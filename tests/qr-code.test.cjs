/* eslint-disable @typescript-eslint/no-require-imports */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const jsQR = require('jsqr');
const { PNG } = require('pngjs');
const root = path.resolve(__dirname, '..');
const cwd = process.cwd();
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-qr-'));
process.chdir(fixture);
require.extensions['.ts'] = (module, filename) => {
  const original = module.require.bind(module);
  module.require = id => original(id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : id);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText, filename);
};
const qr = require('../src/lib/qr-code.ts');
const route = require('../src/app/api/qr-code/route.ts');
after(() => {process.chdir(cwd);fs.rmSync(fixture,{recursive:true,force:true});});
const request = body => new Request('http://localhost/api/qr-code',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});

test('generated PNG decodes to the input link including Korean text and query parameters', async () => {
  const link = 'https://example.com/행사?name=hello&code=123#register';
  const response = await route.POST(request({url:link}));
  assert.equal(response.status,200);
  const result = await response.json();
  assert.match(result.url,/^\/uploads\/[a-f0-9]{24}\.png$/);
  const png = PNG.sync.read(fs.readFileSync(path.join(fixture,'public',result.url)));
  const decoded = jsQR(new Uint8ClampedArray(png.data),png.width,png.height);
  assert.equal(decoded.data,new URL(link).href);
});

test('invalid links and malformed requests do not generate images', async () => {
  for (const url of [null,{},'','javascript:alert(1)','data:text/html,abc','ftp://example.com','https://user:password@example.com','https://example.com/'+ 'a'.repeat(1001)]) {
    assert.equal((await route.POST(request({url}))).status,400);
  }
  assert.equal((await route.POST(new Request('http://localhost/api/qr-code',{method:'POST',body:'{'}))).status,400);
});

test('insertion, replacement, removal and regeneration preserve content with only one QR', () => {
  const original='<html><body><h1>Hello</h1></body></html>';
  const block=qr.createQrBlock('/uploads/abc123.png','https://example.com/?a=1&b=2');
  const inserted=qr.replaceQrBlock(original,block);
  assert.ok(inserted.includes('<h1>Hello</h1>'));
  assert.ok(inserted.indexOf(block)<inserted.indexOf('</body>'));
  assert.match(block,/a=1&amp;b=2/);
  assert.equal(qr.extractQrBlock(inserted),block);
  const updated=qr.replaceQrBlock(inserted,qr.createQrBlock('/uploads/def456.png'));
  assert.doesNotMatch(updated,/abc123/);
  assert.equal(updated.match(/mail-qr:start/g).length,1);
  assert.equal(qr.replaceQrBlock(updated,''),original);
  const generated=qr.replaceQrBlock('<body>New AI content</body>',qr.extractQrBlock(inserted));
  assert.ok(generated.includes(block));
  assert.throws(()=>qr.createQrBlock('https://evil.example/qr.png'));
});

test('uploaded QR image is preserved without resizing and can replace a generated QR', async () => {
  const upload = require('../src/app/api/uploads/route.ts');
  const QRCode = require('qrcode');
  const original = await QRCode.toBuffer('https://example.com/upload-test', {margin:4,scale:8});
  const form = new FormData();
  form.append('file',new File([original],'qr.png',{type:'image/png'}));
  const response = await upload.POST(new Request('http://localhost/api/uploads',{method:'POST',body:form}));
  assert.equal(response.status,200);
  const {url}=await response.json();
  const stored=fs.readFileSync(path.join(fixture,'public',url));
  assert.deepEqual(stored,original);
  const previous=qr.createQrBlock('/uploads/old.png','https://example.com/old');
  const replaced=qr.replaceQrBlock(`<body>${previous}</body>`,qr.createQrBlock(url));
  assert.ok(replaced.includes(url));
  assert.doesNotMatch(replaced,/old.png/);
  const png=PNG.sync.read(stored);
  assert.equal(jsQR(new Uint8ClampedArray(png.data),png.width,png.height).data,'https://example.com/upload-test');
});
