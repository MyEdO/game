// Re-mesure indépendante (regex sur mots, pas AST) : accès de N aux champs/actions d'interface, à cf4f18bcf.
const { execSync } = require('child_process');
const REV = 'cf4f18bcf';
const A = new Set(require('fs').readFileSync('/home/user/game/docs/plans/2026-10-19-vague-3-attaque/sondes/A.txt','utf8').trim().split(',').map(s=>'src/state/'+s+'.ts'));
const files = execSync(`git ls-tree -r --name-only ${REV} -- src/state src/noyau`, {cwd:'/home/user/game'}).toString().trim().split('\n')
  .filter(f => /\.tsx?$/.test(f) && !/\.test\.|testkit|TestKit/i.test(f) && !A.has(f));
const UI = 'zoom povActive camRot camEdge camPan viewMode debugLabels debugRoofCut reveler inspectId sheetId sheetTab sheetScroll sheetAlarmsSeen hoverCombatantId hovered hoverDelta keyOverrides editingHeroId gameMenuOpen codexOverlay compendiumFocus compendiumReturn possessionsScreen combatCursor'.split(' ');
const ACT = 'rotateCam setZoom setCamPan resetCamPan toggleViewMode togglePov setReveler setInspectId setSheetId setSheetTab setSheetScroll setSheetAlarmsSeen setHoverCombatant setHovered setKeyBinding resetKeyBindings setScreen setEditingHero openCodex closeCodexOverlay openPossessionsScreen closePossessionsScreen setGameMenu netHostStart netJoin netLeave netAssign setGmSeat netAssignSlot saveGame autoSave loadGame importGame stepPartyDir moveCursor snapCursorToTarget commitCursor clearCursor'.split(' ');
const re = new RegExp(`\\b(${[...UI,...ACT].join('|')})\\b`, 'g');
let n = 0;
for (const f of files) {
  const src = execSync(`git show ${REV}:${f}`, {cwd:'/home/user/game', maxBuffer: 1e9}).toString().split('\n');
  src.forEach((l, i) => {
    const t = l.replace(/\/\/.*$/, '');
    if (/^\s*(\*|\/\*)/.test(l)) return;
    const m = [...t.matchAll(re)].map(x => x[1]);
    if (m.length) { n++; console.log(`${f.replace('src/','')}:${i+1} ${[...new Set(m)].join(',')} | ${l.trim().slice(0,110)}`); }
  });
}
console.log('fichiers N scannés', files.length, 'lignes', n);
