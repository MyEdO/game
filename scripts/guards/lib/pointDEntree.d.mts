/** Une détection du point d'entrée écrite à la main : ligne 1-based de la source d'origine. */
import type { AnalyseEmpruntee } from './dialecte.mjs';
export interface DetectionDePointDEntree {
  readonly ligne: number;
  readonly extrait: string;
}

/** Détections du point d'entrée écrites à la main dans `source` (définition : en-tête de `pointDEntree.mjs`). */
export function detectionsDePointDEntree(source: string, chemin?: string, analyse?: AnalyseEmpruntee): DetectionDePointDEntree[];
