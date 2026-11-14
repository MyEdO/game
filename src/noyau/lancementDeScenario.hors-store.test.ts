/**
 * Le lancement d'un scénario de test (#1692, `lancerLeScenario`) lit la fiche ET le contenu construit, dont
 * `interludeWeeks` (ADE II 8 l.65) ; le lancement d'une campagne du jeu (#3009, `lancementDeLaCampagne`) passe par la
 * même séquence, le groupe composé gardé.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { seedBattleRng } from './battleRng';
import { lancementDuProjet, lancerLeScenario } from './lancementDeScenario';
import { lancementDuScenario } from '../scenes/test-scenarios/_shared';
import { testScenarios } from '../scenes/test-scenarios';
import { campagneDuJeu, diligenceCampaign, lancementDeLaCampagne, lancerCampagne } from '../scenes/campaign';
import { PRETIRE_DE_TEST, poserLesPretires } from './creation/pretireDeTest.testkit';
import { resetRule, setRule } from '../engine/policy';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { dayIndex } from '../engine/clock';

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc();
  seedBattleRng(1234);
});

/** Lance le scénario `id` par l'unique séquence que joue aussi le menu. */
function lancer(id: string): void {
  lancerLeScenario(banc.getState, banc.setState, lancementDuScenario(testScenarios.find((s) => s.id === id)!, idsDeTest));
}

describe('menu des scénarios de test → lancerScenario', () => {
  it('« Lancer » une bataille de masse dont la fiche porte `interludeWeeks` ouvre l’interlude AVANT la bataille', () => {
    const sc = testScenarios.find((s) => s.id === 'bataille-de-masse')!;
    expect(sc.interludeWeeks).toBe(3);
    lancer(sc.id);
    const s = banc.getState();
    expect(s.interlude?.weeks).toBe(3);
    expect(s.screen).toBe('interlude');
    expect(s.massBattle?.round).toBe(1);
    expect(s.party.map((h) => h.id)).toEqual(sc.construire(idsDeTest).party.map((h) => h.id));
    expect(s.scene?.id).toBe('test-bataille-de-masse');
  });

  it('règle `interlude-actif` coupée (LDB 21 l.108) : « Lancer » n’ouvre aucun interlude, la bataille démarre', () => {
    setRule('interlude-actif', false);
    try {
      lancer('bataille-de-masse');
      const s = banc.getState();
      expect(s.interlude).toBeNull();
      expect(s.massBattle?.round).toBe(1);
      expect(s.screen).toBe('massBattle');
    } finally {
      resetRule('interlude-actif');
    }
  });
});

describe('le navire d’un scénario au lancement', () => {
  it('reçoit la semaine de sa pose (MDG 14 l.143), quelle que soit la semaine de la donnée', () => {
    lancer('voyage-maritime');
    const s = banc.getState();
    expect(s.vessel?.morale.lastMoraleWeek).toBe(Math.floor(dayIndex(s.gameTime) / 7));
    expect(s.vessel?.morale.lastMoraleWeek).toBeGreaterThan(0);
  });
});

describe('le lancement d’une campagne du jeu par le groupe composé', () => {
  /** Le groupe d'un pré-tiré de fixture, recruté par le verbe du noyau. */
  const recruter = (): void => {
    poserLesPretires();
    banc.getState().recruterLeHeros({ pretire: PRETIRE_DE_TEST.id });
  };

  it('la séquence unique garde le groupe recruté et sa possession, pose le document de la campagne sous son identité, à l’écran de campagne', () => {
    recruter();
    const { party, net } = banc.getState();
    const lancee = campagneDuJeu(diligenceCampaign);
    lancerLeScenario(banc.getState, banc.setState, lancementDeLaCampagne(lancee, party));
    const s = banc.getState();
    expect(s.party).toEqual(party);
    expect(s.net).toEqual(net);
    expect(s.scene?.id).toBe(lancee.startSceneId);
    expect(s.campaignDoc).toMatchObject({ startSceneId: lancee.startSceneId, projet: lancee.projet });
    expect(s.campaignDoc?.scenes.map((sc) => sc.id)).toEqual(lancee.scenes.map((sc) => sc.id));
    expect(s.screen).toBe('campaign');
  });

  it('`lancerCampagne` pose la même campagne sans la démarrer : le groupe gardé, le document posé, l’écran laissé', () => {
    recruter();
    const { party, net, screen } = banc.getState();
    const lancee = campagneDuJeu(diligenceCampaign);
    expect(lancerCampagne(banc.getState, lancee)).toBeNull();
    const s = banc.getState();
    expect(s.party).toEqual(party);
    expect(s.net).toEqual(net);
    expect(s.scene?.id).toBe(lancee.startSceneId);
    expect(s.campaignDoc).toMatchObject({ startSceneId: lancee.startSceneId, projet: lancee.projet });
    expect(s.campaignDoc?.scenes.map((sc) => sc.id)).toEqual(lancee.scenes.map((sc) => sc.id));
    expect(s.screen).toBe(screen);
  });

  it('une scène d’entrée nommée ouvre la campagne sur elle ; absente du paquet, le lancement lève en la nommant', () => {
    recruter();
    const lancee = campagneDuJeu(diligenceCampaign);
    const autre = lancee.scenes[1];
    lancerLeScenario(banc.getState, banc.setState, lancementDeLaCampagne(lancee, banc.getState().party, autre.id));
    expect(banc.getState().scene?.id).toBe(autre.id);
    expect(banc.getState().campaignDoc?.startSceneId).toBe(autre.id);
    expect(() => lancementDuProjet(lancee, [], 'zz-absente', null)).toThrow(/scène d’entrée « zz-absente » absente/);
  });

  it('un scénario de test chargé en projet reste sans identité de document', () => {
    lancer('voyage');
    expect(banc.getState().campaignDoc, 'le scénario du voyage porte ses scènes en projet').not.toBeNull();
    expect(banc.getState().campaignDoc?.projet).toBeNull();
  });
});
