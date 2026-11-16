/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
const {appendEmailContent}=require('../src/lib/email-content-addition.ts');

test('appends without rewriting existing HTML, styles, personalization, or links',()=>{
  const original='<!doctype html><html><head><style>p{color:red}</style></head><body class="mail"><table><tr><td>Hello {{name}} <a href="https://example.com">Link</a></td></tr></table></body></html>';
  const result=appendEmailContent(original,'New paragraph',[],'end');
  const split=original.indexOf('</body>');
  assert.ok(result.startsWith(original.slice(0,split)));
  assert.ok(result.endsWith(original.slice(split)));
  assert.match(result,/New paragraph/);
});

test('prepends inside body and keeps QR after appended content',()=>{
  const qr='<!-- mail-qr:start --><div>QR unchanged</div><!-- mail-qr:end -->';
  const original=`<BODY class="x"><p>Original</p>${qr}</BODY>`;
  const first=appendEmailContent(original,'First',[],'start');
  assert.ok(first.indexOf('First') < first.indexOf('<p>Original'));
  assert.ok(first.startsWith('<BODY class="x">'));
  const last=appendEmailContent(original,'Last',[],'end');
  assert.ok(last.indexOf('<p>Original') < last.indexOf('Last'));
  assert.ok(last.indexOf('Last') < last.indexOf(qr));
  assert.ok(last.endsWith(`${qr}</BODY>`));
});

test('escapes typed HTML and alt text while retaining paragraphs and line breaks',()=>{
  const result=appendEmailContent('<p>Old</p>','<script>alert("x")</script>\nsecond\n\nthird',[{url:'/uploads/abc.png',description:'" onerror="alert(1)<tag>'}],'end');
  assert.doesNotMatch(result,/<script>|<tag>/);
  assert.match(result,/&lt;script&gt;/);
  assert.match(result,/<br \/>second/);
  assert.match(result,/alt="&quot; onerror=&quot;alert\(1\)&lt;tag&gt;"/);
  assert.ok(result.indexOf('third') < result.indexOf('<img'));
});

test('supports image-only additions and rejects empty or unsafe input',()=>{
  assert.match(appendEmailContent('<p>Old</p>','',[{url:'/uploads/abc.png',description:''}],'end'),/<img/);
  assert.throws(()=>appendEmailContent('<p>Old</p>','',[],'end'));
  assert.throws(()=>appendEmailContent('','new',[],'end'));
  for(const url of ['javascript:alert(1)','/uploads/../../secret.png','https://example.com/x.png']) assert.throws(()=>appendEmailContent('<p>Old</p>','',[{url,description:''}],'end'));
  assert.throws(()=>appendEmailContent('<p>Old</p>','x'.repeat(20001),[],'end'));
  assert.throws(()=>appendEmailContent('<p>Old</p>','',Array(11).fill({url:'/uploads/abc.png',description:''}),'end'));
});
