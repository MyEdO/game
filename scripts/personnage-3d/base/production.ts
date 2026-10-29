/**
 * LE DOSSIER DE PRODUCTION D'UNE BASE (#3106) : le dossier du GLB construit, écrit tel que l'import le lit
 * (`hotes/godot/asset/importer.ts`, `dossierDeProduction.ts`). Chaque fichier a une source :
 * - le GLB, exporté par la construction (`humanoide.py`) ;
 * - `manifest.json` : `model` et `model_sha256` pris au GLB, `manifeste` le manifeste complet (`manifeste.mjs`),
 *   `animation_sources` le chemin et l'empreinte de chaque pack de clips, `hors_release` la raison qui tient la base
 *   hors Release (#2948, arbitrages n°14 et n°19) ;
 * - `LICENSE-<source>.txt` : la copie octet pour octet du texte de licence de chaque pack source, lu dans le pack.
 * Le dossier reste hors de tout arbre de travail du dépôt.
 */
import { copyFileSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ecrireTexteAtomique } from '../../guards/lib/ecritureJsonAtomique.mjs';
import { depotDe, worktreesDe } from '../../guards/lib/gitPorte.mjs';
import { CLE_HORS_RELEASE, MANIFESTE_DE_PRODUCTION } from '../../../hotes/godot/asset/dossierDeProduction.ts';
import { sha256 } from '../../../hotes/godot/asset/empreinte.ts';
import { tableTotale } from '../../../src/lib/tableTotale.ts';

/** Les packs dont une base se construit : les deux bibliothèques de clips et le corps. */
export interface SourcesDeBase { readonly ual1: string; readonly ual2: string; readonly corps: string }
type Source = keyof SourcesDeBase;
const SOURCES: readonly Source[] = ['ual1', 'ual2', 'corps'];
/** Les packs qui fournissent les clips de la base. */
const SOURCES_D_ANIMATION: readonly Source[] = ['ual1', 'ual2'];

/** La raison qui tient une base de packs Quaternius hors Release : #2948, arbitrages n°14 et n°19. */
export const HORS_RELEASE_DE_BASE = "base d'essai construite de packs Quaternius (UAL, UBC), jamais en Release (#2948, arbitrages n°14 et n°19)";

const TEXTE_DE_LICENCE = /^license.*\.txt$/i;
const DEPOT = fileURLToPath(new URL('.', import.meta.url));

export class ProductionRefusee extends Error {
  constructor(raison: string) {
    super(raison);
    this.name = 'ProductionRefusee';
  }
}

/** Le texte de licence du pack de `source` : le `License*.txt` du premier dossier parent qui en contient un. */
export function licenceDuPack(source: string): string {
  for (let dossier = dirname(resolve(source)); ; dossier = dirname(dossier)) {
    const textes = readdirSync(dossier, { withFileTypes: true }).filter((e) => e.isFile() && TEXTE_DE_LICENCE.test(e.name)).map((e) => e.name);
    if (textes.length > 1) throw new ProductionRefusee(`[licence-ambigue] ${source} : plusieurs textes de licence dans ${dossier} (${textes.sort().join(', ')})`);
    if (textes.length === 1) return join(dossier, textes[0]!);
    if (dirname(dossier) === dossier) throw new ProductionRefusee(`[licence-introuvable] ${source} : aucun License*.txt dans ses dossiers parents`);
  }
}

const contient = (racine: string, chemin: string): boolean => {
  const rel = relative(resolve(racine), chemin);
  return !isAbsolute(rel) && rel.split(sep)[0] !== '..';
};

/** Le dossier de production du GLB `glb` et le texte de licence de chaque pack de `sources`, ou le refus qui les écarte :
 *  un GLB hors `.glb`, un dossier dans un arbre de travail du dépôt, une source absente, une licence introuvable. */
export function verifierProduction({ glb, sources }: { glb: string; sources: SourcesDeBase }): { dossier: string; licences: Record<Source, string> } {
  if (!glb.endsWith('.glb')) throw new ProductionRefusee(`[sortie] ${glb} : un .glb attendu`);
  const dossier = dirname(resolve(glb));
  const arbres = worktreesDe(depotDe(DEPOT));
  if (!arbres) throw new ProductionRefusee(`[sortie] ${dossier} : arbres de travail du dépôt illisibles (git worktree list)`);
  const arbre = arbres.find((a) => contient(a.chemin, dossier));
  if (arbre) throw new ProductionRefusee(`[sortie-dans-le-depot] ${dossier} : dans l'arbre ${arbre.chemin} ; un dossier de production reste hors dépôt (#2948, arbitrages n°14 et n°19)`);
  const absentes = SOURCES.filter((s) => !(existsSync(sources[s]) && statSync(sources[s]).isFile()));
  if (absentes.length) throw new ProductionRefusee(`[source-absente] ${absentes.map((s) => `--${s} ${sources[s]}`).join(', ')}`);
  return { dossier, licences: tableTotale(SOURCES, (s) => licenceDuPack(sources[s])) };
}

/** Écrit le dossier de production du GLB `glb` de manifeste complet `manifeste` : les textes de licence des packs de
 *  `sources`, puis `manifest.json`. Rend les chemins écrits. */
export function ecrireProduction({ glb, manifeste, sources }: { glb: string; manifeste: unknown; sources: SourcesDeBase }): string[] {
  const { dossier, licences } = verifierProduction({ glb, sources });
  const ecrits = SOURCES.map((s) => {
    const copie = join(dossier, `LICENSE-${s}.txt`);
    copyFileSync(licences[s], copie);
    return copie;
  });
  const production = {
    model: basename(glb),
    model_sha256: sha256(readFileSync(glb)),
    manifeste,
    animation_sources: tableTotale(SOURCES_D_ANIMATION, (s) => ({ path: resolve(sources[s]), sha256: sha256(readFileSync(sources[s])) })),
    [CLE_HORS_RELEASE]: HORS_RELEASE_DE_BASE,
  };
  const manifest = join(dossier, MANIFESTE_DE_PRODUCTION);
  ecrireTexteAtomique(manifest, `${JSON.stringify(production, null, 2)}\n`);
  return [...ecrits, manifest];
}
