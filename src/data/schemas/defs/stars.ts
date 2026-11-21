/** ADE II 03 l.36-63. */
import { z } from 'zod';
import { document, sousTirage } from '../grammaire/document';
import { executeesDe, mecaniqueDe } from '../grammaire/mecanique';
import { metaDesChamps, nommerChamps } from '../grammaire/meta';
import { ecartsDuDeDeLaTable, plageEntiereSchema, sourceRefSchema } from '../grammaire/valeurs';
import { formatDice, type DiceSpec } from '../../../engine/dice';

export const file = 'stars.json';
export const famille = 'config';

export const rangee = nommerChamps(z.strictObject({
  id: z.string(),
  label: z.string(),
  ...plageEntiereSchema.shape,
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
  /** ADE II 03 l.63. */
  sub: plageEntiereSchema.optional(),
  desc: z.string().min(1),
  source: sourceRefSchema,
}), {
  id: { label: 'identifiant' },
  label: { label: 'libellé' },
  ...metaDesChamps(plageEntiereSchema, { exigees: true }),
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
    sub: { label: 'Sous-tirage', hint: 'Départage les variantes d’une même fourchette (Étoile du Sorcier)' },
  },
  {
    edit: { niche: { categories: { stars: 'entries' } } },
  },
  {
    // ADE II 3 l.42
    rangee,
    deDeTirage: true,
    affinerDataset: (dataset) => dataset.superRefine((v, ctx) => {
      const table = v as { die: DiceSpec; sub: { die: DiceSpec }; entries: z.output<typeof rangee>[] };
      const groupes = new Map<number, typeof table.entries>();
      for (const r of table.entries) {
        const groupe = groupes.get(r.min);
        if (groupe) groupe.push(r);
        else groupes.set(r.min, [r]);
      }
      const refuser = (message: string) => ctx.addIssue({ code: 'custom', path: ['entries'], message: `${file} : ${message}` });
      const bandes = [...groupes.values()].map(([r]) => r);
      const ecarts = ecartsDuDeDeLaTable(table, bandes, (r) => `la rangée « ${r.id} »`);
      if (ecarts.length) {
        refuser(`les signes ne couvrent pas le ${formatDice(table.die)} d'un seul tenant — ${ecarts.join(' ; ')}.`);
      }
      for (const [bande, ...autres] of groupes.values()) {
        const nom = `la bande ${bande.min}–${bande.max}`;
        const variantes = [bande, ...autres].flatMap(({ id, sub }) => sub ? [{ ...sub, id }] : []);
        if (autres.some((r) => r.max !== bande.max)) {
          refuser(`${nom} regroupe des rangées de bornes hautes différentes.`);
        }
        if (autres.length === 0 && variantes.length === 0) continue;
        if (autres.length === 0 || variantes.length !== autres.length + 1) {
          refuser(`${nom} doit porter un signe simple ou au moins deux variantes ayant chacune un sous-tirage.`);
          continue;
        }
        const ecartsDuSousTirage = ecartsDuDeDeLaTable(table.sub, variantes, (r) => `la variante « ${r.id} »`);
        if (ecartsDuSousTirage.length) {
          refuser(`les variantes de ${nom} ne couvrent pas le sous-tirage ${formatDice(table.sub.die)} d'un seul tenant — ${ecartsDuSousTirage.join(' ; ')}.`);
        }
      }
    }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
