/**
 * GARDE STRUCTURELLE (#1692) — aucune VALEUR FIGÉE à l'import sur un dataset MUTABLE.
 *
 * `src/data/overrides.ts` remplace le CONTENU des datasets sans réassigner leur binding : toute
 * valeur dérivée du CONTENU et calculée au NIVEAU MODULE sert donc l'ancien monde jusqu'au
 * rechargement de la page — l'entrée éditée au Codex reste invisible, l'entrée neuve n'existe pas.
 * Deux staleness étaient prouvées en exécution (`fraicheur-datasets.test.ts`).
 *
 * Sont équivalents devant ce défaut, et tous couverts ici : l'INDEX (`new Map(traits.map(…))`,
 * `Object.fromEntries`, `.reduce` en Record), l'index rempli PAR UNE BOUCLE de niveau module, la VUE
 * dérivée (`const armes = trappings.filter(…)`, `species[0]`, `[...creatures]`), l'accès par
 * ESPACE DE NOMS (`import * as D` → `D.traits.map`) et l'accès par la CLÉ (`datasetArray('traits').map`).
 * S'y ajoutent les dérivations qui prennent le dataset EN ARGUMENT au lieu de l'appeler comme receveur
 * — les ENVELOPPES `new Set(traits)`/`new Map(traits)`/`Array.from(traits)`/`Object.keys|values|entries(traits)`,
 * où le nom est à DROITE de la parenthèse — et les méthodes à COPIE (`toSorted`, `toReversed`, `flat`…).
 * `.includes(…)` n'en est pas : elle rend un booléen, pas une structure.
 * Le nom déclaré par une déclaration fautive rejoint le vocabulaire : l'index bâti ENSUITE sur cette
 * vue est nommé lui aussi.
 *
 * S'y ajoutent les formes qui n'ont ni `const` ni méthode pour se trahir : le DÉCLARATEUR SŒUR d'une
 * flèche (`const f = () => 1, PAR_ID = new Map(traits.map(…))`), l'IIFE de module
 * (`const M = (() => …)()`), la DÉSTRUCTURATION (`const [premier] = traits`), l'`export default`,
 * l'AFFECTATION NUE (`let M; M = new Map(…)`), et l'ACCESSEUR VIVANT RE-FIGÉ — appeler au niveau module
 * un accesseur issu de `memoParVersion`/`indexParId`/`indexParChamp` (`const ENGINS = siegeEngines()`)
 * re-fige exactement ce que cet accesseur venait de dévier.
 *
 * Périmètre : tout `src/**` en `.ts(x)` NON-test. Vocabulaire IMPORTÉ du seam (`bindingsVivants`, dérivé
 * des littéraux `ARRAYS` et `OBJECTS` d'`overrides.ts`), des documents qui portent une clé de dataset
 * (`documentsDesRacinesVivantes`) et des accesseurs DÉCLARÉS sous `src/`
 * (`accesseursVivants`) — jamais une liste recopiée ici. Le SEAM exclu du balayage est DÉRIVÉ lui aussi (`fichiersDuSeam` :
 * le module NON-test qui DÉFINIT `bumperDataset`, et celui qui l'IMPORTE pour versionner ses
 * écritures) — ce sont les deux porteurs de la mécanique.
 * Est INNOCENTE toute déclaration qui passe par les primitives d'index
 * VIVANT (`indexParId`/`indexParChamp`/`memoParVersion`, `src/data/versionDataset.ts`) et toute lecture
 * située DANS un corps de fonction (flèche, `function`, accesseur `get x()`, méthode abrégée) qui
 * n'est pas appelé sur place — elle se refait à chaque appel.
 *
 * CE QUE CETTE GARDE NE VOIT PAS, mesuré par injection (chaque cas rend 0 ligne) :
 *  - CHAMP STATIQUE DE CLASSE — `export class R { static PAR_ID = new Map(traits.map((t) => [t.id, t])); }`
 *    (le corps de classe est à profondeur > 0 : aucune déclaration de niveau module n'y est vue) ;
 *  - FABRIQUE INTER-MODULE — `const PAR_ID = construire();` où `construire()` (autre fichier) lit le
 *    dataset : le détecteur ne suit aucun appel hors du fichier ;
 *  - RÉ-EXPORT RENOMMÉ — `export { traits as tousLesTraits }` dans un module tiers, puis
 *    `new Map(tousLesTraits.map(…))` chez son importateur : le vocabulaire ne suit que le seam ;
 *  - PARTITION PAR UN PRÉDICAT VIVANT — `const TENUES = TENUE_DEFS.filter((d) => !isClassDef(d.id))` :
 *    la source énumérée n'est PAS un dataset, seul le PRÉDICAT en lit un — aucun motif ne la voit,
 *    le dataset n'y est nommé nulle part ;
 *  - LECTURE PAR MEMBRE — `Object.fromEntries(dispoJson.dispoPct.map(…))` : le binding est au
 *    vocabulaire, mais chaque motif veut la méthode JUSTE après le nom ; un saut de membre
 *    (`.dispoPct`) la cache ;
 *  - ALIAS À ANNOTATION DE TYPE-OBJET — `const CARGO = seaCargoJson as unknown as { cargoes: X[]; sell: Y }`
 *    puis `CARGO.cargoes.filter(…)` : le `;` du type littéral arrête la règle d'alias, le nom n'hérite
 *    pas du dataset ;
 *  - FABRIQUE LOCALE — `function ancre(p, id) { … }` puis `export const DAWN = ancre(calendarPhases, 'aube')` :
 *    la lecture vit dans le corps d'une fonction du MÊME fichier, appelée au niveau module ; le corps
 *    est un abri, l'appel n'est pas suivi ;
 *  - FLÈCHE DANS L'ANNOTATION DE TYPE — `const C: Record<string, (id: string) => boolean> =
 *    Object.fromEntries(FLOW_STAKES.map(…))` : le `=>` du TYPE passe pour une frontière de corps, la
 *    lecture qui suit pour vivante ;
 *  - INSTRUCTION D'APPEL DE NIVEAU MODULE — `registerTableStep('x', { rows: BOARD_EVENTS.map(…) })` :
 *    ni `const`, ni affectation, ni boucle — l'instruction n'est pas balayée ;
 *  - APOSTROPHE DANS UN TEXTE JSX — `<p>l'arme</p>` ouvre une chaîne pour le balayage de profondeur,
 *    qui ne connaît pas le JSX : toute déclaration de niveau module qui SUIT est perdue.
 *
 * SONT du VOCABULAIRE (les deux formes par lesquelles le module
 * PROPRIÉTAIRE d'un dataset l'atteint sans jamais nommer le seam) : l'IMPORT JSON DIRECT
 * (`import vehiclesJson from '../data/vehicles.json'` — le document importé EST la racine vivante que
 * le seam mute, dès qu'il porte une clé de dataset : `documentsDesRacinesVivantes`, lu sur le module
 * généré `src/data/schemas/_racines-vivantes.generated.ts`) et l'ALIAS NU de niveau module
 * (`const VEHICLES_LIST = vehiclesJson as VehicleData[]`, `export const IMPERIAL_MONTHS = calendarMonths`),
 * qui hérite du dataset (#1692).
 *
 * ASYMÉTRIE DE PÉRIMÈTRE, dite : la garde d'ÉCRITURE (`seam-ecriture-guard.test.ts`) balaie AUSSI les
 * `.test.ts` (une écriture hors seam dans un test contamine les autres tests du même processus) ;
 * celle-ci s'arrête aux INSTRUMENTS Vitest, tests ET bancs (`scripts/guards/lib/fichierVitest.mjs`,
 * #1788 — un banc POSE un index figé à dessein, c'est le témoin qu'il compare au vivant). Stock
 * résiduel dans les `.test.ts`, MESURÉ (#1692) : 46 valeurs
 * figées à l'import (fixtures d'arbre livré, la plupart légitimes — `const TRAITS_LIVRES = [...traits]` de
 * `fraicheur-datasets.test.ts` EST la sauvegarde qui restaure le seam). Les migrer relève d'un tri
 * cas par cas, pas d'un motif.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bindingsVivants, clesDuSeam, indexFiges, nomsVivantsDuFichier, fichiersSources, fichiersDuSeam, accesseursVivants, sansCommentaires, RACINE } from '../../scripts/guards/lib/bindingsVivants.mjs';
import { estFichierVitest } from '../../scripts/guards/lib/fichierVitest.mjs';
import { DATASET_KEYS } from './overrides';

describe('#1692 — aucun index figé à l’import sur un dataset mutable', () => {
  const parBinding = bindingsVivants();

  it('le vocabulaire vient du seam, pas d’une liste recopiée : ses clés SONT `DATASET_KEYS`', () => {
    // Le littéral `ARRAYS` donne ce que `DATASET_KEYS` (la clé) ne donne pas : le NOM du binding que
    // les modules importent — mais les deux décrivent le MÊME ensemble, et c'est vérifié ici.
    expect(clesDuSeam().sort()).toEqual([...DATASET_KEYS].sort());
    expect(parBinding.get('traits')).toBe('traits');
    expect(parBinding.get('allAxes')).toBe('axes');
    expect(parBinding.get('MOUNT_PROFILES')).toBe('montures');
  });

  it('une entrée du seam à valeur d’APPEL est surveillée sous sa CLÉ, jamais sous sa fabrique', () => {
    // `miscastMinor: miscastEntries('miscast-mineure')` : `miscastEntries` est une fonction PRIVÉE
    // d'`overrides.ts` — la retenir comme binding posait un nom FANTÔME que personne n'importe, et
    // laissait le nom réellement exposé du dataset hors du vocabulaire des DEUX gardes.
    for (const cle of ['miscastMinor', 'miscastMajor', 'miscastWrath']) expect(parBinding.get(cle)).toBe(cle);
    expect(parBinding.has('miscastEntries'), 'la fabrique n’est pas un binding').toBe(false);
    // Les entrées à valeur de MEMBRE gardent leur objet porteur (lui, est bien importé ailleurs) —
    // et les shorthands leur propre nom.
    expect(parBinding.get('shipConstruction')).toBe('shipHullSizes');
    expect(parBinding.get('criticalsTete')).toBe('criticalsTete');

    // Un index figé sur la CLÉ d'une entrée à valeur d'appel (`miscastMinor`) ou shorthand
    // (`criticalsTete`), injecté dans une copie en mémoire, rend 1 ligne chacun.
    const fige = `import { miscastMinor } from '../data/overrides';\nconst PAR_ID = new Map(miscastMinor.map((r) => [r.id, r]));\n`;
    expect(indexFiges('copie.ts', fige, parBinding)).toHaveLength(1);
    const figeCrit = `import { criticalsTete } from '../data/overrides';\nconst PREMIER = criticalsTete[0];\n`;
    expect(indexFiges('copie.ts', figeCrit, parBinding)).toHaveLength(1);
  });

  it('le SEAM se DÉRIVE de ce que les fichiers déclarent, pas d’une liste de chemins', () => {
    // Ce qu'il PORTE le désigne : définir `bumperDataset`, ou l'importer pour versionner ses écritures.
    expect([...fichiersDuSeam()].sort()).toEqual(['src/data/overrides.ts', 'src/data/versionDataset.ts']);
  });

  it('aucun index NI aucune vue dérivée de niveau module sur un dataset du seam', () => {
    const seam = fichiersDuSeam();
    const fautifs = fichiersSources()
      .filter((f) => !estFichierVitest(f) && !seam.has(f))
      .flatMap((f) => indexFiges(f, readFileSync(join(RACINE, f), 'utf8'), parBinding));
    expect(fautifs, 'ces index servent l’ancien monde après une édition au Codex — passer par `indexParId`/`indexParChamp` (src/data/versionDataset.ts)').toEqual([]);
  });

  it('CONTRÔLE POSITIF : un `/*` cité dans un commentaire de LIGNE n’efface pas la source qui suit', () => {
    // Le commentaire de ligne gagne : sans cela, tout le code jusqu'au prochain `*/` disparaît du
    // vocabulaire — et le seam, dérivé de ce que les fichiers déclarent, cesse d'être vu.
    const src = '// a /* b\nconst x = 1; /* c */ const y = 2;';
    const net = sansCommentaires(src);
    expect(net).toContain('const x = 1;');
    expect(net).toContain('const y = 2;');
    expect(net).not.toContain('/* c */');
    expect(net).not.toContain(' b');
  });

  it('CONTRÔLE POSITIF : le même détecteur voit un index figé injecté dans une COPIE en mémoire', () => {
    const fige = `import { traits } from '../data';\nconst PAR_ID = new Map(traits.map((t) => [t.id, t]));\n`;
    expect(indexFiges('copie.ts', fige, parBinding)).toHaveLength(1);
    const vivant = `import { traits } from '../data';\nconst parId = indexParId('traits', traits);\n`;
    expect(indexFiges('copie.ts', vivant, parBinding)).toEqual([]);
    const dansUneFonction = `import { traits } from '../data';\nexport const f = () => new Map(traits.map((t) => [t.id, t]));\n`;
    expect(indexFiges('copie.ts', dansUneFonction, parBinding)).toEqual([]);
    const homonymeNonImporte = `const traits = [];\nconst PAR_ID = new Map(traits.map((t) => [t.id, t]));\n`;
    expect(indexFiges('copie.ts', homonymeNonImporte, parBinding)).toEqual([]);
  });

  it('CONTRÔLE POSITIF : chaque MOTIF élargi est vu — vue dérivée, reduce en Record, boucle, espace de noms, clé', () => {
    const vueDerivee = `import { trappings } from '../data';\nconst armes = trappings.filter((t) => t.categorie === 'melee');\n`;
    expect(indexFiges('copie.ts', vueDerivee, parBinding)).toHaveLength(1);
    // Une vue figée CONTAMINE : l'index bâti dessus est nommé lui aussi (2 lignes rendues).
    const vuePuisIndex = `${vueDerivee}const PAR_ID = new Map(armes.map((t) => [t.id, t]));\n`;
    expect(indexFiges('copie.ts', vuePuisIndex, parBinding)).toHaveLength(2);
    const reduceEnRecord = `import { traits } from '../data';\nconst PAR_ID = traits.reduce((m, t) => ({ ...m, [t.id]: t }), {});\n`;
    expect(indexFiges('copie.ts', reduceEnRecord, parBinding)).toHaveLength(1);
    const parBoucle = `import { traits } from '../data';\nconst PAR_ID = new Map();\nfor (const t of traits) PAR_ID.set(t.id, t);\n`;
    expect(indexFiges('copie.ts', parBoucle, parBinding)).toHaveLength(1);
    const parIndexation = `import { species } from '../data';\nconst PREMIERE = species[0];\n`;
    expect(indexFiges('copie.ts', parIndexation, parBinding)).toHaveLength(1);
    const parEtalement = `import { creatures } from '../data';\nconst TOUTES = [...creatures];\n`;
    expect(indexFiges('copie.ts', parEtalement, parBinding)).toHaveLength(1);
    const parEspaceDeNoms = `import * as D from '../data';\nconst PAR_ID = new Map(D.traits.map((t) => [t.id, t]));\n`;
    expect(indexFiges('copie.ts', parEspaceDeNoms, parBinding)).toHaveLength(1);
    const parLaCle = `import { datasetArray } from '../data/overrides';\nconst IDS = new Set(datasetArray('traits').map((t) => t.id));\n`;
    expect(indexFiges('copie.ts', parLaCle, parBinding)).toHaveLength(1);
  });

  it('CONTRÔLE POSITIF : les dérivations qui prennent le dataset EN ARGUMENT (enveloppes) et les méthodes à COPIE', () => {
    // `new Set(traits)` fige le contenu autant que `new Map(traits.map(…))`, mais le nom y est à DROITE
    // de la parenthèse : aucun motif de receveur ne le voyait.
    for (const cas of [
      `import { traits } from '../data';\nconst IDS = new Set(traits);\n`,
      `import { traits } from '../data';\nconst T = Array.from(traits);\n`,
      `import { traits } from '../data';\nconst K = Object.keys(traits);\n`,
      `import { traits } from '../data';\nconst V = Object.values(traits);\n`,
      `import { traits } from '../data';\nconst E = Object.entries(traits);\n`,
      // Méthodes à COPIE (ES2023) : elles rendent une STRUCTURE dérivée, comme `.concat([])` (témoin déjà vu).
      `import { traits } from '../data';\nconst T = traits.toSorted((a, b) => a.id.localeCompare(b.id));\n`,
      `import { traits } from '../data';\nconst T = traits.flat();\n`,
      `import { traits } from '../data';\nconst T = traits.concat([]);\n`,
      // L'enveloppe voit aussi le MEMBRE d'un espace de noms et l'accès par la CLÉ.
      `import * as D from '../data';\nconst T = Array.from(D.traits);\n`,
      `import { datasetArray } from '../data/overrides';\nconst IDS = new Set(datasetArray('traits'));\n`,
    ]) expect(indexFiges('copie.ts', cas, parBinding), cas).toHaveLength(1);
    // `.includes(…)` rend un BOOLÉEN, pas une structure : rien n'est figé. Et une enveloppe dans un
    // corps de fonction se refait à chaque appel.
    expect(indexFiges('copie.ts', `import { traits } from '../data';\nconst B = traits.includes('x');\n`, parBinding)).toEqual([]);
    expect(indexFiges('copie.ts', `import { traits } from '../data';\nexport const f = () => new Set(traits);\n`, parBinding)).toEqual([]);
  });

  it('CONTRÔLE POSITIF : un ALIAS coupé en PLUSIEURS LIGNES est le même alias — la règle porte sur la déclaration, blancs repliés', () => {
    // La borne « une ligne, 200 caractères » laissait passer un alias mis en forme par le formateur :
    // l'héritage du dataset cessait, et l'index bâti dessus redevenait invisible.
    const multiligne = `import vehiclesJson from '../data/vehicles.json';\nconst LISTE:\n  VehicleData[] = vehiclesJson as VehicleData[];\nconst PAR_ID = new Map(LISTE.map((v) => [v.id, v]));\n`;
    expect(nomsVivantsDuFichier('src/engine/copie.ts', multiligne, parBinding).get('LISTE'), 'l’alias multi-ligne hérite du dataset').toBe('vehicles.json');
    expect(indexFiges('src/engine/copie.ts', multiligne, parBinding)).toHaveLength(1);
  });

  it('CONTRÔLE POSITIF : les formes SANS méthode ni `const` porteur — sœur, IIFE, déstructuration, `export default`, affectation nue', () => {
    const soeurDUneFleche = `import { traits } from '../data';\nconst f = () => 1, PAR_ID = new Map(traits.map((t) => [t.id, t]));\n`;
    expect(indexFiges('copie.ts', soeurDUneFleche, parBinding)).toHaveLength(1);
    const iife = `import { traits } from '../data';\nconst PAR_ID = (() => new Map(traits.map((t) => [t.id, t])))();\n`;
    expect(indexFiges('copie.ts', iife, parBinding)).toHaveLength(1);
    const iifeFunction = `import { traits } from '../data';\nconst V = (function () { return traits.filter((t) => t.id); })();\n`;
    expect(indexFiges('copie.ts', iifeFunction, parBinding)).toHaveLength(1);
    const destructuration = `import { traits } from '../data';\nconst [PREMIER] = traits;\n`;
    expect(indexFiges('copie.ts', destructuration, parBinding)).toHaveLength(1);
    const destructurationObjet = `import { creatures } from '../data';\nconst { length } = creatures;\n`;
    expect(indexFiges('copie.ts', destructurationObjet, parBinding)).toHaveLength(1);
    const exportDefault = `import { traits } from '../data';\nexport default new Map(traits.map((t) => [t.id, t]));\n`;
    expect(indexFiges('copie.ts', exportDefault, parBinding)).toHaveLength(1);
    const affectationNue = `import { traits } from '../data';\nlet M;\nM = new Map(traits.map((t) => [t.id, t]));\n`;
    expect(indexFiges('copie.ts', affectationNue, parBinding)).toHaveLength(1);
  });

  it('CONTRÔLE POSITIF : l’ACCESSEUR VIVANT appelé au niveau module est re-figé — la classe née de #1692', () => {
    // `siegeEngines`/`oupsTable` sont des accesseurs RÉELS du dépôt (`memoParVersion`) : le
    // vocabulaire les connaît parce qu'il les LIT sous `src/`, pas parce qu'ils sont nommés ici.
    expect([...accesseursVivants()]).toContain('siegeEngines');
    const vueRefigee = `import { siegeEngines } from '../data';\nconst ENGINS = siegeEngines().filter((t) => t.siegeRig);\n`;
    expect(indexFiges('copie.ts', vueRefigee, parBinding)).toHaveLength(1);
    const indexRefige = `import { oupsTable } from '../data/oups';\nconst PAR_ID = new Map(oupsTable().map((o) => [o.id, o]));\n`;
    expect(indexFiges('copie.ts', indexRefige, parBinding)).toHaveLength(1);
    const captureNue = `import { siegeEngines } from '../data';\nconst ENGINS = siegeEngines();\n`;
    expect(indexFiges('copie.ts', captureNue, parBinding)).toHaveLength(1);
    const dansUnCorps = `import { siegeEngines } from '../data';\nexport const f = () => siegeEngines().filter((t) => t.siegeRig);\n`;
    expect(indexFiges('copie.ts', dansUnCorps, parBinding)).toEqual([]);
  });

  it('CE QUE LA GARDE NE VOIT PAS est MESURÉ, pas supposé (cf. en-tête)', () => {
    const champStatique = `import { traits } from '../data';\nexport class R { static PAR_ID = new Map(traits.map((t) => [t.id, t])); }\n`;
    const fabriqueInterModule = `import { construire } from './autre';\nconst PAR_ID = construire();\n`;
    const reexportRenomme = `import { tousLesTraits } from './reexport';\nconst PAR_ID = new Map(tousLesTraits.map((t) => [t.id, t]));\n`;
    const partitionParPredicat = `import { TENUE_DEFS } from './tenues.generated';\nimport { isClassDef } from '../data/careers';\nexport const TENUES = TENUE_DEFS.filter((d) => !isClassDef(d.id));\n`;
    const lectureParMembre = `import { disponibilite as dispoJson } from '../data/index';\nexport const P = Object.fromEntries(dispoJson.dispoPct.map((e) => [e.a, e.p]));\n`;
    const aliasTypeObjet = `import seaCargoJson from '../data/sea-cargo.json';\nconst CARGO = seaCargoJson as unknown as { cargoes: X[]; sell: Y };\nconst V = CARGO.cargoes.filter((c) => c);\n`;
    const fabriqueLocale = `import { calendarPhases } from '../data';\nfunction ancre(p, id) { return p.find((x) => x.id === id).start; }\nexport const DAWN = ancre(calendarPhases, 'aube');\n`;
    const flecheDansLeType = `import { FLOW_STAKES } from '../data';\nconst C: Record<string, (id: string) => boolean> = Object.fromEntries(FLOW_STAKES.map((e) => [e.k, () => true]));\n`;
    const appelDeModule = `import { BOARD_EVENTS } from '../engine/seaVoyage';\nregisterTableStep('x', { rows: BOARD_EVENTS.map((e) => e.id) });\n`;
    const apostropheJsx = `import { traits } from '../data';\nexport const V = () => <p>l'arme</p>;\nconst PAR_ID = new Map(traits.map((t) => [t.id, t]));\n`;
    for (const cas of [champStatique, fabriqueInterModule, reexportRenomme, partitionParPredicat, lectureParMembre, aliasTypeObjet, fabriqueLocale, flecheDansLeType, appelDeModule]) {
      expect(indexFiges('src/engine/copie.ts', cas, parBinding), 'angle mort couvert : l’en-tête de ce fichier ne dit plus vrai').toEqual([]);
    }
    expect(indexFiges('src/ui/copie.tsx', apostropheJsx, parBinding), 'angle mort couvert : l’en-tête de ce fichier ne dit plus vrai').toEqual([]);
  });

  it('CONTRÔLE POSITIF : l’IMPORT JSON DIRECT et son ALIAS NU sont du vocabulaire — mesuré sur un fichier RÉEL', () => {
    // Le module PROPRIÉTAIRE d'un dataset ne nomme jamais le seam : il importe SON document et l'aliase.
    // Le document porte une clé de dataset, l'alias hérite — sans quoi trois staleness (`vehicles`,
    // `traumas`, `books`) restaient invisibles alors que le seam splice ces tableaux-là.
    const reel = readFileSync(join(RACINE, 'src/engine/travel.ts'), 'utf8');
    const noms = nomsVivantsDuFichier('src/engine/travel.ts', reel, parBinding);
    expect(noms.get('vehiclesJson')).toBe('vehicles.json');
    expect(noms.get('VEHICLES_LIST'), 'l’alias nu hérite du dataset').toBe('vehicles.json');
    // Le fichier RÉEL est propre ; la même vue réinjectée dans une COPIE est vue.
    expect(indexFiges('src/engine/travel.ts', reel, parBinding)).toEqual([]);
    const injecte = `${reel}\nconst PAYANTS = VEHICLES_LIST.filter((v) => v.travel);\n`;
    expect(indexFiges('src/engine/copie.ts', injecte, parBinding)).toHaveLength(1);
    const alias = `import vehiclesJson from '../data/vehicles.json';\nconst LISTE = vehiclesJson as VehicleData[];\nconst PAR_ID = new Map(LISTE.map((v) => [v.id, v]));\n`;
    expect(indexFiges('src/engine/copie.ts', alias, parBinding)).toHaveLength(1);
    // CLÉ ≠ NOM DE FICHIER : `miscast.json` porte `miscastMinor`/`miscastMajor`/`miscastWrath`.
    const documentNiche = `import miscastJson from '../data/miscast.json';\nconst TABLES = miscastJson as MiscastTableDef[];\nconst PAR_ID = new Map(TABLES.map((t) => [t.id, t]));\n`;
    expect(indexFiges('src/engine/copie.ts', documentNiche, parBinding)).toHaveLength(1);
    // Un JSON sans clé de dataset (`actions.json`), ou le même nom de fichier ailleurs que sous
    // `src/data`, n'entre pas au vocabulaire.
    expect(nomsVivantsDuFichier('src/engine/copie.ts', `import x from '../data/actions.json';\n`, parBinding).size).toBe(0);
    expect(nomsVivantsDuFichier('src/engine/copie.ts', `import x from './vehicles.json';\n`, parBinding).size).toBe(0);
  });

  it('CONTRÔLE NÉGATIF : une lecture dans un CORPS (flèche, `function`, accesseur, méthode) est innocente', () => {
    const accesseur = `import { creatures } from '../data';\nexport const s = { get n(): number { return creatures.length; } };\n`;
    expect(indexFiges('copie.ts', accesseur, parBinding)).toEqual([]);
    const methodeAbregee = `import { gods } from '../data';\nexport const S = { pool(): string[] { return gods.map((g) => g.id); } };\n`;
    expect(indexFiges('copie.ts', methodeAbregee, parBinding)).toEqual([]);
    const declaration = `import { gods } from '../data';\nexport function pool(): string[] { return gods.map((g) => g.id); }\n`;
    expect(indexFiges('copie.ts', declaration, parBinding)).toEqual([]);
    const bouclePropre = `import { traits } from '../data';\nexport const f = () => { for (const t of traits) g(t); };\n`;
    expect(indexFiges('copie.ts', bouclePropre, parBinding)).toEqual([]);
  });
});
