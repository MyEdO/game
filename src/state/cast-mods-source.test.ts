import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { resolveCasting, resolveCounterspell, resolveFocus, castingValue, castTestOf, castTestDRMods } from '../engine/magic';
import type { SpellLike } from '../engine/magic';
import { setRule, resetRule } from '../engine/policy';
import { evaluateTest } from '../engine/tests';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { findSpellById } from '../data/index';
import type { Combatant } from '../engine/types';
import { objetDeTest } from '../engine/objetDeTest.testkit';

/**
 * UNE source de modificateurs pour les Tests de la famille Incantation (`castTestDRMods`) — à DÉ
 * ÉGAL, les TROIS voies d'un même jet rendent le MÊME DR :
 *   1. dé NATUREL (d100 du moteur) ;
 *   2. dé SAISI (option de confort « Dés fixés ») ;
 *   3. dé de RÉSILIENCE (LDB 17 l.68 : « au lieu de lancer les dés pour un Test, vous choisissez le
 *      résultat »), au-dessus de son plancher.
 * Mesuré sur les DEUX Tests de la famille, dont la PORTÉE diffère :
 *   - incantation (LDB 46 l.22-24 : « Pour lancer un Sort, effectuez un Test de Langue (Magick) ») —
 *     Talent lié (LDB 10 l.19) ET armure « Repousser les Vents » (LDB 46 l.150 : « tout Lanceur de
 *     Sorts portant une armure subit une pénalité de -1 DR à tous ses Tests d'Incantation et de
 *     Focalisation, pour chaque PA sur la Localisation la mieux protégée du corps ») ;
 *   - Contre-sort (LDB 46 l.156 : « Effectuez un Test opposé de Langue (Magick) ») — Talent lié
 *     SEUL : l'armure ne porte pas hors des Tests d'Incantation et de Focalisation (l.150 · l.22-24).
 */
const PA = 2;
/** Diction instinctive ×1 : « +1 DR pour toute utilisation réussie de la Compétence liée au Talent »
 *  (LDB 10 l.19) — la Compétence liée est Langue (Magick), celle des DEUX Tests. */
const TALENT = 1;
/** Dé COMMUN aux trois voies : `bestForcedRoll` rend 01 en policy standard, seule valeur que la voie
 *  Résilience choisit d'elle-même. */
const DE = 1;
/** Incantation ENNEMIE figée — DR 0 : le plancher du Test opposé (`castT.sl + 1` = 1) ne masque pas
 *  le DR mesuré. */
const ENEMY_CAST = { cast: true, roll: 20, target: 50, sl: 0, isCritical: false, isFumble: false, log: '' };
/** Sort du lanceur : NI 0 (`flechette`) — le plancher « le Sort PART » de la Résilience ne masque pas
 *  le DR mesuré non plus. */
const SPELL_ID = 'flechette';
/** RNG qui ne rend que le dé COMMUN — les voies naturelles se mesurent sur le même d100 que les deux autres. */
const RNG_DE = { int: () => DE };

const mk = (id: string, kind: Combatant['kind'] = 'hero'): Combatant => ({
  id, name: id, label: id, kind,
  characteristics: { force: 40, dexterite: 40, agilite: 40, endurance: 40, 'force-mentale': 40, 'capacite-de-combat': 45, 'capacite-de-tir': 45, initiative: 40, intelligence: 40, sociabilite: 40 },
  wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], traumas: [],
  resilience: 3, fortune: 2, weapons: [],
  items: [objetDeTest({ uid: 'a1', trappingId: 'plastron', kind: 'armor', equipped: true, pa: PA, locs: ['corps'] })],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  skills: [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 1 }],
  talents: [{ talentId: 'diction-instinctive', times: TALENT }],
  movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
} as unknown as Combatant);

const st = () => useGame.getState() as unknown as Record<string, (...a: unknown[]) => void>;
const P = <T,>(k: string): T => (useGame.getState() as unknown as Record<string, T>)[k];
const counterOf = () => P<{ participants: { result: { counter: { roll: number; sl: number } } }[] }>('pendingCounterspell').participants[0].result.counter;
const castOf = () => P<{ result: { roll: number; sl: number } }>('pendingCast').result;

let VALEUR = 0;
/** DR du dé COMMUN sans aucun modificateur (ce que rendrait une voie DÉBRANCHÉE de la source). */
let DR_NU = 0;
/** DR attendu des trois voies du CONTRE-SORT : Talent lié seul. */
let DR_DISSIPATION = 0;
/** DR attendu des trois voies de l'INCANTATION : Talent lié et armure. */
let DR_INCANTATION = 0;

const openCounterspell = (result?: unknown) => useGame.setState({
  pendingCast: { casterId: 'E', targetId: 'A', spellId: SPELL_ID, missile: false, focused: false, result: ENEMY_CAST },
  pendingCounterspell: { participants: [{ id: 'A', interactive: true, declared: 'solo', ...(result ? { result } : {}) }] },
} as never);

const openCast = (roll: number, target: number) => useGame.setState({
  pendingCounterspell: null,
  pendingCast: {
    casterId: 'A', targetId: 'E', spellId: SPELL_ID, missile: false, focused: false,
    result: { cast: false, roll, target, sl: evaluateTest(roll, target).sl, isCritical: false, isFumble: false, log: '' },
  },
} as never);

beforeEach(() => {
  const A = mk('A'), E = mk('E', 'enemy');
  useGame.setState({
    party: [A],
    battle: { combatants: [A, E], log: [], order: ['A', 'E'], turn: 0, round: 1 } as never,
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
    pendingCast: null, pendingCounterspell: null, pendingCastOpposition: null,
  } as never);
  VALEUR = castingValue(A, 'langue', 'magick');
  DR_NU = evaluateTest(DE, VALEUR).sl;
  DR_DISSIPATION = DR_NU + TALENT;
  DR_INCANTATION = DR_NU + TALENT - PA;
  setDesFixes(true);
});
afterEach(() => resetDesFixes());

describe('modificateurs d’un Test d’incantation — une source, trois voies (#948)', () => {
  it('les DR attendus sont discernables du DR nu ET de tout plancher', () => {
    expect(DR_NU, 'le dé commun ne porte aucun DR à modifier').toBeGreaterThan(0);
    expect(DR_DISSIPATION, 'contre-sort : DR attendu confondu avec le DR nu (modificateur inerte)').not.toBe(DR_NU);
    expect(DR_INCANTATION, 'incantation : DR attendu confondu avec le DR nu (modificateur inerte)').not.toBe(DR_NU);
    expect(DR_INCANTATION, 'les deux portées rendent le même DR (l’écart d’armure ne se mesure pas)').not.toBe(DR_DISSIPATION);
    expect(DR_DISSIPATION, 'contre-sort : le DR attendu ne dépasse pas le plancher du Test opposé — il serait mesuré au plancher').toBeGreaterThan(ENEMY_CAST.sl + 1);
    expect(DR_INCANTATION, 'incantation : le DR attendu n’atteint pas le NI du Sort — il serait mesuré au plancher « le Sort PART »').toBeGreaterThanOrEqual(findSpellById(SPELL_ID)!.cn ?? 0);
  });

  // ---- Contre-sort (LDB 46 l.156) : Talent lié SEUL, pas d'armure -------------------------------
  it('contre-sort — voie 1 : le dé NATUREL passe par la source', () => {
    const A = useGame.getState().party[0];
    const out = resolveCounterspell(A, castTestOf(ENEMY_CAST), RNG_DE);
    expect(out.counter.roll).toBe(DE);
    expect(out.counter.sl, 'jet naturel : DR autre que le Talent lié seul').toBe(DR_DISSIPATION);
  });

  it('contre-sort — voie 1 (store) : un jet RNG quelconque porte les mêmes modificateurs', () => {
    seedBattleRng(12345);
    openCounterspell();
    st().counterspellRoll('A');
    const c = counterOf();
    const nu = evaluateTest(c.roll, VALEUR).sl;
    expect(c.sl, 'jet du store : DR autre que le Talent lié seul').toBe(c.roll <= VALEUR ? nu + TALENT : nu);
  });

  it('contre-sort — voie 2 : le dé SAISI passe par la source', () => {
    openCounterspell({ dispelled: false, counter: { roll: 88, target: VALEUR, sl: -4, success: false, isDouble: true }, casterNetSL: 4, log: '' });
    st().counterspellSetForcedRoll('A', DE);
    const c = counterOf();
    expect(c.roll).toBe(DE);
    expect(c.sl, 'dé fixé : DR autre que le Talent lié seul').toBe(DR_DISSIPATION);
  });

  it('contre-sort — voie 3 : la RÉSILIENCE passe par la source (dé par défaut, puis dé choisi)', () => {
    openCounterspell();
    st().counterspellForceSuccess('A');
    const c = counterOf();
    expect(c.roll, 'la Résilience n’a pas pris son dé par défaut').toBe(DE);
    expect(c.sl, 'Résilience : DR autre que le Talent lié seul').toBe(DR_DISSIPATION);

    st().counterspellSetForcedRoll('A', DE);
    expect(counterOf().sl, 'Résilience + dé choisi : DR autre que le Talent lié seul').toBe(DR_DISSIPATION);
  });

  // ---- Incantation du lanceur (LDB 46 l.22-24) : Talent lié ET armure ---------------------------
  it('incantation — voie 1 : le dé NATUREL passe par la source', () => {
    const A = useGame.getState().party[0];
    const res = resolveCasting(A, findSpellById(SPELL_ID)!, RNG_DE);
    expect(res.roll).toBe(DE);
    expect(res.sl, 'jet naturel : DR autre que Talent lié et armure').toBe(DR_INCANTATION);
  });

  it('incantation — voie 2 : le dé SAISI passe par la source', () => {
    openCast(88, VALEUR);
    st().castSetForcedRoll(DE);
    const r = castOf();
    expect(r.roll).toBe(DE);
    expect(r.sl, 'dé fixé : DR autre que Talent lié et armure').toBe(DR_INCANTATION);
  });

  it('incantation — voie 3 : la RÉSILIENCE passe par la source (dé par défaut, puis dé choisi)', () => {
    openCast(88, VALEUR);
    st().castForceSuccess();
    const r = castOf();
    expect(r.roll, 'la Résilience n’a pas pris son dé par défaut').toBe(DE);
    expect(r.sl, 'Résilience : DR autre que Talent lié et armure').toBe(DR_INCANTATION);

    st().castSetForcedRoll(DE);
    expect(castOf().sl, 'Résilience + dé choisi : DR autre que Talent lié et armure').toBe(DR_INCANTATION);
  });
});

/**
 * GATES par COMPOSANTE de la source unique — chaque famille de modificateur est mesurée SEULE
 * (les autres à zéro), sur les trois `kind`, avec son contrôle POSITIF non nul : une composante
 * silencieusement débranchée, ou branchée sur le mauvais `kind`, tombe ici.
 */
const SORT = (domainId: string): SpellLike => ({ id: 's', label: 'S', ecole: 'Magie des Arcanes', family: 'arcane', domainId, cn: 0, desc: '' });
const mage = (over: Record<string, unknown>) => ({ ...(mk('M') as unknown as Record<string, unknown>), ...over } as unknown as Combatant);
/** Aucun modificateur porté : isole la composante fournie par le CONTEXTE (mer, vent, lieu). */
const NU = () => mage({ items: [], talents: [] });
/** Armure seule (PA 2), aucun Talent. */
const ARME = () => mage({ talents: [] });
/** Diction instinctive ×2 (Langue (Magick)), sans armure. */
const DICTION = () => mage({ items: [], talents: [{ talentId: 'diction-instinctive', times: 2 }] });
/** Harmonisation aethyrique ×2 (Focalisation), sans armure. */
const HARMO = () => mage({ items: [], talents: [{ talentId: 'harmonisation-aethyrique', times: 2 }] });
const TEMPETE = { atSea: true, wind: 'violente-tempete' };
/** Pierre gardienne d'atténuation (VDM 14 l.167) : −2 DR d'Incantation, +2 DR de Dissipation. */
const ATTENUATION = { phenomena: [{ id: 'pierre-gardienne-attenuation' }] };

describe('castTestDRMods — gates par composante (#948)', () => {
  afterEach(() => resetRule('magic-vdm-environnementale'));

  it('armure (LDB 46 l.150) : INCONDITIONNELLE en Incantation et Focalisation, ABSENTE en Dissipation', () => {
    expect(castTestDRMods(ARME(), 'incantation', { spell: SORT('feu'), success: false }), 'armure gatée sur la réussite en Incantation').toBe(-PA);
    expect(castTestDRMods(ARME(), 'focalisation', { spell: SORT('feu'), success: false }), 'armure absente de la Focalisation (l.150 la nomme)').toBe(-PA);
    expect(castTestDRMods(ARME(), 'dissipation', {}), 'armure appliquée au Contre-sort (l.22-24 · l.156)').toBe(0);
    expect(castTestDRMods(ARME(), 'dissipation', { success: false }), 'armure appliquée au Contre-sort raté').toBe(0);
  });

  it('Talent lié (LDB 10 l.19) : indexé sur la COMPÉTENCE du kind, et gaté sur la RÉUSSITE', () => {
    expect(castTestDRMods(DICTION(), 'incantation', { spell: SORT('feu') }), 'Diction instinctive ×2 muette au Test de Langue (Magick)').toBe(2);
    expect(castTestDRMods(DICTION(), 'dissipation', {}), 'Diction instinctive ×2 muette au Contre-sort (même Compétence)').toBe(2);
    expect(castTestDRMods(DICTION(), 'focalisation', { spell: SORT('feu') }), 'un Talent de Langue (Magick) fuit vers la Focalisation').toBe(0);
    expect(castTestDRMods(HARMO(), 'focalisation', { spell: SORT('feu') }), 'Harmonisation aethyrique ×2 muette au Test de Focalisation').toBe(2);
    expect(castTestDRMods(HARMO(), 'incantation', { spell: SORT('feu') }), 'un Talent de Focalisation fuit vers l’Incantation').toBe(0);
    expect(castTestDRMods(DICTION(), 'incantation', { spell: SORT('feu'), success: false }), 'Talent appliqué à un Test RATÉ').toBe(0);
    expect(castTestDRMods(DICTION(), 'dissipation', { success: false }), 'Talent appliqué à un Contre-sort RATÉ').toBe(0);
  });

  it('mer (MDG 02 l.178-186) : le kind choisit la VARIANTE, la Dissipation n’en a aucune', () => {
    expect(castTestDRMods(NU(), 'incantation', { spell: SORT('cieux'), sea: TEMPETE }), 'Cieux en Violente tempête : +1 DR d’Incantation muet').toBe(1);
    expect(castTestDRMods(NU(), 'focalisation', { spell: SORT('cieux'), sea: TEMPETE }), 'la variante d’Incantation fuit vers la Focalisation').toBe(0);
    expect(castTestDRMods(NU(), 'focalisation', { spell: SORT('feu'), sea: TEMPETE }), 'Feu en mer : −1 DR de Focalisation muet').toBe(-1);
    expect(castTestDRMods(NU(), 'incantation', { spell: SORT('feu'), sea: TEMPETE }), 'la variante de Focalisation fuit vers l’Incantation').toBe(0);
    expect(castTestDRMods(NU(), 'incantation', { spell: SORT('cieux'), sea: { atSea: false, wind: 'violente-tempete' } }), 'modificateur de mer appliqué à TERRE').toBe(0);
    expect(castTestDRMods(NU(), 'incantation', { spell: SORT('cieux'), sea: TEMPETE, success: false }), 'modificateur de mer appliqué à un Test RATÉ').toBe(0);
    expect(castTestDRMods(NU(), 'dissipation', { spell: SORT('cieux'), sea: TEMPETE }), 'le Contre-sort a hérité du Domaine d’un Sort').toBe(0);
  });

  it('vent du Domaine (VDM 04 l.50) : Incantation ET Focalisation, jamais la Dissipation', () => {
    expect(castTestDRMods(NU(), 'incantation', { spell: SORT('lumiere') }), 'Hysh : −1 DR d’Incantation muet').toBe(-1);
    expect(castTestDRMods(NU(), 'focalisation', { spell: SORT('lumiere') }), 'Hysh : −1 DR de Focalisation muet').toBe(-1);
    expect(castTestDRMods(NU(), 'dissipation', { spell: SORT('lumiere') }), 'le Contre-sort a hérité du Vent d’un Sort').toBe(0);
    expect(castTestDRMods(NU(), 'incantation', { spell: SORT('lumiere'), success: false }), 'vent du Domaine appliqué à un Test RATÉ').toBe(0);
  });

  it('lieu (VDM 14 l.167) : chaque kind lit SA clé, sous l’option et sur la réussite', () => {
    setRule('magic-vdm-environnementale', true);
    expect(castTestDRMods(NU(), 'incantation', { spell: SORT('feu'), env: ATTENUATION }), 'Atténuation : −2 DR d’Incantation muet').toBe(-2);
    expect(castTestDRMods(NU(), 'dissipation', { env: ATTENUATION }), 'Atténuation : +2 DR de Dissipation muet').toBe(2);
    expect(castTestDRMods(NU(), 'focalisation', { spell: SORT('feu'), env: ATTENUATION }), 'la clé d’Incantation fuit vers la Focalisation').toBe(0);
    expect(castTestDRMods(NU(), 'dissipation', { env: ATTENUATION, success: false }), 'modificateur de lieu appliqué à un Test RATÉ').toBe(0);
    resetRule('magic-vdm-environnementale');
    expect(castTestDRMods(NU(), 'dissipation', { env: ATTENUATION }), 'option désactivée : le lieu modifie quand même le Test').toBe(0);
  });
});

/**
 * TROIS VOIES × DEUX NIVEAUX D'ARMURE, sur le chemin RÉEL du store — la portée arbitrée de l'armure
 * (LDB 46 l.150 · l.22-24 · l.156 : Incantation et Focalisation OUI, Contre-sort NON) se mesure ici
 * par la DIFFÉRENCE entre PA 0 et PA 2, sur chacune des trois voies. Une voie qui n'appliquerait pas
 * la source rendrait le même DR aux deux niveaux (Incantation/Focalisation) ou un DR différent
 * (Contre-sort).
 */
const PAS = [0, 2] as const;
/** Sort de Focalisation : Domaine Bête (`bete`), NI 3 — le sorcier possède Focalisation (bete). */
const FOCUS_SPELL = 'langue-bestiale';
const FOCUS_TARGET = 41;

const focalisateur = (pa: number) => ({
  ...(mk('A') as unknown as Record<string, unknown>),
  items: pa ? [objetDeTest({ uid: 'a1', trappingId: 'plastron', kind: 'armor', equipped: true, pa, locs: ['corps'] })] : [],
  skills: [{ id: 'focalisation', spec: 'bete', characteristic: 'force-mentale', advances: 1 }],
  talents: [{ talentId: 'harmonisation-aethyrique', times: 1 }],
} as unknown as Combatant);

const lanceur = (pa: number) => ({
  ...(mk('A') as unknown as Record<string, unknown>),
  items: pa ? [objetDeTest({ uid: 'a1', trappingId: 'plastron', kind: 'armor', equipped: true, pa, locs: ['corps'] })] : [],
} as unknown as Combatant);

const poser = (hero: Combatant, extra: Record<string, unknown> = {}) => useGame.setState({
  party: [hero],
  battle: { combatants: [hero, mk('E', 'enemy')], log: [], order: ['A', 'E'], turn: 0, round: 1 } as never,
  net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
  pendingCast: null, pendingCounterspell: null, pendingCastOpposition: null, pendingFocus: null,
  ...extra,
} as never);

const focusOf = () => P<{ result: { roll: number; dr: number } }>('pendingFocus').result;
const openFocus = () => useGame.setState({
  pendingFocus: { casterId: 'A', spellId: FOCUS_SPELL, result: { dr: 0, isCritical: false, isFumble: false, roll: 88, target: FOCUS_TARGET, sl: -4, log: '' } },
} as never);

describe('Focalisation — trois voies, même DR à dé égal (#948)', () => {
  for (const pa of PAS) {
    it(`PA ${pa} : dé naturel === dé saisi === Résilience`, () => {
      const hero = focalisateur(pa);
      poser(hero);
      setDesFixes(true);
      // Voie 1 — jet NATUREL du moteur (celui que `FLOWS.focus.resolve` appelle), dé 01.
      const naturel = resolveFocus(hero, findSpellById(FOCUS_SPELL)!, RNG_DE).dr;

      // Voie 2 — dé SAISI (option « Dés fixés »).
      openFocus();
      st().focusSetForcedRoll(DE);
      const saisi = focusOf();
      expect(saisi.roll, 'le dé saisi n’est pas celui appliqué').toBe(DE);

      // Voie 3 — RÉSILIENCE (dé par défaut = le meilleur, 01 en policy standard).
      poser(hero); openFocus();
      st().focusForceSuccess();
      const resil = focusOf();
      expect(resil.roll, 'la Résilience n’a pas pris son dé par défaut').toBe(DE);

      expect(saisi.dr, `dé saisi : DR hors de la source (naturel ${naturel})`).toBe(naturel);
      expect(resil.dr, `Résilience : DR hors de la source (naturel ${naturel})`).toBe(naturel);
      resetDesFixes();
    });
  }

  it('l’armure fait bien BOUGER le DR de Focalisation (contrôle positif de la mesure)', () => {
    const drDe = (pa: number) => resolveFocus(focalisateur(pa), findSpellById(FOCUS_SPELL)!, RNG_DE).dr;
    expect(drDe(0) - drDe(2), 'armure inerte en Focalisation : les deux PA ne se distinguent pas (LDB 46 l.150)').toBe(2);
  });
});

/**
 * PORTÉE de l'armure sur les TROIS voies, Contre-sort ET incantation (#948, cf. `castTestDRMods`,
 * `engine/magic.ts`) : à dé égal, PA 0 et PA 2 rendent le MÊME DR de Contre-sort (l'armure n'y
 * porte pas, LDB 46 l.150 · l.22-24 · l.156) et un DR d'Incantation qui DIFFÈRE de 2 (elle y porte).
 */
describe('portée de l’armure — trois voies × PA 0/2 (#948)', () => {
  afterEach(() => resetDesFixes());

  const csDR = (pa: number) => {
    const hero = lanceur(pa);
    const castT = castTestOf(ENEMY_CAST);
    // Voie 1 — jet naturel du moteur (celui de `FLOWS.counterspell.resolve`).
    const naturel = resolveCounterspell(hero, castT, RNG_DE).counter.sl;
    // Voie 2 — dé saisi.
    poser(hero, { pendingCast: { casterId: 'E', targetId: 'A', spellId: SPELL_ID, missile: false, focused: false, result: ENEMY_CAST },
      pendingCounterspell: { participants: [{ id: 'A', interactive: true, declared: 'solo', result: { dispelled: false, counter: { roll: 88, target: castingValue(hero, 'langue', 'magick'), sl: -4, success: false, isDouble: true }, casterNetSL: 4, log: '' } }] } });
    setDesFixes(true);
    st().counterspellSetForcedRoll('A', DE);
    const saisi = counterOf().sl;
    // Voie 3 — Résilience.
    poser(hero, { pendingCast: { casterId: 'E', targetId: 'A', spellId: SPELL_ID, missile: false, focused: false, result: ENEMY_CAST },
      pendingCounterspell: { participants: [{ id: 'A', interactive: true, declared: 'solo' }] } });
    st().counterspellForceSuccess('A');
    const resil = counterOf().sl;
    return { naturel, saisi, resil };
  };

  const incDR = (pa: number) => {
    const hero = lanceur(pa);
    const cible = castingValue(hero, 'langue', 'magick');
    const naturel = resolveCasting(hero, findSpellById(SPELL_ID)!, RNG_DE).sl;
    const pending = { casterId: 'A', targetId: 'E', spellId: SPELL_ID, missile: false, focused: false,
      result: { cast: false, roll: 88, target: cible, sl: evaluateTest(88, cible).sl, isCritical: false, isFumble: false, log: '' } };
    poser(hero, { pendingCast: pending });
    setDesFixes(true);
    st().castSetForcedRoll(DE);
    const saisi = castOf().sl;
    poser(hero, { pendingCast: pending });
    st().castForceSuccess();
    const resil = castOf().sl;
    return { naturel, saisi, resil };
  };

  it('contre-sort : les trois voies s’accordent, et l’armure ne change RIEN (PA 0 === PA 2)', () => {
    const a = csDR(0), b = csDR(2);
    expect(a.saisi, 'PA 0 — dé saisi hors de la source').toBe(a.naturel);
    expect(a.resil, 'PA 0 — Résilience hors de la source').toBe(a.naturel);
    expect(b.saisi, 'PA 2 — dé saisi hors de la source').toBe(b.naturel);
    expect(b.resil, 'PA 2 — Résilience hors de la source').toBe(b.naturel);
    expect(b.naturel, 'l’armure pénalise le Contre-sort (LDB 46 l.150 ne vise que l’Incantation et la Focalisation)').toBe(a.naturel);
  });

  it('incantation : les trois voies s’accordent, et l’armure retire bien 2 DR (PA 0 − PA 2 = 2)', () => {
    const a = incDR(0), b = incDR(2);
    expect(a.saisi, 'PA 0 — dé saisi hors de la source').toBe(a.naturel);
    expect(a.resil, 'PA 0 — Résilience hors de la source').toBe(a.naturel);
    expect(b.saisi, 'PA 2 — dé saisi hors de la source').toBe(b.naturel);
    expect(b.resil, 'PA 2 — Résilience hors de la source').toBe(b.naturel);
    expect(a.naturel - b.naturel, 'armure inerte à l’Incantation (LDB 46 l.150)').toBe(2);
  });
});
