/** Dit si le harnais présente ce dialecte à la reconnaissance des workflows. */
export function estDialecteDeWorkflow(chemin: string): boolean;

/** Reconnaît la forme d'un workflow et signale les défauts d'association entre son meta et l'agent libre. */
export function lireWorkflow(texte: string, fichier: string): {
  script: boolean;
  exportDeMeta: number | null;
  defauts: string[];
};
