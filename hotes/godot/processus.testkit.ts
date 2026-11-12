/** Un processus du pont (`processus.mjs`) lancé par Node sur son script et ses options, pour les tests : sa sortie lue
 *  en lignes et en octets bruts, dans l'ordre où il les écrit. */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

export interface ProcessusDuPont {
  processus: ChildProcessWithoutNullStreams;
  /** Chaque ligne lue de sa sortie, dans l'ordre. */
  sortie: string[];
  /** La prochaine ligne de sa sortie, sans sa fin de ligne, gardée dans `sortie`. */
  prochaine: () => Promise<string>;
  /** Les `n` prochains octets de sa sortie. */
  octets: (n: number) => Promise<Buffer>;
  /** La ligne que rend la requête `[methode, json|null]`. */
  appel: (methode: string, entree?: unknown) => Promise<{ ok: boolean; vue?: unknown; erreur?: { categorie: string } }>;
  /** Ce que sa sortie, une fois close, a livré et qu'aucune lecture n'a pris. */
  reste: () => Promise<Buffer>;
}

export function ouvrirLeProcessus(script: string, ...options: string[]): ProcessusDuPont {
  const processus = spawn(process.execPath, [script, ...options], { stdio: ['pipe', 'pipe', 'pipe'] });
  processus.stderr.resume();
  let recu = Buffer.alloc(0);
  let close = false;
  let reveil: (() => void) | null = null;
  processus.stdout.on('data', (morceau: Buffer) => { recu = Buffer.concat([recu, morceau]); reveil?.(); });
  processus.stdout.on('end', () => { close = true; reveil?.(); });
  const sortie: string[] = [];
  /** Attend que la sortie livre de quoi tenir `pret`, ou lève si elle se ferme avant. */
  const attendre = async (pret: () => boolean) => {
    while (!pret()) {
      if (close) throw new Error('sortie standard close');
      await new Promise<void>((r) => { reveil = r; });
    }
  };
  const prochaine = async () => {
    await attendre(() => recu.includes(0x0a));
    const fin = recu.indexOf(0x0a);
    const ligne = recu.subarray(0, fin).toString('utf8');
    recu = recu.subarray(fin + 1);
    sortie.push(ligne);
    return ligne;
  };
  const octets = async (n: number) => {
    await attendre(() => recu.length >= n);
    const lus = Buffer.from(recu.subarray(0, n));
    recu = recu.subarray(n);
    return lus;
  };
  const appel = async (methode: string, entree?: unknown) => {
    processus.stdin.write(`${JSON.stringify([methode, entree === undefined ? null : JSON.stringify(entree)])}\n`);
    return JSON.parse(await prochaine());
  };
  const reste = async () => {
    await attendre(() => close);
    return recu;
  };
  return { processus, sortie, prochaine, octets, appel, reste };
}
