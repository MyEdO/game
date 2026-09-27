import { describe, it, expect } from 'vitest';
import { propRefPatch } from './propDefaults';
import { EMPTY_FLOW } from '../../state/flow';
import { propDeclaredFoot } from '../../state/footprint';

describe('propRefPatch — l’action de FOUILLE pré-armée à la pose d’un décor `searchable`', () => {
  it('décor searchable sans action → pré-arme une action `fouiller` à Flow vide, jouable une fois', () => {
    const p = propRefPatch('coffre', undefined);
    expect(p.ref).toBe('coffre');
    expect(p.usable).toEqual({ actions: [{ id: 'fouiller', flow: EMPTY_FLOW, unique: true }] });
  });
  it('décor searchable dont l’instance porte DÉJÀ une action → la liste de l’auteur est intacte', () => {
    const deja = { actions: [{ id: 'ouvrir', flow: EMPTY_FLOW }] };
    const p = propRefPatch('coffre', { usable: deja });
    expect(p).toEqual({ ref: 'coffre' });
    expect('usable' in p).toBe(false);
  });
  it('l’ASSISE déjà activée survit à la pré-arme : les deux faits cohabitent dans l’enveloppe', () => {
    const p = propRefPatch('coffre', { usable: { assise: true } });
    expect(p.usable).toEqual({ assise: true, actions: [{ id: 'fouiller', flow: EMPTY_FLOW, unique: true }] });
  });
  it('décor pur (non searchable) → seulement ref, aucune action', () => {
    const p = propRefPatch('tonneau', undefined);
    expect(p).toEqual({ ref: 'tonneau' });
  });
});

describe('propRefPatch — l’empreinte n’est PAS une propriété d’instance', () => {
  it('gros décor (tribune 3×1) → aucune empreinte posée sur l’entité : elle vient du catalogue', () => {
    expect(propRefPatch('tribune', undefined)).toEqual({ ref: 'tribune' });
    expect(propDeclaredFoot('tribune')).toEqual({ w: 3, h: 1 });
  });
  it('décor 1×1 (tonneau) → seulement la ref, et aucune empreinte au catalogue', () => {
    expect(propRefPatch('tonneau', undefined)).toEqual({ ref: 'tonneau' });
    expect(propDeclaredFoot('tonneau')).toBeUndefined();
  });
});
