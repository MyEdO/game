/**
 * SONDES DE FLUX RÉEL (#1015) — la possession des verbes d'influence est mesurée sur le pending que
 * le MOTEUR produit, jamais sur une fixture posée d'après la table (celle-ci ne prouverait que le
 * routage, cf. `cast-intent-ownership.test.ts`). Échantillon des quadrants nommés par le balayage :
 *  1. `corruption` sous une modale PRIORITAIRE d'un autre siège (le défaut d'origine : `corruption`
 *     est la DERNIÈRE entrée de `MODAL_DEFS`, donc toute autre fenêtre lui volait la possession) ;
 *  2. `heal` par un SOIGNEUR PNJ hors `actorIn` — refus assumé (cf. la sonde dédiée) ;
 *  3. `run` en cadence NON manuelle (Rapide puis Auto) : le porteur dépense encore ;
 *  4. `disengage`, Test OPPOSÉ : le porteur est le MOVER, pas le foe (le mauvais champ donnerait la
 *     Chance du fuyard à son adversaire) ;
 *  5. `activity` (hors combat) : la route par porteur et la route `interlude*` d'`intentAllowedFor`
 *     désignent le MÊME siège ;
 *  6. SOLO bit-à-bit, en combat ET hors combat : le joueur unique garde TOUTES ses dépenses.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, beforeEach, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { initialNet, type BattleState } from './etat';
import { draineCascade } from './cascade.testkit';
import { openAttackCascade } from './combatFlow';
import { gainCorruption } from './corruptionFlow';
import { ouvrirLeMedecin } from './medicFlow';
import { intentAllowedFor, withActingSeat } from './netOwnership';
import { NOM_DU_VERBE_DE_JET, type RollVerb } from './flowVerbs';
import { modalOwnerOf } from './modalArbiter';
import { seedBattleRng } from './battleRng';
import { setCadence, cadenceAuto } from '../engine/cadence';
import { testScene } from '../scenes/test-fixture';
import { createHero } from '../engine/character';
import type { Combatant, Weapon } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { pratiquer } from './interlude.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const NET0 = initialNet();

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const sword: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', qualities: [] } as unknown as Weapon;
const mk = (id: string, kind: 'heros' | 'ennemi', pos: { x: number; y: number }, over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons: [sword], advantage: 0, size: 'moyenne', pos, wounds: blessuresDeBase(18), corruption: 0,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, ...over }) as unknown as Combatant);

const arena = (combatants: Combatant[]): BattleState =>
  ({ combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
     turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
     movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null } as unknown as BattleState);

/** Sièges : 0 = hôte (héros `a`), 1 = joueur (héros `b`), 2 = MJ (ennemi `e`). */
const NET_COOP = { ...NET0, mode: 'hote' as const, mySeat: 0, gmSeat: 2, ownership: { b: 1 }, slots: [0, 1, 0, 0], seatNames: { 0: 'Hôte', 1: 'Joueur', 2: 'MJ' } };
const NET_SOLO = { ...NET0, mode: 'local' as const, mySeat: 0, gmSeat: 0, ownership: {}, slots: [0, 0, 0, 0] };

const g = () => banc.getState();
/** Les gestes de jet `list` sur le flux `flux`, par leur identité `verbe@flux` (`cleDuGeste`). */
const verbs = (flux: string, list: RollVerb[]) => list.map((v) => `${NOM_DU_VERBE_DE_JET[v]}@${flux}`);
/** Le verbe et les arguments du geste `verbe@flux` (`VerbesDeJet`). */
const geste = (cle: string): [string, unknown[]] => {
  const [verbe, flux] = cle.split('@');
  return [verbe, verbe === 'jetImposerLeResultat' ? [flux, 42] : [flux]];
};
/** Verdict des 3 sièges pour un geste : [hôte, joueur, MJ]. */
const seats = (cle: string) => [0, 1, 2].map((seat) => intentAllowedFor(g(), seat, ...geste(cle)));

const INFLUENCE: RollVerb[] = ['lancer', 'relancer', 'ajouterUnDR', 'pactiser', 'forcerLaReussite', 'imposerLeResultat'];
const CORRUPTION_VERBS = verbs('corruption', [...INFLUENCE, 'resister']);
const HEAL_VERBS = verbs('soins', INFLUENCE);
const RUN_VERBS = verbs('course', ['lancer', 'relancer', 'ajouterUnDR', 'forcerLaReussite', 'imposerLeResultat', 'pactiser']);
const DISENGAGE_VERBS = verbs('desengagement', ['relancer', 'ajouterUnDR', 'pactiser', 'forcerLaReussite', 'imposerLeResultat']);
const ACTIVITY_VERBS = verbs('activite', INFLUENCE);

describe('#1015 — sonde 1 : `corruption` sous une fenêtre PRIORITAIRE d’un autre siège', () => {
  it('le siège du CORROMPU dépense, celui de la fenêtre active non', () => {
    seedBattleRng(7);
    const a = mk('a', 'heros', { x: 0, y: 0 }, { characteristics: { ...chars, 'force-mentale': 10, endurance: 10 } });
    const b = mk('b', 'heros', { x: 2, y: 0 });
    const e = mk('e', 'ennemi', { x: 3, y: 0 });
    banc.setState({ battle: arena([a, b, e]), mode: 'battle', scene: testScene(), net: NET_COOP, party: [] });
    // Flux RÉEL : le seuil de Corruption est franchi → `gainCorruption` POSE `pendingCorruption`.
    gainCorruption(g, banc.setState, a, 12);
    expect(g().pendingCorruption?.heroId, 'précondition : le Test de seuil du héros `a` est ouvert').toBe('a');
    // …puis une fenêtre d'ATTAQUE du héros `b` (siège 1) s'ouvre PAR-DESSUS : `corruption` est la
    // dernière entrée de `MODAL_DEFS`, la cascade lui prend le owner de modale.
    banc.setState({ battle: { ...g().battle!, turn: 1 } });
    openAttackCascade(g, banc.setState, { attackerId: 'b', targetId: 'e', location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attaquer');
    expect(modalOwnerOf(g()), 'précondition : la fenêtre ACTIVE est celle d’un AUTRE acteur').toBe('b');
    for (const i of CORRUPTION_VERBS) {
      expect(seats(i), `${i} : la Corruption du corrompu ne se dépense que depuis SON siège`).toEqual([true, false, false]);
    }
  });
});

describe('#1015 — sonde 2 : `heal` par un SOIGNEUR PNJ (hors `actorIn`)', () => {
  it('AUCUN siège n’influence le jet d’un soigneur PNJ ; son lancer suit le repli universel', () => {
    // Un PNJ n'a ni Chance ni Résilience à dépenser : personne n'influence son jet, et l'AFFICHAGE
    // comme l'INTENT répondent pareil (même prédicat `seatInfluences`). Le pending porte l'id du PNJ
    // (`soinDeLActe` : `healerId: soigneur.id ?? 'pnj-soigneur'`), absent du groupe ET du combat — le Test
    // roule sur une valeur BAKÉE (`p.skillValue`, drapeau `actorless`, rollFlowSpecs.ts:349-350 :
    // « L'INFLUENCE (Chance/Résilience) reste gérée à part par la fabrique via `spec.actor` (no-op si
    // l'acteur est un PNJ). »).
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Blessé', seed: 1 });
    hero.id = 'b';
    hero.wounds = { ...hero.wounds, current: hero.wounds.max - 5 };
    banc.setState({ battle: null, mode: 'exploration', scene: testScene(), party: [hero], net: NET_COOP });
    ouvrirLeMedecin(g, banc.setState, 'b', { id: 'medecin-de-scene', label: 'Barbier-chirurgien', skill: { id: 'guerison', value: 45 }, intBonus: 3, acts: [{ act: 'blessures' }] });
    expect(g().pendingHeal?.healerId, 'précondition : le brouillon du soin, au PNJ de scène').toBe('medecin-de-scene');
    for (const i of HEAL_VERBS.filter((v) => v !== 'jetLancer@soins')) expect(seats(i), `${i} : un PNJ n’a ni Chance ni Résilience à dépenser`).toEqual([false, false, false]);
    // Le lancer ne dépense rien : sans siège au porteur, il suit le repli universel — l'infirmerie, à tous tant
    // qu'aucun jet n'est lancé (`decideurDuSoin`).
    expect(seats('jetLancer@soins')).toEqual([true, true, true]);
  });
});

describe('#1015 — sonde 3 : `run` en cadence NON manuelle', () => {
  it('Rapide puis Auto : le porteur du jet garde ses dépenses (la cadence ne redistribue rien)', () => {
    setCadence('rapide');
    expect(cadenceAuto(), 'précondition : cadence non manuelle').toBe(true);
    const a = mk('a', 'heros', { x: 0, y: 0 });
    const e = mk('e', 'ennemi', { x: 6, y: 0 });
    banc.setState({ battle: arena([a, e]), mode: 'battle', scene: testScene(), net: NET_COOP, party: [] });
    g().ouvrirLaCourse({ x: 3, y: 0 });
    expect(g().pendingRun?.combatantId, 'précondition : la Course du héros `a` est ouverte').toBe('a');
    for (const i of RUN_VERBS) expect(seats(i), `${i} (Rapide)`).toEqual([true, false, false]);
    setCadence('auto');
    for (const i of RUN_VERBS) expect(seats(i), `${i} (Auto)`).toEqual([true, false, false]);
  });
});

describe('#1015 — sonde 4 : `disengage`, Test OPPOSÉ — le porteur est le MOVER', () => {
  it('le siège du fuyard dépense ; le siège de son ADVERSAIRE (MJ) est refusé', () => {
    seedBattleRng(3);
    // Le mover est le héros de l'HÔTE (`rompreLEngagement` exige le contrôle LOCAL de l'actif) ; son foe
    // est l'ennemi conduit par le siège MJ — deux sièges DIFFÉRENTS, ce qui rend la sonde discriminante.
    const a = mk('a', 'heros', { x: 0, y: 0 }, { engagedWith: ['e'] });
    const e = mk('e', 'ennemi', { x: 1, y: 0 }, { engagedWith: ['a'], advantage: 0 });
    banc.setState({ battle: arena([a, e]), mode: 'battle', scene: testScene(), net: NET_COOP, party: [] });
    g().rompreLEngagement();
    const pd = g().pendingDisengage!;
    expect([pd.moverId, pd.foeId], 'précondition : mover et foe sont deux sièges DIFFÉRENTS').toEqual(['a', 'e']);
    for (const i of DISENGAGE_VERBS) {
      // Le champ `foeId` donnerait [false,false,true] : l'Esquive du fuyard influencée par son adversaire.
      expect(seats(i), `${i} : la Chance de l’Esquive appartient au fuyard`).toEqual([true, false, false]);
    }
  });
});

describe('#1015 — sonde 5 : `activity` (hors combat) — accord avec la route `interlude*`', () => {
  it('le propriétaire du héros joue son Activité, et les deux routes d’`intentAllowedFor` concordent', () => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'charlatan', label: 'H', seed: 1 });
    hero.id = 'b';
    banc.setState({ party: [hero], battle: null, interlude: null, bank: [], pendingOrders: [], pendingActivity: null, net: NET_COOP });
    g().lancerLaScene(testScene());
    banc.setState({ net: NET_COOP });
    g().ouvrirLInterlude(3);
    draineCascade(banc.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    withActingSeat(1, () => pratiquer(g, 'b', 'observer-une-cible'));
    expect(g().pendingActivity?.heroId, 'précondition : l’Activité du héros `b` est ouverte').toBe('b');
    // Route du choix de l'interlude (le héros de la rangée) et route par PORTEUR nomment le même siège.
    expect([0, 1, 2].map((s) => intentAllowedFor(g(), s, 'fenetreChoisir', ['interlude', 'pratiquer', true, 'b']))).toEqual([false, true, false]);
    for (const i of ACTIVITY_VERBS) expect(seats(i), i).toEqual([false, true, false]);
  });
});

describe('#1015 — sonde 6 : SOLO bit-à-bit', () => {
  it('en COMBAT (Course) : le siège unique garde TOUS les verbes', () => {
    const a = mk('a', 'heros', { x: 0, y: 0 });
    const e = mk('e', 'ennemi', { x: 6, y: 0 });
    banc.setState({ battle: arena([a, e]), mode: 'battle', scene: testScene(), net: NET_SOLO, party: [] });
    g().ouvrirLaCourse({ x: 3, y: 0 });
    expect(g().pendingRun?.combatantId).toBe('a');
    for (const i of RUN_VERBS) expect(intentAllowedFor(g(), 0, ...geste(i)), i).toBe(true);
  });

  it('HORS COMBAT (Activité d’interlude) : idem', () => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'charlatan', label: 'H', seed: 2 });
    hero.id = 'a';
    banc.setState({ party: [hero], battle: null, interlude: null, bank: [], pendingOrders: [], pendingActivity: null, net: NET_SOLO });
    g().lancerLaScene(testScene());
    banc.setState({ net: NET_SOLO });
    g().ouvrirLInterlude(3);
    draineCascade(banc.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    pratiquer(g, 'a', 'observer-une-cible');
    expect(g().pendingActivity?.heroId).toBe('a');
    for (const i of ACTIVITY_VERBS) expect(intentAllowedFor(g(), 0, ...geste(i)), i).toBe(true);
  });
});
