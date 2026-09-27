/**
 * `naval-ports.json` — Index des ports de la Mer des Griffes (#217, MDG 15 l.439-506). Catalogue
 * chargé par référence (`MapPlace.port.ref`, `state/worldMap.ts`).
 */
import { describe, it, expect } from 'vitest';
import { navalPorts, findNavalPortById } from './index';
import { cargoes, CARGO_ENTRIES } from '../engine/seaVoyage';

describe('naval-ports.json — catalogue de l’Index des ports (#217)', () => {
  it('charge et porte au moins les entrées connues', () => {
    expect(navalPorts.length).toBeGreaterThan(0);
    expect(findNavalPortById('salzenmund')).toBeTruthy();
    expect(findNavalPortById('erengrad')).toBeTruthy();
  });

  it('ids uniques', () => {
    const ids = navalPorts.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('chaque id de production/surplus/demande résout dans le vocabulaire de marchandise (sea-cargo.json)', () => {
    const cargoIds = new Set(cargoes().map((c) => c.id));
    // La colonne Production admet TOUT le vocabulaire du catalogue, marqueurs de l'Index compris
    // (`echangeable: false`) — Surplus et Demande, eux, ne portent que des marchandises.
    const columnIds = new Set(CARGO_ENTRIES.map((c) => c.id));
    for (const p of navalPorts) {
      for (const id of p.production ?? []) {
        expect(columnIds.has(id), `${p.id} : production id inconnu "${id}"`).toBe(true);
      }
      for (const id of Object.keys(p.surplus ?? {})) {
        expect(cargoIds.has(id), `${p.id} : surplus id inconnu "${id}"`).toBe(true);
      }
      for (const id of Object.keys(p.demande ?? {})) {
        expect(cargoIds.has(id), `${p.id} : demande id inconnu "${id}"`).toBe(true);
      }
    }
  });

  it('Salzenmund : Taille 4, Richesse 4, Surplus produits-de-luxe +1, Demande armes+céréales +1 (MDG 15 l.452, folio 138)', () => {
    const salzenmund = findNavalPortById('salzenmund')!;
    expect(salzenmund.taille).toBe(4);
    expect(salzenmund.richesse).toBe(4);
    expect(salzenmund.surplus).toEqual({ 'produits-de-luxe': 1 });
    expect(salzenmund.demande).toEqual({ armes: 1, cereales: 1 });
  });

  it('Erengrad : Taille 4, Richesse 4, Surplus pièces-détachées-de-navire +1, Demande laine +1 (MDG 15 l.461-462, folio 138)', () => {
    const erengrad = findNavalPortById('erengrad')!;
    expect(erengrad.taille).toBe(4);
    expect(erengrad.richesse).toBe(4);
    expect(erengrad.surplus).toEqual({ 'pieces-detachees-de-navire': 1 });
    expect(erengrad.demande).toEqual({ laine: 1 });
  });

  it('Marienburg : Surplus pièces-détachées-de-navire +1, Demande armes/bois/métaux/produits-de-luxe +1 (MDG 15 l.439, folio 138)', () => {
    const marienburg = findNavalPortById('marienburg')!;
    expect(marienburg.surplus).toEqual({ 'pieces-detachees-de-navire': 1 });
    expect(marienburg.demande).toEqual({ armes: 1, bois: 1, metaux: 1, 'produits-de-luxe': 1 });
  });

  it('Norden : Surplus poisson-salé +1, Demande armes +2/bois/métaux/pièces-détachées-de-navire +1 (MDG 15 l.456, folio 138)', () => {
    const norden = findNavalPortById('norden')!;
    expect(norden.surplus).toEqual({ 'poisson-sale': 1 });
    expect(norden.demande).toEqual({ armes: 2, bois: 1, metaux: 1, 'pieces-detachees-de-navire': 1 });
  });

  it('Kirkjugarður Langskipa : production armes/produits-de-luxe, sans surplus ni demande (MDG 15 l.468-469, folio 138)', () => {
    const kirkjugardur = findNavalPortById('kirkjugardur-langskipa')!;
    expect(kirkjugardur.production).toEqual(['armes', 'produits-de-luxe']);
    expect(kirkjugardur.surplus).toBeUndefined();
    expect(kirkjugardur.demande).toBeUndefined();
  });

  it('Fjirgard : production produits-de-luxe, Demande armes +1, sans surplus (MDG 15 l.474, folio 138)', () => {
    const fjirgard = findNavalPortById('fjirgard')!;
    expect(fjirgard.production).toEqual(['produits-de-luxe']);
    expect(fjirgard.surplus).toBeUndefined();
    expect(fjirgard.demande).toEqual({ armes: 1 });
  });

  it('Marienburg et Lothern : cosmopolite (MDG 15 l.343-349) ; les autres ports commerce ordinaires ne le sont pas', () => {
    expect(findNavalPortById('marienburg')!.cosmopolite).toBe(true);
    expect(findNavalPortById('lothern')!.cosmopolite).toBe(true);
    expect(findNavalPortById('altdorf-port')!.cosmopolite).toBeFalsy();
  });

  it('chaque entrée porte une source { book, page } avec le livre mer-des-griffes', () => {
    for (const p of navalPorts) {
      expect(p.source.book).toBe('mer-des-griffes');
      expect(typeof p.source.page).toBe('number');
    }
  });
});
