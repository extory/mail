/* eslint-disable @typescript-eslint/no-require-imports -- Isolated route test. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/app/CL0/[...path]/route.ts');
const route = new Module(filename, module);
route._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const get = suffix => route.exports.GET(new Request('https://mail.extory.co' + suffix));

test('restores the exact broken HR link already delivered to recipients', () => {
  const result = get('/CL0/https:%2F%2Fhr.aline.team%2F/1/010601a20bb8b9b6-8d3d5b07-a30b-4d6c-8808-9b16114af73a-000000/g4EOhNXsCxMArlqRSTJhFLPv73BpMKC78sbsyTK4txw=258');
  assert.equal(result.status, 307);
  assert.equal(result.headers.get('location'), 'https://hr.aline.team/');
  assert.equal(result.headers.get('referrer-policy'), 'no-referrer');
});

test('retains HR paths and campaign query parameters', () => {
  const target = 'https://hr.aline.team/jobs?utm_source=email&lang=ko';
  assert.equal(get('/CL0/' + encodeURIComponent(target) + '/1/message/signature').headers.get('location'), target);
});

test('rejects malformed links and destinations outside the HR site', () => {
  for (const target of ['https://evil.test/', 'https://hr.aline.team.evil.test/', 'http://hr.aline.team/', 'https://user@hr.aline.team/', 'https://hr.aline.team:444/', 'javascript:alert(1)']) {
    assert.equal(get('/CL0/' + encodeURIComponent(target) + '/1/message/signature').status, 404);
  }
  assert.equal(get('/CL0/%ZZ/1/message/signature').status, 404);
  assert.equal(get('/CL0/https:%2F%2Fhr.aline.team%2F').status, 404);
});
