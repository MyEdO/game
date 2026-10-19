/** Les suites Vitest de l'arbre de travail du dépôt, chemins POSIX relatifs, triés ; lève sur une suite vide. */
export function suiteVitestDuDepot(racine?: string, options?: { env?: NodeJS.ProcessEnv }): string[];
/** Les suites Vitest du dépôt, avec leur chemin absolu et leur texte. */
export function fichiersDeLaSuite(racine?: string, options?: { env?: NodeJS.ProcessEnv }): { abs: string; rel: string; text: string }[];
