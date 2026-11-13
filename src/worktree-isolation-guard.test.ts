import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import viteConfig from '../vite.config';
import {
  PLAGE_PORTS,
  PORT_DEV_DERIVE,
  PORT_DEV_PRINCIPAL,
  PORT_PREVIEW_DERIVE,
  PORT_PREVIEW_PRINCIPAL,
  estArbrePrincipal,
  normaliserRacine,
  portDev,
  portPreview,
  // @ts-expect-error - module ESM JS (pas de types)
} from '../scripts/port-dev.mjs';

/**
 * Garde-fou ISOLATION DE WORKTREE — tout chemin de fichier déclaré par la config de test
 * (`test.setupFiles`, `test.globalSetup`) doit être ABSOLU, ancré sur `vite.config.ts`, et ne
 * traverser aucune racine de worktree imbriqué (#1679 L1c).
 *
 * Second volet : le PORT du serveur (dev ET `vite preview`) est propre à l'arbre
 * (`scripts/port-dev.mjs`) et posé en `strictPort` — un port fixe faisait servir un arbre VOISIN à la
 * recette (Vite glisse silencieusement sur le port suivant quand le sien est pris). L'arbre
 * PRINCIPAL garde son port historique (5173/4173), reconnu à ce que `<racine>/.git` y est un
 * DOSSIER ; un worktree LIÉ (où `.git` est un FICHIER) se dérive dans la plage suivante.
 *
 * Vitest résout un chemin RELATIF de config par `resolveModule(path, { paths: [root] })`, dont la
 * première base d'URL est le `root` SANS slash final : `new URL('./src/x', 'file:///…/Game/.wt')`
 * écrase le dernier segment et rend `file:///…/Game/src/x`. Un worktree posé d'UN niveau sous la
 * racine charge alors le fichier de l'arbre PARENT (graphes de modules dédoublés, singletons du
 * store perdus). Patron d'ancrage du dépôt : `scripts/typecheck-fast.mjs:10-12` et les scanners de
 * `src/data/*.test.ts` (`fileURLToPath(new URL('../..', import.meta.url))`).
 */

/** Vue étroite de la config lue : `defineConfig` rend une union, seuls ces champs sont gardés. */
type ConfigDeTest = { test?: { setupFiles?: string | string[]; globalSetup?: string | string[] } };

const RACINE_CONFIG = fileURLToPath(new URL('..', import.meta.url)); // dossier de vite.config.ts

/** REND la liste des chemins déclarés par un champ de config (`string` ou `string[]`, absent = []). */
function chemins(champ: string | string[] | undefined): string[] {
  if (champ === undefined) return [];
  return Array.isArray(champ) ? champ : [champ];
}

/** REND le chemin que vitest chargerait pour `chemin` depuis un `root` (base d'URL SANS slash). */
function resoluDepuisRootSansSlash(chemin: string, root: string): string {
  if (isAbsolute(chemin)) return resolve(chemin);
  return fileURLToPath(new URL(chemin, pathToFileURL(root).toString()));
}

/** VRAI si `cible` est située sous `dossier`. */
function estSous(cible: string, dossier: string): boolean {
  const rel = relative(dossier, cible);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

/**
 * VRAI si un `.git` se trouve entre `dossier` (exclu) et le dossier de `cible` (inclus) : la marque
 * d'un WORKTREE IMBRIQUÉ. Un chemin absolu peut être « sous » le dossier de la config et pourtant
 * désigner un AUTRE arbre (`…/Game/.wt-1501/src/test-setup.ts` vu depuis l'arbre principal) — être
 * sous la config ne suffit donc pas, le chemin ne doit traverser aucune racine de worktree.
 * `existe` est injecté pour la mesure ; par défaut, le disque.
 */
function traverseUnWorktree(
  cible: string,
  dossier: string,
  existe: (chemin: string) => boolean = existsSync,
): boolean {
  let courant = dirname(resolve(cible));
  while (estSous(courant, dossier)) {
    if (existe(join(courant, '.git'))) return true;
    courant = dirname(courant);
  }
  return false;
}

const conf = viteConfig as ConfigDeTest;
const declares: [string, string][] = [
  ...chemins(conf.test?.setupFiles).map((p) => ['test.setupFiles', p] as [string, string]),
  ...chemins(conf.test?.globalSetup).map((p) => ['test.globalSetup', p] as [string, string]),
];

describe('garde-fou isolation de worktree — les chemins de la config de test sont ancrés', () => {
  it('la config déclare au moins un fichier de setup (la garde a une matière)', () => {
    expect(declares.length).toBeGreaterThan(0);
  });

  it('chaque chemin déclaré est ABSOLU, sous le dossier de vite.config.ts, et ne traverse aucun worktree', () => {
    const fautifs = declares
      .filter(
        ([, p]) =>
          !isAbsolute(p) || !estSous(resolve(p), RACINE_CONFIG) || traverseUnWorktree(p, RACINE_CONFIG),
      )
      .map(([champ, p]) => `${champ} → ${p}`);
    expect(
      fautifs,
      `Chemin(s) de config non ancré(s) dans CET arbre — utiliser \`fileURLToPath(new URL('./…', import.meta.url))\` :\n${fautifs.join('\n')}`,
    ).toEqual([]);
  });

  it('morsure : un chemin absolu vers un worktree IMBRIQUÉ est refusé, tout « sous la config » qu’il soit', () => {
    const imbrique = resolve(RACINE_CONFIG, '.wt-sonde', 'src', 'test-setup.ts');
    const gitDuWorktree = resolve(RACINE_CONFIG, '.wt-sonde', '.git');
    const existe = (chemin: string) => chemin === gitDuWorktree;
    expect(estSous(imbrique, RACINE_CONFIG), 'le cas planté passe l’ancien contrat').toBe(true);
    expect(traverseUnWorktree(imbrique, RACINE_CONFIG, existe)).toBe(true);
    for (const [champ, p] of declares) {
      expect(traverseUnWorktree(resolve(p), RACINE_CONFIG, existe), `${champ} traverse un worktree`).toBe(false);
    }
  });

  it('morsure : sous un root d’un niveau, un chemin relatif SORT du root, l’absolu y reste', () => {
    const rootFictif = resolve(RACINE_CONFIG, '.sous-arbre');
    // Cas planté : la forme relative historique remonte à l'arbre parent.
    const relatifResolu = resoluDepuisRootSansSlash('./src/test-setup.ts', rootFictif);
    expect(estSous(relatifResolu, rootFictif)).toBe(false);
    expect(relatifResolu).toBe(resolve(RACINE_CONFIG, 'src', 'test-setup.ts'));
    // Les chemins RÉELS de la config, eux, ne bougent pas avec le root.
    for (const [champ, p] of declares) {
      const resolu = resoluDepuisRootSansSlash(p, rootFictif);
      expect(resolu, `${champ} suit le root au lieu d’être ancré`).toBe(resolve(p));
      expect(estSous(resolu, RACINE_CONFIG), `${champ} sort du dépôt`).toBe(true);
    }
  });
});

describe('ports servis — 5173/4173 pour l’arbre PRINCIPAL, dérivés pour un worktree lié', () => {
  /** Lecteur FICTIF assemblé, jamais écrit en dur : `src/portable-paths-guard.test.ts` refuse tout
   *  chemin absolu de machine dans une source `src/**` (patron `const DRIVE = 'C' + ':'`). */
  const LECTEUR = 'X' + ':';
  const principal = `${LECTEUR}/arbres/Game`;
  const worktree = `${principal}/.wt-1679`;
  const autreWorktree = `${principal}/.wt-1624`;
  /** `.git` DOSSIER : seul `principal` est un arbre principal dans cette mesure. */
  const dossierGit = (chemin: string) => normaliserRacine(chemin) === `${principal.toLowerCase()}/.git`;

  it('la config pose le port de CET arbre, en strictPort, pour le dev ET la preview', () => {
    const conf2 = viteConfig as {
      server?: { port?: number; strictPort?: boolean };
      preview?: { port?: number; strictPort?: boolean };
    };
    expect(conf2.server?.port).toBe(portDev());
    expect(conf2.server?.strictPort).toBe(true);
    expect(conf2.preview?.port).toBe(portPreview());
    expect(conf2.preview?.strictPort).toBe(true);
  });

  it('un arbre PRINCIPAL (.git = DOSSIER) garde exactement 5173 et 4173', () => {
    expect(estArbrePrincipal(principal, dossierGit)).toBe(true);
    expect(portDev(principal, dossierGit)).toBe(PORT_DEV_PRINCIPAL);
    expect(portDev(principal, dossierGit)).toBe(5173);
    expect(portPreview(principal, dossierGit)).toBe(PORT_PREVIEW_PRINCIPAL);
    expect(portPreview(principal, dossierGit)).toBe(4173);
  });

  it('un worktree LIÉ (.git = FICHIER) tombe dans la plage dérivée, jamais sur le port du principal', () => {
    for (const racine of [worktree, autreWorktree]) {
      expect(estArbrePrincipal(racine, dossierGit)).toBe(false);
      const dev = portDev(racine, dossierGit);
      expect(dev).toBeGreaterThanOrEqual(PORT_DEV_DERIVE);
      expect(dev).toBeLessThanOrEqual(PORT_DEV_DERIVE + PLAGE_PORTS - 1);
      expect(dev).not.toBe(PORT_DEV_PRINCIPAL);
      const preview = portPreview(racine, dossierGit);
      expect(preview).toBeGreaterThanOrEqual(PORT_PREVIEW_DERIVE);
      expect(preview).toBeLessThanOrEqual(PORT_PREVIEW_DERIVE + PLAGE_PORTS - 1);
      expect(preview).not.toBe(PORT_PREVIEW_PRINCIPAL);
    }
    // Plage annoncée par la doc de recette : 5174-5272 et 4174-4272.
    expect(PORT_DEV_DERIVE + PLAGE_PORTS - 1).toBe(5272);
    expect(PORT_PREVIEW_DERIVE + PLAGE_PORTS - 1).toBe(4272);
  });

  it('le port d’un worktree est DÉTERMINISTE et ne dépend que de la racine', () => {
    for (const racine of [worktree, autreWorktree, '/integration/travail/game/game']) {
      expect(portDev(racine, dossierGit)).toBe(portDev(racine, dossierGit));
    }
    // Même arbre écrit autrement (séparateurs, casse, slash final) = MÊME port.
    const enWindows = [LECTEUR, 'ARBRES', 'Game', '.wt-1679', ''].join(String.fromCharCode(92));
    expect(portDev(enWindows, dossierGit)).toBe(portDev(worktree, dossierGit));
    expect(portPreview(enWindows, dossierGit)).toBe(portPreview(worktree, dossierGit));
    expect(normaliserRacine(enWindows)).toBe(`${LECTEUR.toLowerCase()}/arbres/game/.wt-1679`);
  });

  it('morsure : deux worktrees DISTINCTS ne peuvent pas viser le même port', () => {
    expect(portDev(worktree, dossierGit)).not.toBe(portDev(autreWorktree, dossierGit));
    expect(portPreview(worktree, dossierGit)).not.toBe(portPreview(autreWorktree, dossierGit));
  });

  it('morsure : dev et preview ne se recouvrent jamais pour un même arbre', () => {
    for (const racine of [principal, worktree, autreWorktree]) {
      expect(portDev(racine, dossierGit)).not.toBe(portPreview(racine, dossierGit));
    }
  });

  it('CET arbre, sur le disque RÉEL : port historique s’il est principal, dérivé sinon', () => {
    const principalIci = estArbrePrincipal(RACINE_CONFIG);
    expect(portDev()).toBe(principalIci ? PORT_DEV_PRINCIPAL : portDev(RACINE_CONFIG));
    expect(portPreview()).toBe(principalIci ? PORT_PREVIEW_PRINCIPAL : portPreview(RACINE_CONFIG));
    if (!principalIci) {
      expect(portDev()).toBeGreaterThanOrEqual(PORT_DEV_DERIVE);
      expect(portPreview()).toBeGreaterThanOrEqual(PORT_PREVIEW_DERIVE);
    }
  });
});
