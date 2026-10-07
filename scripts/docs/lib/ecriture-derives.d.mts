// Types du socle d'écriture des dérivés et de la mesure de leurs sources (#1679) — mêmes signatures
// que ecriture-derives.mjs.

export function fusionnerLectures(dossier: string): {
  fichiers: string[];
  dossiers: Map<string, string[]>;
  ecrits: string[];
  /** Chemins LUS hors racine, refusés : distincts par processus, sommés entre PID. */
  cheminsRejetes: number;
  git: import('../../guards/lib/gitPorte.mjs').RequeteMesuree[];
  sondes: SondeMesuree[];
  incomplet: string[];
};

export type SondeMesuree = { chemin: string; type: 'exists' | 'stat'; existe: boolean; nature: 'file' | 'directory' | 'other' | null; code?: string };

export function serialiserSourcesLues(
  parGenerateur: Record<string, { cibles: readonly string[]; fichiers: readonly string[]; dossiers: readonly string[]; git?: readonly import('../../guards/lib/gitPorte.mjs').RequeteMesuree[]; sondes?: readonly SondeMesuree[]; incomplet?: readonly string[] }>,
): string;

export function existeFichier(chemin: string): boolean;

export function estUnDocMarkdown(cible: string): boolean;

export function ecrireDoc(chemin: string, contenu: string): void;

export function ecrireOuVerifier(args: {
  out: string;
  path: string;
  check: boolean;
  staleMsg: string;
  rerunMsg: string;
  okMsg?: string;
  writeMsg?: string;
}): boolean;
