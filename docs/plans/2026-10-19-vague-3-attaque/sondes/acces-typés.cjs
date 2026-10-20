// Accès TYPÉS de N (liste A.txt) aux 26 champs d'interface et aux 38 actions d'adaptateur, avec ligne.
// Tout accès de propriété / destructuration / littéral d'objet contextuellement typé par GameState.
const ts=require('/opt/node-tools/node_modules/typescript');const fs=require('fs');const path=require('path');
const ROOT='/home/user/game';const SRC=ROOT+'/src/';const g=require(__dirname+'/graphe.json');
const A=new Set(fs.readFileSync(__dirname+'/A.txt','utf8').trim().split(',').map(s=>'state/'+s+'.ts'));
const isTest=f=>/\.test\.|testkit|test-setup|fixture/i.test(f);
const N=Object.keys(g).filter(f=>f.startsWith('state/')&&!isTest(f)&&!A.has(f)).map(f=>path.join(SRC,f));
const UI=new Set('zoom povActive camRot camEdge camPan viewMode debugLabels debugRoofCut reveler inspectId sheetId sheetTab sheetScroll sheetAlarmsSeen hoverCombatantId hovered hoverDelta keyOverrides editingHeroId gameMenuOpen codexOverlay compendiumFocus compendiumReturn possessionsScreen combatCursor'.split(' '));
const ACT=new Set('rotateCam setZoom setCamPan resetCamPan toggleViewMode togglePov setReveler setInspectId setSheetId setSheetTab setSheetScroll setSheetAlarmsSeen setHoverCombatant setHovered setKeyBinding resetKeyBindings setScreen setEditingHero openCodex closeCodexOverlay openPossessionsScreen closePossessionsScreen setGameMenu netHostStart netJoin netLeave netAssign setGmSeat netAssignSlot saveGame autoSave loadGame importGame stepPartyDir moveCursor snapCursorToTarget commitCursor clearCursor'.split(' '));
const WATCH=new Set([...UI,...ACT,'screen']);
const cfg=ts.getParsedCommandLineOfConfigFile(ROOT+'/tsconfig.json',{},{...ts.sys,onUnRecoverableConfigFileDiagnostic(){}});
const prog=ts.createProgram({rootNames:[...N,SRC+'state/store.ts'],options:cfg.options});const chk=prog.getTypeChecker();
const storeSf=prog.getSourceFile(SRC+'state/store.ts');
const isGS=(t)=>t&&chk.getPropertyOfType(t,'battle')&&chk.getPropertyOfType(t,'party')&&chk.getPropertyOfType(t,'scene');
const fromStore=(t,nm)=>{const p=t&&chk.getPropertyOfType(t,nm);return p&&p.declarations&&p.declarations.some(d=>d.getSourceFile()===storeSf||/state\/(store|stateFields|combatSlice|rollFlowSpecs)\.ts$/.test(d.getSourceFile().fileName));};
const out=[];
for(const f of N){const sf=prog.getSourceFile(f); if(!sf) continue; const rel=path.relative(SRC,f);
 const L=(n)=>sf.getLineAndCharacterOfPosition(n.getStart()).line+1;
 (function w(n){
  if(ts.isPropertyAccessExpression(n)&&WATCH.has(n.name.text)){ const t=chk.getNonNullableType(chk.getTypeAtLocation(n.expression)); if(isGS(t)) out.push([rel+':'+L(n),'acc',n.name.text]); }
  else if(ts.isBindingElement(n)&&ts.isObjectBindingPattern(n.parent)){ const nm=(n.propertyName||n.name).getText(sf); if(WATCH.has(nm)&&isGS(chk.getNonNullableType(chk.getTypeAtLocation(n.parent)))) out.push([rel+':'+L(n),'destr',nm]); }
  else if((ts.isPropertyAssignment(n)||ts.isShorthandPropertyAssignment(n))&&WATCH.has(n.name.getText(sf))){ const nm=n.name.getText(sf); const ct=chk.getContextualType(n.parent); if(ct&&fromStore(ct,nm)) out.push([rel+':'+L(n),'write',nm]); }
  else if(ts.isElementAccessExpression(n)&&ts.isStringLiteral(n.argumentExpression)&&WATCH.has(n.argumentExpression.text)){ if(isGS(chk.getNonNullableType(chk.getTypeAtLocation(n.expression)))) out.push([rel+':'+L(n),'elem',n.argumentExpression.text]); }
  ts.forEachChild(n,w);})(sf);}
for(const r of out) console.log(r.join('\t'));
console.error('N files',N.length,'hits',out.length);
