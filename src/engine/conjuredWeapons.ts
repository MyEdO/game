/**
 * Armes INVOQUÉES temporaires (op `grantWeapon` — Arme aethyrique LDB 47, Faux de Shyish / Épée
 * ardente de Rhuin LDB 48). Une arme invoquée est un `ItemInstance` ORDINAIRE marqué `conjured`,
 * posé en inventaire et injecté en tête de `c.weapons` par `recomputeLoadout` (via le même `toWeapon`
 * que les armes tenues — aucune arme synthétique). Elle est retirée à l'expiration du Sort. Le SYSTÈME
 * réutilise donc entièrement la base d'armes (`itemFromTrapping`) et le loadout : seuls les Dégâts
 * (= BFM…) et l'Atout Magique sont surchargés par le Sort.
 */
import { Combatant, ItemInstance, QualityInstance } from './types';
import { recomputeLoadout, itemFromTrappingById, ensureDefaultLoadout, newLoadoutId, isUnarmedTrapping, isImprovisedTrapping } from './items';
import { isShieldItem } from './equipCompare';
import { hasQuality } from './qualities/dispatch';
import { trappings, byId } from '../data';

type ConjuredSet = NonNullable<NonNullable<Combatant['activeEffects']>[number]['conjuredSet']>;

/** Pose l'objet invoqué dans un SET d'armes DÉDIÉ (« Arme invoquée ») et l'active — l'arme devient
 *  l'arme du set actif, convertie par `recomputeLoadout` comme toute arme tenue (zéro injection
 *  parallèle). Garantit d'abord les sets réels (Set I/II) pour une restauration propre. Mute `c`. */
export function equipConjuredWeapon(c: Combatant, item: ItemInstance): ConjuredSet {
  c.items = c.items ?? [];
  c.items.push(item);
  ensureDefaultLoadout(c); // sets réels présents → restoreLoadoutId pointe un vrai set
  const restoreLoadoutId = c.activeLoadoutId;
  const loadoutId = newLoadoutId();
  c.loadouts = [...(c.loadouts ?? []), { id: loadoutId, main: item.uid }];
  c.activeLoadoutId = loadoutId;
  recomputeLoadout(c);
  return { itemUid: item.uid, loadoutId, ...(restoreLoadoutId ? { restoreLoadoutId } : {}) };
}

/** À l'expiration d'effets accordant des armes : (a) arme INVOQUÉE → retire l'objet ET son set et
 *  réactive le set d'origine ; (b) arme NATURELLE accordée (op grantNaturalWeapon) → simple recompute
 *  (l'effet porteur a déjà été retiré). Recompose le loadout si besoin. Pur ; mute `c`. */
export function dropExpiredGrantedWeapons(
  c: Combatant,
  expired: { conjuredSet?: ConjuredSet; naturalWeapon?: unknown; enchantRef?: { itemUid: string; enchantId: string } }[],
): void {
  const sets = expired.map((e) => e.conjuredSet).filter((s): s is ConjuredSet => !!s);
  for (const s of sets) {
    c.items = (c.items ?? []).filter((it) => it.uid !== s.itemUid);
    c.loadouts = (c.loadouts ?? []).filter((lo) => lo.id !== s.loadoutId);
    if (c.activeLoadoutId === s.loadoutId) c.activeLoadoutId = s.restoreLoadoutId ?? c.loadouts?.[0]?.id;
  }
  // Enchantements TEMPORISÉS (op augmentWeapon) : retirer l'enchant expiré de SON objet (l'objet reste).
  let enchantCleared = false;
  for (const e of expired) {
    if (!e.enchantRef) continue;
    const it = (c.items ?? []).find((i) => i.uid === e.enchantRef!.itemUid);
    if (it?.enchants?.length) {
      it.enchants = it.enchants.filter((x) => x.id !== e.enchantRef!.enchantId);
      if (!it.enchants.length) delete it.enchants;
      enchantCleared = true;
    }
  }
  if (sets.length || enchantCleared || expired.some((e) => e.naturalWeapon)) recomputeLoadout(c);
}

/** FORME d'arme invoquée à forme libre (Arme aethyrique : « n'importe quelle forme, n'importe quelle
 *  Compétence de Corps à corps que vous possédez », LDB 47). `weapon` = arme RÉELLE de la base dont on
 *  clone le profil (Groupe/allonge/mains) ; `group` = sa Spécialisation de Corps à corps. */
export interface ConjureForm {
  weapon: string; // `id` d'une arme réelle (trapping) — son profil est cloné (label résolu à l'affichage)
  group: string; // `id` du Groupe / Spé de Corps à corps appliquée par combatValue
}

/** Une arme de mêlée est-elle un objet À INVOQUER ? Exclut les boucliers, l'Arme improvisée, les Mains
 *  nues et les armes Inoffensives — PAS « Arme simple » (= épée/hache/marteau/masse/lance courte, l'arme
 *  de base la plus commune, cf. sa description). Détection par CHAMPS DÉCLARÉS sur l'entrée de catalogue
 *  (`TrappingData.unarmed`/`improvised`) et par Atouts (Protectrice = bouclier, Inoffensive) — le moteur
 *  ne nomme aucun id. Les deux marques déclarées sont aujourd'hui REDONDANTES avec l'Atout Inoffensive que
 *  ces mêmes entrées portent (leur retrait ne changerait aucun comportement mesurable) : elles gardent la
 *  règle d'une édition de qualité au Compendium, elles ne la portent pas seules. */
function isConjurableWeapon(it: { trappingId?: string; qualities: QualityInstance[] }): boolean {
  if (isUnarmedTrapping(it.trappingId) || isImprovisedTrapping(it.trappingId)) return false;
  if (isShieldItem(it)) return false;
  if (hasQuality(it, 'inoffensive')) return false;
  return true;
}

/** Formes proposées au lanceur : « n'importe quelle Compétence de Corps à corps que vous POSSÉDEZ »
 *  (LDB 47) → TOUTES les armes réelles des Spécialisations de Corps à corps connues (le lanceur
 *  CHOISIT son arme), les Spé les mieux entraînées d'abord. Aucune Spé → l'arme de base par défaut. */
export function conjureFormOptions(caster: Pick<Combatant, 'skills'>): ConjureForm[] {
  const groupAdv = new Map<string, number>(); // id de Groupe → meilleures avances connues
  // « Compétence de Corps à corps » = compétence dont les SPÉ sont les Groupes d'armes de mêlée : c'est
  // la déclaration `specsSource` de son entrée de `skills.json` — et c'est exactement la garantie dont la
  // suite a besoin (`s.spec` EST alors un id de Groupe, comparable à `it.subType`).
  for (const s of caster.skills ?? []) {
    if (byId('skill', s.id)?.specsSource === 'weaponGroupsMelee' && s.spec) {
      groupAdv.set(s.spec, Math.max(groupAdv.get(s.spec) ?? 0, s.advances ?? 0));
    }
  }
  if (!groupAdv.size) groupAdv.set('base', 0); // mage sans Spé → armes de base
  const out: { weapon: string; group: string; adv: number }[] = [];
  for (const t of trappings) {
    if (t.service) continue; // tarif de service (LDB 66 l.12-14) — pas un objet, itemFromTrappingById refuse
    const it = itemFromTrappingById(t.id);
    if (it?.kind !== 'melee' || !it.subType || !isConjurableWeapon(it)) continue;
    // groupAdv est keyé par id de Groupe ; it.subType EST l'id de Groupe de l'arme → match direct.
    const adv = groupAdv.get(it.subType);
    if (adv == null) continue;
    out.push({ weapon: t.id, group: it.subType, adv });
  }
  out.sort((a, b) => b.adv - a.adv); // meilleure Spé d'abord (l'ordre des armes dans la base sinon)
  const forms = out.map(({ weapon, group }) => ({ weapon, group }));
  return forms.length ? forms : [{ weapon: 'arme-simple', group: 'base' }];
}
