import { describe, it, expect } from 'vitest';
import { opposedLines } from './breakdown';
import { baseTestModLines, baseTestMods, type ModLine } from '../engine/combat';
import { DIFFICULTY_MODIFIERS, type Difficulty } from '../engine/types';
import type { Combatant } from '../engine/types';
import { conditionIds } from '../data';

/**
 * FABRIQUE de PAIRE OPPOSÉE (`opposedLines`, #1112 G1) — LDB 12 l.166 : « Si aucune Difficulté n'est
 * indiquée pour un Test opposé, on considère qu'il est Intermédiaire. » La Difficulté se déclare UNE
 * fois pour l'opposition entière, jamais ligne à ligne ; chaque ligne sort prête pour `RollShell`
 * (`d` si le jet est lancé, `pending` sinon).
 */
describe('opposedLines — la Difficulté est déclarée UNE fois pour l’opposition', () => {
  it('sans Difficulté déclarée, TOUTES les lignes valent Intermédiaire (LDB 12 l.166)', () => {
    const [a, b] = opposedLines([
      { label: 'Corps à corps', base: 45, r: { roll: 30, target: 45, sl: 1, success: true } },
      { label: 'Esquive', base: 38 },
    ]);
    expect(a.d!.difficulty).toBe('intermediaire');
    expect(b.pending!.difficulty).toBe('intermediaire');
    expect(a.pending).toBeUndefined(); // ligne lancée → pas de pré-jet
    expect(b.d).toBeUndefined();
  });

  it('une Difficulté déclarée s’applique à toutes les lignes, et entre dans la cible du pré-jet', () => {
    const [a, b] = opposedLines([
      { label: 'Force', base: 40 },
      { label: 'Force', base: 50 },
    ], 'accessible');
    expect(a.pending!.difficulty).toBe('accessible');
    expect(b.pending!.difficulty).toBe('accessible');
    expect(a.pending!.target).toBe(60); // 40 + 20
    expect(b.pending!.target).toBe(70);
  });

  it('la ligne LANCÉE garde la cible MESURÉE (le modificateur en est déduit, jamais recalculé)', () => {
    const [a] = opposedLines([{ label: 'Marchandage', base: 55, r: { roll: 62, target: 45, sl: -2, success: false } }]);
    expect(a.d!.target).toBe(45);
    expect(a.d!.modifier).toBe(-10);
    expect(a.d!.success).toBe(false);
    expect(a.d!.sl).toBe(-2);
  });

  it('les modificateurs circonstanciels restent des chips NOMMÉES, distinctes de la Difficulté', () => {
    const [a] = opposedLines([{ label: 'Navigation', base: 45, mods: [{ label: 'Hors de contrôle', value: -20, famille: 'jet' }] }]);
    expect(a.pending!.mods).toEqual([{ label: 'Hors de contrôle', value: -20, famille: 'jet' }]);
    expect(a.pending!.difficulty).toBe('intermediaire');
    expect(a.pending!.target).toBe(25); // 45 + 0 (Difficulté) − 20 (chip nommée)
  });

  it('un adversaire OPAQUE garde son masque d’affichage (les valeurs restent exactes)', () => {
    const [a] = opposedLines([{ label: 'Marchandage', base: 60, r: { roll: 12, target: 60, sl: 4, success: true }, mask: 'value' }]);
    expect(a.d!.mask).toBe('value');
    expect(a.d!.base).toBe(60);
  });
});

/**
 * INVARIANT #4 — aucun +N ANONYME : sur les Tests opposés « bruts » de combat (Empoignade LDB 14 l.161,
 * Au Contact, Désengagement LDB 15 l.49), la cible que roule le résolveur inclut `baseTestMods`
 * (Avantage ×10 + États + météo). Ces composantes doivent arriver à la ligne en chips NOMMÉES, sinon
 * l'écart `target − base` s'affiche en modificateur sans nom.
 */
describe('lignes opposées de combat — l’écart à la base est TOUJOURS couvert par des chips nommées (#1112 G8b)', () => {
  /** Combattant MINIMAL : seules les entrées lues par `baseTestModLines` (Avantage, États, météo). */
  const hero = (over: Partial<Combatant> = {}): Combatant => ({
    id: 'c', label: 'Ragnar', advantage: 0, conditions: [], activeEffects: [], ...over,
  } as unknown as Combatant);

  it('`baseTestModLines` NOMME exactement ce que `baseTestMods` ajoute au jet (aucune part muette)', () => {
    const penalisant = conditionIds().find((id) => baseTestMods(hero({ conditions: [{ id, value: 1 }] as Combatant['conditions'] }), 'capacite-de-combat') !== 0);
    expect(penalisant, 'le registre porte un État qui pénalise la CC').toBeDefined();
    for (const c of [hero(), hero({ advantage: 3 }), hero({ advantage: 1, conditions: [{ id: penalisant!, value: 2 }] as Combatant['conditions'] })]) {
      const lines = baseTestModLines(c, 'capacite-de-combat');
      expect(lines.reduce((s, l) => s + l.value, 0)).toBe(baseTestMods(c, 'capacite-de-combat'));
      for (const l of lines) expect(l.label.length).toBeGreaterThan(0); // aucune chip sans nom
    }
  });

  it('une ligne opposée dont la cible dépasse la base porte des chips qui EXPLIQUENT tout l’écart', () => {
    const c = hero({ advantage: 2 });
    const mods = baseTestModLines(c, 'force');
    const base = 40;
    const target = base + baseTestMods(c, 'force');
    const [line] = opposedLines([{ label: 'Force', base, r: { roll: 30, target, sl: 2, success: true }, mods }]);
    expect(line.d!.target - line.d!.base).toBe(20); // Avantage ×10 = +20
    expect(line.d!.mods!.reduce((s, l) => s + l.value, 0)).toBe(line.d!.modifier); // rien d'anonyme
    expect(line.d!.mods!.map((m) => m.label)).toContain('Avantage');
  });
});

/**
 * #1117 G2 — CONTRAT ARITHMÉTIQUE d'une ligne de jet : tout l'écart entre la base affichée et la cible
 * est EXPLIQUÉ — Σ(chips nommées) + Difficulté == modifier. Le filet « autres » (`ui/RollLine.tsx`)
 * n'est alors jamais sollicité : un résidu inexpliqué est un BUG (il doit rougir ici), pas une
 * information à afficher au joueur.
 */
describe('contrat arithmétique d’une ligne de cascade (#1117 G2)', () => {
  /** Ce que la ligne AFFICHE, tel que `CascadeModal.stepLine` le compose : la `base` de l'étape est
   *  NUE, ses `mods` portent TOUT le nommé (Soutien compris). */
  const emission = (step: { base?: number; target?: number; mods?: ModLine[]; difficulty?: Difficulty }) => {
    const base = step.base ?? step.target ?? 0;
    const all = step.mods ?? [];
    const modifier = (step.target ?? 0) - base;
    const dv = step.difficulty ? DIFFICULTY_MODIFIERS[step.difficulty] : 0;
    return { base, mods: all, modifier, dv, residual: modifier - dv - all.reduce((s, m) => s + m.value, 0) };
  };

  it('Soutien + Difficulté : tout l’écart est expliqué, résidu ZÉRO', () => {
    // Cas de la sonde : porteur NU 69, Soutien +20 en ligne de mod, Très difficile (−30) → cible 59.
    const e = emission({ base: 69, target: 59, mods: [{ label: 'Soutien', value: 20, famille: 'jet' as const }], difficulty: 'tresDifficile' });
    expect(e.base, 'la base affichée est la valeur NUE du porteur').toBe(69);
    expect(e.mods.map((m) => m.label)).toEqual(['Soutien']);
    expect(e.residual, 'aucun résidu : Σchips + Difficulté == modifier').toBe(0);
  });

  it('malus NOMMÉ (dérive) + Difficulté : résidu ZÉRO', () => {
    const e = emission({ base: 45, target: 25, mods: [{ label: 'Hors de contrôle', value: -20, famille: 'jet' }], difficulty: 'intermediaire' });
    expect(e.residual).toBe(0);
  });

  it('un écart NON itemisé est un BUG : le résidu est non nul et se voit ICI (jamais « autres » au joueur)', () => {
    const e = emission({ base: 50, target: 30, difficulty: 'intermediaire' }); // −20 venu de nulle part
    expect(e.residual, 'ce cas doit être impossible en production — s’il apparaît, itemiser la source').toBe(-20);
  });
});
