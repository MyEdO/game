/**
 * `importDir` : chemin (relatif au fichier `out`) d'où importer chaque entrée. Défaut `./defs`
 * (les entrées vivent dans un sous-dossier `defs/`). Mettre `.` quand les fichiers sont à plat
 * dans le même dossier que l'index (cas des scénarios).
 * `idUnion` (option PAR registre) : émet AUSSI une union de littéraux `export type <typeName> =`
 * extraite des champs `<field>` littéraux des defs (`champsLitteraux`) — typage RÉEL des ids côté
 * consommateurs TS. Avec `idUnion.out`, l'union s'écrit dans ce module à part (chemin depuis la racine),
 * et le registre des définitions ne la porte plus : un consommateur lit les ids sans importer les defs.
 * `fields` (option PAR registre) : quand un module de def exporte PLUSIEURS noms (pas 1 seul via
 * `exportName`), liste ces noms → chaque entrée du tableau généré devient `{ champ1, champ2, … }`
 * (ex. `src/data/schemas/defs/` : `file` + `schema`).
 * `constFields` (option PAR registre, avec `fields`) : champs de VALEUR LITTÉRALE ajoutés à chaque
 * entrée générée — ce que le def ne déclare pas parce que c'est une propriété du REGISTRE (la
 * racine `root` d'un dataset : le def dit son fichier, le registre dit d'où il vient).
 * @type {{ dir:string, out:string, exportName?:string, arrayName:string, type:string, typeFrom:string, importDir?:string, idUnion?:{ typeName:string, field:string, out?:string }, fields?:string[], constFields?:Record<string,string> }[]}
 */
export const REGISTRIES = [
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
    // + union `IconIdGenerated` des ids déclarés, à part dans `src/data/` → `IconId` (types.ts) est un VRAI type fermé.
    dir: 'src/ui/icons/defs',
    out: 'src/ui/icons/_registry.generated.ts',
    exportName: 'icons',
    arrayName: 'ICON_FAMILIES',
    type: 'IconFamily',
    typeFrom: './types',
    idUnion: { typeName: 'IconIdGenerated', field: 'id', out: 'src/data/icones.generated.ts' },
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

/** Les sorties de la PHASE 2 (`scripts/gen-espaces.mts`, qui les lit ici). */
export const SORTIES_DES_ESPACES = {
  ids: 'src/data/schemas/_ids.generated.ts',
  cles: 'src/data/schemas/_cles-de-dataset.generated.ts',
  racines: 'src/data/schemas/_racines-vivantes.generated.ts',
};

/** Tous les fichiers que ce générateur écrit EN ENTIER, phase 2 comprise — ses cibles dans `GENERATORS` (build-all.mjs). */
export const SORTIES = [...REGISTRIES.flatMap((r) => [r.out, ...(r.idUnion?.out ? [r.idUnion.out] : [])]), ...Object.values(SORTIES_DES_ESPACES)];

export const SORTIE_FORMATS = 'src/noyau/persistance/formats.generated.ts'

/** La cible de `scripts/gen-verbes.mjs` : les paramètres des verbes de la partie, que les hôtes du noyau lisent. */
export const SORTIE_VERBES = 'src/hote/verbes.generated.ts'

/** La cible de `scripts/gen-combattants-de-l-etat.mjs` : les chemins des combattants de l'état, que `transitionDuJeu` lit. */
export const SORTIE_COMBATTANTS_DE_L_ETAT = 'src/noyau/combattantsDeLEtat.generated.ts'
