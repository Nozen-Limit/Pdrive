import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
test('Pending/rejected accounts see no dashboard; Head Teacher can review but not grant Head roles',async()=>{
 const app={innerHTML:''},context=vm.createContext({console,URLSearchParams,localStorage:{getItem(){return null}},innerWidth:390,window:{},addEventListener(){},document:{querySelector:s=>s==='#app'?app:null,addEventListener(){}}});
 const source=(await readFile('src/frontend.js','utf8')).replace(/^load\(\);\s*$/m,'');vm.runInContext(source,context);
 vm.runInContext("data={user:{id:'teacher',email:'teacher@example.test',approval_status:'pending'}};render()",context);
 assert.match(app.innerHTML,/Awaiting approval/);assert.doesNotMatch(app.innerHTML,/Submit module|My modules/);assert.match(app.innerHTML,/Check status/);assert.match(app.innerHTML,/Log out/);
 vm.runInContext("data.user.approval_status='rejected';data.user.approval_note='<script>test</script>';render()",context);
 assert.match(app.innerHTML,/Request not approved/);assert.match(app.innerHTML,/&lt;script&gt;/);assert.doesNotMatch(app.innerHTML,/<script>/);
 const teachers=vm.runInContext("data={user:{role:'head'},teachers:[{id:'teacher',name:'Applicant',email:'teacher@example.test',role:'teacher',approval_status:'pending',emailConfirmed:true,requested_at:'2026-10-04'}]};teachersPage()",context);
 assert.match(teachers,/Review account/);assert.match(teachers,/Pending approval/);assert.doesNotMatch(teachers,/changeRole|value=\"head\"/);
});
