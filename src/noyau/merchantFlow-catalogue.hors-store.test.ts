/**
 * L'entrée de catalogue d'un id (`catalogEntryOf`, `merchantFlow.ts`) sur la donnée réelle : un objet, un véhicule
 * terrestre ou une bête à prix d'achat ; une marque du livre (`'ND'`, `LDB 62 l.28`, `l.31` ; `LDB 68 l.11`) n'est ni un
 * montant ni une classe de Disponibilité ; un id hors de ces trois catalogues n'a pas d'entrée.
 */
import { describe, it, expect } from 'vitest';
import { catalogEntryOf } from './merchantFlow';
import { creatures, trappingsInstanciables, vehicles } from '../data';

describe('catalogEntryOf — donnée réelle', () => {
  it('un id qu’aucun catalogue ne porte n’a pas d’entrée', () => {
    expect(catalogEntryOf('id-hors-de-tout-catalogue')).toBeUndefined();
  });

  it('une marque `ND` au Prix ou à la Disponibilité ne passe ni pour un montant ni pour une classe', () => {
    const marques = trappingsInstanciables().filter((t) => t.price === 'ND' || t.availability === 'ND');
    expect(marques.length, 'la donnée porte des marques ND').toBeGreaterThan(0);
    for (const t of marques) {
      const e = catalogEntryOf(t.id)!;
      if (t.price === 'ND') expect(e.price, t.id).toBeNull();
      if (t.availability === 'ND') expect(e.availability, t.id).toBeNull();
    }
  });

  it('un navire ne se vend pas comme véhicule terrestre ; un véhicule terrestre et une bête achetables portent leur unité', () => {
    const ids = new Set(trappingsInstanciables().map((t) => t.id));
    for (const v of vehicles.filter((x) => x.purchase && x.ship && !ids.has(x.id))) {
      expect(catalogEntryOf(v.id)?.unit?.kind, v.id).not.toBe('vehicule-terrestre');
    }
    const terrestre = vehicles.find((x) => x.purchase && !x.ship && !ids.has(x.id))!;
    expect(catalogEntryOf(terrestre.id)).toMatchObject({ label: terrestre.label, price: terrestre.purchase!.price, unit: { kind: 'vehicule-terrestre', id: terrestre.id } });
    const vehiculesTerrestres = new Set<string>(vehicles.filter((v) => v.purchase && !v.ship).map((v) => v.id));
    const bete = creatures.find((c) => c.purchase && !ids.has(c.id) && !vehiculesTerrestres.has(c.id))!;
    expect(catalogEntryOf(bete.id)).toMatchObject({ label: bete.label, price: bete.purchase!.price, unit: { kind: 'bete', id: bete.id } });
  });
});
