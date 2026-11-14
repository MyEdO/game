/**
 * CONTRAT RAW du TABLEAU DES CARGAISONS (#1659 L-1659-2, #3578 L5) — les 72 cellules des deux tableaux,
 * portées par les huit documents de `cargaisons-aleatoires.json` (une colonne saisonnière imprimée par
 * document), confrontées à ce que les livres IMPRIMENT.
 *
 * Ce que ce fichier tient, et que rien d'autre ne tenait : la valeur des bornes. Le refine du def garde la
 * COUVERTURE du dé de chaque document, pas la FIDÉLITÉ — une colonne entièrement décalée d'un cran couvre
 * toujours 1 à 100 et passerait.
 *
 * POURQUOI LA TABLE EST RETRANSCRITE ICI, et non importée de la migration : un littéral PARTAGÉ entre
 * l'écrivain et le juge ne peut pas les départager. Deux transcriptions INDÉPENDANTES de la même table
 * imprimée sont une saisie en partie double : c'est le seul montage où une coquille se voit.
 *
 * MARITIME — `Source/WH - V4 - La Mer de Griffe/15 - Longs voyages.md` l.404-418.
 * TERRESTRE — `Source/Warhammer v4 - 2.0 Mort sur le Reik Compagnon/13 - CHAPITRE 11 - Règles du
 * commerce.md` l.69-78 (table TRANSPOSÉE : une LIGNE par saison, une COLONNE par bien).
 * `00` est le 100 du d100.
 */
import { tableTotale } from '../lib/tableTotale';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { saisonSchema } from './schemas/grammaire/valeurs';

/** Une cellule du tableau, telle que le livre l'imprime : `01-05` → `[1, 5]`. */
type CelluleAvail = [number, number];

/** Les quatre colonnes, DÉRIVÉES du vocabulaire des saisons (`saisonSchema`, clés de `parSaison`). Leur ORDRE
 *  est celui des deux en-têtes imprimés (MDG 15 l.406, MSRC 13 l.75-78), ce que le premier test vérifie avant
 *  de s'en servir. */
const SAISONS_IMPRIMEES = saisonSchema.options;

/**
 * MDG 15 l.406-418, recopié colonne par colonne :
 *   « | Céréales | 01-05 | 01-09 | 01-18 | 01-09 | … | Pièces détachées de navire | 91-00 | 91-00 | 91-00 | 91-00 | »
 * Ordre des colonnes : Printemps, Été, Automne, Hiver.
 */
const MER: Record<string, CelluleAvail[]> = {
  cereales: [[1, 5], [1, 9], [1, 18], [1, 9]],
  armes: [[6, 8], [10, 12], [19, 21], [10, 12]],
  'produits-de-luxe-mer': [[9, 13], [13, 16], [22, 25], [13, 16]],
  metaux: [[14, 19], [17, 22], [26, 30], [17, 25]],
  'bois-mer': [[20, 28], [23, 44], [31, 46], [26, 36]],
  vin: [[29, 33], [45, 56], [47, 60], [37, 56]],
  'laine-mer': [[34, 50], [57, 62], [61, 65], [57, 60]],
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
/** Les ids de la voie `terre` de `cargoes.json` dans l'ordre des colonnes imprimées (l.73). */
const TERRE_COLONNES = ['vivres', 'armement', 'produits-de-luxe-terre', 'metal', 'bois-terre', 'vin-eau-de-vie', 'laine-terre'];

/** La table terrestre, RETOURNÉE dans l'axe du document (une entrée par bien) — l'inversion est faite
 *  ICI, une fois, pour que la transcription reste celle du livre. */
const TERRE: Record<string, CelluleAvail[]> = tableTotale(TERRE_COLONNES, (_id, colonne) =>
  SAISONS_IMPRIMEES.map((s) => TERRE_PAR_SAISON[s][colonne]),
);

type Document = { id: string; voie: string; saison: string; die: string; entries: { id: string; min: number; max: number }[] };

/** Les documents du tableau d'UNE voie (`cargaisons-aleatoires.json`), lus au disque. */
const lire = (voie: string): Document[] =>
  (JSON.parse(readFileSync(fileURLToPath(new URL('./cargaisons-aleatoires.json', import.meta.url)), 'utf8')) as Document[]).filter((d) => d.voie === voie);

describe('Tableau des cargaisons : les documents disent ce que le livre imprime (#1659, #3578)', () => {
  it('les colonnes du vocabulaire des saisons sont celles des en-têtes IMPRIMÉS, dans l’ordre', () => {
    // Les deux transcriptions ci-dessus sont POSITIONNELLES (MDG 15 l.406 « | Printemps | Été |
    // Automne | Hiver | », MSRC 13 l.75-78 dans le même ordre de lignes).
    expect(SAISONS_IMPRIMEES, 'l’ordre des saisons a changé : les tables retranscrites ici sont lues par POSITION.').toEqual(['printemps', 'ete', 'automne', 'hiver']);
  });

  for (const [voie, attendu, cardinal] of [
    ['mer', MER, 44],
    ['terre', TERRE, 28],
  ] as const) {
    it(`voie ${voie} — un document d100 par saison imprimée, et ses ${cardinal} cellules, borne par borne`, () => {
      const documents = lire(voie);
      expect(documents.map((d) => d.saison).sort(), `voie ${voie} : une colonne imprimée sans document, ou tirée deux fois.`).toEqual([...SAISONS_IMPRIMEES].sort());
      const vu: Record<string, CelluleAvail[]> = {};
      let cellules = 0;
      for (const [i, saison] of SAISONS_IMPRIMEES.entries()) {
        const d = documents.find((x) => x.saison === saison)!;
        for (const r of d.entries) {
          (vu[r.id] ??= [])[i] = [r.min, r.max];
          cellules++;
        }
      }
      expect(vu, `une cellule de la voie ${voie} ne dit plus ce que le livre imprime.`).toEqual(attendu);
      expect(cellules, 'le compte des cellules LUES a bougé : 4 saisons × cargaisons imprimées.').toBe(cardinal);
    });
  }
});
