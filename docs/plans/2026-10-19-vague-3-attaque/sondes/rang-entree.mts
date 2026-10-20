// Juge v6 : `entreeEnScene.rang` (D5 v6) sur deux `startScene` successifs sans transition.
import { useGame } from '/home/user/game/src/state/store';
import { testScene } from '/home/user/game/src/scenes/test-fixture';
const g = useGame.getState;
g().startScene(testScene());
useGame.setState({ sheetId: 'h-ancien', inspectId: 'e-ancien', camPan: { x: 7, y: 3 } } as never);
g().startScene(testScene());               // un second scénario lancé depuis le menu, sans transitionTo
console.log('cf4f18bcf : après le 2e startScene, sheetId =', g().sheetId, '| inspectId =', g().inspectId, '| camPan =', JSON.stringify(g().camPan));
// Règle de D5 v6, au pied de la lettre : startScene repart d'etatInitialDuJeu() (entreeEnScene: null, non gardé),
// PUIS marquerLEntree(neuve: true) : rang = 1 + max des rangs connus de l'état courant.
type E = { sceneId: string; neuve: boolean; rang: number } | null;
const marquer = (courant: E, sceneId: string, neuve: boolean): E => ({ sceneId, neuve, rang: 1 + (courant?.rang ?? 0) });
let etat: { entreeEnScene: E } = { entreeEnScene: null };
const observe: string[] = [];
const poser = (next: E) => { const prev = etat.entreeEnScene; etat = { entreeEnScene: next }; if ((prev?.rang ?? null) !== (next?.rang ?? null)) observe.push(`rang ${prev?.rang ?? null}→${next?.rang ?? null}`); };
const startSceneV6 = (id: string, atomique: boolean) => {
  if (atomique) { poser(marquer(null, id, true)); return; }   // remise et marque dans un même set
  poser(null); poser(marquer(etat.entreeEnScene, id, true));   // remise, puis marque (deux set)
};
startSceneV6('test', true); const n1 = observe.length; startSceneV6('test', true);
console.log('D5 v6 (un set)   : 2e startScene observé =', observe.length > n1, '| rangs', JSON.stringify(observe));
observe.length = 0; etat = { entreeEnScene: null };
startSceneV6('test', false); startSceneV6('test', false);
console.log('D5 v6 (deux set) : observations =', JSON.stringify(observe), '(la remise à null est une observation que D5 ne définit pas)');
