/**
 * L'INVENTAIRE DES FLUX À DÉ FIXÉ (#3058) : pour CHAQUE flux qui porte `imposerLeResultat`, un pending fixture réel, l'id
 * de slot visé (multi) et la lecture du jet obtenu sur l'état que rend le propriétaire, lus par la règle du socle
 * (`fixed-die-inventaire.hors-store.test.ts`). Un flux dont la fixture manque échoue la garde.
 */
import { FLOW_VERBS } from './flowVerbs';
import type { FlowKey } from './flowVerbs';
import type { Combatant } from '../engine/types';
import type { ShipManeuverParticipant } from './pendings';
import { propulsionDuNavire } from '../engine/shipBuild';
import { cascadeDeTest } from './cascade.testkit';
import { testDeRegle } from '../engine/reglesChiffrees';
import { cleDeFixture } from './noyau.testkit';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

export const HERO: Combatant = blessuresSurLeProfil({
  id: 'H', name: 'H', label: 'Héros', kind: 'heros',
  characteristics: { force: 40, dexterite: 40, agilite: 40, endurance: 40, 'force-mentale': 40, 'capacite-de-combat': 45, 'capacite-de-tir': 45, initiative: 40, intelligence: 40, sociabilite: 40 },
  wounds: blessuresDeBase(10), advantage: 0, conditions: [], traumas: [],
  resilience: 3, fortune: 2, weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }], items: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
}) as unknown as Combatant;
export const FOE = { ...HERO, id: 'E', label: 'Ennemi', kind: 'ennemi', pos: { x: 1, y: 0 } } as unknown as Combatant;

const T = 45; // cible de toutes les fixtures
export const PERDANT = 99; // > cible ET dans la bande d'échec auto (LDB 12 l.28)
const rate = { roll: 88, target: T, sl: -4, success: false }; // jet RATÉ générique (4 champs)
const rateTR = { ...rate, isDouble: true };
const atkDetail = { label: 'Corps à corps', base: T, modifier: 0, target: T, roll: 88, success: false, sl: -4 };
/** Incantation ENNEMIE figée (l'« attaquant » des Tests opposés Contre-sort / Opposition). */
const ENEMY_CAST = { cast: true, roll: 20, target: 50, sl: 3, isCritical: false, isFumble: false, log: '' };
const atkResult = {
  hit: false, attackerRoll: 88, netSL: -4, critical: false, advantageTo: null,
  defenderDefeated: false, log: 'raté', attackerDetail: atkDetail,
};

/** Fixture d'un flux : le pending à poser, l'id de slot visé (multi), et la lecture du jet obtenu. */
export interface Fixture {
  state: Record<string, unknown>;
  pid?: string;
  read: (s: object) => { roll: number | undefined; success: boolean | undefined };
}
const P = <T2,>(s: object, k: string): T2 => (s as Record<string, T2>)[k];
/** Participant d'un Test d'équipage (jet à 3 champs) ; Compétence de Navigation par `propulsionDuNavire` (MDG 13 l.18-19). */
const part3 = (id = 'H'): ShipManeuverParticipant => ({ id, roleId: 'mousse', essential: false, interactive: true, cumul: false, navigation: propulsionDuNavire('cogue', undefined, 'maritime')!.competence, result: { roll: 88, target: T, sl: -4 } });
/** Jet à PLAT sur le pending. */
const flatRead = (k: string) => (s: object) => ({ roll: P<{ roll: number }>(s, k).roll, success: P<{ success: boolean }>(s, k).success });
/** Jet rangé sous `result`. */
const resultRead = (k: string) => (s: object) => ({ roll: P<{ result: { roll: number } }>(s, k).result.roll, success: P<{ result: { success: boolean } }>(s, k).result.success });
/** `TestResult` entier rangé sous `roll`. */
const trRead = (k: string) => (s: object) => ({ roll: P<{ roll: { roll: number } }>(s, k).roll.roll, success: P<{ roll: { success: boolean } }>(s, k).roll.success });
/** Participant à 3 champs : la réussite est le d100 propre (≤ cible). */
const partRead = (get: (s: object) => { roll: number }) => (s: object) => { const r = get(s); return { roll: r.roll, success: r.roll <= T }; };
/** Tests OPPOSÉS binaires : `def` = jet de l'acteur, `atk` figé, issue `'reussite'`. */
const opposedFixture = (key: string, extra: Record<string, unknown>): Fixture => ({
  state: { [key]: { ...extra, def: rateTR, atk: { roll: 20, target: 50, success: true, sl: 3, isDouble: false }, result: 'fail' } },
  read: (s) => ({ roll: P<{ def: { roll: number } }>(s, key).def.roll, success: P<{ result: string }>(s, key).result === 'reussite' }),
});

export const FIXTURES: Partial<Record<FlowKey, Fixture>> = {
  attaque: {
    state: { pendingAttack: { attackerId: 'H', targetId: 'E', location: null, result: atkResult } },
    read: (s) => ({ roll: P<{ result: { attackerRoll: number } }>(s, 'pendingAttack').result.attackerRoll, success: P<{ result: { attackerDetail: { success: boolean } } }>(s, 'pendingAttack').result.attackerDetail.success }),
  },
  defense: {
    state: {
      pendingDefense: {
        attackerId: 'E', defenderId: 'H', weapon: { name: 'Gourdin', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] },
        location: null, atk: { roll: 30, target: 40, success: true, sl: 1, isDouble: false }, mode: 'esquive',
        def: rateTR, result: { ...atkResult, defenderDetail: { ...atkDetail, label: 'Esquive' } },
        suite: { mode: 'machine', coup: {} },
      },
    },
    read: (s) => ({ roll: P<{ def: { roll: number } }>(s, 'pendingDefense').def.roll, success: P<{ def: { success: boolean } }>(s, 'pendingDefense').def.success }),
  },
  incantation: {
    state: { pendingCast: { casterId: 'H', targetId: 'H', spellId: 'drain', missile: false, focused: false, result: { cast: false, roll: 88, target: T, sl: -4, isCritical: false, isFumble: false, log: '' } } },
    read: (s) => ({ roll: P<{ result: { roll: number } }>(s, 'pendingCast').result.roll, success: P<{ result: { cast: boolean } }>(s, 'pendingCast').result.cast }),
  },
  // Contre-sort / Opposition : le jet d'incantation ENNEMI est FIGÉ dans `pendingCast` — les deux
  // accesseurs de dé l'y relisent pour re-opposer, la fixture doit donc le poser.
  contreSort: {
    state: {
      pendingCast: { casterId: 'E', targetId: 'H', spellId: 'drain', missile: false, focused: false, result: ENEMY_CAST },
      pendingCounterspell: { participants: [{ id: 'H', interactive: true, declared: 'solo', result: { dispelled: false, counter: rateTR, casterNetSL: 7, log: '' } }] },
    },
    pid: 'H',
    read: (s) => ({
      roll: P<{ participants: { result: { counter: { roll: number } } }[] }>(s, 'pendingCounterspell').participants[0].result.counter.roll,
      success: P<{ participants: { result: { counter: { success: boolean } } }[] }>(s, 'pendingCounterspell').participants[0].result.counter.success,
    }),
  },
  opposition: {
    state: {
      pendingCast: { casterId: 'E', targetId: 'H', spellId: 'drain', missile: false, focused: false, result: ENEMY_CAST },
      pendingCastOpposition: { test: { characteristic: 'force-mentale' }, participants: [{ id: 'H', interactive: true, result: { oppose: rateTR, resisted: false, margin: 7 } }] },
    },
    pid: 'H',
    read: (s) => ({
      roll: P<{ participants: { result: { oppose: { roll: number } } }[] }>(s, 'pendingCastOpposition').participants[0].result.oppose.roll,
      success: P<{ participants: { result: { oppose: { success: boolean } } }[] }>(s, 'pendingCastOpposition').participants[0].result.oppose.success,
    }),
  },
  cascade: {
    state: { pendingCascade: cascadeDeTest([{ id: 's1', kind: cleDeFixture('test'), actorId: 'H', target: T, rollLabel: 'Test', result: { roll: 88, target: T, sl: -4, success: false } }]) },
    pid: 's1',
    read: (s) => ({ roll: P<{ participants: { result: { roll: number } }[] }>(s, 'pendingCascade').participants[0].result.roll, success: P<{ participants: { result: { success: boolean } }[] }>(s, 'pendingCascade').participants[0].result.success }),
  },
  // Rangée de BANDE : elle porte SON verdict (`CascadeRoll.success`) — la garde le LIT. Le dériver du
  // d100 (`roll ≤ cible`, cf. `partRead`) reviendrait à se fournir la valeur qu'on prétend mesurer :
  // la garde resterait verte alors même que l'accesseur de dé n'écrirait aucune issue.
  cascadeEnBande: {
    state: { pendingCascade: cascadeDeTest([{ id: 'b1', kind: cleDeFixture('batch'), aggregate: 'none', participants: [{ id: 'H', interactive: true, base: T, target: T, result: { roll: 88, target: T, sl: -4, success: false } }] }]) },
    pid: 'H',
    read: (s) => {
      const r = P<{ participants: { participants: { result: { roll: number; success: boolean } }[] }[] }>(s, 'pendingCascade').participants[0].participants[0].result;
      return { roll: r.roll, success: r.success };
    },
  },
  // Dé NU d'étape : il tombe, ni réussite ni échec ; la garde lit la valeur posée contre la cible commune.
  cascadeTirage: {
    state: { pendingCascade: cascadeDeTest([{ id: 'd1', kind: cleDeFixture('de'), actorId: 'H', de: { spec: { n: 1, sides: 100 }, result: { roll: 88, total: 88 } } }]) },
    pid: 'd1',
    read: (s) => { const v = P<{ participants: { de: { result: { roll: number } } }[] }>(s, 'pendingCascade').participants[0].de.result.roll; return { roll: v, success: v <= T }; },
  },
  fuite: {
    state: { pendingDisengage: { moverId: 'E', foeId: 'H', fuir: { participants: [{ id: 'H', kind: 'backstab', interactive: true, result: atkResult }] } } },
    pid: 'H',
    read: (s) => {
      const r = P<{ fuir: { participants: { result: { attackerRoll: number; attackerDetail: { success: boolean } } }[] } }>(s, 'pendingDisengage').fuir.participants[0].result;
      return { roll: r.attackerRoll, success: r.attackerDetail.success };
    },
  },
  test: {
    state: { pendingTest: { actorId: 'H', actorName: 'Héros', label: 'T', skillValue: T, difficulty: 'intermediaire', requireSL: 0, ...rate, onSuccess: [], onFailure: [] } },
    read: flatRead('pendingTest'),
  },
  activite: {
    state: { pendingActivity: { heroId: 'H', activityId: 'a', skillValue: T, difficulty: 'intermediaire', ...rate } },
    read: flatRead('pendingActivity'),
  },
  rechargement: {
    state: { pendingReload: { actorId: 'H', actorName: 'H', weaponUid: 'w', reload: 1, progressBefore: 0, skillValue: T, difficulty: 'intermediaire', ...rate } },
    read: flatRead('pendingReload'),
  },
  mainEnsanglantee: { state: { pendingHandGate: { attackerId: 'H', ligne: { base: T, mods: [], target: T, difficulty: 'intermediaire' }, ...rate } }, read: flatRead('pendingHandGate') },
  fuiteDeVapeur: { state: { pendingSteamSave: { actorId: 'H', skillValue: T, difficulty: 'intermediaire', ...rate } }, read: flatRead('pendingSteamSave') },
  evaluation: {
    state: { pendingAppraise: { actorId: 'H', actorName: 'H', itemUid: 'x', itemName: 'x', truePriceBrass: 1, availability: 'rare', ligne: { base: T, mods: [], target: T, difficulty: 'intermediaire' }, ...rate } },
    read: flatRead('pendingAppraise'),
  },
  soins: {
    state: { pendingHeal: { healerId: 'H', targetId: 'H', mode: 'blessures', intBonus: 4, test: 'guerison', bandagesDe: null, skillValue: T, difficulty: 'intermediaire', ...rate } },
    read: flatRead('pendingHeal'),
  },
  chirurgie: {
    state: { pendingSurgery: { healerId: 'H', healerName: 'H', targetId: 'H', targetName: 'H', ligne: { base: T, mods: [], target: T, difficulty: 'intermediaire' }, ...rate } },
    read: flatRead('pendingSurgery'),
  },
  // Exposition à une Influence corruptrice (LDB 19 l.29) : un Test, donc la Résilience (LDB 17 l.68) et son
  // dé choisi.
  corruption: {
    state: { pendingCorruption: { heroId: 'H', kind: 'exposition', level: 'mineure', nature: 'physique', test: testDeRegle('influences-corruptrices', 'physique'), natureFixee: true, menace: 'corruption', ...rate } },
    read: flatRead('pendingCorruption'),
  },
  recuperation: { state: { pendingStateRecovery: { actorId: 'H', state: 'sonne', skillValue: T, difficulty: 'intermediaire', roll: rateTR } }, read: trRead('pendingStateRecovery') },
  marchandage: {
    state: { pendingBargain: { playerId: 'H', merchantId: 'm', playerSkill: T, merchantRoll: { roll: 20, target: 50, success: true, sl: 3, isDouble: false }, roll: rateTR } },
    read: trRead('pendingBargain'),
  },
  frenesie: { state: { pendingFrenzy: { combatantId: 'H', result: rate } }, read: resultRead('pendingFrenzy') },
  approche: { state: { pendingApproach: { combatantId: 'H', test: testDeRegle('calme-d-approche', 'se-rapprocher'), sourceId: 'E', result: rate } }, read: resultRead('pendingApproach') },
  protection: { state: { pendingWard: { attackerId: 'H', targetId: 'E', targetName: 'E', result: rate } }, read: resultRead('pendingWard') },
  dissipation: { state: { pendingDispel: { casterId: 'H', value: T, spellId: 's', result: rate } }, read: resultRead('pendingDispel') },
  chansonDeMarin: { state: { pendingShanty: { singerId: 'H', shantyId: 'x', result: rate } }, read: resultRead('pendingShanty') },
  battement: { state: { pendingBattement: { attackerId: 'H', targetId: 'E', result: rateTR } }, read: resultRead('pendingBattement') },
  focalisation: {
    state: { pendingFocus: { casterId: 'H', spellId: 'drain', result: { dr: 0, isCritical: false, isFumble: false, roll: 88, target: T, sl: -4, log: '' } } },
    read: (s) => ({ roll: P<{ result: { roll: number } }>(s, 'pendingFocus').result.roll, success: P<{ result: { dr: number } }>(s, 'pendingFocus').result.dr > 0 }),
  },
  course: {
    state: { pendingRun: { combatantId: 'H', test: testDeRegle('course', 'courir'), dest: { x: 5, y: 0 }, result: { success: false, roll: 88, target: T, dr: -4, bonusCases: 0 } } },
    read: resultRead('pendingRun'),
  },
  chute: {
    state: { pendingFall: { test: testDeRegle('chute', 'tenter'), to: { x: 0, y: 1 }, metres: 6, initiateurId: 'H', participants: [{ id: 'H', interactive: true, attempt: true, result: { success: false, roll: 88, target: T, dr: -4, effectiveMetres: 6 } }] } },
    pid: 'H',
    read: (s) => { const r = P<{ participants: { result: { roll: number; success: boolean } }[] }>(s, 'pendingFall').participants[0].result; return { roll: r.roll, success: r.success }; },
  },
  testEtendu: {
    state: { pendingExtendedTest: { actorId: 'H', label: 'X', skillLabel: 'Force', target: T, drCible: 6, total: 0, rounds: [{ id: 'r1', interactive: true, result: { roll: 88, sl: -4, success: false } }] } },
    pid: 'r1',
    read: (s) => {
      const r = P<{ rounds: { result: { roll: number; success: boolean } }[] }>(s, 'pendingExtendedTest').rounds[0].result;
      return { roll: r.roll, success: r.success };
    },
  },
  // LOT DE DÉS d'un étal (#1426) : le seul verbe est la POSE. La rangée n'a ni cible ni réussite —
  // ce qu'on vérifie est le SEUL contrat qui existe ici : la valeur SAISIE est la valeur APPLIQUÉE.
  etalLot: {
    state: { pendingEtalLot: { label: 'Halle', cible: 'land', participants: [{ id: 'de-1', label: 'Marchand présent', min: 1, max: 100, value: 88, interactive: true, result: null }] } },
    pid: 'de-1',
    read: (s) => { const v = P<{ participants: { value: number }[] }>(s, 'pendingEtalLot').participants[0].value; return { roll: v, success: v <= T }; },
  },
  enfoncerLaPorte: {
    state: { pendingForceDoor: { doorId: 'd', participants: [{ id: 'H', interactive: true, result: { roll: 88, target: T, sl: -4, damage: 0 } }] } },
    pid: 'H',
    read: partRead((s) => P<{ participants: { result: { roll: number } }[] }>(s, 'pendingForceDoor').participants[0].result),
  },
  manoeuvreDuNavire: {
    state: { pendingShipManeuver: { participants: [part3()] } },
    pid: 'H',
    read: partRead((s) => P<{ participants: { result: { roll: number } }[] }>(s, 'pendingShipManeuver').participants[0].result),
  },
  tirDeBatterie: {
    state: { pendingShipBattery: { participants: [part3()] } },
    pid: 'H',
    read: partRead((s) => P<{ participants: { result: { roll: number } }[] }>(s, 'pendingShipBattery').participants[0].result),
  },
  desengagement: opposedFixture('pendingDisengage', { moverId: 'H', foeId: 'E' }),
  auContact: opposedFixture('pendingAuContact', { moverId: 'H', foeId: 'E' }),
  empoignade: opposedFixture('pendingGrapple', { actorId: 'H', targetId: 'E' }),
  distraire: {
    state: { pendingDistraire: { moverId: 'H', targetId: 'E', atk: rateTR, defRoll: { roll: 20, target: 50, success: true, sl: 3, isDouble: false }, result: 'fail' } },
    read: (s) => ({ roll: P<{ atk: { roll: number } }>(s, 'pendingDistraire').atk.roll, success: P<{ result: string }>(s, 'pendingDistraire').result === 'reussite' }),
  },
  manoeuvre: { state: { pendingManeuver: { attackerId: 'H', targetId: 'E', attaque: 'm', kind: 'souffle', result: rateTR } }, read: resultRead('pendingManeuver') },
};

/** Les flux qui portent `imposerLeResultat`. */
export const FLUX = (Object.keys(FLOW_VERBS) as FlowKey[]).filter(
  (k) => (FLOW_VERBS[k].verbs as readonly string[]).includes('imposerLeResultat'),
);
