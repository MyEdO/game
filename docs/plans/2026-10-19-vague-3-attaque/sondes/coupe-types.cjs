// Arcs de TYPE de N (state hors A, et noyau existant) vers A, par nom importé.
const g=require(process.env.GRAPHE);
const isTest=f=>/\.test\.|testkit|test-setup|fixture/i.test(f);
const A=new Set(process.argv[2].split(',').map(s=>'state/'+s+(s.endsWith('.tsx')?'':'.ts')));
const zone=f=>f.includes('/')?f.split('/')[0]:'racine';
const rows={};
for(const [f,v] of Object.entries(g)){ if(isTest(f)||!(zone(f)==='state'||zone(f)==='noyau')||A.has(f))continue;
 for(const a of v.arcs){ if(!A.has(a.to)) continue;
  const names=a.type ? a.names : a.names.filter(n=>n.startsWith('type '));
  if(!names.length) continue;
  for(const n of names){ const k=a.to+' '+n.replace('type ',''); (rows[k]=rows[k]||new Set()).add(f); } } }
for(const [k,s] of Object.entries(rows).sort()) console.log(k, s.size);
