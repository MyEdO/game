import { nommerChamps } from '../grammaire/meta';
/**
 * Schéma de `spells.json` — dérivé de l'inventaire COMPLET des clés (script node, n=416/416), de
 * `SpellData` (`src/data/index.ts`), `SpellRange`/`SpellTarget` (`src/engine/spellRange.ts`),
 * `SpellDuration` (`src/engine/spellDuration.ts`) et `Formula` (`src/engine/ops.ts`).
 * `effects` (`Flow<EffectOp>`) : MÊME algèbre que talents/etats (`engine/flowCore.ts`), PROMUE dans
 * `grammaire/mecanique.ts` (`flowSchema`/`conditionSchema`) et `grammaire/valeurs.ts` (`formulaSchema`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { charKeySchema, formulaSchema } from '../grammaire/valeurs';
import { flowSchema, conditionSchema } from '../grammaire/mecanique';
import { refOuSpec } from '../grammaire/ref';
import { messagePorteSansDuree } from '../../../engine/ops';

export const file = 'spells.json';
export const famille = 'entite';

/** Toute op `condition { carried }` de l'arbre d'effets d'une entrée (#1695). */
function* opsPortees(noeud: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(noeud)) { for (const e of noeud) yield* opsPortees(e); return; }
  if (noeud == null || typeof noeud !== 'object') return;
  const n = noeud as Record<string, unknown>;
  if (n.op === 'condition' && n.carried === true) yield n;
  for (const v of Object.values(n)) yield* opsPortees(v);
}

/** `SpellRange` (`engine/spellRange.ts`). */
const spellRangeSchema = z.discriminatedUnion('kind', [
  nommerChamps(z.strictObject({ kind: z.literal('self') }), { kind: { label: 'Type' } }),
  nommerChamps(z.strictObject({ kind: z.literal('touch') }), { kind: { label: 'Type' } }),
  nommerChamps(z.strictObject({ kind: z.literal('distance'), value: formulaSchema, unit: z.enum(['m', 'km']) }), { kind: { label: 'Type' }, value: { label: 'Valeur' }, unit: { label: 'Unité' } }),
  nommerChamps(z.strictObject({ kind: z.literal('special'), text: z.string() }), { kind: { label: 'Type' }, text: { label: 'Texte' } }),
]);

/** `SpellTarget` (`engine/spellRange.ts`). `maison` : valeur maison ÉDITABLE portant sa
 *  justification, quand le RAW laisse un point ouvert — CLAUDE.md règle 7. */
const spellTargetSchema = z.discriminatedUnion('kind', [
  nommerChamps(z.strictObject({ kind: z.literal('self') }), { kind: { label: 'Type' } }),
  nommerChamps(z.strictObject({ kind: z.literal('count'), n: formulaSchema }), { kind: { label: 'Type' }, n: { label: 'Nombre' } }),
  nommerChamps(z.strictObject({ kind: z.literal('area'), span: z.enum(['radius', 'diameter']), meters: formulaSchema, excludesCaster: z.boolean().optional(), affects: conditionSchema.optional(), maison: z.string().optional() }), {
    kind: { label: 'Type' },
    span: { label: 'Envergure' },
    meters: { label: 'Mètres' },
    excludesCaster: { label: 'Lanceur exclu' },
    affects: { label: 'Cibles affectées' },
    maison: { label: 'Arbitrage maison' },
  }),
  nommerChamps(z.strictObject({ kind: z.literal('cone'), lengthMeters: formulaSchema, widthMeters: formulaSchema, affects: conditionSchema.optional(), maison: z.string().optional() }), {
    kind: { label: 'Type' },
    lengthMeters: { label: 'Longueur en mètres' },
    widthMeters: { label: 'Largeur (m)' },
    affects: { label: 'Cibles affectées' },
    maison: { label: 'Arbitrage maison' },
  }),
  nommerChamps(z.strictObject({ kind: z.literal('special'), text: z.string() }), { kind: { label: 'Type' }, text: { label: 'Texte' } }),
]);

/** `SpellDuration` (`engine/spellDuration.ts`). */
const spellDurationSchema = z.discriminatedUnion('kind', [
  nommerChamps(z.strictObject({ kind: z.literal('instant') }), { kind: { label: 'Type' } }),
  nommerChamps(z.strictObject({ kind: z.literal('rounds'), value: formulaSchema, plus: z.literal(true).optional() }), { kind: { label: 'Type' }, value: { label: 'Valeur' }, plus: { label: 'Ajout' } }),
  nommerChamps(z.strictObject({ kind: z.literal('clock'), value: formulaSchema, unit: z.enum(['minutes', 'hours', 'days']) }), { kind: { label: 'Type' }, value: { label: 'Valeur' }, unit: { label: 'Unité' } }),
  nommerChamps(z.strictObject({ kind: z.literal('untilDawn') }), { kind: { label: 'Type' } }),
  nommerChamps(z.strictObject({ kind: z.literal('special'), text: z.string(), plus: z.literal(true).optional() }), { kind: { label: 'Type' }, text: { label: 'Texte' }, plus: { label: 'Ajout' } }),
]);

/** VDM 02 l.377-393 */
const ritualSchema = nommerChamps(z.strictObject({
  /** Rubrique **Type** (`l.381`) VERBATIM — l'énoncé imprimé de qui peut y prendre part. */
  type: z.string(),
  /** VDM 02 l.414 ; LDB 50 ; LDB 47 l.309 */
  domains: z.array(z.string()),
  /** Rubrique **NI** (`l.379`) lorsqu'elle n'imprime PAS un nombre mais une formule sur la CIBLE
   *  (« Force Mentale du démon ») : `cn` reste `null`, et la fiche Codex affiche ce texte au lieu
   *  d'un NI muet. VERBATIM. */
  cnFrom: z.string().optional(),
  /** Rubrique **PX d'apprentissage** (`l.383`). */
  xp: z.number(),
  /** VDM 02 l.398 */
  reduced: nommerChamps(z.strictObject({
    /** Ids de `domains.json` dont la pratique ouvre la valeur réduite. */
    domains: z.array(z.string()),
    /** Le Talent Magie du Chaos y ouvre aussi — `domains.json` ne porte pas le Chaos (c'est une
     *  `family`), il se lit donc sur le lanceur comme pour `CastingNumberScope.chaosMagic`. */
    chaosMagic: z.literal(true).optional(),
    cn: z.number(),
    xp: z.number(),
  }), {
    domains: { label: 'Domaines' },
    chaosMagic: { label: 'Magie du Chaos' },
    cn: { label: 'Seuil d’incantation' },
    xp: { label: 'Points d’Expérience' },
  }).optional(),
  /** Rubrique **Composants** (`l.385`) VERBATIM. */
  components: z.string(),
  /** Rubrique **Conditions** (`l.387`) VERBATIM. */
  conditions: z.string(),
  /** Rubrique **Sacrifices** (`l.389`) VERBATIM. */
  sacrifices: z.string(),
  /** Rubrique **Conséquences** (`l.391`) VERBATIM. */
  consequences: z.string(),
}), {
  type: { label: 'Type' },
  domains: { label: 'Domaines' },
  cnFrom: { label: 'Seuil d’incantation d’origine' },
  xp: { label: 'Points d’Expérience' },
  reduced: { label: 'Réduit' },
  components: { label: 'Composants' },
  conditions: { label: 'Conditions' },
  sacrifices: { label: 'Sacrifices' },
  consequences: { label: 'Conséquences' },
});

// ── SpellData (src/data/index.ts) ───────────────────────────────────────────────────────────────
/** Champs PROPRES d'une entrée de `spells.json` — l'enveloppe (id/label/desc/source/alsoIn/variants)
 *  est posée par `document()`. */
const champs = {
  /** VDM */
  ecole: z.string(),
  subType: z.string().nullable(),
  domainId: z.string().optional(),
  /** VDM 02 l.363 ; VDM 12 l.646-647 ; VDM 14 l.489 */
  isRitual: z.boolean().optional(),
  /** VDM 02 l.377-393 */
  ritual: ritualSchema.optional(),
  family: z.enum(['mineure', 'arcane', 'invocation', 'beni', 'chaos']),
  cn: z.number().nullable(),
  range: spellRangeSchema.nullable(),
  target: spellTargetSchema.nullable(),
  duration: spellDurationSchema.nullable(),
  missile: z.boolean().optional(),
  damage: z.number().optional(),
  ignorePA: z.boolean().optional(),
  ignoreBE: z.boolean().optional(),
  curated: z.boolean().optional(),
  breathAttack: z.literal(true).optional(),
  opposed: nommerChamps(z.strictObject({
    kind: z.enum(['resist', 'contact']),
    char: charKeySchema.optional(),
    skill: refOuSpec('skill').optional(),
  }), { kind: { label: 'Type' }, char: { label: 'Caractéristique' }, skill: { label: 'Compétence' } }).optional(),
  effects: flowSchema.optional(),
};

/**
 * Champs qu'une variante réglée de `spells.json` peut republier — ceux dont la lecture PASSE par
 * `effectiveEntry` (`src/engine/variants.ts`), preuve par consommateur :
 *  - `desc`/`source` → fiche Codex `src/ui/compendium/registry.ts` (bâtie sur `effectiveEntry`,
 *    `registry.ts`)
 *  - `cn` → NI effectif `castingNumberOf` (`src/engine/magic.ts`), lu par `evaluateCasting`
 *    (`magic.ts`) et `castLandProbability` (`magic.ts`) ; aperçu pré-jet `previewCast`
 *    (`src/state/combatFlow.ts`) ; NI de lecture au grimoire `effectiveSpellOf`
 *    (`src/state/combatFlow.ts`) ; « NI » affiché de la fiche Codex (`registry.ts`)
 *  - `duration` → `durationClockMinutes` (`src/state/combatFlow.ts`), durée de la zone posée
 *    par `placeSpellZone` (`src/state/combatFlow.ts`)
 *  - `effects` → `spellFlowFor` (`src/state/combatFlow.ts`), `spellOps`
 *    (`src/state/combatEffects.ts`)
 * `range`/`target`/`missile`/`damage`/`ignorePA`/`ignoreBE`/`opposed` en sont ABSENTS : aucune
 * variante curée ne les republie, et une liste blanche n'admet un champ qu'au moment où une donnée
 * réelle l'exerce.
 */
export const VARIANT_RESOLVED_FIELDS = ['desc', 'source', 'cn', 'duration', 'effects'] as const;

const doc = document(
  'spells',
  famille,
  champs,
  {
    ecole: {
      label: 'École',
      hint: 'Libellé d’école hérité, non normalisé (18 valeurs, casse double) — la famille de logique vit sur Famille de sort et Domaine',
    },
    subType: { label: 'Sous-type' },
    domainId: { label: 'Domaine', hint: 'Domaine arcanique ou de culte auquel le sort appartient' },
    isRitual: { label: 'Est un Rituel' },
    ritual: {
      label: 'Rubriques de Rituel',
      hint: 'Rubriques qu’un Rituel imprime en plus d’un Sort : Type, Domaines, PX d’apprentissage, Composants, Conditions, Sacrifices, Conséquences — plus le NI porté par la cible et la Difficulté réduite pour certains Domaines',
    },
    family: { label: 'Famille de sort', hint: 'Mineure/Arcane/Invocation/Béni/Chaos — discriminant de logique' },
    cn: { label: 'Niveau d’Incantation' },
    range: { label: 'Portée' },
    target: { label: 'Cible' },
    duration: { label: 'Durée' },
    missile: { label: 'Est un projectile magique' },
    damage: { label: 'Dégâts (projectile magique)', hint: 'Bonus additif de Dégâts du projectile magique' },
    ignorePA: { label: 'Ignore les PA', hint: 'Le projectile magique ignore les Points d’armure de la cible' },
    ignoreBE: { label: 'Ignore le Bonus d’Endurance', hint: 'Le projectile magique ignore le Bonus d’Endurance de la cible' },
    curated: {
      label: 'Entrée officielle curée',
      hint: 'Vrai pour une entrée complète de la base officielle ; absent/faux pour un sort homebrew',
    },
    breathAttack: { label: 'Sort Souffle', hint: 'Délégué à l’attaque de zone du Trait Souffle' },
    opposed: { label: 'Test opposé', hint: 'Le sort exige un Test de résistance ou de contact de la cible' },
    effects: { label: 'Effets déclenchés' },
  },
  {
    codex: { keys: ['spells'] },
    edit: { dataset: 'spells' },
  },
  {
    exiges: ['desc', 'source'],
    variantes: VARIANT_RESOLVED_FIELDS,
    espace: { discriminant: 'family' },
    /** LDB 48 l.495 */
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const e = v as { duration?: { kind?: string } | null; effects?: unknown };
        if (e.duration != null && e.duration.kind !== 'instant') return;
        for (const op of opsPortees(e.effects)) {
          ctx.addIssue({ code: 'custom', path: ['effects'], message: messagePorteSansDuree(String(op.id ?? '')) });
        }
      }),
  },
);

export const schema = doc.schema;
/** L'ENTRÉE scellée (un Sort), pour les lecteurs qui valident une entrée isolée — `schema` emballe le
 *  FICHIER (`z.array`, famille `entite`). */
export const entree = doc.entree;
export const meta = doc.meta;
export const exposition = doc.exposition;
/** Clés top-level relevées AVANT le sceau — le nœud rendu n'a plus de `.shape`
 *  (`variants-integrity.test.ts`). */
export const cles = doc.cles;
