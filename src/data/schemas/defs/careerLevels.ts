/** LDB 7. */
import { z } from 'zod';
import { charKeySchema, statutSchema } from '../grammaire/valeurs';
import { trappingRefSchema } from '../grammaire/reference';
import { avancement } from '../grammaire/avancement';
import { document } from '../grammaire/document';
import { ref } from '../grammaire/ref';

export const file = 'careerLevels.json';
export const famille = 'entite';

/** LDB 07 l.41-43. */
const MARQUES_PAR_NIVEAU: Readonly<Record<number, number>> = { 1: 3, 2: 1, 3: 1, 4: 1 };

const doc = document(
  'careerLevels',
  famille,
  {
    /** Carrière (`CareerData.id`). */
    career: ref('career'),
    level: z.number(),
    skills: z.array(avancement('skill')),
    talents: z.array(avancement('talent')),
    trappings: z.array(trappingRefSchema),
    characteristics: z.array(charKeySchema),
    /** Statut du Niveau (« Argent 2 ») — VERBATIM du livre. */
    status: statutSchema,
  },
  {
    career: { label: 'Carrière', hint: 'Carrière à laquelle appartient ce Niveau' },
    level: { label: 'Niveau', hint: 'Rang du Niveau au sein de la Carrière' },
    skills: {
      label: 'Compétences du Niveau',
      hint: 'Compétences ouvertes à l’Augmentation par ce Niveau (cumul des Niveaux ≤ courant ; l’italique du N1 sert à Gagner de l’argent)',
    },
    talents: {
      label: 'Talents du Niveau',
      hint: 'Talents disponibles à l’achat au Niveau COURANT seul (100 PX + 100 par prise) — pas ceux des Niveaux précédents',
    },
    trappings: {
      label: 'Possessions du Niveau',
      hint: 'Possessions listées à ce Niveau (celles du Niveau 1 dotent le personnage à la création)',
    },
    characteristics: {
      label: 'Caractéristiques du Niveau',
      hint: 'Caractéristiques de Carrière ouvertes par ce Niveau (Augmentations au coût standard, ×2 hors carrière) ; les Niveaux ≤ courant se cumulent',
    },
    status: { label: 'Statut social', hint: 'Échelon Bronze/Argent/Or de ce Niveau' },
  },
  {
    codex: { keys: ['careerLevels'] },
    edit: { dataset: 'careerLevels' },
  },
  // LDB 07 l.26 ; LDB 07 l.41-43.
  {
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const n = v as { id: string; career: { id: string }; level: number; characteristics: readonly string[] };
        const attendu = `${n.career.id}-${n.level}`;
        if (n.id !== attendu)
          ctx.addIssue({ code: 'custom', path: ['id'], message: `careerLevels.json : l’id « ${n.id} » est désaccordé de la paire carrière+niveau qui le compose — attendu « ${attendu} ».` });
        const marques = MARQUES_PAR_NIVEAU[n.level];
        if (marques !== undefined && n.characteristics.length !== marques)
          ctx.addIssue({ code: 'custom', path: ['characteristics'], message: `careerLevels.json : « ${n.id} » ouvre ${n.characteristics.length} caractéristique(s) — le Schéma de Progression en ouvre ${marques} au niveau ${n.level}.` });
      }),
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        const parCarriere = new Map<string, { id: string; level: number; characteristics: readonly string[] }[]>();
        for (const n of v as { id: string; career: { id: string }; level: number; characteristics: readonly string[] }[])
          parCarriere.set(n.career.id, [...(parCarriere.get(n.career.id) ?? []), n]);
        for (const [carriere, niveaux] of parCarriere) {
          const presents = niveaux.map((n) => n.level).sort((a, b) => a - b);
          if (presents.join(',') !== '1,2,3,4')
            ctx.addIssue({ code: 'custom', path: [], message: `careerLevels.json : la carrière « ${carriere} » doit porter les niveaux 1, 2, 3 et 4 une fois chacun — niveaux présents [${presents.join(', ')}] (${niveaux.map((n) => n.id).join(', ')}).` });
          const marques = niveaux.flatMap((n) => n.characteristics);
          const doublons = [...new Set(marques.filter((c, i) => marques.indexOf(c) !== i))];
          if (doublons.length)
            ctx.addIssue({ code: 'custom', path: [], message: `careerLevels.json : la carrière « ${carriere} » ouvre deux fois [${doublons.join(', ')}] — chaque caractéristique du Schéma de Progression porte une seule marque.` });
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
