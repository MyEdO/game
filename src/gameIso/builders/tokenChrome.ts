/**
 * BUILDER du CHROME D'ÉCRAN d'un jeton de combat (#1176, P3-0f) : barre de PV, icônes d'états/buffs
 * (« +N » compris), pastille d'état de FIN ; et les trois états d'ALLURE : fantôme hors Ligne de Vue,
 * jeton hors d'action, cible survolée.
 *
 * Frère de `builders/dynamicMarks`, et même frontière : PUR, camera-free. Ce que cette dérivation
 * rend, c'est ce qu'il y a à MONTRER d'un jeton — jamais où le montrer. La surcouche SVG
 * (`stage/TokenChromeOverlay`) l'ancre au bord du repère au sol ou du disque de la vue du dessus.
 *
 * La POPULATION est celle des ÉLÉMENTS DU BUILDER (`builders/tokens`) : les jetons réellement postés,
 * filtres compris — aucune voie ne refait de test de visibilité pour savoir qui porte un chrome.
 */
import { endState, type EndState } from '../../engine/conditions';
import type { Combatant } from '../../engine/types';
import { footprintN, sizeFootprint } from '../../noyau/monde/footprint';
import { entitySize } from '../../noyau/monde/spawn';
import type { IconId } from '../../ui/icons';
import { combatantFlags, summarizeEffects } from '../effectIcons';
import { relationColor } from '../teamColors';
import { combatantTokenScale, entityTokenScale } from '../sizeScale';
import { teamRingDecor, type MarkCell } from './dynamicMarks';
import type { OffreRendue, OffresRenduesParPorteur } from '../../state/offreRendue';
import { estPropVolumique, type DecorDEntite, type PropEl, type TokenEl } from './types';
import type { PartyToken } from './tokens';


/** ALVÉOLES RÉSERVÉES du chrome d'un jeton — autant de places que le rack d'États du portrait
 *  (`PortraitTile maxStates`) : les deux surfaces montrent le même nombre d'États d'un combattant.
 *  Le peintre (`TokenChromeMarks`) place la place `i` à une abscisse FIXE, déduite de ce compte et
 *  jamais du contenu — un État qui apparaît n'en pousse aucun autre. SOURCE UNIQUE du compte. */
export const CHROME_SLOTS = 4;
/** Icônes d'états montrées avant le report « +N » (`summarizeEffects`) : la réserve entière — le
 *  report prend une place quand il y en a un (même règle que `StateChips reserve`). */
export const CHROME_ICON_MAX = CHROME_SLOTS;

/** Ce qu'un jeton de combat MONTRE de son combattant. */
export interface TokenChrome {
  /** Barre de PV — `null` pour un engin INERTE (immune) : un objet n'a pas de santé. */
  hp: { current: number; max: number } | null;
  /** Icônes d'états/buffs, déjà tronquées à `CHROME_ICON_MAX`. */
  icons: IconId[];
  /** Surplus d'icônes non montrées. */
  iconsMore: number;
  /** État de FIN (#237) — pastille distincte, ou `null` pour un combattant en état. */
  endState: EndState | null;
  /** Hors Ligne de Vue du tireur actif → corps fantomatique. */
  ghost: boolean;
  /** Cible courante du joueur (survol) → couleur de relation, sinon `null`. */
  highlight: string | null;
}

/** Ce que la frame sait du CIBLAGE, et rien de plus. */
export interface ChromeCtx {
  /** Combattants hors LdV du tireur actif. */
  ghostIds: ReadonlySet<string>;
  /** Combattant survolé (jeton ou frise), ou `null`. */
  hoveredId: string | null;
}

/** Chrome VIDE : ce que MONTRE un jeton qui n'a rien à montrer — figurant d'ambiance, meneur du groupe
 *  hors combat. `TokenChromeMarks` ne peint alors aucune marque ; seul le repère du jeton reste. */
const NEUTRE: TokenChrome = { hp: null, icons: [], iconsMore: 0, endState: null, ghost: false, highlight: null };

/** Le chrome d'un COMBATTANT posté. */
export function tokenChrome(c: Combatant, ctx: ChromeCtx): TokenChrome {
  // Le report « +N » OCCUPE une place de la réserve : au débordement, une icône de moins est montrée
  // pour qu'il tienne dans la dernière — le rang ne déborde jamais de ses alvéoles.
  const plein = summarizeEffects(c.conditions, c.activeEffects, CHROME_ICON_MAX, combatantFlags(c));
  const fx = plein.moreCount > 0
    ? summarizeEffects(c.conditions, c.activeEffects, CHROME_ICON_MAX - 1, combatantFlags(c))
    : plein;
  return {
    hp: c.inert ? null : c.wounds ?? null,
    icons: fx.visible.map((v) => v.icon),
    iconsMore: fx.moreCount,
    endState: endState(c),
    ghost: ctx.ghostIds.has(c.id),
    highlight: c.id === ctx.hoveredId ? relationColor(c.kind) : null,
  };
}

/** Le chrome d'un couple MONTÉ, porté par sa MONTURE : le corps composite ne montre ni PV ni états —
 *  ceux du cavalier et ceux de la monture se peindraient au même endroit — `tokenChromes` ne poste
 *  donc qu'UNE marque par couple, celle de la monture. */
export function mountChrome(mount: Combatant): TokenChrome {
  return { hp: null, icons: [], iconsMore: 0, endState: endState(mount), ghost: false, highlight: null };
}

/** Le JETON POSTÉ, avec de quoi le POSER : sa case d'ancrage (coin NO, celle que la marche fait
 *  glisser), le côté de son EMPREINTE, l'échelle de son corps — c'est d'eux que se tirent le centre du
 *  bloc et la hauteur du chrome (le disque de la vue du dessus se mesure à l'empreinte ; le plateau iso,
 *  à l'échelle du corps). */
export interface TokenChromeMark extends TokenChrome {
  id: string;
  /** CLÉ du cap de ce jeton dans `store.facing` — son id pour une chose POSTÉE (combattant, monture,
   *  figurant), celle que PUBLIE le constructeur du jeton de groupe pour le groupe (`PartyToken.capKey`).
   *  Le disque de la vue du dessus s'y abonne : un cap qui change ne re-rend que SON porteur. */
  capKey: string;
  /** Case d'ANCRAGE (coin NO de l'empreinte) — la position logique, sans glissement. */
  cell: MarkCell;
  /** Côté de l'empreinte, en cases (`footprintN`). */
  n: number;
  /** Multiplicateur de taille du corps (catégorie de Taille). */
  scaleK: number;
  /** DÉCOR d'équipe du jeton (couleur d'anneau + pointillé daltonien) — `null` pour un jeton SANS
   *  équipe (un figurant d'ambiance n'appartient à aucun camp). */
  team: { color: string; dash?: string } | null;
}

/** ANCRAGE d'une chose postée sur le champ : sa case, son empreinte et l'échelle dont se tire la
 *  hauteur du chrome. TOUTE marque de cette chose s'y pose — le chrome d'écran comme la pastille de
 *  ses gestes — et c'est structurel : deux calculs d'ancrage divergeraient d'une case au premier pas. */
export interface Ancrage {
  cell: MarkCell;
  n: number;
  scaleK: number;
}

/** L'ancrage d'un JETON posté (combattant, monture d'un couple, figurant). `null` = rien à poser (une
 *  unité sans case n'est pas sur le champ). */
export function ancrageDuJeton(tk: TokenEl): Ancrage | null {
  const s = tk.subject;
  if (s.kind === 'figurant')
    return {
      cell: { x: s.ent.pos.x, y: s.ent.pos.y, z: tk.cell.z },
      n: sizeFootprint(entitySize(s.ent)),
      scaleK: entityTokenScale(s.ent),
    };
  const unit = s.kind === 'combatant' ? s.c : s.mount;
  if (!unit.pos) return null;
  return {
    cell: { x: unit.pos.x, y: unit.pos.y, z: tk.cell.z },
    n: footprintN(unit),
    scaleK: combatantTokenScale(unit),
  };
}

/** L'ancrage d'un DÉCOR d'entité posté (`DecorDEntite` : le tas d'objets, le tonneau fouillé) — même repère que celui
 *  d'un jeton, tiré de l'empreinte et de l'échelle au pied que le builder de décors a déjà calculées.
 *  Un décor VOLUMIQUE (`VolumePropEl`) n'a pas de `foot` — sa géométrie monde porte sa taille : échelle 1. */
export function ancrageDuDecor(pr: DecorDEntite): Ancrage {
  return {
    cell: { x: pr.cell.x, y: pr.cell.y, z: pr.cell.z },
    n: Math.max(pr.span.w, pr.span.h),
    scaleK: estPropVolumique(pr) ? 1 : pr.foot.scale,
  };
}

/** UNE PASTILLE : ce qu'une entité du champ OFFRE, et où la poser. La donnée des gestes vient du
 *  registre (`state/entityGestes`) ; ce builder ne fait que la POSER, au même ancrage que le chrome. */
export interface GesteMark extends Ancrage {
  /** Clé de groupe SVG — préfixée, pour ne jamais entrer en collision avec le chrome du même porteur. */
  id: string;
  entityId: string;
  /** Nom du porteur à l'écran — lu par l'infobulle unique du jeu au survol de la pastille. */
  label?: string;
  gestes: readonly OffreRendue[];
}

/** Les pastilles de la frame : une par ENTITÉ qui offre au moins un geste, posée sur SON porteur —
 *  un jeton (monture, coque servie) ou un décor (objets au sol). Une offre dont le porteur n'est pas
 *  posté (hors champ, filtré, non dessiné à cet étage) n'a pas de pastille : rien à montrer sur rien.
 *  PUR et camera-free, comme `tokenChromes` : la surcouche projette, ce module ne connaît que le monde. */
export function tokenGesteMarks(
  tokens: readonly TokenEl[],
  props: readonly PropEl[],
  offres: readonly OffresRenduesParPorteur[],
): GesteMark[] {
  const out: GesteMark[] = [];
  for (const groupe of offres) {
    if (!groupe.offres.length) continue;
    const tk = tokens.find((t) => porteurDuJeton(t) === groupe.porteurId);
    const pr = tk ? undefined : props.find((p): p is DecorDEntite => p.source === 'entity' && p.entId === groupe.porteurId);
    const a = tk ? ancrageDuJeton(tk) : pr ? ancrageDuDecor(pr) : null;
    if (!a) continue;
    out.push({ id: `geste-${groupe.porteurId}`, entityId: groupe.porteurId, label: groupe.porteurLabel, gestes: groupe.offres, ...a });
  }
  return out;
}

/** L'ENTITÉ que porte un jeton : l'unité pour un combattant, la MONTURE pour un couple (c'est elle
 *  qu'on enfourche et elle qui tient la case), l'entité de scène pour un figurant. */
function porteurDuJeton(tk: TokenEl): string {
  const s = tk.subject;
  if (s.kind === 'combatant') return s.c.id;
  if (s.kind === 'mounted') return s.mount.id;
  return s.ent.id;
}

/** Les marques de la frame : UNE par jeton posté — combattant, monture d'un couple monté, FIGURANT
 *  d'ambiance — plus celle du meneur du groupe hors combat quand l'hôte en poste un.
 *
 *  POPULATION = celle des ÉLÉMENTS DU BUILDER, et c'est structurel : c'est d'elle que la vue du dessus
 *  tire ses PIONS (`stage/TokenChromeOverlay`, verdict `pionsEnDisques`), et un jeton absent d'ici y
 *  serait un jeton absent de l'écran. Un figurant n'a ni PV ni États à montrer : son chrome est vide
 *  (`TokenChromeMarks` ne peint alors rien), sa marque n'existe que pour son PION. */
export function tokenChromes(
  tokens: readonly TokenEl[],
  ctx: ChromeCtx,
  partyToken: Pick<PartyToken, 'leader' | 'pos' | 'capKey' | 'heroIndex'> | null = null,
): TokenChromeMark[] {
  const out: TokenChromeMark[] = [];
  for (const tk of tokens) {
    const s = tk.subject;
    const a = ancrageDuJeton(tk);
    if (!a) continue;
    if (s.kind === 'figurant') {
      out.push({ id: `e-${s.ent.id}`, capKey: `e-${s.ent.id}`, ...a, team: null, ...NEUTRE });
      continue;
    }
    const unit = s.kind === 'combatant' ? s.c : s.mount;
    out.push({
      id: unit.id,
      capKey: unit.id,
      ...a,
      team: teamRingDecor(s.kind === 'mounted' ? s.rider : s.c, s.heroIndex),
      ...(s.kind === 'combatant' ? tokenChrome(s.c, ctx) : mountChrome(unit)),
    });
  }
  // L’identité est celle du meneur ; la clé de cap appartient au groupe.
  if (partyToken)
    out.push({
      id: partyToken.leader.id,
      capKey: partyToken.capKey,
      cell: { x: partyToken.pos.x, y: partyToken.pos.y, z: partyToken.pos.z ?? 0 },
      n: footprintN(partyToken.leader),
      scaleK: combatantTokenScale(partyToken.leader),
      team: teamRingDecor(partyToken.leader, partyToken.heroIndex),
      ...NEUTRE,
    });
  return out;
}
