import type { JSX } from 'react';
/**
 * SURCOUCHE DES JETONS du stage (#1176, P3-0f puis P3-5c) — ce qui se peint AU-DESSUS du canevas, dans
 * le SVG : le CHROME d'écran (barre de PV, icônes d'États, pastille d'état de FIN) et, sous le verdict
 * `pionsEnDisques` (vue du dessus), le PION lui-même — un disque neutre.
 *
 * Pourquoi un OVERLAY et pas un quad texturé de plus : une barre de PV rasterisée dans le monde
 * mesure 1,7 px de haut à jeton de 40 px et scintille sans mipmaps ; un cache de texture par état de
 * PV fuit sur le GPU ; et la moindre clé de décoration dans l'identité des sujets remonterait tous les
 * billboards à chaque point de vie perdu. Le chrome est de l'INTERFACE : il vit à l'écran, à taille
 * constante, avec ses icônes du registre et ses `<title>` d'accessibilité.
 * Conséquence MESURÉE (juge vision 2026-08-13) : peint à l'écran, ce chrome garde sa LUMINANCE PLEINE
 * là où l'affine, dessiné dans la scène, s'assombrit avec elle — barre de PV mesurée ×2,75 plus claire.
 *
 * CADENCE : le rendu React donne le CONTENU (PV, États, état de fin, pion), la BOUCLE DE MARCHE donne
 * la POSITION. Les deux ne battent pas au même rythme, et c'est structurel : en volumique aucun rendu
 * React ne se produit entre deux pas (`fx/useWalkAnim`, `repaint = false`), si bien qu'un jeton posé au
 * seul rendu attendrait le marcheur sur sa case de départ. Le groupe de chaque jeton porte donc une
 * RÉF, et le battement de la marche y réécrit un `transform` — le patron du groupe caméra du stage
 * (`SurcoucheIso`, `camGRef`), sans un `setState` par frame. Le glissement du DISQUE est donc GRATUIT : il
 * vit dans ce même groupe.
 *
 * ANCRAGE : au bord supérieur du repère au sol — demi-axe vertical de l'anneau en iso,
 * rayon du disque sous `pionsEnDisques`. La géométrie vient de `builders/dynamicMarks`.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { tileCenter, type Dims } from '../../geometry/iso';
import type { Dir8 } from '../../geometry/dir8';
import { useGame } from '../../state/store';
import type { TintAt } from '../backends/webgl/sceneMeshes';
import { TokenChromeMarks } from '../TokenChromeMarks';
import { COMBAT_TOKEN_BASE, discCapPath, discR, RING_B_PX, teamRingRadiusK } from '../builders/dynamicMarks';
import { OUT_OF_PARTY_RING } from '../teamColors';
import { END_STATE_APPEARANCE, endStateFilter } from '../endStateAppearance';
import { subscribeStageFrames } from './stageFrames';
import { viewBoxUnitPx, type StageCanvas } from './stageCam';
import { VH, VW } from './useStageCamera';
import type { GesteMark, TokenChromeMark } from '../builders/tokenChrome';
import { PastilleEntite } from './PastilleEntite';
import type { WalkPos } from '../fx/walkPose';

/** Lift d'étage d'une case (mêmes unités que le `z` de `tileCenter`). */
export type LiftAt = (x: number, y: number, z?: number) => number;

/** Distance ÉCRAN (px) du centre au bord supérieur du repère : rayon du disque en vue du dessus,
 *  demi-axe vertical de l'anneau d'équipe en iso. */
export function chromeHeadPx(pions: boolean, mark: { scaleK: number; n: number }): number {
  return pions
    ? discR(mark.n)
    : RING_B_PX * teamRingRadiusK(COMBAT_TOKEN_BASE * mark.scaleK);
}

/** Position ÉCRAN du jeton à l'instant que porte `wp` : le CENTRE de son bloc d'empreinte, glissement
 *  de marche compris. Un seul calcul, partagé par le rendu React et le battement de marche — deux
 *  formules divergeraient au premier pas. C'est aussi ce qui rend le clic JUSTE sous `pionsEnDisques` :
 *  le disque est centré sur sa case, donc le repli de surface du picking
 *  (`stage/pickResolve.ts:resoudrePixel`) y répond le même jeton. */
export function chromeTransform(m: Pick<TokenChromeMark, 'id' | 'cell' | 'n'>, dims: Dims, liftAt: LiftAt, wp: WalkPos): string {
  const p = wp(m.id, m.cell.x, m.cell.y, m.cell.z);
  const off = (m.n - 1) / 2;
  const x = p.x + off;
  const y = p.y + off;
  const { cx, cy } = tileCenter(x, y, dims, liftAt(x, y, m.cell.z));
  return `translate(${cx},${cy})`;
}

/** Opacité du disque hors Ligne de Vue. */
export const DISQUE_GHOST_OPACITY = 0.45;
/** Part de couleur retirée à un jeton hors Ligne de Vue. */
const DISQUE_GHOST_DESAT = 0.85;
/** Fond du disque — la matière du pion. */
const DISQUE_FOND = '#1b2030';
const DISQUE_STROKE_PX = 2.5;

/**
 * LE PION de la vue du dessus : un disque NEUTRE centré sur sa case — fond, cap, anneau d'équipe, sans
 * corps (#3160).
 *
 * L'ANNEAU d'équipe est celui de `builders/dynamicMarks.teamRingDecor` (couleur + pointillé daltonien
 * R9), au rayon du disque — le pool volumique d'anneaux n'en pose plus aucun sous ce verdict, jamais
 * les deux. C'est la décoration d'ÉQUIPE : un pion sans camp n'en porte pas.
 *
 * Le CAP d'orientation, lui, appartient au PION et pas à son camp : il ne lit que `store.facing`, à la
 * CLÉ que porte la marque (`TokenChromeMark.capKey` — son id pour une chose postée, `CAP_GROUPE` pour
 * le jeton du groupe, que la marque tient de `partyTokenOf`), monture ou figurant compris — un pion
 * hors groupe le porte donc aussi, à la teinte HORS GROUPE de la palette d'identité
 * (`teamColors.OUT_OF_PARTY_RING`).
 * C'est le quartier partagé du marqueur de station (`topoMarkers.wedgePath`, via `discCapPath`), à
 * cheval sur le bord du disque et peint APRÈS le fond : dessous, le bord lui mangeait sa surface,
 * et il ne restait d'une diagonale qu'une couleur au coin. Son orientation est LUE ICI, au pion, et
 * pas dans la surcouche — un cap qui change ne re-rend que le disque de SON porteur, et le plateau
 * iso, où aucun `TokenDisc` n'est monté, ne s'y abonne jamais.
 *
 * ÉCART DÉCLARÉ (#1176) : l'EXPOSITION AUX LAMPES (`stage/stagePointLights.billboardExposure`) n'existe
 * que dans la boucle volumique — un pion en disque ne s'éclaire pas au passage d'une torche. Il garde
 * ses deux autres canaux : la teinte de VISIBILITÉ de sa case, et son allure.
 */
function TokenDisc({ m, dims }: { m: TokenChromeMark; dims: Dims }): JSX.Element {
  const facing: Dir8 = useGame((s) => s.facing?.[m.capKey]) ?? 'S';
  const R = discR(m.n);
  return (
    <>
      <ellipse cx={0} cy={R * 0.92} rx={R} ry={R * 0.32} fill="#000" opacity={0.28} />
      <circle cx={0} cy={0} r={R} fill={DISQUE_FOND} />
      <path d={discCapPath(facing, m.n, dims)} fill={m.team?.color ?? OUT_OF_PARTY_RING} opacity={0.85} />
      {m.team && <circle cx={0} cy={0} r={R} fill="none" stroke={m.team.color} strokeWidth={DISQUE_STROKE_PX} strokeDasharray={m.team.dash} />}
    </>
  );
}

/** Style d'ALLURE du disque, en CSS : estompe, désaturation, lueur de survol, plus la teinte de
 *  visibilité de SA case. */
export function allureStyle(m: Pick<TokenChromeMark, 'endState' | 'ghost' | 'highlight'>, tint: number): CSSProperties {
  const filtres = [
    m.endState ? endStateFilter(m.endState) : m.ghost ? `grayscale(${DISQUE_GHOST_DESAT})` : '',
    tint < 1 ? `brightness(${tint.toFixed(3)})` : '',
    m.highlight ? `drop-shadow(0 0 3px ${m.highlight}) drop-shadow(0 0 7px ${m.highlight})` : '',
  ].filter(Boolean);
  return {
    opacity: m.endState ? END_STATE_APPEARANCE[m.endState].opacity : m.ghost ? DISQUE_GHOST_OPACITY : 1,
    ...(filtres.length ? { filter: filtres.join(' ') } : {}),
  };
}

/** Ce jeton a-t-il quelque chose à peindre ici ? Sous `pionsEnDisques`, TOUJOURS — il y porte son
 *  PION. Sinon, seulement s'il montre du chrome : un figurant d'ambiance n'en a aucun, et un groupe
 *  vide par figurant serait du DOM pour rien. Même condition que celle sous laquelle
 *  `TokenChromeMarks` ne rend rien. */
export function aPeindre(m: TokenChromeMark, pions: boolean): boolean {
  return pions || m.hp != null || m.icons.length > 0 || m.iconsMore > 0 || m.endState != null;
}

export interface TokenChromeOverlayProps {
  /** Jetons de la frame, déjà dérivés par le builder (`builders/tokenChrome`). */
  chromes: readonly TokenChromeMark[];
  dims: Dims;
  liftAt: LiftAt;
  /** Verdict `pionsEnDisques` (`stage/viewPolicy`) : cette surcouche porte alors le PION des jetons,
   *  et pas seulement leur chrome. Tranché par l'hôte, jamais re-déduit d'un test de vue local. */
  pions: boolean;
  /** Teinte de visibilité d'une case — le canal que le monde volumique applique à ses quads, appliqué
   *  ici aux disques. Absente = pleine lumière. */
  tintAt?: TintAt;
  /** Position visuelle des jetons à un instant DONNÉ — le rendu la demande au sien, la boucle de
   *  marche la redemande à chaque frame (c'est là que le glissement se lit). */
  walkPosAt: (now: number) => WalkPos;
  /** PASTILLES d'entité de la frame (`builders/tokenChrome.tokenGesteMarks`) : les gestes que les
   *  choses du champ offrent à l'actif contrôlé. Elles vivent DANS ce groupe par-porteur, donc au
   *  même transform et au même battement de marche que le chrome — une pastille ne décroche jamais
   *  de son entité. Absentes hors combat, hors de son tour, et pour un siège qui ne contrôle pas. */
  gestes?: readonly GesteMark[];
}

/** L'ancrage de POSE d'une pastille : la case et l'empreinte de SON entité, sous l'identité de marche
 *  de celle-ci (`entityId`) — c'est ce qui la fait glisser avec une monture qui marche. */
const ancreDeGeste = (g: GesteMark) => ({ id: g.entityId, cell: g.cell, n: g.n });

/** CONTRE-ÉCHELLE du chrome CLIQUABLE : tout ce qui vit dans le groupe caméra est agrandi par
 *  `zoom × viewBoxScale(canvas)` (`stage/stageCam`, la chaîne même de `stageScreenPixel`). Une cible
 *  tactile doit, elle, mesurer ses pixels d'ÉCRAN — elle se contre-échelonne donc de ce facteur, mesuré
 *  sur le SVG porteur (son cadre EST celui du rendu). Le viewBox nominal sert de repli tant que
 *  l'élément n'est pas mesuré (montage, environnement sans mise en page). */
export function useEchelleEcran(porteur: { current: SVGGElement | null }): number {
  const zoom = useGame((s) => s.zoom);
  const [canvas, setCanvas] = useState<StageCanvas>({ w: VW, h: VH });
  useEffect(() => {
    const svg = porteur.current?.ownerSVGElement;
    if (!svg) return;
    const mesurer = () => {
      const w = svg.clientWidth;
      const h = svg.clientHeight;
      if (!w || !h) return;
      setCanvas((p) => (p.w === w && p.h === h ? p : { w, h }));
    };
    mesurer();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(mesurer);
    ro.observe(svg);
    return () => ro.disconnect();
  }, [porteur]);
  const px = viewBoxUnitPx(zoom, canvas);
  return px > 0 ? 1 / px : 1;
}

export function TokenChromeOverlay({ chromes, dims, liftAt, pions, tintAt, walkPosAt, gestes = [] }: TokenChromeOverlayProps): JSX.Element {
  const groupes = useRef(new Map<string, SVGGElement>());
  const mesure = useRef<SVGGElement | null>(null);
  const echelle = useEchelleEcran(mesure);
  // ORIENTATION MONDE (`store.facing`) : AUCUN abonnement ici — toute écriture de cap reforge la référence de la
  // table à chaque pas et à chaque attaque, et cette surcouche vit sous les DEUX regards. L'abonnement
  // vit dans `TokenDisc`, monté sous le seul verdict `pionsEnDisques`, et n'y porte que la case du pion
  // concerné : sur le plateau iso, un cap qui change ne re-rend rien du tout.
  // Sans tableau de dépendances PAR CONSTRUCTION : l'abonnement se refait après chaque rendu, donc la
  // closure du battement porte toujours les chromes et la vue du rendu courant (même patron que la
  // passe de dessin du monde volumique, `GameStage3D`).
  useEffect(() =>
    subscribeStageFrames(() => {
      const wp = walkPosAt(performance.now());
      for (const m of chromes) {
        const g = groupes.current.get(m.id);
        if (g) g.setAttribute('transform', chromeTransform(m, dims, liftAt, wp));
      }
      for (const m of gestes) {
        const g = groupes.current.get(m.id);
        if (g) g.setAttribute('transform', chromeTransform(ancreDeGeste(m), dims, liftAt, wp));
      }
    }),
  );
  const wp = walkPosAt(performance.now());
  return (
    <>
      {/* Groupe TÉMOIN : il ne peint rien — il donne au chrome cliquable l'élément SVG où se mesure le
          cadre de rendu (contre-échelle de taille écran). */}
      <g ref={mesure} data-chrome-mesure="" pointerEvents="none" />
      {chromes.filter((m) => aPeindre(m, pions)).map((m) => (
        <g
          key={m.id}
          ref={(g) => {
            if (g) groupes.current.set(m.id, g);
            else groupes.current.delete(m.id);
          }}
          data-chrome-cid={m.id}
          {...(pions ? { 'data-pion-cid': m.id } : {})}
          transform={chromeTransform(m, dims, liftAt, wp)}
          pointerEvents="none"
        >
          {pions && (
            <g style={allureStyle(m, tintAt?.(m.cell.x, m.cell.y, m.cell.z) ?? 1)}>
              <TokenDisc m={m} dims={dims} />
            </g>
          )}
          <TokenChromeMarks hp={m.hp} icons={m.icons} iconsMore={m.iconsMore} endState={m.endState} badgeY={-chromeHeadPx(pions, m)} />
        </g>
      ))}
      {gestes.map((m) => (
        <g
          key={m.id}
          ref={(g) => {
            if (g) groupes.current.set(m.id, g);
            else groupes.current.delete(m.id);
          }}
          data-geste-cid={m.entityId}
          transform={chromeTransform(ancreDeGeste(m), dims, liftAt, wp)}
        >
          <PastilleEntite mark={m} headY={-chromeHeadPx(pions, m)} echelle={echelle} />
        </g>
      ))}
    </>
  );
}
