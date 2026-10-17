import * as T from 'three';
let stop=null;
function mount(host){
 let renderer;try{renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'})}catch{return ()=>{}}
 const canvas=renderer.domElement;canvas.className='campus-canvas';canvas.setAttribute('aria-hidden','true');host.prepend(canvas);
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 const scene=new T.Scene();scene.fog=new T.Fog('#111e35',50,110);
 const camera=new T.PerspectiveCamera(36,1,.1,160);camera.position.set(23,18,32);
 scene.add(new T.HemisphereLight('#c7dfff','#243550',2.1));const sun=new T.DirectionalLight('#ffe6bc',3.8);sun.position.set(15,25,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-35,right:35,top:28,bottom:-28,near:.5,far:90});sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;scene.add(sun);
 const campus=new T.Group();scene.add(campus);campus.position.x=-8;campus.rotation.y=-.13;
 const mats={};const mat=color=>mats[color]??=new T.MeshStandardMaterial({color,roughness:.78});
 function box(w,h,d,x,y,z,color,parent=campus){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat(color));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
 box(29,.25,22,0,-.5,0,'#727f68');box(24,.14,18,0,-.27,0,'#e9e3da');
 // A pitched metal roof with real eaves, ridge, and standing seams.
 function roof(x,z,w,d){const pitch=.24,depth=d+.9,length=w+.9,half=depth/2,slant=Math.sqrt(half*half+(half*pitch)**2);for(const side of [-1,1]){const panel=box(length,.1,slant,x,4.5+half*pitch/2,z+side*half/2,'#546879');panel.rotation.x=side*Math.atan(pitch);for(let i=-length/2;i<length/2;i+=.65){const seam=box(.035,.045,slant,x+i,4.57+half*pitch/2,z+side*half/2,'#6b7d88');seam.rotation.x=side*Math.atan(pitch)}}box(length,.11,.14,x,4.5+half*pitch,z,'#748791')}
 function building(x,z,w,d){box(w,4.2,d,x,2,z,'#d7d4c9');box(w+.08,.3,d+.08,x,.04,z,'#aaa99e');roof(x,z,w,d);box(w+.15,.16,d+.15,x,2.12,z,'#a5b2bc');
 for(let i=0;i<Math.floor(w/1.6);i++){const wx=x-w/2+1+i*1.6;for(const y of [1,3.12]){const front=z+d/2;box(1.03,1.25,.12,wx,y,front+.03,'#6c7a7f');const glass=box(.86,1.08,.06,wx,y,front+.105,'#77939c');glass.material=glassMaterial;box(.04,1.15,.07,wx,y,front+.15,'#c6cdd0');box(.92,.045,.07,wx,y+.04,front+.15,'#c6cdd0');box(1.15,.1,.35,wx,y-.63,front+.14,'#e4e1d5');box(1.17,.09,.5,wx,y+.7,front+.19,'#a8b6bf')}}
 // Covered veranda gives the facade depth rather than a flat wall of windows.
 const edge=z+d/2+1.1;box(w+.6,.15,1.8,x,2.05,edge-.2,'#bec6c7');box(w+.7,.12,1.9,x,4.22,edge-.2,'#c5cccb');for(let px=x-w/2+.3;px<x+w/2;px+=2.2){box(.14,4.2,.14,px,2,edge+.55,'#b6c1c4');box(.25,.12,.25,px,0,edge+.55,'#989e9d')}box(w,.08,.065,x,2.85,edge+.55,'#8496a1');for(let px=x-w/2;px<x+w/2;px+=.42)box(.035,.75,.035,px,2.45,edge+.55,'#8c9fa9');
 }
 const glassMaterial=new T.MeshStandardMaterial({color:'#7196a6',metalness:.5,roughness:.2});
 building(-6,-4,10,4);building(6,-4,10,4);building(-11,1,3.5,9);box(2,2.2,.12,0,1,-1.9,'#789bb2');
 box(3,.1,16,0,-.15,2,'#d3ddea');
 // Architectural rhythm: entrance steps, courtyard seating and warm walkway lamps.
 for(let i=0;i<3;i++)box(3.5-i*.25,.14,1.3-i*.2,0,-.1+i*.14,-1+i*.2,'#c3d1e1');
 for(let x of [-7,7])for(let z of [2,6]){box(2,.17,.7,x,.5,z,'#8b6953');box(.12,.6,.5,x-.7,.15,z,'#60738b');box(.12,.6,.5,x+.7,.15,z,'#60738b')}
 for(let x of [-2.3,2.3])for(let z of [2,7]){box(.08,1.4,.08,x,.6,z,'#526884');const bulb=new T.Mesh(new T.SphereGeometry(.15,8,6),new T.MeshStandardMaterial({color:'#ffe1a6',emissive:'#ffce82',emissiveIntensity:1.8}));bulb.position.set(x,1.4,z);campus.add(bulb)}
 // Layered irregular foliage, branching trunks and understory planting.
 let seed=42;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const foliage=new T.IcosahedronGeometry(1,2),trunkGeo=new T.CylinderGeometry(.09,.16,1,8);
 for(const x of [-9,-5,5,9])for(const z of [5,8]){box(2.5,.25,2.2,x,-.07,z,'#b9b8aa');box(2.3,.07,2,x,.1,z,'#5f7258');const trunk=new T.Mesh(trunkGeo,mat('#71624e'));trunk.scale.y=2.3;trunk.position.set(x,1.2,z);trunk.castShadow=true;campus.add(trunk);for(let j=0;j<9;j++){const angle=j*2.4,r=.4+random()*.7;const leaf=new T.Mesh(foliage,mat(['#526e54','#698261','#7c9069','#5c795b'][j%4]));leaf.position.set(x+Math.cos(angle)*r,2.5+random()*.95,z+Math.sin(angle)*r);leaf.scale.set(.65+random()*.3,.75+random()*.4,.6+random()*.35);leaf.castShadow=true;leaf.receiveShadow=true;campus.add(leaf)}for(let j=0;j<5;j++){const shrub=new T.Mesh(foliage,mat('#748166'));shrub.scale.set(.35,.27,.35);shrub.position.set(x-1+random()*2,.3,z-.8+random()*1.6);campus.add(shrub)}}
 // Fine paving joints and lawn edging establish scale at courtyard level.
 for(let x=-10;x<=10;x+=1.2)box(.013,.008,14,x,-.19,1,'#c7c4ba');for(let z=-5;z<=8;z+=1.2)box(21,.008,.013,0,-.185,z,'#c7c4ba');
 const clouds=[];
 let px=0,py=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)');const move=e=>{px=(e.clientX/innerWidth-.5)*2;py=(e.clientY/innerHeight-.5)*2};
 const resize=()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();draw(0)};
 function draw(time){camera.position.x+=(23+(reduced.matches?0:px*1.5)-camera.position.x)*.04;camera.position.y+=(18+(reduced.matches?0:py*.7)-camera.position.y)*.04;camera.lookAt(-4,1,0);if(!reduced.matches)clouds.forEach((c,i)=>c.position.x=-12+i*8+Math.sin(time*.00015+i)*1.1);renderer.render(scene,camera)}
 function loop(){renderer.setAnimationLoop(!document.hidden&&!reduced.matches?draw:null);draw(0)}
 addEventListener('pointermove',move,{passive:true});addEventListener('resize',resize);document.addEventListener('visibilitychange',loop);reduced.addEventListener('change',loop);resize();loop();
 return ()=>{renderer.setAnimationLoop(null);removeEventListener('pointermove',move);removeEventListener('resize',resize);document.removeEventListener('visibilitychange',loop);reduced.removeEventListener('change',loop);const materials=new Set();scene.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material)});materials.forEach(m=>m.dispose());renderer.dispose();canvas.remove()};
}
let current=null;function sync(){const host=document.querySelector('.clean-login');if(host===current)return;stop?.();current=host;stop=host?mount(host):null}
new MutationObserver(sync).observe(document.querySelector('#app'),{childList:true});sync();
