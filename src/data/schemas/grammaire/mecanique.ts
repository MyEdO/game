/**
 * MÉCANIQUE de la grammaire de document (#1466 L1a) — l'algèbre exécutable portée en donnée :
 * `GameOp`, `Condition`, `FlowTest`, `EffectOp`, `Flow`, `TriggeredEffect`, et les entrées de
 * table qui embarquent des ops (voyage, critiques de coque). Le registre `OP_DEFS` type le payload
 * op par op ; `OPS_NON_TYPEES` porte celles qui restent à décrire (lot L1c #1468).
 */
import { z } from 'zod';
import { isMenaceId, menaceIds } from '../../../engine/menace';
import { CATEGORY_BY_SOURCE_KIND, type EffectSourceKind } from '../../../engine/types';
import type { StakeRef } from '../../index';
import { messageRecurrenceHorloge, type GameOp } from '../../../engine/ops';
import { INDICE_TEMPLATE, type Condition, type EffectOp, type EffectTrigger, type Flow } from '../../../engine/flowCore';
import { chaosAlignSchema, charKeySchema, difficultySchema, enumNomme, exposureLevelSchema, formulaSchema, hitLocationSchema, plageSchema, reachSchema, refTestDeCorruption, sizeCategorySchema, surchargePaletteSchema, symptomSeveritySchema } from './valeurs';
import { traitInstanceSchema } from './reference';
import { marque } from './slots';
import { idDe, ref, refs, refOuSpec } from './ref';

/** `PerSL` (`src/engine/ops.ts:146`) — échelle « par +N DR » d'un payload d'op. */
export const perSLSchema = z.strictObject({ every: z.number(), amount: z.number(), onFailure: z.boolean().optional() });

/**
 * Payload STRICT par op (`src/engine/ops.ts`, union `GameOp`). Chaque entrée est un contrat POSITIF
 * vérifié sur toutes les occurrences réelles de l'op dans les 2 racines authorées.
 */
export const OP_DEFS: Readonly<Record<string, z.ZodType<unknown>>> = {
  banish: z.strictObject({ op: z.literal('banish'), narration: z.enum(['chaos', 'unravel']).optional(), onlyGroups: z.array(z.string()).optional() }),
  corruption: z.strictObject({
    op: z.literal('corruption'),
    amount: z.number(),
    perSL: perSLSchema.optional(),
    align: chaosAlignSchema.optional(),
  }),
  corruptionExposure: z.strictObject({
    op: z.literal('corruptionExposure'),
    level: exposureLevelSchema.optional(),
    skill: refTestDeCorruption.optional(),
    easeSteps: z.number().optional(),
  }),
  aggravateSymptom: z.strictObject({
    op: z.literal('aggravateSymptom'),
    disease: idDe('maladie'),
    symptomId: idDe('symptome'),
    severity: symptomSeveritySchema,
    otherwise: z.array(z.lazy(() => gameOpSchema)).optional(),
  }),
  attenuateSymptom: z.strictObject({
    op: z.literal('attenuateSymptom'),
    disease: idDe('maladie'),
    symptomId: idDe('symptome'),
    otherwise: z.array(z.lazy(() => gameOpSchema)).optional(),
  }),
  grantSymptom: z.strictObject({
    op: z.literal('grantSymptom'),
    disease: idDe('maladie'),
    symptomId: idDe('symptome'),
    severity: symptomSeveritySchema.optional(),
  }),
  /** `amputer` (LDB 18 l.233-286) : AUTHORABLE comme toute op (l'atelier la propose sous « Séquelles &
   *  mobilité » — un Trait de créature qui tranche un membre s'écrit avec elle), mais AUCUNE donnée
   *  committée ne la porte aujourd'hui : ses seuls producteurs sont les rangées de Critique, où
   *  `noeudAmputation` (engine/critical.ts) la fabrique depuis `entry.amputation`. Son payload est typé
   *  ICI comme celui de toute op authorée ; ses `sequels` sont des ids de fiche `traumas.json`, dataset
   *  non encore déclaré à `TYPES` (même graphie que `amputationSchema`). */
  amputer: z.strictObject({
    op: z.literal('amputer'),
    sequels: z.array(z.string()),
    loc: hitLocationSchema.optional(),
    unites: formulaSchema.optional(),
    unitesPerSL: perSLSchema.optional(),
  }),
  /** `fall` — la hauteur ne s'authore JAMAIS au site : elle se lit dans la table nommée (`MDG 13
   *  l.684`), par Taille de coque et par station du tombant. La table se désigne par la graphie
 *  CANONIQUE d'une référence (`{id}`) ; `ref(type)` ne s'applique pas — ces tables n'ont pas de
 *  dataset à elles, elles vivent DANS le jeu de Critiques qui les imprime. */
  fall: z.strictObject({ op: z.literal('fall'), hauteur: z.strictObject({ table: z.strictObject({ id: z.string() }) }) }),
  heal: z.strictObject({ op: z.literal('heal'), amount: formulaSchema, perSL: perSLSchema.optional() }),
  /** `money` — mouvement de la bourse PERSONNELLE de la cible. La charge porte son NOM (`montant`),
   *  comme toute autre action du vocabulaire (`giveMoney.montant`, `giveXp.amount`) : elle n'est jamais
   *  étalée parmi les clés de l'op (garde `src/data/monnaie-forme-unique.test.ts`, sonde A). La seule
   *  dénomination chiffrable est `brass`, l'unité de compte de `engine/money.ts`. */
  money: z.strictObject({ op: z.literal('money'), montant: z.strictObject({ brass: formulaSchema }) }),
  giveTrapping: z.strictObject({
    op: z.literal('giveTrapping'),
    trappingId: idDe('trapping').optional(),
    custom: z.string().optional(),
    count: z.number().optional(),
    perSL: perSLSchema.optional(),
  }),
  grantWeapon: z.strictObject({
    op: z.literal('grantWeapon'),
    label: z.string(),
    damage: formulaSchema,
    damagePlus: z.number().optional(),
    plusBF: z.boolean().optional(),
    qualities: z.array(z.string()).optional(),
    subType: z.string().optional(),
    reach: reachSchema.optional(),
    hands: z.union([z.literal(1), z.literal(2)]).optional(),
    onHitEffects: z.array(z.lazy(() => triggeredEffectSchema)).optional(),
    skin: surchargePaletteSchema.optional(),
    form: idDe('trapping').optional(),
    chooseForm: z.boolean().optional(),
  }),
  healCaster: z.strictObject({ op: z.literal('healCaster'), amount: formulaSchema }),
  kill: z.strictObject({ op: z.literal('kill') }),
  loseTurn: z.strictObject({ op: z.literal('loseTurn'), what: z.enum(['action', 'movement']).optional() }),
  noBreath: z.strictObject({ op: z.literal('noBreath') }),
  noHunger: z.strictObject({ op: z.literal('noHunger') }),
  removeTrait: z.strictObject({ op: z.literal('removeTrait'), traitId: idDe('trait') }),
  /** `domeWard` — le dôme OCTROIE un Trait à ceux qu'il couvre (`LDB 47 l.410`) : le Trait se nomme
   *  par la MÊME graphie que partout ailleurs (`traitId`), son Indice est une `Formula`. AUCUNE zone :
   *  elle est déjà écrite par la ligne « Cible » du sort (ZdE, `LDB 47 l.28`) — l'op la LIT. */
  domeWard: z.strictObject({ op: z.literal('domeWard'), traitId: idDe('trait'), indice: formulaSchema }),
  suffocate: z.strictObject({ op: z.literal('suffocate') }),
  /** `summon` — la créature invoquée se nomme par un id du bestiaire (`idDe('creature')`) : une op
   *  sans créature est refusée AU PARSE (#1882), jamais spawnée. */
  summon: z.strictObject({
    op: z.literal('summon'),
    ref: idDe('creature'),
    count: formulaSchema,
    countPerSL: perSLSchema.optional(),
    addTraits: z.array(traitInstanceSchema).optional(),
    size: sizeCategorySchema.optional(),
    allyOfCaster: z.boolean().optional(),
    despawnIfCasterDown: z.boolean().optional(),
  }),
  /** `offTerrainMod` — passif POSITIONNEL : hors de son terrain d'ÉLECTION, le porteur subit un M
   *  IMPOSÉ (`mSet`, Créature marine MDG 16 l.17 « son M tombe à 1 » ; Aquatique MSRC 15 l.139 → 0),
   *  un malus de DR à TOUS ses Tests (`testDR`) et/ou la suffocation (`suffocates`). Le terrain se
   *  nomme par un ID du registre (`idDe('terrain')`) : un terrain inconnu est refusé AU PARSE, là où
   *  il rendait auparavant le drapeau `offTerrain` VRAI partout en silence (`engine/ops.ts:279-283`). */
  offTerrainMod: z.strictObject({
    op: z.literal('offTerrainMod'),
    terrain: idDe('terrain'),
    mSet: z.number().optional(),
    testDR: z.number().optional(),
    suffocates: z.boolean().optional(),
  }),
};

/**
 * Ops du moteur DONT LE PAYLOAD RESTE À DÉCRIRE — liste NOMINATIVE datée (2026-08-24),
 * DÉCROISSANTE, lot de mort `L1c #1468` (qui remplit les payloads restants et fait mourir le repli
 * `looseObject` de `gameOpSchema`). C'est l'INVENTAIRE des payloads non encore déclarés, pas un
 * constat d'obstacle : une seule entrée porte une mesure PROPRE — `gainAdvantage`, dont `traits.json`
 * écrit `amount: "$indice"` (chaîne) hors de `formulaSchema`. Les autres attendent leur mesure en L1c.
 * Une entrée ne se retire que par le commit qui TYPE l'op dans `OP_DEFS`.
 */
export const OPS_NON_TYPEES: readonly string[] = [
  'actGate', 'ap', 'armourPierce', 'arrowWard', 'attackKeyword', 'attackWardFM', 'attrMod', 'augmentWeapon',
  'beginPsych', 'breakBlade', 'castPenalty', 'castWard', 'chain', 'charDRBonus', 'charDamage', 'charMod',
  'condition', 'contractDisease', 'crewTestMod', 'critOnRoll', 'critTwice', 'cureCriticalWound', 'cureDisease',
  'damageArmour', 'delayed', 'disarm', 'diseaseTestMod', 'endPsych', 'endTransform', 'exposeDisease',
  'freeReroll', 'gainAdvantage', 'gainResource', 'grantCareerSkill', 'grantCareerTalent',
  'grantFreeAttack', 'grantNaturalWeapon', 'grantPsychTrait', 'grantReverseToken', 'grantTalent', 'grantTrait',
  'handGate', 'ignoreAnimosity', 'ignoreStatePenalties', 'incomingAdvantage', 'incomingAttackMod',
  'incomingSpellDRMod', 'interruptFocus', 'intoxicate', 'lifeSteal', 'light', 'martyr', 'maxWeaponHands',
  'mitigateIncoming', 'moveMod', 'moveScale', 'narrative', 'perRound', 'polymorph',
  'preventInfection', 'push', 'reduceDiseaseDays', 'reduceToZero', 'removeCondition', 'removePsychTrait',
  'removeShipPoste', 'rollMutation', 'rollTable', 'rollThreshold', 'sbBonus', 'scheduleRespawn', 'senseLoss',
  'sinMod', 'skillDRBonus', 'skillMod', 'spendAdvantage', 'statusMod', 'suppressPsych',
  'suppressSymptom', 'teamCommander', 'teleport', 'testMod', 'transform', 'weaponDamageMod', 'weaponRollMod',
  'weatherWard', 'wounds', 'zone',
];

/** Champs de l'op `condition` qu'un État PORTÉ (#1695) ne peut PAS tenir — LISTE CLOSE, alignée sur ce
 *  que la branche `carried` d'`applyOps` transporte réellement (`id`/`value`/`resolveWindow`) :
 *  les DURÉES et la récurrence (l'effet porteur les tient), les VERROUS (la source EST le verrou), et
 *  les champs de LUTTE, figés par `addCondition` à la pose — que la réconciliation appelle NU. */
export const CHAMPS_EXCLUS_DE_CARRIED = [
  'durationRounds', 'durationMinutes', 'durationHours', 'perRound', 'lockedUntil', 'unlockBy',
  'escapeStrength', 'escapeThreshold', 'entangleOnFail', 'struggleDamage', 'grapple',
] as const;

/**
 * Refus qui portent sur une op encore LOOSE (`OPS_NON_TYPEES`) : ce que le payload strict dirait s'il
 * existait, dit AU PARSE plutôt qu'à l'application. Une entrée meurt avec le typage de son op.
 * — `condition` : `perRound` + durée d'HORLOGE, refusé mot pour mot comme `applyOps` le lève
 *   (`messageRecurrenceHorloge`, `engine/ops.ts`).
 * — `condition` : `carried` + tout `CHAMPS_EXCLUS_DE_CARRIED`, refusé NOMINATIVEMENT (#1695).
 */
function refusLoose(v: Record<string, unknown>, ctx: z.RefinementCtx): void {
  if (v.op !== 'condition') return;
  if (v.perRound === true && (v.durationMinutes != null || v.durationHours != null)) {
    ctx.addIssue({ code: 'custom', path: ['perRound'], message: messageRecurrenceHorloge(String(v.id ?? '')) });
  }
  // État PORTÉ (#1695, LDB 48 l.495) : le canal passif ne transporte que `id`/`value`/`resolveWindow`
  // (`ops.ts`, branche `carried` d'`applyOps` → `syncDerivedConditions` → `addCondition` nu). Tout autre
  // champ de l'op serait PERDU en silence — il est donc NOMMÉ au parse.
  if (v.carried === true) {
    for (const champ of CHAMPS_EXCLUS_DE_CARRIED) {
      if (v[champ] == null) continue;
      ctx.addIssue({
        code: 'custom',
        path: [champ],
        message: `État « ${String(v.id ?? '')} » : « carried » (porté par l'effet actif de la source, #1695) est EXCLUSIF de « ${champ} » `
          + "— un État porté ne tient ni durée, ni verrou, ni champ de lutte en propre : sa durée est celle de l'effet porteur "
          + '(`durationFromCtx`), sa source EST son verrou (un `unlockBy` y serait inerte, `releaseConditionLocks`), et le canal '
          + 'passif ne transporte que `id`/`value`/`resolveWindow` — le reste serait PERDU à la pose. Retirer l’un des deux champs.',
      });
    }
  }
  for (const kind of sujetsNonGarantis(v.lockedUntil)) {
    ctx.addIssue({
      code: 'custom',
      path: ['lockedUntil'],
      message: `Verrou d'État « ${String(v.id ?? '')} » : la Condition « ${kind} » lit un état que le contexte de verrou ne porte PAS `
        + "(`conditionLockCtx`, engine/actorView.ts — la vue du seul PORTEUR : Caractéristiques, PB, Taille, Avantage, camp, appartenances, États, Capacités). "
        + 'Elle serait évaluée FAUSSE en silence : réécrire le verrou sur le porteur, ou étendre le contexte AVANT la donnée.',
    });
  }
}

/** Familles de `Condition` qu'un contexte de VERROU d'État GARANTIT — elles ne lisent que la vue
 *  d'acteur (`buildActorView`). Tout le reste (drapeaux de scène, horloge, bourse, inventaire de
 *  groupe, contexte de résolution d'une touche) est absent de ce contexte. */
export const SUJETS_DE_VERROU = new Set(['always', 'compare', 'capability', 'has', 'relation', 'casterChaosDomain', 'visiblePassive'] as const);

/** Les `kind` d'une Condition de verrou que le contexte ne garantit pas (récursif sur `all`/`any`/`not`). */
export function sujetsNonGarantis(cond: unknown): string[] {
  if (!cond || typeof cond !== 'object') return [];
  const c = cond as Record<string, unknown>;
  if (c.kind === 'all' || c.kind === 'any') return (Array.isArray(c.of) ? c.of : []).flatMap(sujetsNonGarantis);
  if (c.kind === 'not') return sujetsNonGarantis(c.of);
  return typeof c.kind === 'string' && !(SUJETS_DE_VERROU as ReadonlySet<string>).has(c.kind) ? [c.kind] : [];
}

/**
 * Un `GameOp` (`src/engine/ops.ts`) tel qu'il apparaît en DONNÉE. Une op de `OP_DEFS` est validée sur
 * son payload STRICT ; une op de `OPS_NON_TYPEES` garde la forme LOOSE (aux refus de `refusLoose`
 * près) ; une op inconnue des DEUX registres est NOMMÉE en erreur. Ce rouge vit ICI et nulle part
 * ailleurs : la clé `op` est surchargée en donnée (les comparateurs `>=`/`<=`/`==` d'une `Condition`
 * la portent aussi).
 */
export const gameOpSchema: z.ZodType<GameOp> = z.looseObject({ op: z.string() }).superRefine((v, ctx) => {
  const payload = OP_DEFS[v.op];
  if (payload) {
    const res = payload.safeParse(v);
    // L'issue du payload est REPORTÉE TELLE QUELLE, seul son `message` est préfixé du nom de l'op :
    // aplatir son `code` en `'custom'` forcerait un consommateur à trier les refus d'op par leur
    // PHRASE — donc par la locale (`grammaire/locale-fr.ts`), qui n'est pas un contrat.
    if (!res.success) for (const issue of res.error.issues) ctx.addIssue({ ...issue, message: `GameOp « ${v.op} » : ${issue.message}` });
    return;
  }
  if (OPS_NON_TYPEES.includes(v.op)) { refusLoose(v, ctx); return; }
  ctx.addIssue({
    code: 'custom',
    path: ['op'],
    message: `GameOp « ${v.op} » : op inconnue de OP_DEFS et de OPS_NON_TYPEES (src/data/schemas/grammaire/mecanique.ts) — la typer, ou l'inscrire à la liste avec sa raison mesurée.`,
  });
}).transform((v) => v as GameOp);

// ============================================================================
// FLOW CORE (`src/engine/flowCore.ts`) — Condition / FlowTest / Flow / TriggeredEffect. SOURCE UNIQUE
// pour `domains`/`maneuvers`/`qualities`/`talents`/`etats`/`spells`/`traits`/`trappings`/`psychology`,
// qui redéclaraient CHACUN cette algèbre (à l'identique ou avec des libertés locales — cf. écarts
// absorbés ci-dessous, chaque dataset re-testé au parse après rewire).
// ============================================================================

export const compareOpSchema = z.enum(['>=', '<=', '==', '<', '>']);
/** ACTEUR désigné par une mécanique — 2ᵉ espèce de slot, retrouvée par la marche (`slots.ts`). La
 *  marque de slot et les libellés de valeurs vivent sur le MÊME nœud : `marque` rend la feuille telle
 *  quelle, il n'y a donc pas de second registre. */
export const actorRefSchema = marque(enumNomme({ target: 'la cible', caster: 'le lanceur' }), { espece: 'acteur', site: 'actorRefSchema' });

/** `Relation | Camp` (`src/engine/relations.ts`) — union complète lue par la Condition `relation`.
 *  Resserré depuis `z.string()` (variantes `domains`/`talents`/`etats`/`spells`) : les 9 JSON ne
 *  portent que `'opponent'` aujourd'hui, sans-risque vis-à-vis de l'enum SOURCE (vérifié au parse). */
export const relationOrCampSchema = enumNomme({
  self: 'soi-même',
  ally: 'allié (même camp)',
  opponent: 'adversaire (camp ≠)',
  party: 'du groupe (joueur)',
  neutral: 'neutre (PNJ)',
  hostile: 'hostile (ennemi)',
});

/** Donnée FIXE d'un acteur, comparable par la Condition `compare` (`ActorField`, `engine/flowCore`).
 *  UNE instance pour les deux côtés de la comparaison (sujet et valeur). */
export const actorFieldSchema = enumNomme({ woundsCurrent: 'PB courants', woundsMax: 'PB max', size: 'Taille', advantage: 'Avantage' });

/** QUANTIFICATEUR sur le groupe des héros (`partyDead`/`skill`/`career`/`species`/`status`) — déclaré
 *  au module : sous le `lazy` de `conditionSchema`, ses cinq sites rendaient 1 475 nœuds jumeaux. */
export const partyWhoSchema = enumNomme({ any: 'un héros au moins', all: 'tout le groupe' });

/** Cause d'effarouchement testée par la Condition `startleCause` (Nerveux, `LDB 85 l.197`). */
export const startleCauseSchema = enumNomme({ noise: 'Bruits forts', magic: 'Magie' });

/** Nature de l'appartenance testée par la Condition `has`. */
export const hasWhatSchema = enumNomme({ group: 'le Groupe', talent: 'le Talent', trait: 'le Trait', psych: 'l’état psy' });

/** SENS engagé par un Test (`FlowTest.sense` — Perception : vue ou ouïe) ; le libellé est celui de la
 *  phrase qui le montre au joueur (op `senseLoss` : « perd la vue »). */
export const senseSchema = enumNomme({ vue: 'la vue', ouie: "l'ouïe" });

const charRefSchema = z.strictObject({ who: actorRefSchema, char: charKeySchema, bonus: z.boolean().optional() });
const compareSubjectSchema = z.union([
  z.strictObject({ who: actorRefSchema, field: actorFieldSchema }),
  z.strictObject({ who: actorRefSchema, condition: z.string() }),
  charRefSchema,
]);
/** `CompareSubject & { factor?: number }` (`engine/flowCore.ts:131`) — un `z.intersection` d'un
 *  `z.union` de `strictObject` NE FONCTIONNE PAS avec zod (chaque branche strict rejette les clés des
 *  autres, cf. `domains.ts` avant ce rewire : `z.intersection(compareSubjectSchema, …)` échouait sur
 *  `etats.json` #14 « inondation » — `{who,char:'E',factor:0.5}` — vérifié en isolation). La forme
 *  fidèle est donc l'UNION des 3 branches de `CompareSubject`, chacune portant son `factor`. */
const compareValueSchema = z.union([
  z.number(),
  z.strictObject({
    who: actorRefSchema,
    field: actorFieldSchema,
    factor: z.number().optional(),
  }),
  z.strictObject({ who: actorRefSchema, condition: z.string(), factor: z.number().optional() }),
  z.strictObject({ who: actorRefSchema, char: charKeySchema, bonus: z.boolean().optional(), factor: z.number().optional() }),
]);

/** `Condition` (`engine/flowCore.ts:112`) — algèbre CLOSE, récursive via `all`/`any`/`not`. */
export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('always') }),
    z.strictObject({ kind: z.literal('flag'), expr: z.string().min(1, 'Condition « flag » : le drapeau (`expr`) est vide — nommez le drapeau posé par l’Effet `setFlag`, ou retirez la Condition.') }),
    z.strictObject({
      kind: z.literal('time'),
      window: z.strictObject({
        afterHour: z.number().optional(),
        afterMinute: z.number().optional(),
        beforeHour: z.number().optional(),
        beforeMinute: z.number().optional(),
      }),
    }),
    z.strictObject({ kind: z.literal('hasItem'), trappingId: z.string(), count: z.number().optional() }),
    z.strictObject({
      kind: z.literal('money'),
      atLeast: z.strictObject({ gold: z.number().optional(), silver: z.number().optional(), brass: z.number().optional() }),
    }),
    z.strictObject({ kind: z.literal('partyDead'), who: partyWhoSchema }),
    z.strictObject({ kind: z.literal('skill'), id: z.string(), spec: z.string().optional(), advances: z.number().optional(), who: partyWhoSchema.optional() }),
    z.strictObject({ kind: z.literal('career'), id: z.string(), who: partyWhoSchema.optional() }),
    z.strictObject({ kind: z.literal('species'), id: z.string(), who: partyWhoSchema.optional() }),
    z.strictObject({ kind: z.literal('status'), atLeast: z.string(), who: partyWhoSchema.optional() }),
    z.strictObject({ kind: z.literal('compare'), subject: compareSubjectSchema, op: compareOpSchema, value: compareValueSchema }),
    z.strictObject({ kind: z.literal('slThreshold'), op: compareOpSchema, value: z.number() }),
    z.strictObject({ kind: z.literal('location'), is: hitLocationSchema }),
    z.strictObject({ kind: z.literal('attackKind'), is: z.string() }),
    z.strictObject({ kind: z.literal('startleCause'), is: startleCauseSchema }),
    z.strictObject({ kind: z.literal('woundsDealt'), op: compareOpSchema, value: z.number() }),
    z.strictObject({ kind: z.literal('engagedAdvantageGap'), op: compareOpSchema, value: z.number() }),
    z.strictObject({ kind: z.literal('engagedAdvantageLead'), op: compareOpSchema, value: z.number() }),
    z.strictObject({ kind: z.literal('foeInLoS') }),
    z.strictObject({ kind: z.literal('hiddenFromFoes') }),
    z.strictObject({ kind: z.literal('engaged') }),
    z.strictObject({ kind: z.literal('crewTest') }),
    z.strictObject({ kind: z.literal('nearestFoe'), op: compareOpSchema, value: z.number() }),
    z.strictObject({ kind: z.literal('capability'), who: actorRefSchema, id: z.string(), op: compareOpSchema.optional(), value: z.number().optional() }),
    z.strictObject({ kind: z.literal('relation'), who: actorRefSchema, is: relationOrCampSchema }),
    z.strictObject({ kind: z.literal('has'), who: actorRefSchema, what: hasWhatSchema, value: z.string(), spec: z.string().optional() }),
    z.strictObject({ kind: z.literal('casterChaosDomain'), is: z.string() }),
    z.strictObject({ kind: z.literal('visiblePassive'), who: actorRefSchema }),
    z.strictObject({ kind: z.literal('all'), of: z.array(conditionSchema) }),
    z.strictObject({ kind: z.literal('any'), of: z.array(conditionSchema) }),
    z.strictObject({ kind: z.literal('not'), of: conditionSchema }),
  ]),
);


/** `FlowTest` (`engine/flowCore.ts:335`) — jet différé (→ modale), tout le métier hors branches. */
/** `CatalogStake` (`src/data/index.ts`) — RÉFÉRENCE d'enjeu vers un DATASET : la clé de la donnée +
 *  les valeurs calculées pour ses trous. Un Flow authoré peut DIRE ce qu'il met en jeu sans qu'aucun
 *  texte n'entre au document (le résolveur reste la seule porte du texte). */
export const catalogStakeSchema = z.strictObject({
  key: z.strictObject({
    dataset: z.enum(['night', 'voyage', 'weather', 'flow', 'activity', 'combat']),
    kind: z.string(),
    entryId: z.string().optional(),
    entryCategory: z.string().optional(),
  }),
  values: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

/** `AuthoredStake` (`src/data/index.ts`) — la phrase qu'un DOCUMENT de campagne écrit lui-même
 *  (arbitrage user 2026-08-12, #1262) : elle voyage avec le document et ne pointe aucun dataset. */
export const authoredStakeSchema = z.strictObject({ authored: z.string() });

/** `DerivedStake` (`src/data/index.ts`) — enjeu DÉRIVÉ de l'entité porteuse (`{kind, id}`), calculé
 *  au montage de l'étape par le socle. */
export const derivedStakeSchema = z.strictObject({
  from: z.strictObject({
    kind: z.enum(Object.keys(CATEGORY_BY_SOURCE_KIND) as [EffectSourceKind, ...EffectSourceKind[]]),
    id: z.string(),
  }),
});

/** `StakeRef` (`src/data/index.ts`) — les TROIS formes d'enjeu d'une entrée de jet, qui passent par
 *  la même porte de résolution (`resolveStake`). */
export const stakeRefSchema: z.ZodType<StakeRef> = z.union([
  catalogStakeSchema,
  authoredStakeSchema,
  derivedStakeSchema,
]);

export const flowTestSchema = z.strictObject({
  /** ENJEU du Test (#1117) — cf. `stakeRefSchema`. */
  stake: stakeRefSchema.optional(),
  skill: refOuSpec('skill').optional(),
  sense: senseSchema.optional(),
  characteristic: charKeySchema.optional(),
  difficulty: difficultySchema.optional(),
  requireSL: z.number().optional(),
  label: z.string().optional(),
  tool: z.string().optional(),
  vsGroups: z.array(z.string()).optional(),
  vsStatus: z.string().optional(),
  begging: z.boolean().optional(),
  vsCapricieux: z.boolean().optional(),
  easierIf: z
    .strictObject({
      hasSkill: z.strictObject({ id: z.string(), spec: z.string().optional() }).optional(),
      hasTalent: z.string().optional(),
      steps: z.number().optional(),
    })
    .optional(),
  argDifficulty: z.boolean().optional(),
  unlessImmune: z.string().optional(),
  onlyGroups: z.array(z.string()).optional(),
  exceptGroups: z.array(z.string()).optional(),
  gate: conditionSchema.optional(),
  /** SOUTIEN (LDB 12 l.197) — TRI-ÉTAT authoré : absent = défaut de la VOIE qui ouvre le Test (scène/
   *  dialogue : soutenable ; effet déclenché / consommable : non soutenable) ; `true` = jamais
   *  soutenable ; `false` = soutenable malgré la voie (Test de soin d'un nécessaire). */
  noSupport: z.boolean().optional(),
  /** Tag MENACE du talent « Résistance (Menace) » (LDB 10 l.1016-1020) — CLÉ ÉTRANGÈRE vers un id de
   *  spec de l'entrée `resistance` de `talents.json`, résolue à la VALIDATION (liste OUVERTE : une
   *  spec ajoutée au Compendium est utilisable sans toucher au code). Un id inconnu échoue au
   *  chargement (`dev-validate`), au contrat CI (`schema-contract.test.ts`) et à la sauvegarde Codex. */
  menace: z
    .string()
    .superRefine((v, ctx) => {
      if (isMenaceId(v)) return;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `menace « ${v} » : aucune spec de ce nom sur le talent « resistance » (talents.json). Valeurs admises : ${menaceIds().join(', ')}`,
      });
    })
    .optional(),
  difficultyBy: z.array(z.strictObject({ cond: conditionSchema, difficulty: difficultySchema })).optional(),
  opposed: z
    .strictObject({
      attacker: charKeySchema,
      attackerSkill: z.string().optional(),
      attackerLabel: z.string().optional(),
      bonusSL: z.number().optional(),
      attackerBonusSL: z.number().optional(),
    })
    .optional(),
}).superRefine((v, ctx) => {
  // UN JET NOMME CE QU'IL TESTE (#1657 B3-3). Sans `skill` ni `characteristic`, la porte n'a rien à
  // calculer : `testValue` rend 0 et le jet devient un auto-échec SILENCIEUX, sur une cible qui n'est
  // la valeur de personne. Les deux peuvent coexister — une Compétence jouée sur une autre
  // Caractéristique que la sienne (Venin : Résistance sur Endurance, `LDB 20`) est une forme RAW.
  if (v.skill || v.characteristic) return;
  ctx.addIssue({
    code: 'custom',
    path: ['skill'],
    message: 'jet SANS compétence ni caractéristique : la porte le jouerait sur une valeur de 0 '
      + '(auto-échec muet). Nommer `skill` (id de compétence) ou `characteristic`.',
  });
});

/** EFFECTOP — pont UNIQUE entre la logique authorée (Flow) et le moteur mécanique des sorts : applique
 *  des `GameOp` à une cible (`party`/`hero` scène, ou `caster`/`target` incantation). Feuille `do` par
 *  DÉFAUT du `Flow<E>` générique (`engine/flowCore.ts:45`), et l'un des membres de l'union `Effect` de
 *  scène (`defs-scenes/effets.ts`). `on` = les 4 valeurs de
 *  l'interface TS : `'party'`/`'hero'` (scène) ou `'caster'`/`'target'` (contexte d'incantation). Le
 *  ciblage `'self'`/`'victim'` est le vocabulaire du NIVEAU TRIGGER (`effectTargetingSchema`), pas de la
 *  feuille : sur la feuille, `'caster'` = porteur, `'target'` = cible résolue par le trigger. */
export const effectOpSchema = z.strictObject({
  type: z.literal('ops'),
  ops: z.array(gameOpSchema),
  on: z.enum(['party', 'hero', 'caster', 'target']).optional(),
  heroId: z.string().optional(),
  untilTime: z.number().optional(),
  label: z.string().optional(),
});

/** Test ÉTENDU (`LDB 12 l.172-174`) : un acteur cumule des DR Round par Round jusqu'à `targetDR`
 *  (crocheter une serrure, forcer un mécanisme…). `flag` posé à la réussite (gate la suite). */
export const extendedTestSchema = z.strictObject({
  type: z.literal('extendedTest'),
  /** Compétence testée — référence `{ id, spec? }` ; la `spec` précise QUELLE instance est testée
   *  quand le héros en possède plusieurs (Métier (Serrurier), Savoir (Magie)…). */
  skill: refOuSpec('skill').optional(),
  characteristic: charKeySchema.optional(),
  difficulty: difficultySchema.optional(),
  label: z.string(),
  /** DR CUMULÉ à atteindre (ex. serrure complexe = 5). */
  targetDR: z.number(),
  flag: z.string().optional(),
  /** ENJEU du Test (#1117) — référence de donnée, résolue par `resolveStake` et affichée par la
   *  modale du Round. Authorable par site ; à défaut, l'applier pose celui du Test étendu. */
  stake: stakeRefSchema.optional(),
});

/** Options de `noeudTest` — ce qu'un document RESSERRE sur le nœud partagé, jamais un spread. */
export interface OptionsNoeudTest {
  /**
   * `flowTestSchema.difficulty` est OPTIONNELLE — un Flow peut porter un Test dont la Difficulté est
   * fixée ailleurs (`difficultyBy`, opposition). Un document dont TOUTES les rangées la portent le
   * DÉCLARE ici, et le contrat se resserre pour lui seul : `criticals.json` (39 nœuds sur 39 avec
   * `difficulty`) — sans ce resserrement, l'adoption du nœud partagé aurait relâché en SILENCE
   * l'exigence que portait le schéma propre des Blessures critiques.
   */
  readonly difficulteRequise?: boolean;
  /**
   * Le porteur ne SERT que la branche `fail`, et il l'applique par extraction PLATE de ses ops
   * (`spellOps`, `engine/flowCore.ts`) — c'est le régime du cycle de maladie : l'applier de repos
   * (`registerNightBandApplier('diseaseTick')`, `state/restFlow.ts`) rend une liste VIDE sur une
   * réussite, et `symptomOnTick` (`engine/disease.ts`) ne lit que `fail`.
   * Deux formes seraient alors AUTHORABLES SANS EFFET, donc menteuses : une branche `success`
   * peuplée (jamais jouée) et une branche `fail` à embranchement (`if`/`test`/`choice`), dont
   * `spellOps` APLATIRAIT les ops — promises quelle que soit l'issue. Le contrat les REFUSE.
   */
  readonly echecSeulServi?: boolean;
}

/**
 * Un Flow est-il une branche PLATE ? — que des `seq`/`do` : aucun embranchement dont `spellOps`
 * (extraction plate) promettrait les ops des deux côtés. Rend le `kind` fautif, ou `null`.
 */
function kindDEmbranchement(flow: unknown): string | null {
  const n = flow as { kind?: string; steps?: unknown[] } | null;
  if (!n || typeof n !== 'object') return null;
  if (n.kind === 'seq') {
    for (const e of n.steps ?? []) {
      const k = kindDEmbranchement(e);
      if (k) return k;
    }
    return null;
  }
  return n.kind === 'do' ? null : (n.kind ?? 'inconnu');
}

/**
 * NŒUD `test` d'un Flow (`Flow<E>`, `engine/flowCore.ts:492`) — jet ALÉATOIRE interactif dont l'issue
 * choisit la branche `success` ou `fail`. Le nœud ne dépend PAS du type de la feuille `do` de ses
 * branches : seul le schéma de BRANCHE change (`flowSchema` mécanique / `sceneFlowSchema`,
 * `defs-scenes/effets.ts`). La fabrique le déclare donc une seule fois, paramétré par sa branche —
 * `test` est toujours `flowTestSchema`, la forme UNIQUE du jet en donnée.
 */
export function noeudTest<B extends z.ZodType>(branche: B, options: OptionsNoeudTest = {}) {
  const test = options.difficulteRequise
    ? flowTestSchema.superRefine((v, ctx) => {
        if (v.difficulty !== undefined) return;
        ctx.addIssue({
          code: 'custom',
          path: ['difficulty'],
          message: 'nœud `test` à difficulté REQUISE : `difficulty` absente — un site sans Difficulté n’est pas une épreuve.',
        });
      })
    : flowTestSchema;
  const noeud = z.strictObject({ kind: z.literal('test'), test, success: branche, fail: branche });
  if (!options.echecSeulServi) return noeud;
  return noeud.superRefine((valeur, ctx) => {
    // La branche est GÉNÉRIQUE (`B extends z.ZodType`) : son type de sortie est opaque ici, seule la
    // FORME du nœud de Flow est inspectée — celle que `flowCore.ts` déclare pour tout `Flow<E>`.
    const v = valeur as { success: unknown; fail: unknown };
    const succes = v.success as { kind?: string; steps?: unknown[] };
    if (succes?.kind !== 'seq' || (succes.steps ?? []).length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['success'],
        message:
          'ce nœud ne SERT que sa branche d’ÉCHEC : une branche « success » peuplée ne serait jamais jouée. '
          + 'Elle s’écrit vide : {kind:"seq",steps:[]}.',
      });
    }
    const embranchement = kindDEmbranchement(v.fail);
    if (embranchement) {
      ctx.addIssue({
        code: 'custom',
        path: ['fail'],
        message:
          'branche d’ÉCHEC à EMBRANCHEMENT (« ' + embranchement + ' ») : ce nœud est lu par extraction PLATE '
          + '(spellOps), qui appliquerait les ops des DEUX côtés. La branche d’échec ne porte que des feuilles « do ».',
      });
    }
  });
}

/** `Flow<EffectOp>` (`engine/flowCore.ts:492`) — arbre récursif ACYCLIQUE (seq/do/if/test/choice). */
export const flowSchema: z.ZodType<Flow<EffectOp>> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('seq'), steps: z.array(flowSchema) }),
    z.strictObject({ kind: z.literal('do'), effect: effectOpSchema }),
    z.strictObject({ kind: z.literal('if'), cond: conditionSchema, then: flowSchema, else: flowSchema.optional() }),
    noeudTest(flowSchema),
    z.strictObject({
      kind: z.literal('choice'),
      prompt: z.string(),
      // Coût LITTÉRAL, ou TEMPLATE `$indice` (`engine/flowCore::INDICE_TEMPLATE`) — accepté AU PARSE
      // seulement : `withArg` (`state/triggeredEffects`) le remplace par l'Indice de l'instance porteuse.
      advantageCost: z.union([z.number(), z.literal(INDICE_TEMPLATE)]).optional(),
      icon: z.string().optional(),
      yes: flowSchema,
      no: flowSchema.optional(),
    }),
  ]),
);


/** CIBLE simple d'un effet déclenché — la branche chaîne de `EffectTargeting` (les deux autres sont
 *  des géométries, pas un univers de valeurs). */
export const effectOnSchema = enumNomme({
  self: 'soi-même',
  victim: 'la victime',
  engaged: 'les adversaires engagés',
  grappled: 'la victime empoignée (absorbée)',
});

/** `EffectTargeting` (`engine/flowCore.ts:469`). */
export const effectTargetingSchema = z.union([
  effectOnSchema,
  z.strictObject({ near: z.enum(['victim', 'self']), radiusMeters: z.number() }),
  z.strictObject({ pick: z.literal('engaged'), sizeAtMost: z.literal('self').optional(), max: z.number() }),
]);

/** DÉCLENCHEUR d'un `TriggeredEffect` (`EffectTrigger`, `engine/flowCore.ts`). Le `satisfies` garde
 *  l'exhaustivité de COMPILATION que le Record d'affichage tenait : un trigger ajouté à l'union sans
 *  son libellé ici ne compile pas. La taxonomie du recensement d'événements de combat
 *  (`state/combat-event-emission-coverage.test.ts`) en dérive. */
export const effectTriggerSchema = enumNomme({
  onHit: 'À la touche',
  onCrit: 'Sur un Critique',
  onWoundLoss: 'En perdant des PB',
  onSlain: 'À sa mise hors de combat',
  onRoundStart: 'Au début du Round',
  onStartled: 'Surpris (magie / bruit)',
  onKill: 'En tuant un adversaire',
  onCharged: 'Quand Chargé',
  onGainCondition: 'En gagnant un État',
  onCombatStart: 'Au début du combat',
  onCombatEnd: 'À la fin du combat',
  onRoundEnd: 'À la fin du Round',
  onTurnStart: 'Au début de son tour',
  onTurnEnd: 'À la fin de son tour',
  onDayStart: 'Au début de chaque jour',
  onWake: 'Au réveil',
  onAttackResolved: 'Après une attaque résolue',
  onCastResolved: 'Après une incantation résolue',
  onMiscast: 'Sur une Imparfaite',
  onOwnTestFailed: 'En échouant à un Test',
} satisfies Record<EffectTrigger, string>);

/** `TriggeredEffect<EffectOp>` (`engine/flowCore.ts:472`). `optional` (Contrôle de la Frénésie…)
 *  seule 1/9 des JSON le peuple (`talents.json`) — laissé optionnel, sans risque pour les autres. */
export const triggeredEffectSchema = z.strictObject({
  trigger: effectTriggerSchema,
  on: effectTargetingSchema,
  flow: flowSchema,
  condition: z.string().optional(),
  attackType: z.enum(['melee', 'ranged']).optional(),
  optional: z.boolean().optional(),
});

/** `StageOutcome` (`src/engine/activities.ts:82-84`) — effet de portée Étape (Activités + Rencontres
 *  de voyage). Dupliqué à l'identique dans `activities`/`incidents-monture`/`problemes-vehicule`/
 *  `rencontres-edoc`. */
export const stageOutcomeSchema = z.enum([
  'suppressExposure', 'gatherInfo', 'noSurprise', 'mapMade', 'rerollToken', 'countsAsRest', 'campCare',
  'extraActivity', 'skipStage', 'fullRecovery', 'worsenWeather',
]);

/** `TravelTableEntry` (`src/engine/travelTables.ts:15-26`) — entrée d100 de l'enveloppe `TravelTable`,
 *  partagée par `rencontres-edoc`/`incidents-monture`/`problemes-vehicule`. */
export const travelTableEntrySchema = z.strictObject({
  min: z.number(),
  max: z.number(),
  id: z.string(),
  label: z.string(),
  desc: z.string(),
  stageOutcome: stageOutcomeSchema.optional(),
  vehicleWounds: z.string().nullable().optional(),
  occupantOps: z.array(gameOpSchema).optional(),
  /** Suite MÉCANIQUE d'un Incident de MONTE (`incidents-monture.json`, EDOC 07 l.157-174), miroir de
   *  `MountIncidentEffects` (`src/engine/travelTables.ts`) : elle est DÉCLARÉE par l'entrée, jamais
   *  déduite de son id. Une entrée sans `mount` ne laisse aucune séquelle. */
  mount: z.strictObject({
    /** Test du CAVALIER, sous peine de chute de `fallM` mètres (l.166/l.171). */
    riderTest: z.strictObject({
      skill: refOuSpec('skill'),
      char: charKeySchema.optional(),
      difficulty: difficultySchema,
      fallM: z.number(),
    }).optional(),
    /** Modificateur PERSISTANT aux Tests de Chevaucher tant que la séquelle dure (l.174 : −20). */
    ridingPenalty: z.number().optional(),
    /** Allure MAXIMALE imposée à la bête tant que la séquelle dure (Perte d'un fer : le pas). */
    forcedAllure: z.enum(['pas', 'trot', 'galop']).optional(),
    /** La bête ne peut plus être montée ni attelée (Boiteux, Patte brisée). */
    preventsMount: z.boolean().optional(),
    /** Les soins d'une halte n'effacent PAS cette séquelle (Patte brisée). */
    notHealedByCare: z.boolean().optional(),
    /** CONDITION DE FIN de la séquelle, telle que le `desc` verbatim de l'entrée la pose (« jusqu'à ce
     *  que la partie abîmée soit réparée » / « jusqu'à ce que le fer ait été remplacé par un
     *  maréchal-ferrant ») — fragment d'AFFICHAGE joueur accolé à la ligne de séquelle, jamais une
     *  mécanique : ce qui EFFACE la séquelle reste `notHealedByCare` + les soins d'étape. */
    endCondition: z.string().optional(),
    /** ISSUE de la bête, quand le `desc` verbatim en pose une (Patte brisée : « Fracture (Majeure) …
     *  peu d'espoir qu'elle y survive ») — fragment d'AFFICHAGE joueur, ligne propre au journal. */
    outcome: z.string().optional(),
  }).optional(),
});

/**
 * QUI encaisse un coup à l'ÉQUIPAGE — les trois désignations que les livres impriment, et rien
 * d'autre :
 *  - `{ poste: true }` : l'appartenance à une pièce d'artillerie (`MDG 13 l.763`) ;
 *  - `{ stations }` : la ou les PRÉSENCES nommées (`ship-stations.json`) — `MDG 13 l.680/l.714/
 *    l.730/l.751`, `MSRC 07 l.78/l.82/l.94`. Une rangée qui frappe deux présences d'une même
 *    épreuve les liste (`MDG 13 l.680`), elle ne se dédouble pas en deux coups ;
 *  - `{ role }` : le seul cas où le livre nomme un RÔLE d'équipage (`MSRC 07 l.86`).
 * Résolution : `applyCrewHit` (`src/engine/shipCritical.ts`) compare l'ÉPINGLAGE du joueur
 * (`Combatant.shipStation` / `Combatant.shipRole`) — jamais une inférence par Compétence.
 */
export const crewTargetSchema = z.union([
  z.strictObject({ poste: z.literal(true) }),
  z.strictObject({ stations: refs('shipStation', { min: 1 }) }),
  z.strictObject({ role: ref('crewRole') }),
]);

/**
 * `ShipCrewHit` (`src/data/shipCriticals.ts`) — ce qu'un Critique de coque fait à l'ÉQUIPAGE. Le
 * porteur dit QUI encaisse (`crewTarget`, REQUIS) ; l'ISSUE est SOIT une épreuve (le nœud `test` du
 * Flow, dont la branche d'échec porte la conséquence — MDG 13 l.763, MSRC 07 l.78/l.94), SOIT des
 * ops CERTAINES (`ops` — MSRC 07 l.82, où le livre n'appelle aucun jet). Les deux clefs sont
 * EXCLUSIVES.
 */
export const shipCrewHitSchema = z
  .strictObject({
    crewTarget: crewTargetSchema,
    test: noeudTest(flowSchema, { difficulteRequise: true, echecSeulServi: true }).optional(),
    ops: z.array(gameOpSchema).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.test === !v.ops) {
      ctx.addIssue({
        code: 'custom',
        message: 'un coup à l’équipage porte SOIT une épreuve (`test`) SOIT une conséquence certaine (`ops`) — jamais les deux, jamais aucune.',
      });
    }
  });

/** `ShipCritEntry` (`src/data/shipCriticals.ts`) — entrée d100 de Critique de coque, partagée par
 *  `ship-criticals` (navale) et `river-criticals` (fluviale). */
export const shipCritEntrySchema = z.strictObject({
  ...plageSchema.shape,
  id: z.string(),
  label: z.string(),
  ops: z.array(gameOpSchema).optional(),
  shrapnel: z.number().optional(),
  hullCrits: z.string().optional(),
  crewHit: shipCrewHitSchema.optional(),
  note: z.string(),
});
