import { describe, it, expect } from 'vitest';
import { encounterPsych } from './encounterPsych';
import type { Combatant } from './types';
import { ciblePsy } from './psych/ciblage';

const hero = (opts: Partial<Combatant>): Combatant =>
  ({ id: 'h', name: 'H', kind: 'hero', size: 'moyenne', psychState: [], psychTraits: [], groups: [], ...opts } as unknown as Combatant);
const npc = (id: string, opts: Partial<Combatant>): Combatant =>
  ({ id, name: id, kind: 'npc', size: 'moyenne', groups: [], ...opts } as unknown as Combatant);

describe('encounterPsych — Psychologie à la rencontre, HORS COMBAT (Peur/Terreur = combat seulement)', () => {
  it('rencontrer un PNJ ÉNORME (Terreur de Taille) → AUCUN Test hors combat', () => {
    expect(encounterPsych(hero({}), [npc('geant', { size: 'enorme' })])).toBeNull();
  });

  it('rencontrer un PNJ « Peur 3 » au statbloc → AUCUN Test hors combat', () => {
    expect(encounterPsych(hero({}), [npc('spectre', { causesPeur: 3 })])).toBeNull();
  });

  it('héros avec Animosité (elfe) face à un Elfe présent → trait ciblé SOCIAL (taverne, l.16)', () => {
    const t = encounterPsych(hero({ psychTraits: [{ type: 'animosite', cible: ciblePsy.groupe('elfe') }] }), [npc('elfe', { groups: ['elfe'] })]);
    expect(t).toEqual({ kind: 'animosite', sourceId: 'elfe', indice: 0, cible: ciblePsy.groupe('elfe') });
  });

  it('PNJ de même Taille, aucun trait → aucun Test', () => {
    expect(encounterPsych(hero({}), [npc('paysan', { groups: ['humain'] })])).toBeNull();
  });

  it('Immunité (Psychologie) bloque même un Trait social ; Frénésie aussi', () => {
    const immune = hero({ psychImmune: true, psychTraits: [{ type: 'animosite', cible: ciblePsy.groupe('elfe') }] });
    expect(encounterPsych(immune, [npc('elfe', { groups: ['elfe'] })])).toBeNull();
    const frenzied = hero({ psychState: [{ type: 'frenesie' }], psychTraits: [{ type: 'animosite', cible: ciblePsy.groupe('elfe') }] });
    expect(encounterPsych(frenzied, [npc('elfe', { groups: ['elfe'] })])).toBeNull();
  });
});
