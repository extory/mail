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

test('per-image layout applies placement, order, dimensions, captions and safe links without rewriting original',()=>{
  const original='<body><p>Original untouched</p><!-- mail-qr:start --><p>QR</p><!-- mail-qr:end --></body>';
  const image=(id,placement)=>({url:`/uploads/${id}.png`,description:id,layout:{placement,align:'right',width:240,beforeText:'Above <safe>',afterText:'Below\nSecond line',link:'https://example.com/?a=1&b=2'}});
  const result=appendEmailContent(original,'New text',[image('first','start'),image('second','before'),image('third','after'),image('last','end')],'end');
  assert.ok(result.indexOf('first.png')<result.indexOf('<p>Original untouched</p>'));
  assert.ok(result.indexOf('second.png')<result.indexOf('New text'));
  assert.ok(result.indexOf('third.png')>result.indexOf('New text'));
  assert.ok(result.indexOf('last.png')<result.indexOf('<!-- mail-qr:start -->'));
  assert.match(result,/width="240"/);
  assert.match(result,/margin:16px 0 16px auto/);
  assert.match(result,/Above &lt;safe&gt;/);
  assert.match(result,/Below<br \/>Second line/);
  assert.match(result,/href="https:\/\/example.com\/\?a=1&amp;b=2"/);
});

test('full-generation descriptions carry the same layout settings; unsafe options are rejected',()=>{
  const {imageGenerationDescription,imageLayout}=require('../src/lib/image-layout.ts');
  const description=imageGenerationDescription('Product photo',{placement:'start',align:'left',width:320,beforeText:'Product title',afterText:'Purchase now',link:'https://example.com/shop'});
  assert.match(description,/Product photo/);
  for(const value of ['start','left','320','Product title','Purchase now','https://example.com/shop']) assert.ok(description.includes(value));
  assert.equal(imageGenerationDescription('unchanged'),'unchanged');
  for(const options of [{width:0},{width:553},{align:'invalid'},{placement:'invalid'},{link:'javascript:alert(1)'},{link:'https://user:password@example.com'},{beforeText:'x'.repeat(2001)}]) assert.throws(()=>imageLayout(options));
});
