import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/**
 * Schéma de `progression-schemas.derived.json` — artefact GÉNÉRÉ (#905) par
 * `python scripts/data/gen-progression-schemas.py`, qui lit dans les PDF de `Source/` le schéma de
 * progression imprimé de chaque Carrière (quelle marque de niveau coche quelle Caractéristique).
 * Il n'est pas authoré : ce contrat verrouille la FORME que le générateur écrit et que
 * `scripts/guards/lib/progressionSchemas.mjs` consomme, pour qu'une édition à la main s'y casse.
 *
 * GÉNÉRATION : `python scripts/data/gen-progression-schemas.py` écrit l'artefact depuis les PDF de
 * `Source/` ; `--check` le compare à l'OCTET sans rien écrire. NE PAS ÉDITER À LA MAIN.
 * LECTURE : une entrée de `schemas` = une bande de schéma de progression lue dans le PDF — la réf de
 * source `{book, page}` de la grammaire (`grammaire/valeurs.ts`) y est MESURÉE sur la page : `page`
 * est le folio imprimé relevé en pied de page, `career` le titre de Carrière imprimé au-dessus de la bande,
 * `lv[n]` les Caractéristiques marquées au niveau n (`col` = colonne imprimée, `characteristic` = CharKey,
 * `teinte` = couleur RVB mesurée de l'aplat, absente au niveau 1 qui est un glyphe de police).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { charKeySchema, sourceRefSchema } from '../grammaire/valeurs';

export const file = 'progression-schemas.derived.json';
export const famille = 'config';

/** Une marque lue sur la page : sa colonne imprimée, la Caractéristique correspondante, son abscisse
 *  et — pour les niveaux 2/3/4, imprimés en aplat — la couleur RVB MESURÉE qui donne le niveau. Le
 *  niveau 1 est un glyphe de police (`crossbatstfb`), sans aplat donc sans teinte. */
const markSchema = nommerChamps(z.strictObject({
  col: z.enum(['CC', 'CT', 'F', 'E', 'I', 'Ag', 'Dex', 'Int', 'FM', 'Soc']),
  characteristic: charKeySchema,
  x: z.number(),
  teinte: z.tuple([z.number(), z.number(), z.number()]).optional(),
  mark: z.literal('glyphe').optional(),
}), {
  col: { label: 'Colonne' },
  characteristic: { label: 'Caractéristique' },
  x: { label: 'Abscisse' },
  teinte: { label: 'Teinte' },
  mark: { label: 'Marque' },
});

const doc = document(
  'progression-schemas.derived',
  famille,
  {
  livres: z.array(z.string()),
  schemas: z.array(
    nommerChamps(z.strictObject({
      ...sourceRefSchema.shape,
      /** VDM */
      career: z.string().nullable(),
      titresPage: z.array(z.string()),
      pdfpage: z.number(),
      y: z.number(),
      lv: nommerChamps(z.strictObject({
        '1': z.array(markSchema),
        '2': z.array(markSchema),
        '3': z.array(markSchema),
        '4': z.array(markSchema),
      }), {
        "1": { label: 'Premier niveau' },
        "2": { label: 'Deuxième niveau' },
        "3": { label: 'Troisième niveau' },
        "4": { label: 'Quatrième niveau' },
      }),
    }), {
      ...metaDesChamps(sourceRefSchema, { exigees: true }),
      career: { label: 'Carrière' },
      titresPage: { label: 'Titres de page' },
      pdfpage: { label: 'Page PDF' },
      y: { label: 'Ordonnée' },
      lv: { label: 'Niveaux' },
    }),
  ),
  },
  {
    livres: { label: 'Livres sources', hint: 'Provenance du dérivé : livres lus par le générateur' },
    schemas: { label: 'Schémas de progression', hint: 'Un schéma de progression relevé par Carrière' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          "artefact de GARDE (#905) : la lecture brute des schémas de progression dans les PDF (colonne, teinte d'aplat, page PDF), consommée par `scripts/guards/lib/progressionSchemas.mjs` — le contenu de jeu correspondant est déjà exposé au Codex par la Carrière et ses niveaux (`careers`/`careerLevels`).",
      },
    },
    edit: { none: 'artefact GÉNÉRÉ : il se réécrit par `scripts/data/gen-progression-schemas.py`, jamais à l’atelier' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
