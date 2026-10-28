/**
 * Schéma de `careers.json` — dérivé du contenu RÉEL et de `CareerData`
 * (`src/data/index.ts`). `rand` = Tableau des Classes et Carrières aléatoires
 * (LDB 05 l.197+) : borne haute d100 par colonne d'espèce, `null` = carrière indisponible pour
 * cette espèce (l.360). Deux jeux de clés distincts observés (2 key-sets, cohérent
 * avec les colonnes d'espèce qui varient selon que la carrière est ouverte aux races additionnelles).
 *
 * `id` = slug du libellé, cible de `Combatant.career`, `CareerLevelData.career` et des pré-tirés.
 * `labelF` (clé d'ENVELOPPE) est la forme féminine d'AFFICHAGE — le LDB n'imprime QUE le masculin
 * (fiches ch. 07-08), donc féminisation standard FR MAISON ; omise = forme épicène.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { refCareerIdSchema } from '../grammaire/valeurs';
import { refs } from '../grammaire/ref';
import { DECLARABLE_PAR_UN_PORTEUR } from '../grammaire/sousListes';

export const file = 'careers.json';
export const famille = 'entite';

const doc = document(
  'careers',
  famille,
  {
    /** `id` de la Classe (`ClassData.id`). */
    class: z.string(),
    /** Ids de `groups.json` accordés au titulaire de cette carrière (`groupesDe`), en plus de ceux de
     *  sa Classe. Absent = la carrière n'ouvre aucun Groupe d'appartenance. */
    grantGroups: refs('groupe', { sousListe: DECLARABLE_PAR_UN_PORTEUR }).optional(),
    /** id d'une tenue spécifique (`TENUE_BY_ID`) réutilisée par cette carrière quand son rendu
     *  reprend la tenue d'une autre carrière (variants MDG « (Côtier) », MDG 09 l.255/343/458). */
    tenue: z.string().optional(),
    /** Clé = `refCareerIdSchema` (id stable, #313) → borne haute d100 ; clé ABSENTE = carrière
     *  indisponible pour cette espèce (partiel : toutes les carrières ne portent pas les 11 colonnes). */
    rand: z.partialRecord(refCareerIdSchema, z.number().nullable()),
  },
  {
    class: { label: 'Classe' },
    grantGroups: { label: 'Groupes accordés' },
    tenue: { label: 'Tenue réutilisée', hint: 'Identifiant d’une tenue spécifique reprise par cette carrière' },
    rand: { label: 'Seuil aléatoire (d100)', hint: 'Borne haute par colonne d’espèce du Tableau des Classes et Carrières' },
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
