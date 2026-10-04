import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
test('Pages interface renders real login/signup and confirmation feedback without any /api server',async()=>{
 const app={innerHTML:''},toast={textContent:'',classList:{add(){},remove(){}}},fakeStorage={getItem(){return null},setItem(){}};let confirmed=false;
 const context=vm.createContext({console,URLSearchParams,FormData,Blob,URL,setTimeout,location:{search:'',hash:'',pathname:'/Pdrive/'},localStorage:fakeStorage,document:{querySelector:s=>s==='#app'?app:s==='#toast'?toast:null,addEventListener(){}},window:{sikapBackend:{recovery:false,async ready(){},async api(path){if(path==='auth/context')return {};if(path==='state')throw Object.assign(new Error('Sign in'),{status:401});if(path==='auth/register'){confirmed=true;return {needsConfirmation:true}}}}}});
 context.addEventListener=()=>{};
 const source=await readFile('src/frontend.js','utf8');assert.doesNotMatch(source,/fetch\('\/api|signin-with-chatgpt|ClassFlow/);vm.runInContext(source,context);await new Promise(r=>setTimeout(r,10));
 assert.match(app.innerHTML,/Sign in to Project Sikap/);assert.match(app.innerHTML,/Sign Up/);assert.match(app.innerHTML,/Google/);vm.runInContext("setAuthMode('register')",context);assert.match(app.innerHTML,/Full name/);assert.match(app.innerHTML,/Confirm password/);
 const f=new FormData();f.set('name','Teacher');f.set('email','teacher@example.test');f.set('password','Long-password-2026');f.set('confirm','Long-password-2026');context.FormData=class{constructor(){return f}};const error={textContent:''},button={textContent:'Sign Up',disabled:false};context.testEvent={preventDefault(){},target:{querySelector:s=>s==='.form-error'?error:button}};
 await vm.runInContext('schoolLogin(testEvent)',context);assert.ok(confirmed);assert.match(error.textContent,/Check your email/);assert.equal(button.disabled,false);
});
test('Client file validation accepts documents and rejects invalid or oversized files',async()=>{
 globalThis.window={SIKAP_CONFIG:{}};globalThis.location={hash:''};
 const {validateFile}=await import('../src/backend.js');
 assert.equal(await validateFile(new File(['%PDF-1.4\n'],'module.pdf')),'application/pdf');
 assert.equal(await validateFile(new File([new Uint8Array([80,75,3,4,1])],'module.docx')),'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
 await assert.rejects(validateFile(new File(['not a pdf'],'module.pdf')),/valid PDF/);
 await assert.rejects(validateFile(new File(['%PDF-'],'module.exe')),/Only PDF/);
 await assert.rejects(validateFile({size:20971521}),/20 MB/);
 await assert.rejects(window.sikapBackend.ready(),/config.js/);
});
