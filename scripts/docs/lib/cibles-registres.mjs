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
 * couche neutre (`oxlint.config.mjs`, `AVALS_DATA`) : la donnée juge un id d'art d'auteur sans importer
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
    // Sets d'ÉQUIPEMENT quadrupèdes (sellerie/bât/barde — art cuit depuis
    // `atelier/harnais/<id>@<espèce>-<vue>.dessin.mts` en une table keyée par vue,
    // `harnais/<id>Compile.ts`) : 1 set = 1 fichier defs/. Même patron que
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
    // Appendices (cornes/queue, art orienté) : 1 appendice = 1 fichier defs/. Source UNIQUE de
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
    // Têtes (visage + coiffure défaut par Race:Sexe, art en jetons) : 1 tête = 1 fichier defs/.
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
    // Armures (matériau × emplacement, art en jetons) : 1 matériau = 1 fichier defs/ — MÊME pattern que les tenues.
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
    // Schémas zod du contrat de donnée : 1 dataset `src/data/*.json` = 1 fichier defs/,
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

/** Les projections d'art (`genArt`). */
export const SORTIE_ART = 'src/data/schemas/_art.generated.ts';

/** Les sorties de la PHASE 2 (`scripts/gen-espaces.mts`, qui les lit ici). */
export const SORTIES_DES_ESPACES = {
  ids: 'src/data/schemas/_ids.generated.ts',
  cles: 'src/data/schemas/_cles-de-dataset.generated.ts',
  racines: 'src/data/schemas/_racines-vivantes.generated.ts',
};

/** Tous les fichiers que ce générateur écrit EN ENTIER, phase 2 comprise — ses cibles dans `GENERATORS` (build-all.mjs). */
export const SORTIES = [...REGISTRIES.map((r) => r.out), SORTIE_ART, ...Object.values(SORTIES_DES_ESPACES)];

export const SORTIE_FORMATS = 'src/state/formats.generated.ts'
