/** BNO p.4-5 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { nommerNoeud } from '../grammaire/meta';
import { recordDIds, ref, refOuSpec, refs } from '../grammaire/ref';
import { trappingRefSchema } from '../grammaire/reference';
import { charKeySchema, enumNomme } from '../grammaire/valeurs';
import { listeSansCle } from '../grammaire/liste-sans-cle';

export const file = 'modeles-de-pnj.json';
export const famille = 'entite';

/** Sortes d'un document (`kind`) : BNO p.4 ; BNO p.5. */
const LIBELLES_DE_KIND = { modele: 'Modèle de carrière', heros: 'Profil de héros', bete: 'Rôle de bête' } as const;

const doc = document(
  'modeles-de-pnj',
  famille,
  {
    kind: enumNomme(LIBELLES_DE_KIND),
    aussiPour: z.string().min(1).optional(),
    caracteristiques: z.array(charKeySchema).length(4).optional(),
    competences: listeSansCle(z.array(refOuSpec('skill'))).optional(),
    talents: listeSansCle(z.array(refOuSpec('talent'))).optional(),
    traitsFacultatifs: refs('trait').optional(),
    dotations: z.array(trappingRefSchema).optional(),
    modificateurs: recordDIds('characteristic', nommerNoeud(z.number().int(), { nom: 'modificateur' })).optional(),
    arme: z.number().int().min(1).optional(),
    armure: z.number().int().min(1).optional(),
    traits: refs('trait').optional(),
    competence: refOuSpec('skill').optional(),
    bonus: z.number().int().min(1).optional(),
    talent: ref('talent').optional(),
  },
  {
    kind: { label: 'Sorte', hint: 'Modèle de carrière, profil de héros ou rôle de bête — les clés admises en dépendent' },
    aussiPour: { label: 'Aussi pour', hint: 'Les autres profils que le modèle couvre' },
    caracteristiques: { label: 'Caractéristiques', inverseCodex: { cle: 'characteristic' }, hint: '+5 par Niveau à chacune' },
    competences: { label: 'Compétences', inverseCodex: { type: 'skill', portee: 'directe' }, hint: '+5 Augmentations par Niveau à chacune' },
    talents: { label: 'Talents', inverseCodex: { type: 'talent', portee: 'directe' }, hint: 'Chacun pris une fois par Niveau, jusqu’à son Maxi' },
    traitsFacultatifs: { label: 'Traits facultatifs', inverseCodex: { type: 'trait', portee: 'directe' }, hint: 'Suggérés au modèle, au choix de l’auteur' },
    dotations: { label: 'Possessions', inverseCodex: { type: 'trapping', portee: 'directe' }, hint: 'Possessions et bourse du modèle' },
    modificateurs: { label: 'Modificateurs', inverseCodex: { cle: 'characteristic' }, hint: 'Ajoutés aux Caractéristiques du profil' },
    arme: { label: 'Arme +', hint: 'Ajouté à chaque Trait Arme' },
    armure: { label: 'Armure +', hint: 'Ajouté au Trait Armure, ou Trait Armure de cette valeur' },
    traits: { label: 'Traits', inverseCodex: { type: 'trait', portee: 'directe' }, hint: 'Traits ajoutés au profil' },
    competence: { label: 'Compétence', inverseCodex: { type: 'skill', portee: 'directe' }, hint: 'Compétence que le rôle renforce' },
    bonus: { label: 'Bonus', hint: 'Augmentations ajoutées à la Compétence' },
    talent: { label: 'Talent', inverseCodex: { type: 'talent', portee: 'directe' }, hint: 'Talent pris jusqu’à son Maxi' },
  },
  {
    codex: { keys: ['modelesDePnj'] },
    edit: { dataset: 'modelesDePnj' },
  },
  {
    exiges: ['source'],
    espace: {
      discriminant: 'kind',
      chargeParDiscriminant: {
        modele: ['aussiPour', 'caracteristiques', 'competences', 'talents', 'traitsFacultatifs', 'dotations'],
        heros: ['modificateurs', 'arme', 'armure', 'traits'],
        bete: ['competence', 'bonus', 'talent'],
      },
      requisesParDiscriminant: {
        modele: ['caracteristiques', 'competences', 'talents', 'dotations'],
        heros: ['modificateurs'],
        bete: ['competence', 'bonus', 'talent'],
      },
    },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;
export const exposition = doc.exposition;
