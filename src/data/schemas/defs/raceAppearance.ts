/**
 * Schéma de `raceAppearance.json` — apparence de base d'une espèce (Humain, Ogre, Skaven…),
 * consommée comme `RaceAppearanceData[]` (`src/data/index.ts`). PAR RÉFÉRENCE : `featureKeys`
 * (catalogue d'éléments), id de gabarit (`gabarits.json`), ids de tête/jambes, libellé de tenue, couleurs.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { paletteDEspeceSchema, sexeSchema } from '../grammaire/valeurs';
import { SLOTS } from '../../palette.types';
import { ref } from '../grammaire/ref';
import { surchargeDeGabaritSchema } from './gabarits';

export const file = 'raceAppearance.json';
export const famille = 'entite';

const doc = document(
  'raceAppearance',
  famille,
  {
    gabarit: ref('gabarit'),
    gabaritOverride: surchargeDeGabaritSchema.optional(),
    palette: paletteDEspeceSchema.optional(),
    paletteF: paletteDEspeceSchema.optional(),
    head: z.string().optional(),
    legs: z.string().optional(),
    dropHeadgear: z.boolean().optional(),
    tirageIndividuel: z.partialRecord(z.enum(SLOTS), z.array(z.string()).min(1)).optional(),
    featureKeys: z.array(z.string()).optional(),
    pose: z.record(z.string(), z.number()).optional(),
    tenue: z.string().optional(),
    sex: sexeSchema.optional(),
    scale: z.number().optional(),
    extremites: z.enum(['lisses', 'griffues']).optional(),
  },
  {
    gabarit: { label: 'Gabarit', hint: 'Identifiant du gabarit de silhouette par défaut de la race' },
    gabaritOverride: {
      label: 'Surcharge de gabarit',
      hint: 'Mesures du gabarit surchargées pour cette race (longueur et épaisseur globales, jambes, bras, tête)',
    },
    palette: { label: 'Palette', hint: 'Couleurs de peau/cheveux/yeux par défaut de la race' },
    paletteF: {
      label: 'Palette (variante féminine)',
      hint: 'Palette propre au sexe féminin ; absente = la palette commune sert aux deux sexes',
    },
    head: { label: 'Tête monstrueuse', hint: 'Pièce de tête non humaine qui remplace le visage cosmétique' },
    legs: { label: 'Jambes monstrueuses', hint: 'Pièce de jambes qui remplace les deux cuisses (ex. sabots de chèvre)' },
    dropHeadgear: { label: 'Sans couvre-chef', hint: 'La race ne porte jamais le couvre-chef d’une tenue (ex. Vampire)' },
    tirageIndividuel: {
      label: 'Teintes tirées par individu',
      hint: 'Teintes (peau, cheveux…) parmi lesquelles chaque individu de la race reçoit la sienne ; ce qu’on fixe sur le personnage ou la créature l’emporte',
    },
    featureKeys: { label: 'Traits de corps', hint: 'Traits anatomiques ajoutés à l’apparence de la race (ventre, barbe, queue, cornes…)' },
    pose: { label: 'Posture au repos', hint: 'Posture de face et de profil au repos' },
    tenue: { label: 'Tenue par défaut', hint: 'Tenue portée par défaut par cette race' },
    sex: { label: 'Sexe forcé', hint: 'Sexe imposé à l’apparence de cette race, sans choix' },
    scale: { label: 'Échelle du token', hint: 'Facteur d’échelle globale du pion en jeu (ex. Géant)' },
    extremites: { label: 'Nu des pieds', hint: 'Aspect des pieds nus (lisses ou griffues) quand rien ne les chausse' },
  },
  {
    codex: { keys: ['raceAppearance'] },
    edit: { dataset: 'raceAppearance' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
