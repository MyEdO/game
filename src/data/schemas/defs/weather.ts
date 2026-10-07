import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** EDOC 8 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { difficultySchema, ecartsDeCouverture, plageSchema, sourceRefSchema } from '../grammaire/valeurs';
import { listeCle } from '../grammaire/collection-cle';

export const file = 'weather.json';
export const famille = 'config';

/** EDOC 8 l.50-59 */
export const weatherIdSchema = z.enum(['sec', 'beau', 'pluie', 'pluie-diluvienne', 'neige', 'blizzard']);

const doc = document(
  'weather',
  famille,
  {
  seasons: listeCle(
    nommerChamps(z.strictObject({
      id: z.string(),
      label: z.string(),
      ranges: z.array(
        nommerChamps(z.strictObject({
          ...plageSchema.shape,
          weather: weatherIdSchema,
        }), { ...metaDesChamps(plageSchema, { exigees: true }), weather: { label: 'Météo' } }),
      ),
      source: sourceRefSchema.optional(),
    }), {
      id: { label: 'Identifiant' },
      label: { label: 'Libellé' },
      ranges: { label: 'Plages' },
      source: { label: 'Source' },
    }),
    'id',
  ),
  /** EDOC 8 l.82 */
  physicalTestChars: z.array(z.string()),
  physicalTestCharsSource: sourceRefSchema.optional(),
  conditions: listeCle(
    nommerChamps(z.strictObject({
      id: weatherIdSchema,
      /** Le NOM de la météo à l'écran, et le seul (`weatherCondition(w).label`). `.min(1)` STRUCTUREL,
       *  patron de l'enveloppe (`grammaire/document.ts`) : tant que le nom venait du catalogue i18n, le
       *  non-vide était acquis par construction — la donnée reprend la garantie avec la charge. */
      label: z.string().min(1),
      /** Description VERBATIM (Markdown) de la source — rendue par `<Prose>` (règle 5). */
      desc: z.string().optional(),
      /** Visibilité en mètres (0 ≈ nulle) — plafonne la portée du tir en combat. */
      visibiliteM: z.number().optional(),
      /** Pénalité aux armes à DISTANCE (combat). */
      rangedMod: z.number().optional(),
      /** Armes à distance INUTILES (blizzard). */
      rangedUseless: z.boolean().optional(),
      /** Poudre à canon exposée inutilisable (pluie diluvienne). */
      powderUseless: z.boolean().optional(),
      /** Pénalité à tous les Tests PHYSIQUES (caracs de `physicalTestChars`). */
      physicalTestMod: z.number().optional(),
      /** Mouvement plafonné à la marche (neige/blizzard). */
      movementWalkOnly: z.boolean().optional(),
      /** Animaux au Trait Nerveux effrayables par les éclairs (pluie diluvienne). */
      lightningNervous: z.boolean().optional(),
      /** Test de Résistance de traversée (ou État) — DISTINCT de l'Exposition de fin d'Étape.
       *  `enjeu` = énoncé VERBATIM de la source (ce que l'échec coûte), rendu sous le titre d'étape. */
      resistanceTest: nommerChamps(z
        .strictObject({ difficulty: difficultySchema, onFail: z.enum(['extenue']), enjeu: z.string().optional() }), { difficulty: { label: 'Difficulté' }, onFail: { label: 'À l’échec' }, enjeu: { label: 'Enjeu' } })
        .optional(),
      source: sourceRefSchema.optional(),
    }), {
      id: { label: 'Identifiant' },
      label: { label: 'Libellé' },
      desc: { label: 'Description' },
      visibiliteM: { label: 'Visibilité (m)' },
      rangedMod: { label: 'Modificateur de tir' },
      rangedUseless: { label: 'Tir inutilisable' },
      powderUseless: { label: 'Poudre inutilisable' },
      physicalTestMod: { label: 'Modificateur des Tests physiques' },
      movementWalkOnly: { label: 'Marche uniquement' },
      lightningNervous: { label: 'Nervosité face à la foudre' },
      resistanceTest: { label: 'Test de résistance' },
      source: { label: 'Source' },
    }),
    'id',
  ),
  },
  {
    seasons: { label: 'Tirage saisonnier', hint: 'Table de tirage d100 de la météo, par saison' },
    physicalTestChars: {
      label: 'Caractéristiques physiques',
      hint: 'Liste MAISON des Caractéristiques réputées « physiques » (non définie par la source)',
    },
    physicalTestCharsSource: { label: 'Source de la liste maison', hint: 'Référence RAW/maison de la liste de Caractéristiques physiques' },
    conditions: { label: 'Conditions météo', hint: 'Effets par météo : visibilité, pénalités, Test de Résistance de traversée' },
  },
  {
    codex: { keys: ['weather', 'weatherConditions'] },
    edit: { niche: { categories: { weather: 'seasons', weatherConditions: 'conditions' } } },
  },
  {
    // BIJECTION alphabet ⇄ conditions — le z.enum ferme l'id INCONNU, `listeCle` l'id EN DOUBLE ; reste :
    //  - COMPLÉTUDE : une condition SUPPRIMÉE au Codex éteindrait le libellé et les effets d'une météo
    //    que la table saisonnière tire encore (`weatherCondition`, engine, ne lit que ce tableau).
    // COUVERTURE du d100 par saison (`ecartsDeCouverture`, grammaire) : les deux bornes étant
    //    éditables au Codex, un trou ou un chevauchement passerait le z.number() — et le tirage
    //    tomberait sur la dernière rangée par REPLI de `findTableEntry`, sans un mot.
    // Refus NOMINATIF dans les deux cas, aux trois portes (CI `schema-contract`, boot `dev-validate`,
    // save transactionnel du Codex).
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const ids = ((v as { conditions?: { id?: string }[] }).conditions ?? []).map((c) => c.id);
        const manquants = weatherIdSchema.options.filter((id) => !ids.includes(id));
        if (manquants.length) {
          ctx.addIssue({
            code: 'custom',
            path: ['conditions'],
            message: `weather.json : condition(s) manquante(s) — ${manquants.join(', ')}. Chaque météo de l'alphabet (${weatherIdSchema.options.join(', ')}) porte sa fiche : le libellé et les effets ne vivent QUE là.`,
          });
        }

        const saisons = (v as { seasons?: { id?: string; ranges?: { min?: number; max?: number; weather?: string }[] }[] }).seasons ?? [];
        for (const [i, s] of saisons.entries()) {
          const ecarts = ecartsDeCouverture(s.ranges ?? [], 1, 100, (r) => `« ${r.weather} » (${r.min}-${r.max})`);
          if (ecarts.length) {
            ctx.addIssue({
              code: 'custom',
              path: ['seasons', i, 'ranges'],
              message: `weather.json › saison « ${s.id} » : le d100 n'est pas couvert EXACTEMENT une fois — ${ecarts.join(' ; ')}. Un trou fait tomber le tirage sur la DERNIÈRE rangée (repli de \`findTableEntry\`), un chevauchement rend la seconde rangée inatteignable : dans les deux cas la météo tirée ment sans un mot.`,
            });
          }
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
