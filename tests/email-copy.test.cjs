/* eslint-disable @typescript-eslint/no-require-imports -- Isolated Node test harness for TypeScript routes. */
const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalCwd = process.cwd();
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-copy-test-'));
fs.mkdirSync(path.join(fixture, 'data'));
process.chdir(fixture);
require.extensions['.ts'] = (module, filename) => {
  const originalRequire = module.require.bind(module);
  module.require = id => originalRequire(id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : id);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true} }).outputText, filename);
};
const db = require('../src/lib/db.ts');
const copyRoute = require('../src/app/api/history/[id]/copy/route.ts');
const context = id => ({params:Promise.resolve({id:String(id)})});
after(() => {process.chdir(originalCwd);fs.rmSync(fixture,{recursive:true,force:true});});

test('copy creates independent drafts with original HTML, images, source link and initial revision', async () => {
  const html='<p>{{name}}님 안녕하세요</p><img src="/uploads/logo.png"><a href="https://company.co">Visit</a>';
  const source=db.addSendLog('기존 제목',html,12,'sent','old instructions');
  const first=await copyRoute.POST(new Request('http://localhost'),context(source.id));
  assert.equal(first.status,201); const draft=await first.json();
  assert.equal(draft.subject,source.subject);assert.equal(draft.html_content,html);
  assert.equal(draft.source_send_log_id,source.id);assert.equal(draft.prompt,'');
  const second=await (await copyRoute.POST(new Request('http://localhost'),context(source.id))).json();
  assert.notEqual(draft.id,second.id);
  db.saveDraft('English title','<p>New body</p>','translate',draft.id);
  assert.equal(db.getDraft(draft.id).source_send_log_id,source.id);
  assert.equal(db.getDraft(second.id).html_content,html);
  assert.deepEqual(db.getSendLog(source.id),source);
  assert.equal(db.getDraftRevisions(draft.id)[0].html_content,html);
});

test('invalid copy requests create no drafts',async()=>{
  const before=db.getDrafts().length;
  for(const id of ['0','bad','-1','9007199254740992']) assert.equal((await copyRoute.POST(new Request('http://localhost'),context(id))).status,400);
  assert.equal((await copyRoute.POST(new Request('http://localhost'),context(999999))).status,404);
  assert.equal(db.getDrafts().length,before);
});

let captured;
const originalLoader=require.extensions['.ts'];
require.extensions['.ts']=(module,filename)=>{
  if(!filename.endsWith('/api/compose/route.ts')) return originalLoader(module,filename);
  const originalRequire=module.require.bind(module);
  module.require=id=>id==='@/lib/ai' ? {generateEmailStream:async(prompt,options)=>{
    captured={prompt,options};return new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('Subject: New\n\n<p>New</p>'));controller.close();}});
  }} : originalRequire(id.startsWith('@/')?path.join(root,'src',id.slice(2)):id);
  module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
};
const composeRoute=require('../src/app/api/compose/route.ts');
const composeRequest=body=>new Request('http://localhost/api/compose',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
test('translation request uses stored original and validated language rather than requiring a new topic',async()=>{
  const source=db.addSendLog('Original','<img src="/uploads/logo.png"><p>{{name}}</p>',1,'sent');
  const response=await composeRoute.POST(composeRequest({prompt:'',sourceSendLogId:source.id,reuseMode:'translate',targetLanguage:'ja',provider:'openai',model:'auto'}));
  assert.equal(response.status,200);
  assert.deepEqual(captured.options.reuse,{mode:'translate',language:'ja'});
  assert.match(captured.prompt,/Original/);assert.match(captured.prompt,/logo.png/);assert.match(captured.prompt,/\{\{name\}\}/);
  await response.text();
  for(const patch of [{targetLanguage:'invalid'},{reuseMode:'invalid'},{sourceSendLogId:-1}]){
    assert.equal((await composeRoute.POST(composeRequest({prompt:'',sourceSendLogId:source.id,reuseMode:'rewrite',targetLanguage:'en',...patch}))).status,400);
  }
  assert.equal((await composeRoute.POST(composeRequest({prompt:'',sourceSendLogId:999999,reuseMode:'rewrite',targetLanguage:'en'}))).status,404);
});
