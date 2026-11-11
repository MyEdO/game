/**
 * Schéma de `careers.json` — dérivé du contenu RÉEL et de `CareerData`
 * (`src/data/index.ts`). Ses places au Tableau des Classes et Carrières aléatoires vivent dans
 * `carrieres-aleatoires.json` (LDB 05 l.214).
 *
 * `id` = slug du libellé, cible de `Combatant.career`, `CareerLevelData.career` et des pré-tirés.
 * `labelF` (clé d'ENVELOPPE) est la forme féminine d'AFFICHAGE — le LDB n'imprime QUE le masculin
 * (fiches ch. 07-08), donc féminisation standard FR MAISON ; omise = forme épicène.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { raceKeySchema } from '../grammaire/valeurs';
import { idDe, ref, refs } from '../grammaire/ref';
import { DECLARABLE_PAR_UN_PORTEUR } from '../grammaire/sousListes';

export const file = 'careers.json';
export const famille = 'entite';

const doc = document(
  'careers',
  famille,
  {
    /** Classe (`ClassData.id`). */
    class: ref('classe'),
    /** Ids de `groups.json` accordés au titulaire de cette carrière (`groupesDe`), en plus de ceux de
     *  sa Classe. Absent = la carrière n'ouvre aucun Groupe d'appartenance. */
    grantGroups: refs('groupe', { sousListe: DECLARABLE_PAR_UN_PORTEUR }).optional(),
    /** AA 02 l.137 ; ADE I 07 l.11-23 */
    races: z.array(raceKeySchema).optional(),
    /** ADE I 07 l.11, l.15, l.19, l.23 */
    aLaPlaceDe: idDe('career').optional(),
  },
  {
    class: { label: 'Classe' },
    grantGroups: { label: 'Groupes accordés' },
    races: { label: 'Races', hint: 'Présentes : seules ces races tirent cette carrière au Tableau des Classes et Carrières aléatoires' },
    aLaPlaceDe: { label: 'À la place de', hint: 'Présente : qui tire cette carrière au Tableau peut choisir celle-ci à la place' },
  },
  {
    codex: { keys: ['careers'] },
    edit: { dataset: 'careers' },
  },
  { exiges: ['desc', 'source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
