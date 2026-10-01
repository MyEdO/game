import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerArbre } from '../scripts/guards/lib/lister.mjs';
import { GENERATORS, estCiblePure, renduDe } from '../scripts/docs/build-all.mjs';

/**
 * Garde « angle mort de recherche » — les outils de lecture/recherche lean-ctx (`ctx_search` et
 * consorts) sautent tout fichier de plus de 512 Ko SANS le dire : ils rendent « 0 résultat ». Le
 * seuil n'est pas réglable ; la seule défense est la VISIBILITÉ — un fichier au-dessus du seuil est
 * nommé, et toute preuve d'existence/absence sur lui se fait au grep natif.
 *
 * PÉRIMÈTRE MESURÉ (par `fs`, taille en octets, seuil 524288) :
 *   1. `docs/raw/**` — tous fichiers, une cible PURE de `GENERATORS` à son RENDU (`renduDe`), jamais
 *      au disque (#2203 A2 : absente d'un clone neuf) ; comparé à la liste ANNONCÉE dans
 *      `docs/raw/00-index.md` (section « Fichiers au-dessus du seuil d'outillage »). Les deux sens
 *      sont rouges : au-dessus du seuil mais non annoncé, et annoncé mais repassé sous le seuil (ou
 *      ni au disque ni rendu).
 *   2. `src/data/**` — tous fichiers ; comparé à la liste GELÉE `FROZEN_SRC_DATA` ci-dessous.
 *   3. `Source/**` (extension `.md` seulement) — comparé à la liste GELÉE `FROZEN_SOURCE_MD`.
 *
 * ANGLES MORTS (ce que cette garde ne voit PAS) :
 *   - les PDF et toute autre extension sous `Source/` : jamais sondés (aucun outil ne les lit en
 *     texte), donc jamais mesurés ici ;
 *   - `Source/_marker/` : sorties Marker brutes, gitignorées, absentes d'un clone — hors scan, une
 *     liste gelée qui les nommerait mentirait sur la moitié des arbres ;
 *   - les autres zones du dépôt (`public/`, `dist/`, `node_modules/`, arbres de worktree parallèles)
 *     ne sont pas parcourues : le périmètre est celui des trois zones que les agents fouillent.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SEUIL_OCTETS = 524288; // 512 Ko

const INDEX_PATH = join(ROOT, 'docs', 'raw', '00-index.md');
const INDEX_SECTION_RE = /^##\s+.*seuil d'outillage/;

/** Fichiers `src/data/**` au-dessus du seuil, gelés (chemins relatifs à la racine, séparateur `/`). */
const FROZEN_SRC_DATA = [
  'src/data/creatures.json',
  'src/data/spells.json',
];

/** Extraits `Source/**\/*.md` au-dessus du seuil, gelés (hors `Source/_marker/`, cf. angles morts). */
const FROZEN_SOURCE_MD = [
  'Source/Enemy Within Campaign Volume 4 The Horned Rat/01 - Enemy Within Campaign Volume 4 The Horned Rat.md',
];

/** Parcourt `dir` récursivement et rend les chemins relatifs à ROOT (séparateur `/`) des fichiers > seuil. */
function oversizeIn(dir: string, opts: { ext?: RegExp; skipDirs?: string[] } = {}): string[] {
  const dansLeSaut = (interne: string) => {
    const rel = `${dir}/${interne}`;
    return opts.skipDirs?.some((d) => rel === d || rel.startsWith(`${d}/`)) ?? false;
  };
  const out = listerArbre(join(ROOT, dir), {
    descendre: (interne) => !dansLeSaut(interne),
    filtre: (interne) => (!opts.ext || opts.ext.test(interne)) && statSync(join(ROOT, dir, interne)).size > SEUIL_OCTETS,
  }).map((interne) => `${dir}/${interne}`);
  return out.sort();
}

/** `docs/raw/**` au-dessus du seuil : les fichiers commités au disque, et les cibles pures de
 *  `GENERATORS` à la taille de leur rendu. */
async function oversizeAtlas(): Promise<string[]> {
  const auDisque = oversizeIn('docs/raw').filter((f) => !estCiblePure(f, GENERATORS));
  const rendus: string[] = [];
  for (const g of GENERATORS.filter((x) => x.targets.some((t) => t.startsWith('docs/raw/'))))
    for (const [cible, texte] of await renduDe(g))
      if (cible.startsWith('docs/raw/') && Buffer.byteLength(texte, 'utf8') > SEUIL_OCTETS) rendus.push(cible);
  return [...auDisque, ...rendus].sort();
}

/** Noms de fichiers `.md` annoncés par la section dédiée de `docs/raw/00-index.md` (items de liste). */
function annoncesDeLIndex(): string[] {
  const lignes = readFileSync(INDEX_PATH, 'utf8').split('\n');
  const debut = lignes.findIndex((l) => INDEX_SECTION_RE.test(l));
  expect(
    debut,
    `section « Fichiers au-dessus du seuil d'outillage » introuvable dans docs/raw/00-index.md — ` +
      `c'est l'annonce que cette garde compare à la mesure ; sans elle, aucun agent ne sait que ` +
      `ctx_search ne lit plus ces fichiers`,
  ).toBeGreaterThanOrEqual(0);
  const noms: string[] = [];
  for (let i = debut + 1; i < lignes.length; i++) {
    if (/^##\s/.test(lignes[i])) break;
    const m = /^-\s+.*`([^`]+\.md)`/.exec(lignes[i]);
    if (m) noms.push(`docs/raw/${m[1]}`);
  }
  return noms.sort();
}

describe('angle mort de recherche — fichiers > 512 Ko', () => {
  it('docs/raw : tout fichier au-dessus du seuil est ANNONCÉ dans 00-index.md', async () => {
    const mesures = await oversizeAtlas();
    const annonces = annoncesDeLIndex();
    const manquants = mesures.filter((f) => !annonces.includes(f));
    expect(
      manquants,
      `fichier(s) docs/raw au-dessus de 512 Ko absent(s) de l'annonce : ajouter à la section ` +
        `« Fichiers au-dessus du seuil d'outillage » de docs/raw/00-index.md — et savoir que ` +
        `ctx_search ne les lira plus (grep natif obligatoire)`,
    ).toEqual([]);
  });

  it("docs/raw : rien d'ANNONCÉ ne repasse sous le seuil (l'annonce ne doit pas mentir)", async () => {
    const mesures = await oversizeAtlas();
    const annonces = annoncesDeLIndex();
    const fantomes = annonces.filter((f) => !mesures.includes(f));
    expect(
      fantomes,
      `annonce mensongère dans docs/raw/00-index.md : ce(s) fichier(s) sont sous 512 Ko, ou ni ` +
        `au disque ni rendus — les retirer de la section « Fichiers au-dessus du seuil d'outillage »`,
    ).toEqual([]);
  });

  it('src/data : la liste gelée égale la mesure', () => {
    const mesures = oversizeIn('src/data');
    expect(
      mesures,
      `écart src/data : mettre à jour FROZEN_SRC_DATA dans ce test — un fichier de plus au-dessus ` +
        `de 512 Ko est un fichier de plus que ctx_search ne lit plus (grep natif obligatoire) ; ` +
        `un fichier retombé sous le seuil se retire de la liste`,
    ).toEqual([...FROZEN_SRC_DATA].sort());
  });

  it('Source/*.md : la liste gelée égale la mesure', () => {
    const mesures = oversizeIn('Source', { ext: /\.md$/i, skipDirs: ['Source/_marker'] });
    expect(
      mesures,
      `écart Source/**/*.md : mettre à jour FROZEN_SOURCE_MD dans ce test — un extrait de plus ` +
        `au-dessus de 512 Ko est un extrait de plus que ctx_search ne lit plus (grep natif ` +
        `obligatoire) ; un extrait retombé sous le seuil se retire de la liste`,
    ).toEqual([...FROZEN_SOURCE_MD].sort());
  });
});
