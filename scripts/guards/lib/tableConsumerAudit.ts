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
import { enregistrementsPropres, isConsumed } from './entityConsumers.mjs';
import { effectTables } from '../../../src/data/index';
import type { Site } from './stock.mjs';
import { DECROISSANT, type RegenerationDeStock } from './stockDeSites.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
/** Dossier des données, et le dataset que NOMMENT les entrées du stock. */
export const DOSSIER_DONNEES = join(RACINE, 'src/data');
export const DATASET_TABLES = 'src/data/tables.json';

/** L'ENREGISTREMENT PROPRE de chaque table (`enregistrementsPropres`, `entityConsumers.mjs`), clé
 *  `tables:<id>` : la table privée de sa clé `id`, sa déclaration. */
const propresDesTables = (): Map<string, string> => enregistrementsPropres(DOSSIER_DONNEES, { tables: 'tables.json' });

/** Corpus des consommateurs : `tables.json` réduit aux ENREGISTREMENTS PROPRES de ses tables (pour
 *  que les `tableId` d'une table vers une autre comptent), les autres données `src/data/*.json`, + le
 *  code de prod `src/**` (hors tests, COMMENTAIRES retirés — sinon un id cité en commentaire « solde »
 *  une orpheline sans câblage réel ; hors `*.generated.ts` — un INDEX généré de la donnée énumère
 *  tous les ids sans en consommer aucun, cf. `schemas/_ids.generated.ts`). */
export function consumerCorpus(propres: Map<string, string> = propresDesTables()): string {
  let corpus = '';
  const fichiers = listerDossier(DOSSIER_DONNEES).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
  for (const f of fichiers) {
    corpus += f === 'tables.json' ? [...propres.values()].join('\n') : readFileSync(join(DOSSIER_DONNEES, f), 'utf8');
  }
  const sansCommentaires = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const { rel, text } of readCorpus(['src'])) {
    if (rel.endsWith('.generated.ts')) continue;
    corpus += sansCommentaires(text);
  }
  return corpus;
}

/** Les tables d'effets orphelines, en SITES `{ file, ref }` : le prédicat `isConsumed` PARTAGÉ
 *  (`entityConsumers.mjs`), qui décompte les citations de son propre id qu'une table porte dans
 *  son enregistrement. */
export function sitesTableOrpheline(): Site[] {
  const propres = propresDesTables();
  const corpus = consumerCorpus(propres);
  return effectTables
    .filter((t) => !isConsumed(corpus, t.id, propres.get(`tables:${t.id}`)))
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
