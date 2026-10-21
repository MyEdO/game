/** Les entrées qu'un hôte externe importe, mesurées chacune par `mesure`. */
export const ENTREES_FERMEES: readonly ['src/noyau/index.ts', 'src/scenes/test-scenarios/index.ts', 'src/hoteTexte/cli.ts'];
/** Les zones de `src/` qu'aucun module de la fermeture ne charge. */
export const ZONES_D_HOTE: readonly string[];
/** Les paquets qu'aucun module de la fermeture ne charge. */
export const PAQUETS_D_HOTE: readonly string[];
/** Le nom de paquet d'un spécificateur nu, `null` pour un chemin ou un alias. */
export function paquetDe(spec: string): string | null;
/** La fermeture d'exécution de `depart`, ses paquets et ses fautes. */
export function mesure(p?: {
  racine?: string;
  depart?: string;
  arbre?: { existe: (abs: string) => boolean; lire: (abss: string[]) => Map<string, string | null>; fichiers: readonly string[] };
}): { modules: string[]; paquets: string[]; fautes: { cible: string; chaine: string[] }[] };
