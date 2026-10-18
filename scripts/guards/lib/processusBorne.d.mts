import type { ChildProcess } from 'node:child_process';

export interface ErreurArret {
  operation?: string;
  pid?: number | null;
  code?: string;
  message: string;
  cause?: unknown;
}
export interface ArretProcessus {
  pid?: number | null;
  etat: 'demande' | 'indetermine' | 'mort';
  erreurs: ErreurArret[];
  echeance?: number;
  methode?: string;
  zeroNatif?: boolean;
}
export interface ResultatCible {
  status: number | null;
  signal: NodeJS.Signals | null;
  error?: { code: string; message: string };
  pid?: number;
}
export interface ProcessusNatif {
  identifiant: string;
  pid: number;
  ppid: number;
  creation: string;
  residentOctets: number;
  metriqueMemoire: string;
  etat: string;
  erreurs: unknown[];
  role: 'hote' | 'worker' | 'cible' | null;
  entreeId: string | null;
}
export interface ControleSupervision {
  readonly pid: number | null;
  readonly phase: 'demarrage' | 'execution' | 'cloture' | 'termine';
  estFermeture(cause: unknown): boolean;
  pret: Promise<{ pidCible: number; instanceCible: string }>;
  fin: Promise<{ resultatCible: ResultatCible; arret: ArretProcessus }>;
  finPhysique: Promise<void>;
  demanderArret(cause?: Error | string): number | undefined;
  mesurerDomaine(options?: { timeout?: number }): { processus: ProcessusNatif[]; metriqueMemoire: string };
  attribuer(identite: { identifiant: string; pid: number; creation: string; destination: { type: 'parent' } | { type: 'entree'; id: string } }, options?: { timeout?: number }): unknown;
}
export interface OptionsSupervision {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdio?: unknown;
  shell?: boolean;
  delaiArretMs?: number;
  signal?: AbortSignal;
}
export interface FabriqueSupervision {
  (commande: string, argv: readonly string[], options: OptionsSupervision): Promise<{ hote: ChildProcess; controle: ControleSupervision }>;
  optionsEffectives?: (commande: string, argv: readonly string[], options: OptionsSupervision) => { args: readonly string[]; options: OptionsSupervision } | null;
}
export const DELAI_ARRET_MS: number;
export function tuerArbre(controle: ControleSupervision, cause?: Error | string): Promise<ArretProcessus>;
export interface ResultatProcessusBorne {
  code: number;
  status: number | null;
  signal: NodeJS.Signals | null;
  error: (Error & { code?: string }) | null;
  stdout: string;
  stderr: string;
  expiree: boolean;
  annulee: boolean;
  arret: ArretProcessus;
  controle?: ControleSupervision;
  fichier: string;
  sortie: string;
  limiteMs: number;
  pid: number | undefined;
}
export function diagnosticDuLancement(resultat?: Partial<ResultatProcessusBorne> & { dossier?: string; defautCollecte?: unknown }): unknown;
export function diagnosticArret(resultat: Partial<ResultatProcessusBorne>, journal: (texte: string) => void, prefixe?: string): boolean;
export function spawnBorne(options: {
  commande?: string;
  argv: readonly string[];
  fichier: string;
  limiteMs: number;
  delaiArretMs?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  surPid?: (pid: number) => void;
  surControle?: (controle: ControleSupervision) => void;
  site?: string;
  signal?: AbortSignal;
  fluxDistincts?: boolean;
  maxBuffer?: number;
  superviser?: FabriqueSupervision;
}): Promise<ResultatProcessusBorne>;
