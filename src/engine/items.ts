/**
 * Système d'objets / équipement. Les objets portent les stats des `trappings`
 * (Dégâts, PA, qualités, encombrement). Les armes/armures ACTIVES en combat
 * (`Combatant.weapons` / `armour`) sont DÉRIVÉES de l'équipement via
 * recomputeLoadout : équiper une hache ou une armure change donc le combat.
 */
import { Combatant, ItemInstance, ItemKind, HitLocation, ArmourPoints, Weapon, WeaponLoadout, WeaponDamageSpec, QualityInstance, type EffectSource, type ReachValue, type ShipPoste, type AuthoredShipPoste, type WeaponRangeSpec, type RangeBandId, type FireArc, type CharKey } from './types';
import { bonus, baseWithTraits } from './characteristics';
import { talentEncumbranceBonus, traitEncumbranceFactor } from './combatFeatures/dispatch';
import { applyEnchants } from './weaponDamage';
import type { TriggeredEffect } from './flowCore';
import { cannotWieldTwoHanded, handAmputated } from './trauma';
import { mutationArmourBonus, nonDeviatableMutationAP } from './corruption';
import { findTrappingById, findTraitById, qualityInstance, refLabel, type TrappingRef, type TrappingData } from '../data';
import { t } from '../i18n';

/** Résolveur d'une Possession par id STABLE — signature de `findTrappingById`. Injecté aux coutures
 *  d'objet (défaut = règle GLOBALE) pour que le state route la couche de campagne (`campaignData.ts`,
 *  #767) SANS que le moteur importe le store : il reçoit la fonction, reste PUR (règle stricte 3). */
export type TrappingResolver = (id: string) => TrappingData | undefined;
import { slugId } from '../data/slug';
import { craftEncDelta } from './qualities/craftEconomy';
import { hasQuality, qualityIndice, resolveQualities, magazineSize } from './qualities/dispatch';
import { itemCapability } from './capabilities';
import { loadRegister, type WeaponLoadState } from './weaponLoad';

let uidCounter = 0;
export function newUid(): string {
  return `it-${++uidCounter}`;
}

/** Convention d'AFFICHAGE des Dégâts (spec → chaîne) : la SEULE fonction qui décide « +BF » vs « +N »
 *  vs « +BF+N ». DÉRIVE l'affichage de la donnée structurée (`WeaponDamageSpec`, dans `types.ts`). */
export function damageString(d: WeaponDamageSpec): string {
  if ('literal' in d) return d.literal;
  if (d.plusBF) return d.flat === 0 && d.bare ? '+BF' : `+BF+${d.flat}`;
  return d.flat < 0 ? `${d.flat}` : `+${d.flat}`; // Indice négatif : « -2 », pas « +-2 »
}

/** Axe d'ALLONGE de mêlée : ids STABLES, ordonnés du plus COURT au plus LONG (LDB 62 l.156-164).
 *  Toute logique d'Allonge se keye sur `ReachId` (jamais sur le libellé, qui est de l'affichage). */
export const REACH_IDS = ['personnelle', 'tres-courte', 'courte', 'moyenne', 'longue', 'tres-longue', 'considerable'] as const;
export type ReachId = (typeof REACH_IDS)[number];

/** Id d'axe porté par le champ d'authoring `Weapon.reach` (`ReachValue`) — dérivation mécanique du
 *  texte par la primitive `slugId` (couture texte→id du CHARGEMENT), aucune table de correspondance.
 *  `null` = Allonge absente OU hors de l'axe : « Variable » de l'Arme improvisée (LDB 62 l.31) n'a pas
 *  de rang RAW, elle n'en reçoit donc aucun. */
export function reachIdOf(reach: string | null | undefined): ReachId | null {
  const slug = slugId(reach ?? '');
  return (REACH_IDS as readonly string[]).includes(slug) ? (slug as ReachId) : null;
}

/** Rang sur l'axe d'Allonge (index dans `REACH_IDS`) ; `null` = non ordonnable (cf. `reachIdOf`) —
 *  un appelant qui compare deux Allonges ne conclut alors RIEN. */
export function reachRankOf(reach: string | null | undefined): number | null {
  const id = reachIdOf(reach);
  return id ? REACH_IDS.indexOf(id) : null;
}

/** INVERSE de `damageString` (chaîne → spec) — pour la migration des données et la saisie éditeur,
 *  JAMAIS au runtime. « +BF+4 »→{plusBF,flat:4}, « +9 »→{plusBF:false,flat:9}, « +BF »→{plusBF,flat:0,bare},
 *  « -2 »→{plusBF:false,flat:-2}, sinon « Spécial » → {literal}. */
export function parseDamage(s: string): WeaponDamageSpec {
  const t = s.trim();
  const plusBF = /BF/i.test(t);
  const nums = t.replace(/BF/gi, '').match(/[+-]?\d+/g);
  if (!plusBF && !nums) return { literal: t }; // non chiffrable (« Spécial »)
  const flat = (nums ?? []).reduce((a, n) => a + parseInt(n, 10), 0);
  if (plusBF) return flat === 0 && !/\+\s*BF\s*[+-]\s*\d/i.test(t) ? { plusBF: true, flat: 0, bare: true } : { plusBF: true, flat };
  return { plusBF: false, flat };
}

/** Spécification d'une arme SYNTHÉTIQUE (≠ catalogue) : sert `buildWeapon` (→ Weapon) ET `weaponItem`
 *  (→ ItemInstance). `uid` : littéral (Tentacule : 'nat-tentacule'), préfixe → `${prefix}-${newUid()}`,
 *  ou absent → `buildWeapon` génère un uid stable par défaut (`w-${newUid()}`) : TOUTE arme construite
 *  porte un uid (les Pendings d'arme — rechargement/renversement/piège-lame — la retrouvent par uid). */
export interface WeaponSpec {
  label: string;
  type?: 'melee' | 'ranged';
  damage: WeaponDamageSpec;
  qualities?: QualityInstance[];
  subType?: string;
  reach?: ReachValue | null;
  /** Portée de tir — SPEC non résolue (`WeaponRangeSpec`) : mètres fixes OU `{bf}` des armes de JET,
   *  résolue au BF du porteur par `effectiveRange`. `null` = arme sans Portée, comme `ItemInstance.range`. */
  range?: WeaponRangeSpec | null;
  /** Recharge (Indice) — LDB 62 l.333 : DR à cumuler (Test étendu de Projectiles). 0/absent = aucun. */
  reload?: number;
  hands?: 1 | 2;
  /** PROFIL D'ARME propagé TEL QUEL vers `Weapon` (mêmes noms, mêmes sémantiques — cf. les docs de
   *  `Weapon`, types.ts) : le constructeur UNIQUE porte donc TOUT le profil d'une Possession de catalogue,
   *  aucun de ces champs n'étant plus posé après coup par un appelant. */
  trappingId?: string;
  weaponGroup?: string;
  defaultAmmo?: string;
  soloSimple?: boolean;
  indirect?: boolean;
  bladed?: boolean;
  organicProjectile?: boolean;
  onHitEffects?: TriggeredEffect[];
  minRangeBand?: RangeBandId;
  damageTaken?: number;
  hand?: 'main' | 'off';
  mountSide?: FireArc;
  resolveChar?: CharKey;
  uid?: string | { prefix: string };
  skin?: Record<string, string>;
  form?: string;
  /** Slug de FORME (routage de l'art rig) — propagé de l'ItemInstance/trait vers `Weapon.shape`. */
  shape?: string;
  /** Attaque naturelle de corps (aucune arme dessinée) — propagé vers `Weapon.natural`. */
  natural?: boolean;
  /** Nature d'attaque naturelle STAMPÉE (morsure/cornes/caudale/tentacules/pietinement…) — pour la
   *  pose/anim et la Condition `attackKind` ; le constructeur la connaît. Cf. `Weapon.attackKind`. */
  attackKind?: string;
  /** id de trapping source d'une arme built-in (Mains nues) — porté sur `Weapon.builtinId`. */
  builtinId?: string;
  /** Taille PRÉVUE pour l'arme (ADE II 2 l.706-710) — propagée vers `Weapon.sizeFor`. */
  sizeFor?: import('./size').SizeCategory;
  /** Propagé vers `Weapon.sizeless` (exemption du mismatch de Taille, ≠ `natural`/rendu). */
  sizeless?: boolean;
  /** Entité SOURCE de cette arme (sort, talent, trait, objet, maladie…) — propagée vers `Weapon.source`/
   *  `ItemInstance.source`, cf. doctrine `EffectSource` (types.ts). Absent = source non propagée. */
  source?: EffectSource;
}

function specUid(uid: WeaponSpec['uid']): string {
  if (uid == null) return `w-${newUid()}`; // arme sans uid explicite → uid stable par défaut (universel)
  return typeof uid === 'string' ? uid : `${uid.prefix}-${newUid()}`; // UN seul appel newUid par arme
}

/** CONSTRUCTEUR D'ARME UNIQUE. Toute arme synthétique (naturelle, invoquée, gratuite, de trait de créature,
 *  mains nues, Tentacule) passe par ici — fin des re-déclarations éparpillées de la forme `Weapon`. Porte la
 *  convention de Dégâts (`damageString`), l'uid, la COPIE de `qualities` et les défauts (mêlée, 1 main). Le
 *  PROFIL COMPLET d'une Possession (identité `trappingId`, Portée `{bf}`, effets à la touche, Groupe de
 *  Projectiles, bande de portée minimale, main qui la tient) : aucun champ d'arme ne se pose après coup. */
export function buildWeapon(spec: WeaponSpec): Weapon {
  const w: Weapon = {
    label: spec.label,
    type: spec.type ?? 'melee',
    damage: spec.damage, // spec STRUCTURÉE stockée telle quelle (affichage dérivé par damageString)
    qualities: [...(spec.qualities ?? [])],
    hands: spec.hands ?? 1,
  };
  if (spec.reach !== undefined) w.reach = spec.reach;
  if (spec.range !== undefined) w.range = spec.range;
  if (spec.reload !== undefined) w.reload = spec.reload;
  if (spec.subType !== undefined) w.subType = spec.subType;
  w.uid = specUid(spec.uid); // TOUJOURS défini (universel : Pendings d'arme par uid)
  if (spec.skin !== undefined) w.skin = spec.skin;
  if (spec.form !== undefined) w.form = spec.form;
  if (spec.shape !== undefined) w.shape = spec.shape;
  if (spec.natural !== undefined) w.natural = spec.natural;
  if (spec.attackKind !== undefined) w.attackKind = spec.attackKind;
  if (spec.builtinId !== undefined) w.builtinId = spec.builtinId;
  if (spec.sizeFor !== undefined) w.sizeFor = spec.sizeFor;
  if (spec.sizeless !== undefined) w.sizeless = spec.sizeless;
  if (spec.source !== undefined) w.source = spec.source;
  if (spec.trappingId !== undefined) w.trappingId = spec.trappingId;
  if (spec.weaponGroup !== undefined) w.weaponGroup = spec.weaponGroup;
  if (spec.defaultAmmo !== undefined) w.defaultAmmo = spec.defaultAmmo;
  if (spec.soloSimple !== undefined) w.soloSimple = spec.soloSimple;
  if (spec.indirect !== undefined) w.indirect = spec.indirect;
  if (spec.bladed !== undefined) w.bladed = spec.bladed;
  if (spec.organicProjectile !== undefined) w.organicProjectile = spec.organicProjectile;
  if (spec.onHitEffects !== undefined) w.onHitEffects = spec.onHitEffects;
  if (spec.minRangeBand !== undefined) w.minRangeBand = spec.minRangeBand;
  if (spec.damageTaken !== undefined) w.damageTaken = spec.damageTaken;
  if (spec.hand !== undefined) w.hand = spec.hand;
  if (spec.mountSide !== undefined) w.mountSide = spec.mountSide;
  if (spec.resolveChar !== undefined) w.resolveChar = spec.resolveChar;
  return w;
}

/** L'entrée de catalogue `id` est-elle DÉCLARÉE « Mains nues » (`TrappingData.unarmed`) ? Le catalogue
 *  porte la marque, le moteur ne connaît aucun id — une seconde entrée « poings » (espèce, prothèse)
 *  coûte une ligne de `trappings.json`. Résolveur INJECTABLE comme partout ailleurs (couche campagne). */
export const isUnarmedTrapping = (id: string | undefined, resolveTrapping: TrappingResolver = findTrappingById): boolean =>
  !!(id && resolveTrapping(id)?.unarmed);

/** L'entrée de catalogue `id` est-elle DÉCLARÉE « Arme improvisée » (`TrappingData.improvised`) ?
 *  ≠ `weaponDamage.isImprovised` (arme RÉDUITE à cet état par l'usure). */
export const isImprovisedTrapping = (id: string | undefined, resolveTrapping: TrappingResolver = findTrappingById): boolean =>
  !!(id && resolveTrapping(id)?.improvised);

/** Arme « Mains nues » canonique reconnue par son IDENTITÉ de catalogue (`builtinId`/`trappingId`,
 *  multilangue-safe) confrontée à la marque DÉCLARÉE sur l'entrée. Utilisé pour exclure les Mains nues
 *  des armes « wielded » / choisissables. */
export const isUnarmed = (w: Weapon): boolean => isUnarmedTrapping(w.builtinId ?? w.trappingId);

/** IDENTITÉ STABLE d'une arme — SOURCE UNIQUE pour tout keying d'arme (#598). Ordre : id de catalogue
 *  (`trappingId`, partagé par toutes les instances d'un même modèle) → marqueur built-in (`builtinId`)
 *  → `uid` d'instance (toujours défini par `buildWeapon`). JAMAIS `name`, qui est un LIBELLÉ d'affichage.
 *  Stabilité vérifiée pour tout porteur d'`onHitEffects` : ces effets ne viennent que du catalogue
 *  (l'instance a un `trappingId`), d'un enchantement, d'une arme invoquée ou d'un poste servi — dans
 *  les trois derniers cas l'`uid` est celui d'un `ItemInstance` persisté, donc stable d'un
 *  `recomputeLoadout` à l'autre (les armes de `grantNaturalWeapon`, seules à porter un uid regénéré,
 *  ne portent pas d'`onHitEffects`). */
export const weaponIdentity = (w: Weapon): string => w.trappingId ?? w.builtinId ?? w.uid ?? '';

/** Variante ItemInstance (objet d'inventaire) : RÉUTILISE `buildWeapon` pour le cœur (Dégâts, uid,
 *  qualities copiées, défauts) puis ne fait que la bascule `Weapon`→`ItemInstance` (`type`→`kind` + les
 *  champs propres à l'OBJET : enc/equipped/conjured). Utilisé par l'arme INVOQUÉE (op `grantWeapon`) posée
 *  dans un set d'armes dédié. */
export function weaponItem(spec: WeaponSpec & { conjured?: boolean }): ItemInstance {
  const { type, uid, ...rest } = buildWeapon(spec); // buildWeapon garantit toujours un uid
  return {
    ...rest,
    kind: type,
    uid: uid!,
    enc: 0,
    equipped: false,
    ...(spec.conjured ? { conjured: true } : {}),
  };
}

/** Zones d'armure d'une Possession → localisations d'impact, keyées par ID de zone (slug) : le champ
 *  d'authoring `TrappingData.loc` porte du TEXTE (« Tête, Bras »), converti en id par `slugId` à la
 *  lecture — même couture texte→id que `reachIdOf`, aucune clé de table en libellé. */
const ARMOUR_LOC_BY_ID: Record<string, HitLocation[]> = {
  tete: ['tete'],
  bras: ['brasG', 'brasD'],
  mains: ['brasG', 'brasD'],
  corps: ['corps'],
  jambes: ['jambeG', 'jambeD'],
};

/** PONT catalogue → runtime : la CATÉGORIE de catalogue (`TrappingData.categorie`) se TRADUIT en
 *  `ItemKind` (`ItemInstance.kind`). Deux vocabulaires distincts, jamais une recopie. */
function kindOf(categorie: string): ItemKind {
  if (categorie === 'melee') return 'melee';
  if (categorie === 'ranged') return 'ranged';
  if (categorie === 'armor') return 'armor';
  if (categorie === 'ammunition') return 'ammo';
  return 'misc';
}

/** Construit une instance d'objet depuis le catalogue par son `id` STABLE. Pose `trappingId` (réf
 *  de re-dérivation). Id inconnu → null (objet hors-base → `customTrapping`). */
export function itemFromTrappingById(id: string, resolveTrapping: TrappingResolver = findTrappingById): ItemInstance | null {
  const t = resolveTrapping(id);
  if (!t) return null;
  if (t.service) throw new Error(`itemFromTrappingById: "${t.id}" est un tarif de service (LDB 66 l.12-14), pas un objet possédable.`);
  const kind = kindOf(t.categorie);
  const locs =
    t.loc != null
      ? t.loc
          .split(',')
          .flatMap((p) => ARMOUR_LOC_BY_ID[slugId(p)] ?? [])
      : undefined;
  return {
    uid: newUid(),
    trappingId: t.id,
    label: t.label,
    kind,
    // Le spec de Dégâts est CLONÉ (jamais l'objet du catalogue) : une instance possède son profil, une
    // mutation d'instance ne peut PAS corrompre la def de trapping partagée (aliasing → pollution cross-test
    // sous isolate:false : un canon muté à 999 coulait toute coque, #379 #339).
    damage: t.damage ? { ...t.damage } : undefined,
    // Allonge (mêlée) ⊥ Portée (tir) — LDB 62. La donnée est NORMALISÉE : `reach` = string|null (Allonge
    // ou formule de jet « BFx3 »), `range` = Portée numérique (m) des armes à portée fixe → copie DIRECTE,
    // plus de `Number(t.reach)` (le « type menteur » d'avant la migration est éliminé).
    reach: t.reach,
    range: t.range ?? null,
    qualities: (t.qualities ?? []).map(qualityInstance), // QualityRef[] (donnée) → QualityInstance[] runtime (structuré, frais)
    pa: t.pa ?? undefined,
    locs: locs && locs.length ? locs : undefined,
    enc: typeof t.enc === 'number' ? t.enc : 0, // 'ND' (ateliers) / 'Variable' (arme improvisée) → non-encombrant (0), jamais NaN
    ...(t.sizeFor ? { sizeFor: t.sizeFor } : {}), // taille prévue (ADE II 2 l.706-710) — version « taille ogre » d'une possession ordinaire
    equipped: false,
    ...(t.shape ? { shape: t.shape } : {}), // slug de FORME (routage de l'art rig) — absent pour munitions/siège/Mains nues
    desc: t.desc,
    ...(t.consumable ? { consumable: t.consumable } : {}), // effet de consommable (Flow) copié du catalogue
    ...(t.consumableDuration ? { consumableDuration: t.consumableDuration } : {}), // durée d'horloge (LDB 71/72 « Durée : … »), résolue au boire
    subType: t.subType ?? undefined,
    ...(t.weaponGroup ? { weaponGroup: t.weaponGroup } : {}), // Groupe de Projectiles d'une arme de siège (AA 10 l.142)
    ...(t.defaultAmmo ? { defaultAmmo: t.defaultAmmo } : {}), // munition REPRÉSENTATIVE (hint joueur, ammoFamilyLabel)
    ...(t.soloSimple ? { soloSimple: true } : {}), // baliste « relativement simple » : tir solo perd les Atouts (AA 10 l.148)
    ...(t.indirect ? { indirect: true } : {}), // mortier/catapulte « arc élevé » (AA 10 l.169/171) : tir INDIRECT → viser une case
    ...(t.bladed ? { bladed: true } : {}), // LDB 62 l.278 — approximation MAISON, propagée du catalogue
    ...(t.organicProjectile ? { organicProjectile: true } : {}), // LDB 47 — approximation MAISON, propagée du catalogue
    ...(t.onHitEffects?.length ? { onHitEffects: t.onHitEffects } : {}), // effets « à la touche » en DONNÉE (Canon à flammes nain → En flammes, ADE II 8 l.243)
    ...(t.minRangeBand ? { minRangeBand: t.minRangeBand } : {}), // PORTÉE MINIMALE (machine de siège : pas de Bout Portant / trébuchet-mortier sous Portée Courte, ADE II 8 l.251/253)
    ...(t.requiresMastery ? { requiresMastery: true } : {}), // arme inhabituelle (ACE 12 l.17-21) : maîtrise requise
    hands: kind === 'melee' || kind === 'ranged' ? (t.hands === 2 ? 2 : 1) : undefined, // champ typé (LDB 62)
    qty: kind === 'ammo' ? (t.packSize ?? 1) : undefined, // taille de paquet typée
    ...(t.ammoRangeMod != null ? { ammoRangeMod: t.ammoRangeMod } : {}), // modificateur de Portée de la munition (LDB 62)
    // Les capacités de catégorie (weatherProtection/isShelter/isRations/isGrimoire/preventForcedDrop) NE
    // sont PAS copiées sur l'instance : elles restent lues DEPUIS le catalogue par `trappingId` (canal
    // `capabilities`), via `engine/capabilities` — comme `passive`. Une seule source de vérité.
    ...(t.container ? { container: t.container } : {}), // Contenant (LDB 64) : capacité de rangement
  };
}

/**
 * Matérialise une `TrappingRef` RÉSOLUE (`{id, spec?, count?, qualities?}` — après
 * `resolveTrappingChoices`) en objet de sac. COUTURE UNIQUE ref → objet : le catalogue donne les
 * stats (`itemFromTrappingById`), la REF donne ce que la dotation ajoute par-dessus — la
 * spécialisation imprimée entre parenthèses (`ItemInstance.spec`), la quantité d'un paquet de
 * munitions, les Atouts ATTACHÉS. Aucun site ne recopie ces trois gestes : ils vivent ici.
 */
export function itemFromTrappingRef(
  ref: Extract<TrappingRef, { id: string }>,
  resolveTrapping: TrappingResolver = findTrappingById,
): ItemInstance | null {
  const it = itemFromTrappingById(ref.id, resolveTrapping);
  if (!it) return null;
  if (ref.spec) it.spec = ref.spec;
  if (it.kind === 'ammo' && ref.count && 'fixed' in ref.count) it.qty = ref.count.fixed; // quantité de la carrière
  if (ref.qualities?.length) {
    // Atouts ATTACHÉS d'une dotation (joker de qualité résolu, #657 Lot 1) — même patron d'APPEND que
    // `withGiveQualities` (giveTrapping magique), mais via `qualityInstance` (préserve `value` —
    // « Solide 3 » — que le merge par id nu de `withGiveQualities` perdrait, correctif juge Lot 1).
    it.qualities = [...(it.qualities ?? []), ...ref.qualities.map(qualityInstance)];
  }
  return it;
}

/** Objet « custom » minimal (trinket / objet de quête) quand le nom n'est PAS un vrai trapping de la
 *  base : permet de donner un objet au groupe via `giveTrapping` sans entrée de données (cf. retrait de
 *  l'inventaire de groupe — « donner un objet = un trapping custom OU réel »). kind `misc`, sans stats. */
export function customTrapping(name: string): ItemInstance {
  return { uid: newUid(), label: name, kind: 'misc', qualities: [], enc: 0, equipped: false };
}

/** Résout l'ItemInstance d'un Effet `giveTrapping` : objet de CATALOGUE (`trappingId`) sinon objet CUSTOM
 *  (`custom`, nom libre hors-base). SOURCE UNIQUE (applyEffects + ramassage de prop). `source` (optionnel) =
 *  entité déclenchante (sort/talent/…) — stampée sur l'instance pour l'ancrage de règle (`ItemInstance.source`). */
export function itemFromGive(give: { trappingId?: string; custom?: string }, source?: EffectSource, resolveTrapping: TrappingResolver = findTrappingById): ItemInstance {
  const it = (give.trappingId ? itemFromTrappingById(give.trappingId, resolveTrapping) : null) ?? customTrapping(give.custom ?? give.trappingId ?? 'Objet');
  if (source) it.source = source;
  return it;
}

/** Fusionne les qualités MAGIQUES ajoutées d'un `giveTrapping` (`give.qualities` = ids de scène) aux
 *  qualités de base d'un objet — SOURCE UNIQUE du merge (apply giveTrapping + affichage du butin). */
export function withGiveQualities(base: QualityInstance[], give: { qualities?: string[] }): QualityInstance[] {
  return give.qualities?.length ? [...base, ...give.qualities.map((id) => ({ id }))] : base;
}

/** Qualités RÉSOLUES d'un `giveTrapping` = qualités de la def du catalogue (`itemFromGive`) + qualités
 *  magiques ajoutées. Même liste que l'objet effectivement reçu (apply) → sert l'AFFICHAGE des chips de
 *  butin, qu'elles vivent dans la def (objet catalogué) ou sur l'Effet (magique). */
export function giveTrappingQualities(give: { trappingId?: string; custom?: string; qualities?: string[] }, resolveTrapping: TrappingResolver = findTrappingById): QualityInstance[] {
  const resolved = resolveQualities(itemFromGive(give, undefined, resolveTrapping)).map((r) => ({ id: r.id, ...(r.indice != null ? { value: r.indice } : {}) }));
  return withGiveQualities(resolved, give);
}

/** Libellé d'affichage d'un Effet `giveTrapping` (catalogue → label, sinon nom custom). */
export function giveTrappingLabel(give: { trappingId?: string; custom?: string }, resolveTrapping: TrappingResolver = findTrappingById): string {
  return give.trappingId ? (resolveTrapping(give.trappingId)?.label ?? give.trappingId) : (give.custom ?? 'Objet');
}

/** Libellé D'AFFICHAGE d'une instance d'objet, DÉRIVÉ de son id STABLE (`trappingId` → libellé FR du
 *  catalogue via `refLabel`) — id = logique, label = affichage. Repli sur `name` pour un objet CUSTOM
 *  hors-base (nom libre — trinket/quête/pièces de monstre, sans `trappingId`). SOURCE UNIQUE de l'affichage
 *  du nom d'un objet catalogué (fiche/sac/pickers) : un objet CATALOGUÉ ne rend jamais son id brut, même si
 *  son champ `label` a dérivé (save ancienne, donnée fautive). */
export function itemLabel(it: Pick<ItemInstance, 'trappingId' | 'label' | 'spec'>): string {
  return it.trappingId ? refLabel('trappings', { id: it.trappingId, spec: it.spec }) : it.label;
}

/** Limite d'Encombrement = (Bonus de Force + Bonus d'Endurance) × facteur (ogre ADE II 2 l.708 :
 *  ×2), +2 par niveau de Costaud (LDB ; talent Costaud : « Augmentez les Points d'Encombrement … de
 *  votre niveau × 2 » — le bonus de Costaud n'est PAS multiplié, il s'ajoute après). Le facteur JAMAIS
 *  cumulatif : le PLUS GRAND des Traits raciaux porteurs l'emporte (`traitEncumbranceFactor`, Ogre). */
export function maxEncumbrance(c: Combatant): number {
  const factor = traitEncumbranceFactor(c);
  return (bonus(baseWithTraits(c, 'force')) + bonus(baseWithTraits(c, 'endurance'))) * factor + talentEncumbranceBonus(c);
}

/** Encombrement transporté par une liste d'`ItemInstance` — PUR, sans porteur. Les objets PORTÉS
 *  sur le corps (armure ET accessoire) voient leur Encombrement réduit de 1 — souvent 0 une fois
 *  portés (LDB 61 l.21). Les armes tenues et le matériel simplement transporté gardent leur
 *  Encombrement plein ; un objet RANGÉ dans un contenant est absorbé par celui-ci (LDB 64 l.5) et ne
 *  compte pas au total. Réutilisée par `totalEncumbrance` (héros) ET `possessionTotalEnc` (§5,
 *  SOCLE POSSESSIONS #616) — SOURCE UNIQUE de la sommation d'items, jamais un `Combatant` factice. */
export function itemsEncumbrance(items: ItemInstance[]): number {
  return (items ?? []).reduce((s, i) => {
    if (i.inside) return s; // rangé dans un contenant → absorbé par lui (LDB 64 l.5), ne compte pas
    // Pas de doublement d'Enc à l'exécution (ADE II 2 l.708 : « la version ogre… vaut deux fois
    // l'Encombrement classique »). Vérifié valeur par valeur contre les tables l.609-654 : le
    // catalogue ogre (`massue-ogre`, `grande-massue-ogre`, `pistolet-ogre`, `pansiere-ogre`…) est
    // DÉJÀ saisi à son Enc final (l.604 : « les points d'Encombrement n'ont donc pas besoin d'être
    // doublés »). Toute future « version ogre » d'une possession courante se catalogue de la MÊME
    // façon : une entrée `trappings.json` dédiée à Enc/prix déjà ×2, pas un multiplicateur ici —
    // `sizeFor` reste réservé au malus de Taille hors-gabarit (`combat.ts` l.507).
    const enc = (i.enc || 0) + craftEncDelta(i); // Léger -1 / Volumineux +1 (LDB 60)
    if (!!i.equipped && i.subType === 'protheses') return s; // prothèse portée = Enc 0 (LDB 73)
    // Objet PORTÉ sur le corps (armure OU accessoire — PAS une arme, qui se TIENT) : -1 (LDB 61 l.21) ;
    // armure Volumineux portée = 1 (LDB 60 l.62).
    const worn = !!i.equipped && isWearable(i);
    const eff = worn ? (i.kind === 'armor' && hasQuality(i, 'volumineux') ? 1 : enc - 1) : enc;
    // Monnaie PERSONNELLE portée par l'instance (Bourse) : 1 Enc / 200 PIÈCES (LDB 61 l.29) — le NOMBRE
    // de pièces, pas leur valeur en sous.
    const moneyEnc = i.money ? Math.floor((i.money.gold + i.money.silver + i.money.brass) / 200) : 0;
    return s + Math.max(0, eff) + moneyEnc;
  }, 0);
}

/** Encombrement transporté par un héros — délègue à `itemsEncumbrance` (§A, #616). */
export function totalEncumbrance(c: Combatant): number {
  return itemsEncumbrance(c.items ?? []);
}

/** Armure vide : PA uniforme `ap` sur toutes les localisations (0 par défaut). */
export function emptyArmour(ap = 0): ArmourPoints {
  return { tete: ap, brasG: ap, brasD: ap, corps: ap, jambeG: ap, jambeD: ap };
}

/** Latéralité d'une arme. La donnée canonique marque le 2-mains par le préfixe `(2M)` — UNIFORME mêlée ET
 *  distance (Arc/Arbalète/Arquebuse/Tromblon = (2M) ; Arbalète de poing/Pistolet/Fronde = 1 main).
 *  La donnée canonique porte la latéralité TYPÉE : `TrappingData.hands` (LDB 62), propagée par
 *  `itemFromTrapping` sur l'ItemInstance. Repli pour les armes BRUTES sans `hands` typé (statblocs
 *  d'ennemis, armes synthétiques) : Groupe « Deux-mains » typé (`subType==='deux-mains'`). Aucun parse
 *  de chaîne d'affichage. */
export function weaponHands(it: { hands?: 1 | 2; subType?: string }, ctx?: { mounted?: boolean }): 1 | 2 {
  // Cavalerie « (2M) » (LDB 62 l.142-143) : MONTÉE, l'arme est maniée à UNE main (l'autre tient les rênes) ;
  // utilisée À PIED, « toutes les armes à deux mains du Groupe Cavalerie sont aussi considérées comme des
  // armes à Deux Mains ». La donnée porte `hands:2` d'origine (= le profil à pied) ; on n'allège à 1 que monté.
  if (ctx?.mounted && it.subType === 'cavalerie' && it.hands === 2) return 1;
  if (it.hands === 1 || it.hands === 2) return it.hands;
  if (it.subType === 'deux-mains') return 2; // Groupe « Deux-mains » (id stable, donnée typée)
  return 1;
}

/** Arme éligible à la MAIN SECONDAIRE (LDB 14 l.138 : « une arme de combat rapproché à une main OU un
 *  pistolet ») : arme de mêlée à UNE main, ou une arme à distance portant l'Atout Pistolet (qualité
 *  `pistolet` — « peut attaquer en Combat rapproché », inclut l'Arbalète de poing). Exclut donc les
 *  arcs/arbalètes ordinaires et toute arme à deux mains. Détection du pistolet par la QUALITÉ (id stable,
 *  multilangue-safe), pas par le nom. */
export function isOffHandEligible(it: ItemInstance): boolean {
  if (it.kind !== 'melee' && it.kind !== 'ranged') return false;
  if (weaponHands(it) !== 1) return false;
  if (it.kind === 'melee') return true;
  return hasQuality(it, 'pistolet'); // Atout Pistolet (qualities.json id) — seule arme à distance utilisable de la 2nde main
}

/** Couche de PORT d'une pièce d'armure (LDB 63) : le « Cuir souple » « peut être porté sans pénalité
 *  sous n'importe quelle autre Armure » (l.93) ; une armure Flexible « peut être portée sous une
 *  couche d'armure non Flexible » (l.105-106) ; le reste forme la couche extérieure rigide.
 *  Une seule pièce par couche et par localisation. */
export type ArmourLayer = 'souple' | 'flexible' | 'rigide';
export function armourLayer(it: ItemInstance): ArmourLayer {
  if (it.subType === 'cuir-souple') return 'souple'; // type d'armure « Cuir souple » (id)
  if (hasQuality(it, 'flexible')) return 'flexible';
  return 'rigide';
}

/** Cape/manteau (« Vêtements et Accessoires », sans stats) : PORTABLE dans l'emplacement Cape de la
 *  fiche — purement cosmétique (rendu dorsal du rig), une seule à la fois. Détecté par la capacité
 *  par-OBJET `weatherProtection` (catalogue, ≠ nom — un objet `misc` qui protège des intempéries =
 *  un vêtement de dos). */
export function isCapeItem(it: ItemInstance): boolean {
  return it.kind === 'misc' && itemCapability(it, 'weatherProtection');
}

/** Objet PORTABLE sur le corps (armure + accessoire). Les armes se TIENNENT (loadout), les munitions ne se portent pas. */
export function isWearable(it: ItemInstance): boolean {
  if (it.kind === 'armor') return true;
  // misc porté sur le corps : Vêtements et Accessoires (LDB 61 l.21) + prothèses (LDB 73) ; le reste se transporte.
  return it.kind === 'misc' && (it.subType === 'vetements-et-accessoires' || it.subType === 'protheses');
}

/** Remplissage actuel d'un contenant (LDB 64) : somme de l'Enc des objets rangés DEDANS (`inside === containerUid`). PUR. */
export function containerFillEnc(c: Pick<Combatant, 'items'>, containerUid: string): number {
  return (c.items ?? [])
    .filter((i) => i.inside === containerUid)
    .reduce((s, i) => s + (i.enc || 0) + craftEncDelta(i), 0);
}

/** Peut-on ranger `it` dans le contenant `containerUid` (LDB 64) ? Le contenant existe et a une capacité ;
 *  `it` n'est ni le contenant lui-même ni un contenant (pas d'imbrication) ; le Contenu restant suffit. PUR. */
export function canStow(c: Pick<Combatant, 'items'>, it: ItemInstance, containerUid: string): boolean {
  const container = (c.items ?? []).find((i) => i.uid === containerUid);
  const capacity = container?.container?.capacity;
  if (capacity == null) return false;
  if (it.uid === containerUid || it.container) return false; // pas d'auto-rangement ni d'imbrication de sacs
  return containerFillEnc(c, containerUid) + ((it.enc || 0) + craftEncDelta(it)) <= capacity;
}

/** Rangement PAR DÉFAUT d'un objet nouvellement acquis (#204, retour playtest) : uid du contenant avec le
 *  PLUS de place LIBRE (capacité − `containerFillEnc`) parmi ceux où `canStow(c, it, uid)` l'autorise —
 *  `canStow` écarte déjà l'auto-rangement/l'imbrication, donc un objet qui EST lui-même un contenant ne
 *  reçoit jamais de cible. `null` = aucun contenant compatible → `it` reste porté/en vrac. Départage
 *  déterministe : premier contenant rencontré (ordre de `c.items`) à égalité de place libre. PUR. */
export function defaultContainerFor(c: Combatant, it: ItemInstance): string | null {
  let best: string | null = null;
  let bestFree = -Infinity;
  for (const cand of c.items ?? []) {
    if (!cand.container) continue;
    if (!canStow(c, it, cand.uid)) continue;
    const free = cand.container.capacity - containerFillEnc(c, cand.uid);
    if (free > bestFree) { bestFree = free; best = cand.uid; }
  }
  return best;
}

/** Objets ÉQUIPÉS en conflit de port avec `it` : armure de MÊME couche sur ≥1 localisation commune
 *  (pas deux justaucorps de cuir l'un sur l'autre), ou autre cape déjà portée. Équiper `it` doit
 *  d'abord les retirer (échange façon jeu vidéo). */
export function equipConflicts(c: Pick<Combatant, 'items'>, it: ItemInstance): ItemInstance[] {
  const others = (c.items ?? []).filter((o) => o.uid !== it.uid && o.equipped);
  if (it.kind === 'armor' && it.locs?.length) {
    const layer = armourLayer(it);
    return others.filter(
      (o) => o.kind === 'armor' && armourLayer(o) === layer && (o.locs ?? []).some((l) => it.locs!.includes(l)),
    );
  }
  if (isCapeItem(it)) return others.filter(isCapeItem);
  return [];
}

let _unarmed: Weapon | null = null;
/** Arme « Mains nues » canonique, DÉRIVÉE de l'entrée de catalogue `mains-nues` (LDB 62 l.28) : Dégâts,
 *  Allonge, Atouts et Groupe viennent tous de la donnée. Entrée absente ou sans profil d'arme = donnée
 *  cassée, BRUYANTE — jamais un profil deviné. Lazy + mémoïsé sur le résolveur par défaut ; un résolveur
 *  INJECTÉ (campagne, test de câblage) est lu à chaque appel. Copie fraîche à chaque appel. */
export function unarmedWeapon(resolveTrapping: TrappingResolver = findTrappingById): Weapon {
  const build = (): Weapon => {
    const it = itemFromTrappingById('mains-nues', resolveTrapping);
    if (!it?.damage) throw new Error('unarmedWeapon : entrée de catalogue « mains-nues » absente ou sans profil d’arme (src/data/trappings.json).');
    return buildWeapon({ label: it.label, damage: it.damage, reach: it.reach, qualities: it.qualities, subType: it.subType, builtinId: 'mains-nues' });
  };
  if (resolveTrapping !== findTrappingById) return { ...build(), hand: 'main' };
  if (!_unarmed) _unarmed = build();
  return { ..._unarmed, hand: 'main' };
}

/** Libellé AUTO d'un set d'armes, DÉRIVÉ de son CONTENU (façon Dragon Age / Pillars) : nom de l'arme
 *  `main` (+ « + » nom de l'`off` quand il y en a une), ou « Mains nues » si le set est vide. Les noms sont
 *  lus dans l'inventaire du combattant (`c.items`). Remplace l'affichage du champ `name` (« Set I/II »). PUR. */
export function loadoutLabel(lo: WeaponLoadout, c: Combatant): string {
  const items = c.items ?? [];
  const nameOf = (uid?: string) => {
    const it = uid ? items.find((i) => i.uid === uid) : undefined;
    return it ? itemLabel(it) : undefined;
  };
  const main = nameOf(lo.main);
  const off = nameOf(lo.off);
  if (main && off) return `${main} + ${off}`;
  return main ?? off ?? 'Mains nues';
}

/** Loadout actif d'un combattant, ou null si le combattant n'a aucun set (cas traité par ensureDefaultLoadout dans recomputeLoadout). */
export function activeLoadout(c: Combatant): WeaponLoadout | null {
  if (!c.loadouts?.length) return null;
  return c.loadouts.find((l) => l.id === c.activeLoadoutId) ?? c.loadouts[0];
}

/** Une arme (par `uid` d'ItemInstance) est-elle ACTIVE dans le loadout courant ? Source de vérité = les
 *  armes DÉRIVÉES `c.weapons` (elles gèrent déjà contrainte 2 mains, amputation, destruction). Remplace la
 *  lecture de `it.equipped` pour les ARMES : « équipé » d'une arme = « tenue dans le set actif ». */
export function isWeaponActive(c: Combatant, uid?: string): boolean {
  return uid != null && (c.weapons ?? []).some((w) => w.uid === uid);
}

/** Résolution ALTERNATIVE d'attaque DÉRIVÉE (ADE II 8 l.233 : « Toutes les machines de guerre...
 *  utilisent... Projectiles [Machine de guerre], à l'exception du bélier, qui utilise Force ») — la SEULE
 *  arme de MÊLÉE du Groupe `machine-de-guerre` est le bélier : aucun id en dur, dérivé du Groupe + du type
 *  (comme le décompte d'équipage dérive du Groupe). Lu par `combatValue` (`Weapon.resolveChar`). */
function warMachineResolveChar(it: Pick<ItemInstance, 'kind' | 'weaponGroup'>): 'force' | undefined {
  return it.weaponGroup === 'machine-de-guerre' && it.kind === 'melee' ? 'force' : undefined;
}

/** Machine de guerre nécessitant une ÉQUIPE (ADE II 8 l.233, Qualité `equipe` ; catégorie `armes-de-siege`) :
 *  ne se manie JAMAIS en loadout solo — elle doit être SERVIE en poste (`mannedPosteWeapon`/`serveAtPoste`, qui
 *  dérivent la même arme SANS passer par `toWeapon`). Même famille de veto que `cannotWieldTwoHanded`
 *  (amputation) : un item qui ne devient PAS une arme de loadout normal. */
function requiresCrewedPoste(it: Pick<ItemInstance, 'subType' | 'qualities'>): boolean {
  return it.subType === 'armes-de-siege' || hasQuality(it, 'equipe');
}

/**
 * PROJECTION UNIQUE `ItemInstance` → `Weapon` : la SEULE dérivation d'une arme jouable depuis une
 * Possession, quel qu'en soit le canal — loadout de héros (`recomputeLoadout`), poste d'artillerie servi
 * (`mannedPosteWeapon`), armement d'entité de scène (`creatureEquip`). Passe par le constructeur UNIQUE
 * `buildWeapon` (profil complet : identité, Portée `{bf}`, effets à la touche, portée minimale, Taille
 * prévue) puis replie les altérations PORTÉES PAR L'OBJET (`applyEnchants`) → l'arme rendue est déjà
 * Magique/+Dégâts/onHit, visible partout ET appliquée à la résolution.
 * `hand` = main qui la tient (absent hors loadout) ; `ctx.mounted` alimente `weaponHands` (LDB 62 l.142-143).
 * Les VETOS de port (arme détruite, machine à Équipe, amputation) restent chez l'appelant : ils dépendent
 * du PORTEUR, pas du profil de l'arme.
 */
export function weaponFromItem(it: ItemInstance, hand?: 'main' | 'off', ctx?: { mounted?: boolean }): Weapon {
  return applyEnchants(buildWeapon({
    label: itemLabel(it), trappingId: it.trappingId, type: it.kind as 'melee' | 'ranged',
    // Possession de catalogue SANS profil de Dégâts (lasso, mortier, munitions de trait) : « +BF » nu.
    // Convention UNIQUE du profil d'arme — elle vit ICI, plus aucun appelant ne la redéclare.
    damage: it.damage ?? { plusBF: true, flat: 0, bare: true },
    reach: it.reach, range: it.range, qualities: it.qualities, subType: it.subType,
    weaponGroup: it.weaponGroup, defaultAmmo: it.defaultAmmo, soloSimple: it.soloSimple, indirect: it.indirect,
    bladed: it.bladed, organicProjectile: it.organicProjectile, onHitEffects: it.onHitEffects,
    minRangeBand: it.minRangeBand, reload: qualityIndice(it, 'recharge') ?? 0, damageTaken: it.damageTaken,
    skin: it.skin, form: it.form, shape: it.shape, hands: weaponHands(it, ctx), hand, uid: it.uid,
    mountSide: it.mountSide, resolveChar: warMachineResolveChar(it), sizeFor: it.sizeFor,
  }), it.enchants ?? []);
}

/** Recalcule armes/armure actives + encombrement. Les ARMES viennent du loadout actif (contrainte 2 mains,
 *  tag `hand`) ; si aucun loadout, ensureDefaultLoadout en crée un automatiquement — UN SEUL modèle. */
export function recomputeLoadout(c: Combatant): void {
  const items = c.items ?? [];
  // Auto-prune : un slot référençant une arme qui a quitté l'inventaire (vente/transfert/perte) OU qui est
  // DÉTRUITE (Incident de Tir / usure, LDB 14/62) est vidé, sur TOUS les loadouts — évite les références
  // orphelines (et nettoie le slot d'une arme cassée, plus rééquipable telle quelle).
  const slotDead = (uid?: string) => uid != null && !items.some((i) => i.uid === uid && !i.destroyed);
  for (const lo of c.loadouts ?? []) {
    if (slotDead(lo.main)) lo.main = undefined;
    if (slotDead(lo.off)) lo.off = undefined;
  }
  const toWeapon = (it: ItemInstance, hand: 'main' | 'off'): Weapon | null => {
    if (it.destroyed) return null; // arme détruite : inutilisable (LDB 14 — Incident de Tir)
    if (requiresCrewedPoste(it)) return null; // machine de guerre à Équipe (ADE II 8 l.233) : pas de loadout solo, doit être SERVIE en poste
    const mounted = !!c.mountId; // Cavalerie (2M) à pied → vraies 2 mains (LDB 62 l.142-143)
    if (weaponHands(it, { mounted }) === 2 && cannotWieldTwoHanded(c)) return null; // amputation : pas d'arme à 2 mains (LDB 18 l.263)
    return weaponFromItem(it, hand, { mounted });
  };

  // UN SEUL modèle : tout combattant porteur d'armes passe par un loadout (auto-généré si absent — plus de
  // chemin « toutes armes équipées »). Les ennemis (armes du statbloc, posées en dur, sans items) ne passent
  // pas par ici (cf. spawn.ts), donc aucun statbloc n'est écrasé.
  if (!activeLoadout(c)) ensureDefaultLoadout(c);
  const weapons: Weapon[] = [];
  const lo = activeLoadout(c);
  if (lo) {
    // Mains amputées (LDB 18) : une main perdue ne tient rien. L'arme DIRECTRICE reste tenue tant qu'il reste
    // une main (le −20 CC/CT de l'amputation est porté par la séquelle) ; l'objet de main SECONDAIRE
    // (bouclier / 2e arme) tombe dès qu'une main manque. Les DEUX mains perdues → Mains nues.
    const mainLost = handAmputated(c, 'main');
    const offLost = handAmputated(c, 'off');
    const mainIt = !(mainLost && offLost) && lo.main ? items.find((i) => i.uid === lo.main && (i.kind === 'melee' || i.kind === 'ranged')) : undefined;
    const mainW = mainIt ? toWeapon(mainIt, 'main') : null;
    if (mainW) weapons.push(mainW);
    const mainTwoHanded = mainW?.hands === 2;
    if (!mainTwoHanded && !mainLost && !offLost && lo.off) {
      const offIt = items.find((i) => i.uid === lo.off && (i.kind === 'melee' || i.kind === 'ranged'));
      const offW = offIt ? toWeapon(offIt, 'off') : null;
      if (offW) weapons.push(offW);
    }
    // Pas de resync `it.equipped` sur les ARMES : « équipé » d'une arme = « tenue dans ce set actif », ce que
    // `c.weapons` (dérivé ici) exprime déjà → les lecteurs passent par `isWeaponActive`. `it.equipped` sert
    // seulement pour l'armure (port) et de seed du loadout par défaut (ensureDefaultLoadout).
  }
  // Le SET ACTIF tient-il une arme ? (mesuré ICI : seules les armes issues des slots main/off comptent —
  // les armes naturelles/dérivées/de poste ajoutées plus bas ne « désarment » ni n'« arment » un set.)
  const setHoldsWeapon = weapons.length > 0;

  // Armes DÉRIVÉES d'un objet ÉQUIPÉ (prothèse-arme, LDB 73 : le Crochet « est considéré comme une
  // Dague » en mêlée) — DÉCLARATIF sur le trapping (`derivedWeapon`).
  for (const i of items) {
    const dw = i.equipped && i.trappingId ? findTrappingById(i.trappingId)?.derivedWeapon : undefined;
    if (dw) weapons.push({ hand: 'main', ...dw });
  }
  // Armes NATURELLES portées en DONNÉE par le `passive` d'une source — trait (Tentacules, LDB 85 l.405) ou
  // mutation (Tentacule épais → trait ; LDB 19 : « Compte comme une Arme de Créature »). Op `grantNaturalWeapon`,
  // MÊME vocabulaire, boucle KIND-AGNOSTIQUE : ajouter une source = l'itérer ici, aucun kind nommé en dur.
  // (L'Attaque gratuite 1/tour du Tentacule est portée par le maneuver `tentacule`, keyé sur uid `nat-tentacule`.)
  const naturalWeaponPassives = [
    ...(c.mutations ?? []).map((m) => m.passive),
    ...(c.traits ?? []).map((t) => findTraitById(t.id)?.passive),
  ];
  for (const ops of naturalWeaponPassives) for (const op of ops ?? []) {
    if (op.op !== 'grantNaturalWeapon') continue;
    const flat = (typeof op.damage === 'number' ? op.damage : 0) + (op.damagePlus ?? 0);
    weapons.push({ hand: 'main', ...buildWeapon({
      label: op.label, attackKind: op.attackKind, subType: op.subType,
      damage: { plusBF: op.plusBF !== false, flat, bare: op.bare ? true : undefined },
      qualities: (op.qualities ?? []).map((id) => ({ id })), uid: op.uid ?? { prefix: 'nat' },
    }) });
  }
  // Armes NATURELLES accordées par un Sort (op `grantNaturalWeapon` — Dent et griffe : Morsure/Arme ;
  // Incarnation de Wyssan) : attaques ADDITIONNELLES tant que l'effet dure (retirées au recompute
  // d'expiration, dropExpiredGrantedWeapons). Même injection que Tentacule/Cornes.
  for (const e of c.activeEffects ?? []) {
    if (e.naturalWeapon) weapons.push({ ...e.naturalWeapon, hand: 'main' });
  }

  // Pièce d'artillerie SERVIE (`mannedPoste`, MDG 12-13) : SEUL le CHEF (`crewIds[0]`) DÉRIVE l'arme du poste
  // comme arme active taguée `mountSide` — comme un Tentacule/une Morsure (dans `weapons`, HORS inventaire). Les
  // membres SUPPORT (`crewIds[1..]`, Arme d'équipe) occupent la pièce (lien `mannedPoste`, comptés dans l'Indice)
  // mais ne TIRENT pas → pas d'arme. Le canon reste la pièce de la coque (vérité = la coque). KIND-AGNOSTIQUE.
  if (c.mannedPoste && c.mannedPoste.crewIds?.[0] === c.id) {
    const w = mannedPosteWeapon(c, c.mannedPoste);
    if (w) weapons.push(w);
  }

  // Mains nues (stats canoniques du trapping, LDB 62 l.28) : arme du seul combattant DÉSARMÉ de fait —
  // set actif ne tenant AUCUNE arme (set vide, arme détruite/inutilisable, amputation). Un set ARMÉ (même
  // d'une seule arme à distance, même avec une main libre) n'en porte PAS : l'attaque passe par les armes
  // du set, le joueur commute lui-même (arbitrage user 2026-08-17, #1348 —
  // `docs/plans/2026-08-16-spec-hud-combat.md` § « ARBITRAGE SET STRICT », verbatim au ticket).
  if (!setHoldsWeapon) weapons.push(unarmedWeapon());

  const armour = wornArmourPoints(items);
  // Mutations de Corruption (LDB 19) : PA NATURELS additifs (Peau d'acier +2 partout,
  // Écailles épineuses +1 partout, Cornes asymétriques +1 Tête) — par-dessus l'armure portée.
  for (const l of Object.keys(armour) as (keyof typeof armour)[]) armour[l] += mutationArmourBonus(c, l);

  // (L'ÉTAT DE CHARGE n'est pas reporté ici : il vit sur l'OBJET possédé, qui SURVIT à ce re-dérivage —
  //  `loadRegister`. LIMITE CONNUE : une arme SANS objet re-fabriquée à chaque recompte (arme dérivée
  //  d'une prothèse/d'un trait, arme octroyée par un effet) repart donc à neuf ; inerte tant que ces
  //  armes-là n'ont pas de Recharge — le jour où l'une en aura, son état devra vivre sur sa source.)
  c.weapons = weapons;
  c.armour = armour;
  c.encumbrance = totalEncumbrance(c);
}

/**
 * Arme dérivée d'un poste d'artillerie SERVI (`mannedPoste`, MDG 12-13) — taguée `mountSide = poste.side`,
 * profil et altérations de l'instance repliés par la projection UNIQUE `weaponFromItem`. Builder PARTAGÉ par
 * `recomputeLoadout` (chefs héros) ET `applyShipPostes` (octroi DIRECT aux chefs à statbloc qui ne recomputent
 * pas) → le canon apparaît de la MÊME façon quel que soit le `kind`. PUR.
 */
export function mannedPosteWeapon(c: Combatant, poste: ShipPoste): Weapon | undefined {
  const it: ItemInstance = { ...poste.item, mountSide: poste.side };
  if (it.destroyed) return undefined;
  if (weaponHands(it) === 2 && cannotWieldTwoHanded(c)) return undefined;
  return weaponFromItem(it, 'main');
}

/**
 * HYDRATATION d'un poste AUTHORÉ (#222) — couture UNIQUE, appelée au spawn (`spawnEnemy`). Résout la base
 * de la pièce depuis `trappingId` (`itemFromTrappingById`, la couture existante — JAMAIS une base copiée),
 * puis re-pose l'état d'INSTANCE propre au poste (uid stable, enchants de dérogation, usure). MIGRATION
 * transparente de l'ancienne forme : `trappingId` manquant se dérive de `item.trappingId` (l'arme copiée
 * pré-#222) ; sa base copiée est JETÉE (re-résolue du catalogue). `trappingId` irrésoluble → throw explicite
 * (fail-fast — une pièce fantôme est un défaut d'authoring, pas un silence).
 */
export function hydratePoste(a: AuthoredShipPoste): ShipPoste {
  const trappingId = a.trappingId ?? a.item?.trappingId;
  if (!trappingId) throw new Error(`[poste] réf catalogue absente (ni trappingId ni item.trappingId) : ${JSON.stringify(a)} (#222)`);
  const base = itemFromTrappingById(trappingId);
  if (!base) throw new Error(`[poste] trappingId inconnu « ${trappingId} » — pièce non hydratable (#222)`);
  const enchants = a.enchants ?? a.item?.enchants;
  const item: ItemInstance = {
    ...base,
    uid: a.uid ?? a.item?.uid ?? base.uid, // uid d'instance STABLE (liens hotbar/log)
    ...(enchants?.length ? { enchants } : {}), // dérogation de CETTE pièce (hors base catalogue)
    ...(a.item?.damageTaken != null ? { damageTaken: a.item.damageTaken } : {}), // usure runtime (LDB 62 l.135)
    ...(a.item?.destroyed ? { destroyed: true } : {}),
  };
  const poste: ShipPoste = { item };
  if (a.side) poste.side = a.side;
  if (a.cover) poste.cover = a.cover;
  if (a.crewIds) poste.crewIds = a.crewIds;
  if (a.loaded != null) poste.loaded = a.loaded;
  if (a.reloadProgress != null) poste.reloadProgress = a.reloadProgress;
  if (a.ammo) poste.ammo = a.ammo;
  if (a.ammoUid) poste.ammoUid = a.ammoUid;
  if (a.loadedAmmoUid) poste.loadedAmmoUid = a.loadedAmmoUid;
  if (a.chambered != null) poste.chambered = a.chambered;
  if (a.enchants?.length) poste.enchants = a.enchants;
  if (a.anchor) poste.anchor = a.anchor;
  return poste;
}

let loadoutCounter = 0;
/** Génère les DEUX sets d'armes par défaut d'un héros qui n'en a pas : le 1er = meilleure arme de
 *  mêlée (+ bouclier/2e arme à 1 main en secondaire), le 2nd = 1re arme à distance (sinon vide).
 *  Idempotent. Le libellé d'un set est DÉRIVÉ de son contenu à l'affichage (`loadoutLabel`), pas stocké. */
export function ensureDefaultLoadout(c: Combatant): void {
  if (c.loadouts?.length) return;
  const items = (c.items ?? []).filter((i) => i.equipped && (i.kind === 'melee' || i.kind === 'ranged'));
  const melee = items.filter((i) => i.kind === 'melee');
  const ranged = items.filter((i) => i.kind === 'ranged');

  const set1: WeaponLoadout = { id: `lo-${++loadoutCounter}` };
  if (melee.length) {
    const main = [...melee].sort((a, b) => damageScore(b.damage) - damageScore(a.damage))[0];
    set1.main = main.uid;
    if (weaponHands(main) === 1) set1.off = melee.find((i) => i.uid !== main.uid && weaponHands(i) === 1)?.uid;
  }
  const set2: WeaponLoadout = { id: `lo-${++loadoutCounter}`, main: ranged[0]?.uid };
  c.loadouts = [set1, set2];
  c.activeLoadoutId = (set1.main ? set1 : set2.main ? set2 : set1).id;
}

/** Id de loadout unique (réutilise le compteur d'ensureDefaultLoadout). */
export function newLoadoutId(): string {
  return `lo-${++loadoutCounter}`;
}

/** Crée un loadout vide, le rend actif, et renvoie son id. */
export function loadoutCreate(c: Combatant): string {
  const id = newLoadoutId();
  c.loadouts = [...(c.loadouts ?? []), { id }];
  c.activeLoadoutId = id;
  return id;
}

/** Supprime un loadout ; si c'était l'actif, bascule sur le 1ᵉʳ restant (ou undefined). */
export function loadoutDelete(c: Combatant, id: string): void {
  c.loadouts = (c.loadouts ?? []).filter((l) => l.id !== id);
  if (c.activeLoadoutId === id) c.activeLoadoutId = c.loadouts[0]?.id;
}

export function loadoutSetActive(c: Combatant, id: string): void {
  if (c.loadouts?.some((l) => l.id === id)) c.activeLoadoutId = id;
}

/** Assigne (ou retire si `uid` null) une arme à un slot. Une arme à 2 mains en `main` vide le slot `off` ;
 *  une même arme ne peut occuper les DEUX mains (l'assigner à une main la retire de l'autre). */
export function loadoutSetSlot(c: Combatant, id: string, slot: 'main' | 'off', uid: string | null): void {
  const lo = c.loadouts?.find((l) => l.id === id);
  if (!lo) return;
  lo[slot] = uid ?? undefined;
  if (uid) {
    const other = slot === 'main' ? 'off' : 'main';
    if (lo[other] === uid) lo[other] = undefined; // une arme ne peut pas être tenue des deux mains à la fois
    if (slot === 'main') {
      const it = (c.items ?? []).find((i) => i.uid === uid);
      if (it && weaponHands(it) === 2) lo.off = undefined; // 2 mains → pas de secondaire
    }
  }
}

/** Auto-rangement (#204) : à l'ACQUISITION d'un objet, pose `it.inside` sur son contenant par défaut
 *  (`defaultContainerFor`) s'il y en a un — sinon `it` reste porté/en vrac. JAMAIS pour un objet ÉQUIPÉ
 *  explicitement par l'appelant (le port choisi prime). SOURCE UNIQUE : à appeler juste après avoir
 *  poussé `it` dans `c.items`, avant `recomputeLoadout`. */
export function autoStowNewItem(c: Combatant, it: ItemInstance): void {
  if (it.equipped) return;
  const uid = defaultContainerFor(c, it);
  if (uid) it.inside = uid;
}

/**
 * Ajoute l'objet de catalogue `trappingId` à l'inventaire PERSONNEL d'un héros et re-dérive son équipement
 * actif. Retourne un NOUVEAU combattant (cloné). SOURCE UNIQUE du « donner un objet à un héros » : utilisée
 * par l'achat marchand (`buyItem`) ET l'assignation de butin. Id inconnu → inchangé.
 */
export function addItemToHero(hero: Combatant, trappingId: string): Combatant {
  const it = itemFromTrappingById(trappingId);
  if (!it) return hero;
  const clone: Combatant = structuredClone(hero);
  clone.items = [...(clone.items ?? []), it];
  autoStowNewItem(clone, it);
  recomputeLoadout(clone);
  return clone;
}

/**
 * PA portés par localisation, dérivés des pièces équipées. Une seule pièce compte par localisation
 * (la meilleure), SAUF Flexible (LDB 63) : « peut être portée sous une couche d'armure non
 * Flexible […] vous gagnez les bénéfices des deux » → meilleure pièce rigide + meilleure pièce
 * Flexible se CUMULENT. `exclude` retire des pièces du calcul (PA ignorés par la touche —
 * Partielle/Points faibles, cf. `ignoredArmourAP`).
 */
export function wornArmourPoints(items: ItemInstance[], exclude?: (it: ItemInstance) => boolean): ArmourPoints {
  const rigid = emptyArmour();
  const flex = emptyArmour();
  for (const it of items) {
    if (!it.equipped || it.kind !== 'armor' || !it.pa || !it.locs || it.destroyed) continue;
    if (exclude?.(it)) continue;
    const net = Math.max(0, it.pa - (it.damageTaken ?? 0)); // PA nette des dégâts (LDB 63 l.19)
    const layer = hasQuality(it, 'flexible') ? flex : rigid;
    for (const l of it.locs) layer[l] = Math.max(layer[l], net);
  }
  const armour = emptyArmour();
  for (const l of Object.keys(armour) as HitLocation[]) armour[l] = rigid[l] + flex[l];
  return armour;
}

/**
 * PA portés à `loc` IGNORÉS par cette touche (LDB 63, Qualités des armures) :
 *  - Partielle : « Un adversaire qui obtient un nombre pair pour vous toucher, ou obtient un
 *    Coup Critique, ignore les PA de l'armure Partielle » ;
 *  - Points faibles : « Si votre adversaire possède une arme avec l'Atout Empaleuse et obtient
 *    un Critique, les PA de votre armure sont ignorés ».
 * Différence entre les PA dérivés avec et sans les pièces ignorées (gère la superposition Flexible).
 */
export function ignoredArmourAP(c: Combatant, loc: HitLocation, hit: { roll: number; critical: boolean; empaleuse: boolean }): number {
  const items = c.items ?? [];
  if (!items.length) return 0;
  const even = hit.roll % 2 === 0;
  const ignored = (it: ItemInstance): boolean =>
    (hasQuality(it, 'partielle') && (even || hit.critical)) ||
    (hasQuality(it, 'points-faibles') && hit.critical && hit.empaleuse);
  if (!items.some((it) => it.equipped && it.kind === 'armor' && it.locs?.includes(loc) && ignored(it))) return 0;
  return Math.max(0, wornArmourPoints(items)[loc] - wornArmourPoints(items, ignored)[loc]);
}

/** La localisation `loc` est-elle protégée par une pièce Impénétrable (LDB 63 : les Coups
 *  Critiques obtenus sur un jet de toucher IMPAIR sont ignorés) ? */
export function impenetrableAt(c: Combatant, loc: HitLocation): boolean {
  return (c.items ?? []).some(
    (i) => i.equipped && i.kind === 'armor' && i.locs?.includes(loc) && (i.pa ?? 0) - (i.damageTaken ?? 0) > 0 && hasQuality(i, 'impenetrable'),
  );
}

/** PA d'armure SACRIFIABLE pour la Déviation Critique (LDB 63 l.30) à `loc` : `c.armour[loc]` (armure portée +
 *  statbloc créature + PA naturels de mutation) MOINS les PA marqués hors-Déviation (Écailles, EDO App.2 l.196).
 *  Le PA de sort (activeEffects) n'est pas une pièce d'armure et n'entre pas. > 0 ⇔ « protégé par une armure ». */
export function deviatableArmourAt(c: Combatant, loc: HitLocation): number {
  return (c.armour?.[loc] ?? 0) - nonDeviatableMutationAP(c, loc);
}

/** Endommage de 1 PA l'armure de `c` à la localisation `loc` (LDB 63 l.19-21). Héros : endommage la
 *  pièce la plus solide (damageTaken+1) puis re-dérive ; ennemi/figurant (armure plate du statblock,
 *  sans items) : décrément direct. RETOURNE true si une PA a été retirée. */
export function damageArmour(c: Combatant, loc: HitLocation): boolean {
  const pieces = (c.items ?? []).filter(
    (i) => i.equipped && i.kind === 'armor' && i.locs?.includes(loc) && (i.pa ?? 0) - (i.damageTaken ?? 0) > 0,
  );
  if (pieces.length) {
    const piece = pieces.sort((a, b) => ((b.pa ?? 0) - (b.damageTaken ?? 0)) - ((a.pa ?? 0) - (a.damageTaken ?? 0)))[0];
    piece.damageTaken = (piece.damageTaken ?? 0) + 1;
    recomputeLoadout(c);
    return true;
  }
  if ((c.armour?.[loc] ?? 0) > 0) {
    c.armour[loc] = c.armour[loc] - 1; // armure plate (ennemi/figurant) : décrément direct
    return true;
  }
  return false;
}

/** Putréfaction (LDB 47) : « le cuir se racornit (perdant 1 PA à 1 Localisation) » — endommage de
 *  1 PA la première pièce de CUIR portée encore intacte, re-dérive l'armure. Retourne la
 *  localisation touchée, ou null si rien en cuir (ennemi à armure plate : matière inconnue → MJ).
 *  Matière détectée par l'id de TYPE d'armure `subType` (« cuir-souple »/« cuir-bouilli ») — réf STABLE
 *  qui PORTE le matériau (≠ nom — multilangue-safe ; cohérent avec l'op `damageArmour{material:'cuir'}`). */
export function damageLeatherArmour(c: Combatant): HitLocation | null {
  const piece = (c.items ?? []).find(
    (i) => i.equipped && i.kind === 'armor' && !!i.subType?.startsWith('cuir') && (i.pa ?? 0) - (i.damageTaken ?? 0) > 0,
  );
  if (!piece) return null;
  piece.damageTaken = (piece.damageTaken ?? 0) + 1;
  recomputeLoadout(c);
  return piece.locs?.[0] ?? 'corps';
}

/** Score de dégâts approximatif pour le tri (composante fixe ; « Spécial » → 0). */
export function damageScore(d?: WeaponDamageSpec): number {
  return d && 'flat' in d ? d.flat : 0;
}

/** Construit l'inventaire d'un héros depuis des `TrappingRef[]` (possessions de Classe + niveau de
 *  carrière — déjà des refs par id). Un ref `{id}` à stats devient un objet ; le `count` d'une munition
 *  donne sa quantité. Les refs `{text}` (flavor hors catalogue : « Réseau d'informateurs ») n'ont pas
 *  de stats → ignorées. */
export function buildInventory(refs: TrappingRef[]): ItemInstance[] {
  const items: ItemInstance[] = [];
  for (const ref of refs) {
    if ('vehicleId' in ref) continue; // dotation véhicule = grant de POSSESSION (matérialisé en T1, registre), jamais un objet de sac.
    if (!('id' in ref)) continue; // {text} narratif : pas d'objet à stats
    const it = itemFromTrappingRef(ref);
    if (it) items.push(it);
  }
  // Équipement par défaut : la MEILLEURE arme de mêlée + la première à distance + les armures
  // SANS conflit de couche (max une pièce par couche × localisation, meilleure PA d'abord —
  // LDB 63 : pas de « 2 armures de cuir »). Les doublons restent dans l'inventaire (déséquipés).
  const melee = items.filter((i) => i.kind === 'melee');
  const ranged = items.filter((i) => i.kind === 'ranged');
  if (melee.length) melee.sort((a, b) => damageScore(b.damage) - damageScore(a.damage))[0].equipped = true;
  if (ranged.length) ranged[0].equipped = true;
  const holder = { items } as Combatant; // equipConflicts lit c.items (équipés au fil de l'eau)
  const armours = items.filter((i) => i.kind === 'armor').sort((a, b) => (b.pa ?? 0) - (a.pa ?? 0));
  for (const a of armours) if (!equipConflicts(holder, a).length) a.equipped = true;
  return items;
}

/** Famille de munitions canonique. Les armes à **Poudre noire** ET d'**Ingénierie** partagent les
 *  mêmes munitions (« Poudre noire et ingénierie ») — le LDB les regroupe sous « Armes à Poudre
 *  noire et d'Ingénierie » (62-Les armes l.150, l.174-175). Les autres familles (Arc/Arbalète/
 *  Fronde) correspondent à l'identique. Sans cette normalisation, une arme à feu (subType « Poudre
 *  noire ») ne trouverait jamais sa munition (subType « Poudre noire et ingénierie »). */
export function ammoFamily(subType?: string): string {
  const s = subType ?? ''; // `subType` = id de Groupe (poudre-noire / ingenierie / arc / arbalete / fronde…)
  if (s === 'poudre-noire' || s === 'ingenierie' || s === 'poudre-noire-et-ingenierie') return 'poudre-ingenierie';
  // Artillerie (AA/MDG) : les armes de siège (canon/baliste/mortier/pierrier) tirent les munitions de
  // siège (boulets, carreaux, bombes, mitraille). Sans cette normalisation, une arme de siège
  // (`armes-de-siege`) ne trouverait jamais sa munition (`munition-de-siege`).
  if (s === 'armes-de-siege' || s === 'munition-de-siege') return 'artillerie';
  return s;
}

/** Libellé JOUEUR de la munition attendue par une arme à distance (hint d'achat/chargement quand le
 *  carquois du tireur ET le coffre du poste sont vides) : la munition REPRÉSENTATIVE de l'ARME
 *  (`defaultAmmo`, résolu au catalogue) si connue, sinon celle de la famille générique (`ammoFamily`) —
 *  `armes-de-siege` seul ne discrimine pas pierrier/canon/baliste/mortier (MDG 12 l.410-424), d'où le
 *  besoin du `defaultAmmo` par arme. Affichage FR pur (aide de saisie), jamais un id de logique. */
export function ammoFamilyLabel(subType?: string, defaultAmmo?: string): string {
  if (defaultAmmo) {
    const label = findTrappingById(defaultAmmo)?.label;
    if (label) return label;
  }
  switch (ammoFamily(subType)) {
    case 'artillerie': return t('ammo.artillerie');
    case 'poudre-ingenierie': return t('ammo.poudreIngenierie');
    case 'arc': return t('ammo.arc');
    case 'arbalete': return t('ammo.arbalete');
    case 'fronde': return t('ammo.fronde');
    default: return t('ammo.generic');
  }
}

/** Munitions compatibles avec une arme à distance (même famille canonique, qty>0) : l'inventaire du
 *  porteur, PLUS — s'il SERT cette pièce (`mannedPoste`) — le STOCK DU POSTE (MDG 12 l.410-424 :
 *  le coffre à boulets de la pièce), en tête (le stock de bord prime sur la besace du servant). */
export function compatibleAmmo(c: Combatant, weapon: Weapon): ItemInstance[] {
  if (weapon.type !== 'ranged') return [];
  const fam = ammoFamily(weapon.subType);
  if (!fam) return [];
  const match = (i: ItemInstance) => i.kind === 'ammo' && (i.qty ?? 0) > 0 && ammoFamily(i.subType) === fam;
  const poste = c.mannedPoste;
  const posteStock = poste && poste.item.uid === weapon.uid ? (poste.ammo ?? []).filter(match) : [];
  return [...posteStock, ...(c.items ?? []).filter(match)];
}

// Les LECTEURS du cycle de charge (`loadRegister`/`weaponLoaded`/`reloadProgressOf`) vivent dans le module
// FEUILLE `engine/weaponLoad` (aucune dépendance) ; ce fichier porte les ÉCRIVAINS ci-dessous.

/** Munition CHOISIE pour le PROCHAIN chargement de CETTE arme : le choix porté par l'arme (`weapon.ammoUid`,
 *  hotbar) s'il est compatible, sinon la sélection PERSISTANTE du poste servi (`poste.ammoUid`, fiche du
 *  navire — MDG 12 : boulet/mitraille), sinon la 1re compatible. PUR (inventaire/famille). Ce qui part au
 *  coup suivant, ce n'est PAS ce choix mais la munition CAPTURÉE (`loadedAmmo`). `undefined` = pas de munition. */
export function selectedAmmo(c: Combatant, weapon: Weapon): ItemInstance | undefined {
  const compat = compatibleAmmo(c, weapon);
  const reg = loadRegister(c, weapon);
  const poste = c.mannedPoste;
  const posteUid = poste && poste.item.uid === weapon.uid ? poste.ammoUid : undefined;
  return compat.find((a) => a.uid === reg.ammoUid) ?? compat.find((a) => a.uid === posteUid) ?? compat[0];
}

/** Munition RÉELLEMENT dans l'arme — celle que le tir consomme et qui augmente le coup (`weaponWithAmmo`,
 *  bandes de portée). Capturée au chargement par `loadWeapon` (PROPRIÉTAIRE UNIQUE de `loadedAmmoUid`).
 *  Arbitrage utilisateur 2026-08-16 « La munition se fixe au CHARGEMENT » (`docs/plans/2026-08-16-hud-combat.md` §1).
 *  Lue dans le REGISTRE de l'arme (pièce servie → la pièce). Sans cycle de chargement (`reload` 0 : Arc,
 *  fronde) il n'y a rien à capturer → le choix courant vaut coup. Repli sur le choix courant quand rien
 *  n'est capturé (arme authorée « prête » sans capture posée). PUR. */
export function loadedAmmo(c: Combatant, weapon: Weapon): ItemInstance | undefined {
  if ((weapon.reload ?? 0) <= 0) return selectedAmmo(c, weapon);
  const compat = compatibleAmmo(c, weapon);
  const uid = loadRegister(c, weapon).loadedAmmoUid;
  return compat.find((a) => a.uid === uid) ?? selectedAmmo(c, weapon);
}

/** CHARGE une arme : pose ENSEMBLE, DANS SON REGISTRE, l'état de charge (`loaded`, `reloadProgress`,
 *  `chambered`) et la munition CAPTURÉE (`loadedAmmoUid`) — arbitrage utilisateur 2026-08-16 « quand on
 *  charge une arme on sélectionne une munition ». PROPRIÉTAIRE UNIQUE de la pose : fin de rechargement
 *  (joueur ET IA), début de combat, spawn, prise d'une pièce. Mute en place. */
export function loadWeapon(c: Combatant, weapon?: Weapon, poste?: ShipPoste): void {
  if (!weapon && !poste) return;
  // Munition capturée : celle choisie pour CETTE arme ; pour une pièce dont l'arme n'est pas résolue
  // (équipage sans arme dérivée), la sélection persistante de la pièce fait foi (MDG 12).
  const captured = weapon ? selectedAmmo(c, weapon)?.uid : poste?.ammoUid;
  const reg: WeaponLoadState = poste ?? loadRegister(c, weapon!);
  reg.loaded = true;
  reg.reloadProgress = 0;
  reg.loadedAmmoUid = captured;
  if (weapon) reg.chambered = magazineSize(weapon); // À répétition (Indice) : chargeur rempli (LDB 62 l.229/231)
}

/** DÉCHARGE une arme : efface ENSEMBLE, DANS SON REGISTRE, l'état de charge et la munition capturée.
 *  PROPRIÉTAIRE UNIQUE de l'effacement : coup parti, bordée, bascule de munition sur une arme chargée
 *  (arbitrage utilisateur 2026-08-16). `poste` fourni SANS arme = décharge de la seule pièce (bordée).
 *  Aucune munition n'est détruite : le décompte du stock n'a lieu qu'au tir (`consumeAmmo`). Mute en place. */
export function unloadWeapon(c?: Combatant, weapon?: Weapon, poste?: ShipPoste): void {
  const regs: WeaponLoadState[] = [];
  if (poste) regs.push(poste);
  if (c && weapon) {
    const reg = loadRegister(c, weapon);
    if (reg !== poste) regs.push(reg);
  }
  for (const reg of regs) {
    reg.loaded = false;
    reg.reloadProgress = 0;
    reg.loadedAmmoUid = undefined;
    reg.chambered = undefined; // À répétition (Indice) : le chargeur se vide AUSSI (LDB 62 l.229/231)
  }
}

/** DR cumulés du Test étendu de rechargement de CETTE arme (LDB 62 l.335) — écrivain UNIQUE de la
 *  progression : la remise à zéro d'une interruption comme le cumul d'un jet passent par ici, toujours
 *  DANS le registre (pièce servie, objet possédé ou instance d'arme). `poste` = pièce visée explicitement
 *  (recharge d'équipage) ; sans arme résolue, seule la pièce est écrite. Mute en place. */
export function setReloadProgress(c: Combatant | undefined, weapon: Weapon | undefined, dr: number, poste?: ShipPoste): void {
  const reg: WeaponLoadState | undefined = poste ?? (c && weapon ? loadRegister(c, weapon) : undefined);
  if (reg) reg.reloadProgress = Math.max(0, dr);
}

/** CHOIX de munition « à charger au prochain rechargement » (`ammoUid`) — écrivain UNIQUE : hotbar du
 *  joueur, sélecteur de pièce du navire (MDG 12). Ne touche NI l'état de charge NI le coup capturé :
 *  changer d'avis ne décharge rien par lui-même (c'est l'appelant qui décide de décharger, arbitrage
 *  utilisateur 2026-08-16). Mute en place. */
export function setAmmoChoice(c: Combatant | undefined, weapon: Weapon | undefined, uid: string | undefined, poste?: ShipPoste): void {
  const reg: WeaponLoadState | undefined = poste ?? (c && weapon ? loadRegister(c, weapon) : undefined);
  if (reg) reg.ammoUid = uid;
}

/** Consomme UN coup du chargeur d'une arme À répétition (Indice) (LDB 62 l.229/231) — écrivain UNIQUE de
 *  `chambered`. Renvoie `true` s'il reste des munitions chargées (l'arme reste prête), `false` quand le
 *  chargeur est vide (ou que l'arme n'en a pas) : l'appelant décharge alors par `unloadWeapon`. */
export function spendChamberedRound(c: Combatant, weapon: Weapon): boolean {
  const mag = magazineSize(weapon);
  if (mag == null) return false; // pas de chargeur : un coup = l'arme est vide
  const reg = loadRegister(c, weapon);
  reg.chambered = (reg.chambered ?? mag) - 1;
  return (reg.chambered ?? 0) > 0;
}

/** CONSOMME une munition tirée (décrément `qty`, retrait à 0) LÀ OÙ ELLE VIT : stock du poste servi
 *  (`mannedPoste.ammo`) ou inventaire du tireur — source unique du décrément (tir individuel ET bordée). */
export function consumeAmmo(c: Combatant, used: ItemInstance): void {
  if ((used.qty ?? 0) <= 0) return;
  used.qty = (used.qty ?? 0) - 1;
  if (used.qty > 0) return;
  const poste = c.mannedPoste;
  if (poste?.ammo?.some((i) => i.uid === used.uid)) poste.ammo = poste.ammo.filter((i) => i.uid !== used.uid);
  else c.items = (c.items ?? []).filter((i) => i.uid !== used.uid);
}

/** Arme à distance « augmentée » par la munition tirée : Dégâts combinés (flats additionnés, BF si l'un
 *  l'utilise) et Atouts fusionnés (ex. Empaleuse de la Flèche). */
export function weaponWithAmmo(weapon: Weapon, ammo: ItemInstance): Weapon {
  const w = weapon.damage;
  const a = ammo.damage;
  const qualities = [...weapon.qualities];
  for (const q of ammo.qualities) if (!qualities.some((x) => x.id === q.id)) qualities.push(q);
  const damage: WeaponDamageSpec = 'flat' in w
    ? { plusBF: w.plusBF || (a != null && 'plusBF' in a && a.plusBF), flat: w.flat + (a != null && 'flat' in a ? a.flat : 0) }
    : w; // arme « Spécial » (literal) → inchangée
  return { ...weapon, damage, qualities };
}
