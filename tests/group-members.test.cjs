/* eslint-disable @typescript-eslint/no-require-imports -- Isolated Node test harness for TypeScript routes. */
const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalCwd = process.cwd();
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-group-members-test-'));
fs.mkdirSync(path.join(fixture, 'data'));
process.chdir(fixture);
require.extensions['.ts'] = (module, filename) => {
  const originalRequire = module.require.bind(module);
  module.require = id => originalRequire(id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : id);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true} }).outputText, filename);
};
const db = require('../src/lib/db.ts');
const routes = require('../src/app/api/groups/[id]/members/route.ts');
const request = ids => new Request('http://localhost/api/groups/1/members',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({ids})});
const context = id => ({params:Promise.resolve({id:String(id)})});
const Database = require('better-sqlite3');
after(() => {process.chdir(originalCwd); fs.rmSync(fixture,{recursive:true,force:true});});

test('remove selected membership only, retain subscribers and other groups even after legacy migration', async () => {
  const group = db.addGroup('target');
  const other = db.addGroup('other');
  const selected = db.addSubscriber('selected@example.com','Selected',[group.id,other.id]);
  const keep = db.addSubscriber('keep@example.com','Keep',[group.id]);
  const outsider = db.addSubscriber('outsider@example.com','Outsider',[other.id]);
  const connection = new Database(path.join(fixture,'data','mail.db'));
  try {
    connection.prepare('UPDATE subscribers SET group_id = ? WHERE id = ?').run(group.id,selected.id);
    const response = await routes.DELETE(request([selected.id,selected.id,outsider.id,999999]),context(group.id));
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{removed:1});
    assert.deepEqual(db.getSubscribers(undefined,group.id).map(s=>s.id),[keep.id]);
    assert.ok(db.getSubscribers(undefined,other.id).some(s=>s.id===selected.id));
    assert.equal(db.getSubscribers().length,3);
    assert.equal(db.getGroups().find(g=>g.id===group.id).subscriber_count,1);
    connection.exec('INSERT OR IGNORE INTO subscriber_groups (subscriber_id, group_id) SELECT id, group_id FROM subscribers WHERE group_id IS NOT NULL');
    assert.deepEqual(db.getSubscribers(undefined,group.id).map(s=>s.id),[keep.id]);
  } finally {connection.close();}
});

test('reject invalid selection and unknown group without modifying memberships', async () => {
  const before = db.getSubscribers();
  for (const ids of [[],null,'all',[0],[-1],['1'],[1.5],[1,Number.MAX_SAFE_INTEGER+1]]) {
    assert.equal((await routes.DELETE(request(ids),context(1))).status,400);
  }
  for (const id of ['bad','0','-1','1.5','9007199254740992']) {
    assert.equal((await routes.DELETE(request([1]),context(id))).status,400);
  }
  assert.equal((await routes.DELETE(request([1]),context(999999))).status,404);
  assert.equal((await routes.DELETE(new Request('http://localhost',{method:'DELETE',body:'{'}),context(1))).status,400);
  assert.deepEqual(db.getSubscribers(),before);
});

test('failed membership removal rolls back all selected rows', () => {
  const group = db.addGroup('rollback');
  const first = db.addSubscriber('rollback1@example.com','',[group.id]);
  const second = db.addSubscriber('rollback2@example.com','',[group.id]);
  const connection = new Database(path.join(fixture,'data','mail.db'));
  connection.exec(`CREATE TRIGGER prevent_member_delete BEFORE DELETE ON subscriber_groups WHEN OLD.subscriber_id = ${second.id} BEGIN SELECT RAISE(ABORT, 'test failure'); END;`);
  try {
    assert.throws(()=>db.removeGroupMembers(group.id,[first.id,second.id]),/test failure/);
    assert.equal(db.getSubscribers(undefined,group.id).length,2);
  } finally {connection.exec('DROP TRIGGER prevent_member_delete'); connection.close();}
});

const subscriberRoutes = require('../src/app/api/subscribers/[id]/route.ts');
const editRequest = body => new Request('http://localhost/api/subscribers/1',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(body)});

test('editing subscriber updates all group views while preserving ID, membership and status', async () => {
  const one = db.addGroup('edit one');
  const two = db.addGroup('edit two');
  const sub = db.addSubscriber('before@example.com','Before',[one.id,two.id]);
  const response = await subscriberRoutes.PATCH(editRequest({email:' after@example.com ',name:' After '}),context(sub.id));
  assert.equal(response.status,200);
  const updated = await response.json();
  assert.equal(updated.id,sub.id);
  assert.equal(updated.email,'after@example.com');
  assert.equal(updated.name,'After');
  assert.equal(updated.status,sub.status);
  assert.equal(updated.created_at,sub.created_at);
  assert.deepEqual(updated.groups,sub.groups);
  for (const group of [one,two]) {
    assert.equal(db.getSubscribers(undefined,group.id)[0].email,'after@example.com');
    assert.equal(db.getSubscribers(undefined,group.id)[0].name,'After');
  }
  db.removeSubscriber(sub.id);
  const cleared = await (await subscriberRoutes.PATCH(editRequest({email:'after@example.com',name:''}),context(sub.id))).json();
  assert.equal(cleared.name,null);
  assert.equal(cleared.status,'unsubscribed');
  assert.deepEqual(cleared.groups,sub.groups);
});

test('duplicate addresses and invalid edits do not change subscriber records', async () => {
  const sub = db.addSubscriber('edit-protected@example.com','Original',[]);
  db.addSubscriber('taken@example.com','Other',[]);
  const before = db.getSubscribers();
  assert.equal((await subscriberRoutes.PATCH(editRequest({email:'TAKEN@example.com',name:'Wrong'}),context(sub.id))).status,409);
  for (const body of [null,{}, {email:3,name:'a'}, {email:'bad',name:'a'}, {email:'x@example.com',name:3}, {email:'x@example.com',name:'x'.repeat(201)}, {email:'x'.repeat(255)+'@example.com',name:'a'}]) {
    assert.equal((await subscriberRoutes.PATCH(editRequest(body),context(sub.id))).status,400);
  }
  assert.equal((await subscriberRoutes.PATCH(editRequest({email:'ok@example.com',name:'ok'}),context('1 OR 1=1'))).status,400);
  assert.equal((await subscriberRoutes.PATCH(editRequest({email:'ok@example.com',name:'ok'}),context(999999))).status,404);
  assert.equal((await subscriberRoutes.PATCH(new Request('http://localhost',{method:'PATCH',body:'{'}),context(sub.id))).status,400);
  assert.deepEqual(db.getSubscribers(),before);
});
