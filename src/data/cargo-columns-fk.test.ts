import { describe, it, expect } from 'vitest';
import { unresolvedCargoIds, type CargoEntry } from '../engine/cargo';
import { findLandCargoEntryById } from '../engine/landCargo';
import { REIK_INDEX } from '../scenes/test-scenarios/_reik-index';

/**
 * Garde FK de la colonne Produits de l'Index géographique (#1318 E4/C1-bis), constante de CODE
 * (`REIK_INDEX`, `src/scenes/test-scenarios/_reik-index.ts`) qu'aucun parse ne juge. Les colonnes des
 * DOCUMENTS (`naval-ports.json`, `worldMap` des projets) se refusent au parse (`refs('seaCargo')`,
 * `refs('landCargo')`, #1473).
 *
 * La colonne est une liste d'IDS d'entrées de `land-cargo.json` (marchandises ET marqueurs). Rien, à la
 * LECTURE, ne distingue un id inconnu d'un id sans particularité : les résolveurs rendent `undefined`
 * et les dérivations retombent silencieusement sur leur défaut — un renommage amont de l'entrée
 * « commerce » ferait perdre la qualité de PLAQUE TOURNANTE (`isTradeHubEntry`) à tous ses Lieux, sans
 * une seule erreur. Cette garde rend la perte BRUYANTE : chaque id cité par une donnée RÉELLE doit
 * résoudre dans SON catalogue.
 */
describe('#1318 — intégrité FK de la colonne Produits de l’Index géographique', () => {
  it('TERRESTRE — chaque id de la colonne Produits de l’Index géographique résout dans land-cargo.json', () => {
    const lieux = REIK_INDEX; // les 3 sous-index (Reikland, Bögenhafen, Auerswald) vivent dans CE tableau
    const morts: string[] = [];
    for (const l of lieux) for (const id of unresolvedCargoIds(l.produits, findLandCargoEntryById)) morts.push(`${l.id}.produits → « ${id} »`);
    expect(morts, `ids de cargaison introuvables dans land-cargo.json :\n${morts.join('\n')}`).toEqual([]);
    expect(lieux.length).toBeGreaterThan(0);
  });

  it('MORSURE — une entrée RENOMMÉE amont fait rougir la colonne qui la citait', () => {
    // Fixture : le catalogue a renommé « commerce » en « commerce-local » ; le Lieu, lui, cite encore
    // l'ancien id. Sans cette garde, la seule conséquence visible serait la PERTE SILENCIEUSE de la
    // plaque tournante (`isTradeHubEntry(undefined) === false`).
    const renomme = (id: string): CargoEntry | undefined =>
      (id === 'commerce' ? undefined : findLandCargoEntryById(id));
    expect(unresolvedCargoIds(['vin', 'commerce'], renomme)).toEqual(['commerce']);
    // …et la colonne SAINE, elle, ne remonte rien (mêmes ids, catalogue intact).
    expect(unresolvedCargoIds(['vin', 'commerce'], findLandCargoEntryById)).toEqual([]);
  });
});
