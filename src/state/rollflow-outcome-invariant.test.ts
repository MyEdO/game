import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { FLOW_VERBS, FLOW_HANDLERS } from './rollFlowSpecs';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

/**
 * GARDE BEHAVIORAL de l'ISSUE CANONIQUE (`spec.outcome`) — VERROUILLE la classe de bugs « le prédicat
 * `failed` DIVERGE de l'issue réelle du flux » (bug historique `activity` : la narration lisait
 * `combinedLevel`, l'ancien `failed` lisait skill-1 → Chance/Résilience mal gatées).
 *
 * Depuis le refactor, la fabrique DÉRIVE le gating de la Chance/Pacte/Résistance de l'issue unique :
 * `failed = !outcome(slot).won`. Ce test PILOTE, flux par flux (catalogue-dérivé de `FLOW_VERBS`), le
 * verbe RÉELLEMENT gaté par ce `failed` — la RELANCE de Chance (`<prefix>Reroll`) — et prouve qu'il :
 *   (a) est DISPONIBLE sur un résultat PERDANT (dépense 1 Point de Chance) ;
 *   (b) est un NO-OP sur un résultat GAGNANT (aucune dépense).
 * Un flux dont l'`outcome.won` NE reflète PAS son issue réelle fait donc échouer (a) ou (b).
 *
 * Observable = le Point de Chance : `opReroll` ne le dépense QUE si `rolled && !outcome.won` (via
 * `canReroll`) ET que la re-résolution aboutit. Le cas GAGNANT court-circuite AVANT toute re-résolution
 * (donc toujours sûr) ; le cas PERDANT exige une re-résolution valide (d'où les fixtures minimales mais
 * complètes ci-dessous, calquées sur `resilience-die-choice.test.ts`).
 */

const C = (over: Partial<Combatant>): Combatant =>
  ({
    id: 'X', name: 'X', kind: 'hero',
    characteristics: { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 35, endurance: 35, initiative: 35, agilite: 35, dexterite: 35, intelligence: 35, 'force-mentale': 35, sociabilite: 35 },
    wounds: { current: 14, max: 14 }, advantage: 0, conditions: [], traumas: [],
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
    ...over,
  }) as unknown as Combatant;

/** Héros « A » avec 1 Point de Chance (l'observable) ; l'ennemi « B » adjacent. */
const hero = (over: Partial<Combatant> = {}): Combatant => C({ id: 'A', label: 'A', kind: 'hero', fortune: 1, resilience: 1, ...over });
const foe = (over: Partial<Combatant> = {}): Combatant => C({ id: 'B', label: 'B', kind: 'enemy', fortune: 0, resilience: 0, pos: { x: 1, y: 0 }, ...over });
const arena = (extra: Combatant[] = []) => ({ combatants: [hero(), foe(), ...extra], log: [] });

/** Jets propres PERDANT / GAGNANT réutilisés partout (roll ≤ cible = réussite). */
const LOSE = { roll: 95, target: 40, success: false, sl: -5, isDouble: false };
const WIN = { roll: 8, target: 40, success: true, sl: 3, isDouble: false };

/** Détail d'attaquant/défenseur (attaque/défense/piétinement). */
const atkDetail = (win: boolean) => ({ label: 'Corps à corps', base: 45, modifier: 0, target: 45, roll: win ? 20 : 88, success: win, sl: win ? 2 : -4 });

const fortuneOfA = (): number | undefined => {
  const s = useGame.getState();
  return (s.battle?.combatants ?? s.party).find((c) => c.id === 'A')?.fortune;
};

/**
 * `make(win)` : les deux issues nominales (perdante / gagnante), consommées par les DEUX volets.
 * `composite` (optionnel) : l'état où le d100 est PROPREMENT RÉUSSI mais où l'issue MÉTIER est
 * défavorable — DR sous le NI d'un sort (`LDB 46 l.23-25`), seuil `requireSL` manqué. C'est là, et
 * seulement là, que « issue composée » et « d100 propre » peuvent DIVERGER : sans cet état, le volet
 * structurel ne mesure rien (mutation mesurée verte sur les seules fixtures nominales).
 */
type Fix = { pid?: string; make: (win: boolean) => Record<string, unknown>; composite?: () => Record<string, unknown> };

/**
 * Fixtures par flux (préfixe de `FLOW_VERBS`). `make(win)` pose une arène fraîche (A = 1 Chance) + le
 * pending avec un jet PERDANT (win=false) ou GAGNANT (win=true). L'`outcome` du flux DOIT lire le champ
 * qui bascule ci-dessous. Les flux absents sont documentés dans `SKIP` (fixture trop lourde/hors-jet).
 */
const FIXTURES: Record<string, Fix> = {
  // ── Attaque / défense / piétinement (issue = `attackerDetail.success` / `def.success`) ──
  attack: { make: (win) => ({
    battle: arena(), scene: testScene(), // resolveAttack (re-résolution) lit la scène (LdV/couvert) sans garde
    pendingAttack: { attackerId: 'A', targetId: 'B', location: null, result: { hit: win, attackerRoll: win ? 20 : 88, netSL: win ? 2 : -4, critical: false, advantageTo: win ? 'attacker' : 'defender', defenderDefeated: false, log: '', attackerDetail: atkDetail(win) } },
  }) },
  defense: { make: (win) => ({
    battle: { combatants: [hero({ pos: { x: 1, y: 0 } }), foe({ pos: { x: 0, y: 0 } })], log: [] },
    pendingDefense: {
      attackerId: 'B', defenderId: 'A', weapon: { name: 'Gourdin', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] },
      location: null, atk: { roll: 30, target: 45, success: true, sl: 1, isDouble: false }, mode: 'esquive',
      def: win ? WIN : LOSE,
      result: { hit: !win, attackerRoll: 30, netSL: win ? -1 : 5, critical: false, advantageTo: win ? 'defender' : 'attacker', defenderDefeated: false, log: '', attackerDetail: { label: 'Corps à corps', base: 45, modifier: 0, target: 45, roll: 30, success: true, sl: 1 }, defenderDetail: { label: 'Esquive', base: 40, modifier: 0, target: 40, roll: win ? 8 : 95, success: win, sl: win ? 3 : -5 } },
      suite: { mode: 'machine', coup: {} },
    },
  }) },
  trample: { make: (win) => ({
    battle: arena(),
    pendingTrample: { attackerId: 'A', targetId: 'B', result: { hit: win, attackerRoll: win ? 20 : 90, netSL: win ? 2 : -5, critical: false, advantageTo: win ? 'attacker' : 'defender', defenderDefeated: false, log: '', attackerDetail: atkDetail(win) } },
  }) },
  // ── Incantation / Focalisation / dissipation (jet propre / DR) ──
  cast: {
    make: (win) => ({
      battle: arena(),
      pendingCast: { casterId: 'A', targetId: 'A', spellId: 'drain', missile: false, focused: false, result: { cast: win, roll: win ? 8 : 88, target: 45, sl: win ? 3 : -4, isCritical: false, isFumble: false, log: '' } },
    }),
    // « Succès mais DR < NI → tentative échoue » (`LDB 46 l.23-25`) : le TEST est réussi (8 ≤ 45), le
    // sort n'est pas lancé (`cast: false`). L'issue canonique doit rester celle du TEST.
    composite: () => ({
      battle: arena(),
      pendingCast: { casterId: 'A', targetId: 'A', spellId: 'drain', missile: false, focused: false, result: { cast: false, roll: 8, target: 45, sl: 1, isCritical: false, isFumble: false, log: '' } },
    }),
  },
  focus: { make: (win) => ({
    battle: arena(),
    pendingFocus: { casterId: 'A', spellId: 'drain', result: { dr: win ? 2 : 0, isCritical: false, isFumble: false, roll: win ? 8 : 95, target: 40, sl: win ? 2 : -5, log: '' } },
  }) },
  dispel: { make: (win) => ({ battle: arena(), pendingDispel: { casterId: 'A', value: 40, result: win ? WIN : LOSE } }) },
  // ── Opposés BINAIRES (issue = jet de l'ACTEUR, foe figé) ──
  disengage: { make: (win) => ({ battle: arena(), pendingDisengage: { moverId: 'A', atk: { roll: 40, target: 45, success: true, sl: 1, isDouble: false }, def: win ? WIN : LOSE, result: win ? 'success' : 'fail' } }) },
  auContact: { make: (win) => ({ battle: arena(), pendingAuContact: { moverId: 'A', atk: { roll: 40, target: 45, success: true, sl: 1, isDouble: false }, def: win ? WIN : LOSE, result: win ? 'success' : 'fail' } }) },
  grapple: { make: (win) => ({ battle: arena(), pendingGrapple: { actorId: 'A', atk: { roll: 40, target: 45, success: true, sl: 1, isDouble: false }, def: win ? WIN : LOSE, result: win ? 'success' : 'fail' } }) },
  distraire: { make: (win) => ({ battle: arena(), pendingDistraire: { moverId: 'A', defRoll: { roll: 40, target: 45, success: true, sl: 1, isDouble: false }, atk: win ? WIN : LOSE, result: win ? 'success' : 'fail' } }) },
  // ── Fuir (flux MULTI HÉTÉROGÈNE : slot `backstab` du frappeur 'B' — déjà résolu, il fait perdre des
  //    PB donc le Test de Calme est dû — + slot `calme` du fuyard 'A', celui que la Chance influence) ──
  flee: { pid: 'A', make: (win) => ({
    battle: arena(),
    pendingDisengage: { moverId: 'A', foeId: 'B', fuir: { participants: [
      { id: 'B', kind: 'backstab', interactive: false, result: { hit: true, attackerRoll: 30, netSL: 1, location: 'corps', damage: 4, woundsLost: 4, critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '', attackerDetail: atkDetail(true) } },
      { id: 'A', kind: 'calme', interactive: true, calme: win ? WIN : LOSE },
    ] } },
  }) },
  // ── Manœuvres d'attaquant NON opposées (issue = `result.success`) ──
  battement: { make: (win) => ({ battle: arena(), pendingBattement: { attackerId: 'A', result: win ? WIN : LOSE } }) },
  maneuver: { make: (win) => ({ battle: arena(), pendingManeuver: { attackerId: 'A', kind: 'souffle', result: win ? WIN : LOSE } }) },
  // ── Course / Frénésie / Approche / Bénédiction (Test binaire) ──
  run: { make: (win) => ({ battle: arena(), pendingRun: { combatantId: 'A', result: { success: win, roll: win ? 8 : 95, target: 40, dr: win ? 3 : 0, bonusCases: win ? 1 : 0 } } }) },
  fall: { pid: 'A', make: (win) => ({ battle: arena(), pendingFall: { to: { x: 0, y: 0 }, metres: 4, initiateurId: 'A', participants: [{ id: 'A', interactive: true, attempt: true, result: { success: win, roll: win ? 8 : 95, target: 40, dr: win ? 3 : 0, effectiveMetres: win ? 1 : 4 } }] } }) },
  frenzy: { make: (win) => ({ battle: arena(), pendingFrenzy: { combatantId: 'A', result: win ? WIN : LOSE } }) },
  approach: { make: (win) => ({ battle: arena(), pendingApproach: { combatantId: 'A', result: win ? WIN : LOSE } }) },
  ward: { make: (win) => ({ battle: arena(), pendingWard: { attackerId: 'A', result: win ? WIN : LOSE } }) },
  // ── Tests numériques « jet propre » (soin/rechargement/évaluation/corruption/activité/test) ──
  reload: { make: (win) => ({ battle: arena(), pendingReload: { actorId: 'A', skillValue: 40, difficulty: 'intermediaire', roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }) },
  handGate: { make: (win) => ({ battle: arena(), pendingHandGate: { attackerId: 'A', actorName: 'A', hand: 'main', skillValue: 40, difficulty: 'accessible', roll: win ? 8 : 95, target: 60, sl: win ? 3 : -5, success: win, pa: { attackerId: 'A', targetId: 'B', location: null, result: null }, title: 'Attaque', icon: 'action/attack' } }) },
  heal: { make: (win) => ({ battle: arena(), pendingHeal: { healerId: 'A', mode: 'first-aid', skillValue: 40, difficulty: 'intermediaire', roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }) },
  surgery: { make: (win) => ({ battle: arena(), pendingSurgery: { healerId: 'A', skillValue: 40, difficulty: 'intermediaire', roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }) },
  appraise: { make: (win) => ({ battle: arena(), pendingAppraise: { actorId: 'A', skillValue: 40, difficulty: 'intermediaire', roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }) },
  corruption: { make: (win) => ({ battle: arena(), pendingCorruption: { heroId: 'A', skill: 'calme', roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }) },
  test: {
    make: (win) => ({ battle: arena(), pendingTest: { actorId: 'A', skillValue: 40, difficulty: 'intermediaire', target: 40, requireSL: 0, roll: win ? 8 : 95, sl: win ? 3 : -5, success: win } }),
    // Seuil de DR EXIGÉ manqué (`requireSL`, `meetsRequiredSL`) : le d100 est réussi (8 ≤ 40), l'issue
    // métier ne l'est pas. L'issue canonique doit rester celle du d100 (`LDB 12 l.11`).
    composite: () => ({ battle: arena(), pendingTest: { actorId: 'A', skillValue: 40, difficulty: 'intermediaire', target: 40, requireSL: 3, roll: 8, sl: 1, success: false } }),
  },
  steamSave: { make: (win) => ({ battle: arena(), pendingSteamSave: { actorId: 'A', actorName: 'A', skillValue: 40, difficulty: 'intermediaire', target: 40, scaldOps: [{ op: 'wounds', amount: 1, ignoreAP: true }], roll: win ? 8 : 95, sl: win ? 3 : -5, success: win } }) },
  activity: { make: (win) => ({ battle: arena(), pendingActivity: { heroId: 'A', kind: 'catalog', label: 'x', skillLabel: 'x', skillValue: 40, difficulty: 'intermediaire', mod: 0, roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }) },
  shanty: { make: (win) => ({ battle: arena(), pendingShanty: { singerId: 'A', shantyId: 'x', result: win ? WIN : LOSE } }) },
  // ── Opposés « joueur vs figé » avec re-résolution dédiée (récupération / marchandage) ──
  recover: { make: (win) => ({ battle: arena(), pendingStateRecovery: { actorId: 'A', skillValue: 40, difficulty: 'intermediaire', opposed: false, roll: win ? WIN : LOSE, netSL: win ? 3 : 0, success: win } }) },
  bargain: { make: (win) => ({ battle: arena(), pendingBargain: { playerId: 'A', playerSkill: 40, merchantValue: 40, roll: win ? WIN : LOSE, merchantRoll: { roll: 50, target: 40, success: false, sl: -1, isDouble: false }, result: { winner: win ? 'attacker' : 'defender', attackerWins: win, netSL: win ? 2 : -2 } } }) },
  // ── MULTI (participant/round/étape « A ») ──
  counterspell: { pid: 'A', make: (win) => ({
    battle: arena(),
    pendingCast: { casterId: 'B', targetId: 'A', spellId: 'drain', missile: false, focused: false, result: { cast: true, roll: 20, target: 45, sl: 2, isCritical: false, isFumble: false, log: '' } },
    pendingCounterspell: { participants: [{ id: 'A', interactive: true, declared: 'solo', result: { counter: win ? WIN : LOSE, dispelled: win, margin: win ? 1 : -1 } }] },
  }) },
  opposition: { pid: 'A', make: (win) => ({
    battle: arena(),
    pendingCast: { casterId: 'B', targetId: 'A', spellId: 'drain', missile: false, focused: false, result: { cast: true, roll: 20, target: 45, sl: 2, isCritical: false, isFumble: false, log: '' } },
    pendingCastOpposition: { kind: 'resist', char: 'force-mentale', participants: [{ id: 'A', interactive: true, result: { oppose: win ? WIN : LOSE, resisted: win, margin: win ? 0 : 2 } }] },
  }) },
  cascade: { pid: 'st1', make: (win) => ({
    battle: arena(),
    pendingCascade: { purpose: 'combat', cursor: 0, participants: [{ id: 'st1', actorId: 'A', target: 40, result: { roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }] },
  }) },
  extendedTest: { pid: 'r1', make: (win) => ({
    battle: arena(),
    pendingExtendedTest: { actorId: 'A', label: 'x', skillLabel: 'x', target: 40, targetDR: 5, total: 0, rounds: [{ id: 'r1', result: { roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }] },
  }) },
  forceDoor: { pid: 'A', make: (win) => ({
    battle: arena(),
    pendingForceDoor: { label: 'Porte', doorBE: 2, doorB: 6, doorBmax: 6, participants: [{ id: 'A', result: { roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, damage: win ? 4 : 0 } }] },
  }) },
  // Rangée de BANDE (étape batch de cascade) : issue MULTI-VALEURS — le d100 propre et le verdict
  // divergent dès que l'étape est OPPOSÉE (`meta.opposed`), où `success` vient de `resolveOpposed`.
  // La fixture est donc opposante : le dé 8 est SOUS la cible et pourtant PERDANT (l'attaquant figé
  // l'emporte au DR), exactement le cas où une issue dérivée du d100 mentirait à la Chance.
  cascadeBatch: { pid: 'A', make: (win) => ({
    battle: arena(),
    pendingCascade: { purpose: 'combat', cursor: 0, participants: [{
      id: 'b1', kind: 'triggeredBatchTest', aggregate: 'none',
      meta: { opposed: { aT: { roll: 20, target: 60, success: true, sl: 4, isDouble: false, base: 60 } } },
      participants: [{ id: 'A', interactive: true, base: 40, target: 40, result: { roll: 8, target: 40, sl: win ? 9 : 1, success: win } }],
    }] },
  }) },
};

/** Flux NON couverts par une fixture minimale — justifiés (leur `outcome` est trivial + partagé). */
const SKIP: Record<string, string> = {
  etalLot: 'Lot de dés d’étal (#1426) — le flux n’a NI Chance NI Résilience (`verbs: [setForcedRoll]`) : il n’y a pas d’issue à gater. Un dé d’étal ne réussit ni n’échoue, il tombe ; son `outcome` est scellé neutre sur sa valeur, et `failed` n’a aucun consommateur.',
  shipManeuver: 'Test d’équipage par rôle (MDG 14) — fixture de rôle valide lourde ; `outcome` = `cleanRollOutcome` partagé (crewRoleFlowSpec), déjà exercé par la logique numérique de forceDoor',
  shipBattery: 'idem shipManeuver (MÊME crewRoleFlowSpec)',
  crewTest: 'idem shipManeuver (MÊME crewRoleFlowSpec)',
};

beforeEach(() => {
  useGame.setState({ battle: null, scene: null } as never);
});

describe('Issue canonique (outcome) — la Chance est gatée par l’issue RÉELLE (failed dérivé == won)', () => {
  // Les 11 flux « à risque » (issues multi-valeurs : combiné/opposé/DR/jet-propre-vs-issue) DOIVENT être couverts.
  const REQUIRED = ['activity', 'attack', 'defense', 'cast', 'counterspell', 'opposition', 'recover', 'bargain', 'disengage', 'flee', 'focus', 'cascadeBatch'];
  it('couvre tous les flux à risque (multi-valeurs)', () => {
    const missing = REQUIRED.filter((p) => !(p in FIXTURES));
    expect(missing, 'flux à risque sans fixture').toEqual([]);
  });

  it('chaque flux de FLOW_VERBS est couvert par une fixture OU justifié dans SKIP', () => {
    const uncovered = Object.keys(FLOW_VERBS).filter((p) => !(p in FIXTURES) && !(p in SKIP));
    expect(uncovered, 'flux ni couvert ni justifié').toEqual([]);
  });

  for (const prefix of Object.keys(FLOW_VERBS)) {
    const fx = FIXTURES[prefix];
    if (!fx) {
      it.skip(`${prefix} — non piloté (${SKIP[prefix] ?? 'à couvrir'})`, () => {});
      continue;
    }
    const rerollFn = `${prefix}Reroll`;
    it(`${prefix} : reroll DISPONIBLE sur un perdant, NO-OP sur un gagnant`, () => {
      // (a) PERDANT → outcome.won=false → failed=true → la Chance se dépense.
      seedBattleRng(9);
      useGame.setState({ battle: null } as never);
      useGame.setState(fx.make(false) as never);
      (useGame.getState() as unknown as Record<string, (pid?: string) => void>)[rerollFn](fx.pid);
      expect(fortuneOfA(), `${prefix} perdant : la relance de Chance doit être DISPONIBLE (1 Point dépensé)`).toBe(0);

      // (b) GAGNANT → outcome.won=true → failed=false → aucune relance possible (no-op).
      seedBattleRng(9);
      useGame.setState({ battle: null } as never);
      useGame.setState(fx.make(true) as never);
      (useGame.getState() as unknown as Record<string, (pid?: string) => void>)[rerollFn](fx.pid);
      expect(fortuneOfA(), `${prefix} gagnant : la relance de Chance doit être un NO-OP (Point conservé)`).toBe(1);
    });
  }
});

/**
 * VOLET STRUCTUREL (#1318 V4) — « le ✓/✗ POSÉ SUR LA LIGNE ⇔ `spec.outcome(slot).won` ».
 *
 * Pourquoi il fallait un second volet : le volet comportemental ci-dessus prouve que le SEAM gate la
 * Chance sur son issue canonique. Il ne dit rien de ce que la MODALE imprime. Or la coquille dérive
 * désormais sa fenêtre du succès de la LIGNE (`row.d.success`) : si une modale y pose une issue
 * COMPOSÉE là où le seam lit le d100 propre, le bouton s'affiche et le verbe est INERTE — la classe
 * exacte qu'on vient de tuer (mesurée sur `cast`, qui posait `res.cast`, et sur `test`, qui posait
 * `success && meetsRequiredSL`).
 *
 * La mesure est possible parce que `TestOutcome` porte le VERDICT **et les chiffres qui le fondent** :
 * `outcomeOf()` rend `{won, roll, target}`. Une ligne ne peut être à la fois VRAIE (elle imprime
 * `roll` et `target`) et alignée sur le seam si `won` contredit `roll ≤ target`. On mesure donc
 * l'issue de CHAQUE flux sur ses deux fixtures, sans aucune valeur attendue écrite à la main.
 *
 * Les flux dont l'issue est légitimement COMPOSÉE (Test OPPOSÉ : le verdict n'est pas le d100 propre)
 * sont DÉCLARÉS ci-dessous. Pour ceux-là le contrat s'inverse : la ligne DOIT poster le verdict
 * composé, faute de quoi la coquille rouvrirait la Chance là où le seam la refuse.
 */
const ISSUE_COMPOSEE: Record<string, string> = {
  cascadeBatch: 'Étape de BANDE opposée (`meta.opposed`) : le verdict vient de `resolveOpposed` — un d100 '
    + 'SOUS la cible peut perdre au DR (LDB 12 l.160). `CascadeModal` poste bien `result.success` (le '
    + 'verdict composé) sur la ligne, donc coquille et seam restent alignés.',
};

describe('#1318 V4 — l’issue canonique est COHÉRENTE avec les chiffres qu’elle porte', () => {
  it('aucun flux ne déclare une issue COMPOSÉE sans justification', () => {
    const inconnus = Object.keys(ISSUE_COMPOSEE).filter((p) => !(p in FIXTURES));
    expect(inconnus, 'exception d’issue composée sans fixture — périmée ?').toEqual([]);
  });

  for (const prefix of Object.keys(FLOW_VERBS)) {
    const fx = FIXTURES[prefix];
    if (!fx) continue;
    it(`${prefix} : outcome.won == (roll ≤ cible), issues nominales${fx.composite ? ' + composée' : ''}`, () => {
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
        useGame.setState({ battle: null } as never);
        useGame.setState(state as never);
        const o = FLOW_HANDLERS[prefix as keyof typeof FLOW_HANDLERS].outcomeOf(useGame.getState, fx.pid);
        expect(o, `${prefix} : l’issue canonique doit être lisible sur un pending ouvert`).not.toBeNull();
        const propre = o!.roll <= o!.target;
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
