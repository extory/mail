/* eslint-disable @typescript-eslint/no-require-imports -- Node CJS harness loads TypeScript server modules. */
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Exercise the server modules with the installed SDKs and mocked HTTP only.
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
};
const models = require('../src/lib/ai-models.ts');
const ai = require('../src/lib/ai.ts');
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
let sequence = 0, calls, failOpenAI, openaiIds, geminiIds;
const email = 'Subject: 소식\n\n<p>{{name}}님 안녕하세요</p>';
function sse(events) {
  return new Response(events.map(e => `data: ${JSON.stringify(e)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } });
}
beforeEach(() => {
  process.env.OPENAI_API_KEY = `test-openai-${++sequence}`;
  process.env.GEMINI_API_KEY = `test-gemini-${sequence}`;
  delete process.env.OPENAI_MODEL; delete process.env.GEMINI_MODEL;
  calls = []; failOpenAI = false;
  // Fictional future IDs verify that selection is not pinned to today's models.
  openaiIds = ['gpt-9.9', 'gpt-10.1', 'gpt-10.1-preview', 'gpt-11-audio', 'gpt-11-pro', 'gpt-11-codex'];
  geminiIds = ['gemini-9.9-pro', 'gemini-10.1-flash', 'gemini-10.1-pro-preview', 'gemini-11-pro-image'];
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input); const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ url, body });
    if (url === 'https://api.openai.com/v1/models') {
      if (failOpenAI) return Response.json({ error: { message: 'secret upstream details', type: 'authentication_error' } }, { status: 401 });
      return Response.json({ object: 'list', data: openaiIds.map((id, i) => ({ id, created: i, object: 'model', owned_by: 'openai' })) });
    }
    if (url.includes('generativelanguage.googleapis.com') && !url.includes(':generateContent') && !url.includes(':streamGenerateContent')) {
      return Response.json({ models: geminiIds.map(id => ({name: `models/${id}`, displayName: id, supportedGenerationMethods: ['generateContent']})) });
    }
    if (url.endsWith('/responses')) {
      if (body.stream) return sse([{ type: 'response.output_text.delta', delta: email }, { type: 'response.completed' }]);
      return Response.json({ id: 'resp_test', object: 'response', status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '<p>{{name}}님 반갑습니다</p>', annotations: [] }] }] });
    }
    if (url.includes(':streamGenerateContent')) return sse([{ candidates: [{ content: { parts: [{ text: email }], role: 'model' }, finishReason: 'STOP' }] }]);
    if (url.includes(':generateContent')) return Response.json({ candidates: [{ content: { parts: [{ text: '<p>Gemini 편집</p>' }], role: 'model' }, finishReason: 'STOP' }] });
    throw new Error(`Unexpected request: ${url}`);
  };
});
after(() => { globalThis.fetch = originalFetch; process.env = originalEnv; });

test('discovers both providers; numeric versions sort correctly; specialized models excluded', async () => {
  const catalog = await models.getModelCatalog();
  assert.equal(catalog.providers[0].latest, 'gpt-10.1');
  assert.equal(catalog.providers[1].latest, 'gemini-10.1-flash');
  assert.equal(catalog.providers[0].models.length, 3);
  assert.equal(catalog.providers[1].models.length, 3);
});
test('cache deduplicates simultaneous discovery and invalidates when API key changes', async () => {
  await Promise.all([models.getModelCatalog(), models.getModelCatalog()]);
  assert.equal(calls.length, 2);
  await models.getModelCatalog(); assert.equal(calls.length, 2);
  process.env.OPENAI_API_KEY += '-rotated';
  await models.getModelCatalog(); assert.equal(calls.length, 3);
});
test('cache expires and discovers a newly available model', async () => {
  const realNow = Date.now;
  try {
    await models.getProviderModels('openai');
    openaiIds.push('gpt-12');
    Date.now = () => realNow() + 6 * 60 * 1000;
    assert.equal((await models.getProviderModels('openai')).latest, 'gpt-12');
  } finally { Date.now = realNow; }
});
test('one provider failing does not hide the other or leak provider error details', async () => {
  failOpenAI = true;
  const catalog = await models.getModelCatalog();
  assert.match(catalog.providers[0].error, /Could not load/);
  assert.ok(catalog.providers[1].latest);
  assert.ok(!JSON.stringify(catalog).includes('secret'));
  await assert.rejects(models.resolveAIModel({provider:'openai'}), /Could not load/);
});
test('missing/placeholder keys are not queried; invalid selections rejected', async () => {
  process.env.OPENAI_API_KEY = 'your-key'; process.env.GEMINI_API_KEY = '';
  assert.ok((await models.getModelCatalog()).providers.every(p => !p.configured));
  assert.equal(calls.length, 0);
  await assert.rejects(models.resolveAIModel({provider:'gemini'}), /GEMINI_API_KEY/);
  assert.throws(() => models.parseAISelection('invalid', 'auto'), /Invalid/);
  assert.throws(() => models.parseAISelection('openai', {}), /Invalid/);
});
test('explicit model, environment pin, and auto are distinct; removed models rejected', async () => {
  process.env.OPENAI_MODEL = 'gpt-9.9';
  assert.equal((await models.resolveAIModel()).model, 'gpt-9.9');
  assert.equal((await models.resolveAIModel({provider:'openai',model:'auto'})).model, 'gpt-10.1');
  assert.equal((await models.resolveAIModel({provider:'openai',model:'gpt-10.1-preview'})).model, 'gpt-10.1-preview');
  await assert.rejects(models.resolveAIModel({provider:'openai',model:'gpt-removed'}), /not in the available/);
});
test('generation and editing honor selected OpenAI model and keep output contract', async () => {
  const stream = await ai.generateEmailStream('소식', {provider:'openai',model:'gpt-9.9',useName:true,images:[{url:'https://example.com/photo.png'}]});
  assert.equal(await new Response(stream).text(), email);
  assert.equal(calls.at(-1).body.model, 'gpt-9.9');
  assert.match(calls.at(-1).body.instructions, /photo.png/);
  assert.match(calls.at(-1).body.instructions, /\{\{name\}\}/);
  assert.equal(await ai.editSelection('안녕','정중하게',{provider:'openai',model:'auto'}), '<p>{{name}}님 반갑습니다</p>');
  assert.equal(calls.at(-1).body.model, 'gpt-10.1');
});
test('generation and editing use Gemini even when OpenAI is configured', async () => {
  assert.equal(await new Response(await ai.generateEmailStream('소식',{provider:'gemini',model:'auto'})).text(), email);
  assert.ok(calls.at(-1).url.includes('gemini-10.1-flash:streamGenerateContent'));
  assert.equal(await ai.editSelection('안녕','편집',{provider:'gemini',model:'gemini-9.9-pro'}), '<p>Gemini 편집</p>');
  assert.ok(calls.at(-1).url.includes('gemini-9.9-pro:generateContent'));
});
test('Gemini discovery reads every page before choosing latest', async () => {
  let pages = 0;
  globalThis.fetch = async input => {
    const url = String(input);
    pages++;
    if (pages === 1) return Response.json({models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']}],nextPageToken:'second'});
    assert.match(url,/pageToken=second/);
    return Response.json({models:[{name:'models/gemini-10.2-pro',supportedGenerationMethods:['generateContent']},{name:'models/gemini-11-pro',supportedGenerationMethods:['embedContent']}]});
  };
  assert.equal((await models.getProviderModels('gemini')).latest, 'gemini-10.2-pro');
  assert.equal(pages,2);
});

test('reuse instructions set requested language while retaining HTML and placeholder requirements', async () => {
  const stream = await ai.generateEmailStream('Original email reference', {provider:'openai',model:'auto',reuse:{mode:'translate',language:'ja'}});
  await new Response(stream).text();
  const call = calls.find(c=>c.url.includes('/responses'));
  assert.match(call.body.instructions,/Output language: Japanese/);
  assert.match(call.body.instructions,/Translate the original subject/);
  assert.match(call.body.instructions,/Preserve image URLs/);
  assert.match(call.body.instructions,/\{\{name\}\}/);
});
