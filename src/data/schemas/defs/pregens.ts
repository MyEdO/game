/** EDOC 16 l.421 ; MSRC 19 l.498 ; ZI 14 l.55 ; PDTP 01 l.3 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { messageDeRefusDeSpec, recordDIds, ref, refs, refusDeSpec } from '../grammaire/ref';
import { charKeySchema, sexeSchema } from '../grammaire/valeurs';
import { nommerNoeud } from '../grammaire/meta';
import { dotationDeCatalogueSchema, dotationDeTexteSchema, sommeSchema, talentRefSchema } from '../grammaire/reference';

export const file = 'pregens.json';
export const famille = 'entite';

const entier = (min: number) => z.number().int().min(min);
const augmentations = nommerNoeud(entier(0), { nom: 'augmentations' });

/** Augmentations par Compétence : un nombre, ou un nombre par spécialisation. */
const augmentationsDesCompetences = recordDIds('skill', z.union([augmentations, z.record(z.string().min(1), augmentations)])).superRefine((v, ctx) => {
  for (const [id, a] of Object.entries(v)) {
    if (typeof a === 'number') continue;
    for (const spec of Object.keys(a)) {
      const refus = refusDeSpec('skill', id, spec);
      if (refus) ctx.addIssue({ code: 'custom', path: [id, spec], message: messageDeRefusDeSpec('skill', id, spec, refus, false) });
    }
  }
});

const doc = document(
  'pregens',
  famille,
  {
    species: ref('species'),
    /** Chaque carrière au Niveau atteint, la dernière actuelle (`ParcoursDeCarriere`, `engine/pnjDeCarriere.ts`). */
    carrieres: recordDIds('career', nommerNoeud(entier(1).max(4), { nom: 'niveau' })),
    initiales: z.record(charKeySchema, z.number().int()),
    charAdvances: z.partialRecord(charKeySchema, entier(1)),
    skills: augmentationsDesCompetences,
    talents: z.array(talentRefSchema),
    trappings: z.array(z.union([dotationDeCatalogueSchema, dotationDeTexteSchema])),
    spells: refs('spell'),
    fate: entier(0),
    resilience: entier(0),
    xp: entier(0),
    motivation: z.string().min(1),
    age: entier(1),
    sex: sexeSchema,
    /** La « Richesse de départ » imprimée. */
    richesse: sommeSchema,
  },
  {
    species: { label: 'Espèce', hint: 'Espèce imprimée sur la fiche' },
    carrieres: { label: 'Parcours de carrière', hint: 'Chaque carrière au Niveau atteint ; la dernière est la carrière actuelle' },
    initiales: { label: 'Caractéristiques initiales', hint: 'La ligne « Initiales » de la fiche' },
    charAdvances: { label: 'Augmentations de Caractéristiques', hint: 'La ligne « Augmentation » de la fiche' },
    skills: { label: 'Compétences', hint: 'Augmentations de chaque Compétence de la fiche' },
    talents: { label: 'Talents', hint: 'Les Talents de la fiche, à leur nombre pris' },
    trappings: { label: 'Possessions', hint: 'Possessions, armes et armures de la fiche' },
    spells: { label: 'Sorts', hint: 'Sorts et Prières de la fiche' },
    fate: { label: 'Destin' },
    resilience: { label: 'Résilience' },
    xp: { label: 'Expérience actuelle' },
    motivation: { label: 'Motivation' },
    age: { label: 'Âge' },
    sex: { label: 'Sexe', hint: 'Sexe visuel (cosmétique)' },
    richesse: { label: 'Richesse de départ', hint: 'La somme imprimée, tirée au recrutement' },
  },
  {
    codex: { keys: ['pregens'] },
    edit: { dataset: 'pregens' },
  },
  { exiges: ['desc', 'source'], fragmentsAdmis: ['blocs'], porteursDeProse: ['descRef'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
