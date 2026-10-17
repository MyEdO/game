/**
 * Attaques d'une créature DÉRIVÉES DE SES TRAITS (data, RAW — Livre de base, « Traits » p.338+).
 * Un trait d'attaque OCTROIE une/des MANŒUVRE(S) de 1ʳᵉ classe (`TraitData.grantsManeuvers` → dataset
 * `maneuvers`). `creatureAttacks` résout ces octrois par id (`findManeuverById`) et porte sur chaque
 * `CreatureAttack` la `ManeuverDef` ENTIÈRE (résolue ENSUITE par `state/combatManeuvers.resolveManeuver`)
 * + l'`indice` (le `+N` de l'instance de trait). On ne modélise QUE ce que la donnée écrit ; rien d'inventé.
 *
 * Le trait `Souffle` octroie les 6 souffles élémentaires ; la DÉSAMBIGUÏSATION est GÉNÉRIQUE : on choisit
 * la manœuvre dont le suffixe d'id (`souffle-feu`…) correspond à `norm(arg)` (« Feu » → souffle-feu),
 * sinon le défaut élémentaire `souffle-feu` (exotiques arbitrés MJ). Aucun regex « (Type) » en dur.
 */
import { formatTrait } from './traits/dispatch';
import { findTraitById, findManeuverById, maneuvers, type ManeuverDef } from '../data';
import { norm } from '../lib/normalize';
import { spellEffectOps } from './flowCore';
import type { TraitList } from './statEntry';
import type { Combatant } from './types';
import type { GameOp } from './ops';

/** Type d'attaque naturelle (geste + règle distincts). Sert UNIQUEMENT à l'anim/pose/icône. */
export type AttackKind = 'arme' | 'morsure' | 'caudale' | 'cornes' | 'souffle' | 'vomi' | 'tentacules' | 'etreinte' | 'regard' | 'langue' | 'hurlement' | 'pietinement';

/** Déclenchement RAW : action normale, gratuite (coût en Avantage), ou gratuite à la Charge. */
export type AttackTrigger = 'action' | 'free' | 'charge';

export interface CreatureAttack {
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
}

/** Choisit, parmi les manœuvres octroyées par un trait, celle qui correspond à l'argument de l'instance
 *  (Souffle « (Feu) » → `souffle-feu`). Désambiguïsation GÉNÉRIQUE par suffixe d'id ; défaut = 1ʳᵉ
 *  octroyée (un seul grant → elle ; Souffle exotique sans correspondance → `souffle-feu`, en tête). */
function pickGranted(ids: string[], arg?: string): ManeuverDef | undefined {
  if (ids.length === 1) return findManeuverById(ids[0]);
  const a = norm(arg ?? '').trim();
  const match = a ? ids.find((id) => norm(id).endsWith(a)) : undefined;
  return findManeuverById(match ?? ids[0]);
}

/** Attaques naturelles d'une créature à partir de ses traits : chaque trait d'attaque OCTROIE sa/ses
 *  manœuvre(s) (`grantsManeuvers`) ; on résout chaque octroi en `CreatureAttack` portant la `ManeuverDef`
 *  + l'Indice/compte/type lus de l'INSTANCE. Le libellé est reconstruit par `formatTrait`. Ajouter une
 *  attaque naturelle = un dataset `maneuvers` + un `grantsManeuvers` dans `traits.json` (jamais une table). */
export function creatureAttacks(traits: TraitList): CreatureAttack[] {
  const out: CreatureAttack[] = [];
  for (const x of traits) {
    const inst = x;
    const grants = findTraitById(inst.id)?.grantsManeuvers;
    if (!grants?.length) continue;
    const def = pickGranted(grants.map((r) => r.id), inst.arg);
    if (!def || def.ecartDeTailleMin != null) continue;
    const type = inst.arg && !/divers|au choix/i.test(inst.arg) ? inst.arg : undefined;
    const indice = inst.value ?? 0;
    out.push({
      kind: def.kind, label: formatTrait(inst), bonus: indice, indice, type, def,
      trigger: def.activation, avantage: def.advantageCost,
      ...(def.stat ? { stat: def.stat } : {}), ...(def.advantageMode ? { advantageMode: def.advantageMode } : {}),
      ...(inst.count != null ? { count: inst.count } : {}),
      ...(def.targeting === 'zone' ? { aoe: true } : {}), ...(def.magic ? { magic: true } : {}),
      ...(def.kind === 'tentacules' ? { perTentacle: true } : {}),
    });
  }
  return out;
}

/** Attaque d'une manœuvre ouverte par l'écart de Taille (`ecartDeTailleMin`) : aucun trait ne la porte,
 *  aucune instance n'en module l'Indice. LDB 85 l.387 ; LDB 85 l.344 */
function attaqueDEcart(def: ManeuverDef): CreatureAttack {
  return {
    kind: def.kind, label: def.label, bonus: 0, indice: 0, def, trigger: def.activation, avantage: def.advantageCost,
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
