/**
 * Générateur GÉNÉRIQUE de registres « dépose un fichier → intégré ». Scanne un dossier `defs/`
 * et écrit un index EXPLICITE (`_registry.generated.ts`) — pas d'`import.meta.glob` (Vite-only,
 * cassé sous tsx) : l'index généré marche partout (app Vite, Vitest, scripts tsx), est
 * inspectable et sans coût runtime. Réutilisable pour créatures / tenues / modèles / etc.
 *
 *   node scripts/gen-registry.mjs            (`npm run gen`, écrit)
 *   node scripts/gen-registry.mjs --check    (ligne de `GENERATORS`, scripts/docs/build-all.mjs : compare sans écrire)
 *
 * `genAll` joue la PHASE 1 (ces registres) puis la PHASE 2 (`scripts/gen-espaces.mts`, l'INDEX DES
 * IDS, les CLÉS DE DATASET et les RACINES VIVANTES), pour `npm run gen`, `npm run build` et le plugin
 * Vite (`vite.config.ts`, donc chaque run Vitest). Ajouter une entrée = déposer un fichier dans le `defs/` correspondant, puis relancer.
 */
import { readFileSync } from 'node:fs';
import { listerDossier } from './guards/lib/lister.mjs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { estFichierVitest } from './guards/lib/fichierVitest.mjs';
import { ecrireOuVerifier } from './docs/lib/empreinte-sources.mjs';

/**
 * `importDir` : chemin (relatif au fichier `out`) d'où importer chaque entrée. Défaut `./defs`
 * (les entrées vivent dans un sous-dossier `defs/`). Mettre `.` quand les fichiers sont à plat
 * dans le même dossier que l'index (cas des scénarios).
 * `idUnion` (option PAR registre) : émet AUSSI une union de littéraux `export type <typeName> =`
 * extraite des champs `<field>` littéraux des defs (`champsLitteraux`) — typage RÉEL des ids côté
 * consommateurs TS.
 * `fields` (option PAR registre) : quand un module de def exporte PLUSIEURS noms (pas 1 seul via
 * `exportName`), liste ces noms → chaque entrée du tableau généré devient `{ champ1, champ2, … }`
 * (ex. `src/data/schemas/defs/` : `file` + `schema`).
 * `constFields` (option PAR registre, avec `fields`) : champs de VALEUR LITTÉRALE ajoutés à chaque
 * entrée générée — ce que le def ne déclare pas parce que c'est une propriété du REGISTRE (la
 * racine `root` d'un dataset : le def dit son fichier, le registre dit d'où il vient).
 * `projection` (option PAR registre) : projette les ids des defs (et, avec `champ`, la valeur de ce champ
 * par id) dans `src/data/schemas/_art.generated.ts` (`genArt`) — la forme partagée extraite vers une
 * couche neutre (`eslint.config.js`, `AVALS_DATA`) : la donnée juge un id d'art d'auteur sans importer
 * le rendu.
 * @type {{ dir:string, out:string, exportName?:string, arrayName:string, type:string, typeFrom:string, importDir?:string, idUnion?:{ typeName:string, field:string }, fields?:string[], constFields?:Record<string,string>, projection?:{ nom:string, champ?:string } }[]}
 */
export const REGISTRIES = [
  {
    dir: 'src/gameIso/rig/creatures/defs',
    out: 'src/gameIso/rig/creatures/_registry.generated.ts',
    exportName: 'creature',
    arrayName: 'CREATURES',
    type: 'CreatureDef',
    typeFrom: './types',
    projection: { nom: 'ESPECES_DE_CREATURE' },
  },
  {
    // Scénarios de test : fichiers À PLAT dans le dossier (pas de sous-dossier defs/).
    dir: 'src/scenes/test-scenarios',
    out: 'src/scenes/test-scenarios/_registry.generated.ts',
    exportName: 'scenario',
    arrayName: 'SCENARIOS',
    type: 'TestScenario',
    typeFrom: './_shared',
    importDir: '.',
  },
  {
    // Parts monstrueuses (têtes/bras/jambes) : 1 part = 1 fichier defs/.
    dir: 'src/gameIso/rig/parts/monster/defs',
    out: 'src/gameIso/rig/parts/monster/_registry.generated.ts',
    exportName: 'part',
    arrayName: 'MONSTER_PARTS',
    type: 'MonsterPartDef',
    typeFrom: './types',
  },
  {
    // Têtes QUADRUPÈDES (art 3 vues + canaux de forme portés par la tête) : 1 tête = 1 fichier defs/.
    // L'union `QuadHeadId` est GÉNÉRÉE depuis les defs : le socle n'énumère aucune clé à la main.
    dir: 'src/gameIso/rig/quadruped/heads/defs',
    out: 'src/gameIso/rig/quadruped/heads/_registry.generated.ts',
    exportName: 'quadHead',
    arrayName: 'QUAD_HEAD_DEFS',
    type: 'QuadHeadDef',
    typeFrom: './types',
    idUnion: { typeName: 'QuadHeadId', field: 'key' },
  },
  {
    // Queues QUADRUPÈDES (art profil + dos) : 1 queue = 1 fichier defs/. L'union `QuadTailId` est
    // GÉNÉRÉE depuis les defs : le socle n'énumère aucune clé à la main.
    dir: 'src/gameIso/rig/quadruped/tails/defs',
    out: 'src/gameIso/rig/quadruped/tails/_registry.generated.ts',
    exportName: 'quadTail',
    arrayName: 'QUAD_TAIL_DEFS',
    type: 'QuadTailDef',
    typeFrom: './types',
    idUnion: { typeName: 'QuadTailId', field: 'key' },
  },
  {
    // Crinières QUADRUPÈDES (encolure de profil + fraise de poitrail + touffe de croupe) :
    // 1 crinière = 1 fichier defs/. L'union `QuadManeId` GÉNÉRÉE remplace l'union littérale du socle.
    dir: 'src/gameIso/rig/quadruped/manes/defs',
    out: 'src/gameIso/rig/quadruped/manes/_registry.generated.ts',
    exportName: 'quadMane',
    arrayName: 'QUAD_MANE_DEFS',
    type: 'QuadManeDef',
    typeFrom: './types',
    idUnion: { typeName: 'QuadManeId', field: 'key' },
  },
  {
    // Sets d'ÉQUIPEMENT quadrupèdes (sellerie/bât/barde — art cuit par vue depuis
    // `atelier/harnais/<id>@<espèce>-<vue>.dessin.mts`) : 1 set = 1 fichier defs/. Même patron que
    // les têtes/queues/crinières ; l'union `QuadHarnaisId` est GÉNÉRÉE des ids déclarés (#1128).
    dir: 'src/gameIso/rig/quadruped/harnais/defs',
    out: 'src/gameIso/rig/quadruped/harnais/_registry.generated.ts',
    exportName: 'quadHarnais',
    arrayName: 'QUAD_HARNAIS_DEFS',
    type: 'QuadHarnaisDef',
    typeFrom: './types',
    idUnion: { typeName: 'QuadHarnaisId', field: 'id' },
  },
  {
    // Appendices (cornes/queue, art multi-vues) : 1 appendice = 1 fichier defs/. Source UNIQUE de
    // l'art de corne/queue, référencé par id (monster.cornes / appendageFeature / traitVisuals).
    dir: 'src/gameIso/rig/parts/appendages/defs',
    out: 'src/gameIso/rig/parts/appendages/_registry.generated.ts',
    exportName: 'appendage',
    arrayName: 'APPENDAGE_DEFS',
    type: 'AppendageDef',
    typeFrom: './types',
    idUnion: { typeName: 'AppendageId', field: 'id' },
  },
  {
    // Prothèses/amputations (art dans defs) : 1 prothèse = 1 fichier.
    dir: 'src/gameIso/rig/parts/prosthesis/defs',
    out: 'src/gameIso/rig/parts/prosthesis/_registry.generated.ts',
    exportName: 'prosthesis',
    arrayName: 'PROSTHESIS_DEFS',
    type: 'ProsthesisDef',
    typeFrom: './types',
    idUnion: { typeName: 'ProsthesisId', field: 'id' },
  },
  {
    // Corps de base (chair nue, pour composer les tenues de monstres) : 1 corps = 1 fichier defs/.
    dir: 'src/gameIso/rig/parts/bodies/defs',
    out: 'src/gameIso/rig/parts/bodies/_registry.generated.ts',
    exportName: 'body',
    arrayName: 'BODY_DEFS',
    type: 'BodyDef',
    typeFrom: './types',
    idUnion: { typeName: 'BodyId', field: 'id' },
  },
  {
    // Yeux peints (art d'orbite, remplacé en place) : 1 œil = 1 fichier defs/. Blessures/mutations/éditeur.
    dir: 'src/gameIso/rig/parts/eyes/defs',
    out: 'src/gameIso/rig/parts/eyes/_registry.generated.ts',
    exportName: 'eye',
    arrayName: 'EYE_DEFS',
    type: 'EyeDef',
    typeFrom: './types',
    idUnion: { typeName: 'EyeId', field: 'id' },
  },
  {
    // Capes (art dorsal 3 vues) : 1 cape = 1 fichier defs/. Emplacement Cape (equip.cape), dorsalOverlays.
    dir: 'src/gameIso/rig/parts/capes/defs',
    out: 'src/gameIso/rig/parts/capes/_registry.generated.ts',
    exportName: 'cape',
    arrayName: 'CAPE_DEFS',
    type: 'CapeDef',
    typeFrom: './types',
    idUnion: { typeName: 'CapeId', field: 'id' },
  },
  {
    // Ailes (art dorsal 3 vues, emplumées/cuir) : 1 paire = 1 fichier defs/. Servi par le trait Vol,
    // l'élément 'ailes' et monster.ailes ; référencé par id.
    dir: 'src/gameIso/rig/parts/wings/defs',
    out: 'src/gameIso/rig/parts/wings/_registry.generated.ts',
    exportName: 'wing',
    arrayName: 'WING_DEFS',
    type: 'WingDef',
    typeFrom: './types',
    idUnion: { typeName: 'WingId', field: 'id' },
  },
  {
    // Tenues (archétypes de classe + Nu) : 1 tenue = 1 fichier defs/.
    dir: 'src/gameIso/rig/parts/tenues/defs',
    out: 'src/gameIso/rig/parts/tenues/_registry.generated.ts',
    exportName: 'tenue',
    arrayName: 'TENUE_DEFS',
    type: 'TenueDef',
    typeFrom: './types',
  },
  {
    // Têtes (visage + coiffure défaut par Race:Sexe, art tokenisé) : 1 tête = 1 fichier defs/.
    dir: 'src/gameIso/rig/parts/heads/defs',
    out: 'src/gameIso/rig/parts/heads/_registry.generated.ts',
    exportName: 'head',
    arrayName: 'HEAD_DEFS',
    type: 'HeadDef',
    typeFrom: './types',
  },
  {
    // Coiffures (pool partagé par sexe, 3 vues) : 1 coiffure = 1 fichier defs/.
    dir: 'src/gameIso/rig/parts/hairstyles/defs',
    out: 'src/gameIso/rig/parts/hairstyles/_registry.generated.ts',
    exportName: 'hairstyle',
    arrayName: 'HAIRSTYLE_DEFS',
    type: 'HairstyleDef',
    typeFrom: './types',
    projection: { nom: 'SEXE_DE_COIFFURE', champ: 'sex' },
  },
  {
    // Formes de nuée (silhouette d'1 constituant + palette) : 1 forme = 1 fichier defs/.
    dir: 'src/gameIso/rig/swarm/defs',
    out: 'src/gameIso/rig/swarm/_registry.generated.ts',
    exportName: 'swarmForm',
    arrayName: 'SWARM_FORM_DEFS',
    type: 'SwarmFormDef',
    typeFrom: './formDef',
    projection: { nom: 'FORMES_DE_NUEE' },
  },
  {
    // Éléments d'apparence (catalogue unifié — traits de corps réutilisables) : 1 élément = 1 fichier defs/.
    dir: 'src/gameIso/rig/parts/elements/defs',
    out: 'src/gameIso/rig/parts/elements/_registry.generated.ts',
    exportName: 'element',
    arrayName: 'ELEMENT_DEFS',
    type: 'AppearanceElement',
    typeFrom: './types',
  },
  {
    // Armes (forme + art unifiés) : 1 arme = 1 fichier defs/.
    dir: 'src/gameIso/rig/parts/weapons/defs',
    out: 'src/gameIso/rig/parts/weapons/_registry.generated.ts',
    exportName: 'weapon',
    arrayName: 'WEAPON_DEFS',
    type: 'WeaponDef',
    typeFrom: './types',
  },
  {
    // Boucliers (silhouette main faible) : 1 bouclier = 1 fichier defs/ — MÊME pattern que les armes.
    dir: 'src/gameIso/rig/parts/shields/defs',
    out: 'src/gameIso/rig/parts/shields/_registry.generated.ts',
    exportName: 'shield',
    arrayName: 'SHIELD_DEFS',
    type: 'ShieldDef',
    typeFrom: './types',
  },
  {
    // Armures (matériau × emplacement, art tokenisé) : 1 matériau = 1 fichier defs/ — MÊME pattern que les tenues.
    dir: 'src/gameIso/rig/parts/armour/defs',
    out: 'src/gameIso/rig/parts/armour/_registry.generated.ts',
    exportName: 'armour',
    arrayName: 'ARMOUR_DEFS',
    type: 'ArmourDef',
    typeFrom: './types',
  },
  {
    // Arts d'engin de siège (silhouette statique 3 vues, plan 'engin') : 1 engin = 1 fichier defs/ —
    // MÊME pattern que les armes/parts (routé par id d'espèce, JAMAIS de name-matcher ni de table à la main).
    dir: 'src/gameIso/rig/engin/defs',
    out: 'src/gameIso/rig/engin/_registry.generated.ts',
    exportName: 'enginArt',
    arrayName: 'ENGIN_ARTS',
    type: 'EnginArtDef',
    typeFrom: './artkit',
  },
  {
    // Arts de COQUE de navire (profil broadside) : 1 coque = 1 fichier defs/ — MÊME pattern que les
    // engins (routé par ID de véhicule dans composeShip ; un id sans def tombe sur le REPLI VISIBLE #223.
    // La galerie oriented-objects montre la couverture déclarée).
    dir: 'src/gameIso/rig/ship/defs',
    out: 'src/gameIso/rig/ship/_registry.generated.ts',
    exportName: 'hullArt',
    arrayName: 'SHIP_ARTS',
    type: 'ShipArtDef',
    typeFrom: './artkit',
  },
  {
    // Arts de VÉHICULE TERRESTRE : 1 véhicule = 1 fichier defs/ — MÊME pattern que les engins/coques
    // (routé par ID de véhicule dans composeLand ; un id sans def tombe sur le REPLI VISIBLE #223).
    dir: 'src/gameIso/rig/land/defs',
    out: 'src/gameIso/rig/land/_registry.generated.ts',
    exportName: 'landArt',
    arrayName: 'LAND_ARTS',
    type: 'LandArtDef',
    typeFrom: './artkit',
  },
  {
    // Gabarits (carrures réutilisables) : 1 carrure = 1 fichier defs/. Dissout PROPS.
    dir: 'src/gameIso/rig/gabarits/defs',
    out: 'src/gameIso/rig/gabarits/_registry.generated.ts',
    exportName: 'gabarit',
    arrayName: 'GABARIT_DEFS',
    type: 'GabaritDef',
    typeFrom: './types',
  },
  {
    // Gabarits corporels AUTO-ENREGISTRÉS : 1 plan = 1 fichier defs/ (ré-exporte son BodyPlan).
    // bodyPlan.ts dérive la table PLANS de cette liste → aucun registre central à éditer.
    dir: 'src/gameIso/rig/plans/defs',
    out: 'src/gameIso/rig/plans/_registry.generated.ts',
    exportName: 'plan',
    arrayName: 'PLAN_LIST',
    type: 'BodyPlan',
    typeFrom: '../bodyPlan',
  },
  {
    // Décors / placeables (catalogue) : 1 décor = 1 fichier defs/.
    dir: 'src/gameIso/catalog/decor/defs',
    out: 'src/gameIso/catalog/decor/_registry.generated.ts',
    exportName: 'prop',
    arrayName: 'PROP_DEFS',
    type: 'PropViz',
    typeFrom: '../types',
  },
  {
    // Icônes UI SVG maison (24×24, currentColor — remplacent les emojis) : 1 famille = 1 fichier defs/.
    // + union `IconIdGenerated` des ids déclarés → `IconId` (types.ts) est un VRAI type fermé.
    dir: 'src/ui/icons/defs',
    out: 'src/ui/icons/_registry.generated.ts',
    exportName: 'icons',
    arrayName: 'ICON_FAMILIES',
    type: 'IconFamily',
    typeFrom: './types',
    idUnion: { typeName: 'IconIdGenerated', field: 'id' },
  },
  {
    // Bandes d'ambiance (`SceneBackdrop`) : 1 illustration stylisée = 1 fichier defs/.
    dir: 'src/ui/backdrops/defs',
    out: 'src/ui/backdrops/_registry.generated.ts',
    exportName: 'backdrop',
    arrayName: 'BACKDROP_DEFS',
    type: 'BackdropDef',
    typeFrom: './types',
  },
  {
    // Sons (assets CC0 Kenney dans public/audio) : 1 son (avec variantes) = 1 fichier defs/.
    dir: 'src/audio/defs',
    out: 'src/audio/_registry.generated.ts',
    exportName: 'sound',
    arrayName: 'SOUND_DEFS',
    type: 'SoundDef',
    typeFrom: './types',
  },
  {
    // Schémas zod du contrat de donnée (Lot 1) : 1 dataset `src/data/*.json` = 1 fichier defs/,
    // exportant `file` (nom du .json) + `schema` (zod). `fields` (2 exports par module, pas 1
    // seul) → entrées `{ file, schema }` plutôt qu'un tableau plat d'un seul type.
    dir: 'src/data/schemas/defs',
    out: 'src/data/schemas/_registry.generated.ts',
    arrayName: 'SCHEMA_DEFS',
    type: 'SchemaDef',
    typeFrom: './types',
    fields: ['file', 'schema', 'famille', 'exposition'],
    optionalFields: ['meta'],
    constFields: { root: "'src/data'" },
  },
  {
    // Schémas zod des documents de la 2ᵉ racine (`src/scenes`) : 1 projet de campagne = 1 fichier
    // defs-scenes/, exportant `file` (chemin RELATIF à la racine, pas un basename), `schema` et
    // `famille`. Les modules de FORME du même dossier (scene/worldmap/narratif/projet) n'exportent
    // pas `file` : le collecteur les saute (cf. `genOne`, registres à champ `file`).
    dir: 'src/data/schemas/defs-scenes',
    out: 'src/data/schemas/_registry-scenes.generated.ts',
    importDir: './defs-scenes',
    arrayName: 'SCHEMA_DEFS_SCENES',
    type: 'SchemaDef',
    typeFrom: './types',
    fields: ['file', 'schema', 'famille', 'exposition'],
    optionalFields: ['meta'],
    constFields: { root: "'src/scenes'" },
  },
];

// Ajout ciblé (#298) : les 2 nouveaux defs manifeste (primitives-manifest, systemes-manifest) vivent
// dans le même dossier `src/data/schemas/defs/` que le registre SCHEMA_DEFS ci-dessus — un fichier
// déposé y est déjà repris par le générateur générique (aucune entrée REGISTRIES supplémentaire).

/**
 * FORME CANONIQUE de chaque export de premier niveau qu'un def porte et que CE générateur lit :
 * `chaine` = `export const X = '…';`, `presence` = seule l'existence de `export const X` compte (la valeur n'est lue qu'à la compilation du registre).
 * Un nom lu hors de cette table est une faute du générateur, pas du def.
 */
const FORMES_D_EXPORT = {
  file: 'chaine',
  famille: 'chaine',
  meta: 'presence',
};

const CHAINE = "'([^'\\\\\\n]+)'";
const VALEUR_CANONIQUE = new RegExp(`^ = ${CHAINE};$`);

/**
 * LECTEUR UNIQUE des exports de premier niveau d'un def — la seule lecture textuelle d'un export du
 * générateur. Règle unique, par nom lu : export absent → `undefined` ; `export const X` à sa forme
 * canonique (`FORMES_D_EXPORT`) → sa valeur (`true` pour une forme `presence`) ; tout autre export du
 * nom (commentaire en fin de ligne, `as const`, annotation de type, guillemets doubles, `export { … }`,
 * `export let`…) → la génération LÈVE en nommant le def et le champ.
 * @param {string} src source du def
 * @param {readonly string[]} noms exports lus
 * @param {string} def chemin du def, pour le message
 * @returns {Record<string, string | true | undefined>}
 */
export function lireExports(src, noms, def) {
  const lu = {};
  for (const nom of noms) {
    const forme = FORMES_D_EXPORT[nom];
    if (!forme) throw new Error(`gen-registry: lireExports : « ${nom} » n'a aucune forme à FORMES_D_EXPORT.`);
    const declaration = new RegExp(`^export const ${nom}\\b(.*)$`, 'm').exec(src);
    const autreForme = new RegExp(`^export\\s+(?:(?:let|var|function\\*?|async\\s+function|class)\\s+${nom}\\b|const\\s*\\{[^}]*\\b${nom}\\b)|^export\\s*\\{[^}]*\\b${nom}\\s*[,}]`, 'm').test(src);
    const hors = (attendu) =>
      new Error(`gen-registry: ${def} : export « ${nom} » hors de sa forme canonique (${attendu}) — le générateur est textuel, il ne lit que cette forme.`);
    const attendu = forme === 'chaine' ? `export const ${nom} = '…';` : `export const ${nom}`;
    if (autreForme && !declaration) throw hors(attendu);
    if (!declaration) { lu[nom] = undefined; continue; }
    if (forme === 'presence') { lu[nom] = true; continue; }
    const m = VALEUR_CANONIQUE.exec(declaration[1]);
    if (!m) throw hors(attendu);
    lu[nom] = m[1];
  }
  return lu;
}

/** Modules de def d'un dossier — la population de tout registre ; lève si le dossier manque. */
function modulesDeDefs(dir) {
  return listerDossier(dir).filter((f) => /\.tsx?$/.test(f) && !f.startsWith('_') && !estFichierVitest(f) && !f.endsWith('.ascii.ts') && f !== 'index.ts');
}

/** Les exports `noms` de chaque def d'un dossier, par `lireExports` : `{ module, …exports }`. */
export function lireDefs(dir, noms) {
  return modulesDeDefs(dir).map((f) => ({ module: f, ...lireExports(readFileSync(join(dir, f), 'utf8'), noms, join(dir, f)) }));
}

/** Les projections d'art (`genArt`). */
const SORTIE_ART = 'src/data/schemas/_art.generated.ts';

/** Les sorties de la PHASE 2 (`scripts/gen-espaces.mts`, qui les lit ici). */
export const SORTIES_DES_ESPACES = {
  ids: 'src/data/schemas/_ids.generated.ts',
  cles: 'src/data/schemas/_cles-de-dataset.generated.ts',
  racines: 'src/data/schemas/_racines-vivantes.generated.ts',
};

/** Tous les fichiers que ce générateur écrit EN ENTIER, phase 2 comprise — ses cibles dans `GENERATORS` (build-all.mjs). */
export const SORTIES = [...REGISTRIES.map((r) => r.out), SORTIE_ART, ...Object.values(SORTIES_DES_ESPACES)];

/** Le rouge d'un registre périmé en `--check` : `genAll` résume lui-même le reste. */
export const MESSAGES_DE = (out) => ({
  staleMsg: `gen-registry — ${out} est PÉRIMÉ (un fichier de defs ou une donnée a changé).`,
  rerunMsg: '  → relancer `npm run gen` et committer le résultat.',
});

function genOne(r, check) {
  const importDir = r.importDir ?? './defs';
  try {
    listerDossier(r.dir);
  } catch {
    return { arrayName: r.arrayName, dir: r.dir, files: 0, changed: false, missing: true };
  }
  // Registre à champ `file` : un module du dossier qui ne DÉCLARE pas de document (modules de
  // FORME partagés entre defs) n'est pas une entrée — critère STRUCTUREL, jamais une liste de noms.
  const lus = r.fields
    ? lireDefs(r.dir, [...(r.fields.includes('file') ? ['file'] : []), ...(r.optionalFields ?? [])])
      .filter((d) => !r.fields.includes('file') || d.file !== undefined)
    : modulesDeDefs(r.dir).map((module) => ({ module }));
  const files = lus.map((d) => d.module);
  // `fields` (option PAR registre) : un module de def exporte PLUSIEURS noms (ex. `file`+`schema`,
  // cf. src/data/schemas/defs/) → une entrée `{ champ1, champ2, … }` par fichier, au lieu du
  // tableau plat d'un seul export (`exportName`) des registres « 1 def = 1 valeur ».
  // Alias suffixé (`e0_champ`) UNIQUEMENT pour les registres multi-champs : les registres
  // « 1 def = 1 valeur » gardent `e0` — leur sortie générée reste byte-identique.
  // `optionalFields` : champ qu'un module de def exporte OU NON (`meta`, #1466). Le générateur est
  // TEXTUEL (listing + regex, jamais d'import runtime), donc un export absent doit être vu AVANT
  // d'être importé, sinon le module généré ne compile pas.
  const presents = (i) => (r.optionalFields ?? []).filter((fn) => lus[i][fn] !== undefined);
  const imports = files.map((f, i) => {
    const names = r.fields
      ? [...r.fields, ...presents(i)].map((fn) => `${fn} as e${i}_${fn}`).join(', ')
      : `${r.exportName} as e${i}`;
    return `import { ${names} } from '${importDir}/${f.replace(/\.tsx?$/, '')}';`;
  });
  const constParts = Object.entries(r.constFields ?? {}).map(([k, v]) => `${k}: ${v}`);
  const arr = r.fields
    ? files.map((_, i) => `{ ${[...r.fields, ...presents(i)].map((fn) => `${fn}: e${i}_${fn}`).concat(constParts).join(', ')} }`)
    : files.map((_, i) => `e${i}`);
  // Union de littéraux des ids déclarés dans les defs (option `idUnion`) — triée, dédupliquée.
  let unionDecl = '';
  if (r.idUnion) {
    const uniq = unionDesIds(r.dir, files, r.idUnion.field);
    // Registre encore VIDE (socle posé avant sa première def) : l'union est `never`, pas la chaîne
    // vide — un `''` accepterait silencieusement l'id vide chez les consommateurs.
    unionDecl =
      `\n/** Union GÉNÉRÉE des \`${r.idUnion.field}\` déclarés dans les defs — le typage réel des consommateurs. */\n` +
      `export type ${r.idUnion.typeName} =\n${uniq.length ? `  | '${uniq.join(`'\n  | '`)}';\n` : '  | never;\n'}`;
  }
  const body =
    `// GÉNÉRÉ par scripts/gen-registry.mjs — NE PAS ÉDITER À LA MAIN.\n` +
    `// Ajouter une entrée = déposer un fichier dans ${importDir === '.' ? r.dir.split('/').pop() : importDir.replace('./', '')}/ puis \`npm run gen\`.\n` +
    `import type { ${r.type} } from '${r.typeFrom}';\n` +
    imports.join('\n') + '\n\n' +
    `export const ${r.arrayName}: ${r.type}[] = [${arr.join(', ')}];\n` +
    unionDecl;
  // `ecrireDoc` n'écrit que si le contenu change (évite de toucher le mtime → boucles de watch).
  const changed = !ecrireOuVerifier({ out: body, path: r.out, check, ...MESSAGES_DE(r.out) });
  return { arrayName: r.arrayName, dir: r.dir, files: files.length, changed, missing: false };
}

/** Littéral de chaîne TS d'une valeur, pour les modules générés. */
const lit = (v) => `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/**
 * Valeurs du champ `champ` écrites en LITTÉRAL (guillemets simples ou doubles, en tête de ligne) dans
 * la source d'un def — SEULE règle de lecture d'un littéral du générateur (`idUnion`, `projection`).
 * Un compte hors de la `cardinalite`, ou une mention du champ qui n'est pas un tel littéral, LÈVE en
 * nommant le def : un id calculé, absent ou doublé ne sort pas du registre en silence.
 * @param {string} src source du def
 * @param {string} champ champ lu
 * @param {string} def chemin du def, pour le message
 * @param {'un' | 'auMoinsUn'} cardinalite
 * @returns {string[]}
 */
export function champsLitteraux(src, champ, def, cardinalite) {
  const vus = [...src.matchAll(new RegExp(String.raw`^\s*${champ}:\s*(['"])([^'"\\\n]+)\1`, 'gm'))].map((m) => m[2]);
  if (cardinalite === 'un' ? vus.length !== 1 : vus.length === 0)
    throw new Error(`gen-registry: ${def} : ${vus.length} champ(s) « ${champ} » littéral(aux) — le registre en exige ${cardinalite === 'un' ? 'EXACTEMENT' : 'AU MOINS'} un.`);
  const mentions = [...src.matchAll(new RegExp(String.raw`\b${champ}\s*:`, 'g'))].length;
  if (mentions !== vus.length)
    throw new Error(`gen-registry: ${def} : ${mentions - vus.length} champ(s) « ${champ} » non littéral(aux) — le registre ne lit que des littéraux.`);
  return vus;
}

/**
 * Union des `field` littéraux déclarés par les defs `files` de `dir` (option `idUnion`) — triée, dédupliquée.
 * @param {string} dir @param {string[]} files @param {string} field @returns {string[]}
 */
export function unionDesIds(dir, files, field) {
  const ids = files.flatMap((f) => champsLitteraux(readFileSync(join(dir, f), 'utf8'), field, join(dir, f), 'auMoinsUn'));
  return [...new Set(ids)].sort();
}

/**
 * Projection d'un registre de defs : `[id]` par def, ou `[id, valeur de champ]` avec `projection.champ`.
 * FAIL-FAST nominatif : un id porté par deux defs lève.
 * @param {string} dir dossier des defs
 * @param {{ nom:string, champ?:string }} projection
 * @returns {string[][]}
 */
export function projeterDefs(dir, projection) {
  const lignes = modulesDeDefs(dir).map((f) => {
    const src = readFileSync(join(dir, f), 'utf8');
    const [id] = champsLitteraux(src, 'id', join(dir, f), 'un');
    return projection.champ ? [id, ...champsLitteraux(src, projection.champ, join(dir, f), 'un')] : [id];
  });
  const vus = new Set();
  for (const [id] of lignes) {
    if (vus.has(id)) throw new Error(`gen-registry: ${dir} : id « ${id} » porté par deux defs — ${projection.nom} ne peut pas se projeter.`);
    vus.add(id);
  }
  return lignes.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Module des projections (`projection` des `REGISTRIES`), écrit seulement s'il change. */
function genArt(check, registres = REGISTRIES, out = SORTIE_ART) {
  const blocs = registres.filter((r) => r.projection).map((r) => {
    const lignes = projeterDefs(r.dir, r.projection);
    const tete = `/** Projection GÉNÉRÉE de \`${r.dir}\`${r.projection.champ ? ` : id → \`${r.projection.champ}\`` : ' : ids'} (${lignes.length}). */\n`;
    if (!r.projection.champ)
      return { nom: r.projection.nom, n: lignes.length, texte: `${tete}export const ${r.projection.nom}: readonly string[] = [\n${lignes.map(([id]) => `  ${lit(id)},\n`).join('')}];\n` };
    const valeurs = [...new Set(lignes.map(([, v]) => v))].sort().map(lit).join(' | ');
    return { nom: r.projection.nom, n: lignes.length, texte: `${tete}export const ${r.projection.nom}: Readonly<Record<string, ${valeurs}>> = {\n${lignes.map(([id, v]) => `  ${lit(id)}: ${lit(v)},\n`).join('')}};\n` };
  });
  const body =
    `// GÉNÉRÉ par scripts/gen-registry.mjs — NE PAS ÉDITER À LA MAIN.\n` +
    `// Régénérer : \`npm run gen\` (option \`projection\` des REGISTRIES).\n\n` +
    blocs.map((b) => b.texte).join('\n');
  const changed = !ecrireOuVerifier({ out: body, path: out, check, ...MESSAGES_DE(out) });
  return { out, blocs: blocs.map((b) => `${b.nom}=${b.n}`), changed };
}

/**
 * PHASE 2 : l'INDEX DES IDS, par `scripts/gen-espaces.mts` sous `tsx` (il parse les documents par
 * leurs schémas TypeScript), dans un processus enfant. Hors `--check`, lève si l'enfant échoue ; en
 * `--check`, son code de sortie (bit « corps périmé » compris) rejoint celui de ce processus.
 */
function genEspaces(verbose, check) {
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/gen-espaces.mts', ...(verbose ? [] : ['--silencieux']), ...(check ? ['--check'] : [])], {
    stdio: 'inherit',
    cwd: fileURLToPath(new URL('..', import.meta.url)),
  });
  if (r.status === 0) return;
  if (check && r.status !== null) {
    process.exitCode = (Number(process.exitCode) || 0) | r.status;
    return;
  }
  throw new Error(`gen-registry: phase 2 (scripts/gen-espaces.mts) en échec (exit ${r.status ?? r.signal}).`);
}

/**
 * Régénère TOUS les registres (phase 1), les projections d'art (`genArt`), puis l'INDEX DES IDS
 * (phase 2). `verbose` (défaut `false`) : en mode silencieux (appel `buildStart` du plugin Vite, donc
 * CHAQUE run Vitest via `globalSetup`), n'imprime QUE les registres réellement RÉGÉNÉRÉS ou en erreur
 * (dossier absent), + UNE ligne agrégée pour le reste — évite les ~15 lignes « [inchangé] » qui
 * polluent chaque sortie de test et cassent le parseur pass/fail de l'outil `rtk`. En mode verbose
 * (exécution directe `npm run gen`), détail complet (usage : audit manuel de ce que le générateur a vu).
 */
export function genAll(verbose = false, { check = false } = {}) {
  // En `--check`, une validation qui LÈVE est un rouge (bit 1) parmi les autres : levée hors du
  // processus, elle sortirait en 1 et effacerait le bit « corps périmé » d'un registre déjà jugé.
  const jouer = (fn) => {
    if (!check) return fn();
    try {
      return fn();
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exitCode = (Number(process.exitCode) || 0) | 1;
      return null;
    }
  };
  const libelle = (nom, detail, changed) =>
    check
      ? `gen-registry --check: ${nom} ${changed ? 'PÉRIMÉ' : 'à jour'} (${detail})`
      : `gen-registry: ${nom} ← ${detail}${changed ? '' : ' [inchangé]'}`;
  const results = REGISTRIES.map((r) => jouer(() => genOne(r, check))).filter(Boolean);
  let unchangedCount = 0;
  for (const res of results) {
    if (res.missing) {
      console.log(`gen-registry: ${res.arrayName} ← dossier absent (${res.dir}) — ignoré`);
      continue;
    }
    if (res.changed || verbose) {
      console.log(libelle(res.arrayName, `${res.files} fichiers, ${res.dir}`, res.changed));
    } else {
      unchangedCount++;
    }
  }
  const artRes = jouer(() => genArt(check));
  if (artRes && (artRes.changed || verbose)) {
    console.log(libelle("projections d'art", `${artRes.blocs.join(', ')}, ${artRes.out}`, artRes.changed));
  } else if (artRes) {
    unchangedCount++;
  }
  if (!verbose && unchangedCount > 0) {
    console.log(`gen-registry: ${unchangedCount} registre${unchangedCount > 1 ? 's' : ''} à jour`);
  }
  genEspaces(verbose, check);
}

// Exécution directe (node scripts/gen-registry.mjs) : détail complet (audit manuel). Point d'entrée
// seulement — l'importer (`vite.config.ts`, gardes, `scripts/gen-espaces.mts`) n'exécute rien.
if (import.meta.main) {
  genAll(true, { check: process.argv.includes('--check') });
}
