import type { CorpusFile } from './sourceCorpus.mjs';

/** Sites `{ ligne, texte }` d'un fichier où un verbe de `verbes` est appelé directement sur un handler
 *  de flux (`FLOWS`), hors générateur (#2903). Contrat : en-tête de
 *  `delegueDeVerbeManuscrit.mjs`. */
export function sitesDeDelegueManuscrit(f: Pick<CorpusFile, 'rel' | 'text'>, verbes: Iterable<string>): { ligne: number; texte: string }[];
