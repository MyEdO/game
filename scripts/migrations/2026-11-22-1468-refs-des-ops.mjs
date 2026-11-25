/**
 * Migration #1468 — les références de maladie, de symptôme, de créature, de table et de facteur de
 * Manann d’une opération deviennent des objets `{ id }`.
 *
 * Entrées : tous les jeux de données `src/data/*.json` et tous les projets livrés `<x>-projet.json` sous `projets/` (`cheminsDesProjetsLivres`).
 * Un identifiant absent de son catalogue ou une clé de destination déjà présente arrête la migration
 * avant toute écriture.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';
import { emboiterLesRefsDOps } from './lib/refsDOpsEmboitees.mjs';
import { cheminsDesProjetsLivres } from '../guards/lib/projetsLivres.mjs';

const racine = fileURLToPath(new URL('../../', import.meta.url));
const dossierDesDonnees = join(racine, 'src/data');
const lire = (fichier) => JSON.parse(readFileSync(join(dossierDesDonnees, fichier), 'utf8'));
const regleDe = (catalogue, entrees = lire(catalogue)) => ({ ids: new Set(entrees.map((e) => e.id)), catalogue });

const maladie = regleDe('maladies.json');
const symptome = { ...regleDe('symptoms.json'), vers: 'symptom' };
const creature = { ...regleDe('creatures.json'), vers: 'creature' };
const table = { ...regleDe('tables.json'), vers: 'table' };
const facteur = { ...regleDe('sea-events.json#manann.factors', lire('sea-events.json').manann.factors), vers: 'facteur' };
const symptomeDeMaladie = { disease: maladie, symptomId: symptome };

const canoniqueDeScene = (doc) => `${JSON.stringify(doc, null, 1)}\n`;
const documents = [
  ...readdirSync(dossierDesDonnees).filter((f) => f.endsWith('.json'))
    .map((f) => ({ rel: `src/data/${f}`, canonique: serializeDataset })),
  ...cheminsDesProjetsLivres(racine).map((rel) => ({ rel, canonique: canoniqueDeScene })),
];

emboiterLesRefsDOps(racine, documents, {
  aggravateSymptom: symptomeDeMaladie,
  attenuateSymptom: symptomeDeMaladie,
  grantSymptom: symptomeDeMaladie,
  exposeDisease: { disease: { ...maladie, ids: new Set([...maladie.ids, '$arg']) } },
  contractDisease: { disease: maladie },
  reduceDiseaseDays: { disease: maladie },
  suppressSymptom: { symptomId: symptome },
  summon: { ref: creature },
  scheduleRespawn: { ref: { ...creature, ids: new Set([...creature.ids, 'self']) } },
  polymorph: { ref: creature },
  transform: { morphRef: creature },
  rollTable: { tableId: table },
  manann: { factorId: facteur },
}, 'migration 1468 (références d’opérations emboîtées)');
