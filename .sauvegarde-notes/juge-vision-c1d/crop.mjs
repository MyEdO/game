// usage: node crop.mjs spec.json ; spec = [[src,out,x0,y0,x1,y1,k],...] — lecture seule des PNG, sorties dans juge-vision-c1d/
import { launchSession, evaluate } from '/home/user/game/.wt-1919-H2/scripts/recette/lib.mjs';
import fs from 'node:fs';
const S='/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/';
const specs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const s=await launchSession({width:1200,height:900});
try{
for (const [src,out,x0,y0,x1,y1,k] of specs){
  const data=fs.readFileSync(S+src).toString('base64');
  await evaluate(s,`new Promise(r=>{document.body.style.margin=0;document.body.innerHTML='';const i=new Image();i.style.cssText='image-rendering:pixelated;display:block';i.onload=()=>{i.width=i.naturalWidth;r(1)};i.src='data:image/png;base64,${data}';document.body.appendChild(i);})`);
  const r=await s.rpc('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:x0,y:y0,width:x1-x0,height:y1-y0,scale:k}});
  fs.writeFileSync(S+'juge-vision-c1d/'+out,Buffer.from(r.data,'base64'));
}
} finally { await s.close?.(); }
