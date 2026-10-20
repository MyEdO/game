// Identifiants de premier niveau de store.ts cités par les membres de create<GameState>, séparés adaptateur / noyau.
const ts=require('/opt/node-tools/node_modules/typescript');const fs=require('fs');
const F='/home/user/game/src/state/store.ts';const sf=ts.createSourceFile(F,fs.readFileSync(F,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const ADAPT=new Set('rotateCam setZoom setCamPan resetCamPan toggleViewMode togglePov setReveler setInspectId setSheetId setSheetTab setSheetScroll setSheetAlarmsSeen setHoverCombatant setHovered setKeyBinding resetKeyBindings setScreen setEditingHero openCodex closeCodexOverlay openPossessionsScreen closePossessionsScreen setGameMenu netHostStart netJoin netLeave netAssign setGmSeat netAssignSlot saveGame autoSave loadGame importGame stepPartyDir'.split(' '));
const top=new Set();
for(const s of sf.statements){ if(ts.isImportDeclaration(s)||ts.isExportDeclaration(s)) continue;
 if(ts.isVariableStatement(s)) s.declarationList.declarations.forEach(d=>top.add(d.name.getText())); else if(s.name) top.add(s.name.getText()); }
let obj=null;(function w(n){ if(!obj&&ts.isCallExpression(n)&&n.expression.getText(sf).startsWith('create')){ let b=n.arguments[0].body; if(ts.isParenthesizedExpression(b)) b=b.expression; if(ts.isObjectLiteralExpression(b)) obj=b;} ts.forEachChild(n,w);})(sf);
const noy={}, ad={}; let nActions=0, nAd=0;
for(const p of obj.properties){ if(ts.isSpreadAssignment(p)){ (function w(n){ if(ts.isIdentifier(n)&&top.has(n.text)) (noy[n.text]=noy[n.text]||new Set()).add('...spread'); ts.forEachChild(n,w);})(p); continue; }
 const name=p.name.getText(sf); const init=ts.isPropertyAssignment(p)?p.initializer:p; const isFn=ts.isMethodDeclaration(p)||ts.isArrowFunction(init)||ts.isFunctionExpression(init);
 const tgt = ADAPT.has(name)?ad:noy; if(isFn){ if(ADAPT.has(name)) nAd++; else nActions++; }
 (function w(n){ if(ts.isIdentifier(n)&&top.has(n.text)&&!(ts.isPropertyAccessExpression(n.parent)&&n.parent.name===n)) (tgt[n.text]=tgt[n.text]||new Set()).add(name); ts.forEachChild(n,w);})(init);
}
console.log('actions noyau',nActions,'adaptateur',nAd);
console.log('NOYAU cite:'); for(const [k,v] of Object.entries(noy)) console.log(' ',k,'<-',[...v].slice(0,6).join(','), v.size>6?'…'+v.size:'');
console.log('ADAPTATEUR cite:'); for(const [k,v] of Object.entries(ad)) console.log(' ',k,'<-',[...v].join(','));
