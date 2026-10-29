import { describe, it, beforeEach, expect } from 'vitest';
import type { Combatant, ShipPoste } from '../engine/types';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { seedBattleRng } from './battleRng';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * RECHARGE D'UN POSTE DE NAVIRE (MDG 12 l.462 / LDB 62 l.333) — Test ÉTENDU de Projectiles du CHEF de pièce
 * (+ Soutien générique des servants), tâche d'équipage PARALLÈLE : occupe l'équipage (`crewActed`) sans consommer
 * le tour du navire (`acted`). L'état de recharge vit sur le POSTE (`loaded`/`reloadProgress`), pas sur le marin.
 */
const gunner = (): Combatant =>
  ({ id: 'gunner', label: 'Artilleur', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 70, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], fortune: 0, resilience: 0,
    skills: [{ id: 'projectiles', spec: 'poudre-noire', characteristic: 'capacite-de-tir', advances: 20 }], talents: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos: { x: 5, y: 5 } }) as unknown as Combatant;

/** Un poste de canon (Recharge 6) qui A TIRÉ : déchargé, à 5 DR de recharge cumulés (proche de la cible). */
const firedPoste = (over: Partial<ShipPoste> = {}): ShipPoste =>
  ({ side: 'tribord', loaded: false, reloadProgress: 5, crewIds: ['gunner'],
    item: { uid: 'canon', label: 'Canon moyen', kind: 'ranged', subType: 'armes-de-siege', damage: { flat: 14, plusBF: false }, range: 75, qualities: [{ id: 'recharge', value: 6 }] }, ...over }) as unknown as ShipPoste;

const ship = (poste = firedPoste()): Combatant =>
  ({ id: 'ship', label: 'Frégate', kind: 'npc', bodyShape: 'vehicule', creatureId: 'bateau-de-patrouille',
    crewIds: ['gunner'], postes: [poste], pos: { x: 5, y: 5 }, conditions: [], weapons: [] }) as unknown as Combatant;

const setup = (poste = firedPoste()) =>
  banc.setState({ battle: { combatants: [ship(poste), gunner()], order: ['ship'], turn: 0, round: 1, acted: false, log: [], crewActed: {} } as never, party: [gunner()], facing: { ship: 'N' }, pendingReload: null, scene: null as never });

describe('battleShipReload — Test étendu de recharge d’un poste (MDG 12 / LDB 62)', () => {
  it('ouvre la modale de recharge sur le CHEF de pièce, cible = Recharge N', () => {
    setup();
    banc.getState().battleShipReload('ship', 'canon');
    const pr = banc.getState().pendingReload!;
    expect(pr).toBeTruthy();
    expect(pr.actorId).toBe('gunner'); // le chef de pièce lance
    expect(pr.reload).toBe(6); // Recharge 6 (effectif complet → pas de ×2)
    expect(pr.progressBefore).toBe(5); // reprend le Test étendu là où il en était
    expect(pr.posteUid).toBe('canon');
    expect(pr.shipId).toBe('ship');
  });

  it('réussite suffisante → la PIÈCE est rechargée (poste.loaded), PAS le champ du marin ; équipage OCCUPÉ, tour NON consommé', () => {
    seedBattleRng(1); // jet bas → réussite, DR ≥ 1 → 5 + DR ≥ 6 → rechargée
    setup();
    banc.getState().battleShipReload('ship', 'canon');
    banc.getState().reloadRoll();
    banc.getState().reloadConfirm();
    const st = banc.getState();
    const poste = st.battle!.combatants.find((c) => c.id === 'ship')!.postes![0];
    expect(poste.loaded).toBe(true); // la PIÈCE est rechargée
    expect(poste.reloadProgress).toBe(0); // Test étendu terminé → remis à 0
    expect(st.battle!.combatants.find((c) => c.id === 'gunner')!.weapons.some((w) => w.loaded)).toBe(false); // découplé du marin : ses armes à lui n'ont pas bougé
    expect(st.battle!.crewActed?.['ship']).toContain('gunner'); // équipage OCCUPÉ ce Round (ressource)
    expect(st.battle!.acted).toBe(false); // tâche PARALLÈLE : ne consomme pas le tour du navire
  });

  it('une pièce DÉJÀ chargée → no-op (rien à recharger)', () => {
    setup(firedPoste({ loaded: true }));
    banc.getState().battleShipReload('ship', 'canon');
    expect(banc.getState().pendingReload).toBeNull();
  });

  it('chef DÉJÀ engagé ce Round (crewActed) → no-op : un seul Test de recharge par pièce et par Round', () => {
    setup();
    banc.setState({ battle: { ...banc.getState().battle!, crewActed: { ship: ['gunner'] } } as never });
    banc.getState().battleShipReload('ship', 'canon');
    expect(banc.getState().pendingReload).toBeNull();
  });
});

/** CYCLE END-TO-END (le scénario réel) : bordée → la pièce est déchargée → on NE peut PAS re-tirer → au Round
 *  SUIVANT, recharge (Test étendu) → la pièce redevient prête → re-bordée. RAW : recharger occupe un Round
 *  (l'Artilleur qui a tiré le fait ensuite), pas d'auto-rechargement. */
describe('cycle bordée → recharge → re-bordée (MDG 12-14)', () => {
  const gunnerPJ = (): Combatant =>
    ({ id: 'gunner', label: 'Artilleur', kind: 'hero',
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 80, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], fortune: 0, resilience: 0,
      skills: [{ id: 'projectiles', spec: 'poudre-noire', characteristic: 'capacite-de-tir', advances: 30 }], talents: [], weapons: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos: { x: 5, y: 5 } }) as unknown as Combatant;
  const onePoste = (): ShipPoste =>
    ({ side: 'tribord', loaded: true, crewIds: ['gunner'],
      item: { uid: 'canon', label: 'Pierrier', kind: 'ranged', subType: 'armes-de-siege', damage: { flat: 14, plusBF: false }, range: 75, qualities: [{ id: 'recharge', value: 1 }] } }) as unknown as ShipPoste;
  const cycleShip = (): Combatant =>
    ({ id: 'ship', label: 'Frégate', kind: 'hero', bodyShape: 'vehicule', creatureId: 'bateau-de-patrouille',
      crewIds: ['gunner'], postes: [onePoste()], pos: { x: 5, y: 5 }, conditions: [], weapons: [],
      wounds: { current: 50, max: 50, base: 50 } }) as unknown as Combatant;
  const foe = (): Combatant =>
    ({ id: 'target', label: 'Cogue', kind: 'enemy', bodyShape: 'vehicule', creatureId: 'knarr', pos: { x: 9, y: 5 },
      characteristics: { 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: 40, initiative: 0, agilite: 0, dexterite: 0, intelligence: 0, 'force-mentale': 0, sociabilite: 0 },
      wounds: { current: 90, max: 90, base: 90 }, advantage: 0, conditions: [], weapons: [], armour: { corps: 0 }, skills: [], talents: [], crewIds: [] }) as unknown as Combatant;

  it('une pièce qui a tiré ne re-tire pas ; elle redevient prête après un Test de recharge réussi', () => {
    seedBattleRng(1);
    banc.setState({ battle: { combatants: [cycleShip(), gunnerPJ(), foe()], order: ['ship'], turn: 0, round: 1, acted: false, log: [], crewActed: {} } as never, party: [gunnerPJ()], facing: { ship: 'N' }, pendingShipBattery: null, pendingReload: null, scene: null as never });
    // Round 1 : bordée tribord → la pièce tire puis est DÉCHARGÉE.
    banc.getState().battleShipBattery('ship', 'target');
    banc.getState().shipBatteryRoll('gunner');
    banc.getState().shipBatteryConfirm();
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'ship')!.postes![0].loaded).toBe(false);
    // Même Round : 2e bordée impossible (aucune pièce ne porte → ne s'ouvre pas).
    banc.getState().battleShipBattery('ship', 'target');
    expect(banc.getState().pendingShipBattery).toBeNull();
    // Round 2 (crewActed réinitialisé) : recharge de la pièce.
    banc.setState({ battle: { ...banc.getState().battle!, round: 2, crewActed: {} } as never });
    banc.getState().battleShipReload('ship', 'canon');
    expect(banc.getState().pendingReload).toBeTruthy();
    banc.getState().reloadRoll();
    banc.getState().reloadConfirm();
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'ship')!.postes![0].loaded).toBe(true); // rechargée
    // Round 2, après recharge : la bordée redevient possible.
    banc.getState().battleShipBattery('ship', 'target');
    expect(banc.getState().pendingShipBattery).toBeTruthy();
  });
});
