/** Les fabriques à fermeture de `src/` (hors tests), par nom : l'inventaire que `estFabriqueAFermeture` relève. */
export const FABRIQUES_A_FERMETURE: readonly string[];

/** Les fabriques dont l'évaluation de premier niveau est admise, et pourquoi. */
export const FABRIQUES_ADMISES: Readonly<Record<string, string>>;

/** Une fonction ESTree qui déclare un état et rend une fonction ou un objet de fonctions. */
export function estFabriqueAFermeture(fn: unknown): boolean;

/** Les fonctions de PREMIER NIVEAU d'un programme ESTree : `[nom, nœud de déclaration, fonction]`. */
export function fonctionsDePremierNiveau(programme: unknown): [nom: string, declaration: unknown, fonction: unknown][];

/** Le mur `murs/etat-de-module` (règle de plugin oxlint). */
declare const etatDeModule: { meta: { type: string }; create(context: unknown): Record<string, (node: unknown) => void> };
export default etatDeModule;
