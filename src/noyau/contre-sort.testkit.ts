import type { Combatant } from '../engine/types';
import type { Scene } from './monde/scene';
import type { Banc } from './banc.testkit';
import type { NetState } from './etat';
import { castSpell } from './combatFlow';
import { imposerLesD100 } from './battleRng.testkit';

export const netDuTest = (mode: 'hote' | 'invite', mySeat: number, invite: string): NetState => ({
  mode, mySeat, roomCode: 'ABC234', seatNames: { 0: 'Hôte', 1: 'Antoine' }, presence: {},
  connection: 'connecte', hoteAbsent: false, ownership: { [invite]: 1 }, slots: [1, 1, 0, 0], rangs: {}, gmSeat: 0,
});

export const repondantDuContreSort = 'L';

/** L'hôte ouvre un Carreau sur le sorcier de l'invité, les deux combattants à portée. */
export function armerLeCarreau(banc: Banc, scene: Scene, creerSorcier: () => Combatant, nombreDeRepondants: 1 | 2 = 1): string[] {
  const ids = [repondantDuContreSort, 'M'].slice(0, nombreDeRepondants);
  const sorciers = ids.map((id) => {
    const sorcier = creerSorcier();
    return { ...sorcier, id, label: id };
  });
  const get = banc.getState;
  const set = banc.setState;
  const net = netDuTest('hote', 0, ids[0]);
  net.ownership = Object.fromEntries(ids.map((id, i) => [id, i + 1]));
  set({ party: sorciers, net });
  get().lancerLaScene(scene);
  get().lancerLeCombat('enc-mutants');
  get().fenetreValider('debutDuRound');
  const b = get().battle!;
  const [ennemi, ...autres] = b.combatants.filter((c) => c.kind === 'ennemi');
  autres.forEach((e) => { e.dead = true; });
  ennemi.characteristics.intelligence = 50;
  ennemi.advantage = 1;
  ennemi.fortune = 1;
  ennemi.skills = [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 15 }];
  ennemi.spells = ['carreau'];
  const combattants = ids.map((id) => b.combatants.find((c) => c.id === id)!);
  combattants.forEach((c, i) => { c.pos = { x: 10, y: 10 + i }; });
  ennemi.pos = { x: 12, y: 10 };
  set({ battle: { ...b } });
  castSpell(get, set, ennemi, combattants[0], 'carreau');
  return ids;
}

export function lancerLeCarreau(banc: Banc, ...reponses: number[]): void {
  imposerLesD100(30, ...reponses);
  banc.getState().jetLancer('incantation');
}
