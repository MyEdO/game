/** Les fichiers de l'arbre de travail du dépôt que joue la suite `suite` (la principale par défaut), chemins POSIX relatifs, triés ; lève sur une suite vide. */
export function suiteVitestDuDepot(racine?: string, options?: { env?: NodeJS.ProcessEnv; suite?: (rel: string) => boolean }): string[];
/** Les fichiers de la suite `suite` du dépôt, avec leur chemin absolu et leur texte. */
export function fichiersDeLaSuite(racine?: string, options?: { env?: NodeJS.ProcessEnv; suite?: (rel: string) => boolean }): { abs: string; rel: string; text: string }[];
