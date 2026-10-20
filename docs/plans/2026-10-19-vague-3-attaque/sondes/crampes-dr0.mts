// Juge v7 : D10 promet d'asserter « l'effet que pose l'échec » des Crampes abdominales sur un échec SANS JET,
// dont le DR est 0 (echec-sans-jet-appliers.test.ts:248-266). Effet observable à DR 0, -2, -4, -6 ?
import { useGame } from '/home/user/game/src/state/store';
import { fireOwnTestFailed } from '/home/user/game/src/noyau/triggeredEffects';
import { makeRNG } from '/home/user/game/src/engine/dice';
for (const sl of [0, -1, -2, -4, -6]) {
  const h: any = { id: 'h', label: 'Hilda', kind: 'hero', characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 40, intelligence: 30, 'force-mentale': 35, sociabilite: 30 }, wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], talents: [], weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [], movement: 4, skills: [] };
  h.diseases = [{ id: 'colique', phase: 'active', symptoms: [{ symptomId: 'crampes-abdominales' }], minutesLeft: 1e5, durationMinutes: 1e5 }];
  useGame.setState({ party: [h], battle: null, journal: [], pendingCascade: null });
  const lignes = fireOwnTestFailed(useGame.getState, 'h', { sl, rng: makeRNG(7) });
  const c = (useGame.getState().party[0] as any).conditions ?? [];
  console.log(`DR ${sl} : lignes ${lignes.length} | États ${JSON.stringify(c.map((x: any) => x.id ?? x))}`);
}
