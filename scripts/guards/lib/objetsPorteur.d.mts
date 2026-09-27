import type { Program } from 'typescript';

export interface EcartObjetsPorteur {
  angle: 'placement' | 'entree';
  /** Forme d'écriture attrapée (`affectation`, `delete`, `Object.assign`, `push`, `unshift`, `splice`,
   *  `affectation étendue`, `littéral d’objet`). */
  forme: string;
  /** `fichier:ligne`, chemin relatif à la racine. */
  at: string;
}

/** Racines du Program du dépôt pour cette garde : `src/` hors tests. */
export function racinesSrc(fileNames: string[], root: string): string[];

/** Program du dépôt pour cette garde (rien n'est retenu). */
export function programmeObjetsPorteur(root: string): Program;

/** Écarts du placement et de l'entrée d'un objet chez un porteur, `src/` hors tests. */
export function auditObjetsPorteur(root: string, programme?: Program | null): EcartObjetsPorteur[];
