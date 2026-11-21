// Types du socle d'écriture des dérivés et de la mesure de leurs sources (#1679) — mêmes signatures
// que ecriture-derives.mjs.

export function fusionnerLectures(dossier: string): {
  fichiers: string[];
  dossiers: Map<string, string[]>;
  ecrits: string[];
  /** Chemins LUS hors racine, refusés : distincts par processus, sommés entre PID. */
  cheminsRejetes: number;
  git: import('../../guards/lib/requeteMesuree.mjs').RequeteMesuree[];
  sondes: SondeMesuree[];
  incomplet: string[];
};

export type SondeMesuree = { chemin: string; type: 'exists' | 'stat' | 'lstat' | 'access'; existe: boolean; nature: 'file' | 'directory' | 'other' | null; mode?: number; code?: string };

export function serialiserSourcesLues(
  parGenerateur: Record<string, { cibles: readonly string[]; fichiers: readonly string[]; dossiers: readonly string[]; git?: readonly import('../../guards/lib/requeteMesuree.mjs').RequeteMesuree[]; sondes?: readonly SondeMesuree[]; incomplet?: readonly string[] }>,
): string;

export function existeFichier(chemin: string): boolean;

export function estUnDocMarkdown(cible: string): boolean;

export function ecrireSourcesLues(cwd: string, contenu: string): void;
export const LECTURES_DU_BUILD: string;
export function ciblesRenduesDans(dossier: string): string;

export type CibleRendue = {
  out: string;
  path: string;
  staleMsg?: string;
  rerunMsg?: string;
  okMsg?: string;
  writeMsg?: string;
  amorce?: true;
};

export type Production = (options: { check: boolean }) =>
  Generator<CibleRendue, void, boolean> | AsyncGenerator<CibleRendue, void, boolean>;

export function lancerDepuisCLI(meta: ImportMeta, produire: Production): Promise<void>;
export function lancerDepuisManifeste(meta: ImportMeta, charger: (script: string) => Promise<Production>): Promise<void>;
