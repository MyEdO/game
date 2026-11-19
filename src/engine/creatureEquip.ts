/**
 * Dérivation PURE « traits → équipement » (armes jouables + armure en PA) d'une créature/statbloc.
 * SOURCE UNIQUE, partagée par le SPAWN de combat (`noyau/monde/spawn`), `recomputeLoadout` ET le RENDU d'exploration.
 * Vit dans `engine` (pur, ne dépend de rien d'en haut) → importable par le noyau ET par le rendu
 * (`scripts/guards/lib/couches.mjs`).
 */
import type { ArmourPoints, Combatant, HitLocation, ItemInstance, Weapon } from './types';
import type { TraitInstance, TraitList } from './statEntry';
import {
  buildWeapon,
  cleDInstanceDeTrait,
  emptyArmour,
  estUneVraieArme,
  gabaritDObjet,
  peutEtreTenu,
  uidDArme,
  unarmedWeapon,
  weaponFromItem,
  type GabaritDObjet,
  type TrappingResolver,
} from './items';
import { armureDuTrait } from './armourBypass';
import { itemCapability } from './capabilities';
import type { WeaponDamageSpec } from './types';
import { traitLabelById } from './traits/dispatch';
import { findTraitById, findTrappingById, SPEC_SOURCES } from '../data/index';

/**
 * Résout l'`arg` d'un trait `arme`/`a-distance` (`specsSource` `weaponsMelee`/`weaponsRanged`, cf.
 * `data/index.ts`) vers la POSSESSION de catalogue correspondante — l'`arg` porte alors un `id` STABLE
 * (univers de l'entrée résolue : `SPEC_SOURCES[source].admetEntree`), plus un libellé.
 * `undefined` pour un `arg` NATUREL/libre/absent (« Griffes », « Crocs »…) : ces traits sont `specsOpen`
 * (RAW : attaques naturelles ou génériques acceptées hors catalogue) — le rendu retombe alors sur le
 * comportement générique/naturel.
 */
function catalogItem(arg: string | undefined, source: 'weaponsMelee' | 'weaponsRanged', resolveTrapping: TrappingResolver): GabaritDObjet | undefined {
  const entree = arg ? resolveTrapping(arg) : undefined;
  return entree && SPEC_SOURCES[source].admetEntree(entree)
    ? (gabaritDObjet(entree.id, resolveTrapping) ?? undefined) : undefined;
}

/**
 * Arme de créature dérivée d'une Possession de CATALOGUE : la projection UNIQUE `weaponFromItem`
 * (engine/items) porte TOUT le profil — le STATBLOC ne surcharge que ce qu'il IMPRIME, l'Indice de
 * Dégâts et la Portée du trait (LDB 85 l.9). `reload` DÉRIVE de la Qualité Recharge (LDB 62 l.333)
 * dans la projection : l'armement de créature étant en Traits, sans qualité portée, une arbalète de
 * bestiaire n'aurait sinon aucun défaut Recharge.
 */
function creatureWeapon(it: GabaritDObjet, uid: string, dmg: WeaponDamageSpec, range: number | undefined): Weapon {
  const w = weaponFromItem({ ...it, uid });
  w.damage = dmg;
  if (range !== undefined) w.range = range;
  return w;
}

/**
 * Parse UN trait d'arme WFRP4 (français) en arme jouable, ou null. Gère le TYPE
 * entre parenthèses (l'armement des monstres est dans les Traits) :
 *   « Arme +7 », « Arme (Épée) +7 », « Arme (Dague) +4 », « Arme (griffes) »,
 *   « À distance (Arbalète) +9 (60) », « À distance +8 (50) », « Morsure +9 ».
 * Le `name` = le TYPE quand il est manufacturé ; sinon une étiquette naturelle.
 */
export function weaponFromTrait(t: TraitInstance, resolveTrapping: TrappingResolver = findTrappingById): Weapon | null {
  const w = armeDuTrait(t, resolveTrapping);
  return w && t.confere?.length ? { ...w, traitsConferes: t.confere } : w;
}

/** L'arme d'un Trait d'arme, sans les Traits qu'il confère (`weaponFromTrait`). */
function armeDuTrait(t: TraitInstance, resolveTrapping: TrappingResolver): Weapon | null {
  // Indice de créature = SB déjà inclus → PAS de token BF (« +N », « -N » négatif) ; à défaut d'Indice,
  // arme générique « +BF » nu (SB-relatif). Le constructeur d'arme UNIQUE porte les deux conventions.
  const uid = `trait-${cleDInstanceDeTrait(t)}`; // #2907
  const dmg: WeaponDamageSpec = t.value != null
    ? { plusBF: false, flat: t.value, ...(findTraitById(t.id)?.bfInclus ? { bfInclus: true as const } : {}) }
    : { plusBF: true, flat: 0, bare: true };
  // Quel(s) Trait(s) ARMENT une créature est DÉCLARÉ par l'entrée du registre : `specsSource` nomme LE
  // catalogue où se résout son `arg` (`weaponsMelee`/`weaponsRanged`, cf. `SPEC_SOURCES`). Un troisième
  // trait porteur d'arme coûte cette ligne de `traits.json` — et la source passée à `catalogItem` EST
  // celle qui est déclarée, sans second champ à tenir synchrone.
  const source = findTraitById(t.id)?.specsSource;
  if (source === 'weaponsRanged') {
    if (t.value == null) return null; // « À distance » sans Indice de Dégâts : pas une arme jouable (RAW)
    const it = catalogItem(t.arg, source, resolveTrapping);
    if (it) return creatureWeapon(it, uid, dmg, t.range);
    // Arme naturelle/libre (arg hors catalogue, ou absent) : aucun `trappingId`, aucune forme résolue (le rendu retombe sur le Groupe).
    return buildWeapon({ label: t.arg || 'Attaque à distance', type: 'distance', damage: dmg, range: t.range ?? undefined, uid });
  }
  if (source === 'weaponsMelee') {
    // Attaque naturelle de corps (flag DONNÉE `natural`) → aucune arme dessinée (aucune forme résolue).
    if (t.natural) return buildWeapon({ label: t.arg ?? 'Arme', damage: dmg, natural: true, uid });
    const it = catalogItem(t.arg, source, resolveTrapping);
    if (it) return creatureWeapon(it, uid, dmg, t.range);
    // Arme manufacturée hors catalogue, ou descripteur naturel non flaggé : générique, mêlée par
    // défaut.
    // `sizeless` (≠ `natural`, qui viderait les mains) : le trait « Arme +N » SANS objet identifié au
    // catalogue n'est jamais une POSSESSION dont la Taille pourrait ne pas convenir (ADE II 2
    // l.604-710 vise un objet manufacturé réel, ex. une massue-ogre) — sa taille effective EST celle
    // du porteur (LDB 85 l.33), exemptée du mismatch (`combat.ts`) sans toucher au rendu.
    return buildWeapon({ label: t.arg ?? 'Arme', damage: dmg, sizeless: true, uid });
  }
  // Attaque naturelle TYPÉE (Morsure, Cornes, Tentacules…) : reconnue par la CAPACITÉ du trait
  // (`capabilities.naturalWeapon`, donnée). L'arme reste UNE (l'Action d'attaque) ; le compte joue sur
  // les Attaques GRATUITES (aiCreatureFreeAttacks, LDB 85 l.405). `natural` → aucune arme tenue dessinée.
  // `attackKind = t.id` (l'id du trait EST le kind : morsure/cornes/tentacules) → la pose/anim route par
  // ce champ STABLE (`maniementDe`, `src/noyau/animation.ts`), jamais par le libellé.
  const nat = findTraitById(t.id)?.capabilities?.naturalWeapon;
  if (nat) return buildWeapon({ label: traitLabelById(t.id), type: nat.ranged ? 'distance' : 'melee', damage: dmg, natural: true, attackKind: t.id, uid });
  return null;
}

/** Armes EXPLICITES d'une créature (traits « Arme »/« À distance »/naturelles), SANS arme générique de
 *  repli. Pour le RENDU : une créature sans trait d'arme reste mains libres (un villageois ne tient rien) —
 *  les Mains nues de repli de `weaponsFromTraits` n'y entrent pas. */
export function renderWeaponsFromTraits(traits: TraitList, resolveTrapping: TrappingResolver = findTrappingById): Weapon[] {
  const weapons: Weapon[] = [];
  for (const t of traits) {
    const w = weaponFromTrait(t, resolveTrapping);
    if (w) weapons.push({ ...w, uid: uidDArme(w.uid!, weapons) });
  }
  return weapons;
}

/** Armes JOUABLES (combat) : comme `renderWeaponsFromTraits` ; sans trait d'arme, `unarmedWeapon`.
 *  LDB 85 l.31, LDB 14 l.155, LDB 62 l.28. */
export function weaponsFromTraits(traits: TraitList): Weapon[] {
  const weapons = renderWeaponsFromTraits(traits);
  return weapons.length ? weapons : [unarmedWeapon()];
}

/** PA du Trait Armure (`armureDuTrait`). LDB 85 l.37-39 ; #1463. */
export function armourFromTraits(traits: TraitList): ArmourPoints {
  const armure = armureDuTrait(traits);
  return armure?.parLocalisation ? { ...armure.parLocalisation } : emptyArmour(armure?.value ?? 0);
}

/** Armes des Traits `traits` que compose `recomputeLoadout` : `renderWeaponsFromTraits`, hors des Traits dont la def
 *  porte déjà l'arme en `grantNaturalWeapon`. */
export const armesDuProfil = (traits: TraitList): Weapon[] =>
  renderWeaponsFromTraits(traits.filter((t) => !uidDeLArmeDuTrait(t) && !findTraitById(t.id)?.passive?.some((op) => op.op === 'grantNaturalWeapon')));

/** Les Traits `traits` qui restent devant les objets réels `objets` : le Trait Armure cède à une armure portée hors armure
 *  de monture (`armureDeMonture`, arbitrage du 2026-11-16, #4135), un
 *  Trait dont l'arme est une vraie arme (`estUneVraieArme`) cède à un objet tenu (`peutEtreTenu`) du même type.
 *  LDB 85 l.31, l.39 ; arbitrage du 2026-11-08 (#773). */
export function traitsDevantLEquipement(traits: readonly TraitInstance[], objets: readonly GabaritDObjet[], resolveTrapping: TrappingResolver = findTrappingById): TraitInstance[] {
  const tenus = new Set(objets.filter(peutEtreTenu).map((o) => o.kind));
  const armurePortee = objets.some((o) => o.equipped && o.kind === 'armor' && !itemCapability(o, 'armureDeMonture'));
  return traits.filter((t) => {
    if (armurePortee && armureDuTrait([t])) return false;
    const w = weaponFromTrait(t, resolveTrapping);
    return !(w && estUneVraieArme(w) && tenus.has(w.type));
  });
}

/** Le Trait imprimé passe sur l'objet désigné lorsqu'il nomme le même matériel. LDB 85 l.31-39 ; #773. */
export function ajusterTraitsDuProfil(c: Combatant, profil: readonly ItemInstance[], autres: readonly ItemInstance[]): void {
  const traits = c.traits ?? [];
  const restent = new Set(autres.length ? traitsDevantLEquipement(traits, autres) : traits);
  const couvertes = new Set(profil.flatMap(localisationsDeLArmure));
  if (couvertes.size) {
    for (const i of autres) if (i.equipped) for (const lieu of localisationsDeLArmure(i)) couvertes.add(lieu);
  }
  const armes = new Set<string>();
  const retenus = new Map<TraitInstance, TraitInstance>();
  for (const t of traits) {
    const lie = !t.src && !c.liveTraits?.includes(t) ? lierArmeDuProfil(t, profil, armes) : undefined;
    let reste = lie ?? (restent.has(t) ? t : undefined);
    if (armureDuTrait([t])) {
      if (t.matiere === 'peau') reste = t;
      else if (couvertes.size) reste = armureRestante(t, couvertes);
    }
    if (reste) retenus.set(t, reste);
  }
  c.traits = [...retenus.values()];
  if (c.liveTraits) c.liveTraits = c.liveTraits.flatMap((t) => retenus.get(t) ?? []);
}

const localisationsDeLArmure = (i: ItemInstance): readonly HitLocation[] =>
  i.kind === 'armor' && !itemCapability(i, 'armureDeMonture') ? i.locs ?? [] : [];

const PREFIXE_SOURCE_ARME_DE_FICHE = 'arme-de-fiche:';

/** UID de l'arme qui concrétise le Trait du statbloc. LDB 85 l.31-35 ; #773. */
export function uidDeLArmeDuTrait(t: TraitInstance): string | undefined {
  return t.src?.kind === 'objet' && t.src.id.startsWith(PREFIXE_SOURCE_ARME_DE_FICHE)
    ? t.src.id.slice(PREFIXE_SOURCE_ARME_DE_FICHE.length) : undefined;
}

function lierArmeDuProfil(t: TraitInstance, profil: readonly ItemInstance[], armes: Set<string>): TraitInstance | undefined {
  const w = weaponFromTrait(t);
  if (!w || !estUneVraieArme(w)) return undefined;
  const objet = profil.find((i) => !armes.has(i.uid) && (
    (w.trappingId != null && i.trappingId === w.trappingId && peutEtreTenu(i))
    || (t.arg != null && i.trappingId === t.arg && i.derivedWeapon?.type === w.type)
  ));
  if (!objet) return undefined;
  armes.add(objet.uid);
  return { ...t, src: { kind: 'objet', id: `${PREFIXE_SOURCE_ARME_DE_FICHE}${objet.uid}` } };
}

/** LDB 85 l.37-39 ; #773. */
function armureRestante(t: TraitInstance, couvertes: ReadonlySet<HitLocation>): TraitInstance | undefined {
  if (!t.parLocalisation) return undefined;
  const parLocalisation = { ...t.parLocalisation };
  for (const lieu of couvertes) parLocalisation[lieu] = 0;
  return Object.values(parLocalisation).some((pa) => pa > 0) ? { ...t, parLocalisation } : undefined;
}
