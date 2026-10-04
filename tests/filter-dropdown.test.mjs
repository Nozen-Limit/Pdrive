import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('Academic filters use in-page dropdowns and preserve mobile drafts',async()=>{
 const app={innerHTML:''},context=vm.createContext({console,URLSearchParams,localStorage:{getItem(){return null}},innerWidth:390,window:{},addEventListener(){},document:{querySelector:s=>s==='#app'?app:null,addEventListener(){}}});
 vm.runInContext((await readFile('src/frontend.js','utf8')).replace(/^load\(\);\s*$/m,''),context);
 vm.runInContext("data={modules:[{subject:'Science',grade:'Grade 5',term:'Quarter 1',year:'2026–2027'}]};filterOpen=true;filterDraft={...filters};setFilter('subject','Science')",context);
 const html=vm.runInContext('filterPanel()',context);
 assert.doesNotMatch(html,/<select|type="radio"/);
 assert.match(html,/filter-dropdown/);assert.match(html,/data-value="Science" aria-pressed="true"/);
 assert.match(html,/data-filter-key="sort"/);
 assert.equal(vm.runInContext('filters.subject',context),'all');
 assert.equal(vm.runInContext('filterDraft.subject',context),'Science');
 const safe=vm.runInContext("select('subject','Subject',['<script>'])",context);
 assert.doesNotMatch(safe,/<script>/);assert.match(safe,/&lt;script&gt;/);
});
