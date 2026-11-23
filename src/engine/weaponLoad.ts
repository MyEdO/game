import type { Combatant, ItemInstance, ShipPoste, Weapon } from './types';
import type { TraitInstance } from './statEntry';

/**
 * ÉTAT DE CHARGE — module FEUILLE (aucun import runtime) : les LECTEURS purs du cycle de charge.
 * Arbitrage utilisateur 2026-08-16 : « quand on charge une arme on sélectionne une munition » et « si j'ai
 * 2 armes à distance elles gèrent chacune leur propre rechargement et munition ».
 * Les ÉCRIVAINS (`loadWeapon`/`unloadWeapon`, engine/items.ts) sont les seuls à poser/effacer.
 */
export interface WeaponLoadState {
  ammoUid?: string;
  loadedAmmoUid?: string;
  loaded?: boolean;
  reloadProgress?: number;
  chambered?: number;
}

/** L'OBJET SOURCE de l'arme tenue : l'objet PORTÉ d'une arme dérivée (`derivedFromItem`), la pièce du poste
 *  SERVI (`mannedPoste.item`), sinon l'objet possédé de même `uid` (`c.items`). `undefined` pour une arme
 *  sans objet (statbloc, arme naturelle, Mains nues). */
export function objetSourceDeLArme(c: Combatant, weapon: Weapon): ItemInstance | undefined {
  if (weapon.derivedFromItem != null) return (c.items ?? []).find((i) => i.uid === weapon.derivedFromItem);
  if (weapon.uid == null) return undefined;
  if (c.mannedPoste?.item?.uid === weapon.uid) return c.mannedPoste.item;
  return (c.items ?? []).find((i) => i.uid === weapon.uid);
}

/** Le Trait source de cette arme autonome. #3693 */
export function traitSourceDeLArme(c: Combatant, weapon: Weapon): TraitInstance | undefined {
  return weapon.uid === undefined ? undefined : c.traits?.find((trait) => trait.uid === weapon.uid);
}

/** Détache le registre du Trait des descripteurs de profil partagés. #3693 */
export function modifierEtatDArmeDuTrait(c: Combatant, trait: TraitInstance): NonNullable<TraitInstance['etatDArme']> {
  if (!c.liveTraits?.includes(trait)) return trait.etatDArme ??= {};
  const etatDArme = { ...trait.etatDArme };
  c.traits = c.traits!.map((t) => t === trait ? { ...t, etatDArme } : t);
  return etatDArme;
}

/** Registre de charge : poste servi, objet, Trait d'arme ou instance de l'arme. #2907, #3693 */
export function loadRegister(c: Combatant, weapon: Weapon, mode: 'lecture' | 'ecriture' = 'lecture'): WeaponLoadState {
  const poste: ShipPoste | undefined = c.mannedPoste;
  if (poste && weapon.uid != null && poste.item?.uid === weapon.uid) return poste;
  if (weapon.uid == null) return weapon;
  const objet = objetSourceDeLArme(c, weapon);
  if (objet) return objet;
  const trait = traitSourceDeLArme(c, weapon);
  if (trait?.etatDArme) return mode === 'ecriture' ? modifierEtatDArmeDuTrait(c, trait) : trait.etatDArme;
  return (c.weapons ?? []).find((w) => w.uid === weapon.uid) ?? weapon;
}

/** CETTE arme est-elle prête à tirer ? Sans Indice de Recharge il n'y a pas de cycle de charge (Arc, fronde :
 *  toujours prête). Une PIÈCE non renseignée est réputée AMORCÉE (`loaded !== false`, MDG 12) ; une arme
 *  personnelle doit avoir été chargée (`loaded === true`). */
export function weaponLoaded(c: Combatant, weapon: Weapon): boolean {
  if ((weapon.reload ?? 0) <= 0) return true;
  const reg = loadRegister(c, weapon);
  return reg === c.mannedPoste ? reg.loaded !== false : reg.loaded === true;
}

/** CETTE arme a-t-elle un cycle de charge à faire ? Arme à distance à Indice de Recharge que `weaponLoaded`
 *  ne dit pas prête. LDB 62 l.335. */
export function aRecharger(c: Combatant, weapon: Weapon): boolean {
  return weapon.type === 'distance' && (weapon.reload ?? 0) > 0 && !weaponLoaded(c, weapon);
}

/** La chambre de CETTE arme est-elle pleine : une arme à Indice de Recharge que `weaponLoaded` dit prête. LDB 62 l.335. */
export function chambrePleine(c: Combatant, weapon: Weapon): boolean {
  return (weapon.reload ?? 0) > 0 && weaponLoaded(c, weapon);
}

/** DR déjà cumulés au Test étendu de rechargement de CETTE arme (LDB 62 l.335). */
export function reloadProgressOf(c: Combatant, weapon: Weapon): number {
  return loadRegister(c, weapon).reloadProgress ?? 0;
}

/** Une arme (par `uid` d'ItemInstance) est-elle ACTIVE dans le loadout courant ? Source de vérité = les
 *  armes DÉRIVÉES `c.weapons` (elles gèrent déjà contrainte 2 mains, amputation, destruction). Remplace la
 *  lecture de `it.equipped` pour les ARMES : « équipé » d'une arme = « tenue dans le set actif ». */
export function isWeaponActive(c: { weapons?: readonly { uid?: string }[] }, uid?: string): boolean {
  return uid != null && (c.weapons ?? []).some((w) => w.uid === uid);
}

/** Objet porté (`equipped`) ou tenu par une arme du loadout actif (`isWeaponActive`). */
export function isHeld(c: { weapons?: readonly { uid?: string }[] }, it: Partial<Pick<ItemInstance, 'uid' | 'equipped'>>): boolean {
  return !!it.equipped || isWeaponActive(c, it.uid);
}
