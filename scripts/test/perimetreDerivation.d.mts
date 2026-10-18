export interface Lien {
  nature: 'touché' | 'toolchain' | 'import' | 'racine balayée' | 'setup';
  distance: number;
  rang?: number;
  chaine?: string[];
  racine?: string;
  specificite?: number;
  site?: string;
  touche: string;
}
export interface NonResolu { site: string; fichier: string; helper: string; raison: string; moduleBalaieLeDepot: boolean }
export interface Images { base: string | null; tete: string | null; touches: string[]; post: string[]; avant: string[] }
export interface Derivation {
  retenus: Map<string, Lien>;
  signaux: Map<string, { signal: string; noms: string[] }>;
  toolchain: string[];
  nonResolus: NonResolu[];
  vitest: string[];
  node: string[];
  setup: string[];
  modules: number;
}
export interface Memos {
  lire(nom: string, cle: string): unknown;
  ecrire(nom: string, cle: string, valeur: unknown): void;
  elaguer(): void;
  sauver(): void;
}
export function memosDeDerivation(dossier: string, version: string, options?: {
  lectureSeule?: boolean;
  limiteFamille?: number;
  diagnostic?: (nom: string, raison: string) => void;
  imagesVivantes?: Map<string, Set<string>>;
}): Memos;
export function versionDesMemosDeDerivation(racine: string, options?: {
  fermeture?: (module: string, racine: string) => [string, string | null][];
  lire?: (fichier: string, encodage: string) => string;
  format?: string;
  dossierDesMemos?: string;
  lectureSeule?: boolean;
}): string;
export function bornerIR(module: string, valeur: string, limite?: number): string;
export function deriverPerimetre(entree: {
  racine: string;
  touches: string[];
  post: string[];
  avant: string[];
  lire: (rels: string[]) => Map<string, string | null>;
  lireAvant?: (rels: string[]) => Map<string, string | null>;
  memos?: Memos;
  stade?: (nom: string, module: string | null) => void;
}): Derivation;
export function produireDTO(entree: { racine: string; base?: string; tete?: string; dossierDesMemos?: string; lectureSeule?: boolean; mode?: string }, stade?: (nom: string, module: string | null) => void): object;
export function enDTO(images: Images, derive: Derivation): object;
export function depuisDTO(dto: unknown): Images & Derivation;
export function signalDe(lien: { distance: number }, liaisons: { forme: string; importe: { nom: string } | null }[], touches: Set<string>): { signal: string; noms: string[] };
export function declarationsExportees(rel: string, texte: string | null): Map<string, string>;
export function exportsTouches(rel: string, avant: string | null, apres: string | null): Set<string>;
export const lireDuDisque: (racine: string) => (rels: string[]) => Map<string, string | null>;
export const estTestNode: (rel: string) => boolean;
export const CACHE: string;
export const RANG_SETUP: number;
export const RANG_TOOLCHAIN: number;
export const FORMAT_DES_MEMOS: string;
export const FORMAT_DTO: number;
export const LIMITE_IR: number;
export const LIMITE_FAMILLE: number;
export const FICHIERS_DE_CONTEXTE: readonly string[];
