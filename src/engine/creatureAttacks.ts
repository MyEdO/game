/**
 * Attaques d'une créature DÉRIVÉES DE SES TRAITS (data, RAW — Livre de base, « Traits » p.338+).
 * Un trait d'attaque OCTROIE une/des MANŒUVRE(S) de 1ʳᵉ classe (`TraitData.grantsManeuvers` → dataset
 * `maneuvers`). `creatureAttacks` résout ces octrois par id (`findManeuverById`) et porte sur chaque
 * `CreatureAttack` la `ManeuverDef` ENTIÈRE (résolue ENSUITE par `noyau/combatManeuvers.resolveManeuver`)
 * + l'`indice` (le `+N` de l'instance de trait). On ne modélise QUE ce que la donnée écrit ; rien d'inventé.
 *
 * Le trait `Souffle` octroie la manœuvre `souffle`, que `souffleDuType` compose avec les règles de son
 * Type (`breath-types.json`).
 */
import { formatTrait } from './traits/dispatch';
import { findTraitById, findManeuverById, findBreathTypeById, findConditionById, maneuvers, type BreathTypeData, type ManeuverDef } from '../data';
import { t } from '../i18n';
import { reecrireLesOps, spellEffectOps } from './flowCore';
import type { TraitInstance, TraitList } from './statEntry';
import { DIFFICULTY_LABELS, type Combatant, type Difficulty } from './types';
import type { GameOp } from './ops';

/** Type d'attaque naturelle (geste + règle distincts). Sert UNIQUEMENT à l'anim/pose/icône. */
export type AttackKind = 'arme' | 'morsure' | 'caudale' | 'cornes' | 'souffle' | 'vomi' | 'tentacules' | 'etreinte' | 'regard' | 'langue' | 'hurlement' | 'pietinement';

/** Déclenchement RAW : action normale, gratuite (coût en Avantage), ou gratuite à la Charge. */
export type AttackTrigger = 'action' | 'free' | 'charge';

export interface CreatureAttack {
  /** Clé de l'attaque parmi celles du porteur (`clesDesAttaques`) : l'id de sa manœuvre, distingué par le
   *  rang quand deux Traits octroient la même (deux Souffles de Types différents). LDB 85 l.322 */
  cle: string;
  kind: AttackKind;
  /** Libellé canonique du trait (« Morsure +10 », « Attaque caudale +9 »…). */
  label: string;
  /** Indice de Dégâts (« +N », BF inclus) si présent, sinon 0 — lu de l'INSTANCE du trait. */
  bonus: number;
  /** Alias explicite de `bonus` pour la résolution de Dégâts (`{indiceOf}`) — l'Indice de la manœuvre. */
  indice: number;
  /** Comment l'attaque se déclenche (dérivé de `def.activation`). */
  trigger: AttackTrigger;
  /** Coût en Avantage de l'Attaque gratuite (dérivé de `def.advantageCost`). */
  avantage: number;
  /** Caractéristique du jet d'attaquant (capacite-de-combat mêlée / capacite-de-tir distance·zone) ;
   *  absent = pas de jet d'attaquant (Hurlement : chaque cible teste sa Résistance). */
  stat?: 'capacite-de-combat' | 'capacite-de-tir';
  /** Gestion de l'Avantage dépensé : `fixed` (défaut) / `variable` (Regard) / `all` (Hurlement). */
  advantageMode?: 'fixed' | 'variable' | 'all';
  /** Attaque de ZONE (Souffle/Vomi) — dérivé de `def.targeting === 'zone'`. */
  aoe?: boolean;
  /** Attaque magique (Souffle, Étreinte glaciale). */
  magic?: boolean;
  /** Une Attaque gratuite PAR tentacule (le résolveur n'en dépend pas ; l'IA boucle dessus). */
  perTentacle?: boolean;
  /** Nombre porté EN TÊTE du trait (« 8 Tentacules +9 » → 8). */
  count?: number;
  /** Aspect/Type entre parenthèses (Souffle : Feu/Froid/… ; affiché au feed). */
  type?: string;
  /** La MANŒUVRE de 1ʳᵉ classe résolue (profil + effets AUTHORÉS) — source de TOUTE la résolution. */
  def: ManeuverDef;
  /** Traits que confère l'attaque (`TraitPose.confere`). ZI 03 l.75, l.77 */
  confere?: TraitInstance[];
}

/** Les Types dont un Type de Souffle applique les règles : lui-même, ou ceux qu'il nomme. EDOC 13 l.237 */
const typesAppliques = (t: BreathTypeData): BreathTypeData[] =>
  t.types?.length ? t.types.flatMap((r) => findBreathTypeById(r.id) ?? []) : [t];

/** Ce que la règle d'un Type fait aux cibles touchées. La Difficulté du Trait est celle des États posés.
 *  LDB 85 l.324-328 ; MDG 16 l.226 ; LDB 16 l.70 */
function opsDeLaRegle(r: BreathTypeData, difficulte: Difficulty | undefined): GameOp[] {
  return [
    ...(r.etat ? [{ op: 'condition' as const, id: r.etat, ...(difficulte ? { difficulte } : {}) }] : []),
    ...(r.endommageLEquipement ? [{ op: 'damageArmour' as const, material: 'cuir' as const }] : []),
  ];
}

/** Ce que les règles du Type font au défenseur, en clair : le trou `regleDuType` de l'enjeu du Souffle.
 *  LDB 85 l.322-329 ; MDG 16 l.226 */
function regleDuType(regles: BreathTypeData[], difficulte: Difficulty | undefined): string {
  const suites = regles.flatMap((r) => [
    ...(r.etat ? [difficulte
      ? t('souffle.enjeu.etatDifficulte', { etat: findConditionById(r.etat)?.label ?? r.etat, difficulte: DIFFICULTY_LABELS[difficulte] })
      : t('souffle.enjeu.etat', { etat: findConditionById(r.etat)?.label ?? r.etat })] : []),
    ...(r.endommageLEquipement ? [t('souffle.enjeu.equipement')] : []),
    ...(r.fumee ? [t('souffle.enjeu.fumee')] : []),
  ]);
  return (regles.some((r) => r.ignoreAP) ? t('souffle.enjeu.pa') : '')
    + (suites.length ? t('souffle.enjeu.puis', { suites: suites.join(t('souffle.enjeu.et')) }) : '');
}

/** Le Souffle `base` composé avec les règles de son Type ; un Type hors registre garde le Souffle seul.
 *  LDB 85 l.320-329 ; EDOC 13 l.237 */
export function souffleDuType(base: ManeuverDef, typeId: string | undefined, difficulte?: Difficulty): ManeuverDef {
  const type = findBreathTypeById(typeId);
  const regles = type ? typesAppliques(type) : [];
  const ignoreAP = regles.some((r) => r.ignoreAP);
  const ops = regles.flatMap((r) => opsDeLaRegle(r, difficulte));
  const effets = (base.effects ?? []).map((e) => ({ ...e, flow: reecrireLesOps(e.flow, (o) => (o.op === 'wounds' && ignoreAP ? { ...o, ignoreAP: true } : o)) }));
  return {
    ...base,
    label: type ? `${base.label} (${type.label})` : base.label,
    effects: ops.length ? [...effets, { trigger: 'onHit', on: 'victim', flow: { kind: 'do', effect: { type: 'ops', on: 'target', ops } } }] : effets,
    ...(regles.some((r) => r.fumee) ? { fumee: true } : {}),
    enjeu: { regleDuType: regleDuType(regles, difficulte) },
  };
}

/** La manœuvre que l'instance tire d'un octroi : composée avec son Type quand le Trait prend un Type de
 *  Souffle pour argument. LDB 85 l.322 */
function manoeuvreDeLInstance(id: string, inst: TraitInstance): ManeuverDef | undefined {
  const def = findManeuverById(id);
  return def && findTraitById(inst.id)?.specsSource === 'breathTypes' ? souffleDuType(def, inst.arg, inst.difficulte) : def;
}

/** Attaques naturelles d'une créature à partir de ses traits : chaque trait d'attaque OCTROIE sa/ses
 *  manœuvre(s) (`grantsManeuvers`) ; on résout chaque octroi en `CreatureAttack` portant la `ManeuverDef`
 *  + l'Indice/compte/type lus de l'INSTANCE. Le libellé est reconstruit par `formatTrait`. Ajouter une
 *  attaque naturelle = un dataset `maneuvers` + un `grantsManeuvers` dans `traits.json` (jamais une table). */
export function creatureAttacks(traits: TraitList): CreatureAttack[] {
  const out: CreatureAttack[] = [];
  for (const inst of traits) {
    for (const g of findTraitById(inst.id)?.grantsManeuvers ?? []) {
      const def = manoeuvreDeLInstance(g.id, inst);
      if (!def || def.ecartDeTailleMin != null || def.targeting === 'self') continue;
      const type = inst.arg && !/divers|au choix/i.test(inst.arg) ? inst.arg : undefined;
      const indice = inst.value ?? 0;
      out.push({
        cle: def.id, kind: def.kind, label: formatTrait(inst), bonus: indice, indice, type, def,
        trigger: def.activation, avantage: def.advantageCost,
        ...(def.stat ? { stat: def.stat } : {}), ...(def.advantageMode ? { advantageMode: def.advantageMode } : {}),
        ...(inst.count != null ? { count: inst.count } : {}),
        ...(def.targeting === 'zone' ? { aoe: true } : {}), ...(def.magic ? { magic: true } : {}),
        ...(def.kind === 'tentacules' ? { perTentacle: true } : {}),
        ...(inst.confere?.length ? { confere: inst.confere } : {}),
      });
    }
  }
  return clesDesAttaques(out);
}

/** Les attaques, chacune sous sa clé : l'id de sa manœuvre, suffixé de son rang parmi celles qui partagent
 *  cet id. LDB 85 l.322 */
function clesDesAttaques(attaques: CreatureAttack[]): CreatureAttack[] {
  const rangs = new Map<string, number>();
  return attaques.map((a) => {
    const rang = rangs.get(a.def.id) ?? 0;
    rangs.set(a.def.id, rang + 1);
    return rang ? { ...a, cle: `${a.def.id}~${rang + 1}` } : a;
  });
}

/** L'attaque naturelle de clé `cle` parmi celles que les Traits octroient. */
export const attaqueDeCle = (traits: TraitList, cle: string): CreatureAttack | undefined =>
  creatureAttacks(traits).find((a) => a.cle === cle);

/** Attaque d'une manœuvre ouverte par l'écart de Taille (`ecartDeTailleMin`) : aucun trait ne la porte,
 *  aucune instance n'en module l'Indice. LDB 85 l.387 ; LDB 85 l.344 */
function attaqueDEcart(def: ManeuverDef): CreatureAttack {
  return {
    cle: def.id, kind: def.kind, label: def.label, bonus: 0, indice: 0, def, trigger: def.activation, avantage: def.advantageCost,
    ...(def.stat ? { stat: def.stat } : {}), ...(def.advantageMode ? { advantageMode: def.advantageMode } : {}),
  };
}

/** LISTE UNIQUE des attaques naturelles d'un combattant : celles de ses traits (`creatureAttacks`), puis
 *  chaque manœuvre d'écart de Taille, une fois par DÉFINITION — tout combattant y a droit, héros compris.
 *  Lue par la barre d'attaques, la file de l'IA, le coût, l'arme et les effets d'une gratuite. LDB 85 l.387 */
export function attaquesNaturelles(traits: TraitList): CreatureAttack[] {
  return [...creatureAttacks(traits), ...maneuvers.filter((d) => d.ecartDeTailleMin != null).map(attaqueDEcart)];
}

/** L'attaque naturelle `kind` de la liste unique (`attaquesNaturelles`). */
export const attaqueNaturelle = (traits: TraitList, kind: string): CreatureAttack | undefined =>
  attaquesNaturelles(traits).find((a) => a.kind === kind);

// ---------------------------------------------------------------------------
// Capacités SUR SOI (targeting:'self') — transformation/mue/auto-buff octroyées par un trait
// ---------------------------------------------------------------------------

/** Manœuvres SUR SOI (`targeting:'self'`) octroyées par les traits de `c` (Métamorphose humain↔hybride de
 *  l'Enfant d'Ulric…). SÉPARÉ de `creatureAttacks` (orienté attaque : une manœuvre par trait). PUR. */
export function selfManeuversOf(c: Combatant): ManeuverDef[] {
  const out: ManeuverDef[] = [];
  for (const tr of c.traits ?? [])
    for (const r of findTraitById(tr.id)?.grantsManeuvers ?? []) {
      const def = findManeuverById(r.id);
      if (def?.targeting === 'self') out.push(def);
    }
  return out;
}

/** `tag` du 1ᵉʳ op `transform`/`endTransform` des effets d'une manœuvre self (gate d'applicabilité GÉNÉRIQUE
 *  dérivé de la DONNÉE — aucun nom d'entité en dur). */
function formTagOf(def: ManeuverDef, opName: 'transform' | 'endTransform'): string | undefined {
  for (const e of def.effects ?? [])
    for (const o of spellEffectOps(e.flow)) if (o.op === opName) return (o as Extract<GameOp, { op: 'transform' | 'endTransform' }>).tag;
  return undefined;
}

/** Une manœuvre self est-elle APPLICABLE à `c` maintenant ? `transform` → hors de la forme (tag absent) ;
 *  `endTransform` → dans la forme (un `activeEffect` porte ce label). Autre self-buff → toujours. PUR. */
export function selfManeuverApplicable(c: Combatant, def: ManeuverDef): boolean {
  const inForm = (tag: string) => (c.activeEffects ?? []).some((e) => e.effectId === tag);
  const tIn = formTagOf(def, 'transform');
  if (tIn) return !inForm(tIn); // « prendre la forme » : seulement hors de la forme
  const tOut = formTagOf(def, 'endTransform');
  if (tOut) return inForm(tOut); // « reprendre la forme de base » : seulement dans la forme
  return true;
}
