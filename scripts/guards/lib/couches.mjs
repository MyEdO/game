// LES ZONES DE `src/` ET LEURS SENS D'IMPORT (#2882 ; AGENTS.md règle 3). Une seule source : le mur
// `murs/purete-imports` et le mur `murs/zone` (`couchesLint.mjs`) la lisent, `docs/architecture.md`
// la décrit. Plan : `docs/plans/2026-10-19-restructuration.md`.
//
// Une zone est un dossier de premier niveau de `src/` ; `racine` désigne les fichiers posés à même
// `src/` (entrée de l'hôte web, tests transverses). Par zone :
//  - `importe` : les zones qu'elle importe librement (`'*'` : toutes) ;
//  - `types` : les zones qu'elle ne lit que par un arc effacé à la compilation (`import type`…) ;
//  - `portes` : pour une zone importée, le SEUL module qu'elle en lit (sa surface), en valeur comme en type.
// Toute autre zone lui est fermée, même pour un type.

/** La surface du noyau (#2817 D9) : la porte de `noyau` pour un hôte, l'entrée de la fermeture
 *  (`fermetureDuNoyau.mjs`), le seul module de `src/noyau/` qui réexporte (`reexportations.mjs`). */
export const SURFACE_DU_NOYAU = 'src/noyau/index.ts';

const FEUILLES = Object.freeze(['lib', 'geometry', 'i18n']);
const AMONT_DE_LA_PRESENTATION = Object.freeze(['state', 'noyau', 'web', 'scenes', 'data', 'engine', 'net', 'audio', ...FEUILLES]);

export const COUCHES = Object.freeze({
  lib: { importe: [] },
  geometry: { importe: [] },
  i18n: { importe: [] },
  engine: { importe: ['data', ...FEUILLES] },
  data: { importe: ['engine', ...FEUILLES] },
  noyau: { importe: ['engine', 'data', ...FEUILLES] },
  hoteTexte: { importe: ['noyau', 'scenes', ...FEUILLES], portes: { noyau: SURFACE_DU_NOYAU } },
  scenes: { importe: ['noyau', 'data', 'engine', ...FEUILLES] },
  net: { importe: [...FEUILLES] },
  web: { importe: [...FEUILLES] },
  audio: { importe: ['web', ...FEUILLES] },
  state: { importe: ['noyau', 'web', 'engine', 'data', 'scenes', 'net', 'audio', ...FEUILLES], types: ['ui'] },
  ui: { importe: ['gameIso', ...AMONT_DE_LA_PRESENTATION] },
  gameIso: { importe: ['ui', ...AMONT_DE_LA_PRESENTATION] },
  racine: { importe: '*' },
});

/** `z` est-il une zone de la table ? Clé PROPRE seulement : `constructor` ou `__proto__` n'en sont pas. */
export const estZone = (z) => typeof z === 'string' && Object.hasOwn(COUCHES, z);

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
