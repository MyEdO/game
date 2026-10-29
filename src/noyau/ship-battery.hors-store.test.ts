import { describe, it, beforeEach, expect } from 'vitest';
import { resolveBattery } from './monde/shipBattery';
import type { Combatant, ShipPoste, SkillInstance } from '../engine/types';
import type { FireArc } from '../engine/types';
import type { RNG } from '../engine/dice';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { seedBattleRng } from './battleRng';
import { rollCrewRole } from './shipManeuver';
import { makeRNG } from '../engine/dice';
import { jete } from '../engine/tests.testkit';
import { rangeBandName, toucheAuJetPose } from '../engine/combat';
import { propulsionDuNavire } from '../engine/shipBuild';
import { resolveVolley } from '../engine/volley';
import { jouerLesTirsDeBordee } from './combatFlow';
import { draineCascade, poseSurDeNonTombe } from './cascade.testkit';
import { t } from '../i18n';
import { deFixe, desEnSuite } from '../engine/dice.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Compétence de Navigation d'une Cogue (`propulsionDuNavire`, MDG 13 l.18-19). */
const NAVIGATION = propulsionDuNavire('cogue', undefined, 'maritime')!.competence;

/** Combattant d'équipage minimal (carac d'instance = Dex → valeur prévisible). Calqué sur crew-roles.test.ts. */
const mk = (chars: Partial<Record<string, number>>, skills: { id: string; advances: number; spec?: string }[] = []): Combatant =>
  ({
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30, ...chars },
    skills: skills.map((s) => ({ ...s, characteristic: 'dexterite' }) as SkillInstance),
    kind: 'hero', wounds: { current: 10, max: 10 }, conditions: [], talents: [],
  }) as unknown as Combatant;
const seq = (values: number[]): RNG => desEnSuite(values);

const poste = (side: FireArc, uid: string): ShipPoste => ({ item: { uid, name: `Canon ${side}` } as never, side });
const hull = (postes: ShipPoste[]): Combatant =>
  ({ id: 'hull', label: 'Galère', pos: { x: 5, y: 5 }, postes, conditions: [], weapons: [] }) as unknown as Combatant;
const target = (x: number, y: number): Combatant =>
  ({ id: 'cible', label: 'Cible', pos: { x, y }, conditions: [], weapons: [] }) as unknown as Combatant;
const artilleur = () => mk({ dexterite: 80 }, [{ id: 'projectiles', advances: 0, spec: 'poudre-noire' }]); // valeur 80

/**
 * Tir de batterie (MDG 14 l.126-130) : « le total de DR s'applique à toutes les armes à feu tournées vers
 * l'ennemi ». Le résolveur PUR détermine la bordée qui porte + ses pièces + le DR PARTAGÉ (Test d'équipage
 * Artilleur essentiel). L'application par pièce (Dégâts + DR) est le suivi (flux/modale).
 */
describe('resolveBattery — lâcher une bordée (DR partagé, MDG 14)', () => {
  it('cap Nord, cible plein EST → bordée TRIBORD ; seules SES pièces tirent ; DR = total du Test d’équipage', () => {
    const h = hull([poste('tribord', 't1'), poste('tribord', 't2'), poste('babord', 'b1')]);
    const plan = resolveBattery(h, target(9, 5), 'N', [{ crew: artilleur(), roleId: 'artilleur' }], 80, NAVIGATION, seq([30]))!;
    expect(plan.side).toBe('tribord');
    expect(plan.postes.map((p) => p.item.uid)).toEqual(['t1', 't2']); // pas la pièce bâbord
    expect(plan.dr).toBe(plan.crewTest.total); // le DR partagé = le total du Test d'équipage
    expect(plan.crewTest.contributions[0].essential).toBe(true); // Artilleur = rôle ESSENTIEL (DR ×2)
  });

  it('cible plein OUEST → bordée BÂBORD (le bord opposé tire)', () => {
    const h = hull([poste('tribord', 't1'), poste('babord', 'b1'), poste('babord', 'b2')]);
    const plan = resolveBattery(h, target(1, 5), 'N', [{ crew: artilleur(), roleId: 'artilleur' }], 80, NAVIGATION, seq([30]))!;
    expect(plan.side).toBe('babord');
    expect(plan.postes.map((p) => p.item.uid)).toEqual(['b1', 'b2']);
  });

  it('aucune pièce sur la bordée qui porte → null (rien à lâcher, pas de Test gaspillé)', () => {
    const h = hull([poste('babord', 'b1')]); // que bâbord ; cible à l'est → tribord
    expect(resolveBattery(h, target(9, 5), 'N', [{ crew: artilleur(), roleId: 'artilleur' }], 80, NAVIGATION, seq([30]))).toBeNull();
  });

  it('positions non résolues → null (défensif)', () => {
    const h = hull([poste('tribord', 't1')]);
    h.pos = undefined as never;
    expect(resolveBattery(h, target(9, 5), 'N', [], 80, NAVIGATION, seq([30]))).toBeNull();
  });
});

// ── Flux JOUABLE (store) : Test d'équipage MULTI des Artilleurs → volée sur la coque (jumeau de la manœuvre). ──
const gunnerPJ = (): Combatant =>
  ({ id: 'gunner', label: 'Artilleur', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], fortune: 2, resilience: 1,
    skills: [{ id: 'projectiles', spec: 'poudre-noire', characteristic: 'capacite-de-tir', advances: 30 }], talents: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos: { x: 5, y: 5 } }) as unknown as Combatant;
const battPoste = (): ShipPoste =>
  ({ side: 'tribord', item: { uid: 'canon', label: 'Canon moyen', kind: 'ranged', subType: 'armes-de-siege', damage: { flat: 14, plusBF: false }, range: 75, qualities: [{ id: 'recharge', value: 6 }] }, crewIds: ['gunner'] }) as unknown as ShipPoste;
const firingShip = (): Combatant =>
  ({ id: 'ship', label: 'Frégate', kind: 'npc', bodyShape: 'vehicule', creatureId: 'bateau-de-patrouille', crewIds: ['gunner'], postes: [battPoste()], pos: { x: 5, y: 5 }, wounds: { current: 60, max: 60 }, conditions: [], weapons: [] }) as unknown as Combatant;
const enemyHull = (pos = { x: 9, y: 5 }): Combatant =>
  ({ id: 'target', label: 'Caraque', kind: 'enemy', bodyShape: 'vehicule', creatureId: 'knarr', pos,
    characteristics: { 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: 40, initiative: 0, agilite: 0, dexterite: 0, intelligence: 0, 'force-mentale': 0, sociabilite: 0 },
    wounds: { current: 90, max: 90, base: 90 }, advantage: 0, conditions: [], weapons: [], armour: { corps: 0 }, skills: [], talents: [], crewIds: [] }) as unknown as Combatant;

/**
 * PORTÉE D'UNE BORDÉE — les BANDES du socle (`LDB 62 l.198-206` : Bout portant ÷10, Courte ÷2, Moyenne,
 * Longue ×2, Extrême ×3 ; au-delà = hors de portée). Le clic ne doit refuser QU'au-delà d'Extrême — en
 * deçà le tir part avec le modificateur de sa bande. Échelle par défaut : 2 m/case.
 */
describe('bordée — la portée se juge aux BANDES, jamais à la Portée moyenne (LDB 62 l.198-206)', () => {
  const canon = 75; // Portée moyenne de la pièce du bord (m) → Longue = 150 m, Extrême = 225 m
  const monter = (cible: Combatant) => {
    seedBattleRng(7);
    banc.setState({ battle: { combatants: [firingShip(), gunnerPJ(), cible], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never, party: [gunnerPJ()], facing: { ship: 'N' }, pendingShipBattery: null, refus: null, scene: null as never });
  };

  it('120 m (bande LONGUE) : le tir PART — la bande porte son malus, elle ne refuse pas', () => {
    monter(enemyHull({ x: 5 + 60, y: 5 })); // 60 cases × 2 m = 120 m
    expect(rangeBandName(60, canon), 'témoin : 120 m avec Portée 75 est bien la bande Longue').toBe('Longue');
    banc.getState().battleShipBattery('ship', 'target');
    expect(banc.getState().pendingShipBattery, 'un tir à portée Longue doit ouvrir son Test d’équipage').not.toBeNull();
    expect(banc.getState().refus).toBeNull();
  });

  it('230 m (au-delà d’Extrême = 225 m) : refus DIT, aucun Test ouvert', () => {
    monter(enemyHull({ x: 5 + 115, y: 5 })); // 115 cases × 2 m = 230 m
    expect(rangeBandName(115, canon), 'témoin : 230 m est hors de toute bande').toBeNull();
    banc.getState().battleShipBattery('ship', 'target');
    expect(banc.getState().pendingShipBattery, 'aucune volée hors de portée').toBeNull();
    expect(banc.getState().refus?.texte, 'et le refus se dit au point du geste').toBeTruthy();
  });
});

describe('flux shipBattery (store) — bordée jouable bout-en-bout (MDG 14 l.128)', () => {
  it('battleShipBattery ouvre le Test des Artilleurs (bord auto) ; roll ; Feu ! → la coque encaisse', () => {
    seedBattleRng(7);
    banc.setState({ battle: { combatants: [firingShip(), gunnerPJ(), enemyHull()], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never, party: [gunnerPJ()], facing: { ship: 'N' }, pendingShipBattery: null, scene: null as never });
    banc.getState().battleShipBattery('ship', 'target');
    const p = banc.getState().pendingShipBattery!;
    expect(p.side).toBe('tribord'); // cible plein est, cap N → bordée tribord
    expect(p.participants.some((x) => x.id === 'gunner' && x.essential)).toBe(true); // l'Artilleur est ESSENTIEL (★)
    const before = banc.getState().battle!.combatants.find((c) => c.id === 'target')!.wounds.current;
    banc.getState().shipBatteryRoll('gunner'); // le PJ Artilleur lance SON jet
    expect(banc.getState().pendingShipBattery!.participants.every((x) => x.result)).toBe(true);
    banc.getState().shipBatteryConfirm();
    expect(banc.getState().pendingShipBattery).toBeNull();
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'target')!.wounds.current).toBeLessThan(before); // la coque encaisse
  });

  it('aucune pièce ne porte sur le bord visé (cible en proue, pièces à tribord) → n’ouvre rien', () => {
    seedBattleRng(7);
    banc.setState({ battle: { combatants: [firingShip(), gunnerPJ(), enemyHull({ x: 5, y: 1 })], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never, party: [gunnerPJ()], facing: { ship: 'N' }, pendingShipBattery: null, scene: null as never });
    banc.getState().battleShipBattery('ship', 'target');
    expect(banc.getState().pendingShipBattery).toBeNull();
  });

  it('Recharge : une pièce qui a tiré est DÉCHARGÉE (pas de 2e bordée avant rechargement, MDG 12 / LDB 62)', () => {
    seedBattleRng(7);
    banc.setState({ battle: { combatants: [firingShip(), gunnerPJ(), enemyHull()], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never, party: [gunnerPJ()], facing: { ship: 'N' }, pendingShipBattery: null, scene: null as never });
    banc.getState().battleShipBattery('ship', 'target');
    banc.getState().shipBatteryRoll('gunner');
    banc.getState().shipBatteryConfirm();
    const poste = banc.getState().battle!.combatants.find((c) => c.id === 'ship')!.postes![0];
    expect(poste.loaded).toBe(false); // a tiré → déchargée, reste muette jusqu'à la fin du Test étendu de recharge
    expect(poste.reloadProgress).toBe(0); // recharge à zéro (RAW : pas d'auto-rechargement passif)
    banc.getState().battleShipBattery('ship', 'target'); // 2e bordée même Round → pièce déchargée → aucune ne porte
    expect(banc.getState().pendingShipBattery).toBeNull();
  });

  it('équipage-ressource : après une bordée, les contributeurs sont marqués « engagés ce Round » (crewActed)', () => {
    seedBattleRng(7);
    banc.setState({ battle: { combatants: [firingShip(), gunnerPJ(), enemyHull()], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never, party: [gunnerPJ()], facing: { ship: 'N' }, pendingShipBattery: null, scene: null as never });
    banc.getState().battleShipBattery('ship', 'target');
    banc.getState().shipBatteryRoll('gunner');
    banc.getState().shipBatteryConfirm();
    expect(banc.getState().battle!.crewActed?.['ship']).toContain('gunner'); // l'Artilleur a agi ce Round
    // Parallélisme (MDG 14 l.37) : la bordée est une tâche d'équipage, elle NE consomme PAS le tour du navire
    // (≠ `acted`) → manœuvre + bordée(s) + recharge coexistent le même Round, bornées par l'équipage (crewActed).
    expect(banc.getState().battle!.acted).toBe(false);
  });

});

// ── Munitions à AIRE en bordée (Explosion / Tir de zone) + EXTENSIBILITÉ onHit (point 4) ──────────────────
/** Scène minimale valide (LoS de `fireTriggers`). */
const navScene = () =>
  ({ id: 's', name: 's', dimensions: { w: 20, h: 20 }, ambiance: 'jour', metresPerTile: 10,
    layers: [{ z: 0, tiles: new Array(400).fill('eau') }], entities: [], dialogues: [], triggers: [], encounters: [] });
/** Marin exposé de la coque cible (pour être balayé par l'aire). */
const sailor = (id: string): Combatant =>
  ({ id, name: id, kind: 'enemy', pos: { x: 9, y: 5 }, wounds: { current: 6, max: 6 }, advantage: 0,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 0, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, conditions: [], traits: [], talents: [], skills: [], weapons: [] }) as unknown as Combatant;
/** Coque cible AVEC équipage exposé. */
const crewedHull = (crewIds: string[]): Combatant => ({ ...enemyHull(), crewIds } as Combatant);
/** Pièce avec qualités/enchant custom (Atout d'aire + effet onHit générique). */
const aireePoste = (qualities: { id: string; value?: number }[], onHit?: unknown): ShipPoste =>
  ({ side: 'tribord', crewIds: ['gunner'], item: { uid: 'canon', label: 'Canon', kind: 'ranged', subType: 'armes-de-siege', damage: { flat: 14, plusBF: false }, range: 75,
    qualities: [{ id: 'recharge', value: 6 }, ...qualities], ...(onHit ? { enchants: [{ onHitEffects: onHit }] } : {}) } } as unknown as ShipPoste);
const shipWith = (poste: ShipPoste): Combatant => ({ ...firingShip(), postes: [poste], wounds: { current: 60, max: 60 } } as Combatant);

const setupNaval = (poste: ShipPoste, hull: Combatant, extra: Combatant[] = []) => {
  seedBattleRng(7);
  const ship = shipWith(poste);
  banc.setState({ battle: { combatants: [ship, gunnerPJ(), hull, ...extra], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never,
    party: [gunnerPJ()], facing: { ship: 'N' }, pendingShipBattery: null, scene: navScene() as never });
  banc.getState().battleShipBattery('ship', 'target');
  banc.getState().shipBatteryRoll('gunner');
  banc.getState().shipBatteryConfirm();
};

describe('bordée à munition à AIRE — balaie l’équipage exposé du navire cible (MDG 13 × ch.12)', () => {
  it('Tir de zone → la coque encaisse ET jusqu’à Indice marins exposés sont touchés', () => {
    const crew = [sailor('m1'), sailor('m2'), sailor('m3')];
    setupNaval(aireePoste([{ id: 'tir-de-zone', value: 2 }]), crewedHull(['m1', 'm2', 'm3']), crew);
    const after = banc.getState().battle!.combatants;
    expect(after.find((c) => c.id === 'target')!.wounds.current).toBeLessThan(90); // coque touchée
    const touched = ['m1', 'm2', 'm3'].filter((id) => after.find((c) => c.id === id)!.wounds.current < 6).length;
    expect(touched).toBe(2); // EXACTEMENT Indice (2) marins (≠ rayon métrique, dégénéré à 10 m/case)
  });

  it('Explosion → TOUT l’équipage exposé est pris dans le souffle', () => {
    const crew = [sailor('m1'), sailor('m2'), sailor('m3')];
    setupNaval(aireePoste([{ id: 'a-explosion', value: 4 }]), crewedHull(['m1', 'm2', 'm3']), crew);
    const after = banc.getState().battle!.combatants;
    expect(['m1', 'm2', 'm3'].every((id) => after.find((c) => c.id === id)!.wounds.current < 6)).toBe(true);
  });

  it('munition SIMPLE (sans atout d’aire) → SEULE la coque encaisse, l’équipage est épargné (non-régression)', () => {
    const crew = [sailor('m1'), sailor('m2')];
    setupNaval(aireePoste([]), crewedHull(['m1', 'm2']), crew);
    const after = banc.getState().battle!.combatants;
    expect(after.find((c) => c.id === 'target')!.wounds.current).toBeLessThan(90);
    expect(['m1', 'm2'].every((id) => after.find((c) => c.id === id)!.wounds.current === 6)).toBe(true);
  });

  it('EXTENSIBILITÉ : un canon CUSTOM (atout onHit posant un État + Tir de zone) → touche multiple ET applique l’État, SANS code spécifique', () => {
    const crew = [sailor('m1'), sailor('m2')];
    // Atout onHit générique : pose « en-flammes » sur la victime (chemin fireTriggers, pas de pose bespoke).
    const onHit = [{ trigger: 'onHit', on: 'victim', flow: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: 'en-flammes-navire', value: 1 }] } } }];
    setupNaval(aireePoste([{ id: 'tir-de-zone', value: 2 }], onHit), crewedHull(['m1', 'm2']), crew);
    const after = banc.getState().battle!.combatants;
    const hull = after.find((c) => c.id === 'target')!;
    expect((hull.conditions ?? []).some((c) => c.id === 'en-flammes-navire')).toBe(true); // État appliqué à la coque par l'onHit générique en bordée
    expect(['m1', 'm2'].filter((id) => after.find((c) => c.id === id)!.wounds.current < 6).length).toBe(2); // ET aire : 2 marins
  });
});

describe('rollCrewRole — cumul de rôles (Manque de bras, MDG 14 l.53)', () => {
  const cap = (): Combatant =>
    ({ id: 'cap', label: 'Cap', characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      kind: 'hero', wounds: { current: 10, max: 10 }, skills: [{ id: 'commandement', characteristic: 'sociabilite', advances: 30 }], conditions: [], talents: [] }) as unknown as Combatant;

  it('cumul → +2 crans de Difficulté : cible PLUS DURE (−20) qu\'un jet normal, même dé', () => {
    const normal = jete(rollCrewRole(cap(), 'capitaine', NAVIGATION, makeRNG(5))!.result);
    const cumul = jete(rollCrewRole(cap(), 'capitaine', NAVIGATION, makeRNG(5), true)!.result);
    expect(cumul.target).toBe(normal.target - 20); // Intermédiaire (+0) → +2 crans = Difficile (−20)
  });
});

// ── Chaque coup de bordée par la couture du coup, selon sa CIBLE (MDG 14 l.128 « un ennemi », EDOC 07 l.332) ──
describe('bordée — chaque coup passe par la couture du coup, quelle que soit la cible', () => {
  const fixe = deFixe;
  /** Créature ciblée : corps localisé, PA 2 partout. */
  const pirate = (traits: unknown[] = []): Combatant =>
    ({ ...sailor('target'), label: 'Pirate', wounds: { current: 30, max: 30 }, armour: { tete: 2, brasG: 2, brasD: 2, corps: 2, jambeG: 2, jambeD: 2 },
      characteristics: { ...sailor('x').characteristics, endurance: 30 }, traits }) as unknown as Combatant;
  /** Coque SANS profil naval (EDOC 07 l.332-334). */
  const chariot = (): Combatant => ({ ...enemyHull(), label: 'Chariot', creatureId: undefined } as unknown as Combatant);
  const deuxPieces = (): ShipPoste[] => [battPoste(), { ...battPoste(), item: { ...battPoste().item, uid: 'canon2' } } as ShipPoste];
  const monter = (cible: Combatant, postes = [battPoste()]) => {
    seedBattleRng(7);
    const ship = { ...firingShip(), postes } as Combatant;
    banc.setState({ battle: { combatants: [ship, gunnerPJ(), cible], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never,
      party: [gunnerPJ()], facing: { ship: 'N' }, pendingShipBattery: null, pendingCascade: null, suspendedCascades: [], scene: navScene() as never });
    return ship;
  };
  /** Les tirs tels que la bordée les pose (`resolveVolley`), au jet fixé. */
  const tirs = (ship: Combatant, roll: number) =>
    resolveVolley(ship, ship.postes!, 3, true, [gunnerPJ()], fixe(roll)).map((s) => ({ tireurId: s.tireur.id, weapon: s.weapon, jet: s.jet }));
  const journal = () => JSON.stringify(banc.getState().battle!.log);
  const cible = () => banc.getState().battle!.combatants.find((c) => c.id === 'target')!;

  it('créature : la bordée jouée bout-en-bout la blesse, sans aucun État naval', () => {
    monter(pirate());
    banc.getState().battleShipBattery('ship', 'target');
    banc.getState().shipBatteryRoll('gunner');
    banc.getState().shipBatteryConfirm();
    expect(cible().wounds.current).toBeLessThan(30);
    expect(cible().conditions.filter((c) => /navire|voie-d-eau/.test(c.id))).toEqual([]);
    expect(banc.getState().battle!.acted, 'la bordée ne consomme pas l’Action du navire (MDG 14 l.37)').toBe(false);
  });

  it('chariot : un double inflige des Blessures, et son Critique se dit « pas un navire » (EDOC 07 l.334)', () => {
    const ship = monter(chariot());
    expect(jouerLesTirsDeBordee(banc.getState, banc.setState, { targetId: 'target', actedAvant: false, tirs: tirs(ship, 33) })).toBe(false);
    expect(cible().wounds.current).toBeLessThan(90);
    expect(journal()).toContain('pas un navire');
  });

  it('suspension : un coup qui ouvre une sauvegarde suspend, le coup suivant attend sa fermeture', () => {
    const p = pirate([{ id: 'demoniaque', value: 9 }]);
    const ship = monter(p, deuxPieces());
    const coups = tirs(ship, 34);
    expect(coups).toHaveLength(2);
    expect(jouerLesTirsDeBordee(banc.getState, banc.setState, { targetId: 'target', actedAvant: false, tirs: coups })).toBe(true);
    expect(banc.getState().pendingCascade, 'la sauvegarde du 1er coup est ouverte').not.toBeNull();
    expect(cible().wounds.current, 'aucune Blessure avant la sauvegarde').toBe(30);
    const un = toucheAuJetPose(gunnerPJ(), pirate([{ id: 'demoniaque', value: 9 }]), coups[0].weapon, coups[0].jet, coups[0].jet.sl, { rng: makeRNG(1) }).woundsLost!;
    draineCascade(banc.getState, 4, poseSurDeNonTombe(1)); // la fenêtre se ferme : dé raté (1 < 9) s'il reste à jeter
    expect(cible().wounds.current, 'les DEUX coups appliqués, le 2e après la reprise').toBe(30 - 2 * un);
    expect(banc.getState().pendingCascade).toBeNull();
    expect(banc.getState().battle!.acted, 'l’Action du navire rendue après la reprise').toBe(false);
  });

  it('aire sur un chariot : le rayon de l’Explosion balaie qui se tient à côté (EDOC 07 l.332)', () => {
    const voisin = { ...sailor('m1'), pos: { x: 9, y: 6 } } as Combatant;
    seedBattleRng(7);
    const ship = { ...firingShip(), postes: [aireePoste([{ id: 'a-explosion', value: 4 }])] } as Combatant;
    banc.setState({ battle: { combatants: [ship, gunnerPJ(), chariot(), voisin], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never,
      party: [gunnerPJ()], facing: { ship: 'N' }, pendingShipBattery: null, scene: { ...navScene(), metresPerTile: 2 } as never });
    banc.getState().battleShipBattery('ship', 'target');
    banc.getState().shipBatteryRoll('gunner');
    banc.getState().shipBatteryConfirm();
    expect(cible().wounds.current).toBeLessThan(90);
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'm1')!.wounds.current).toBeLessThan(6);
  });
});

// ── Sonde du juge promue (#1906) : un VRAI véhicule routier (`chariot-lourd`, schéma `vehicles`), en cible puis en tireur ──
describe('bordée et véhicule routier réel (chariot-lourd) — EDOC 07 l.332-334, MDG 14 l.128', () => {
  const lourd = (over: Partial<Combatant>): Combatant =>
    ({ ...enemyHull(), creatureId: 'chariot-lourd', label: 'Chariot lourd', ...over } as Combatant);

  it('en CIBLE : la bordée part et se résout sans lever ; aucun État naval sur une coque routière', () => {
    seedBattleRng(7);
    banc.setState({ battle: { combatants: [firingShip(), gunnerPJ(), lourd({})], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never,
      party: [gunnerPJ()], facing: { ship: 'N' }, pendingShipBattery: null, pendingCascade: null, refus: null, scene: navScene() as never });
    banc.getState().battleShipBattery('ship', 'target');
    expect(banc.getState().pendingShipBattery, `refus : ${banc.getState().refus?.texte}`).not.toBeNull();
    banc.getState().shipBatteryRoll('gunner');
    expect(() => banc.getState().shipBatteryConfirm()).not.toThrow();
    const c = banc.getState().battle!.combatants.find((x) => x.id === 'target')!;
    expect(c.wounds.current).toBeLessThan(90);
    expect(c.conditions.filter((x) => /navire|voie-d-eau/.test(x.id))).toEqual([]);
  });

  it('en TIREUR : un chariot ne lâche pas de bordée — refus dit, aucun Test ouvert', () => {
    seedBattleRng(7);
    const tireur = lourd({ id: 'ship', kind: 'npc', crewIds: ['gunner'], postes: [battPoste()], pos: { x: 5, y: 5 } });
    banc.setState({ battle: { combatants: [tireur, gunnerPJ(), enemyHull()], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never,
      party: [gunnerPJ()], facing: { ship: 'N' }, pendingShipBattery: null, refus: null, scene: navScene() as never });
    expect(() => banc.getState().battleShipBattery('ship', 'target')).not.toThrow();
    expect(banc.getState().pendingShipBattery).toBeNull();
    expect(banc.getState().refus?.texte).toBe(t('cs.bordeeSansNavire', { ship: 'Chariot lourd' }));
  });
});
