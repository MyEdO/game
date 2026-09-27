/**
 * Fichiers NEUFS (non suivis, `??` de `git status --porcelain`) du périmètre, dans `cwd`.
 *
 * `git diff` ne voit QUE le suivi : une migration qui CRÉE un document à chaque passage y est
 * invisible. Ce relevé est la seconde moitié de la mesure d'idempotence du rejeu.
 */
export function neufsDe(cwd: string, perimetre: readonly string[]): string[];

/**
 * Périmètre ÉCRIT par les migrations. Importé par `replay-head.mjs` (l'empreinte) et par le hook
 * `pre-push` (quelle plage poussée arme le rejeu) — jamais recopié.
 */
export const PERIMETRE: readonly string[];

/**
 * `racine` est-elle DANS un arbre de travail git ? Hors dépôt, `git diff --exit-code -- <a> <b> …`
 * bascule en `--no-index` et rend 0 : ce détecteur est ce qui empêche ce faux vert.
 */
export function estUnDepot(racine: string): boolean;

/**
 * JOUE les migrations de `dossier` sur l'arbre `racine`, dans l'ordre lexical. Ne mesure rien : le
 * verdict d'idempotence appartient à l'appelant.
 */
export function rejouer(params: {
  racine: string;
  dossier?: string;
  ecrire?: (ligne: string) => void;
}): { rouges: string[]; joues: number };

/**
 * Mesure « le rejeu a-t-il écrit ? » DANS UN DÉPÔT (`git diff` pour le suivi, `git status` pour le
 * reste). Hors dépôt, refuse de conclure : rouge nommé, jamais un « INCHANGÉ » de complaisance.
 */
export function mesurerParGit(params: {
  racine: string;
  perimetre?: readonly string[];
  diffAvant: string;
  neufsAvant: Set<string>;
}): { rouges: string[]; lignes: string[] };
