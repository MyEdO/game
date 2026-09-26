/**
 * RÉSOLVEUR D'AIRE des munitions/armes à effet de zone — SOURCE UNIQUE partagée par le tir individuel
 * (`combatFlow.applyAttackResult`) ET la bordée navale (`combatSlice.shipBatteryConfirm`). Module FEUILLE
 * (convention « baril ») : n'importe RIEN de combatFlow ; combatFlow le ré-exporte (`export * from './combatArea'`).
 *
 * Lit GÉNÉRIQUEMENT les capacités d'arme (`resolveQualities` → `caps`) — aucun id d'arme ni chemin naval bespoke :
 *  - **Tir de zone (Indice)** (Aux Armes p.89 / MDG 12 l.466-472) : selon la bande de portée —
 *      · Bout portant → la cible seule, **+Indice aux Dégâts** (RAW) ;
 *      · Courte à Longue → la cible **+ les Indice cibles les plus proches** ;
 *      · Extrême → comme Courte-Longue mais **−Indice aux Dégâts** (bande jadis manquante).
 *  - **Explosion (Indice)** (LDB 62 l.254) : « Tous les Personnages situés à Indice mètres du point cible frappé
 *      subissent DR + Dégâts d'arme et gagnent tous les États infligés par l'arme. » → DR+Dégâts (déjà dans
 *      `damage`) + propagation des États PAR LE CHEMIN GÉNÉRIQUE `fireTriggers(...,'onHit',...)` (pas de pose bespoke).
 *
 * SOURCE DES CIBLES SECONDAIRES — DEUX branches PROPRES dans `areaTargets`, dispatchées sur la NATURE de la
 * cible primaire (composition LITTÉRALE de deux règles RAW, aucune invention) :
 *  - **cible = personnage (terre)** : rayon métrique Chebyshev autour de la cible, converti à l'échelle de la
 *    scène (`metresPerTile`, 2 m person-scale) — PAS le « 2 m » codé en dur ;
 *  - **cible = navire (mer, `bodyShape:'vehicule'`)** : COMPOSITION de MDG 13 (un coup à la Localisation
 *    « Équipage » touche un marin EXPOSÉ « comme un combat normal ») × MDG 12 l.466-472 / LDB 62 l.254 (Tir de
 *    zone ajoute les Indice plus proches ; Explosion touche tous dans le rayon) → l'aire balaie l'ÉQUIPAGE
 *    EXPOSÉ du navire (`exposedCrew`, MÊME précédent que les Éclats d'un Critique de coque), car à l'échelle
 *    Mer (10 m/case) un rayon métrique < 1 case n'attraperait personne. PAS de cas spécial « navires au
 *    contact » : un autre navire n'est touché que si la règle métrique générique l'attrape (cible personnage).
 *
 * APPLIQUE les effets (mute via `loseWounds` + `fireTriggers`) et renvoie les lignes de journal. RNG injecté.
 */
import type { Get, Set as SetFn } from './flowTypes';
import type { Combatant, Weapon, HitLocation } from '../engine/types';
import { woundsFromHit, rangeBandName } from '../engine/combat';
import { sceneMetresPerTile } from './scene';
import { bonus, effectiveChar } from '../engine/characteristics';
import { effectiveWeaponRange } from '../engine/weaponDamage';
import { loadedAmmo } from '../engine/items';
import { resolveQualities } from '../engine/qualities/dispatch';
import { loseWounds, isOutOfAction } from '../engine/conditions';
import { exposedCrew } from '../engine/shipCritical';
import { combatantsWithinRadius } from './combatGeometry';
import { emitCombatEvent } from './combatEvents';
import { t as tr, type MsgKey } from '../i18n';
import { RNG, defaultRNG } from '../engine/dice';
import type { Pt } from './path';

/** Contexte d'une touche à résoudre en aire — commun au tir individuel, à la bordée ET au pilonnage
 *  INDIRECT (« viser une case », AA 10 l.169/171 : mortier/catapulte à arc élevé visent un POINT au sol). */
export interface AreaHit {
  attacker: Combatant;
  /** Cible primaire — celle qui a encaissé la touche directe (tir individuel/bordée), EXCLUE de l'aire.
   *  ABSENTE pour le tir INDIRECT visant une CASE : le centre n'est pas forcément un combattant, l'Explosion
   *  frappe alors tout le rayon (aucune primaire à exclure). */
  primaryTarget?: Combatant;
  /** Arme EFFECTIVE (munition + sous-effectif déjà bakés) — porteuse des Atouts d'aire et des effets `onHit`. */
  weapon: Weapon;
  /** Dégâts BRUTS du tir (DR + Dégâts d'arme + qualités) déjà subis par la cible primaire. */
  damage: number;
  /** Localisation de la touche primaire (re-jouée sur les cibles secondaires faute de jet par cible). */
  location: HitLocation;
  /** Distance attaquant→cible en CASES (pour la bande de portée). */
  distanceTiles: number;
  /** Point d'impact CHOISI (pilonnage indirect) : l'aire se centre ICI. Absent → centre = `primaryTarget.pos`
   *  (tir direct/bordée — STRICTEMENT inchangé). Présent : l'Explosion frappe tout le rayon autour de la case. */
  center?: Pt;
  /** DR (Degrés de Réussite) du jet de tir — propagé aux effets `onHit` des cibles de zone (`ctx.sl`) pour
   *  les échelles `valuePerSL` (Canon à flammes nain : « 2 + DR En flammes », ADE II 8 l.243). Absent → 0. */
  margin?: number;
}

/**
 * SOURCE des cibles secondaires d'une aire — STRATÉGIE injectée (terrestre vs naval) : renvoie, des plus
 * « proches »/prioritaires aux moins, les cibles candidates EXCLUANT la primaire. `resolveWeaponArea`
 * applique ensuite le plafond d'Indice (Tir de zone) ou prend toute la liste (Explosion).
 */
export type AreaTargets = (hit: AreaHit) => Combatant[];

/** Convertit un rayon en MÈTRES en un rayon en CASES (Chebyshev), via l'échelle de scène (≥1 case). */
function metresToTiles(metres: number, metresPerTile: number): number {
  return Math.max(1, Math.ceil(metres / Math.max(1, metresPerTile)));
}

/** Indice d'AIRE d'une arme EFFECTIVE (le plus grand de Explosion / Tir de zone) — `0` si l'arme n'a aucun
 *  Atout d'aire. Lu pour dimensionner le gabarit du placeur de case (pilonnage indirect). PUR. */
export function weaponAreaIndice(weapon: Weapon): number {
  let indice = 0;
  for (const r of resolveQualities(weapon)) if (r.caps?.explosion || r.caps?.areaFire) indice = Math.max(indice, r.indice ?? 1);
  return indice;
}

/** Rayon (en CASES) de l'aire d'une arme EFFECTIVE à l'échelle de la scène (Chebyshev) — `0` si pas d'aire.
 *  SOURCE UNIQUE du dimensionnement de l'aire (gabarit du placeur ET cible-repère du pilonnage). PUR. */
export function blastRadiusTiles(weapon: Weapon, metresPerTile: number): number {
  const indice = weaponAreaIndice(weapon);
  return indice > 0 ? metresToTiles(indice, metresPerTile) : 0;
}

/** Un porteur de navire (carène) — détecté par `bodyShape:'vehicule'` (≠ personnage). */
const isShip = (c: Combatant): boolean => c.bodyShape === 'vehicule';

/**
 * SOURCE des cibles secondaires — DEUX branches RAW (cf. en-tête) dispatchées sur la cible primaire :
 *  - personnage → les combattants vivants d'un AUTRE camp que l'attaquant à ≤ `indice` mètres (Chebyshev, échelle `metresPerTile`), du plus proche au plus loin ;
 *  - navire (`bodyShape:'vehicule'`) → son ÉQUIPAGE EXPOSÉ (`crewOf` → `exposedCrew`) ; le rayon métrique ne
 *    s'applique pas (10 m/case → < 1 case). Le plafond d'Indice (Tir de zone) est appliqué par `resolveWeaponArea`.
 * `crewOf` résout les `crewIds` d'un navire en combattants (le caller le fournit ; combatFlow renvoie [] : pas d'équipage en person-scale).
 */
export function areaTargets(combatants: Combatant[], metresPerTile: number, crewOf: (ship: Combatant) => Combatant[] = () => []): (indice: number) => AreaTargets {
  return (indice) => (hit) => {
    if (hit.primaryTarget && isShip(hit.primaryTarget)) return exposedCrew(crewOf(hit.primaryTarget)); // mer : balaie le pont (Éclats-like)
    // Centre : le point d'impact CHOISI (pilonnage indirect) sinon la position de la primaire (tir direct/bordée).
    const center = hit.center ?? hit.primaryTarget?.pos;
    if (!center) return [];
    // TERRE : combattants d'un AUTRE camp que l'attaquant, vivants, dans le rayon métrique (Chebyshev), via la primitive de géométrie d'aire PARTAGÉE.
    // La primaire (si présente) est exclue ; viser une CASE n'a pas de primaire → l'Explosion frappe tout le rayon.
    return combatantsWithinRadius(center, metresToTiles(indice, metresPerTile), combatants,
      (c) => c.kind !== hit.attacker.kind && c.id !== hit.primaryTarget?.id && !isOutOfAction(c));
  };
}

/** Applique DR+Dégâts à une cible SECONDAIRE et propage les États « infligés par l'arme » (chemin générique
 *  `onHit`). Renvoie la ligne de journal de la touche + celles des effets déclenchés. */
function hitSecondary(
  get: Get, set: SetFn, hit: AreaHit, victim: Combatant, damage: number, msgKey: MsgKey, rng: RNG,
): string[] {
  const wl = woundsFromHit(hit.weapon, victim, hit.location, damage, 0, 0, hit.attacker.size); // plancher 0 (navire/ricochet)
  const lines: string[] = [];
  if (wl > 0) loseWounds(victim, wl);
  lines.push(tr(msgKey, { name: victim.label, wl }));
  // États « infligés par l'arme » via le MÊME dispatcher que le tir individuel (Empêtré, En flammes, Venin…),
  // déclenchés dès la touche — parité avec la cible PRIMAIRE (`applyAttackResult` fire l'onHit sur `res.hit` seul).
  // Une arme à Dégâts « Spéciaux » (Canon à flammes nain, ADE II 8 l.243) applique donc son État à 0 Blessure ;
  // les effets qui EXIGENT une Blessure se gardent EUX-MÊMES (Condition Flow `woundsDealt > 0` : Venin/Empoisonnement).
  if (!isOutOfAction(victim))
    emitCombatEvent('onHit', { get, set, battle: get().battle!, self: hit.attacker, sink: (line) => lines.push(line), triggerCtx: { victim, weapon: hit.weapon, woundsDealt: wl, margin: hit.margin, location: hit.location, attackType: hit.weapon.type, rng } });
  return lines;
}

/**
 * Résout TOUS les effets d'aire d'une touche (Tir de zone ET Explosion cumulables), mutant les cibles et
 * renvoyant les lignes de journal. `targetsFor(indice)` = STRATÉGIE de cibles secondaires (terrestre/naval).
 * NE re-jette AUCUN jet de toucher (RAW : un nuage de projectiles / un souffle ne re-teste pas).
 */
export function resolveWeaponArea(
  get: Get, set: SetFn, hit: AreaHit, targetsFor: (indice: number) => AreaTargets, rng: RNG = defaultRNG,
): { lines: string[] } {
  const lines: string[] = [];
  const { primaryTarget: target, weapon } = hit;
  const quals = resolveQualities(weapon);

  // ── Tir de zone (Aux Armes p.89 / MDG 12) ──────────────────────────────────────────────────────────
  const tz = quals.find((r) => r.caps?.areaFire);
  if (tz) {
    const indice = tz.indice ?? 1;
    const rangeM = effectiveWeaponRange(weapon, loadedAmmo(hit.attacker, weapon)?.ammoRangeMod, () => bonus(effectiveChar(hit.attacker, 'force'))); // Portée résolue (BF) + modificateur de munition
    const band = rangeM != null ? rangeBandName(hit.distanceTiles, rangeM, sceneMetresPerTile(get().scene)) : 'Bout portant';
    if (band === 'Bout portant' && target) {
      // +Indice aux DÉGÂTS sur la cible seule (≠ +Indice Blessures brut). La cible a déjà encaissé `damage` ;
      // on applique le SURCROÎT de Blessures dû à `damage + indice` (woundsFromHit est monotone). Sans primaire
      // (pilonnage indirect d'une case) il n'y a PAS de « cible seule » de Bout portant → on retombe sur la branche
      // d'aire (les N plus proches autour de la case), via la condition `&& target`.
      const extra = woundsFromHit(weapon, target, hit.location, hit.damage + indice, 0, 0, hit.attacker.size) - woundsFromHit(weapon, target, hit.location, hit.damage, 0, 0, hit.attacker.size);
      if (extra > 0 && !isOutOfAction(target)) loseWounds(target, extra);
      lines.push(tr('cf.blastPointBlank', { name: target.label, indice }));
    } else {
      // Courte-Longue : cible + Indice plus proches. Extrême : idem mais −Indice aux Dégâts.
      const dmg = band === 'Extrême' ? hit.damage - indice : hit.damage;
      for (const sec of targetsFor(indice)(hit).slice(0, indice))
        lines.push(...hitSecondary(get, set, hit, sec, dmg, 'cf.blastSecondary', rng));
    }
  }

  // ── Explosion (LDB 62 l.254) : toutes les cibles candidates — DR+Dégâts + États de l'arme (pas de plafond d'Indice) ──
  const expl = quals.find((r) => r.caps?.explosion);
  if (expl) {
    const indice = expl.indice ?? 1;
    for (const victim of targetsFor(indice)(hit))
      lines.push(...hitSecondary(get, set, hit, victim, hit.damage, 'cf.blastExplosion', rng));
  }

  return { lines };
}
