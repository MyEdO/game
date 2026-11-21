/**
 * Dérivation PURE « traits → équipement » (armes jouables + armure en PA) d'une créature/statbloc.
 * SOURCE UNIQUE, partagée par le SPAWN de combat (`noyau/monde/spawn`), `recomputeLoadout` ET le RENDU d'exploration.
 * Vit dans `engine` (pur, ne dépend de rien d'en haut) → importable par le noyau ET par le rendu
 * (`scripts/guards/lib/couches.mjs`).
 */
import type { Combatant, HitLocation, ItemInstance, Weapon } from './types';
import type { TraitInstance, TraitList } from './statEntry';
import {
  appliquerProfilDuTrait,
  armeNaturelleAccordee,
  buildWeapon,
  cleDInstanceDeTrait,
  deciderApparencesDesArmes,
  estUneVraieArme,
  isUnarmed,
  mainsNuesSiDesarme,
  gabaritDObjet,
  peutEtreTenu,
  uidDArme,
  unarmedWeapon,
  weaponFromItem,
  type GabaritDObjet,
  type ProfilDArmePorte,
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

/** LDB 85 l.9, l.31 ; ZI 13 l.224, l.240, l.242 */
export function profilDArmeDuTrait(t: TraitInstance): ProfilDArmePorte {
  // LDB 85 l.31
  const passif = t.value == null ? passifDeLArmeNaturelleDuTrait(t) : undefined;
  const damage: WeaponDamageSpec = t.value != null
    ? { plusBF: false, flat: t.value, ...(findTraitById(t.id)?.bfInclus ? { bfInclus: true as const } : {}) }
    : passif ? armeNaturelleAccordee(passif, indiceLitteralDArme(passif.damage), { uid: uidDuTraitArmant(t) }).damage
      : { plusBF: true, flat: 0, bare: true };
  return { damage, range: t.range, traitsConferes: t.confere, ajustements: t.profilDArme };
}

/**
 * Parse UN trait d'arme WFRP4 (français) en arme jouable, ou null. Gère le TYPE
 * entre parenthèses (l'armement des monstres est dans les Traits) :
 *   « Arme +7 », « Arme (Épée) +7 », « Arme (Dague) +4 », « Arme (griffes) »,
 *   « À distance (Arbalète) +9 (60) », « À distance +8 (50) », « Morsure +9 ».
 * Le `name` = le TYPE quand il est manufacturé ; sinon une étiquette naturelle.
 */
export function weaponFromTrait(t: TraitInstance, resolveTrapping: TrappingResolver = findTrappingById): Weapon | null {
  if (t.etatDArme?.lachee) return null;
  const profil = profilDArmeDuTrait(t);
  const arme = armeDuTrait(t, profil.damage, resolveTrapping);
  if (!arme) return null;
  const damageTaken = t.etatDArme?.damageTaken;
  return appliquerProfilDuTrait(damageTaken === undefined ? arme : { ...arme, damageTaken }, profil);
}

/** L'arme d'un Trait d'attaque, avant les indications propres au profil. */
function armeDuTrait(t: TraitInstance, dmg: WeaponDamageSpec, resolveTrapping: TrappingResolver): Weapon | null {
  const uid = uidDuTraitArmant(t);
  // Quel(s) Trait(s) ARMENT une créature est DÉCLARÉ par l'entrée du registre : `specsSource` nomme LE
  // catalogue où se résout son `arg` (`weaponsMelee`/`weaponsRanged`, cf. `SPEC_SOURCES`). Un troisième
  // trait porteur d'arme coûte cette ligne de `traits.json` — et la source passée à `catalogItem` EST
  // celle qui est déclarée, sans second champ à tenir synchrone.
  const def = findTraitById(t.id);
  const source = def?.specsSource;
  if (source === 'weaponsRanged') {
    if (t.value == null) return null; // « À distance » sans Indice de Dégâts : pas une arme jouable (RAW)
    const it = t.natural ? undefined : catalogItem(t.arg, source, resolveTrapping);
    if (it) return weaponFromItem({ ...it, uid });
    return buildWeapon({ label: t.arg || 'Attaque à distance', type: 'distance', damage: dmg, natural: t.natural, uid });
  }
  if (source === 'weaponsMelee') {
    // Attaque naturelle de corps (flag DONNÉE `natural`) → aucune arme dessinée (aucune forme résolue).
    if (t.natural) return buildWeapon({ label: t.arg ?? 'Arme', damage: dmg, natural: true, uid });
    const it = catalogItem(t.arg, source, resolveTrapping);
    if (it) return weaponFromItem({ ...it, uid });
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
  const nat = def?.capabilities?.naturalWeapon;
  if (!nat) return null;
  const passif = passifDeLArmeNaturelleDuTrait(t);
  return buildWeapon({
    label: t.value === undefined ? passif?.label ?? traitLabelById(t.id) : traitLabelById(t.id),
    type: nat.ranged ? 'distance' : 'melee',
    damage: dmg,
    natural: true,
    attackKind: t.id,
    subType: passif?.subType?.id,
    qualities: passif?.qualities?.map((id) => ({ id })),
    uid,
    source: { kind: 'trait', id: t.id },
  });
}

const uidDuTraitArmant = (t: TraitInstance) => t.uid ?? `trait-${cleDInstanceDeTrait(t)}`;
const prefixeDAttaquePassive = (uid: string) => `nat-${encodeURIComponent(uid)}:`;
const indiceLitteralDArme = (damage: unknown) => typeof damage === 'number' ? damage : 0;

function passifsArmants(t: TraitInstance) {
  return (findTraitById(t.id)?.passive ?? []).filter((op) => op.op === 'grantNaturalWeapon');
}

function passifDeLArmeNaturelleDuTrait(t: TraitInstance, passifs = passifsArmants(t)) {
  return findTraitById(t.id)?.capabilities?.naturalWeapon
    ? passifs.find((op) => op.attackKind === t.id)
    : undefined;
}

/** Les armes qu'un Trait projette, principales et passives. LDB 85 l.9, l.31–35, l.405 */
export function armesDUnTrait(t: TraitInstance, resolveTrapping: TrappingResolver = findTrappingById): Weapon[] {
  const principale = uidDeLArmeDuTrait(t) ? null : weaponFromTrait(t, resolveTrapping);
  const passifs = passifsArmants(t);
  const inclus = principale ? passifDeLArmeNaturelleDuTrait(t, passifs) : undefined;
  const uid = uidDuTraitArmant(t);
  const armes = principale ? [principale] : [];
  for (const [rang, op] of passifs.entries()) {
    if (op === inclus) continue;
    armes.push({ hand: 'main', ...armeNaturelleAccordee(op, indiceLitteralDArme(op.damage), {
      uid: `${prefixeDAttaquePassive(uid)}${rang}`,
      source: { kind: 'trait', id: t.id },
    }) });
  }
  return armes;
}

/** Armes des Traits pour le rendu, sans les mains nues de repli. */
export function renderWeaponsFromTraits(traits: TraitList, resolveTrapping: TrappingResolver = findTrappingById): Weapon[] {
  const weapons: Weapon[] = [];
  for (const trait of traits) for (const arme of armesDUnTrait(trait, resolveTrapping)) {
    weapons.push({ ...arme, uid: uidDArme(arme.uid!, weapons) });
  }
  return weapons;
}

/** LDB 85 l.31 ; LDB 14 l.155 ; LDB 62 l.28 */
export function weaponsFromTraits(traits: TraitList): Weapon[] {
  const weapons = armesDuProfil(traits);
  return weapons.length ? weapons : [unarmedWeapon()];
}

/**
 * Armes autonomes des Traits, en attribuant les uid aux instances natives à leur première projection.
 * L'uid d'une arme déjà née reste réservé jusqu'au retrait de son Trait. #2907, #3693
 */
export function armesDuProfil(traits: TraitList): Weapon[] {
  return traits.flatMap((trait) => {
    const armes = armesDUnTrait(trait);
    if (!armes.length) return armes;
    if (armes.some(estUneVraieArme)) trait.etatDArme ??= {};
    if (trait.uid !== undefined) return armes;
    trait.uid = uidDArme(uidDuTraitArmant(trait), traits);
    return armesDUnTrait(trait);
  });
}

/** Re-compose le seul armement autonome des Traits. #3693 */
export function synchroniserArmesDuProfil(c: Combatant, traitsAvant: TraitList = c.traits ?? []): void {
  const uids = new Set(traitsAvant.flatMap((trait) => trait.uid === undefined ? [] : [trait.uid]));
  const passifs = Array.from(uids, prefixeDAttaquePassive);
  const duProfil = (arme: Weapon): boolean => arme.uid !== undefined
    && (uids.has(arme.uid) || (arme.source?.kind === 'trait' && passifs.some((prefixe) => arme.uid!.startsWith(prefixe))));
  const profil = armesDuProfil(c.traits ?? []);
  const precedentes = c.weapons ?? [];
  if (!profil.length && !precedentes.some(duProfil)) return;

  deciderApparencesDesArmes(findTrappingById, profil, c.appearanceOverride, c.creatureId);
  const restant = new Map(profil.map((arme) => [arme.uid, arme]));
  const armes = precedentes.flatMap((precedente) => {
    if (isUnarmed(precedente)) return [];
    if (!duProfil(precedente)) return [precedente];
    const arme = restant.get(precedente.uid);
    restant.delete(precedente.uid);
    return arme ? [arme] : [];
  });
  armes.push(...restant.values());
  if (c.loadouts?.length || !armes.length || precedentes.some((arme) => isUnarmed(arme) || estUneVraieArme(arme))) {
    mainsNuesSiDesarme(armes, armes.some((arme) => arme.mountSide === undefined && !arme.derivedFromItem && estUneVraieArme(arme)));
  }
  c.weapons = armes;
}

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
export function ajusterTraitsDuProfil(
  c: Combatant,
  profil: readonly ItemInstance[],
  autres: readonly ItemInstance[],
  { armureDecriteParLeTrait }: { armureDecriteParLeTrait: boolean },
): void {
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
      if (t.matiere === 'peau' || armureDecriteParLeTrait) reste = t;
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
