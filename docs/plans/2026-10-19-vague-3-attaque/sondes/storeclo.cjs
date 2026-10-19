// Fermeture des actions de store.ts appelées (get().X) depuis N : quelles actions de store.ts le lot 3c doit descendre
const ts=require('/opt/node-tools/node_modules/typescript');const fs=require('fs');
const R='/home/user/game/src/state/';
const src=fs.readFileSync(R+'store.ts','utf8');const sf=ts.createSourceFile('store.ts',src,ts.ScriptTarget.Latest,true);
let obj=null;
(function v(n){ if(!obj&&ts.isCallExpression(n)&&n.expression.getText(sf)==='create'&&n.typeArguments){ const fn=n.arguments[0]; obj=fn.body.kind===ts.SyntaxKind.ParenthesizedExpression?fn.body.expression:fn.body; } ts.forEachChild(n,v); })(sf);
const props={};
for(const p of obj.properties){ if((ts.isPropertyAssignment(p)||ts.isMethodDeclaration(p))&&p.name){ const body=p; const txt=body.getText(sf); const isFn=ts.isMethodDeclaration(p)||ts.isArrowFunction(p.initializer)||ts.isFunctionExpression(p.initializer);
  const lines=sf.getLineAndCharacterOfPosition(p.getEnd()).line-sf.getLineAndCharacterOfPosition(p.getStart()).line+1;
  const calls=new Set([...txt.matchAll(/get\(\)\.([a-zA-Z_]+)\(/g)].map(m=>m[1]));
  props[p.name.getText(sf)]={isFn,lines,calls}; } }
const seeds=process.argv[2].split(',');
const seen=new Set();const st=[...seeds];
while(st.length){const a=st.pop(); if(seen.has(a)||!props[a]||!props[a].isFn) continue; seen.add(a); for(const c of props[a].calls) st.push(c);}
let L=0;for(const a of seen)L+=props[a].lines;
const fns=Object.entries(props).filter(([k,v])=>v.isFn);
console.log('actions de store.ts :',fns.length,'lignes',fns.reduce((s,[k,v])=>s+v.lines,0));
console.log('fermeture depuis',seeds.length,'graines :',seen.size,'actions,',L,'lignes');
console.log([...seen].sort().join(' '));
// identifiants libres des corps de la fermeture : déclarations top-level de store.ts et imports depuis A
const A=new Set(fs.readFileSync(process.env.AFILE,'utf8').trim().split(',').map(s=>'./'+s));
const top={};const impA={};
for(const st of sf.statements){ if(ts.isImportDeclaration(st)){ const spec=st.moduleSpecifier.text; const nb=st.importClause?.namedBindings; if(nb&&ts.isNamedImports(nb)) for(const e of nb.elements) if(!e.isTypeOnly&&!st.importClause.isTypeOnly) impA[e.name.text]=spec; if(st.importClause?.name) impA[st.importClause.name.text]=spec; }
 else if(ts.isFunctionDeclaration(st)&&st.name) top[st.name.text]=1; else if(ts.isVariableStatement(st)) for(const d of st.declarationList.declarations) if(ts.isIdentifier(d.name)) top[d.name.text]=1; }
const used={top:new Set(),imp:{}};
for(const p of obj.properties){ if(!p.name||!seen.has(p.name.getText(sf))) continue; (function w(n){ if(ts.isIdentifier(n)){ const t=n.text; if(top[t]&&t!=='useGame') used.top.add(t); if(impA[t]&&(A.has(impA[t])||!impA[t].startsWith('.'))) (used.imp[impA[t]]=used.imp[impA[t]]||new Set()).add(t);} ts.forEachChild(n,w); })(p); }
console.log('top-level de store.ts utilisés :',[...used.top].join(' '));
for(const [k,v] of Object.entries(used.imp)) console.log('import',k,':',[...v].join(' '));
