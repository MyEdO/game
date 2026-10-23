/** Sites `{ ligne, texte }` d'un fichier où un verbe de `verbes` est appelé directement sur un handler
 *  de flux (`FLOWS`/`FLOW_HANDLERS`), hors générateur (#2903). Contrat : en-tête de
 *  `delegueDeVerbeManuscrit.mjs`. */
export function sitesDeDelegueManuscrit(f: { rel: string; text: string }, verbes: Iterable<string>): { ligne: number; texte: string }[];
