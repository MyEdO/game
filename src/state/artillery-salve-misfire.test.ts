import { describe, it, expect } from 'vitest';
import { applyOups } from './combatFlow';
import { OPS_DIFFEREES } from './combatEffects';
import { useGame } from './store';
import type { CascadeStep } from './pendings';
import type { Combatant, Weapon } from '../engine/types';

/**
 * #450 — branchement de la Table AA « Incidents de Tir d'Artillerie par Salve » (AA 10 l.270-277) :
 * une arme dotée de l'Atout *Salve* (id `salve`) qui subit un Incident de tir (`applyOups`,
 * cas `misfire`) tire EN PLUS sur ce tableau d10 dédié — AA 10 l.264. DISTINCT de l'Incident de tir
 * GÉNÉRIQUE d'Arme d'équipe (MDG 12 l.464) déjà résolu par le même appelant.
 *
 * Le d10 de cette table PASSE PAR LA PORTE (#1508 T3b-4) : `applyOups` n'applique rien tant qu'il
 * n'est pas tombé (elle rend `OPS_DIFFEREES`), et c'est le JOUEUR qui le pose — d'où `poserLesDes`.
 */

/** L'étape COURANTE de la séquence en vol (celle que la fenêtre servirait). */
const etapeCourante = (): CascadeStep | undefined => {
  const p = useGame.getState().pendingCascade;
  return p?.participants[p.cursor];
};

/** POSE `valeur` sur chaque dé que la porte ouvre, et avance — le geste du joueur, jamais un appel
 *  moteur. Rend les `kind` des étapes jouées, dans l'ordre. */
function poserLesDes(valeur: number): string[] {
  const joues: string[] = [];
  for (let garde = 0; garde < 8 && useGame.getState().pendingCascade; garde++) {
    const st = etapeCourante();
    if (!st) break;
    joues.push(st.kind);
    if (st.de && !st.de.result) useGame.getState().cascadeDieSetForcedRoll(st.id, valeur);
    if (st.table && !st.table.result) useGame.getState().cascadeTableSetForcedRoll(st.id, valeur);
    useGame.getState().cascadeNext();
  }
  return joues;
}
const chars = { 'capacite-de-combat': 30, 'capacite-de-tir': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const mkHero = (id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ id, name: id, kind: 'hero', characteristics: { ...chars },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], items: [],
    skills: [], talents: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos: { x: 5, y: 5 }, ...over }) as unknown as Combatant;

const salveGun: Weapon = {
  name: 'Batterie tonnerre de feu', label: 'Batterie tonnerre de feu', type: 'ranged', subType: 'ingenierie',
  damage: { flat: 12, plusBF: false },
  qualities: [{ id: 'salve', value: 9 }, { id: 'arme-d-equipe', value: 3 }],
} as unknown as Weapon;

const setup = (chef: Combatant, aide?: Combatant) => {
  useGame.setState({
    battle: { combatants: aide ? [chef, aide] : [chef], order: [chef.id], turn: 0, round: 1, acted: false, log: [] } as never,
    party: aide ? [chef, aide] : [chef], facing: {}, scene: null as never,
    pendingCascade: null, suspendedCascades: [],
  });
  return { get: () => useGame.getState(), set: ((patch: never) => useGame.setState(patch)) as never };
};

describe('Incident de Tir d’Artillerie par Salve (AA 10 l.270-277) — branchement `applyOups`', () => {
  it("arme à Atout Salve : le tireur encaisse ET journalise l'Incident par Salve en plus du misfire générique", () => {
    const chef = mkHero('chef');
    const { get, set } = setup(chef);
    const issue = applyOups(get, set, chef, { ...salveGun, chambered: 5 }, { roll: 44, kind: 'misfire', label: 'Incident de Tir !' });
    expect(issue, 'le d10 de la table part à la porte : rien n’est appliqué avant').toBe(OPS_DIFFEREES);
    expect(chef.wounds.current, 'aucune Blessure tant que le dé n’est pas tombé').toBe(20);
    expect(etapeCourante()?.table?.tableId).toBe('artillery-salve-misfire');
    expect(poserLesDes(2), 'une seule étape : la table (l’arme n’est pas Solide)').toEqual(['casseDArme']);
    expect(chef.wounds.current).toBeLessThan(20);
    const log = get().battle!.log.map((l) => l.text ?? l).join(' | ');
    expect(log).toContain('Salve');
    expect(log, 'la ligne tirée est celle du dé POSÉ (1-4 : Bras principal)').toContain('Bras principal');
  });

  it('arme à Salve ET Arme d’équipe : le second servant (aide) encaisse aussi la Table par Salve', () => {
    const chef = mkHero('chef', { mannedPoste: { crewIds: ['chef', 'aide'] } as never });
    const aide = mkHero('aide');
    const { get, set } = setup(chef, aide);
    const issue = applyOups(get, set, chef, { ...salveGun, chambered: 0 }, { roll: 44, kind: 'misfire', label: 'Incident de Tir !' });
    expect(issue).toBe(OPS_DIFFEREES);
    expect(aide.wounds.current, 'l’équipage n’encaisse rien avant le dé').toBe(20);
    poserLesDes(2);
    // Générique d'équipe (MDG 12 l.464) ET Table par Salve (AA) frappent tous deux l'aide au moins une fois.
    expect(aide.wounds.current).toBeLessThan(20);
  });

  it('la reprise du dé lit l’ARME, jamais son libellé : une pièce SANS libellé encaisse la même Table', () => {
    const chef = mkHero('chef');
    const { get, set } = setup(chef);
    const sansLibelle = { ...salveGun, chambered: 5, label: undefined } as unknown as Weapon;
    expect(applyOups(get, set, chef, sansLibelle, { roll: 44, kind: 'misfire', label: 'Incident de Tir !' })).toBe(OPS_DIFFEREES);
    poserLesDes(2);
    expect(chef.wounds.current, 'le dé tombé est appliqué : l’arme est en jeu, libellé ou non').toBeLessThan(20);
  });

  it('arme SANS Atout Salve : aucun jet/branchement sur la Table par Salve (misfire générique inchangé)', () => {
    const gun: Weapon = { name: 'Arbalète', label: 'Arbalète', type: 'ranged', damage: { flat: 8, plusBF: false }, qualities: [] } as unknown as Weapon;
    const chef = mkHero('chef');
    const { get, set } = setup(chef);
    const issue = applyOups(get, set, chef, gun, { roll: 44, kind: 'misfire', label: 'Incident de Tir !' });
    expect(issue, 'aucun dé à ouvrir : la Maladresse s’applique sur place').toBeUndefined();
    expect(useGame.getState().pendingCascade, 'aucune étape ouverte').toBeNull();
    const log = get().battle!.log.map((l) => l.text ?? l).join(' | ');
    expect(log).not.toContain('Salve');
  });
});
