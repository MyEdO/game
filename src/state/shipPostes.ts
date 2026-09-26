/**
 * POSTES D'ARTILLERIE d'un navire — placement & répartition (MDG 12 « Navires et construction navale »).
 * Couche STATE (le côté de montage est un `FireArc`, cf. fireArc.ts). RAW vérifié FR + VO (« Boats and
 * Boatbuilding ») : PAS de slots fixes — placement LIBRE, seule limite = le poids (Enc) des pièces sur un
 * « facing » vs la Contenance (`ship.capacity`). Le Sabord (Gun Port) est une Amélioration optionnelle qui
 * donne un couvert TOTAL au servant qui tire à travers (sinon tir depuis le pont, aucun couvert).
 */
import { inFireArc } from './fireArc';
import { mannedPosteWeapon, loadWeapon } from '../engine/items';
import { hasWeaponGroupSkill } from '../engine/combat';
import { exposedCrew } from '../engine/shipCritical';
import { isOutOfAction } from '../engine/conditions';
import { combatDistance, footprintN } from './footprint';
import { rotateDir8, DIR8_DELTA, DIR8_ORDER, DELTA_DIR8, type Dir8 } from './dir8';
import { isWalkable, type Scene } from './scene';
import { findFreeTile } from './combatGeometry';
import type { FireArc } from './fireArc';
import type { Combatant, ShipPoste, ShipDeck } from '../engine/types';

// Le TYPE `ShipPoste` vit en engine/types (pour que `Combatant` le porte sans dépendance engine→state) ;
// la LOGIQUE (placement, arc, support) reste ici. Ré-export pour les importeurs historiques.
export type { ShipPoste };

type Pt = { x: number; y: number };

/** Le poids (Enc) d'une pièce montée sur un bord donné — entrée du calcul de pénalité de répartition. */
export interface MountWeight {
  side: FireArc;
  weight: number;
}

/** Pénalité de placement appliquée au navire (M, Man, et DR aux Tests de Navigation). */
export interface PlacementPenalty {
  m: number;
  man: number;
  navDR: number;
}

/**
 * Pénalité de PLACEMENT des pièces (MDG 12 l.432-433 / VO l.315-317). Si le poids (Enc) des pièces sur
 * UN seul « facing » (proue/poupe/bâbord/tribord) dépasse 25 % de la Contenance → −1 M / −1 Man / −1 DR aux
 * Tests de Navigation ; >50 % → −2. Seuil STRICT ; la pénalité est le PIRE palier atteint par un seul bord
 * (non cumulatif entre les bords). PUR — `capacity` = `ship.capacity` (Contenance, déjà en donnée). */
export function placementPenalty(mounts: MountWeight[], capacity: number): PlacementPenalty {
  const bySide = new Map<FireArc, number>();
  for (const m of mounts) bySide.set(m.side, (bySide.get(m.side) ?? 0) + m.weight);
  const maxSide = Math.max(0, ...bySide.values());
  if (maxSide > capacity * 0.5) return { m: -2, man: -2, navDR: -2 };
  if (maxSide > capacity * 0.25) return { m: -1, man: -1, navDR: -1 };
  return { m: 0, man: 0, navDR: 0 };
}

/** Le Combattant-coque dont l'équipage (`crewIds`) inclut `crewId`, parmi `combatants` — le SUPPORT naval du
 *  servant. KIND-AGNOSTIQUE (ne regarde pas le `kind` : héros/allié/ennemi indifférent). PUR. */
export function shipOfCrew(combatants: Combatant[], crewId: string): Combatant | undefined {
  return combatants.find((c) => c.crewIds?.includes(crewId));
}

/** `c` est-il un PASSAGER au combat — un membre d'ÉQUIPAGE d'une coque présente, à l'échelle MER ? Le NAVIRE agit
 *  alors en UNITÉ : « la performance des Personnages représente celle de tout l'équipage » (MDG 14 l.39) →
 *  l'équipage n'a pas de slot d'initiative. Le passager RESTE dans `battle.combatants` (cible d'Éclats / Critiques
 *  d'équipage, futur combattant de Pont à l'abordage) ; seul son SLOT d'`order` est retiré. PUR.
 *
 *  NE COUVRE PAS les MONTURES : RAW « Combat monté » (LDB 14 l.182) — « une monture sans le Trait Nerveux est un
 *  autre combattant à part entière, et peut effectuer sa propre Action » → une monture GARDE son tour. (La désynchro
 *  monture/cavalier est un bug de SYNCHRO DE POSITION — le cavalier utilise le Mouvement de sa monture, l.179 —, pas
 *  un bug de tour : à corriger côté mouvement, pas ici.) */
export function isPassengerInBattle(c: Combatant, combatants: Combatant[], merScale: boolean): boolean {
  return merScale && !!shipOfCrew(combatants, c.id);
}

/** Nombre de servants EFFECTIFS qui tiennent le poste que `chef` sert, parmi `combatants` — entrée de
 *  `crewedFireWeapon` (sous-effectif d'une Arme d'équipe, AA 10 l.234-243). Comptent les servants à la fois APTES
 *  (vivants + conscients, via `exposedCrew`) ET possédant la Projectiles APPROPRIÉE au Groupe de l'engin
 *  (l.230 : « Compétence Projectiles appropriée » ; Ingénierie qualifie pour la Poudre noire, l.146 ; un
 *  servant à Arc ne compte PAS pour une baliste, Exemple 1 l.251). Le Groupe est porté EN DONNÉE par la pièce
 *  (`weaponGroup`) → réutilise `hasWeaponGroupSkill` (même source que la Spé de tir). Pièce SANS Groupe déclaré
 *  (stub/générique) → aucune exigence de compétence (tous les aptes comptent). Le chef est lui-même un `crewIds`
 *  du poste, donc compté s'il est qualifié. `undefined` si `chef` ne sert aucun poste (tir normal). PUR.
 *
 *  La VALIDATION de compétence ne pèse QUE sur ce décompte d'équipage : l'ACTION « Servir cette pièce »
 *  (`servablePostes`/`serveAtPoste`) reste, elle, kind- et compétence-AGNOSTIQUE (décision produit). */
export function servingCrewPresent(chef: Combatant, combatants: Combatant[]): number | undefined {
  const poste = chef.mannedPoste;
  if (!poste) return undefined;
  const crew = (poste.crewIds ?? [])
    .map((id) => combatants.find((c) => c.id === id))
    .filter((c): c is Combatant => !!c);
  const apt = exposedCrew(crew);
  // Groupe de Projectiles requis lu DIRECTEMENT sur la pièce (champ, pas d'arme dérivée) : pièce sans Groupe
  // déclaré (générique / stub de test) → aucune exigence (tous les aptes comptent), sans construire d'arme.
  if (!poste.item.weaponGroup) return apt.length;
  const engine = mannedPosteWeapon(chef, poste);
  if (!engine) return apt.length;
  return apt.filter((c) => hasWeaponGroupSkill(c, engine, 'ranged')).length;
}

/** Un combattant qui SERVIRAIT `poste` (en deviendrait chef) possède-t-il la Compétence Projectiles APPROPRIÉE
 *  au Groupe de l'engin (AA 10 l.230) — donc COMPTERAIT-il dans l'effectif (vs simple « aide » qui déplace/
 *  compense les pertes, l.232) ? Pièce SANS Groupe déclaré (générique/stub) ou arme non dérivable (ex. pièce à
 *  2 mains qu'il ne peut tenir) → aucune exigence (true). MÊME prédicat que `servingCrewPresent`, mais l'arme est
 *  dérivée de CE combattant (le futur chef qui la manie). Sert au FEEDBACK d'« Servir cette pièce ». PUR. */
export function isCrewQualified(actor: Combatant, poste: ShipPoste): boolean {
  if (!poste.item.weaponGroup) return true;
  const engine = mannedPosteWeapon(actor, poste);
  return !engine || hasWeaponGroupSkill(actor, engine, 'ranged');
}

/** Répartition de l'équipage APTE (vivant + conscient) d'un poste pour l'AFFICHAGE (tooltip d'équipe) :
 *  `qualified` = membres possédant la Projectiles du Groupe → COMPTENT dans l'effectif (longueur identique à
 *  `servingCrewPresent`) ; `aides` = présents mais non qualifiés → aident à déplacer/compenser les pertes
 *  mais NE comptent PAS (AA 10 l.232). Pièce sans Groupe → tous qualifiés. L'arme est dérivée du CHEF
 *  (`crewIds[0]`), exactement comme `servingCrewPresent`. PUR. */
export function posteCrewSplit(poste: ShipPoste, combatants: Combatant[]): { qualified: Combatant[]; aides: Combatant[] } {
  const crew = (poste.crewIds ?? [])
    .map((id) => combatants.find((c) => c.id === id))
    .filter((c): c is Combatant => !!c);
  const apt = exposedCrew(crew);
  if (!poste.item.weaponGroup) return { qualified: apt, aides: [] };
  const chef = combatants.find((c) => c.id === poste.crewIds?.[0]);
  const engine = chef ? mannedPosteWeapon(chef, poste) : undefined;
  if (!engine) return { qualified: apt, aides: [] };
  const qualified: Combatant[] = [], aides: Combatant[] = [];
  for (const c of apt) (hasWeaponGroupSkill(c, engine, 'ranged') ? qualified : aides).push(c);
  return { qualified, aides };
}

/**
 * Une pièce MONTÉE (`weapon.mountSide`) porte-t-elle sur `targetPos` ? `heading` = cap du support (coque), `supportPos`
 * = sa position. Aucune contrainte d'arc (→ true) si l'arme n'est PAS montée, ou si le cap/la position du support
 * ne sont pas résolus (pièce au sol sans support, setup partiel…). Réutilise `inFireArc` (déjà général). PUR.
 */
export function mountedWeaponBears(weapon: { mountSide?: FireArc }, heading: Dir8 | undefined, supportPos: Pt | undefined, targetPos: Pt): boolean {
  if (!weapon.mountSide) return true;
  if (!heading || !supportPos) return true;
  return inFireArc(weapon.mountSide, heading, supportPos, targetPos);
}

/** Cap-MONDE (Dir8) vers lequel pointe un `FireArc` relatif au cap `heading` de la coque. PUR. */
function arcDir8(side: FireArc, heading: Dir8): Dir8 {
  switch (side) {
    case 'proue': return heading;
    case 'poupe': return rotateDir8(heading, 4);
    case 'tribord': return rotateDir8(heading, 2);
    default: return rotateDir8(heading, -2); // babord
  }
}

/**
 * Position d'une pièce dans l'espace de la SCÈNE (index/rendu top-down uniquement, AUCUN effet combat — RAW :
 * placement libre, pas de slot fixe). Ordre de résolution :
 *   1. `poste.anchor` authoré (fait foi).
 *   2. slot de pont (`opts.deck.postes`) de même `side`, MAIS seulement hors échelle mer (les coords du pont ne
 *      valent que quand la scène rendue EST ce pont d'abordage, pas la coque à l'échelle mer).
 *   3. sinon la position de la coque, décalée vers le BORD par l'arc quand l'empreinte > 1 et que `side`+`heading`
 *      sont connus (FireArc → Dir8-monde via le cap, pas × ~empreinte/2 depuis le centre). Plusieurs pièces d'un
 *      même bord peuvent partager une case (le composant les regroupe). Sinon la position de coque telle quelle.
 * `undefined` si la coque n'a pas de position. PUR.
 */
export function posteAnchor(
  hull: Combatant,
  poste: ShipPoste,
  opts?: { heading?: Dir8; deck?: ShipDeck; sea?: boolean },
): { x: number; y: number; z?: number } | undefined {
  if (poste.anchor) return poste.anchor;
  if (opts?.deck && opts.sea !== true && poste.side) {
    const slot = opts.deck.postes?.find((s) => s.side === poste.side);
    if (slot) return { x: slot.pos.x, y: slot.pos.y };
  }
  if (!hull.pos) return undefined;
  if (hull.footprint && hull.footprint > 1 && poste.side && opts?.heading) {
    const d = DIR8_DELTA[arcDir8(poste.side, opts.heading)];
    const step = Math.floor(hull.footprint / 2);
    return { x: hull.pos.x + d.gx * step, y: hull.pos.y + d.gy * step, ...(hull.pos.z !== undefined ? { z: hull.pos.z } : {}) };
  }
  return { x: hull.pos.x, y: hull.pos.y, ...(hull.pos.z !== undefined ? { z: hull.pos.z } : {}) };
}

/** Ordre de priorité RELATIF au cap `heading` (pas de Dir8.indexOf, mais l'ÉCART de crans) pour peupler la
 *  formation d'un poste terrestre CREWÉ — droite, gauche, puis les 2 angles arrière, puis l'arrière : jamais
 *  l'avant (crans 0/±1, exclus), l'engin y frappe (#210, ADE II 8 l.258 : « on pousse par les flancs/
 *  l'arrière »). */
const CREW_FORMATION_STEPS = [2, 6, 3, 5, 4] as const;

/**
 * Cases de FORMATION autour de l'empreinte d'un poste terrestre CREWÉ (bélier, batterie de siège…) — ADE II
 * ch.08 l.258. Anneau de cases adjacentes à l'empreinte de `hull` (Chebyshev 1), ORDONNÉ (`CREW_FORMATION_STEPS`) :
 * flanc droit, flanc gauche, angle arrière-droit, angle arrière-gauche, arrière — jamais l'avant, où l'engin
 * frappe. `opts.heading` = cap vers lequel l'engin frappe (le SENS de poussée, pas un cap de coque) ; combiné à
 * `poste.side` via `arcDir8` si le poste porte un côté (généralise `posteAnchor`, qui gère déjà `hull.footprint
 * > 1`). GÉOMÉTRIE PURE : ne connaît pas l'occupation de la scène — `assignCrewFormation` filtre/retombe sur
 * `findFreeTile` pour un poste à l'empreinte enclavée. PUR.
 */
export function crewFormationSlots(
  hull: Pick<Combatant, 'pos' | 'footprint' | 'size'>,
  poste: Pick<ShipPoste, 'side' | 'crewIds'>,
  opts?: { heading?: Dir8 },
): Pt[] {
  if (!hull.pos) return [];
  const heading = poste.side ? arcDir8(poste.side, opts?.heading ?? 'N') : opts?.heading ?? 'N';
  const n = footprintN(hull);
  const px = hull.pos.x, py = hull.pos.y;
  const byStep = new Map<number, Pt[]>();
  for (let y = py - 1; y <= py + n; y++) {
    for (let x = px - 1; x <= px + n; x++) {
      if (x >= px && x < px + n && y >= py && y < py + n) continue; // sous l'empreinte
      const dx = x < px ? -1 : x >= px + n ? 1 : 0;
      const dy = y < py ? -1 : y >= py + n ? 1 : 0;
      const step = (DIR8_ORDER.indexOf(DELTA_DIR8[`${dx},${dy}`]) - DIR8_ORDER.indexOf(heading) + 8) % 8;
      if (step === 0 || step === 1 || step === 7) continue; // jamais l'avant (front, front-droit, front-gauche)
      (byStep.get(step) ?? byStep.set(step, []).get(step)!).push({ x, y });
    }
  }
  const out: Pt[] = [];
  for (const step of CREW_FORMATION_STEPS) for (const p of (byStep.get(step) ?? []).sort((a, b) => a.y - b.y || a.x - b.x)) out.push(p);
  return out;
}

/**
 * Assigne à chaque `crewIds` de `poste` UNE case de la formation (`crewFormationSlots`), en écartant les
 * cases impraticables/occupées (`occupied`) — au-delà (empreinte enclavée : moins de cases libres que de
 * servants), retombe sur la case libre la plus proche de la scène (`findFreeTile`) : aucun servant sans
 * case. PUR (ne mute rien ; l'appelant pose les `pos`). Ordre = celui de `poste.crewIds`.
 */
export function assignCrewFormation(
  hull: Pick<Combatant, 'pos' | 'footprint' | 'size'>,
  poste: Pick<ShipPoste, 'side' | 'crewIds'>,
  scene: Scene,
  occupied: (p: Pt) => boolean,
  opts?: { heading?: Dir8 },
): Pt[] {
  const crewIds = poste.crewIds ?? [];
  const free = crewFormationSlots(hull, poste, opts).filter((p) => isWalkable(scene, p.x, p.y) && !occupied(p));
  return crewIds.map((_, i) => free[i] ?? findFreeTile(scene));
}

/**
 * Auto-FORMATION runtime des servants d'un poste TERRESTRE crewé (#210 résidu — un engin de siège SPAWNÉ
 * n'importe où sur la carte reçoit sa formation, sans que le scénario/l'éditeur ait à précalculer
 * `crewFormationSlots` à la main comme 42-belier-porte.ts). Un membre de `poste.crewIds` dont la `pos`
 * COÏNCIDE avec celle de la coque (défaut de qui ne pose pas la formation à la main — aucune position
 * PROPRE authorée) est réparti en anneau (`assignCrewFormation`, ADE II 8 l.258) autour de l'empreinte
 * de la coque. Un servant à une position DISTINCTE de la coque (authorée à la main) n'est JAMAIS touché —
 * le placement d'AUTEUR prime toujours. Ne lit QUE `hull.postes[].crewIds` (postes terrestres, bélier/
 * baliste) — l'équipage de COQUE navale (`Combatant.crewIds`, MDG 14) est PASSAGER hors case propre,
 * hors du champ de cette fonction. Mute en place ; appelé une fois au spawn (`combatSlice.startCombat`).
 */
export function autoFormCrews(combatants: Combatant[], scene: Scene, facingOf?: (hull: Combatant) => Dir8 | undefined): void {
  for (const hull of combatants) {
    if (!hull.pos || !hull.postes?.length) continue;
    for (const poste of hull.postes) {
      const crew = (poste.crewIds ?? [])
        .map((id) => combatants.find((c) => c.id === id))
        .filter((c): c is Combatant => !!c);
      const unplaced = crew.filter((c) => c.pos && c.pos.x === hull.pos!.x && c.pos.y === hull.pos!.y);
      if (!unplaced.length) continue;
      const occupied = (p: Pt) => combatants.some((c) => c !== hull && !unplaced.includes(c) && c.pos && c.pos.x === p.x && c.pos.y === p.y);
      const slots = assignCrewFormation(hull, { side: poste.side, crewIds: unplaced.map((c) => c.id) }, scene, occupied, { heading: facingOf?.(hull) });
      unplaced.forEach((c, i) => {
        const p = slots[i];
        if (p) c.pos = { x: p.x, y: p.y, ...(c.pos!.z !== undefined ? { z: c.pos!.z } : {}) };
      });
    }
  }
}

/**
 * SERVICE d'une pièce par son chef (KIND-AGNOSTIQUE) : pose le lien `mannedPoste` et OCTROIE l'arme dérivée
 * (taguée `mountSide`) DIRECTEMENT — pour que le canon apparaisse aussi sur un chef à STATBLOC (ennemi, qui
 * ne passe pas par `recomputeLoadout`). Idempotent ; un chef héros la re-dérivera identiquement au prochain
 * recompute (rebuild from scratch → pas de doublon). SOURCE UNIQUE du service, partagée par `applyShipPostes`
 * (author-time, chef = `crewIds[0]`) ET `serveAtPoste` (runtime « Servir cette pièce »). Mute en place.
 */
export function serveChef(chef: Combatant, poste: ShipPoste): void {
  chef.mannedPoste = poste;
  const w = mannedPosteWeapon(chef, poste);
  if (w && !(chef.weapons ?? []).some((x) => x.uid === w.uid)) (chef.weapons ??= []).push(w);
  // Une pièce que l'on PREND est AMORCÉE (chargée à la mise en batterie) : le 1er coup part, la Recharge ne
  // joue qu'ENTRE les tirs. UNIQUEMENT si son cycle n'a jamais commencé (`loaded` absent) : une pièce qui a
  // TIRÉ (`loaded === false`, Test étendu en cours) garde son état — la reprendre ne remplace pas le Test
  // étendu de rechargement (LDB 62 l.335), sinon changer de servant rechargerait gratis. Couture UNIQUE, sur
  // le registre de la PIÈCE — c'est LUI que lisent le gate de tir (`weaponLoaded`) et la munition tirée.
  if (poste.loaded === undefined) loadWeapon(chef, w, poste);
}

/** Un servant QUITTE la pièce (release, runtime « Quitter la pièce ») : retire le lien `mannedPoste`, se retire
 *  de l'équipage, retire l'arme dérivée (no-op pour un support, qui n'en a pas). KIND-AGNOSTIQUE — fonctionne
 *  pour le CHEF comme pour un SUPPORT. SUCCESSION : si le chef (`crewIds[0]`) part et qu'il reste de l'équipage
 *  en état, le servant le plus ancien encore apte devient chef (`serveChef` → arme + `crewIds[0]`), pour que
 *  l'invariant « `crewIds[0]` = chef qui TIRE » tienne et que la pièce ne reste pas « occupée mais muette ».
 *  Mute en place. */
export function leaveChef(actor: Combatant, poste: ShipPoste, combatants: Combatant[]): void {
  const wasChef = poste.crewIds?.[0] === actor.id;
  delete actor.mannedPoste;
  poste.crewIds = (poste.crewIds ?? []).filter((id) => id !== actor.id);
  if (actor.weapons) actor.weapons = actor.weapons.filter((w) => w.uid !== poste.item.uid);
  if (wasChef) {
    const next = (poste.crewIds ?? []).map((id) => combatants.find((c) => c.id === id)).find((c): c is Combatant => !!c && !isOutOfAction(c));
    if (next) {
      poste.crewIds = [next.id, ...(poste.crewIds ?? []).filter((id) => id !== next.id)]; // promu en TÊTE
      serveChef(next, poste);
    }
  }
}

/** Un combattant REJOINT l'équipage d'une pièce (runtime « Servir cette pièce »). Pièce NON servie → il en
 *  devient le CHEF (`crewIds[0]`), seul à TIRER : lien + arme dérivée via `serveChef`. Pièce DÉJÀ servie (chef
 *  vivant) → il REJOINT en SUPPORT (Arme d'équipe, AA 10 l.232) — appendu en queue de `crewIds`, occupe la pièce
 *  (`mannedPoste` posé, compte dans l'Indice pour compenser le sous-effectif) mais NE tire PAS (aucune arme).
 *  KIND-AGNOSTIQUE. Mute en place. */
export function serveAtPoste(actor: Combatant, poste: ShipPoste, combatants: Combatant[]): void {
  if (isPosteManned(poste, combatants)) {
    poste.crewIds = [...(poste.crewIds ?? []).filter((id) => id !== actor.id), actor.id];
    actor.mannedPoste = poste;
  } else {
    poste.crewIds = [actor.id, ...(poste.crewIds ?? []).filter((id) => id !== actor.id)];
    serveChef(actor, poste);
  }
}

/** Un poste est-il ACTUELLEMENT servi ? = sa tête d'équipage (`crewIds[0]`) est un combattant encore en action
 *  qui SERT bien CE poste (`mannedPoste`). Sinon (équipage vide, chef hors d'état, ou tête d'équipage qui ne
 *  sert pas) → NON servi, donc servable. KIND-AGNOSTIQUE. PUR. */
export function isPosteManned(poste: ShipPoste, combatants: Combatant[]): boolean {
  const chefId = poste.crewIds?.[0];
  if (!chefId) return false;
  const chef = combatants.find((c) => c.id === chefId);
  return !!chef && !isOutOfAction(chef) && chef.mannedPoste?.item.uid === poste.item.uid;
}

/** Le poste (et sa coque/emplacement) que `id` sert comme membre d'ÉQUIPAGE d'un poste ACTIF (coque encore en
 *  action), parmi `combatants` — SOURCE UNIQUE consultée par l'IA pour tenir sa FORMATION (#196 : un servant
 *  IA d'un engin crewé — bélier, batterie de siège — ne charge ni ne s'approche seul, c'est le poste qui le
 *  déplace). `undefined` si `id` ne figure dans le `crewIds` d'AUCUN poste dont la coque est encore active.
 *  KIND-AGNOSTIQUE. Aucun flag miroir sur le `Combatant` : cherche directement dans `crewIds`. PUR. */
export function crewPosteOf(id: string, combatants: Combatant[]): { hull: Combatant; poste: ShipPoste } | undefined {
  for (const hull of combatants) {
    if (isOutOfAction(hull)) continue;
    for (const poste of hull.postes ?? []) if ((poste.crewIds ?? []).includes(id)) return { hull, poste };
  }
  return undefined;
}

/** Postes qu'un `actor` peut REJOINDRE maintenant : ceux d'un emplacement/coque ADJACENT (empreinte, ≤ 1 case)
 *  dont il ne fait PAS DÉJÀ partie de l'équipage. Une pièce déjà servie reste « rejoignable » en SUPPORT (Arme
 *  d'équipe : on peut être plusieurs à servir) — `serveAtPoste` décide ensuite chef-vs-support. KIND-AGNOSTIQUE
 *  (héros/PNJ/ennemi) — SOURCE UNIQUE de la disponibilité « Servir cette pièce », consommée par l'affordance
 *  JOUEUR ET l'énumération IA. PUR. */
export function servablePostes(actor: Combatant, combatants: Combatant[]): { hull: Combatant; poste: ShipPoste }[] {
  if (!actor.pos || isOutOfAction(actor)) return [];
  const out: { hull: Combatant; poste: ShipPoste }[] = [];
  for (const hull of combatants) {
    if (!hull.postes?.length || !hull.pos || combatDistance(actor, hull) > 1) continue;
    for (const poste of hull.postes) if (!(poste.crewIds ?? []).includes(actor.id)) out.push({ hull, poste });
  }
  return out;
}

/** La pièce ADJACENTE qu'`actor` peut REJOINDRE sur la coque/emplacement `hull` (survol/clic du token) : le
 *  1er poste servable de `hull` pour `actor`. `undefined` si `actor` sert déjà une pièce (parité hotbar
 *  `!mannedPoste`) ou si `hull` n'offre aucun poste servable. SOURCE UNIQUE consommée par l'affordance de
 *  survol, le commit de clic et le tooltip d'équipe. PUR. */
export function serveTargetPoste(actor: Combatant, hull: Combatant, combatants: Combatant[]): ShipPoste | undefined {
  if (actor.mannedPoste) return undefined;
  return servablePostes(actor, combatants).find((sp) => sp.hull.id === hull.id)?.poste;
}

/**
 * Au DÉBUT du combat (après spawn) : pour chaque Combattant-coque portant des `postes`, SERT chaque poste à son
 * **chef de pièce** (`crewIds[0]`), parmi `combatants`. Le canon apparaît comme arme dérivée (via `serveChef`).
 * KIND-AGNOSTIQUE (ne regarde pas le `kind`). Mute en place. Chef de pièce introuvable / coque sans postes → ignoré.
 */
export function applyShipPostes(combatants: Combatant[]): void {
  const byId = new Map(combatants.map((c) => [c.id, c]));
  for (const hull of combatants)
    for (const poste of hull.postes ?? []) {
      const chefId = poste.crewIds?.[0];
      const chef = chefId ? byId.get(chefId) : undefined;
      if (chef) serveChef(chef, poste);
    }
}
