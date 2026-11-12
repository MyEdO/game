/** Un processus du pont (`processus.mjs`) lancé par Node sur son script, pour les tests : sa sortie lue ligne à ligne. */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';

export interface ProcessusDuPont {
  processus: ChildProcessWithoutNullStreams;
  /** Chaque ligne lue de sa sortie, dans l'ordre. */
  sortie: string[];
  /** Les lignes de sa sortie, et la prochaine, gardée dans `sortie`. */
  lignes: AsyncIterator<string>;
  prochaine: () => Promise<string>;
  /** La ligne que rend la requête `[methode, json|null]`. */
  appel: (methode: string, entree?: unknown) => Promise<{ ok: boolean; vue?: unknown; erreur?: { categorie: string } }>;
}

export function ouvrirLeProcessus(script: string): ProcessusDuPont {
  const processus = spawn(process.execPath, [script], { stdio: ['pipe', 'pipe', 'pipe'] });
  processus.stderr.resume();
  const lignes = createInterface({ input: processus.stdout, crlfDelay: Infinity })[Symbol.asyncIterator]();
  const sortie: string[] = [];
  const prochaine = async () => {
    const { value, done } = await lignes.next();
    if (done) throw new Error('sortie standard close');
    sortie.push(value);
    return value;
  };
  const appel = async (methode: string, entree?: unknown) => {
    processus.stdin.write(`${JSON.stringify([methode, entree === undefined ? null : JSON.stringify(entree)])}\n`);
    return JSON.parse(await prochaine());
  };
  return { processus, sortie, lignes, prochaine, appel };
}
