/**
 * Schéma de `groups.json` — registre des Groupes d'APPARTENANCE (LDB 21, Traits psy ciblés), miroir de
 * `GroupData` (`src/data/index.ts`). Une entrée porte `id`+`label` ; un Groupe JOKER (`tout`, `vivant`)
 * porte le couple `matchesAll`/`exceptGroups`.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { refs } from '../grammaire/ref';

export const file = 'groups.json';
export const famille = 'entite';

const doc = document(
  'groups',
  famille,
  {
    /** Groupe-CIBLE JOKER : il vise n'importe quel combattant (`groupMatch`), hormis les porteurs
     *  d'un `exceptGroups`. Absent = appartenance STRICTE par id. */
    matchesAll: z.literal(true).optional(),
    /** Ids de `groups.json` RETRANCHÉS du joker — un combattant qui en porte un n'est pas visé. */
    exceptGroups: refs('groupe').optional(),
  },
  {
    matchesAll: { label: 'Groupe joker', hint: 'Vise tout combattant, hormis les porteurs d’un Groupe exclu' },
    exceptGroups: { label: 'Groupes exclus', hint: 'Groupes qui retranchent leur porteur du joker' },
  },
  {
    codex: { keys: ['groups'] },
    edit: { dataset: 'groups' },
  },
  // `matchesAll` : marqueur de la sous-liste `DECLARABLE_PAR_UN_PORTEUR` (`grammaire/sousListes.ts`).
  { espace: { marqueurs: ['matchesAll'] } },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
