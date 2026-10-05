import type { Combatant, Weapon, ItemInstance, HitLocation, QualityInstance } from '../../../engine/types';
import { isCapeItem } from '../../../engine/items';
import { isShieldItem } from '../../../engine/equipCompare';
import type { Slot } from '../bones';
import type { PartArt } from './types';
import { ARMOUR, ARMOUR_PALETTES } from './armour';
import { WEAPON_DEFS } from './weapons/_registry.generated';
import { SHIELD_DEFS } from './shields/_registry.generated';
import { weaponGroupKey } from '../../../engine/weaponGroup';
import { norm as wnorm } from './weaponForms';
import { findTrappingById } from '../../../data';
import { buildTokenMap, tableDObjet, applyTokenMapArt } from '../palette';

/** Clés d'une arme que le rig LIT telles quelles (#2097) : le type `FormeDArme` et le sélecteur
 *  `armeDeDessin` en dérivent ; l'identité de dessin (`sceneMeshes.stableStr`) hache ces clés et la forme
 *  RÉSOLUE, et elles seules. */
const CLES_ARME = ['attackKind', 'hand', 'natural', 'skin', 'subType', 'type'] as const;
/** Clés d'une pièce d'armure que le rig LIT (#2097). */
const CLES_PIECE = ['locs', 'skin'] as const;

/** Ce dont la forme d'un objet porté se résout : son id de catalogue, la silhouette forcée d'une arme
 *  invoquée, le choix du joueur. */
export type SourceDeForme = Pick<Weapon, 'form' | 'formeChoisie' | 'natural' | 'trappingId'>;

/** Ce que le rig lit d'une arme : ses clés lues telles quelles, et sa forme RÉSOLUE (`formeResolue`).
 *  `forme` n'existe pas sur `Weapon` : une arme brute ne s'y substitue pas (#2113). */
export type FormeDArme = Pick<Weapon, (typeof CLES_ARME)[number]> & { forme: string | undefined };
export type ArmeDeDessin = FormeDArme & { bouclier: boolean };
export type PieceDeDessin = Pick<ItemInstance, (typeof CLES_PIECE)[number]> & { materiau: Materiau };
export type BouclierDeDessin = { forme: string | undefined };
export type Materiau = 'rembourre' | 'cuir' | 'maille' | 'plaque';

/** Équipement DESSINÉ d'un porteur : projection de son état par `armeDeDessin`/`pieceDeDessin`
 *  (#2097), jamais une copie. */
export interface EquipCtx {
  weapons: ArmeDeDessin[];
  armour: PieceDeDessin[];           // couche VISIBLE d'abord
  shield?: BouclierDeDessin;
  cape?: boolean;
}

/** Copie DÉTACHÉE des seules clés listées : aucune référence vivante ne survit à la projection. */
function projeter<T extends object, K extends keyof T>(src: T, cles: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of cles) if (src[k] !== undefined) out[k] = structuredClone(src[k]);
  return out;
}

/** Bouclier au sens du rig : `isShieldItem` (`src/engine/equipCompare.ts`), par l'id de Qualité. */
export const isShield = (x: { qualities?: QualityInstance[] }): boolean => isShieldItem(x);

/**
 * FORME d'un objet porté, RÉSOLUE au catalogue courant (#2113) — l'UNIQUE résolution : rig, icône
 * d'inventaire et sélecteur de forme la lisent. Routage PAR ID STABLE :
 *  1. attaque naturelle → aucune forme ;
 *  2. arme invoquée (`form` = id de trapping) → son `shape` catalogué ;
 *  3. choix du joueur, s'il est parmi les `formChoices` du catalogue ;
 *  4. `shape` du catalogue, par `trappingId`.
 * `undefined` : le consommateur retombe sur son repli (Groupe, bouclier par défaut).
 */
export function formeResolue(x: SourceDeForme): string | undefined {
  if (x.natural) return undefined;
  const invoquee = x.form ? findTrappingById(x.form)?.shape : undefined;
  if (invoquee) return invoquee;
  const t = x.trappingId ? findTrappingById(x.trappingId) : undefined;
  if (x.formeChoisie && t?.formChoices?.includes(x.formeChoisie)) return x.formeChoisie;
  return t?.shape;
}

export const armeDeDessin = (w: Weapon): ArmeDeDessin => ({ ...projeter(w, CLES_ARME), forme: formeResolue(w), bouclier: isShield(w) });
export const pieceDeDessin = (it: ItemInstance): PieceDeDessin => ({ ...projeter(it, CLES_PIECE), materiau: armourMaterial(it) });
export const bouclierDeDessin = (x: SourceDeForme): BouclierDeDessin => ({ forme: formeResolue(x) });

/** Rang d'affichage des matériaux : la couche du DESSUS s'affiche (plaque sur maille sur cuir). */
const MATERIAL_RANK: Record<Materiau, number> = { plaque: 3, maille: 2, cuir: 1, rembourre: 0 };

/** Équipement dessiné : armes, pièces d'armure, bouclier (tenu parmi les armes), cape. */
export function equipDe(weapons: Weapon[], armour: ItemInstance[], cape?: ItemInstance): EquipCtx {
  // Pièces TRIÉES par matériau décroissant : par slot, le rendu (resolve.ts) prend la 1re pièce qui
  // le couvre → un héros en cuir + maille montre la maille, la plate par-dessus tout.
  const pieces = armour.map(pieceDeDessin).sort((a, b) => MATERIAL_RANK[b.materiau] - MATERIAL_RANK[a.materiau]);
  const shield = weapons.find(isShield); // un bouclier tenu est dans le set actif → présent dans c.weapons
  return {
    weapons: weapons.map(armeDeDessin),
    armour: pieces,
    ...(shield ? { shield: bouclierDeDessin(shield) } : {}),
    ...(cape ? { cape: true } : {}),
  };
}

/** Pièces d'armure ÉQUIPÉES d'un combattant (locs renseignés). */
const piecesPortees = (c: Combatant): ItemInstance[] =>
  (c.items ?? []).filter((i) => i.kind === 'armor' && i.equipped && (i.locs?.length ?? 0) > 0);

/** Arme PRINCIPALE : la première qui n'est pas un bouclier, celle que l'os `arme` DESSINE (`resolve.ts`)
 *  — d'où se dérivent aussi la prise (`weaponRest`) et le geste par défaut. Un porteur de bouclier seul
 *  n'en a pas. */
export const armePrincipale = (equip: EquipCtx): ArmeDeDessin | undefined => equip.weapons.find((w) => !w.bouclier);

/** Équipement PORTÉ d'un combattant : ses armes, ses pièces portées — sinon `repliArmure` (armure
 *  synthétisée d'un profil, `enemyRigProfile`) —, sa cape. */
export function equipPorte(c: Combatant, repliArmure: () => ItemInstance[] = () => []): EquipCtx {
  const portees = piecesPortees(c);
  return equipDe(c.weapons ?? [], portees.length ? portees : repliArmure(), (c.items ?? []).find((i) => i.equipped && isCapeItem(i)));
}

/** Ensemble des slugs de FORME catalogués (clés de l'art rig) — pour valider une forme résolue.
 *  `epee` (forme générique, repli du Groupe `base` + défaut final) est une def du registre comme les autres. */
const ART_BY_SLUG = new Set(WEAPON_DEFS.map((d) => d.slug));

/** Forme par défaut d'un Groupe canonique (REPLI quand l'arme n'a pas de forme résolue : armes
 *  génériques de statbloc / hors catalogue). Le Groupe (WFRP4) n'encode pas la forme — c'est un
 *  simple défaut visuel par famille, pas un routage de libellé. */
const ART_BY_GROUP: Record<string, string> = {
  base: 'epee', escrime: 'rapiere', deuxmains: 'epee_batarde',
  cavalerie: 'lance_cavalerie', hast: 'lance', fleau: 'fleau', parade: 'main_gauche', bagarre: '',
  arc: 'arc', arbalete: 'arbalete', poudre: 'pistolet', ingenierie: 'pistolet_rep',
  fronde: 'fronde', lancer: 'javelot', entraves: 'fouet', explosifs: 'bombe',
};

/** FORME d'art de l'arme (clé du registre WEAPONS) = 1 silhouette : aucune pour une attaque naturelle,
 *  sinon la forme résolue (`formeResolue`) si l'art la connaît, sinon le repli par Groupe canonique. */
export function weaponFamily(w: FormeDArme): string {
  if (w.natural) return ''; // attaque naturelle (corps) : la part du rig fait foi, rien en main
  if (w.forme && ART_BY_SLUG.has(w.forme)) return w.forme;
  return ART_BY_GROUP[weaponGroupKey(w)] ?? (w.type === 'ranged' ? 'arc' : 'epee');
}

/**
 * Parts d'arme (repère local de l'os `arme`, manche à l'origine).
 * ART DES FORMES = registre auto-chargé `weapons/defs/` (1 arme = 1 fichier ; les réécritures
 * lisibilité de l'audit aveugle sont déjà bakées dans chaque def). `epee` (forme générique, repli
 * du Groupe `base` via `ART_BY_GROUP` + défaut final de `weaponPart`) est une def comme les autres.
 */
// Art des formes RÉSOLU par la table d'OBJET du def (`tableDObjet`) : les clés porteur restent en
// jeton pour la passe du porteur. Relevé sur `PartArt` : préserve un art ORIENTÉ verbatim.
const FORM_ART: Record<string, PartArt> = Object.fromEntries(
  WEAPON_DEFS.map((d) => [d.slug, applyTokenMapArt(d.art, tableDObjet([d.palette ?? {}]))]),
);
const FORM_DEF = new Map(WEAPON_DEFS.map((d) => [d.slug, d]));
const WEAPONS: Record<string, PartArt> = FORM_ART;

export function weaponPart(w: FormeDArme): PartArt {
  const f = weaponFamily(w);
  if (f === '') return ''; // mains nues : pas d'arme
  // SKIN d'objet légendaire : re-résout l'art du def contre SA palette + l'override d'instance
  // (≠ tenues qui suivent la palette du PORTEUR). Sans skin → art @défaut précalculé.
  const def = w.skin ? FORM_DEF.get(f) : undefined;
  if (def) return applyTokenMapArt(def.art, tableDObjet([def.palette ?? {}], w.skin));
  return WEAPONS[f] ?? WEAPONS.epee;
}

/** Silhouette de bouclier (os `bouclier`, main faible) — registre DATA-DRIVEN `shields/defs/`,
 *  routé par la forme RÉSOLUE (`bouclierDeDessin`), plus aucun lookup de libellé ; repli = le def
 *  marqué `fallback` (rondache). Plus aucun SVG ni tableau en dur ici. */
const SHIELD_BY_SLUG = new Map(SHIELD_DEFS.map((d) => [d.slug, d]));
const SHIELD_FALLBACK = SHIELD_DEFS.find((d) => d.fallback) ?? SHIELD_DEFS[0];
const TABLE_BOUCLIER = tableDObjet([]);
export function shieldPart(x: BouclierDeDessin): PartArt {
  const d = (x.forme ? SHIELD_BY_SLUG.get(x.forme) : undefined) ?? SHIELD_FALLBACK;
  return applyTokenMapArt(d.art, TABLE_BOUCLIER);
}

/** Matériau inféré du nom (sinon palier de PA). Cuir AVANT plaque (« Plastron de cuir »). */
export function armourMaterial(item: Pick<ItemInstance, 'label' | 'pa'>): Materiau {
  const n = wnorm(item.label);
  if (/cuir|jaque/.test(n)) return 'cuir';
  if (/maille|cotte|haubert/.test(n)) return 'maille';
  if (/plaque|plastron|harnois|heaume|brassard|acier|gantelet|greve/.test(n)) return 'plaque';
  if (/rembourr|gambison|matelass/.test(n)) return 'rembourre';
  const pa = item.pa ?? 0;
  return pa >= 4 ? 'plaque' : pa >= 2 ? 'maille' : pa >= 1 ? 'cuir' : 'rembourre';
}

/** Slot de corps couvert par cet item (via ses locs WFRP4) — false si pas ce slot.
 *  `pied`/`main`/`cou` : couverture DÉRIVÉE des HitLocation existantes (pied←jambes, main←bras,
 *  cou←corps) — c'est du VISUEL et du calcul de PA sur la zone parente, PAS une nouvelle HitLocation
 *  moteur (le RAW WFRP4 n'en a pas ; la localisation d'armure reste tete/corps/bras/jambe). Une
 *  armure de statblock non-portée ne produit AUCUN item (`synthArmour`, #774) : plus
 *  besoin de gate ici — tout item présent COUVRE ses zones dérivées (porté = pleinement rendu). */
function coversSlot(item: Pick<ItemInstance, 'locs'>, slot: Slot): boolean {
  const map: Partial<Record<Slot, HitLocation[]>> = {
    tete: ['tete'], torse: ['corps'], bras: ['brasG', 'brasD'], jambes: ['jambeG', 'jambeD'],
    pied: ['jambeG', 'jambeD'], main: ['brasG', 'brasD'], cou: ['corps'],
  };
  const locs = map[slot];
  return !!locs && (item.locs ?? []).some((l) => locs.includes(l));
}

export function armourPart(item: PieceDeDessin, slot: Slot): PartArt | null {
  if (!coversSlot(item, slot)) return null;
  const mat = item.materiau;
  // Art dessiné par le workflow (matériau × emplacement) en priorité, COULEUR résolue contre la
  // palette du matériau (défaut sans perte) + le SKIN de l'objet (override par-objet, légendaire).
  const art = ARMOUR[mat]?.[slot as 'tete' | 'torse' | 'bras' | 'jambes' | 'pied' | 'main' | 'cou'];
  // Les 4 matériaux couvrent tete/torse/bras/jambes ; pour un slot qu'aucun def ne dessine (pied/main/cou),
  // art est absent → null, et la zone retombe sur son repli de chair (resolve.ts).
  return art
    ? applyTokenMapArt(art, tableDObjet([ARMOUR_PALETTES[mat] ?? {}], item.skin))
    : null;
}

const TABLE_PORTEUR_DEFAUT = buildTokenMap([]);
/** Rendu d'un OBJET SANS PORTEUR (icône, galerie) : la part d'arme, d'armure ou de bouclier passée
 *  par la table du porteur PAR DÉFAUT (#1903), qui résout ses clés porteur. */
export function objetSansPorteur(art: PartArt): PartArt {
  return applyTokenMapArt(art, TABLE_PORTEUR_DEFAUT);
}
