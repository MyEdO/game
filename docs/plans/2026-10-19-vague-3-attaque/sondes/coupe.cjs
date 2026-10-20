const g=require(process.env.GRAPHE || './graphe.json');
const isTest=f=>/\.test\.|testkit|test-setup|fixture/i.test(f);
const A=new Set(process.argv[2].split(',').map(s=>'state/'+s+(s.endsWith('.tsx')?'':'.ts')));
const HOSTZ=new Set(['web','net','audio','ui','gameIso','scenes','racine']);
const zone=f=>f.includes('/')?f.split('/')[0]:'racine';
const rows={};
for(const [f,v] of Object.entries(g)){ if(isTest(f)||zone(f)!=='state'||A.has(f))continue;
 for(const a of v.arcs){ if(a.type) continue; const bad = A.has(a.to) || HOSTZ.has(zone(a.to)); if(!bad) continue;
  const vals=a.names.filter(n=>!n.startsWith('type ')); if(!vals.length && !a.names.includes('*export')) continue;
  (rows[a.to]=rows[a.to]||[]).push(f.replace('state/','')+':'+a.line+' {'+vals.join(',')+'}'); } }
for(const [t,l] of Object.entries(rows).sort((a,b)=>b[1].length-a[1].length)){console.log('->',t,l.length);for(const x of l)console.log('   ',x);}
