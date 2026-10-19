// LES ZONES DE `src/` ET LEURS SENS D'IMPORT (#2882 ; AGENTS.md règle 3). Une seule source : le mur
// `murs/purete-imports` et le mur `murs/zone` (`couchesLint.mjs`) la lisent, `docs/architecture.md`
// la décrit. Plan : `docs/plans/2026-10-19-restructuration.md`.
//
// Une zone est un dossier de premier niveau de `src/` ; `racine` désigne les fichiers posés à même
// `src/` (entrée de l'hôte web, tests transverses). Par zone :
//  - `importe` : les zones qu'elle importe librement (`'*'` : toutes) ;
//  - `types` : les zones qu'elle ne lit que par un arc effacé à la compilation (`import type`…) ;
//  - `transitoire` : une arête d'aujourd'hui contraire à la cible, de zone à zone, avec la sous-issue qui
//    la retire, et `types: true` quand l'arête n'est qu'un arc de type. La sous-issue retire sa ligne.
// Toute autre zone lui est fermée, même pour un type.

const FEUILLES = Object.freeze(['lib', 'geometry', 'i18n']);
const AMONT_DE_LA_PRESENTATION = Object.freeze(['state', 'scenes', 'data', 'engine', 'net', 'audio', ...FEUILLES]);

export const COUCHES = Object.freeze({
  lib: { importe: [] },
  geometry: { importe: [] },
  i18n: { importe: [] },
  engine: { importe: ['data', ...FEUILLES], transitoire: { gameIso: { issue: '#2884', types: true } } },
  data: {
    importe: ['engine', ...FEUILLES],
    transitoire: {
      state: { issue: '#2884', types: true },
      gameIso: { issue: '#2884', types: true },
      scenes: { issue: '#2884' },
    },
  },
  scenes: {
    importe: ['data', 'engine', ...FEUILLES],
    transitoire: { state: { issue: '#2884' }, ui: { issue: '#2884', types: true } },
  },
  net: { importe: [...FEUILLES] },
  audio: { importe: [...FEUILLES], transitoire: { state: { issue: '#2884' } } },
  state: { importe: ['engine', 'data', 'scenes', 'net', 'audio', ...FEUILLES], types: ['ui'] },
  ui: { importe: ['gameIso', ...AMONT_DE_LA_PRESENTATION] },
  gameIso: { importe: ['ui', ...AMONT_DE_LA_PRESENTATION] },
  racine: { importe: '*' },
});

/** `z` est-il une zone de la table ? Clé PROPRE seulement : `constructor` ou `__proto__` n'en sont pas. */
export const estZone = (z) => typeof z === 'string' && Object.hasOwn(COUCHES, z);

/** Les zones que `de` importe librement, et celles qu'elle ne lit qu'en type, arêtes transitoires
 *  comprises. */
export function ouvertes(de) {
  const { importe, types = [], transitoire = {} } = COUCHES[de];
  const libres = importe === '*' ? Object.keys(COUCHES).filter((z) => z !== de) : [...importe];
  const enType = [...types];
  for (const [vers, arete] of Object.entries(transitoire)) (arete.types ? enType : libres).push(vers);
  return { libres, enType };
}

/** Le verdict d'un arc de la zone `de` vers la zone `vers` : `null` s'il est ouvert, sinon ce qui le
 *  ferme — `'execution'` (un type passerait) ou `'type'` (fermé même pour un type). */
export function fermeture(de, vers, typeSeul) {
  if (!estZone(de) || de === vers) return null;
  const zone = COUCHES[de];
  if (zone.importe === '*' || zone.importe.includes(vers)) return null;
  const transitoire = zone.transitoire && Object.hasOwn(zone.transitoire, vers) ? zone.transitoire[vers] : undefined;
  if (transitoire && !transitoire.types) return null;
  const typeOuvert = Boolean(transitoire) || (zone.types ?? []).includes(vers);
  if (typeOuvert) return typeSeul ? null : 'execution';
  return 'type';
}
