/**
 * `refTypee` (#2820), sur le foyer de règle `foyerDeRegleSchema` : le `type` NOMME l'espace où l'id
 * résout, parmi un vocabulaire FERMÉ ; la référence est un objet strict `{ id, type }`.
 * `chute` vit dans `regles.json` ET `spells.json`, `exposition` dans `regles.json` seul.
 */
import { describe, it, expect } from 'vitest';
import { declarationDeRefTypee } from './ref';
import { foyerDeRegleSchema } from './valeurs';

/** Les messages du refus, joints — `null` si la valeur passe. */
function refus(valeur: unknown): string | null {
  const r = foyerDeRegleSchema.safeParse(valeur);
  return r.success ? null : r.error.issues.map((i) => i.message).join(' | ');
}

describe('refTypee — l’id résout dans l’espace que son type nomme', () => {
  it('un id résout dans l’espace de SON type, quel que soit l’autre espace qui le porte aussi', () => {
    expect(refus({ id: 'chute', type: 'regle' })).toBeNull();
    expect(refus({ id: 'chute', type: 'spell' })).toBeNull();
  });

  it('un id absent de l’espace de son type est refusé, en nommant ce catalogue', () => {
    expect(refus({ id: 'exposition', type: 'skill' })).toContain('absent du catalogue des compétences (skills.json)');
    expect(refus({ id: 'zzz', type: 'regle' })).toContain('absent du catalogue des règles');
  });

  it('un type inconnu ou absent est refusé, en nommant les types admis', () => {
    expect(refus({ id: 'chute', type: 'creature' })).toContain('type de référence absent ou inconnu');
    expect(refus({ id: 'chute' })).toContain('type de référence absent ou inconnu');
  });

  it('la référence est un objet FERMÉ : ni clé en trop, ni id nu', () => {
    expect(refus({ id: 'chute', type: 'regle', x: 1 })).toContain('Clé non reconnue');
    expect(refus('chute')).not.toBeNull();
  });

  it('le nœud déclare EXACTEMENT les types admis du foyer de règle', () => {
    expect(declarationDeRefTypee(foyerDeRegleSchema)?.types).toEqual([
      'regle', 'skill', 'talent', 'etat', 'quality', 'characteristic', 'spell', 'psychology', 'symptome', 'steamBreakdown',
    ]);
  });
});
