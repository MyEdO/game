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
 * `json` (option PAR registre) : les entrées sont les fichiers `.json` de tout l'arbre de `dir`, pas des modules de
 * def ; le registre est l'objet `{ <chemin relatif à dir>: <document> }`, sans `type` ni `typeFrom`.
 * `vocabulaire` (option PAR registre, #2968 P-art) : la table `id → libellé` de ses defs, lue aux champs
 * littéraux `id` et `libelle` (`vocabulaireDuRegistre`, `scripts/gen-registry.mjs`), s'écrit sous `nom` dans
 * `SORTIE_VOCABULAIRES_D_ART` : un VOCABULAIRE (`src/data/schemas/grammaire/vocabulaires.ts`), donc l'espace
 * `vocabulaire:<nom>` de l'index des ids, que `TYPES` (`src/data/schemas/grammaire/ref.ts`) peut déclarer.
 * @type {{ dir:string, out:string, exportName?:string, arrayName:string, type?:string, typeFrom?:string, importDir?:string, idUnion?:{ typeName:string, field:string, out?:string }, vocabulaire?:{ nom:string, id:string, libelle:string }, fields?:string[], constFields?:Record<string,string>, json?:true }[]}
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
    dir: 'src/data/icons/defs',
    out: 'src/data/icons/_registry.generated.ts',
    exportName: 'icons',
    arrayName: 'ICON_FAMILIES',
    type: 'IconFamily',
    typeFrom: './types',
    idUnion: { typeName: 'IconIdGenerated', field: 'id', out: 'src/data/icones.generated.ts' },
  },
  {
    // Fonds d'ambiance (dessin SVG que chaque hôte trace à ses couleurs) : 1 illustration stylisée = 1 fichier defs/.
    dir: 'src/data/fonds/defs',
    out: 'src/data/fonds/_registry.generated.ts',
    exportName: 'fond',
    arrayName: 'FOND_DEFS',
    type: 'FondDef',
    typeFrom: './types',
    vocabulaire: { nom: 'fonds', id: 'id', libelle: 'label' },
  },
  {
    // Cadres de panneau (dessin SVG en neuf tranches que l'hôte trace à ses couleurs) : 1 cadre = 1 fichier defs/.
    dir: 'src/data/cadres/defs',
    out: 'src/data/cadres/_registry.generated.ts',
    exportName: 'cadre',
    arrayName: 'CADRE_DEFS',
    type: 'CadreDef',
    typeFrom: './types',
  },
  {
    // Couches de paysage (dessin SVG que l'hôte trace à ses couleurs, empilées en un paysage) : 1 famille = 1 fichier defs/.
    dir: 'src/data/paysages/defs',
    out: 'src/data/paysages/_registry.generated.ts',
    exportName: 'couches',
    arrayName: 'FAMILLES_DE_COUCHES',
    type: 'FamilleDeCouches',
    typeFrom: './types',
    idUnion: { typeName: 'IdDeCoucheGenere', field: 'id', out: 'src/data/paysages.generated.ts' },
  },
  {
    // Sons (assets CC0) : 1 son (avec variantes) = 1 fichier defs/ ; vocabulaire `sons`, que désigne un effet.
    dir: 'src/data/sons/defs',
    out: 'src/data/sons/_registry.generated.ts',
    exportName: 'sound',
    arrayName: 'SOUND_DEFS',
    type: 'SoundDef',
    typeFrom: './types',
    vocabulaire: { nom: 'sons', id: 'id', libelle: 'label' },
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
  {
    // Fiches de dossier de chapitre commitées (#2290) : 1 fiche = `docs/dossiers/<ABBR>/<NN>.json`.
    dir: 'docs/dossiers',
    out: 'src/data/_dossiers.generated.ts',
    importDir: '../../docs/dossiers',
    arrayName: 'FICHIERS_DE_DOSSIER',
    json: true,
  },
];

/** Les sorties de la PHASE 2 (`scripts/gen-espaces.mts`, qui les lit ici). */
export const SORTIES_DES_ESPACES = {
  ids: 'src/data/schemas/_ids.generated.ts',
  cles: 'src/data/schemas/_cles-de-dataset.generated.ts',
  racines: 'src/data/schemas/_racines-vivantes.generated.ts',
};

/** La sortie des VOCABULAIRES D'ART (option `vocabulaire`), écrite par la phase 1, que lisent
 *  `grammaire/vocabulaires.ts` et `grammaire/ref.ts`. */
export const SORTIE_VOCABULAIRES_D_ART = 'src/data/schemas/_vocabulaires-d-art.generated.ts';

/** Tous les fichiers que ce générateur écrit EN ENTIER, phase 2 comprise — ses cibles dans `GENERATORS` (build-all.mjs). */
export const SORTIES = [...REGISTRIES.flatMap((r) => [r.out, ...(r.idUnion?.out ? [r.idUnion.out] : [])]), SORTIE_VOCABULAIRES_D_ART, ...Object.values(SORTIES_DES_ESPACES)];

export const SORTIE_FORMATS = 'src/noyau/persistance/formats.generated.ts'

/** La cible de `scripts/gen-verbes.mjs` : les paramètres des verbes de la partie, que les hôtes du noyau lisent. */
export const SORTIE_VERBES = 'src/hote/verbes.generated.ts'

/** La seconde cible de `scripts/gen-verbes.mjs` : les noms de paramètre que les libellés `parametre.*` typent. */
export const SORTIE_NOMS_DE_PARAMETRE = 'src/i18n/nomsDeParametre.generated.ts'

/** La cible de `scripts/gen-combattants-de-l-etat.mjs` : les chemins des combattants de l'état, que `transitionDuJeu` lit. */
export const SORTIE_COMBATTANTS_DE_L_ETAT = 'src/noyau/combattantsDeLEtat.generated.ts'
