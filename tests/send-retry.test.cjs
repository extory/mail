/* eslint-disable @typescript-eslint/no-require-imports -- Isolated Node test harness for TypeScript routes. */
const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalCwd = process.cwd();
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-send-test-'));
fs.mkdirSync(path.join(fixture, 'data'));
process.chdir(fixture);
require.extensions['.ts'] = (module, filename) => {
  const originalRequire = module.require.bind(module);
  module.require = id => originalRequire(id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : id);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true} }).outputText, filename);
};
const db = require('../src/lib/db.ts');
const tracking = require('../src/lib/send-tracking.ts');
process.env.RESEND_API_KEY = 'test-only-never-send';
const mail = require('../src/lib/resend.ts');
const retryRoute = require('../src/app/api/history/[id]/retry/route.ts');
const originalFetch = globalThis.fetch;
let requests = [], reply, counter = 0;
globalThis.fetch = async (url, options) => {
  assert.match(String(url),/^https:\/\/api.resend.com\/emails/);
  const payload = JSON.parse(options.body);
  requests.push({url:String(url),payload,headers:new Headers(options.headers)});
  return reply(payload,requests.length);
};
const ok = payload => new Response(JSON.stringify(Array.isArray(payload)
  ? {data:payload.map(()=>({id:`provider-${++counter}`})),errors:[]}
  : {id:`provider-${++counter}`}),{status:200,headers:{'content-type':'application/json'}});
const seed = (count,prefix) => Array.from({length:count},(_,i)=>db.addSubscriber(`${prefix}${i}@real-company.co`,'Recipient',[]));
const newLog = recipients => db.addSendLog('Subject','<p>{{name}}</p>',recipients.length,'sending');
after(() => {globalThis.fetch=originalFetch;process.chdir(originalCwd);fs.rmSync(fixture,{recursive:true,force:true});});

test('420 valid recipients: persist 320 successes and retry only the 100 rejected recipients', async () => {
  const recipients = seed(420,'bulk');
  recipients.push(db.addSubscriber('sample@example.com','Example',[]));
  const log = newLog(recipients);
  requests=[];
  reply = (payload,index) => index === 2
    ? new Response(JSON.stringify({name:'validation_error',message:'Invalid to field'}),{status:422}) : ok(payload);
  let result = await mail.sendBulkEmails(log.subject,log.html_content,recipients,log.id);
  assert.equal(result.success,320); assert.equal(result.retryable,100); assert.equal(result.blocked,1);
  assert.equal(tracking.getSendReport(log.id).accepted.length,320);
  assert.ok(requests.every(r=>r.payload.every(email=>!email.to[0].endsWith('@example.com'))));
  assert.ok(requests.every(r=>r.headers.get('idempotency-key')));
  const failedEmails = tracking.getSendReport(log.id).recipients.filter(r=>r.state==='failed').map(r=>r.email);
  requests=[]; reply=ok;
  result = await mail.retryUnsentEmails(log.id);
  assert.equal(result.success,420); assert.equal(result.retryable,0);
  assert.deepEqual(requests.flatMap(r=>r.payload.map(e=>e.to[0])),failedEmails);
  requests=[]; await mail.retryUnsentEmails(log.id); assert.equal(requests.length,0);
});

test('permissive batch maps provider IDs past rejected indexes correctly', async () => {
  const recipients=seed(3,'partial'); const log=newLog(recipients); requests=[];
  reply=()=>new Response(JSON.stringify({data:[{id:'mapped-first'},{id:'mapped-third'}],errors:[{index:1,message:'Invalid to field'}]}),{status:200});
  const result=await mail.sendBulkEmails(log.subject,log.html_content,recipients,log.id);
  assert.equal(result.success,2); assert.equal(result.blocked,1);
  const rows=tracking.getSendReport(log.id).recipients;
  assert.equal(rows[0].resend_id,'mapped-first'); assert.equal(rows[1].state,'blocked'); assert.equal(rows[2].resend_id,'mapped-third');
  assert.equal(requests[0].headers.get('x-batch-validation'),'permissive');
});

test('unknown outcomes and malformed successes are never retried; no fake success IDs', async () => {
  for (const response of [()=>{throw new Error('timeout')},()=>new Response(JSON.stringify({data:[]}),{status:200})]) {
    const recipients=seed(1,`unknown${counter++}`); const log=newLog(recipients); requests=[]; reply=response;
    const result=await mail.sendBulkEmails(log.subject,log.html_content,recipients,log.id);
    assert.equal(result.unknown,1); assert.equal(result.success,0); assert.equal(result.retryable,0);
    requests=[]; reply=ok; await mail.retryUnsentEmails(log.id); assert.equal(requests.length,0);
    assert.equal(tracking.getSendReport(log.id).accepted.length,0);
  }
});

test('concurrent resend is locked and removed/unsubscribed recipients are excluded', async () => {
  const recipients=seed(3,'exclude'); const log=newLog(recipients);
  tracking.initializeSend(log.id,recipients,false);
  db.removeSubscriber(recipients[0].id);
  db.deleteSubscribers([recipients[1].id]);
  let release; reply=payload=>new Promise(resolve=>{release=()=>resolve(ok(payload));});requests=[];
  const pending=mail.retryUnsentEmails(log.id);
  await new Promise(resolve=>setImmediate(resolve));
  await assert.rejects(mail.retryUnsentEmails(log.id),/already in progress/);
  release(); await pending;
  const report=tracking.getSendReport(log.id);
  assert.equal(report.success,1); assert.equal(report.skipped,2);
  assert.deepEqual(requests.flatMap(r=>r.payload.map(e=>e.to[0])),[recipients[2].email]);
});

test('interrupted processing becomes unknown while never-attempted recipients remain retryable', async () => {
  const recipients=seed(2,'interrupted'); const log=newLog(recipients);
  tracking.initializeSend(log.id,recipients,false);
  const token=tracking.claimSend(log.id);
  tracking.setRecipientResult(tracking.getSendReport(log.id).recipients[0],'sending');
  db.getDb().prepare('UPDATE send_tracking SET lock_until=0 WHERE send_log_id=?').run(log.id);
  reply=ok; requests=[]; await mail.retryUnsentEmails(log.id);
  assert.equal(tracking.getSendReport(log.id).unknown,1);
  assert.equal(tracking.getSendReport(log.id).success,1);
  assert.equal(requests[0].payload[0].to[0],recipients[1].email);
  tracking.finishSend(log.id,token);
});

test('legacy recovery requires original list and full provider records, preserving accepted recipients', async () => {
  const recipients=seed(2,'legacy'); const log=db.addSendLog('Old','<p>Old</p>',1,'partial');
  db.saveSentEmail(log.id,'legacy-real',recipients[0].email);
  assert.throws(()=>tracking.recoverLegacySend(log.id,[recipients[1].email],false),/complete original/);
  const report=tracking.recoverLegacySend(log.id,recipients.map(r=>r.email),false);
  assert.equal(report.success,1); assert.equal(report.retryable,1);
  requests=[]; reply=ok; await mail.retryUnsentEmails(log.id);
  assert.equal(requests[0].payload[0].to[0],recipients[1].email);
  const unsafe=db.addSendLog('Unsafe','x',1,'partial'); db.saveSentEmail(unsafe.id,'local-fake',recipients[0].email);
  assert.throws(()=>tracking.recoverLegacySend(unsafe.id,recipients.map(r=>r.email),false),/Incomplete/);
});

test('retry endpoint requires confirmation and handles nonexistent history', async () => {
  const context=id=>({params:Promise.resolve({id:String(id)})});
  requests=[];
  assert.equal((await retryRoute.POST(new Request('http://localhost',{method:'POST',body:'{}'}),context(1))).status,400);
  assert.equal((await retryRoute.POST(new Request('http://localhost',{method:'POST',body:JSON.stringify({confirmed:true})}),context(999999))).status,404);
  assert.equal(requests.length,0);
});

test('CID images use single-email API with attachments and retry keeps stored send content', async () => {
  const recipients=seed(1,'cid');
  fs.mkdirSync(path.join(fixture,'public','uploads'),{recursive:true});
  fs.writeFileSync(path.join(fixture,'public','uploads','qa.png'),Buffer.from('image'));
  const html='<p>{{name}}</p><img src="/uploads/qa.png">';
  const log=db.addSendLog('CID subject',html,1,'sending');
  requests=[]; reply=ok;
  const result=await mail.sendBulkEmails(log.subject,html,recipients,log.id,{embedImages:true});
  assert.equal(result.success,1);
  assert.equal(requests[0].url,'https://api.resend.com/emails');
  assert.equal(requests[0].payload.subject,'CID subject');
  assert.equal(requests[0].payload.attachments.length,1);
  assert.match(requests[0].payload.html,/src="cid:img1"/);
});

test('unsubscribe suppresses frozen retries and supplies per-recipient HTTP unsubscribe headers', async () => {
  const recipients = seed(2, 'optout');
  const log = newLog(recipients);
  requests = [];
  reply = () => new Response(JSON.stringify({ name: 'rate_limit_exceeded', message: 'Retry later' }), { status: 429 });
  await mail.sendBulkEmails(log.subject, log.html_content, recipients, log.id);
  const first = requests[0].payload[0];
  assert.match(first.headers['List-Unsubscribe'], /\/api\/unsubscribe\?token=/);
  assert.equal(first.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.match(first.html, /\/unsubscribe\?token=/);
  db.unsubscribeByEmail(recipients[0].email);
  requests = []; reply = ok;
  await mail.retryUnsentEmails(log.id);
  assert.deepEqual(requests.flatMap(r => r.payload.map(email => email.to[0])), [recipients[1].email]);
});

test('scheduled delivery excludes recipients who unsubscribe after scheduling', async () => {
  const group = db.addGroup('scheduled suppression');
  const blocked = db.addSubscriber('scheduled-blocked@real-company.co', '', [group.id]);
  const allowed = db.addSubscriber('scheduled-allowed@real-company.co', '', [group.id]);
  db.createScheduledSend('Scheduled optout', '<p>Scheduled</p>', null, group.id, false, '2020-01-01T00:00:00.000Z', null);
  db.unsubscribeByEmail(blocked.email);
  requests = []; reply = ok;
  const { tickScheduler } = require('../src/lib/scheduler.ts');
  await tickScheduler();
  assert.deepEqual(requests.flatMap(r => r.payload.map(email => email.to[0])), [allowed.email]);
});

test('deleted unsubscribed recipients remain blocked even if subscriber records are recreated externally', async () => {
  const recipient = db.addSubscriber('never-send-again@real-company.co');
  const log = newLog([recipient]);
  tracking.initializeSend(log.id, [recipient], false);
  db.unsubscribeByEmail(recipient.email);
  db.deleteSuppressedSubscribers([recipient.email]);
  db.getDb().prepare("INSERT INTO subscribers(email,status) VALUES (?, 'active')").run(recipient.email);
  requests = []; reply = ok;
  await mail.retryUnsentEmails(log.id);
  assert.equal(requests.length, 0);
  const report = tracking.getSendReport(log.id);
  assert.equal(report.recipients[0].state, 'skipped');
  assert.equal(db.isEmailSuppressed(recipient.email), true);
});

test('QR images use absolute URLs in normal delivery and CID attachments when requested', async () => {
  const { createQrBlock } = require('../src/lib/qr-code.ts');
  const recipient = db.addSubscriber('qr-reader@real-company.co');
  fs.mkdirSync(path.join(fixture,'public','uploads'),{recursive:true});
  fs.writeFileSync(path.join(fixture,'public','uploads','qr-test.png'), Buffer.from('qr-test-fixture'));
  const html = createQrBlock('/uploads/qr-test.png','https://example.com/event');
  for (const embedImages of [false,true]) {
    const log = db.addSendLog('QR email',html,1,'sending');
    requests=[]; reply=ok;
    await mail.sendBulkEmails(log.subject,html,[recipient],log.id,{embedImages});
    const payload=embedImages ? requests[0].payload : requests[0].payload[0];
    assert.match(payload.html,embedImages ? /src="cid:img1"/ : /src="https:\/\/mail.extory.co\/uploads\/qr-test.png"/);
    assert.ok(payload.html.includes('https://example.com/event'));
    if(embedImages) assert.equal(payload.attachments.length,1);
  }
});

test('report API includes saved delivery results for tracked and legacy sends without changing retry eligibility', async () => {
  const route = require('../src/app/api/history/[id]/route.ts');
  for (const tracked of [true, false]) {
    const recipient = seed(1, `report-${tracked}`)[0];
    const log = db.addSendLog('Report', '<p>Report</p>', 1, 'sent');
    const providerId = `report-provider-${tracked}`;
    if (tracked) {
      tracking.initializeSend(log.id, [recipient], false);
      tracking.setRecipientResult(tracking.getSendReport(log.id).recipients[0], 'accepted', undefined, providerId);
    } else db.saveSentEmail(log.id, providerId, recipient.email);
    db.recordEmailEvent(providerId, 'opened');
    const response = await route.GET(new Request('http://localhost'), {params: Promise.resolve({id: String(log.id)})});
    const report = await response.json();
    assert.equal(report.tracked, tracked);
    assert.equal(report.accepted[0].recipient_email, recipient.email);
    assert.equal(report.accepted[0].last_event, 'opened');
    assert.equal(report.retryable, 0);
  }
});

test('hard-bounce removal validates the campaign and preserves history and statistics', async () => {
  const route = require('../src/app/api/history/[id]/hard-bounces/route.ts');
  const group = db.addGroup('Hard bounce cleanup');
  const recipients = ['hard', 'soft', 'unknown'].map(prefix => db.addSubscriber(`${prefix}-cleanup@real-company.co`, '', [group.id]));
  const log = db.addSendLog('Cleanup', '<p>Cleanup</p>', 3, 'sent');
  recipients.forEach((r, i) => {
    db.saveSentEmail(log.id, `cleanup-${i}`, r.email);
    db.recordEmailEvent(`cleanup-${i}`, 'bounced', i === 2 ? JSON.stringify({source:'resend_csv_recovery'}) : JSON.stringify({type:i === 0 ? 'Permanent' : 'Transient',message:'Provider reason'}));
  });
  const report = tracking.getSendReport(log.id);
  assert.deepEqual(report.accepted.map(r => r.hardBounce), [true, false, false]);
  assert.equal(report.accepted[0].bounceReason, 'Provider reason');
  const request = body => new Request('http://localhost', {method:'DELETE',body:JSON.stringify(body)});
  const context = id => ({params:Promise.resolve({id:String(id)})});
  assert.equal((await route.DELETE(request({emails:[recipients[0].email]}),context(log.id))).status,400);
  assert.equal((await route.DELETE(request({confirmed:true,emails:[recipients[0].email, 'unrelated@real-company.co']}),context(log.id))).status,400);
  assert.ok(db.getDb().prepare('SELECT id FROM subscribers WHERE id=?').get(recipients[0].id));
  const other = db.addSendLog('Other', 'x', 0, 'sent');
  assert.equal((await route.DELETE(request({confirmed:true,emails:[recipients[0].email]}),context(other.id))).status,400);
  const before = db.getSendLogStats().find(r=>r.send_log_id===log.id);
  const response = await route.DELETE(request({confirmed:true,emails:[recipients[0].email.toUpperCase(),recipients[0].email]}),context(log.id));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{deleted:1});
  assert.equal(db.getDb().prepare('SELECT id FROM subscribers WHERE id=?').get(recipients[0].id),undefined);
  assert.equal(db.getDb().prepare('SELECT 1 FROM subscriber_groups WHERE subscriber_id=?').get(recipients[0].id),undefined);
  assert.equal(tracking.getSendReport(log.id).accepted[0].subscriberExists,false);
  assert.deepEqual(db.getSendLogStats().find(r=>r.send_log_id===log.id),before);
  assert.deepEqual(await (await route.DELETE(request({confirmed:true,emails:[recipients[0].email]}),context(log.id))).json(),{deleted:0});
  assert.equal((await route.DELETE(request({confirmed:true,emails:[recipients[0].email]}),context(999999))).status,404);
  assert.equal((await route.DELETE(new Request('http://localhost',{method:'DELETE',body:'bad json'}),context(log.id))).status,400);
});

test('unknown bounce details remain unclassified but explicitly bounced addresses can be deleted', () => {
  const r = seed(1,'malformed-bounce')[0];
  const log = db.addSendLog('Unknown bounce', 'x', 1, 'sent');
  db.saveSentEmail(log.id,'malformed-bounce-id',r.email);
  for (const data of ['not json', 'null', '{"type":"Undetermined"}', '{"message":"hard bounce"}']) {
    db.recordEmailEvent('malformed-bounce-id','bounced',data);
    assert.equal(tracking.getSendReport(log.id).accepted[0].hardBounce,false);
    assert.equal(tracking.getSendReport(log.id).accepted[0].bounced,true);
  }
  assert.equal(tracking.deleteHardBouncedSubscribers(log.id,[r.email]),1);
});

test('suppression statistics include old imports and webhooks without counting ordinary failures; manual removal preserves results', async () => {
  const route = require('../src/app/api/history/[id]/hard-bounces/route.ts');
  const recipients = seed(6, 'suppression-cleanup');
  const log = newLog(recipients);
  const events = [
    ['suppressed', JSON.stringify({reason:'suppressed'})],
    ['failed', JSON.stringify({source:'resend_csv_recovery',provider_state:'suppressed'})],
    ['failed', JSON.stringify({reason:'suppressed',details:{reason:'Previously bounced'}})],
    ['failed', JSON.stringify({message:'ordinary failure'})],
    ['failed', 'invalid json'],
    ['failed', JSON.stringify({message:'suppressed'})],
  ];
  recipients.forEach((r,i) => {
    db.saveSentEmail(log.id, `suppressed-cleanup-${i}`, r.email);
    db.recordEmailEvent(`suppressed-cleanup-${i}`, ...events[i]);
  });
  // Duplicate notifications still count each email only once.
  db.recordEmailEvent('suppressed-cleanup-0', ...events[0]);
  const before = db.getOverallStats();
  const stats = db.getSendLogStats().find(r=>r.send_log_id===log.id);
  assert.equal(stats.suppressed,3);
  assert.equal(stats.failed,3);
  assert.ok(before.total_suppressed >= 3);
  assert.deepEqual(db.getDashboardData().emailStats, before);
  const report = tracking.getSendReport(log.id);
  assert.deepEqual(report.accepted.map(r=>r.suppressed), [true,true,true,false,false,false]);
  assert.equal(report.accepted[1].last_event,'suppressed');
  const remove = emails => route.DELETE(new Request('http://localhost', {method:'DELETE', body:JSON.stringify({confirmed:true, emails})}), {params:Promise.resolve({id:String(log.id)})});
  assert.equal((await remove([recipients[0].email,recipients[3].email])).status,400);
  assert.equal(tracking.getSendReport(log.id).accepted[0].subscriberExists,true);
  const result = await remove(recipients.slice(0,3).map(r=>r.email));
  assert.equal(result.status,200);
  assert.deepEqual(await result.json(), {deleted:3});
  assert.deepEqual(db.getOverallStats(),before);
  assert.deepEqual(db.getSendLogStats().find(r=>r.send_log_id===log.id),stats);
  assert.deepEqual(tracking.getSendReport(log.id).accepted.map(r=>r.subscriberExists),[false,false,false,true,true,true]);
});

test('server report filters classify all bounce types and page before returning recipients', async () => {
  const route = require('../src/app/api/history/[id]/route.ts');
  for (const tracked of [false,true]) {
    const recipients = seed(8, `filter-${tracked}`);
    const log = newLog(recipients);
    if (tracked) tracking.initializeSend(log.id,recipients,false);
    const events = ['bounced','bounced','bounced','suppressed','failed','delivered','sent','delivery_delayed'];
    recipients.forEach((r,i)=> {
      const providerId = `filter-${tracked}-${i}`;
      if (tracked) tracking.setRecipientResult(tracking.getSendReport(log.id).recipients[i],'accepted',undefined,providerId);
      else db.saveSentEmail(log.id,providerId,r.email);
      db.recordEmailEvent(providerId,events[i],i===0?'malformed':JSON.stringify({type:i===1?'Permanent':i===2?'Transient':undefined}));
    });
    const get = async (filter,page=1) => {
      const response = await route.GET(new Request(`http://localhost/api/history/${log.id}?page=${page}&pageSize=2&filter=${filter}`),{params:Promise.resolve({id:String(log.id)})});
      assert.equal(response.status,200);
      return response.json();
    };
    const all = await get('all');
    assert.equal(all.pagination.total,8);
    assert.equal(all.recipients.length,2);
    assert.equal(all.accepted.length,2);
    assert.equal(all.counts.unreached,7);
    assert.equal(all.counts.hard_bounce,1);
    assert.equal(all.counts.soft_bounce,1);
    const bounced = await get('bounced',2);
    assert.equal(bounced.pagination.total,3);
    assert.equal(bounced.recipients.length,1);
    assert.equal(bounced.accepted[0].softBounce,true);
    const clamped = await get('bounced',999);
    assert.equal(clamped.pagination.page,2);
    const delivered = await get('delivered');
    assert.equal(delivered.pagination.total,1);
    assert.equal(delivered.accepted[0].last_event,'delivered');
    const empty = await get('clicked');
    assert.equal(empty.pagination.total,0);
    assert.equal(empty.recipients.length,0);
    assert.equal((await route.GET(new Request('http://localhost?filter=invalid'),{params:Promise.resolve({id:String(log.id)})})).status,400);
    assert.equal(tracking.deleteHardBouncedSubscribers(log.id,recipients.slice(0,3).map(r=>r.email)),3);
    assert.equal((await get('bounced')).counts.bounced,3);
  }
});

test('server list pagination bounds sizes, filters before paging, and keeps overall totals', async () => {
  const {readPage} = require('../src/lib/server-pagination.ts');
  assert.deepEqual(readPage(new URLSearchParams('page=-2&pageSize=99999')),{page:1,pageSize:200});
  assert.deepEqual(readPage(new URLSearchParams('page=NaN&pageSize=0')),{page:1,pageSize:30});
  const group = db.addGroup('Paging fixture');
  const recipients = seed(7,'paging-fixture');
  recipients.slice(0,4).forEach(r=>db.updateSubscriberGroups(r.id,[group.id]));
  const first = db.querySubscribers('paging-fixture',group.id,{page:1,pageSize:3});
  const last = db.querySubscribers('paging-fixture',group.id,{page:2,pageSize:3});
  assert.equal(first.total,4);
  assert.equal(first.items.length,3);
  assert.equal(last.items.length,1);
  assert.equal(new Set([...first.items,...last.items].map(r=>r.id)).size,4);
  assert.equal(db.querySubscribers('paging-fixture%',group.id,{page:1,pageSize:3}).total,0);
  const clamped = db.querySubscribers('paging-fixture',group.id,{page:999,pageSize:3});
  assert.equal(clamped.page,2);
  const history = require('../src/app/api/history/route.ts');
  const statistics = require('../src/app/api/statistics/route.ts');
  const h = await (await history.GET(new Request('http://localhost?page=1&pageSize=2'))).json();
  const stats = await (await statistics.GET(new Request('http://localhost?page=1&pageSize=2'))).json();
  assert.equal(h.items.length,2);
  assert.equal(stats.campaigns.length,2);
  assert.equal(stats.total,h.total);
  assert.deepEqual(stats.overall, db.getOverallStats());
  assert.deepEqual(stats.campaigns.map(r=>r.send_log_id),h.items.map(r=>r.id));
});
