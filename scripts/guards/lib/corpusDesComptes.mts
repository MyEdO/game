// CORPUS DES COMPTES (#2705) : ce que mesurent les collections à compte (`COLLECTIONS_A_COMPTE`,
// `occurrencesStock.mjs`) sur une racine, et la PORTE DE PLAGE qui refuse qu'un compte monte ou qu'un
// site naisse entre la base d'une plage et sa tête.
//
// DÉTECTEUR CONSTANT : la base et la tête se mesurent par le MÊME code, celui qui tourne (`scripts/`), posé
// dans chaque image ; tout `src/` vient de l'image — donnée, defs, grammaire, `OP_DEFS`. Un détecteur élargi
// mesure donc les deux côtés pareil, et ce qui monte est la DONNÉE ou son SCHÉMA (un `idDe` retiré se voit).
// Aucune ligne de message n'admet une hausse.
// ANGLE MORT : au MÊME site, une hausse compensée par une baisse ne change pas le compte (#1711).
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENERATORS, genererCodeSansCertifier } from '../../docs/build-all.mjs';
import { lierDependances } from '../../migrations/replay-head.mjs';
import { scanDuCorpus, scannerRedeclarations } from '../../docs/lib/structures-scan.mjs';
import { champsSansSlot, occurrencesInatteignables, slotsDuParse } from '../../docs/lib/slots-registre.mjs';
import { OP_DEFS, OPS_NON_TYPEES } from '../../../src/data/schemas/grammaire/mecanique';
import { GitIndisponible, TRONC, baseCommune, depotDe, lireEnLot, listerImage, refusDeGit, shaDe, type Depot } from './gitPorte.mjs';
import { COLLECTIONS_A_COMPTE, occurrencesDe, type CorpusDesComptes, type EntreeDeCompte } from './occurrencesStock.mjs';
import { cleDeSite, ecartsDeStock, sitesEnEntrees, SEPARATEUR_DE_REMEDE, type EntreeDeSite } from './stock.mjs';
import { scanAll } from '../../raw/check-source-format.mjs';

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
    typage: { types: Object.keys(OP_DEFS), nonTypees: OPS_NON_TYPEES },
  };
}

/** Le corpus des comptes de la racine `root`. */
export const corpusDesComptes = (root: string): CorpusDesComptes =>
  corpusDuScan(scanDuCorpus(root), scannerRedeclarations(root).redeclarations);

/** Les entrées mesurées de chaque collection sous la porte, par nom. */
export type Comptes = ReadonlyMap<string, readonly EntreeDeCompte[]>;

/** Une collection SOUS LA PORTE : son nom, l'identité d'un site, la cible qui solde sa hausse, son compte. */
type SousLaPorte = {
  readonly nom: string;
  readonly site: (e: EntreeDeCompte) => string;
  readonly cible: (cle: string, e: EntreeDeCompte) => string;
  readonly nombre: (e: EntreeDeCompte) => number;
};

/** Le volet à `nombre` de la mise en forme des chapitres de `Source/` (`scripts/raw/check-source-format.mjs`),
 *  mesuré par ses sites (`scanAll`) : une entrée de stock de sites, sa clé `cleDeSite`, son compte `nombre`. */
const SOURCE_FORMAT = {
  nom: 'scripts/raw/source-format-stock.json',
  site: (e: EntreeDeCompte) => cleDeSite(e as unknown as EntreeDeSite),
  cible: () => 'Corriger le site : la mise en forme du chapitre (scripts/raw/check-source-format.mjs).',
  nombre: (e: EntreeDeCompte) => Number(e.nombre),
} as const;

/** Tout ce que la porte juge : les collections à compte (`COLLECTIONS_A_COMPTE`) et le volet `SOURCE_FORMAT`. */
const SOUS_LA_PORTE: readonly SousLaPorte[] = [...COLLECTIONS_A_COMPTE.map((c) => ({ ...c, nombre: occurrencesDe })), SOURCE_FORMAT];

/** Les comptes d'un corpus, collection par collection (`COLLECTIONS_A_COMPTE`). */
export const comptesDuCorpus = (corpus: CorpusDesComptes): Comptes => new Map(COLLECTIONS_A_COMPTE.map((c) => [c.nom, c.mesure(corpus)]));

/** Les comptes de la racine `root` (le répertoire courant pour `Source/`) : ses collections à compte et `SOURCE_FORMAT`. */
const comptesDeLaRacine = (root: string): Comptes =>
  new Map([...comptesDuCorpus(corpusDesComptes(root)), [SOURCE_FORMAT.nom, sitesEnEntrees(scanAll()) as unknown as EntreeDeCompte[]]]);

/**
 * Le REFUS de la plage `base` → `tete`, une ligne par site : un site NEUF d'une collection sous la porte, ou
 * un site dont le compte MONTE (`ecartsDeStock`, la tête comme observé, la base comme stock). PURE.
 */
export function refusDesComptes(base: Comptes, tete: Comptes): string[] {
  return SOUS_LA_PORTE.flatMap((c) => {
    const { neuves, accrues } = ecartsDeStock({
      observe: tete.get(c.nom) ?? [],
      stock: base.get(c.nom) ?? [],
      cle: c.site,
      nombre: c.nombre,
      cible: c.cible,
      remede: { neuve: (k, e) => `${k}${SEPARATEUR_DE_REMEDE}site NEUF : la dette NAÎT. ${c.cible(k, e)} Aucune écriture ne l’admet.` },
    });
    return [...neuves, ...accrues].map((l) => `${c.nom} : ${l}`);
  });
}

/** La racine du code qui TOURNE : le détecteur. */
const RACINE = fileURLToPath(new URL('../../..', import.meta.url));
/** Ce que le détecteur apporte à une image : son code et sa configuration de modules. */
const DU_DETECTEUR = ['scripts', 'package.json', 'tsconfig.json'];
/** Ce que l'image apporte : `src/` (donnée ET schémas) et `Source/` (les chapitres que mesure `SOURCE_FORMAT`). */
const DE_L_IMAGE = ['src', 'Source'];
/** Les fichiers TEXTE que la mesure lit ; un fichier binaire ne se pose pas. */
const TEXTE = /\.(?:md|json|ts|tsx|mts|mjs|js|cjs|css|snap)$/;

/** La mesure d'une image n'a pas abouti : la porte ne juge pas ce qu'elle n'a pas mesuré. */
class MesureImpossible extends Error {}

/**
 * L'image mesurable de `arbre` sous `dossier` : ce qu'elle apporte (`DE_L_IMAGE`, grammaire comprise), le code du
 * détecteur (`DU_DETECTEUR`), ses dépendances liées (`lierDependances`, `scripts/migrations/replay-head.mjs`)
 * et ses cibles de code produites sans certificat (`genererCodeSansCertifier` : `_registry.generated.ts`
 * n'est pas suivi, et une image jetable ne certifie rien).
 */
function poserImage(depot: Depot, arbre: string, dossier: string): void {
  for (const [rel, texte] of lireEnLot(depot, arbre, listerImage(depot, arbre, ...DE_L_IMAGE).filter((c) => TEXTE.test(c)))) {
    if (texte === null) continue;
    mkdirSync(dirname(join(dossier, rel)), { recursive: true });
    writeFileSync(join(dossier, rel), texte);
  }
  for (const rel of DU_DETECTEUR) cpSync(join(RACINE, rel), join(dossier, rel), { recursive: true });
  lierDependances(dossier);
  if (genererCodeSansCertifier({ cwd: dossier, generateurs: GENERATORS.filter((g) => existsSync(join(dossier, g.script))) }) !== 0)
    throw new MesureImpossible(`${arbre.slice(0, 9)} : cibles de code de l’image non produites`);
}

/** Les comptes de l'image posée sous `dossier`, mesurés DANS l'image : ses defs, sa grammaire, son `OP_DEFS`. */
function mesurerImage(dossier: string): Comptes {
  const vu = spawnSync(process.execPath, [join(RACINE, 'node_modules/tsx/dist/cli.mjs'), 'scripts/guards/lib/corpusDesComptes.mts'], {
    cwd: dossier, encoding: 'utf8', maxBuffer: 1 << 28,
  });
  if (vu.status !== 0) {
    const erreur = (vu.stderr ?? '').split('\n').find((l) => /^\w*Error\b/.test(l)) ?? (vu.stderr ?? '').trim().split('\n').slice(-1)[0];
    throw new MesureImpossible(`mesure de l’image en échec (${vu.status ?? vu.signal}) — ${erreur}`);
  }
  return new Map(JSON.parse(vu.stdout) as [string, EntreeDeCompte[]][]);
}

/** Les comptes du commit `sha`, une fois par processus : la mesure ne dépend que du commit et du détecteur. */
const COMPTES_PAR_SHA = new Map<string, Comptes>();
function comptesDuCommit(depot: Depot, sha: string): Comptes {
  const connus = COMPTES_PAR_SHA.get(sha);
  if (connus) return connus;
  const dossier = mkdtempSync(join(tmpdir(), 'comptes-'));
  try {
    poserImage(depot, sha, dossier);
    const comptes = mesurerImage(dossier);
    COMPTES_PAR_SHA.set(sha, comptes);
    return comptes;
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

/**
 * Le verdict de la plage `merge-base(base, tete)..tete` : `ok`, et son `texte`. Chaque borne est posée sous
 * `os.tmpdir()` et mesurée dans son image, puis effacée.
 */
export function jugerLesComptes({ cwd, base = TRONC.suivi, tete = 'HEAD' }: { cwd: string; base?: string; tete?: string }): { ok: boolean; texte: string } {
  try {
    const depot = depotDe(cwd);
    const shaTete = shaDe(depot, tete);
    const shaBase = shaTete && baseCommune(depot, base, shaTete);
    if (!shaTete || !shaBase) return { ok: false, texte: `⛔ ${base}..${tete} : base commune illisible — la porte ne juge pas une plage sans borne.` };
    const plage = `${base} (base ${shaBase.slice(0, 9)})..${tete} (${shaTete.slice(0, 9)})`;
    if (shaBase === shaTete) return { ok: true, texte: `${plage} : plage vide.` };
    const refus = refusDesComptes(comptesDuCommit(depot, shaBase), comptesDuCommit(depot, shaTete));
    return refus.length
      ? { ok: false, texte: `⛔ ${plage} : ${refus.length} compte(s) de collection à compte MONTENT ou NAISSENT — aucune donnée n’y entre, aucun \`CLIQUET:\` ne les couvre (#2705) :\n${refus.map((l) => `  ${l}`).join('\n')}` }
      : { ok: true, texte: `${plage} : aucun compte des ${SOUS_LA_PORTE.length} collections sous la porte ne monte, aucun site n’y naît.` };
  } catch (e) {
    if (e instanceof MesureImpossible) return { ok: false, texte: `⛔ ${e.message} — la porte ne juge pas ce qu’elle n’a pas mesuré.` };
    if (!(e instanceof GitIndisponible)) throw e;
    return { ok: false, texte: `⛔ lecture git indisponible : ${refusDeGit(e)} — la porte ne juge pas ce que git n’a pas lu.` };
  }
}

if (import.meta.main) process.stdout.write(JSON.stringify([...comptesDeLaRacine(process.cwd())]));
