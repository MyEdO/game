/**
 * Schéma de `stars.json` — Tableau des Signes astrologiques (ADE II 3), document mono-table : son dé
 * `die` tire un seuil (`rand`, borne haute cumulée), le dé de son sous-tirage (`sub`, `sousTirage`) départage les
 * variantes d'un même seuil (`sub` de la rangée).
 */
import { z } from 'zod';
import { document, sousTirage } from '../grammaire/document';
import { executeesDe, mecaniqueDe } from '../grammaire/mecanique';
import { nommerChamps } from '../grammaire/meta';
import { ecartsDuDeDeLaTable, plageSchema, sourceRefSchema } from '../grammaire/valeurs';
import { formatDice, parseDice, totalDuDe } from '../../../engine/dice';
import { deDeLaTableTiree, facesDuDe } from '../../../engine/tables';

export const file = 'stars.json';
export const famille = 'config';

/** Un signe, à son seuil du dé de la table. */
export const rangee = nommerChamps(z.strictObject({
  id: z.string(),
  label: z.string(),
  rand: z.number(),
  signe: z.string(),
  classique: z.string(),
  ascendant: z.string(),
  dates: z.string(),
  dieux: z.string(),
  apparence: z.string(),
  /** Effet du signe aux ATTRIBUTS DE DÉPART (ADE II 3 l.38) — `GameOp[]`, jamais de la prose : la
   *  clé porte le nom du CONCEPT qu'elle contient (`ops`, comme `drunkenness`/`traumas`/les
   *  Critiques), et la langue unique `applyOps`/`GameOpEditor` la lit sans exception d'atelier.
   *  Désignateur : `createHero` (`engine/character.ts`), via `applyStarOps` (`engine/creation.ts`). */
  ops: executeesDe(mecaniqueDe({ 'grantTalent.talent': 'specOuChoixFacultatifs' }).gameOp).optional(),
  /** Étoile du Sorcier (ADE II 3 l.63) : fourchette du dé du sous-tirage (`sub` du document),
   *  forme PARTAGÉE `{min, max}` que `findTableEntry` (`src/engine/tables.ts`) lit. Absente sur un
   *  signe simple. */
  sub: plageSchema.optional(),
  desc: z.string().min(1),
  source: sourceRefSchema,
}), {
  id: { label: 'identifiant' },
  label: { label: 'libellé' },
  rand: { label: 'Seuil aléatoire (borne haute du dé)' },
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
  sub: { label: 'Sous-tirage', hint: 'Fourchette du dé du sous-tirage (Étoile du Sorcier)' },
  desc: { label: 'texte' },
  source: { label: 'source' },
});

const doc = document(
  'stars',
  famille,
  {
    // ADE II 3 l.63
    sub: sousTirage,
  },
  {
    sub: { label: 'Sous-tirage', hint: 'Départage les variantes d’un même seuil (Étoile du Sorcier)' },
  },
  {
    edit: { niche: { categories: { stars: 'entries' } } },
  },
  {
    // ADE II 3 l.42
    rangee,
    deDeTirage: true,
    // COUVERTURE du sous-tirage — invariant du GROUPE de variantes, pas d'une rangée : une variante
    // seule ne sait pas si sa voisine commence là où elle s'arrête. Le groupe est celui que le
    // résolveur forme (`rollStar`, `src/engine/creation.ts`) : les rangées qui PARTAGENT le même
    // `rand`. Le domaine est celui du dé du sous-tirage, d'un seul tenant.
    // Sans lui, un trou ouvert au Codex ne lèverait RIEN : `findTableEntry` (`src/engine/tables.ts`)
    // replie sur la dernière entrée, et un 5 rendrait la variante « Sorcier ! ».
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        const { sub, entries } = v as { sub: { die: string }; entries: { id: string; rand: number; sub?: { min: number; max: number } }[] };
        if (parseDice(sub.die) === null) return;
        const subDie = deDeLaTableTiree(sub);
        const groupes = new Map<number, typeof entries>();
        for (const e of entries) groupes.set(e.rand, [...(groupes.get(e.rand) ?? []), e]);
        for (const [rand, groupe] of groupes) {
          if (!groupe.some((e) => e.sub)) continue;
          const sans = groupe.filter((e) => !e.sub).map((e) => `« ${e.id} »`);
          if (sans.length) {
            ctx.addIssue({
              code: 'custom',
              path: ['entries'],
              message: `stars.json : le groupe de variantes du seuil ${rand} mêle des rangées AVEC et SANS sous-tirage (${sans.join(', ')}) — le résolveur ne retient que celles qui en portent un, les autres deviennent inatteignables.`,
            });
            continue;
          }
          if (groupe.length < 2) {
            ctx.addIssue({
              code: 'custom',
              path: ['entries'],
              message: `stars.json : le seuil ${rand} porte un sous-tirage sur une rangée SEULE — le dé du sous-tirage départage des variantes, il n'en départage aucune ici.`,
            });
            continue;
          }
          const ecarts = ecartsDuDeDeLaTable(sub, groupe.map((e) => ({ ...e.sub!, id: e.id })), (f) => `la variante « ${f.id} » (${f.min}–${f.max})`);
          if (ecarts.length) {
            ctx.addIssue({
              code: 'custom',
              path: ['entries'],
              message: `stars.json : les variantes du seuil ${rand} ne couvrent pas le ${formatDice(subDie)} de ${totalDuDe(subDie, subDie.n)} à ${facesDuDe(subDie)} d'un seul tenant — ${ecarts.join(' ; ')}.`,
            });
          }
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
