import { describe, it, beforeEach, expect } from 'vitest';
import type { Combatant, ShipPoste } from '../engine/types';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { seedBattleRng } from './battleRng';
import { combattantDeTest, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { applyShipPostes } from './monde/shipPostes';
import { addCondition } from '../engine/conditions';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * RECHARGE D'UNE PIÈCE DE NAVIRE — le Test étendu de Projectiles du chef de pièce (LDB 62 l.335), Soutien d'un servant
 * (MDG 12 l.462). Il coûte l'Action du chef comme la recharge d'une arme portée (LDB 13 l.106, arbitrage #3595 du
 * 2026-11-07) : sans Tour propre, son engagement du Round (`crewActed`, MDG 14 l.37), pas l'Action du navire. Le
 * registre de charge est la pièce qu'il sert (`mannedPoste`).
 */
const marin = (id: string, pos = { x: 5, y: 5 }): Combatant =>
  combattantDeTest({ id, label: id, kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 70, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(10), advantage: 0, conditions: [], fortune: 0, resilience: 0,
    skills: [{ id: 'projectiles', spec: 'poudre-noire', characteristic: 'capacite-de-tir', advances: 20 }], talents: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos });

/** Un poste de canon (Recharge 6) qui A TIRÉ : déchargé, à 5 DR de recharge cumulés (proche de la cible). */
const firedPoste = (over: Partial<ShipPoste> = {}): ShipPoste =>
  ({ side: 'tribord', loaded: false, reloadProgress: 5, crewIds: ['gunner'],
    item: { uid: 'canon', label: 'Canon moyen', kind: 'distance', subType: 'armes-de-siege', weaponGroup: 'poudre-noire', damage: { flat: 14, plusBF: false }, range: 75, qualities: [{ id: 'recharge', value: 6 }] }, ...over }) as unknown as ShipPoste;

const ship = (poste: ShipPoste): Combatant =>
  combattantDeTest({ id: 'ship', label: 'Frégate', kind: 'heros', bodyShape: 'vehicule', creatureId: 'bateau-de-patrouille',
    crewIds: poste.crewIds, postes: [poste], pos: { x: 5, y: 5 }, conditions: [], weapons: [] });

/** Le navire au Tour, son équipage SANS Tour propre ; `applyShipPostes` fait servir chaque pièce par son chef. */
const setup = (poste = firedPoste(), equipage = [marin('gunner')]) => {
  const all = [ship(poste), ...equipage];
  applyShipPostes(all);
  banc.setState({ battle: { combatants: all, order: ['ship'], turn: 0, round: 1, acted: false, log: [], crewActed: {} } as never, party: equipage, facing: { ship: 'N' }, pendingReload: null, scene: null as never });
  return all;
};
const pieceDe = () => banc.getState().battle!.combatants.find((c) => c.id === 'ship')!.postes![0];

describe('rechargerLArme sur la pièce d’un navire — Test étendu du chef (LDB 62 l.335 ; MDG 12 l.462)', () => {
  it('ouvre la modale de recharge sur le CHEF de pièce, cible = Recharge N, cumul repris', () => {
    setup();
    banc.getState().rechargerLArme('canon');
    const pr = banc.getState().pendingReload!;
    expect(pr.actorId).toBe('gunner');
    expect(pr.weaponUid).toBe('canon');
    expect(pr.reload).toBe(6);
    expect(pr.progressBefore).toBe(5);
  });

  it('réussite suffisante → la PIÈCE est rechargée ; l’Action du chef est dépensée, pas celle du navire (LDB 13 l.106, arbitrage #3595)', () => {
    seedBattleRng(1); // jet bas → réussite, DR ≥ 1 → 5 + DR ≥ 6 → rechargée
    setup();
    banc.getState().rechargerLArme('canon');
    banc.getState().jetLancer('rechargement');
    banc.getState().jetValider('rechargement');
    const st = banc.getState();
    expect(pieceDe().loaded).toBe(true);
    expect(pieceDe().reloadProgress).toBe(0);
    expect(st.battle!.crewActed?.['ship']).toContain('gunner'); // le chef a pris son Action du Round
    expect(st.battle!.acted).toBe(false); // le navire garde la sienne (MDG 14 l.37)
  });

  it('une pièce DÉJÀ chargée → rien à recharger', () => {
    setup(firedPoste({ loaded: true }));
    banc.getState().rechargerLArme('canon');
    expect(banc.getState().pendingReload).toBeNull();
  });

  it('chef qui a DÉJÀ pris son Action ce Round (crewActed) → refusé : une recharge par Action', () => {
    setup();
    banc.setState({ battle: { ...banc.getState().battle!, crewActed: { ship: ['gunner'] } } as never });
    banc.getState().rechargerLArme('canon');
    expect(banc.getState().pendingReload).toBeNull();
  });

  it('chef Sonné → refusé : la recharge est son Action, qu’il ne peut prendre (LDB 16 l.125)', () => {
    const [, chef] = setup();
    addCondition(chef, 'sonne');
    banc.getState().rechargerLArme('canon');
    expect(banc.getState().pendingReload).toBeNull();
  });

  it('un servant adjacent qualifié SOUTIENT le Test de recharge (+10) et voit son Round engagé (MDG 12 l.462 ; LDB 12 l.187-196)', () => {
    seedBattleRng(1);
    setup(firedPoste({ crewIds: ['gunner', 'aide'] }), [marin('gunner'), marin('aide', { x: 5, y: 6 })]);
    banc.getState().rechargerLArme('canon');
    const pr = banc.getState().pendingReload!;
    expect(pr.soutien?.ids).toEqual(['aide']);
    expect(pr.soutien?.bonus).toBe(10);
    banc.getState().jetLancer('rechargement');
    banc.getState().jetValider('rechargement');
    expect(banc.getState().battle!.crewActed?.['ship']).toEqual(expect.arrayContaining(['gunner', 'aide']));
  });
});

/** CYCLE END-TO-END (le scénario réel) : bordée → la pièce est déchargée → on NE peut PAS re-tirer → au Round
 *  SUIVANT, recharge (Test étendu) → la pièce redevient prête → re-bordée. RAW : recharger occupe un Round
 *  (l'Artilleur qui a tiré le fait ensuite), pas d'auto-rechargement. */
describe('cycle bordée → recharge → re-bordée (MDG 12-14)', () => {
  const gunnerPJ = (): Combatant =>
    combattantDeTest({ id: 'gunner', label: 'Artilleur', kind: 'heros',
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 80, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      wounds: blessuresDeBase(10), advantage: 0, conditions: [], fortune: 0, resilience: 0,
      skills: [{ id: 'projectiles', spec: 'poudre-noire', characteristic: 'capacite-de-tir', advances: 30 }], talents: [], weapons: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos: { x: 5, y: 5 } });
  const onePoste = (): ShipPoste =>
    ({ side: 'tribord', loaded: true, crewIds: ['gunner'],
      item: { uid: 'canon', label: 'Pierrier', kind: 'distance', subType: 'armes-de-siege', damage: { flat: 14, plusBF: false }, range: 75, qualities: [{ id: 'recharge', value: 1 }] } }) as unknown as ShipPoste;
  const cycleShip = (): Combatant =>
    combattantDeTest({ id: 'ship', label: 'Frégate', kind: 'heros', bodyShape: 'vehicule', creatureId: 'bateau-de-patrouille',
      crewIds: ['gunner'], postes: [onePoste()], pos: { x: 5, y: 5 }, conditions: [], weapons: [],
      wounds: blessuresDeBase(50) });
  const foe = (): Combatant =>
    combattantDeTest({ id: 'target', label: 'Cogue', kind: 'ennemi', bodyShape: 'vehicule', creatureId: 'knarr', pos: { x: 9, y: 5 },
      characteristics: { 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: 40, initiative: 0, agilite: 0, dexterite: 0, intelligence: 0, 'force-mentale': 0, sociabilite: 0 },
      wounds: blessuresDeBase(90), advantage: 0, conditions: [], weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, skills: [], talents: [], crewIds: [] });

  it('une pièce qui a tiré ne re-tire pas ; elle redevient prête après un Test de recharge réussi', () => {
    seedBattleRng(1);
    const all = [cycleShip(), gunnerPJ(), foe()];
    applyShipPostes(all);
    banc.setState({ battle: { combatants: all, order: ['ship'], turn: 0, round: 1, acted: false, log: [], crewActed: {} } as never, party: [gunnerPJ()], facing: { ship: 'N' }, pendingShipBattery: null, pendingReload: null, scene: null as never });
    // Round 1 : bordée tribord → la pièce tire puis est DÉCHARGÉE.
    banc.getState().ouvrirLaBordee('ship', 'target');
    banc.getState().jetLancer('tirDeBatterie', 'gunner');
    banc.getState().jetValider('tirDeBatterie');
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'ship')!.postes![0].loaded).toBe(false);
    // Même Round : 2e bordée impossible (aucune pièce ne porte → ne s'ouvre pas).
    banc.getState().ouvrirLaBordee('ship', 'target');
    expect(banc.getState().pendingShipBattery).toBeNull();
    // Round 2 (crewActed réinitialisé) : recharge de la pièce.
    banc.setState({ battle: { ...banc.getState().battle!, round: 2, crewActed: {} } as never });
    banc.getState().rechargerLArme('canon');
    expect(banc.getState().pendingReload).toBeTruthy();
    banc.getState().jetLancer('rechargement');
    banc.getState().jetValider('rechargement');
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'ship')!.postes![0].loaded).toBe(true); // rechargée
    // Round 2, après recharge : la bordée redevient possible.
    banc.getState().ouvrirLaBordee('ship', 'target');
    expect(banc.getState().pendingShipBattery).toBeTruthy();
  });
});
