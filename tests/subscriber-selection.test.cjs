/* eslint-disable @typescript-eslint/no-require-imports -- TypeScript test harness. */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {filterSubscribers,selectedVisibleIds} = require('../src/lib/subscriber-selection.ts');
const subscribers = [
  {id:1,email:'Alice@company.com',name:'홍길동',groups:[{id:1,name:'VIP'}]},
  {id:2,email:'bob@company.com',name:null,groups:[{id:2,name:'Staff'}]},
  {id:3,email:'carol@example.com',name:'홍영희',groups:[]},
];
test('name and email searches are trimmed, case insensitive, and combine with group filters', () => {
  assert.deepEqual(filterSubscribers(subscribers,' 홍 ').map(s=>s.id),[1,3]);
  assert.deepEqual(filterSubscribers(subscribers,' ALICE ').map(s=>s.id),[1]);
  assert.deepEqual(filterSubscribers(subscribers,'company','2').map(s=>s.id),[2]);
  assert.deepEqual(filterSubscribers(subscribers,'','0').map(s=>s.id),[3]);
  assert.deepEqual(filterSubscribers(subscribers,'missing'),[]);
});
test('bulk deletion selection excludes hidden and stale IDs and includes all matching pages', () => {
  const visible = filterSubscribers(subscribers,'hong');
  assert.deepEqual(selectedVisibleIds(visible,new Set([1,2,99])),[]);
  assert.deepEqual(selectedVisibleIds(filterSubscribers(subscribers,'홍'),new Set([1,2,99])),[1]);
  const many = Array.from({length:65},(_,i)=>({id:i+1,email:`user${i}@example.com`,name:null,groups:[]}));
  const results = filterSubscribers(many,'example.com');
  assert.equal(selectedVisibleIds(results,new Set(results.map(s=>s.id))).length,65);
  assert.deepEqual(selectedVisibleIds(results,new Set()),[]);
});
