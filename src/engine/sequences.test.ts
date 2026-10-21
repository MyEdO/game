/**
 * LES SÉQUENCES D'IDS (#2898 lot D) : une partie neuve les remet à zéro, et aucun compteur de module ne vit hors d'elles.
 * Garde de classe : un `let n = 0` de premier niveau dans le moteur, le noyau, les données ou les scénarios échappe à la
 * remise à zéro de `creerPartie`, et deux rejeux d'un fichier dans un processus n'y fabriquent plus les mêmes ids.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import { estFichierVitest } from '../../scripts/guards/lib/fichierVitest.mjs';
import { remettreLesSequencesAZero, sequence } from './sequences';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

describe('les séquences d’ids', () => {
  it('rendent l’entier suivant depuis 1, et repartent de 1 après la remise à zéro', () => {
    const s = sequence();
    expect([s.courant(), s.suivant(), s.suivant(), s.courant()]).toEqual([0, 1, 2, 2]);
    remettreLesSequencesAZero();
    expect(s.suivant()).toBe(1);
  });

  it('aucun compteur numérique de premier niveau en `let` dans engine, noyau, data ni scenes', () => {
    const fichiers = ['src/engine', 'src/noyau', 'src/data', 'src/scenes'].flatMap((racine) =>
      listerArbre(join(ROOT, racine)).map((r: string) => `${racine}/${r}`)).filter((f) => /\.tsx?$/.test(f) && !estFichierVitest(f));
    const compteurs = fichiers.flatMap((f) => readFileSync(join(ROOT, f), 'utf8').split('\n').flatMap((l, i) =>
      (/^(export )?let \w+(\s*:\s*number)?\s*=\s*\d+\s*;/.test(l) ? [`${f}:${i + 1} ${l.trim()}`] : [])));
    expect(compteurs, 'un compteur de module se déclare par `sequence()` (src/engine/sequences.ts)').toEqual([]);
  });
});
