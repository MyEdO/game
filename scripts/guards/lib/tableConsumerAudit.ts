/**
 * AUDIT des tables d'effets SANS CONSOMMATEUR (#734) — définition UNIQUE de la mesure, partagée par
 * la garde `src/data/tables.test.ts` et la régénération de `tableConsumerStock.mjs` (`regenerations`).
 * Deux lectures divergentes du corpus laisseraient l'une écrire ce que l'autre refuse.
 *
 * Classe de défaut mesurée : une entrée de `tables.json` que NI une autre donnée (`src/data/*.json`,
 * y compris une AUTRE table via son `tableId`) NI le code de prod de `src/` (hors tests, hors
 * commentaires, hors `*.generated.ts`) ne porte par son id en toutes lettres — jeton de chaîne CITÉ
 * complet — ne sera jamais tirée au runtime.
 *
 * Le FICHIER du site est le dataset où la table est DÉCLARÉE : c'est lui que la porte de plage
 * (`croissanceDesStocks`) voit, et celui que l'auteur ouvre pour câbler.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerDossier } from './lister.mjs';
import { readCorpus } from './sourceCorpus.mjs';
import { effectTables } from '../../../src/data/index';
import type { Site } from './stock.mjs';
import { DECROISSANT, type RegenerationDeStock } from './stockDeSites.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
/** Dossier des données, et le dataset que NOMMENT les entrées du stock. */
export const DOSSIER_DONNEES = join(RACINE, 'src/data');
export const DATASET_TABLES = 'src/data/tables.json';

/** DÉCLARATION d'une table dans `tables.json` : `"id"`, la clé d'ENVELOPPE `"type"`, puis `"label"`.
 *  Retirée du corpus pour qu'une table ne se compte pas elle-même. `type` reste OPTIONNEL dans le
 *  motif : le fichier a vécu sans lui, et un motif qui l'exigerait mentirait sur l'historique. */
export const MOTIF_DECLARATION = /"id":\s*"[^"]*"\s*,\s*(?:"type":\s*"[^"]*"\s*,\s*)?(?="label")/g;

/** Corpus des consommateurs : `tables.json` privé de ses seules DÉCLARATIONS d'id (pour que les
 *  `tableId` d'une table vers une autre comptent), les autres données `src/data/*.json`, + le code
 *  de prod `src/**` (hors tests, COMMENTAIRES retirés — sinon un id cité en commentaire « solde »
 *  une orpheline sans câblage réel ; hors `*.generated.ts` — un INDEX généré de la donnée énumère
 *  tous les ids sans en consommer aucun, cf. `schemas/_ids.generated.ts`). */
export function consumerCorpus(): string {
  let corpus = '';
  const fichiers = listerDossier(DOSSIER_DONNEES).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
  for (const f of fichiers) {
    const raw = readFileSync(join(DOSSIER_DONNEES, f), 'utf8');
    // Sans le maillon `type` (#1467 L1b V-FLIP-ENTITE-b), le retrait ne mordait plus : la
    // déclaration RESTAIT dans le corpus et chaque table s'y comptait comme sa propre
    // consommatrice. Le motif est VERROUILLÉ par un test de `src/data/tables.test.ts`.
    corpus += f === 'tables.json' ? raw.replace(MOTIF_DECLARATION, '') : raw;
  }
  const sansCommentaires = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const { rel, text } of readCorpus(['src'])) {
    if (rel.endsWith('.generated.ts')) continue;
    corpus += sansCommentaires(text);
  }
  return corpus;
}

/** Un id compte comme consommé s'il apparaît comme jeton de chaîne CITÉ complet (`"<id>"` ou
 *  `'<id>'`) — jamais une sous-chaîne nue (prose, id plus long, mention non citée). */
export const isConsumed = (corpus: string, id: string): boolean =>
  corpus.includes(`"${id}"`) || corpus.includes(`'${id}'`);

/** Les tables d'effets orphelines, en SITES `{ file, ref }`. */
export function sitesTableOrpheline(): Site[] {
  const corpus = consumerCorpus();
  return effectTables
    .filter((t) => !isConsumed(corpus, t.id))
    .map((t) => ({ file: DATASET_TABLES, ref: t.id }));
}

export const MOTIF_TABLE_ORPHAN =
  "Une table neuve sans consommateur se CÂBLE (op `rollTable`, `tableId` d'une autre table, appel code), elle ne s'entérine pas ici.";

/** La RÉGÉNÉRATION de `tableConsumerStock.mjs`, sur des sites (par défaut, la mesure du dépôt). Commande :
 *  `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/tableConsumerAudit.ts [--check]`. */
export const regenerations = (sites: readonly Site[] = sitesTableOrpheline()): RegenerationDeStock[] => [{
  chemin: fileURLToPath(new URL('./tableConsumerStock.mjs', import.meta.url)),
  politique: DECROISSANT,
  collections: [{ nom: 'TABLE_ORPHAN_RATCHET', sites, motif: MOTIF_TABLE_ORPHAN }],
}];
