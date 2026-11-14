/**
 * #3613 — un poste se désigne par son uid (`IdDePoste`), sa place sur son porteur (`hydratePoste`, #2907) : un hôte
 * joue `servirLePoste(posteUid)` et `approvisionnerLaPiece(posteUid, ammoUid)` sans nommer le porteur, que le noyau
 * retrouve dans la bataille (`posteDeLaBataille`).
 */
import { describe, it, beforeEach, expect } from 'vitest';
import { hydratePoste } from '../engine/items';
import { argumentsDuVerbe } from '../hote/geste';
import { VERBES } from '../hote/verbes.generated';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { Combatant } from '../engine/types';
import { combattantDeTest, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const CHARS = { 'capacite-de-combat': 30, 'capacite-de-tir': 60, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

/** Un emplacement au sol dont la baliste, aux deux carreaux du catalogue, est hydratée à sa place, comme au spawn (`spawn.ts`). */
const emplacement = (id: string, pos: { x: number; y: number }): Combatant =>
  combattantDeTest({ id, label: id, kind: 'ennemi', pos, conditions: [], weapons: [], items: [], inert: true,
    wounds: blessuresDeBase(0), advantage: 0,
    postes: [hydratePoste({ trappingId: 'baliste', ammo: { 'carreau-de-baliste': 4, 'carreau-nain-norse': 4 } }, `${id}-poste-0`)] });

const heros = (pos: { x: number; y: number }): Combatant =>
  combattantDeTest({ id: 'hero', label: 'hero', kind: 'heros', characteristics: CHARS, pos, movement: 4,
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], skills: [], talents: [], weapons: [], items: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } });

/** Deux porteurs adjacents au héros actif, chacun sa baliste. */
function bataille() {
  const a = emplacement('empA', { x: 5, y: 5 });
  const b = emplacement('empB', { x: 7, y: 6 });
  const hero = heros({ x: 6, y: 6 });
  banc.setState({
    battle: { combatants: [a, b, hero], order: ['hero', 'empA', 'empB'], turn: 0, round: 1, acted: false, log: [], crewActed: {} } as never,
    party: [hero], facing: {},
  });
  return { posteA: a.postes![0], posteB: b.postes![0] };
}

describe('un poste se désigne par son uid (#3613)', () => {
  it('servirLePoste(posteUid) : l’hôte admet l’uid du poste, et le héros sert CE poste', () => {
    const { posteA, posteB } = bataille();
    const args = argumentsDuVerbe(banc.getState(), 'servirLePoste', [posteB.item.uid], VERBES.servirLePoste);
    expect(args).toEqual(['empB-poste-0']);
    banc.getState().servirLePoste(...(args as [string]));
    const hero = banc.getState().battle!.combatants.find((c) => c.id === 'hero')!;
    expect(hero.mannedPoste?.item.uid).toBe('empB-poste-0');
    expect(posteB.crewIds?.[0]).toBe('hero');
    expect(posteA.crewIds ?? []).not.toContain('hero');
  });

  it('approvisionnerLaPiece(posteUid, ammoUid) : la munition va au poste désigné, sur son porteur, parmi deux', () => {
    const { posteA, posteB } = bataille();
    const args = argumentsDuVerbe(banc.getState(), 'approvisionnerLaPiece', [posteB.item.uid, 'empB-poste-0-carreau-nain-norse'], VERBES.approvisionnerLaPiece);
    banc.getState().approvisionnerLaPiece(...(args as [string, string]));
    expect(posteB.ammoUid).toBe('empB-poste-0-carreau-nain-norse');
    expect(posteA.ammoUid).toBeUndefined();
  });
});
