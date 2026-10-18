import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * GARDE D'HYGIÈNE de `Source/` — les livres VF sont la vérité CITABLE du dépôt (AGENTS.md règle 1).
 * UN relevé, `git -c core.quotePath=false ls-files --eol -- Source/`, et DEUX volets :
 *
 *  1. FINS DE LIGNE — `.gitattributes:5` (`* text=auto eol=lf`) impose le LF dans l'index ET dans la
 *     copie de travail. Le relevé rend, par fichier, l'état de l'index (`i/…`) et celui du disque
 *     (`w/…`) : tout fichier TEXTE doit être `i/lf` ET `w/lf` — liste BLANCHE, `crlf`, `mixed` et
 *     `none` sont refusés. Les binaires (`-text`, cf. `.gitattributes` §Binaires) sortent du
 *     périmètre : aucune conversion ne les concerne. Un `Source/` en CRLF décale les lignes citées et
 *     fait mentir les réfs `LDB <chap> l.<ligne>`.
 *  2. CHEMINS ASCII (#1699) — tout chemin SUIVI sous `Source/` est en ASCII imprimable (0x20-0x7E).
 *     Verbatim utilisateur (2026-09-06) : « Tu sais nos fichiers aujourd'hui peuvent etre déplacé, par
 *     contre les caracteres accentués c'est un soucis ». TOLÉRANCE ZÉRO, sans stock ni liste
 *     d'exception — la VO n'y échappe pas : la plainte est celle de git, des outils tiers et du
 *     transport, qui ne distinguent ni VO ni FR.
 *
 * `core.quotePath=false` N'EST PAS UN CONFORT, c'est la CONDITION du volet 2 : sans lui, git rend un
 * chemin non ASCII sous forme ÉCHAPPÉE (`"Source/Boi\314\202te…"`), qui est de l'ASCII pur — la garde
 * serait aveugle à ce qu'elle cherche.
 *
 * CE QU'ELLE NE MESURE PAS : le CONTENU des fichiers de `Source/` — ni leur prose, ni leurs liens.
 * Elle ne juge que ce que git indexe : fins de ligne et chemins. Et elle juge l'ASCII, PAS le POINT
 * FIXE de `nomAscii` : un nom ASCII hors forme canonique (`12 - .md`, titre vidé) lui est VALIDE —
 * c'est la migration qui tient ce critère (`aBouger`), parce que la forme `NN - <titre>.md` est le
 * sujet des scanners de chapitres, pas celui de l'hygiène des chemins.
 *
 * OÙ ELLE MORD : le volet 1 est VACU sur la CI (checkout frais depuis l'index, tout y naît en LF) et
 * mord sur un arbre LOCAL qu'un outil a réécrit en CRLF (un parseur, un éditeur, une opération git
 * sous `core.autocrlf=true`) ; le volet 2 mord partout, dès qu'un fichier neuf entre sous `Source/`
 * avec un nom accentué.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url)); // racine du projet (src/ → ..)

/** Une ligne de `git ls-files --eol` : `i/<eol>  w/<eol>  attr/<attrs>\t<chemin>`. */
export type EolRow = { index: string; worktree: string; path: string };

/** Découpe la sortie de `git ls-files --eol` en lignes structurées (colonnes séparées par des blancs,
 *  chemin séparé par une TABULATION — un chemin peut contenir des espaces). */
export function parseEolOutput(sortie: string): EolRow[] {
  const rows: EolRow[] = [];
  for (const ligne of sortie.split(/\r?\n/)) {
    if (!ligne.trim()) continue;
    const tab = ligne.indexOf('\t');
    if (tab < 0) continue;
    const colonnes = ligne.slice(0, tab).trim().split(/\s+/);
    const index = colonnes.find((c) => c.startsWith('i/'))?.slice(2) ?? '';
    const worktree = colonnes.find((c) => c.startsWith('w/'))?.slice(2) ?? '';
    rows.push({ index, worktree, path: ligne.slice(tab + 1) });
  }
  return rows;
}

/** Fichiers TEXTE dont l'index ou le disque n'est pas en LF — le rapport du volet 1. */
export function nonLf(rows: EolRow[]): string[] {
  return rows
    .filter((r) => r.index !== '-text' && r.worktree !== '-text')
    .filter((r) => r.index !== 'lf' || r.worktree !== 'lf')
    .map((r) => `${r.path} → index ${r.index || '(vide)'} / disque ${r.worktree || '(vide)'}`);
}

const horsAscii = (c: string) => (c.codePointAt(0) as number) < 0x20 || (c.codePointAt(0) as number) > 0x7e;
const nomDuPointDeCode = (c: string) => `U+${(c.codePointAt(0) as number).toString(16).toUpperCase().padStart(4, '0')}`;

/** Chemins portant au moins un caractère hors ASCII imprimable, chacun NOMMANT ses fautifs — volet 2. */
export function nonAscii(rows: EolRow[]): string[] {
  return rows
    .filter((r) => [...r.path].some(horsAscii))
    .map((r) => {
      const fautifs = [...new Set([...r.path].filter(horsAscii))];
      return `${r.path} → ${fautifs.map((c) => `${c} (${nomDuPointDeCode(c)})`).join(', ')}`;
    });
}

const SORTIE = execFileSync('git', ['-c', 'core.quotePath=false', 'ls-files', '--eol', '--', 'Source/'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 1 << 28,
});

describe('garde d’hygiène de `Source/` — fins de ligne en LF, chemins en ASCII', () => {
  it('la porte lit un inventaire NON VIDE (une mesure sur zéro fichier ne prouve rien)', () => {
    expect(parseEolOutput(SORTIE).length).toBeGreaterThan(1000);
  });

  it('cas planté : CRLF, mixed et index divergent sont refusés ; `-text` sort du périmètre', () => {
    const planté: EolRow[] = [
      { index: 'lf', worktree: 'crlf', path: 'Source/a.md' },
      { index: 'lf', worktree: 'mixed', path: 'Source/b.md' },
      { index: 'crlf', worktree: 'lf', path: 'Source/c.md' },
      { index: 'lf', worktree: 'lf', path: 'Source/d.md' },
      { index: '-text', worktree: '-text', path: 'Source/e.png' },
    ];
    expect(nonLf(planté).map((s) => s.split(' →')[0])).toEqual(['Source/a.md', 'Source/b.md', 'Source/c.md']);
  });

  it('cas planté : le chemin est lu après la TABULATION, espaces compris', () => {
    const ligne = 'i/lf    w/crlf   attr/text=auto eol=lf \tSource/WH - V4 - Livre/01 - Chapitre.md';
    expect(parseEolOutput(ligne)).toEqual([
      { index: 'lf', worktree: 'crlf', path: 'Source/WH - V4 - Livre/01 - Chapitre.md' },
    ]);
  });

  it('cas planté : un chemin accentué, DÉCOMPOSÉ ou à caractère invisible est NOMMÉ ; l’ASCII passe', () => {
    const planté: EolRow[] = [
      { index: 'lf', worktree: 'lf', path: 'Source/Livre/01 - Côte.md' },
      { index: 'lf', worktree: 'lf', path: 'Source/Boîte/01 - Chapitre.md' },
      { index: 'lf', worktree: 'lf', path: 'Source/Livre/12 - ￼.md' },
      { index: 'lf', worktree: 'lf', path: "Source/Livre/01 - Cote de l'Ostland.md" },
    ];
    const vus = nonAscii(planté);
    expect(vus.map((s) => s.split(' →')[0])).toEqual([
      'Source/Livre/01 - Côte.md',
      'Source/Boîte/01 - Chapitre.md',
      'Source/Livre/12 - ￼.md',
    ]);
    expect(vus[0]).toContain('U+00F4');
    expect(vus[1]).toContain('U+0302');
    expect(vus[2]).toContain('U+FFFC');
  });

  it('aucun fichier de `Source/` n’échappe au LF (tolérance ZÉRO)', () => {
    const offenders = nonLf(parseEolOutput(SORTIE));
    expect(
      offenders,
      `Fins de ligne non-LF sous \`Source/\` — les réfs \`LDB <chap> l.<ligne>\` s'y décalent.\nRemise en état : \`git add --renormalize Source/\` (cf. .gitattributes:5) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('aucun chemin suivi de `Source/` n’échappe à l’ASCII imprimable (tolérance ZÉRO, sans stock)', () => {
    const offenders = nonAscii(parseEolOutput(SORTIE));
    expect(
      offenders,
      'Chemin(s) NON ASCII sous `Source/` — un nom accentué ne se transporte pas (#1699).\n' +
        'Remède : nommer le fichier par `nomAscii` (`scripts/source/nom-ascii.mjs`) à l’import — c’est ce que\n' +
        'font les scripts de découpe ; sur un stock neuf :\n' +
        '`node scripts/migrations/2026-09-14-1699-source-chemins-ascii.mjs --apply`.\n' +
        `${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
