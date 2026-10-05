/**
 * VOLÉE DE BORDÉE — « Tir de batterie » (MDG 14 l.128), résolution PURE. Module FRÈRE de `shipCritical.ts` : ne mute
 * RIEN (l'appelant applique les Blessures + un `applyHullCritical` par pièce critique). RAW : un seul Test d'équipage
 * (Artilleur ★) produit un DR PARTAGÉ qui REMPLACE le jet de touche de chaque pièce, « pour le meilleur et pour le pire »
 * (l.128) → le DR (POSITIF OU NÉGATIF) s'ajoute aux Dégâts de chaque pièce.
 *
 * PRINCIPE (corrige une DÉRIVE : la volée ré-implémentait son propre calcul de Dégâts, larguant munitions/sous-effectif/
 * qualités) — chaque pièce est résolue par les MÊMES fonctions AGNOSTIQUES que le tir individuel : préparation d'arme
 * (`weaponWithAmmo` munition + `crewedFireWeapon` sous-effectif), DR d'Atouts (`attackDRAdjust` : Imprécise, Pointue), Dégâts
 * (`effectiveWeaponDamage`), Blessures (`woundsFromHit` : BE + blindage + Perforante + bypass,
 * plancher 0 navire). Seules la LOCALISATION des Dégâts d'un bateau (1d100 par gréement, MDG 13 l.571) et la
 * détection de CRITIQUE (double sur ce 1d100, OU coque à 0 — MDG 13 l.656) restent spécifiques au navire. Le
 * SUCCÈS du Test d'équipage (MDG 14 l.13, `crewTestSuccess`) est transmis par l'appelant : il conditionne les
 * Dégâts, les DR d'Atouts « Test réussi » (LDB 62 l.288) et le Critique (l.656).
 */
import { d100, type RNG, defaultRNG } from './dice';
import { isDoubleRoll } from './tests';
import { effectiveWeaponDamage } from './weaponDamage';
import { woundsFromHit, shipHitLocation, type ShipRig, type ShipLocation } from './combat';
import { attackDRAdjust } from './qualities/dispatch';
import { mannedPosteWeapon, loadedAmmo, weaponWithAmmo, itemLabel } from './items';
import { crewedFireWeapon } from './crewedWeapon';
import { crewedTeamIndice } from './qualities/dispatch';
import { exposedCrew } from './shipCritical';
import type { Combatant, ShipPoste, Weapon, ItemInstance } from './types';

export interface VolleyShot {
  weaponName: string;
  /** Munition tirée (journal), si une était chargée. */
  ammoName?: string;
  /** Dégâts bruts (arme + DR partagé + qualités) avant mitigation — 0 si le Test d'équipage est raté (l.13). */
  damage: number;
  /** Blessures infligées à la coque (après BE + blindage + Perforante, plancher 0) — 0 si le Test est raté. */
  wounds: number;
  location: ShipLocation;
  /** Le 1d100 de localisation — jet de touche substitué (ch.13 l.571). */
  locRoll: number;
  /** Sur un Test d'équipage RÉUSSI seulement : double sur le 1d100, OU coque déjà à 0 (MDG 13 l.656). */
  critical: boolean;
  /** uid de la pièce (`item.uid`) — pour poser la Recharge sur le bon poste après le tir. */
  posteUid: string;
  /** Munition TIRÉE (l'instance du stock du poste / de l'inventaire du chef) — consommée par l'appelant
   *  (`consumeAmmo`, MDG 12 l.410-424) : le résolveur reste PUR, aucune mutation ici. */
  ammo?: ItemInstance;
  /** Recharge effective de la pièce (Recharge N, ×2 si sous-effectif via `crewedFireWeapon`) — Rounds avant de re-tirer. */
  reload: number;
  /** Arme EFFECTIVE de la pièce (munition + sous-effectif déjà bakés) — pour rejouer les effets `onHit` et l'AIRE
   *  côté appelant SANS re-dériver l'arme (anti-duplication : `resolveVolley` la construit déjà). */
  weapon: Weapon;
}

export interface VolleyResult {
  shots: VolleyShot[];
  totalWounds: number;
}

// (La munition tirée passe par `loadedAmmo` — SOURCE UNIQUE partagée avec le tir individuel : munition
//  CAPTURÉE au chargement (registre de l'arme ou de la PIÈCE, loadRegister), pool = stock du poste
//  (MDG 12 l.410-424) ∪ inventaire du chef. Pas de gate `kind:'hero'` : un équipage PNJ charge aussi.)

/**
 * Résout la volée d'une bordée. `firingShip` = navire tireur ; `postes` = pièces du bord qui porte ; `target` = coque
 * cible ; `rig` = gréement de la CIBLE (colonne de localisation) ; `dr` = DR partagé du Test d'équipage Artilleur ;
 * `success` = ce même Test est-il RÉUSSI (`crewTestSuccess`, MDG 14 l.13) — le Test d'équipage TIENT LIEU de jet de
 * touche de chaque pièce (l.128), donc raté la bordée manque en bloc : chaque pièce a fait feu (Recharge + munition
 * consommées) mais n'inflige ni Dégâts, ni Blessures, ni Critique (#1019) ;
 * `crew` = combattants de l'équipage tireur (pour résoudre chef + effectif de chaque pièce). PUR (RNG injecté).
 *
 * `opts.merScale` (couche MER, MDG 14 l.39 « la performance des Personnages représente celle de tout l'équipage ») :
 * l'équipage est ABSTRAIT — une pièce du bord qui porte est réputée SERVIE par l'équipage du navire, même sans `crewIds`
 * posés dessus (le Manque de bras s'exprime au DR du Test d'équipage — `shipUndercrew` —, jamais par une pièce muette).
 * L'effectif par pièce vaut alors l'Indice PLEIN (aucun sous-effectif par-pièce, déjà porté par le DR d'équipage). Au
 * Pont (person-scale) le comportement est INCHANGÉ : une pièce sans servant reste muette (les héros SERVENT les pièces).
 */
export function resolveVolley(
  firingShip: Combatant, postes: ShipPoste[], target: Combatant, rig: ShipRig, dr: number, success: boolean,
  crew: Combatant[], rng: RNG = defaultRNG,
  opts: { merScale?: boolean } = {},
): VolleyResult {
  const byId = new Map(crew.map((c) => [c.id, c] as const));
  const shipCrew = exposedCrew(crew); // équipage APTE du navire tireur — représentant abstrait à la Mer
  const shots: VolleyShot[] = [];
  for (const poste of postes) {
    const servants = exposedCrew((poste.crewIds ?? []).map((id) => byId.get(id)).filter((c): c is Combatant => !!c));
    const abstract = !!opts.merScale && !servants.length && shipCrew.length > 0; // équipage abstrait sert la pièce (l.39)
    if (!servants.length && !abstract) continue; // pièce non servie → ne tire pas (RAW : il faut un équipage)
    let weapon = mannedPosteWeapon(firingShip, poste);
    if (!weapon) continue; // pièce détruite
    const chef = byId.get((poste.crewIds ?? [])[0]) ?? (abstract ? shipCrew[0] : undefined);
    const ammo = chef ? loadedAmmo(chef, weapon) : undefined;
    if (ammo) weapon = weaponWithAmmo(weapon, ammo);
    // À la Mer : effectif = Indice PLEIN (équipage abstrait au complet) → aucun sous-effectif par pièce ; au Pont : réel.
    weapon = crewedFireWeapon(weapon, abstract ? crewedTeamIndice(weapon) : servants.length); // Recharge×2 / Imprécise / Dangereuse selon l'effectif
    // DR de la pièce = DR partagé + Atouts d'attaque de l'arme (`attackDRAdjust` : Imprécise, LDB 62 l.323 ;
    // Pointue, LDB 62 l.288 — muette hors Test réussi). Test d'équipage raté (MDG 14 l.13) → aucun Dégât.
    // « Pour le pire » (l.128) : sur un Test RÉUSSI, un DR négatif réduit les Dégâts — on n'écrase PAS le DR à 0.
    const gunDR = dr + attackDRAdjust(weapon, success);
    const damage = success ? effectiveWeaponDamage(weapon, 0) + gunDR : 0;
    const wounds = success ? woundsFromHit(weapon, target, 'corps', damage, 0, 0, chef?.size) : 0; // BE/blindage/Perforante/bypass, plancher 0
    const locRoll = d100(rng); // Localisation des Dégâts d'un bateau (MDG 13 l.571)
    shots.push({
      weaponName: weapon.label, ammoName: ammo ? itemLabel(ammo) : undefined, ammo, damage, wounds, weapon, // arme effective : Atouts d'aire + effets onHit côté appelant
      location: shipHitLocation(rig, locRoll), locRoll,
      critical: success && (isDoubleRoll(locRoll) || target.wounds.current <= 0), // jet d'attaque RÉUSSI : double, OU coque à 0 (l.656)
      posteUid: poste.item.uid, reload: weapon.reload ?? 0, // Recharge effective (crewedFireWeapon a doublé si sous-effectif)
    });
  }
  return { shots, totalWounds: shots.reduce((s, x) => s + x.wounds, 0) };
}
