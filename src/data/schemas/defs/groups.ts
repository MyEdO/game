/**
 * Schéma de `groups.json` — registre des Groupes d'APPARTENANCE (LDB 21, Traits psy ciblés), miroir de
 * `GroupData` (`src/data/index.ts`). Une entrée porte `id`+`label` ; un Groupe JOKER (`tout`, `vivant`)
 * porte le couple `matchesAll`/`exceptGroups` ; un Groupe RELATIF, son `relatif` ; une Race, son marqueur
 * `race` (ADE II 09 l.15).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { refs } from '../grammaire/ref';
import { CIBLE_D_APPARTENANCE } from '../grammaire/sousListes';
import { enumNomme } from '../grammaire/valeurs';
import { MOTIF_D_ID_DE_GROUPE } from '../../../engine/psych/ciblage';

export const file = 'groups.json';

/** Les Groupes relatifs, chacun lu par `vise` : Engagés avec le porteur (LDB 85 l.282), hors de son camp et de
 *  ses liens (Préjugé (Étrangers)), d'une autre Race que la sienne (LDB 19 l.152 ; EDOC 12 l.219). #3045 */
export const relatifSchema = enumNomme({
  engagesAvecPorteur: 'Engagés avec le porteur',
  etrangersAuPorteur: 'Étrangers au porteur',
  autresRacesQueLePorteur: 'D’une autre Race que le porteur',
});
export type Relatif = z.infer<typeof relatifSchema>;
export const famille = 'entite';

const doc = document(
  'groups',
  famille,
  {
    /** Groupe-CIBLE JOKER : il vise n'importe quel combattant (`groupMatch`), hormis les porteurs
     *  d'un `exceptGroups`. Absent = appartenance STRICTE par id. */
    matchesAll: z.literal(true).optional(),
    /** Ids de `groups.json` RETRANCHÉS du joker — un combattant qui en porte un n'est pas visé. */
    exceptGroups: refs('groupe', { sousListe: CIBLE_D_APPARTENANCE }).optional(),
    /** Groupe-CIBLE RELATIF : ses membres se lisent par rapport au PORTEUR du Trait psy qui le vise
     *  (`vise`, `engine/psychology.ts`) ; personne ne le déclare. #3045 */
    relatif: relatifSchema.optional(),
    /** Ce Groupe est une Race (ADE II 09 l.15), lue par les Groupes relatifs de Race. #3045 */
    race: z.literal(true).optional(),
  },
  {
    matchesAll: { label: 'Groupe joker', hint: 'Vise tout combattant, hormis les porteurs d’un Groupe exclu' },
    exceptGroups: { label: 'Groupes exclus', hint: 'Groupes qui retranchent leur porteur du joker' },
    relatif: { label: 'Groupe relatif', hint: 'Ses membres se lisent par rapport au porteur du Trait psy qui le vise' },
    race: { label: 'Race', hint: 'Ce Groupe est une Race' },
  },
  {
    codex: { keys: ['groups'] },
    edit: { dataset: 'groups' },
  },
  // `matchesAll`, `relatif` : marqueurs des sous-listes `DECLARABLE_PAR_UN_PORTEUR`, `CIBLE_D_APPARTENANCE`
  // (`grammaire/sousListes.ts`).
  {
    espace: { marqueurs: ['matchesAll', 'relatif'] },
    idDocument: z.string().regex(MOTIF_D_ID_DE_GROUPE, `id de Groupe : minuscules, chiffres et tirets (${MOTIF_D_ID_DE_GROUPE.source}).`),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
