/** EDOC 7 l.25. */
import { z } from 'zod';
import { document, type EnveloppeDocument } from '../grammaire/document';
import { refs } from '../grammaire/ref';

export const file = 'montures.json';
export const famille = 'entite';

/** Une monture ou bête de trait : Mouvement, Endurance, trot et capacité de charge en voyage. */
const champs = {
  /** SOCLE POSSESSIONS #617/#618. */
  creatureIds: refs('creature'),
  /** Mouvement (M). */
  m: z.number(),
  /** EDOC 07 l.229. */
  e: z.number(),
  /** EDOC 7. */
  trot: z.boolean(),
  /** EDOC 07 l.97-110. */
  encPortee: z.number(),
};

const doc = document(
  'montures',
  famille,
  champs,
  {
    creatureIds: { label: 'Créatures' },
    m: { label: 'Mouvement' },
    e: { label: 'Endurance' },
    trot: { label: 'Trot' },
    encPortee: { label: 'Encombrement porté' },
  },
  {
    codex: { keys: ['montures'] },
    edit: { dataset: 'montures' },
  },
  // EDOC 07 l.12-93 ; `mountProfileForCreature` (`src/engine/mountTravel.ts`) lit le profil d'une créature.
  {
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        const profils = new Map<string, string>();
        (v as readonly { id: string; creatureIds: readonly string[] }[]).forEach((p, i) => {
          for (const creature of p.creatureIds) {
            const premier = profils.get(creature);
            if (premier === undefined) profils.set(creature, p.id);
            else ctx.addIssue({ code: 'custom', path: [i, 'creatureIds'], message: `${file} : la créature « ${creature} » est citée par les profils « ${premier} » et « ${p.id} » — une créature, un seul profil de monture.` });
          }
        });
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
/** VUE TS du dataset — le nœud rendu par la fabrique est SCELLÉ, la vue se recompose depuis
 *  l'enveloppe et les champs déclarés. */
export type MonturesData = (EnveloppeDocument & z.infer<z.ZodObject<typeof champs>>)[];
