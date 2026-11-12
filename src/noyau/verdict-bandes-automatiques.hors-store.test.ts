/**
 * LE VERDICT DU d100 SUIT LES BANDES AUTOMATIQUES, PARTOUT (#3059 J1). LDB 12 l.25-28 : « Si, sur un Test
 * quelconque, vous obtenez de 96 à 00, le résultat sera toujours un échec […] de 01 à 05 […] toujours un
 * succès » ; « Ces bandes automatiques s'appliquent à *tous* les tests ». Le juge est `evaluateTest`
 * (`engine/tests.ts`) : un site qui relit un jet posé (Chance, Résilience, `jetsEnVue`, Contre-sort, taverne)
 * rend le même verdict que lui. Cibles bornées 1..99 : 97 contre 99 est un échec, 03 contre 1 une réussite.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { EMPTY_FLOW } from '../engine/flowCore';
import { evaluateTest } from '../engine/tests';
import { castTestOf } from '../engine/magic';
import { FLOWS } from './rollFlowSpecs';
import { jetsEnVue, type LigneDeJet } from './jetsEnVue';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import type { Combatant } from '../engine/types';
import type { TavernPayload } from './tavernFlow';
import { fixtureText } from '../i18n/fixtureText';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const get = () => banc.getState();

/** Le Test de scène posé comme `resolve` le pose : dé, cible bornée, et le verdict d'`evaluateTest`. */
function testPose(roll: number, cible: number, fortune = 1) {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
  hero.fortune = fortune;
  const t = evaluateTest(roll, cible);
  banc.setState({
    battle: null, pendingCascade: null, party: [hero],
    pendingTest: { actorId: hero.id, actorName: 'A', label: 'Test', skillValue: cible, difficulty: 'intermediaire',
      requireSL: 0, target: t.target, roll, success: t.success, sl: t.sl, rerolled: false, onSuccess: EMPTY_FLOW, onFailure: EMPTY_FLOW },
  });
  return hero;
}

const reussiDe = (l: LigneDeJet | undefined): boolean | undefined => (l?.genre === 'test' ? l.jet?.reussi : undefined);

describe('Chance et +1 DR : l’issue canonique du seam est celle d’`evaluateTest`', () => {
  it('97 contre 99 est un ÉCHEC : la relance de Chance est offerte (LDB 17 l.23)', () => {
    testPose(97, 99);
    expect(FLOWS.test.outcomeOf(get)?.won).toBe(false);
    get().jetRelancer('test');
    expect(get().party[0].fortune, 'un Point de Chance dépensé sur le Test raté').toBe(0);
  });

  it('03 contre 1 est une RÉUSSITE : la relance de Chance est refusée', () => {
    testPose(3, 1);
    expect(FLOWS.test.outcomeOf(get)?.won).toBe(true);
    get().jetRelancer('test');
    expect(get().party[0].fortune, 'aucun Point dépensé sur un Test réussi').toBe(1);
  });

  it('+1 DR sur 97 contre 99 ne fabrique pas de réussite', () => {
    testPose(97, 99);
    get().jetAjouterUnDR('test');
    expect(get().pendingTest!.success).toBe(false);
  });

  it('incantation 97 contre 99 (`cleanRollOutcome`) : issue ratée', () => {
    const [h] = tousLesHerosDeScenario(idsDeTest) as Combatant[];
    banc.setState({
      party: [h], battle: { combatants: [h], log: [] } as never,
      pendingCast: { casterId: h.id, targetId: h.id, spellId: 'drain', missile: false, focused: false, result: { cast: false, roll: 97, target: 99, sl: -1, isCritical: false, isFumble: false, log: '' } },
    } as never);
    expect(FLOWS.incantation.outcomeOf(get)?.won).toBe(false);
  });
});

describe('`jetsEnVue` annonce le verdict du résolveur', () => {
  it('Test de scène 97 contre 99 : la ligne est ratée', () => {
    const h = testPose(97, 99);
    // Le Test de scène est une cascade-hôte à une étape (`testsDeScene`) : la fenêtre est la cascade.
    banc.setState({ pendingCascade: { title: 'Test', cursor: 0, seq: 1, log: [], purpose: 'combat', participants: [{ id: 'hote-test', kind: 'testDeclenche', actorId: h.id, jet: 'test', label: fixtureText('Test') }] } });
    expect(reussiDe(jetsEnVue(get()).find((j) => j.flux === 'test')?.lignes[0])).toBe(false);
  });

  it('Focalisation réussie à 0 DR : la ligne est réussie (LDB 12 l.174)', () => {
    const [h] = tousLesHerosDeScenario(idsDeTest) as Combatant[];
    banc.setState({
      party: [h], battle: { combatants: [h], log: [] } as never,
      pendingFocus: { casterId: h.id, spellId: 'drain', result: { dr: 0, success: true, isCritical: false, isFumble: false, roll: 40, target: 45, sl: 0, log: '' } },
    } as never);
    expect(reussiDe(jetsEnVue(get()).find((j) => j.flux === 'focalisation')?.lignes[0])).toBe(true);
  });
});

describe('Magie : le Test d’Incantation figé du Contre-sort (LDB 46 l.156)', () => {
  it('97 contre 99 est un échec, 03 contre 1 une réussite', () => {
    expect(castTestOf({ roll: 97, target: 99, sl: -1 }).success).toBe(false);
    expect(castTestOf({ roll: 3, target: 1, sl: 1 }).success).toBe(true);
  });
});

describe('Taverne : le lancer de volée relit le verdict du d100 (NADJ 16 l.70)', () => {
  it('l’Arène, 97 contre une cible au-delà de 99 : échec, aucun point', () => {
    const a = tousLesHerosDeScenario(idsDeTest)[0] as Combatant;
    a.characteristics = { ...a.characteristics, 'capacite-de-tir': 95 };
    banc.setState({ battle: null, party: [a], journal: [], tavernGames: null, pendingCascade: null, sequence: null });
    get().jouerALaTaverne(a.id, { gameId: 'arene', opponent: { kind: 'profil', id: 'humain' } });
    let pc = get().pendingCascade!;
    const vise = pc.participants[pc.cursor];
    get().jetRegler('cascade', 'choix', '0', vise.id); // le nez : Très facile (+60)
    get().jetValider('cascade');
    pc = get().pendingCascade!;
    const idx = pc.participants.findIndex((s) => s.kind === 'taverneLancer');
    const band = pc.participants[idx];
    const row = band.participants![0];
    expect(row.target!, 'la cible du lancer dépasse la borne haute').toBeGreaterThanOrEqual(99);
    const t = evaluateTest(97, row.target!);
    const participants = [...pc.participants];
    participants[idx] = { ...band, participants: [{ ...row, result: { roll: 97, target: row.target!, sl: t.sl, success: t.success } }] };
    banc.setState({ pendingCascade: { ...pc, participants, cursor: idx } });
    get().jetValider('cascade');
    expect((get().sequence?.chargeUtile as TavernPayload | undefined)?.volley?.gains.joueur).toEqual([0]);
  });
});
