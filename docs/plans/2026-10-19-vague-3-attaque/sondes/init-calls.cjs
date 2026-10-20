// Champs non fonctionnels du littéral de create<GameState> dont la valeur initiale est un APPEL ou une référence (pas un littéral).
const ts=require('/opt/node-tools/node_modules/typescript');const fs=require('fs');
const F='/home/user/game/src/state/store.ts';const sf=ts.createSourceFile(F,fs.readFileSync(F,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
let obj=null;(function w(n){ if(!obj&&ts.isCallExpression(n)&&n.expression.getText(sf).startsWith('create')){ let b=n.arguments[0].body; if(ts.isParenthesizedExpression(b)) b=b.expression; if(ts.isObjectLiteralExpression(b)) obj=b;} ts.forEachChild(n,w);})(sf);
const lit=(e)=>ts.isLiteralExpression(e)||e.kind===ts.SyntaxKind.NullKeyword||e.kind===ts.SyntaxKind.TrueKeyword||e.kind===ts.SyntaxKind.FalseKeyword||(ts.isPrefixUnaryExpression(e))||(ts.isArrayLiteralExpression(e)&&e.elements.every(lit))||(ts.isObjectLiteralExpression(e)&&e.properties.every(p=>ts.isPropertyAssignment(p)&&lit(p.initializer)))||(ts.isAsExpression(e)&&lit(e.expression));
for(const p of obj.properties){ if(ts.isSpreadAssignment(p)){ console.log('SPREAD', p.expression.getText(sf).slice(0,80)); continue; }
  if(!ts.isPropertyAssignment(p)) continue; const i=p.initializer; if(ts.isArrowFunction(i)||ts.isFunctionExpression(i)) continue;
  if(!lit(i)) console.log(sf.getLineAndCharacterOfPosition(p.getStart()).line+1, p.name.getText(sf), '=', i.getText(sf).replace(/\s+/g,' ').slice(0,90)); }
