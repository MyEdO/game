// LES ZONES DU DÉPÔT ET LEURS SENS D'IMPORT (#2882, #2928 ; AGENTS.md règle 3). Une seule source : les murs de
// `couchesLint.mjs`, la suite du noyau (`racinesDeLaSuite.mjs`), les couches CSS (`cssCouches.mjs`) et les racines
// que l'arbre porte (`racinesPresentes.mjs`) la lisent, `docs/architecture.md` (§ Couches) la décrit.
//
// Une zone est un dossier : `dossier`, `src/<zone>` par défaut ; `racine` désigne les fichiers posés à même `src/`
// (entrée de l'hôte web, tests transverses). Par zone :
//  - `importe` : les zones qu'elle importe librement (`'*'` : toutes) ;
//  - `types` : les zones qu'elle ne lit que par un arc effacé à la compilation (`import type`…) ;
//  - `portes` : pour une zone importée, le SEUL module qu'elle en lit (sa surface), en valeur comme en type ;
//  - `survit` : la zone survit à la bascule vers Godot (#2794) — elle ne charge aucun paquet de l'hôte web
//    (`PAQUETS_DE_L_HOTE_WEB`), même pour un type, n'écrit aucun JSX, et ne lit aucun module hors des zones ;
//  - `outillage` : pour un outillage de la zone (lancé par Node à la construction, à la recette ou par les tests,
//    jamais chargé par l'hôte), les seuls modules hors des zones qu'il lit (`horsZoneOuvert`) ;
//  - `paquetsDOutillage` : pour un outillage de la zone, les seuls paquets de l'hôte web que ses modules chargent
//    (`paquetFerme`) ; aucun module de la zone hors de cet outillage ne l'importe (`outillageAtteint`).
// La clé d'un outillage (`couvre`) : finie par `/`, un dossier et tout ce qu'il contient ; sinon, un fichier exact.
// Toute autre zone lui est fermée, même pour un type.
import { posix as cheminPosix } from 'node:path';

/** La surface du noyau (#2817 D9) : la porte de `noyau` pour un hôte, le seul module de `src/state/` et
 *  `src/noyau/` qui réexporte (`murs/reexportation`, `couchesLint.mjs`). */
export const SURFACE_DU_NOYAU = 'src/noyau/index.ts';

/** Les zones dont la production ne réexporte rien hors de `SURFACE_DU_NOYAU` (#2817 D2, `murs/reexportation`). */
export const ZONES_SANS_REEXPORTATION = Object.freeze(['state', 'noyau']);

/** Les paquets de l'hôte web (#2817 D9) : aucune zone qui survit à la bascule (`survit`) ne les charge. */
export const PAQUETS_DE_L_HOTE_WEB = Object.freeze(['react', 'react-dom', 'zustand', 'three']);

const FEUILLES = Object.freeze(['lib', 'geometry', 'i18n']);
const AMONT_DE_LA_PRESENTATION = Object.freeze(['state', 'noyau', 'web', 'scenes', 'data', 'engine', 'net', 'audio', ...FEUILLES]);

/** Les droits d'un hôte du noyau (#2898, #2928) : la porte du noyau, les scénarios et les feuilles. */
const DROITS_D_HOTE = Object.freeze({ importe: Object.freeze(['noyau', 'scenes', ...FEUILLES]), portes: Object.freeze({ noyau: SURFACE_DU_NOYAU }), survit: true });

/** Les droits d'un hôte qui lit le module commun des hôtes (`hote`) : ceux d'un hôte, plus `hote`. */
const DROITS_DES_HOTES = Object.freeze({ ...DROITS_D_HOTE, importe: Object.freeze([...DROITS_D_HOTE.importe, 'hote']) });

export const COUCHES = Object.freeze({
  lib: { importe: [], survit: true },
  geometry: { importe: [], survit: true },
  i18n: { importe: [], survit: true },
  engine: { importe: ['data', ...FEUILLES], survit: true },
  data: { importe: ['engine', ...FEUILLES], survit: true },
  noyau: { importe: ['engine', 'data', ...FEUILLES], survit: true },
  hote: DROITS_D_HOTE,
  hoteTexte: DROITS_DES_HOTES,
  hotes: {
    dossier: 'hotes',
    ...DROITS_DES_HOTES,
    outillage: {
      'hotes/godot/construire.mjs': ['scripts/entree-d-hote.mjs', 'scripts/guards/lib/lister.mjs'],
      'hotes/godot/asset/charger.mjs': ['scripts/entree-d-hote.mjs'],
      'hotes/godot/asset/importer.ts': ['scripts/guards/lib/ecritureJsonAtomique.mjs'],
      'hotes/godot/asset/release.ts': ['scripts/guards/lib/ecritureJsonAtomique.mjs'],
      'hotes/godot/recette.mjs': ['scripts/recette/lib.mjs'],
    },
    paquetsDOutillage: { 'hotes/godot/asset/evaluateur/': ['three'] },
  },
  scenes: {
    importe: ['noyau', 'data', 'engine', ...FEUILLES],
    survit: true,
    outillage: { 'src/scenes/projetsLivres.testkit.ts': ['scripts/guards/lib/projetsLivres.mjs'] },
  },
  net: { importe: [...FEUILLES] },
  web: { importe: [...FEUILLES] },
  audio: { importe: ['web', ...FEUILLES] },
  state: { importe: ['noyau', 'hote', 'web', 'engine', 'data', 'scenes', 'net', 'audio', ...FEUILLES], types: ['ui'] },
  ui: { importe: ['gameIso', 'hote', ...AMONT_DE_LA_PRESENTATION] },
  gameIso: { importe: ['ui', ...AMONT_DE_LA_PRESENTATION] },
  racine: { dossier: 'src', importe: '*' },
});

/** `z` est-il une zone de la table ? Clé PROPRE seulement : `constructor` ou `__proto__` n'en sont pas. */
export const estZone = (z) => typeof z === 'string' && Object.hasOwn(COUCHES, z);

/** Le dossier de la zone `z`, relatif à la racine du dépôt : `src/<z>` sauf déclaration. */
export const dossierDe = (z) => COUCHES[z].dossier ?? `src/${z}`;

/** Les dossiers de premier niveau du dépôt qui portent une zone (`src`, `hotes`). */
export const RACINES_DES_ZONES = Object.freeze([...new Set(Object.keys(COUCHES).map((z) => dossierDe(z).split('/')[0]))]);


/** Les hôtes du noyau : les zones qui ne lisent le noyau que par sa porte (`portes`). */
export const HOTES_DU_NOYAU = Object.freeze(Object.keys(COUCHES).filter((z) => COUCHES[z].portes?.noyau === SURFACE_DU_NOYAU));

/** Les zones à dossier propre, du plus long dossier au plus court : un dossier imbriqué se lit avant son parent. */
const PAR_DOSSIER = Object.keys(COUCHES).filter((z) => z !== 'racine').map((z) => [dossierDe(z), z]).sort(([a], [b]) => b.length - a.length);

/** La zone d'un chemin RELATIF à la racine du dépôt : celle dont le chemin est sous le dossier (`dossierDe`), `racine`
 *  pour un fichier posé à même `src/`, `null` hors de `src/` et des dossiers de zone. Un sous-dossier de `src/` sans
 *  ligne rend son dossier (`src/<segment>`), qui n'est jamais une zone, pour que `murs/zone` le nomme — `src/hotes/`
 *  et `src/racine/` compris, dont le nom est celui d'une zone d'un autre dossier. PURE. */
export function zoneDe(rel) {
  const chemin = cheminPosix.normalize(rel.split('\\').join('/'));
  const zone = PAR_DOSSIER.find(([d]) => chemin === d || chemin.startsWith(`${d}/`));
  if (zone) return zone[1];
  const segments = chemin.split('/');
  if (segments[0] !== 'src' || segments.length < 2) return null;
  return segments.length === 2 ? 'racine' : `src/${segments[1]}`;
}

/** Les zones que `de` importe librement, et celles qu'elle ne lit qu'en type. */
export function ouvertes(de) {
  const { importe, types = [] } = COUCHES[de];
  const libres = importe === '*' ? Object.keys(COUCHES).filter((z) => z !== de) : [...importe];
  return { libres, enType: [...types] };
}

/** Le verdict d'un arc de la zone `de` vers la zone `vers` : `null` s'il est ouvert, sinon ce qui le
 *  ferme — `'execution'` (un type passerait) ou `'type'` (fermé même pour un type). */
export function fermeture(de, vers, typeSeul) {
  if (!estZone(de) || de === vers) return null;
  const zone = COUCHES[de];
  if (zone.importe === '*' || zone.importe.includes(vers)) return null;
  if ((zone.types ?? []).includes(vers)) return typeSeul ? null : 'execution';
  return 'type';
}

/** La clé d'outillage `cle` couvre-t-elle le chemin `rel` (relatif à la racine) : finie par `/`, `rel` est sous ce
 *  dossier ; sinon, `rel` est ce fichier. PURE. */
export const couvre = (cle, rel) => (cle.endsWith('/') ? rel.startsWith(cle) : rel === cle);

/** Les valeurs déclarées pour `rel` dans la table d'outillage `table` (`outillage`, `paquetsDOutillage`) : celles de
 *  chaque clé qui le couvre (`couvre`). */
const declarePour = (table, rel) => Object.entries(table ?? {}).flatMap(([cle, valeurs]) => (couvre(cle, rel) ? valeurs : []));

/** Le module hors des zones `cibleRel` est-il ouvert à `importeurRel` (chemins relatifs à la racine) : un outillage
 *  de la zone `de` (`outillage`) qui le déclare ? */
export const horsZoneOuvert = (de, importeurRel, cibleRel) => estZone(de) && declarePour(COUCHES[de].outillage, importeurRel).includes(cibleRel);

/** Le paquet `paquet` est-il ouvert à `importeurRel` (chemin relatif à la racine) : un outillage de la zone `de`
 *  (`paquetsDOutillage`) le contient et le déclare ? */
const paquetDOutillage = (de, paquet, importeurRel) => importeurRel !== undefined && declarePour(COUCHES[de].paquetsDOutillage, importeurRel).includes(paquet);

/** L'outillage de la zone `de` (clé de `paquetsDOutillage`) que l'arc de `importeurRel` vers `cibleRel` (chemins
 *  relatifs à la racine) atteint du dehors : la cible est sous lui, l'importeur hors de lui ; `null` sinon. PURE. */
export const outillageAtteint = (de, importeurRel, cibleRel) => (estZone(de)
  ? Object.keys(COUCHES[de].paquetsDOutillage ?? {}).find((cle) => couvre(cle, cibleRel) && !couvre(cle, importeurRel)) ?? null
  : null);

/** La zone `de` refuse-t-elle le paquet `paquet` à `importeurRel` : elle survit à la bascule, c'est un paquet de l'hôte
 *  web, et aucun outillage de la zone ne le lui ouvre (`paquetsDOutillage`) ? Sans importeur, le verdict de
 *  la zone. */
export const paquetFerme = (de, paquet, importeurRel) => estZone(de) && COUCHES[de].survit === true && PAQUETS_DE_L_HOTE_WEB.includes(paquet)
  && !paquetDOutillage(de, paquet, importeurRel);

/** Le module d'un chemin RELATIF à la racine, sans extension de script ni `index` final : `src/noyau/index.ts`,
 *  `src/noyau/index` et `src/noyau` désignent le même module. PURE. */
const moduleDe = (rel) => rel.replace(/\.(?:[cm]?[jt]sx?)$/, '').replace(/\/index$/, '');

/** La porte que la zone `de` impose vers la zone `vers` quand l'arc vise `cibleRel` (chemin relatif à la racine) :
 *  `null` si `de` n'en déclare aucune vers `vers` ou si l'arc la passe, sinon le module de la porte. */
export function porteManquee(de, vers, cibleRel) {
  const porte = estZone(de) && COUCHES[de].portes ? COUCHES[de].portes[vers] : undefined;
  if (porte === undefined || moduleDe(cibleRel) === moduleDe(porte)) return null;
  return porte;
}
