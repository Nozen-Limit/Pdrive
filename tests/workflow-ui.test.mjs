import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('Navigation refreshes state; notifications stay unread until acknowledged; failed refresh preserves the page',async()=>{
 const app={innerHTML:''},toast={textContent:'',classList:{add(){},remove(){}}};
 const state={user:{id:'teacher',role:'teacher',name:'Teacher',approval_status:'approved'},modules:[],notes:[],teachers:[],events:[],notifications:[{id:'notice',module:'lesson',body:'Review completed',read:false}]};
 const calls=[];let failed=false;
 const ctx=vm.createContext({console,URLSearchParams,FormData,Blob,URL,setTimeout,location:{search:''},localStorage:{getItem(){return null}},document:{querySelector:s=>s==='#app'?app:s==='#toast'?toast:null,addEventListener(){}},addEventListener(){},window:{scrollTo(){},sikapBackend:{async ready(){},async api(path){calls.push(path);if(path==='state'){if(failed)throw Error('Offline');return state}if(path==='notifications')state.notifications.forEach(n=>n.read=true);return {}}}}});
 vm.runInContext(await readFile('src/frontend.js','utf8'),ctx);await new Promise(r=>setTimeout(r,10));
 calls.length=0;await vm.runInContext("go('notifications')",ctx);
 assert.deepEqual(calls,['state']);assert.match(app.innerHTML,/Unread/);assert.match(app.innerHTML,/Mark all as read/);
 await vm.runInContext('markNotificationsRead()',ctx);assert.equal(state.notifications[0].read,true);assert.doesNotMatch(app.innerHTML,/<strong>Unread<\/strong>/);
 const before=app.innerHTML;failed=true;await vm.runInContext("go('notes')",ctx);assert.equal(app.innerHTML,before);assert.match(toast.textContent,/Could not refresh/);
});
