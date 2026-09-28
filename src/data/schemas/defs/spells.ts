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
  z.strictObject({ kind: z.literal('self') }),
  z.strictObject({ kind: z.literal('touch') }),
  z.strictObject({ kind: z.literal('distance'), value: formulaSchema, unit: z.enum(['m', 'km']) }),
  z.strictObject({ kind: z.literal('special'), text: z.string() }),
]);

/** `SpellTarget` (`engine/spellRange.ts`). `maison` : valeur maison ÉDITABLE portant sa
 *  justification, quand le RAW laisse un point ouvert — CLAUDE.md règle 7. */
const spellTargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('self') }),
  z.strictObject({ kind: z.literal('count'), n: formulaSchema }),
  z.strictObject({ kind: z.literal('area'), span: z.enum(['radius', 'diameter']), meters: formulaSchema, excludesCaster: z.boolean().optional(), affects: conditionSchema.optional(), maison: z.string().optional() }),
  z.strictObject({ kind: z.literal('cone'), lengthMeters: formulaSchema, widthMeters: formulaSchema, affects: conditionSchema.optional(), maison: z.string().optional() }),
  z.strictObject({ kind: z.literal('special'), text: z.string() }),
]);

/** `SpellDuration` (`engine/spellDuration.ts`). */
const spellDurationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('instant') }),
  z.strictObject({ kind: z.literal('rounds'), value: formulaSchema, plus: z.literal(true).optional() }),
  z.strictObject({ kind: z.literal('clock'), value: formulaSchema, unit: z.enum(['minutes', 'hours', 'days']) }),
  z.strictObject({ kind: z.literal('untilDawn') }),
  z.strictObject({ kind: z.literal('special'), text: z.string(), plus: z.literal(true).optional() }),
]);

/**
 * ANATOMIE D'UN RITUEL (`VDM 02 l.377-393`) — les rubriques qu'un Rituel imprime EN PLUS d'un Sort.
 * `NI` (`l.379`) et `Description` (`l.393`) n'en sont pas : ce sont `cn` et `desc`, communs à tout
 * Sort puisqu'un Rituel EST un Sort (`l.363`).
 *
 * Chaque champ admis ici a un CONSOMMATEUR (même règle que `VARIANT_RESOLVED_FIELDS` ci-dessous) :
 * la fiche Codex des Sorts (`src/ui/compendium/registry.ts`, catégorie `spells`) rend `xp`/`cnFrom`
 * en faits d'en-tête et les quatre rubriques de prose en section « Rituel ». Les formes qu'aucun
 * consommateur ne lit (ops de sacrifice/conséquence, Tests de condition, modificateurs de NI portés
 * par le Rituel lui-même) sont HORS de ce schéma tant qu'un lecteur ne les exerce pas.
 */
const ritualSchema = z.strictObject({
  /** Rubrique **Type** (`l.381`) VERBATIM — l'énoncé imprimé de qui peut y prendre part. */
  type: z.string(),
  /** Le même **Type** en ids de `domains.json`, part EXÉCUTABLE de la rubrique (`l.381` : « Un
   *  lanceur de sorts qui ne pratique pas l'un des Domaines listés ne peut pas y prendre part »),
   *  lue par `arcaneDomainsOf`/`eligibleTalent` (`src/engine/grimoire.ts`). REQUISE — aucun Rituel
   *  n'est dispensé de dire ses Domaines, et « plusieurs Domaines » n'est JAMAIS représenté par
   *  « aucun ». Deux états :
   *   - liste PEUPLÉE = seuls ces Domaines ; un Rituel ouvert à trois reste interdit au quatrième ;
   *   - liste VIDE = « N'importe quel Domaine », aucune exclusion.
   *  Une rubrique qui désigne une CATÉGORIE (« N'importe quel Domaine sombre », `VDM 02 l.414`) se
   *  résout par la liste que le livre en donne — ici les deux Domaines du chapitre de Magie noire
   *  du Livre de base (`LDB 50`, cf. `LDB 47 l.309`). */
  domains: z.array(z.string()),
  /** Rubrique **NI** (`l.379`) lorsqu'elle n'imprime PAS un nombre mais une formule sur la CIBLE
   *  (« Force Mentale du démon ») : `cn` reste `null`, et la fiche Codex affiche ce texte au lieu
   *  d'un NI muet. VERBATIM. */
  cnFrom: z.string().optional(),
  /** Rubrique **PX d'apprentissage** (`l.383`). */
  xp: z.number(),
  /** DIFFICULTÉ RÉDUITE imprimée entre parenthèses (`VDM 02 l.398` : « **NI :** 50 (25) », `l.400` :
   *  « **PX d'apprentissage :** 200 (100) »), dont la rubrique `type` nomme les bénéficiaires. La
   *  clause porte sur le LANCEUR (les Domaines qu'il PRATIQUE), pas sur le Rituel — d'où ces ids
   *  ici et non un `CastingNumberMod`, dont le `CastingNumberSubject.domainId` est le Domaine du
   *  SORT (`src/engine/castingNumber.ts`). Lue par `ritualReduction` (`src/engine/grimoire.ts`),
   *  consommée par `spellCost` (PX) et `castingNumberOf` (`src/engine/magic.ts`, NI de base). */
  reduced: z.strictObject({
    /** Ids de `domains.json` dont la pratique ouvre la valeur réduite. */
    domains: z.array(z.string()),
    /** Le Talent Magie du Chaos y ouvre aussi — `domains.json` ne porte pas le Chaos (c'est une
     *  `family`), il se lit donc sur le lanceur comme pour `CastingNumberScope.chaosMagic`. */
    chaosMagic: z.literal(true).optional(),
    cn: z.number(),
    xp: z.number(),
  }).optional(),
  /** Rubrique **Composants** (`l.385`) VERBATIM. */
  components: z.string(),
  /** Rubrique **Conditions** (`l.387`) VERBATIM. */
  conditions: z.string(),
  /** Rubrique **Sacrifices** (`l.389`) VERBATIM. */
  sacrifices: z.string(),
  /** Rubrique **Conséquences** (`l.391`) VERBATIM. */
  consequences: z.string(),
});

// ── SpellData (src/data/index.ts) ───────────────────────────────────────────────────────────────
/** Champs PROPRES d'une entrée de `spells.json` — l'enveloppe (id/label/desc/source/alsoIn/variants)
 *  est posée par `document()`. */
const champs = {
  /** ÉCOLE — libellé d'affichage hérité (dépotoir : 18 valeurs, casse double 'Magie mineure' /
   *  'Magie Mineure') ; le discriminant de logique reste `family` + `domainId`. Sa MORT PAR
   *  DÉRIVATION depuis `family` + `domainIds` appartient à #1517 (Sorts multi-domaines : `domainId`
   *  single, 320/576 null → `domainIds` pluriel sur règle RAW VDM citée, puis mort du libellé `ecole`
   *  par dérivation). */
  ecole: z.string(),
  subType: z.string().nullable(),
  domainId: z.string().optional(),
  /** `VDM 02 l.363` / `l.377-393` — TAG lu par `castingNumberOf` (`src/engine/magic.ts`) et
   *  `effectiveSpellOf` (`src/state/combatFlow.ts`) pour composer un `CastingNumberSubject`
   *  dont le `kind` départage les portées `kinds:['sort'|'rituel']` (`VDM 12 l.646-647`,
   *  `VDM 14 l.489`). Sans ce champ au schéma, aucune donnée ne peut porter la nature Rituel. */
  isRitual: z.boolean().optional(),
  /** Rubriques d'ANATOMIE D'UN RITUEL (`VDM 02 l.377-393`) — présentes sur les seules entrées
   *  taguées `isRitual`. */
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
  opposed: z.strictObject({
    kind: z.enum(['resist', 'contact']),
    char: charKeySchema.optional(),
    skill: refOuSpec('skill').optional(),
  }).optional(),
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
    /**
     * Un État PORTÉ (`carried`, #1695 — LDB 48 l.495 « qui persistent tous pour la durée du Sort »)
     * tient sa durée de l'effet actif du Sort. Un Sort à Durée INSTANTANÉE ou ABSENTE n'en pose
     * aucun : l'État serait porté à jamais. Refus NOMINATIF au parse, MOT POUR MOT comme `applyOps`
     * le journalise (`messagePorteSansDuree`) — patron du jumeau `messageRecurrenceHorloge`. Les
     * Durées `special`/`untilDawn` ne se jugent PAS ici (leur échéance se résout au lancement) :
     * c'est le refus À L'APPLICATION qui les couvre.
     */
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
