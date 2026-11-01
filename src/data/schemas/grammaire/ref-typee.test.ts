/**
 * `refTypee` (#2820), sur le foyer de règle `foyerDeRegleSchema` : le `type` NOMME l'espace où l'id
 * résout, parmi un vocabulaire FERMÉ ; la référence est un objet strict `{ id, type }`.
 * `chute` vit dans `regles.json` ET `spells.json`, `exposition` dans `regles.json` seul. Une valeur hors des types
 * nomme la sous-liste d'un espace (#3116).
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { declarationDeRefTypee, idsDeLaSousListe, refTypee } from './ref';
import { enumNomme, foyerDeRegleSchema } from './valeurs';

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

describe('refTypee — une valeur hors des types nomme la sous-liste d’un espace (#3116)', () => {
  const habille = refTypee(enumNomme({ trapping: 'Objet', tenue: 'Tenue' }), { tenue: { type: 'gardeRobe', sousListe: 'tenue' } });
  const [tenue] = idsDeLaSousListe('gardeRobe', 'tenue');
  const [piece] = idsDeLaSousListe('gardeRobe', 'piece');

  it('l’id d’une branche de sous-liste résout dans cette sous-liste, et elle seule', () => {
    expect(habille.safeParse({ id: tenue, type: 'tenue' }).success).toBe(true);
    const r = habille.safeParse({ id: piece, type: 'tenue' });
    expect(r.success ? '' : r.error.issues.map((i) => i.message).join(' | ')).toContain(`« ${piece} » est hors de la sous-liste « tenue »`);
  });

  it('le refus d’un type inconnu nomme la sous-liste de chaque valeur qui en nomme une', () => {
    const r = habille.safeParse({ id: tenue, type: 'prop' });
    expect(r.success ? '' : r.error.issues.map((i) => i.message).join(' | ')).toContain('« tenue » (garde-robe, sous-liste « tenue »)');
  });

  it('la déclaration porte le couple (type, sous-liste) que nomme chaque valeur', () => {
    const { branches } = declarationDeRefTypee(habille)!;
    expect(branches.tenue).toMatchObject({ type: 'gardeRobe', sousListe: 'tenue' });
    expect(branches.trapping).toMatchObject({ type: 'trapping' });
    expect(branches.trapping.sousListe).toBeUndefined();
  });

  it('une valeur qui n’est ni un type ni une sous-liste nommée lève à la construction', () => {
    expect(() => refTypee(z.enum(['zzz']) as unknown as z.ZodEnum<{ skill: 'skill' }>)).toThrow(/« zzz » n'est ni un type de la grammaire/);
  });
});
