// Champs de GameState : (1) lus/écrits par N (accès typé, set({..}) littéraux) ; (2) modules qui typent chaque champ.
const ts=require('/opt/node-tools/node_modules/typescript');const fs=require('fs');const path=require('path');
const ROOT='/home/user/game';const SRC=ROOT+'/src/';const g=require('./graphe.json');
const A=new Set(fs.readFileSync('A.txt','utf8').trim().split(',').map(s=>'state/'+s+'.ts'));
const isTest=f=>/\.test\.|testkit|test-setup|fixture/i.test(f);
const N=Object.keys(g).filter(f=>f.startsWith('state/')&&!isTest(f)&&!A.has(f)).map(f=>path.join(SRC,f));
const cfg=ts.getParsedCommandLineOfConfigFile(ROOT+'/tsconfig.json',{},{...ts.sys,onUnRecoverableConfigFileDiagnostic(){}});
const prog=ts.createProgram({rootNames:[...N,SRC+'state/store.ts'],options:cfg.options});const chk=prog.getTypeChecker();
const storeSf=prog.getSourceFile(SRC+'state/store.ts');
const gsSym=chk.getExportsOfModule(chk.getSymbolAtLocation(storeSf)).find(s=>s.name==='GameState');
const gs=chk.getDeclaredTypeOfSymbol(gsSym);
const props=chk.getPropertiesOfType(gs);
const isFnType=(s)=>{const d=s.declarations&&s.declarations[0]; if(!d) return false; const t=chk.getTypeOfSymbolAtLocation(s,d); return chk.getNonNullableType(t).getCallSignatures().length>0;};
const fields=props.filter(p=>!isFnType(p));
const fieldNames=new Set(fields.map(f=>f.name));
// (1) accès N
const acc={};
const isGS=(t)=>t&&chk.getPropertyOfType(t,'battle')&&chk.getPropertyOfType(t,'party')&&chk.getPropertyOfType(t,'scene');
for(const f of N){const sf=prog.getSourceFile(f); if(!sf) continue; const rel=path.relative(SRC,f);
 (function w(n){
  if(ts.isPropertyAccessExpression(n)&&fieldNames.has(n.name.text)){ const t=chk.getTypeAtLocation(n.expression); if(isGS(chk.getNonNullableType(t))) (acc[n.name.text]=acc[n.name.text]||new Set()).add(rel); }
  else if(ts.isBindingElement(n)&&ts.isObjectBindingPattern(n.parent)){ const nm=(n.propertyName||n.name).getText(sf); if(fieldNames.has(nm)&&isGS(chk.getNonNullableType(chk.getTypeAtLocation(n.parent)))) (acc[nm]=acc[nm]||new Set()).add(rel); }
  else if(ts.isPropertyAssignment(n)||ts.isShorthandPropertyAssignment(n)){ const nm=n.name.getText(sf); if(fieldNames.has(nm)){ const ct=chk.getContextualType(n.parent); if(ct&&chk.getPropertyOfType(ct,nm)){ const ps=chk.getPropertyOfType(ct,nm); if(ps.declarations&&ps.declarations.some(d=>d.getSourceFile()===storeSf)) (acc[nm]=acc[nm]||new Set()).add(rel+'(w)'); } } }
  else if(ts.isElementAccessExpression(n)&&ts.isStringLiteral(n.argumentExpression)&&fieldNames.has(n.argumentExpression.text)){ if(isGS(chk.getNonNullableType(chk.getTypeAtLocation(n.expression)))) (acc[n.argumentExpression.text]=acc[n.argumentExpression.text]||new Set()).add(rel+'([])'); }
  ts.forEachChild(n,w);})(sf);}
// (2) modules typant chaque champ
const zoneOf=(file)=>{const r=path.relative(SRC,file); if(r.startsWith('..')) return 'ext:'+(file.includes('node_modules')?file.split('node_modules/')[1].split('/')[0]:file); return r;};
const typing={};
for(const p of fields){ const d=p.declarations&&p.declarations[0]; if(!d||!d.type) {typing[p.name]=new Set(['?noannot:'+(d?path.relative(SRC,d.getSourceFile().fileName):'')]);continue;} const s=new Set();
 (function w(n){ if(ts.isTypeReferenceNode(n)||ts.isExpressionWithTypeArguments(n)||ts.isTypeQueryNode(n)){ const id=ts.isTypeReferenceNode(n)?n.typeName:ts.isTypeQueryNode(n)?n.exprName:n.expression; let sym=chk.getSymbolAtLocation(ts.isQualifiedName(id)?id.left:id); if(sym&&sym.flags&ts.SymbolFlags.Alias) sym=chk.getAliasedSymbol(sym); if(sym&&sym.declarations) for(const dd of sym.declarations) s.add(zoneOf(dd.getSourceFile().fileName)); } ts.forEachChild(n,w);})(d.type);
 typing[p.name]=s; }
let rows=[];
for(const p of fields){ const z=[...typing[p.name]]; const bad=z.filter(x=>A.has(x)||/^(ui|gameIso|net|web|audio|scenes)\//.test(x)); const rN=acc[p.name]?[...acc[p.name]].length:0; rows.push({f:p.name,decl:p.declarations?path.relative(SRC,p.declarations[0].getSourceFile().fileName):"?",N:rN,bad,z}); }
console.log('champs',fields.length,'| lus/écrits par N',rows.filter(r=>r.N).length);
console.log('--- champs lus par N typés par A/hôte :'); for(const r of rows.filter(r=>r.N&&r.bad.length)) console.log(r.f,'<-',r.bad.join(','),'| N:',[...acc[r.f]].slice(0,4).join(','),r.N);
console.log('--- champs lus par N typés hors store (state/) :'); for(const r of rows.filter(r=>r.N)) { const st=r.z.filter(x=>x.startsWith('state/')&&x!=='state/store.ts'&&!A.has(x)); }
console.log('--- champs NON lus par N (A seul) :', rows.filter(r=>!r.N).map(r=>r.f).join(' '));
fs.writeFileSync('champs.json',JSON.stringify(rows.map(r=>({...r,Nfiles:acc[r.f]?[...acc[r.f]]:[]})),null,1));
