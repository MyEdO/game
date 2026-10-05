/**
 * Départage d'égalité, DÉ POSÉ et seam de CASCADE — LDB 12 l.160 (#1150).
 *
 * « Si les deux participants obtiennent le même DR, c'est le groupe avec la Compétence ou la
 * Caractéristique la plus élevée qui l'emporte » — la Compétence étant, `LDB 09 l.17`, la
 * Caractéristique associée + les Augmentations.
 *
 * Trois câblages que le moteur pur ne voit pas :
 *  1. Contre-sort : un dé SAISI reconstruit le Test du chanteur — sa nue est RELUE par
 *     `counterspellOutcomeFrom`, jamais héritée de la valeur testée (Soutien compris) ;
 *  2. Opposition d'incantation (Résistance à la Magie) : la nue de la CIBLE doit survivre au dé posé ;
 *  3. Cascade opposée : l'étape jette sur une cible DÉJÀ modifiée par sa Difficulté — le `base` que
 *     le seam de jet y poserait est une CIBLE ; c'est la `base` authorée de l'étape qui doit servir,
 *     sans quoi l'opposition compare une cible à la nue de l'attaquant figé.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import type { Combatant } from '../engine/types';
import { cascadeDeTest } from './cascadeTestKit';
import type { CascadeRollStep, CascadeStep } from './pendings';

const mk = (id: string, kind: Combatant['kind'] = 'hero', over: Partial<Combatant> = {}): Combatant => ({
  id, name: id, label: id, kind,
  characteristics: { force: 40, dexterite: 40, agilite: 40, endurance: 40, 'force-mentale': 30, 'capacite-de-combat': 45, 'capacite-de-tir': 45, initiative: 40, intelligence: 30, sociabilite: 40 },
  wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], traumas: [],
  resilience: 3, fortune: 2, weapons: [], items: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  skills: [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 15 }],
  talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
  ...over,
} as unknown as Combatant);

/** Incantation ENNEMIE figée : Niveau de Compétence 60, cible testée 25 (Difficile + ward), dé 13 → DR 1. */
const ENEMY_CAST = { cast: true, roll: 13, target: 25, base: 60, sl: 1, isCritical: false, isFumble: false, log: '' };
/** Jet raté de départ du participant — le dé posé le remplace. */
const RATE = { roll: 88, target: 30, base: 30, sl: -6, success: false, isDouble: true };
/** Dé posé : 23 sur cible 30 → DR 1, à ÉGALITÉ avec l'incantation figée. */
const POSE = 23;

const st = () => useGame.getState() as unknown as Record<string, (...a: unknown[]) => void>;
const P = <T,>(k: string): T => (useGame.getState() as unknown as Record<string, T>)[k];

beforeEach(() => {
  // Le héros A a Int 30 + 15 Augmentations = Niveau de Compétence 45 en Langue (Magick).
  const A = mk('A'), E = mk('E', 'enemy');
  useGame.setState({
    party: [A],
    battle: { combatants: [A, E], log: [], order: ['A', 'E'], turn: 0, round: 1 } as never,
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
    pendingCounterspell: null,
    pendingCastOpposition: null,
    pendingCascade: null,
    pendingCast: { casterId: 'E', targetId: 'A', spellId: 'drain', missile: false, focused: false, result: ENEMY_CAST },
  } as never);
});

describe('LDB 12 l.160 — dé POSÉ sur un Test opposé d’incantation (#1150)', () => {
  it('Contre-sort : la nue du chanteur est RELUE (45), pas héritée de la cible ni du Soutien — le lanceur 60 l’emporte', () => {
    useGame.setState({ pendingCounterspell: { participants: [
      // `base: 30` sur le jet de départ = une valeur TESTÉE quelconque : elle ne doit pas servir au départage.
      { id: 'A', interactive: true, declared: 'solo', result: { dispelled: false, counter: { ...RATE }, casterNetSL: 7, log: '' } },
    ] } } as never);
    st().counterspellSetForcedRoll('A', POSE);

    const part = P<{ participants: { result: { dispelled: boolean; counter: { roll: number; sl: number; base?: number } } }[] }>('pendingCounterspell').participants[0];
    expect(part.result.counter.roll).toBe(POSE);
    expect(part.result.counter.sl, 'le dé posé donne bien le MÊME DR que l’incantation figée').toBe(ENEMY_CAST.sl);
    expect(part.result.counter.base, 'la nue du chanteur doit être relue à sa source (Int 30 + 15 Augmentations)').toBe(45);
    expect(part.result.dispelled, 'à DR égal, la nue 60 du lanceur bat les 45 du chanteur').toBe(false);
  });

  it('Contre-sort : le chanteur le plus compétent dissipe, à DR égal', () => {
    useGame.setState({ party: [mk('A', 'hero', { skills: [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 45 }] })] } as never);
    const b = useGame.getState().battle!;
    useGame.setState({ battle: { ...b, combatants: [useGame.getState().party[0], b.combatants[1]] } } as never);
    useGame.setState({ pendingCounterspell: { participants: [
      { id: 'A', interactive: true, declared: 'solo', result: { dispelled: false, counter: { ...RATE }, casterNetSL: 7, log: '' } },
    ] } } as never);
    st().counterspellSetForcedRoll('A', POSE);

    const part = P<{ participants: { result: { dispelled: boolean; counter: { base?: number } } }[] }>('pendingCounterspell').participants[0];
    expect(part.result.counter.base, 'Int 30 + 45 Augmentations').toBe(75);
    expect(part.result.dispelled, 'nue 75 > 60 : le Sort est dissipé').toBe(true);
  });

  it('Opposition d’incantation (Résistance à la Magie) : la nue de la cible survit au dé posé', () => {
    useGame.setState({ pendingCastOpposition: { kind: 'resist', char: 'force-mentale', menace: 'magie', participants: [
      { id: 'A', interactive: true, result: { oppose: { ...RATE }, resisted: false, margin: 7 } },
    ] } } as never);
    st().oppositionSetForcedRoll('A', POSE);

    const part = P<{ participants: { result: { resisted: boolean; oppose: { roll: number; sl: number; base?: number } } }[] }>('pendingCastOpposition').participants[0];
    expect(part.result.oppose.roll).toBe(POSE);
    expect(part.result.oppose.sl).toBe(ENEMY_CAST.sl);
    expect(part.result.oppose.base, 'la valeur nue de la cible n’a pas survécu au dé posé').toBe(30);
    expect(part.result.resisted, 'à DR égal, la nue 60 du lanceur bat les 30 de la cible').toBe(false);
  });
});

describe('LDB 12 l.160 — seam de CASCADE opposée : la nue de l’étape, jamais sa cible (#1150)', () => {
  /** Étape opposée : Compétence NUE 45, Difficulté Difficile (−20) → cible 25. L'attaquant figé porte
   *  une nue de 40 et le MÊME DR : seul le départage par la Compétence peut trancher. */
  const step = (over: Partial<CascadeRollStep> = {}): CascadeStep => ({
    id: 's1', kind: 'test', actorId: 'A', rollLabel: 'Force Mentale',
    base: 45, target: 25, difficulty: 'difficile',
    meta: { opposed: { aT: { roll: 13, target: 40, base: 40, sl: 1, success: true, isDouble: false }, attackerId: 'E', attackerName: 'E', attackerLabel: 'Force' } },
    result: { roll: 88, target: 25, sl: -6, success: false },
    ...over,
  });

  const openCascade = (s: CascadeStep) =>
    useGame.setState({ pendingCascade: cascadeDeTest([s], { purpose: 'combat' }) });

  it('CONTRAT (c) : le dé posé oppose la BASE de l’étape (45), pas sa cible modifiée (25)', () => {
    openCascade(step());
    st().cascadeSetForcedRoll('s1', POSE); // 23 sur cible 25 → DR 2-2 = 0… → cf. assertion de DR ci-dessous

    const r = P<{ participants: { result: { roll: number; sl: number; success: boolean } }[] }>('pendingCascade').participants[0].result;
    expect(r.roll).toBe(POSE);
    // DR du défenseur (0) < DR de l'attaquant (1) : l'attaquant l'emporte sur le DR, sans départage.
    expect(r.success).toBe(false);
  });

  it('CONTRAT (c) : à DR ÉGAL, la nue 45 de l’étape bat la nue 40 de l’attaquant figé (la cible 25 perdrait)', () => {
    openCascade(step());
    st().cascadeSetForcedRoll('s1', 13); // 13 sur cible 25 → DR 2-1 = 1, ÉGAL au DR figé de l'attaquant

    const r = P<{ participants: { result: { roll: number; sl: number; success: boolean } }[] }>('pendingCascade').participants[0].result;
    expect(r.roll).toBe(13);
    expect(r.sl, 'DR égal : le départage par la Compétence est bien le sujet').toBe(1);
    expect(r.success, 'nue 45 > 40 : l’attaquant ne l’emporte pas, le défenseur RÉSISTE').toBe(true);
  });

  it('CONTRAT (c) : une étape SANS base authorée retombe sur les cibles des DEUX camps (jamais un mixte)', () => {
    openCascade(step({ base: undefined }));
    st().cascadeSetForcedRoll('s1', 13);

    const r = P<{ participants: { result: { sl: number; success: boolean } }[] }>('pendingCascade').participants[0].result;
    expect(r.sl).toBe(1);
    // Cibles : 40 (attaquant) > 25 (étape) → l'attaquant l'emporte, le défenseur ne résiste pas.
    expect(r.success).toBe(false);
  });

  it('CONTRAT (c) : chemin RNG (`cascadeRoll`) — à chaque DR égal rencontré, le verdict suit la Compétence', () => {
    // Le jet RNG de l'étape est lancé sur la cible DÉJÀ modifiée : c'est là que le seam poserait une
    // CIBLE en guise de Niveau de Compétence. Propriété vérifiée sur 60 graines, sur les seuls tirages
    // qui ATTEIGNENT l'égalité de DR (les autres sont tranchés par le DR, LDB 12 l.160 première phrase).
    let egalites = 0;
    for (let seed = 1; seed <= 60; seed++) {
      useGame.getState().seedRng(seed);
      openCascade(step({ result: null }));
      st().cascadeRoll('s1');
      const r = P<{ participants: { result: { sl: number; success: boolean } | null }[] }>('pendingCascade').participants[0].result;
      if (!r || r.sl !== 1) continue; // 1 = DR de l'attaquant figé
      egalites++;
      expect(r.success, `graine ${seed} : à DR égal, la nue 45 de l’étape bat les 40 de l’attaquant`).toBe(true);
    }
    expect(egalites, 'aucune égalité de DR rencontrée : la propriété n’aurait rien mesuré').toBeGreaterThan(0);
  });
});
