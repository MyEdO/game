import type { Combatant, ItemInstance, ShipPoste, Weapon } from './types';

/**
 * ÉTAT DE CHARGE — module FEUILLE (aucun import runtime) : les LECTEURS purs du cycle de charge.
 * L'état vit sur l'ARME (docs/plans/2026-08-16-hud-combat.md:73-79) : son registre (`loadRegister`), ou la
 * PIÈCE servie (`ShipPoste`) pour son canon.
 * Les ÉCRIVAINS (`loadWeapon`/`unloadWeapon`/`oublierCycleDeCharge`, engine/items.ts) sont les seuls à
 * poser/effacer.
 */
export interface WeaponLoadState {
  ammoUid?: string;
  loadedAmmoUid?: string;
  loaded?: boolean;
  reloadProgress?: number;
  chambered?: number;
}

/** Table TOTALE des champs du CYCLE de charge : tout `WeaponLoadState` hors le CHOIX de munition (`ammoUid`).
 *  Un champ ajouté au registre sans classement ne compile pas. */
export const CYCLE_DE_CHARGE = {
  loaded: true, reloadProgress: true, loadedAmmoUid: true, chambered: true,
} as const satisfies Record<Exclude<keyof WeaponLoadState, 'ammoUid'>, true>;

/** Le CYCLE de charge de ce registre a-t-il commencé ? Vrai dès qu'un champ de `CYCLE_DE_CHARGE` y est PRÉSENT. */
export function cycleCommence(reg: WeaponLoadState): boolean {
  return Object.keys(CYCLE_DE_CHARGE).some((k) => k in reg);
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

/** REGISTRE de charge de CETTE arme — SOURCE UNIQUE de lecture/écriture, dans cet ordre :
 *  1. la PIÈCE servie quand l'arme est la sienne (son cycle vit sur elle, MDG 12) ;
 *  2. l'OBJET possédé de même `uid` (`c.items`) — porteur PERSISTANT : il survit au re-dérivage du set
 *     actif (`recomputeLoadout`), donc changer de set ne téléporte ni n'efface un coup chargé ;
 *  3. l'instance d'arme du porteur (`c.weapons`) pour une arme SANS objet (statbloc de créature/ennemi) ;
 *  4. l'arme reçue elle-même (fixtures nues).
 *  L'arme reçue peut être une COPIE bakée (munition fusionnée, sous-effectif) : on ne l'écrit jamais
 *  quand un registre persistant existe. */
export function loadRegister(c: Combatant, weapon: Weapon): WeaponLoadState {
  const poste: ShipPoste | undefined = c.mannedPoste;
  if (poste && weapon.uid != null && poste.item?.uid === weapon.uid) return poste;
  if (weapon.uid == null) return weapon;
  return objetSourceDeLArme(c, weapon)
    ?? (c.weapons ?? []).find((w) => w.uid === weapon.uid)
    ?? weapon;
}

/** CETTE arme est-elle prête à tirer ? Sans Indice de Recharge il n'y a pas de cycle de charge (Arc, fronde :
 *  toujours prête). Une PIÈCE non renseignée est réputée AMORCÉE (`loaded !== false`, MDG 12) ; une arme
 *  personnelle doit avoir été chargée (`loaded === true`). */
export function weaponLoaded(c: Combatant, weapon: Weapon): boolean {
  if ((weapon.reload ?? 0) <= 0) return true;
  const reg = loadRegister(c, weapon);
  return reg === c.mannedPoste ? reg.loaded !== false : reg.loaded === true;
}

/** CETTE arme a-t-elle un rechargement à faire ? Arme de tir à Indice de Recharge, pas prête
 *  (`weaponLoaded`). Prédicat UNIQUE : dispatcher `battleReload`, verdict d'offre `arme-a-recharger`, IA (`ai.ts`, `combatFlow.ts`). */
export function armeARecharger(c: Combatant, weapon: Weapon): boolean {
  return weapon.type === 'ranged' && (weapon.reload ?? 0) > 0 && !weaponLoaded(c, weapon);
}

/** DR déjà cumulés au Test étendu de rechargement de CETTE arme (LDB 62 l.335). */
export function reloadProgressOf(c: Combatant, weapon: Weapon): number {
  return loadRegister(c, weapon).reloadProgress ?? 0;
}
