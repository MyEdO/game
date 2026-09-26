/**
 * #46 — Maladies transmises par l'eau (MSRC 16 l.13-61) : tables d'exposition hydrique en DONNÉE
 * (`water-exposure.json`, lookup `findTableEntry`) + Effet de scène `waterExposure` (Test de
 * Résistance Intermédiaire modifié par étape de cascade) + contraction DIRECTE sur échec
 * (« Si le Test de Résistance est raté, lancez un dé … avec un modificateur de +10 pour chaque DR
 * négatif ») — jamais un second Test de Contraction.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyEffects } from './combatFlow';
import { cascadeAppliers } from './cascade';
import { WATER_EXPOSURE } from '../data';
import { autoExposureMods, sourceExposureMod, drawWaterDisease, isWounded } from '../engine/waterExposure';
import { createHero } from '../engine/character';
import { makeRNG, type RNG } from '../engine/dice';
import { seedBattleRng } from './battleRng';
import type { Combatant } from '../engine/types';

const seq = (vals: number[]): RNG => {
  let i = 0;
  return { int: () => vals[Math.min(i++, vals.length - 1)] } as RNG;
};

function hero(name: string, over: Partial<Combatant> = {}): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: name, rng: makeRNG(1) });
  return { ...h, id: name, ...over } as Combatant;
}

describe('water-exposure.json — la donnée MSRC 16 l.23-61', () => {
  it('la table d100 partitionne 1..100 sans trou ni chevauchement', () => {
    let next = 1;
    for (const e of WATER_EXPOSURE.diseases) {
      expect(e.min).toBe(next);
      expect(e.max).toBeGreaterThanOrEqual(e.min);
      next = e.max + 1;
    }
    expect(next).toBe(101);
  });
  it('« Par État Assommé » (MSRC) → id LDB `sonne` (le LDB 16 n\'a pas d\'État « Assommé » — glissement de traduction)', () => {
    const m = WATER_EXPOSURE.modifiers.find((x) => x.id === 'par-etat-assomme')!;
    expect(m.auto).toEqual({ kind: 'perCondition', condition: 'sonne' });
    expect(m.mod).toBe(-5);
  });
  it('tableau 1 (source d\'eau) : −30 à +10, ingestion ET immersion ; tableau 2 : immersion seule', () => {
    const t1 = WATER_EXPOSURE.modifiers.filter((m) => m.table === 'source-d-eau');
    expect(t1.map((m) => m.mod)).toEqual([-30, -20, -10, 0, 10]);
    for (const m of t1) expect(m.appliesTo).toEqual(['ingestion', 'immersion']);
    for (const m of WATER_EXPOSURE.modifiers.filter((x) => x.table === 'blessures-et-etats')) expect(m.appliesTo).toEqual(['immersion']);
  });
});

describe('modificateurs dérivés du Combatant (tableau 2, « tous les modificateurs peuvent être cumulés »)', () => {
  it('1 PB restant (−30) CUMULÉ avec 5+ PB perdus (−20) + 2 Hémorragique (−10 chacun) + Inconscient (−20)', () => {
    const h = hero('h', {
      wounds: { current: 1, max: 12, base: 12 },
      conditions: [{ id: 'hemorragique', value: 2 }, { id: 'inconscient', value: 1 }],
    } as Partial<Combatant>);
    const mods = autoExposureMods(h, 'immersion');
    expect(mods.reduce((s, m) => s + m.mod, 0)).toBe(-30 - 20 - 20 - 20); // −90
  });
  it('en INGESTION, le tableau 2 ne s\'applique pas (« uniquement à l\'immersion »)', () => {
    const h = hero('h', { wounds: { current: 1, max: 12, base: 12 } } as Partial<Combatant>);
    expect(autoExposureMods(h, 'ingestion')).toEqual([]);
  });
  it('source d\'eau : « Grande ville ; marais » = −30 ; id inconnu → null (Campagne +0)', () => {
    expect(sourceExposureMod('grande-ville-marais')?.mod).toBe(-30);
    expect(sourceExposureMod(undefined)).toBeNull();
  });
});

describe('drawWaterDisease — d100 « +10 pour chaque DR négatif » + « Relancez si le Personnage n\'est pas blessé »', () => {
  it('jet 35 sans DR négatif → Courante galopante (01-40)', () => {
    expect(drawWaterDisease(0, false, seq([35]))).toMatchObject({ roll: 35, modified: 35, disease: 'courante-galopante', rerolled: 0 });
  });
  it('jet 35 + 3 DR négatifs (+30) → 65 = Infection mineure, ACCEPTÉE si blessé', () => {
    expect(drawWaterDisease(3, true, seq([35]))).toMatchObject({ modified: 65, disease: 'infection-mineure' });
  });
  it('non blessé sur une entrée ¹ → RELANCE (65 → 20 = Courante galopante)', () => {
    expect(drawWaterDisease(0, false, seq([65, 20]))).toMatchObject({ disease: 'courante-galopante', rerolled: 1 });
  });
  it('le jet modifié est plafonné à la table (95 + 30 → 100 = Flux sanglant)', () => {
    expect(drawWaterDisease(3, true, seq([95]))).toMatchObject({ modified: 100, disease: 'flux-sanglant' });
  });
});

describe('Effet de scène `waterExposure` — cascade + contraction DIRECTE', () => {
  beforeEach(() => {
    seedBattleRng(7);
    useGame.setState({ battle: null, scene: null, mode: 'exploration', flags: {}, journal: [], pendingCascade: null, gameTime: 600 });
  });

  it('ouvre UNE étape par héros exposé : base = Résistance NUE, les modificateurs cumulés sont des lignes NOMMÉES', () => {
    const h1 = hero('h1', { wounds: { current: 1, max: 12, base: 12 } } as Partial<Combatant>);
    const h2 = hero('h2');
    useGame.setState({ party: [h1, h2] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'waterExposure', mode: 'immersion', source: 'grande-ville-marais', target: 'party' }]);
    const pc = useGame.getState().pendingCascade!;
    expect(pc.participants).toHaveLength(2);
    const s1 = pc.participants.find((s) => s.actorId === 'h1')!;
    const s2 = pc.participants.find((s) => s.actorId === 'h2')!;
    expect(s1.kind).toBe('waterExposure');
    // La ligne est montée par le monteur canonique : la base est le Niveau de Compétence NU (Résistance,
    // E 42), IDENTIQUE pour les deux — ce qui les sépare s'AFFICHE au lieu de fondre dans la base.
    expect([s1.base, s2.base]).toEqual([42, 42]);
    // La source d'eau (−30) touche les DEUX ; h1 cumule EN PLUS ses mods dérivés : 1 PB restant (−30)
    // + 11 PB perdus ≥ 5 (−20) — chaque tableau rend SA ligne, liée à la fiche qui l'octroie (MSRC 16).
    expect(s2.mods).toEqual([
      { label: 'Grande ville ; marais', value: -30, famille: 'jet', ref: { category: 'regles', id: 'exposition-hydrique' } },
    ]);
    expect(s1.mods?.map((m) => [m.label, m.value])).toEqual([
      ['Grande ville ; marais', -30],
      ['1 Blessure ou moins restante', -30],
      ['5 Blessures ou plus perdues', -20],
    ]);
    // Ce qui SÉPARE les deux héros (50) se lit dans la somme de leurs lignes.
    const somme = (s: typeof s1): number => (s.mods ?? []).reduce((t, m) => t + m.value, 0);
    expect(somme(s2) - somme(s1)).toBe(50);
    // Cible : Résistance nue + modificateurs + Difficulté (Intermédiaire +0), bornée par la MÊME
    // primitive que `rollTest` — le plancher subi par h1 est RENDU (`clamped`), il n'est plus muet.
    expect([s2.target, s2.clamped]).toEqual([12, undefined]); // 42 − 30
    expect([s1.target, s1.clamped]).toEqual([1, 39]); // 42 − 80 = −38 → plancher 1, écart RENDU
  });

  it('échec de l\'étape → maladie contractée DIRECTEMENT (incubation normale, pas de second Test)', () => {
    const h = hero('h1');
    useGame.setState({ party: [h] });
    const out = cascadeAppliers['waterExposure'].apply(
      useGame.getState, useGame.setState,
      { id: 'w1', kind: 'waterExposure', actorId: 'h1', result: { roll: 99, target: 40, sl: -5, success: false } } as never,
      h, { steps: [], index: 0 },
    );
    expect((h.diseases ?? []).length).toBe(1); // contractée sans Test supplémentaire
    expect(out?.consequences?.length).toBeGreaterThan(0);
  });

  it('réussite de l\'étape → rien de contracté', () => {
    const h = hero('h1');
    useGame.setState({ party: [h] });
    cascadeAppliers['waterExposure'].apply(
      useGame.getState, useGame.setState,
      { id: 'w1', kind: 'waterExposure', actorId: 'h1', result: { roll: 3, target: 40, sl: 3, success: true } } as never,
      h, { steps: [], index: 0 },
    );
    expect(h.diseases ?? []).toHaveLength(0);
  });

  it('isWounded : PB courants < max', () => {
    expect(isWounded(hero('h', { wounds: { current: 3, max: 12, base: 12 } } as Partial<Combatant>))).toBe(true);
    expect(isWounded(hero('h'))).toBe(false);
  });
});
