/**
 * Dérivation PURE « traits → équipement » (armes jouables + armure en PA) d'une créature/statbloc.
 * SOURCE UNIQUE, partagée par le SPAWN de combat (`state/spawn`) ET le RENDU d'exploration (`gameIso`).
 * Vit dans `engine` (pur, ne dépend de rien d'en haut) → importable par le rendu SANS cycle de couches
 * (`state/spawn` importe déjà `gameIso`, donc `gameIso` ne peut pas importer `state/spawn`).
 */
import type { Weapon, ArmourPoints } from './types';
import type { TraitInstance, TraitList } from './statEntry';
import { buildWeapon, emptyArmour, itemFromTrappingById, weaponFromItem } from './items';
import type { ItemInstance, WeaponDamageSpec } from './types';
import { findResolvedTrait, traitLabelById } from './traits/dispatch';
import { findTraitById, findTrappingById, SPEC_SOURCES } from '../data/index';

/** Arme depuis un `trappingId` d'authoring de scène (`SceneEntity.weapon`) : lookup EXACT au catalogue
 *  (`findTrappingById`) puis PROJECTION UNIQUE `weaponFromItem` (engine/items) — Dégâts, Portée (y compris
 *  la spec `{bf}` des armes de JET), Groupe (`subType`/`weaponGroup`), qualités, Recharge, mains, Allonge,
 *  forme, Taille prévue, effets à la touche et bande de portée MINIMALE viennent TOUS du catalogue, jamais
 *  d'un littéral : cette arme est jouable (bandes de tir `effectiveWeaponRange`, Spécialisation
 *  `weaponGroupSkillMode`) autant que dessinée. Id introuvable OU trapping qui n'est pas une arme → `null`
 *  + `console.error` : l'entité reste désarmée, rien d'inventé (aucune arme devinée depuis un id mort). */
export function weaponFromId(trappingId: string): Weapon | null {
  const trapping = findTrappingById(trappingId);
  if (!trapping) {
    console.error(`[weapon] trappingId « ${trappingId} » introuvable au catalogue d'armes (#223) — entité désarmée, rien d'inventé.`);
    return null;
  }
  if (trapping.categorie !== 'melee' && trapping.categorie !== 'ranged') {
    console.error(`[weapon] trapping « ${trappingId} » (catégorie « ${trapping.categorie} ») n'est pas une arme — entité désarmée, rien d'inventé.`);
    return null;
  }
  const it = itemFromTrappingById(trappingId);
  return it ? weaponFromItem(it) : null;
}

/**
 * Résout l'`arg` d'un trait `arme`/`a-distance` (`specsSource` `weaponsMelee`/`weaponsRanged`, cf.
 * `data/index.ts`) vers la POSSESSION de catalogue correspondante — l'`arg` porte alors un `id` STABLE
 * (validité : `SPEC_SOURCES[source].resolves`, qui garantit AUSSI le type melee/ranged), plus un libellé.
 * `undefined` pour un `arg` NATUREL/libre/absent (« Griffes », « Crocs »…) : ces traits sont `specsOpen`
 * (RAW : attaques naturelles ou génériques acceptées hors catalogue) — le rendu retombe alors sur le
 * comportement générique/naturel.
 */
function catalogItem(arg: string | undefined, source: 'weaponsMelee' | 'weaponsRanged'): ItemInstance | undefined {
  return arg && SPEC_SOURCES[source].resolves(arg) ? (itemFromTrappingById(arg) ?? undefined) : undefined;
}

/**
 * Arme de créature dérivée d'une Possession de CATALOGUE : la projection UNIQUE `weaponFromItem`
 * (engine/items) porte TOUT le profil — le STATBLOC ne surcharge que ce qu'il IMPRIME, l'Indice de
 * Dégâts et la Portée du trait (LDB 85 l.9). `reload` DÉRIVE de la Qualité Recharge (LDB 62 l.333)
 * dans la projection : l'armement de créature étant en Traits, sans qualité portée, une arbalète de
 * bestiaire n'aurait sinon aucun défaut Recharge.
 */
function creatureWeapon(it: ItemInstance, dmg: WeaponDamageSpec, range: number | undefined): Weapon {
  const w = weaponFromItem(it);
  w.damage = dmg;
  if (range !== undefined) w.range = range;
  return w;
}

/**
 * Parse UN trait d'arme WFRP4 (français) en arme jouable, ou null. Gère le TYPE
 * entre parenthèses (l'armement des monstres est dans les Traits) :
 *   « Arme +7 », « Arme (Épée) +7 », « Arme (Dague) +4 », « Arme (griffes) »,
 *   « À distance (Arbalète) +9 (60) », « À distance +8 (50) », « Morsure +9 ».
 * Le `name` = le TYPE quand il est manufacturé (→ le rig tient cette arme) ; sinon
 * une étiquette naturelle (→ weaponFamily renvoie '' = aucune arme dessinée).
 */
export function weaponFromTrait(t: TraitInstance): Weapon | null {
  // Indice de créature = SB déjà inclus → PAS de token BF (« +N », « -N » négatif) ; à défaut d'Indice,
  // arme générique « +BF » nu (SB-relatif). Le constructeur d'arme UNIQUE porte les deux conventions.
  const dmg: WeaponDamageSpec = t.value != null ? { plusBF: false, flat: t.value } : { plusBF: true, flat: 0, bare: true };
  // Quel(s) Trait(s) ARMENT une créature est DÉCLARÉ par l'entrée du registre : `specsSource` nomme LE
  // catalogue où se résout son `arg` (`weaponsMelee`/`weaponsRanged`, cf. `SPEC_SOURCES`). Un troisième
  // trait porteur d'arme coûte cette ligne de `traits.json` — et la source passée à `catalogItem` EST
  // celle qui est déclarée, sans second champ à tenir synchrone.
  const source = findTraitById(t.id)?.specsSource;
  if (source === 'weaponsRanged') {
    if (t.value == null) return null; // « À distance » sans Indice de Dégâts : pas une arme jouable (RAW)
    const it = catalogItem(t.arg, source);
    if (it) return creatureWeapon(it, dmg, t.range);
    // Arme naturelle/libre (arg hors catalogue, ou absent) : aucun `trappingId`, aucune forme résolue (le rendu retombe sur le Groupe).
    return buildWeapon({ label: t.arg || 'Attaque à distance', type: 'ranged', damage: dmg, range: t.range ?? undefined });
  }
  if (source === 'weaponsMelee') {
    // Attaque naturelle de corps (flag DONNÉE `natural`) → aucune arme dessinée (aucune forme résolue).
    if (t.natural) return buildWeapon({ label: t.arg ?? 'Arme', damage: dmg, natural: true });
    const it = catalogItem(t.arg, source);
    if (it) return creatureWeapon(it, dmg, t.range);
    // Arme manufacturée hors catalogue, ou descripteur naturel non flaggé : générique, mêlée par
    // défaut — REND toujours une silhouette (`weaponFamily` retombe sur le Groupe, ex. « épée »).
    // `sizeless` (≠ `natural`, qui viderait les mains) : le trait « Arme +N » SANS objet identifié au
    // catalogue n'est jamais une POSSESSION dont la Taille pourrait ne pas convenir (ADE II 2
    // l.604-710 vise un objet manufacturé réel, ex. une massue-ogre) — sa taille effective EST celle
    // du porteur (LDB 85 l.33), exemptée du mismatch (`combat.ts`) sans toucher au rendu.
    return buildWeapon({ label: t.arg ?? 'Arme', damage: dmg, sizeless: true });
  }
  // Attaque naturelle TYPÉE (Morsure, Cornes, Tentacules…) : reconnue par la CAPACITÉ du trait
  // (`capabilities.naturalWeapon`, donnée). L'arme reste UNE (l'Action d'attaque) ; le compte joue sur
  // les Attaques GRATUITES (aiCreatureFreeAttacks, LDB 85 l.405). `natural` → aucune arme tenue dessinée.
  // `attackKind = t.id` (l'id du trait EST le kind : morsure/cornes/tentacules) → la pose/anim route par
  // ce champ STABLE (handlingClass), jamais par le libellé.
  const nat = findTraitById(t.id)?.capabilities?.naturalWeapon;
  if (nat) return buildWeapon({ label: traitLabelById(t.id), type: nat.ranged ? 'ranged' : 'melee', damage: dmg, natural: true, attackKind: t.id });
  return null;
}

/** Armes EXPLICITES d'une créature (traits « Arme »/« À distance »/naturelles), SANS arme générique de
 *  repli. Pour le RENDU : une créature sans trait d'arme reste mains libres (un villageois ne tient rien) —
 *  le repli « Arme +BF » générique de `weaponsFromTraits` serait dessiné comme une épée (cf. weaponFamily). */
export function renderWeaponsFromTraits(traits: TraitList): Weapon[] {
  const weapons: Weapon[] = [];
  for (const t of traits) {
    const w = weaponFromTrait(t);
    if (w) weapons.push(w);
  }
  return weapons;
}

/** Armes JOUABLES (combat) : comme `renderWeaponsFromTraits`, mais garantit AU MOINS une arme (« Arme »
 *  générique = poings) pour qu'un combattant puisse toujours frapper, même sans trait d'arme. */
export function weaponsFromTraits(traits: TraitList): Weapon[] {
  const weapons = renderWeaponsFromTraits(traits);
  if (weapons.length === 0) weapons.push(buildWeapon({ label: 'Arme', damage: { literal: '+BF' } })); // uid universel
  return weapons;
}

/** PA plats du trait « Armure (Indice) » (LDB 85, profils d'éditeur) — lus par le REGISTRE des
 *  Traits (Indice ou argument), jamais par une regex propre. 0 si absent. */
export function armourFromTraits(traits: TraitList): ArmourPoints {
  const r = findResolvedTrait(traits, 'armure');
  const n = r ? Number(r.indice ?? r.arg ?? 0) : 0;
  return emptyArmour(Number.isFinite(n) ? n : 0);
}
