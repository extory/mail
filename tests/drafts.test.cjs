/* eslint-disable @typescript-eslint/no-require-imports -- Isolated Node test harness for TypeScript routes. */
const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalCwd = process.cwd();
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-drafts-test-'));
fs.mkdirSync(path.join(fixture, 'data'));
process.chdir(fixture);
require.extensions['.ts'] = (module, filename) => {
  const originalRequire = module.require.bind(module);
  module.require = id => originalRequire(id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : id);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true} }).outputText, filename);
};
const db = require('../src/lib/db.ts');
const routes = require('../src/app/api/drafts/route.ts');
const request = body => new Request('http://localhost/api/drafts', {method:'DELETE', headers:{'content-type':'application/json'}, body:JSON.stringify(body)});
after(() => {process.chdir(originalCwd); fs.rmSync(fixture,{recursive:true,force:true});});

test('bulk deletion removes only selected drafts and their revisions, tolerating duplicates and stale IDs', async () => {
  const first = db.saveDraft('first','<p>one</p>','');
  const second = db.saveDraft('second','<p>two</p>','');
  const keep = db.saveDraft('keep','<p>keep</p>','');
  for (const draft of [first,second,keep]) db.addDraftRevision(draft.id,draft.subject,draft.html_content,'');
  const response = await routes.DELETE(request({ids:[first.id,second.id,first.id,999999]}));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{deleted:2});
  assert.equal(db.getDraft(first.id),undefined);
  assert.equal(db.getDraft(second.id),undefined);
  assert.equal(db.getDraftRevisions(first.id).length,0);
  assert.equal(db.getDraftRevisions(second.id).length,0);
  assert.equal(db.getDraft(keep.id).subject,'keep');
  assert.equal(db.getDraftRevisions(keep.id).length,1);
});

test('invalid or malformed requests never delete drafts', async () => {
  const draft = db.saveDraft('protected','','');
  const before = db.getDrafts();
  for (const body of [null,{}, {ids:[]}, {ids:'all'}, {ids:[draft.id,0]}, {ids:[draft.id,-1]}, {ids:[draft.id,'2']}, {ids:[draft.id,1.5]}, {ids:[draft.id,Number.MAX_SAFE_INTEGER+1]}]) {
    assert.equal((await routes.DELETE(request(body))).status,400);
    assert.deepEqual(db.getDrafts(),before);
  }
  assert.equal((await routes.DELETE(new Request('http://localhost/api/drafts',{method:'DELETE',body:'{'}))).status,400);
});

test('database failures roll back both draft deletion and revision cleanup', () => {
  const first = db.saveDraft('rollback first','','');
  const second = db.saveDraft('rollback second','','');
  for (const draft of [first,second]) db.addDraftRevision(draft.id,draft.subject,'','');
  const Database = require('better-sqlite3');
  const connection = new Database(path.join(fixture,'data','mail.db'));
  connection.exec(`CREATE TRIGGER prevent_test_delete BEFORE DELETE ON drafts WHEN OLD.id = ${second.id} BEGIN SELECT RAISE(ABORT, 'test failure'); END;`);
  try {
    assert.throws(() => db.deleteDrafts([first.id,second.id]),/test failure/);
    assert.ok(db.getDraft(first.id));
    assert.ok(db.getDraft(second.id));
    assert.equal(db.getDraftRevisions(first.id).length,1);
    assert.equal(db.getDraftRevisions(second.id).length,1);
  } finally {connection.exec('DROP TRIGGER prevent_test_delete'); connection.close();}
});
