// Inventaire des membres de l'objet de create<GameState> (store.ts) : nom, lignes, champ/action,
// réf RAW, classe coop, appels get().X, clés écrites par set({...}), imports de A utilisés.
const ts=require('/opt/node-tools/node_modules/typescript');const fs=require('fs');
const F='/home/user/game/src/state/store.ts';const txt=fs.readFileSync(F,'utf8');
const sf=ts.createSourceFile(F,txt,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const classes=require(process.env.CLASSES || './classes.json');
const A=new Set(fs.readFileSync(process.env.LISTE_A || __dirname+'/A.txt','utf8').trim().split(','));
// imports : nom local -> module
const imp={};
for(const st of sf.statements){ if(ts.isImportDeclaration(st)&&st.importClause&&!st.importClause.isTypeOnly){ const m=st.moduleSpecifier.text.replace(/^\.\//,'').replace(/^\.\.\//,'../'); const c=st.importClause; if(c.name) imp[c.name.text]=m; const nb=c.namedBindings; if(nb&&ts.isNamedImports(nb)) for(const e of nb.elements) if(!e.isTypeOnly) imp[e.name.text]=m; if(nb&&ts.isNamespaceImport(nb)) imp[nb.name.text]=m; } }
let obj=null;
(function w(n){ if(!obj&&ts.isCallExpression(n)&&n.expression.getText(sf).startsWith('create')){ const fn=n.arguments[0]; if(fn&&ts.isArrowFunction(fn)){ let b=fn.body; if(ts.isParenthesizedExpression(b)) b=b.expression; if(ts.isObjectLiteralExpression(b)) obj=b; } } ts.forEachChild(n,w); })(sf);
const RAW=/\b(LDB|ADE|EDO|EDOC|AA|ZI|MDG|ACE|MSRC|NADJ|VDM|CRB)\s?\d/;
const rows=[];
for(const p of obj.properties){ if(ts.isSpreadAssignment(p)) { rows.push({name:'...'+p.expression.getText(sf),spread:true}); continue; }
 const name=p.name.getText(sf); const s=sf.getLineAndCharacterOfPosition(p.getStart()).line+1; const e=sf.getLineAndCharacterOfPosition(p.getEnd()).line+1;
 const init=ts.isPropertyAssignment(p)?p.initializer:p; const isFn=ts.isMethodDeclaration(p)||ts.isArrowFunction(init)||ts.isFunctionExpression(init);
 const calls=new Set(), writes=new Set(), usedA=new Set(), usedImp=new Set();
 (function w(n){ if(ts.isCallExpression(n)){ const c=n.expression; if(ts.isPropertyAccessExpression(c)&&ts.isCallExpression(c.expression)&&c.expression.expression.getText(sf)==='get') calls.add(c.name.text);
   if(ts.isIdentifier(c)&&c.text==='set'&&n.arguments[0]){ let a=n.arguments[0]; if(ts.isArrowFunction(a)){ a=a.body; if(ts.isParenthesizedExpression(a)) a=a.expression; } if(ts.isObjectLiteralExpression(a)) for(const q of a.properties) if(q.name) writes.add(q.name.getText(sf)); else if(ts.isSpreadAssignment(q)) writes.add('...'+q.expression.getText(sf).slice(0,30)); } }
  if(ts.isIdentifier(n)&&imp[n.text]){ const m=imp[n.text]; usedImp.add(m); if(A.has(m.replace(/\.ts$/,''))||/^\.\.\/(web|net|audio|ui|gameIso|scenes)\//.test(m)) usedA.add(m+':'+n.text); }
  ts.forEachChild(n,w); })(init);
 rows.push({name,s,e,lines:e-s+1,fn:isFn,raw:RAW.test(p.getFullText(sf)),classe:classes[name]??null,calls:[...calls],writes:[...writes],usedA:[...usedA]});
}
fs.writeFileSync(process.env.SORTIE || 'storeparts.json',JSON.stringify(rows,null,0));
const fns=rows.filter(r=>r.fn); console.log('membres',rows.length,'actions',fns.length,'lignes actions',fns.reduce((a,r)=>a+r.lines,0));
const by={}; for(const r of fns){ const k=r.classe??'?'; by[k]=by[k]||{n:0,l:0}; by[k].n++; by[k].l+=r.lines; } console.log(by);
