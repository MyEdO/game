import { useGame } from '/home/user/game/src/state/store';
import { netSnapshot } from '/home/user/game/src/state/netFlow';
const s = useGame.getState() as any;
useGame.setState({ camRot: 2, sheetId: 'x', codexOverlay: { kind: 'talent', id: 'y' } as any, screen: 'compendium' as any, keyOverrides: { a: 'b' } as any } as any);
const snap = netSnapshot(useGame.getState) as any;
const data = snap.game ?? snap;
const UI = 'zoom povActive camRot camEdge camPan viewMode debugLabels debugRoofCut reveler inspectId sheetId sheetTab sheetScroll sheetAlarmsSeen hoverCombatantId hovered hoverDelta keyOverrides editingHeroId gameMenuOpen codexOverlay compendiumFocus compendiumReturn possessionsScreen combatCursor screen localIntent'.split(' ');
for (const k of UI) console.log(k, k in data ? 'IN-SNAPSHOT' : 'absent', JSON.stringify(data[k]));
console.log('keys', Object.keys(data).length);
