import { describe, it, expect } from 'vitest';
import { parsePsychTraits } from './registry';
import { ciblePsy } from './ciblage';

describe('Psychologie data-driven (capabilities de traits.json) — LDB 21/85', () => {
  it('parse Peur/Terreur/Immunité + ciblés (Animosité/Phobie indice 1/Effrayé indice 0), Cible = id de Groupe', () => {
    const p = parsePsychTraits([{ id: 'peur', value: 2 }, { id: 'immunite-psychologique' }, { id: 'animosite', arg: 'elfe' }, { id: 'phobie', arg: 'Serpents' }, { id: 'effraye', arg: 'Feu' }]);
    expect(p.causesPeur).toBe(2);
    expect(p.psychImmune).toBe(true);
    expect(p.psychTraits).toEqual(expect.arrayContaining([
      { type: 'animosite', cible: ciblePsy.groupe('elfe') },
      // « Serpents »/« Feu » ne sont PAS des ids de Groupe (`groups.json`) → Cible INERTE (pas de chaîne FR résiduelle).
      { type: 'phobie', cible: undefined, indice: 1 },
      { type: 'phobie', cible: undefined, indice: 0 },
    ]));
  });

  it('Cible « un au choix » ou vide → inerte (cible indéfinie) ; « deux au choix » → 2 wildcards inertes', () => {
    expect(parsePsychTraits([{ id: 'haine', arg: 'un au choix' }]).psychTraits).toEqual([{ type: 'haine', cible: undefined }]);
    expect(parsePsychTraits([{ id: 'haine' }]).psychTraits).toEqual([{ type: 'haine', cible: undefined }]);
    expect(parsePsychTraits([{ id: 'animosite', arg: 'deux au choix' }]).psychTraits).toEqual([
      { type: 'animosite', cible: undefined },
      { type: 'animosite', cible: undefined },
    ]);
  });

  it('deux instances → deux Cibles, une par instance (Haine, Effrayé, Animosité, Préjugé)', () => {
    for (const [id, type, indice] of [['haine', 'haine', undefined], ['effraye', 'phobie', 0], ['animosite', 'animosite', undefined], ['prejuge', 'prejuge', undefined]] as const) {
      const attendu = (groupe: string) => {
        const cible = ciblePsy.groupe(groupe);
        return indice == null ? { type, cible } : { type, cible, indice };
      };
      expect(parsePsychTraits([{ id, arg: 'noble' }, { id, arg: 'homme-bete' }]).psychTraits, id).toEqual([attendu('noble'), attendu('homme-bete')]);
    }
  });

  it('une liste jointe dans UNE instance n’est pas découpée : une seule Cible, inerte', () => {
    expect(parsePsychTraits([{ id: 'animosite', arg: 'noble, homme-bete' }]).psychTraits).toEqual([{ type: 'animosite', cible: undefined }]);
  });

  it('un trait sans capacité psy est ignoré', () => {
    expect(parsePsychTraits([{ id: 'arme', value: 7 }])).toEqual({});
  });
});
