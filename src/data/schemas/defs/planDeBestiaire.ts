/**
 * Schéma de `planDeBestiaire.json` (#2993) — LE plan de bestiaire du design de #2972 (révision 5, « une base par
 * corps, pas par plan ») : par espèce de rendu, la base humanoïde à une race de rendu (`race`), un corps d'un
 * générateur (`corps`, sa `famille`), ou ni l'un ni l'autre et le motif de son omission (`omis`) ; et l'échelle d'art de qui
 * porte un corps (`echelle`). Il fait le domaine des espèces d'apparence (`especeDApparenceSchema`,
 * `grammaire/valeurs.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { ref } from '../grammaire/ref';
import { enumNomme } from '../grammaire/valeurs';

export const file = 'planDeBestiaire.json';
export const famille = 'entite';

/** Les familles de générateur de corps, une par ticket de générateur (#2973 à #2985). */
export const familleDeCorpsSchema = enumNomme({
  quadrupede: 'Quadrupède',
  'quadrupede-aile': 'Quadrupède ailé',
  oiseau: 'Oiseau',
  'sans-jambes': 'Sans jambes',
  theropode: 'Théropode',
  'arthropode-a-pinces': 'Arthropode à pinces',
  'sans-membres': 'Sans membres',
  amorphe: 'Amorphe',
  arachnide: 'Arachnide',
  poisson: 'Poisson',
  unique: 'Unique',
  cephalopode: 'Céphalopode',
  squig: 'Squig',
});

const doc = document(
  'planDeBestiaire',
  famille,
  {
    race: ref('raceAppearance').optional(),
    corps: z.string().min(1).optional(),
    famille: familleDeCorpsSchema.optional(),
    omis: z.string().min(1).optional(),
    echelle: z.number().positive().optional(),
  },
  {
    race: { label: 'Race de rendu', hint: 'L’espèce porte la base humanoïde, à cette race de rendu' },
    corps: { label: 'Corps', hint: 'Le corps qu’un générateur construit pour l’espèce', texte: { regime: 'technique' } },
    famille: { label: 'Générateur', hint: 'La famille de générateur qui construit ce corps' },
    omis: { label: 'Omise', hint: 'L’espèce n’a aucun corps : le motif', texte: { regime: 'technique' } },
    echelle: { label: 'Échelle d’art', hint: 'Facteur d’échelle du corps de l’espèce, à Taille égale' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison: 'plan d’art des corps 3D (art, pas règle) — aucune catégorie du Codex ne l’expose, il s’édite au fichier `src/data/planDeBestiaire.json`',
      },
    },
    edit: { none: 'plan d’art, édité au fichier `src/data/planDeBestiaire.json` — aucun écran ne l’écrit', dataset: 'planDeBestiaire' },
  },
  {
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const { race, corps, famille: generateur, omis, echelle } = v as { race?: unknown; corps?: unknown; famille?: unknown; omis?: unknown; echelle?: unknown };
        if ((corps === undefined) !== (generateur === undefined)) ctx.addIssue({ code: 'custom', path: ['famille'], message: 'plan de bestiaire : un `corps` nomme sa `famille` de générateur, et seul un corps en a une.' });
        if ([race, corps, omis].filter((x) => x !== undefined).length !== 1) ctx.addIssue({ code: 'custom', message: 'plan de bestiaire : une espèce porte exactement un de `race`, `corps` ou `omis`.' });
        const porte = omis === undefined;
        if (porte !== (echelle !== undefined)) ctx.addIssue({ code: 'custom', path: ['echelle'], message: 'plan de bestiaire : une espèce qui porte un corps a son `echelle`, une espèce omise n’en a aucune.' });
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
