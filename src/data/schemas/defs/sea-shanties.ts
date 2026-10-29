/**
 * Schéma de `sea-shanties.json` — Chansons de marin (MDG 9), `SeaShantyData`
 * (`src/data/index.ts`). `crewOps`/`captainOps` = `GameOp[]` (même vocabulaire que
 * traits/qualités). `note` = clause RAW laissée à l'arbitrage MJ, affichée telle quelle (jamais un
 * effet inventé).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { executeesDe } from '../grammaire/mecanique';

export const file = 'sea-shanties.json';
export const famille = 'entite';

const doc = document(
  'sea-shanties',
  famille,
  {
    crewOps: executeesDe().optional(),
    captainOps: executeesDe().optional(),
    note: z.string().optional(),
  },
  {
    crewOps: { label: 'Effets sur l’équipage', hint: 'Effets mécaniques appliqués à l’équipage tant que la chanson est entonnée' },
    captainOps: { label: 'Effets sur le capitaine', hint: 'Effets mécaniques appliqués au capitaine tant que la chanson est entonnée' },
    note: { label: 'Clause laissée au jeu', hint: 'Clause RAW non chiffrée, affichée verbatim (jamais un effet inventé)' },
  },
  {
    codex: { keys: ['seaShanties'] },
    edit: { dataset: 'seaShanties' },
  },
  { exiges: ['desc', 'source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
