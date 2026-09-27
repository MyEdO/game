/**
 * CONTRAT RAW de la DISPONIBILITÉ SAISONNIÈRE (#1659 L-1659-2) — les 72 cellules des deux tableaux de
 * cargaisons, confrontées à ce que les livres IMPRIMENT.
 *
 * Ce que ce fichier tient, et que rien d'autre ne tenait : la valeur des bornes. Le refine des defs
 * garde la COUVERTURE (1–100 sans trou), pas la FIDÉLITÉ — une colonne entièrement décalée d'un cran
 * couvre toujours 1 à 100 et passerait. Le lookup, lui, ne juge rien.
 *
 * POURQUOI LA TABLE EST RETRANSCRITE ICI, et non importée de la migration
 * (`scripts/migrations/2026-09-01-1659-avail-plage.mjs`, `ATTENDU_MER`/`ATTENDU_TERRE`) :
 *  1. une migration est un artefact DATÉ, rejoué puis destiné à disparaître ; un contrat qui en
 *     dépendrait mourrait avec elle ;
 *  2. surtout, un littéral PARTAGÉ entre l'écrivain et le juge ne peut pas les départager : la
 *     migration écrit CE littéral, ce test le relirait — une faute de transcription serait VERTE des
 *     deux côtés. Deux transcriptions INDÉPENDANTES de la même table imprimée sont une saisie en
 *     partie double : c'est le seul montage où une coquille se voit.
 * Un troisième domicile (`scripts/raw/…`) ne ferait que déplacer le problème (1) et supprimer (2) :
 * il n'aurait aucun autre lecteur que ces deux-là.
 *
 * MARITIME — `Source/WH - V4 - La Mer de Griffe/15 - Longs voyages.md` l.406-418.
 * TERRESTRE — `Source/Warhammer v4 - 2.0 Mort sur le Reik Compagnon/13 - CHAPITRE 11 - Règles du
 * commerce.md` l.73-78 (table TRANSPOSÉE : une LIGNE par saison, une COLONNE par bien).
 * `00` est le 100 du d100.
 */
import { tableTotale } from '../lib/tableTotale';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod';
import { dispoSaisonniereSchema } from './schemas/grammaire/valeurs';

/** Une cellule du tableau, telle que le livre l'imprime : `01-05` → `[1, 5]`. */
type CelluleAvail = [number, number];

/** Les quatre colonnes, DÉRIVÉES du nœud de grammaire — la liste des saisons n'est écrite qu'une fois
 *  dans le dépôt (`parSaison`). Leur ORDRE est celui des deux en-têtes imprimés (MDG 15 l.406,
 *  MSRC 13 l.73-78), ce que le premier test vérifie avant de s'en servir. */
const SAISONS_IMPRIMEES = Object.keys(dispoSaisonniereSchema.shape) as (keyof z.infer<typeof dispoSaisonniereSchema>)[];

/**
 * MDG 15 l.406-418, recopié colonne par colonne :
 *   « | Céréales | 01-05 | 01-09 | 01-18 | 01-09 | … | Pièces détachées de navire | 91-00 | 91-00 | 91-00 | 91-00 | »
 * Ordre des colonnes : Printemps, Été, Automne, Hiver.
 */
const MER: Record<string, CelluleAvail[]> = {
  cereales: [[1, 5], [1, 9], [1, 18], [1, 9]],
  armes: [[6, 8], [10, 12], [19, 21], [10, 12]],
  'produits-de-luxe': [[9, 13], [13, 16], [22, 25], [13, 16]],
  metaux: [[14, 19], [17, 22], [26, 30], [17, 25]],
  bois: [[20, 28], [23, 44], [31, 46], [26, 36]],
  vin: [[29, 33], [45, 56], [47, 60], [37, 56]],
  laine: [[34, 50], [57, 62], [61, 65], [57, 60]],
  sel: [[51, 60], [63, 75], [66, 72], [61, 64]],
  huile: [[61, 70], [76, 82], [73, 83], [65, 81]],
  'poisson-sale': [[71, 90], [83, 90], [84, 90], [82, 90]],
  'pieces-detachees-de-navire': [[91, 100], [91, 100], [91, 100], [91, 100]],
};

/**
 * MSRC 13 l.75-78, recopié LIGNE par ligne (le livre écrit les saisons en lignes) :
 *   « | Printemps | 01–09 | 10–15 | 16–20 | 21–30 | 31–55 | 56–75 | 76–00 |
 *     | Été       | 01–19 | 20–23 | 24–29 | 30–39 | 40–74 | 75–85 | 86–00 |
 *     | Automne   | 01–35 | 36–40 | 41–44 | 45–60 | 61–80 | 81–95 | 96–00 |
 *     | Hiver     | 01–19 | 20–23 | 24–29 | 30–44 | 45–60 | 61–95 | 96–00 | »
 * Colonnes du livre, dans l'ordre : Vivres, Armement, Produits de luxe, Métal, Bois, Vin/Eau-de-vie, Laine.
 */
const TERRE_PAR_SAISON: Record<string, CelluleAvail[]> = {
  printemps: [[1, 9], [10, 15], [16, 20], [21, 30], [31, 55], [56, 75], [76, 100]],
  ete: [[1, 19], [20, 23], [24, 29], [30, 39], [40, 74], [75, 85], [86, 100]],
  automne: [[1, 35], [36, 40], [41, 44], [45, 60], [61, 80], [81, 95], [96, 100]],
  hiver: [[1, 19], [20, 23], [24, 29], [30, 44], [45, 60], [61, 95], [96, 100]],
};
/** Les ids de `land-cargo.json` dans l'ordre des colonnes imprimées (l.73). */
const TERRE_COLONNES = ['vivres', 'armement', 'produits-de-luxe', 'metal', 'bois', 'vin', 'laine'];

/** La table terrestre, RETOURNÉE dans l'axe du document (une entrée par bien) — l'inversion est faite
 *  ICI, une fois, pour que la transcription reste celle du livre. */
const TERRE: Record<string, CelluleAvail[]> = tableTotale(TERRE_COLONNES, (_id, colonne) =>
  SAISONS_IMPRIMEES.map((s) => TERRE_PAR_SAISON[s][colonne]),
);

type Entree = { id: string; label: string; echangeable?: false; avail?: Record<string, { min: number; max: number }> };

const lire = (fichier: string): Entree[] =>
  JSON.parse(readFileSync(fileURLToPath(new URL(fichier, import.meta.url)), 'utf8')).cargoes as Entree[];

/** Les entrées MARCHANDES : le marqueur de colonne Production/Produits n'a pas de disponibilité
 *  (`isEchangeable`, `src/engine/cargo.ts` — le CHAMP d'exclusion, jamais un id). */
const marchandes = (entrees: Entree[]) => entrees.filter((e) => e.echangeable !== false);

describe('disponibilité saisonnière : la donnée dit ce que le livre imprime (#1659)', () => {
  it('les colonnes du nœud de grammaire sont celles des en-têtes IMPRIMÉS, dans l’ordre', () => {
    // Les deux transcriptions ci-dessus sont POSITIONNELLES (MDG 15 l.406 « | Printemps | Été |
    // Automne | Hiver | », MSRC 13 l.75-78 dans le même ordre de lignes) : si `parSaison` réordonnait
    // ses clés, elles seraient lues de travers SANS qu'aucune borne ne change.
    expect(
      SAISONS_IMPRIMEES,
      'l’ordre des colonnes de `parSaison` a changé : les tables retranscrites ici sont lues par POSITION.',
    ).toEqual(['printemps', 'ete', 'automne', 'hiver']);
  });

  for (const [fichier, attendu, cardinal] of [
    ['./sea-cargo.json', MER, 44],
    ['./land-cargo.json', TERRE, 28],
  ] as const) {
    it(`${fichier} — les ${cardinal} cellules, borne par borne`, () => {
      const entrees = marchandes(lire(fichier));
      expect(
        entrees.map((e) => e.id).sort(),
        'le catalogue et la table imprimée n’ont plus les mêmes cargaisons : une entrée marchande sans ligne au livre est une invention (règle 1).',
      ).toEqual(Object.keys(attendu).sort());

      // Le RÉSULTAT est comparé en BLOC (une seule assertion nomme toutes les cellules fautives), et
      // son CARDINAL est asserté sur ce qui a été effectivement lu — pas sur la longueur du littéral.
      const vu: Record<string, CelluleAvail[]> = {};
      let cellules = 0;
      for (const e of entrees) {
        vu[e.id] = SAISONS_IMPRIMEES.map((s) => {
          const f = e.avail?.[s];
          cellules++;
          return [f?.min as number, f?.max as number];
        });
      }
      expect(vu, `une cellule de disponibilité de ${fichier} ne dit plus ce que le livre imprime.`).toEqual(attendu);
      expect(cellules, 'le compte des cellules LUES a bougé : 4 saisons × cargaisons marchandes.').toBe(cardinal);
    });
  }

  it('les deux catalogues portent 72 cellules — le cardinal du lot, sur le RÉSULTAT', () => {
    const total = [...marchandes(lire('./sea-cargo.json')), ...marchandes(lire('./land-cargo.json'))]
      .flatMap((e) => SAISONS_IMPRIMEES.map((s) => e.avail?.[s]))
      .filter((f) => typeof f?.min === 'number' && typeof f?.max === 'number').length;
    expect(total, 'les 72 disponibilités saisonnières du lot #1659 L-1659-2 ne sont plus toutes des fourchettes.').toBe(72);
  });

  it('AUCUNE cellule n’est restée un TUPLE `[min, max]` (la forme que #1659 retire)', () => {
    const tuples = [...marchandes(lire('./sea-cargo.json')), ...marchandes(lire('./land-cargo.json'))]
      .flatMap((e) => SAISONS_IMPRIMEES.map((s) => ({ id: e.id, s, f: e.avail?.[s] })))
      .filter((c) => Array.isArray(c.f))
      .map((c) => `${c.id} › ${c.s}`);
    expect(
      tuples,
      'une disponibilité est réécrite en TUPLE : `findTableEntryIndex` (`src/engine/tables.ts`) lit `{min, max}`, et un tuple encode ses bornes par POSITION — ni éditable, ni mesurable.',
    ).toEqual([]);
  });
});
