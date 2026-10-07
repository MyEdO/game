/** Déclarations des questions git consommées depuis TypeScript (`cssCouchesAudit.ts`, `horsStrateAudit.ts`, `cssImages.d.mts`, `regenStock.mts`). */

/** La marque d'une poignée `depotDe` (`gitPorte.mjs`, `MARQUE_DEPOT`). */
declare const MARQUE_DEPOT: unique symbol;

/** Le DÉPÔT git d'un `cwd` (`depotDe`) : une poignée opaque et MARQUÉE, premier paramètre de chaque
 *  question ; un `{ cwd }` écrit à la main n'en est pas une. */
export type Depot = Readonly<{ cwd: string; [MARQUE_DEPOT]: true }>;
export type RequeteMesuree = { args: string[]; cwd: string; canal?: 'stdout'; status: number | null; stdout: string; stderr: string };
export const MARQUE_RACINE_MESUREE: '<RACINE>';
export function verifierRequeteMesuree(requete: RequeteMesuree): true;
export function normaliserRequeteMesuree(racine: string, requete: RequeteMesuree): RequeteMesuree;
export function relireRequeteMesuree(depot: Depot, requete: RequeteMesuree): RequeteMesuree;

export type DiagnosticGit = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
  signal?: string;
};
export type EchecGit = {
  disponible: false;
  raison: string;
  issue: 'refus' | 'lancement' | 'interruption' | 'mesure';
  diagnostic?: DiagnosticGit;
};
export type ResultatGit<T = DiagnosticGit> =
  | { disponible: true; valeur: T }
  | { disponible: true; absent: true; diagnostic?: DiagnosticGit }
  | EchecGit;
export function fait<T>(valeur: T): { disponible: true; valeur: T };
export function indisponible(raison: string, details?: Partial<Pick<EchecGit, 'issue' | 'diagnostic'>>): EchecGit;
export function classer(
  vu: Partial<DiagnosticGit> | null | undefined,
  opts?: { cwd?: string; nature?: (chemin: string) => 'repertoire' | 'fichier' | 'absent' },
): ResultatGit;
export class GitIndisponible extends Error {
  constructor(cause: string | EchecGit);
  raison: string;
  issue: EchecGit['issue'];
  diagnostic?: DiagnosticGit;
}
export function reussi(union: ResultatGit): boolean;
export function refusDeGit(vu: ResultatGit | GitIndisponible): string;
export function pousser(depot: Depot, geste: { vers: string; bail?: boolean }): ResultatGit;
export function fetchOrigin(depot: Depot, opts?: { branche?: string }): ResultatGit;

/** Le dépôt git de `cwd`. */
export function depotDe(
  cwd: string,
  opts?: {
    env?: NodeJS.ProcessEnv | (() => NodeJS.ProcessEnv);
    spawn?: typeof import('node:child_process').spawnSync;
    attendre?: (ms: number) => void;
    enPanne?: (raison: string, vu: EchecGit) => void;
  },
): Depot;
/** La racine de l'arbre de travail, `null` hors d'un arbre. */
export function racineDe(depot: Depot): string | null;
/** La valeur de l'attribut `nom` sur `chemin` (`check-attr`), `null` si git ne répond pas. */
export function attributDe(depot: Depot, chemin: string, nom: string): string | null;
export const INDEX: string;
export const SUIVI: string;
export const TRAVAIL: string;

/** Une entrée d'image (`entreesDe`) : mode et sha du blob. */
export type EntreeDImage = { mode: string; sha: string };
/** La valeur de l'attribut `nom` sur chacun des `chemins` (`check-attr --stdin`). */
export function attributsDe(depot: Depot, chemins: readonly string[], nom: string): Map<string, string>;
/** Les entrées de `chemins` dans l'image `arbre` (une ref, ou `INDEX`). */
export function entreesDe(depot: Depot, arbre: string, chemins: readonly string[], opts?: { index?: string | null }): Map<string, EntreeDImage>;
/** Le dernier commit de `de..vers` qui ajoute `chemin`, `null` sans lui. */
export function ajoutDe(depot: Depot, de: string, vers: string, chemin: string): string | null;
/** Les commits de `tete` absents de `amont` (`git cherry`). */
export function ceriseDe(depot: Depot, amont: string, tete: string): { signe: '+' | '-'; sha: string }[];
/** Le contenu du blob `sha`, en octets ; sous `chemin`, filtré pour l'arbre de travail. */
export function contenuDuBlob(depot: Depot, sha: string, opts?: { chemin?: string }): Buffer;
/** Le sha de blob de chacun des fichiers `chemins` de l'arbre de travail. */
export function shasDuTravail(depot: Depot, chemins: readonly string[]): Map<string, string>;
/** La fusion à trois au style diff3, marqueurs de `taille` caractères, ou `{ binaire: true }`. */
export function fusionDiff3(
  depot: Depot,
  fichiers: { ours: string; base: string; theirs: string },
  labels: { ours: string; base: string; theirs: string },
  taille: number,
): { texte: string; conflit: boolean } | { binaire: true };
/** Un blob écrit tel quel dans la base d'objets. */
export function ecrireBlob(depot: Depot, contenu: Buffer | string): ResultatGit;
/** Des entrées posées ou retirées dans l'index `index`. */
export function poserDansIndex(
  depot: Depot,
  p: { index: string; entrees: readonly ({ chemin: string; mode: string; sha: string } | { chemin: string; retirer: true })[] },
): ResultatGit;
/** Les entrées aux stats périmées de l'index `index`, rafraîchies. */
export function rafraichirIndex(depot: Depot, p: { index: string }): ResultatGit;
/** L'arbre de travail et l'index `index` avancés de `de` à `vers` (`read-tree -m -u`). */
export function avancerArbre(depot: Depot, p: { index: string; de: string; vers: string }): ResultatGit;
/** Le hook `nom` joué sur `args`. */
export function lancerHook(depot: Depot, nom: string, args: readonly string[]): ResultatGit;
/** Le résultat d'un ordre de transaction de refs. */
export type OrdreDeRefs = { ok: true } | { ok: false; raison: string };
/** Une transaction de refs gardée ouverte (`update-ref --stdin`). */
export function transactionDeRefs(
  depot: Depot,
  p: { message: string },
): {
  pid: number | undefined;
  start(): Promise<OrdreDeRefs>;
  update(ref: string, nouveau: string, ancien: string): Promise<OrdreDeRefs>;
  prepare(): Promise<OrdreDeRefs>;
  commit(): Promise<OrdreDeRefs>;
  abort(): Promise<OrdreDeRefs>;
};
