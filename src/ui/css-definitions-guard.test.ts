import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { detenteur } from '../detenteur.testkit';

/**
 * Garde STRUCTURELLE — ce qu'une feuille CONSOMME doit être DÉFINI quelque part dans l'arbre.
 * Deux consommations silencieuses en CSS : une `animation:` qui nomme des `@keyframes` absentes
 * (l'animation ne joue simplement pas) et un `var(--x)` SANS repli dont la variable n'est déclarée
 * nulle part (la propriété tombe à sa valeur non résolue). Aucune des deux ne casse un build, aucune
 * ne se voit en test unitaire de composant : elles se voient ICI, ou à l'œil, des mois plus tard.
 */
/**
 * Retire les commentaires d'un source TS avant le scan des `--x` POSÉS par le code : une mention en
 * PROSE (`// la gouttière lit --af-pulse`) ne pose aucune variable et ne doit blanchir personne.
 * Le `[^:]` devant `//` : un protocole (`https://…`) au milieu d'une chaîne n'est pas un commentaire.
 */
function stripCodeComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const cssTexts = detenteur(() =>
  readCorpus(['src'], { exts: ['.css'], tests: true }).map(({ rel, text }) => [rel, text] as const),
);
const codeTexts = detenteur(() => readCorpus(['src']).map(({ text }) => stripCodeComments(text)));

/** Retire commentaires puis appels de fonction (`cubic-bezier(…)`, `steps(…)`) d'une valeur. */
function strip(value: string): string {
  let v = value.replace(/\/\*[\s\S]*?\*\//g, ' ');
  for (let i = 0; i < 4; i++) v = v.replace(/[-\w]*\([^()]*\)/g, ' ');
  return v;
}

/** Mots-clés du raccourci `animation` — tout le reste est un NOM de `@keyframes`. */
const ANIM_KEYWORDS = new Set([
  'none', 'initial', 'inherit', 'unset', 'revert', 'infinite', 'normal', 'reverse',
  'alternate', 'alternate-reverse', 'forwards', 'backwards', 'both', 'running', 'paused',
  'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end',
]);

describe('CSS — toute consommation a sa définition', () => {
  const keyframes = new Set<string>();
  for (const [, t] of cssTexts()) for (const m of t.matchAll(/@(?:-\w+-)?keyframes\s+([-\w]+)/g)) keyframes.add(m[1]);

  /** Noms d'animations consommés, avec le fichier qui les consomme. */
  const animUsed = new Map<string, string>();
  for (const [f, t] of cssTexts())
    for (const m of t.matchAll(/(?:^|[;{}\s])animation(?:-name)?\s*:([^;}]*)/g))
      for (const tok of strip(m[1]).split(/[\s,]+/))
        if (tok && !/^[\d.]/.test(tok) && /^[-\w]+$/.test(tok) && !ANIM_KEYWORDS.has(tok) && !animUsed.has(tok))
          animUsed.set(tok, f);

  it('mesure un stock non vide de `@keyframes` et d’animations consommées', () => {
    expect(keyframes.size).toBeGreaterThan(5);
    expect(animUsed.size).toBeGreaterThan(5);
  });

  it('chaque animation consommée nomme des `@keyframes` définies', () => {
    expect([...animUsed].filter(([n]) => !keyframes.has(n)).map(([n, f]) => `${n} (${f})`)).toEqual([]);
  });

  // Variables : déclarées en CSS (`--x:`, `@property --x`) ou POSÉES par le code (style inline,
  // `setProperty`) — les deux comptent comme définition, le rendu final les fusionne.
  const varsDefined = new Set<string>();
  for (const [, t] of cssTexts()) {
    for (const m of t.matchAll(/(--[-\w]+)\s*:/g)) varsDefined.add(m[1]);
    for (const m of t.matchAll(/@property\s+(--[-\w]+)/g)) varsDefined.add(m[1]);
  }
  for (const t of codeTexts()) for (const m of t.matchAll(/(--[a-z][-\w]*)/g)) varsDefined.add(m[1]);

  /** `var(--x)` SANS repli : la déclaration entière meurt si `--x` n'existe pas. */
  const varsUsed = new Map<string, string>();
  for (const [f, t] of cssTexts())
    for (const m of t.matchAll(/var\(\s*(--[-\w]+)\s*\)/g)) if (!varsUsed.has(m[1])) varsUsed.set(m[1], f);

  it('mesure un stock non vide de variables consommées sans repli', () => {
    expect(varsUsed.size).toBeGreaterThan(50);
  });

  /**
   * Deux consommations mortes ANTÉRIEURES, relevées par ce scan et laissées à l'arbitrage de leur
   * écran (les deux tombent aujourd'hui à l'hérité : `border-left` n'est pas peint, la police est
   * celle du corps) — leur correction est un choix de RENDU, pas un correctif mécanique. La liste
   * est FERMÉE : elle ne grandit pas, et un site retiré d'ici doit disparaître du CSS.
   */
  const MORTES_CONNUES = ['--line', '--font-body'];

  it('chaque `var(--x)` sans repli a sa variable définie', () => {
    const mortes = [...varsUsed].filter(([n]) => !varsDefined.has(n));
    expect(mortes.filter(([n]) => !MORTES_CONNUES.includes(n)).map(([n, f]) => `${n} (${f})`)).toEqual([]);
  });

  it('la liste des mortes connues ne grandit pas et reste HABITÉE', () => {
    const mortes = [...varsUsed].filter(([n]) => !varsDefined.has(n)).map(([n]) => n);
    expect(mortes.sort()).toEqual([...MORTES_CONNUES].sort());
  });

  it('le scan VOIT un cas RÉEL de chaque famille (non-vacuité nominative)', () => {
    // Un témoin d'ANIMATION et un témoin de VARIABLE, chacun nommé avec la feuille qui le consomme :
    // le scan regarde bien les deux consommations (#1806 2d).
    expect(animUsed.get('reveal-timer-drain')).toBe('src/ui/styles/reveal-body.css');
    expect(varsUsed.get('--chip-malus-bg')).toBe('src/ui/styles/fx-chip.css');
  });
});
