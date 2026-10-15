/**
 * VOLÉE DE BORDÉE — « Tir de batterie » (MDG 14 l.128), résolution PURE : ne mute RIEN. Le Test d'équipage
 * (`dr`, `success`, MDG 14 l.13) tient lieu du jet pour toucher de chaque pièce ; chaque coup est ensuite
 * la touche d'un tir ordinaire (`toucheAuJetPose`, MDG 12 l.375, EDOC 07 l.332), quelle que soit la cible.
 * L'appelant applique chaque `AttackResult` par la couture du coup (`applyAttackResult`).
 */
import { d100, type RNG, defaultRNG } from './dice';
import { toucheAuJetPose, type AttackResult, type RollBreakdown } from './combat';
import { attackDRAdjust } from './qualities/dispatch';
import { mannedPosteWeapon, loadedAmmo, weaponWithAmmo } from './items';
import { crewedFireWeapon } from './crewedWeapon';
import { crewedTeamIndice } from './qualities/dispatch';
import { exposedCrew } from './shipCritical';
import type { Combatant, ShipPoste, Weapon, ItemInstance } from './types';

export interface VolleyShot {
  /** Chef de pièce, ou représentant de l'équipage abstrait (MDG 14 l.39) : l'attaquant du coup. */
  tireur: Combatant;
  /** Arme EFFECTIVE de la pièce (munition + sous-effectif). */
  weapon: Weapon;
  /** Le coup, touché ou raté. */
  res: AttackResult;
  /** uid de la pièce (`item.uid`) — pour la décharger après le tir. */
  posteUid: string;
  /** Munition TIRÉE — consommée par l'appelant (MDG 12 l.410-424). */
  ammo?: ItemInstance;
  /** Recharge effective de la pièce. */
  reload: number;
}

/**
 * Résout la volée d'une bordée. `firingShip` = navire tireur ; `postes` = pièces du bord qui porte ; `target` = cible
 * (MDG 14 l.128 : « un ennemi ») ; `dr` = DR partagé du Test d'équipage ; `success` = ce Test est-il réussi
 * (`crewTestSuccess`, MDG 14 l.13) ; `crew` = équipage tireur. PUR (RNG injecté).
 *
 * `opts.merScale` (MDG 14 l.39) : une pièce sans servant est servie par l'équipage abstrait, à l'Indice plein.
 */
export function resolveVolley(
  firingShip: Combatant, postes: ShipPoste[], target: Combatant, dr: number, success: boolean,
  crew: Combatant[], rng: RNG = defaultRNG,
  opts: { merScale?: boolean } = {},
): VolleyShot[] {
  const byId = new Map(crew.map((c) => [c.id, c] as const));
  const shipCrew = exposedCrew(crew);
  const shots: VolleyShot[] = [];
  for (const poste of postes) {
    const servants = exposedCrew((poste.crewIds ?? []).map((id) => byId.get(id)).filter((c): c is Combatant => !!c));
    const abstract = !!opts.merScale && !servants.length && shipCrew.length > 0; // MDG 14 l.39
    if (!servants.length && !abstract) continue;
    let weapon = mannedPosteWeapon(firingShip, poste);
    if (!weapon) continue;
    const tireur = byId.get((poste.crewIds ?? [])[0]) ?? (abstract ? shipCrew[0] : servants[0]);
    const ammo = loadedAmmo(tireur, weapon);
    if (ammo) weapon = weaponWithAmmo(weapon, ammo);
    weapon = crewedFireWeapon(weapon, abstract ? crewedTeamIndice(weapon) : servants.length);
    const gunDR = dr + attackDRAdjust(weapon, success); // LDB 62 l.288, l.323
    const jet: RollBreakdown = { label: 'Tir de batterie', base: 0, modifier: 0, target: 0, roll: d100(rng), success, sl: gunDR };
    shots.push({
      tireur, weapon, ammo, res: toucheAuJetPose(tireur, target, weapon, jet, gunDR),
      posteUid: poste.item.uid, reload: weapon.reload ?? 0,
    });
  }
  return shots;
}
