// CORPUS DES COMPTES (#2705) : ce que mesurent les collections à compte (`COLLECTIONS_A_COMPTE`,
// `occurrencesStock.mjs`) sur une racine, et la PORTE DE PLAGE qui refuse qu'un compte monte ou qu'un
// site naisse entre la base d'une plage et sa tête.
//
// DÉTECTEURS CONSTANTS : la base et la tête se mesurent par le MÊME code, posé dans chaque image — deux fois,
// par le détecteur de la tête (le `scripts/` qui tourne) et par celui de la base (`scripts/` du commit de base) ;
// tout `src/` vient de l'image — donnée, defs, grammaire, `OP_DEFS`. Ce qui monte sous l'un ou l'autre est la
// DONNÉE ou son SCHÉMA (un `idDe` retiré se voit) et refuse la plage. Une paire qui ne se lie pas est sautée et
// nommée ; aucune paire liée, la porte refuse. Aucune ligne de message n'admet une hausse.
// ANGLE MORT : au MÊME site, une hausse compensée par une baisse ne change pas le compte (#1711).
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENERATORS, genererCode } from '../../docs/build-all.mjs';
import { lierDependances } from '../../migrations/replay-head.mjs';
import { scanDuCorpus, scannerRedeclarations } from '../../docs/lib/structures-scan.mjs';
import { champsSansSlot, occurrencesInatteignables, slotsDuParse } from '../../docs/lib/slots-registre.mjs';
import { OP_DEFS, OPS_NON_TYPEES } from '../../../src/data/schemas/grammaire/mecanique';
import { enfantsDe, ouverts } from '../../../src/data/schemas/grammaire/descente';
import { estFeuilleDId } from '../../../src/data/schemas/grammaire/ref';
import { gitDirContenant } from '../../docs/lib/ecrivain-derives.mjs';
import { GitIndisponible, TRONC, baseCommune, lireEnLot, listerImage, refusDeGit, shaDe, type Depot } from './gitPorte.mjs';
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

/** La racine du code qui TOURNE : le détecteur de la tête. */
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

/** Le détecteur de la tête : le code qui tourne (`RACINE`). */
const DETECTEUR_DE_LA_TETE: Detecteur = {
  nom: 'détecteur de la tête',
  cle: 'tête',
  poser: (dossier) => { for (const rel of DU_DETECTEUR) cpSync(join(RACINE, rel), join(dossier, rel), { recursive: true }); },
};

/** Le détecteur du commit `sha` : son `scripts/`, son `package.json` et son `tsconfig.json`, lus par git. */
export const detecteurDuCommit = (depot: Depot, sha: string): Detecteur => ({
  nom: `détecteur de la base (${sha.slice(0, 9)})`,
  cle: sha,
  poser: (dossier) => ecrireDeLImage(depot, sha, dossier, DU_DETECTEUR),
});

/**
 * L'image mesurable de `arbre` sous `dossier` : ce qu'elle apporte (`DE_L_IMAGE`, grammaire comprise), le code du
 * `detecteur`, ses dépendances liées (`lierDependances`, `scripts/migrations/replay-head.mjs`)
 * et ses cibles de code produites et certifiées localement (`genererCode`). Un `dossier` contenu dans un dépôt git est
 * refusé (`ImageDansUnDepot`) avant toute écriture.
 */
function poserImage(depot: Depot, arbre: string, dossier: string, detecteur: Detecteur): void {
  const gitDir = gitDirContenant(dossier);
  if (gitDir !== null) throw new ImageDansUnDepot(`${dossier} : l’image d’une borne se pose hors de tout dépôt git — ${gitDir} le contient`);
  ecrireDeLImage(depot, arbre, dossier, DE_L_IMAGE);
  detecteur.poser(dossier);
  lierDependances(dossier);
  if (genererCode({ cwd: dossier, quiet: true, generateurs: GENERATORS.filter((g) => existsSync(join(dossier, g.script))) }) !== 0)
    throw new MesureImpossible(`${arbre.slice(0, 9)} : cibles de code de l’image non produites`);
}

/** Les comptes de l'image posée sous `dossier`, mesurés DANS l'image : ses defs, sa grammaire, son `OP_DEFS`. */
function mesurerImage(dossier: string): Comptes {
  const vu = spawnSync(process.execPath, [join(RACINE, 'node_modules/tsx/dist/cli.mjs'), POINT_D_ENTREE], {
    cwd: dossier, encoding: 'utf8', maxBuffer: 1 << 28,
  });
  if (vu.status !== 0) {
    const erreur = (vu.stderr ?? '').split('\n').find((l) => /^\w*Error\b/.test(l)) ?? (vu.stderr ?? '').trim().split('\n').slice(-1)[0];
    throw new MesureImpossible(`mesure de l’image en échec (${vu.status ?? vu.signal}) — ${erreur}`);
  }
  return new Map(JSON.parse(vu.stdout) as [string, EntreeDeCompte[]][]);
}

/** Les comptes du commit `sha` sous `detecteur`, une fois par processus : la mesure ne dépend que des deux. */
const COMPTES_PAR_MESURE = new Map<string, Comptes>();
function comptesDuCommit(depot: Depot, sha: string, detecteur: Detecteur): Comptes {
  const cle = `${detecteur.cle}\u0000${sha}`;
  const connus = COMPTES_PAR_MESURE.get(cle);
  if (connus) return connus;
  const dossier = mkdtempSync(join(tmpdir(), 'comptes-'));
  try {
    poserImage(depot, sha, dossier, detecteur);
    const comptes = mesurerImage(dossier);
    COMPTES_PAR_MESURE.set(cle, comptes);
    return comptes;
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
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

/**
 * Le verdict de la `plage` sur les mesures de ses détecteurs : refus si l'UN voit un compte monter ou un site
 * naître (`refusDesComptes`), refus si AUCUNE paire ne se lie ; chaque paire sautée est nommée. PURE.
 */
export function verdictDesDetecteurs(plage: string, mesures: readonly MesureDUnDetecteur[]): { ok: boolean; texte: string } {
  const sautees = mesures.flatMap((m) => ('sautee' in m ? [`  paire sautée — ${m.detecteur} : ${m.sautee}`] : []));
  const liees = mesures.flatMap((m) => ('sautee' in m ? [] : [m]));
  const suite = sautees.length ? `\n${sautees.join('\n')}` : '';
  if (!liees.length) return { ok: false, texte: `⛔ ${plage} : aucune paire de détecteur ne se lie — la porte ne juge pas ce qu’elle n’a pas mesuré.${suite}` };
  const refus = liees.flatMap((m) => refusDesComptes(m.base, m.tete).map((l) => `  [${m.detecteur}] ${l}`));
  return refus.length
    ? { ok: false, texte: `⛔ ${plage} : ${refus.length} compte(s) de collection à compte MONTENT ou NAISSENT — aucune donnée n’y entre, aucun \`CLIQUET:\` ne les couvre (#2705) :\n${refus.join('\n')}${suite}` }
    : { ok: true, texte: `${plage} : aucun compte des ${SOUS_LA_PORTE.length} collections sous la porte ne monte, aucun site n’y naît (${liees.map((m) => m.detecteur).join(', ')}).${suite}` };
}

/**
 * Le verdict de la plage `merge-base(base, tete)..tete` du `depot` (`depotDe`, gitPorte.mjs), dont chaque lecture git
 * passe par lui, jugée par le détecteur de la tête et par celui de la base (`verdictDesDetecteurs`). Chaque borne est
 * posée sous `os.tmpdir()` et mesurée dans son image, puis effacée ; un détecteur de base sans point d'entrée
 * (`POINT_D_ENTREE`) est sauté sans poser d'image.
 */
export function jugerLesComptes({ depot, base = TRONC.suivi, tete = 'HEAD' }: { depot: Depot; base?: string; tete?: string }): { ok: boolean; texte: string } {
  try {
    const shaTete = shaDe(depot, tete);
    const shaBase = shaTete && baseCommune(depot, base, shaTete);
    if (!shaTete || !shaBase) return { ok: false, texte: `⛔ ${base}..${tete} : base commune illisible — la porte ne juge pas une plage sans borne.` };
    const plage = `${base} (base ${shaBase.slice(0, 9)})..${tete} (${shaTete.slice(0, 9)})`;
    if (shaBase === shaTete) return { ok: true, texte: `${plage} : plage vide.` };
    const deLaBase = detecteurDuCommit(depot, shaBase);
    return verdictDesDetecteurs(plage, [
      mesurerLaPaire(depot, shaBase, shaTete, DETECTEUR_DE_LA_TETE),
      listerImage(depot, shaBase, POINT_D_ENTREE).length
        ? mesurerLaPaire(depot, shaBase, shaTete, deLaBase)
        : { detecteur: deLaBase.nom, sautee: `\`${POINT_D_ENTREE}\` absent de la base` },
    ]);
  } catch (e) {
    if (!(e instanceof GitIndisponible)) throw e;
    return { ok: false, texte: `⛔ lecture git indisponible : ${refusDeGit(e)} — la porte ne juge pas ce que git n’a pas lu.` };
  }
}

if (import.meta.main) process.stdout.write(JSON.stringify([...comptesDeLaRacine(process.cwd())]));
