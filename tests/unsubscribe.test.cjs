/* eslint-disable @typescript-eslint/no-require-imports */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cwd = process.cwd();
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-unsubscribe-'));
fs.mkdirSync(path.join(fixture, 'data'));
process.chdir(fixture);
require.extensions['.ts'] = (module, filename) => {
  const originalRequire = module.require.bind(module);
  module.require = id => originalRequire(id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : id);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
};
const db = require('../src/lib/db.ts');
const links = require('../src/lib/unsubscribe.ts');
const route = require('../src/app/api/unsubscribe/route.ts');
const subscribers = require('../src/app/api/subscribers/route.ts');
const edit = require('../src/app/api/subscribers/[id]/route.ts');
after(() => { process.chdir(cwd); fs.rmSync(fixture, { recursive: true, force: true }); });
const json = body => new Request('https://mail.test/api/unsubscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('confirmation is idempotent, case insensitive, and suppresses all groups', async () => {
  const group = db.addGroup('unsubscribe group');
  const sub = db.addSubscriber('Recipient@company.co', 'Recipient', [group.id]);
  const token = links.generateUnsubscribeToken('RECIPIENT@company.co');
  for (let i = 0; i < 2; i++) {
    const response = await route.POST(json({ token }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).success, true);
  }
  assert.equal(db.getSubscribers().some(s => s.id === sub.id), false);
  assert.equal(db.getSubscribers(undefined, group.id).length, 0);
  assert.equal(db.getUnsubscribedEmails().filter(s => s.email === 'recipient@company.co').length, 1);
});

test('one-click accepts urlencoded and multipart POST; GET scanners never unsubscribe', async () => {
  for (const format of ['urlencoded', 'multipart']) {
    const email = `${format}@company.co`;
    db.addSubscriber(email);
    const url = links.buildOneClickUnsubscribeUrl('https://mail.test/', email);
    const response = await route.GET(new Request(url));
    assert.equal(response.status, 303);
    assert.equal(db.isEmailSuppressed(email), false);
    const body = format === 'multipart' ? new FormData() : new URLSearchParams();
    body.set('List-Unsubscribe', 'One-Click');
    assert.equal((await route.POST(new Request(url, { method: 'POST', body }))).status, 200);
    assert.equal(db.isEmailSuppressed(email), true);
  }
});

test('invalid tokens and malformed requests never change subscriptions', async () => {
  db.addSubscriber('untouched@company.co');
  const good = links.generateUnsubscribeToken('untouched@company.co');
  const decoded = JSON.parse(Buffer.from(good, 'base64url').toString());
  decoded.email = 'other@company.co';
  const changed = Buffer.from(JSON.stringify(decoded)).toString('base64url');
  for (const token of ['', 'bad', changed, null, {}, 'a'.repeat(3000)]) {
    assert.equal((await route.POST(json({ token }))).status, 400);
  }
  assert.equal((await route.POST(new Request('https://mail.test/api/unsubscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }))).status, 400);
  assert.equal(db.isEmailSuppressed('untouched@company.co'), false);
});

test('imports, manual/group additions, edits and deletion cannot bypass suppression', async () => {
  const sub = db.addSubscriber('blocked@company.co');
  db.unsubscribeByEmail(sub.email);
  const result = db.importSubscribers([{ email: 'BLOCKED@company.co', name: 'Import' }]);
  assert.equal(result.imported, 0);
  assert.equal(result.skipped_rows[0].reason, 'previously_unsubscribed');
  assert.equal(db.isEmailSuppressed(sub.email), true);
  const addResponse = await subscribers.POST(json({ email: sub.email }));
  assert.equal(addResponse.status, 409);
  const active = db.addSubscriber('editable@company.co');
  assert.equal((await edit.PATCH(json({ email: sub.email, name: 'Changed' }), { params: Promise.resolve({ id: String(active.id) }) })).status, 409);
  db.deleteSubscribers([sub.id]);
  assert.throws(() => db.addSubscriber('BLOCKED@company.co'), /email_unsubscribed/);
  assert.equal(db.importSubscribers([{ email: sub.email }]).skipped, 1);
  // Even an externally reactivated row is filtered by the independent suppression list.
  db.getDb().prepare("INSERT INTO subscribers(email,status) VALUES (?, 'active')").run(sub.email);
  assert.equal(db.getSubscribers().some(s => s.email === sub.email), false);
});

test('footer rewrites unsubscribe mailto/old URLs but keeps contact links', () => {
  const url = links.buildUnsubscribeUrl('https://mail.test', 'reader@company.co');
  const html = links.wrapHtmlWithUnsubscribeFooter('<BODY><a href="mailto:sender@company.co">수신 거부</a><a href="/unsubscribe?token=old"><span>Unsubscribe</span></a><a href="mailto:sender@company.co">문의하기</a></BODY>', url);
  assert.match(html, /href="mailto:sender@company.co">문의하기/);
  assert.doesNotMatch(html, /href="mailto:sender@company.co">수신/);
  assert.doesNotMatch(html, /token=old/);
  assert.equal(html.split(url).length - 1, 3);
  assert.ok(html.endsWith('</body>'));
});

test('manual suppression normalizes addresses, excludes existing subscribers, and blocks unregistered addresses', async () => {
  const manual = require('../src/app/api/subscribers/suppress/route.ts');
  const sub = db.addSubscriber('manual-active@company.co');
  for (const email of [' MANUAL-ACTIVE@company.co ', 'new-blocked@company.co', 'new-blocked@company.co']) {
    const response = await manual.POST(json({ email }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).email, email.trim().toLowerCase());
  }
  assert.equal(db.getSubscribers().some(s => s.id === sub.id), false);
  assert.equal(db.getUnsubscribedEmails().filter(s => s.email === 'new-blocked@company.co').length, 1);
  assert.throws(() => db.addSubscriber('new-blocked@company.co'), /email_unsubscribed/);
  const count = db.getUnsubscribedEmails().length;
  for (const body of [null, {}, {email:3}, {email:''}, {email:'invalid'}, {email:'a'.repeat(255)+'@company.co'}]) {
    assert.equal((await manual.POST(json(body))).status, 400);
  }
  assert.equal(db.getUnsubscribedEmails().length, count);
});

test('selected cleanup removes only subscriber records and memberships, retaining suppression and send history', async () => {
  const cleanup = require('../src/app/api/subscribers/suppress/subscribers/route.ts');
  const group = db.addGroup('cleanup group');
  const selected = db.addSubscriber('cleanup-selected@company.co', 'Selected', [group.id]);
  const kept = db.addSubscriber('cleanup-kept@company.co', 'Kept', [group.id]);
  db.unsubscribeByEmail(selected.email);
  db.unsubscribeByEmail(kept.email);
  const history = db.addSendLog('Preserve history', '<p>History</p>', 1, 'sent');
  const response = await cleanup.DELETE(json({ emails: [selected.email.toUpperCase(), selected.email] }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).removed, 1);
  assert.equal(db.getDb().prepare('SELECT id FROM subscribers WHERE id = ?').get(selected.id), undefined);
  assert.equal(db.getDb().prepare('SELECT subscriber_id FROM subscriber_groups WHERE subscriber_id = ?').get(selected.id), undefined);
  assert.ok(db.getDb().prepare('SELECT id FROM subscribers WHERE id = ?').get(kept.id));
  assert.ok(db.getDb().prepare('SELECT id FROM send_log WHERE id = ?').get(history.id));
  assert.equal(db.getUnsubscribedEmails().find(s => s.email === selected.email).subscriber_count, 0);
  assert.equal(db.isEmailSuppressed(selected.email), true);
  assert.throws(() => db.addSubscriber(selected.email), /email_unsubscribed/);
  assert.equal(db.importSubscribers([{email:selected.email}]).skipped, 1);
  assert.equal((await (await cleanup.DELETE(json({emails:[selected.email]}))).json()).removed, 0);
});

test('cleanup rejects malformed and non-suppressed selections and rolls back failures', async () => {
  const cleanup = require('../src/app/api/subscribers/suppress/subscribers/route.ts');
  const group = db.addGroup('cleanup rollback group');
  const one = db.addSubscriber('rollback-one@company.co', '', [group.id]);
  const two = db.addSubscriber('rollback-two@company.co', '', [group.id]);
  db.unsubscribeByEmail(one.email); db.unsubscribeByEmail(two.email);
  const active = db.addSubscriber('cleanup-active@company.co');
  for (const body of [null, {}, {emails:[]}, {emails:[3]}, {emails:['bad']}, {emails:Array(1001).fill(one.email)}, {emails:[one.email,active.email]}]) {
    assert.equal((await cleanup.DELETE(json(body))).status, 400);
  }
  const sql = db.getDb();
  sql.exec(`CREATE TRIGGER fail_cleanup BEFORE DELETE ON subscribers WHEN OLD.id = ${two.id} BEGIN SELECT RAISE(ABORT, 'test failure'); END`);
  try {
    assert.equal((await cleanup.DELETE(json({emails:[one.email,two.email]}))).status, 500);
    for (const sub of [one,two]) {
      assert.ok(sql.prepare('SELECT id FROM subscribers WHERE id = ?').get(sub.id));
      assert.ok(sql.prepare('SELECT subscriber_id FROM subscriber_groups WHERE subscriber_id = ?').get(sub.id));
      assert.equal(db.isEmailSuppressed(sub.email), true);
    }
  } finally { sql.exec('DROP TRIGGER fail_cleanup'); }
});
