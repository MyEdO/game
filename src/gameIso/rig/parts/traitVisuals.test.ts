import { VIEWS } from '../facing';
import { describe, it, expect } from 'vitest';
import { traitOverlaysFor } from './traitVisuals';
import type { TraitInstance } from '../../../engine/statEntry';
import type { Combatant } from '../../../engine/types';

const mk = (traits: TraitInstance[], species = 'humain'): Combatant =>
  ({ id: 'c1', name: 'C', kind: 'enemy', species, traits }) as unknown as Combatant;

describe('visuels dérivés des traits de créature (statbloc éditeur, sorts grantTrait)', () => {
  it('sans traits → rien', () => {
    expect(traitOverlaysFor(mk([]))).toEqual([]);
  });

  it('Cornes → cornes derrière la tête (3 vues) ; Attaque caudale → queue dorsale (3 vues, profil vers −x)', () => {
    const ovs = traitOverlaysFor(mk([{ id: 'cornes', value: 6 }, { id: 'attaque-caudale', value: 8 }]));
    const cornes = ovs.filter((o) => o.bone === 'tete' && o.behind && o.svg.includes('data-trait="cornes"'));
    expect(cornes.map((o) => o.view).sort()).toEqual([...VIEWS].sort()); // cornes orientées (registre)
    const queue = ovs.filter((o) => o.svg.includes('data-trait="queue"'));
    expect(queue.map((o) => o.view).sort()).toEqual([...VIEWS].sort());
    expect(queue.find((o) => o.view === 'profile')?.plane).toBeUndefined(); // racine posée SUR le dos
    expect(queue.find((o) => o.view === 'profile')?.svg).toContain('M-2 2'); // part vers −x (le dos)
  });

  it('anti-doublon : la race qui fournit déjà cornes/queue (feature behind) fait foi', () => {
    expect(traitOverlaysFor(mk([{ id: 'cornes', value: 6 }], 'homme-bete'))).toEqual([]); // cornes caprines de race
    expect(traitOverlaysFor(mk([{ id: 'attaque-caudale', value: 8 }], 'skaven'))).toEqual([]); // queue de rat de race
    // un Nain (barbe en layer positif) garde ses cornes de trait — orientées (3 calques)
    expect(traitOverlaysFor(mk([{ id: 'cornes', value: 6 }], 'nain')).map((o) => o.view).sort())
      .toEqual([...VIEWS].sort());
  });

  it('Tentacules → bras gauche remplacé (poing effacé)', () => {
    const ovs = traitOverlaysFor(mk([{ id: 'tentacules', count: 8, value: 9 }]));
    expect(ovs.some((o) => o.bone === 'epauleG' && o.replace && o.svg.includes('data-trait="tentacules"'))).toBe(true);
    expect(ovs.some((o) => o.bone === 'mainG' && o.replace && o.svg === '')).toBe(true);
  });

  it('Vol → ailes par vue (face/dos/profil) — donc le sort Envol (grantTrait Vol) en hérite', () => {
    const ovs = traitOverlaysFor(mk([{ id: 'vol', value: 90 }]));
    const wings = ovs.filter((o) => o.svg.includes('data-trait="vol"'));
    expect(wings.map((o) => o.view).sort()).toEqual([...VIEWS].sort());
    expect(wings.every((o) => o.bone === 'torse')).toBe(true);
    // Plan dédié : derrière TOUT le corps de face (z inégal des bras), devant tout de dos ;
    // de profil, calque d'os normal (la racine se peint SUR le bord du dos, sinon elle flotte).
    expect(wings.find((o) => o.view === 'front')?.plane).toBe('fond');
    expect(wings.find((o) => o.view === 'profile')?.plane).toBeUndefined();
    expect(wings.find((o) => o.view === 'back')?.plane).toBe('avant');
  });
});
