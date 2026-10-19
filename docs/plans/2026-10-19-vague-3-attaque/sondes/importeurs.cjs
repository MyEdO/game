const g=require(process.env.GRAPHE);
const A=new Set(process.argv[2].split(',').map(s=>'state/'+s+'.ts'));
const isTest=f=>/\.test\.|testkit|test-setup|fixture/.test(f);
const zone=f=>f.includes('/')?f.split('/')[0]:'racine';
const N=Object.keys(g).filter(f=>f.startsWith('state/')&&!isTest(f)&&!A.has(f));const Ns=new Set(N);
const imp={}; for(const f of N) imp[f]={N:new Set(),A:new Set(),autres:new Set(),valN:0};
for(const [f,v] of Object.entries(g)){ if(isTest(f)) continue; for(const a of v.arcs){ if(!imp[a.to]||f===a.to) continue;
  if(Ns.has(f)){imp[a.to].N.add(f.replace('state/','')); if(!a.type) imp[a.to].valN++;} else if(A.has(f)) imp[a.to].A.add(f.replace('state/','')); else imp[a.to].autres.add(zone(f)); } }
for(const f of N){const i=imp[f]; if(i.valN===0) console.log(f, '| valN=0 N:',[...i.N].join(','),'| A:',[...i.A].join(','),'| autres:',[...i.autres].join(','));}
