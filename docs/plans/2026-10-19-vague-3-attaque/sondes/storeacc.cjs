// Accès TYPÉS de N aux membres de GameState implémentés par store.ts (et non par combatSlice) ; lecture seule.
const ts=require('/opt/node-tools/node_modules/typescript');const fs=require('fs');const path=require('path');
const ROOT='/home/user/game';const g=require('./graphe.json');
const A=new Set(fs.readFileSync('A.txt','utf8').trim().split(',').map(s=>'state/'+s+'.ts'));
const isTest=f=>/\.test\.|testkit|test-setup|fixture/i.test(f);
const N=Object.keys(g).filter(f=>f.startsWith('state/')&&!isTest(f)&&!A.has(f)).map(f=>path.join(ROOT,'src',f));
const cfg=ts.getParsedCommandLineOfConfigFile(ROOT+'/tsconfig.json',{},{...ts.sys,onUnRecoverableConfigFileDiagnostic(){}});
const prog=ts.createProgram({rootNames:[...N,ROOT+'/src/state/store.ts'],options:cfg.options});
const chk=prog.getTypeChecker();
const storeSf=prog.getSourceFile(ROOT+'/src/state/store.ts');
let obj=null;(function v(n){ if(!obj&&ts.isCallExpression(n)&&n.expression.getText(storeSf)==='create'&&n.typeArguments){const fn=n.arguments[0];obj=fn.body.kind===ts.SyntaxKind.ParenthesizedExpression?fn.body.expression:fn.body;} ts.forEachChild(n,v);})(storeSf);
const storeFns=new Set();const storeFields=new Set();
for(const p of obj.properties){ if(!p.name) continue; const nm=p.name.getText(storeSf); const isFn=ts.isMethodDeclaration(p)||(ts.isPropertyAssignment(p)&&(ts.isArrowFunction(p.initializer)||ts.isFunctionExpression(p.initializer))); (isFn?storeFns:storeFields).add(nm);}
const gs=chk.getDeclaredTypeOfSymbol(chk.getExportsOfModule(chk.getSymbolAtLocation(storeSf)).find(s=>s.name==='GameState'));
const gsProps=new Set(chk.getPropertiesOfType(gs).map(s=>s.name));
const used={};const usedRegex=new Set();
for(const f of N){ const sf=prog.getSourceFile(f); if(!sf) continue; const rel=path.relative(ROOT+'/src',f);
 for(const m of sf.text.matchAll(/get\(\)\.([a-zA-Z_]+)\(/g)) if(storeFns.has(m[1])) usedRegex.add(m[1]);
 (function w(n){ if(ts.isPropertyAccessExpression(n)){ const nm=n.name.text; if(storeFns.has(nm)&&gsProps.has(nm)){ const t=chk.getTypeAtLocation(n.expression); const ps=t.getProperty&&t.getProperty(nm); if(ps&&gsProps.has(nm)&&chk.getPropertyOfType(t,'battle')&&chk.getPropertyOfType(t,'party')){ (used[nm]=used[nm]||new Set()).add(rel);} } }
  else if(ts.isBindingElement(n)&&ts.isObjectBindingPattern(n.parent)){ const nm=(n.propertyName||n.name).getText(sf); if(storeFns.has(nm)){ const t=chk.getTypeAtLocation(n.parent); if(chk.getPropertyOfType(t,'battle')&&chk.getPropertyOfType(t,'party')) (used[nm]=used[nm]||new Set()).add(rel+'(destr)'); } }
  ts.forEachChild(n,w);})(sf);
}
const typed=Object.keys(used).sort();
console.log('store fns',storeFns.size,'| regex get().X( :',usedRegex.size,'| typés :',typed.length);
console.log('typés hors regex :',typed.filter(x=>!usedRegex.has(x)).map(x=>x+' <- '+[...used[x]].join(',')).join('\n  '));
fs.writeFileSync('seeds-typed.txt',typed.join(','));fs.writeFileSync('seeds-regex.txt',[...usedRegex].sort().join(','));
