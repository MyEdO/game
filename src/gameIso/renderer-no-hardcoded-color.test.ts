/**
 * Garde-fou : AUCUN renderer d'environnement ne porte de littéral de couleur (identité de matériau).
 * Toute couleur vient de la DONNÉE (`src/data/*.json`, `src/data/terrains.json` compris) ou de
 * `shade.ts` (la LUMIÈRE : ombre d'orientation, occlusion, spéculaire). `#hex` / `rgb()` littéraux
 * capturent aussi les tables hex-valuées. Deux niveaux de couverture :
 *   1) balayage RÉCURSIF des arborescences pivot/backend/authoring/pov/catalog/stage — auto-couvre tout NOUVEAU
 *      fichier (aucune liste à tenir à la main) ;
 *   2) les renderers à la RACINE de `gameIso/`, nommés explicitement par FICHIER (`SurcoucheIso.tsx`,
 *      `sprites.ts`) — l'hôte du monde et ses surcouches de `stage/` sont pris par le balayage.
 * `catalog/decor/defs/` (les 97 defs de props) a son propre bloc plus bas (dessin par def, MAIS couleurs
 * tirées de la palette partagée) → exclu du balayage.
 *
 * HORS périmètre (couleur LÉGITIME, non balayés) : le rig (`rig/**` = bestiaire/équipement dessinés
 * « à la main »), les FX de combat (`fx/**`), `shade.ts` (helpers de voile lumineux sanctionnés
 * `ao`/`spec`/`warm`). L'identité matériau des SOLS (`swatch`, `stops`) vit en donnée
 * (`src/data/terrains.json`), donc hors de toute arborescence balayée. Les TOKENS
 * (`stage/TokenChromeOverlay`/`tokenBodyKind`) sont couverts À PART (bloc « chrome ») : leur
 * couleur d'identité vient de teamColors (`ACTIVE_RING`/`hpColor`) ou d'une donnée d'apparence, le reste
 * est du chrome NEUTRE allowlisté ; tout AUTRE hex y est une fuite d'identité de matériau à attraper.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { detenteur } from '../detenteur.testkit';

const HERE = fileURLToPath(new URL('.', import.meta.url)); // …/src/gameIso/
const SOUS_GAMEISO = 'src/gameIso/';

// Renderers d'environnement à la RACINE de gameIso/ (hors arborescence balayée) — nommés.
const ROOT_RENDERERS = [
  'SurcoucheIso.tsx', // surcouche de plateau (coquille fine) — overlays et picking seuls, zéro couleur
  'sprites.ts', // overlays de terrain (mur/arbre) + villageois d'ambiance — tons de decorPalette + ao()
];

// Arborescences pivot / backend volumique / peintres d'authoring / recettes / catalogue / stage / POV :
// chaque .ts/.tsx
// (hors test) est un renderer d'environnement (ou l'alimente en données) → hex-free.
// `catalog/decor/defs` a son bloc dédié (palette) → exclu du balayage.
const SWEEP_DIRS = ['builders', 'backends', 'authoring', 'detail', 'pov', 'catalog', 'stage'];

/** Le balayage : les sources (hors tests) des arborescences déclarées, chemins relatifs à `gameIso/`.
 *  `catalog/decor/defs` a son bloc dédié plus bas (palette) — il sort ici. */
const BALAYAGE = detenteur(() =>
  readCorpus(SWEEP_DIRS.map((d) => `${SOUS_GAMEISO}${d}`))
    .filter(({ rel }) => !rel.startsWith(`${SOUS_GAMEISO}catalog/decor/defs/`))
    .map(({ rel, text }) => [rel.slice(SOUS_GAMEISO.length), text] as const),
);

// Chrome d'état des TOKENS : la surcouche des jetons (pion-disque, PV, badges, ombres) et tokenBodyKind
// (bloc de siège) rendent l'ÉTAT de combat, pas un MATÉRIAU du monde. La couleur d'IDENTITÉ vient de
// teamColors (`teamRingDecor`/`hpColor`) ou d'une donnée (apparence de structure) ; le RESTE est du
// chrome NEUTRE allowlisté (ombres, fond de disque, tons de badge). Tout hex HORS allowlist = fuite.
// Déclarée ICI parce que le balayage d'ENVIRONNEMENT les RETIRE : un fichier passe par un bloc ou par
// l'autre, jamais par les deux — et jamais par aucun (le filtre ci-dessous ne retire que du connu).
const CHROME_RENDERERS = ['stage/TokenChromeOverlay.tsx', 'tokenBodyKind.tsx'];

/** Le texte de chaque fichier couvert, par chemin relatif à `gameIso/`. */
const SOURCE = detenteur(() =>
  new Map<string, string>([
    ...ROOT_RENDERERS.map((rel) => [rel, readFileSync(HERE + rel, 'utf8')] as const),
    ...BALAYAGE(),
  ]),
);
const COVERED = detenteur(() => [...SOURCE().keys()].filter((rel) => !CHROME_RENDERERS.includes(rel)));

// `rgb(`/`hsl(` ne mordent que sur des CANAUX LITTÉRAUX : `rgb(${r},…)` (assemblage d'une couleur
// CALCULÉE, ex. `tint` du POV) n'est pas une identité en dur.
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*[\d.]|\bhsla?\(\s*[\d.]/;

/** Retire commentaires (bloc + ligne, en préservant `://`) et imports — on ne teste que le code. */
function stripNoise(src: string): string {
  return src
    .replace(new RegExp('/\\*[\\s\\S]*?\\*/', 'g'), '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i > 0 && l[i - 1] === ':' ? l : i >= 0 ? l.slice(0, i) : l;
    })
    .filter((l) => !/^\s*import\b/.test(l))
    .join('\n');
}

function colorHits(src: string): string[] {
  return stripNoise(src)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => COLOR_LITERAL.test(l));
}

describe('garde-fou — aucune couleur en dur dans un renderer d’environnement', () => {
  it('le détecteur mord', () => {
    expect(colorHits('const a = "#5d4c36";')).toHaveLength(1);
    expect(colorHits('fill = `rgba(0,0,0,0.3)`;')).toHaveLength(1);
    expect(colorHits('const c = shade(app.wood.face, SIDE_N);')).toHaveLength(0);
    expect(colorHits('fill="var(--combat-gold)"')).toHaveLength(0);
    expect(colorHits('fill={`rgb(${mix(a, b)}, 0, 0)`}')).toHaveLength(0); // canaux calculés = OK
    expect(colorHits('// ancien: #5d4c36')).toHaveLength(0);
  });

  it('la surface couverte est complète (racine + balayage)', () => {
    expect(COVERED()).toContain('sprites.ts');
    // Ancres nommées : le peintre volumique, les recettes de matière, et les peintres d'authoring
    // survivants (#1176, P3-4 C5b).
    expect(COVERED()).toContain('backends/webgl/faceColors.ts');
    expect(COVERED()).toContain('detail/expand.ts');
    expect(COVERED()).toContain('authoring/wallsSvg.ts');
    // …et chaque arborescence déclarée est réellement ATTEINTE : une ancre nommée ne prouve que son
    // propre dossier ; ceci empêche n'importe lequel des autres de se vider en silence.
    for (const dir of SWEEP_DIRS) expect(COVERED().filter((rel) => rel.startsWith(`${dir}/`))).not.toEqual([]);
    expect(COVERED().length).toBeGreaterThan(40);
    // Les renderers de CHROME sont RETIRÉS de ce balayage — et pas perdus : ils passent par le bloc
    // dédié plus bas, à l'allowlist neutre. Un fichier par bloc, et un bloc pour chacun.
    for (const rel of CHROME_RENDERERS) expect(COVERED(), rel).not.toContain(rel);
  });

  it.each(COVERED())('%s : zéro couleur en dur', (rel) => {
    const hits = colorHits(SOURCE().get(rel)!);
    expect(hits, `Couleurs en dur dans ${rel} :\n${hits.join('\n')}`).toEqual([]);
  });
});

const CHROME_ALLOW = new Set(['#000', '#1b2030', '#f2eef8', '#cdb8d8']);
// Extrait chaque littéral de couleur (hex, ou rgb/hsl à canaux LITTÉRAUX — `rgb(${…})` calculé exclu).
const CHROME_TOKEN = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*[\d.][^)]*\)|\bhsla?\(\s*[\d.][^)]*\)/g;
/** Couleurs LITTÉRALES d'un fichier chrome, hors allowlist neutre (= identités de matériau interdites ici). */
function chromeLeaks(src: string): string[] {
  return (stripNoise(src).match(CHROME_TOKEN) ?? []).filter((tok) => !CHROME_ALLOW.has(tok));
}

describe('garde-fou — chrome des tokens : hex neutre allowlisté, tout autre = fuite', () => {
  it('le filtre attrape un hex hors allowlist, laisse passer un neutre', () => {
    expect(chromeLeaks('fill="#ff0000"')).toEqual(['#ff0000']);
    expect(chromeLeaks('fill="#000"')).toEqual([]);
  });
  it.each(CHROME_RENDERERS)('%s : zéro couleur d’identité en dur', (rel) => {
    const leaks = chromeLeaks(readFileSync(HERE + rel, 'utf8'));
    expect(leaks, `Couleurs d’identité en dur dans ${rel} (à sourcer via teamColors/données) :\n${leaks.join('\n')}`).toEqual([]);
  });
});

// Les 97 defs de décor : le dessin reste du code par def, MAIS toute couleur vient de la palette
// partagée (`P.<ton>`, `src/data/decorPalette.json`). Glob → couvre aussi tout nouveau `defs/<id>.ts`.
const DECOR_DEFS_DIR = HERE + 'catalog/decor/defs';
const DECOR_DEFS = listerDossier(DECOR_DEFS_DIR).filter((f) => f.endsWith('.ts'));

describe('garde-fou — decor defs consomment la palette (zéro couleur en dur)', () => {
  it('la liste des defs n’est pas vide', () => {
    expect(DECOR_DEFS.length).toBeGreaterThan(90);
  });
  it.each(DECOR_DEFS)('catalog/decor/defs/%s : zéro couleur en dur', (f) => {
    const hits = colorHits(readFileSync(`${DECOR_DEFS_DIR}/${f}`, 'utf8'));
    expect(hits, `Couleurs en dur dans decor/defs/${f} :\n${hits.join('\n')}`).toEqual([]);
  });
});
