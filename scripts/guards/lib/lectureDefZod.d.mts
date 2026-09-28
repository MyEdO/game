/** Les lectures de `_zod.def` et de champs d'enfants d'un texte source (vue code seul), ligne par ligne. */
export function lecturesDefZod(contenu: string, champs: readonly string[]): { ligne: number; extrait: string }[];
