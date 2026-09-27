import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerProjetsLivres, PROJETS_LIVRES } from '../../scripts/guards/lib/projetsLivres.mjs';
import { navalPorts } from './index';
import { unresolvedCargoIds, type CargoEntry } from '../engine/cargo';
import { findCargoEntryById } from '../engine/seaVoyage';
import { findLandCargoEntryById } from '../engine/landCargo';
import { REIK_INDEX } from '../scenes/test-scenarios/_reik-index';

/**
 * Garde FK des colonnes Production / Produits (#1318 E4/C1-bis) — patron `axes-integrity.test.ts`.
 *
 * Ces colonnes sont des listes d'IDS d'entrées de `sea-cargo.json` / `land-cargo.json` (marchandises ET
 * marqueurs). Rien, à la LECTURE, ne distingue un id inconnu d'un id sans particularité : les
 * résolveurs rendent `undefined` et les dérivations retombent silencieusement sur leur défaut — un
 * renommage amont de l'entrée « commerce » ferait perdre la qualité de PLAQUE TOURNANTE
 * (`isTradeHubEntry`) à tous ses Lieux, sans une seule erreur. Cette garde rend la perte BRUYANTE :
 * chaque id cité par une donnée RÉELLE doit résoudre dans SON catalogue.
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Colonnes citées par les projets de campagne committés : `worldMap.places[].port`/`.market` INLINE
 *  (un `port.ref` est résolu depuis `naval-ports.json`, couvert par le bloc MARITIME). */
function colonnesDesProjets(): { source: string; ids: string[]; resolve: (id: string) => CargoEntry | undefined }[] {
  const out: { source: string; ids: string[]; resolve: (id: string) => CargoEntry | undefined }[] = [];
  for (const rel of listerProjetsLivres(ROOT).map((r) => `${PROJETS_LIVRES.dossier}/${r}`)) {
    let doc: { worldMap?: { places?: { id?: string; port?: { production?: string[] }; market?: { produits?: string[] } }[] } };
    try { doc = JSON.parse(readFileSync(join(ROOT, rel), 'utf8')); } catch { continue; }
    for (const p of doc.worldMap?.places ?? []) {
      if (p.port?.production) out.push({ source: `${rel} → ${p.id}.port.production`, ids: p.port.production, resolve: findCargoEntryById });
      if (p.market?.produits) out.push({ source: `${rel} → ${p.id}.market.produits`, ids: p.market.produits, resolve: findLandCargoEntryById });
    }
  }
  return out;
}

describe('#1318 — intégrité FK des colonnes Production / Produits', () => {
  it('MARITIME — chaque id de `naval-ports.json` (production, surplus, demande) résout dans sea-cargo.json', () => {
    const morts: string[] = [];
    for (const p of navalPorts) {
      for (const [colonne, ids] of [
        ['production', p.production ?? []],
        ['surplus', Object.keys(p.surplus ?? {})],
        ['demande', Object.keys(p.demande ?? {})],
      ] as const) {
        for (const id of unresolvedCargoIds(ids, findCargoEntryById)) morts.push(`${p.id}.${colonne} → « ${id} »`);
      }
    }
    expect(morts, `ids de cargaison introuvables dans sea-cargo.json :\n${morts.join('\n')}`).toEqual([]);
    expect(navalPorts.length).toBeGreaterThan(0); // le corpus mesuré n'est pas vide
  });

  it('TERRESTRE — chaque id de la colonne Produits de l’Index géographique résout dans land-cargo.json', () => {
    const lieux = REIK_INDEX; // les 3 sous-index (Reikland, Bögenhafen, Auerswald) vivent dans CE tableau
    const morts: string[] = [];
    for (const l of lieux) for (const id of unresolvedCargoIds(l.produits, findLandCargoEntryById)) morts.push(`${l.id}.produits → « ${id} »`);
    expect(morts, `ids de cargaison introuvables dans land-cargo.json :\n${morts.join('\n')}`).toEqual([]);
    expect(lieux.length).toBeGreaterThan(0);
  });

  it('PROJETS — chaque colonne INLINE d’un projet de campagne committé résout dans son catalogue', () => {
    const morts: string[] = [];
    for (const c of colonnesDesProjets()) for (const id of unresolvedCargoIds(c.ids, c.resolve)) morts.push(`${c.source} → « ${id} »`);
    expect(morts, `ids de cargaison introuvables :\n${morts.join('\n')}`).toEqual([]);
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
