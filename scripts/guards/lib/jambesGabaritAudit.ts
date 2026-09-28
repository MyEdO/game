/**
 * AUDIT de la migration de la JAMBE vers le gabarit partagé (#633) — définition UNIQUE,
 * partagée par la garde `src/gameIso/rig/parts/tenues/jambes-gabarit-ratchet.test.ts` et la
 * régénération de `jambesGabaritStock.mjs` (`regenerations`). Deux lectures divergentes du corpus
 * laisseraient l'une écrire ce que l'autre refuse.
 *
 * Classe de défaut mesurée : une tenue qui redessine sa jambe INLINE au lieu de consommer le gabarit
 * `jambeVetue` (`parts/bodies/jambe-gabarit.ts`) — elle recopie le défaut de galbe genou/mollet que
 * le gabarit corrige UNE fois. Le scan porte sur les SOURCES `defs/*.ts` : un `jambes:` qui n'appelle
 * NI `jambeVetue(` NI `BODIES.` est encore inline.
 *
 * Le FICHIER du site est celui que le scan a ouvert — pas besoin de l'index généré ici, la mesure
 * part déjà du disque. C'est lui que la porte de plage voit, et lui que l'artiste ouvre pour migrer.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerDossier } from './lister.mjs';
import type { Site } from './stock.mjs';
import { DECROISSANT, type RegenerationDeStock } from './stockDeSites.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
/** Dossier des defs de tenue, et le préfixe de chemin que portent les entrées du stock. */
export const DOSSIER_DEFS = 'src/gameIso/rig/parts/tenues/defs';

/** Le TEXTE de la valeur `jambes:` d'une source (jusqu'à la virgule/fermeture de rang 0). */
export function jambesRegion(src: string): string {
  const m = src.match(/jambes:\s*/);
  if (!m || m.index == null) return '';
  let depth = 0, tick = false, out = '';
  for (let i = m.index + m[0].length; i < src.length; i++) {
    const c = src[i];
    if (c === '`') { tick = !tick; out += c; continue; }
    if (tick) { out += c; continue; }
    if ('{(['.includes(c)) depth++;
    else if ('})]'.includes(c)) { if (depth === 0) break; depth--; }
    else if (c === ',' && depth === 0) break;
    out += c;
  }
  return out;
}

function idOf(src: string, file: string): string {
  const m = src.match(/\bid:\s*["']([^"']+)["']/);
  if (!m) throw new Error(`def sans id STABLE : ${file}`);
  return m[1];
}

/**
 * Un SITE par def dont la jambe est encore INLINE :
 * `{ file: 'src/gameIso/rig/parts/tenues/defs/<Nom>.ts', ref: '<id>:jambes:inline' }`.
 * C'est la forme que `sitesEnEntrees` (`guards/lib/stock.mjs`) ordinalise en entrées de site.
 *
 * @param dossier Dossier LU, relatif à la racine du dépôt ou absolu (`resolve`) — le défaut est le
 *   corpus réel. Une garde qui veut MORDRE (forger une migration) en donne une COPIE hors arbre :
 *   le `file` rendu garde le préfixe `DOSSIER_DEFS`, la clé de stock reste donc comparable.
 */
export function sitesJambeInline(dossier: string = DOSSIER_DEFS): Site[] {
  const sites: Site[] = [];
  const dir = resolve(RACINE, dossier);
  for (const nom of listerDossier(dir).filter((f) => f.endsWith('.ts'))) {
    const src = readFileSync(join(dir, nom), 'utf8');
    if (!/jambes:/.test(src)) continue;
    const migre = /jambeVetue\s*\(/.test(src) || /BODIES\./.test(jambesRegion(src));
    if (!migre) sites.push({ file: `${DOSSIER_DEFS}/${nom}`, ref: `${idOf(src, nom)}:jambes:inline` });
  }
  return sites;
}

/** Le MOTIF du volet, dernière phrase du refus de `refusDeCroissance` (`stock.mjs`). */
export const MOTIF_JAMBE_INLINE =
  "Une jambe inline neuve se MIGRE (`jambeVetue(` / `BODIES.`), elle ne s'entérine pas ici ; une silhouette "
  + 'volontairement hors gabarit s\'inscrit À LA MAIN dans JAMBE_SILHOUETTE_OVERRIDES, sous revue.';

/** La RÉGÉNÉRATION de `jambesGabaritStock.mjs`, sur des sites (par défaut, la mesure du dépôt). Commande :
 *  `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/jambesGabaritAudit.ts [--check]`. */
export const regenerations = (sites: readonly Site[] = sitesJambeInline()): RegenerationDeStock[] => [{
  chemin: fileURLToPath(new URL('./jambesGabaritStock.mjs', import.meta.url)),
  politique: DECROISSANT,
  collections: [{ nom: 'JAMBE_INLINE_RATCHET', sites, motif: MOTIF_JAMBE_INLINE }],
}];
