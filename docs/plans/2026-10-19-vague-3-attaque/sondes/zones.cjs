// pour chaque fichier de N (non-test), tout arc (valeur ou type) vers une zone que noyau n'ouvre pas
const g=require(process.env.GRAPHE);
const A=new Set(process.argv[2].split(',').map(s=>'state/'+s+'.ts'));
const isTest=f=>/\.test\.|testkit|test-setup|fixture/.test(f);
const zone=f=>f.includes('/')?f.split('/')[0]:'racine';
const OK=new Set(['engine','data','lib','geometry','i18n','noyau']);
const N=Object.keys(g).filter(f=>f.startsWith('state/')&&!isTest(f)&&!A.has(f));
const Nset=new Set(N);
const rows=[];
for(const f of N) for(const a of g[f].arcs){ const z=zone(a.to); if(OK.has(z)) continue; if(z==='state'&&Nset.has(a.to)) continue;
  rows.push([a.type?'TYPE ':'VAL  ', z==='state'?(A.has(a.to)?'A':(isTest(a.to)?'TESTKIT':'?')):z, f+':'+a.line, '->', a.to, JSON.stringify(a.names)].join(' ')); }
rows.sort(); console.log(rows.join('\n')); console.log(rows.length);
