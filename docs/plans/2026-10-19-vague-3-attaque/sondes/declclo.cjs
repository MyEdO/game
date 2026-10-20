// Fermeture des corps de déclaration de targetingModes.ts : identifiants libres -> import source / local ; appels get().X(
const ts=require('/opt/node-tools/node_modules/typescript');const fs=require('fs');
const F='/home/user/game/src/state/targetingModes.ts';const src=fs.readFileSync(F,'utf8');const sf=ts.createSourceFile(F,src,ts.ScriptTarget.Latest,true);
const A=new Set(fs.readFileSync('A.txt','utf8').trim().split(',').map(s=>'./'+s));
const imp={};const local={};
for(const st of sf.statements){ if(ts.isImportDeclaration(st)){const spec=st.moduleSpecifier.text;const c=st.importClause;if(!c)continue; if(c.name)imp[c.name.text]=spec; const nb=c.namedBindings; if(nb&&ts.isNamedImports(nb)) for(const e of nb.elements) imp[e.name.text]=(c.isTypeOnly||e.isTypeOnly?'type ':'')+spec;}
 else if(ts.isFunctionDeclaration(st)&&st.name) local[st.name.text]=st; else if(ts.isVariableStatement(st)) for(const d of st.declarationList.declarations) if(ts.isIdentifier(d.name)) local[d.name.text]=d; }
const roots=['attackClickCommit','castClickCommit','teleportCommitTile','pushCommitTile','castCommitTile','placingCommitCombatant'];
const seen=new Set();const st=[...roots];const useImp={};const getCalls=new Set();const fields=new Set();
while(st.length){const r=st.pop(); if(seen.has(r))continue; seen.add(r); const node=local[r]; if(!node) continue; const t=node.getText(sf);
 for(const m of t.matchAll(/get\(\)\.([a-zA-Z_]+)\(/g)) getCalls.add(m[1]);
 for(const m of t.matchAll(/get\(\)\.([a-zA-Z_]+)\b(?!\()/g)) fields.add(m[1]);
 (function w(n){ if(ts.isIdentifier(n)&&!(ts.isPropertyAccessExpression(n.parent)&&n.parent.name===n)&&!(ts.isPropertyAssignment(n.parent)&&n.parent.name===n)){ const x=n.text; if(imp[x]) (useImp[imp[x]]=useImp[imp[x]]||new Set()).add(x); else if(local[x]&&x!==r) st.push(x);} ts.forEachChild(n,w);})(node);}
console.log('fonctions locales atteintes :',[...seen].filter(x=>!roots.includes(x)).join(' ')||'(aucune)');
for(const [k,v] of Object.entries(useImp).sort()) console.log((A.has(k.replace('type ',''))?'A  ':'   ')+k,':',[...v].join(','));
console.log('get().X( :',[...getCalls].sort().join(' '));
console.log('get().champ :',[...fields].sort().join(' '));
