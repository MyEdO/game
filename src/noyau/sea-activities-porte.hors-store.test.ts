import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from './battleRng';
import { activityById, travelActivitySpec } from '../engine/activities';
import { activiteMer, avecActivite } from '../engine/activiteMer.testkit';
import { setRule, resetRule } from '../engine/policy';
import { buildSeaGenericStep } from './seaActivities';
import { composeRollLabel, effectiveTarget, type RollRequest } from './rollSeam';
import { testValue } from '../engine/skills';
import { DIFFICULTY_MODIFIERS } from '../engine/types';
import type { Combatant } from '../engine/types';
import type { ModLine } from '../engine/combat';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * LA PORTE des Activités en mer (#1262 V2 L5) — `seaActivities.ts` ne monte plus ses étapes : elles
 * naissent de `monoStep`, la séquence s'ouvre par `openSequence`. Ce fichier mesure l'ÉQUIVALENCE
 * champ à champ avec les littéraux d'avant migration (recopiés ici tels qu'ils s'écrivaient) et la
 * POSSESSION posée par le mint, sur des données RÉELLES (catalogue `activities.json`, pré-tirés).
 */

const get = () => banc.getState();
const set: Banc['setState'] = (e) => banc.setState(e);

/** Somme des modificateurs NOMMÉS d'une ligne montée — ce que le mint a SORTI de la base. */
const sommeMods = (mods: ModLine[] | undefined): number => (mods ?? []).reduce((s, m) => s + m.value, 0);

function freshState() {
  seedBattleRng(7);
  banc.setState({
    party: makePregens().slice(0, 3),
    battle: null,
    travelPlan: null,
    travelRecap: null,
    pendingCascade: null,
    pendingRest: null,
    pendingSeaActivities: null,
    gameTime: 8 * 60,
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
    journal: [],
  } as never);
}

describe('#1262 V2 L5 — les Activités en mer passent par la PORTE', () => {
  beforeEach(freshState);

  it('Cartographie — l’étape MINTÉE est équivalente CHAMP À CHAMP à son ancien littéral, et le porteur est le cartographe', () => {
    const [cartographe, autre] = get().party;
    (cartographe as Combatant).skills = [{ id: 'metier', spec: 'cartographe', advances: 20 } as never];
    (cartographe as Combatant).characteristics = { ...cartographe.characteristics, dexterite: 40 };
    set({ party: [...get().party], pendingSeaActivities: { picks: {}, day: { kmFrom: 0, kmTo: 40, hours: 24, lines: [] } } } as never);

    get().seaActivitiesConfirm({ [cartographe.id]: { activityId: 'cartographie', stashGold: 7 } });

    const casc = get().pendingCascade;
    expect(casc, 'la séquence des Activités doit être ouverte (surface M)').toBeTruthy();
    expect(casc!.purpose).toBe('seaActivities');
    const step = casc!.participants.find((s) => s.kind === 'sea-activity-chart')!;
    expect(step, 'l’étape de Cartographie doit être dans la séquence').toBeTruthy();

    // LITTÉRAL D'AVANT MIGRATION, recopié tel quel (seaActivities.ts:120-125 à `b29cbe51`).
    const hero = get().party.find((h) => h.id === cartographe.id)!;
    const test: RollRequest['test'] = { skill: 'metier', spec: 'cartographe' };
    const def = activityById('cartographie')!;
    const difficulty = def.difficulty ?? 'complexe';
    const ancien = {
      id: `sea-activity-chart-${hero.id}`, kind: 'sea-activity-chart', actorId: hero.id,
      label: composeRollLabel(hero, 'Cartographie', test), difficulty, rollLabel: 'Métier (Cartographe)',
      base: testValue(hero, 'metier', undefined, 'cartographe'), target: effectiveTarget(hero, test, difficulty),
      result: null, meta: { stashGold: 7 },
    };

    // POSSESSION posée par le mint : le jeteur EST le cartographe, pas un autre héros du groupe.
    expect(step.actorId, 'possession de l’étape (`monoStep` la pose depuis `actor`)').toBe(cartographe.id);
    expect(step.actorId, 'possession détournée vers un autre héros du groupe').not.toBe(autre.id);

    expect(step.id).toBe(ancien.id);
    expect(step.kind).toBe(ancien.kind);
    expect(step.label).toBe(ancien.label);
    expect(step.rollLabel).toBe(ancien.rollLabel);
    expect(step.difficulty).toBe(ancien.difficulty);
    expect(step.result).toBe(ancien.result);
    expect(step.meta).toEqual(ancien.meta);
    expect(step.target).toBe(ancien.target);
    // La base NUE + ses modificateurs NOMMÉS valent l'ancienne base FONDUE — rien n'a bougé du jet,
    // seule la répartition base/chips change (invariant de `rollLine`).
    expect(step.base! + sommeMods(step.mods)).toBe(ancien.base);
    expect(step.base! + sommeMods(step.mods) + DIFFICULTY_MODIFIERS[difficulty]).toBe(step.target);
  });

  /**
   * #1479 — LA SEMAINE EST **UNE** SÉQUENCE. L'émetteur ne trie plus ses étapes par surface au
   * call-site (une `RollRequest` forgée passée à `resolveSurface`, puis deux lots : un
   * `runCascadeImmediate` SILENCIEUX et une fenêtre) : il POUSSE, et `openSequence` dérive la surface
   * des porteurs (`surfaceDesEtapes`). Comportement mesuré ici : une étape résolue d'office tombe
   * DANS la fenêtre, où son bilan se lit — jamais dans un lot séparé qui ne s'affiche nulle part.
   */
  function deuxCartographes(): [Combatant, Combatant] {
    const [a, b] = get().party;
    for (const h of [a, b]) {
      (h as Combatant).skills = [{ id: 'metier', spec: 'cartographe', advances: 20 } as never];
      (h as Combatant).characteristics = { ...h.characteristics, dexterite: 40 };
    }
    return [a, b];
  }

  it('semaine MIXTE (un héros tenu, un héros conduit par l’IA) → UNE fenêtre qui porte les DEUX étapes, celle que personne ne tient déjà résolue DEDANS', () => {
    const [ia, tenu] = deuxCartographes(); // l'IA est en TÊTE : le curseur s'y pose d'abord
    set({
      party: get().party.map((h) => (h.id === ia.id ? { ...h, aiControlled: true } : h)),
      pendingSeaActivities: { picks: {}, day: { kmFrom: 0, kmTo: 40, hours: 24, lines: [] } },
    } as never);

    get().seaActivitiesConfirm({
      [tenu.id]: { activityId: 'cartographie' },
      [ia.id]: { activityId: 'cartographie' },
    });

    const casc = get().pendingCascade;
    expect(casc, 'un seul héros tenu suffit à ouvrir la fenêtre de la semaine').toBeTruthy();
    expect(casc!.purpose).toBe('seaActivities');
    const etapes = casc!.participants.filter((s) => s.kind === 'sea-activity-chart');
    expect(etapes.map((s) => s.actorId).sort(), 'les DEUX Activités sont dans la MÊME séquence — aucun lot résolu à part')
      .toEqual([tenu.id, ia.id].sort());
    expect(etapes.find((s) => s.actorId === ia.id)!.result, 'personne ne la tient : son dé tombe DANS la fenêtre, visible au bilan').toBeTruthy();
    expect(etapes.find((s) => s.actorId === tenu.id)!.result, 'celle du joueur attend SON dé').toBeNull();
  });

  it('CONTRÔLE — semaine que PERSONNE ne tient : aucune fenêtre de `seaActivities` (la sonde discrimine)', () => {
    const [a, b] = deuxCartographes();
    set({
      party: get().party.map((h) => ({ ...h, aiControlled: true })),
      pendingSeaActivities: { picks: {}, day: { kmFrom: 0, kmTo: 40, hours: 24, lines: [] } },
    } as never);

    get().seaActivitiesConfirm({
      [a.id]: { activityId: 'cartographie' },
      [b.id]: { activityId: 'cartographie' },
    });

    expect(get().pendingCascade?.purpose, 'tout est résolu d’office : rien à ouvrir').not.toBe('seaActivities');
  });

  /**
   * Chemin GÉNÉRIQUE (`sea-activity-generic`) : AUCUNE Activité de contexte 'mer' ne l'emprunte
   * aujourd'hui (`activities.json` : les trois entrées 'mer' sont `seaChart`, `opportunityTrade` et
   * `crewTraining` — cette dernière bloquée par `seaActivityBlocked`), mais la donnée est éditable au
   * Compendium. Le `def` étant un ARGUMENT du mint, il s'exerce avec une Activité 'mer' SANS résolveur
   * dérivée d'une entrée réelle d'`activities.json`, à DEUX compétences (le choix de la meilleure est exercé).
   */
  const MER = activiteMer({ id: 'releve-des-cotes', label: 'Relevé des côtes', difficulty: 'intermediaire', skills: [{ id: 'metier', spec: 'cartographe' }, { id: 'art', spec: 'cartographie' }] });

  it('chemin GÉNÉRIQUE — le MINT rend la MÊME cible et la MÊME valeur que `travelActivitySpec`, et possède le héros', () => {
    const hero = get().party[0];
    const def = MER;
    const spec = travelActivitySpec(hero, def)!;
    expect(spec.target, 'le def choisi doit lancer un Test').not.toBeNull();

    const step = avecActivite(def, () => buildSeaGenericStep(get, set, hero, def))!;
    expect(step, 'le mint doit rendre une étape (cible calculable)').toBeTruthy();
    expect(step.actorId).toBe(hero.id);
    expect(step.kind).toBe('sea-activity-generic');
    expect(step.id).toBe(`sea-activity-generic-${hero.id}`);
    expect(step.rollLabel).toBe(def.label);
    expect(step.meta).toEqual({ activityId: def.id });
    expect(step.target).toBe(spec.target);
    expect(step.base! + sommeMods(step.mods)).toBe(spec.value);
  });

  /**
   * RÈGLE OPTIONNELLE « Tests >100 % » (LDB 12 l.77) : la borne de cible vient du SEUL constructeur
   * (`clampTarget`, `engine/tests.ts`, lu de `getTestPolicy`). Le mint et `travelActivitySpec`
   * (`engine/activities.ts`) partent de la même cible brute (`cibleDuTest`) et la bornent par lui :
   * règle éteinte, plafond 99 des deux côtés ; règle active, le plafond se lève des deux côtés.
   */
  it('« Tests >100 % » — le mint et `travelActivitySpec` suivent la même policy de bornage', () => {
    const hero = get().party[0];
    (hero as Combatant).skills = [{ id: 'metier', spec: 'cartographe', advances: 200 } as never];
    (hero as Combatant).characteristics = { ...hero.characteristics, dexterite: 80 };
    set({ party: [...get().party] } as never);
    const cible = get().party[0];
    const def = MER;

    // Policy par DÉFAUT : plafond 99 des deux côtés.
    const eteint = avecActivite(def, () => buildSeaGenericStep(get, set, cible, def))!;
    expect(eteint.target).toBe(travelActivitySpec(cible, def)!.target);
    expect(eteint.target).toBe(99);

    try {
      setRule('test-over-100', true);
      const actif = avecActivite(def, () => buildSeaGenericStep(get, set, cible, def))!;
      expect(actif.target, 'le plafond se lève avec la règle').toBeGreaterThan(99);
      expect(actif.target, 'la cible est la valeur PLEINE : 80 Dex + 200 avances, Difficulté intermédiaire (+0)').toBe(280);
      expect(actif.target).toBe(actif.base! + sommeMods(actif.mods) + DIFFICULTY_MODIFIERS[def.difficulty ?? 'intermediaire']);
      expect(travelActivitySpec(cible, def)!.target, 'la même cible bornée par le constructeur').toBe(actif.target);
    } finally {
      resetRule('test-over-100');
    }
  });
});
