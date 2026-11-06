/**
 * Inversion de Test (LDB 12 l.42) sur les flux du lot I2 : chaque source ne s'offre que sur les Tests que
 * son passage vise. Studieux LDB 11 l.55, Lecture rapide LDB 10 l.634, Sociable LDB 11 l.25, Entraînement
 * au Combat LDB 23 l.209, Battement LDB 10 l.103, À sang-froid LDB 85 l.13, Mécénat ACE 12 l.60-62.
 */
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { cascadeDeTest } from './cascade.testkit';
import { cleDeFixture } from './noyau.testkit';
import { FLOWS } from './rollFlowSpecs';
import { initialNet } from './etat';
import { emptyScene } from './monde/scene';
import { appliquerLIntentionDUnSiege } from './intentionsDeSiege';
import { openSkillTest } from './combatEffects';
import { applyOps, type GameOp } from '../engine/ops';
import { activityById } from '../engine/activities';
import { unarmedWeapon } from '../engine/items';
import { makeRNG } from '../engine/dice';
import { hydrateTR } from '../engine/tests';
import { EMPTY_FLOW } from '../engine/flowCore';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import type { Combatant } from '../engine/types';
import type { BatchParticipant, PendingExtendedTest, PendingTest } from './pendings';
import type { PendingActivity } from './interludeFlow';

const CHARS = { force: 40, dexterite: 40, agilite: 40, endurance: 40, 'force-mentale': 55, 'capacite-de-combat': 45, 'capacite-de-tir': 45, initiative: 40, intelligence: 40, sociabilite: 40 };
const heros = (id: string, over: Partial<Combatant> = {}): Combatant => blessuresSurLeProfil({
  id, name: id, label: id, kind: 'hero', characteristics: { ...CHARS }, wounds: blessuresDeBase(10), advantage: 0,
  conditions: [], traumas: [], resilience: 0, fortune: 0, weapons: [unarmedWeapon()], items: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, skills: [], talents: [], movement: 4,
  bodyShape: 'humanoide', pos: { x: 0, y: 0 }, ...over,
}) as unknown as Combatant;
const talent = (id: string) => ({ talents: [{ talentId: id, times: 1 }] } as Partial<Combatant>);
const jeton = (c: Combatant, op: Omit<Extract<GameOp, { op: 'grantReverseToken' }>, 'op'>): Combatant => {
  applyOps(c, [{ op: 'grantReverseToken', ...op }], { rng: makeRNG(1), label: 'Source' });
  return c;
};
const jetons = (c: Combatant) => (c.activeEffects ?? []).filter((e) => e.reverseToken);
const lu = (banc: Banc, id: string) => (banc.getState().battle?.combatants ?? banc.getState().party).find((c) => c.id === id)!;

/** Dé 64 contre 55 : échec DR −1 ; inversé 46 : réussite DR +1. */
const RATE = { roll: 64, sl: -1, success: false };
const INVERSE = { roll: 46, sl: 1, success: true };

describe('Test étendu : le Round s’inverse sur la Compétence du Test', () => {
  const etendu = (skill?: PendingExtendedTest['skill']): PendingExtendedTest => ({
    actorId: 'H', label: 'Recherche', skillLabel: 'Recherche', ...(skill ? { skill } : { characteristic: 'force' }), target: 55, targetDR: 5, total: 0,
    rounds: [{ id: 'round-1', interactive: true, result: { ...RATE } }],
  });

  it('Studieux sur une Recherche étendue : offert 46 réussite DR +1, le clic écrit le Round', () => {
    const banc = ouvrirLeBanc();
    banc.setState({ battle: null, party: [heros('H', talent('studieux'))], pendingExtendedTest: etendu({ id: 'recherche' }) });
    expect(FLOWS.extendedTest.reversePreview(banc.getState, 'round-1')).toEqual(INVERSE);
    banc.getState().jetReverse('extendedTest', 'round-1');
    expect(banc.getState().pendingExtendedTest!.rounds[0].result).toEqual(INVERSE);
  });

  it('Studieux sur un Test étendu de Force : non offert', () => {
    const banc = ouvrirLeBanc();
    banc.setState({ battle: null, party: [heros('H', talent('studieux'))], pendingExtendedTest: etendu() });
    expect(FLOWS.extendedTest.reverseAvailable(banc.getState, 'round-1')).toBe(false);
  });

  it('coop : seul le siège de l’acteur du Test inverse son Round', () => {
    const banc = ouvrirLeBanc();
    banc.setState({
      battle: { combatants: [jeton(heros('h2'), {}), heros('h3')], order: ['h2', 'h3'], turn: 0, round: 1, log: [], over: null } as never,
      mode: 'battle', party: [],
      net: { ...initialNet(), mode: 'host', mySeat: 0, ownership: { h2: 1, h3: 2 }, slots: [1, 2, 0, 0], seatNames: { 0: 'Hôte', 1: 'A', 2: 'B' } },
      pendingExtendedTest: { ...etendu({ id: 'crochetage' }), actorId: 'h2' },
    });
    expect(appliquerLIntentionDUnSiege(banc.getState, 2, 'jetReverse', ['extendedTest', 'round-1'])).toBe('refusee');
    expect(appliquerLIntentionDUnSiege(banc.getState, 0, 'jetReverse', ['extendedTest', 'round-1'])).toBe('refusee');
    expect(banc.getState().pendingExtendedTest!.rounds[0].result!.roll).toBe(64);
    expect(appliquerLIntentionDUnSiege(banc.getState, 1, 'jetReverse', ['extendedTest', 'round-1'])).toBe('appliquee');
    expect(banc.getState().pendingExtendedTest!.rounds[0].result).toEqual(INVERSE);
  });
});

describe('Activité : Talents partout, jetons d’aventure sur les seules Scènes de bataille', () => {
  const activite = (skillId: string, over: Partial<PendingActivity> = {}): PendingActivity => ({
    heroId: 'H', kind: 'catalog', label: 'A', skillLabel: 'A', skillValue: 55, difficulty: 'intermediaire', ligne: {} as never,
    roll: 64, target: 55, sl: -1, success: false, chosenSkill: { id: skillId }, ...over,
  } as PendingActivity);

  it('Studieux sur la Recherche d’une Activité d’interlude : offert 46', () => {
    const banc = ouvrirLeBanc();
    banc.setState({ party: [heros('H', talent('studieux'))], pendingActivity: activite('recherche') });
    expect(FLOWS.activity.reversePreview(banc.getState)).toEqual(INVERSE);
    banc.getState().jetReverse('activity');
    expect(banc.getState().pendingActivity).toMatchObject({ roll: 46, sl: 1, success: true });
  });

  it('Sociable sur le Ragot d’une Activité : offert ; sur la Recherche : non', () => {
    const banc = ouvrirLeBanc();
    banc.setState({ party: [heros('H', talent('sociable'))], pendingActivity: activite('ragot') });
    expect(FLOWS.activity.reverseAvailable(banc.getState)).toBe(true);
    banc.setState({ pendingActivity: activite('recherche') });
    expect(FLOWS.activity.reverseAvailable(banc.getState)).toBe(false);
  });

  it('jeton d’Entraînement (Corps à corps) : non offert entre deux aventures, offert sur une Scène de bataille', () => {
    const banc = ouvrirLeBanc();
    const h = jeton(heros('H'), { skill: { id: 'corps-a-corps' } });
    banc.setState({ party: [h], pendingActivity: activite('corps-a-corps') });
    expect(FLOWS.activity.reverseAvailable(banc.getState)).toBe(false);
    banc.setState({ pendingActivity: activite('corps-a-corps', { battle: 'round' }) });
    expect(FLOWS.activity.reversePreview(banc.getState)).toEqual(INVERSE);
    banc.getState().jetReverse('activity');
    expect(jetons(lu(banc, 'H'))).toEqual([]);
  });

  it('Test combiné : rien à inverser', () => {
    const banc = ouvrirLeBanc();
    banc.setState({ party: [heros('H', talent('studieux'))], pendingActivity: activite('recherche', { target2: 50, skill2: 'B', skillValue2: 50 }) });
    expect(FLOWS.activity.reverseAvailable(banc.getState)).toBe(false);
  });
});

describe('Battement : le Test de Corps à corps s’inverse', () => {
  const battement = (h: Combatant, banc: Banc) => banc.setState({
    battle: { combatants: [h, heros('E', { kind: 'enemy' } as Partial<Combatant>)], order: ['H', 'E'], turn: 0, round: 1, log: [], over: null } as never,
    pendingBattement: { attackerId: 'H', foeId: 'E', result: hydrateTR({ roll: 64, target: 55, base: 45, sl: -1, success: false }) },
  });

  it('jeton d’Entraînement (Corps à corps) : offert 46, le clic écrit le jet et consomme le jeton', () => {
    const banc = ouvrirLeBanc();
    battement(jeton(heros('H'), { skill: { id: 'corps-a-corps' } }), banc);
    expect(FLOWS.battement.reversePreview(banc.getState)).toEqual(INVERSE);
    banc.getState().jetReverse('battement');
    expect(banc.getState().pendingBattement!.result).toMatchObject({ roll: 46, target: 55, sl: 1, success: true });
    expect(jetons(lu(banc, 'H'))).toEqual([]);
  });

  it('jeton d’Athlétisme : non offert', () => {
    const banc = ouvrirLeBanc();
    battement(jeton(heros('H'), { skill: { id: 'athletisme' } }), banc);
    expect(FLOWS.battement.reverseAvailable(banc.getState)).toBe(false);
  });
});

describe('À sang-froid sur une rangée de Psychologie PILOTÉE (LDB 85 l.13)', () => {
  const RANGEE: BatchParticipant = { id: 'H', interactive: true, base: 55, target: 55, skill: { id: 'calme' }, result: { roll: 64, target: 55, sl: -1, success: false } };
  const bande = (banc: Banc, h: Combatant) => banc.setState({
    battle: { combatants: [h], log: [] } as never,
    pendingCascade: cascadeDeTest([{ id: 'b1', kind: cleDeFixture('combatPsych'), contexte: 'psych', aggregate: 'none', participants: [{ ...RANGEE }] }]),
  });

  it('porteur du Trait : offert 46 réussite DR +1, le clic l’écrit', () => {
    const banc = ouvrirLeBanc();
    bande(banc, heros('H', { traits: [{ id: 'a-sang-froid' }] } as Partial<Combatant>));
    expect(FLOWS.cascadeBatch.reversePreview(banc.getState, 'H')).toEqual(INVERSE);
    banc.getState().jetReverse('cascadeBatch', 'H');
    expect(banc.getState().pendingCascade!.participants[0].participants![0].result).toEqual({ roll: 46, target: 55, sl: 1, success: true });
  });

  it('sans le Trait : non offert', () => {
    const banc = ouvrirLeBanc();
    bande(banc, heros('H'));
    expect(FLOWS.cascadeBatch.reverseAvailable(banc.getState, 'H')).toBe(false);
  });
});

describe('Mécénat (ACE 12 l.60-62) : jeton de Sociabilité face à l’amateur que la fiche déclare', () => {
  const testSocial = (skillId: string, contexte?: PendingTest['contexte']): PendingTest => ({
    actorId: 'H', actorName: 'H', label: 'T', sujet: { skill: { id: skillId } }, skillValue: 55, difficulty: 'intermediaire', requireSL: 0, target: 55,
    roll: 64, success: false, sl: -1, isDouble: false, onSuccess: EMPTY_FLOW, onFailure: EMPTY_FLOW, after: EMPTY_FLOW,
    ...(contexte ? { contexte } : {}),
  } as PendingTest);
  const bande = (minSL: number) => activityById('mecenat')!.outcomes!.find((b) => b.on === 'success' && b.minSL === minSL)!;

  it('+6 DR : jeton de Sociabilité face à un amateur de théâtre, jamais consommé', () => {
    const banc = ouvrirLeBanc();
    const h = heros('H');
    applyOps(h, bande(6).ops!, { rng: makeRNG(1), label: 'Mécénat' });
    expect(jetons(h).map((e) => e.reverseToken)).toEqual([{ characteristic: 'sociabilite', contexte: 'amateurDeTheatre', illimite: true }]);
    banc.setState({ battle: null, party: [h], pendingTest: testSocial('charme', 'amateurDeTheatre') });
    expect(FLOWS.test.reversePreview(banc.getState)).toEqual(INVERSE);
    banc.getState().jetReverse('test');
    expect(banc.getState().pendingTest).toMatchObject(INVERSE);
    expect(jetons(lu(banc, 'H'))).toHaveLength(1);
  });

  it('+6 DR : non offert face à un simple amateur d’art, ni sans contrepartie', () => {
    const banc = ouvrirLeBanc();
    const h = heros('H');
    applyOps(h, bande(6).ops!, { rng: makeRNG(1), label: 'Mécénat' });
    banc.setState({ battle: null, party: [h], pendingTest: testSocial('charme', 'amateurDArt') });
    expect(FLOWS.test.reverseAvailable(banc.getState)).toBe(false);
    banc.setState({ pendingTest: testSocial('charme') });
    expect(FLOWS.test.reverseAvailable(banc.getState)).toBe(false);
  });

  it('+3 à +5 DR : jeton d’amateur d’art, offert face à un amateur de théâtre, consommé', () => {
    const banc = ouvrirLeBanc();
    const h = heros('H');
    applyOps(h, bande(3).ops!, { rng: makeRNG(1), label: 'Mécénat' });
    banc.setState({ battle: null, party: [h], pendingTest: testSocial('charme', 'amateurDeTheatre') });
    expect(FLOWS.test.reversePreview(banc.getState)).toEqual(INVERSE);
    banc.getState().jetReverse('test');
    expect(jetons(lu(banc, 'H'))).toEqual([]);
  });

  it('un Test de Perception face à l’amateur : non offert (pas un Test de Sociabilité)', () => {
    const banc = ouvrirLeBanc();
    const h = heros('H');
    applyOps(h, bande(3).ops!, { rng: makeRNG(1), label: 'Mécénat' });
    banc.setState({ battle: null, party: [h], pendingTest: testSocial('perception', 'amateurDArt') });
    expect(FLOWS.test.reverseAvailable(banc.getState)).toBe(false);
  });

  it('le Test ouvert dans un dialogue lit la contrepartie sur la fiche de l’interlocuteur', () => {
    const banc = ouvrirLeBanc();
    banc.setState({
      battle: null, party: [heros('H')],
      scene: { ...emptyScene('s'), entities: [{ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 1, y: 1 }, amateur: 'amateurDeTheatre' }] } as never,
      dialogue: { dialogue: { id: 'd', start: 'n', nodes: [] } as never, nodeId: 'n', speakerId: 'pnj', session: 1 },
    });
    openSkillTest(banc.getState, banc.setState, { skill: { id: 'charme' } } as never, EMPTY_FLOW, EMPTY_FLOW, EMPTY_FLOW, { actorId: 'H' });
    expect(banc.getState().pendingTest?.contexte).toBe('amateurDeTheatre');
  });
});
