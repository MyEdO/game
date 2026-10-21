// LES ZONES DU DÉPÔT ET LEURS SENS D'IMPORT (#2882, #2928 ; AGENTS.md règle 3). Une seule source : le mur
// `murs/purete-imports` et le mur `murs/zone` (`couchesLint.mjs`), la fermeture du noyau (`fermetureDuNoyau.mjs`), la
// suite du noyau (`racinesDeLaSuite.mjs`), les couches CSS (`cssCouches.mjs`) et les racines que l'arbre
// porte (`racinesPresentes.mjs`) la lisent,
// `docs/architecture.md` la décrit. Plan : `docs/plans/2026-10-19-restructuration.md`.
//
// Une zone est un dossier : `dossier`, `src/<zone>` par défaut ; `racine` désigne les fichiers posés à même `src/`
// (entrée de l'hôte web, tests transverses). Par zone :
//  - `importe` : les zones qu'elle importe librement (`'*'` : toutes) ;
//  - `types` : les zones qu'elle ne lit que par un arc effacé à la compilation (`import type`…) ;
//  - `portes` : pour une zone importée, le SEUL module qu'elle en lit (sa surface), en valeur comme en type.
// Toute autre zone lui est fermée, même pour un type.
import { posix as cheminPosix } from 'node:path';

/** La surface du noyau (#2817 D9) : la porte de `noyau` pour un hôte, l'entrée de la fermeture
 *  (`fermetureDuNoyau.mjs`), le seul module de `src/noyau/` qui réexporte (`reexportations.mjs`). */
export const SURFACE_DU_NOYAU = 'src/noyau/index.ts';

const FEUILLES = Object.freeze(['lib', 'geometry', 'i18n']);
const AMONT_DE_LA_PRESENTATION = Object.freeze(['state', 'noyau', 'web', 'scenes', 'data', 'engine', 'net', 'audio', ...FEUILLES]);

/** Les droits d'un hôte du noyau (#2898, #2928) : la porte du noyau, les scénarios et les feuilles. */
const DROITS_D_HOTE = Object.freeze({ importe: Object.freeze(['noyau', 'scenes', ...FEUILLES]), portes: Object.freeze({ noyau: SURFACE_DU_NOYAU }) });

/** Les droits d'un hôte qui lit le module commun des hôtes (`hote`) : ceux d'un hôte, plus `hote`. */
const DROITS_DES_HOTES = Object.freeze({ ...DROITS_D_HOTE, importe: Object.freeze([...DROITS_D_HOTE.importe, 'hote']) });

export const COUCHES = Object.freeze({
  lib: { importe: [] },
  geometry: { importe: [] },
  i18n: { importe: [] },
  engine: { importe: ['data', ...FEUILLES] },
  data: { importe: ['engine', ...FEUILLES] },
  noyau: { importe: ['engine', 'data', ...FEUILLES] },
  hote: DROITS_D_HOTE,
  hoteTexte: DROITS_DES_HOTES,
  hotes: { dossier: 'hotes', ...DROITS_DES_HOTES },
  scenes: { importe: ['noyau', 'data', 'engine', ...FEUILLES] },
  net: { importe: [...FEUILLES] },
  web: { importe: [...FEUILLES] },
  audio: { importe: ['web', ...FEUILLES] },
  state: { importe: ['noyau', 'web', 'engine', 'data', 'scenes', 'net', 'audio', ...FEUILLES], types: ['ui'] },
  ui: { importe: ['gameIso', ...AMONT_DE_LA_PRESENTATION] },
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
