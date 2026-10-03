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
