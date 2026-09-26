import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * EN-TÊTE STRUCTURÉ de la garde.
 */
const GARDE = {
  question:
    'Quel fichier TRACKÉ de `scripts/` contient un octet NUL brut (0x00) dans son texte source ?',
  pourquoi:
    'Classe d’incident réelle du 2026-08-25 : des backticks exécutés dans un corps interpolé par le pont shell ' +
    'ont matérialisé un octet NUL RÉEL dans un script commité (soldé en 231f8530d). Un NUL dans un script tronque ' +
    'les motifs des outils qui le relisent (grep, éditeurs, parseurs) : il se propage sans rougir. PROMOTION ' +
    'PRÉVENTIVE de la sonde d’audit du 2026-08-26 — 0 fichier NUL tracké à HEAD, la garde tient l’état atteint.',
  primitive:
    '`git ls-files scripts` pour l’ÉNUMÉRATION (jamais un parcours du système de fichiers : 4 `.pyc` gitignorés ' +
    'sous `scripts/art-ref/__pycache__/` rougiraient toute machine ayant lancé le pipeline python) + `readFileSync` ' +
    'en BUFFER pour la LECTURE (jamais une regex ni un grep : l’octet NUL tronque le motif, un grep sur NUL ment).',
  perimetre: '`scripts/**`, fichiers TRACKÉS par git, toutes extensions.',
  ticket: '#1466',
  angleMort: [
    'Fichiers trackés SEULEMENT : un script non commité peut porter un NUL sans rougir (il ne peut pas se propager non plus).',
    '`scripts/**` seulement : `src/**` et les `.json` de données ont leurs propres gardes.',
    'Seul l’octet 0x00 BRUT est mesuré — une séquence d’ÉCHAPPEMENT `\\u0000` en littéral est légitime et invisible ici.',
    'Un fichier TRACKÉ par l’index mais ABSENT de l’arbre (suppression en vol) n’est pas scanné : il n’a plus d’octets. La garde le SAUTE au lieu de rendre un ENOENT — une panne de lecture n’est pas un verdict.',
  ],
} as const;

/** Fichiers énumérés par git — l'ÉNUMÉRATION, séparée de la détection. */
function fichiersTrackes(): string[] {
  return execFileSync('git', ['ls-files', 'scripts'], { cwd: RACINE, encoding: 'utf8' })
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** DÉTECTEUR PUR : positions (index d’octet) des 5 premiers NUL d’un buffer, vide si aucun. */
function positionsDeNul(buf: Buffer): number[] {
  const positions: number[] = [];
  for (let i = 0; i < buf.length && positions.length < 5; i += 1) {
    if (buf[i] === 0) positions.push(i);
  }
  return positions;
}

/**
 * LECTURE : le détecteur pur appliqué aux octets du fichier. `null` quand le fichier est TRACKÉ par
 * l'index mais ABSENT de l'arbre de travail (suppression en vol) : il n'a plus d'octets à scanner, et
 * un `ENOENT` brut ferait rendre à la garde une PANNE là où on attend un verdict.
 */
function positionsDeNulDuFichier(chemin: string): number[] | null {
  const abs = join(RACINE, chemin);
  if (!existsSync(abs)) return null;
  return positionsDeNul(readFileSync(abs));
}

describe('scripts/ — aucun octet NUL brut dans un fichier tracké', () => {
  it('en-tête : la garde se déclare — périmètre, primitive d’énumération, angles morts, ticket', () => {
    expect(GARDE.perimetre, 'le périmètre doit NOMMER `scripts/**` et la restriction aux fichiers trackés.')
      .toMatch(/scripts\/\*\*.*TRACKÉS/s);
    expect(GARDE.primitive, 'l’énumération passe par git, jamais par le système de fichiers.').toContain('git ls-files');
    expect(GARDE.angleMort.join(' | ')).toMatch(/trackés SEULEMENT/);
    expect(GARDE.angleMort.join(' | ')).toMatch(/`scripts\/\*\*` seulement/);
    expect(GARDE.angleMort.join(' | ')).toMatch(/séquence d’ÉCHAPPEMENT/);
    expect(GARDE.ticket).toBe('#1466');
  });

  it('cas planté : le détecteur PUR trouve les NUL d’un buffer (preuve TDD)', () => {
    expect(positionsDeNul(Buffer.from([97, 98, 99, 0, 100, 0]))).toEqual([3, 5]);
    expect(positionsDeNul(Buffer.from('abc def', 'utf8'))).toEqual([]);
  });

  it('aucun fichier tracké de scripts/ ne porte 0x00', () => {
    const fautifs = fichiersTrackes()
      .map((f) => ({ f, positions: positionsDeNulDuFichier(f) ?? [] }))
      .filter((e) => e.positions.length > 0);

    const rapport = fautifs
      .map((e) => `${e.f} — octets NUL aux positions ${e.positions.join(', ')}`)
      .join('\n');

    expect(
      fautifs.length,
      fautifs.length === 0
        ? ''
        : `Octet NUL brut dans ${fautifs.length} fichier(s) tracké(s) de scripts/ :\n${rapport}\n` +
          `Remède : remplacer l’octet par sa séquence d’échappement (\\u0000) dans le littéral.`,
    ).toBe(0);
  });
});
