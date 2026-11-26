// CORPUS DES COMPTES (#2705, #3021) : ce que mesurent les volets de `SOUS_LA_PORTE` (`occurrencesStock.mjs`) sur une
// racine, et la PORTE DE PLAGE qui refuse qu'un compte monte, qu'un site naisse ou qu'un plancher cède entre la base
// d'une plage et sa tête. Chaque volet se mesure sur le CODE de l'image, jamais sur sa donnée (#2995).
//
// DÉTECTEURS CONSTANTS : la base et la tête se MESURENT par le même code, posé dans chaque image — deux fois,
// par le détecteur de la tête (`scripts/` de son image git) et par celui de la base (`scripts/` de son image git).
// Le CLASSEMENT que la mesure exécute sous `src/` — registres, fabriques, classifieurs, parcours — est du code du
// détecteur : chaque module qui porte la MARQUE (`MARQUE_DE_CLASSEMENT`) voyage avec lui (#2969), comme les modules
// `.mjs` de `src/lib/` que `scripts/` importe (`LIB_DU_DETECTEUR`, #3117). La constance
// couvre la MESURE ; les GÉNÉRATEURS et les DÉCLARATIONS appartiennent à l'image, celles que `scripts/` porte comprises
// (`DECLARATIONS_DE_L_IMAGE`, posées par-dessus le détecteur). L'image est celle de SON commit :
// `src/` — donnée, defs, vocabulaire `TYPES`, `OP_DEFS`, table des poses — et ses cibles de code, produites par son
// propre `genererCode` (scripts/docs/build-all.mjs), une fois par commit, avant la pose du détecteur. Une mesure impossible sous ces
// cibles se rejoue sous celles des générateurs du DÉTECTEUR (`comptesDuCommit`) : une borne se mesure si UNE des deux
// configurations aboutit, sinon sa paire est sautée et nommée avec les deux raisons ; une paire sautée refuse.
// Ce qui monte, naît ou cède sous l'un ou l'autre détecteur est le SCHÉMA (un `idDe` relâché se voit, `FEUILLES_D_ID`)
// et refuse la plage. Aucune ligne de message n'admet une hausse ni un plancher qui cède ; une baisse du DÉTECTEUR, plancher
// compris, se justifie par `FAUX-POSITIF:` (`baissesDuDetecteur`).
// MODULES GÉNÉRÉS : sous les cibles de l'image, chaque module généré que le détecteur importe (`MODULES_GENERES_LUS`)
// à un chemin que l'image ne déclare pas et ne porte pas y est un RENVOI vers le module au chemin que déclare l'image
// (`CIBLES_DECLAREES` de son commit, `poserLesRenvois`) ; un module déplacé dans la plage se lit aux deux bornes (#5083).
// DÉPLACEMENTS : une image mesurée sous le détecteur de l'AUTRE borne porte, à chaque chemin que la plage renomme
// (`ceQuiChange(…).renommages`) et qu'elle n'a pas, un LIEN vers son fichier (`poserLesLiens`), retiré après la mesure :
// le détecteur lit et génère aux chemins de son commit (#5069). Un fichier déplacé et réécrit au-delà de la similarité
// de `-M` n'est pas un renommage.
// ANGLES MORTS : une forme générée que `src/` ET le détecteur lisent, changée des deux côtés de la plage, peut empêcher
// une mesure. Au MÊME site, une hausse compensée par une baisse ne change pas le compte (#1711). Une
// DÉCLARATION (`DECLARATIONS_DE_L_IMAGE`) qui tait une famille, `sansFolio` posé sur une liste existante, en retire la
// dette comme une baisse de DONNÉE, sans `FAUX-POSITIF:`.
// L’ordinal d’un compte n’est pas l’adresse d’une valeur. Un chemin RENOMMÉ dans la plage même où sa référence se
// relâche passe le plancher `FEUILLES_D_ID` : le chemin de la base n’existe plus à la tête, celui de la tête y naît. Le
// renommage peut être INDIRECT : une route plus courte vers un nœud partagé change son plus court chemin
// (`cheminsDeSchema`) et renomme tous ses sous-chemins.
// Un chemin RETIRÉ dans une plage puis réintroduit en chaîne nue dans une autre passe aussi : aucune des deux plages ne
// voit un chemin `idDe` présent à ses deux bornes.
// La preuve d’un FAUX-POSITIF est du texte, sans vérification de sa vérité ; `SOUS_LA_PORTE`, ses identités et
// la politique du juge courant restent des entrées de confiance.
// Un algorithme de classement de `src/` sans la MARQUE suit l’image, et un détecteur antérieur à la marque d’un module
// mesure par celui de l’image : leur changement peut masquer une baisse sous les deux détecteurs. Un export d’un module
// de classement que l’image importe et que l’autre détecteur ne porte pas empêche une mesure.
// La table des poses (`grammaire/interne/poses.ts`) se lit dans l’image : la changer re-classe les formes de
// l’inventaire sous les deux détecteurs, hors porte. Une composition ajoutée dans un second def, sans donnée, fait
// sortir un nœud G1 sous les deux détecteurs ; c’est une forme partagée réelle, pas un re-classement (#3012).
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { lierDependances } from '../../migrations/replay-head.mjs';
import { LUS_PAR_LES_GENERATEURS } from '../../docs/build-all.mjs';
import { scannerRedeclarations } from '../../docs/lib/structures-scan.mjs';
import { OP_DEFS, OPS_NON_TYPEES } from '../../../src/data/schemas/grammaire/mecanique';
import { enfantsDe, ouverts } from '../../../src/data/schemas/grammaire/descente';
import { estFeuilleDId } from '../../../src/data/schemas/grammaire/ref';
import { ENV_EPOQUE, ENV_TENU, gitDirContenant } from '../../docs/lib/ecrivain-derives.mjs';
import {
  GitIndisponible, INDEX, TRONC, baseCommune, ceQuiChange, fusionnesEnCours, journalDe, lireEnLot, listerImage, refusDeGit, shaDe,
  type Depot,
} from './gitPorte.mjs';
import {
  DETTE_OPS, FEUILLES_D_ID, MOTIF_NON_TYPEE, SOUS_LA_PORTE, STRUCTURES_LOCALES, STRUCTURES_REDECLARATIONS, motifAPlat,
  type EntreeDeCompte, type SiteDeDetteDOp,
} from './occurrencesStock.mjs';
import { ecartsDeStock, remedeDeNaissance, sitesEnEntrees } from './stock.mjs';
import { scanAll, SOURCE_FORMAT } from '../../raw/check-source-format.mjs';
import { EXTENSIONS_DE_SCRIPT } from './dialecte.mjs';
import { cheminsDeDocument, sitesDeStructure } from './structuresLocales.mts';

/** Les clés de PREMIER niveau du payload de chaque op de `opDefs` dont le schéma, ouvert de ses enveloppes
 *  (`ouverts`), est une feuille `idDe` (`estFeuilleDId`) : la référence À PLAT (`DETTE_OPS`). */
export function refsAPlat(opDefs: Readonly<Record<string, unknown>>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(opDefs).map(([op, schema]) => [op, [...new Set(ouverts([schema]).flatMap((n) =>
    enfantsDe(n).flatMap((e) => (e.cle !== undefined && ouverts([e.noeud]).some(estFeuilleDId) ? [e.cle] : []))))].sort()]));
}

/** Les sites de `DETTE_OPS` : chaque op de `nonTypees`, puis chaque couple (op, clé) de `refsAPlat(opDefs)`. PURE. */
export const sitesDeDetteDOps = (nonTypees: Iterable<string>, opDefs: Readonly<Record<string, unknown>>): SiteDeDetteDOp[] => [
  ...[...nonTypees].map((op) => ({ op, motif: MOTIF_NON_TYPEE })),
  ...Object.entries(refsAPlat(opDefs)).flatMap(([op, cles]) => cles.map((cle) => ({ op, motif: motifAPlat(cle) }))),
];

/** Les entrées mesurées de chaque collection sous la porte, par nom. */
export type Comptes = ReadonlyMap<string, readonly EntreeDeCompte[]>;

/** Une liste de sites comme entrées de compte. */
const enEntrees = (sites: readonly object[]): EntreeDeCompte[] => sites as unknown as EntreeDeCompte[];

/** Les comptes de la racine `root` (le répertoire courant pour `Source/`) mesurés sur le code de l'image. */
const comptesDeLaRacine = (root: string): Comptes =>
  new Map([
    [STRUCTURES_REDECLARATIONS.nom, STRUCTURES_REDECLARATIONS.mesure(scannerRedeclarations(root).redeclarations)],
    [DETTE_OPS.nom, enEntrees(sitesDeDetteDOps(OPS_NON_TYPEES, OP_DEFS))],
    [FEUILLES_D_ID.nom, enEntrees(sitesEnEntrees(cheminsDeDocument()))],
    [STRUCTURES_LOCALES.nom, enEntrees(sitesEnEntrees(sitesDeStructure()))],
    [SOURCE_FORMAT.nom, enEntrees(sitesEnEntrees(scanAll()))],
  ]);

/**
 * Le REFUS de la plage `base` → `tete`, une ligne par site, sur chaque volet de `SOUS_LA_PORTE` (`occurrencesStock.mjs`) :
 * le juge propre d'un PLANCHER (`plancher.cede`), sinon un site NEUF ou un site dont le compte MONTE (`ecartsDeStock`, la tête
 * comme observé, la base comme stock). Un site né que le volet apparie à un disparu (`renommages`) n'est pas neuf. PURE.
 */
export function refusDesComptes(base: Comptes, tete: Comptes): string[] {
  return SOUS_LA_PORTE.flatMap((c) => {
    const [avant, apres] = [base.get(c.nom) ?? [], tete.get(c.nom) ?? []];
    if (c.plancher) return c.plancher.cede(avant, apres).map((l) => `${c.nom} : ${l}`);
    const renommes = c.renommages?.(avant, apres) ?? new Set<string>();
    const { neuves, accrues } = ecartsDeStock({
      observe: apres.filter((e) => !renommes.has(c.site(e))),
      stock: avant,
      cle: c.site,
      nombre: c.nombre,
      cible: c.cible,
      remede: { neuve: remedeDeNaissance(c.cible) },
    });
    return [...neuves, ...accrues].map((l) => `${c.nom} : ${l}`);
  });
}

/** La racine de l’outillage qui lance les mesures. */
const RACINE = fileURLToPath(new URL('../../..', import.meta.url));
/** Ce que le détecteur apporte à une image : son code et sa configuration de modules. */
const DU_DETECTEUR = ['scripts', 'package.json', 'tsconfig.json'];
/** La première ligne d'un module de CLASSEMENT de `src/` (#2969) : le détecteur qui le porte le pose dans l'image. */
const MARQUE_DE_CLASSEMENT = '// CLASSEMENT DU DÉTECTEUR';
/** Le dossier des modules de classement. */
const RACINE_DU_CLASSEMENT = 'src/data/schemas/grammaire';
/** Le texte d'un module est-il du classement ? */
const estDuClassement = (_rel: string, texte: string): boolean => texte.startsWith(MARQUE_DE_CLASSEMENT);
/** Les modules PURS de `src/lib/` en `.mjs`, que `scripts/` importe sans TypeScript (`src/lib/ordre.mjs`, en-tête) : du code du
 *  détecteur, qui voyage avec lui comme son classement. */
const LIB_DU_DETECTEUR = 'src/lib';
/** Le fichier est-il un module JavaScript de `LIB_DU_DETECTEUR` ? */
const estModulePartage = (rel: string): boolean => rel.endsWith('.mjs');
/** Ce que l'image apporte : `src/` (donnée ET schémas), `Source/` (les chapitres que mesure `SOURCE_FORMAT`) et ce que ses
 *  générateurs lisent hors de `src/` (`LUS_PAR_LES_GENERATEURS`). */
const DE_L_IMAGE = ['src', 'Source', ...LUS_PAR_LES_GENERATEURS];
/** Les DÉCLARATIONS de la donnée de l'image que `scripts/` porte : la liste de découpe d'un livre (son grain, `sansFolio`)
 *  dit ce que SES chapitres de `Source/` impriment (#3884). Elles se posent de l'image PAR-DESSUS le détecteur. */
const DECLARATIONS_DE_L_IMAGE = ['scripts/raw/decoupes'];
/** La déclaration des chemins des modules générés (#5083) : celle de l'image se pose sous `COPIE_DES_CIBLES`, à côté de
 *  celle du détecteur. */
const CIBLES_DECLAREES = 'scripts/docs/lib/cibles-registres.mjs';
const COPIE_DES_CIBLES = '.cibles-de-l-image';
/** Les fichiers TEXTE que la mesure lit ; un fichier binaire ne se pose pas. */
const EXTENSIONS_DE_TEXTE = [...EXTENSIONS_DE_SCRIPT, '.md', '.json', '.css', '.snap'];
/** Le point d'entrée de la mesure, dans le code d'un détecteur. */
const POINT_D_ENTREE = 'scripts/guards/lib/corpusDesComptes.mts';

/** La mesure d'une image n'a pas abouti : la porte ne juge pas ce qu'elle n'a pas mesuré. */
class MesureImpossible extends Error {}

/** Le dossier d'une image est DANS un dépôt git : ses cibles de code y verraient l'écrivain de ce dépôt (`gitDirContenant`). */
class ImageDansUnDepot extends Error {}

/** Les fichiers texte de `dossiers` dans l'image `arbre` que `retenir` garde (chemin, texte), écrits sous `dossier`. */
function ecrireDeLImage(depot: Depot, arbre: string, dossier: string, dossiers: readonly string[], retenir = (_rel: string, _texte: string): boolean => true): void {
  ecrireLesFichiers(dossier, fichiersDeLImage(depot, arbre, dossiers, retenir));
}

/** Les chemins et textes effectivement posés, dans l'ordre de l'image git. */
function fichiersDeLImage(depot: Depot, arbre: string, dossiers: readonly string[], retenir: (rel: string, texte: string) => boolean): [string, string][] {
  const chemins = listerImage(depot, arbre, ...dossiers).filter((c) => EXTENSIONS_DE_TEXTE.some((ext) => c.endsWith(ext)));
  return [...lireEnLot(depot, arbre, chemins)].flatMap(([rel, texte]) =>
    texte !== null && retenir(rel, texte) ? [[rel, texte]] : []);
}

function ecrireLesFichiers(dossier: string, fichiers: readonly [string, string][]): void {
  for (const [rel, texte] of fichiers) {
    const cible = join(dossier, rel);
    mkdirSync(dirname(cible), { recursive: true });
    writeFileSync(cible, texte);
  }
}

/** Pose sous `dossier` les `DECLARATIONS_DE_L_IMAGE` de `sha` à la place de celles du détecteur. */
function poserLesDeclarations(depot: Depot, sha: string, dossier: string): void {
  for (const d of DECLARATIONS_DE_L_IMAGE) rmSync(join(dossier, d), { recursive: true, force: true });
  ecrireDeLImage(depot, sha, dossier, DECLARATIONS_DE_L_IMAGE);
}

/** Un DÉTECTEUR : son nom, sa clé de mémo, et la pose de son code (`DU_DETECTEUR`, son classement) dans une image. */
type Detecteur = {
  readonly nom: string;
  readonly cle: string;
  readonly empreinte: () => string;
  readonly poser: (dossier: string) => void;
};

/** Le détecteur du commit `sha` : son `scripts/`, son `package.json`, son `tsconfig.json`, ses modules de classement
 *  (`MARQUE_DE_CLASSEMENT`) et ses modules partagés (`LIB_DU_DETECTEUR`), lus par git. */
export function detecteurDuCommit(depot: Depot, sha: string): Detecteur {
  let fichiers: [string, string][] | undefined;
  let empreinte: string | undefined;
  const lireFichiers = () => fichiers ??= [
    ...fichiersDeLImage(depot, sha, DU_DETECTEUR, () => true),
    ...fichiersDeLImage(depot, sha, [RACINE_DU_CLASSEMENT], estDuClassement),
    ...fichiersDeLImage(depot, sha, [LIB_DU_DETECTEUR], estModulePartage),
  ];
  return {
    nom: `détecteur de la base (${sha.slice(0, 9)})`,
    cle: sha,
    empreinte: () => {
      if (empreinte === undefined) {
        const hachage = createHash('sha256');
        for (const fichier of lireFichiers()) hachage.update(JSON.stringify(fichier));
        empreinte = hachage.digest('hex');
      }
      return empreinte;
    },
    poser: (dossier) => ecrireLesFichiers(dossier, lireFichiers()),
  };
}

/** La première ligne d'erreur d'un processus enfant : la première `…Error`, sinon la dernière ligne de son stderr. */
const premiereErreur = (vu: SpawnSyncReturns<string>): string =>
  (vu.stderr ?? '').split('\n').find((l) => /^\w*Error\b/.test(l)) ?? (vu.stderr ?? '').trim().split('\n').slice(-1)[0];

/** La génération du code d'une image : le `genererCode` de SON `scripts/docs/build-all.mjs` (argv[1]), cwd = l'image. */
const GENERATION_DE_L_IMAGE = 'const { genererCode } = await import(process.argv[1]); process.exitCode = await genererCode({ cwd: process.cwd(), quiet: true });';

/** L'env de la génération d'une image : sans l'espace de noms de git (`GIT_*`, `git help git`, « ENVIRONMENT
 *  VARIABLES ») ni l'écrivain des dérivés de l'arbre qui tourne (`ENV_EPOQUE`, `ENV_TENU`, ecrivain-derives.mjs). */
const envDeGeneration = (): NodeJS.ProcessEnv =>
  Object.fromEntries(Object.entries(process.env).filter(([nom]) => !nom.startsWith('GIT_') && nom !== ENV_EPOQUE && nom !== ENV_TENU));

/** Un dossier neuf sous `os.tmpdir()` où poser une image, refusé (`ImageDansUnDepot`) avant toute écriture quand un
 *  dépôt git le contient. */
function dossierDImage(): string {
  const dossier = mkdtempSync(join(tmpdir(), 'comptes-'));
  const gitDir = gitDirContenant(dossier);
  if (gitDir === null) return dossier;
  rmSync(dossier, { recursive: true, force: true });
  throw new ImageDansUnDepot(`${dossier} : l’image d’une borne se pose hors de tout dépôt git — ${gitDir} le contient`);
}

/** Les cibles de code de l'image `dossier`, produites par le `scripts/` qui y est posé (`GENERATION_DE_L_IMAGE`), ses
 *  dépendances liées (`lierDependances`, `scripts/migrations/replay-head.mjs`), dans un processus enfant. */
function genererLesCibles(dossier: string, configuration: string): void {
  lierDependances(dossier);
  const vu = spawnSync(process.execPath, ['--input-type=module', '-e', GENERATION_DE_L_IMAGE, pathToFileURL(join(dossier, 'scripts/docs/build-all.mjs')).href], {
    cwd: dossier, env: envDeGeneration(), encoding: 'utf8', maxBuffer: 1 << 28,
  });
  if (vu.status !== 0) throw new MesureImpossible(`${configuration} : génération en échec (${vu.status ?? vu.signal}) — ${premiereErreur(vu)}`);
}

/** Les comptes de l'image posée sous `dossier`, mesurés DANS l'image : ses defs, sa grammaire, son `OP_DEFS`. */
function mesurerImage(dossier: string, configuration: string): Comptes {
  const vu = spawnSync(process.execPath, [join(RACINE, 'node_modules/tsx/dist/cli.mjs'), POINT_D_ENTREE], {
    cwd: dossier, encoding: 'utf8', maxBuffer: 1 << 28,
  });
  if (vu.status !== 0) throw new MesureImpossible(`${configuration} : mesure en échec (${vu.status ?? vu.signal}) — ${premiereErreur(vu)}`);
  return new Map(JSON.parse(vu.stdout) as [string, EntreeDeCompte[]][]);
}

/** L'image de chaque commit, générée par son propre code, une fois par processus : son dossier, ou la raison de son
 *  échec. Les dossiers s'effacent à la sortie du processus. */
type ImageGeneree = { dossier: string; derniereMesure?: { empreinte: string; comptes: Comptes } };
const IMAGES_GENEREES = new Map<string, ImageGeneree | MesureImpossible>();
let sortieObservee = false;
const effacerLesImages = (): void => {
  for (const image of IMAGES_GENEREES.values()) if (!(image instanceof MesureImpossible)) rmSync(image.dossier, { recursive: true, force: true });
};

/** Le dossier de l'image de `sha` : `DE_L_IMAGE` et `DU_DETECTEUR` de `sha`, ses cibles de code produites par SON
 *  `genererCode` (`genererLesCibles`). */
function imageGeneree(depot: Depot, sha: string, configuration: string): ImageGeneree {
  if (!IMAGES_GENEREES.has(sha)) {
    if (!sortieObservee) { process.once('exit', effacerLesImages); sortieObservee = true; }
    const dossier = dossierDImage();
    try {
      ecrireDeLImage(depot, sha, dossier, [...DE_L_IMAGE, ...DU_DETECTEUR]);
      genererLesCibles(dossier, configuration);
      IMAGES_GENEREES.set(sha, { dossier });
    } catch (e) {
      rmSync(dossier, { recursive: true, force: true });
      if (!(e instanceof MesureImpossible)) throw e;
      IMAGES_GENEREES.set(sha, e);
    }
  }
  const image = IMAGES_GENEREES.get(sha)!;
  if (image instanceof MesureImpossible) throw image;
  return image;
}

/** Les chemins des MODULES GÉNÉRÉS, indexés par leur nom stable, selon la déclaration `argv[1]` puis `argv[2]` : chaque
 *  sortie de `SORTIES_DES_ESPACES` sous sa clé, chaque `out` de `REGISTRIES` sous son `arrayName`. */
const MODULES_GENERES_LUS = [
  'const lus = async (url) => { const { SORTIES_DES_ESPACES, REGISTRIES } = await import(url);',
  '  return [...Object.entries(SORTIES_DES_ESPACES ?? {}), ...(REGISTRIES ?? []).map((r) => [r.arrayName, r.out])]; };',
  'process.stdout.write(JSON.stringify([await lus(process.argv[1]), await lus(process.argv[2])]));',
].join('\n');

/** Sous `dossier`, à chaque chemin d'un module généré (`MODULES_GENERES_LUS`) que déclare le détecteur posé, autre que
 *  celui que l'image déclare sous le même nom, un RENVOI vers celui de l'image (#5083) : un module à lui seul si le
 *  chemin est absent, ajouté en fin de la sortie que l'image y génère sous un autre nom (un module scindé, #5070). */
function poserLesRenvois(dossier: string, configuration: string): void {
  const vu = spawnSync(process.execPath, ['--input-type=module', '-e', MODULES_GENERES_LUS,
    pathToFileURL(join(dossier, COPIE_DES_CIBLES, CIBLES_DECLAREES)).href, pathToFileURL(join(dossier, CIBLES_DECLAREES)).href], {
    cwd: dossier, encoding: 'utf8',
  });
  if (vu.status !== 0) throw new MesureImpossible(`${configuration} : lecture des modules générés en échec (${vu.status ?? vu.signal}) — ${premiereErreur(vu)}`);
  const [deLImage, duDetecteur] = JSON.parse(vu.stdout) as [[string, string][], [string, string][]];
  const viseParNom = new Map(deLImage);
  const sortiesDeLImage = new Set(viseParNom.values());
  for (const [nom, chemin] of duDetecteur) {
    const vise = viseParNom.get(nom);
    if (vise === undefined || chemin === vise || !/\.m?ts$/.test(chemin)) continue;
    const cible = join(dossier, chemin);
    const renvoi = `export * from './${posix.relative(posix.dirname(chemin), vise)}';\n`;
    if (!existsSync(cible)) {
      mkdirSync(dirname(cible), { recursive: true });
      writeFileSync(cible, renvoi);
    } else if (sortiesDeLImage.has(chemin)) appendFileSync(cible, renvoi);
  }
}

/** Les liens d'une mesure : chemin attendu par le détecteur et absent de l'image ↦ chemin du fichier dans l'image. */
type Liens = readonly (readonly [string, string])[];

/** Sous `dossier`, à chaque chemin absent des `liens`, un lien vers le fichier de l'image, ajouté à `poses` ; un
 *  système qui refuse le lien (`EPERM` : Windows sans privilège de lien) rend la mesure impossible. */
function poserLesLiens(dossier: string, liens: Liens, configuration: string, poses: string[]): void {
  for (const [absent, present] of liens) {
    const cible = join(dossier, absent);
    if (existsSync(cible) || !existsSync(join(dossier, present))) continue;
    mkdirSync(dirname(cible), { recursive: true });
    try {
      symlinkSync(posix.relative(posix.dirname(absent), present), cible);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EPERM') throw e;
      throw new MesureImpossible(`${configuration} : lien vers un chemin renommé refusé (EPERM) — ${absent}`);
    }
    poses.push(cible);
  }
}

/** Les comptes de `sha` sous les cibles de SON image (`imageGeneree`), le code du `detecteur` posé à la place du sien,
 *  sur le classement de l'image qu'une pose précédente a pu recouvrir ; ses modules générés aux chemins que déclare
 *  l'image (`CIBLES_DECLAREES`). */
function mesurerSousLesCiblesDeLImage(depot: Depot, sha: string, detecteur: Detecteur, liens: Liens): Comptes {
  const configuration = `${sha.slice(0, 9)} sous les cibles de l’image`;
  const image = imageGeneree(depot, sha, configuration);
  const empreinte = `${detecteur.empreinte()}\u0000${JSON.stringify(liens)}`;
  // Seule la dernière pose réussie est réutilisable, sous ses liens : une pose intermédiaire peut laisser d’autres fichiers dans l’image.
  if (image.derniereMesure?.empreinte === empreinte) return image.derniereMesure.comptes;
  delete image.derniereMesure;
  const { dossier } = image;
  rmSync(join(dossier, 'scripts'), { recursive: true, force: true });
  ecrireDeLImage(depot, sha, dossier, [RACINE_DU_CLASSEMENT]);
  detecteur.poser(dossier);
  poserLesDeclarations(depot, sha, dossier);
  ecrireDeLImage(depot, sha, join(dossier, COPIE_DES_CIBLES), [CIBLES_DECLAREES]);
  poserLesRenvois(dossier, configuration);
  const poses: string[] = [];
  try {
    poserLesLiens(dossier, liens, configuration, poses);
    const comptes = mesurerImage(dossier, configuration);
    image.derniereMesure = { empreinte, comptes };
    return comptes;
  } finally {
    for (const lien of poses) rmSync(lien, { force: true });
  }
}

/** Les comptes de `sha` sous les cibles des générateurs du `detecteur` : `DE_L_IMAGE` de `sha`, le code du `detecteur`. */
function mesurerSousLesCiblesDuDetecteur(depot: Depot, sha: string, detecteur: Detecteur, liens: Liens): Comptes {
  const configuration = `${sha.slice(0, 9)} sous les cibles du détecteur`;
  const dossier = dossierDImage();
  try {
    ecrireDeLImage(depot, sha, dossier, DE_L_IMAGE);
    detecteur.poser(dossier);
    poserLesDeclarations(depot, sha, dossier);
    poserLesLiens(dossier, liens, configuration, []);
    genererLesCibles(dossier, configuration);
    return mesurerImage(dossier, configuration);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

/** Les comptes du commit `sha` sous `detecteur`, une fois par processus : sous les cibles de l'image, sinon sous celles
 *  du détecteur ; les deux impossibles, les deux raisons. */
const COMPTES_PAR_MESURE = new Map<string, Comptes>();
function comptesDuCommit(depot: Depot, sha: string, detecteur: Detecteur, liens: Liens): Comptes {
  const cle = `${detecteur.cle}\u0000${sha}`;
  const connus = COMPTES_PAR_MESURE.get(cle);
  if (connus) return connus;
  let comptes: Comptes;
  try {
    comptes = mesurerSousLesCiblesDeLImage(depot, sha, detecteur, liens);
  } catch (e) {
    if (!(e instanceof MesureImpossible)) throw e;
    try {
      comptes = mesurerSousLesCiblesDuDetecteur(depot, sha, detecteur, liens);
    } catch (repli) {
      if (!(repli instanceof MesureImpossible)) throw repli;
      throw new MesureImpossible(`${e.message} ; ${repli.message}`);
    }
  }
  COMPTES_PAR_MESURE.set(cle, comptes);
  return comptes;
}

/** La mesure de la plage par un détecteur : ses comptes aux deux bornes, ou la raison qui la saute. */
type MesureDUnDetecteur = { readonly detecteur: string } & (
  | { readonly base: Comptes; readonly tete: Comptes }
  | { readonly sautee: string }
);

/** La paire base/tête mesurée par `detecteur`, ou sautée quand elle ne se lie pas ; `renommages` : chemin de la base ↦
 *  chemin de la tête. Une borne se mesure sous le détecteur de l'autre avec les liens vers ses chemins. */
function mesurerLaPaire(depot: Depot, shaBase: string, shaTete: string, detecteur: Detecteur, renommages: ReadonlyMap<string, string>): MesureDUnDetecteur {
  const versLaTete = [...renommages];
  const liensDe = (sha: string): Liens => detecteur.cle === sha ? [] : sha === shaBase ? versLaTete.map(([b, t]) => [t, b]) : versLaTete;
  try {
    return { detecteur: detecteur.nom, base: comptesDuCommit(depot, shaBase, detecteur, liensDe(shaBase)), tete: comptesDuCommit(depot, shaTete, detecteur, liensDe(shaTete)) };
  } catch (e) {
    if (!(e instanceof MesureImpossible)) throw e;
    return { detecteur: detecteur.nom, sautee: e.message };
  }
}

/** #2948. */
type FauxPositif = readonly [collection: string, site: string, occurrence: number];

/** #2948 ; un PLANCHER compte 1 par site qu'il tient (`plancher.tient`). */
export function baissesDuDetecteur(base: Comptes, teteSousBase: Comptes, tete: Comptes): FauxPositif[] {
  return SOUS_LA_PORTE.flatMap((c) => {
    const compte = (e: EntreeDeCompte): number => (c.plancher ? Number(c.plancher.tient(e)) : c.nombre(e));
    const parSite = (comptes: Comptes): Map<string, number> => new Map((comptes.get(c.nom) ?? []).map((e) => [c.site(e), compte(e)]));
    const natifs = parSite(base);
    const anciens = parSite(teteSousBase);
    const nouveaux = parSite(tete);
    return [...natifs].flatMap(([site, nombre]) => {
      const borne = Math.min(nombre, anciens.get(site) ?? 0);
      const debut = (nouveaux.get(site) ?? 0) + 1;
      return Array.from({ length: Math.max(0, borne - debut + 1) }, (_, i) => [c.nom, site, debut + i] as const);
    });
  });
}

export function refusDesFauxPositifs(attendus: readonly FauxPositif[], message: string): string[] {
  const restants = new Map(attendus.map((a) => [JSON.stringify(a), a]));
  const vus = new Set<string>();
  const refus: string[] = [];
  for (const ligne of message.split(/\r?\n/).filter((l) => /^[ \t]*FAUX-POSITIF[ \t]*:/.test(l))) {
    const lu = /^[ \t]*FAUX-POSITIF:[ \t]*(\[[^\r\n]*\])[ \t]+—[ \t]+(.+)$/.exec(ligne);
    let tuple: unknown;
    try { tuple = lu && JSON.parse(lu[1]); } catch { tuple = null; }
    if (!lu || lu[2].trim().length < 20 || !Array.isArray(tuple) || tuple.length !== 3
      || typeof tuple[0] !== 'string' || typeof tuple[1] !== 'string' || !Number.isSafeInteger(tuple[2]) || tuple[2] < 1) {
      refus.push(`  FAUX-POSITIF malformé : ${ligne}`);
      continue;
    }
    const cle = JSON.stringify(tuple);
    if (vus.has(cle)) refus.push(`  FAUX-POSITIF dupliqué : ${cle}`);
    else if (!restants.delete(cle)) refus.push(`  FAUX-POSITIF surnuméraire ou site inconnu : ${cle}`);
    vus.add(cle);
  }
  refus.push(...[...restants.keys()].map((cle) => `  FAUX-POSITIF manquant : ${cle} — <preuve d’au moins 20 caractères>`));
  return refus;
}

export function verdictDesDetecteurs(plage: string, mesures: readonly MesureDUnDetecteur[], message = ''): { ok: boolean; texte: string } {
  const sautees = mesures.flatMap((m) => ('sautee' in m ? [`  paire sautée — ${m.detecteur} : ${m.sautee}`] : []));
  const liees = mesures.flatMap((m) => ('sautee' in m ? [] : [m]));
  const suite = sautees.length ? `\n${sautees.join('\n')}` : '';
  if (!liees.length) return { ok: false, texte: `⛔ ${plage} : aucune paire de détecteur ne se lie — la porte ne juge pas ce qu’elle n’a pas mesuré.${suite}` };
  const refus = liees.flatMap((m) => refusDesComptes(m.base, m.tete).map((l) => `  [${m.detecteur}] ${l}`));
  const croissance = refus.length ? { ok: false, texte: `⛔ ${plage} : ${refus.length} site(s) sous la porte MONTENT, NAISSENT ou CÈDENT leur plancher — aucune donnée n’y entre, aucun \`CLIQUET:\` ne les couvre (#2705) :\n${refus.join('\n')}${suite}` } : null;
  const [tete, base] = mesures;
  if (!tete || !base || 'sautee' in tete || 'sautee' in base)
    return croissance ?? { ok: false, texte: `⛔ ${plage} : les deux détecteurs sont nécessaires pour attribuer une baisse à la donnée.${suite}` };
  const declarations = refusDesFauxPositifs(baissesDuDetecteur(base.base, base.tete, tete.tete), message);
  if (croissance) return { ...croissance, texte: croissance.texte + (declarations.length ? '\n' + declarations.join('\n') : '') };
  return declarations.length
    ? { ok: false, texte: `⛔ ${plage} : baisse de détecteur non justifiée exactement par FAUX-POSITIF:\n${declarations.join('\n')}${suite}` }
    : { ok: true, texte: `${plage} : aucun compte des ${SOUS_LA_PORTE.length} volets sous la porte ne monte, aucun site n’y naît, aucun plancher ne cède ; baisses de détecteur justifiées (${liees.map((m) => m.detecteur).join(', ')}).${suite}` };
}

/**
 * Le verdict de la plage `merge-base(base, tete)..tete` du `depot` (`depotDe`, gitPorte.mjs), dont chaque lecture git
 * passe par lui, jugée par le détecteur de la tête et par celui de la base (`verdictDesDetecteurs`). Sous `INDEX`, la base
 * est un arbre réel lu tel quel, et les déclarations sont le journal `^<base>` des parents du commit à venir, HEAD et
 * `fusionnesEnCours`, puis son message : ce que la CI lira de `<base>..<tete>` une fois le commit fait (#1463). Chaque
 * borne est posée sous `os.tmpdir()` et mesurée dans son image (`comptesDuCommit`) ; un détecteur de base sans point
 * d'entrée (`POINT_D_ENTREE`) est sauté sans poser d'image.
 */
export function jugerLesComptes({ depot, base = TRONC.suivi, tete = 'HEAD', message }: { depot: Depot; base?: string; tete?: string; message?: string }): { ok: boolean; texte: string } {
  const index = tete === INDEX;
  const viderLesMesures = (): void => { effacerLesImages(); IMAGES_GENEREES.clear(); COMPTES_PAR_MESURE.clear(); };
  if (index) viderLesMesures();
  try {
    const shaTete = index ? INDEX : shaDe(depot, tete);
    const shaBase = index ? base : shaTete && baseCommune(depot, base, shaTete);
    if (!shaTete || !shaBase) return { ok: false, texte: `⛔ ${base}..${tete} : base commune illisible — la porte ne juge pas une plage sans borne.` };
    const plage = `${base} (base ${shaBase.slice(0, 9)})..${tete} (${shaTete.slice(0, 9)})`;
    if (shaBase === shaTete) {
      const refus = refusDesFauxPositifs([], message ?? '');
      return { ok: refus.length === 0, texte: refus.length ? `⛔ ${plage} :\n${refus.join('\n')}` : `${plage} : plage vide.` };
    }
    const deLaBase = detecteurDuCommit(depot, shaBase);
    const deLaTete = { ...detecteurDuCommit(depot, shaTete), nom: 'détecteur de la tête' };
    const head = index ? shaDe(depot, 'HEAD') : null;
    const journal = !index ? (message === undefined ? journalDe(depot, [`${shaBase}..${shaTete}`]) : [])
      : head ? journalDe(depot, [`^${shaBase}`, head, ...fusionnesEnCours(depot)]) : [];
    if (journal === null) throw new GitIndisponible('messages de la plage illisibles');
    if (index && message === undefined) return { ok: false, texte: `⛔ ${plage} : message du commit absent pour l’index.` };
    const renommages: ReadonlyMap<string, string> = ceQuiChange(depot, shaBase, shaTete).renommages();
    return verdictDesDetecteurs(plage, [
      mesurerLaPaire(depot, shaBase, shaTete, deLaTete, renommages),
      listerImage(depot, shaBase, POINT_D_ENTREE).length
        ? mesurerLaPaire(depot, shaBase, shaTete, deLaBase, renommages)
        : { detecteur: deLaBase.nom, sautee: `\`${POINT_D_ENTREE}\` absent de la base` },
    ], [...journal.map((c) => c.message), ...(message === undefined ? [] : [message])].join('\n'));
  } catch (e) {
    if (!(e instanceof GitIndisponible)) throw e;
    return { ok: false, texte: `⛔ lecture git indisponible : ${refusDeGit(e)} — la porte ne juge pas ce que git n’a pas lu.` };
  } finally {
    if (index) viderLesMesures();
  }
}

if (import.meta.main) process.stdout.write(JSON.stringify([...comptesDeLaRacine(process.cwd())]));
