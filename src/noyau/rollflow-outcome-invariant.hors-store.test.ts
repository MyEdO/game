import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, onTestFinished } from 'vitest';
import { crewRoles, spells, type CrewRoleData, type SpellData } from '../data';
import { setDataset } from '../data/overrides';
import { idDeFixture } from '../data/idDeFixture.testkit';
import { fixtureText } from '../i18n/fixtureText';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { evaluateTest } from '../engine/tests';
import { resetRule, setRule } from '../engine/policy';
import { seedBattleRng } from './battleRng';
import { FLOWS } from './rollFlowSpecs';
import { FLOW_VERBS, fluxAccepte, type FlowKey } from './flowVerbs';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import { cascadeDeTest, TESTE_DE_TEST } from './cascade.testkit';
import { t } from '../i18n';
import { testDeRegle } from '../engine/reglesChiffrees';
import { cleDeFixture } from './noyau.testkit';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

const sort: SpellData = {
  id: idDeFixture('spell', 'sort-fixture-resilience'), type: 'spells', label: 'Sort de test', ecole: 'sort', subType: null,
  family: 'arcane', cn: 0, range: null, target: null, duration: null, desc: '', source: { book: 'LDB', page: 0 },
};
const role: CrewRoleData = {
  id: idDeFixture('crewRole', 'role-fixture-resilience'), type: 'crew-roles', label: 'Rôle de test', desc: '',
  skills: [{ id: 'voile' }], profil: { id: idDeFixture('creature', 'profil-fixture-resilience') },
};
const sortsLivres = [...spells];
const rolesLivres = [...crewRoles];
beforeAll(() => {
  setDataset('spells', [...sortsLivres, sort]);
  setDataset('crewRoles', [...rolesLivres, role]);
});
afterAll(() => {
  setDataset('spells', sortsLivres);
  setDataset('crewRoles', rolesLivres);
});

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * GARDE BEHAVIORAL de l'ISSUE CANONIQUE (`spec.outcome`) — VERROUILLE la classe de bugs « le prédicat
 * `failed` DIVERGE de l'issue réelle du flux » (bug historique `activity` : la narration lisait
 * `combinedLevel`, l'ancien `failed` lisait skill-1 → Chance/Résilience mal gatées).
 *
 * Depuis le refactor, la fabrique DÉRIVE le gating de la Chance/Pacte/Résistance de l'issue unique :
 * `failed = !outcome(slot).won`. Ce test PILOTE, flux par flux (catalogue-dérivé de `FLOW_VERBS`), le
 * verbe RÉELLEMENT gaté par ce `failed` — la RELANCE de Chance (`jetRelancer(flux, …)`) — et prouve qu'il :
 *   (a) est DISPONIBLE sur un résultat PERDANT (dépense 1 Point de Chance) ;
 *   (b) est un NO-OP sur un résultat GAGNANT (aucune dépense).
 * Un flux dont l'`outcome.won` NE reflète PAS son issue réelle fait donc échouer (a) ou (b).
 *
 * Observable = le Point de Chance : `opReroll` ne le dépense QUE si `rolled && !outcome.won` (via
 * `canReroll`) ET que la re-résolution aboutit. Le cas GAGNANT court-circuite AVANT toute re-résolution
 * (donc toujours sûr) ; le cas PERDANT exige une re-résolution valide (d'où les fixtures minimales mais
 * complètes ci-dessous, calquées sur `resilience-die-choice.hors-store.test.ts`).
 */

const C = (over: Partial<Combatant>): Combatant =>
  (blessuresSurLeProfil({
    id: 'X', name: 'X', kind: 'heros',
    characteristics: { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 35, endurance: 35, initiative: 35, agilite: 35, dexterite: 35, intelligence: 35, 'force-mentale': 35, sociabilite: 35 },
    wounds: blessuresDeBase(14), advantage: 0, conditions: [], traumas: [],
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
    ...over,
  })) as unknown as Combatant;

/** Héros « A » avec 1 Point de Chance (l'observable) ; l'ennemi « B » adjacent. */
const hero = (over: Partial<Combatant> = {}): Combatant => C({ id: 'A', label: 'A', kind: 'heros', fortune: 1, resilience: 1, ...over });
const foe = (over: Partial<Combatant> = {}): Combatant => C({ id: 'B', label: 'B', kind: 'ennemi', fortune: 0, resilience: 0, pos: { x: 1, y: 0 }, ...over });
const arena = (extra: Combatant[] = []) => ({ combatants: [hero(), foe(), ...extra], log: [] });

/** Jets propres PERDANT / GAGNANT réutilisés partout (verdict `evaluateTest`, LDB 12 l.25-28). */
const LOSE = { roll: 95, target: 40, success: false, sl: -5, isDouble: false };
const WIN = { roll: 8, target: 40, success: true, sl: 3, isDouble: false };

/** Détail d'attaquant/défenseur (attaque/défense/piétinement). */
const atkDetail = (win: boolean) => ({ label: 'Corps à corps', base: 45, modifier: 0, target: 45, roll: win ? 20 : 88, success: win, sl: win ? 2 : -4 });

const fortuneOfA = (): number | undefined => {
  const s = banc.getState();
  return (s.battle?.combatants ?? s.party).find((c) => c.id === 'A')?.fortune;
};

/**
 * `make(win)` : les deux issues nominales (perdante / gagnante), consommées par les DEUX volets.
 * `composite` (optionnel) : l'état où le d100 est PROPREMENT RÉUSSI mais où l'issue MÉTIER est
 * défavorable — DR sous le NI d'un sort (`LDB 46 l.22-24`), seuil `requireSL` manqué. C'est là, et
 * seulement là, que « issue composée » et « d100 propre » peuvent DIVERGER : sans cet état, le volet
 * structurel ne mesure rien (mutation mesurée verte sur les seules fixtures nominales).
 */
type ChiffresDuJet = { roll: number; target: number; sl: number };

type Fix = {
  pid?: string;
  make: (win: boolean) => Record<string, unknown>;
  composite?: () => Record<string, unknown>;
  jetPropre?: (etat: ReturnType<Banc['getState']>) => ChiffresDuJet | null | undefined;
  plancherOppose?: number;
};

const posteDEquipage = (win: boolean) => ({
  id: 'A', roleId: role.id, essential: true, navigation: { id: 'voile' }, interactive: true,
  result: win ? WIN : LOSE,
});

const areneDEquipage = () => ({
  combatants: [hero({ skills: [{ id: 'voile', characteristic: 'agilite', advances: 5 }] }), foe()], log: [],
});

/**
 * Fixtures par flux (préfixe de `FLOW_VERBS`). `make(win)` pose une arène fraîche (A = 1 Chance) + le
 * pending avec un jet PERDANT (win=false) ou GAGNANT (win=true). L'`outcome` du flux DOIT lire le champ
 * qui bascule ci-dessous. Les flux absents sont documentés dans `SKIP` (fixture trop lourde/hors-jet).
 */
const FIXTURES: Partial<Record<FlowKey, Fix>> = {
  // ── Attaque / défense / piétinement (issue = `attackerDetail.success` / `def.success`) ──
  attaque: { make: (win) => ({
    battle: arena(), scene: testScene(), // resolveAttack (re-résolution) lit la scène (LdV/couvert) sans garde
    pendingAttack: { attackerId: 'A', targetId: 'B', location: null, result: { hit: win, attackerRoll: win ? 20 : 88, netSL: win ? 2 : -4, critical: false, advantageTo: win ? 'attaquant' : 'defenseur', defenderDefeated: false, log: '', attackerDetail: atkDetail(win) } },
  }) },
  defense: { plancherOppose: 2, make: (win) => ({
    battle: { combatants: [hero({ pos: { x: 1, y: 0 } }), foe({ pos: { x: 0, y: 0 } })], log: [] },
    pendingDefense: {
      attackerId: 'B', defenderId: 'A', weapon: { name: 'Gourdin', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] },
      location: null, atk: { roll: 30, target: 45, success: true, sl: 1, isDouble: false }, mode: 'esquive',
      def: win ? WIN : LOSE,
      result: { hit: !win, attackerRoll: 30, netSL: win ? -1 : 5, critical: false, advantageTo: win ? 'defenseur' : 'attaquant', defenderDefeated: false, log: '', attackerDetail: { label: 'Corps à corps', base: 45, modifier: 0, target: 45, roll: 30, success: true, sl: 1 }, defenderDetail: { label: 'Esquive', base: 40, modifier: 0, target: 40, roll: win ? 8 : 95, success: win, sl: win ? 3 : -5 } },
      suite: { mode: 'machine', coup: {} },
    },
  }) },
  // ── Incantation / Focalisation / dissipation (jet propre / DR) ──
  incantation: {
    make: (win) => ({
      battle: arena(),
      pendingCast: { casterId: 'A', targetId: 'A', spellId: sort.id, missile: false, result: { cast: win, roll: win ? 8 : 88, target: 45, sl: win ? 3 : -4, isCritical: false, isFumble: false, log: '' } },
    }),
    // DR sous le NI (`LDB 46 l.22-24`) : le TEST est réussi (8 ≤ 45), le
    // sort n'est pas lancé (`cast: false`). L'issue canonique doit rester celle du TEST.
    composite: () => ({
      battle: arena(),
      pendingCast: { casterId: 'A', targetId: 'A', spellId: sort.id, missile: false, result: { cast: false, roll: 8, target: 45, sl: 1, isCritical: false, isFumble: false, log: '' } },
    }),
  },
  // Le lanceur Focalise : il porte la Compétence (LDB 46 l.130).
  focalisation: { make: (win) => ({
    battle: { combatants: [hero({ skills: [{ id: 'focalisation', spec: 'feu', characteristic: 'force-mentale', advances: 10 }] }), foe()], log: [] },
    pendingFocus: { casterId: 'A', spellId: sort.id, result: { dr: win ? 2 : 0, isCritical: false, isFumble: false, roll: win ? 8 : 95, target: 40, sl: win ? 2 : -5, log: '' } },
  }) },
  dissipation: { make: (win) => ({ battle: arena(), pendingDispel: { casterId: 'A', value: 40, result: win ? WIN : LOSE } }) },
  // ── Opposés BINAIRES (issue = jet de l'ACTEUR, foe figé) ──
  desengagement: { plancherOppose: 2, make: (win) => ({ battle: arena(), pendingDisengage: { moverId: 'A', atk: { roll: 40, target: 45, success: true, sl: 1, isDouble: false }, def: win ? WIN : LOSE, result: win ? 'reussite' : 'echec' } }) },
  auContact: { plancherOppose: 2, make: (win) => ({ battle: arena(), pendingAuContact: { moverId: 'A', atk: { roll: 40, target: 45, success: true, sl: 1, isDouble: false }, def: win ? WIN : LOSE, result: win ? 'reussite' : 'echec' } }) },
  empoignade: { plancherOppose: 2, make: (win) => ({ battle: arena(), pendingGrapple: { actorId: 'A', atk: { roll: 40, target: 45, success: true, sl: 1, isDouble: false }, def: win ? WIN : LOSE, result: win ? 'reussite' : 'echec' } }) },
  distraire: { plancherOppose: 2, make: (win) => ({ battle: arena(), pendingDistraire: { moverId: 'A', defRoll: { roll: 40, target: 45, success: true, sl: 1, isDouble: false }, atk: win ? WIN : LOSE, result: win ? 'reussite' : 'echec' } }) },
  // ── Fuir (flux MULTI HÉTÉROGÈNE : slot `backstab` du frappeur 'B' — déjà résolu, il fait perdre des
  //    PB donc le Test `fuite` est dû — + slot `touche` du fuyard 'A', celui que la Chance influence) ──
  fuite: { pid: 'A', make: (win) => ({
    battle: arena(),
    pendingDisengage: { moverId: 'A', foeId: 'B', fuir: { participants: [
      { id: 'B', kind: 'backstab', interactive: false, result: { hit: true, attackerRoll: 30, netSL: 1, location: 'corps', damage: 4, woundsLost: 4, critical: false, advantageTo: 'attaquant', defenderDefeated: false, log: '', attackerDetail: atkDetail(true) } },
      { id: 'A', kind: 'touche', interactive: true, test: testDeRegle('fuite', 'touche-en-fuyant'), jet: win ? WIN : LOSE },
    ] } },
  }) },
  // ── Manœuvres d'attaquant NON opposées (issue = `result.success`) ──
  battement: { make: (win) => ({ battle: arena(), pendingBattement: { attackerId: 'A', result: win ? WIN : LOSE } }) },
  manoeuvre: { make: (win) => ({ battle: arena(), pendingManeuver: { attackerId: 'A', kind: 'souffle', result: win ? WIN : LOSE } }) },
  // ── Course / Frénésie / Approche / Bénédiction (Test binaire) ──
  course: { make: (win) => ({ battle: arena(), pendingRun: { combatantId: 'A', test: testDeRegle('course', 'courir'), result: { success: win, roll: win ? 8 : 95, target: 40, dr: win ? 3 : 0, bonusCases: win ? 1 : 0 } } }) },
  chute: { pid: 'A', make: (win) => ({ battle: arena(), pendingFall: { test: testDeRegle('chute', 'tenter'), to: { x: 0, y: 0 }, metres: 4, initiateurId: 'A', participants: [{ id: 'A', interactive: true, attempt: true, result: { success: win, roll: win ? 8 : 95, target: 40, dr: win ? 3 : 0, effectiveMetres: win ? 1 : 4 } }] } }) },
  frenesie: { make: (win) => ({ battle: arena(), pendingFrenzy: { combatantId: 'A', result: win ? WIN : LOSE } }) },
  approche: { make: (win) => ({ battle: arena(), pendingApproach: { combatantId: 'A', test: testDeRegle('calme-d-approche', 'se-rapprocher'), result: win ? WIN : LOSE } }) },
  protection: { make: (win) => ({ battle: arena(), pendingWard: { attackerId: 'A', result: win ? WIN : LOSE } }) },
  // ── Tests numériques « jet propre » (soin/rechargement/évaluation/corruption/activité/test) ──
  rechargement: { make: (win) => ({ battle: arena(), pendingReload: { actorId: 'A', skillValue: 40, difficulty: 'intermediaire', roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }) },
  mainEnsanglantee: { make: (win) => ({ battle: arena(), pendingHandGate: { attackerId: 'A', hand: 'main', ligne: { base: 40, mods: [], target: 60, difficulty: 'accessible' }, roll: win ? 8 : 95, target: 60, sl: win ? 3 : -5, success: win, pa: { attackerId: 'A', targetId: 'B', location: null, result: null }, title: 'Attaque', icon: 'action/attaquer' } }) },
  soins: { make: (win) => ({ battle: arena(), pendingHeal: { healerId: 'A', mode: 'first-aid', test: 'guerison', bandagesDe: null, skillValue: 40, difficulty: 'intermediaire', roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }) },
  chirurgie: { make: (win) => ({ battle: arena(), pendingSurgery: { healerId: 'A', ligne: { base: 40, mods: [], target: 40, difficulty: 'intermediaire' }, roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }) },
  evaluation: { make: (win) => ({ battle: arena(), pendingAppraise: { actorId: 'A', ligne: { base: 40, mods: [], target: 40, difficulty: 'intermediaire' }, roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }) },
  corruption: { make: (win) => ({ battle: arena(), pendingCorruption: { heroId: 'A', nature: 'spirituelle', test: testDeRegle('influences-corruptrices', 'spirituelle'),  roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }) },
  test: {
    make: (win) => ({ battle: arena(), pendingTest: { sujet: TESTE_DE_TEST, actorId: 'A', skillValue: 40, difficulty: 'intermediaire', target: 40, requireSL: 0, roll: win ? 8 : 95, sl: win ? 3 : -5, success: win } }),
    // Seuil de DR EXIGÉ manqué (`requireSL`, `meetsRequiredSL`) : le d100 est réussi (8 ≤ 40), l'issue
    // métier ne l'est pas. L'issue canonique doit rester celle du d100 (`LDB 12 l.11`).
    composite: () => ({ battle: arena(), pendingTest: { sujet: TESTE_DE_TEST, actorId: 'A', skillValue: 40, difficulty: 'intermediaire', target: 40, requireSL: 3, roll: 8, sl: 1, success: false } }),
  },
  fuiteDeVapeur: { make: (win) => ({ battle: arena(), pendingSteamSave: { actorId: 'A', skillValue: 40, difficulty: 'intermediaire', target: 40, scaldOps: [{ op: 'wounds', amount: 1, ignoreAP: true }], roll: win ? 8 : 95, sl: win ? 3 : -5, success: win } }) },
  activite: { make: (win) => ({ battle: arena(), pendingActivity: { teste: TESTE_DE_TEST, heroId: 'A', kind: 'catalog', label: 'x', skillLabel: 'x', skillValue: 40, difficulty: 'intermediaire', ligne: { base: 40, mods: [], target: 40, difficulty: 'intermediaire' }, mod: 0, roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }) },
  chansonDeMarin: { make: (win) => ({ battle: arena(), pendingShanty: { singerId: 'A', shantyId: 'x', result: win ? WIN : LOSE } }) },
  // ── Opposés « joueur vs figé » avec re-résolution dédiée (récupération / marchandage) ──
  recuperation: { jetPropre: (etat) => etat.pendingStateRecovery?.roll, make: (win) => ({ battle: arena(), pendingStateRecovery: { teste: TESTE_DE_TEST, actorId: 'A', skillValue: 40, difficulty: 'intermediaire', opposed: false, roll: win ? WIN : LOSE, netSL: win ? 3 : 0, success: win } }) },
  marchandage: { make: (win) => ({ battle: arena(), pendingBargain: { playerId: 'A', playerSkill: 40, contrepartie: { kind: 'marchand', mode: 'achat', titre: t('out.bargainTitreAchat') }, opposant: { label: 'Marchand', valeur: 40 }, roll: win ? WIN : LOSE, merchantRoll: { roll: 50, target: 40, success: false, sl: -1, isDouble: false }, result: { winner: win ? 'attaquant' : 'defenseur', attackerWins: win, netSL: win ? 2 : -2 } } }) },
  // ── MULTI (participant/round/étape « A ») ──
  contreSort: { pid: 'A', plancherOppose: 2, make: (win) => ({
    battle: arena(),
    pendingCast: { casterId: 'B', targetId: 'A', spellId: sort.id, missile: false, result: { cast: true, roll: 20, target: 45, base: 45, sl: 1, isCritical: false, isFumble: false, log: '' } },
    pendingCounterspell: { participants: [{ id: 'A', interactive: true, declared: 'solo', result: { counter: win ? WIN : LOSE, dispelled: win, margin: win ? 1 : -1 } }] },
  }) },
  opposition: { pid: 'A', plancherOppose: 2, make: (win) => ({
    battle: arena(),
    pendingCast: { casterId: 'B', targetId: 'A', spellId: sort.id, missile: false, result: { cast: true, roll: 20, target: 45, base: 45, sl: 1, isCritical: false, isFumble: false, log: '' } },
    pendingCastOpposition: { test: { characteristic: 'force-mentale' }, participants: [{ id: 'A', interactive: true, result: { oppose: win ? WIN : LOSE, resisted: win, margin: win ? 0 : 2 } }] },
  }) },
  cascade: { pid: 'st1', make: (win) => ({
    battle: arena(),
    pendingCascade: cascadeDeTest([{ teste: TESTE_DE_TEST, id: 'st1', kind: cleDeFixture('test'), actorId: 'A', target: 40, rollLabel: 'Test', result: { roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }], { purpose: 'combat' }),
  }) },
  testEtendu: { pid: 'r1', make: (win) => ({
    battle: arena(),
    pendingExtendedTest: { actorId: 'A', label: 'x', skillLabel: 'x', characteristic: 'force', target: 40, drCible: 5, total: 0, rounds: [{ id: 'r1', result: { roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }] },
  }) },
  enfoncerLaPorte: { pid: 'A', make: (win) => ({
    battle: arena(),
    pendingForceDoor: { label: 'Porte', doorBE: 2, doorB: 6, doorBmax: 6, participants: [{ id: 'A', result: { roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, damage: win ? 4 : 0 } }] },
  }) },
  manoeuvreDuNavire: { pid: 'A', make: (win) => ({
    battle: areneDEquipage(),
    pendingShipManeuver: { shipId: 'navire', turnSteps: 0, moraleScore: 0, participants: [posteDEquipage(win)] },
  }) },
  tirDeBatterie: { pid: 'A', make: (win) => ({
    battle: areneDEquipage(),
    pendingShipBattery: { shipId: 'navire', targetId: 'autre', side: 'babord', moraleScore: 0, participants: [posteDEquipage(win)] },
  }) },
  // Rangée de BANDE (étape batch de cascade) : issue MULTI-VALEURS — le d100 propre et le verdict
  // divergent dès que l'étape est OPPOSÉE (`meta.opposed`), où `success` vient de `resolveOpposed`.
  // La fixture est donc opposante : le dé 8 est SOUS la cible et pourtant PERDANT (l'attaquant figé
  // l'emporte au DR), exactement le cas où une issue dérivée du d100 mentirait à la Chance.
  cascadeEnBande: { pid: 'A', plancherOppose: 5, make: (win) => ({
    battle: arena(),
    pendingCascade: cascadeDeTest([{
      id: 'b1', kind: 'testDeclencheEnBande', aggregate: 'none',
      meta: { opposed: { aT: { roll: 20, target: 60, success: true, sl: 4, isDouble: false, base: 60 }, attackerName: fixtureText('B') } },
      participants: [{ teste: TESTE_DE_TEST, id: 'A', interactive: true, base: 40, target: 40, result: { roll: 8, target: 40, sl: win ? 9 : 1, success: win } }],
    }], { purpose: 'combat' }),
  }) },
};

/** Flux NON couverts par une fixture minimale — justifiés (leur `outcome` est trivial + partagé). */
const SKIP: Partial<Record<FlowKey, string>> = {
  etalLot: 'Lot de dés d’étal (#1426) — le flux n’a NI Chance NI Résilience (`verbs: [setForcedRoll]`) : il n’y a pas d’issue à gater. Un dé d’étal ne réussit ni n’échoue, il tombe ; son `outcome` est scellé neutre sur sa valeur, et `failed` n’a aucun consommateur.',
  cascadeTirage: 'Dé d’étape de cascade (table, dé nu) — le flux n’a NI Chance NI Résilience (`verbs: [roll, setForcedRoll]`) : un dé de table tombe sans réussir ni échouer, son `outcome` est scellé neutre sur sa valeur.',
  maladresse: 'Maladresse (LDB 14) — le flux n’a NI Chance NI Résilience (`verbs: [roll, confirm]`) : le tirage des Oups ! désigne une ligne de table, son `outcome` est scellé neutre.',
};

beforeEach(() => {
  banc.setState({ battle: null, scene: null } as never);
});

describe('Issue canonique (outcome) — la Chance est gatée par l’issue RÉELLE (failed dérivé == won)', () => {
  // Les 11 flux « à risque » (issues multi-valeurs : combiné/opposé/DR/jet-propre-vs-issue) DOIVENT être couverts.
  const REQUIRED: readonly FlowKey[] = ['activite', 'attaque', 'defense', 'incantation', 'contreSort', 'opposition', 'recuperation', 'marchandage', 'desengagement', 'fuite', 'focalisation', 'cascadeEnBande'];
  it('couvre tous les flux à risque (multi-valeurs)', () => {
    const missing = REQUIRED.filter((p) => !(p in FIXTURES));
    expect(missing, 'flux à risque sans fixture').toEqual([]);
  });

  it('chaque flux de FLOW_VERBS est couvert par une fixture OU justifié dans SKIP', () => {
    const uncovered = Object.keys(FLOW_VERBS).filter((p) => !(p in FIXTURES) && !(p in SKIP));
    expect(uncovered, 'flux ni couvert ni justifié').toEqual([]);
  });

  /** La relance de Chance (`jetRelancer`) sur le flux `flux`, la rangée `pid` posée sur un flux multi. */
  const relancer = (flux: string, pid?: string): void =>
    (banc.getState().jetRelancer as (flux: string, pid?: string) => void)(flux, pid);
  for (const prefix of Object.keys(FLOW_VERBS) as FlowKey[]) {
    const fx = FIXTURES[prefix];
    if (!fx) {
      it.skip(`${prefix} — non piloté (${SKIP[prefix] ?? 'à couvrir'})`, () => {});
      continue;
    }
    it(`${prefix} : reroll DISPONIBLE sur un perdant, NO-OP sur un gagnant`, () => {
      // (a) PERDANT → outcome.won=false → failed=true → la Chance se dépense.
      seedBattleRng(9);
      banc.setState({ battle: null } as never);
      banc.setState(fx.make(false) as never);
      relancer(prefix, fx.pid);
      expect(fortuneOfA(), `${prefix} perdant : la relance de Chance doit être DISPONIBLE (1 Point dépensé)`).toBe(0);

      // (b) GAGNANT → outcome.won=true → failed=false → aucune relance possible (no-op).
      seedBattleRng(9);
      banc.setState({ battle: null } as never);
      banc.setState(fx.make(true) as never);
      relancer(prefix, fx.pid);
      expect(fortuneOfA(), `${prefix} gagnant : la relance de Chance doit être un NO-OP (Point conservé)`).toBe(1);
    });
  }
});

/**
 * VOLET STRUCTUREL (#1318 V4) — « le ✓/✗ POSÉ SUR LA LIGNE ⇔ `spec.outcome(slot).won` ».
 *
 * Pourquoi il fallait un second volet : le volet comportemental ci-dessus prouve que le SEAM gate la
 * Chance sur son issue canonique. Il ne dit rien de ce que la MODALE imprime. Or la coquille dérive
 * sa fenêtre du succès de la LIGNE (`row.d.success`) : si une modale y pose une issue
 * COMPOSÉE là où le seam lit le d100 propre, le bouton s'affiche et le verbe est INERTE — la classe
 * exacte qu'on vient de tuer (mesurée sur `cast`, qui posait `res.cast`, et sur `test`, qui posait
 * `success && meetsRequiredSL`).
 *
 * La mesure est possible parce que `TestOutcome` porte le VERDICT **et les chiffres qui le fondent** :
 * `outcomeOf()` rend `{won, roll, target}`. Une ligne ne peut être à la fois VRAIE (elle imprime
 * `roll` et `target`) et alignée sur le seam si `won` contredit `evaluateTest(roll, target)` (LDB 12 l.25-28). On mesure donc
 * l'issue de CHAQUE flux sur ses deux fixtures, sans aucune valeur attendue écrite à la main.
 *
 * Les flux dont l'issue est légitimement COMPOSÉE (Test OPPOSÉ : le verdict n'est pas le d100 propre)
 * sont DÉCLARÉS ci-dessous. Pour ceux-là le contrat s'inverse : la ligne DOIT poster le verdict
 * composé, faute de quoi la coquille rouvrirait la Chance là où le seam la refuse.
 */
const ISSUE_COMPOSEE: Partial<Record<FlowKey, string>> = {
  cascadeEnBande: 'Étape de BANDE opposée (`meta.opposed`) : le verdict vient de `resolveOpposed` — un d100 '
    + 'SOUS la cible peut perdre au DR (LDB 12 l.160). `CascadeModal` poste bien `result.success` (le '
    + 'verdict composé) sur la ligne, donc coquille et seam restent alignés.',
};

describe('#1318 V4 — l’issue canonique est COHÉRENTE avec les chiffres qu’elle porte', () => {
  it('aucun flux ne déclare une issue COMPOSÉE sans justification', () => {
    const inconnus = Object.keys(ISSUE_COMPOSEE).filter((p) => !(p in FIXTURES));
    expect(inconnus, 'exception d’issue composée sans fixture — périmée ?').toEqual([]);
  });

  for (const prefix of Object.keys(FLOW_VERBS) as FlowKey[]) {
    const fx = FIXTURES[prefix];
    if (!fx) continue;
    it(`${prefix} : outcome.won == evaluateTest(roll, cible), issues nominales${fx.composite ? ' + composée' : ''}`, () => {
      const divergences: string[] = [];
      // Les deux issues nominales, PLUS — quand le flux en a une — l'issue COMPOSÉE (d100 réussi,
      // métier défavorable) : c'est le seul état où le verdict peut s'écarter du dé, donc le seul qui
      // MESURE quelque chose ici.
      const etats: { nom: string; state: Record<string, unknown> }[] = [
        { nom: 'perdant', state: fx.make(false) },
        { nom: 'gagnant', state: fx.make(true) },
        ...(fx.composite ? [{ nom: 'composée (d100 réussi, métier raté)', state: fx.composite() }] : []),
      ];
      for (const { nom, state } of etats) {
        seedBattleRng(9);
        banc.setState({ battle: null } as never);
        banc.setState(state as never);
        const o = FLOWS[prefix as keyof typeof FLOWS].outcomeOf(banc.getState, fx.pid);
        expect(o, `${prefix} : l’issue canonique doit être lisible sur un pending ouvert`).not.toBeNull();
        const propre = evaluateTest(o!.roll, o!.target).success;
        if (o!.won !== propre) divergences.push(`${nom} : won=${o!.won} roll=${o!.roll} cible=${o!.target}`);
      }
      if (ISSUE_COMPOSEE[prefix]) {
        expect(divergences.length, `${prefix} est déclaré à issue COMPOSÉE mais son verdict suit le d100 `
          + 'propre sur les DEUX fixtures — l’exception est périmée, la retirer').toBeGreaterThan(0);
        return;
      }
      expect(divergences,
        `${prefix} : le verdict du seam contredit ses propres chiffres. La ligne de la modale ne peut `
        + 'alors être à la fois vraie et alignée sur la fenêtre d’influence (bouton rendu, verbe inerte). '
        + 'Corriger l’issue, OU déclarer le flux dans ISSUE_COMPOSEE avec sa justification.',
      ).toEqual([]);
    });
  }
});

describe.each([{ rapide: true, mode: 'rapide' }, { rapide: false, mode: 'standard' }])(
  '#2932 — Résilience, calcul $mode (LDB 12 l.92-94, l.102 ; LDB 17 l.68)',
  ({ rapide }) => {
    beforeEach(() => { setRule('test-dr-rapide', rapide); });
    afterEach(() => { resetRule('test-dr-rapide'); });

    const dizaines = (entier: number) => Math.floor(entier / 10);
    const drDuDe = (de: number, cible: number) => rapide ? dizaines(de) : dizaines(cible) - dizaines(de);

    for (const flux of Object.keys(FLOW_VERBS).filter((f) => fluxAccepte(f, 'forcerLaReussite'))) {
      it(`${flux} : le DR suit le dé choisi`, () => {
        const fx = FIXTURES[flux];
        if (!fx) throw new Error(`Fixture de Résilience requise pour ${flux}`);
        const { pid } = fx;
        const h = FLOWS[flux];
        const get = banc.getState;
        const lire = () => (fx.jetPropre ? fx.jetPropre(get()) : h.outcomeOf(get, pid));

        seedBattleRng(9);
        banc.setState(fx.make(false) as never);
        const avant = lire();
        const binaire = typeof (h.slotOf(get, pid) as { result?: unknown } | null)?.result === 'string';
        expect(h.actorOf(get, pid)?.resilience).toBe(1);
        get().jetForcerLaReussite(flux, pid);
        expect(h.actorOf(get, pid)?.resilience).toBe(0);
        const slot = h.slotOf(get, pid);
        if (!slot) throw new Error('Rangée forcée absente');
        expect(slot.forcee).toBe(true);

        if (binaire) {
          expect(slot).toMatchObject({ result: 'reussite' });
          expect(lire()).toEqual(avant);
        }

        if (!fluxAccepte(flux, 'imposerLeResultat')) throw new Error(`Choix du dé déclaré manquant pour ${flux}`);
        expect(h.fermetures(get, pid).imposerLeResultat).toBeNull();
        const proposition = h.picker?.(slot, h.actorOf(get, pid), get());
        if (!proposition) throw new Error('Dé à choisir absent');
        // LDB 12 l.102 : vérifier le DR de toute nouvelle valeur posée avant une éventuelle saisie.
        if (!binaire && proposition.roll !== avant?.roll) {
          expect(lire()?.roll).toBe(proposition.roll);
          expect(lire()?.sl, 'DR du dé par défaut').toBe(drDuDe(proposition.roll, proposition.target));
        }

        const palier = dizaines(Math.min(proposition.target, 95)) * 10;
        const de = proposition.roll === palier ? palier - 1 : palier;
        get().jetImposerLeResultat(flux, de, pid);

        const courant = h.slotOf(get, pid);
        const lu = courant && h.picker?.(courant, h.actorOf(get, pid), get());
        expect(lu?.roll, 'dé choisi effectivement posé').toBe(de);
        expect(lu?.target).toBe(proposition.target);
        const pose = lire();
        expect(pose?.roll).toBe(de);
        if (!pose) throw new Error('DR du dé posé absent');
        const dr = drDuDe(pose.roll, proposition.target);
        expect(pose.sl, 'DR issu du dé choisi').toBe(Math.max(dr, fx.plancherOppose ?? 1));
        expect(h.actorOf(get, pid)?.resilience).toBe(0);
      });
    }

    it('bande sans opposition : le DR de la rangée suit le dé choisi', () => {
      banc.setState({
        battle: arena() as never,
        pendingCascade: cascadeDeTest([{
          id: 'b1', kind: 'testDeclencheEnBande', aggregate: 'none',
          participants: [{ teste: TESTE_DE_TEST, id: 'A', interactive: true, base: 40, target: 40, result: LOSE }],
        }], { purpose: 'combat' }),
      });
      banc.getState().jetForcerLaReussite('cascadeEnBande', 'A');
      banc.getState().jetImposerLeResultat('cascadeEnBande', 31, 'A');
      expect(FLOWS.cascadeEnBande.outcomeOf(banc.getState, 'A')).toMatchObject({
        roll: 31, target: 40, sl: rapide ? 3 : 1, won: true,
      });
    });

    it('focalisation avant le jet : la réussite est forcée sans dé à choisir', () => {
      banc.setState({
        battle: arena() as never,
        pendingFocus: { casterId: 'A', spellId: sort.id, result: null } as never,
      });
      banc.getState().jetForcerLaReussite('focalisation');
      expect(banc.getState().pendingFocus).toMatchObject({ forcee: true, result: { dr: 1 } });
      expect(FLOWS.focalisation.fermetures(banc.getState).imposerLeResultat).toBe('jetNonLance');
      banc.getState().jetImposerLeResultat('focalisation', 31);
      expect(banc.getState().pendingFocus?.result).toMatchObject({ roll: 1, dr: 1 });
    });

    it('activité simple : le DR du dé par défaut est acquis avant toute saisie', () => {
      banc.setState(FIXTURES.activite!.make(false) as never);
      banc.getState().jetForcerLaReussite('activite');
      expect(banc.getState().pendingActivity).toMatchObject({
        forcee: true, success: true, target: 40, roll: rapide ? 40 : 1, sl: 4,
      });
    });

    it('activité combinée : le dé par défaut et le dé choisi donnent les deux DR', () => {
      const fixture = FIXTURES.activite!.make(false);
      banc.setState({
        ...fixture,
        pendingActivity: {
          ...fixture.pendingActivity as Record<string, unknown>,
          target: 58,
          target2: 36,
          teste2: TESTE_DE_TEST,
          success2: false,
          sl2: -6,
          combinedLevel: 'fail',
        },
      } as never);
      const resultat = () => banc.getState().pendingActivity;
      const force = () => banc.getState().jetForcerLaReussite('activite');
      const choisir = (de: number) => banc.getState().jetImposerLeResultat('activite', de);

      force();
      expect(resultat()).toMatchObject(rapide
        ? { roll: 36, sl: 3, sl2: 3, combinedLevel: 'full' }
        : { roll: 1, sl: 5, sl2: 3, combinedLevel: 'full' });

      choisir(45);
      expect(resultat()).toMatchObject({ roll: rapide ? 36 : 1, combinedLevel: 'full' });

      choisir(26);
      expect(resultat()).toMatchObject(rapide
        ? { roll: 26, sl: 2, sl2: 2, combinedLevel: 'full' }
        : { roll: 26, sl: 3, sl2: 1, combinedLevel: 'full' });

      choisir(6);
      expect(resultat()).toMatchObject(rapide
        ? { roll: 6, sl: 1, sl2: 1, combinedLevel: 'full' }
        : { roll: 6, sl: 5, sl2: 3, combinedLevel: 'full' });

      choisir(36);
      expect(resultat()).toMatchObject(rapide
        ? { roll: 36, sl: 3, sl2: 3, combinedLevel: 'full' }
        : { roll: 36, sl: 2, sl2: 1, combinedLevel: 'full' });

      setRule('test-bandes-auto', 'inverted');
      onTestFinished(() => resetRule('test-bandes-auto'));
      choisir(3);
      expect(resultat()).toMatchObject({ roll: 3, sl: -1, sl2: -1 });
    });
  },
);
