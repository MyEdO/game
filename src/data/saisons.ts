/**
 * Les SAISONS (`Season`, `src/engine/travelStages.ts`) telles que la donnée les déclare
 * (`weather.json › seasons[]`, éditable au Codex). Module FEUILLE, sans la façade `data/index` : la
 * grammaire le lit (`parSaison`, `grammaire/valeurs.ts`) et la façade l'importe.
 */
import weatherJson from './weather.json';
import { indexParId } from './versionDataset';

/** La fiche d'une saison par son id STABLE, LIVE (le tableau est réécrit en place à l'édition). */
export const saisonParId = indexParId('weather', weatherJson.seasons);
