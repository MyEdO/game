import type { CorpusFile } from './sourceCorpus.mjs';

export interface FlowTestRollSite {
  /** Chemin POSIX depuis la racine du dépôt. */
  file: string;
  line: number;
  /** Fonction de `src/engine/**` qui porte le site. */
  fn: string;
  /** Ligne de DÉCLARATION de `fn` — celle qu'un doc généré cite quand il NOMME le résolveur. */
  fnLine: number;
  /** `lecteur` : le roulage est DANS une fonction qui lit le nœud · `appelant` : le site appelle une telle fonction. */
  famille: 'lecteur' | 'appelant';
  /** Motif appelé (`rollTest`/`d100`/`TestOutcome.seal`, ou le nom de la fonction fautive appelée). */
  name: string;
  detail: string;
}

export function scanFlowTestEngineRoll(engineFiles: Pick<CorpusFile, 'rel' | 'text'>[]): FlowTestRollSite[];
export function siteLabel(s: FlowTestRollSite): string;
