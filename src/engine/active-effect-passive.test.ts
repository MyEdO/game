/**
 * `ActiveEffect.passive` — canal UNIQUE des passifs d'un effet actif (#1791). Ce que le contrat exige :
 * une op posée par `applyOps` s'annonce au nom de l'effet qui la porte (`src`/`label`), donc la
 * Dissipation, la Détermination (`LDB 17 l.61`) et la suspension générale (`engine/suspension.ts`)
 * l'emportent comme n'importe quel autre passif, jusqu'au consommateur NUMÉRIQUE.
 */
import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import type { CodexTarget } from './ruleRefs';
import { applyOps, type Formula } from './ops';
import { makeRNG } from './dice';
import { passiveMods, traumaMovementHalved, passiveMoveMod, cannotWieldTwoHanded, traumaSkillPenalty } from './trauma';
import { suspendSource } from './suspension';
import { removeActiveEffects } from './conditions';
import { effectiveMovement } from './encumbrance';
import { deFixe, desDuTest } from './dice.testkit';

function hero(p: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', label: 'Cobaye', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 45, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 38, sociabilite: 30 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ id: 'marchandage', advances: 15 }], talents: [],
    ...p,
  } as Combatant;
}

const SORT_ID = 'toile-de-lumiere';
const SOURCE: CodexTarget = { category: 'spells', id: SORT_ID };
const LABEL = 'Toile de lumière';
const CTX = { label: LABEL, source: { kind: 'spell' as const, id: SORT_ID }, defaultDurationRounds: 3, now: 0, rng: makeRNG(7) };

/** Les quatre ops qui vivaient en champs SCALAIRES de l'`ActiveEffect` avant #1791. */
const OPS = [
  { op: 'moveScale' as const, num: 1, den: 2 },
  { op: 'moveMod' as const, mod: -2 },
  { op: 'maxWeaponHands' as const, hands: 1 },
  { op: 'skillMod' as const, skill: { id: 'marchandage' }, mod: -20 },
];

function lanceLeSort(): Combatant {
  const c = hero();
  applyOps(c, OPS, { ...CTX, rng: makeRNG(7) });
  return c;
}

/** Les `PassiveMod` émis pour les op-types du lot (le reste du collecteur ne concerne pas ce contrat). */
function modsDuLot(c: Combatant) {
  const types = new Set(OPS.map((o) => o.op));
  return passiveMods(c).filter((m) => types.has(m.op.op as typeof OPS[number]['op']));
}

describe('ActiveEffect.passive — les ops d’un effet portent leur source', () => {
  it('chaque op posée vit dans `passive`, et `passiveMods` la rend avec `src` + `label` de l’effet', () => {
    const c = lanceLeSort();
    expect(c.activeEffects).toHaveLength(4);
    for (const o of OPS) {
      expect(c.activeEffects!.some((e) => (e.passive ?? []).some((p) => p.op === o.op))).toBe(true);
    }
    const mods = modsDuLot(c);
    expect(mods).toHaveLength(4);
    for (const m of mods) {
      expect(m.src).toEqual(SOURCE);
      expect(m.label).toBe(LABEL);
    }
  });

  it('les consommateurs NUMÉRIQUES lisent ces ops : M ×½ −2, arme à une main, −20 Marchandage', () => {
    const c = lanceLeSort();
    expect(traumaMovementHalved(c)).toBe(true);
    expect(passiveMoveMod(c)).toBe(-2);
    expect(effectiveMovement(c)).toBe(1); // (4 − 2) ÷ 2
    expect(cannotWieldTwoHanded(c)).toBe(true);
    expect(traumaSkillPenalty(c, 'marchandage')).toBe(-20);
  });

  it('source SUSPENDUE → plus aucun passif ni aucun effet numérique ; la suspension levée, tout revient', () => {
    const c = lanceLeSort();
    suspendSource(c, SOURCE, { scale: 'rounds', left: 1 }, 'Détermination', 'determination');
    expect(modsDuLot(c)).toHaveLength(0);
    expect(traumaMovementHalved(c)).toBe(false);
    expect(passiveMoveMod(c)).toBe(0);
    expect(effectiveMovement(c)).toBe(4);
    expect(cannotWieldTwoHanded(c)).toBe(false);
    expect(traumaSkillPenalty(c, 'marchandage')).toBe(0);

    removeActiveEffects(c, (e) => e.effectId === 'determination');
    expect(modsDuLot(c)).toHaveLength(4);
    expect(effectiveMovement(c)).toBe(1);
    expect(cannotWieldTwoHanded(c)).toBe(true);
    expect(traumaSkillPenalty(c, 'marchandage')).toBe(-20);
  });

  it('durée : intrinsèque à l’op quand elle en porte une (`durationRounds`), sinon celle du contexte', () => {
    const c = hero();
    applyOps(c, [
      { op: 'maxWeaponHands', hands: 1, durationRounds: 2 },
      { op: 'moveScale', num: 1, den: 2 },
    ], { ...CTX, rng: makeRNG(7) });
    const mains = c.activeEffects!.find((e) => (e.passive ?? []).some((p) => p.op === 'maxWeaponHands'))!;
    const mouvement = c.activeEffects!.find((e) => (e.passive ?? []).some((p) => p.op === 'moveScale'))!;
    expect(mains.duration).toEqual({ scale: 'rounds', left: 2 });
    expect(mouvement.duration).toEqual({ scale: 'rounds', left: 3 });
    // La durée est CONSOMMÉE à la pose : l'op passive ne la retransporte pas (elle serait rejouée).
    expect(mains.passive![0]).toEqual({ op: 'maxWeaponHands', hands: 1 });
  });

  it('PLANCHER de Rounds : porté par la FORMULE de l’entrée, jamais par le site d’appel', () => {
    // « Durée : (Bonus de Force Mentale) Rounds » (VDM 15 l.406) — aucun minimum : à FM < 10, zéro Round.
    const faible = hero({ characteristics: { ...hero().characteristics, 'force-mentale': 9 } });
    applyOps(faible, [{ op: 'charMod', char: 'agilite', mod: -10, durationRounds: { bonusOf: 'force-mentale' } }], { rng: desDuTest, label: 'Écorce' });
    expect(faible.activeEffects![0].duration).toEqual({ scale: 'rounds', left: 0 });

    // « inutilisable pour 1d10 − (Bonus d'Endurance) Rounds (minimum de 1) » (AA 07 l.113) : BE 10, d10 = 1.
    const NUE: Formula = { sum: [{ dice: { n: 1, sides: 10 } }, { times: { of: { bonusOf: 'endurance' }, factor: -1 } }] };
    const costaud = hero({ characteristics: { ...hero().characteristics, endurance: 100 } });
    applyOps(costaud, [{ op: 'maxWeaponHands', hands: 1, durationRounds: { minimum: 1, of: NUE } }], { label: 'Choc au bras', rng: deFixe(1) });
    expect(costaud.activeEffects![0].duration).toEqual({ scale: 'rounds', left: 1 });

    // La MEME op sans la borne : le moteur ne la remet pas — zéro Round, comme toute autre durée.
    const sansBorne = hero({ characteristics: { ...hero().characteristics, endurance: 100 } });
    applyOps(sansBorne, [{ op: 'maxWeaponHands', hands: 1, durationRounds: NUE }], { label: 'Choc au bras', rng: deFixe(1) });
    expect(sansBorne.activeEffects![0].duration).toEqual({ scale: 'rounds', left: -9 });
  });

  it('journal d’un `charMod` : fragment de durée en minutes seulement si l’op porte SON horloge', () => {
    const herite = hero();
    const ligneHeritee = applyOps(herite, [{ op: 'charMod', char: 'agilite', mod: -10 }], { rng: desDuTest, label: 'Écorce', defaultUntilTime: 600 });
    expect(ligneHeritee[0]).toMatch(/durée hors combat/); // échéance du CONTEXTE : une date, pas un décompte

    const propre = hero();
    const lignePropre = applyOps(propre, [{ op: 'charMod', char: 'agilite', mod: -10, durationHours: 1 }], { rng: desDuTest, label: 'Écorce', now: 0 });
    expect(lignePropre[0]).toMatch(/1 heure/);
  });

  it('effets RETIRÉS (Dissipation, expiration, purge) → plus un seul passif du sort', () => {
    const c = lanceLeSort();
    removeActiveEffects(c, (e) => e.source?.id === SORT_ID);
    expect(modsDuLot(c)).toHaveLength(0);
    expect(effectiveMovement(c)).toBe(4);
    expect(cannotWieldTwoHanded(c)).toBe(false);
    expect(traumaSkillPenalty(c, 'marchandage')).toBe(0);
  });
});
