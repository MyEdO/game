import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { FLOW_HANDLERS, FLOW_VERBS } from './rollFlowSpecs';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { rowForcedDie, type FlowKey } from '../ui/forcedDieRow';
import type { Combatant } from '../engine/types';

/**
 * GARDE EXHAUSTIVE de l'option « Dés fixés » — le socle, pas 36 copies.
 *
 * L'évaluation d'un dé saisi vit dans `makeRollFlow` : elle prend la cible que l'ACCESSEUR DE DÉ du flux
 * (`RollFlowSpec.die`, ou sa dérivation depuis la lentille) désigne, l'évalue par `evaluateTest`, puis la
 * projette par le `write` du même accesseur. Aucun résolveur de flux n'est sollicité — ils traitent
 * `forced` comme un auto-succès de Résilience et rendraient une réussite GRATUITE en ignorant la saisie.
 *
 * Cette garde ouvre un pending FIXTURE RÉEL pour CHAQUE flux portant `setForcedRoll` et vérifie les deux
 * invariants du socle :
 *   1. un dé fixé PERDANT ne devient jamais une réussite ;
 *   2. la valeur APPLIQUÉE est la valeur SAISIE.
 * Un flux dont la fixture manque ÉCHOUE la garde : impossible d'en ajouter un en le laissant dehors.
 */
const HERO: Combatant = {
  id: 'H', name: 'H', label: 'Héros', kind: 'hero',
  characteristics: { force: 40, dexterite: 40, agilite: 40, endurance: 40, 'force-mentale': 40, 'capacite-de-combat': 45, 'capacite-de-tir': 45, initiative: 40, intelligence: 40, sociabilite: 40 },
  wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], traumas: [],
  resilience: 3, fortune: 2, weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }], items: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
} as unknown as Combatant;
const FOE = { ...HERO, id: 'E', label: 'Ennemi', kind: 'enemy', pos: { x: 1, y: 0 } } as unknown as Combatant;

const T = 45; // cible de toutes les fixtures
const PERDANT = 99; // > cible ET dans la bande d'échec auto (LDB 12 l.28)
const rate = { roll: 88, target: T, sl: -4, success: false }; // jet RATÉ générique (4 champs)
const rateTR = { ...rate, isDouble: true };
const atkDetail = { label: 'Corps à corps', base: T, modifier: 0, target: T, roll: 88, success: false, sl: -4 };
/** Incantation ENNEMIE figée (l'« attaquant » des Tests opposés Contre-sort / Opposition). */
const ENEMY_CAST = { cast: true, roll: 20, target: 50, sl: 3, isCritical: false, isFumble: false, log: '' };
const atkResult = {
  hit: false, attackerRoll: 88, netSL: -4, critical: false, advantageTo: 'defender',
  defenderDefeated: false, log: 'raté', attackerDetail: atkDetail,
};

/** Fixture d'un flux : le pending à poser, l'id de slot visé (multi), et la lecture du jet obtenu. */
interface Fixture {
  state: Record<string, unknown>;
  pid?: string;
  read: () => { roll: number | undefined; success: boolean | undefined };
}
const P = <T2,>(k: string): T2 => (useGame.getState() as unknown as Record<string, T2>)[k];
/** Participant générique d'un flux MULTI (jet à 3 champs). */
const part3 = (id = 'H') => ({ id, roleId: 'mousse', interactive: true, cumul: 0, result: { roll: 88, target: T, sl: -4 } });
/** Jet à PLAT sur le pending. */
const flatRead = (k: string) => () => ({ roll: P<{ roll: number }>(k).roll, success: P<{ success: boolean }>(k).success });
/** Jet rangé sous `result`. */
const resultRead = (k: string) => () => ({ roll: P<{ result: { roll: number } }>(k).result.roll, success: P<{ result: { success: boolean } }>(k).result.success });
/** `TestResult` entier rangé sous `roll`. */
const trRead = (k: string) => () => ({ roll: P<{ roll: { roll: number } }>(k).roll.roll, success: P<{ roll: { success: boolean } }>(k).roll.success });
/** Participant à 3 champs : la réussite est le d100 propre (≤ cible). */
const partRead = (get: () => { roll: number }) => () => { const r = get(); return { roll: r.roll, success: r.roll <= T }; };
/** Tests OPPOSÉS binaires : `def` = jet de l'acteur, `atk` figé, issue `'success'`. */
const opposedFixture = (key: string, extra: Record<string, unknown>): Fixture => ({
  state: { [key]: { ...extra, def: rateTR, atk: { roll: 20, target: 50, success: true, sl: 3, isDouble: false }, result: 'fail' } },
  read: () => ({ roll: P<{ def: { roll: number } }>(key).def.roll, success: P<{ result: string }>(key).result === 'success' }),
});

const FIXTURES: Partial<Record<FlowKey, Fixture>> = {
  attack: {
    state: { pendingAttack: { attackerId: 'H', targetId: 'E', location: null, result: atkResult } },
    read: () => ({ roll: P<{ result: { attackerRoll: number } }>('pendingAttack').result.attackerRoll, success: P<{ result: { attackerDetail: { success: boolean } } }>('pendingAttack').result.attackerDetail.success }),
  },
  trample: {
    state: { pendingTrample: { attackerId: 'H', targetId: 'E', result: atkResult } },
    read: () => ({ roll: P<{ result: { attackerRoll: number } }>('pendingTrample').result.attackerRoll, success: P<{ result: { attackerDetail: { success: boolean } } }>('pendingTrample').result.attackerDetail.success }),
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
    read: () => ({ roll: P<{ def: { roll: number } }>('pendingDefense').def.roll, success: P<{ def: { success: boolean } }>('pendingDefense').def.success }),
  },
  cast: {
    state: { pendingCast: { casterId: 'H', targetId: 'H', spellId: 'drain', missile: false, focused: false, result: { cast: false, roll: 88, target: T, sl: -4, isCritical: false, isFumble: false, log: '' } } },
    read: () => ({ roll: P<{ result: { roll: number } }>('pendingCast').result.roll, success: P<{ result: { cast: boolean } }>('pendingCast').result.cast }),
  },
  // Contre-sort / Opposition : le jet d'incantation ENNEMI est FIGÉ dans `pendingCast` — les deux
  // accesseurs de dé l'y relisent pour re-opposer, la fixture doit donc le poser.
  counterspell: {
    state: {
      pendingCast: { casterId: 'E', targetId: 'H', spellId: 'drain', missile: false, focused: false, result: ENEMY_CAST },
      pendingCounterspell: { participants: [{ id: 'H', interactive: true, declared: 'solo', result: { dispelled: false, counter: rateTR, casterNetSL: 7, log: '' } }] },
    },
    pid: 'H',
    read: () => ({
      roll: P<{ participants: { result: { counter: { roll: number } } }[] }>('pendingCounterspell').participants[0].result.counter.roll,
      success: P<{ participants: { result: { counter: { success: boolean } } }[] }>('pendingCounterspell').participants[0].result.counter.success,
    }),
  },
  opposition: {
    state: {
      pendingCast: { casterId: 'E', targetId: 'H', spellId: 'drain', missile: false, focused: false, result: ENEMY_CAST },
      pendingCastOpposition: { kind: 'resist', char: 'force-mentale', participants: [{ id: 'H', interactive: true, result: { oppose: rateTR, resisted: false, margin: 7 } }] },
    },
    pid: 'H',
    read: () => ({
      roll: P<{ participants: { result: { oppose: { roll: number } } }[] }>('pendingCastOpposition').participants[0].result.oppose.roll,
      success: P<{ participants: { result: { oppose: { success: boolean } } }[] }>('pendingCastOpposition').participants[0].result.oppose.success,
    }),
  },
  cascade: {
    state: { pendingCascade: { cursor: 0, participants: [{ id: 's1', actorId: 'H', target: T, result: { roll: 88, target: T, sl: -4, success: false } }] } },
    pid: 's1',
    read: () => ({ roll: P<{ participants: { result: { roll: number } }[] }>('pendingCascade').participants[0].result.roll, success: P<{ participants: { result: { success: boolean } }[] }>('pendingCascade').participants[0].result.success }),
  },
  // Rangée de BANDE : elle porte SON verdict (`CascadeRoll.success`) — la garde le LIT. Le dériver du
  // d100 (`roll ≤ cible`, cf. `partRead`) reviendrait à se fournir la valeur qu'on prétend mesurer :
  // la garde resterait verte alors même que l'accesseur de dé n'écrirait aucune issue.
  cascadeBatch: {
    state: { pendingCascade: { cursor: 0, participants: [{ id: 'b1', kind: 'batch', aggregate: 'none', participants: [{ id: 'H', interactive: true, base: T, target: T, result: { roll: 88, target: T, sl: -4, success: false } }] }] } },
    pid: 'H',
    read: () => {
      const r = P<{ participants: { participants: { result: { roll: number; success: boolean } }[] }[] }>('pendingCascade').participants[0].participants[0].result;
      return { roll: r.roll, success: r.success };
    },
  },
  flee: {
    state: { pendingDisengage: { moverId: 'E', foeId: 'H', fuir: { participants: [{ id: 'H', kind: 'backstab', interactive: true, result: atkResult }] } } },
    pid: 'H',
    read: () => {
      const r = P<{ fuir: { participants: { result: { attackerRoll: number; attackerDetail: { success: boolean } } }[] } }>('pendingDisengage').fuir.participants[0].result;
      return { roll: r.attackerRoll, success: r.attackerDetail.success };
    },
  },
  test: {
    state: { pendingTest: { actorId: 'H', actorName: 'Héros', label: 'T', skillValue: T, difficulty: 'intermediaire', requireSL: 0, ...rate, onSuccess: [], onFailure: [] } },
    read: flatRead('pendingTest'),
  },
  activity: {
    state: { pendingActivity: { heroId: 'H', activityId: 'a', skillValue: T, difficulty: 'intermediaire', ...rate } },
    read: flatRead('pendingActivity'),
  },
  reload: {
    state: { pendingReload: { actorId: 'H', actorName: 'H', weaponUid: 'w', reload: 1, progressBefore: 0, skillValue: T, difficulty: 'intermediaire', ...rate } },
    read: flatRead('pendingReload'),
  },
  handGate: { state: { pendingHandGate: { attackerId: 'H', skillValue: T, difficulty: 'intermediaire', ...rate } }, read: flatRead('pendingHandGate') },
  steamSave: { state: { pendingSteamSave: { actorId: 'H', skillValue: T, difficulty: 'intermediaire', ...rate } }, read: flatRead('pendingSteamSave') },
  appraise: {
    state: { pendingAppraise: { actorId: 'H', actorName: 'H', itemUid: 'x', itemName: 'x', truePriceBrass: 1, availability: 'Rare', skillValue: T, difficulty: 'intermediaire', ...rate } },
    read: flatRead('pendingAppraise'),
  },
  heal: {
    state: { pendingHeal: { healerId: 'H', targetId: 'H', mode: 'wounds', intBonus: 4, skillValue: T, difficulty: 'intermediaire', ...rate } },
    read: flatRead('pendingHeal'),
  },
  surgery: {
    state: { pendingSurgery: { healerId: 'H', healerName: 'H', targetId: 'H', targetName: 'H', kind: 'surgery', skillValue: T, difficulty: 'intermediaire', ...rate } },
    read: flatRead('pendingSurgery'),
  },
  // Exposition à une Influence corruptrice (LDB 19 l.29) : « tentez un Test de Résistance Intermédiaire
  // (+0) ou un Test de Calme » — un Test, donc la Résilience (LDB 17 l.68) et son dé choisi.
  corruption: {
    state: { pendingCorruption: { heroId: 'H', kind: 'exposition', level: 'mineure', skill: 'resistance', skillLocked: true, menace: 'corruption', ...rate } },
    read: flatRead('pendingCorruption'),
  },
  recover: { state: { pendingStateRecovery: { actorId: 'H', state: 'sonne', skillValue: T, difficulty: 'intermediaire', roll: rateTR } }, read: trRead('pendingStateRecovery') },
  bargain: {
    state: { pendingBargain: { playerId: 'H', merchantId: 'm', playerSkill: T, merchantRoll: { roll: 20, target: 50, success: true, sl: 3, isDouble: false }, roll: rateTR } },
    read: trRead('pendingBargain'),
  },
  frenzy: { state: { pendingFrenzy: { combatantId: 'H', result: rate } }, read: resultRead('pendingFrenzy') },
  approach: { state: { pendingApproach: { combatantId: 'H', sourceId: 'E', sourceName: 'E', result: rate } }, read: resultRead('pendingApproach') },
  ward: { state: { pendingWard: { attackerId: 'H', targetId: 'E', targetName: 'E', result: rate } }, read: resultRead('pendingWard') },
  dispel: { state: { pendingDispel: { casterId: 'H', value: T, spellId: 's', result: rate } }, read: resultRead('pendingDispel') },
  shanty: { state: { pendingShanty: { singerId: 'H', shantyId: 'x', result: rate } }, read: resultRead('pendingShanty') },
  battement: { state: { pendingBattement: { attackerId: 'H', targetId: 'E', result: rateTR } }, read: resultRead('pendingBattement') },
  focus: {
    state: { pendingFocus: { casterId: 'H', spellId: 'drain', result: { dr: 0, isCritical: false, isFumble: false, roll: 88, target: T, sl: -4, log: '' } } },
    read: () => ({ roll: P<{ result: { roll: number } }>('pendingFocus').result.roll, success: P<{ result: { dr: number } }>('pendingFocus').result.dr > 0 }),
  },
  run: {
    state: { pendingRun: { combatantId: 'H', dest: { x: 5, y: 0 }, result: { success: false, roll: 88, target: T, dr: -4, bonusCases: 0 } } },
    read: resultRead('pendingRun'),
  },
  fall: {
    state: { pendingFall: { combatantId: 'H', metres: 6, attempt: true, result: { success: false, roll: 88, target: T, dr: -4, effectiveMetres: 6 } } },
    read: resultRead('pendingFall'),
  },
  extendedTest: {
    state: { pendingExtendedTest: { actorId: 'H', label: 'X', skillLabel: 'Force', target: T, targetDR: 6, total: 0, rounds: [{ id: 'r1', interactive: true, result: { roll: 88, sl: -4, success: false } }] } },
    pid: 'r1',
    read: () => {
      const r = P<{ rounds: { result: { roll: number; success: boolean } }[] }>('pendingExtendedTest').rounds[0].result;
      return { roll: r.roll, success: r.success };
    },
  },
  // LOT DE DÉS d'un étal (#1426) : le seul verbe est la POSE. La rangée n'a ni cible ni réussite —
  // ce qu'on vérifie est le SEUL contrat qui existe ici : la valeur SAISIE est la valeur APPLIQUÉE.
  etalLot: {
    state: { pendingEtalLot: { label: 'Halle', cible: 'land', participants: [{ id: 'de-1', label: 'Marchand présent', min: 1, max: 100, value: 88, interactive: true, result: null }] } },
    pid: 'de-1',
    read: () => { const v = P<{ participants: { value: number }[] }>('pendingEtalLot').participants[0].value; return { roll: v, success: v <= T }; },
  },
  forceDoor: {
    state: { pendingForceDoor: { doorId: 'd', participants: [{ id: 'H', interactive: true, result: { roll: 88, target: T, sl: -4, damage: 0 } }] } },
    pid: 'H',
    read: partRead(() => P<{ participants: { result: { roll: number } }[] }>('pendingForceDoor').participants[0].result),
  },
  shipManeuver: {
    state: { pendingShipManeuver: { participants: [part3()] } },
    pid: 'H',
    read: partRead(() => P<{ participants: { result: { roll: number } }[] }>('pendingShipManeuver').participants[0].result),
  },
  shipBattery: {
    state: { pendingShipBattery: { participants: [part3()] } },
    pid: 'H',
    read: partRead(() => P<{ participants: { result: { roll: number } }[] }>('pendingShipBattery').participants[0].result),
  },
  crewTest: {
    state: { pendingCrewTest: { participants: [part3()] } },
    pid: 'H',
    read: partRead(() => P<{ participants: { result: { roll: number } }[] }>('pendingCrewTest').participants[0].result),
  },
  disengage: opposedFixture('pendingDisengage', { moverId: 'H', foeId: 'E' }),
  auContact: opposedFixture('pendingAuContact', { moverId: 'H', foeId: 'E' }),
  grapple: opposedFixture('pendingGrapple', { actorId: 'H', targetId: 'E' }),
  distraire: {
    state: { pendingDistraire: { moverId: 'H', targetId: 'E', atk: rateTR, defRoll: { roll: 20, target: 50, success: true, sl: 3, isDouble: false }, result: 'fail' } },
    read: () => ({ roll: P<{ atk: { roll: number } }>('pendingDistraire').atk.roll, success: P<{ result: string }>('pendingDistraire').result === 'success' }),
  },
  maneuver: { state: { pendingManeuver: { attackerId: 'H', targetId: 'E', maneuverId: 'm', kind: 'souffle', result: rateTR } }, read: resultRead('pendingManeuver') },
};

const FLUX = (Object.keys(FLOW_VERBS) as FlowKey[]).filter(
  (k) => (FLOW_VERBS[k].verbs as readonly string[]).includes('setForcedRoll'),
);

beforeEach(() => {
  resetDesFixes();
  useGame.setState({
    party: [HERO],
    battle: { combatants: [HERO, FOE], log: [], order: ['H', 'E'], turn: 0, round: 1 } as never,
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
  });
});
afterEach(() => resetDesFixes());

describe('socle du dé fixé — les flux passent TOUS par le même chemin', () => {
  it('chaque flux portant `setForcedRoll` sait réévaluer un dé saisi (accesseur complet)', () => {
    const sans = FLUX.filter((k) => !FLOW_HANDLERS[k].fixable);
    expect(sans, 'flux sans ACCESSEUR DE DÉ — déclarer `die` (ou une lentille) sur sa spec').toEqual([]);
  });

  it('chaque flux a sa FIXTURE (un flux ajouté sans fixture échoue ICI, jamais en silence)', () => {
    const sans = FLUX.filter((k) => !FIXTURES[k]);
    expect(sans, 'flux sans fixture de garde').toEqual([]);
  });

  for (const k of FLUX) {
    it(`${k} — un dé fixé PERDANT échoue, et la valeur appliquée est la valeur saisie`, () => {
      const f = FIXTURES[k]!;
      setDesFixes(true);
      useGame.setState(f.state as never);
      // L'affordance existe VRAIMENT pour ce flux (le champ est rendu).
      const die = rowForcedDie(useGame.getState(), k, { actor: HERO, rolled: true, key: f.pid } as never, true);
      expect(die.forcedRoll?.fixed, `${k} : aucun champ « dé fixé » offert`).toBe(true);
      // Le geste passe par le DÉLÉGUÉ de store — le même chemin qu'un intent coop.
      const verb = (useGame.getState() as unknown as Record<string, (...a: unknown[]) => void>)[`${k}SetForcedRoll`];
      if (f.pid) verb(f.pid, PERDANT); else verb(PERDANT);
      const got = f.read();
      expect(got.roll, `${k} : la valeur appliquée n'est pas la valeur saisie`).toBe(PERDANT);
      expect(got.success, `${k} : un dé PERDANT est devenu une réussite (réussite gratuite)`).toBe(false);
    });
  }
});

/**
 * GARDE JUMELLE — le dé CHOISI au titre de la Résilience (LDB 17 l.68 : « au lieu de lancer les dés pour
 * un Test, vous choisissez le résultat ») emprunte le MÊME chemin de socle, avec sa POLITIQUE : le dé doit
 * rester une réussite, le DR est planché (Test opposé : « vous l'emportez avec au moins DR +1 »), et la
 * réussite PAYÉE par le point est conservée.
 *
 * Deux régressions que cette garde ferme : les Tests opposés binaires RELANÇAIENT un dé aléatoire (point de
 * Résilience perdu, réussite détruite) ; quatorze flux rendaient le sélecteur en IGNORANT la saisie.
 */
// Le dé CHOISI est un geste de RÉSILIENCE : il n'a de sens que pour les flux qui la déclarent. Un
// flux qui n'offre que la POSE (lot de dés d'étal : `verbs: ['setForcedRoll']`) n'a pas de
// `forceSuccess` à appeler — l'itérer ici mesurerait un verbe qui n'existe pas.
const FLUX_RESILIENCE = FLUX.filter((k) => (FLOW_VERBS[k].verbs as readonly string[]).includes('forceSuccess'));

describe('socle du dé choisi (Résilience) — même chemin, politique en paramètre', () => {
  const CHOISI = 11; // ≤ cible (45) : le plus bas double réussi — le dé de l'exemple Salundra (l.70)
  for (const k of FLUX_RESILIENCE) {
    it(`${k} — le dé choisi s'applique, la réussite achetée tient, le point n'est pas re-dépensé`, () => {
      const f = FIXTURES[k]!;
      // Acteur FRAIS par fixture : un objet partagé verrait sa Résilience épuisée par les cas précédents,
      // et les derniers flux ne forceraient plus rien (piège mesuré).
      const hero = { ...HERO, resilience: 3 } as Combatant;
      const foe = { ...FOE, resilience: 3 } as Combatant;
      useGame.setState({
        party: [hero],
        battle: { combatants: [hero, foe], log: [], order: ['H', 'E'], turn: 0, round: 1 } as never,
      });
      useGame.setState(f.state as never);
      const verbs = useGame.getState() as unknown as Record<string, (...a: unknown[]) => void>;
      const call = (v: string, ...args: unknown[]) => (f.pid ? verbs[v](f.pid, ...args) : verbs[v](...args));
      call(`${k}ForceSuccess`);
      const apres = useGame.getState().battle!.combatants.find((c) => c.id === 'H')!.resilience;
      expect(apres, `${k} : la Résilience n'a pas été dépensée (le forçage n'a pas pris)`).toBe(2);
      const forced = f.read();
      expect(forced.success, `${k} : « Je ne faillirai pas ! » n'a pas produit de réussite`).toBe(true);

      call(`${k}SetForcedRoll`, CHOISI);
      const got = f.read();
      expect(got.roll, `${k} : le dé CHOISI n'est pas celui appliqué (jet relancé ou saisie ignorée)`).toBe(CHOISI);
      expect(got.success, `${k} : la réussite PAYÉE par le point de Résilience a été perdue`).toBe(true);
      expect(useGame.getState().battle!.combatants.find((c) => c.id === 'H')!.resilience,
        `${k} : le choix du dé a re-dépensé une ressource`).toBe(apres);
    });
  }
});
