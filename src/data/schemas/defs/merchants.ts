/**
 * Schéma de `merchants.json` — archétypes de marchand (#2, migré du CODE en donnée éditable,
 * doctrine « aucun archétype en dur »). Reflet FIDÈLE de `MerchantArchetypeDef`
 * (`src/state/merchants/types.ts`).
 */
import { z } from 'zod';
import { refs } from '../grammaire/ref';
import { document } from '../grammaire/document';

export const file = 'merchants.json';
export const famille = 'entite';

const settlementSchema = z.enum(['village', 'ville', 'cite']);

const doc = document(
  'merchants',
  famille,
  {
    category: z.strictObject({
      /** CATÉGORIES de catalogue vendues (`TrappingData.categorie`) — mesuré : 1 porteur, valeurs ⊆ le
       *  vocabulaire de `trappings.json`. Absent = pas de filtre par catégorie. */
      categories: z.array(z.string()).optional(),
      /** Sous-types vendus (`TrappingData.subType`, Groupe d'objet) — axe DISTINCT, nom inchangé. */
      subTypes: z.array(z.string()).optional(),
    }),
    settlement: settlementSchema,
    resaleRate: z.number(),
    buyMarkup: z.number().optional(),
    bargainSkill: z.number(),
    restockDays: z.number().optional(),
    /** Sélection d'objets proposés d'office — clés étrangères vers `trappings.json`. */
    curated: refs('trapping').optional(),
    boniment: z.string().optional(),
    unitKinds: z.array(z.enum(['bete', 'vehicule-terrestre'])).optional(), // 'navire' non géré à l'achat (payCart) -> #748
  },
  {
    category: { label: 'Familles vendues', hint: 'Filtre le catalogue vendu par type/sous-type de possession' },
    settlement: {
      label: 'Taille d’agglomération',
      hint: 'Taille de colonie par défaut de ce marchand, surchargeable en Scène',
    },
    resaleRate: { label: 'Taux de rachat', hint: 'Part du prix listé payée sur un Marchandage de vente gagné' },
    buyMarkup: { label: 'Majoration d’achat', hint: 'Multiplicateur du prix listé à l’achat (1 = prix normal)' },
    bargainSkill: { label: 'Valeur de Marchandage', hint: 'Valeur opposée au Test de Marchandage du client' },
    restockDays: { label: 'Délai de réassort', hint: 'Jours écoulés avant que le stock ne soit re-tiré' },
    curated: { label: 'Objets garantis', hint: 'Possessions toujours en stock chez ce marchand, Disponibilité ignorée' },
    boniment: { label: 'Réplique de boniment', hint: 'Phrase d’ambiance affichée au-dessus de l’étal' },
    unitKinds: {
      label: 'Catégories d’unités vendues',
      hint: 'Types d’unités (bêtes, véhicules terrestres) proposées à l’achat',
    },
  },
  {
    codex: {
      exempt: {
        kind: 'dette',
        raison:
          'exposition Codex des archétypes de marchand DUE, non faite — lot UI séparé : le document ne se lit aujourd’hui qu’à l’étal',
        ticket: '#747',
      },
    },
    edit: { none: 'aucune catégorie du Codex ne l’édite — le stock se règle en Scène, l’archétype reste app-owned' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
