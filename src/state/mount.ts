/**
 * Combat monté (LDB 14 l.175-187) — APPAIRAGE cavalier↔monture, DYNAMIQUE (Monter/Descendre en jeu).
 * Un cavalier (`mountId`) et sa monture (`riderId`) sont deux Combattants distincts ; le couple PARTAGE
 * la position et l'empreinte de la MONTURE (souvent Grande → 2×2). Module-feuille pur (aucun import de
 * combatFlow) : mute les combattants, l'appelant (store) re-set la bataille + émet SCENE_DIRTY.
 */
import type { Combatant, Weapon } from '../engine/types';
import { isOutOfAction } from '../engine/conditions';
import { effectiveMovement } from '../engine/encumbrance';
import { sizeGap, type SizeCategory } from '../engine/size';
import { fearSizeAsMount } from '../engine/combatFeatures/dispatch';
import type { ModLine } from '../engine/combat';
import { assertAttackWeapon } from '../engine/combat';
import { RULE_REF } from '../engine/ruleRefs';
import { reachTiles, meleeReachTiles } from '../engine/engagement';
import { Scene, isWalkable } from './scene';
import { occupiesTile, footprintN, combatDistance } from './footprint';
import { isSkittishMount } from '../engine/traits/dispatch';
import { meleeWarMachineHullOf, isMeleeWarMachine } from './siegePush';
import { structureImmune } from '../engine/structures';
import type { Pt } from './path';
import type { BattleState } from './store';
import { inBattleId } from './combatants';
import { t } from '../i18n';
import { chebyshev } from '../engine/grid';

/** Ce combattant chevauche-t-il une monture (= cavalier) ? */
export const isRider = (c: Combatant): boolean => !!c.mountId;
/** Ce combattant porte-t-il un cavalier (= monture) ? */
export const isMount = (c: Combatant): boolean => !!c.riderId;

/** Monture CHEVAUCHÉE qui ne peut pas mener sa propre Action (Trait Nerveux, LDB 14 l.182 : « une monture
 *  possédant le Trait Nerveux ne peut pas mener sa propre Action d'attaque ») → PAS de tour d'initiative
 *  propre tant qu'elle est montée (exclue de `battle.order`). Un destrier (SANS Nerveux) est « un autre
 *  combattant à part entière » et GARDE son tour ; une monture LIBRE (sans cavalier) aussi. */
export function isControlledMount(c: Combatant): boolean {
  return !!c.riderId && isSkittishMount(c.traits);
}

/** Réinsère `id` dans une liste d'ordre triée par Initiative DÉCROISSANTE (descente d'une monture Nerveux
 *  qui retrouve son tour) — avant le premier combattant d'Initiative strictement inférieure. PUR. */
export function insertByInitiative(orderIds: string[], combatants: Combatant[], id: string): string[] {
  if (orderIds.includes(id)) return orderIds;
  const init = (cid: string) => combatants.find((c) => c.id === cid)?.initiative ?? -Infinity;
  const mi = init(id);
  const at = orderIds.findIndex((cid) => init(cid) < mi);
  const pos = at < 0 ? orderIds.length : at;
  return [...orderIds.slice(0, pos), id, ...orderIds.slice(pos)];
}

/** La monture chevauchée par `rider` (ou undefined). */
export const mountOf = (battle: BattleState, rider: Combatant): Combatant | undefined =>
  rider.mountId ? inBattleId(battle, rider.mountId) : undefined;

/** Géométrie de COMBAT d'un combattant, à partir d'une liste brute de combattants (utilisable hors
 *  `BattleState` complet, ex. `firedWeapon`). */
export const combatGeomOfList = (combatants: Combatant[], c: Combatant): Combatant =>
  (c.mountId ? combatants.find((x) => x.id === c.mountId) : undefined) ?? meleeWarMachineHullOf(c, combatants) ?? c;

/** Géométrie de COMBAT d'un combattant : sa MONTURE s'il est cavalier (le couple partage pos+empreinte,
 *  LDB 14), la COQUE de la pièce de mêlée qu'il sert s'il est chef d'un engin de siège de mêlée servi
 *  (#210 — bélier ADE II 8 : c'est la pièce qui frappe, pas le chef qui la sert), sinon lui-même.
 *  Substitution PAR-ACTEUR (indépendante de toute arme) : réservée au côté DÉFENSEUR/cible d'une attaque
 *  (l'arme employée par l'attaquant est hors-sujet pour la géométrie de SA cible) et aux usages hors attaque
 *  (mouvement, Peur, distance de combat générique). Côté ATTAQUANT d'une attaque → `attackGeomOf`
 *  (PAR-arme, #BUG-A) : une arme personnelle ne doit JAMAIS hériter de l'allonge de la coque servie. */
export const combatGeomOf = (battle: BattleState, c: Combatant): Combatant => combatGeomOfList(battle.combatants, c);

/** Géométrie D'ATTAQUE d'un combattant pour UNE arme donnée (#BUG-A, suite #210) : sa MONTURE s'il est
 *  cavalier (fondu avec elle quelle que soit l'arme tenue — LDB 14), la COQUE de la pièce de mêlée servie
 *  SEULEMENT si `weapon` EST cette pièce (`isMeleeWarMachine`) — une arme personnelle du chef (épée…) ne
 *  bénéficie JAMAIS de l'allonge de l'engin qu'il sert, et réciproquement. SOURCE UNIQUE pour un site
 *  d'ATTAQUE (aperçu/plan/résolution/tir/choix d'arme) : `combatGeomOf` (par-acteur) reste réservé au
 *  DÉFENSEUR/cible et aux usages hors attaque. */
export const attackGeomOfList = (combatants: Combatant[], c: Combatant, weapon: Weapon | null | undefined): Combatant => {
  const mount = c.mountId ? combatants.find((x) => x.id === c.mountId) : undefined;
  if (mount) return mount;
  if (weapon && isMeleeWarMachine(weapon)) {
    const hull = meleeWarMachineHullOf(c, combatants);
    if (hull) return hull;
  }
  return c;
};
export const attackGeomOf = (battle: BattleState, c: Combatant, weapon: Weapon | null | undefined): Combatant =>
  attackGeomOfList(battle.combatants, c, weapon);

/** Arme de MÊLÉE de `attacker` la plus UTILE contre `target` — chaque candidate évaluée avec SA PROPRE
 *  géométrie (`attackGeomOfList`, #BUG-A) et parmi celles À PORTÉE, celle qui peut effectivement BLESSER
 *  `target` gagne sur celle qui ne le peut pas (`structureImmune`, ADE II 8 l.249 : seul un Bélier
 *  abîme une porte) — jamais un `if` bélier : règle GÉNÉRALE « utile bat inutile », qui rejoue pour toute
 *  future immunité d'arme/cible. Repli sur la 1ʳᵉ candidate à portée (même immunisée) si aucune n'est utile
 *  — mieux vaut un choix cohérent qu'aucun. `undefined` si aucune arme de mêlée n'atteint la cible. */
export function meleeWeaponInRangeList(combatants: Combatant[], attacker: Combatant, target: Combatant, weapons: Weapon[] = attacker.weapons): Weapon | undefined {
  const tGeom = combatGeomOfList(combatants, target);
  const inRange = weapons.filter((w) => w.type === 'melee' && combatDistance(attackGeomOfList(combatants, attacker, w), tGeom) <= reachTiles(w));
  return inRange.find((w) => !structureImmune(w, target)) ?? inRange[0];
}
export function meleeWeaponInRange(battle: BattleState, attacker: Combatant, target: Combatant): Weapon | undefined {
  return meleeWeaponInRangeList(battle.combatants, attacker, target);
}

/** Armes PERSONNELLES d'un combattant — HORS l'arme dérivée du poste qu'il sert (`mannedPoste`), si un
 *  poste est servi. « Un intent, une entrée » : l'option d'attaque GÉNÉRIQUE ('arme', `availableAttacks`)
 *  et l'option DÉDIÉE « Servir <pièce> » (`weaponUid` épinglé) se recouvraient sinon pour une pièce de
 *  MÊLÉE servie (l'auto-choix générique prenait l'épée OU le bélier au hasard des géométries) — la pièce
 *  servie reste accessible UNIQUEMENT par choix explicite (`weaponUid`, posé par l'option 'poste' et par
 *  l'IA). PUR. */
function personalWeaponsOf(attacker: Combatant): Weapon[] {
  const posteUid = attacker.mannedPoste?.item.uid;
  return posteUid ? attacker.weapons.filter((w) => w.uid !== posteUid) : attacker.weapons;
}

/**
 * COMPTEUR des `weaponUid` FOURNIS mais INTROUVABLES dans `attacker.weapons` (#1153) — sonde partagée,
 * patron `REDERIVATIONS`/`ANONYMES`. `c.weapons` ne contient que le loadout ACTIF (`recomputeLoadout`,
 * `engine/items.ts`) : un uid d'arme possédée mais non tenue n'y est PAS. Retomber en silence sur le
 * re-choix (la mêlée l'emporte dès qu'elle est à portée) faisait d'un tir une frappe au 2ᵉ passage.
 */
export const ARME_INTROUVABLE = { vues: 0, dites: new Set<string>() };

/** Choix d'arme d'ATTAQUE PAR-ARME (#BUG-A) : l'arme EXPLICITE `weaponUid` si posée (pièce servie
 *  épinglée par l'option « Servir », ou choix de l'IA), sinon la mêlée PERSONNELLE la plus UTILE à
 *  portée (`meleeWeaponInRangeList` sur `personalWeaponsOf` — géométrie propre + `structureImmune` ; la
 *  pièce de siège servie n'est JAMAIS auto-choisie, cf. `personalWeaponsOf`), sinon le fallback générique
 *  `assertAttackWeapon` (préfère une arme à distance). Remplace tout `assertAttackWeapon(weapons, adj)`
 *  où `adj` était calculé PAR-ACTEUR (bug vécu : une arme personnelle héritait de l'allonge de la coque
 *  servie — #203/#210 suite). Variante `List` utilisable hors `BattleState` complet (ex. `firedWeapon`).
 *
 *  Un `weaponUid` fourni et INTROUVABLE n'est jamais un choix par défaut : c'est un appelant qui
 *  désigne une arme que le combattant ne TIENT pas. Le fait se crie (DEV) au lieu de se traduire en
 *  arme différente — la re-dérivation d'un jet déjà résolu en dépendait. */
export function pickAttackWeaponList(combatants: Combatant[] | undefined, attacker: Combatant, target: Combatant, weaponUid?: string): Weapon {
  const chosen = weaponUid ? attacker.weapons.find((w) => w.uid === weaponUid) : undefined;
  if (chosen) return chosen;
  if (weaponUid) {
    ARME_INTROUVABLE.vues += 1;
    // UNE fois par uid : les chemins de RENDU (aperçu d'attaque, viseur) rejouent cette résolution à
    // chaque image — un cri par frame noierait le signal au lieu de le porter.
    if (!ARME_INTROUVABLE.dites.has(weaponUid)) {
      ARME_INTROUVABLE.dites.add(weaponUid);
      console.error(`[combat] arme « ${weaponUid} » demandée mais absente des armes TENUES de ${attacker.label ?? attacker.id} `
        + `(${attacker.weapons.map((w) => w.uid ?? '—').join(', ') || 'aucune'}) — \`weapons\` ne porte que le loadout ACTIF. `
        + 'Le choix retombe sur l\'auto-sélection : un jet déjà résolu peut changer d\'arme.');
    }
  }
  const personal = personalWeaponsOf(attacker);
  if (!combatants) return assertAttackWeapon(personal, combatDistance(attacker, target) <= meleeReachTiles(personal));
  return meleeWeaponInRangeList(combatants, attacker, target, personal) ?? assertAttackWeapon(personal, false);
}
export function pickAttackWeapon(battle: BattleState, attacker: Combatant, target: Combatant, weaponUid?: string): Weapon {
  return pickAttackWeaponList(battle.combatants, attacker, target, weaponUid);
}

/** Cavalier émérite (AA 13 l.25) : Taille EFFECTIVE de `self` face à la Peur/Terreur causée par la TAILLE
 *  de l'adversaire. Le porteur du Talent, une fois monté, compte la Taille de sa MONTURE (« confiant une
 *  fois monté »). `undefined` (→ l'appelant retombe sur `self.size`) s'il n'a pas le Talent ou n'est pas
 *  monté. Passé à `fearSourceFor(self, foe, ⇐)` : seul le versant Taille est concerné, jamais un
 *  `causesPeur`/`causesTerreur` de statbloc (un démon fait toujours peur, RAW). */
export function riderFearSize(battle: BattleState, self: Combatant): SizeCategory | undefined {
  if (!fearSizeAsMount(self)) return undefined;
  return mountOf(battle, self)?.size;
}

/** Le cavalier porté par `mount` (ou undefined). */
export const riderOf = (battle: BattleState, mount: Combatant): Combatant | undefined =>
  mount.riderId ? inBattleId(battle, mount.riderId) : undefined;

/** Distance de Chebyshev entre une case et l'empreinte d'un combattant (0 = sur l'empreinte). */
function tileToFootprint(c: Combatant, x: number, y: number): number {
  if (!c.pos) return Infinity;
  const n = footprintN(c);
  const dx = x < c.pos.x ? c.pos.x - x : x > c.pos.x + n - 1 ? x - (c.pos.x + n - 1) : 0;
  const dy = y < c.pos.y ? c.pos.y - y : y > c.pos.y + n - 1 ? y - (c.pos.y + n - 1) : 0;
  return Math.max(dx, dy);
}

/** `rider` (à pied, libre) peut-il enfourcher `mount` ? Monture vivante, SANS cavalier, à une case de
 *  l'empreinte de la monture (ou dessus), et `rider` n'est pas déjà monté. MÊME ÉTAGE requis (z-aware) :
 *  un cavalier au rez ne peut pas enfourcher une monture qui couvre les mêmes (x,y) au chemin de ronde
 *  (sans ce filtre, l'enfourchement le téléporterait verticalement via `mountUp`). */
export function canMount(_battle: BattleState, rider: Combatant, mount: Combatant): boolean {
  if (rider.id === mount.id || rider.mountId || mount.riderId) return false;
  if (isOutOfAction(rider) || isOutOfAction(mount) || !rider.pos || !mount.pos) return false;
  if ((rider.pos.z ?? 0) !== (mount.pos.z ?? 0)) return false;
  return tileToFootprint(mount, rider.pos.x, rider.pos.y) <= 1;
}

/** `rider` enfourche `mount` : appairage + le cavalier monte SUR la monture (partage sa position). */
export function mountUp(rider: Combatant, mount: Combatant): void {
  rider.mountId = mount.id;
  mount.riderId = rider.id;
  if (mount.pos) rider.pos = { ...mount.pos };
}

/** Case libre la plus proche pour reposer un cavalier À PIED (1×1) autour de la monture, sur l'ÉTAGE
 *  de la monture (z-aware, #802) : une monture démontée en pleine muraille (`pos.z>0`) rend son
 *  cavalier au chemin de ronde, jamais téléporté au sol en contrebas. */
function nearestFreeFoot(battle: BattleState, scene: Scene, mount: Combatant, rider: Combatant): Pt | undefined {
  const p = mount.pos;
  if (!p) return undefined;
  const z = p.z ?? 0;
  const n = footprintN(mount);
  const occupied = (x: number, y: number): boolean =>
    battle.combatants.some((c) => c.id !== rider.id && c.id !== mount.id && !isOutOfAction(c) && c.pos && (c.pos.z ?? 0) === z && occupiesTile(c.pos, footprintN(c), x, y));
  let best: Pt | undefined;
  let bestD = Infinity;
  for (let y = p.y - 3; y <= p.y + n + 2; y++)
    for (let x = p.x - 3; x <= p.x + n + 2; x++) {
      if (occupiesTile(p, footprintN(mount), x, y) || !isWalkable(scene, x, y, z) || occupied(x, y)) continue;
      const d = Math.max(tileToFootprint(mount, x, y), 0);
      if (d > 0 && d < bestD) { bestD = d; best = { x, y, ...(z ? { z } : {}) }; }
    }
  return best;
}

/** Le cavalier descend : on défait l'appairage et il prend la case libre la plus proche (à pied). */
export function dismount(battle: BattleState, scene: Scene, rider: Combatant): boolean {
  const mount = mountOf(battle, rider);
  rider.mountId = undefined;
  if (mount) {
    mount.riderId = undefined;
    const free = nearestFreeFoot(battle, scene, mount, rider);
    if (free) rider.pos = free;
  }
  return true;
}

/** Mort/retrait de la monture (LDB 14 l.182, la monture est un combattant à part) : son cavalier est
 *  DÉMONTÉ (à pied, case libre adjacente). Pas de dégâts de chute (le RAW ne définit AUCUNE chute liée à
 *  la mort d'une monture — seul existe le cas générique de la Chute, LDB 15 l.78-84 ; on ne l'invente pas). */
export function handleMountDeath(battle: BattleState, scene: Scene, mount: Combatant): Combatant | undefined {
  const rider = riderOf(battle, mount);
  if (!rider) return undefined;
  mount.riderId = undefined;
  rider.mountId = undefined;
  const free = nearestFreeFoot(battle, scene, mount, rider);
  if (free) rider.pos = free;
  return rider;
}

/** Balayage post-résolution : toute monture mise hors de combat désarçonne son cavalier (à pied, strict
 *  RAW). Retourne les lignes de journal des désarçonnements (vide si rien). Appelé depuis checkBattleOver,
 *  donc déclenché quelle que soit la cause de mise hors de combat (touche, sort de zone, mort lente, Nuée). */
export function sweepDismountDeaths(battle: BattleState, scene: Scene): string[] {
  const lines: string[] = [];
  for (const mount of battle.combatants) {
    if (!mount.riderId || !isOutOfAction(mount)) continue;
    const rider = handleMountDeath(battle, scene, mount);
    if (rider) lines.push(t('mount.unhorsed', { rider: rider.label, mount: mount.label }));
  }
  return lines;
}

// ── Combat monté : Mouvement & modificateurs de combat (LDB 14 l.179-184) ──────────────────────────
/** Acrobaties équestres (LDB 10 l.30) : annule la pénalité d'Esquive du cavalier (LDB 14 l.184). */
const hasAcrobatiesEquestres = (c: Combatant): boolean =>
  (c.talents ?? []).some((t) => (t.times ?? 0) > 0 && t.talentId === 'acrobaties-equestres');

/** Mouvement effectif d'un combattant : celui de sa MONTURE s'il est cavalier (LDB 14 l.179), sinon le sien. */
export function mountMovement(battle: BattleState, c: Combatant): number {
  const mount = mountOf(battle, c);
  return effectiveMovement(mount ?? c);
}

/** Cases de Mouvement encore disponibles ce Tour : budget du Tour moins le Mouvement déjà parcouru
 *  (déplacement DÉCOMPOSABLE — règle maison, cf. `BattleState.movementUsed`). Le budget est la Marche
 *  (de la monture si cavalier), ÉTENDU par une Course réussie (`battle.runBudget` = Marche + Course + DR,
 *  LDB 15 l.41 : la distance de Course « vient en plus » du Mouvement du Round — le reliquat reste dépensable). */
export function movementRemaining(battle: BattleState, c: Combatant): number {
  const budget = Math.max(battle.runBudget ?? 0, mountMovement(battle, c));
  return Math.max(0, budget - (battle.movementUsed ?? 0));
}

/** Ce combattant peut-il (encore) se déplacer librement ce Tour ? Mouvement décomposable, mais NON entrelacé
 *  avec l'Action (règle maison) : interdit une fois l'Action prise SI du Mouvement a déjà été parcouru avant
 *  elle (pas de « Mouvement → Action → Mouvement »). Faire « Action puis Mouvement » reste permis. */
export function canMove(battle: BattleState, c: Combatant): boolean {
  if (battle.acted && battle.movedPreAction) return false;
  return movementRemaining(battle, c) > 0;
}

/** Modificateurs d'attaque liés au Combat monté, injectés dans `env` (combat.ts reste pur, ignorant des
 *  montures) :
 *  - +20 si l'attaquant est un CAVALIER frappant une cible plus petite que SA monture (l.180, « toute attaque ») ;
 *  - −10 en MÊLÉE si l'on cible un CAVALIER (la cible chevauche) alors qu'on est plus petit que sa monture (l.181). */
export function mountedAttackMods(battle: BattleState, attacker: Combatant, target: Combatant | null, kind: 'melee' | 'ranged'): ModLine[] {
  const out: ModLine[] = [];
  if (!target) return out;
  const attMount = mountOf(battle, attacker);
  if (attMount && sizeGap(attMount.size, target.size) >= 1) out.push({ label: t('mount.modSmallerTarget'), value: 20, famille: 'circonstance', ref: RULE_REF['combat-monte'] });
  const tgtMount = mountOf(battle, target); // la cible est-elle un cavalier ? (on frappe alors le cavalier, pas la monture)
  if (kind === 'melee' && tgtMount && sizeGap(attacker.size, tgtMount.size) <= -1) out.push({ label: t('mount.modTargetRider'), value: -10, famille: 'circonstance', ref: RULE_REF['combat-monte'] });
  return out;
}

/** Pénalité d'Esquive d'un cavalier (LDB 14 l.184) : −20, sauf Talent Acrobaties équestres. 0 à pied. */
export function mountedDodgePenalty(defender: Combatant): number {
  return defender.mountId && !hasAcrobatiesEquestres(defender) ? -20 : 0;
}

/** Montures LIBRES que `rider` (à pied) peut enfourcher, de la plus proche à la plus lointaine :
 *  marquées `mountable`, du MÊME camp (on n'enfourche pas la monture d'un ennemi), sans cavalier, à une
 *  case de leur empreinte (LDB 14). SOURCE UNIQUE de la disponibilité de « Monter » — la pastille de
 *  CHAQUE monture en naît, et le dispatcher y retrouve celle qu'on a désignée. */
export function mountablesNear(battle: BattleState, rider: Combatant): Combatant[] {
  return battle.combatants
    .filter((m) => m.mountable && m.kind === rider.kind && canMount(battle, rider, m))
    .map((m) => ({ m, d: m.pos && rider.pos ? chebyshev(m.pos, rider.pos) : Infinity }))
    .sort((a, b) => a.d - b.d)
    .map((x) => x.m);
}

/** La PLUS PROCHE des montures enfourchables (`mountablesNear`) — le défaut quand aucune n'est désignée. */
export function mountableNear(battle: BattleState, rider: Combatant): Combatant | undefined {
  return mountablesNear(battle, rider)[0];
}
