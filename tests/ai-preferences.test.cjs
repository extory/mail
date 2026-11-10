/* eslint-disable @typescript-eslint/no-require-imports */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname,'..');
const cwd = process.cwd();
const fixture = fs.mkdtempSync(path.join(os.tmpdir(),'mail-ai-preferences-'));
fs.mkdirSync(path.join(fixture,'data')); process.chdir(fixture);
let session = { id:1 };
let configured = { openai:true, gemini:true };
require.extensions['.ts'] = (module, filename) => {
  const original = module.require.bind(module);
  module.require = id => {
    if(id === '@/lib/auth') return {getSession:async()=>session};
    if(id === '@/lib/ai-models') return {
      providerKey: provider => configured[provider] ? 'test-key' : undefined,
      getModelCatalog:async()=>({providers:['openai','gemini'].map(provider=>({provider,configured:configured[provider],models:[],latest:null}))}),
    };
    return original(id.startsWith('@/') ? path.join(root,'src',id.slice(2)) : id);
  };
  module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
};
const db = require('../src/lib/db.ts');
const preferences = require('../src/lib/ai-preferences.ts');
const route = require('../src/app/api/settings/ai/route.ts');
const catalog = require('../src/app/api/ai/models/route.ts');
const first = db.createUser('ai-one@qa.invalid','test-only');
const second = db.createUser('ai-two@qa.invalid','test-only');
const request = body => new Request('http://localhost/api/settings/ai',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
after(()=>{process.chdir(cwd);fs.rmSync(fixture,{recursive:true,force:true});});

test('provider choice persists per account and becomes composer default without silent fallback',async()=>{
  session={id:first.id};
  assert.equal((await (await route.GET()).json()).provider,'openai');
  for(const provider of ['gemini','openai','gemini']) {
    assert.equal((await route.PUT(request({provider}))).status,200);
    assert.equal(preferences.getAIProviderPreference(first.id),provider);
    assert.equal((await (await catalog.GET()).json()).defaultProvider,provider);
  }
  session={id:second.id};
  assert.equal((await (await route.GET()).json()).provider,'openai');
  assert.equal(preferences.getAIProviderPreference(second.id),null);
  session={id:first.id}; configured.gemini=false;
  assert.equal((await (await catalog.GET()).json()).defaultProvider,'gemini');
  configured.gemini=true;
});

test('invalid, unconfigured and unauthenticated updates do not change saved choice',async()=>{
  session={id:first.id};
  for(const body of [null,{}, {provider:'claude'}, {provider:3}]) assert.equal((await route.PUT(request(body))).status,400);
  configured.openai=false;
  assert.equal((await route.PUT(request({provider:'openai'}))).status,400);
  assert.equal(preferences.getAIProviderPreference(first.id),'gemini');
  session=null;
  assert.equal((await route.GET()).status,401);
  assert.equal((await route.PUT(request({provider:'gemini'}))).status,401);
  assert.equal((await catalog.GET()).status,401);
  configured.openai=true;
});
