/**
 * AUDIT « le FOLIO déclaré tombe-t-il sur la LIGNE citée ? » en SITES (#1318, #1727) — la
 * TRADUCTION en sites est UNIQUE, partagée par la garde `src/data/folio-line-align.test.ts` et la
 * régénération de `folioLineAlignStock.mjs` (`regenerations`) : deux lectures divergentes du corpus
 * laisseraient l'une écrire ce que l'autre refuse. `auditFolioLineAlign` leur donne aussi la même
 * RÉSOLUTION du dossier de données, chacun n'ouvrant le disque qu'une fois.
 *
 * La MÉCANIQUE de mesure vit dans `folioLineAlign.mjs` (module ESM pur, `auditDataDir` /
 * `auditAlignment`) : ce module-ci n'en TRADUIT que la sortie en `{ file, ref }`, la forme que
 * `sitesEnEntrees` (`stock.mjs`) ordinalise en entrées `{ fichier, ref, occurrence }`.
 *
 * Le `file` d'un site est le dataset à OUVRIR (`src/data/<dataset>.json`) — c'est lui que la porte
 * de plage (`croissanceDesStocks`) voit ; une clé `<dataset>#<id>` lui est INVISIBLE (le `#` casse le
 * motif de chemin de `stocksNominatifs.mjs`), et un append n'y coûte alors rien.
 *
 * Ce que le stock NE PORTE PAS, et pourquoi : la citation et les deux folios (« VDM 03 l.40 » →
 * mesuré 35, déclaré 36). Ils sont RENDUS par la mesure — `citationsParCle` ci-dessous les pose dans
 * la phrase de rouge, depuis le disque du jour. Une copie gelée dans le stock dirait le folio d'hier
 * après une ré-extraction Marker, et toute prose posée entre les entrées est de toute façon mangée à
 * la régénération (`regenStock.mts`).
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditDataDir } from './folioLineAlign.mjs';
import type { AlignReport, AlignViolation, IgnoredEntry } from './folioLineAlign.mjs';
import type { Site } from './stock.mjs';
import { DECROISSANT, type RegenerationDeStock } from './stockDeSites.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** Dossier des datasets, et le préfixe de chemin que portent les entrées des deux stocks. */
export const DOSSIER_DATA = 'src/data';

/** Audit du corpus réel — `dataDir` relatif à la racine du dépôt, ou absolu. */
export const auditFolioLineAlign = (dataDir: string = DOSSIER_DATA): AlignReport =>
  auditDataDir(resolve(RACINE, dataDir));

/** Un SITE par entrée DÉSALIGNÉE : `{ file: 'src/data/<dataset>.json', ref: '<id>' }`. PUR. */
export const sitesDesViolations = (violations: readonly AlignViolation[]): Site[] =>
  violations.map((v) => ({ file: `${DOSSIER_DATA}/${v.file}`, ref: v.id }));

/** Un SITE par entrée que le détecteur REFUSE de juger (tout motif sauf `hors-forme` : la citation
 *  est bien formée, mais l'extraction ne porte pas d'ancre exploitable). PUR. */
export const sitesDesNonJugeables = (ignored: readonly IgnoredEntry[]): Site[] =>
  ignored.filter((i) => i.reason !== 'hors-forme').map((i) => ({ file: `${DOSSIER_DATA}/${i.file}`, ref: i.id }));

/** La citation et les DEUX folios d'un désalignement — ce que le stock ne grave pas et que le rouge
 *  doit dire. La clé est le fragment `<fichier> :: <ref>` de `cleDeSite` (`stock.mjs`), pour qu'une
 *  ligne de remède se reconnaisse par simple inclusion. PUR. */
export const citationsParCle = (violations: readonly AlignViolation[]): Map<string, string> =>
  new Map(violations.map((v) => [
    `${DOSSIER_DATA}/${v.file} :: ${v.id}`,
    `« ${v.cite} » tombe sous data-folio="${v.folio}", source.page dit ${v.page}`,
  ]));

/** Le MOTIF du volet DÉSALIGNEMENT, dernière phrase du refus de `refusDeCroissance` (`stock.mjs`). */
export const MOTIF_FOLIO_DESALIGNE =
  'Un désalignement neuf se RELÈVE au `Source/` (marqueur `data-folio`) et se corrige côté DONNÉE : '
  + "c'est l'une des deux citations qui ment, jamais les deux — il ne s'entérine pas ici.";

/** Le MOTIF du volet NON JUGEABLE. */
export const MOTIF_FOLIO_NON_JUGEABLE =
  "Une entrée neuve hors de portée du détecteur se RELÈVE à la main au `Source/` avant d'être gelée : "
  + 'la geler sans relevé ferait passer un folio non vérifié pour une couverture tenue.';

/** La RÉGÉNÉRATION de `folioLineAlignStock.mjs`, ses deux collections sur UN rapport (par défaut,
 *  celui du corpus réel). Commande :
 *  `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/folioLineAlignAudit.ts [--check]`. */
export const regenerations = (rapport: AlignReport = auditFolioLineAlign()): RegenerationDeStock[] => [{
  chemin: fileURLToPath(new URL('./folioLineAlignStock.mjs', import.meta.url)),
  politique: DECROISSANT,
  collections: [
    { nom: 'FOLIO_LINE_ALIGN_RATCHET', sites: sitesDesViolations(rapport.violations), motif: MOTIF_FOLIO_DESALIGNE },
    { nom: 'FOLIO_LINE_ALIGN_NON_JUGEABLE', sites: sitesDesNonJugeables(rapport.ignored), motif: MOTIF_FOLIO_NON_JUGEABLE },
  ],
}];
