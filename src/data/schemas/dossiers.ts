/**
 * Les fiches de dossier de chapitre (#2290), côté app : un jeu les remet par son contenu (`ContenuDUnJeu.dossiers`,
 * `src/hote/contenu.ts`), chacune lue par `lireFicheDeDossier` (`src/data/schemas/source/dossier.ts`), la lecture que partage
 * le chargeur Node (`scripts/raw/lib/dossiers.mjs`). Un fichier hors de la forme `<ABBR>/<NN>.json` LÈVE à la lecture.
 */
import { entreesDeLaFiche, lireFicheDeDossier, type EntreeNommee, type FicheLue } from './source/dossier';

/** Les fiches `fichiers` (chemin relatif au dossier `dossier` → JSON de la fiche), lues dans leur ordre. */
export const lireLesFiches = (dossier: string, fichiers: Readonly<Record<string, unknown>>): readonly FicheLue[] =>
  Object.entries(fichiers).map(([rel, json]) => lireFicheDeDossier(`${dossier}/${rel}`, rel, json));

/** Les entrées des fiches `fiches`, par fiche puis par famille. */
export const entreesDesFiches = (fiches: readonly FicheLue[]): readonly EntreeNommee[] =>
  fiches.flatMap(({ abbr, nn, fiche }) => entreesDeLaFiche(abbr, nn, fiche));
