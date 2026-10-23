/**
 * ÉQUIPEMENT DESSINÉ d'un porteur, sans art (#2097, #2948) : la PROJECTION de son état sur les clés que
 * tout dessinateur lit (rig SVG, hôte 3D), keyée par ids stables. L'art (formes, matériaux peints) vit
 * chez chaque dessinateur et consomme cette projection.
 */
import type { ArmourPoints, Combatant, HitLocation, ItemInstance, Weapon } from '../engine/types';
import { emptyArmour, formeResolue, isCapeItem, isShieldItem, isWeaponActive, objetDeSlot, weaponFromItem, weaponHands, type ContexteDeManiement, type SourceDeForme } from '../engine/items';
import { armourFromTraits, renderWeaponsFromTraits, weaponFromId } from '../engine/creatureEquip';
import type { TraitList } from '../engine/statEntry';
import { findCreatureById } from '../data';
import { idsDeLaSousListe } from '../data/schemas/grammaire/ref';

/** Clés d'une arme que le dessin LIT telles quelles (#2097) : le type `FormeDArme` et le sélecteur
 *  `armeDeDessin` en dérivent ; l'identité de dessin (`sceneMeshes.stableStr`) hache ces clés et la forme
 *  RÉSOLUE, et elles seules. */
const CLES_ARME = ['attackKind', 'hand', 'hands', 'natural', 'teinte', 'subType', 'type'] as const;
/** Clés d'une pièce d'armure que le dessin LIT (#2097). */
const CLES_PIECE = ['locs', 'teinte'] as const;

/** Matière d'une pièce d'armure : id du type d'armure (`subType`, sous-liste `armour` des Groupes,
 *  `weaponGroups.json?kind=armour`). */
export type MatiereDArmure = 'cuir-souple' | 'cuir-bouilli' | 'mailles' | 'plate' | 'armure-du-chaos';

/** Ce que le dessin lit d'une arme : ses clés lues telles quelles, et sa forme RÉSOLUE (`formeResolue`).
 *  `forme` n'existe pas sur `Weapon` : une arme brute ne s'y substitue pas (#2113). */
export type FormeDArme = Pick<Weapon, (typeof CLES_ARME)[number]> & { forme: string | undefined };
/** `hands` : mains qu'occupe l'arme pour SON porteur (`weaponHands`, monté ou non). */
export type ArmeDeDessin = FormeDArme & { bouclier: boolean; hands: 1 | 2 };
export type PieceDeDessin = Pick<ItemInstance, (typeof CLES_PIECE)[number]> & { matiere: MatiereDArmure };
export type BouclierDeDessin = { forme: string | undefined };

/** Équipement DESSINÉ d'un porteur : projection de son état par `armeDeDessin`/`pieceDeDessin`
 *  (#2097), jamais une copie. */
export interface EquipCtx {
  weapons: ArmeDeDessin[];
  /** Armes des sets (`c.loadouts`) qui ne sont PAS tenues : portées au fourreau, au dos, à la ceinture. */
  rangees: ArmeDeDessin[];
  armour: PieceDeDessin[];           // couche VISIBLE d'abord
  shield?: BouclierDeDessin;
  cape?: boolean;
}

/** Rang d'affichage des matières : la couche du DESSUS s'affiche (plate sur mailles sur cuir). */
export const RANG_DE_MATIERE: Record<MatiereDArmure, number> = { 'armure-du-chaos': 4, plate: 3, mailles: 2, 'cuir-bouilli': 1, 'cuir-souple': 0 };

/** Lu à la même sous-liste que le schéma de `trappings.json` (`idDe('weaponGroup', 'armour')`). */
const estMatiere = (id: string | undefined): id is MatiereDArmure => id !== undefined && idsDeLaSousListe('weaponGroup', 'armour').includes(id);

/** Matière de l'armure de statbloc SYNTHÉTISÉE (`synthArmour`), par palier de PA — présentation maison
 *  (#2948). */
const matiereDePalier = (pa: number): MatiereDArmure => (pa >= 4 ? 'plate' : pa >= 2 ? 'mailles' : 'cuir-souple');

/** Copie DÉTACHÉE des seules clés listées : aucune référence vivante ne survit à la projection. */
function projeter<T extends object, K extends keyof T>(src: T, cles: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of cles) if (src[k] !== undefined) out[k] = structuredClone(src[k]);
  return out;
}

export const armeDeDessin = (w: Weapon, maniement?: ContexteDeManiement): ArmeDeDessin =>
  ({ ...projeter(w, CLES_ARME), hands: weaponHands(w, maniement), forme: formeResolue(w), bouclier: isShieldItem(w) });
/** Pièce d'armure dessinée : sa matière est son `subType`, qu'une pièce d'armure porte toujours (schéma de
 *  `trappings.json`, `synthArmour`) ; une pièce sans type d'armure est un état invalide, refusé. */
export function pieceDeDessin(it: ItemInstance): PieceDeDessin {
  const matiere = it.subType;
  if (!estMatiere(matiere)) throw new Error(`pieceDeDessin : « ${it.uid} » n'a pas de type d'armure (subType « ${matiere ?? ''} »).`);
  return { ...projeter(it, CLES_PIECE), matiere };
}
export const bouclierDeDessin = (x: SourceDeForme): BouclierDeDessin => ({ forme: formeResolue(x) });

/** Équipement dessiné d'armes et de pièces DONNÉES : armes tenues, pièces d'armure, bouclier (tenu parmi les
 *  armes), armes rangées, cape. Ne résout aucune armure portée : un porteur passe par `equipementDessine` ou
 *  `equipementDEntite`. */
export function equipDe(weapons: Weapon[], armour: ItemInstance[], autres: { rangees?: Weapon[]; cape?: ItemInstance } & ContexteDeManiement = {}): EquipCtx {
  const { rangees = [], cape, ...maniement } = autres;
  // Pièces TRIÉES par matière décroissante : par slot, le rendu prend la 1re pièce qui le couvre → un
  // héros en cuir + mailles montre les mailles, la plate par-dessus tout.
  const pieces = armour.map(pieceDeDessin).sort((a, b) => RANG_DE_MATIERE[b.matiere] - RANG_DE_MATIERE[a.matiere]);
  const dessins = weapons.map((w) => armeDeDessin(w, maniement));
  const iBouclier = dessins.findIndex((w) => w.bouclier); // un bouclier tenu est dans le set actif → présent dans c.weapons
  return {
    weapons: dessins,
    armour: pieces,
    rangees: rangees.map((w) => armeDeDessin(w, maniement)),
    ...(iBouclier >= 0 ? { shield: bouclierDeDessin(weapons[iBouclier]) } : {}),
    ...(cape ? { cape: true } : {}),
  };
}

/** Arme PRINCIPALE : la première qui n'est pas un bouclier, celle que l'os `arme` DESSINE — d'où se
 *  dérivent aussi la prise et le geste par défaut. Un porteur de bouclier seul n'en a pas. */
export const armePrincipale = (equip: EquipCtx): ArmeDeDessin | undefined => equip.weapons.find((w) => !w.bouclier);

/** Pièces d'armure dessinées depuis les PA de statbloc par localisation — UNIQUEMENT si l'apparence
 *  DÉCLARE son armure de statbloc PORTÉE (`armurePortee`) [entériné 2026-07-22, #774 : « Les PA ne
 *  devrait pas impacté l'apparence, sauf si on le décide »]. Chaque pièce porte la matière de son palier
 *  de PA (`matiereDePalier`). */
function synthArmour(ap: ArmourPoints, armurePortee: boolean | undefined): ItemInstance[] {
  if (!armurePortee) return [];
  const items: ItemInstance[] = [];
  const piece = (uid: string, name: string, pa: number, locs: HitLocation[]) => {
    items.push({ uid, label: name, kind: 'armor', subType: matiereDePalier(pa), qualities: [], pa, locs, enc: 0, equipped: true });
  };
  if (ap.corps > 0) piece('syn-corps', 'Protection (corps)', ap.corps, ['corps']);
  if (ap.tete > 0) piece('syn-tete', 'Protection (tête)', ap.tete, ['tete']);
  const bras = Math.max(ap.brasG, ap.brasD);
  if (bras > 0) piece('syn-bras', 'Protection (bras)', bras, ['brasG', 'brasD']);
  const jambes = Math.max(ap.jambeG, ap.jambeD);
  if (jambes > 0) piece('syn-jambes', 'Protection (jambes)', jambes, ['jambeG', 'jambeD']);
  return items;
}

/** Armure de statbloc DÉCLARÉE PORTÉE : l'apparence d'auteur (`override`) prime sur le record de la créature
 *  (parité #181/#182). */
function armurePorteeDe(override: { armurePortee?: boolean } | undefined, creatureId: string | undefined): boolean | undefined {
  return override?.armurePortee ?? findCreatureById(creatureId)?.appearance?.armurePortee;
}

/** Pièces d'armure ÉQUIPÉES d'un combattant (locs renseignés). */
const piecesPortees = (c: Combatant): ItemInstance[] =>
  (c.items ?? []).filter((i) => i.kind === 'armor' && i.equipped && (i.locs?.length ?? 0) > 0);

/** Armes RANGÉES d'un combattant : les objets des slots `main`/`off` de TOUS ses sets (`objetDeSlot`), sauf
 *  ceux qu'il tient (`isWeaponActive`). Un objet porté au fourreau n'est pas manié : aucun veto de maniement. */
function armesRangees(c: Combatant, maniement: ContexteDeManiement): Weapon[] {
  const uids = new Set((c.loadouts ?? []).flatMap((lo) => [lo.main, lo.off]));
  return [...uids].filter((uid) => !isWeaponActive(c, uid)).flatMap((uid) => {
    const it = objetDeSlot(c, uid);
    return it ? [weaponFromItem(it, undefined, maniement)] : [];
  });
}

/** Équipement DESSINÉ d'un combattant : ses armes tenues et rangées, ses pièces portées — sinon, armure de
 *  statbloc déclarée portée (`armurePorteeDe`), les pièces synthétisées de ses PA (`synthArmour`) —, sa cape. */
export function equipementDessine(c: Combatant): EquipCtx {
  const portees = piecesPortees(c);
  const maniement: ContexteDeManiement = { mounted: !!c.mountId };
  return equipDe(c.weapons ?? [], portees.length ? portees : synthArmour(c.armour, armurePorteeDe(c.appearanceOverride, c.creatureId)), {
    ...maniement, rangees: armesRangees(c, maniement), cape: (c.items ?? []).find((i) => i.equipped && isCapeItem(i)),
  });
}

/** Ce qu'une ENTITÉ de scène déclare de son équipement : apparence d'auteur (`armurePortee`), arme
 *  d'authoring (`SceneEntity.weapon`), statbloc d'éditeur (`traits`, `armour`), enrôlement. */
export interface EquipementDAuteur {
  armurePortee?: boolean;
  /** Arme d'authoring (`trappingId`). */
  weapon?: string;
  traits?: TraitList;
  armour?: number;
  /** Membre d'une rencontre : porte les ARMES des traits de son record (parité avec `creatureToCombatant`). */
  enrolled?: boolean;
}

/** Équipement DESSINÉ d'une entité de scène de réf `ref` (id de créature), MÊME dérivation qu'au combat :
 *  traits du statbloc d'éditeur, sinon du record ; l'armure s'en dérive toujours, les armes seulement pour
 *  un statbloc d'éditeur ou une entité enrôlée (`renderWeaponsFromTraits`, armes EXPLICITES). `weapon` ne
 *  s'ajoute que si les traits n'ont pas déjà produit une arme du même type (`spawn.ts`, #126/#145). */
export function equipementDEntite(ref: string | undefined, opts: EquipementDAuteur = {}): EquipCtx {
  const traits = opts.traits ?? findCreatureById(ref)?.traits ?? [];
  const traitWeapons = renderWeaponsFromTraits(opts.traits || opts.enrolled ? traits : []);
  const idWeaponInst = opts.weapon ? weaponFromId(opts.weapon) : undefined;
  const idWeapon = idWeaponInst && !traitWeapons.some((w) => w.type === idWeaponInst.type) ? [idWeaponInst] : [];
  const armourPA: ArmourPoints = opts.armour != null ? emptyArmour(opts.armour) : armourFromTraits(traits);
  return equipDe([...idWeapon, ...traitWeapons], synthArmour(armourPA, armurePorteeDe(opts, ref)));
}
