import { nommerChamps, nommerNoeud, metaDesChamps, type MetaDesChamps } from './meta';
/**
 * MÉCANIQUE de la grammaire de document (#1466 L1a) — l'algèbre exécutable portée en donnée :
 * `GameOp`, `Condition`, `FlowTest`, `EffectOp`, `Flow`, `TriggeredEffect`, et les entrées de
 * table qui embarquent des ops (voyage, critiques de coque). Le registre `OP_DEFS` type le payload
 * op par op ; `OPS_NON_TYPEES` porte celles qui restent à décrire (lot L1c #1468).
 */
import { z } from 'zod';
import { validerApparenceDonnee } from './valeurs';
import { proseNommee } from './prose';
import { declarerEnfants } from './descente';
import { marquerProduit } from './interne/produits';
import { CATEGORY_BY_SOURCE_KIND, type EffectSourceKind } from '../../../engine/types';
import { categorieDEntreeAPool, trousDeLEnjeu, type StakeRef } from '../../index';
import { messageRecurrenceHorloge, SELF_REF, type Formula, type GameOp, type OpPassive } from '../../../engine/ops';
import { NARRATIVE_MARKERS } from '../../../engine/conditions';
import {
  ARG_TEMPLATE,
  CHAMPS_DE_DECISION,
  INDICE_TEMPLATE,
  flowHasFreeAttack,
  walkFlow,
  type Condition,
  type EffectOp,
  type EffectTrigger,
  type Flow,
  type FlowTestNode,
  type TriggeredEffect,
} from '../../../engine/flowCore';
import {
  acteDeDeverrouillageSchema,
  attackKindSchema,
  chaosAlignSchema,
  charKeySchema,
  cibleEtendueSchema,
  contexteDeTestSchema,
  deDeTirageSchema,
  diceSpecSchema,
  difficultySchema,
  effetSigneSchema,
  idDIconeSchema,
  enumNomme,
  shipLocationSchema,
  exposureLevelSchema,
  formulaSchema,
  formuleSansTirageSchema,
  genreDArmeSchema,
  hitLocationSchema,
  mainSchema,
  messageDeTermeDeJet,
  meteoImposeeSchema,
  statutSchema,
  ouReserve,
  plageSchema,
  reachSchema,
  natureDInfluenceSchema,
  sizeCategorySchema,
  symptomSeveritySchema,
  tirageSchema,
} from './valeurs';
import { traitInstanceSchema } from './reference';
import {
  idDe,
  marquerOpAtteinte,
  ref,
  refs,
  refOuSpec,
  specAuCatalogue,
  specDe,
  specFermeeDe,
  tirageSurTable,
  type RegimeDePorteur,
  type TypeEntite,
} from './ref';
import { CIBLE_D_APPARTENANCE, DECLARABLE_PAR_UN_PORTEUR, INSTANCIABLE_PAR_ID, RACINE_D_APPARENCE } from './sousListes';
import { GROUPES_TIRABLES } from '../../obsessions';
import { customStatblockSchema } from '../defs-scenes/communs';
import { estCibleType, varianteAdmise } from '../../../engine/psych/ciblage';
import { VIVRES_DE_CALE } from '../../../engine/seaNavigation';

/** Régime d'une liste d'ops, posé par sa fabrique (`passifsDe`, `executeesDe`) et lu par IDENTITÉ : une
 *  liste construite à la main n'en a aucun. */
export type RegimeDeListe = 'passive' | 'executee';
const REGIMES_DES_LISTES = new WeakMap<object, RegimeDeListe>();

/** La variante `noeud` d'une union (`Condition`, `Flow`, sélecteur, fenêtre, cible, objectif de victoire), nommée
 *  `label` à l'affichage. */
export const variante = <T extends z.ZodType>(label: string, noeud: T): T => nommerNoeud(noeud, { label });

/** Le régime d'une liste d'ops, `undefined` hors de `passifsDe` et `executeesDe`. */
export function regimeDeListe(noeud: unknown): RegimeDeListe | undefined {
  return typeof noeud === 'object' && noeud !== null ? REGIMES_DES_LISTES.get(noeud) : undefined;
}

/** Catégorie d'armure ignorée d'un `ArmourBypass` (`engine/armourBypass.bypassedAP`) ; `nonMetal` : LDB 62 l.270. */
export const armourBypassCategorieSchema = enumNomme({
  all: "toute l'armure",
  metal: 'le métal',
  nonMagic: 'le non-magique',
  nonMetal: 'le non-métal',
});

/** `ArmourBypass` — PA ignorés : un nombre de points, ou une catégorie d'armure. Source du type moteur
 *  (`src/engine/types.ts`). */
export const armourBypassSchema = z.union([z.number(), armourBypassCategorieSchema]);
export type ArmourBypass = z.infer<typeof armourBypassSchema>;

/** Localisation dont l'op `wounds` déduit les PA. LDB 16 l.84 */
const apFromSchema = enumNomme({ corps: 'le Corps', least: 'la Localisation la moins protégée' });

/** Ressource de destin que l'op `gainResource` crédite. */
export const ressourceDeDestinSchema = enumNomme({ fortune: 'Chance', fate: 'Destin' });

/** Sens d'arrondi de la fraction de l'op `lifeSteal`. */
const arrondiSchema = enumNomme({ floor: 'inférieur', ceil: 'supérieur' });

/** État que nomme une op `condition`/`removeCondition` : une entrée d'`etats.json` ou un marqueur narratif
 *  (`NARRATIVE_MARKERS`, `engine/conditions.ts`). #1463 LD.1, #2995 */
export const refDEtatSchema = ref(ouReserve(idDe('etat'), enumNomme(Object.fromEntries(NARRATIVE_MARKERS.map((m) => [m.id, m.label])))));

/** Fenêtre de Détermination d'un État porté en passif (`ResolveWindow`, `engine/ops.ts`). */
const fenetreDeDeterminationSchema = z.union([
  variante('Sans fenêtre', z.literal('none')),
  nommerChamps(z.strictObject({ scale: z.literal('rounds'), left: formulaSchema }), { scale: { label: 'échelle' }, left: { label: 'Rounds', texte: { regime: 'technique', usage: 'formule mécanique résolue par la grammaire' } } }),
  nommerChamps(z.strictObject({ scale: z.literal('clock'), minutes: formulaSchema }), { scale: { label: 'échelle' }, minutes: { label: 'minutes', texte: { regime: 'technique', usage: 'formule mécanique résolue par la grammaire' } } }),
]);

/** Champs de l'op `condition` qu'un État PORTÉ (#1695) ne peut PAS tenir — LISTE CLOSE, alignée sur ce
 *  que la branche `carried` d'`applyOps` transporte réellement (`id`/`value`/`resolveWindow`) :
 *  les DURÉES et la récurrence (l'effet porteur les tient), les VERROUS (la source EST le verrou), et
 *  les champs de LUTTE, figés par `addCondition` à la pose — que la réconciliation appelle NU. */
export const CHAMPS_EXCLUS_DE_CARRIED = [
  'durationRounds', 'durationMinutes', 'durationHours', 'perRound', 'lockedUntil', 'unlockBy',
  'escapeStrength', 'escapeThreshold', 'entangleOnFail', 'struggleDamage', 'difficulte', 'argDifficulty', 'grapple',
] as const;

/** Refus du payload `condition` : `perRound` + durée d'HORLOGE, mot pour mot comme `applyOps` le lève
 *  (`messageRecurrenceHorloge`, `engine/ops.ts`) ; `carried` + tout `CHAMPS_EXCLUS_DE_CARRIED` (#1695,
 *  LDB 48 l.495) ; un verrou dont une Condition lit un état que le contexte de verrou ne porte pas. */
function refusDeLaPoseDEtat(v: Readonly<Record<string, unknown>> & { id: { id: string } }, ctx: z.RefinementCtx): void {
  const id = v.id.id;
  if (v.perRound === true && (v.durationMinutes != null || v.durationHours != null)) {
    ctx.addIssue({ code: 'custom', path: ['perRound'], message: messageRecurrenceHorloge(id) });
  }
  if (v.carried === true) {
    for (const champ of CHAMPS_EXCLUS_DE_CARRIED) {
      if (v[champ] == null) continue;
      ctx.addIssue({
        code: 'custom',
        path: [champ],
        message: `État « ${id} » : « carried » (porté par l'effet actif de la source, #1695) est EXCLUSIF de « ${champ} » `
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
      message: `Verrou d'État « ${id} » : la Condition « ${kind} » lit un état que le contexte de verrou ne porte PAS `
        + "(`conditionLockCtx`, engine/actorView.ts — la vue du seul PORTEUR : Caractéristiques, PB, Taille, Avantage, camp, appartenances, États, Capacités). "
        + 'Elle serait évaluée FAUSSE en silence : réécrire le verrou sur le porteur, ou étendre le contexte AVANT la donnée.',
    });
  }
}

/** Ce que l'op `loseTurn` retire ; absent = les deux. */
export const loseTurnWhatSchema = enumNomme({ action: 'son Action', movement: 'son Mouvement' });

/** Compétences du dieu que frappe l'op `deitySkillMod`. LDB 40 l.61, l.70 */
export const deitySkillPickSchema = enumNomme({ all: 'toutes', random: 'une au hasard' });

/** Refus d'une op `deitySkillMod` sans durée, ou à deux durées. */
export const MESSAGE_DUREE_DE_DIVINITE = 'durée EXCLUSIVE : « durationHours » (heures) OU « durationDays » (jours) — exactement une des deux.';

/** Forme d'une `zone`. */
export const zoneShapeSchema = enumNomme({ disc: 'disque', wall: 'mur' });

/** `PerSL` (`src/engine/ops.ts:146`) — échelle « par +N DR » d'un payload d'op. */
export const perSLSchema = nommerChamps(z.strictObject({ every: z.number(), amount: z.number(), onFailure: z.boolean().optional() }), { every: { label: "intervalle" }, amount: { label: "quantité" }, onFailure: { label: "en cas d’échec" } });

/** PORTÉE d'attaque d'un ASSAILLANT que vise un passif du défenseur (`incomingAttackMod`,
 *  `incomingAdvantage`, `src/engine/ops.ts`) ; `all` = mêlée ET distance. Source du type moteur. */
export const porteeDAssautSchema = enumNomme({ melee: 'au corps à corps', distance: 'à distance', all: 'au corps à corps et à distance' });
export type PorteeDAssaut = z.infer<typeof porteeDAssautSchema>;

/** SENS engagé par un Test (`FlowTest.sense` — Perception : vue ou ouïe) ; le libellé est celui de la
 *  phrase qui le montre au joueur (op `senseLoss` : « perd la vue »). */
export const senseSchema = enumNomme({ vue: 'la vue', ouie: "l'ouïe" });

/** Les tables de CIBLES : chaque rangée désigne un Groupe (`groups.json`), la Cible tirée d'un Trait ciblé.
 *  EDOC 12 l.170. */
export const tablesDeCiblesSchema = enumNomme({ obsessions: 'le Tableau des Obsessions' });
export type TableDeCibles = z.infer<typeof tablesDeCiblesSchema>;
const tableDeCiblesSchema = nommerChamps(z.strictObject({ id: tablesDeCiblesSchema }), { id: { label: 'table' } });
/** Tirage d'une Cible (`grantTrait.cible`) : `pick` tirages sur une table de Cibles. */
const tirageDeCibleSchema = tirageSurTable(tableDeCiblesSchema);
export type TirageDeCible = z.infer<typeof tirageDeCibleSchema>;

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

/** Contrainte ENTRE champs d'un payload déclaré, posée sur l'objet que la famille ferme. */
type AffinageDePayload = (o: Record<string, unknown>, ctx: z.RefinementCtx) => void;

class PayloadDeclare<C extends FormeDePayload = FormeDePayload> {
  constructor(readonly champs: C, readonly meta: MetaDesChamps<FormeDePayload>, readonly affinage?: AffinageDePayload) {}
}
function declarerPayload<C extends FormeDePayload>(champs: C, meta: MetaDesChamps<C>, affinage?: AffinageDePayload): PayloadDeclare<C> {
  return new PayloadDeclare(champs, meta, affinage);
}

const estNoeudZod = (v: unknown): v is z.ZodType => typeof v === 'object' && v !== null && '_zod' in v;

/** Prose du retrait du jeu (`banish`) : LDB 85 l.98, l.199. */
export const banishNarrationSchema = enumNomme({ chaos: 'banni aux Royaumes du Chaos', unravel: 'se délite' }, { chaos: 'LDB 85 l.98', unravel: 'LDB 85 l.199' });

/** Une Cible n'est portée que par un type CIBLÉ, et celle d'une op est un Groupe que ce type admet
 *  (`psychology.json`, `cibles`). LDB 21 l.17-19, l.75 ; #3045 */
function refuserLaCibleHorsCiblage(type: string, cible: unknown, ctx: z.RefinementCtx): void {
  if (cible === undefined) return;
  if (!estCibleType(type)) {
    ctx.addIssue({ code: 'custom', path: ['cible'], message: `« ${type} » ne vise aucune Cible : « cible » est refusée.` });
  } else if (!varianteAdmise(type, 'groupe')) {
    ctx.addIssue({ code: 'custom', path: ['cible'], message: `« ${type} » ne vise pas un Groupe : voir ses « cibles » (psychology.json).` });
  }
}

/** Un vivre posé dans la cale du navire est l'un des vivres de `sea-navigation.json` `longsVoyages.vivresDeCale`.
 *  MDG 14 l.245-252 */
function refuserLeVivreHorsCale(id: string, path: PropertyKey[], ctx: z.RefinementCtx): void {
  if (!(VIVRES_DE_CALE.vivres as readonly string[]).includes(id)) {
    ctx.addIssue({ code: 'custom', path, message: `« ${id} » n'est pas un vivre de la cale (sea-navigation.json, longsVoyages.vivresDeCale : ${VIVRES_DE_CALE.vivres.join(', ')}).` });
  }
}

/** Un vivre posé par `setVessel`/`adjustVessel` : le vivre et ses rations (jours-homme) vont ensemble. MDG 14 l.245-252 */
export function refuserLeVivreDuNavire(o: { vivre?: { id: string }; provisions?: number }, ctx: z.RefinementCtx): void {
  if (o.vivre && o.provisions == null) ctx.addIssue({ code: 'custom', path: ['provisions'], message: `« provisions » manque : le vivre « ${o.vivre.id} » reçoit un nombre de rations (jours-homme).` });
  if (!o.vivre && o.provisions != null) ctx.addIssue({ code: 'custom', path: ['vivre'], message: `« vivre » manque : les ${o.provisions} rations visent un vivre de la cale.` });
  if (o.vivre) refuserLeVivreHorsCale(o.vivre.id, ['vivre'], ctx);
}

/** Le SUJET d'un jet : ce qu'il teste, Compétence ou Caractéristique (LDB 12 l.7, l.131). */
export const sujetDuJetSchema = nommerChamps(z.strictObject({
  skill: refOuSpec('skill').optional(),
  characteristic: charKeySchema.optional(),
}), { skill: { label: 'Compétence' }, characteristic: { label: 'caractéristique' } });
export type SujetDuJet = z.infer<typeof sujetDuJetSchema>;

/**
 * Payload STRICT par op (`src/engine/ops.ts`, union `GameOp`). Chaque entrée est un contrat POSITIF
 * vérifié sur toutes les occurrences réelles de l'op dans les 2 racines authorées. Une entrée est un
 * nœud zod, ou la FORME de ses champs quand l'un d'eux est un champ à choix (`aChoix`). Toute op
 * IMBRIQUÉE dans un payload (`z.lazy`) pointe la famille FERMÉE : seules les ops à la racine d'un
 * porteur lisent ses régimes (`mecaniqueDe`).
 */
const DECLARATIONS_D_OPS = {
  narrative: proseNommee(nommerChamps(z.strictObject({ op: z.literal('narrative'), nombre: formulaSchema.optional() }), { op: { label: 'opération'  }, nombre: { label: 'nombre tiré', texte: { regime: 'technique', usage: 'formule mécanique résolue par la grammaire' } } }), 'narrative.text'),
  banish: nommerChamps(z.strictObject({ op: z.literal('banish'), narration: banishNarrationSchema.optional(), onlyGroups: refs('groupe', { sousListe: CIBLE_D_APPARTENANCE }).optional() }), { op: { label: "opération"  }, narration: { label: "narration"  }, onlyGroups: { label: "groupes autorisés" , texte: { regime: "technique"} } }),
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
    characteristic: charKeySchema,
    mod: z.number(),
    min: reserve(z.number().optional()),
    durationRounds: formulaSchema.optional(),
    durationMinutes: formulaSchema.optional(),
    durationHours: formulaSchema.optional(),
  }, { op: { label: "opération" }, characteristic: { label: "caractéristique" }, mod: { label: "modificateur" }, min: { label: "minimum" }, durationRounds: { label: 'durée en Rounds' }, durationMinutes: { label: 'durée en minutes' }, durationHours: { label: 'durée en heures' } }),
  corruptionExposure: nommerChamps(z.strictObject({
    op: z.literal('corruptionExposure'),
    level: exposureLevelSchema.optional(),
    nature: natureDInfluenceSchema.optional(),
    easeSteps: z.number().optional(),
  }), { op: { label: "opération"  }, level: { label: "niveau"  }, nature: { label: "nature de l’Influence" }, easeSteps: { label: "crans de facilité" } }),
  aggravateSymptom: nommerChamps(z.strictObject({
    op: z.literal('aggravateSymptom'),
    disease: idDe('maladie'),
    symptomId: idDe('symptome'),
    severity: symptomSeveritySchema,
    otherwise: executeesDe(z.lazy(() => gameOpSchema)).optional(),
  }), { op: { label: "opération"  }, disease: { label: "maladie" , texte: { regime: "technique"} }, symptomId: { label: "symptôme" , texte: { regime: "technique"} }, severity: { label: "gravité"  }, otherwise: { label: "sinon" } }),
  attenuateSymptom: nommerChamps(z.strictObject({
    op: z.literal('attenuateSymptom'),
    disease: idDe('maladie'),
    symptomId: idDe('symptome'),
    otherwise: executeesDe(z.lazy(() => gameOpSchema)).optional(),
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
   *  ICI comme celui de toute op authorée ; ses `sequels` sont des ids de fiche `traumas.json` (même graphie que `amputationSchema`). */
  amputer: nommerChamps(z.strictObject({
    op: z.literal('amputer'),
    sequels: refs('trauma'),
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
  wounds: nommerChamps(z.strictObject({
    op: z.literal('wounds'),
    amount: formulaSchema,
    perSL: perSLSchema.optional(),
    onlyGroups: refs('groupe', { sousListe: CIBLE_D_APPARTENANCE }).optional(),
    ignoreTB: z.boolean().optional(),
    ignoreAP: z.boolean().optional(),
    bypassArmour: armourBypassSchema.optional(),
    apFrom: apFromSchema.optional(),
    min: z.number().optional(),
    extraAP: z.number().optional(),
    weaponHit: z.boolean().optional(),
  }), { op: { label: "opération"  }, amount: { label: "quantité" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, perSL: { label: "par DR" }, onlyGroups: { label: "groupes autorisés" , texte: { regime: "technique"} }, ignoreTB: { label: "ignore le Bonus d’Endurance" }, ignoreAP: { label: "ignore les PA" }, bypassArmour: { label: "armure percée" }, apFrom: { label: "PA lus à" }, min: { label: "minimum" }, extraAP: { label: "PA additionnels" }, weaponHit: { label: "coup d’arme" } }),
  ap: nommerChamps(z.strictObject({
    op: z.literal('ap'),
    loc: hitLocationSchema.optional(),
    amount: formulaSchema,
    noDeviation: z.boolean().optional(),
    atHitLocation: z.boolean().optional(),
  }), { op: { label: "opération"  }, loc: { label: "localisation"  }, amount: { label: "PA (±)" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, noDeviation: { label: "sans déviation" }, atHitLocation: { label: "à la Localisation touchée" } }),
  sinMod: nommerChamps(z.strictObject({ op: z.literal('sinMod'), amount: z.number() }), { op: { label: "opération"  }, amount: { label: "Points de Péché (±)" } }),
  gainResource: nommerChamps(z.strictObject({
    op: z.literal('gainResource'),
    resource: ressourceDeDestinSchema,
    amount: z.number(),
    perSL: perSLSchema.optional(),
    temporary: z.boolean().optional(),
  }), { op: { label: "opération"  }, resource: { label: "ressource" }, amount: { label: "points" }, perSL: { label: "par DR" }, temporary: { label: "le temps du Sort" } }),
  sbBonus: nommerChamps(z.strictObject({ op: z.literal('sbBonus'), amount: z.number() }), { op: { label: "opération"  }, amount: { label: "Bonus de Force (±)" } }),
  moveScale: nommerChamps(z.strictObject({ op: z.literal('moveScale'), num: z.number().min(0), den: z.number().min(1), durationRounds: formulaSchema.optional() }), { op: { label: "opération"  }, num: { label: "numérateur" }, den: { label: "dénominateur" }, durationRounds: { label: 'durée en Rounds', texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
  maxWeaponHands: nommerChamps(z.strictObject({ op: z.literal('maxWeaponHands'), hands: z.number().min(1), durationRounds: formulaSchema.optional() }), { op: { label: "opération"  }, hands: { label: "mains" }, durationRounds: { label: 'durée en Rounds', texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
  moveMod: nommerChamps(z.strictObject({ op: z.literal('moveMod'), mod: z.number() }), { op: { label: "opération"  }, mod: { label: "Mouvement (±)" } }),
  grantNaturalWeapon: nommerChamps(z.strictObject({
    op: z.literal('grantNaturalWeapon'),
    label: z.string(),
    damage: formulaSchema,
    plusBF: z.boolean().optional(),
    bare: z.boolean().optional(),
    qualities: refs('quality').optional(),
    attackKind: attackKindSchema.optional(),
    subType: ref('weaponGroup').optional(),
  }), { op: { label: "opération"  }, label: { label: "libellé" , texte: { regime: "designation"} }, damage: { label: "dégâts" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, plusBF: { label: "ajouter le Bonus de Force" }, bare: { label: "à mains nues" }, qualities: { label: "qualités" , texte: { regime: "technique"} }, attackKind: { label: "type d’attaque" }, subType: { label: "sous-type" , texte: { regime: "technique"} } }),
  light: nommerChamps(z.strictObject({ op: z.literal('light'), radiusM: z.number().min(1), tone: ref('lightTone').optional() }), { op: { label: "opération"  }, radiusM: { label: "rayon (m)" }, tone: { label: "ton" , texte: { regime: "technique"} } }),
  lifeSteal: nommerChamps(z.strictObject({ op: z.literal('lifeSteal'), num: z.number().min(1), den: z.number().min(1), round: arrondiSchema.optional() }), { op: { label: "opération"  }, num: { label: "numérateur" }, den: { label: "dénominateur" }, round: { label: "arrondi" } }),
  push: nommerChamps(z.strictObject({ op: z.literal('push'), meters: formulaSchema }), { op: { label: "opération"  }, meters: { label: "distance (m)" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
  chain: nommerChamps(z.strictObject({ op: z.literal('chain'), maxBounces: formulaSchema, hopMeters: formulaSchema }), { op: { label: "opération"  }, maxBounces: { label: "rebonds max" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, hopMeters: { label: "saut (m)" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
  teleport: nommerChamps(z.strictObject({
    op: z.literal('teleport'),
    meters: formulaSchema,
    perSL: nommerChamps(z.strictObject({ every: z.number().min(1), metersFormula: formulaSchema }), { every: { label: "intervalle" }, metersFormula: { label: "bonus (m)" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }).optional(),
  }), { op: { label: "opération"  }, meters: { label: "distance (m)" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, perSL: { label: "par DR" } }),
  armourPierce: nommerChamps(z.strictObject({ op: z.literal('armourPierce'), amount: z.number().min(0), bypass: armourBypassSchema.optional() }), { op: { label: "opération"  }, amount: { label: "PA retirés" }, bypass: { label: "armure ignorée" } }),
  condition: nommerChamps(z.strictObject({
    op: z.literal('condition'),
    id: refDEtatSchema,
    value: formulaSchema.optional(),
    valuePerSL: perSLSchema.optional(),
    perRound: z.boolean().optional(),
    durationRounds: formulaSchema.optional(),
    durationMinutes: formulaSchema.optional(),
    durationHours: formulaSchema.optional(),
    onlyGroups: refs('groupe', { sousListe: CIBLE_D_APPARTENANCE }).optional(),
    onlyIfCondition: refDEtatSchema.optional(),
    unlessCondition: refDEtatSchema.optional(),
    escapeStrength: formulaSchema.optional(),
    escapeThreshold: formulaSchema.optional(),
    entangleOnFail: z.boolean().optional(),
    struggleDamage: formulaSchema.optional(),
    difficulte: difficultySchema.optional(),
    argDifficulty: z.boolean().optional(),
    lockedUntil: z.lazy(() => conditionSchema).optional(),
    resolveWindow: fenetreDeDeterminationSchema.optional(),
    unlockBy: acteDeDeverrouillageSchema.optional(),
    grapple: z.boolean().optional(),
    carried: z.literal(true).optional(),
  }).superRefine(refusDeLaPoseDEtat), { op: { label: "opération"  }, id: { label: "État" }, value: { label: "pions" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, valuePerSL: { label: "pions par DR" }, perRound: { label: "chaque Round" }, durationRounds: { label: 'durée en Rounds', texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, durationMinutes: { label: 'durée en minutes', texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, durationHours: { label: 'durée en heures', texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, onlyGroups: { label: "groupes autorisés" , texte: { regime: "technique"} }, onlyIfCondition: { label: "si la cible porte" }, unlessCondition: { label: "sauf si la cible porte" }, escapeStrength: { label: "Force d’évasion" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, escapeThreshold: { label: "DR d’évasion" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, entangleOnFail: { label: "aggravé sur échec" }, struggleDamage: { label: "dégâts de lutte" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, difficulte: { label: "difficulté d’élimination" }, argDifficulty: { label: "difficulté de l’argument" }, lockedUntil: { label: "verrouillé tant que" }, resolveWindow: { label: "fenêtre de Détermination" }, unlockBy: { label: "retiré seulement par" }, grapple: { label: "Empoignade" }, carried: { label: "porté par l’effet" } }),
  removeCondition: nommerChamps(z.strictObject({
    op: z.literal('removeCondition'),
    id: refDEtatSchema.optional(),
    value: formulaSchema.optional(),
    valuePerSL: perSLSchema.optional(),
    all: z.boolean().optional(),
  }), { op: { label: "opération"  }, id: { label: "État" }, value: { label: "pions" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, valuePerSL: { label: "pions par DR" }, all: { label: "tous les pions" } }),
  rollMutation: nommerChamps(z.strictObject({ op: z.literal('rollMutation'), table: ref('mutationTable'), duration: z.literal('permanent').optional() }), { op: { label: "opération"  }, table: { label: "table de Corruption" , texte: { regime: "technique"} }, duration: { label: "permanente" } }),
  /** `money` — mouvement de la bourse PERSONNELLE de la cible. La charge porte son NOM (`montant`),
   *  comme toute autre action du vocabulaire (`giveMoney.montant`, `giveXp.amount`) : elle n'est jamais
   *  étalée parmi les clés de l'op (garde `src/data/monnaie-forme-unique.test.ts`, sonde A). La seule
   *  dénomination chiffrable est `brass`, l'unité de compte de `engine/money.ts`. */
  money: nommerChamps(z.strictObject({ op: z.literal('money'), montant: nommerChamps(z.strictObject({ brass: formulaSchema }), { brass: { label: "sous de cuivre" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }), groupe: z.literal(true).optional() }), { op: { label: "opération"  }, montant: { label: "montant" }, groupe: { label: "bourse du groupe" } }),
  /** Ops de NAVIRE (`OPS_DU_NAVIRE`, `engine/ops.ts`) : résolues sur la cible `navire` d'un EffectOp. */
  shipMorale: nommerChamps(z.strictObject({ op: z.literal('shipMorale'), delta: effetSigneSchema }), { op: { label: "opération"  }, delta: { label: "variation" } }),
  /** Variation LIBRE (`delta`) OU facteur du tableau (`factorId`, MDG 15 l.97-124), exclusifs. */
  manann: z.union([
    nommerChamps(z.strictObject({ op: z.literal('manann'), delta: effetSigneSchema }), { op: { label: "opération"  }, delta: { label: "variation" } }),
    nommerChamps(z.strictObject({ op: z.literal('manann'), factorId: z.string().min(1) }), { op: { label: "opération"  }, factorId: { label: "facteur" , texte: { regime: "technique"} } }),
  ], {
    error: (iss) => {
      const v = (iss.input ?? {}) as { delta?: unknown; factorId?: unknown };
      return (v.delta === undefined) === (v.factorId === undefined)
        ? 'Humeur EXCLUSIVE : « delta » (variation tirée) OU « factorId » (facteur du tableau) — exactement un des deux.'
        : undefined;
    },
  }),
  /** `shipCritical` — MDG 15 l.153 ; `equipageEpargne` : MDG 15 l.49-51 */
  shipCritical: nommerChamps(z.strictObject({ op: z.literal('shipCritical'), location: z.union([shipLocationSchema, z.literal('aleatoire')]), count: formulaSchema, equipageEpargne: z.literal(true).optional() }), { op: { label: "opération"  }, location: { label: "localisation" }, count: { label: "nombre" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, equipageEpargne: { label: "équipage épargné" } }),
  /** `navireMod` — MDG 15 l.184-185, l.187-188, l.228, l.229 */
  navireMod: nommerChamps(z.strictObject({
    op: z.literal('navireMod'),
    m: z.number().int().optional(),
    manDR: z.number().int().optional(),
    evite: z.array(idDe('seaHazard')).min(1).optional(),
    jusqua: z.union([variante('Échéance de bord', enumNomme({ carenage: 'jusqu’au carénage', evenementDeBord: 'jusqu’au prochain événement de bord' })), nommerChamps(z.strictObject({ jours: formulaSchema }), { jours: { label: "jours" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } })]),
  }).refine((v) => v.m !== undefined || v.manDR !== undefined || v.evite !== undefined, { message: 'navireMod VIDE : nommer « m » (Mouvement), « manDR » (DR de Manœuvre) ou « evite » (périls évités).' }).refine((v) => !(v.evite && v.jusqua === 'evenementDeBord'), { message: 'navireMod : « evite » jusqu’au prochain événement de bord ne voit aucun péril, levé avant la conséquence qui le heurte ; borner en « jours » ou au « carenage ».' }), { op: { label: "opération"  }, m: { label: "Mouvement" }, manDR: { label: "DR de Manœuvre" }, evite: { label: "périls évités" , texte: { regime: "technique"} }, jusqua: { label: "jusqu’à" } }),
  /** `meteoImposee` — MDG 15 l.189, l.196-197, l.199, l.219, l.226-227, l.248, l.257 */
  meteoImposee: nommerChamps(z.strictObject({
    op: z.literal('meteoImposee'),
    jours: formulaSchema,
    meteo: meteoImposeeSchema.optional(),
    ventInverse: z.literal(true).optional(),
    aggravation: nommerChamps(z.strictObject({ de: formulaSchema, seuil: z.number().int(), meteo: meteoImposeeSchema }), { de: { label: "dé de chaque matin" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, seuil: { label: "seuil" }, meteo: { label: "météo aggravée" } }).optional(),
  }).refine((v) => v.meteo !== undefined || v.ventInverse !== undefined, { message: 'meteoImposee VIDE : nommer « meteo » (axes imposés) ou « ventInverse ».' }), { op: { label: "opération"  }, jours: { label: "jours" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, meteo: { label: "météo imposée" }, ventInverse: { label: "vent inversé" }, aggravation: { label: "aggravation" } }),
  /** `cargaison` — MDG 15 l.209-210, l.224-225, l.250, l.33-36, l.159-164, l.174-178 */
  cargaison: z.union([
    nommerChamps(z.strictObject({ op: z.literal('cargaison'), enc: formulaSchema }), { op: { label: "opération"  }, enc: { label: "Encombrement" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
    nommerChamps(z.strictObject({ op: z.literal('cargaison'), perteAuDechargement: formulaSchema }), { op: { label: "opération"  }, perteAuDechargement: { label: "perte au déchargement" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
    nommerChamps(z.strictObject({ op: z.literal('cargaison'), perduePct: z.number().int().min(1).max(100) }), { op: { label: "opération"  }, perduePct: { label: "part perdue (%)" } }),
    nommerChamps(z.strictObject({ op: z.literal('cargaison'), perdueEnc: formulaSchema }), { op: { label: "opération"  }, perdueEnc: { label: "Encombrement perdu" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
  ], {
    error: (iss) => {
      const v = (iss.input ?? {}) as { enc?: unknown; perteAuDechargement?: unknown; perduePct?: unknown; perdueEnc?: unknown };
      return [v.enc, v.perteAuDechargement, v.perduePct, v.perdueEnc].filter((x) => x !== undefined).length !== 1
        ? 'Cargaison EXCLUSIVE : « enc » (cargaison trouvée), « perteAuDechargement » (Enc perdus au prochain déchargement), « perduePct » (part de la cale perdue) OU « perdueEnc » (Enc de la cale perdus) — exactement un des quatre.'
        : undefined;
    },
  }),
  /** `equipage` : variation de l'effectif (`delta`) OU part des PNJ perdus (`perdusPct`), exclusifs.
   *  MDG 15 l.202-204, l.213-218, l.258, l.33-35 */
  equipage: z.union([
    nommerChamps(z.strictObject({
      op: z.literal('equipage'),
      delta: formulaSchema,
      role: ref('crewRole').optional(),
      sansSolde: z.literal('jusquAuPort').optional(),
    }), { op: { label: "opération"  }, delta: { label: "variation" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, role: { label: "rôle" , texte: { regime: "technique",usage: "référence mécanique résolue au catalogue"} }, sansSolde: { label: "sans solde" } }),
    nommerChamps(z.strictObject({ op: z.literal('equipage'), perdusPct: z.number().int().min(1).max(100) }), { op: { label: "opération"  }, perdusPct: { label: "part perdue (%)" } }),
  ], {
    error: (iss) => {
      const v = (iss.input ?? {}) as { delta?: unknown; perdusPct?: unknown };
      return (v.delta === undefined) === (v.perdusPct === undefined)
        ? 'Équipage EXCLUSIF : « delta » (variation de l’effectif) OU « perdusPct » (part des PNJ perdus) — exactement un des deux.'
        : undefined;
    },
  }),
  /** `perilDeMer` : le navire heurte un péril (`collision`) OU entre dans un tourbillon (`tourbillon`), exclusifs.
   *  MDG 15 l.140-141, l.146, l.181-183 */
  perilDeMer: z.union([
    nommerChamps(z.strictObject({ op: z.literal('perilDeMer'), collision: ref('seaHazard') }), { op: { label: "opération"  }, collision: { label: "péril heurté" , texte: { regime: "technique"} } }),
    nommerChamps(z.strictObject({ op: z.literal('perilDeMer'), tourbillon: ref('tourbillon') }), { op: { label: "opération"  }, tourbillon: { label: "tourbillon" , texte: { regime: "technique"} } }),
  ], {
    error: (iss) => {
      const v = (iss.input ?? {}) as { collision?: unknown; tourbillon?: unknown };
      return (v.collision === undefined) === (v.tourbillon === undefined)
        ? 'Péril EXCLUSIF : « collision » (péril heurté) OU « tourbillon » — exactement un des deux.'
        : undefined;
    },
  }),
  /** `navireHostile` — MDG 15 l.150-151, l.171-173 */
  navireHostile: nommerChamps(z.strictObject({
    op: z.literal('navireHostile'),
    navire: ref('vehicle'),
    equipage: ref('creature', { nombre: nommerNoeud(z.number().int().min(1), { nom: 'effectif' }) }),
    chef: ref('creature').optional(),
    grandsCanons: z.number().int().min(1).optional(),
    exigence: z.literal('fouille').optional(),
  }), { op: { label: "opération"  }, navire: { label: "navire" , texte: { regime: "technique"} }, equipage: { label: "équipage" }, chef: { label: "chef" , texte: { regime: "technique"} }, grandsCanons: { label: "grands canons" }, exigence: { label: "exigence" } }),
  /** `infestation` — MDG 15 l.159-164, l.174-178 ; MDG 14 l.98-104 */
  infestation: nommerChamps(z.strictObject({
    op: z.literal('infestation'),
    crewTestType: ref('crewTestType'),
    difficulty: difficultySchema,
    ...cibleEtendueSchema.shape,
    chaqueNuit: z.lazy(() => flowSchema),
    /** MDG 15 l.161, l.176 */
    surDRNegatif: z.lazy(() => flowSchema).optional(),
  }), { op: { label: "opération"  }, crewTestType: { label: "Test d’équipage" , texte: { regime: "technique"} }, difficulty: { label: "difficulté" }, ...metaDesChamps(cibleEtendueSchema, { exigees: true }), chaqueNuit: { label: "chaque nuit" }, surDRNegatif: { label: "sur une étape à DR négatif" } }),
  /** `combatEnMer` — MDG 15 l.136-139, l.142-143, l.165-168 */
  combatEnMer: nommerChamps(z.strictObject({
    op: z.literal('combatEnMer'),
    adversaire: ref('creature', {
      nombre: nommerNoeud(z.number().int().min(1), { nom: 'effectif' }),
      optionals: nommerNoeud(z.array(traitInstanceSchema).min(1).optional(), { nom: 'Traits facultatifs' }),
    }),
    repousseAPct: z.number().int().min(1).max(99).optional(),
    victoire: z.lazy(() => flowSchema).optional(),
  }), { op: { label: "opération"  }, adversaire: { label: "adversaire" }, repousseAPct: { label: "repoussé à (% des Blessures)" }, victoire: { label: "sur la victoire" } }),
  /** `attaquesSubies` — MDG 15 l.163-164, l.177-178 */
  attaquesSubies: nommerChamps(z.strictObject({
    op: z.literal('attaquesSubies'),
    assaillant: nommerChamps(z.strictObject({ statblock: customStatblockSchema }), { statblock: { label: "profil personnalisé" } }),
    nombre: tirageSchema,
  }), { op: { label: "opération"  }, assaillant: { label: "assaillant" }, nombre: { label: "nombre d’attaques" , texte: { regime: "technique"} } }),
  /** `commission` — MDG 15 l.261 */
  commission: nommerChamps(z.strictObject({
    op: z.literal('commission'),
    montant: nommerChamps(z.strictObject({ brass: formulaSchema }), { brass: { label: "sous de cuivre" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
  }), { op: { label: "opération"  }, montant: { label: "montant à la livraison" } }),
  /** `constructeurDEscale` — MDG 15 l.255 */
  constructeurDEscale: nommerChamps(z.strictObject({
    op: z.literal('constructeurDEscale'),
    competence: z.number().int().min(1),
    duree: formulaSchema,
  }), { op: { label: "opération"  }, competence: { label: "Métier (Constructeur de navires)" }, duree: { label: "durée de chaque réparation ou Amélioration (jours)" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
  /** `rationsDEscale` — MDG 15 l.262 */
  rationsDEscale: nommerChamps(z.strictObject({
    op: z.literal('rationsDEscale'),
    montant: nommerChamps(z.strictObject({ brass: formulaSchema }), { brass: { label: "sous de cuivre" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
  }), { op: { label: "opération"  }, montant: { label: "prix d’une ration-jour de vivres frais" } }),
  /** `marcheDuPort` : bascule des colonnes (`colonnes`), lot offert (`offre`) OU Demande accrue ailleurs (`demande`,
   *  `jours`), exclusifs. MDG 15 l.253, l.256, l.259, l.263 */
  marcheDuPort: z.union([
    nommerChamps(z.strictObject({ op: z.literal('marcheDuPort'), colonnes: enumNomme({ penurie: 'Pénurie', saturation: 'Saturation de produits' }) }), { op: { label: "opération"  }, colonnes: { label: "colonnes de l’Index" } }),
    nommerChamps(z.strictObject({
      op: z.literal('marcheDuPort'),
      offre: nommerChamps(z.strictObject({ enc: formulaSchema, remisePct: z.number().int().min(1).max(99) }), { enc: { label: "Encombrement offert" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, remisePct: { label: "remise (%)" } }),
    }), { op: { label: "opération"  }, offre: { label: "offre" } }),
    nommerChamps(z.strictObject({ op: z.literal('marcheDuPort'), demande: z.number().int(), jours: formulaSchema }), { op: { label: "opération"  }, demande: { label: "Demande" }, jours: { label: "jours" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
  ], {
    error: (iss) => {
      const v = (iss.input ?? {}) as { colonnes?: unknown; offre?: unknown; demande?: unknown };
      return [v.colonnes, v.offre, v.demande].filter((x) => x !== undefined).length !== 1
        ? 'Marché EXCLUSIF : « colonnes » (bascule de l’Index), « offre » (lot offert à l’achat) OU « demande » (Demande accrue dans un autre port, avec « jours ») — exactement un des trois.'
        : undefined;
    },
  }),
  /** `provisions` : jours de vivres gagnés (`jours`), part gâtée (`gateesPct`), rations (`rations`) OU tonneaux
   *  d'eau (`eauTonneaux`), exclusifs ; `jours` et `rations` nomment leur vivre de la cale (`vivre`).
   *  MDG 15 l.169-170, l.235-236, l.194 ; MDG 14 l.242, l.245-252 */
  provisions: z.union([
    nommerChamps(z.strictObject({ op: z.literal('provisions'), jours: formulaSchema, vivre: ref('trapping') }).superRefine((o, ctx) => refuserLeVivreHorsCale(o.vivre.id, ['vivre'], ctx)), { op: { label: "opération"  }, jours: { label: "jours de vivres" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, vivre: { label: "vivre de la cale", texte: { regime: "technique", usage: "référence mécanique résolue au catalogue" } } }),
    nommerChamps(z.strictObject({ op: z.literal('provisions'), gateesPct: z.number().int().min(1).max(100) }), { op: { label: "opération"  }, gateesPct: { label: "part gâtée (%)" } }),
    nommerChamps(z.strictObject({ op: z.literal('provisions'), rations: formulaSchema, vivre: ref('trapping') }).superRefine((o, ctx) => refuserLeVivreHorsCale(o.vivre.id, ['vivre'], ctx)), { op: { label: "opération"  }, rations: { label: "rations" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, vivre: { label: "vivre de la cale", texte: { regime: "technique", usage: "référence mécanique résolue au catalogue" } } }),
    nommerChamps(z.strictObject({ op: z.literal('provisions'), eauTonneaux: formulaSchema }), { op: { label: "opération"  }, eauTonneaux: { label: "tonneaux d’eau" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
  ], {
    error: (iss) => {
      const v = (iss.input ?? {}) as { jours?: unknown; gateesPct?: unknown; rations?: unknown; eauTonneaux?: unknown; vivre?: unknown };
      if ([v.jours, v.gateesPct, v.rations, v.eauTonneaux].filter((x) => x !== undefined).length !== 1) {
        return 'Provisions EXCLUSIVES : « jours » (vivres gagnés), « gateesPct » (part gâtée), « rations » (rations d’un vivre) OU « eauTonneaux » (tonneaux d’eau) — exactement un des quatre.';
      }
      return (v.jours !== undefined || v.rations !== undefined) && v.vivre === undefined
        ? 'Provisions : « jours » et « rations » nomment leur « vivre » (un vivre de la cale, sea-navigation.json longsVoyages.vivresDeCale).'
        : undefined;
    },
  }),
  healCaster: nommerChamps(z.strictObject({ op: z.literal('healCaster'), amount: formulaSchema }), { op: { label: "opération"  }, amount: { label: "quantité" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
  gainAdvantage: nommerChamps(z.strictObject({ op: z.literal('gainAdvantage'), amount: formulaSchema }), { op: { label: "opération"  }, amount: { label: "quantité" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
  topUpAdvantage: nommerChamps(z.strictObject({ op: z.literal('topUpAdvantage'), amount: ouReserve(formulaSchema, INDICE_TEMPLATE), feedOpposingPool: z.boolean().optional() }), { op: { label: "opération"  }, amount: { label: "quantité" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, feedOpposingPool: { label: "réserve adverse" } }),
  spendAdvantage: nommerChamps(z.strictObject({ op: z.literal('spendAdvantage'), amount: z.number().optional() }), { op: { label: "opération"  }, amount: { label: "quantité" } }),
  kill: nommerChamps(z.strictObject({ op: z.literal('kill') }), { op: { label: "opération"  } }),
  /** LDB 09 l.260 */
  preventInfection: nommerChamps(z.strictObject({ op: z.literal('preventInfection') }), { op: { label: "opération"  } }),
  /** LDB 18 l.311 */
  aideMedicale: nommerChamps(z.strictObject({ op: z.literal('aideMedicale') }), { op: { label: "opération"  } }),
  /** LDB 85 l.325, l.447 */
  damageWornGear: nommerChamps(z.strictObject({ op: z.literal('damageWornGear') }), { op: { label: "opération"  } }),
  loseTurn: nommerChamps(z.strictObject({ op: z.literal('loseTurn'), what: loseTurnWhatSchema.optional() }), { op: { label: "opération"  }, what: { label: "objet"  } }),
  noBreath: nommerChamps(z.strictObject({ op: z.literal('noBreath') }), { op: { label: "opération"  } }),
  noHunger: nommerChamps(z.strictObject({ op: z.literal('noHunger') }), { op: { label: "opération"  } }),
  /** `grantTrait` — le Trait OCTROYÉ est un Trait posé (`traitInstanceSchema`), son Indice lu sur le lanceur
   *  (LDB 47 l.441). Sa Cible est
   *  posée (`trait.arg`) ou TIRÉE (`cible`, `pick` tirages sur une table de Cibles) : EDOC 12 l.217, l.241.
   *  `indicePerSL` s'ajoute à l'Indice au DR du jet : LDB 47 l.420. */
  grantTrait: nommerChamps(z.strictObject({
    op: z.literal('grantTrait'),
    trait: traitInstanceSchema,
    cible: tirageDeCibleSchema.optional(),
    indicePerSL: perSLSchema.optional(),
    onlyGroups: refs('groupe', { sousListe: CIBLE_D_APPARTENANCE }).optional(),
    durationRounds: formulaSchema.optional(),
    durationMinutes: formulaSchema.optional(),
    durationHours: formulaSchema.optional(),
  }).superRefine((o, ctx) => {
    if (!o.cible) return;
    const { id, arg } = o.trait;
    if (arg !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['cible'], message: `Trait « ${id} » : sa Cible est posée (« trait.arg ») ou tirée (« cible »), jamais les deux.` });
    }
    const absents = GROUPES_TIRABLES[o.cible.table.id]().filter((g) => !specAuCatalogue('trait', id, g));
    if (absents.length) {
      ctx.addIssue({ code: 'custom', path: ['cible'], message: `Trait « ${id} » : la table de Cibles « ${o.cible.table.id} » tire un Groupe absent du catalogue de spécialisations de ce Trait (« ${absents[0]} »…).` });
    }
  }), { op: { label: "opération" }, trait: { label: "Trait" }, cible: { label: "Cible tirée" }, indicePerSL: { label: "Indice par DR" }, onlyGroups: { label: "groupes autorisés" , texte: { regime: "technique"} }, durationRounds: { label: "durée en Rounds" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, durationMinutes: { label: "durée en minutes" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, durationHours: { label: "durée en heures" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
  /** Pose d'AUTEUR d'un état psychologique : jamais une entrée qui en devient une autre (`becomes`). LDB 21 l.56 */
  beginPsych: nommerChamps(z.strictObject({
    op: z.literal('beginPsych'),
    type: ref('psychology', undefined, { horsMarqueurs: ['becomes'] }),
    cible: ref('groupe').optional(),
    indice: formulaSchema.optional(),
    active: z.boolean().optional(),
  }).superRefine((o, ctx) => refuserLaCibleHorsCiblage(o.type.id, o.cible, ctx)), { op: { label: "opération" }, type: { label: "état psychologique", texte: { regime: "technique", usage: "référence mécanique résolue au catalogue" } }, cible: { label: "Cible", texte: { regime: "technique", usage: "référence mécanique résolue au catalogue" } }, indice: { label: "Indice", texte: { regime: "technique", usage: "formule mécanique résolue par la grammaire" } }, active: { label: "subi" } }),
  /** Fin des états d'un TYPE, ou de l'INSTANCE dont l'effet porte l'op (`instance`, réservé à la famille de
   *  `defs/psychology.ts` : ailleurs aucune instance ne voyage dans le contexte). */
  endPsych: declarerPayload({
    op: z.literal('endPsych'),
    type: ref('psychology').optional(),
    instance: reserve(z.literal('courante').optional()),
  }, { op: { label: "opération" }, type: { label: "état psychologique", texte: { regime: "technique", usage: "référence mécanique résolue au catalogue" } }, instance: { label: "l’instance en cours" } }, (o, ctx) => {
    if ((o.type === undefined) === (o.instance === undefined)) ctx.addIssue({ code: 'custom', message: 'fin d’état psychologique : « type » (un état du catalogue) OU « instance » (celle de l’effet qui porte l’op), exactement l’un des deux.' });
  }),
  /** `envers`, `resistanceSiAmis` et `durationHours` sont réservés à la famille des sorts (`defs/spells.ts`) :
   *  une mutation ou une maladie, qui pose son Trait sans `applyOps`, les refuse au parse. VDM 10 l.327-330 */
  grantPsychTrait: declarerPayload({
    op: z.literal('grantPsychTrait'),
    psychType: ref('psychology'),
    cible: ref('groupe').optional(),
    envers: reserve(z.literal('personneChoisie').optional()),
    resistanceSiAmis: reserve(z.lazy(() => flowTestSchema).optional()),
    durationHours: reserve(formulaSchema.optional()),
  }, { op: { label: "opération" }, psychType: { label: "Trait psychologique", texte: { regime: "technique", usage: "référence mécanique résolue au catalogue" } }, cible: { label: "Cible", texte: { regime: "technique", usage: "référence mécanique résolue au catalogue" } }, envers: { label: "envers une personne choisie" }, resistanceSiAmis: { label: "résistance si amis" }, durationHours: { label: "durée en heures", texte: { regime: "technique", usage: "formule mécanique résolue par la grammaire" } } }, (o, ctx) => {
    const type = (o.psychType as { id: string }).id;
    refuserLaCibleHorsCiblage(type, o.cible, ctx);
    if (o.envers !== undefined && o.cible !== undefined) ctx.addIssue({ code: 'custom', path: ['envers'], message: '« envers » et « cible » sont exclusifs : la Cible est un Groupe posé, ou la personne que choisit le décideur.' });
    if (o.envers !== undefined && !varianteAdmise(type, 'individu')) ctx.addIssue({ code: 'custom', path: ['envers'], message: `« ${type} » ne vise pas un individu : voir ses « cibles » (psychology.json).` });
    if (o.resistanceSiAmis !== undefined && o.envers === undefined) ctx.addIssue({ code: 'custom', path: ['resistanceSiAmis'], message: '« resistanceSiAmis » suit la personne choisie : « envers » est requis.' });
  }),
  removePsychTrait: nommerChamps(z.strictObject({ op: z.literal('removePsychTrait'), psychType: ref('psychology').optional(), cible: ref('groupe').optional() }).superRefine((o, ctx) => {
    if (o.cible !== undefined && !o.psychType) ctx.addIssue({ code: 'custom', path: ['cible'], message: '« cible » vise une instance d’un Trait : « psychType » est requis.' });
    else if (o.psychType) refuserLaCibleHorsCiblage(o.psychType.id, o.cible, ctx);
  }), { op: { label: "opération" }, psychType: { label: "Trait psychologique", texte: { regime: "technique", usage: "référence mécanique résolue au catalogue" } }, cible: { label: "Cible", texte: { regime: "technique", usage: "référence mécanique résolue au catalogue" } } }),
  removeTrait: nommerChamps(z.strictObject({ op: z.literal('removeTrait'), trait: ref('trait') }), { op: { label: "opération"  }, trait: { label: "Trait" , texte: { regime: "technique",usage: "référence mécanique résolue au catalogue"} } }),
  /** `domeWard` — le dôme OCTROIE un Trait à ceux qu'il couvre (`LDB 47 l.410`) : le Trait octroyé
   *  (`traitInstanceSchema`). AUCUNE zone : elle est déjà écrite par la ligne « Cible » du sort (ZdE,
   *  `LDB 47 l.28`) — l'op la LIT. */
  domeWard: nommerChamps(z.strictObject({ op: z.literal('domeWard'), trait: traitInstanceSchema }).superRefine((o, ctx) => {
    if (o.trait.value === undefined) ctx.addIssue({ code: 'custom', path: ['trait', 'value'], message: `Dôme : le Trait octroyé « ${o.trait.id} » porte son Indice (LDB 47 l.410).` });
  }), { op: { label: "opération"  }, trait: { label: "Trait" } }),
  suffocate: nommerChamps(z.strictObject({ op: z.literal('suffocate') }), { op: { label: "opération"  } }),
  /** `offTerrainMod` — passif POSITIONNEL : hors de son terrain d'ÉLECTION, le porteur subit un M
   *  IMPOSÉ (`mSet`, Créature marine MDG 16 l.17 « son M tombe à 1 » ; Aquatique MSRC 15 l.139 → 0),
   *  un malus de DR à TOUS ses Tests (`testDR`) et/ou la suffocation (`suffocates`). Le terrain se
   *  désigne par `ref('terrain')` : un terrain inconnu est refusé AU PARSE. */
  offTerrainMod: nommerChamps(z.strictObject({
    op: z.literal('offTerrainMod'),
    terrain: ref('terrain'),
    mSet: z.number().optional(),
    testDR: z.number().optional(),
    suffocates: z.boolean().optional(),
  }), { op: { label: "opération"  }, terrain: { label: "terrain" , texte: { regime: "technique"} }, mSet: { label: "Mouvement imposé" }, testDR: { label: "DR de Test" }, suffocates: { label: "asphyxie" } }),
  skillMod: nommerChamps(z.strictObject({ op: z.literal('skillMod'), skill: refOuSpec('skill'), mod: z.number(), sense: senseSchema.optional() }), { op: { label: "opération"  }, skill: { label: "Compétence" }, mod: { label: "modificateur" }, sense: { label: "sens"  } }),
  /** Durée EXCLUSIVE, en heures OU en jours (`engine/ops.ts`, union `deitySkillMod`). */
  deitySkillMod: z.union([
    nommerChamps(z.strictObject({ op: z.literal('deitySkillMod'), pick: deitySkillPickSchema, mod: z.number(), durationHours: formulaSchema }), { op: { label: "opération" }, pick: { label: "Compétences frappées" }, mod: { label: "modificateur" }, durationHours: { label: 'durée en heures', texte: { regime: "technique", usage: "formule mécanique résolue par la grammaire" } } }),
    nommerChamps(z.strictObject({ op: z.literal('deitySkillMod'), pick: deitySkillPickSchema, mod: z.number(), durationDays: formulaSchema }), { op: { label: "opération" }, pick: { label: "Compétences frappées" }, mod: { label: "modificateur" }, durationDays: { label: 'durée en jours', texte: { regime: "technique", usage: "formule mécanique résolue par la grammaire" } } }),
  ], { error: () => MESSAGE_DUREE_DE_DIVINITE }),
  /** Cible EXCLUSIVE, `skill` OU `testType` (`engine/ops.ts`, union `skillDRBonus`). */
  skillDRBonus: z.union([
    nommerChamps(z.strictObject({ op: z.literal('skillDRBonus'), skill: refOuSpec('skill'), bonus: formuleSansTirageSchema }), { op: { label: "opération"  }, skill: { label: "Compétence" }, bonus: { label: "bonus" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
    nommerChamps(z.strictObject({ op: z.literal('skillDRBonus'), testType: ref('crewTestType'), bonus: formuleSansTirageSchema }), { op: { label: "opération"  }, testType: { label: "type de Test" , texte: { regime: "technique"} }, bonus: { label: "bonus" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
  ], {
    error: (iss) => {
      const v = (iss.input ?? {}) as { skill?: unknown; testType?: unknown; bonus?: unknown };
      return (v.skill === undefined) === (v.testType === undefined)
        ? 'cible EXCLUSIVE : « skill » (Compétence) OU « testType » (type de Test d’équipage, crew-test-types.json) — exactement une des deux.'
        : messageDeTermeDeJet(v.bonus);
    },
  }),
  charDRBonus: nommerChamps(z.strictObject({ op: z.literal('charDRBonus'), characteristic: charKeySchema, bonus: formuleSansTirageSchema }), { op: { label: "opération"  }, characteristic: { label: "caractéristique" }, bonus: { label: "bonus" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
  charDamage: nommerChamps(z.strictObject({ op: z.literal('charDamage'), characteristic: charKeySchema, amount: formulaSchema }), { op: { label: "opération"  }, characteristic: { label: "caractéristique" }, amount: { label: "quantité" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
  testDAgir: nommerChamps(z.strictObject({ op: z.literal('testDAgir'), characteristic: charKeySchema }), { op: { label: "opération"  }, characteristic: { label: "caractéristique" } }),
  incomingSpellDRMod: nommerChamps(z.strictObject({ op: z.literal('incomingSpellDRMod'), amount: formuleSansTirageSchema }), { op: { label: "opération"  }, amount: { label: "quantité" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }),
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
  suppressTalents: nommerChamps(z.strictObject({ op: z.literal('suppressTalents'), talents: z.array(ref('talent')).min(1), durationDays: formulaSchema }), { op: { label: "opération" }, talents: { label: "Talents suspendus", texte: { regime: "technique", usage: "référence mécanique résolue au catalogue" } }, durationDays: { label: 'durée en jours', texte: { regime: "technique", usage: "formule mécanique résolue par la grammaire" } } }),
  deityBan: nommerChamps(z.strictObject({ op: z.literal('deityBan'), durationDays: formulaSchema }), { op: { label: "opération" }, durationDays: { label: 'durée en jours', texte: { regime: "technique", usage: "formule mécanique résolue par la grammaire" } } }),
  prayerForAction: nommerChamps(z.strictObject({ op: z.literal('prayerForAction'), durationRounds: formulaSchema }), { op: { label: "opération" }, durationRounds: { label: 'durée en Rounds', texte: { regime: "technique", usage: "formule mécanique résolue par la grammaire" } } }),
  grantReverseToken: nommerChamps(z.strictObject({ op: z.literal('grantReverseToken'), ...sujetDuJetSchema.shape, contexte: contexteDeTestSchema.optional(), illimite: z.literal(true).optional() }), { op: { label: "opération"  }, skill: { label: "Compétence" }, characteristic: { label: "Caractéristique du Test" }, contexte: { label: "contexte du Test" }, illimite: { label: "jamais consommé" } }),
  exposeDisease: nommerChamps(z.strictObject({
    op: z.literal('exposeDisease'),
    disease: ouReserve(idDe('maladie'), ARG_TEMPLATE),
    difficultyShift: z.number().optional(),
    incubation: z.literal('instant').optional(),
  }), { op: { label: "opération"  }, disease: { label: "maladie" , texte: { regime: "technique"} }, difficultyShift: { label: "décalage de difficulté" }, incubation: { label: "incubation"  } }),
  contractDisease: nommerChamps(z.strictObject({ op: z.literal('contractDisease'), disease: idDe('maladie') }), { op: { label: "opération"  }, disease: { label: "maladie" , texte: { regime: "technique"} } }),
  reduceDiseaseDays: nommerChamps(z.strictObject({
    op: z.literal('reduceDiseaseDays'),
    days: z.number().nonnegative().optional(),
    dice: diceSpecSchema.optional(),
    disease: idDe('maladie').optional(),
    oncePerDisease: z.boolean().optional(),
    daysPerSL: perSLSchema.optional(),
  }), { op: { label: "opération"  }, days: { label: "jours" }, dice: { label: "dés" }, disease: { label: "maladie" , texte: { regime: "technique"} }, oncePerDisease: { label: "une fois par maladie" }, daysPerSL: { label: "jours par DR" } }),
  diseaseTestMod: nommerChamps(z.strictObject({ op: z.literal('diseaseTestMod'), diseases: refs('maladie').optional(), amount: z.number() }), { op: { label: "opération"  }, diseases: { label: "maladies" , texte: { regime: "technique"} }, amount: { label: "quantité" } }),
  suppressSymptom: nommerChamps(z.strictObject({ op: z.literal('suppressSymptom'), symptomId: idDe('symptome') }), { op: { label: "opération"  }, symptomId: { label: "symptôme" , texte: { regime: "technique"} } }),
  giveTrapping: nommerChamps(z.strictObject({
    op: z.literal('giveTrapping'),
    apparence: ref('apparence').optional(),
    trappingId: idDe('trapping', INSTANCIABLE_PAR_ID, { ouverte: true }).optional(),
    custom: z.string().optional(),
    count: z.number().optional(),
    perSL: perSLSchema.optional(),
  }).superRefine(validerApparenceDonnee), { op: { label: "opération"  }, apparence: { label: "apparence" }, trappingId: { label: "objet" , texte: { regime: "technique"} }, custom: { label: "profil personnalisé" , texte: { regime: "designation"} }, count: { label: "nombre" }, perSL: { label: "par DR" } }),
  /** `summon` — la créature invoquée se nomme par un id du bestiaire (`idDe('creature')`) : une op
   *  sans créature est refusée AU PARSE (#1882), jamais spawnée. `addTraits` : instances de Trait
   *  (`grammaire/reference.ts › traitInstanceSchema`), dont l'`id` est une feuille `idDe('trait')`. */
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
    ops: executeesDe(z.lazy(() => gameOpSchema)),
    morphRef: idDe('creature').optional(),
  }), { op: { label: "opération"  }, tag: { label: "marque" , texte: { regime: "technique"} }, ops: { label: "opérations" }, morphRef: { label: "forme transformée" , texte: { regime: "technique"} } }),
  /** Table INLINE (`entries`) OU RÉFÉRENCÉE (`tableId`), exclusives (`engine/ops.ts`, union `rollTable`). */
  rollTable: z.union([
    nommerChamps(z.strictObject({
      op: z.literal('rollTable'),
      die: deDeTirageSchema,
      mod: z.number().optional(),
      addNegativeSL: z.boolean().optional(),
      extraRollsPerStep: z.number().optional(),
      entries: z.array(nommerChamps(z.strictObject({ min: z.number(), max: z.number(), ops: executeesDe(z.lazy(() => gameOpSchema)) }), { min: { label: "minimum" }, max: { label: "maximum" }, ops: { label: "opérations" } })),
    }), { op: { label: "opération"  }, die: { label: "dé de tirage" , texte: { regime: "technique"} }, mod: { label: "modificateur" }, addNegativeSL: { label: "ajouter les DR négatifs" }, extraRollsPerStep: { label: "jets supplémentaires par cran" }, entries: { label: "rangées" } }),
    nommerChamps(z.strictObject({
      op: z.literal('rollTable'),
      mod: z.number().optional(),
      addNegativeSL: z.boolean().optional(),
      extraRollsPerStep: z.number().optional(),
      tableId: idDe('table'),
    }), { op: { label: "opération"  }, mod: { label: "modificateur" }, addNegativeSL: { label: "ajouter les DR négatifs" }, extraRollsPerStep: { label: "jets supplémentaires par cran" }, tableId: { label: "table" , texte: { regime: "technique"} } }),
  ], {
    error: (iss) => {
      const v = (iss.input ?? {}) as { entries?: unknown; tableId?: unknown };
      return (v.entries === undefined) === (v.tableId === undefined)
        ? 'table EXCLUSIVE : « entries » (rangées inline) OU « tableId » (tables.json) — exactement une des deux.'
        : undefined;
    },
  }),
  testMod: nommerChamps(z.strictObject({
    op: z.literal('testMod'),
    amount: z.number(),
    characteristic: charKeySchema.optional(),
    movementOnly: z.boolean().optional(),
    sense: senseSchema.optional(),
    diseases: refs('maladie').optional(),
    exceptSkills: z.array(ref('skill')).optional(),
    weaponHand: mainSchema.optional(),
  }), { op: { label: "opération"  }, amount: { label: "quantité" }, characteristic: { label: "caractéristique" }, movementOnly: { label: "Mouvement uniquement" }, sense: { label: "sens"  }, diseases: { label: "maladies" , texte: { regime: "technique"} }, exceptSkills: { label: "Compétences exclues" , texte: { regime: "technique",usage: "référence mécanique résolue au catalogue"} }, weaponHand: { label: "main de l’arme"  } }),
  incomingAttackMod: nommerChamps(z.strictObject({
    op: z.literal('incomingAttackMod'),
    mode: porteeDAssautSchema,
    amount: z.number(),
    flankRear: z.boolean().optional(),
  }), { op: { label: "opération" }, mode: { label: "portée de l’assaut" }, amount: { label: "quantité" }, flankRear: { label: "par le flanc ou par derrière" } }),
  castWard: nommerChamps(z.strictObject({
    op: z.literal('castWard'),
    radius: formulaSchema,
    mod: z.number(),
    perSL: nommerChamps(z.strictObject({ every: z.number(), radiusFormula: formulaSchema }), { every: { label: "intervalle" }, radiusFormula: { label: "rayon" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }).optional(),
  }), { op: { label: "opération" }, radius: { label: "rayon" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, mod: { label: "modificateur" }, perSL: { label: "rayon par DR" } }),
  incomingAdvantage: nommerChamps(z.strictObject({
    op: z.literal('incomingAdvantage'),
    mode: porteeDAssautSchema,
    amount: z.number(),
  }), { op: { label: "opération" }, mode: { label: "portée de l’assaut" }, amount: { label: "quantité" } }),
  perRound: nommerChamps(z.strictObject({ op: z.literal('perRound'), ops: executeesDe(z.lazy(() => gameOpSchema)) }), { op: { label: "opération"  }, ops: { label: "opérations" } }),
  delayed: nommerChamps(z.strictObject({
    op: z.literal('delayed'),
    afterMinutes: formulaSchema.optional(),
    afterHours: formulaSchema.optional(),
    afterDays: formulaSchema.optional(),
    afterDuration: z.literal(true).optional(),
    forMinutes: formulaSchema.optional(),
    forHours: formulaSchema.optional(),
    forDays: formulaSchema.optional(),
    ops: executeesDe(z.lazy(() => gameOpSchema)),
  }), { op: { label: "opération"  }, afterMinutes: { label: "délai en minutes" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, afterHours: { label: "délai en heures" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, afterDays: { label: "délai en jours" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, afterDuration: { label: "après la durée" }, forMinutes: { label: "durée en minutes" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, forHours: { label: "durée en heures" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, forDays: { label: "durée en jours" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, ops: { label: "opérations" } }),
  zone: nommerChamps(z.strictObject({
    op: z.literal('zone'),
    shape: zoneShapeSchema,
    radiusMeters: formulaSchema.optional(),
    lengthMeters: formulaSchema.optional(),
    lengthPerSL: nommerChamps(z.strictObject({ every: z.number(), metersFormula: formulaSchema }), { every: { label: "intervalle" }, metersFormula: { label: "distance" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }).optional(),
    blocksLoS: z.boolean().optional(),
    onCross: executeesDe(z.lazy(() => gameOpSchema)).optional(),
    perRound: executeesDe(z.lazy(() => gameOpSchema)).optional(),
    crossTest: z.lazy(() => flowTestSchema).optional(),
    barrier: z.boolean().optional(),
    gate: z.literal('profane').optional(),
    noCorruption: z.boolean().optional(),
  }), { op: { label: "opération"  }, shape: { label: "forme"  }, radiusMeters: { label: "rayon en mètres" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, lengthMeters: { label: "longueur en mètres" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, lengthPerSL: { label: "longueur par DR" }, blocksLoS: { label: "bloquer la vue" }, onCross: { label: "à la traversée" }, perRound: { label: "par Round" }, crossTest: { label: "Test de traversée" }, barrier: { label: "barrière" }, gate: { label: "condition d’accès"  }, noCorruption: { label: "sans Corruption" } }),
  augmentWeapon: nommerChamps(z.strictObject({
    op: z.literal('augmentWeapon'),
    addQualities: refs('quality').optional(),
    damageBonus: formulaSchema.optional(),
    bypass: armourBypassSchema.optional(),
    requiresWeapon: refs('apparence', { sousListe: RACINE_D_APPARENCE }).optional(),
    removeQualities: refs('quality').optional(),
    removeType: z.enum(['atout', 'defaut']).optional(),
    suppressEnchants: z.boolean().optional(),
    passive: passifsDe(z.lazy(() => gameOpSchema)).optional(),
    onHitEffects: z.array(z.lazy(() => triggeredEffectSchema)).optional(),
  }), { op: { label: "opération"  }, addQualities: { label: "qualités ajoutées" , texte: { regime: "technique"} }, damageBonus: { label: "bonus de dégâts" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, bypass: { label: "armure ignorée"  }, requiresWeapon: { label: "formes requises", texte: { regime: "technique" } }, removeQualities: { label: "qualités retirées" , texte: { regime: "technique"} }, removeType: { label: "type retiré"  }, suppressEnchants: { label: "supprimer les enchantements" }, passive: { label: "passifs" }, onHitEffects: { label: "à la touche" } }),
  grantWeapon: nommerChamps(z.strictObject({
    op: z.literal('grantWeapon'),
    label: z.string(),
    damage: formulaSchema,
    damagePlus: z.number().optional(),
    plusBF: z.boolean().optional(),
    qualities: refs('quality').optional(),
    subType: ref('weaponGroup').optional(),
    reach: reachSchema.optional(),
    hands: z.union([z.literal(1), z.literal(2)]).optional(),
    onHitEffects: z.array(z.lazy(() => triggeredEffectSchema)).optional(),
    teinte: ref('material', undefined, 'objet').optional(),
    form: ref('trapping', undefined, INSTANCIABLE_PAR_ID).optional(),
    chooseForm: z.boolean().optional(),
  }), { op: { label: "opération"  }, label: { label: "libellé" , texte: { regime: "designation"} }, damage: { label: "dégâts" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} }, damagePlus: { label: "dégâts supplémentaires" }, plusBF: { label: "ajouter le Bonus de Force" }, qualities: { label: "qualités" , texte: { regime: "technique"} }, subType: { label: "sous-type" , texte: { regime: "technique"} }, reach: { label: "allonge"  }, hands: { label: "mains" }, onHitEffects: { label: "à la touche" }, teinte: { label: "teinte" }, form: { label: "forme" , texte: { regime: "technique"} }, chooseForm: { label: "choisir la forme" } }),
  rollThreshold: nommerChamps(z.strictObject({
    op: z.literal('rollThreshold'),
    sides: z.number(),
    thresholds: z.array(nommerChamps(z.strictObject({ atLeast: z.number(), ops: executeesDe(z.lazy(() => gameOpSchema)) }), { atLeast: { label: "minimum" }, ops: { label: "opérations" } })),
  }), { op: { label: "opération"  }, sides: { label: "faces" }, thresholds: { label: "seuils" } }),
};

type DeclarationsDOps = typeof DECLARATIONS_D_OPS;
type ChampsAChoixDe<K extends string, D> = D extends PayloadDeclare<infer F>
  ? { [C in keyof F & string]: F[C] extends ChampAChoixDeclare ? `${K}.${C}` : never }[keyof F & string]
  : never;

/** `<op>.<champ>` de chaque champ à choix, DÉRIVÉ des déclarations d'`DECLARATIONS_D_OPS`. */
export type ChampAChoix = { [K in keyof DeclarationsDOps & string]: ChampsAChoixDe<K, DeclarationsDOps[K]> }[keyof DeclarationsDOps & string];

type ChampsReservesDe<K extends string, D> = D extends PayloadDeclare<infer F>
  ? { [C in keyof F & string]: F[C] extends ChampReserveDeclare ? `${K}.${C}` : never }[keyof F & string]
  : never;

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

/** Les Conditions RÉSERVÉES à un porteur, admises par le régime `condition.<kind>` de sa famille et refusées
 *  nommément partout ailleurs. `cibleEnVue` ne se lit qu'au contexte d'une affliction psychologique. */
export const CONDITIONS_RESERVEES = ['cibleEnVue'] as const;
type ConditionReservee = (typeof CONDITIONS_RESERVEES)[number];

/** Régime d'une Condition réservée. */
export type RegimeDeCondition = `condition.${ConditionReservee}`;

/** Régime de chaque champ d'un porteur : un champ à choix absent est `specSeule`, un champ réservé ou une
 *  Condition réservée absents sont REFUSÉS. */
export type Regimes = Readonly<Partial<Record<ChampAChoix, RegimeDePorteur> & Record<ChampReserve | RegimeDeCondition, 'admis'>>>;

/**
 * Ops du moteur DONT LE PAYLOAD RESTE À DÉCRIRE — liste NOMINATIVE datée (2026-08-24),
 * DÉCROISSANTE, lot de mort `L1c #1468` (qui remplit les payloads restants et fait mourir le repli
 * `looseObject` de `gameOpSchema`). C'est l'INVENTAIRE des payloads non encore déclarés, pas un
 * constat d'obstacle : chacune attend sa mesure en L1c.
 * Une entrée ne se retire que par le commit qui TYPE l'op dans `OP_DEFS`.
 */
export const OPS_NON_TYPEES: readonly string[] = [
  'arrowWard', 'attackKeyword', 'attackWardFM', 'attrMod', 'breakBlade', 'crewTestMod',
  'critOnRoll', 'critTwice', 'cureCriticalWound', 'cureDisease', 'damageArmour', 'disarm', 'endTransform',
  'freeReroll', 'grantFreeAttack', 'handGate', 'ignoreAnimosity', 'ignoreStatePenalties', 'interruptFocus',
  'intoxicate', 'martyr', 'mitigateIncoming', 'reduceToZero', 'removeShipPoste',
  'senseLoss', 'statusMod', 'suppressPsych', 'teamCommander', 'weaponDamageMod', 'weaponRollMod',
  'weatherWard',
];

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
const LIBELLES_D_ACTEUR = { target: 'la cible', caster: 'le lanceur' } as const;
export const actorRefSchema = enumNomme(LIBELLES_D_ACTEUR);

/** Cible d'une feuille `ops` nommée par une chaîne (`EffectOp.on`, `engine/flowCore.ts`) : celles d'une scène
 *  (`CIBLES_D_EFFET_DE_SCENE`, `noyau/combatEffects.ts`), puis l'acteur du déclenché. */
export const cibleDeFeuilleSchema = enumNomme({ groupe: 'Tout le groupe', heros: 'Un héros', navire: 'Le navire', membreAuHasard: 'Un membre du bord au hasard', ...LIBELLES_D_ACTEUR });

/** `Relation | Camp` (`src/engine/relations.ts`) — union complète lue par la Condition `relation`.
 *  Resserré depuis `z.string()` (variantes `domains`/`talents`/`etats`/`spells`) : les 9 JSON ne
 *  portent que `'adversaire'` aujourd'hui, sans-risque vis-à-vis de l'enum SOURCE (vérifié au parse). */
export const relationOrCampSchema = enumNomme({
  soi: 'soi-même',
  allie: 'allié (même camp)',
  adversaire: 'adversaire (camp ≠)',
  groupe: 'du groupe (joueur)',
  neutre: 'neutre (PNJ)',
  hostile: 'hostile (ennemi)',
});

/** Donnée FIXE d'un acteur, comparable par la Condition `compare` (`ActorField`, `engine/flowCore`).
 *  UNE instance pour les deux côtés de la comparaison (sujet et valeur). */
export const actorFieldSchema = enumNomme({ woundsCurrent: 'PB courants', woundsMax: 'PB max', size: 'Taille', advantage: 'Avantage' });

/** QUANTIFICATEUR sur le groupe des héros (`partyDead`/`skill`/`career`/`species`/`status`) — déclaré
 *  au module : sous le `lazy` de `conditionSchema`, ses cinq sites rendaient 1 475 nœuds jumeaux. */
export const partyWhoSchema = enumNomme({ any: 'un héros au moins', all: 'tout le groupe' });

/** SÉLECTEUR de héros (`PartySelector`, `engine/flowCore.ts`) : le quantificateur, ou le héros que désigne
 *  un état de campagne de forme `heros` (`{ etat }`). */
export const partySelectorSchema = z.union([
  variante('Quantificateur du groupe', partyWhoSchema),
  nommerChamps(z.strictObject({ etat: z.string().min(1, 'Sélecteur « etat » : nommez l’état de campagne qui désigne le héros.') }), { etat: { label: "héros désigné par l’état" , texte: { regime: "technique"} } }),
]);

/** Cause d'effarouchement testée par la Condition `startleCause` (Nerveux, `LDB 85 l.197`). */
export const startleCauseSchema = enumNomme({ noise: 'Bruits forts', magic: 'Magie' });

/** Nature de l'appartenance testée par la Condition `has`. */
export const hasWhatSchema = enumNomme({ group: 'le Groupe', talent: 'le Talent', trait: 'le Trait', psych: 'l’état psy', immunity: 'l’Immunité' });

/** Le `what` d'une branche de la Condition `has`, NOMMÉ par `hasWhatSchema`. */
const whatDeHas = (what: z.infer<typeof hasWhatSchema>) => z.literal(what).pipe(hasWhatSchema);

/** La `spec` d'une Condition `has` : une spécialisation de l'entrée de `type` que nomme sa `value` (`specDe`). */
function refusDeSpecDeLaValeur(type: TypeEntite) {
  return (c: { value?: string; spec?: string }, ctx: z.RefinementCtx): void => {
    if (c.spec === undefined) return;
    const lu = specDe(type, c.value ?? '').safeParse(c.spec);
    for (const iss of lu.success ? [] : lu.error.issues) ctx.addIssue({ code: 'custom', path: ['spec'], message: iss.message });
  };
}

/** Condition `has`, DISCRIMINÉE par `what` : `value` résout dans le registre de `what`, la `spec` n'appartient qu'au Talent. */
export const hasConditionSchema = z.discriminatedUnion('what', [
  nommerChamps(z.strictObject({ kind: z.literal('has'), who: actorRefSchema, what: whatDeHas('group'), value: idDe('groupe', CIBLE_D_APPARTENANCE) }), { kind: { label: "type" }, who: { label: "acteur" }, what: { label: "objet" }, value: { label: "valeur", texte: { regime: "technique" } } }),
  nommerChamps(z.strictObject({ kind: z.literal('has'), who: actorRefSchema, what: whatDeHas('talent'), value: idDe('talent'), spec: z.string().optional() }).superRefine(refusDeSpecDeLaValeur('talent')), { kind: { label: "type" }, who: { label: "acteur" }, what: { label: "objet" }, value: { label: "valeur", texte: { regime: "technique" } }, spec: { label: "spécialisation", texte: { regime: "technique" } } }),
  nommerChamps(z.strictObject({ kind: z.literal('has'), who: actorRefSchema, what: whatDeHas('trait'), value: idDe('trait') }), { kind: { label: "type" }, who: { label: "acteur" }, what: { label: "objet" }, value: { label: "valeur", texte: { regime: "technique" } } }),
  nommerChamps(z.strictObject({ kind: z.literal('has'), who: actorRefSchema, what: whatDeHas('psych'), value: idDe('psychology') }), { kind: { label: "type" }, who: { label: "acteur" }, what: { label: "objet" }, value: { label: "valeur", texte: { regime: "technique" } } }),
  nommerChamps(z.strictObject({ kind: z.literal('has'), who: actorRefSchema, what: whatDeHas('immunity'), value: idDe('damageType') }), { kind: { label: "type" }, who: { label: "acteur" }, what: { label: "objet" }, value: { label: "valeur", texte: { regime: "technique" } } }),
]);


const charRefSchema = nommerChamps(z.strictObject({ who: actorRefSchema, characteristic: charKeySchema, bonus: z.boolean().optional() }), { who: { label: "acteur"  }, characteristic: { label: "caractéristique" }, bonus: { label: "bonus" } });
const compareSubjectSchema = z.union([
  nommerChamps(z.strictObject({ who: actorRefSchema, field: actorFieldSchema }), { who: { label: "acteur"  }, field: { label: "champ"  } }),
  nommerChamps(z.strictObject({ who: actorRefSchema, condition: idDe('etat') }), { who: { label: "acteur"  }, condition: { label: "condition" , texte: { regime: "technique"} } }),
  charRefSchema,
]);
/** `CompareSubject & { factor?: number }` (`engine/flowCore.ts:131`) — un `z.intersection` d'un
 *  `z.union` de `strictObject` NE FONCTIONNE PAS avec zod (chaque branche strict rejette les clés des
 *  autres, cf. `domains.ts` avant ce rewire : `z.intersection(compareSubjectSchema, …)` échouait sur
 *  `etats.json` #14 « inondation » — `{who,characteristic:'endurance',factor:0.5}` — vérifié en isolation). La forme
 *  fidèle est donc l'UNION des 3 branches de `CompareSubject`, chacune portant son `factor`. */
const compareValueSchema = z.union([
  z.number(),
  nommerChamps(z.strictObject({
    who: actorRefSchema,
    field: actorFieldSchema,
    factor: z.number().optional(),
  }), { who: { label: "acteur"  }, field: { label: "champ"  }, factor: { label: "facteur" } }),
  nommerChamps(z.strictObject({ who: actorRefSchema, condition: idDe('etat'), factor: z.number().optional() }), { who: { label: "acteur"  }, condition: { label: "condition" , texte: { regime: "technique"} }, factor: { label: "facteur" } }),
  nommerChamps(z.strictObject({ who: actorRefSchema, characteristic: charKeySchema, bonus: z.boolean().optional(), factor: z.number().optional() }), { who: { label: "acteur"  }, characteristic: { label: "caractéristique" }, bonus: { label: "bonus" }, factor: { label: "facteur" } }),
]);

/** Condition `skill` : sa Compétence et sa spécialisation résolvent au catalogue (`refOuSpec`). Le nœud de la
 *  fabrique est un objet discriminable par `kind`, ce que sa signature générique ne porte pas. */
const conditionDeCompetenceSchema = refOuSpec('skill', {
  kind: nommerNoeud(z.literal('skill'), { nom: 'type' }),
  advances: nommerNoeud(z.number().optional(), { nom: 'augmentations' }),
  who: nommerNoeud(partySelectorSchema.optional(), { nom: 'acteur' }),
}) as z.ZodType<Extract<Condition, { kind: 'skill' }>> & z.core.$ZodTypeDiscriminable;

/** `{ kind: 'talent' }` — un héros du groupe porte le Talent (Béni (Manann) : MDG 15 l.197-198). */
const conditionDeTalentSchema = refOuSpec('talent', {
  kind: nommerNoeud(z.literal('talent'), { nom: 'type' }),
  who: nommerNoeud(partySelectorSchema.optional(), { nom: 'acteur' }),
}) as z.ZodType<Extract<Condition, { kind: 'talent' }>> & z.core.$ZodTypeDiscriminable;

/** Les algèbres `Condition` construites, par Conditions réservées admises. */
const ALGEBRES_DE_CONDITION = new Map<string, z.ZodType<Condition>>();

/** `Condition` (`engine/flowCore.ts:112`) — algèbre CLOSE, récursive via `all`/`any`/`not`, où une Condition
 *  RÉSERVÉE hors des `admises` de la famille est refusée nommément. Mémoïsée par ses `admises` ; chaque branche est
 *  un produit de la fabrique, de même classe d'une famille à l'autre. */
function conditionDe(admises: readonly ConditionReservee[]): z.ZodType<Condition> {
  const cle = [...admises].sort().join(',');
  const deja = ALGEBRES_DE_CONDITION.get(cle);
  if (deja) return deja;
  const reservee = <T extends z.ZodType>(kind: ConditionReservee, branche: T): T =>
    admises.includes(kind) ? branche : (branche.check(z.superRefine((_v, ctx) => {
      ctx.addIssue({ code: 'custom', message: `Condition « ${kind} » : réservée à la famille qui l'admet (régime « condition.${kind} », src/data/schemas/grammaire/mecanique.ts) ; elle serait FAUSSE en silence ici.` });
    })) as T);
  const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
    z.discriminatedUnion('kind', [
      variante('Toujours', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('always') }), { kind: { label: "type"  } }), 'conditionDe', 'condition.always')),
      variante('Drapeaux', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('flag'), expr: z.string().min(1, 'Condition « flag » : le drapeau (`expr`) est vide — nommez le drapeau posé par l’Effet `setFlag`, ou retirez la Condition.') }), { kind: { label: "type"  }, expr: { label: "expression" , texte: { regime: "technique"} } }), 'conditionDe', 'condition.flag')),
      variante('Créneau horaire', marquerProduit(nommerChamps(z.strictObject({
        kind: z.literal('time'),
        window: marquerProduit(nommerChamps(z.strictObject({
          afterHour: z.number().optional(),
          afterMinute: z.number().optional(),
          beforeHour: z.number().optional(),
          beforeMinute: z.number().optional(),
        }), { afterHour: { label: "après cette heure" }, afterMinute: { label: "après cette minute" }, beforeHour: { label: "avant cette heure" }, beforeMinute: { label: "avant cette minute" } }), 'conditionDe', 'condition.time.window'),
      }), { kind: { label: "type"  }, window: { label: "créneau horaire" } }), 'conditionDe', 'condition.time')),
      variante('Possède un objet', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('hasItem'), trappingId: z.string(), count: z.number().optional() }), { kind: { label: "type"  }, trappingId: { label: "objet" , texte: { regime: "technique"} }, count: { label: "nombre" } }), 'conditionDe', 'condition.hasItem')),
      variante('Bourse ≥', marquerProduit(nommerChamps(z.strictObject({
        kind: z.literal('money'),
        atLeast: z.union([
          variante('Montant', marquerProduit(nommerChamps(z.strictObject({ gold: z.number().optional(), silver: z.number().optional(), brass: z.number().optional() }), { gold: { label: "couronnes d’or" }, silver: { label: "pistoles d’argent" }, brass: { label: "sous de cuivre" } }), 'conditionDe', 'condition.money.atLeast')),
          // MDG 15 l.245-247.
          variante('Valeur liée', marquerProduit(nommerChamps(z.strictObject({ brass: marquerProduit(nommerChamps(z.strictObject({ tire: z.string().min(1) }), { tire: { label: "valeur liée", texte: { regime: "technique" } } }), 'conditionDe', 'condition.money.atLeast.tire.brass') }), { brass: { label: "sous de cuivre" } }), 'conditionDe', 'condition.money.atLeast.tire')),
        ]),
      }), { kind: { label: "type"  }, atLeast: { label: "minimum" } }), 'conditionDe', 'condition.money')),
      variante('Héros mort', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('partyDead'), who: partySelectorSchema }), { kind: { label: "type"  }, who: { label: "acteur"  } }), 'conditionDe', 'condition.partyDead')),
      variante('État de campagne', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('etat'), etat: z.string().min(1, 'Condition « etat » : nommez l’état de campagne lu.'), value: z.string().optional() }), { kind: { label: "type"  }, etat: { label: "état de campagne" , texte: { regime: "technique"} }, value: { label: "valeur" , texte: { regime: "technique"} } }), 'conditionDe', 'condition.etat')),
      variante('Compétence du groupe', conditionDeCompetenceSchema),
      variante('Talent du groupe', conditionDeTalentSchema),
      variante('Carrière du groupe', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('career'), id: z.string(), who: partySelectorSchema.optional() }), { kind: { label: "type"  }, id: { label: "identifiant" , texte: { regime: "technique"} }, who: { label: "acteur"  } }), 'conditionDe', 'condition.career')),
      variante('Espèce du groupe', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('species'), id: z.string(), who: partySelectorSchema.optional() }), { kind: { label: "type"  }, id: { label: "identifiant" , texte: { regime: "technique"} }, who: { label: "acteur"  } }), 'conditionDe', 'condition.species')),
      variante('Statut du groupe ≥', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('status'), atLeast: statutSchema, who: partySelectorSchema.optional() }), { kind: { label: "type"  }, atLeast: { label: "minimum" , texte: { regime: "technique"} }, who: { label: "acteur"  } }), 'conditionDe', 'condition.status')),
      variante('État du porteur (comparaison)', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('compare'), subject: compareSubjectSchema, op: compareOpSchema, value: compareValueSchema }), { kind: { label: "type"  }, subject: { label: "sujet" }, op: { label: "opération"  }, value: { label: "valeur" } }), 'conditionDe', 'condition.compare')),
      variante('Marge (DR)', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('slThreshold'), op: compareOpSchema, value: z.number() }), { kind: { label: "type"  }, op: { label: "opération"  }, value: { label: "valeur" } }), 'conditionDe', 'condition.slThreshold')),
      variante('Localisation touchée', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('location'), is: hitLocationSchema }), { kind: { label: "type"  }, is: { label: "valeur attendue"  } }), 'conditionDe', 'condition.location')),
      variante('Type d’attaque', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('attackKind'), is: attackKindSchema }), { kind: { label: "type"  }, is: { label: "valeur attendue" , texte: { regime: "technique"} } }), 'conditionDe', 'condition.attackKind')),
      variante('Cause d’effarouchement', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('startleCause'), is: startleCauseSchema }), { kind: { label: "type"  }, is: { label: "valeur attendue"  } }), 'conditionDe', 'condition.startleCause')),
      variante('Blessures infligées', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('woundsDealt'), op: compareOpSchema, value: z.number() }), { kind: { label: "type"  }, op: { label: "opération"  }, value: { label: "valeur" } }), 'conditionDe', 'condition.woundsDealt')),
      variante('Écart d’Avantage (engagés)', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('engagedAdvantageGap'), op: compareOpSchema, value: z.number() }), { kind: { label: "type"  }, op: { label: "opération"  }, value: { label: "valeur" } }), 'conditionDe', 'condition.engagedAdvantageGap')),
      variante('Avance d’Avantage (sur tous les engagés)', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('engagedAdvantageLead'), op: compareOpSchema, value: z.number() }), { kind: { label: "type"  }, op: { label: "opération"  }, value: { label: "valeur" } }), 'conditionDe', 'condition.engagedAdvantageLead')),
      variante('Ennemi en Ligne de Vue', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('foeInLoS') }), { kind: { label: "type"  } }), 'conditionDe', 'condition.foeInLoS')),
      variante('Caché de l’ennemi (hors de vue)', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('hiddenFromFoes') }), { kind: { label: "type"  } }), 'conditionDe', 'condition.hiddenFromFoes')),
      variante('Engagé avec un ennemi', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('engaged') }), { kind: { label: "type"  } }), 'conditionDe', 'condition.engaged')),
      variante('Au sein d’un Test d’équipage (à bord)', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('crewTest') }), { kind: { label: "type"  } }), 'conditionDe', 'condition.crewTest')),
      variante('Pendant un Round de combat', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('roundDeCombat') }), { kind: { label: "type"  } }), 'conditionDe', 'condition.roundDeCombat')),
      variante('Distance à l’ennemi le plus proche', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('nearestFoe'), op: compareOpSchema, value: z.number() }), { kind: { label: "type"  }, op: { label: "opération"  }, value: { label: "valeur" } }), 'conditionDe', 'condition.nearestFoe')),
      variante('Capacité de combat', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('capability'), who: actorRefSchema, id: z.string(), op: compareOpSchema.optional(), value: z.number().optional() }), { kind: { label: "type"  }, who: { label: "acteur"  }, id: { label: "identifiant" , texte: { regime: "technique"} }, op: { label: "opération"  }, value: { label: "valeur" } }), 'conditionDe', 'condition.capability')),
      variante('Camp / relation', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('relation'), who: actorRefSchema, is: relationOrCampSchema }), { kind: { label: "type"  }, who: { label: "acteur"  }, is: { label: "valeur attendue"  } }), 'conditionDe', 'condition.relation')),
      variante('Possède (Groupe/Talent/Trait)', hasConditionSchema),
      variante('Domaine du Chaos du lanceur', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('casterChaosDomain'), is: z.string() }), { kind: { label: "type"  }, is: { label: "valeur attendue" , texte: { regime: "technique"} } }), 'conditionDe', 'condition.casterChaosDomain')),
      variante('Atteinte VISIBLE (apparence)', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('visiblePassive'), who: actorRefSchema }), { kind: { label: "type"  }, who: { label: "acteur"  } }), 'conditionDe', 'condition.visiblePassive')),
      variante('Cible de l’affliction en vue (psychologie)', reservee('cibleEnVue', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('cibleEnVue'), hostiles: z.literal(true).optional() }), { kind: { label: "type"  }, hostiles: { label: "hostiles seulement" } }), 'conditionDe', 'condition.cibleEnVue'))),
      variante('TOUS (ET)', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('all'), of: z.array(conditionSchema) }), { kind: { label: "type"  }, of: { label: "contenu" } }), 'conditionDe', 'condition.all')),
      variante('AU MOINS UN (OU)', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('any'), of: z.array(conditionSchema) }), { kind: { label: "type"  }, of: { label: "contenu" } }), 'conditionDe', 'condition.any')),
      variante('NON', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('not'), of: conditionSchema }), { kind: { label: "type"  }, of: { label: "contenu" } }), 'conditionDe', 'condition.not')),
    ]),
  );
  ALGEBRES_DE_CONDITION.set(cle, conditionSchema);
  return conditionSchema;
}

/** L'algèbre `Condition` de la famille FERMÉE : aucune Condition réservée. */
export const conditionSchema: z.ZodType<Condition> = conditionDe([]);


/** `FlowTest` (`engine/flowCore.ts:335`) — jet différé (→ modale), tout le métier hors branches. */
/** `CatalogStake` (`src/data/index.ts`) — RÉFÉRENCE d'enjeu vers un DATASET, à sa forme AUTHORÉE : la
 *  clé de la donnée seule. Un Flow authoré peut DIRE ce qu'il met en jeu sans qu'aucun texte n'entre au
 *  document (le résolveur reste la seule porte du texte). Les `values` des trous sont CALCULÉES par le
 *  flux (porte `stakeRef`), jamais saisies : elles restent au type runtime, hors du document, qui ne vise
 *  donc qu'une entrée existante et sans trou (`trousDeLEnjeu`). */
export const catalogStakeSchema = nommerChamps(z.strictObject({
  key: nommerChamps(z.strictObject({
    dataset: z.enum(['nuit', 'voyage', 'meteo', 'flux', 'activite', 'combat']),
    kind: z.string(),
    entryId: z.string().optional(),
    entryCategory: z.string().optional(),
  }), { dataset: { label: "registre"  }, kind: { label: "type" , texte: { regime: "technique"} }, entryId: { label: "entrée" , texte: { regime: "technique"} }, entryCategory: { label: "catégorie d’entrée" , texte: { regime: "technique"} } }),
}).superRefine(({ key }, ctx) => {
  const trous = trousDeLEnjeu(key);
  const cle = `${key.dataset}/${key.kind}${key.entryId ? `/${key.entryId}` : ''}`;
  if (key.entryCategory !== undefined && !categorieDEntreeAPool(key.entryCategory))
    ctx.addIssue({ code: 'custom', path: ['key', 'entryCategory'], message: `la catégorie d’entrée « ${key.entryCategory} » de l’enjeu « ${cle} » n’a aucun pool` });
  if (!trous) ctx.addIssue({ code: 'custom', path: ['key'], message: `aucune entrée d’enjeu « ${cle} »` });
  else if (trous.length) ctx.addIssue({ code: 'custom', path: ['key'], message: `l’entrée d’enjeu « ${cle} » a des trous que seul le moteur remplit (${trous.join(', ')}) : un document ne peut pas la viser` });
}), { key: { label: "clé" } });

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

/** FACILITATION d'un jet par ce que porte le jeteur (Compétence, Talent) : `steps` crans plus facile,
 *  au signe d'`easeDifficulty` (`src/engine/tests.ts`). Forme partagée (`FlowTest.easierIf`, Spécial
 *  d'un jeu de taverne). */
export const facilitationSchema = nommerChamps(z
  .strictObject({
    hasSkill: refOuSpec('skill').optional(),
    hasTalent: idDe('talent').optional(),
    steps: z.number().optional(),
  }), { hasSkill: { label: "Compétence requise" }, hasTalent: { label: "Talent requis" , texte: { regime: "technique"} }, steps: { label: "Étape" } });

/** Le JET : ce qu'il teste et sa Difficulté (LDB 12 l.7, l.137) — forme partagée, sans refine. */
export const jetSchema = nommerChamps(z.strictObject({
  ...sujetDuJetSchema.shape,
  difficulty: difficultySchema.optional(),
}), { ...metaDesChamps(sujetDuJetSchema, { exigees: true }), difficulty: { label: 'difficulté' } });

/** Tag `menace` d'un Test : une spécialisation de l'entrée `resistance` de `talents.json`
 *  (`MenaceId`, `engine/menace.ts`). */
export const menaceSchema = specFermeeDe('talent', 'resistance');

/** La DÉCISION authorée d'un Test (`CHAMPS_DE_DECISION`, `engine/flowCore.ts`), lue par `resoudreFlowTest` seul :
 *  forme partagée du Test de flux et du Test étendu, sans refine. */
export const decisionDuTestSchema = nommerChamps(z.strictObject({
  easierIf: facilitationSchema.optional(),
  gate: conditionSchema.optional(),
  difficultyBy: z.array(nommerChamps(z.strictObject({ cond: conditionSchema, difficulty: difficultySchema }), { cond: { label: "condition" }, difficulty: { label: "difficulté"  } })).optional(),
}), { easierIf: { label: "facilité conditionnelle" }, gate: { label: "condition d’accès" }, difficultyBy: { label: "difficultés conditionnelles" } });

export const flowTestSchema = nommerChamps(z.strictObject({
  /** ENJEU du Test (#1117) — cf. `stakeRefSchema`. */
  stake: stakeRefSchema.optional(),
  ...jetSchema.shape,
  sense: senseSchema.optional(),
  /** MDG 15 l.144-145 */
  crewTestType: idDe('crewTestType').optional(),
  requireSL: z.number().optional(),
  label: z.string().optional(),
  tool: z.string().optional(),
  vsGroups: refs('groupe', { sousListe: DECLARABLE_PAR_UN_PORTEUR }).optional(),
  vsStatus: statutSchema.optional(),
  begging: z.boolean().optional(),
  vsCapricieux: z.boolean().optional(),
  ...decisionDuTestSchema.shape,
  argDifficulty: z.boolean().optional(),
  onlyGroups: refs('groupe', { sousListe: CIBLE_D_APPARTENANCE }).optional(),
  exceptGroups: refs('groupe', { sousListe: CIBLE_D_APPARTENANCE }).optional(),
  /** SOUTIEN (LDB 12 l.197) — TRI-ÉTAT authoré : absent = défaut de la VOIE qui ouvre le Test (scène/
   *  dialogue : soutenable ; effet déclenché / consommable : non soutenable) ; `true` = jamais
   *  soutenable ; `false` = soutenable malgré la voie (Test de soin d'un nécessaire). */
  noSupport: z.boolean().optional(),
  /** Tag MENACE du talent « Résistance (Menace) » (LDB 10 l.1016-1020). */
  menace: menaceSchema.optional(),
  opposed: nommerChamps(z
    .strictObject({
      attacker: charKeySchema,
      attackerSkill: idDe('skill').optional(),
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
  if (v.crewTestType) {
    if (!v.stake) {
      ctx.addIssue({ code: 'custom', path: ['stake'], message: 'Test d’équipage SANS enjeu : le Test nomme ce qu’il met en jeu (`stake`).' });
    }
    if (!v.skill && !v.characteristic) return;
    ctx.addIssue({
      code: 'custom',
      path: ['crewTestType'],
      message: 'Test d’équipage EXCLUSIF : `crewTestType` (l’équipage le joue par ses rôles) OU `skill`/`characteristic`, jamais les deux.',
    });
    return;
  }
  if (v.skill || v.characteristic) return;
  ctx.addIssue({
    code: 'custom',
    path: ['skill'],
    message: 'jet SANS compétence ni caractéristique : la porte le jouerait sur une valeur de 0 '
      + '(auto-échec muet). Nommer `skill` (id de compétence), `characteristic`, ou `crewTestType`.',
  });
}), { stake: { label: "enjeu" }, ...metaDesChamps(jetSchema, { exigees: true }), sense: { label: "sens"  }, crewTestType: { label: "Test d’équipage" , texte: { regime: "technique",usage: "référence mécanique résolue au catalogue"} }, requireSL: { label: "DR requis" }, label: { label: "libellé" , texte: { regime: "designation"} }, tool: { label: "outil" , texte: { regime: "technique"} }, vsGroups: { label: "contre les groupes" , texte: { regime: "technique"} }, vsStatus: { label: "contre le statut" , texte: { regime: "technique"} }, begging: { label: "mendicité" }, vsCapricieux: { label: "contre Capricieux" }, ...metaDesChamps(decisionDuTestSchema, { exigees: true }), argDifficulty: { label: "difficulté de l’argument" }, onlyGroups: { label: "groupes autorisés" , texte: { regime: "technique"} }, exceptGroups: { label: "groupes exclus" , texte: { regime: "technique"} }, noSupport: { label: "sans assistance" }, menace: { label: "menace" , texte: { regime: "technique"} }, opposed: { label: "opposition" } });


/** Champ que `flowTestSchema` laisse FACULTATIF et qu'un porteur peut exiger. */
type ChampExigibleDuTest = 'skill' | 'difficulty';

/** RESSERREMENT, au PORTEUR, du Test qu'il compose par identité sous sa clé `test` : les `champs` que le
 *  nœud partagé laisse facultatifs y sont exigés. Un clone resserré du nœud perdrait sa pose
 *  (`interne/concepts.ts`) ; le `superRefine` du porteur la garde. */
export function exigerDuTest(...champs: readonly ChampExigibleDuTest[]) {
  return (porteur: Readonly<Record<string, unknown>>, ctx: z.RefinementCtx): void => {
    const test = porteur.test;
    if (typeof test !== 'object' || test === null) return;
    for (const champ of champs)
      if (Reflect.get(test, champ) === undefined)
        ctx.addIssue({ code: 'custom', path: ['test', champ], message: `Test : \`${champ}\` exigée.` });
  };
}

/** Refuse au Test de `porteur` tout champ de DÉCISION (`CHAMPS_DE_DECISION`) : c'est le porteur qui la tient. */
function refuserLaDecision(porteur: Readonly<Record<string, unknown>>, ctx: z.RefinementCtx, raison: string): void {
  const test = porteur.test;
  if (typeof test !== 'object' || test === null) return;
  for (const champ of CHAMPS_DE_DECISION)
    if (Reflect.get(test, champ) !== undefined)
      ctx.addIssue({ code: 'custom', path: ['test', champ], message: `Test : \`${champ}\` refusé — ${raison}` });
}

/** Le Test que son PORTEUR fixe (`JetFixe`, `engine/flowCore.ts`) : les `champs` exigés (`exigerDuTest`),
 *  aucun champ de décision — sa Difficulté est celle qu'il déclare. */
export function fixerLeTest(...champs: readonly ChampExigibleDuTest[]) {
  const exiger = exigerDuTest(...champs);
  return (porteur: Readonly<Record<string, unknown>>, ctx: z.RefinementCtx): void => {
    exiger(porteur, ctx);
    refuserLaDecision(porteur, ctx, 'ce porteur fixe sa Difficulté, il ne la décide pas.');
  };
}

/** Test ÉTENDU (`LDB 12 l.172-174`) : un acteur cumule des DR Round par Round jusqu'à sa cible
 *  (`cibleEtendueSchema`) (crocheter une serrure, forcer un mécanisme…). `flag` posé à la réussite (gate la suite).
 *  Sa décision est celle d'un Test de flux (`decisionDuTestSchema`). */
export const extendedTestSchema = nommerChamps(z.strictObject({
  type: z.literal('extendedTest'),
  ...jetSchema.shape,
  ...decisionDuTestSchema.shape,
  label: z.string(),
  ...cibleEtendueSchema.shape,
  flag: z.string().optional(),
  /** ENJEU du Test (#1117) — référence de donnée, résolue par `resolveStake` et affichée par la
   *  modale du Round. Authorable par site ; à défaut, l'applier pose celui du Test étendu. */
  stake: stakeRefSchema.optional(),
}), { type: { label: "type"  }, ...metaDesChamps(jetSchema, { exigees: true }), ...metaDesChamps(decisionDuTestSchema, { exigees: true }), label: { label: "libellé" , texte: { regime: "designation"} }, ...metaDesChamps(cibleEtendueSchema, { exigees: true }), flag: { label: "drapeau" , texte: { regime: "technique"} }, stake: { label: "enjeu" } });

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
   * Le porteur ne SERT que la branche `echec`, et il l'applique par extraction PLATE de ses ops
   * (`spellOps`, `engine/flowCore.ts`) — c'est le régime du cycle de maladie : l'applier de repos
   * (`bandeDeNuit`, applier `maladie-test-quotidien`, `noyau/restFlow.ts`) rend une liste VIDE sur une
   * réussite, et `symptomOnTick` (`engine/disease.ts`) ne lit que `echec`.
   * Deux formes seraient alors AUTHORABLES SANS EFFET, donc menteuses : une branche `reussite`
   * peuplée (jamais jouée) et une branche `echec` à embranchement (`si`/`test`/`choix`), dont
   * `spellOps` APLATIRAIT les ops — promises quelle que soit l'issue. Le contrat les REFUSE.
   */
  readonly echecSeulServi?: boolean;
  /**
   * La Difficulté du nœud se décide au PORTEUR (`difficultyBySeverity` du cycle de maladie, lu par
   * `engine/disease.ts`) : le Test ne porte aucun champ de décision (`NoeudDecideAuPorteur`).
   */
  readonly decisionAuPorteur?: boolean;
}

/**
 * Un Flow est-il une branche PLATE ? — que des `sequence`/`effet` : aucun embranchement dont `spellOps`
 * (extraction plate) promettrait les ops des deux côtés. Rend le `kind` fautif, ou `null`.
 */
function kindDEmbranchement(flow: Flow<unknown>): string | null {
  if (flow.kind === 'sequence') {
    for (const e of flow.etapes) {
      const k = kindDEmbranchement(e);
      if (k) return k;
    }
    return null;
  }
  return flow.kind === 'effet' ? null : flow.kind;
}

/**
 * NŒUD `test` d'un Flow (`Flow<E>`, `engine/flowCore.ts:559`) — jet ALÉATOIRE interactif dont l'issue
 * choisit la branche `reussite` ou `echec`. Le nœud ne dépend PAS du type de la feuille `effet` de ses
 * branches : seul le schéma de BRANCHE change (`arbreDeFlow`, composé par `flowSchema` mécanique et
 * `sceneFlowSchema`, `defs-scenes/effets.ts`). La fabrique le déclare donc une seule fois, paramétré
 * par sa branche — `test` est toujours `flowTestSchema`, la forme UNIQUE du jet en donnée.
 */
export function noeudTest<B extends z.ZodType>(branche: B, options: OptionsNoeudTest = {}) {
  const marque = marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('test'), test: flowTestSchema, reussite: branche, echec: branche }), { kind: { label: "type"  }, test: { label: "Test" }, reussite: { label: "réussite" , texte: { regime: "technique",usage: "branche de Flow paramétrée par son schéma"} }, echec: { label: "échec" , texte: { regime: "technique",usage: "branche de Flow paramétrée par son schéma"} } }), 'noeudTest', 'test');
  const exige = options.difficulteRequise ? marque.superRefine(exigerDuTest('difficulty')) : marque;
  const noeud = options.decisionAuPorteur
    ? exige.superRefine((v, ctx) => refuserLaDecision(v, ctx, 'la Difficulté de ce nœud se décide au porteur.'))
    : exige;
  if (!options.echecSeulServi) return noeud;
  return noeud.superRefine((valeur, ctx) => {
    // La branche est GÉNÉRIQUE (`B extends z.ZodType`) : son type de sortie est opaque ici, seule la
    // FORME du nœud de Flow est inspectée — celle que `flowCore.ts` déclare pour tout `Flow<E>`.
    const v = valeur as FlowTestNode<unknown>;
    if (v.reussite.kind !== 'sequence' || v.reussite.etapes.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['reussite' satisfies keyof FlowTestNode<unknown>],
        message:
          'ce nœud ne SERT que sa branche d’ÉCHEC : une branche « reussite » peuplée ne serait jamais jouée. '
          + 'Elle s’écrit vide : {kind:"sequence",etapes:[]}.',
      });
    }
    const embranchement = kindDEmbranchement(v.echec);
    if (embranchement) {
      ctx.addIssue({
        code: 'custom',
        path: ['echec' satisfies keyof FlowTestNode<unknown>],
        message:
          'branche d’ÉCHEC à EMBRANCHEMENT (« ' + embranchement + ' ») : ce nœud est lu par extraction PLATE '
          + '(spellOps), qui appliquerait les ops des DEUX côtés. La branche d’échec ne porte que des feuilles « effet ».',
      });
    }
  });
}



/** CIBLE simple d'un effet déclenché — la branche chaîne de `EffectTargeting` (les deux autres sont
 *  des géométries, pas un univers de valeurs). */
export const effectOnSchema = enumNomme({
  soi: 'soi-même',
  victime: 'la victime',
  engages: 'les adversaires engagés',
  empoigne: 'la victime empoignée (absorbée)',
});

/** `EffectTargeting` (`engine/flowCore.ts:632`). */
export const effectTargetingSchema = z.union([
  variante('Cible désignée', effectOnSchema),
  nommerChamps(z.strictObject({ near: z.enum(['victime', 'soi']), radiusMeters: z.number() }), { near: { label: "près de"  }, radiusMeters: { label: "rayon en mètres" } }),
  nommerChamps(z.strictObject({ pick: z.literal('engages'), sizeAtMost: z.literal('soi').optional(), max: z.number() }), { pick: { label: "sélection"  }, sizeAtMost: { label: "Taille maximale"  }, max: { label: "maximum" } }),
]);

/** DÉCLENCHEUR d'un `TriggeredEffect` (`EffectTrigger`, `engine/flowCore.ts`). Le `satisfies` garde
 *  l'exhaustivité de COMPILATION que le Record d'affichage tenait : un trigger ajouté à l'union sans
 *  son libellé ici ne compile pas. La taxonomie du recensement d'événements de combat
 *  (`src/combat-event-emission-coverage.test.ts`) en dérive. */
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
  'suppressExposure', 'gatherInfo', 'noSurprise', 'mapMade', 'reverseToken', 'countsAsRest', 'campCare',
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
/** Le marin ÉPINGLÉ à un rôle d'équipage (`Combatant.shipRole`) : cible d'un coup d'équipage, et d'une
 *  feuille `ops` de scène (`EffectOp.on`, `CibleDeRole`). MSRC 07 l.86 ; MDG 15 l.233 */
export const cibleDeRoleSchema = nommerChamps(z.strictObject({ role: ref('crewRole') }), { role: { label: "rôle" , texte: { regime: "technique",usage: "référence mécanique résolue au catalogue"} } });

/** Les héros qui CHOISISSENT d'être visés, chacun à son siège (`prompt`) : cible d'une feuille `ops` de scène
 *  (`EffectOp.on`, `CibleDeVolontaires`). MDG 15 l.196 */
export const cibleDeVolontairesSchema = nommerChamps(z.strictObject({ volontaires: z.string().min(1) }), { volontaires: { label: "volontaires" , texte: { regime: "designation"} } });

export const crewTargetSchema = z.union([
  nommerChamps(z.strictObject({ poste: z.literal(true) }), { poste: { label: "poste" } }),
  nommerChamps(z.strictObject({ stations: refs('shipStation', { min: 1 }) }), { stations: { label: "présences" , texte: { regime: "technique"} } }),
  cibleDeRoleSchema,
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

/** Libellé court (texte SEUL, sert aussi de `<option>` natif) de CHAQUE op du vocabulaire `GameOp` —
 *  `Record` TOTAL (TS force sa complétude) : source runtime de l'énumération des kinds pour les
 *  tests (`Object.keys(OP_LABEL)`), sans dupliquer la liste. Le payload d'une op typée en porte le sien
 *  (`nommerNoeud`, `payloadsDe`) ; une op de `OPS_NON_TYPEES`, sans payload, n'a que lui. */
export const OP_LABEL: Record<GameOp['op'], string> = {
  wounds: 'Blessures (ignore BE/PA)',
  fall: 'Chute (hauteur lue dans une table)',
  heal: 'Soin (Blessures rendues)',
  healCaster: 'Soin au lanceur',
  condition: 'Poser un État',
  removeCondition: 'Retirer un État',
  charMod: 'Modif. de caractéristique',
  ap: '+PA (Localisation ou toutes)',
  testMod: 'Modif. à tous les Tests',
  skillDRBonus: '+DR à une Compétence',
  charDRBonus: '+DR aux Tests d’une Caractéristique',
  offTerrainMod: 'Hors de son terrain (M imposé, ±DR)',
  crewTestMod: 'Modif. aux Tests individuels d’un Test d’équipage',
  incomingAttackMod: 'Modif. au toucher de l’attaquant',
  incomingAdvantage: 'Avantage donné à l’attaquant',
  incomingSpellDRMod: 'Modif. au DR des Sorts qui l’affectent (par point/Indice)',
  sbBonus: '+Bonus de Force aux Dégâts',
  endPsych: 'Fin d’un état psychologique',
  beginPsych: 'Entrée dans un état psychologique',
  exposeDisease: 'Exposer à une Maladie (Test de Contraction)',
  contractDisease: 'Contracter une Maladie (immédiat)',
  kill: 'Mort directe (Point de Destin sauve)',
  removeShipPoste: 'Retirer un poste de navire (Canon perdu)',
  teamCommander: 'Diriger l’équipe (score de Projectiles du commandant)', // posé par l'action « Diriger l'équipe » ; hors palette d'auteur (commanderId interne)
  attackKeyword: 'Mot-clé d’attaque (ex. magique)',
  mitigateIncoming: 'Mitige les Dégâts entrants (Éthéré)',
  ignoreStatePenalties: 'Ignore les pénalités d’État',
  freeReroll: 'Relance gratuite (prochain échec)',
  critTwice: 'Deux lancers de Critique (meilleur)',
  gainResource: 'Points de Chance / Destin',
  gainAdvantage: 'Gagner de l’Avantage',
  topUpAdvantage: 'Porter l’Avantage à (min)',
  attrMod: 'Modif. d’attribut secondaire',
  corruption: 'Points de Corruption',
  sinMod: 'Points de Péché (±)',
  corruptionExposure: 'Exposition corruptrice (Test différé)',
  castPenalty: 'Contrecoup d’incantation',
  money: 'Bourse personnelle (sous de cuivre, ±)',
  statusMod: 'Standing temporaire (prochaine aventure)',
  grantReverseToken: 'Jeton d’inversion (prochaine aventure)',
  castWard: 'Aura anti-Sort (Langue)',
  arrowWard: 'Bouclier anti-projectiles',
  domeWard: 'Dôme protecteur',
  attackWardFM: 'Attaquer exige un Test de FM',
  grantWeapon: 'Invoquer une arme magique',
  grantNaturalWeapon: 'Accorder une arme naturelle',
  grantFreeAttack: 'Accorder une attaque gratuite',
  interruptFocus: 'Interrompre la Focalisation', // marqueur combat-interne (branche d’échec du Test `interruption-de-focalisation`) — non author-pickable
  breakBlade: 'Désarmer / briser la lame', // marqueur combat-interne (victoire du Test de Piège-lame) — non author-pickable
  push: 'Poussée (repousser de N m)',
  teleport: 'Téléportation du lanceur',
  chain: 'Attaques en chaîne (rebond)',

  grantTrait: 'Accorder un Trait',
  removeTrait: 'Retirer un Trait',
  grantPsychTrait: 'Accorder un Trait psychologique',
  removePsychTrait: 'Retirer un Trait psychologique',
  grantTalent: 'Accorder un Talent',
  suppressTalents: 'Suspendre des Talents (jours)',
  deitySkillMod: 'Modifier les Compétences du dieu',
  deityBan: 'Bannir des Prières du dieu (jours)',
  prayerForAction: 'Imposer la Prière pour l’Action (Rounds)',
  grantCareerSkill: 'Compétence ajoutée aux carrières',
  grantCareerTalent: 'Talent ajouté aux carrières',
  augmentWeapon: 'Enchanter l’arme',
  cureDisease: 'Guérir des maladies',
  reduceDiseaseDays: 'Raccourcir une maladie',
  preventInfection: 'Empêcher l’infection',
  aideMedicale: 'Aide Médicale',
  cureCriticalWound: 'Guérir une Blessure critique',
  amputer: 'Amputer (plaie + séquelles permanentes)',
  diseaseTestMod: 'Modif. aux Tests d’une maladie',
  suppressSymptom: 'Suspendre un symptôme',
  aggravateSymptom: 'Aggraver un symptôme',
  attenuateSymptom: 'Atténuer un symptôme',
  grantSymptom: 'Ajouter un symptôme',
  testDAgir: 'Test par Round pour agir (drogue)',
  delayed: 'Ops différées (échéance d’horloge)',
  suppressPsych: 'Apaiser les Traits psychologiques',
  suffocate: 'Suffocation',
  noBreath: 'Plus besoin de respirer',
  noHunger: 'Plus besoin de manger',
  ignoreAnimosity: 'Ignore Préjugés/Animosités',
  weatherWard: 'Immunité aux intempéries',
  damageArmour: 'Pourrir le cuir (−1 PA)',
  damageWornGear: 'Endommager Armures et Armes portées (1 Dégât)',
  reduceToZero: 'Réduire les Blessures à 0',
  banish: 'Bannir (retirer du jeu)',
  martyr: 'Martyr (recevoir les Dégâts)',
  giveTrapping: 'Donner un objet',
  perRound: 'Effet récurrent (chaque Round)',
  summon: 'Invoquer une créature',
  scheduleRespawn: 'Reconstitution différée (à la mort)', // marqueur de DONNÉE (op onSlain, non author-pickable)
  zone: 'Zone persistante (mur / disque)',
  polymorph: 'Métamorphose en créature',
  transform: 'Transformation durable (réversible)',
  endTransform: 'Fin de transformation',
  lifeSteal: 'Vol de vie (drain de Blessures)',
  light: 'Émettre de la lumière (rayon)',
  skillMod: 'Modif. d’une Compétence',
  moveScale: 'Échelle de Mouvement (×n/d)',
  moveMod: 'Modif. de Mouvement (±N)',
  maxWeaponHands: 'Plafond de mains d’arme',
  disarm: 'Lâcher l’objet tenu (main)',
  handGate: 'Main ensanglantée (Test par Action)',
  senseLoss: 'Perte sensorielle (œil/oreille)',
  loseTurn: 'Perdre Action + Mouvement',
  weaponRollMod: 'Atout d’arme — modif. de jet (passif)',
  weaponDamageMod: 'Atout d’arme — modif. de Dégâts (passif)',
  armourPierce: 'Atout d’arme — Perforante (passif)',
  critOnRoll: 'Atout d’arme — Critique sur jet (passif)',
  spendAdvantage: 'Dépenser de l’Avantage',
  rollThreshold: 'Jet à paliers (un dé → ops par seuil)',
  rollTable: 'Tirage sur table (dé → ops par fourchette)',
  rollMutation: 'Tirage d’une mutation (durée réglable)',
  charDamage: 'Perte permanente de Caractéristique',
  intoxicate: 'Boisson alcoolisée (échec de Résistance à l’alcool)',
  narrative: 'Effet narratif (texte libre)',
  shipMorale: 'Moral de l’équipage du navire',
  manann: 'Humeur de Manann',
  shipCritical: 'Coup critique au navire',
  navireMod: 'Modificateur du navire (M, Manœuvre)',
  meteoImposee: 'Météo imposée au navire',
  cargaison: 'Cargaison trouvée',
  provisions: 'Provisions de bord',
  equipage: 'Équipage du navire',
  perilDeMer: 'Péril de mer',
  navireHostile: 'Navire hostile',
  infestation: 'Infestation du navire',
  combatEnMer: 'Combat en mer',
  attaquesSubies: 'Attaques subies',
  commission: 'Commission de transport',
  constructeurDEscale: 'Constructeur de navires d’escale',
  rationsDEscale: 'Rations d’escale',
  marcheDuPort: 'Marché d’un port',
};

/** Payloads d'une famille, chacun nommé par le libellé de son op (`OP_LABEL`) : une FORME se ferme en `z.strictObject`,
 *  ses champs à choix au régime demandé. */
function payloadsDe(regimes: Regimes): Readonly<Record<string, z.ZodType<unknown>>> {
  return Object.fromEntries(
    Object.entries(DECLARATIONS_D_OPS).map(([op, d]) => {
      const nomme = <N extends z.ZodType>(noeud: N): N => nommerNoeud(noeud, { label: OP_LABEL[op as GameOp['op']] });
      if (estNoeudZod(d)) return [op, nomme(d)];
      const admis = (champ: string, v: unknown): v is ChampReserveDeclare =>
        v instanceof ChampReserveDeclare && regimes[`${op}.${champ}` as ChampReserve] === 'admis';
      const entrees = Object.entries((d as PayloadDeclare).champs);
      const champs = entrees.flatMap(([champ, v]) =>
        v instanceof ChampAChoixDeclare ? [[champ, refOuSpec(v.cible, v.extra, regimes[`${op}.${champ}` as ChampAChoix] ?? 'specSeule')]]
          : v instanceof ChampReserveDeclare ? (admis(champ, v) ? [[champ, v.noeud]] : [])
            : [[champ, v]],
      );
      const meta = Object.fromEntries(champs.map(([champ]) => [champ, (d as PayloadDeclare).meta[champ as string]]));
      // Les clés RÉSERVÉES admises sont le choix de la famille appelante (ses régimes).
      const reservesAdmises = Object.fromEntries(entrees.flatMap(([champ, v]) => (admis(champ, v) ? [[champ, v.noeud]] : [])));
      const affinage = (d as PayloadDeclare).affinage;
      return [op, nomme(marquerProduit(nommerChamps(z.strictObject(Object.fromEntries(champs)).check(...(affinage ? [z.superRefine(affinage)] : [])), meta), 'payloadsDe', op, reservesAdmises))];
    }),
  );
}

/** La forme LOOSE commune aux `gameOp` de toutes les familles : son reste (`.*`) est UN nœud, celui des ops encore
 *  non typées (`OPS_NON_TYPEES`), quelle que soit la famille qui l'atteint. */
const OP_EN_DONNEE = z.looseObject({ op: z.string() });

/**
 * Une attaque gratuite est le DERNIER geste de son Flow d'effet déclenché (#4011, `runCombatFlow`,
 * `noyau/combat/triggeredTest.ts`) : refuse une op `grantFreeAttack` suivie d'une op dans sa feuille, et une
 * étape de `sequence` qui en porte une (`flowHasFreeAttack`, à quelque profondeur de branche) suivie d'une étape.
 */
function refuserLaGratuiteNonTerminale(flow: Flow<EffectOp>, ctx: z.RefinementCtx): void {
  walkFlow(flow, (noeud, chemin) => {
    if (noeud.kind === 'effet') {
      noeud.effet.ops.forEach((o, i) => {
        if (o.op === 'grantFreeAttack' && i < noeud.effet.ops.length - 1) {
          ctx.addIssue({ code: 'custom', path: ['flow', ...chemin, 'effet', 'ops', i], message: 'attaque gratuite suivie d’une opération : « grantFreeAttack » est la DERNIÈRE opération de sa feuille.' });
        }
      });
    } else if (noeud.kind === 'sequence') {
      noeud.etapes.forEach((e, i) => {
        if (i < noeud.etapes.length - 1 && flowHasFreeAttack(e)) {
          ctx.addIssue({ code: 'custom', path: ['flow', ...chemin, 'etapes', i], message: 'attaque gratuite suivie d’une étape : l’étape qui accorde « grantFreeAttack » est la DERNIÈRE de sa séquence.' });
        }
      });
    }
  });
}

/** `Flow<E>` (`engine/flowCore.ts:559`) — arbre récursif ACYCLIQUE (sequence/effet/si/test/choix), paramétré
 *  par sa feuille `effet`, sa `Condition` et le coût d'Avantage de son `choix`. */
export function arbreDeFlow<E>(feuille: z.ZodType<E>, condition: z.ZodType<Condition>, coutDAvantage: z.ZodType<number | typeof INDICE_TEMPLATE>): z.ZodType<Flow<E>> {
  const flow: z.ZodType<Flow<E>> = z.lazy(() =>
    z.discriminatedUnion('kind', [
      variante('Séquence', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('sequence'), etapes: z.array(flow) }), { kind: { label: "type"  }, etapes: { label: "étape" } }), 'arbreDeFlow', 'flow.seq')),
      variante('Effet', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('effet'), effet: feuille }), { kind: { label: "type"  }, effet: { label: "effet" } }), 'arbreDeFlow', 'flow.do')),
      variante('Si', marquerProduit(nommerChamps(z.strictObject({ kind: z.literal('si'), condition, alors: flow, sinon: flow.optional() }), { kind: { label: "type"  }, condition: { label: "condition" }, alors: { label: "alors" }, sinon: { label: "sinon" } }), 'arbreDeFlow', 'flow.if')),
      variante('Test', noeudTest(flow)),
      variante('Choix', proseNommee(nommerChamps(z.strictObject({
        kind: z.literal('choix'),
        coutEnAvantage: coutDAvantage.optional(),
        icon: idDIconeSchema.optional(),
        oui: flow,
        non: flow.optional(),
      }), { kind: { label: "type"  }, coutEnAvantage: { label: "coût en Avantage"  }, icon: { label: "icône" , texte: { regime: "technique"} }, oui: { label: "oui" }, non: { label: "non" } }), 'flow.choice.invite')),
    ]),
  );
  return flow;
}

function construire(regimes: Regimes) {
  const opDefs = payloadsDe(regimes);
  const condition = conditionDe(CONDITIONS_RESERVEES.filter((k) => regimes[`condition.${k}`] === 'admis'));
  /**
   * Un `GameOp` (`src/engine/ops.ts`) tel qu'il apparaît en DONNÉE. Une op de `OP_DEFS` est validée sur
   * son payload STRICT ; une op de `OPS_NON_TYPEES` garde la forme LOOSE ; une op inconnue des DEUX registres est NOMMÉE en erreur. Ce rouge vit ICI et nulle part
   * ailleurs : la clé `op` est surchargée en donnée (les comparateurs `>=`/`<=`/`==` d'une `Condition`
   * la portent aussi).
   */
  const gameOp: z.ZodType<GameOp> = marquerProduit(nommerChamps(OP_EN_DONNEE.superRefine((v, ctx) => {
    marquerOpAtteinte(ctx);
    const payload = opDefs[v.op];
    if (payload) {
      const res = payload.safeParse(v);
      // L'issue du payload est REPORTÉE TELLE QUELLE, seul son `message` est préfixé du nom de l'op :
      // aplatir son `code` en `'custom'` forcerait un consommateur à trier les refus d'op par leur
      // PHRASE — donc par la locale (`src/lib/zodEnFrancais.ts`), qui n'est pas un contrat.
      if (!res.success) for (const issue of res.error.issues) ctx.addIssue({ ...issue, message: `GameOp « ${v.op} » : ${issue.message}` });
      return;
    }
    if (OPS_NON_TYPEES.includes(v.op)) return;
    ctx.addIssue({
      code: 'custom',
      path: ['op'],
      message: `GameOp « ${v.op} » : op inconnue de OP_DEFS et de OPS_NON_TYPEES (src/data/schemas/grammaire/mecanique.ts) — la typer, ou l'inscrire à la liste avec sa raison mesurée.`,
    });
  }), { op: { label: "opération" , texte: { regime: "technique"} } }), 'construire', 'gameOp').transform((v) => v as GameOp);

  /** EFFECTOP — pont UNIQUE entre la logique authorée (Flow) et le moteur mécanique des sorts : applique
   *  des `GameOp` à une cible (`party`/`hero` scène, ou `caster`/`target` incantation). Feuille `effet` par
   *  DÉFAUT du `Flow<E>` générique (`engine/flowCore.ts:559`), et l'un des membres de l'union `Effect` de
   *  scène (`defs-scenes/effets.ts`). `on` = les 5 valeurs de
   *  l'interface TS : `'party'`/`'hero'`/`'navire'` (scène) ou `'caster'`/`'target'` (contexte d'incantation). Le
   *  ciblage `'soi'`/`'victime'` est le vocabulaire du NIVEAU TRIGGER (`effectTargetingSchema`), pas de la
   *  feuille : sur la feuille, `'caster'` = porteur, `'target'` = cible résolue par le trigger. */
  declarerEnfants(gameOp, Object.entries(opDefs).map(([op, noeud]) => ({ noeud, segment: '^' + op })), valeur => {
    const op = (valeur as { op?: string } | null)?.op;
    return op && opDefs[op] ? [opDefs[op]] : [];
  }, 'payloads-op');
  nommerNoeud(gameOp, { opacite: { nature: 'dispatch-op', raison: 'Payloads stricts déclarés ; OPS_NON_TYPEES reste opaque.' } });

  const effectOp = marquerProduit(nommerChamps(z.strictObject({
    type: z.literal('ops'),
    ops: executeesDe(gameOp),
    on: z.union([variante('Cible désignée', cibleDeFeuilleSchema), cibleDeRoleSchema, cibleDeVolontairesSchema]).optional(),
    heroId: z.string().optional(),
    untilTime: z.number().optional(),
    label: z.string().optional(),
    pendantJours: (formulaSchema as z.ZodType<Formula>).optional(),
  }).refine((v) => v.untilTime === undefined || v.pendantJours === undefined, { message: 'durée EXCLUSIVE : « untilTime » (échéance bakée) OU « pendantJours » (jours tirés à l’application), jamais les deux.' }), { type: { label: "type"  }, ops: { label: "opérations" }, on: { label: "cible"  }, heroId: { label: "héros" , texte: { regime: "technique"} }, untilTime: { label: "échéance" }, label: { label: "libellé" , texte: { regime: "designation"} }, pendantJours: { label: "pendant (jours)" , texte: { regime: "technique",usage: "formule mécanique résolue par la grammaire"} } }), 'construire', 'effectOp');

  // Coût LITTÉRAL, ou TEMPLATE `$indice` (`engine/flowCore::INDICE_TEMPLATE`) — accepté AU PARSE
  // seulement : `withArg` (`noyau/triggeredEffects`) le remplace par l'Indice de l'instance porteuse.
  const flow = arbreDeFlow(effectOp, condition, ouReserve(z.number(), INDICE_TEMPLATE));

  /** `TriggeredEffect<EffectOp>` (`engine/flowCore.ts:635`). `optional` (Contrôle de la Frénésie…)
   *  seule 1/9 des JSON le peuple (`talents.json`) — laissé optionnel, sans risque pour les autres. */
  const triggeredEffect = marquerProduit(nommerChamps(z.strictObject({
    trigger: effectTriggerSchema,
    on: effectTargetingSchema,
    flow: flow,
    condition: idDe('etat').optional(),
    attackType: genreDArmeSchema.optional(),
    coupCritique: z.boolean().optional(),
    optional: z.boolean().optional(),
  }).superRefine((v, ctx) => refuserLaGratuiteNonTerminale(v.flow, ctx)), { trigger: { label: "déclenchement"  }, on: { label: "cible"  }, flow: { label: "enchaînement", transparent: true }, condition: { label: "condition" , texte: { regime: "technique"} }, attackType: { label: "type d’attaque"  }, coupCritique: { label: "sur Coup Critique seulement" }, optional: { label: "facultatif" } }), 'construire', 'triggeredEffect');

  /** Entrée d100 d'une table de voyage (`TravelTableEntry`, `src/engine/travelTables.ts`), partagée par
   *  `rencontres-edoc`/`incidents-monture`/`problemes-vehicule`. */
  const travelTableEntry = marquerProduit(nommerChamps(z.strictObject({
    min: z.number(),
    max: z.number(),
    id: z.string(),
    label: z.string(),
    desc: z.string(),
    stageOutcome: stageOutcomeSchema.optional(),
    vehicleWounds: tirageSchema.nullable().optional(),
    occupantOps: executeesDe(gameOp).optional(),
    /** Suite MÉCANIQUE d'un Incident de MONTE (`incidents-monture.json`, EDOC 07 l.157-174), miroir de
     *  `MountIncidentEffects` (`src/engine/travelTables.ts`) : elle est DÉCLARÉE par l'entrée, jamais
     *  déduite de son id. Une entrée sans `mount` ne laisse aucune séquelle. */
    mount: marquerProduit(nommerChamps(z.strictObject({
      /** Test du CAVALIER, sous peine de chute de `fallM` mètres (l.166/l.171). */
      riderTest: marquerProduit(nommerChamps(z.strictObject({
        test: flowTestSchema,
        fallM: z.number(),
      }).superRefine(fixerLeTest('skill', 'difficulty')), { test: { label: "Test" }, fallM: { label: "hauteur de chute" } }), 'construire', 'travelTableEntry.mount.riderTest').optional(),
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
    }), { riderTest: { label: "Test du cavalier" }, ridingPenalty: { label: "malus de Chevaucher" }, forcedAllure: { label: "allure imposée"  }, preventsMount: { label: "monture inutilisable" }, notHealedByCare: { label: "sans récupération par soins" }, endCondition: { label: "condition de fin" , texte: { regime: "narration",horsContrat: { motif: "catalogue",preuve: "src/data/schemas/defs/incidents-monture.ts:schema"}} }, outcome: { label: "issue"  , texte: { regime: "narration",horsContrat: { motif: "catalogue",preuve: "src/data/schemas/defs/incidents-monture.ts:schema"}} } }), 'construire', 'travelTableEntry.mount').optional(),
  }), { min: { label: "minimum" }, max: { label: "maximum" }, id: { label: "identifiant"  , texte: { regime: "technique"} }, label: { label: "libellé"  , texte: { regime: "designation"} }, desc: { label: "texte"  , texte: { regime: "narration",horsContrat: { motif: "catalogue",preuve: "src/data/schemas/defs/incidents-monture.ts:schema"}} }, stageOutcome: { label: "issue d’étape"  }, vehicleWounds: { label: "Blessures du véhicule"  , texte: { regime: "technique"} }, occupantOps: { label: "opérations des occupants" }, mount: { label: "monture" } }), 'construire', 'travelTableEntry');
  /**
   * `ShipCrewHit` (`src/data/shipCriticals.ts`) — ce qu'un Critique de coque fait à l'ÉQUIPAGE. Le
   * porteur dit QUI encaisse (`crewTarget`, REQUIS) ; l'ISSUE est SOIT une épreuve (le nœud `test` du
   * Flow, dont la branche d'échec porte la conséquence — MDG 13 l.763, MSRC 07 l.78/l.94), SOIT des
   * ops CERTAINES (`ops` — MSRC 07 l.82, où le livre n'appelle aucun jet). Les deux clefs sont
   * EXCLUSIVES.
   */
  const shipCrewHit = marquerProduit(nommerChamps(z
    .strictObject({
      crewTarget: crewTargetSchema,
      test: noeudTest(flow, { difficulteRequise: true, echecSeulServi: true }).optional(),
      ops: executeesDe(gameOp).optional(),
    })
    .superRefine((v, ctx) => {
      if (!v.test === !v.ops) {
        ctx.addIssue({
          code: 'custom',
          message: 'un coup à l’équipage porte SOIT une épreuve (`test`) SOIT une conséquence certaine (`ops`) — jamais les deux, jamais aucune.',
        });
      }
    }), { crewTarget: { label: "cible d’équipage" }, test: { label: "Test" }, ops: { label: "opérations" } }), 'construire', 'shipCrewHit');

  /** `ShipCritEntry` (`src/data/shipCriticals.ts`) — entrée d100 de Critique de coque, partagée par
   *  `ship-criticals` (navale) et `river-criticals` (fluviale). */
  const shipCritEntry = marquerProduit(nommerChamps(z.strictObject({
    ...plageSchema.shape,
    id: z.string(),
    label: z.string(),
    ops: executeesDe(gameOp).optional(),
    shrapnel: z.number().optional(),
    hullCrits: tirageSchema.optional(),
    crewHit: shipCrewHit.optional(),
    note: z.string(),
  }), { ...metaDesChamps(plageSchema, { exigees: true }), id: { label: "identifiant"  , texte: { regime: "technique"} }, label: { label: "libellé"  , texte: { regime: "designation"} }, ops: { label: "opérations" }, shrapnel: { label: "éclats" }, hullCrits: { label: "Critiques de coque"  , texte: { regime: "technique"} }, crewHit: { label: "coup à l’équipage" }, note: { label: "note"  , texte: { regime: "narration",horsContrat: { motif: "catalogue",preuve: "src/data/schemas/defs/ship-criticals.ts:schema"}} } }), 'construire', 'shipCritEntry');

  for (const noeud of [gameOp, effectOp, flow]) REGIMES_DES_NOEUDS.set(noeud, regimes);
  return { regimes, opDefs, condition, gameOp, effectOp, flow, triggeredEffect, travelTableEntry, shipCrewHit, shipCritEntry };
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
  const declares: readonly string[] = [...CHAMPS_A_CHOIX, ...CHAMPS_RESERVES, ...CONDITIONS_RESERVEES.map((k) => `condition.${k}`)];
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

/** La famille d'un champ d'effets déclenchés (`z.array(famille.triggeredEffect)`, facultatif ou non) : l'Atelier y
 *  lit l'algèbre de Condition et les ops que le porteur admet. Absent = champ hors famille. */
export function familleDesEffets(noeud: unknown): FamilleMecanique | undefined {
  let n = noeud;
  while (n instanceof z.ZodOptional) n = n.unwrap();
  const element = n instanceof z.ZodArray ? n.element : undefined;
  return element === undefined ? undefined : famillesConstruites().find((f) => f.triggeredEffect === element);
}

/** Les familles construites, en lecture seule — racines de la garde du masquage (`parse-de-mesure.test.ts`). */
export function famillesConstruites(): readonly FamilleMecanique[] {
  return [...FAMILLES.values()];
}

const FERMEE = mecaniqueDe({});
export const OP_DEFS: Readonly<Record<string, z.ZodType<unknown>>> = FERMEE.opDefs;
export const gameOpSchema: z.ZodType<GameOp> = FERMEE.gameOp;

/** Liste passive d'un porteur, lue par un collecteur de passifs (`passiveMods`, `weaponPassiveOps`, `navalPassiveOps`,
 *  passifs de maladie) : le marquage `auTotal` d'un `attrMod` de Blessures ne vit que sur le canal exécuté (`applyOps`,
 *  #3060), il est donc refusé ici. */
export function passifsDe(op: z.ZodType<GameOp> = gameOpSchema): z.ZodType<OpPassive[]> {
  const liste = z.array(op).superRefine((ops, ctx) => {
    ops.forEach((o, i) => {
      if (o.op === 'attrMod' && o.attr === 'wounds' && o.auTotal) {
        ctx.addIssue({
          code: 'custom',
          path: [i, 'auTotal'],
          message: '« auTotal » n’agit que sur une liste d’opérations EXÉCUTÉE (consommable, manœuvre, sort) : '
            + 'une liste passive ne marque pas ses modificateurs de Caractéristique. Retirer « auTotal ».',
        });
      }
    });
  });
  REGIMES_DES_LISTES.set(liste, 'passive');
  return liste as z.ZodType<OpPassive[]>;
}

/** Liste d'ops EXÉCUTÉE (`applyOps`, ou un interprète restreint : `applyStarOps`, `applyOnFailInline`) : `auTotal` y
 *  marque, sous `applyOps`, les modificateurs de Caractéristique qu'elle porte (#3060). */
export function executeesDe(op: z.ZodType<GameOp> = gameOpSchema): z.ZodArray<z.ZodType<GameOp>> {
  const liste = z.array(op);
  REGIMES_DES_LISTES.set(liste, 'executee');
  return liste;
}
export const effectOpSchema = FERMEE.effectOp;
export const flowSchema: z.ZodType<Flow<EffectOp>> = FERMEE.flow;
export const triggeredEffectSchema: z.ZodType<TriggeredEffect<EffectOp>> = FERMEE.triggeredEffect;
export const travelTableEntrySchema = FERMEE.travelTableEntry;
export const shipCrewHitSchema = FERMEE.shipCrewHit;
export const shipCritEntrySchema = FERMEE.shipCritEntry;
