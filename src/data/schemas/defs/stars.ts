/**
 * Schéma de `stars.json` — Étoiles (ADE II 3), dérivé du contenu RÉEL (23 étoiles) et de
 * `StarData` (`src/data/index.ts`). Les champs `string | null` de l'interface (signe/classique/
 * ascendant/dates/dieux/apparence) sont TOUS des `string` dans la donnée actuelle — nullable
 * conservé pour rester fidèle au contrat consommateur (le type autorise `null`). `desc` et `source`
 * sont des clés d'ENVELOPPE, `source` EXIGÉE (`options.exiges`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { mecaniqueDe } from '../grammaire/mecanique';
import { ecartsDeCouverture, plageSchema } from '../grammaire/valeurs';

export const file = 'stars.json';
export const famille = 'entite';

const doc = document(
  'stars',
  famille,
  {
    rand: z.number(),
    signe: z.string().nullable(),
    classique: z.string().nullable(),
    ascendant: z.string().nullable(),
    dates: z.string().nullable(),
    dieux: z.string().nullable(),
    apparence: z.string().nullable(),
    /** Effet du signe aux ATTRIBUTS DE DÉPART (ADE II 3 l.38) — `GameOp[]`, jamais de la prose : la
     *  clé porte le nom du CONCEPT qu'elle contient (`ops`, comme `drunkenness`/`traumas`/les
     *  Critiques), et la langue unique `applyOps`/`GameOpEditor` la lit sans exception d'atelier.
     *  Désignateur : `createHero` (`engine/character.ts`), via `applyStarOps` (`engine/creation.ts`). */
    ops: z.array(mecaniqueDe({ 'grantTalent.talent': 'specOuChoixFacultatifs' }).gameOp).optional(),
    /** Étoile du Sorcier (ADE II 3 l.63) : fourchette du 1d10 interne, forme PARTAGÉE `{min, max}` que
     *  `findTableEntry` (`src/engine/tables.ts`) lit — le sous-tirage se résout par le lookup commun,
     *  sans adaptateur au call-site. Absente sur un signe simple. */
    sub: plageSchema.optional(),
  },
  {
    rand: { label: 'Seuil aléatoire (d100)' },
    signe: { label: 'Signe' },
    classique: { label: 'Nom classique' },
    ascendant: { label: 'Ascendant' },
    dates: { label: 'Dates' },
    dieux: { label: 'Dieux associés' },
    apparence: { label: 'Apparence' },
    ops: {
      label: 'Effets accordés',
      hint: 'Ajustement de Caractéristique / Talent octroyé, appliqué une fois à la création',
    },
    sub: { label: 'Sous-tirage', hint: 'Fourchette 1d10 interne (Étoile du Sorcier)' },
  },
  {
    codex: { keys: ['stars'] },
    edit: { dataset: 'stars' },
  },
  {
    exiges: ['source'],
    // COUVERTURE du sous-tirage — invariant du GROUPE de variantes, pas d'une entrée : une variante
    // seule ne sait pas si sa voisine commence là où elle s'arrête. Le groupe est celui que le
    // résolveur forme (`rollStar`, `src/engine/creation.ts`) : les entrées qui PARTAGENT le même
    // `rand`. ADE II 3 l.63 imprime « Lancez un 1d10 » et quatre bandes (1-3 / 4-6 / 7-9 / 10) : le
    // domaine est 1–10, d'un seul tenant.
    // Sans lui, un trou ouvert au Codex ne lèverait RIEN : `findTableEntry` (`src/engine/tables.ts`)
    // replie sur la dernière entrée, et un 5 rendrait la variante « Sorcier ! ».
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        const etoiles = (v as { id?: string; rand?: number; sub?: { min: number; max: number } }[]) ?? [];
        const groupes = new Map<number, typeof etoiles>();
        for (const e of etoiles) {
          if (typeof e.rand !== 'number') continue;
          groupes.set(e.rand, [...(groupes.get(e.rand) ?? []), e]);
        }
        for (const [rand, groupe] of groupes) {
          if (!groupe.some((e) => e.sub)) continue;
          const sans = groupe.filter((e) => !e.sub).map((e) => `« ${e.id} »`);
          if (sans.length) {
            ctx.addIssue({
              code: 'custom',
              path: ['sub'],
              message: `stars.json : le groupe de variantes du seuil ${rand} mêle des entrées AVEC et SANS sous-tirage (${sans.join(', ')}) — le résolveur ne retient que celles qui en portent un, les autres deviennent inatteignables.`,
            });
            continue;
          }
          if (groupe.length < 2) {
            ctx.addIssue({
              code: 'custom',
              path: ['sub'],
              message: `stars.json : le seuil ${rand} porte un sous-tirage sur une entrée SEULE — un 1d10 interne départage des variantes, il n'en départage aucune ici.`,
            });
            continue;
          }
          const ecarts = ecartsDeCouverture(
            groupe.map((e) => ({ ...e.sub!, id: e.id })),
            1,
            10,
            (f) => `la variante « ${f.id} » (${f.min}–${f.max})`,
          );
          if (ecarts.length) {
            ctx.addIssue({
              code: 'custom',
              path: ['sub'],
              message: `stars.json : les variantes du seuil ${rand} ne couvrent pas le 1d10 de 1 à 10 d'un seul tenant — ${ecarts.join(' ; ')}.`,
            });
          }
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
