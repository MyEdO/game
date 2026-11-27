/**
 * L'ouverture du Round 1 (#5042 V3a) : « 1. Déterminer la Surprise … 2. Début du Round … 3. Les Personnages effectuent
 * leur tour » (LDB 13 l.21-23). Les Tests d'ouverture (Surprise, effets `onRoundStart`) se jouent avant que la pause de
 * début de Round soit posée, comme aux Rounds suivants (borne `roundBoundary`).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { heroDuDuel } from './combatDeTest.testkit';
import { draineCascade } from './cascade.testkit';
import { desDeCombat } from './ouvertureDuTour.testkit';
import { seedBattleRng } from './battleRng';
import { attachMutation } from '../engine/corruption';
import { mutationById } from '../data/mutations';
import { makeRNG } from '../engine/dice';
import { setCadence } from '../engine/cadence';
import { testScene } from '../scenes/test-fixture';
import { scenario } from '../scenes/test-scenarios/embuscade';
import { idsDeTest } from '../engine/idsDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
afterEach(() => setCadence('manuel'));

const g = () => banc.getState();
const surprisDuGroupe = (): string[] => g().battle!.combatants.filter((c) => c.kind === 'heros' && c.conditions.some((k) => k.id === 'surpris')).map((c) => c.id);

describe('Round 1 : la pause de début de Round', () => {
  for (const cadence of ['manuel', 'rapide', 'auto'] as const) {
    it(`cadence ${cadence}, sans Test d'ouverture : le combat s'ouvre sur la pause du Round 1, personne actif`, () => {
      setCadence(cadence);
      banc.setState({ screen: 'campaign', party: [heroDuDuel()] });
      g().lancerLaScene(testScene());
      g().lancerLeCombat('enc-mutants');
      expect(g().pendingCascade).toBeNull();
      expect(g().pendingRoundStart).toEqual({ round: 1 });
      expect(g().battle!.turn).toBe(-1);
    });
  }
});

describe('Round 1 : la Surprise se joue avant la pause (embuscade, héros manuels)', () => {
  it('la pause n’est posée qu’après la bande de Surprise ; aucun héros ne devient Surpris après l’ouverture de son tour', () => {
    setCadence('manuel');
    seedBattleRng(3);
    const { scene, party } = scenario.construire(idsDeTest);
    banc.setState({ screen: 'campaign', party });
    g().lancerLaScene(scene);
    desDeCombat('echec');
    g().lancerLeCombat('enc-mutants');
    expect(g().pendingCascade?.participants.map((p) => p.kind)).toEqual(['testDeclencheEnBande']);
    expect(g().pendingCascade?.roundBoundary).toBe(true);
    expect(g().pendingRoundStart).toBeNull();
    // La pause n'est pas ouverte : sa validation est refusée, aucun tour ne s'ouvre.
    g().fenetreValider('debutDuRound');
    expect(g().refus).not.toBeNull();
    expect(g().battle!.turn).toBe(-1);
    expect(g().pendingCascade).not.toBeNull();
    draineCascade(g);
    expect(g().pendingRoundStart).toEqual({ round: 1 });
    const surpris = surprisDuGroupe();
    expect(surpris.length).toBeGreaterThan(0);
    g().fenetreValider('debutDuRound');
    banc.abandonner();
    expect(g().battle!.turn).toBeGreaterThanOrEqual(0);
    expect(surprisDuGroupe()).toEqual(surpris);
  });

  it('l’étape de Surprise précède celle de Stupide (embuscade, héros Crétin)', () => {
    setCadence('manuel');
    seedBattleRng(3);
    const { scene, party } = scenario.construire(idsDeTest);
    attachMutation(party[0], mutationById('cretin')!, makeRNG(1));
    banc.setState({ screen: 'campaign', party: [party[0]] });
    g().lancerLaScene(scene);
    desDeCombat('echec');
    g().lancerLeCombat('enc-mutants');
    expect(g().pendingCascade?.participants.map((p) => [p.kind, p.actorId === party[0].id || p.participants?.some((r) => r.id === party[0].id)])).toEqual([
      ['testDeclencheEnBande', true],
      ['testDeclenche', true],
    ]);
    expect(g().pendingRoundStart).toBeNull();
  });
});
