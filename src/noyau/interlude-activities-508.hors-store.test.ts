/**
 * Les 8 Activités de Classe/répandues LDB 23 (#508) + les 5 Activités de Guerrier AA Annexe II
 * (#510) : gate de Classe générique appliqué au chemin réel, bout-en-bout pour 3 Activités
 * représentatives (Entraînement au Combat, Réputation, Semer la dissension), tables du Remaniement.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineCascade } from './cascade.testkit';
import { createHero } from '../engine/character';
import { toBrass, fromBrass } from '../engine/money';
import { partyMoneyTotal, creditBourse } from './bourseFlow';
import { testScene } from '../scenes/test-fixture';
import { consumeReverseToken } from '../engine/reverseToken';
import { activityById } from '../engine/activities';
import { findEffectTableById } from '../data/effectTables';
import { findTableEntry } from '../engine/tables';
import { easeDifficulty } from '../engine/tests';
import { testValue } from '../engine/skills';
import { pratiquer } from './interlude.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function setup(careerId: string) {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId, label: 'H', seed: 1 });
  banc.setState({ party: [h], battle: null, interlude: null, bank: [], pendingOrders: [], pendingActivity: null, journal: [] });
  banc.getState().lancerLaScene(testScene());
  creditBourse(banc.getState, banc.setState, h.id, fromBrass(20000));
  banc.getState().ensemencerLeTirage(13);
  banc.getState().ouvrirLInterlude(3);
  draineCascade(banc.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
  const itl = banc.getState().interlude!;
  itl.perHero[h.id] = { ...itl.perHero[h.id], fx: undefined, left: 3 };
  banc.setState({ interlude: { ...itl } });
  return h.id;
}

describe('Gate de Classe (LDB 23 l.197 / AA 12 l.5) — appliqué au chemin réel', () => {
  it("Observer une cible (Roublards) : un Roublard garde la Difficulté déclarée, un Guerrier la subit +1 Niveau", () => {
    const roublardId = setup('charlatan'); // classe roublards
    pratiquer(banc.getState, roublardId, 'observer-une-cible');
    expect(banc.getState().pendingActivity?.difficulty).toBe('intermediaire');
  });

  it('hors Classe : la Difficulté durcit d’un Niveau (Intermédiaire → Complexe)', () => {
    const guerrierId = setup('soldat'); // classe guerriers, PAS roublards
    pratiquer(banc.getState, guerrierId, 'observer-une-cible');
    expect(banc.getState().pendingActivity?.difficulty).toBe('complexe');
  });

  it('Activité de Guerrier AA (Fabuleuse Vente de Punchausen) : hors Classe, la Difficulté durcit d’un Niveau', () => {
    const guerrierId = setup('soldat');
    pratiquer(banc.getState, guerrierId, 'punchausen');
    const guerrierDifficulty = banc.getState().pendingActivity?.difficulty;
    expect(guerrierDifficulty).toBeTruthy();

    const eruditId = setup('erudit'); // classe lettres, PAS guerriers
    pratiquer(banc.getState, eruditId, 'punchausen');
    expect(banc.getState().pendingActivity?.difficulty).toBe(easeDifficulty(guerrierDifficulty!, -1));
  });

  it('Punchausen : Charme et Divertissement (Narration) à égalité de valeur brute — le flux retient la voie de CIBLE la plus favorable (Divertissement, Intermédiaire), pas la première Compétence déclarée (Charme, Complexe)', () => {
    const heroId = setup('soldat'); // classe guerriers (couverte par le classGate)
    let h = banc.getState().party[0];
    // Force l'égalité de valeur BRUTE (« pour un héros sans avance », les deux retombent sur la même
    // Caractéristique Sociabilité) — sans quoi une sélection par VALEUR choisirait Divertissement
    // par coïncidence sur ce tirage de héros.
    h = { ...h, skills: h.skills.filter((k) => k.id !== 'charme' && k.id !== 'divertissement') };
    banc.setState({ party: [h] });
    expect(testValue(h, { skill: { id: 'charme' } })).toBe(testValue(h, { skill: { id: 'divertissement', spec: 'narration' } }));
    pratiquer(banc.getState, heroId, 'punchausen');
    const pa = banc.getState().pendingActivity!;
    expect(pa.chosenSkill).toEqual({ id: 'divertissement', spec: 'narration' });
    expect(pa.difficulty).toBe('intermediaire');
  });
});

describe('Entraînement au Combat (LDB 23 l.205-209) — jeton d’inversion SCOPÉ à la Compétence testée', () => {
  it('succès → grantReverseToken scopé, consommable une fois pour la Compétence testée', () => {
    const heroId = setup('soldat');
    pratiquer(banc.getState, heroId, 'entrainement-au-combat');
    const pa = banc.getState().pendingActivity!;
    expect(pa.activityId).toBe('entrainement-au-combat');
    expect(['corps-a-corps', 'projectiles']).toContain(pa.chosenSkill?.id);
    banc.getState().jetLancer('activite');
    banc.setState({ pendingActivity: { ...banc.getState().pendingActivity!, roll: 1, success: true, sl: 2 } });
    banc.getState().jetValider('activite');
    expect(banc.getState().pendingActivity).toBeNull();
    const hero = banc.getState().party[0];
    expect(consumeReverseToken(hero, { skill: { id: pa.chosenSkill!.id } })).toBe(true);
    expect(consumeReverseToken(hero, { skill: { id: pa.chosenSkill!.id } })).toBe(false); // épuisé, une seule utilisation
  });
});

describe('Réputation (LDB 23 l.228-234) — coût dépensé DANS TOUS LES CAS, Standing +1/+2/-1', () => {
  it('succès : +1 Standing (statusMod) retenu pour la clôture, coût débité', () => {
    const heroId = setup('agitateur'); // classe citadins
    pratiquer(banc.getState, heroId, 'reputation');
    const before = toBrass(partyMoneyTotal(banc.getState));
    expect(banc.getState().pendingActivity?.costBrass).toBeGreaterThan(0);
    banc.getState().jetLancer('activite');
    banc.setState({ pendingActivity: { ...banc.getState().pendingActivity!, roll: 1, success: true, sl: 2 } });
    banc.getState().jetValider('activite');
    const hero = banc.getState().party[0];
    expect(banc.getState().interlude?.perHero[heroId].closeOps).toEqual([{ ops: [{ op: 'statusMod', amount: 1 }], ctx: { label: 'Réputation', source: { kind: 'activite', id: 'reputation' }, sl: 2 } }]);
    expect(hero.activeEffects?.some((e) => e.statusMod), 'posé avant la prochaine aventure').toBeFalsy();
    expect(toBrass(partyMoneyTotal(banc.getState))).toBeLessThan(before);
  });
});

describe('Semer la dissension (LDB 23 l.236-248) — DEUX Activités, la 2ᵉ gatée par le succès de la 1ʳᵉ', () => {
  it('Émeute refusée avant le succès du Repérage ; débloquée après', () => {
    const heroId = setup('agitateur');
    pratiquer(banc.getState, heroId, 'semer-dissension-emeute');
    expect(banc.getState().pendingActivity).toBeNull(); // gate : Repérage non encore réussi

    pratiquer(banc.getState, heroId, 'semer-dissension-reperage');
    banc.getState().jetLancer('activite');
    banc.setState({ pendingActivity: { ...banc.getState().pendingActivity!, roll: 1, success: true, sl: 2 } });
    banc.getState().jetValider('activite');
    const itl = banc.getState().interlude!;
    expect(itl.perHero[heroId].dissensionReady).toBe(true);

    pratiquer(banc.getState, heroId, 'semer-dissension-emeute');
    expect(banc.getState().pendingActivity?.activityId).toBe('semer-dissension-emeute');
    banc.getState().jetLancer('activite');
    banc.setState({ pendingActivity: { ...banc.getState().pendingActivity!, roll: 1, success: true, sl: 2 } });
    banc.getState().jetValider('activite');
    expect(banc.getState().interlude!.perHero[heroId].dissensionReady).toBe(false); // consommé
  });
});

describe('Remaniement du contremaître (AA 12 l.51-144) — tire ses TROIS tables', () => {
  it('les 3 tables (Lieu/Objectif/Personnalité) sont enregistrées et couvrent 1..100', () => {
    for (const id of ['contremaitre-lieu', 'contremaitre-objectif', 'contremaitre-personnalite']) {
      const t = findEffectTableById(id);
      expect(t.entries.length).toBeGreaterThan(0);
      for (const roll of [1, 50, 100]) expect(findTableEntry(t.entries, roll)).toBeTruthy();
    }
  });

  it('Activité enregistrée avec resolver contremaitre, gate Guerriers', () => {
    const def = activityById('remaniement-contremaitre');
    expect(def?.resolver).toBe('contremaitre');
    expect(def?.classGate?.classes).toEqual(['guerriers']);
  });
});
