// Types du socle d'empreinte de sources (#1679 L1b) — mêmes signatures que empreinte-sources.mjs.

export const PIED_RX: RegExp;

export function lirePied(texte: string): { empreinte: string; fichiers: number; dossiers: number } | null;

export function retirerPied(texte: string): string;

export function avecPied(
  texte: string,
  pied: { empreinte: string; fichiers: number; dossiers: number },
): string;

export function hashBlobDisque(chemin: string): string;

export function hashListing(entrees: readonly string[]): string;

export function fusionnerLectures(dossier: string): {
  fichiers: string[];
  dossiers: Map<string, string[]>;
  ecrits: string[];
  /** Chemins LUS hors racine, refusés : distincts par processus, sommés entre PID. */
  cheminsRejetes: number;
};

export function indexGit(racine: string): Map<string, string>;

export function enfantsDeLIndex(blobs: Map<string, string>, dossier: string): string[];

export function empreinteDe(
  fichiers: Iterable<[string, string]>,
  dossiers: Iterable<[string, string]>,
): string;

export function empreinteDuDisque(
  racine: string,
  lues: { fichiers: readonly string[]; dossiers: Map<string, string[]> },
  ignores: Set<string>,
): { empreinte: string; fichiers: Map<string, string>; dossiers: Map<string, string> };

export function empreinteDeLIndex(
  blobs: Map<string, string>,
  lues: { fichiers: readonly string[]; dossiers: Map<string, string[]> },
): { empreinte: string; fichiers: Map<string, string>; dossiers: Map<string, string>; manquants: string[] };

export function serialiserSourcesLues(
  parGenerateur: Record<string, { cibles: readonly string[]; fichiers: readonly string[]; dossiers: readonly string[] }>,
): string;

export function deltaSourcesLues(
  avant: Record<string, { cibles?: readonly string[]; fichiers?: readonly string[]; dossiers?: readonly string[] }> | null | undefined,
  apres: Record<string, { cibles?: readonly string[]; fichiers?: readonly string[]; dossiers?: readonly string[] }> | null | undefined,
): { generateur: string; champ: 'cibles' | 'dossiers' | 'fichiers'; ajoutes: string[]; retires: string[] }[];

export function existeFichier(chemin: string): boolean;
