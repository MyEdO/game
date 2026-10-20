const ts=require('/opt/node-tools/node_modules/typescript');const fs=require('fs');
const src=fs.readFileSync('/home/user/game/src/state/store.ts','utf8');const sf=ts.createSourceFile('s.ts',src,ts.ScriptTarget.Latest,true);
let obj=null;(function v(n){ if(!obj&&ts.isCallExpression(n)&&n.expression.getText(sf)==='create'&&n.typeArguments){const fn=n.arguments[0];obj=fn.body.kind===ts.SyntaxKind.ParenthesizedExpression?fn.body.expression:fn.body;} ts.forEachChild(n,v);})(sf);
const clo=new Set(process.argv[2].split(' '));
const RAW=/(LDB|ADE|EDOC?|AA|MDG|ZI|CRB|ACE|MSRC|NADJ|VDM) ?(I|II)? ?\d+ ?(l\.|§|ch)/;
const rows=[];
for(const p of obj.properties){ if(!p.name) continue; const isFn=ts.isMethodDeclaration(p)||(ts.isPropertyAssignment(p)&&(ts.isArrowFunction(p.initializer)||ts.isFunctionExpression(p.initializer))); if(!isFn) continue;
 const nm=p.name.getText(sf); const full=src.slice(p.getFullStart(),p.getEnd()); const lines=full.split('\n').length; const thin=/^\s*\(?[^)]*\)?\s*=>\s*\w+(\.\w+)?\(get, set/.test(p.initializer?p.initializer.getText(sf).replace(/^\([^)]*\)/,'()'):'' )||/=> *\w+Flow\.\w+\(get, set/.test(p.getText(sf));
 if(RAW.test(full)&&!clo.has(nm)) rows.push([nm,lines,thin?'mince':'corps']); }
rows.sort((a,b)=>b[1]-a[1]);
console.log('actions de store.ts hors fermeture des 27 portant une réf RAW :',rows.length,'| corps (non mince) :',rows.filter(r=>r[2]==='corps').length,'lignes',rows.filter(r=>r[2]==='corps').reduce((s,r)=>s+r[1],0));
console.log(rows.filter(r=>r[2]==='corps').map(r=>r[0]+'('+r[1]+')').join(' '));
