/**
 * LE DOSSIER DE PRODUCTION D'UNE BASE (#3106) : le dossier du GLB construit, écrit tel que l'import le lit
 * (`hotes/godot/asset/importer.ts`, `dossierDeProduction.ts`). Chaque fichier a une source :
 * - le GLB, exporté par la construction (`humanoide.py`) ;
 * - `manifest.json` : `model` et `model_sha256` pris au GLB, `manifeste` le manifeste complet (`manifeste.mjs`),
 *   `packs_sources` le chemin, l'empreinte (`empreinteDeSource`) et la copie du texte de licence de chaque pack,
 *   `hors_release` la raison qui tient la base hors Release (#2948, arbitrages n°14 et n°19) ;
 * - `LICENSE-<source>.txt` : la copie octet pour octet du texte de licence que la construction nomme pour chaque pack
 *   source, pris dans un dossier ancêtre de la source.
 * Le dossier reste hors de tout arbre de travail du dépôt et ne contient rien d'autre.
 */
import { copyFileSync, existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ecrireTexteAtomique } from '../../guards/lib/ecritureJsonAtomique.mjs';
import { depotDe, worktreesDe } from '../../guards/lib/gitPorte.mjs';
import { chargerLicences, CLE_HORS_RELEASE, licenceDeclaree, MANIFESTE_DE_PRODUCTION } from '../../../hotes/godot/asset/dossierDeProduction.ts';
import { sha256 } from '../../../hotes/godot/asset/empreinte.ts';
import { tableTotale } from '../../../src/lib/tableTotale.ts';

/** Les packs dont une base se construit : les deux bibliothèques de clips, le corps, son corps féminin, et le dossier
 *  `data` de MPFB, donneur MakeHuman de la clé `corpulence` (`corpulence.py`). */
export interface SourcesDeBase { readonly ual1: string; readonly ual2: string; readonly corps: string; readonly 'corps-feminin': string; readonly mpfb: string }
type Source = keyof SourcesDeBase;
/** Le texte de licence nommé pour chaque pack de `SourcesDeBase`. */
type LicencesDeBase = SourcesDeBase;
export const SOURCES: readonly Source[] = ['ual1', 'ual2', 'corps', 'corps-feminin', 'mpfb'];

/** La raison qui tient une base de packs Quaternius et MakeHuman hors Release : #2948, arbitrages n°14 et n°19. */
export const HORS_RELEASE_DE_BASE = "base d'essai construite de packs Quaternius (UAL, UBC) et MakeHuman (MPFB), jamais en Release (#2948, arbitrages n°14 et n°19)";

const DEPOT = fileURLToPath(new URL('.', import.meta.url));
const copieDeLicence = (source: Source): string => `LICENSE-${source}.txt`;

export class ProductionRefusee extends Error {
  constructor(raison: string) {
    super(raison);
    this.name = 'ProductionRefusee';
  }
}

const estFichier = (chemin: string): boolean => existsSync(chemin) && statSync(chemin).isFile();
/** Les fichiers du dossier `dossier`, à toute profondeur. */
const fichiersDe = (dossier: string): string[] => readdirSync(dossier, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));
const estDossierNonVide = (chemin: string): boolean => existsSync(chemin) && statSync(chemin).isDirectory() && fichiersDe(chemin).length > 0;

type Nature = 'fichier' | 'dossier non vide';
/** La nature de la source de chaque pack : un fichier, ou pour MPFB son dossier `data`, qui porte au moins un fichier. */
const NATURE_DE_SOURCE: Readonly<Record<Source, Nature>> = { ual1: 'fichier', ual2: 'fichier', corps: 'fichier', 'corps-feminin': 'fichier', mpfb: 'dossier non vide' };
const EST_DE_NATURE: Readonly<Record<Nature, (chemin: string) => boolean>> = { fichier: estFichier, 'dossier non vide': estDossierNonVide };

/** L'empreinte SHA-256 de la source `chemin` du pack `source` : celle de ses octets pour un fichier ; pour un dossier,
 *  celle de la liste triée de ses fichiers, une ligne « chemin relatif POSIX, espace, SHA-256 » par fichier. */
function empreinteDeSource(source: Source, chemin: string): string {
  if (NATURE_DE_SOURCE[source] === 'fichier') return sha256(readFileSync(chemin));
  const lignes = fichiersDe(chemin).map((f) => `${relative(chemin, f).split(sep).join('/')} ${sha256(readFileSync(f))}\n`).sort();
  return sha256(Buffer.from(lignes.join('')));
}

const contient = (racine: string, chemin: string): boolean => {
  const rel = relative(resolve(racine), chemin);
  return !isAbsolute(rel) && rel.split(sep)[0] !== '..';
};

/** `chemin` absolu, liens et jonctions résolus jusqu'à son plus proche ancêtre existant. */
function cheminReel(chemin: string): string {
  const absolu = resolve(chemin);
  for (let ancetre = absolu; ; ancetre = dirname(ancetre)) {
    if (existsSync(ancetre)) return join(realpathSync.native(ancetre), relative(ancetre, absolu));
    if (dirname(ancetre) === ancetre) return absolu;
  }
}

/** Le refus du texte de licence `licence` nommé pour le pack `source`, ou `null` s'il est un fichier d'un dossier
 *  ancêtre de la source dont la licence déclarée (`licenceDeclaree`) se résout par la table des licences. */
function refusDeLicence(table: ReadonlyMap<string, string>, source: string, licence: string): string | null {
  if (!estFichier(licence)) return `[licence-absente] ${licence} : texte de licence introuvable`;
  if (!contient(dirname(cheminReel(licence)), cheminReel(source))) return `[licence-hors-des-ancetres] ${licence} : hors des dossiers ancêtres de ${source}`;
  const declaree = licenceDeclaree(readFileSync(licence, 'utf8'));
  if (!declaree) return `[licence-sans-ligne] ${licence} : texte vide, ni ligne « License: » ni titre`;
  if (!table.has(declaree)) return `[licence-inconnue] ${licence} : « ${declaree} » absente de la table des licences`;
  return null;
}

/** Le dossier de production du GLB `glb`, ou le refus qui l'écarte : un GLB hors `.glb`, un dossier dans un arbre de
 *  travail du dépôt (liens résolus), un dossier qui porte un fichier que la production n'écrit pas, une source absente ou d'une autre nature que celle de son pack,
 *  un pack sans texte de licence nommé, un texte de licence absent, hors des dossiers ancêtres de sa source, sans
 *  licence déclarée ou hors de la table des licences. */
export function verifierProduction({ glb, sources, licences }: { glb: string; sources: SourcesDeBase; licences: LicencesDeBase }): { dossier: string } {
  if (!glb.endsWith('.glb')) throw new ProductionRefusee(`[sortie] ${glb} : un .glb attendu`);
  const dossier = dirname(resolve(glb));
  const arbres = worktreesDe(depotDe(DEPOT));
  if (!arbres) throw new ProductionRefusee(`[sortie] ${dossier} : arbres de travail du dépôt illisibles (git worktree list)`);
  const reel = cheminReel(dossier);
  const arbre = arbres.find((a) => contient(cheminReel(a.chemin), reel));
  if (arbre) throw new ProductionRefusee(`[sortie-dans-le-depot] ${dossier} : dans l'arbre ${arbre.chemin} ; un dossier de production reste hors dépôt (#2948, arbitrages n°14 et n°19)`);
  const ecrits = new Set([basename(glb), MANIFESTE_DE_PRODUCTION, ...SOURCES.map(copieDeLicence)]);
  const etrangers = existsSync(dossier) ? readdirSync(dossier).filter((f) => !ecrits.has(f)).sort() : [];
  if (etrangers.length) throw new ProductionRefusee(`[sortie-etrangere] ${dossier} : ${etrangers.join(', ')} ; le dossier de production ne porte que ${[...ecrits].join(', ')}`);
  const absentes = SOURCES.filter((s) => !EST_DE_NATURE[NATURE_DE_SOURCE[s]](sources[s]));
  if (absentes.length) throw new ProductionRefusee(`[source-absente] ${absentes.map((s) => `--${s} ${sources[s]} : ${NATURE_DE_SOURCE[s]} attendu`).join(', ')}`);
  const anonymes = SOURCES.filter((s) => !licences[s]);
  if (anonymes.length) throw new ProductionRefusee(`[licence-non-nommee] ${anonymes.map((s) => `--licence-${s}`).join(', ')}`);
  const table = chargerLicences();
  const refus = SOURCES.flatMap((s) => refusDeLicence(table, sources[s], licences[s]) ?? []);
  if (refus.length) throw new ProductionRefusee(refus.join('\n'));
  return { dossier };
}

/** Écrit le dossier de production du GLB `glb` de manifeste complet `manifeste` : la copie du texte de licence nommé
 *  pour chaque pack de `sources`, puis `manifest.json`. Rend les chemins écrits. */
export function ecrireProduction({ glb, manifeste, sources, licences }: { glb: string; manifeste: unknown; sources: SourcesDeBase; licences: LicencesDeBase }): string[] {
  const { dossier } = verifierProduction({ glb, sources, licences });
  const ecrits = SOURCES.map((s) => {
    const copie = join(dossier, copieDeLicence(s));
    copyFileSync(licences[s], copie);
    return copie;
  });
  const production = {
    model: basename(glb),
    model_sha256: sha256(readFileSync(glb)),
    manifeste,
    packs_sources: tableTotale(SOURCES, (s) => ({ path: resolve(sources[s]), sha256: empreinteDeSource(s, sources[s]), licence: copieDeLicence(s) })),
    [CLE_HORS_RELEASE]: HORS_RELEASE_DE_BASE,
  };
  const manifest = join(dossier, MANIFESTE_DE_PRODUCTION);
  ecrireTexteAtomique(manifest, `${JSON.stringify(production, null, 2)}\n`);
  return [...ecrits, manifest];
}
