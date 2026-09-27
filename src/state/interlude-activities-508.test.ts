/**
 * Les 8 Activités de Classe/répandues LDB 23 (#508) + les 5 Activités de Guerrier AA Annexe II
 * (#510) : gate de Classe générique appliqué au chemin réel, bout-en-bout pour 3 Activités
 * représentatives (Entraînement au Combat, Réputation, Semer la dissension), tables du Remaniement.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { draineCascade } from './cascadeTestKit';
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

function setup(careerId: string) {
  vi.useFakeTimers();
  vi.clearAllTimers();
  const h = createHero({ speciesId: 'humains-reiklander', careerId, label: 'H', seed: 1 });
  useGame.setState({ party: [h], battle: null, interlude: null, bank: [], pendingOrders: [], pendingActivity: null, journal: [] });
  useGame.getState().startScene(testScene);
  vi.clearAllTimers();
  creditBourse(useGame.getState, useGame.setState, h.id, fromBrass(20000));
  useGame.getState().seedRng(13);
  useGame.getState().startInterlude(3);
  draineCascade(useGame.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
  const itl = useGame.getState().interlude!;
  itl.perHero[h.id] = { ...itl.perHero[h.id], fx: undefined, left: 3 };
  useGame.setState({ interlude: { ...itl } });
  return h.id;
}

describe('Gate de Classe (LDB 23 l.197 / AA 12 l.5) — appliqué au chemin réel', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("Observer une cible (Roublards) : un Roublard garde la Difficulté déclarée, un Guerrier la subit +1 Niveau", () => {
    const roublardId = setup('charlatan'); // classe roublards
    useGame.getState().interludeActivity(roublardId, 'observer-une-cible');
    expect(useGame.getState().pendingActivity?.difficulty).toBe('intermediaire');
  });

  it('hors Classe : la Difficulté durcit d’un Niveau (Intermédiaire → Complexe)', () => {
    const guerrierId = setup('soldat'); // classe guerriers, PAS roublards
    useGame.getState().interludeActivity(guerrierId, 'observer-une-cible');
    expect(useGame.getState().pendingActivity?.difficulty).toBe('complexe');
  });

  it('Activité de Guerrier AA (Fabuleuse Vente de Punchausen) : hors Classe, la Difficulté durcit d’un Niveau', () => {
    const guerrierId = setup('soldat');
    useGame.getState().interludeActivity(guerrierId, 'punchausen');
    const guerrierDifficulty = useGame.getState().pendingActivity?.difficulty;
    expect(guerrierDifficulty).toBeTruthy();

    const eruditId = setup('erudit'); // classe lettres, PAS guerriers
    useGame.getState().interludeActivity(eruditId, 'punchausen');
    expect(useGame.getState().pendingActivity?.difficulty).toBe(easeDifficulty(guerrierDifficulty!, -1));
  });

  it('Punchausen : Charme et Divertissement (Narration) à égalité de valeur brute — le flux retient la voie de CIBLE la plus favorable (Divertissement, Intermédiaire), pas la première Compétence déclarée (Charme, Complexe)', () => {
    const heroId = setup('soldat'); // classe guerriers (couverte par le classGate)
    let h = useGame.getState().party[0];
    // Force l'égalité de valeur BRUTE (« pour un héros sans avance », les deux retombent sur la même
    // Caractéristique Sociabilité) — sans quoi une sélection par VALEUR (le bug corrigé) choisirait
    // encore Divertissement par coïncidence sur ce tirage de héros.
    h = { ...h, skills: h.skills.filter((k) => k.id !== 'charme' && k.id !== 'divertissement') };
    useGame.setState({ party: [h] });
    expect(testValue(h, 'charme')).toBe(testValue(h, 'divertissement', undefined, 'narration'));
    useGame.getState().interludeActivity(heroId, 'punchausen');
    const pa = useGame.getState().pendingActivity!;
    expect(pa.chosenSkill).toBe('divertissement');
    expect(pa.chosenSkillSpec).toBe('narration');
    expect(pa.difficulty).toBe('intermediaire');
  });
});

describe('Entraînement au Combat (LDB 23 l.205-209) — jeton d’inversion SCOPÉ à la Compétence testée', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('succès → grantReverseToken scopé, consommable une fois pour la Compétence testée', () => {
    const heroId = setup('soldat');
    useGame.getState().interludeActivity(heroId, 'entrainement-au-combat');
    const pa = useGame.getState().pendingActivity!;
    expect(pa.activityId).toBe('entrainement-au-combat');
    expect(['corps-a-corps', 'projectiles']).toContain(pa.chosenSkill);
    useGame.getState().activityRoll();
    useGame.setState({ pendingActivity: { ...useGame.getState().pendingActivity!, roll: 1, success: true, sl: 2 } });
    useGame.getState().activityConfirm();
    expect(useGame.getState().pendingActivity).toBeNull();
    const hero = useGame.getState().party[0];
    expect(consumeReverseToken(hero, { skill: pa.chosenSkill! })).toBe(true);
    expect(consumeReverseToken(hero, { skill: pa.chosenSkill! })).toBe(false); // épuisé, une seule utilisation
  });
});

describe('Réputation (LDB 23 l.228-234) — coût dépensé DANS TOUS LES CAS, Standing +1/+2/-1', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('succès : +1 Standing (statusMod), coût débité', () => {
    const heroId = setup('agitateur'); // classe citadins
    useGame.getState().interludeActivity(heroId, 'reputation');
    const before = toBrass(partyMoneyTotal(useGame.getState));
    expect(useGame.getState().pendingActivity?.costBrass).toBeGreaterThan(0);
    useGame.getState().activityRoll();
    useGame.setState({ pendingActivity: { ...useGame.getState().pendingActivity!, roll: 1, success: true, sl: 2 } });
    useGame.getState().activityConfirm();
    const hero = useGame.getState().party[0];
    expect(hero.activeEffects?.some((e) => e.statusMod === 1)).toBe(true);
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBeLessThan(before);
  });
});

describe('Semer la dissension (LDB 23 l.236-248) — DEUX Activités, la 2ᵉ gatée par le succès de la 1ʳᵉ', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('Émeute refusée avant le succès du Repérage ; débloquée après', () => {
    const heroId = setup('agitateur');
    useGame.getState().interludeActivity(heroId, 'semer-dissension-emeute');
    expect(useGame.getState().pendingActivity).toBeNull(); // gate : Repérage non encore réussi

    useGame.getState().interludeActivity(heroId, 'semer-dissension-reperage');
    useGame.getState().activityRoll();
    useGame.setState({ pendingActivity: { ...useGame.getState().pendingActivity!, roll: 1, success: true, sl: 2 } });
    useGame.getState().activityConfirm();
    const itl = useGame.getState().interlude!;
    expect(itl.perHero[heroId].dissensionReady).toBe(true);

    useGame.getState().interludeActivity(heroId, 'semer-dissension-emeute');
    expect(useGame.getState().pendingActivity?.activityId).toBe('semer-dissension-emeute');
    useGame.getState().activityRoll();
    useGame.setState({ pendingActivity: { ...useGame.getState().pendingActivity!, roll: 1, success: true, sl: 2 } });
    useGame.getState().activityConfirm();
    expect(useGame.getState().interlude!.perHero[heroId].dissensionReady).toBe(false); // consommé
  });
});

describe('Remaniement du contremaître (AA 12 l.51-144) — tire ses TROIS tables', () => {
  it('les 3 tables (Lieu/Objectif/Personnalité) sont enregistrées et couvrent 1..100', () => {
    for (const id of ['contremaitre-lieu', 'contremaitre-objectif', 'contremaitre-personnalite']) {
      const t = findEffectTableById(id);
      expect(t.rows.length).toBeGreaterThan(0);
      for (const roll of [1, 50, 100]) expect(findTableEntry(t.rows, roll)).toBeTruthy();
    }
  });

  it('Activité enregistrée avec resolver contremaitre, gate Guerriers', () => {
    const def = activityById('remaniement-contremaitre');
    expect(def?.resolver).toBe('contremaitre');
    expect(def?.classGate?.classes).toEqual(['guerriers']);
  });
});
