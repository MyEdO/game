/**
 * Schéma de `raceAppearance.json` — apparence de base d'une espèce de rig (Humain, Ogre, Skaven…),
 * consommée comme `RaceAppearanceData[]` (`src/data/index.ts`). PAR RÉFÉRENCE : `featureKeys`
 * (catalogue d'éléments), ids de gabarit/tête/jambes, libellé de tenue, couleurs — les SVG/gabarits
 * restent des registres CODE résolus par `src/gameIso/rig/races/index.ts`.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { surchargePaletteSchema } from '../grammaire/valeurs';
import { SLOTS } from '../../palette.types';

export const file = 'raceAppearance.json';
export const famille = 'entite';

const doc = document(
  'raceAppearance',
  famille,
  {
    gabarit: z.string(),
    gabaritOverride: z.record(z.string(), z.number()).optional(),
    palette: z.record(z.string(), z.string()).optional(),
    paletteF: z.record(z.string(), z.string()).optional(),
    head: z.string().optional(),
    legs: z.string().optional(),
    armG: z.string().optional(),
    armD: z.string().optional(),
    dropHeadgear: z.boolean().optional(),
    tirageIndividuel: z.partialRecord(z.enum(SLOTS), z.array(z.string()).min(1)).optional(),
    featureKeys: z.array(z.string()).optional(),
    pose: z.record(z.string(), z.number()).optional(),
    tenue: z.string().optional(),
    colors: surchargePaletteSchema.optional(),
    sex: z.enum(['M', 'F']).optional(),
    parts: z.strictObject({ cheveux: z.number().optional(), visage: z.number().optional() }).optional(),
    scale: z.number().optional(),
    eyes: z.strictObject({ G: z.string().optional(), D: z.string().optional() }).optional(),
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
    armG: { label: 'Bras gauche monstrueux', hint: 'Pièce qui remplace l’épaule gauche' },
    armD: { label: 'Bras droit monstrueux', hint: 'Pièce qui remplace l’épaule droite (ex. griffe)' },
    dropHeadgear: { label: 'Sans couvre-chef', hint: 'La race ne porte jamais le couvre-chef d’une tenue (ex. Vampire)' },
    tirageIndividuel: {
      label: 'Teintes tirées par individu',
      hint: 'Teintes (peau, cheveux…) parmi lesquelles chaque individu de la race reçoit la sienne ; ce qu’on fixe sur le personnage ou la créature l’emporte',
    },
    featureKeys: { label: 'Traits de corps', hint: 'Traits anatomiques ajoutés au rig (ventre, barbe, queue, cornes…)' },
    pose: { label: 'Posture au repos', hint: 'Posture de face et de profil au repos' },
    tenue: { label: 'Tenue par défaut', hint: 'Tenue portée par défaut par cette race' },
    colors: { label: 'Surcharge de palette', hint: 'Couleurs qui surchargent la palette de base pour cette race' },
    sex: { label: 'Sexe forcé', hint: 'Sexe imposé au rig de cette race, sans choix' },
    parts: { label: 'Coiffure/visage épinglés', hint: 'Variante de coiffure et de visage fixée pour cette race' },
    scale: { label: 'Échelle du token', hint: 'Facteur d’échelle globale du pion en jeu (ex. Géant)' },
    eyes: {
      label: 'Yeux par défaut',
      hint: 'Yeux par défaut de la race, œil gauche/droit (clés du catalogue) — surchargés par mutation/blessure',
    },
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
