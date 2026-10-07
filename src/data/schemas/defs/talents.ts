import { nommerChamps } from '../grammaire/meta';
/** LDB 05 l.484 */
import { z } from 'zod';
import { charKeySchema, combatFeatureSchema, sizeCategorySchema, specsSchema, specsSourceSchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';
import { conditionSchema, mecaniqueDe, triggeredEffectSchema } from '../grammaire/mecanique';
import { refOuSpec } from '../grammaire/ref';

export const file = 'talents.json';
export const famille = 'entite';

// ── TestMatch / TalentTest (src/data/index.ts) ──────────────────────────────────────────────────
/** Un `TestMatch` désigne la spec visée d'UNE façon : `skill.spec` FIXE, `specFromInstance` (la spec
 *  élue du talent) ou `exceptSpec` (toutes SAUF). Les combiner ne se résout pas — `matchApplies`
 *  (`src/engine/magic.ts`) laisse `specFromInstance` ÉCRASER `skill.spec`, et rend `exceptSpec`
 *  inerte dès que la spec est épinglée : la donnée mentirait sur ce qu'elle déclare. */
const testMatchSchema = nommerChamps(z.strictObject({
  skill: refOuSpec('skill').optional(),
  char: charKeySchema.optional(),
  specFromInstance: z.boolean().optional(),
  exceptSpec: z.string().optional(),
  when: conditionSchema.optional(),
  manual: z.boolean().optional(),
}).superRefine((v, ctx) => {
  const spec = (v.skill as { spec?: string } | undefined)?.spec;
  if (spec == null) return;
  for (const [cle, pose] of [['specFromInstance', v.specFromInstance === true], ['exceptSpec', v.exceptSpec != null]] as const) {
    if (!pose) continue;
    ctx.addIssue({
      code: 'custom',
      path: [cle],
      message: `TestMatch « ${String((v.skill as { id?: string }).id)} (${spec}) » : « ${cle} » et « skill.spec » désignent tous deux la spécialisation — un seul régime à la fois (matchApplies, src/engine/magic.ts).`,
    });
  }
}), {
  skill: { label: 'Compétence' },
  char: { label: 'Caractéristique' },
  specFromInstance: { label: 'Spécialisation de l’instance' },
  exceptSpec: { label: 'Spécialisation exclue' },
  when: { label: 'Condition' },
  manual: { label: 'Manuel' },
});

const talentTestSchema = nommerChamps(z.strictObject({
  raw: z.string(),
  matches: z.array(testMatchSchema),
}), { raw: { label: 'Texte source' }, matches: { label: 'Correspondances' } });

// ── CombatFeature (src/engine/combatFeatures/types.ts) — PROMU dans `grammaire/valeurs.ts` (#563, SOURCE
// UNIQUE) : `combatFeatureSchema` importé ci-dessus ; `variantOf` est composé par la fabrique.

/**
 * Champs qu'une variante réglée de `talents.json` peut republier — ceux dont la lecture PASSE par
 * `effectiveEntry` (`src/engine/variants.ts`), preuve par consommateur :
 *  - `desc`/`source` → Codex `src/ui/compendium/registry.ts`
 *  - `test` → `talentTestSLBonus` (`src/engine/magic.ts`)
 *  - `max` → `talentMaxById` (`src/engine/careerSlots.ts`), Apprentissage (`src/ui/InterludeScreen.tsx:722`)
 *  - `combat` → `featuresOf` (`src/engine/combatFeatures/dispatch.ts`), `castingKindOf` (l.17)
 * `passive`/`effects` en sont ABSENTS : `talentEffects.ts`/`characteristics.ts`/`combatManeuvers.ts`
 * les lisent sur l'entrée BRUTE — les y admettre ferait diverger le Codex du moteur.
 */
export const VARIANT_RESOLVED_FIELDS = ['desc', 'source', 'test', 'max', 'combat'] as const;

const doc = document(
  'talents',
  famille,
  {
    max: z.union([z.number(), nommerChamps(z.strictObject({ bonusOf: charKeySchema }), { bonusOf: { label: 'Bonus de caractéristique' } }), z.null()]),
    test: talentTestSchema.nullable(),
    specs: specsSchema.optional(),
    size: sizeCategorySchema.optional(),
    specsSource: specsSourceSchema.optional(),
    /** Le `spec` de ce Talent nomme un CULTE (`gods.json`) : ses `grantGroups` sont accordés au
     *  porteur (`groupsFor`). Absent = le `spec` n'ouvre aucun Groupe d'appartenance. */
    grantSpecGroups: z.literal(true).optional(),
    /** LDB 46 l.177 ; VDM 02 l.190-192 */
    grantsArcaneDomain: z.literal(true).optional(),
    specsOpen: z.boolean().optional(),
    rand: z.number().nullable(),
    effects: z.array(triggeredEffectSchema).optional(),
    /** Désignateur : `careerSkillAdditions` (`engine/talentEffects.ts`), la spec du Talent porteur. */
    passive: z.array(mecaniqueDe({ 'grantCareerSkill.skill': 'specOuChoixFacultatifs' }).gameOp).optional(),
    combat: combatFeatureSchema.optional(),
    // Contenu de RÉFÉRENCE (PNJ/campagne, RAW cité par entrée) : hors graphe d'obtenabilité (#326).
    codexOnly: z.literal(true).optional(),
  },
  {
    max: { label: 'Maximum', hint: 'Nombre maximum d’achats du Talent' },
    test: { label: 'Test associé', hint: 'Compétence/Caractéristique/spécialisation dont le Talent modifie le jet' },
    specs: { label: 'Spécialisations', hint: 'Liste fermée de spécialisations proposées' },
    size: { label: 'Taille requise' },
    specsSource: { label: 'Registre de spécialisations' },
    grantSpecGroups: {
      label: 'Groupes du culte choisi',
      hint: 'La spécialisation nomme un culte dont les Groupes sont accordés au porteur',
    },
    grantsArcaneDomain: { label: 'Ouvre un Domaine arcanique' },
    specsOpen: { label: 'Spécialisation ouverte' },
    rand: { label: 'Seuil aléatoire (d100)' },
    effects: { label: 'Effets déclenchés' },
    passive: { label: 'Effets passifs' },
    combat: {
      label: 'Fonction de combat',
      hint: 'Capacité de combat à laquelle le Talent se rattache (parade, initiative, avantage de groupe…)',
    },
    codexOnly: { label: 'Codex seulement', hint: 'Jamais proposé à l’achat/création (PNJ/campagne)' },
  },
  {
    codex: { keys: ['talents'] },
    edit: { dataset: 'talents' },
  },
  // `specsOpen` : lu par `entreeOuverte` (`grammaire/ref.ts`).
  { exiges: ['source'], variantes: VARIANT_RESOLVED_FIELDS, espace: { marqueurs: ['specsOpen'] } },
);

export const schema = doc.schema;
export const meta = doc.meta;
export const exposition = doc.exposition;
/** Clés top-level de l'entrée (enveloppe + champs), relevées AVANT le sceau — le nœud rendu par la
 *  fabrique n'a plus de `.shape`. Consommée par `src/data/variants-integrity.test.ts`. */
export const cles = doc.cles;
