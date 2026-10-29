import { findTeinteById, findWeaponGroupById, groupeDArmure, groupesDArmure } from '../../../data';
import type { ItemInstance, HitLocation } from '../../../engine/types';
import type { BouclierDeDessin, FormeDArme, MatiereDArmure, PieceDeDessin } from '../../../noyau/equipementDessine';
import type { Slot } from '../../../engine/authoringAppearance';
import type { PartArt } from './types';
import { ARMOUR, ARMOUR_PALETTES } from './armour';
import { WEAPON_DEFS } from './weapons/_registry.generated';
import { SHIELD_DEFS } from './shields/_registry.generated';
import { racineDesCandidats } from '../../../engine/items';
import { buildTokenMap, tableDObjet, applyTokenMapArt } from '../palette';

/** Ensemble des slugs de FORME catalogués (clés de l'art rig) — pour valider une forme résolue.
 *  `epee` (forme générique, repli du Groupe `base` + défaut final) est une def du registre comme les autres. */
const ART_BY_SLUG = new Set(WEAPON_DEFS.map((d) => d.slug));

/** #2967 — repli d'une arme sans forme dessinée : la `forme` de son Groupe (`weaponGroups.json`, `null` : rien en
 *  main) ; une arme sans Groupe suit son type. */
export function weaponFamily(w: FormeDArme): string {
  if (w.natural) return ''; // attaque naturelle (corps) : la part du rig fait foi, rien en main
  const forme = racineDesCandidats(w.candidats);
  if (forme && ART_BY_SLUG.has(forme)) return forme;
  const groupe = findWeaponGroupById(w.subType);
  if (groupe?.kind === 'weapon') return groupe.forme?.id ?? '';
  return w.type === 'ranged' ? 'arc' : 'epee';
}

/**
 * Parts d'arme (repère local de l'os `arme`, manche à l'origine).
 * ART DES FORMES = registre auto-chargé `weapons/defs/` (1 arme = 1 fichier ; les réécritures
 * lisibilité de l'audit aveugle sont déjà bakées dans chaque def). Repli : la `forme` du Groupe
 * (`weaponGroups.json`), puis `epee`, défaut final de `weaponPart` et def comme les autres.
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
  const palette = findTeinteById(w.teinte)?.palette;
  const def = palette ? FORM_DEF.get(f) : undefined;
  if (def) return applyTokenMapArt(def.art, tableDObjet([def.palette ?? {}], palette));
  return WEAPONS[f] ?? WEAPONS.epee;
}

/** Silhouette de bouclier (os `bouclier`, main faible) — registre DATA-DRIVEN `shields/defs/`,
 *  routé par la forme RÉSOLUE (`bouclierDeDessin`), plus aucun lookup de libellé ; repli = le def
 *  marqué `fallback` (rondache). Plus aucun SVG ni tableau en dur ici. */
const SHIELD_BY_SLUG = new Map(SHIELD_DEFS.map((d) => [d.slug, d]));
const SHIELD_FALLBACK = SHIELD_DEFS.find((d) => d.fallback) ?? SHIELD_DEFS[0];
const TABLE_BOUCLIER = tableDObjet([]);
export function shieldPart(x: BouclierDeDessin): PartArt {
  const forme = racineDesCandidats(x.candidats);
  const d = (forme ? SHIELD_BY_SLUG.get(forme) : undefined) ?? SHIELD_FALLBACK;
  return applyTokenMapArt(d.art, TABLE_BOUCLIER);
}

/** Def d'art (`armour/defs/`) qui peint une matière d'armure : l'`art` de son Groupe. */
export const artDeMatiere = (matiere: MatiereDArmure): string => groupeDArmure(matiere).art;
/** Une matière que le def `defId` peint (galeries, audits d'art), `undefined` pour un def qu'aucune matière n'atteint. */
export const matiereDuDef = (defId: string): MatiereDArmure | undefined => groupesDArmure().find((g) => g.art === defId)?.id;

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
  const mat = artDeMatiere(item.matiere);
  // Art dessiné par le workflow (matériau × emplacement) en priorité, COULEUR résolue contre la
  // palette du matériau (défaut sans perte) + la teinte de l'objet.
  const art = ARMOUR[mat]?.[slot as 'tete' | 'torse' | 'bras' | 'jambes' | 'pied' | 'main' | 'cou'];
  // Les defs d'art couvrent tete/torse/bras/jambes ; pour un slot qu'aucun def ne dessine (pied/main/cou),
  // art est absent → null, et la zone retombe sur son repli de chair (resolve.ts).
  return art
    ? applyTokenMapArt(art, tableDObjet([ARMOUR_PALETTES[mat] ?? {}], findTeinteById(item.teinte)?.palette))
    : null;
}

const TABLE_PORTEUR_DEFAUT = buildTokenMap([]);
/** Rendu d'un OBJET SANS PORTEUR (icône, galerie) : la part d'arme, d'armure ou de bouclier passée
 *  par la table du porteur PAR DÉFAUT (#1903), qui résout ses clés porteur. */
export function objetSansPorteur(art: PartArt): PartArt {
  return applyTokenMapArt(art, TABLE_PORTEUR_DEFAUT);
}
