// Fermeture TRANSITIVE de type : depuis les champs de GameState que N touche (champs.json) et les types que N importe de store.ts,
// quelles déclarations vivent dans A ou une zone d'hôte ? (lecture seule)
const ts=require('/opt/node-tools/node_modules/typescript');const fs=require('fs');const path=require('path');
const ROOT='/home/user/game';const SRC=ROOT+'/src/';
const A=new Set(fs.readFileSync('A.txt','utf8').trim().split(',').map(s=>'state/'+s+'.ts'));
const rows=require('./champs.json');const touched=new Set(rows.filter(r=>r.N).map(r=>r.f));
const cfg=ts.getParsedCommandLineOfConfigFile(ROOT+'/tsconfig.json',{},{...ts.sys,onUnRecoverableConfigFileDiagnostic(){}});
const prog=ts.createProgram({rootNames:[SRC+'state/store.ts'],options:cfg.options});const chk=prog.getTypeChecker();
const storeSf=prog.getSourceFile(SRC+'state/store.ts');
const exp=chk.getExportsOfModule(chk.getSymbolAtLocation(storeSf));
const gs=chk.getDeclaredTypeOfSymbol(exp.find(s=>s.name==='GameState'));
const startNodes=[];
for(const p of chk.getPropertiesOfType(gs)) if(touched.has(p.name)&&p.declarations) for(const d of p.declarations) if(d.type) startNodes.push([d.type,'champ '+p.name]);
for(const n of ['BattleState','RevealEntry','ShootingStanceKey','Objective','CampaignVessel']){ const s=exp.find(x=>x.name===n); if(s){ const r=s.flags&ts.SymbolFlags.Alias?chk.getAliasedSymbol(s):s; for(const d of r.declarations||[]) startNodes.push([d,'type '+n]); } }
const seen=new Set();const hits={};
const rel=f=>path.relative(SRC,f);
const bad=f=>{const r=rel(f); return A.has(r)&&r!=='state/store.ts' || /^(ui|gameIso|net|web|audio|scenes)\//.test(r) || r==='state/store.ts'?r:null;};
function walk(node,from){ (function w(n){ if(ts.isTypeReferenceNode(n)||ts.isExpressionWithTypeArguments(n)||ts.isTypeQueryNode(n)||ts.isImportTypeNode(n)){
   let id=ts.isTypeReferenceNode(n)?n.typeName:ts.isTypeQueryNode(n)?n.exprName:ts.isImportTypeNode(n)?n.qualifier:n.expression; if(!id){ts.forEachChild(n,w);return;}
   let sym=chk.getSymbolAtLocation(ts.isQualifiedName(id)?id.right:id); if(sym&&sym.flags&ts.SymbolFlags.Alias) sym=chk.getAliasedSymbol(sym);
   if(sym&&sym.declarations) for(const d of sym.declarations){ const f=d.getSourceFile().fileName; if(f.includes('node_modules')) continue; const key=f+'#'+sym.name; const r=rel(f);
     if((A.has(r)&&r!=='state/store.ts')||/^(ui|gameIso|net|web|audio|scenes)\//.test(r)) (hits[r+' :: '+sym.name]=hits[r+' :: '+sym.name]||new Set()).add(from);
     if(!seen.has(key)){ seen.add(key); if(!/^(engine|data|lib|geometry|i18n|noyau)\//.test(r)) walk(d,from+' > '+sym.name); } } }
  ts.forEachChild(n,w);})(node); }
for(const [n,from] of startNodes) walk(n,from);
for(const [k,v] of Object.entries(hits)) console.log(k,'  via',[...v].slice(0,2).join(' | '),v.size>2?'(+'+(v.size-2)+')':'');
