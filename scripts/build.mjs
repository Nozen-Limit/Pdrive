import {mkdir,copyFile,writeFile,access} from 'node:fs/promises';
import {build} from 'esbuild';
await mkdir('docs',{recursive:true});
await mkdir('docs/assets',{recursive:true});
await copyFile('src/assets/school-campus.png','docs/assets/school-campus.png');
for(const file of ['index.html','frontend.js','styles.css'])await copyFile('src/'+file,'docs/'+file);
try{await access('docs/config.js')}catch{await copyFile('config.js','docs/config.js')}
await build({entryPoints:['src/backend.js'],bundle:true,minify:true,platform:'browser',format:'iife',outfile:'docs/backend.js'});
await build({entryPoints:['src/docx-preview.js'],bundle:true,minify:true,platform:'browser',outfile:'docs/docx-preview.js'});
await writeFile('docs/.nojekyll','');console.log('Project Sikap built in docs/ for GitHub Pages.');

await build({entryPoints:['src/landing-scene.js'],bundle:true,minify:true,platform:'browser',format:'iife',outfile:'docs/landing-scene.js'});

await build({entryPoints:['src/head-desk.js'],bundle:true,minify:true,platform:'browser',format:'iife',outfile:'docs/head-desk.js'});
