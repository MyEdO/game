/** Une lecture d'hôte que le rendu sous win32 ne simule pas : ligne 1-based de la source d'origine. */
export interface LectureDHote {
  readonly ligne: number;
  readonly extrait: string;
}

/** Lectures d'hôte non simulées dans `source` (définition : en-tête de `graphiesDHote.mjs`). */
export function lecturesDHote(source: string, chemin?: string): LectureDHote[];
