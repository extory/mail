/* eslint-disable @typescript-eslint/no-require-imports -- Isolated Node test harness for TypeScript routes. */
const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalCwd = process.cwd();
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-images-test-'));
fs.mkdirSync(path.join(fixture, 'data'));
process.chdir(fixture);
require.extensions['.ts'] = (module, filename) => {
  const originalRequire = module.require.bind(module);
  module.require = id => originalRequire(id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : id);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true} }).outputText, filename);
};
const db = require('../src/lib/db.ts');
const validators = require('../src/lib/image-library.ts');
const uploads = require('../src/app/api/uploads/route.ts');
const collection = require('../src/app/api/images/route.ts');
const item = require('../src/app/api/images/[id]/route.ts');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const jsonRequest = body => new Request('http://localhost/api/images', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const context = id => ({params:Promise.resolve({id:String(id)})});
after(() => {process.chdir(originalCwd); fs.rmSync(fixture,{recursive:true,force:true});});

test('metadata validation rejects empty, oversized and non-string fields', () => {
  assert.equal(validators.imageMetadata(null),null);
  assert.equal(validators.imageMetadata({name:' '}),null);
  assert.equal(validators.imageMetadata({name:'x'.repeat(121)}),null);
  assert.equal(validators.imageMetadata({name:'logo',description:{}}),null);
  assert.equal(validators.imageMetadata({name:'logo',description:'x'.repeat(1001)}),null);
  assert.deepEqual(validators.imageMetadata({name:' 로고 ',description:' 회사 '}),{name:'로고',description:'회사'});
});
test('upload, save, list, update, deduplicate, delete and retain image for sent emails', async () => {
  const form = new FormData(); form.append('file',new File([png],'logo.html',{type:'image/png'}));
  const response = await uploads.POST(new Request('http://localhost/api/uploads',{method:'POST',body:form}));
  assert.equal(response.status,200);
  const uploaded = await response.json();
  assert.match(uploaded.url,/^\/uploads\/[a-f0-9]{24}\.png$/);
  const savedRes = await collection.POST(jsonRequest({url:uploaded.url,name:'회사 로고',description:'메일 상단 중앙'}));
  assert.equal(savedRes.status,200); const saved = await savedRes.json();
  const duplicate = await (await collection.POST(jsonRequest({url:uploaded.url,name:'새 이름',description:'푸터'}))).json();
  assert.equal(duplicate.id,saved.id);
  let list = await (await collection.GET()).json();
  assert.equal(list.length,1); assert.equal(list[0].description,'푸터');
  const edited = await item.PATCH(jsonRequest({name:'최종 로고',description:'본문 상단'}),context(saved.id));
  assert.equal(edited.status,200); assert.equal((await edited.json()).description,'본문 상단');
  assert.equal((await item.DELETE(new Request('http://localhost'),context(saved.id))).status,200);
  list = db.getSavedImages(); assert.equal(list.length,0);
  assert.equal(fs.existsSync(path.join(fixture,'public',uploaded.url)),true);
  assert.equal((await item.DELETE(new Request('http://localhost'),context(saved.id))).status,404);
  assert.equal((await item.PATCH(jsonRequest({name:'missing'}),context(saved.id))).status,404);
});
test('reject external URLs, traversal, nonexistent uploads and invalid IDs', async () => {
  for (const url of ['https://example.com/logo.png','/uploads/../../secret','/uploads/%2e%2e/secret','/uploads/'+'a'.repeat(24)+'.png']) {
    assert.equal((await collection.POST(jsonRequest({url,name:'bad'}))).status,400);
  }
  assert.equal((await item.DELETE(new Request('http://localhost'),context('1 OR 1=1'))).status,400);
  assert.equal((await collection.POST(jsonRequest({url:'x',name:123}))).status,400);
});
test('reject unsupported upload formats and oversized files', async () => {
  for (const file of [new File(['<svg/>'],'logo.svg',{type:'image/svg+xml'}), new File([new Uint8Array(5*1024*1024+1)],'large.png',{type:'image/png'})]) {
    const form = new FormData(); form.append('file',file);
    assert.equal((await uploads.POST(new Request('http://localhost/api/uploads',{method:'POST',body:form}))).status,400);
  }
});
