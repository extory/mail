const assert = require('node:assert/strict');
const fs = require('node:fs'), Module = require('node:module');
const path = require('node:path');
const base=path.resolve(__dirname, '..');
const ts=require(base+'/node_modules/typescript');
const {Webhook}=require(base+'/node_modules/svix');
const filename=path.join(base, 'src/app/api/webhooks/resend/route.ts');
let writes=0;
function load(secret){
 if(secret)process.env.RESEND_WEBHOOK_SECRET=secret; else delete process.env.RESEND_WEBHOOK_SECRET;
 const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(base);
 m.require=(name)=>name==='@/lib/db'?{recordEmailEvent(){writes++}}:require(require.resolve(name,{paths:[base]}));
 m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
 return m.exports;
}
const body=JSON.stringify({type:'email.delivered',data:{email_id:'test-only'}});
const req=(text=body,headers={})=>new Request('https://mail.test/api/webhooks/resend',{method:'POST',headers,body:text});
(async()=>{
 assert.equal((await load().POST(req())).status,503);assert.equal(writes,0);
 const secret='whsec_'+Buffer.from('isolated-test-secret-32-characters').toString('base64');
 const route=load(secret);
 assert.equal((await route.POST(req())).status,401);assert.equal(writes,0);
 const wh=new Webhook(secret),now=new Date();
 const headers={'svix-id':'msg_test','svix-timestamp':String(Math.floor(now.getTime()/1000)),'svix-signature':wh.sign('msg_test',now,body)};
 assert.equal((await route.POST(req(body,headers))).status,200);assert.equal(writes,1);
 assert.equal((await route.POST(req(body+' ',headers))).status,401);assert.equal(writes,1);
 assert.equal((await route.POST(req('x'.repeat(262145),headers))).status,413);
 console.log('PASS: missing secret, missing signature, valid signature, tampered payload, streaming size limit. No real events written.');
})().catch(e=>{console.error(e);process.exitCode=1});
