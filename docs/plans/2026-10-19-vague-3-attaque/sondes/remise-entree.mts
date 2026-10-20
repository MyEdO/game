// Juge v7 : ce que startScene et transitionTo remettent AUJOURD'HUI (cf4f18bcf) parmi les 25 champs
// d'interface, confronté à la liste de remettreLAdaptateur (D5 v7).
import { useGame } from '/home/user/game/src/state/store';
import { registerScene } from '/home/user/game/src/state/store';
const UI = 'zoom povActive camRot camEdge camPan viewMode debugLabels debugRoofCut reveler inspectId sheetId sheetTab sheetScroll sheetAlarmsSeen hoverCombatantId hovered hoverDelta keyOverrides editingHeroId gameMenuOpen codexOverlay compendiumFocus compendiumReturn possessionsScreen combatCursor'.split(' ');
const SALE: Record<string, unknown> = { zoom: 2, povActive: true, camRot: 2, camEdge: true, camPan: { x: 5, y: 5 }, viewMode: 'top', debugLabels: true, debugRoofCut: false, reveler: true, inspectId: 'x', sheetId: 'x', sheetTab: 'magie', sheetScroll: { etat: 9 }, sheetAlarmsSeen: { h: 'f' }, hoverCombatantId: 'x', hovered: 'x', hoverDelta: { x: 1 }, keyOverrides: { 'cam-left': 'KeyZ' }, editingHeroId: 'x', gameMenuOpen: true, codexOverlay: { kind: 'x' }, compendiumFocus: { kind: 'x' }, compendiumReturn: 'party', possessionsScreen: { uid: null }, combatCursor: { tile: { x: 1, y: 1 } } };
const scene = (id: string): any => ({ id, label: id, dimensions: { w: 6, h: 6 }, tiles: [], walls: [], entities: [{ id: 'hs', kind: 'heroStart', pos: { x: 1, y: 1 } }], flags: {} });
const remis = () => UI.filter(k => JSON.stringify((useGame.getState() as any)[k]) !== JSON.stringify(SALE[k]));
const D5_TOUJOURS = ['camEdge', 'camPan'];
const D5_NEUVE = 'debugLabels debugRoofCut reveler inspectId sheetId sheetTab sheetScroll sheetAlarmsSeen hoverCombatantId hovered editingHeroId gameMenuOpen codexOverlay compendiumFocus compendiumReturn possessionsScreen combatCursor'.split(' ');
const cmp = (nom: string, auj: string[], d5: string[]) => {
  const a = auj.filter(k => k !== 'hoverDelta');
  console.log(`${nom} : aujourd'hui ${a.length} remis | D5 ${d5.length} | en moins dans D5 ${JSON.stringify(a.filter(k => !d5.includes(k)))} | en trop dans D5 ${JSON.stringify(d5.filter(k => !a.includes(k)))}`);
};
useGame.setState(SALE as never); useGame.getState().startScene(scene('s1'));
cmp('startScene', remis(), [...D5_TOUJOURS, ...D5_NEUVE]);
registerScene(scene('s2'));
useGame.setState(SALE as never); useGame.getState().transitionTo('s2');
cmp('transitionTo', remis(), D5_TOUJOURS);
