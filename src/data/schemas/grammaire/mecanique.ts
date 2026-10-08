import { nommerChamps, nommerNoeud, metaDesChamps, type MetaDesChamps } from './meta';
/**
 * MÉCANIQUE de la grammaire de document (#1466 L1a) — l'algèbre exécutable portée en donnée :
 * `GameOp`, `Condition`, `FlowTest`, `EffectOp`, `Flow`, `TriggeredEffect`, et les entrées de
 * table qui embarquent des ops (voyage, critiques de coque). Le registre `OP_DEFS` type le payload
 * op par op ; `OPS_NON_TYPEES` porte celles qui restent à décrire (lot L1c #1468).
 */
import { z } from 'zod';
import { proseNommee } from './prose';
import { declarerEnfants } from './descente';
import { isMenaceId, menaceIds } from '../../../engine/menace';
import { CATEGORY_BY_SOURCE_KIND, type EffectSourceKind } from '../../../engine/types';
import type { StakeRef } from '../../index';
import { messageRecurrenceHorloge, SELF_REF, type GameOp } from '../../../engine/ops';
import { ARG_TEMPLATE, INDICE_TEMPLATE, type Condition, type EffectOp, type EffectTrigger, type Flow, type TriggeredEffect } from '../../../engine/flowCore';
import { chaosAlignSchema, charKeySchema, deDeTableSchema, diceSpecSchema, difficultySchema, enumNomme, exposureLevelSchema, formulaSchema, hitLocationSchema, ouReserve, plageSchema, reachSchema, refTestDeCorruption, sizeCategorySchema, surchargePaletteSchema, symptomSeveritySchema } from './valeurs';
import { traitInstanceSchema } from './reference';
import { idDe, marquerOpAtteinte, ref, refs, refOuSpec, type RegimeDePorteur, type TypeEntite } from './ref';
import { INSTANCIABLE_PAR_ID } from './sousListes';

/** Catégorie d'armure ignorée d'un `ArmourBypass` (`engine/armourBypass.bypassedAP`) ; `nonMetal` : LDB 62 l.270. */
export const armourBypassCategorieSchema = enumNomme({
  all: "toute l'armure",
  metal: 'le métal',
  leather: 'le cuir',
  nonMagic: 'le non-magique',
  nonMetal: 'le non-métal',
});

/** `ArmourBypass` — PA ignorés : un nombre de points, ou une catégorie d'armure. Source du type moteur
 *  (`src/engine/types.ts`). */
export const armourBypassSchema = z.union([z.number(), armourBypassCategorieSchema]);
export type ArmourBypass = z.infer<typeof armourBypassSchema>;

/** Ce que l'op `loseTurn` retire ; absent = les deux. */
export const loseTurnWhatSchema = enumNomme({ action: 'son Action', movement: 'son Mouvement' });

/** Forme d'une `zone`. */
export const zoneShapeSchema = enumNomme({ disc: 'disque', wall: 'mur' });

/** `PerSL` (`src/engine/ops.ts:146`) — échelle « par +N DR » d'un payload d'op. */
export const perSLSchema = nommerChamps(z.strictObject({ every: z.number(), amount: z.number(), onFailure: z.boolean().optional() }), { every: { label: "intervalle" }, amount: { label: "quantité" }, onFailure: { label: "en cas d’échec" } });

/** SENS engagé par un Test (`FlowTest.sense` — Perception : vue ou ouïe) ; le libellé est celui de la
 *  phrase qui le montre au joueur (op `senseLoss` : « perd la vue »). */
export const senseSchema = enumNomme({ vue: 'la vue', ouie: "l'ouïe" });

/**
 * CHAMP À CHOIX d'un payload d'op : une référence à spécialisation dont le RÉGIME est un paramètre de la
 * famille (`mecaniqueDe`), déclarée UNE fois à sa place dans le payload. La famille la résout en
 * `refOuSpec(type, extra, regimes['<op>.<champ>'] ?? 'specSeule')` ; la clé est calculée depuis la
 * POSITION de la déclaration. La marque privée rend la classe nominale : aucun nœud zod ne s'y confond.
 */
class ChampAChoixDeclare {
  private declare readonly marqueNominale: true;
  constructor(
    readonly cible: TypeEntite,
    readonly extra?: Record<string, z.ZodType>,
  ) {}
}

/** Déclare un champ à choix de type `cible` (+ champs propres `extra`) à sa place dans un payload d'op. */
export function aChoix(cible: TypeEntite, extra?: Record<string, z.ZodType>): ChampAChoixDeclare {
  return new ChampAChoixDeclare(cible, extra);
}

/**
 * CHAMP RÉSERVÉ d'un payload d'op : admis par la seule famille dont le porteur le demande (régime `admis`),
 * OMIS partout ailleurs — le `z.strictObject` du payload le refuse alors. Sœur de `ChampAChoixDeclare`,
 * même clé `<op>.<champ>` calculée depuis la POSITION de la déclaration.
 */
class ChampReserveDeclare {
  private declare readonly marqueReserve: true;
  constructor(readonly noeud: z.ZodType) {}
}

/** Déclare un champ réservé au porteur, de forme `noeud`, à sa place dans un payload d'op. */
export function reserve(noeud: z.ZodType): ChampReserveDeclare {
  return new ChampReserveDeclare(noeud);
}

/** Payload déclaré par ses champs (au moins un champ à choix ou réservé) : la famille le ferme en `z.strictObject`. */
type FormeDePayload = Readonly<Record<string, z.ZodType | ChampAChoixDeclare | ChampReserveDeclare>>;

class PayloadDeclare {
  constructor(readonly champs: FormeDePayload, readonly meta: MetaDesChamps<FormeDePayload>) {}
}
function declarerPayload<C extends FormeDePayload>(champs: C, meta: MetaDesChamps<C>): PayloadDeclare {
  return new PayloadDeclare(champs, meta);
}

const estNoeudZod = (v: unknown): v is z.ZodType => typeof v === 'object' && v !== null && '_zod' in v;

/**
 * Payload STRICT par op (`src/engine/ops.ts`, union `GameOp`). Chaque entrée est un contrat POSITIF
 * vérifié sur toutes les occurrences réelles de l'op dans les 2 racines authorées. Une entrée est un
 * nœud zod, ou la FORME de ses champs quand l'un d'eux est un champ à choix (`aChoix`). Toute op
 * IMBRIQUÉE dans un payload (`z.lazy`) pointe la famille FERMÉE : seules les ops à la racine d'un
 * porteur lisent ses régimes (`mecaniqueDe`).
 */
const DECLARATIONS_D_OPS = {
  narrative: proseNommee(nommerChamps(z.strictObject({ op: z.literal('narrative') }), { op: { label: 'opération'  } }), 'narrative.text'),
  banish: nommerChamps(z.strictObject({ op: z.literal('banish'), narration: z.enum(['chaos', 'unravel']).optional(), onlyGroups: z.array(z.string()).optional() }), { op: { label: "opération"  }, narration: { label: "narration"  }, onlyGroups: { label: "groupes autorisés" , texte: { regime: "technique"} } }),
  corruption: nommerChamps(z.strictObject({
    op: z.literal('corruption'),
    amount: z.number(),
    perSL: perSLSchema.optional(),
    align: chaosAlignSchema.optional(),
  }), { op: { label: "opération"  }, amount: { label: "quantité" }, perSL: { label: "par DR" }, align: { label: "Puissance du Chaos"  } }),
  /** `min` : plancher d'une perte de mutation (EDO 11 l.190), réservé au `passive` de mutation —
   *  seul `attachMutation` le résout (`engine/corruption.ts`). */
  charMod: declarerPayload({
    op: z.literal('charMod'),
    char: charKeySchema,
    mod: z.number(),
    min: reserve(z.number().optional()),
    durationRounds: formulaSchema.optional(),
    durationMinutes: formulaSchema.optional(),
    durationHours: formulaSchema.optional(),
  }, { op: { label: "opération" }, char: { label: "caractéristiques" }, mod: { label: "modificateur" }, min: { label: "minimum" }, durationRounds: { label: 'durée en Rounds' }, durationMinutes: { label: 'durée en minutes' }, durationHours: { label: 'durée en heures' } }),
  corruptionExposure: nommerChamps(z.strictObject({
    op: z.literal('corruptionExposure'),
    level: exposureLevelSchema.optional(),
    skill: refTestDeCorruption.optional(),
    easeSteps: z.number().optional(),
  }), { op: { label: "opération"  }, level: { label: "niveau"  }, skill: { label: "Compétence" }, easeSteps: { label: "crans de facilité" } }),
  aggravateSymptom: nommerChamps(z.strictObject({
    op: z.literal('aggravateSymptom'),
    disease: idDe('maladie'),
    symptomId: idDe('symptome'),
    severity: symptomSeveritySchema,
    otherwise: z.array(z.lazy(() => gameOpSchema)).optional(),
  }), { op: { label: "opération"  }, disease: { label: "maladie" , texte: { regime: "technique"} }, symptomId: { label: "symptôme" , texte: { regime: "technique"} }, severity: { label: "gravité"  }, otherwise: { label: "sinon" } }),
  attenuateSymptom: nommerChamps(z.strictObject({
    op: z.literal('attenuateSymptom'),
    disease: idDe('maladie'),
    symptomId: idDe('symptome'),
    otherwise: z.array(z.lazy(() => gameOpSchema)).optional(),
  }), { op: { label: "opération"  }, disease: { label: "maladie" , texte: { regime: "technique"} }, symptomId: { label: "symptôme" , texte: { regime: "technique"} }, otherwise: { label: "sinon" } }),
  grantSymptom: nommerChamps(z.strictObject({
    op: z.literal('grantSymptom'),
    disease: idDe('maladie'),
    symptomId: idDe('symptome'),
    severity: symptomSeveritySchema.optional(),
  }), { op: { label: "opération"  }, disease: { label: "maladie" , texte: { regime: "technique"} }, symptomId: { label: "symptôme" , texte: { regime: "technique"} }, severity: { label: "gravité"  } }),
  /** `amputer` (LDB 18 l.233-286) : AUTHORABLE comme toute op (l'atelier la propose sous « Séquelles &
   *  mobilité » — un Trait de créature qui tranche un membre s'écrit avec elle), mais AUCUNE donnée
   *  committée ne la porte aujourd'hui : ses seuls producteurs sont les rangées de Critique, où
   *  `noeudAmputation` (engine/critical.ts) la fabrique depuis `entry.amputation`. Son payload est typé
   *  ICI comme celui de toute op authorée ; ses `sequels` sont des ids de fiche `traumas.json`, dataset
   *  absent de `TYPES` jusqu'à R2 v2 de #1473 (même graphie que `amputationSchema`). */
  amputer: nommerChamps(z.strictObject({
    op: z.literal('amputer'),
    sequels: z.array(z.string()),
    loc: hitLocationSchema.optional(),
    unites: formulaSchema.optional(),
    unitesPerSL: perSLSchema.optional(),
  }), { op: { label: "opération"  }, sequels: { label: "séquelles" , texte: { regime: "technique"} }, loc: { label: "localisation"  }, unites: { label: "unités" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, unitesPerSL: { label: "unités par DR" } }),
  /** `fall` — la hauteur ne s'authore JAMAIS au site : elle se lit dans la table nommée (`MDG 13
   *  l.684`), par Taille de coque et par station du tombant. La table se désigne par la graphie
 *  CANONIQUE d'une référence (`{id}`) ; `ref(type)` ne s'applique pas — ces tables n'ont pas de
 *  dataset à elles, elles vivent DANS le jeu de Critiques qui les imprime. */
  fall: nommerChamps(z.strictObject({ op: z.literal('fall'), hauteur: nommerChamps(z.strictObject({ table: nommerChamps(z.strictObject({ id: z.string() }), { id: { label: "identifiant" , texte: { regime: "technique"} } }) }), { table: { label: "table" } }) }), { op: { label: "opération"  }, hauteur: { label: "hauteur" } }),
  heal: nommerChamps(z.strictObject({ op: z.literal('heal'), amount: formulaSchema, perSL: perSLSchema.optional() }), { op: { label: "opération"  }, amount: { label: "quantité" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, perSL: { label: "par DR" } }),
  /** `money` — mouvement de la bourse PERSONNELLE de la cible. La charge porte son NOM (`montant`),
   *  comme toute autre action du vocabulaire (`giveMoney.montant`, `giveXp.amount`) : elle n'est jamais
   *  étalée parmi les clés de l'op (garde `src/data/monnaie-forme-unique.test.ts`, sonde A). La seule
   *  dénomination chiffrable est `brass`, l'unité de compte de `engine/money.ts`. */
  money: nommerChamps(z.strictObject({ op: z.literal('money'), montant: nommerChamps(z.strictObject({ brass: formulaSchema }), { brass: { label: "sous de cuivre" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }) }), { op: { label: "opération"  }, montant: { label: "montant" } }),
  healCaster: nommerChamps(z.strictObject({ op: z.literal('healCaster'), amount: formulaSchema }), { op: { label: "opération"  }, amount: { label: "quantité" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
  kill: nommerChamps(z.strictObject({ op: z.literal('kill') }), { op: { label: "opération"  } }),
  loseTurn: nommerChamps(z.strictObject({ op: z.literal('loseTurn'), what: loseTurnWhatSchema.optional() }), { op: { label: "opération"  }, what: { label: "objet"  } }),
  noBreath: nommerChamps(z.strictObject({ op: z.literal('noBreath') }), { op: { label: "opération"  } }),
  noHunger: nommerChamps(z.strictObject({ op: z.literal('noHunger') }), { op: { label: "opération"  } }),
  removeTrait: nommerChamps(z.strictObject({ op: z.literal('removeTrait'), traitId: idDe('trait') }), { op: { label: "opération"  }, traitId: { label: "Trait" , texte: { regime: "technique"} } }),
  /** `domeWard` — le dôme OCTROIE un Trait à ceux qu'il couvre (`LDB 47 l.410`) : le Trait se nomme
   *  par la MÊME graphie que partout ailleurs (`traitId`), son Indice est une `Formula`. AUCUNE zone :
   *  elle est déjà écrite par la ligne « Cible » du sort (ZdE, `LDB 47 l.28`) — l'op la LIT. */
  domeWard: nommerChamps(z.strictObject({ op: z.literal('domeWard'), traitId: idDe('trait'), indice: formulaSchema }), { op: { label: "opération"  }, traitId: { label: "Trait" , texte: { regime: "technique"} }, indice: { label: "indice" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
  suffocate: nommerChamps(z.strictObject({ op: z.literal('suffocate') }), { op: { label: "opération"  } }),
  /** `offTerrainMod` — passif POSITIONNEL : hors de son terrain d'ÉLECTION, le porteur subit un M
   *  IMPOSÉ (`mSet`, Créature marine MDG 16 l.17 « son M tombe à 1 » ; Aquatique MSRC 15 l.139 → 0),
   *  un malus de DR à TOUS ses Tests (`testDR`) et/ou la suffocation (`suffocates`). Le terrain se
   *  nomme par un ID du registre (`idDe('terrain')`) : un terrain inconnu est refusé AU PARSE. */
  offTerrainMod: nommerChamps(z.strictObject({
    op: z.literal('offTerrainMod'),
    terrain: idDe('terrain'),
    mSet: z.number().optional(),
    testDR: z.number().optional(),
    suffocates: z.boolean().optional(),
  }), { op: { label: "opération"  }, terrain: { label: "terrain" , texte: { regime: "technique"} }, mSet: { label: "Mouvement imposé" }, testDR: { label: "DR de Test" }, suffocates: { label: "asphyxie" } }),
  skillMod: nommerChamps(z.strictObject({ op: z.literal('skillMod'), skill: refOuSpec('skill'), mod: z.number(), sense: senseSchema.optional() }), { op: { label: "opération"  }, skill: { label: "Compétence" }, mod: { label: "modificateur" }, sense: { label: "sens"  } }),
  /** Cible EXCLUSIVE, `skill` OU `testType` (`engine/ops.ts`, union `skillDRBonus`). `testType` : id de
   *  `crew-test-types.json`, document `config` dont les ids vivent sous `types[]` — hors de l'INDEX
   *  DES IDS (`IDS_PAR_ESPACE`, `scripts/gen-espaces.mts`) ; clé étrangère tenue par
   *  `scripts/guards/lib/gameOpRefFk.mjs` pour les sous-listes à ids des documents `config` (#1473). */
  skillDRBonus: z.union([
    nommerChamps(z.strictObject({ op: z.literal('skillDRBonus'), skill: refOuSpec('skill'), bonus: formulaSchema }), { op: { label: "opération"  }, skill: { label: "Compétence" }, bonus: { label: "bonus" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
    nommerChamps(z.strictObject({ op: z.literal('skillDRBonus'), testType: z.string(), bonus: formulaSchema }), { op: { label: "opération"  }, testType: { label: "type de Test" , texte: { regime: "technique"} }, bonus: { label: "bonus" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
  ], {
    error: (iss) => {
      const v = (iss.input ?? {}) as { skill?: unknown; testType?: unknown };
      return (v.skill === undefined) === (v.testType === undefined)
        ? 'cible EXCLUSIVE : « skill » (Compétence) OU « testType » (type de Test d’équipage, crew-test-types.json) — exactement une des deux.'
        : undefined;
    },
  }),
  castPenalty: nommerChamps(z.strictObject({
    op: z.literal('castPenalty'),
    skill: refOuSpec('skill').optional(),
    mod: z.number().optional(),
    blocked: z.boolean().optional(),
    maxZeroDR: z.boolean().optional(),
    rounds: formulaSchema.optional(),
    minutes: formulaSchema.optional(),
    hours: formulaSchema.optional(),
    days: formulaSchema.optional(),
  }), { op: { label: "opération"  }, skill: { label: "Compétence" }, mod: { label: "modificateur" }, blocked: { label: "bloqué" }, maxZeroDR: { label: "plafond de zéro DR" }, rounds: { label: "Rounds" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, minutes: { label: "minutes" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, hours: { label: "heures" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, days: { label: "jours" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
  grantCareerSkill: declarerPayload({ op: z.literal('grantCareerSkill'), skill: aChoix('skill') }, { op: { label: "opération" }, skill: { label: "Compétence" } }),
  grantCareerTalent: declarerPayload({ op: z.literal('grantCareerTalent'), talent: aChoix('talent') }, { op: { label: "opération" }, talent: { label: 'Talent' } }),
  grantTalent: declarerPayload({ op: z.literal('grantTalent'), talent: aChoix('talent') }, { op: { label: "opération" }, talent: { label: 'Talent' } }),
  grantReverseToken: nommerChamps(z.strictObject({ op: z.literal('grantReverseToken'), skill: refOuSpec('skill').optional() }), { op: { label: "opération"  }, skill: { label: "Compétence" } }),
  exposeDisease: nommerChamps(z.strictObject({
    op: z.literal('exposeDisease'),
    disease: ouReserve(idDe('maladie'), ARG_TEMPLATE),
    difficultyShift: z.number().optional(),
    incubation: z.literal('instant').optional(),
  }), { op: { label: "opération"  }, disease: { label: "maladie" , texte: { regime: "technique"} }, difficultyShift: { label: "décalage de difficulté" }, incubation: { label: "incubation"  } }),
  contractDisease: nommerChamps(z.strictObject({ op: z.literal('contractDisease'), disease: idDe('maladie') }), { op: { label: "opération"  }, disease: { label: "maladie" , texte: { regime: "technique"} } }),
  reduceDiseaseDays: nommerChamps(z.strictObject({
    op: z.literal('reduceDiseaseDays'),
    days: z.number().optional(),
    dice: diceSpecSchema.optional(),
    disease: idDe('maladie').optional(),
    oncePerDisease: z.boolean().optional(),
    daysPerSL: perSLSchema.optional(),
  }), { op: { label: "opération"  }, days: { label: "jours" }, dice: { label: "dés" }, disease: { label: "maladie" , texte: { regime: "technique"} }, oncePerDisease: { label: "une fois par maladie" }, daysPerSL: { label: "jours par DR" } }),
  diseaseTestMod: nommerChamps(z.strictObject({ op: z.literal('diseaseTestMod'), diseases: refs('maladie').optional(), amount: z.number() }), { op: { label: "opération"  }, diseases: { label: "maladies" , texte: { regime: "technique"} }, amount: { label: "quantité" } }),
  suppressSymptom: nommerChamps(z.strictObject({ op: z.literal('suppressSymptom'), symptomId: idDe('symptome') }), { op: { label: "opération"  }, symptomId: { label: "symptôme" , texte: { regime: "technique"} } }),
  giveTrapping: nommerChamps(z.strictObject({
    op: z.literal('giveTrapping'),
    trappingId: idDe('trapping', INSTANCIABLE_PAR_ID).optional(),
    custom: z.string().optional(),
    count: z.number().optional(),
    perSL: perSLSchema.optional(),
  }), { op: { label: "opération"  }, trappingId: { label: "objet" , texte: { regime: "technique"} }, custom: { label: "profil personnalisé" , texte: { regime: "designation"} }, count: { label: "nombre" }, perSL: { label: "par DR" } }),
  /** `summon` — la créature invoquée se nomme par un id du bestiaire (`idDe('creature')`) : une op
   *  sans créature est refusée AU PARSE (#1882), jamais spawnée. `addTraits` : instances de Trait
   *  (`grammaire/reference.ts › traitInstanceSchema`), dont l'`id` est un `z.string()` et non une feuille
   *  `idDe` — aucun slot. */
  summon: nommerChamps(z.strictObject({
    op: z.literal('summon'),
    ref: idDe('creature'),
    count: formulaSchema,
    countPerSL: perSLSchema.optional(),
    addTraits: z.array(traitInstanceSchema).optional(),
    size: sizeCategorySchema.optional(),
    allyOfCaster: z.boolean().optional(),
    despawnIfCasterDown: z.boolean().optional(),
  }), { op: { label: "opération"  }, ref: { label: "référence" , texte: { regime: "technique"} }, count: { label: "nombre" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, countPerSL: { label: "nombre par DR" }, addTraits: { label: "traits ajoutés" }, size: { label: "Taille"  }, allyOfCaster: { label: "allié du lanceur" }, despawnIfCasterDown: { label: "disparaître avec le lanceur" } }),
  scheduleRespawn: nommerChamps(z.strictObject({
    op: z.literal('scheduleRespawn'),
    ref: ouReserve(idDe('creature'), SELF_REF),
    delayDays: formulaSchema,
    count: formulaSchema.optional(),
    allyOfCaster: z.boolean().optional(),
    cancelFlag: z.string().optional(),
  }), { op: { label: "opération"  }, ref: { label: "référence" , texte: { regime: "technique"} }, delayDays: { label: "délai en jours" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, count: { label: "nombre" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, allyOfCaster: { label: "allié du lanceur" }, cancelFlag: { label: "drapeau d’annulation" , texte: { regime: "technique"} } }),
  polymorph: nommerChamps(z.strictObject({ op: z.literal('polymorph'), ref: idDe('creature') }), { op: { label: "opération"  }, ref: { label: "référence" , texte: { regime: "technique"} } }),
  transform: nommerChamps(z.strictObject({
    op: z.literal('transform'),
    tag: z.string(),
    ops: z.array(z.lazy(() => gameOpSchema)),
    morphRef: idDe('creature').optional(),
  }), { op: { label: "opération"  }, tag: { label: "marque" , texte: { regime: "technique"} }, ops: { label: "opérations" }, morphRef: { label: "forme transformée" , texte: { regime: "technique"} } }),
  /** Table INLINE (`rows`) OU RÉFÉRENCÉE (`tableId`), exclusives (`engine/ops.ts`, union `rollTable`). */
  rollTable: z.union([
    nommerChamps(z.strictObject({
      op: z.literal('rollTable'),
      die: deDeTableSchema,
      mod: z.number().optional(),
      addNegativeSL: z.boolean().optional(),
      extraRollsPerStep: z.number().optional(),
      rows: z.array(nommerChamps(z.strictObject({ min: z.number(), max: z.number(), ops: z.array(z.lazy(() => gameOpSchema)) }), { min: { label: "minimum" }, max: { label: "maximum" }, ops: { label: "opérations" } })),
    }), { op: { label: "opération"  }, die: { label: "dé de tirage"  }, mod: { label: "modificateur" }, addNegativeSL: { label: "ajouter les DR négatifs" }, extraRollsPerStep: { label: "jets supplémentaires par cran" }, rows: { label: "rangées" } }),
    nommerChamps(z.strictObject({
      op: z.literal('rollTable'),
      die: deDeTableSchema.optional(),
      mod: z.number().optional(),
      addNegativeSL: z.boolean().optional(),
      extraRollsPerStep: z.number().optional(),
      tableId: idDe('table'),
    }), { op: { label: "opération"  }, die: { label: "dé de tirage"  }, mod: { label: "modificateur" }, addNegativeSL: { label: "ajouter les DR négatifs" }, extraRollsPerStep: { label: "jets supplémentaires par cran" }, tableId: { label: "table" , texte: { regime: "technique"} } }),
  ], {
    error: (iss) => {
      const v = (iss.input ?? {}) as { rows?: unknown; tableId?: unknown };
      return (v.rows === undefined) === (v.tableId === undefined)
        ? 'table EXCLUSIVE : « rows » (rangées inline) OU « tableId » (tables.json) — exactement une des deux.'
        : undefined;
    },
  }),
  testMod: nommerChamps(z.strictObject({
    op: z.literal('testMod'),
    amount: z.number(),
    char: charKeySchema.optional(),
    combatOnly: z.boolean().optional(),
    movementOnly: z.boolean().optional(),
    hearingOnly: z.boolean().optional(),
    exceptSkills: z.array(ref('skill')).optional(),
    weaponHand: z.enum(['main', 'off']).optional(),
  }), { op: { label: "opération"  }, amount: { label: "quantité" }, char: { label: "caractéristiques"  }, combatOnly: { label: "combat uniquement" }, movementOnly: { label: "Mouvement uniquement" }, hearingOnly: { label: "ouïe uniquement" }, exceptSkills: { label: "Compétences exclues" , texte: { regime: "technique",usage: "référence mécanique résolue au catalogue"} }, weaponHand: { label: "main de l’arme"  } }),
  perRound: nommerChamps(z.strictObject({ op: z.literal('perRound'), ops: z.array(z.lazy(() => gameOpSchema)) }), { op: { label: "opération"  }, ops: { label: "opérations" } }),
  delayed: nommerChamps(z.strictObject({
    op: z.literal('delayed'),
    afterMinutes: formulaSchema.optional(),
    afterHours: formulaSchema.optional(),
    afterDays: formulaSchema.optional(),
    afterDuration: z.literal(true).optional(),
    forMinutes: formulaSchema.optional(),
    forHours: formulaSchema.optional(),
    forDays: formulaSchema.optional(),
    ops: z.array(z.lazy(() => gameOpSchema)),
  }), { op: { label: "opération"  }, afterMinutes: { label: "délai en minutes" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, afterHours: { label: "délai en heures" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, afterDays: { label: "délai en jours" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, afterDuration: { label: "après la durée" }, forMinutes: { label: "durée en minutes" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, forHours: { label: "durée en heures" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, forDays: { label: "durée en jours" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, ops: { label: "opérations" } }),
  zone: nommerChamps(z.strictObject({
    op: z.literal('zone'),
    shape: zoneShapeSchema,
    radiusMeters: formulaSchema.optional(),
    lengthMeters: formulaSchema.optional(),
    lengthPerSL: nommerChamps(z.strictObject({ every: z.number(), metersFormula: formulaSchema }), { every: { label: "intervalle" }, metersFormula: { label: "distance" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }).optional(),
    blocksLoS: z.boolean().optional(),
    onCross: z.array(z.lazy(() => gameOpSchema)).optional(),
    perRound: z.array(z.lazy(() => gameOpSchema)).optional(),
    crossTest: z.lazy(() => flowTestSchema).optional(),
    barrier: z.boolean().optional(),
    gate: z.literal('profane').optional(),
    noCorruption: z.boolean().optional(),
  }), { op: { label: "opération"  }, shape: { label: "forme"  }, radiusMeters: { label: "rayon en mètres" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, lengthMeters: { label: "longueur en mètres" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, lengthPerSL: { label: "longueur par DR" }, blocksLoS: { label: "bloquer la vue" }, onCross: { label: "à la traversée" }, perRound: { label: "par Round" }, crossTest: { label: "Test de traversée" }, barrier: { label: "barrière" }, gate: { label: "condition d’accès"  }, noCorruption: { label: "sans Corruption" } }),
  /** `addQualities`/`removeQualities` : ids de Qualité, et `requiresWeapon`, hors de `TYPES` — gardés
   *  par `GAMEOP_FIELD_TARGETS` (`scripts/guards/lib/gameOpRefFk.mjs`). */
  augmentWeapon: nommerChamps(z.strictObject({
    op: z.literal('augmentWeapon'),
    addQualities: z.array(z.string()).optional(),
    damageBonus: formulaSchema.optional(),
    bypass: armourBypassSchema.optional(),
    requiresWeapon: z.string().optional(),
    removeQualities: z.array(z.string()).optional(),
    removeType: z.enum(['atout', 'defaut']).optional(),
    suppressEnchants: z.boolean().optional(),
    passive: z.array(z.lazy(() => gameOpSchema)).optional(),
    onHitEffects: z.array(z.lazy(() => triggeredEffectSchema)).optional(),
  }), { op: { label: "opération"  }, addQualities: { label: "qualités ajoutées" , texte: { regime: "technique"} }, damageBonus: { label: "bonus de dégâts" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, bypass: { label: "armure ignorée"  }, requiresWeapon: { label: "arme requise" , texte: { regime: "technique"} }, removeQualities: { label: "qualités retirées" , texte: { regime: "technique"} }, removeType: { label: "type retiré"  }, suppressEnchants: { label: "supprimer les enchantements" }, passive: { label: "passifs" }, onHitEffects: { label: "à la touche" } }),
  /** `qualities` (ids de Qualité) et `subType` (id de Groupe d'arme), hors de `TYPES` — gardés par
   *  `GAMEOP_FIELD_TARGETS` (`scripts/guards/lib/gameOpRefFk.mjs`). */
  grantWeapon: nommerChamps(z.strictObject({
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
    form: idDe('trapping', INSTANCIABLE_PAR_ID).optional(),
    chooseForm: z.boolean().optional(),
  }), { op: { label: "opération"  }, label: { label: "libellé" , texte: { regime: "designation"} }, damage: { label: "dégâts" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, damagePlus: { label: "dégâts supplémentaires" }, plusBF: { label: "ajouter le Bonus de Force" }, qualities: { label: "qualités" , texte: { regime: "technique"} }, subType: { label: "sous-type" , texte: { regime: "technique"} }, reach: { label: "allonge"  }, hands: { label: "mains" }, onHitEffects: { label: "à la touche" }, skin: { label: "palette" }, form: { label: "forme" , texte: { regime: "technique"} }, chooseForm: { label: "choisir la forme" } }),
  rollThreshold: nommerChamps(z.strictObject({
    op: z.literal('rollThreshold'),
    sides: z.number(),
    thresholds: z.array(nommerChamps(z.strictObject({ atLeast: z.number(), ops: z.array(z.lazy(() => gameOpSchema)) }), { atLeast: { label: "minimum" }, ops: { label: "opérations" } })),
  }), { op: { label: "opération"  }, sides: { label: "faces" }, thresholds: { label: "seuils" } }),
};

type DeclarationsDOps = typeof DECLARATIONS_D_OPS;
type ChampsAChoixDe<K extends string, D> = D extends z.ZodType
  ? never
  : { [C in keyof D & string]: D[C] extends ChampAChoixDeclare ? `${K}.${C}` : never }[keyof D & string];

/** `<op>.<champ>` de chaque champ à choix, DÉRIVÉ des déclarations d'`DECLARATIONS_D_OPS`. */
export type ChampAChoix = { [K in keyof DeclarationsDOps & string]: ChampsAChoixDe<K, DeclarationsDOps[K]> }[keyof DeclarationsDOps & string];

type ChampsReservesDe<K extends string, D> = D extends z.ZodType
  ? never
  : { [C in keyof D & string]: D[C] extends ChampReserveDeclare ? `${K}.${C}` : never }[keyof D & string];

/** `<op>.<champ>` de chaque champ réservé, DÉRIVÉ des déclarations d'`DECLARATIONS_D_OPS`. */
export type ChampReserve = { [K in keyof DeclarationsDOps & string]: ChampsReservesDe<K, DeclarationsDOps[K]> }[keyof DeclarationsDOps & string];

/** Les `<op>.<champ>` dont la déclaration est une instance de `classe`. */
function champsDeclares<T extends string>(classe: abstract new (...a: never[]) => object): readonly T[] {
  return Object.entries(DECLARATIONS_D_OPS).flatMap(([op, d]) =>
    estNoeudZod(d) ? [] : Object.entries((d as PayloadDeclare).champs).flatMap(([champ, v]) => (v instanceof classe ? [`${op}.${champ}` as T] : [])),
  );
}

/** Les champs à choix, dérivés du MÊME parcours que le type `ChampAChoix`. */
export const CHAMPS_A_CHOIX: readonly ChampAChoix[] = champsDeclares<ChampAChoix>(ChampAChoixDeclare);

/** Les champs réservés, dérivés du MÊME parcours que le type `ChampReserve`. */
export const CHAMPS_RESERVES: readonly ChampReserve[] = champsDeclares<ChampReserve>(ChampReserveDeclare);

/** Régime de chaque champ d'un porteur : un champ à choix absent est `specSeule`, un champ réservé
 *  absent est OMIS. */
export type Regimes = Readonly<Partial<Record<ChampAChoix, RegimeDePorteur> & Record<ChampReserve, 'admis'>>>;

/**
 * Ops du moteur DONT LE PAYLOAD RESTE À DÉCRIRE — liste NOMINATIVE datée (2026-08-24),
 * DÉCROISSANTE, lot de mort `L1c #1468` (qui remplit les payloads restants et fait mourir le repli
 * `looseObject` de `gameOpSchema`). C'est l'INVENTAIRE des payloads non encore déclarés, pas un
 * constat d'obstacle : une seule entrée porte une mesure PROPRE — `gainAdvantage`, dont `traits.json`
 * écrit `amount: "$indice"` (chaîne) hors de `formulaSchema`. Les autres attendent leur mesure en L1c.
 * Une entrée ne se retire que par le commit qui TYPE l'op dans `OP_DEFS`.
 */
export const OPS_NON_TYPEES: readonly string[] = [
  'actGate', 'ap', 'armourPierce', 'arrowWard', 'attackKeyword', 'attackWardFM', 'attrMod',
  'beginPsych', 'breakBlade', 'castWard', 'chain', 'charDRBonus', 'charDamage', 'condition',
  'crewTestMod', 'critOnRoll', 'critTwice', 'cureCriticalWound', 'cureDisease', 'damageArmour', 'disarm',
  'endPsych', 'endTransform', 'freeReroll', 'gainAdvantage', 'gainResource', 'grantFreeAttack',
  'grantNaturalWeapon', 'grantPsychTrait', 'grantTrait', 'handGate', 'ignoreAnimosity',
  'ignoreStatePenalties', 'incomingAdvantage', 'incomingAttackMod', 'incomingSpellDRMod', 'interruptFocus',
  'intoxicate', 'lifeSteal', 'light', 'martyr', 'maxWeaponHands', 'mitigateIncoming', 'moveMod', 'moveScale',
  'preventInfection', 'push', 'reduceToZero', 'removeCondition', 'removePsychTrait', 'removeShipPoste',
  'rollMutation', 'sbBonus', 'senseLoss', 'sinMod', 'spendAdvantage', 'statusMod', 'suppressPsych', 'teamCommander',
  'teleport', 'weaponDamageMod', 'weaponRollMod', 'weatherWard', 'wounds',
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


// ============================================================================
// FLOW CORE (`src/engine/flowCore.ts`) — Condition / FlowTest / Flow / TriggeredEffect. SOURCE UNIQUE
// pour `domains`/`maneuvers`/`qualities`/`talents`/`etats`/`spells`/`traits`/`trappings`/`psychology`,
// qui redéclaraient CHACUN cette algèbre (à l'identique ou avec des libertés locales — cf. écarts
// absorbés ci-dessous, chaque dataset re-testé au parse après rewire).
// ============================================================================

export const compareOpSchema = z.enum(['>=', '<=', '==', '<', '>']);
/** ACTEUR désigné par une mécanique. */
export const actorRefSchema = enumNomme({ target: 'la cible', caster: 'le lanceur' });

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


const charRefSchema = nommerChamps(z.strictObject({ who: actorRefSchema, char: charKeySchema, bonus: z.boolean().optional() }), { who: { label: "acteur"  }, char: { label: "caractéristiques"  }, bonus: { label: "bonus" } });
const compareSubjectSchema = z.union([
  nommerChamps(z.strictObject({ who: actorRefSchema, field: actorFieldSchema }), { who: { label: "acteur"  }, field: { label: "champ"  } }),
  nommerChamps(z.strictObject({ who: actorRefSchema, condition: z.string() }), { who: { label: "acteur"  }, condition: { label: "condition" , texte: { regime: "technique"} } }),
  charRefSchema,
]);
/** `CompareSubject & { factor?: number }` (`engine/flowCore.ts:131`) — un `z.intersection` d'un
 *  `z.union` de `strictObject` NE FONCTIONNE PAS avec zod (chaque branche strict rejette les clés des
 *  autres, cf. `domains.ts` avant ce rewire : `z.intersection(compareSubjectSchema, …)` échouait sur
 *  `etats.json` #14 « inondation » — `{who,char:'E',factor:0.5}` — vérifié en isolation). La forme
 *  fidèle est donc l'UNION des 3 branches de `CompareSubject`, chacune portant son `factor`. */
const compareValueSchema = z.union([
  z.number(),
  nommerChamps(z.strictObject({
    who: actorRefSchema,
    field: actorFieldSchema,
    factor: z.number().optional(),
  }), { who: { label: "acteur"  }, field: { label: "champ"  }, factor: { label: "facteur" } }),
  nommerChamps(z.strictObject({ who: actorRefSchema, condition: z.string(), factor: z.number().optional() }), { who: { label: "acteur"  }, condition: { label: "condition" , texte: { regime: "technique"} }, factor: { label: "facteur" } }),
  nommerChamps(z.strictObject({ who: actorRefSchema, char: charKeySchema, bonus: z.boolean().optional(), factor: z.number().optional() }), { who: { label: "acteur"  }, char: { label: "caractéristiques"  }, bonus: { label: "bonus" }, factor: { label: "facteur" } }),
]);

/** `Condition` (`engine/flowCore.ts:112`) — algèbre CLOSE, récursive via `all`/`any`/`not`. */
export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    nommerChamps(z.strictObject({ kind: z.literal('always') }), { kind: { label: "type"  } }),
    nommerChamps(z.strictObject({ kind: z.literal('flag'), expr: z.string().min(1, 'Condition « flag » : le drapeau (`expr`) est vide — nommez le drapeau posé par l’Effet `setFlag`, ou retirez la Condition.') }), { kind: { label: "type"  }, expr: { label: "expression" , texte: { regime: "technique"} } }),
    nommerChamps(z.strictObject({
      kind: z.literal('time'),
      window: nommerChamps(z.strictObject({
        afterHour: z.number().optional(),
        afterMinute: z.number().optional(),
        beforeHour: z.number().optional(),
        beforeMinute: z.number().optional(),
      }), { afterHour: { label: "après cette heure" }, afterMinute: { label: "après cette minute" }, beforeHour: { label: "avant cette heure" }, beforeMinute: { label: "avant cette minute" } }),
    }), { kind: { label: "type"  }, window: { label: "créneau horaire" } }),
    nommerChamps(z.strictObject({ kind: z.literal('hasItem'), trappingId: z.string(), count: z.number().optional() }), { kind: { label: "type"  }, trappingId: { label: "objet" , texte: { regime: "technique"} }, count: { label: "nombre" } }),
    nommerChamps(z.strictObject({
      kind: z.literal('money'),
      atLeast: nommerChamps(z.strictObject({ gold: z.number().optional(), silver: z.number().optional(), brass: z.number().optional() }), { gold: { label: "couronnes d’or" }, silver: { label: "pistoles d’argent" }, brass: { label: "sous de cuivre" } }),
    }), { kind: { label: "type"  }, atLeast: { label: "minimum" } }),
    nommerChamps(z.strictObject({ kind: z.literal('partyDead'), who: partyWhoSchema }), { kind: { label: "type"  }, who: { label: "acteur"  } }),
    nommerChamps(z.strictObject({ kind: z.literal('skill'), id: z.string(), spec: z.string().optional(), advances: z.number().optional(), who: partyWhoSchema.optional() }), { kind: { label: "type"  }, id: { label: "identifiant" , texte: { regime: "technique"} }, spec: { label: "spécialisation" , texte: { regime: "technique"} }, advances: { label: "augmentations" }, who: { label: "acteur"  } }),
    nommerChamps(z.strictObject({ kind: z.literal('career'), id: z.string(), who: partyWhoSchema.optional() }), { kind: { label: "type"  }, id: { label: "identifiant" , texte: { regime: "technique"} }, who: { label: "acteur"  } }),
    nommerChamps(z.strictObject({ kind: z.literal('species'), id: z.string(), who: partyWhoSchema.optional() }), { kind: { label: "type"  }, id: { label: "identifiant" , texte: { regime: "technique"} }, who: { label: "acteur"  } }),
    nommerChamps(z.strictObject({ kind: z.literal('status'), atLeast: z.string(), who: partyWhoSchema.optional() }), { kind: { label: "type"  }, atLeast: { label: "minimum" , texte: { regime: "technique"} }, who: { label: "acteur"  } }),
    nommerChamps(z.strictObject({ kind: z.literal('compare'), subject: compareSubjectSchema, op: compareOpSchema, value: compareValueSchema }), { kind: { label: "type"  }, subject: { label: "sujet" }, op: { label: "opération"  }, value: { label: "valeur" } }),
    nommerChamps(z.strictObject({ kind: z.literal('slThreshold'), op: compareOpSchema, value: z.number() }), { kind: { label: "type"  }, op: { label: "opération"  }, value: { label: "valeur" } }),
    nommerChamps(z.strictObject({ kind: z.literal('location'), is: hitLocationSchema }), { kind: { label: "type"  }, is: { label: "valeur attendue"  } }),
    nommerChamps(z.strictObject({ kind: z.literal('attackKind'), is: z.string() }), { kind: { label: "type"  }, is: { label: "valeur attendue" , texte: { regime: "technique"} } }),
    nommerChamps(z.strictObject({ kind: z.literal('startleCause'), is: startleCauseSchema }), { kind: { label: "type"  }, is: { label: "valeur attendue"  } }),
    nommerChamps(z.strictObject({ kind: z.literal('woundsDealt'), op: compareOpSchema, value: z.number() }), { kind: { label: "type"  }, op: { label: "opération"  }, value: { label: "valeur" } }),
    nommerChamps(z.strictObject({ kind: z.literal('engagedAdvantageGap'), op: compareOpSchema, value: z.number() }), { kind: { label: "type"  }, op: { label: "opération"  }, value: { label: "valeur" } }),
    nommerChamps(z.strictObject({ kind: z.literal('engagedAdvantageLead'), op: compareOpSchema, value: z.number() }), { kind: { label: "type"  }, op: { label: "opération"  }, value: { label: "valeur" } }),
    nommerChamps(z.strictObject({ kind: z.literal('foeInLoS') }), { kind: { label: "type"  } }),
    nommerChamps(z.strictObject({ kind: z.literal('hiddenFromFoes') }), { kind: { label: "type"  } }),
    nommerChamps(z.strictObject({ kind: z.literal('engaged') }), { kind: { label: "type"  } }),
    nommerChamps(z.strictObject({ kind: z.literal('crewTest') }), { kind: { label: "type"  } }),
    nommerChamps(z.strictObject({ kind: z.literal('nearestFoe'), op: compareOpSchema, value: z.number() }), { kind: { label: "type"  }, op: { label: "opération"  }, value: { label: "valeur" } }),
    nommerChamps(z.strictObject({ kind: z.literal('capability'), who: actorRefSchema, id: z.string(), op: compareOpSchema.optional(), value: z.number().optional() }), { kind: { label: "type"  }, who: { label: "acteur"  }, id: { label: "identifiant" , texte: { regime: "technique"} }, op: { label: "opération"  }, value: { label: "valeur" } }),
    nommerChamps(z.strictObject({ kind: z.literal('relation'), who: actorRefSchema, is: relationOrCampSchema }), { kind: { label: "type"  }, who: { label: "acteur"  }, is: { label: "valeur attendue"  } }),
    nommerChamps(z.strictObject({ kind: z.literal('has'), who: actorRefSchema, what: hasWhatSchema, value: z.string(), spec: z.string().optional() }), { kind: { label: "type"  }, who: { label: "acteur"  }, what: { label: "objet"  }, value: { label: "valeur" , texte: { regime: "technique"} }, spec: { label: "spécialisation" , texte: { regime: "technique"} } }),
    nommerChamps(z.strictObject({ kind: z.literal('casterChaosDomain'), is: z.string() }), { kind: { label: "type"  }, is: { label: "valeur attendue" , texte: { regime: "technique"} } }),
    nommerChamps(z.strictObject({ kind: z.literal('visiblePassive'), who: actorRefSchema }), { kind: { label: "type"  }, who: { label: "acteur"  } }),
    nommerChamps(z.strictObject({ kind: z.literal('all'), of: z.array(conditionSchema) }), { kind: { label: "type"  }, of: { label: "contenu" } }),
    nommerChamps(z.strictObject({ kind: z.literal('any'), of: z.array(conditionSchema) }), { kind: { label: "type"  }, of: { label: "contenu" } }),
    nommerChamps(z.strictObject({ kind: z.literal('not'), of: conditionSchema }), { kind: { label: "type"  }, of: { label: "contenu" } }),
  ]),
);


/** `FlowTest` (`engine/flowCore.ts:335`) — jet différé (→ modale), tout le métier hors branches. */
/** `CatalogStake` (`src/data/index.ts`) — RÉFÉRENCE d'enjeu vers un DATASET : la clé de la donnée +
 *  les valeurs calculées pour ses trous. Un Flow authoré peut DIRE ce qu'il met en jeu sans qu'aucun
 *  texte n'entre au document (le résolveur reste la seule porte du texte). */
export const catalogStakeSchema = nommerChamps(z.strictObject({
  key: nommerChamps(z.strictObject({
    dataset: z.enum(['night', 'voyage', 'weather', 'flow', 'activity', 'combat']),
    kind: z.string(),
    entryId: z.string().optional(),
    entryCategory: z.string().optional(),
  }), { dataset: { label: "registre"  }, kind: { label: "type" , texte: { regime: "technique"} }, entryId: { label: "entrée" , texte: { regime: "technique"} }, entryCategory: { label: "catégorie d’entrée" , texte: { regime: "technique"} } }),
  values: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
}), { key: { label: "clé" }, values: { label: "valeurs" , texte: { regime: "technique"} } });

/** `AuthoredStake` (`src/data/index.ts`) — la phrase qu'un DOCUMENT de campagne écrit lui-même
 *  (arbitrage user 2026-08-12, #1262) : elle voyage avec le document et ne pointe aucun dataset. */
export const authoredStakeSchema = proseNommee(nommerChamps(z.strictObject({}), {}), 'stake.authored');

/** `DerivedStake` (`src/data/index.ts`) — enjeu DÉRIVÉ de l'entité porteuse (`{kind, id}`), calculé
 *  au montage de l'étape par le socle. */
export const derivedStakeSchema = nommerChamps(z.strictObject({
  from: nommerChamps(z.strictObject({
    kind: z.enum(Object.keys(CATEGORY_BY_SOURCE_KIND) as [EffectSourceKind, ...EffectSourceKind[]]),
    id: z.string(),
  }), { kind: { label: "type"  }, id: { label: "identifiant" , texte: { regime: "technique"} } }),
}), { from: { label: "provenance" } });

/** `StakeRef` (`src/data/index.ts`) — les TROIS formes d'enjeu d'une entrée de jet, qui passent par
 *  la même porte de résolution (`resolveStake`). */
export const stakeRefSchema: z.ZodType<StakeRef> = z.union([
  catalogStakeSchema,
  authoredStakeSchema,
  derivedStakeSchema,
]);

export const flowTestSchema = nommerChamps(z.strictObject({
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
  easierIf: nommerChamps(z
    .strictObject({
      hasSkill: nommerChamps(z.strictObject({ id: z.string(), spec: z.string().optional() }), { id: { label: "identifiant" , texte: { regime: "technique"} }, spec: { label: "spécialisation" , texte: { regime: "technique"} } }).optional(),
      hasTalent: idDe('talent').optional(),
      steps: z.number().optional(),
    }), { hasSkill: { label: "Compétence requise" }, hasTalent: { label: "Talent requis" , texte: { regime: "technique"} }, steps: { label: "étape" } })
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
        code: 'custom',
        message: `menace « ${v} » : aucune spec de ce nom sur le talent « resistance » (talents.json). Valeurs admises : ${menaceIds().join(', ')}`,
      });
    })
    .optional(),
  difficultyBy: z.array(nommerChamps(z.strictObject({ cond: conditionSchema, difficulty: difficultySchema }), { cond: { label: "condition" }, difficulty: { label: "difficulté"  } })).optional(),
  opposed: nommerChamps(z
    .strictObject({
      attacker: charKeySchema,
      attackerSkill: z.string().optional(),
      attackerLabel: z.string().optional(),
      bonusSL: z.number().optional(),
      attackerBonusSL: z.number().optional(),
    }), { attacker: { label: "attaquant"  }, attackerSkill: { label: "Compétence de l’attaquant" , texte: { regime: "technique"} }, attackerLabel: { label: "nom de l’attaquant" , texte: { regime: "technique"} }, bonusSL: { label: "bonus de DR" }, attackerBonusSL: { label: "bonus de DR de l’attaquant" } })
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
}), { stake: { label: "enjeu" }, skill: { label: "Compétence" }, sense: { label: "sens"  }, characteristic: { label: "caractéristique"  }, difficulty: { label: "difficulté"  }, requireSL: { label: "DR requis" }, label: { label: "libellé" , texte: { regime: "designation"} }, tool: { label: "outil" , texte: { regime: "technique"} }, vsGroups: { label: "contre les groupes" , texte: { regime: "technique"} }, vsStatus: { label: "contre le statut" , texte: { regime: "technique"} }, begging: { label: "mendicité" }, vsCapricieux: { label: "contre Capricieux" }, easierIf: { label: "facilité conditionnelle" }, argDifficulty: { label: "difficulté de l’argument" }, unlessImmune: { label: "sauf immunité" , texte: { regime: "technique"} }, onlyGroups: { label: "groupes autorisés" , texte: { regime: "technique"} }, exceptGroups: { label: "groupes exclus" , texte: { regime: "technique"} }, gate: { label: "condition d’accès" }, noSupport: { label: "sans assistance" }, menace: { label: "menace" , texte: { regime: "technique"} }, difficultyBy: { label: "difficultés conditionnelles" }, opposed: { label: "opposition" } });


/** Test ÉTENDU (`LDB 12 l.172-174`) : un acteur cumule des DR Round par Round jusqu'à `targetDR`
 *  (crocheter une serrure, forcer un mécanisme…). `flag` posé à la réussite (gate la suite). */
export const extendedTestSchema = nommerChamps(z.strictObject({
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
}), { type: { label: "type"  }, skill: { label: "Compétence" }, characteristic: { label: "caractéristique"  }, difficulty: { label: "difficulté"  }, label: { label: "libellé" , texte: { regime: "designation"} }, targetDR: { label: "DR à atteindre" }, flag: { label: "drapeau" , texte: { regime: "technique"} }, stake: { label: "enjeu" } });

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
  const noeud = nommerChamps(z.strictObject({ kind: z.literal('test'), test, success: branche, fail: branche }), { kind: { label: "type"  }, test: { label: "Test" }, success: { label: "réussite" , texte: { regime: "technique",usage: "branche de Flow paramétrée par son schéma"} }, fail: { label: "échec" , texte: { regime: "technique",usage: "branche de Flow paramétrée par son schéma"} } });
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
  nommerChamps(z.strictObject({ near: z.enum(['victim', 'self']), radiusMeters: z.number() }), { near: { label: "près de"  }, radiusMeters: { label: "rayon en mètres" } }),
  nommerChamps(z.strictObject({ pick: z.literal('engaged'), sizeAtMost: z.literal('self').optional(), max: z.number() }), { pick: { label: "sélection"  }, sizeAtMost: { label: "Taille maximale"  }, max: { label: "maximum" } }),
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


/** `StageOutcome` (`src/engine/activities.ts:82-84`) — effet de portée Étape (Activités + Rencontres
 *  de voyage). Dupliqué à l'identique dans `activities`/`incidents-monture`/`problemes-vehicule`/
 *  `rencontres-edoc`. */
export const stageOutcomeSchema = z.enum([
  'suppressExposure', 'gatherInfo', 'noSurprise', 'mapMade', 'rerollToken', 'countsAsRest', 'campCare',
  'extraActivity', 'skipStage', 'fullRecovery', 'worsenWeather',
]);


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
  nommerChamps(z.strictObject({ poste: z.literal(true) }), { poste: { label: "poste" } }),
  nommerChamps(z.strictObject({ stations: refs('shipStation', { min: 1 }) }), { stations: { label: "présences" , texte: { regime: "technique"} } }),
  nommerChamps(z.strictObject({ role: ref('crewRole') }), { role: { label: "rôle" , texte: { regime: "technique",usage: "référence mécanique résolue au catalogue"} } }),
]);

// ============================================================================
// FAMILLE MÉCANIQUE — tout nœud qui compose un `GameOp`, construit par `mecaniqueDe(regimes)`.
// ============================================================================

/** Les régimes déposés par une famille sur ses nœuds `gameOp`/`effectOp`/`flow`. */
const REGIMES_DES_NOEUDS = new WeakMap<object, Regimes>();

/** Les régimes de la famille qui a construit ce nœud, `undefined` hors famille. */
export function regimesDuNoeud(noeud: unknown): Regimes | undefined {
  return typeof noeud === 'object' && noeud !== null ? REGIMES_DES_NOEUDS.get(noeud) : undefined;
}

/** Payloads d'une famille : une FORME se ferme en `z.strictObject`, ses champs à choix au régime demandé. */
function payloadsDe(regimes: Regimes): Readonly<Record<string, z.ZodType<unknown>>> {
  return Object.fromEntries(
    Object.entries(DECLARATIONS_D_OPS).map(([op, d]) => {
      if (estNoeudZod(d)) return [op, d];
      const champs = Object.entries((d as PayloadDeclare).champs).flatMap(([champ, v]) =>
        v instanceof ChampAChoixDeclare ? [[champ, refOuSpec(v.cible, v.extra, regimes[`${op}.${champ}` as ChampAChoix] ?? 'specSeule')]]
          : v instanceof ChampReserveDeclare ? (regimes[`${op}.${champ}` as ChampReserve] === 'admis' ? [[champ, v.noeud]] : [])
            : [[champ, v]],
      );
      const meta = Object.fromEntries(champs.map(([champ]) => [champ, (d as PayloadDeclare).meta[champ as string]]));
      return [op, nommerChamps(z.strictObject(Object.fromEntries(champs)), meta)];
    }),
  );
}

function construire(regimes: Regimes) {
  const opDefs = payloadsDe(regimes);
  /**
   * Un `GameOp` (`src/engine/ops.ts`) tel qu'il apparaît en DONNÉE. Une op de `OP_DEFS` est validée sur
   * son payload STRICT ; une op de `OPS_NON_TYPEES` garde la forme LOOSE (aux refus de `refusLoose`
   * près) ; une op inconnue des DEUX registres est NOMMÉE en erreur. Ce rouge vit ICI et nulle part
   * ailleurs : la clé `op` est surchargée en donnée (les comparateurs `>=`/`<=`/`==` d'une `Condition`
   * la portent aussi).
   */
  const gameOp: z.ZodType<GameOp> = nommerChamps(z.looseObject({ op: z.string() }).superRefine((v, ctx) => {
    marquerOpAtteinte(ctx);
    const payload = opDefs[v.op];
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
  }), { op: { label: "opération" , texte: { regime: "technique"} } }).transform((v) => v as GameOp);

  /** EFFECTOP — pont UNIQUE entre la logique authorée (Flow) et le moteur mécanique des sorts : applique
   *  des `GameOp` à une cible (`party`/`hero` scène, ou `caster`/`target` incantation). Feuille `do` par
   *  DÉFAUT du `Flow<E>` générique (`engine/flowCore.ts:45`), et l'un des membres de l'union `Effect` de
   *  scène (`defs-scenes/effets.ts`). `on` = les 4 valeurs de
   *  l'interface TS : `'party'`/`'hero'` (scène) ou `'caster'`/`'target'` (contexte d'incantation). Le
   *  ciblage `'self'`/`'victim'` est le vocabulaire du NIVEAU TRIGGER (`effectTargetingSchema`), pas de la
   *  feuille : sur la feuille, `'caster'` = porteur, `'target'` = cible résolue par le trigger. */
  declarerEnfants(gameOp, Object.entries(opDefs).map(([op, noeud]) => ({ noeud, segment: '^' + op })), valeur => {
    const op = (valeur as { op?: string } | null)?.op;
    return op && opDefs[op] ? [opDefs[op]] : [];
  }, 'payloads-op');
  nommerNoeud(gameOp, { opacite: { nature: 'dispatch-op', raison: 'Payloads stricts déclarés ; OPS_NON_TYPEES reste opaque.' } });

  const effectOp = nommerChamps(z.strictObject({
    type: z.literal('ops'),
    ops: z.array(gameOp),
    on: z.enum(['party', 'hero', 'caster', 'target']).optional(),
    heroId: z.string().optional(),
    untilTime: z.number().optional(),
    label: z.string().optional(),
  }), { type: { label: "type"  }, ops: { label: "opérations" }, on: { label: "cible"  }, heroId: { label: "héros" , texte: { regime: "technique"} }, untilTime: { label: "échéance" }, label: { label: "libellé" , texte: { regime: "designation"} } });

  /** `Flow<EffectOp>` (`engine/flowCore.ts:492`) — arbre récursif ACYCLIQUE (seq/do/if/test/choice). */
  const flow: z.ZodType<Flow<EffectOp>> = z.lazy(() =>
    z.discriminatedUnion('kind', [
      nommerChamps(z.strictObject({ kind: z.literal('seq'), steps: z.array(flow) }), { kind: { label: "type"  }, steps: { label: "étape" } }),
      nommerChamps(z.strictObject({ kind: z.literal('do'), effect: effectOp }), { kind: { label: "type"  }, effect: { label: "effet" } }),
      nommerChamps(z.strictObject({ kind: z.literal('if'), cond: conditionSchema, then: flow, else: flow.optional() }), { kind: { label: "type"  }, cond: { label: "condition" }, then: { label: "alors" }, else: { label: "sinon" } }),
      noeudTest(flow),
      proseNommee(nommerChamps(z.strictObject({
        kind: z.literal('choice'),
        // Coût LITTÉRAL, ou TEMPLATE `$indice` (`engine/flowCore::INDICE_TEMPLATE`) — accepté AU PARSE
        // seulement : `withArg` (`state/triggeredEffects`) le remplace par l'Indice de l'instance porteuse.
        advantageCost: ouReserve(z.number(), INDICE_TEMPLATE).optional(),
        icon: z.string().optional(),
        yes: flow,
        no: flow.optional(),
      }), { kind: { label: "type"  }, advantageCost: { label: "coût en Avantage"  }, icon: { label: "icône" , texte: { regime: "technique"} }, yes: { label: "oui" }, no: { label: "non" } }), 'flow.choice.prompt'),
    ]),
  );

  /** `TriggeredEffect<EffectOp>` (`engine/flowCore.ts:472`). `optional` (Contrôle de la Frénésie…)
   *  seule 1/9 des JSON le peuple (`talents.json`) — laissé optionnel, sans risque pour les autres. */
  const triggeredEffect = nommerChamps(z.strictObject({
    trigger: effectTriggerSchema,
    on: effectTargetingSchema,
    flow: flow,
    condition: z.string().optional(),
    attackType: z.enum(['melee', 'ranged']).optional(),
    optional: z.boolean().optional(),
  }), { trigger: { label: "déclenchement"  }, on: { label: "cible"  }, flow: { label: "enchaînement", transparent: true }, condition: { label: "condition" , texte: { regime: "technique"} }, attackType: { label: "type d’attaque"  }, optional: { label: "facultatif" } });

  /** `TravelTableEntry` (`src/engine/travelTables.ts:15-26`) — entrée d100 de l'enveloppe `TravelTable`,
   *  partagée par `rencontres-edoc`/`incidents-monture`/`problemes-vehicule`. */
  const travelTableEntry = nommerChamps(z.strictObject({
    min: z.number(),
    max: z.number(),
    id: z.string(),
    label: z.string(),
    desc: z.string(),
    stageOutcome: stageOutcomeSchema.optional(),
    vehicleWounds: z.string().nullable().optional(),
    occupantOps: z.array(gameOp).optional(),
    /** Suite MÉCANIQUE d'un Incident de MONTE (`incidents-monture.json`, EDOC 07 l.157-174), miroir de
     *  `MountIncidentEffects` (`src/engine/travelTables.ts`) : elle est DÉCLARÉE par l'entrée, jamais
     *  déduite de son id. Une entrée sans `mount` ne laisse aucune séquelle. */
    mount: nommerChamps(z.strictObject({
      /** Test du CAVALIER, sous peine de chute de `fallM` mètres (l.166/l.171). */
      riderTest: nommerChamps(z.strictObject({
        skill: refOuSpec('skill'),
        char: charKeySchema.optional(),
        difficulty: difficultySchema,
        fallM: z.number(),
      }), { skill: { label: "Compétence" }, char: { label: "caractéristiques"  }, difficulty: { label: "difficulté"  }, fallM: { label: "hauteur de chute" } }).optional(),
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
    }), { riderTest: { label: "Test du cavalier" }, ridingPenalty: { label: "malus de Chevaucher" }, forcedAllure: { label: "allure imposée"  }, preventsMount: { label: "monture inutilisable" }, notHealedByCare: { label: "sans récupération par soins" }, endCondition: { label: "condition de fin" , texte: { regime: "narration",horsContrat: { motif: "catalogue",preuve: "src/data/schemas/defs/incidents-monture.ts:schema"}} }, outcome: { label: "issue"  , texte: { regime: "narration",horsContrat: { motif: "catalogue",preuve: "src/data/schemas/defs/incidents-monture.ts:schema"}} } }).optional(),
  }), { min: { label: "minimum" }, max: { label: "maximum" }, id: { label: "identifiant"  , texte: { regime: "technique"} }, label: { label: "libellé"  , texte: { regime: "designation"} }, desc: { label: "texte"  , texte: { regime: "narration",horsContrat: { motif: "catalogue",preuve: "src/data/schemas/defs/incidents-monture.ts:schema"}} }, stageOutcome: { label: "issue d’étape"  }, vehicleWounds: { label: "Blessures du véhicule"  , texte: { regime: "technique"} }, occupantOps: { label: "opérations des occupants" }, mount: { label: "monture" } });
  /**
   * `ShipCrewHit` (`src/data/shipCriticals.ts`) — ce qu'un Critique de coque fait à l'ÉQUIPAGE. Le
   * porteur dit QUI encaisse (`crewTarget`, REQUIS) ; l'ISSUE est SOIT une épreuve (le nœud `test` du
   * Flow, dont la branche d'échec porte la conséquence — MDG 13 l.763, MSRC 07 l.78/l.94), SOIT des
   * ops CERTAINES (`ops` — MSRC 07 l.82, où le livre n'appelle aucun jet). Les deux clefs sont
   * EXCLUSIVES.
   */
  const shipCrewHit = nommerChamps(z
    .strictObject({
      crewTarget: crewTargetSchema,
      test: noeudTest(flow, { difficulteRequise: true, echecSeulServi: true }).optional(),
      ops: z.array(gameOp).optional(),
    })
    .superRefine((v, ctx) => {
      if (!v.test === !v.ops) {
        ctx.addIssue({
          code: 'custom',
          message: 'un coup à l’équipage porte SOIT une épreuve (`test`) SOIT une conséquence certaine (`ops`) — jamais les deux, jamais aucune.',
        });
      }
    }), { crewTarget: { label: "cible d’équipage" }, test: { label: "Test" }, ops: { label: "opérations" } });

  /** `ShipCritEntry` (`src/data/shipCriticals.ts`) — entrée d100 de Critique de coque, partagée par
   *  `ship-criticals` (navale) et `river-criticals` (fluviale). */
  const shipCritEntry = nommerChamps(z.strictObject({
    ...plageSchema.shape,
    id: z.string(),
    label: z.string(),
    ops: z.array(gameOp).optional(),
    shrapnel: z.number().optional(),
    hullCrits: z.string().optional(),
    crewHit: shipCrewHit.optional(),
    note: z.string(),
  }), { ...metaDesChamps(plageSchema, { exigees: true }), id: { label: "identifiant"  , texte: { regime: "technique"} }, label: { label: "libellé"  , texte: { regime: "designation"} }, ops: { label: "opérations" }, shrapnel: { label: "éclats" }, hullCrits: { label: "Critiques de coque"  , texte: { regime: "technique"} }, crewHit: { label: "coup à l’équipage" }, note: { label: "note"  , texte: { regime: "narration",horsContrat: { motif: "catalogue",preuve: "src/data/schemas/defs/ship-criticals.ts:schema"}} } });

  for (const noeud of [gameOp, effectOp, flow]) REGIMES_DES_NOEUDS.set(noeud, regimes);
  return { regimes, opDefs, gameOp, effectOp, flow, triggeredEffect, travelTableEntry, shipCrewHit, shipCritEntry };
}

/** Une famille mécanique : ses payloads d'op et tout nœud qui compose un `GameOp`. */
export type FamilleMecanique = ReturnType<typeof construire>;

/** Le cache de `mecaniqueDe`, par forme CANONIQUE des régimes : il EST le registre des familles. */
const FAMILLES = new Map<string, FamilleMecanique>();

/**
 * La famille mécanique d'un porteur, au régime de ses champs à choix et réservés. Mémoïsée par la forme
 * canonique de `regimes` (entrées triées, `specSeule` retiré) : `mecaniqueDe({})` est la famille FERMÉE, dont les
 * exports ci-dessous sont l'instance.
 */
export function mecaniqueDe(regimes: Regimes): FamilleMecanique {
  const entrees = (Object.entries(regimes) as [string, RegimeDePorteur | 'admis' | undefined][])
    .filter(([, r]) => r !== undefined && r !== 'specSeule')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const declares: readonly string[] = [...CHAMPS_A_CHOIX, ...CHAMPS_RESERVES];
  for (const [champ] of entrees) {
    if (!declares.includes(champ)) {
      throw new Error(`mecaniqueDe : « ${champ} » n'est aucun champ à choix ni réservé déclaré (${declares.join(', ')}).`);
    }
  }
  const cle = JSON.stringify(entrees);
  let famille = FAMILLES.get(cle);
  if (!famille) {
    famille = construire(Object.fromEntries(entrees) as Regimes);
    FAMILLES.set(cle, famille);
  }
  return famille;
}

/** Les familles construites, en lecture seule — racines de la garde du masquage (`parse-de-mesure.test.ts`). */
export function famillesConstruites(): readonly FamilleMecanique[] {
  return [...FAMILLES.values()];
}

const FERMEE = mecaniqueDe({});
export const OP_DEFS: Readonly<Record<string, z.ZodType<unknown>>> = FERMEE.opDefs;
export const gameOpSchema: z.ZodType<GameOp> = FERMEE.gameOp;
export const effectOpSchema = FERMEE.effectOp;
export const flowSchema: z.ZodType<Flow<EffectOp>> = FERMEE.flow;
export const triggeredEffectSchema: z.ZodType<TriggeredEffect<EffectOp>> = FERMEE.triggeredEffect;
export const travelTableEntrySchema = FERMEE.travelTableEntry;
export const shipCrewHitSchema = FERMEE.shipCrewHit;
export const shipCritEntrySchema = FERMEE.shipCritEntry;
