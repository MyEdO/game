/**
 * Schéma de `river-criticals.json` — Critiques de coque fluviale (Mort sur le Reik Compagnon ch.5,
 * p.29). MÊME patron que `ship-criticals.json` (`ShipCritSet`, `src/data/shipCriticals.ts`), PROMU
 * dans `grammaire/mecanique.ts` (`shipCritEntrySchema`/`shipCrewHitSchema`), mais 5 Localisations DISTINCTES
 * (greement/avirons/gouvernail/coque/superstructure — pas de cargaison ni d'équipements côté
 * fluvial), sans `die` (absent du JSON, à la différence du jeu MDG) et sans `shrapnelHit` : MSRC
 * n'emploie JAMAIS le mot-clé « Éclats ». Le Gouvernail porte donc un coup CERTAIN à son servant,
 * `crewHit {role}` (MSRC 07 l.86, #1657 B3-2b-a). Une rangée fluviale qui gagnerait un Indice
 * d'Éclats sans table est une anomalie NOMMÉE par `applyHullCritical` (`src/engine/shipCritical.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { shipCritEntrySchema } from '../grammaire/mecanique';
import { replisSansExposeSchema } from '../grammaire/valeurs';
import { listeCle } from '../grammaire/collection-cle';

export const file = 'river-criticals.json';
export const famille = 'config';


const doc = document(
  'river-criticals',
  famille,
  {
    replisSansExpose: replisSansExposeSchema,
    tables: z.strictObject({
      greement: listeCle(shipCritEntrySchema, 'id'),
      avirons: listeCle(shipCritEntrySchema, 'id'),
      gouvernail: listeCle(shipCritEntrySchema, 'id'),
      coque: listeCle(shipCritEntrySchema, 'id'),
      superstructure: listeCle(shipCritEntrySchema, 'id'),
    }),
  },
  {
    replisSansExpose: {
      label: 'Repli sans équipage exposé',
      hint: 'Localisation qui encaisse le coup à l’Équipage quand aucun marin n’est exposé',
    },
    tables: { label: 'Critiques par Localisation', hint: 'Cinq tables sœurs : gréement, avirons, gouvernail, coque, superstructure' },
  },
  {
    codex: { keys: ['riverCriticalsGreement', 'riverCriticalsAvirons', 'riverCriticalsGouvernail', 'riverCriticalsCoque', 'riverCriticalsSuperstructure'] },
    edit: { niche: { categories: ['riverCriticalsGreement', 'riverCriticalsAvirons', 'riverCriticalsGouvernail', 'riverCriticalsCoque', 'riverCriticalsSuperstructure'] } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
