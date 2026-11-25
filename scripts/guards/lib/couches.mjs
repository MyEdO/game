// LES ZONES DU DÉPÔT ET LEURS SENS D'IMPORT (#2882, #2928 ; AGENTS.md règle 3). Une seule source : les murs de
// `couchesLint.mjs`, la suite du noyau (`racinesDeLaSuite.mjs`), les couches CSS (`cssCouches.mjs`) et les racines
// que l'arbre porte (`racinesPresentes.mjs`) la lisent, `docs/architecture.md` (§ Couches) la décrit.
//
// Une zone est un dossier : `dossier`, `src/<zone>` par défaut ; `racine` désigne les fichiers posés à même `src/`
// (tests transverses). Hors de `src/`, chaque dossier de `hotes/` est un affichage et chaque dossier de `projets/` un
// projet (#4903 H3), chacun sa zone. La ligne d'un projet se construit (`ligneDeProjet`) : les droits d'un projet
// (`DROITS_D_UN_PROJET`), plus les affichages qu'il déclare, plus ses `ouvertures`, chacune nommée par son ticket, et
// son `outillage`. Un projet est fermé à toute autre zone,
// `importe: '*'` compris (`fermeParLeProjet`). Par zone :
//  - `importe` : les zones qu'elle importe librement (`'*'` : toutes) ;
//  - `types` : les zones qu'elle ne lit que par un arc effacé à la compilation (`import type`…) ;
//  - `portes` : pour une zone importée, le SEUL module qu'elle en lit (sa surface), en valeur comme en type ;
//  - `survit` : la zone survit à la bascule vers Godot (#2794) — elle ne charge aucun paquet de l'hôte web
//    (`PAQUETS_DE_L_HOTE_WEB`), même pour un type, n'écrit aucun JSX, et ne lit aucun module hors des zones ; ses
//    suites et bancs n'atteignent aucune zone qui ne survit pas, même pour un type (`fermeParLaSurvie`, #3058), et la
//    clôture d'imports d'aucun de ses modules n'en compte un, outillage déclaré compris (#3337) ;
//  - `outillage` : pour un outillage de la zone (lancé par Node à la construction, à la recette ou par les tests,
//    jamais chargé par l'hôte), les seuls modules hors des zones qu'il lit (`horsZoneOuvert`) ;
//  - `paquetsDOutillage` : pour un outillage de la zone, les seuls paquets de l'hôte web que ses modules chargent
//    (`paquetFerme`) ; aucun module de la zone hors de cet outillage ne l'importe (`outillageAtteint`).
// La clé d'un outillage (`couvre`) : finie par `/`, un dossier et tout ce qu'il contient ; sinon, un fichier exact.
// Toute autre zone lui est fermée, même pour un type.
import { posix as cheminPosix } from 'node:path';

/** La surface du noyau (#2817 D9) : la porte de `noyau` pour un hôte, le seul module de `src/noyau/` et `src/scenes/` qui réexporte (`murs/reexportation`, `couchesLint.mjs`). */
export const SURFACE_DU_NOYAU = 'src/noyau/index.ts';

/** Les zones dont la production ne réexporte rien hors de `SURFACE_DU_NOYAU` (#2817 D2, `murs/reexportation`). */
export const ZONES_SANS_REEXPORTATION = Object.freeze(['noyau', 'scenes']);

/** Les paquets de l'hôte web (#2817 D9) : aucune zone qui survit à la bascule (`survit`) ne les charge. */
export const PAQUETS_DE_L_HOTE_WEB = Object.freeze(['react', 'react-dom', 'zustand', 'three']);

const FEUILLES = Object.freeze(['lib', 'geometry', 'i18n']);

/** Les droits d'un hôte du noyau (#2898, #2928) : la porte du noyau, les scénarios et les feuilles. */
const DROITS_D_HOTE = Object.freeze({ importe: Object.freeze(['noyau', 'scenes', ...FEUILLES]), portes: Object.freeze({ noyau: SURFACE_DU_NOYAU }), survit: true });

/** Les droits d'un hôte qui lit le module commun des hôtes (`hote`) : ceux d'un hôte, plus `hote`. */
const DROITS_DES_HOTES = Object.freeze({ ...DROITS_D_HOTE, importe: Object.freeze([...DROITS_D_HOTE.importe, 'hote']) });

/** Les droits d'un projet (#4903 H3) : ceux des hôtes (`DROITS_DES_HOTES`), sans `scenes`. */
export const DROITS_D_UN_PROJET = Object.freeze({ ...DROITS_DES_HOTES, importe: Object.freeze(DROITS_DES_HOTES.importe.filter((z) => z !== 'scenes')) });

/** La ligne du projet de dossier `dossier` (#4903 H3) : les droits d'un projet (`DROITS_D_UN_PROJET`), plus les
 *  `affichages` qu'il déclare, des droits, plus ses `ouvertures` (`{ <zone>: <n° de ticket> }`) ; ouvrir une zone
 *  l'importe et retire sa porte. `outillage` : les modules hors des zones que lit chacun de ses outillages. La ligne
 *  garde ses affichages et ses ouvertures. PURE. */
export function ligneDeProjet(dossier, ouvertures, { affichages = [], outillage } = {}) {
  const ouvertes = Object.keys(ouvertures);
  return Object.freeze({
    dossier,
    ...DROITS_D_UN_PROJET,
    importe: Object.freeze([...new Set([...DROITS_D_UN_PROJET.importe, ...affichages, ...ouvertes])]),
    portes: Object.freeze(Object.fromEntries(Object.entries(DROITS_D_UN_PROJET.portes).filter(([z]) => !ouvertes.includes(z)))),
    ...(outillage && { outillage: Object.freeze({ ...outillage }) }),
    affichages: Object.freeze([...affichages]),
    ouvertures: Object.freeze({ ...ouvertures }),
  });
}

export const COUCHES = Object.freeze({
  lib: { importe: [], survit: true },
  geometry: { importe: [], survit: true },
  i18n: { importe: [], survit: true },
  engine: { importe: ['data', ...FEUILLES], survit: true },
  data: { importe: ['engine', ...FEUILLES], survit: true },
  noyau: {
    importe: ['engine', 'data', ...FEUILLES],
    survit: true,
    outillage: { 'src/noyau/noeudsDeTest.testkit.ts': ['scripts/guards/lib/lister.mjs'] },
  },
  hote: DROITS_D_HOTE,
  texte: { dossier: 'hotes/texte', ...DROITS_DES_HOTES },
  godot: {
    dossier: 'hotes/godot',
    ...DROITS_DES_HOTES,
    outillage: {
      'hotes/godot/construire.mjs': ['scripts/entree-d-hote.mjs', 'scripts/guards/lib/ecritureJsonAtomique.mjs', 'scripts/guards/lib/fileBornee.mjs', 'scripts/guards/lib/lister.mjs', 'scripts/guards/lib/pid.mjs', 'scripts/test/verrou.mjs'],
      'hotes/godot/avis.mjs': ['scripts/guards/lib/lister.mjs'],
      'hotes/godot/cibles/propositions/sources/rendre.mjs': ['scripts/guards/lib/lister.mjs', 'scripts/recette/navigateur.mjs'],
      'hotes/godot/asset/charger.mjs': ['scripts/entree-d-hote.mjs'],
      'hotes/godot/asset/evaluer.mjs': ['scripts/test/partition.mjs'],
      'hotes/godot/asset/importer.ts': ['scripts/guards/lib/ecritureJsonAtomique.mjs'],
      'hotes/godot/asset/release.ts': ['scripts/guards/lib/ecritureJsonAtomique.mjs'],
      'hotes/godot/etalons.mjs': ['scripts/guards/lib/fileBornee.mjs', 'scripts/recette/ecart.mjs', 'scripts/recette/lib.mjs', 'scripts/recette/navigateur.mjs'],
      'hotes/godot/lot-de-recettes.mjs': ['scripts/guards/lib/fileBornee.mjs'],
      'hotes/godot/pilotage/': ['scripts/recette/lib.mjs'],
      'hotes/godot/planches.mjs': ['scripts/qc/lib/pngDecode.mjs', 'scripts/qc/lib/pngEncode.mjs'],
      'hotes/godot/recette.mjs': ['scripts/guards/lib/projetsLivres.mjs', 'scripts/qc/lib/pngDecode.mjs', 'scripts/qc/lib/pngEncode.mjs', 'scripts/docs/lib/cibles-registres.mjs'],
      'hotes/godot/servir.mjs': ['scripts/guards/lib/projetsLivres.mjs', 'scripts/source/projetLivre.mjs', 'scripts/source/resoudre.mjs', 'scripts/source/prose-source-plugin.mjs', 'scripts/guards/lib/ecritureJsonAtomique.mjs', 'scripts/docs/lib/cibles-registres.mjs'],
    },
    paquetsDOutillage: { 'hotes/godot/asset/evaluateur/': ['three'] },
  },
  roguelite: {
    ...ligneDeProjet('projets/roguelite', { engine: 4932, data: 4933, scenes: 4933, noyau: 4931 }),
    outillage: {
      'projets/roguelite/recette/commun.mjs': ['scripts/recette/navigateur.mjs'],
      'projets/roguelite/recette/images.mjs': ['scripts/recette/ecart.mjs'],
    },
  },
  scenes: {
    importe: ['noyau', 'data', 'engine', ...FEUILLES],
    survit: true,
    outillage: { 'src/scenes/projetsLivres.testkit.ts': ['scripts/guards/lib/projetsLivres.mjs'] },
  },
  racine: {
    dossier: 'src',
    importe: '*',
    survit: true,
    outillage: {
      'src/compendiumJoue.testkit.ts': ['scripts/guards/lib/editabiliteDesChamps.mjs', 'scripts/source/prose-source-plugin.mjs'],
      'src/ecrituresJouees.testkit.ts': ['scripts/guards/lib/editabiliteDesChamps.mjs', 'scripts/source/prose-source-plugin.mjs'],
      'src/formulaireJoue.testkit.ts': ['scripts/guards/lib/editabiliteDesChamps.mjs'],
    },
  },
});

/** `z` est-il une zone de la table ? Clé PROPRE seulement : `constructor` ou `__proto__` n'en sont pas. */
export const estZone = (z) => typeof z === 'string' && Object.hasOwn(COUCHES, z);

/** Le dossier de la zone `z`, relatif à la racine du dépôt : `src/<z>` sauf déclaration. */
export const dossierDe = (z) => COUCHES[z].dossier ?? `src/${z}`;

/** Les dossiers de premier niveau dont chaque dossier est une zone (#4903 H3) : les affichages, les projets. */
const RACINES_PAR_DOSSIER = Object.freeze(['hotes', 'projets']);

/** Les dossiers de premier niveau du dépôt qui portent une zone (`src`, `hotes`, `projets`). */
export const RACINES_DES_ZONES = Object.freeze([...new Set([...Object.keys(COUCHES).map((z) => dossierDe(z).split('/')[0]), ...RACINES_PAR_DOSSIER])]);


/** Les hôtes du noyau (#2898, #4903 H3) : les zones bâties sur les droits d'un hôte ou d'un projet, celles dont la ligne
 *  importe chaque zone des droits d'un projet (`DROITS_D_UN_PROJET`) autre qu'elle-même. */
export const HOTES_DU_NOYAU = Object.freeze(Object.keys(COUCHES).filter((z) => {
  const { importe } = COUCHES[z];
  return importe !== '*' && DROITS_D_UN_PROJET.importe.every((v) => v === z || importe.includes(v));
}));

/** Les dossiers des zones déclarées d’une garde de corpus, issus de `COUCHES` (#3556). La zone `racine` ne
 *  désigne pas un dossier à parcourir séparément. */
export function porteeDeGarde(zones) {
  return Object.freeze(zones.map((z) => {
    if (!estZone(z) || z === 'racine') throw new Error(`porteeDeGarde : « ${z} » ne désigne pas une zone de corpus`);
    return dossierDe(z);
  }));
}

/** Les zones à dossier propre, du plus long dossier au plus court : un dossier imbriqué se lit avant son parent. */
const PAR_DOSSIER = Object.keys(COUCHES).filter((z) => z !== 'racine').map((z) => [dossierDe(z), z]).sort(([a], [b]) => b.length - a.length);

/** La zone d'un chemin RELATIF à la racine du dépôt : celle dont le chemin est sous le dossier (`dossierDe`), `racine`
 *  pour un fichier posé à même `src/`, `null` hors des racines des zones (`RACINES_DES_ZONES`). Un dossier sans ligne
 *  rend son dossier, qui n'est jamais une zone, pour que `murs/zone` le nomme : `src/<segment>` (`src/godot/` et
 *  `src/racine/` compris, dont le nom est celui d'une zone d'un autre dossier), `hotes/<segment>` ou
 *  `projets/<segment>` ; un fichier posé à même `hotes/` ou `projets/` rend cette racine. PURE. */
export function zoneDe(rel) {
  const chemin = cheminPosix.normalize(rel.split('\\').join('/'));
  const zone = PAR_DOSSIER.find(([d]) => chemin === d || chemin.startsWith(`${d}/`));
  if (zone) return zone[1];
  const segments = chemin.split('/');
  if (segments.length < 2) return null;
  if (segments[0] === 'src') return segments.length === 2 ? 'racine' : `src/${segments[1]}`;
  if (!RACINES_PAR_DOSSIER.includes(segments[0])) return null;
  return segments.length === 2 ? segments[0] : `${segments[0]}/${segments[1]}`;
}

/** `z` est-il un projet : une zone dont le dossier est sous `projets/` (#4903 H3) ? */
export const estProjet = (z) => estZone(z) && dossierDe(z).startsWith('projets/');

/** La zone `vers` est-elle fermée à la zone `de` parce qu'elle est un projet, et `de` une autre zone (#4903 H3) ? Ni
 *  `importe: '*'`, ni une ligne, ni une suite ne l'ouvrent. PURE. */
export const fermeParLeProjet = (de, vers) => estProjet(vers) && de !== vers;

/** Les zones que `de` importe librement, et celles qu'elle ne lit qu'en type ; un projet n'en est jamais
 *  (`fermeParLeProjet`). */
export function ouvertes(de) {
  const { importe, types = [] } = COUCHES[de];
  const ouverte = (z) => z !== de && !fermeParLeProjet(de, z);
  return { libres: (importe === '*' ? Object.keys(COUCHES) : importe).filter(ouverte), enType: types.filter(ouverte) };
}

/** Le verdict d'un arc de la zone `de` vers la zone `vers` : `null` s'il est ouvert, sinon ce qui le
 *  ferme — `'execution'` (un type passerait) ou `'type'` (fermé même pour un type) ; un projet est fermé à toute autre
 *  zone (`fermeParLeProjet`). */
export function fermeture(de, vers, typeSeul) {
  if (!estZone(de) || de === vers) return null;
  if (fermeParLeProjet(de, vers)) return 'type';
  const zone = COUCHES[de];
  if (zone.importe === '*' || zone.importe.includes(vers)) return null;
  if ((zone.types ?? []).includes(vers)) return typeSeul ? null : 'execution';
  return 'type';
}

/** La zone `de` ferme-t-elle la zone `vers` à ses instruments et à la clôture de ses modules : `de` survit à la bascule
 *  (`survit`) et `vers`, zone de la table, n'y survit pas (#3058, #3337) ? Une cible hors de la table ne ferme rien. PURE. */
export const fermeParLaSurvie = (de, vers) => estZone(de) && COUCHES[de].survit === true && estZone(vers) && COUCHES[vers].survit !== true;

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
