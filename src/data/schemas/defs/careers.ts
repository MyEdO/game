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
import { ref, refs, specRef } from '../grammaire/ref';
import { DECLARABLE_PAR_UN_PORTEUR } from '../grammaire/sousListes';

export const file = 'careers.json';
/** Les champs qui bornent la substitution `aLaPlaceDe`, refusés sans elle. */
export const BORNES_DE_LA_SUBSTITUTION = ['especesALaPlaceDe', 'talentALaPlaceDe'] as const;
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
    /** ADE I 07 l.11-23 ; Middenheim 09 l.57 ; AA 05 l.135-140 ; VDM 03 l.11 */
    aLaPlaceDe: ref('career').optional(),
    /** Middenheim 09 l.57 ; AA 05 l.135 ; ADE I 07 l.11 */
    especesALaPlaceDe: refs('species').optional(),
    /** AA 05 l.137 */
    talentALaPlaceDe: specRef('talent').optional(),
    /** ADE I 07 l.9 */
    gatedByRule: ref('regleOptionnelle').optional(),
  },
  {
    class: { label: 'Classe' },
    grantGroups: { label: 'Groupes accordés' },
    races: { label: 'Races', hint: 'Présentes : seules ces races tirent cette carrière au Tableau des Classes et Carrières aléatoires' },
    aLaPlaceDe: { label: 'À la place de', hint: 'Présente : qui tire cette carrière au Tableau peut choisir celle-ci à la place' },
    especesALaPlaceDe: {
      label: 'Espèces de la substitution',
      hint: 'Présentes : seules ces espèces peuvent prendre cette carrière à la place de celle tirée (« À la place de ») ; elles bornent la substitution, pas la carrière',
    },
    talentALaPlaceDe: {
      label: 'Talent de la substitution',
      hint: 'Présent : prise à la place de la carrière tirée (« À la place de »), la carrière perd le bonus d’XP du tirage si son Talent de carrière est ce Talent à une spécialisation hors de cette liste',
    },
    gatedByRule: { label: 'Règle optionnelle requise', hint: 'Présente : la carrière n’est offerte que si cette règle optionnelle est active' },
  },
  {
    codex: { keys: ['careers'] },
    edit: { dataset: 'careers' },
  },
  {
    exiges: ['desc', 'source'],
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const c = v as { id: string; aLaPlaceDe?: unknown; especesALaPlaceDe?: unknown; talentALaPlaceDe?: unknown };
        if (c.aLaPlaceDe !== undefined) return;
        for (const borne of BORNES_DE_LA_SUBSTITUTION)
          if (c[borne] !== undefined)
            ctx.addIssue({ code: 'custom', path: [borne], message: `careers.json : « ${c.id} » porte \`${borne}\` sans \`aLaPlaceDe\` — ce champ borne une substitution : renseigne la carrière tirée (« À la place de »).` });
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
