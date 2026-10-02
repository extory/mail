/* eslint-disable @typescript-eslint/no-require-imports -- Isolated Node test harness for TypeScript routes. */
const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalCwd = process.cwd();
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-import-test-'));
fs.mkdirSync(path.join(fixture, 'data'));
process.chdir(fixture);
require.extensions['.ts'] = (module, filename) => {
  const originalRequire = module.require.bind(module);
  module.require = id => originalRequire(id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : id);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true} }).outputText, filename);
};
const db = require('../src/lib/db.ts');
const routes = require('../src/app/api/subscribers/import/route.ts');
const iconv = require('iconv-lite');
const upload = (file, groupId) => {
  const form = new FormData(); form.append('file',file);
  if (groupId) form.append('groupIds',String(groupId));
  return routes.POST(new Request('http://localhost/api/subscribers/import',{method:'POST',body:form}));
};
after(() => {process.chdir(originalCwd); fs.rmSync(fixture,{recursive:true,force:true});});

test('XLSX first sheet imports Korean headers, names and groups with duplicates reported', async () => {
  const group = db.addGroup('Default');
  const response = await upload(new File([fs.readFileSync(path.join(__dirname,'fixtures/subscribers.xlsx'))],'SUBSCRIBERS.XLSX'),group.id);
  assert.equal(response.status,200);
  const result = await response.json();
  assert.equal(result.imported,2);
  assert.equal(result.skipped,2);
  assert.equal(result.created_groups,2);
  assert.deepEqual(result.skipped_rows.map(r=>r.reason),['duplicate_in_csv','invalid_email']);
  const hong = db.getSubscribers().find(s=>s.email==='hong@example.com');
  assert.equal(hong.name,'홍길동');
  assert.deepEqual(hong.groups.map(g=>g.name).sort(),['Default','VIP','소식'].sort());
  assert.equal(db.getSubscribers().some(s=>s.email==='ignored@example.com'),false);
});

test('CSV keeps UTF-8 BOM, quoted commas, CP949, headerless and existing-subscriber behavior', async () => {
  let response = await upload(new File(['\ufeffemail,name,groups\r\nbom@example.com,"Last, First",VIP'],'bom.csv'));
  assert.equal(response.status,200);
  assert.equal(db.getSubscribers().find(s=>s.email==='bom@example.com').name,'Last, First');
  response = await upload(new File([iconv.encode('email,name\ncp949@example.com,한글 이름','cp949')],'legacy.csv'));
  assert.equal(response.status,200);
  assert.equal(db.getSubscribers().find(s=>s.email==='cp949@example.com').name,'한글 이름');
  response = await upload(new File(['hong@example.com,변경된 이름'],'headerless.csv'));
  assert.equal((await response.json()).updated,1);
  assert.equal(db.getSubscribers().find(s=>s.email==='hong@example.com').name,'변경된 이름');
});

test('invalid, unsupported, oversized and empty files leave subscribers unchanged', async () => {
  const before = db.getSubscribers();
  for (const [file,error] of [
    [new File(['not a workbook'],'bad.xlsx'),'invalid_file'],
    [new File(['email,name'],'old.xls'),'unsupported_format'],
    [new File([''],'empty.csv'),'empty_file'],
    [new File(['email,name'],'headers.csv'),'empty_file'],
    [new File(['name,groups\nA,VIP'],'missing.csv'),'missing_email_column'],
    [new File([new Uint8Array(10*1024*1024+1)],'large.xlsx'),'file_too_large'],
  ]) {
    const response = await upload(file);
    assert.equal(response.status,400);
    assert.equal((await response.json()).error,error);
  }
  const form = new FormData(); form.append('file','fake');
  assert.equal((await routes.POST(new Request('http://localhost',{method:'POST',body:form}))).status,400);
  assert.deepEqual(db.getSubscribers(),before);
});
