/**
 * ENTRÉES-SORTIES de la régénération d'un stock de sites, pour ses deux formats (`FORMATS`,
 * `stockDeSites.mjs`) : lire le fichier en place, appeler le cœur pur (`texteRegenere`), écrire,
 * retirer ou juger (`--check`, `ecartDeRegeneration`). C'est la SEULE écriture d'un fichier de stock
 * de sites, et la SEULE commande de sa régénération :
 *
 *   npx tsx scripts/guards/lib/regenStock.mts <module qui mesure> [--check] [--amorce] [--lot <#N …>]
 *   npm run stocks:regen [-- --check] [-- --lot <#N …>]   (`--tous`)
 *
 * Le module qui mesure déclare sa régénération (`regenerations()`, une liste de
 * `RegenerationDeStock`) ; la commande l'importe sans l'exécuter, et refuse un chemin de stock dont
 * l'attribut git `merge` n'est pas `stocks` (le pilote de fusion, `.gitattributes`). `--tous` joue
 * chaque module qui mesure (`modulesQuiMesurent`, sur l'arbre syntaxique) et rend le plus grand code :
 * c'est la régénération au point fixe du train après une fusion du tronc (`etapesDuTrain.mjs`, #2525).
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RACINE } from './bindingsVivants.mjs';
import { analyserCorpus, typescript } from './dialecte.mjs';
import { estFichierVitest } from './fichierVitest.mjs';
import { attributDe, depotDe, listerImage, refusDeGit, SUIVI } from './gitPorte.mjs';
import { estModule } from './importGraph.mjs';
import { ecartDeRegeneration, texteEnPlace, texteRegenere, type RegenerationDeStock } from './stockDeSites.mjs';

/** Le lot du chantier passé par `--lot <#N …>`, ou `null`. */
export function lotDeLaLigne(args: readonly string[]): string | null {
  const i = args.indexOf('--lot');
  const v = i >= 0 ? String(args[i + 1] ?? '').trim() : '';
  return v && !v.startsWith('--') ? v : null;
}

/**
 * Régénère (ou juge, sous `--check`) chaque déclaration de la liste, dans son ordre, et rend le PLUS
 * GRAND des codes de sortie (0 = rien à dire, 1 = refus ou stock périmé). AMORÇAGE (`--amorce`) : la
 * politique de chaque déclaration dit ce qu'il lui fait ; il est légal au seul commit qui CRÉE le stock,
 * et tout usage ultérieur est visible au diff, que la porte de plage compte.
 */
export function regenererStock(
  regenerations: readonly RegenerationDeStock[],
  { outil, args = process.argv.slice(2), date = new Date().toISOString().slice(0, 10) }: {
    outil: string;
    args?: readonly string[];
    date?: string;
  },
): number {
  const check = args.includes('--check');
  const amorce = args.includes('--amorce');
  const lot = lotDeLaLigne(args);
  if (amorce) {
    for (const r of regenerations) {
      console.warn(`AMORÇAGE : ${r.chemin}, politique ${r.politique.nom} : légal au seul commit qui CRÉE ce stock ; la politique dit ce que l'amorce lui fait.`);
    }
  }
  let code = 0;
  for (const r of regenerations) code = Math.max(code, regenererUn(r, { check, amorce, lot, date, outil }));
  return code;
}

function regenererUn(
  r: RegenerationDeStock,
  p: { check: boolean; amorce: boolean; lot: string | null; date: string; outil: string },
): number {
  const enPlace = texteEnPlace(r.chemin);
  if (p.check) {
    const ecart = ecartDeRegeneration(r, enPlace);
    if (ecart !== null) {
      console.error(`${ecart}\nRelancer : ${p.outil}`);
      return 1;
    }
    console.log(`${r.chemin} : Stock à jour`);
    return 0;
  }
  const rendu = texteRegenere(r, { enPlace, lot: p.lot, date: p.date, amorce: p.amorce });
  if ('refus' in rendu && rendu.refus) {
    console.error(rendu.refus);
    return 1;
  }
  const { texte, tailles } = rendu as { texte: string | null; tailles: string };
  if (texte === null) {
    if (existsSync(r.chemin)) {
      rmSync(r.chemin);
      console.log(`${r.chemin} : Stock soldé, fichier retiré`);
    } else {
      console.log(`${r.chemin} : Stock inchangé (absent)`);
    }
    return 0;
  }
  if (texte !== enPlace) {
    writeFileSync(r.chemin, texte);
    console.log(`${r.chemin} : Stock régénéré (${tailles})`);
  } else {
    console.log(`${r.chemin} : Stock inchangé (${tailles})`);
  }
  return 0;
}

const USAGE = 'Usage : npx tsx scripts/guards/lib/regenStock.mts <module qui mesure> | --tous [--check] [--amorce] [--lot <#N …>]';

/** Les arguments de la commande : le module (seul positionnel), `TOUS` sous `--tous` sans positionnel,
 *  ou `null` si la ligne est hors usage. */
const TOUS = Symbol('tous');
function moduleDeLaLigne(args: readonly string[]): string | typeof TOUS | null {
  const positionnels: string[] = [];
  let tous = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--check' || a === '--amorce') continue;
    if (a === '--tous') { tous = true; continue; }
    if (a === '--lot') { i++; continue; }
    if (a.startsWith('--')) return null;
    positionnels.push(a);
  }
  if (tous) return positionnels.length === 0 ? TOUS : null;
  return positionnels.length === 1 ? positionnels[0] : null;
}

/**
 * Les modules qui MESURENT parmi `fichiers` : ceux qui exportent une liaison `regenerations`
 * (`export const`, `export function`, `export async function`), lus sur l'arbre syntaxique. Une
 * déclaration de types (`.d.mts`), un instrument (`estFichierVitest`) ou un fichier hors `estModule`
 * n'en est pas un. PUR.
 */
export function modulesQuiMesurent(fichiers: Iterable<{ rel: string; text: string }>): string[] {
  const ts = typescript();
  const estExporte = (st: { modifiers?: readonly { kind: number }[] }) => Boolean(st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
  const candidats = [...fichiers].filter((f) => estModule(f.rel) && !/\.d\.[cm]?ts$/.test(f.rel) && !estFichierVitest(f.rel));
  const vus: string[] = [];
  for (const { fichier, sourceFile } of analyserCorpus(candidats)) {
    const exporte = sourceFile?.statements.some((st) => {
      if (ts.isFunctionDeclaration(st)) return estExporte(st) && st.name?.text === 'regenerations';
      return ts.isVariableStatement(st) && estExporte(st) && st.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === 'regenerations');
    });
    if (exporte) vus.push(fichier.rel);
  }
  return vus;
}

/** Les modules qui mesurent parmi les fichiers SUIVIS de `scripts/` (`listerImage`, `SUIVI`). */
function modulesQuiMesurentDuDepot(depot: ReturnType<typeof depotDe>): string[] {
  const suivis = listerImage(depot, SUIVI, 'scripts').filter((rel: string) => estModule(rel));
  return modulesQuiMesurent(suivis.map((rel) => ({ rel, text: readFileSync(resolve(RACINE, rel), 'utf8') })));
}

/** Joue chaque module de `modules` (`jouerModule`), dans son ordre, et rend le PLUS GRAND code. */
export async function jouerModules(modules: readonly string[], args: readonly string[]): Promise<number> {
  let code = 0;
  for (const module of modules) code = Math.max(code, await jouerModule(module, args));
  return code;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const module = moduleDeLaLigne(args);
  if (module === null) {
    console.error(USAGE);
    return 2;
  }
  if (module !== TOUS) return jouerModule(module, args);
  return jouerModules(modulesQuiMesurentDuDepot(depotDe(RACINE)), args);
}

/** Régénère (ou juge) les stocks que déclare `module` ; 2 sur un module ou un chemin refusé. */
async function jouerModule(module: string, args: readonly string[]): Promise<number> {
  const M = await import(pathToFileURL(resolve(RACINE, module)).href);
  if (typeof M.regenerations !== 'function') {
    console.error(`${module} : aucun export \`regenerations\`.`);
    return 2;
  }
  const liste = await M.regenerations();
  if (!Array.isArray(liste)) {
    console.error(`${module} : \`regenerations()\` ne rend pas une liste.`);
    return 2;
  }
  const pannes: string[] = [];
  const depot = depotDe(RACINE, { enPanne: (_raison, vu) => pannes.push(refusDeGit(vu)) });
  for (const r of liste as RegenerationDeStock[]) {
    const attribut = attributDe(depot, relative(RACINE, resolve(r.chemin)), 'merge');
    if (attribut !== 'stocks') {
      console.error(`${r.chemin} : l'attribut git merge vaut ${attribut ?? `(git check-attr en échec : ${pannes[pannes.length - 1] ?? 'sans réponse'})`}, pas \`stocks\` (.gitattributes) : rien n'est écrit.`);
      return 2;
    }
  }
  return regenererStock(liste, { outil: `npx tsx scripts/guards/lib/regenStock.mts ${module}`, args });
}

if (import.meta.main) process.exitCode = await main();
