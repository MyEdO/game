import type { Combatant, Weapon, ItemInstance, HitLocation, QualityInstance } from '../../../engine/types';
import { isCapeItem } from '../../../engine/items';
import type { Slot } from '../bones';
import type { PartArt } from './types';
import { ARMOUR, ARMOUR_PALETTES } from './armour';
import { WEAPON_DEFS } from './weapons/_registry.generated';
import { SHIELD_DEFS } from './shields/_registry.generated';
import { weaponGroupKey } from '../../../engine/weaponGroup';
import { norm as wnorm } from './weaponForms';
import { findTrappingById } from '../../../data';
import { buildTokenMap, tableDObjet, applyTokenMapArt } from '../palette';

/** Contexte d'équipement extrait d'un Combatant (le rendu lit l'engine — direction permise). */
export interface EquipCtx {
  weapons: Weapon[];
  armour: ItemInstance[];           // pièces d'armure ÉQUIPÉES (locs renseignés), couche VISIBLE d'abord
  shield?: Weapon | ItemInstance;
  cape?: ItemInstance;              // cape/manteau porté (cosmétique — rendu dorsal)
}

export const isShield = (x: { label: string; qualities?: QualityInstance[] }) =>
  (x.qualities ?? []).some((q) => q.id === 'protectrice') || /bouclier/i.test(x.label);

/** Rang d'affichage des matériaux : la couche du DESSUS s'affiche (plaque sur maille sur cuir). */
const MATERIAL_RANK: Record<ReturnType<typeof armourMaterial>, number> = { plaque: 3, maille: 2, cuir: 1, rembourre: 0 };

export function equipFromCombatant(c: Combatant): EquipCtx {
  const weapons = c.weapons ?? [];
  // Pièces TRIÉES par matériau décroissant : par slot, le rendu (resolve.ts) prend la 1re pièce qui
  // le couvre → un héros en cuir + maille montre la maille, la plate par-dessus tout.
  const armour = (c.items ?? [])
    .filter((i) => i.kind === 'armor' && i.equipped && (i.locs?.length ?? 0) > 0)
    .sort((a, b) => MATERIAL_RANK[armourMaterial(b)] - MATERIAL_RANK[armourMaterial(a)]);
  const shield = weapons.find(isShield); // un bouclier tenu est dans le set actif → présent dans c.weapons
  const cape = (c.items ?? []).find((i) => i.equipped && isCapeItem(i));
  return { weapons, armour, shield, cape };
}

/** Ensemble des slugs de FORME catalogués (clés de l'art rig) — pour valider un `shape` reçu en donnée.
 *  `epee` (forme générique, repli du Groupe `base` + défaut final) est une def du registre comme les autres. */
const ART_BY_SLUG = new Set(WEAPON_DEFS.map((d) => d.slug));

/** Forme par défaut d'un Groupe canonique (REPLI quand l'arme ne porte pas de `shape` : armes
 *  génériques de statbloc / hors catalogue). Le Groupe (WFRP4) n'encode pas la forme — c'est un
 *  simple défaut visuel par famille, pas un routage de libellé. */
const ART_BY_GROUP: Record<string, string> = {
  base: 'epee', escrime: 'rapiere', deuxmains: 'epee_batarde',
  cavalerie: 'lance_cavalerie', hast: 'lance', fleau: 'fleau', parade: 'main_gauche', bagarre: '',
  arc: 'arc', arbalete: 'arbalete', poudre: 'pistolet', ingenierie: 'pistolet_rep',
  fronde: 'fronde', lancer: 'javelot', entraves: 'fouet', explosifs: 'bombe',
};

/**
 * FORME d'art de l'arme (clé du registre WEAPONS) = 1 silhouette. Routage PAR ID STABLE, plus aucun
 * lookup de libellé/regex au runtime (« lookup par libellé = bug multilingue ») :
 *  1. attaque naturelle (`w.natural`) → aucune arme tenue ;
 *  2. arme invoquée (`w.form` = id de trapping) → son `shape` catalogué ;
 *  3. `w.shape` catalogué (stampé au spawn depuis l'objet/le trait) ;
 *  4. repli par Groupe canonique (armes génériques sans shape).
 */
export function weaponFamily(w: Weapon): string {
  if (w.natural) return ''; // attaque naturelle (corps) : la part du rig fait foi, rien en main
  if (w.form) { // arme invoquée : `form` porte un id de trapping → résolu par id vers son shape
    const s = findTrappingById(w.form)?.shape;
    if (s && ART_BY_SLUG.has(s)) return s;
  }
  if (w.shape && ART_BY_SLUG.has(w.shape)) return w.shape;
  return ART_BY_GROUP[weaponGroupKey(w)] ?? (w.type === 'ranged' ? 'arc' : 'epee');
}

/**
 * Parts d'arme (repère local de l'os `arme`, manche à l'origine).
 * ART DES FORMES = registre auto-chargé `weapons/defs/` (1 arme = 1 fichier ; les réécritures
 * lisibilité de l'audit aveugle sont déjà bakées dans chaque def). `epee` (forme générique, repli
 * du Groupe `base` via `ART_BY_GROUP` + défaut final de `weaponPart`) est une def comme les autres.
 */
// Art des formes RÉSOLU par la table d'OBJET du def (`tableDObjet`) : les clés porteur restent en
// jeton pour la passe du porteur. Relevé sur `PartArt` : préserve un art DIRECTIONNEL verbatim.
const FORM_ART: Record<string, PartArt> = Object.fromEntries(
  WEAPON_DEFS.map((d) => [d.slug, applyTokenMapArt(d.art, tableDObjet([d.palette ?? {}]))]),
);
const FORM_DEF = new Map(WEAPON_DEFS.map((d) => [d.slug, d]));
const WEAPONS: Record<string, PartArt> = FORM_ART;

export function weaponPart(w: Weapon): PartArt {
  const f = weaponFamily(w);
  if (f === '') return ''; // mains nues : pas d'arme
  // SKIN d'objet légendaire : re-résout l'art du def contre SA palette + l'override d'instance
  // (≠ tenues qui suivent la palette du PORTEUR). Sans skin → art @défaut précalculé.
  const def = w.skin ? FORM_DEF.get(f) : undefined;
  if (def) return applyTokenMapArt(def.art, tableDObjet([def.palette ?? {}], w.skin));
  return WEAPONS[f] ?? WEAPONS.epee;
}

/** Silhouette de bouclier (os `bouclier`, main faible) — registre DATA-DRIVEN `shields/defs/`,
 *  routé par SLUG de FORME (`x.shape`, stampé au spawn depuis le trapping), plus aucun lookup de
 *  libellé ; repli = le def marqué `fallback` (rondache). Plus aucun SVG ni tableau en dur ici. */
const SHIELD_BY_SLUG = new Map(SHIELD_DEFS.map((d) => [d.slug, d]));
const SHIELD_FALLBACK = SHIELD_DEFS.find((d) => d.fallback) ?? SHIELD_DEFS[0];
const TABLE_BOUCLIER = tableDObjet([]);
export function shieldPart(x: Weapon | ItemInstance): PartArt {
  const d = (x.shape ? SHIELD_BY_SLUG.get(x.shape) : undefined) ?? SHIELD_FALLBACK;
  return applyTokenMapArt(d.art, TABLE_BOUCLIER);
}

/** Matériau inféré du nom (sinon palier de PA). Cuir AVANT plaque (« Plastron de cuir »). */
export function armourMaterial(item: ItemInstance): 'rembourre' | 'cuir' | 'maille' | 'plaque' {
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
 *  armure de statblock non-portée ne produit désormais AUCUN item (`synthArmour`, #774) : plus
 *  besoin de gate ici — tout item présent COUVRE ses zones dérivées (porté = pleinement rendu). */
function coversSlot(item: ItemInstance, slot: Slot): boolean {
  const map: Partial<Record<Slot, HitLocation[]>> = {
    tete: ['tete'], torse: ['corps'], bras: ['brasG', 'brasD'], jambes: ['jambeG', 'jambeD'],
    pied: ['jambeG', 'jambeD'], main: ['brasG', 'brasD'], cou: ['corps'],
  };
  const locs = map[slot];
  return !!locs && (item.locs ?? []).some((l) => locs.includes(l));
}

export function armourPart(item: ItemInstance, slot: Slot): PartArt | null {
  if (!coversSlot(item, slot)) return null;
  const mat = armourMaterial(item);
  // Art dessiné par le workflow (matériau × emplacement) en priorité, COULEUR résolue contre la
  // palette du matériau (défaut sans perte) + le SKIN de l'objet (override par-objet, légendaire).
  const art = ARMOUR[mat]?.[slot as 'tete' | 'torse' | 'bras' | 'jambes' | 'pied' | 'main' | 'cou'];
  // Les 4 matériaux couvrent tete/torse/bras/jambes ; pour un slot qu'aucun def ne dessine (pied/main/cou),
  // art est absent → null, et la zone retombe sur son repli de chair (resolve.ts).
  return art
    ? applyTokenMapArt(art, tableDObjet([ARMOUR_PALETTES[mat] ?? {}], item.skin as Record<string, string> | undefined))
    : null;
}

const TABLE_PORTEUR_DEFAUT = buildTokenMap([]);
/** Rendu d'un OBJET SANS PORTEUR (icône, galerie) : la part d'arme, d'armure ou de bouclier passée
 *  par la table du porteur PAR DÉFAUT (#1903 D2), qui résout ses clés porteur. */
export function objetSansPorteur(art: PartArt): PartArt {
  return applyTokenMapArt(art, TABLE_PORTEUR_DEFAUT);
}
