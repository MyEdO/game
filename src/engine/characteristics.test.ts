import { describe, it, expect } from 'vitest';
import { effectiveChar, volatileCharLines } from './characteristics';
import { testValue } from './skills';
import { passiveCharSum, traumaById, dechirureFractureFicheId } from './trauma';
import type { Combatant, CharKey, EffectSource } from './types';

/** Combatant minimal : seuls `characteristics` et `activeEffects` importent ici (pool non-cumul). */
function mk(activeEffects: { char: CharKey; bonus: number; label?: string; source?: EffectSource }[] = [], F = 40, over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c', label: 'c', kind: 'enemy', advantage: 0, conditions: [],
    characteristics: { force: F, agilite: 30, 'capacite-de-combat': 40 } as never,
    activeEffects: activeEffects.map((e) => ({ label: e.label ?? 'Effet', ...e })) as never,
    psychState: [], psychTraits: [], groups: [], weapons: [], armour: {} as never,
    skills: [], talents: [], movement: 4, wounds: { current: 10, max: 10 },
    ...over,
  } as Combatant;
}

/** Source frappée par tout lancement, Prières comprises (`runCastFlow`, `src/state/combatFlow.ts`) :
 *  le pool se lit à l'id du catalogue, jamais au `kind`. */
const SORT = (id: string): EffectSource => ({ kind: 'spell', id });

describe('effectiveChar — pools de non-cumul (LDB 46 l.119, LDB 40 l.19) ; le reste se somme (LDB 14 l.95)', () => {
  it('aucun effet actif → valeur de base', () => {
    expect(effectiveChar(mk(), 'force')).toBe(40);
  });
  it('Sorts : seul le MEILLEUR bonus s’applique (+20, +10 → +20)', () => {
    expect(effectiveChar(mk([{ char: 'force', bonus: 20, source: SORT('a') }, { char: 'force', bonus: 10, source: SORT('b') }]), 'force')).toBe(60);
  });
  it('Sorts : seule la PIRE pénalité s’applique (−10, −20 → −20)', () => {
    expect(effectiveChar(mk([{ char: 'force', bonus: -10, source: SORT('a') }, { char: 'force', bonus: -20, source: SORT('b') }]), 'force')).toBe(20);
  });
  it('Sorts : meilleur bonus + pire pénalité (+20, +10, −10 → +10 net)', () => {
    expect(effectiveChar(mk([{ char: 'force', bonus: 20, source: SORT('a') }, { char: 'force', bonus: 10, source: SORT('b') }, { char: 'force', bonus: -10, source: SORT('c') }]), 'force')).toBe(50);
  });
  it('la MÊME Prière ne se cumule pas ; deux Prières différentes se somment ; Prière + Sort se somment', () => {
    expect(effectiveChar(mk([{ char: 'force', bonus: 10, source: SORT('benediction-de-bataille') }, { char: 'force', bonus: 10, source: SORT('benediction-de-bataille') }]), 'force')).toBe(50);
    expect(effectiveChar(mk([{ char: 'force', bonus: 10, source: SORT('benediction-de-bataille') }, { char: 'force', bonus: 10, source: SORT('prouesses-martiales') }]), 'force')).toBe(60);
    expect(effectiveChar(mk([{ char: 'force', bonus: 10, source: SORT('benediction-de-bataille') }, { char: 'force', bonus: -20, source: SORT('malediction-d-anraheir') }]), 'force')).toBe(30);
  });
  it('effets hors pool (non magiques) : sommés', () => {
    expect(effectiveChar(mk([{ char: 'force', bonus: -10 }, { char: 'force', bonus: -20 }]), 'force')).toBe(10);
  });
  it('effets ciblant une AUTRE caractéristique → ignorés', () => {
    expect(effectiveChar(mk([{ char: 'agilite', bonus: 30 }]), 'force')).toBe(40);
  });
});

describe('volatileCharLines — décomposition étiquetée des contributions retenues (issue #202)', () => {
  it('invariant : Σ(lines.value) = effectiveChar − characteristics − passiveCharSum, pour tout combattant', () => {
    const c = mk([{ char: 'capacite-de-combat', bonus: 20, label: 'Bénédiction de Bataille', source: SORT('a') }, { char: 'capacite-de-combat', bonus: 10, label: 'Autre buff', source: SORT('b') }, { char: 'capacite-de-combat', bonus: -10, label: 'Malédiction' }]);
    const sum = volatileCharLines(c, 'capacite-de-combat').reduce((s, l) => s + l.value, 0);
    expect(sum).toBe(effectiveChar(c, 'capacite-de-combat') - c.characteristics['capacite-de-combat'] - passiveCharSum(c, 'capacite-de-combat'));
  });

  it('un seul buff +10 CC → une ligne étiquetée, `famille: jet` (hors table des Difficultés)', () => {
    const c = mk([{ char: 'capacite-de-combat', bonus: 10, label: 'Bénédiction de Bataille' }]);
    expect(volatileCharLines(c, 'capacite-de-combat')).toEqual([{ label: 'Bénédiction de Bataille', value: 10, famille: 'jet' }]);
  });

  it('Sorts +20/+10/−10 même carac → seules les lignes gagnantes (+20 et −10), le +10 dominé absent', () => {
    const c = mk([
      { char: 'capacite-de-combat', bonus: 20, label: 'Sort A', source: SORT('a') },
      { char: 'capacite-de-combat', bonus: 10, label: 'Sort B', source: SORT('b') },
      { char: 'capacite-de-combat', bonus: -10, label: 'Sort C', source: SORT('c') },
    ]);
    const lines = volatileCharLines(c, 'capacite-de-combat');
    expect(lines.map((l) => [l.label, l.value])).toEqual([['Sort A', 20], ['Sort C', -10]]);
    expect(lines.reduce((s, l) => s + l.value, 0)).toBe(10);
  });

  /**
   * RÉÉCRIT (#1153) : ce test verrouillait le libellé de FAMILLE « Séquelle ». Une composante se nomme
   * par son OCTROYEUR — la MÊME séquelle disait déjà « Fracture (Majeure) » sur le canal `skillMod`
   * (`skills.testValueParts`) et « Séquelle » sur le canal `charMod` qui alimente la modale d'ATTAQUE.
   * Le nom attendu est celui que le `Trauma` PORTE, et il est le même sur les deux canaux.
   */
  it('séquelle → ligne au NOM de la séquelle, sommée avec la pénalité d’un Sort (hors pool)', () => {
    const trauma = traumaById(dechirureFractureFicheId('fracture', 'majeur', 'corps'), undefined, 'corps');
    const c = mk([], 40, { traumas: [trauma] });
    const lines = volatileCharLines(c, 'force');
    expect(lines).toEqual([{ label: trauma.label, value: -30, famille: 'jet', ref: undefined }]);
    expect(lines[0].label).not.toBe('Séquelle'); // le nom de la FAMILLE n'est pas un nom d'octroyeur
    expect(effectiveChar(c, 'force')).toBe(40 - 30);
    const maudit = mk([{ char: 'force', bonus: -10, label: 'Sort', source: SORT('a') }], 40, { traumas: [trauma] });
    expect(effectiveChar(maudit, 'force')).toBe(40 - 30 - 10);
  });
});

describe('Fièvre : pénalité aux TESTS, jamais une baisse de Caractéristique (LDB 20 l.170, #1827)', () => {
  const fievreux = () => mk([], 40, { diseases: [{ phase: 'active', symptoms: [{ symptomId: 'fievre' }] }] as never });
  it('la Force effective (donc BF, dégâts, Blessures) reste intacte', () => {
    expect(effectiveChar(fievreux(), 'force')).toBe(40);
  });
  it('le Test de Force porte le −10', () => {
    expect(testValue(fievreux(), undefined, 'force')).toBe(30);
  });
  it('faim + fièvre : la Force effective porte la Faim seule, le Test de Force la Faim et la Fièvre (LDB 18 l.342, LDB 20 l.170)', () => {
    const affame = mk([], 40, { hunger: { days: 4, tests: 1, failures: 1 }, diseases: [{ phase: 'active', symptoms: [{ symptomId: 'fievre' }] }] as never });
    expect(volatileCharLines(affame, 'force').map((l) => [l.label, l.value])).toEqual([['Faim/Soif', -10]]);
    expect(effectiveChar(affame, 'force')).toBe(30);
    expect(testValue(affame, undefined, 'force')).toBe(20);
  });
});

describe('ActiveEffect.passive : le pool suit l’entité SOURCE, pas le canal (LDB 46 l.119, LDB 14 l.95)', () => {
  const porteur = (kind: 'spell' | 'trapping') => mk([], 40, {
    activeEffects: ['a', 'b'].map((id) => ({ label: id, bonus: 0, duration: { scale: 'rounds', left: 3 }, source: { kind, id }, passive: [{ op: 'charMod', char: 'force', mod: -10 }] })) as never,
  });
  it('deux objets : leurs réductions se somment', () => {
    expect(effectiveChar(porteur('trapping'), 'force')).toBe(20);
  });
  it('deux Sorts : la pire pénalité seule', () => {
    expect(effectiveChar(porteur('spell'), 'force')).toBe(30);
  });
});
