/**
 * POUSSÉE d'un engin de siège CREWÉ (ADE II 8 l.256/258 : la baliste/le bélier sont « dotés de roues
 * pour se déplacer sur le champ de bataille » — RAW muet sur un Test ou une vitesse chiffrée). Décision de
 * design (#156, Lot 2) : mouvement SIMPLE (aucun jet), effort collectif de l'Équipe — le CHEF de pièce
 * pousse, l'ENGIN et TOUS les servants du poste (`ShipPoste.crewIds`) translatent du MÊME delta (formation
 * rigide), exactement comme `shipAdvance` (store.ts:1239) déplace une coque + son équipage. Distance
 * plafonnée à une valeur MAISON éditable (`rule('siege-engine-push-speed')`, engine/policy.ts).
 *
 * Module FEUILLE (aucune dépendance combatFlow/combatSlice) : mute les combattants, l'appelant (store)
 * re-set `battle` + émet SCENE_DIRTY — MÊME convention que `mount.ts`.
 */
import type { Combatant, ShipPoste, Weapon } from '../engine/types';
import type { BattleState } from './store';
import { mannedPosteWeapon } from '../engine/items';
import { warMachineCrewRequired, warMachineCrewPenalty } from '../engine/warMachineCrew';
import { exposedCrew } from '../engine/shipCritical';
import { footprintN, footprintTiles } from './footprint';
import { moveEnv } from './combatGeometry';
import { rule } from '../engine/policy';
import { reachable, tileKey, tileFromKey } from './path';
import { isWalkable, type Scene } from './scene';

/** Le Combattant-affût qui PORTE `poste` (le poste vit sur `hull.postes`) — recherche par `uid` de la
 *  pièce (pas de dépendance à l'identité d'objet), MÊME esprit que `isPosteManned` (shipPostes.ts).
 *  `undefined` si `poste` n'appartient à aucun Combattant présent (scène désynchronisée). PUR. */
export function posteHullOf(poste: ShipPoste, combatants: Combatant[]): Combatant | undefined {
  return combatants.find((h) => h.postes?.some((p) => p.item.uid === poste.item.uid));
}

/** L'arme dérivée d'un poste est-elle un engin de siège MOBILE (ADE II 8) : catalogue « armes de
 *  siège » (`subType`) portant la Qualité `equipe` (l.233 — l'Équipe requise, réutilisée comme seuil de
 *  poussée). Un poste NAVAL (bordée de navire, MDG 12) n'a jamais cette combinaison → jamais poussable
 *  ici — la coque, elle, avance par `shipAdvance` (cap + Manœuvre), mécanisme DISTINCT jamais mêlé à
 *  celui-ci. PUR. */
export function isPushableEngine(w: Pick<Weapon, 'subType' | 'qualities'>): boolean {
  return w.subType === 'armes-de-siege' && warMachineCrewRequired(w) > 0;
}

/** L'arme d'un poste servi est-elle une machine de guerre de MÊLÉE (ADE II 8 l.233 — « Toutes les
 *  machines de guerre... utilisent... Projectiles [Machine de guerre], à l'exception du bélier, qui
 *  utilise Force ») : la SEULE de ce type est le bélier, dérivé du type d'arme + de la Qualité `equipe`,
 *  aucun id en dur. #210 : c'est cette pièce (pas le chef qui la sert) qui doit être adjacente pour
 *  frapper. PUR. */
export function isMeleeWarMachine(w: Pick<Weapon, 'type' | 'qualities'>): boolean {
  return w.type === 'melee' && warMachineCrewRequired(w) > 0;
}

/** La COQUE/l'affût portant la pièce de MÊLÉE que sert `actor` (#210) : l'adjacence/allonge d'une pièce
 *  de mêlée servie (bélier) se mesure depuis L'EMPREINTE DE LA PIÈCE, pas depuis celle du chef qui la
 *  sert — le chef reste le testeur/déclencheur, sa position propre ne donne plus la portée. `undefined`
 *  si `actor` ne sert aucune pièce, ou si la pièce servie est à DISTANCE (baliste/canon : géométrie du
 *  chef inchangée, cf. `firedAttackBlock`/`firedWeapon`). KIND-AGNOSTIQUE (aucun id d'arme en dur). PUR. */
export function meleeWarMachineHullOf(actor: Combatant, combatants: Combatant[]): Combatant | undefined {
  const poste = actor.mannedPoste;
  // `poste.item.kind` PORTE déjà le type d'arme (melee/ranged) — filtrer ICI évite de dériver l'arme
  // complète (`mannedPosteWeapon`) pour CHAQUE poste à distance (bordée navale, artillerie) sur CHAQUE
  // calcul de distance : cette dérivation n'est due qu'aux pièces de mêlée, jamais aux autres.
  if (!poste || poste.item.kind !== 'melee') return undefined;
  const w = mannedPosteWeapon(actor, poste);
  if (!w || !isMeleeWarMachine(w)) return undefined;
  return posteHullOf(poste, combatants);
}

/** `active` est-il le CHEF d'un poste d'engin MOBILE (rôle/équipement — ne juge PAS l'effectif, cf.
 *  `pushCrewOk`) ? Symétrique de la gate 'poste' d'attaque (`availableAttacks`, combatManeuvers.ts l.263) :
 *  l'appelant vérifie séparément l'Action disponible (`canTakeAction`/`battle.acted`). PUR. */
export function pushEligible(active: Combatant): boolean {
  const poste = active.mannedPoste;
  if (!poste || poste.crewIds?.[0] !== active.id) return false;
  const w = mannedPosteWeapon(active, poste);
  return !!w && isPushableEngine(w);
}

/** Effectif de poussée SUFFISANT : ≥ la moitié de l'Équipe requise (ADE II 8 l.233 — « [les armes de
 *  siège] ne peuvent être utilisées avec moins de la moitié de l'Équipe nécessaire » ; ici étendu à l'EFFORT
 *  de déplacement, pas seulement le tir, MÊME seuil que `firedAttackBlock`, combatFlow.ts:296-310). Effectif
 *  BRUT (`exposedCrew` : vivant + conscient) — le RAW ADE II ne pose ICI aucune exigence de Compétence
 *  (≠ `servingCrewPresent`, qui filtre par Projectiles pour la courbe AA/MDG — hors sujet ADE II, cf.
 *  `warMachineCrew.ts` en-tête). PUR. */
export function pushCrewOk(poste: ShipPoste, weapon: Weapon, combatants: Combatant[]): boolean {
  const required = warMachineCrewRequired(weapon);
  if (required <= 0) return true;
  const crew = (poste.crewIds ?? []).map((id) => combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c);
  return !warMachineCrewPenalty(exposedCrew(crew).length, required).unusable;
}

/** Portée de poussée PLAFONNÉE (cases) — PARALLÈLE à `mountMovement` (state/mount.ts:154-158), sémantique
 *  DISTINCTE : un engin poussé n'emprunte PAS le Mouvement du chef, seulement la valeur maison éditable
 *  (ADE II 8 l.258 : roues, aucune vitesse chiffrée). N'altère PAS `mountMovement`. PUR. */
export function pushMovement(): number {
  return Number(rule('siege-engine-push-speed'));
}

/** État de la case « Pousser » de la console — SOURCE UNIQUE du gate d'affordance, découplée du reste
 *  des conditions de surface (Action dispo / Sonné / Brisé, qui vivent dans `CombatConsole`).
 *  `show` = `active` est chef d'un engin poussable RÉSOLU (arme + affût présents) ; `undercrew` = visible mais
 *  Équipe sous la moitié requise → bouton DÉSACTIVÉ (parité tir sous-effectif, `firedAttackBlock`). PUR. */
export function pushSlot(active: Combatant, combatants: Combatant[]): { show: boolean; undercrew: boolean } {
  const poste = pushEligible(active) ? active.mannedPoste : undefined;
  const w = poste ? mannedPosteWeapon(active, poste) : undefined;
  const show = !!poste && !!w && !!posteHullOf(poste, combatants);
  return { show, undercrew: show && !pushCrewOk(poste!, w!, combatants) };
}

/** L'empreinte N×N de `hull` ancrée en (x,y) tient-elle (praticable, hors `blocked`) ? Réplique locale de
 *  `footFits` (path.ts, non exportée) — même convention de clé (`tileKey`). PUR. */
function hullFootFits(scene: Scene, x: number, y: number, n: number, blocked: Set<string>): boolean {
  for (let dy = 0; dy < n; dy++)
    for (let dx = 0; dx < n; dx++) {
      if (!isWalkable(scene, x + dx, y + dy) || blocked.has(tileKey(x + dx, y + dy, 0))) return false;
    }
  return true;
}

/**
 * Cases de POUSSÉE atteignables (#210 : formation à empreinte RÉELLE, ≥1 sur le bélier ADE II) — le CHEF se
 * déplace en 1×1 (lui-même), mais une destination n'est retenue que si l'EMPREINTE DE L'ENGIN
 * (`footprintN(hull)`) tiendrait à sa position RÉSULTANTE (le delta chef→engin est RIGIDE, `pushCommitTile`
 * l'applique tel quel) — contre TOUS les obstacles (`moveEnv`) SAUF l'engin et SA PROPRE Équipe (`crewIds`),
 * qui translatent AVEC la poussée et ne sont donc jamais des obstacles à eux-mêmes. Sans ce retrait, l'engin
 * bloquerait sa PROPRE case de départ (`occupied` ne connaît que le CHEF, jamais l'engin qu'il pousse) et
 * aucune poussée ne serait jamais possible dès que `footprintN(hull) > 1`. PUR (lit `battle`, ne mute rien).
 */
export function pushReachable(battle: BattleState, scene: Scene, active: Combatant, hull: Combatant): Map<string, number> {
  if (!active.pos || !hull.pos) return new Map();
  const crewIds = new Set(active.mannedPoste?.crewIds ?? []);
  const blocked = new Set(moveEnv(battle, active).blocked);
  for (const c of battle.combatants) {
    if ((c.id !== hull.id && !crewIds.has(c.id)) || !c.pos) continue;
    for (const t of footprintTiles(c.pos, footprintN(c))) blocked.delete(tileKey(t.x, t.y, c.pos.z ?? 0));
  }
  const delta = { x: hull.pos.x - active.pos.x, y: hull.pos.y - active.pos.y };
  const n = footprintN(hull);
  const raw = reachable(scene, active.pos, pushMovement(), { blocked, foot: 1 });
  const out = new Map<string, number>();
  for (const [k, d] of raw) {
    const { x, y } = tileFromKey(k);
    if (hullFootFits(scene, x + delta.x, y + delta.y, n, blocked)) out.set(k, d);
  }
  return out;
}
