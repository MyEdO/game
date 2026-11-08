/**
 * Les fiches de dossier de chapitre COMMITÉES (#2290), côté app : `docs/dossiers/<ABBR>/<NN>.json`, chacune
 * lue par `lireFicheDeDossier` (`src/data/source/dossier.ts`), la lecture que partage le chargeur Node
 * (`scripts/raw/lib/dossiers.mjs`). Chargement par le registre généré (`FICHIERS_DE_DOSSIER`, `scripts/gen-registry.mjs`).
 * Tout `.json` sous la racine est lu : un fichier hors de la forme `<ABBR>/<NN>.json` LÈVE au chargement.
 */
import { FICHIERS_DE_DOSSIER } from './_dossiers.generated';
import { entreesDeLaFiche, lireFicheDeDossier, type EntreeNommee, type FicheLue } from './source/dossier';

/** Les fiches commitées, en ordre de chemin. */
export const FICHES_DE_DOSSIER: readonly FicheLue[] = Object.entries(FICHIERS_DE_DOSSIER)
  .map(([rel, json]) => lireFicheDeDossier(`docs/dossiers/${rel}`, rel, json));

/** Une entrée nommée d'une fiche commitée, avec le livre et le chapitre de sa fiche. */
interface EntreeDeDossier extends EntreeNommee {
  abbr: string;
  nn: string;
}

/** Toutes les entrées des fiches commitées, par fiche puis par famille. */
export const ENTREES_DE_DOSSIER: readonly EntreeDeDossier[] = FICHES_DE_DOSSIER.flatMap(({ abbr, nn, fiche }) =>
  entreesDeLaFiche(abbr, nn, fiche).map((e) => ({ ...e, abbr, nn })),
);
