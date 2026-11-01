/**
 * BUILDER de TOKENS — produit les éléments `token` du pivot (cf. ./types) : FIGURANTS de scène
 * (PNJ/créatures d'ambiance) et COMBATTANTS (branche combat, couples montés compris).
 * Porte l'IDENTITÉ et la position LOGIQUE + toutes les DÉCISIONS de scène (filtres d'étage/brouillard/
 * couverture, ordre d'anneau héros, surplomb) ; la position INTERPOLÉE de marche est PAR-FRAME et reste
 * au stage. PUR : aucune caméra — seule la bascule
 * `top` (pions-portraits : cavalier et monture séparés) est une vérité de MODE DE VUE, pas de pose.
 */
import type { Scene } from '../../noyau/monde/scene';
import { isMerScene, enrolledEntityIds } from '../../noyau/monde/scene';
import type { BattleState } from '../../noyau/etat';
import { combatantAtTile } from '../../noyau/monde/combatGeometry';
import { isPassengerInBattle } from '../../noyau/monde/shipPostes';
import { isRider, isMount, riderOf } from '../../noyau/mount';
import { RANG_MENEUR, seatPoseOf, type SeatPose } from '../../noyau/monde/seating';
import { CAP_GROUPE } from '../../noyau/monde/combatants';
import type { Combatant } from '../../engine/types';
import { isStructure } from '../../engine/structures';
import { campOf } from '../../engine/relations';
import { isOverhang, capsSolid } from './floors';
import type { TokenEl } from './types';
import { heroRingIndex } from './dynamicMarks';

/**
 * JETON DE GROUPE hors combat — le meneur VISIBLE, sa position de RENDU, et la place qu'il occupe.
 *
 * Dérivation UNIQUE, pour que le corps, son chrome, sa caméra et le monde volumique lisent la MÊME
 * pose : assis, la position de rendu devient l'ANCRE FRACTIONNAIRE de la place (`SeatPose.anchor`) ;
 * `partyPos` (l'abord) reste la position LOGIQUE du groupe — brouillard, chemins et déclencheurs n'en
 * bougent pas. `null` = aucun meneur à poster (combat, vue subjective : l'appelant tranche ces
 * contextes, ici on ne connaît que la scène et le corps).
 */
export interface PartyToken {
  /** Le CORPS qui marche : c'est SON id que porte le bus des gestes, la pose du monde et la caméra. */
  leader: Combatant;
  heroIndex: number;
  pos: { x: number; y: number; z?: number };
  seat?: SeatPose;
  /** CLÉ du cap dans `store.facing`, publiée ICI et consommée telle quelle par TOUT ce qui dessine ce
   *  jeton (quad du monde volumique, disque de la vue du dessus). Le regard du groupe n'est keyé par
   *  AUCUN héros (`CAP_GROUPE`, `noyau/monde/combatants.ts`) : un meneur qui change ne le fait pas sauter. */
  capKey: string;
}

export function partyTokenOf(
  scene: Scene,
  leader: Combatant | undefined,
  partyPos: { x: number; y: number; z?: number },
  partyIds: readonly string[],
): PartyToken | null {
  if (!leader) return null;
  const seat = seatPoseOf(scene, { kind: 'party', rang: RANG_MENEUR });
  const heroIndex = heroRingIndex(leader, partyIds);
  if (!seat) return { leader, heroIndex, pos: partyPos, capKey: CAP_GROUPE };
  return { leader, heroIndex, pos: { x: seat.anchor.x, y: seat.anchor.y, ...(partyPos.z ? { z: partyPos.z } : {}) }, seat, capKey: CAP_GROUPE };
}

/** Vérité de JEU pilotant la sélection (PAS une caméra) : étage actif/isolé + mode de vue du dessus
 *  (`top` : les couples montés redeviennent deux pions distincts). */
export interface TokenView {
  activeZ: number;
  viewZ: number | null;
  top: boolean;
  /** AUTHORING (#1176, P3-3) : l'ÉDITEUR voit les EMBUSQUEURS. Une entité `hiddenUntilCombat` est
   *  invisible EN JEU avant le combat — l'auteur, lui, doit voir le corps de ce qu'il pose, sinon il
   *  édite un cadre vide. Absent = la loi de jeu, la seule qu'un écran de partie puisse demander. */
  ambush?: boolean;
}

/** Filtres de CASE d'un combattant — étage isolé/actif, surplomb de muraille, brouillard. Les mêmes
 *  pour un fantassin et pour un couple monté (qui les prend à la case de sa MONTURE) : un couple ne
 *  peut pas rester visible là où le même ennemi à pied est coupé. `héros` = allié VIEWER (jamais
 *  masqué par sa propre vue) ; pour un couple, l'un OU l'autre des deux corps suffit. */
function cutByView(scene: Scene, visible: ReadonlySet<string> | undefined, view: TokenView, pos: { x: number; y: number; z?: number }, héros: boolean): { cut: boolean; overhang: boolean } {
  const cz = pos.z ?? 0;
  // Jeton de muraille vu d'en bas : un combattant posé au-dessus de la zone active sur un SOL QUE LE
  // MONDE DESSINE DÉJÀ d'en bas reste rendu (défenseurs/pièces ciblables depuis la cour — parité avec
  // le picking cross-couche). MÊME vocabulaire que le builder de sols (`buildFloors`, floors.ts) : un
  // tablier sur pilotis (`isOverhang`) OU le DESSUS d'un bloc plein (`capsSolid` : chemin de ronde posé
  // sur la masse du rempart). Un plancher peint sans ses occupants était le trou (#1567).
  const overhang = view.viewZ == null && cz > view.activeZ && (isOverhang(scene, pos.x, pos.y, cz) || capsSolid(scene, pos.x, pos.y, cz));
  if (view.viewZ != null ? cz !== view.viewZ : cz > view.activeZ && !overhang) return { cut: true, overhang };
  // Brouillard : un ennemi/PNJ que personne du groupe ne voit n'est pas dessiné (les alliés, qui
  // SONT les viewers, restent toujours rendus). Clé z-aware = l'étage du combattant.
  if (!héros && visible && !visible.has(`${pos.x},${pos.y},${cz}`)) return { cut: true, overhang };
  return { cut: false, overhang };
}

/** Éléments `token` de la scène — figurants (toujours), puis combattants (si `battle`). Les hors-vue
 *  sont COUPÉS (une créature non vue n'est pas dessinée) → tout token émis est VISIBLE (au-dessus du
 *  voile de brouillard). `visible` ABSENT = aucune loi de vue (planches QC : elles jugent
 *  l'environnement, pas le brouillard) — même convention que `buildFloors`/`buildProps`.
 *
 *  SOURCE UNIQUE des jetons du monde (#1176) : le monde volumique en fait des billboards
 *  (`sceneBillboards`) et la surcouche SVG leur chrome (`stage/TokenChromeOverlay`) — les filtres
 *  (embuscade, enrôlé, couverture, étage, hors-vue) ne se recopient pas, ils se CONSOMMENT. */
export function buildTokens(scene: Scene, visible: ReadonlySet<string> | undefined, battle: BattleState | null, view: TokenView, partyIds: readonly string[]): TokenEl[] {
  const { top } = view;
  const out: TokenEl[] = [];
  const inBattle = !!battle;

  // ── FIGURANTS (PNJ d'ambiance) : maintenus en combat — estompés, cases libres seulement. ──────────
  // Entités ENRÔLÉES (membres d'une rencontre) → équipement dérivé du record (parité avec le spawn).
  const enrolledIds = enrolledEntityIds(scene);
  // Un figurant dont la case est occupée par un combattant n'est pas dessiné (pas d'empilement de
  // corps) — figurants de décor = sol (z0) uniquement.
  const covered = (x: number, y: number) => inBattle && !!combatantAtTile(battle!.combatants, x, y, 0);
  for (const ent of scene.entities) {
    if (ent.kind === 'heroStart' || ent.kind === 'prop') continue;
    if (ent.combat?.hiddenUntilCombat && !view.ambush) continue; // ennemi d'embuscade : invisible avant le combat (sauf à l'authoring)
    if (inBattle && battle!.combatants.some((c) => c.id === ent.id)) continue; // enrôlé : le combattant le rend
    const ez = ent.z ?? 0;
    // MÊME loi de case que les combattants (`cutByView`) : étage isolé/actif + sol vu d'en bas +
    // brouillard. Un figurant posté sur le chemin de ronde se voit de la cour comme le défenseur qui
    // l'y remplacera au combat — deux lois divergentes le faisaient disparaître hors combat (#1567).
    if (cutByView(scene, visible, view, { x: ent.pos.x, y: ent.pos.y, z: ez }, false).cut) continue;
    if (!ez && covered(ent.pos.x, ent.pos.y)) continue; // l'occlusion par combattant ne vaut qu'au sol
    // ASSISE : un PNJ authored attablé (`Scene.seatAssignments`) porte son ancre et son cap depuis la
    // SOURCE UNIQUE `noyau/monde/seating` — le builder ne recalcule aucune géométrie de meuble.
    const assis = seatPoseOf(scene, { kind: 'entity', entityId: ent.id });
    out.push({
      kind: 'token',
      key: `fig:${ent.id}`,
      id: ent.id,
      cell: { x: ent.pos.x, y: ent.pos.y, z: ez },
      subject: { kind: 'figurant', ent, enrolled: enrolledIds.has(ent.id), inBattle, ...(assis ? { seat: assis } : {}) },
      states: { visible: true },
    });
  }

  if (!battle) return out;

  // L'identité suit l'ordre du groupe ; seuls les jetons sont filtrés par la vue.
  for (const c of battle.combatants) {
    if (!c.pos) continue;
    // MDG 14 l.39
    if (isPassengerInBattle(c, battle.combatants, isMerScene(scene))) continue;
    // Structure de siège : AUCUN jeton de case — elle se rend sur son ARÊTE (`stage/AreteOverlay.tsx`).
    if (isStructure(c)) continue;
    const cz = c.pos.z ?? 0;
    const isHero = campOf(c) === 'party';
    const { cut, overhang } = cutByView(scene, visible, view, c.pos, isHero);
    if (cut) continue;
    // Combat monté (iso) : cavalier rendu EN SELLE (couple composite ci-dessous) ; en vue du dessus,
    // cavalier et monture sont deux pions distincts.
    if (!top && isRider(c)) continue;
    if (!top && isMount(c)) continue;
    out.push({
      kind: 'token',
      key: `cbt:${c.id}`,
      id: c.id,
      cell: { x: c.pos.x, y: c.pos.y, z: cz },
      subject: { kind: 'combatant', c, ...(isHero ? { heroIndex: heroRingIndex(c, partyIds) } : {}), overhang },
      states: { visible: true },
    });
  }
  // Couples MONTÉS (iso seulement) : UN corps composite à la tuile/empreinte de la monture, filtré
  // comme n'importe quel combattant — équipage abstrait, étage, surplomb, brouillard.
  //
  // ÉCART RÉSIDUEL DÉCLARÉ (#1176, P3-5) : en vue du DESSUS (`top`), le couple redevient DEUX pions
  // superposés (branche ci-dessus), et le monde volumique en hérite deux billboards à la même case.
  // La vue du dessus tactique le tranche.
  if (!top)
    for (const mount of battle.combatants) {
      if (!isMount(mount) || !mount.pos) continue;
      const rider = riderOf(battle, mount);
      if (!rider) continue;
      if (isPassengerInBattle(mount, battle.combatants, isMerScene(scene))) continue;
      // Un couple est VIEWER dès que l'un des deux corps est un héros (le cheval d'un héros ne
      // disparaît pas parce que le record de la monture est d'un autre camp).
      if (cutByView(scene, visible, view, mount.pos, campOf(mount) === 'party' || campOf(rider) === 'party').cut) continue;
      out.push({
        kind: 'token',
        key: `mtd:${mount.id}`,
        id: mount.id,
        cell: { x: mount.pos.x, y: mount.pos.y, z: mount.pos.z ?? 0 },
        subject: { kind: 'mounted', mount, rider, ...(campOf(rider) === 'party' ? { heroIndex: heroRingIndex(rider, partyIds) } : {}) },
        states: { visible: true },
      });
    }
  return out;
}
