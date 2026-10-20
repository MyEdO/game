// Fermeture de type de Jeu = EtatDeJeu (champs hors interface) & ActionsDuNoyau (actions hors 38 d'adaptateur) :
// déclarations atteintes qui vivent dans un module de A (hors store.ts, qui déménage en etat.ts) ou une zone d'hôte.
const ts=require('/opt/node-tools/node_modules/typescript');const fs=require('fs');const path=require('path');
const ROOT='/home/user/game';const SRC=ROOT+'/src/';
const A=new Set(fs.readFileSync(__dirname+'/A.txt','utf8').trim().split(',').map(s=>'state/'+s+'.ts'));
const UI=new Set('zoom povActive camRot camEdge camPan viewMode debugLabels debugRoofCut reveler inspectId sheetId sheetTab sheetScroll sheetAlarmsSeen hoverCombatantId hovered hoverDelta keyOverrides editingHeroId gameMenuOpen codexOverlay compendiumFocus compendiumReturn possessionsScreen combatCursor'.split(' '));
const ACT=new Set('rotateCam setZoom setCamPan resetCamPan toggleViewMode togglePov setReveler setInspectId setSheetId setSheetTab setSheetScroll setSheetAlarmsSeen setHoverCombatant setHovered setKeyBinding resetKeyBindings setScreen setEditingHero openCodex closeCodexOverlay openPossessionsScreen closePossessionsScreen setGameMenu netHostStart netJoin netLeave netAssign setGmSeat netAssignSlot saveGame autoSave loadGame importGame stepPartyDir moveCursor snapCursorToTarget commitCursor clearCursor'.split(' '));
const cfg=ts.getParsedCommandLineOfConfigFile(ROOT+'/tsconfig.json',{},{...ts.sys,onUnRecoverableConfigFileDiagnostic(){}});
const prog=ts.createProgram({rootNames:[SRC+'state/store.ts'],options:cfg.options});const chk=prog.getTypeChecker();
const storeSf=prog.getSourceFile(SRC+'state/store.ts');
const gs=chk.getDeclaredTypeOfSymbol(chk.getExportsOfModule(chk.getSymbolAtLocation(storeSf)).find(s=>s.name==='GameState'));
const rel=f=>path.relative(SRC,f);
const GSDECL=chk.getExportsOfModule(chk.getSymbolAtLocation(storeSf)).find(s=>s.name==='GameState').declarations[0];
const gsProps=new Map(chk.getPropertiesOfType(gs).map(p=>[p.name,p]));
const bad=f=>{const r=rel(f); return (A.has(r)&&r!=='state/store.ts')||/^(ui|gameIso|net|web|audio)\//.test(r);};
const seenDecl=new Set();const hits={};
function visitDecl(d,via){ if(d===GSDECL) return; if(seenDecl.has(d)) return; seenDecl.add(d); const f=d.getSourceFile().fileName; if(f.includes('node_modules')) return;
  if(bad(f)){ const nm=(d.name&&d.name.getText&&d.name.getText())||ts.SyntaxKind[d.kind]; (hits[rel(f)+' :: '+nm]=hits[rel(f)+' :: '+nm]||new Set()).add(via); }
  walk(d,via); }
function walk(n,via){ if(ts.isIndexedAccessTypeNode(n)&&ts.isTypeReferenceNode(n.objectType)&&n.objectType.typeName.getText()==='GameState'&&ts.isLiteralTypeNode(n.indexType)){ const k=n.indexType.literal.text; const p=gsProps.get(k); if(UI.has(k)||ACT.has(k)) (hits['ACCES GameState['+k+']']=hits['ACCES GameState['+k+']']||new Set()).add(via); if(p) for(const d of p.declarations||[]) if(d.type) walk(d.type,via); return; }
 if(ts.isTypeReferenceNode(n)||ts.isExpressionWithTypeArguments(n)||ts.isTypeQueryNode(n)||ts.isImportTypeNode(n)){
   let id=ts.isTypeReferenceNode(n)?n.typeName:ts.isTypeQueryNode(n)?n.exprName:ts.isImportTypeNode(n)?n.qualifier:n.expression;
   if(id){ let sym=chk.getSymbolAtLocation(id); if(sym&&sym.flags&ts.SymbolFlags.Alias) sym=chk.getAliasedSymbol(sym); if(sym&&sym.declarations) for(const d of sym.declarations) visitDecl(d,via); } }
  // typeof valeur : suivre la déclaration de la valeur (const X = ... as const)
  ts.forEachChild(n,c=>walk(c,via)); }
let nf=0,na=0;
for(const p of chk.getPropertiesOfType(gs)){ if(UI.has(p.name)||ACT.has(p.name)) continue; for(const d of p.declarations||[]){ const f=d.getSourceFile().fileName; if(d.type){ walk(d.type,p.name); } else walk(d,p.name); } }
for(const [k,v] of Object.entries(hits).sort()) console.log(k,'<-',[...v].slice(0,6).join(','),v.size>6?'(+'+(v.size-6)+')':'');
console.error('hits',Object.keys(hits).length);
