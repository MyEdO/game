// CORPUS DES COMPTES (#2705) : ce que mesurent les collections à compte (`COLLECTIONS_A_COMPTE`,
// `occurrencesStock.mjs`) sur une racine, et la PORTE DE PLAGE qui refuse qu'un compte monte ou qu'un
// site naisse entre la base d'une plage et sa tête.
//
// DÉTECTEURS CONSTANTS : la base et la tête se MESURENT par le même code, posé dans chaque image — deux fois,
// par le détecteur de la tête (`scripts/` de son image git) et par celui de la base (`scripts/` de son image git).
// La constance couvre la MESURE ; les GÉNÉRATEURS appartiennent à l'image. L'image est celle de SON commit :
// `src/` — donnée, defs, grammaire, `OP_DEFS` — et ses cibles de code, produites par son propre `genererCode`
// (scripts/docs/build-all.mjs), une fois par commit, avant la pose du détecteur. Une mesure impossible sous ces
// cibles se rejoue sous celles des générateurs du DÉTECTEUR (`comptesDuCommit`) : une borne se mesure si UNE des deux
// configurations aboutit, sinon sa paire est sautée et nommée avec les deux raisons ; une paire sautée refuse.
// Ce qui monte sous l'un ou l'autre détecteur est la DONNÉE ou son SCHÉMA (un `idDe` retiré se voit) et
// refuse la plage. Aucune ligne de message n'admet une hausse.
// ANGLES MORTS : au MÊME site, une hausse compensée par une baisse ne change pas le compte (#1711) ; une forme
// générée que `src/` ET le détecteur lisent, changée des deux côtés de la plage, peut empêcher une mesure.
// `c.site` peut agréger plusieurs datasets (homonymes) ; l’ordinal d’un compte n’est pas l’adresse d’une valeur.
// La preuve d’un FAUX-POSITIF est du texte, sans vérification de sa vérité ; `SOUS_LA_PORTE`, ses identités et
// la politique du juge courant restent des entrées de confiance.
// Le classement `estFeuilleDId`/`descente` et `OP_DEFS`, importé de `src/`, suit l’image : sa modification peut masquer une baisse sous les deux détecteurs (#2969).
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { lierDependances } from '../../migrations/replay-head.mjs';
import { scanDuCorpus, scannerRedeclarations } from '../../docs/lib/structures-scan.mjs';
import { champsSansSlot, occurrencesInatteignables, slotsDuParse } from '../../docs/lib/slots-registre.mjs';
import { OP_DEFS, OPS_NON_TYPEES } from '../../../src/data/schemas/grammaire/mecanique';
import { enfantsDe, ouverts } from '../../../src/data/schemas/grammaire/descente';
import { estFeuilleDId } from '../../../src/data/schemas/grammaire/ref';
import { ENV_EPOQUE, ENV_TENU, gitDirContenant } from '../../docs/lib/ecrivain-derives.mjs';
import { GitIndisponible, INDEX, TRONC, baseCommune, journalDe, lireEnLot, listerImage, refusDeGit, shaDe, type Depot } from './gitPorte.mjs';
import { COLLECTIONS_A_COMPTE, SOUS_LA_PORTE, type CorpusDesComptes, type EntreeDeCompte } from './occurrencesStock.mjs';
import { ecartsDeStock, remedeDeNaissance, sitesEnEntrees } from './stock.mjs';
import { scanAll, SOURCE_FORMAT } from '../../raw/check-source-format.mjs';

/** Les clés de PREMIER niveau du payload de chaque op de `opDefs` dont le schéma, ouvert de ses enveloppes
 *  (`ouverts`), est une feuille `idDe` (`estFeuilleDId`) : la référence À PLAT (`estDetteDOp`). */
export function refsAPlat(opDefs: Readonly<Record<string, unknown>>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(opDefs).map(([op, schema]) => [op, [...new Set(ouverts([schema]).flatMap((n) =>
    enfantsDe(n).flatMap((e) => (e.cle !== undefined && ouverts([e.noeud]).some(estFeuilleDId) ? [e.cle] : []))))].sort()]));
}

/** Le corpus des comptes d'un scan déjà fait (`scanDuCorpus`) et de ses redéclarations. Le parse de mesure des
 *  slots ne se joue qu'à la première lecture de `sansSlot` : une garde qui ne mesure pas les slots ne le paie pas. */
export function corpusDuScan(
  { scan, defs }: Pick<ReturnType<typeof scanDuCorpus>, 'scan' | 'defs'>,
  redeclarations: CorpusDesComptes['redeclarations'],
): CorpusDesComptes {
  let sansSlot: CorpusDesComptes['sansSlot'] | undefined;
  return {
    scan, inatteignables: occurrencesInatteignables(scan), redeclarations,
    get sansSlot() { return (sansSlot ??= champsSansSlot(scan, slotsDuParse(scan, defs))); },
    typage: { types: Object.keys(OP_DEFS), nonTypees: OPS_NON_TYPEES, aPlat: refsAPlat(OP_DEFS) },
  };
}

/** Le corpus des comptes de la racine `root`. */
export const corpusDesComptes = (root: string): CorpusDesComptes =>
  corpusDuScan(scanDuCorpus(root), scannerRedeclarations(root).redeclarations);

/** Les entrées mesurées de chaque collection sous la porte, par nom. */
export type Comptes = ReadonlyMap<string, readonly EntreeDeCompte[]>;

/** Les comptes d'un corpus, collection par collection (`COLLECTIONS_A_COMPTE`). */
export const comptesDuCorpus = (corpus: CorpusDesComptes): Comptes => new Map(COLLECTIONS_A_COMPTE.map((c) => [c.nom, c.mesure(corpus)]));

/** Les comptes de la racine `root` (le répertoire courant pour `Source/`) : ses collections à compte et `SOURCE_FORMAT`. */
const comptesDeLaRacine = (root: string): Comptes =>
  new Map([...comptesDuCorpus(corpusDesComptes(root)), [SOURCE_FORMAT.nom, sitesEnEntrees(scanAll()) as unknown as EntreeDeCompte[]]]);

/**
 * Le REFUS de la plage `base` → `tete`, une ligne par site : un site NEUF d'une collection sous la porte, ou
 * un site dont le compte MONTE (`ecartsDeStock`, la tête comme observé, la base comme stock), sur chaque volet de
 * `SOUS_LA_PORTE` (`occurrencesStock.mjs`). PURE.
 */
export function refusDesComptes(base: Comptes, tete: Comptes): string[] {
  return SOUS_LA_PORTE.flatMap((c) => {
    const { neuves, accrues } = ecartsDeStock({
      observe: tete.get(c.nom) ?? [],
      stock: base.get(c.nom) ?? [],
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
/** Ce que l'image apporte : `src/` (donnée ET schémas) et `Source/` (les chapitres que mesure `SOURCE_FORMAT`). */
const DE_L_IMAGE = ['src', 'Source'];
/** Les fichiers TEXTE que la mesure lit ; un fichier binaire ne se pose pas. */
const TEXTE = /\.(?:md|json|ts|tsx|mts|mjs|js|cjs|css|snap)$/;
/** Le point d'entrée de la mesure, dans le code d'un détecteur. */
const POINT_D_ENTREE = 'scripts/guards/lib/corpusDesComptes.mts';

/** La mesure d'une image n'a pas abouti : la porte ne juge pas ce qu'elle n'a pas mesuré. */
class MesureImpossible extends Error {}

/** Le dossier d'une image est DANS un dépôt git : ses cibles de code y verraient l'écrivain de ce dépôt (`gitDirContenant`). */
class ImageDansUnDepot extends Error {}

/** Les fichiers texte de `dossiers` dans l'image `arbre`, écrits sous `dossier`. */
function ecrireDeLImage(depot: Depot, arbre: string, dossier: string, dossiers: readonly string[]): void {
  for (const [rel, texte] of lireEnLot(depot, arbre, listerImage(depot, arbre, ...dossiers).filter((c) => TEXTE.test(c)))) {
    if (texte === null) continue;
    mkdirSync(dirname(join(dossier, rel)), { recursive: true });
    writeFileSync(join(dossier, rel), texte);
  }
}

/** Un DÉTECTEUR : son nom, sa clé de mémo, et la pose de son code (`DU_DETECTEUR`) dans une image. */
type Detecteur = { readonly nom: string; readonly cle: string; readonly poser: (dossier: string) => void };

/** Le détecteur du commit `sha` : son `scripts/`, son `package.json` et son `tsconfig.json`, lus par git. */
export const detecteurDuCommit = (depot: Depot, sha: string): Detecteur => ({
  nom: `détecteur de la base (${sha.slice(0, 9)})`,
  cle: sha,
  poser: (dossier) => ecrireDeLImage(depot, sha, dossier, DU_DETECTEUR),
});

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
const IMAGES_GENEREES = new Map<string, string | MesureImpossible>();
let sortieObservee = false;
const effacerLesImages = (): void => {
  for (const image of IMAGES_GENEREES.values()) if (typeof image === 'string') rmSync(image, { recursive: true, force: true });
};

/** Le dossier de l'image de `sha` : `DE_L_IMAGE` et `DU_DETECTEUR` de `sha`, ses cibles de code produites par SON
 *  `genererCode` (`genererLesCibles`). */
function imageGeneree(depot: Depot, sha: string, configuration: string): string {
  if (!IMAGES_GENEREES.has(sha)) {
    if (!sortieObservee) { process.once('exit', effacerLesImages); sortieObservee = true; }
    const dossier = dossierDImage();
    try {
      ecrireDeLImage(depot, sha, dossier, [...DE_L_IMAGE, ...DU_DETECTEUR]);
      genererLesCibles(dossier, configuration);
      IMAGES_GENEREES.set(sha, dossier);
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

/** Les comptes de `sha` sous les cibles de SON image (`imageGeneree`), le code du `detecteur` posé à la place du sien. */
function mesurerSousLesCiblesDeLImage(depot: Depot, sha: string, detecteur: Detecteur): Comptes {
  const configuration = `${sha.slice(0, 9)} sous les cibles de l’image`;
  const image = imageGeneree(depot, sha, configuration);
  rmSync(join(image, 'scripts'), { recursive: true, force: true });
  detecteur.poser(image);
  return mesurerImage(image, configuration);
}

/** Les comptes de `sha` sous les cibles des générateurs du `detecteur` : `DE_L_IMAGE` de `sha`, le code du `detecteur`. */
function mesurerSousLesCiblesDuDetecteur(depot: Depot, sha: string, detecteur: Detecteur): Comptes {
  const configuration = `${sha.slice(0, 9)} sous les cibles du détecteur`;
  const dossier = dossierDImage();
  try {
    ecrireDeLImage(depot, sha, dossier, DE_L_IMAGE);
    detecteur.poser(dossier);
    genererLesCibles(dossier, configuration);
    return mesurerImage(dossier, configuration);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

/** Les comptes du commit `sha` sous `detecteur`, une fois par processus : sous les cibles de l'image, sinon sous celles
 *  du détecteur ; les deux impossibles, les deux raisons. */
const COMPTES_PAR_MESURE = new Map<string, Comptes>();
function comptesDuCommit(depot: Depot, sha: string, detecteur: Detecteur): Comptes {
  const cle = `${detecteur.cle}\u0000${sha}`;
  const connus = COMPTES_PAR_MESURE.get(cle);
  if (connus) return connus;
  let comptes: Comptes;
  try {
    comptes = mesurerSousLesCiblesDeLImage(depot, sha, detecteur);
  } catch (e) {
    if (!(e instanceof MesureImpossible)) throw e;
    try {
      comptes = mesurerSousLesCiblesDuDetecteur(depot, sha, detecteur);
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

/** La paire base/tête mesurée par `detecteur`, ou sautée quand elle ne se lie pas. */
function mesurerLaPaire(depot: Depot, shaBase: string, shaTete: string, detecteur: Detecteur): MesureDUnDetecteur {
  try {
    return { detecteur: detecteur.nom, base: comptesDuCommit(depot, shaBase, detecteur), tete: comptesDuCommit(depot, shaTete, detecteur) };
  } catch (e) {
    if (!(e instanceof MesureImpossible)) throw e;
    return { detecteur: detecteur.nom, sautee: e.message };
  }
}

/** #2948. */
type FauxPositif = readonly [collection: string, site: string, occurrence: number];

export function baissesDuDetecteur(base: Comptes, teteSousBase: Comptes, tete: Comptes): FauxPositif[] {
  return SOUS_LA_PORTE.flatMap((c) => {
    const parSite = (comptes: Comptes): Map<string, number> => new Map((comptes.get(c.nom) ?? []).map((e) => [c.site(e), c.nombre(e)]));
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
  const croissance = refus.length ? { ok: false, texte: `⛔ ${plage} : ${refus.length} compte(s) de collection à compte MONTENT ou NAISSENT — aucune donnée n’y entre, aucun \`CLIQUET:\` ne les couvre (#2705) :\n${refus.join('\n')}${suite}` } : null;
  const [tete, base] = mesures;
  if (!tete || !base || 'sautee' in tete || 'sautee' in base)
    return croissance ?? { ok: false, texte: `⛔ ${plage} : les deux détecteurs sont nécessaires pour attribuer une baisse à la donnée.${suite}` };
  const declarations = refusDesFauxPositifs(baissesDuDetecteur(base.base, base.tete, tete.tete), message);
  if (croissance) return { ...croissance, texte: croissance.texte + (declarations.length ? '\n' + declarations.join('\n') : '') };
  return declarations.length
    ? { ok: false, texte: `⛔ ${plage} : baisse de détecteur non justifiée exactement par FAUX-POSITIF:\n${declarations.join('\n')}${suite}` }
    : { ok: true, texte: `${plage} : aucun compte des ${SOUS_LA_PORTE.length} collections sous la porte ne monte, aucun site n’y naît ; baisses de détecteur justifiées (${liees.map((m) => m.detecteur).join(', ')}).${suite}` };
}

/**
 * Le verdict de la plage `merge-base(base, tete)..tete` du `depot` (`depotDe`, gitPorte.mjs), dont chaque lecture git
 * passe par lui, jugée par le détecteur de la tête et par celui de la base (`verdictDesDetecteurs`). Chaque borne est
 * posée sous `os.tmpdir()` et mesurée dans son image (`comptesDuCommit`) ; un détecteur de base sans point d'entrée
 * (`POINT_D_ENTREE`) est sauté sans poser d'image.
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
    const journal = message === undefined && !index ? journalDe(depot, [`${shaBase}..${shaTete}`]) : [];
    if (journal === null) throw new GitIndisponible('messages de la plage illisibles');
    if (index && message === undefined) return { ok: false, texte: `⛔ ${plage} : message du commit absent pour l’index.` };
    return verdictDesDetecteurs(plage, [
      mesurerLaPaire(depot, shaBase, shaTete, deLaTete),
      listerImage(depot, shaBase, POINT_D_ENTREE).length
        ? mesurerLaPaire(depot, shaBase, shaTete, deLaBase)
        : { detecteur: deLaBase.nom, sautee: `\`${POINT_D_ENTREE}\` absent de la base` },
    ], message ?? journal.map((c) => c.message).join('\n'));
  } catch (e) {
    if (!(e instanceof GitIndisponible)) throw e;
    return { ok: false, texte: `⛔ lecture git indisponible : ${refusDeGit(e)} — la porte ne juge pas ce que git n’a pas lu.` };
  } finally {
    if (index) viderLesMesures();
  }
}

if (import.meta.main) process.stdout.write(JSON.stringify([...comptesDeLaRacine(process.cwd())]));
