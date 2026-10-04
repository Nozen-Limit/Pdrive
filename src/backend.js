import {createClient} from '@supabase/supabase-js';
const config=window.SIKAP_CONFIG||{};
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
function validateConfig(){
 if(!config.supabaseUrl||!config.supabasePublishableKey)fail('Connect your Supabase project in config.js, then reload.',503);
 if(!/^https:\/\/[^/]+\.supabase\.co\/?$/.test(config.supabaseUrl))fail('Enter your Supabase Project URL, beginning with https:// and ending in .supabase.co.',503);
 const key=config.supabasePublishableKey;if(key.startsWith('sb_secret_'))fail('Do not use a secret key in config.js. Use the publishable key.',503);
 if(key.startsWith('eyJ')){try{if(JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role!=='anon')fail('Use an anon or publishable key, never a service-role key.',503)}catch(e){fail(e.message||'Invalid public key.',503)}}
}
const callbackUrl=()=>new URL('./',location.href).href;
const storage={getItem:k=>localStorage.getItem(k)||sessionStorage.getItem(k),setItem(k,v){(k.endsWith('-code-verifier')||localStorage.getItem('sikap-remember')==='yes'?localStorage:sessionStorage).setItem(k,v)},removeItem(k){localStorage.removeItem(k);sessionStorage.removeItem(k)}};
let client=null,initError=null;
let recovery=new URLSearchParams(location.hash.slice(1)).get('type')==='recovery';
try{validateConfig();client=createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{flowType:'pkce',storage,storageKey:'sikap-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});client.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY')recovery=true})}catch(e){initError=e}
const checked=result=>{if(result.error)fail(result.error.message,result.error.status||400);return result.data};
const rpc=async(name,args={})=>checked(await client.rpc(name,args));
async function current(){const {session}=checked(await client.auth.getSession());if(!session)fail('Please sign in.',401);return session.user}
function remember(value){localStorage.setItem('sikap-remember',value?'yes':'no');storage.removeItem('sikap-auth')}
export async function validateFile(file){
 if(!file?.size||file.size>20971520)fail('Choose a PDF or DOCX up to 20 MB.');
 const ext=file.name.split('.').pop().toLowerCase();if(!['pdf','docx'].includes(ext))fail('Only PDF and DOCX files are supported.');
 const bytes=new Uint8Array(await file.slice(0,5).arrayBuffer());if(ext==='pdf'&&new TextDecoder().decode(bytes)!=='%PDF-')fail('This is not a valid PDF.');if(ext==='docx'&&(bytes[0]!==80||bytes[1]!==75))fail('This is not a valid DOCX.');
 return ext==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}
// Provider boundary: upload and signed read URLs can later be implemented by a Drive integration.
async function upload(file,mid){const user=await current(),mime=await validateFile(file),ext=file.name.split('.').pop().toLowerCase(),key=`${user.id}/${mid}/${crypto.randomUUID()}.${ext}`;
 checked(await client.storage.from('sikap-modules').upload(key,file,{contentType:mime,upsert:false}));return {object_key:key,filename:file.name,mime,bytes:file.size};}
async function signedVersions(versions){return Promise.all(versions.map(async v=>({...v,url:checked(await client.storage.from('sikap-modules').createSignedUrl(v.key,3600)).signedUrl,downloadUrl:checked(await client.storage.from('sikap-modules').createSignedUrl(v.key,3600,{download:v.name})).signedUrl})))}
const backend={
 get recovery(){return recovery},
 async ready(){if(initError)throw initError;await client.auth.getSession();},
 async api(path,options={}){
  await this.ready();const method=options.method||'GET',body=typeof options.body==='string'?JSON.parse(options.body):options.body;
  if(path==='auth/context')return {googleConfigured:true};
  if(path==='auth/login'){remember(body.remember);checked(await client.auth.signInWithPassword({email:body.email,password:body.password}));return {ok:true}}
  if(path==='auth/register'){if(body.password.length<12)fail('Use at least 12 characters for your password.');remember(body.remember);const result=checked(await client.auth.signUp({email:body.email,password:body.password,options:{data:{name:body.name},emailRedirectTo:callbackUrl()}}));return {ok:true,needsConfirmation:!result.session}}
  if(path==='auth/logout'){checked(await client.auth.signOut({scope:'local'}));recovery=false;return {ok:true}}
  const user=await current();
  if(path==='state'){const state=await rpc('get_state');if(!state.user)fail('Account profile is missing. Run the Supabase setup first.',503);return state}
  if(path==='modules'&&method==='POST'){const mid=crypto.randomUUID(),file=await upload(body.get('file'),mid);await rpc('submit_module',{mid,details:Object.fromEntries([...body.entries()].filter(([k])=>k!=='file')),...file});return {id:mid}}
  if(path==='profile'){checked(await client.from('profiles').update({name:body.name,assignment:body.assignment}).eq('id',user.id));return {ok:true}}
  if(path.startsWith('users/')){await rpc('change_role',{uid:path.split('/')[1],new_role:body.role});return {ok:true}}
  if(path==='notifications'){checked(await client.from('notifications').update({read:true}).eq('owner',user.id));return {ok:true}}
  if(path==='notes'){checked(await client.from('notes').insert({owner:user.id,title:body.title,body:body.body,pinned:body.pinned}));return {ok:true}}
  if(path.startsWith('notes/')){const nid=path.split('/')[1];checked(await (method==='DELETE'?client.from('notes').delete():client.from('notes').update({title:body.title,body:body.body,pinned:body.pinned,updated:new Date().toISOString()})).eq('id',nid).eq('owner',user.id));return {ok:true}}
  const match=path.match(/^modules\/([^/]+)(?:\/([^/]+))?$/);if(match){const [,mid,action]=match;
   if(!action){const detail=await rpc('module_details',{mid});detail.versions=await signedVersions(detail.versions);return detail}
   if(action==='revise'){const file=await upload(body.get('file'),mid);await rpc('revise_module',{mid,expected_revision:Number(body.get('revision')),changes:body.get('changes'),...file})}
   else if(action==='decision')await rpc('review_module',{mid,expected_revision:Number(body.revision),decision:body.status,feedback:body.feedback||''});
   else if(action==='comments')await rpc('comment_module',{mid,message:body.body});
   else if(action==='archive')await rpc('archive_module',{mid,archive:!!body.archived});
   else if(action==='star'){const rows=checked(await client.from('stars').select('id').eq('owner',user.id).eq('module',mid));checked(await(rows.length?client.from('stars').delete().eq('id',rows[0].id):client.from('stars').insert({module:mid,owner:user.id})))}
   else fail('Unknown action.');return {ok:true};
  }fail('Unknown action.');
 },
 async google(link=false){await this.ready();if(link){await current();checked(await client.auth.linkIdentity({provider:'google',options:{redirectTo:callbackUrl()}}))}else{remember(true);checked(await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:callbackUrl()}}))}},
 async reset(email){await this.ready();checked(await client.auth.resetPasswordForEmail(email,{redirectTo:callbackUrl()}))},
 async updatePassword(password){await this.ready();if(password.length<12)fail('Use at least 12 characters.');checked(await client.auth.updateUser({password}));recovery=false}
};
window.sikapBackend=backend;
