/**
 * MONDE VOLUMIQUE (#1176) monté sous une vue — la couche PARTAGÉE des deux hôtes : le stage
 * isométrique (`IsoStage`, regard de plateau) et la vue première personne (`pov/PovStage`, regard POV,
 * lot P3-1a). Un seul montage volumique, donc une seule dérivation d'acteurs, une seule marche lue à
 * la frame, une seule liste de marques — les deux vues ne peuvent pas diverger sur ce que le monde
 * contient, seulement sur le REGARD porté dessus (`frame`, cf. `StageFrame`).
 *
 * Composant à part, et c'est STRUCTUREL : les abonnements au store qui n'ont de sens qu'ici y vivent,
 * donc ne s'abonnent pas quand l'hôte ne monte pas le monde (le POV SVG, jusqu'à C5b). `facing` en est
 * le cas d'école — `setFacing` reforge la référence de la table à chaque orientation (`store.ts`, à
 * chaque pas et à chaque attaque) : lu par `IsoStage`, il re-rendait le stage ENTIER.
 * Un hook conditionnel est interdit ; un composant conditionnel, non.
 *
 * Les ACTEURS se dérivent des ÉLÉMENTS DU BUILDER (`tokenEls`), pas de `battle.combatants` : les
 * filtres du builder valent pour eux (passager de navire abstrait, structure de siège rendue sur son
 * arête, étage isolé, surplomb, brouillard). Un couple MONTÉ y entre comme UN acteur : la monture porte
 * la case et l'échelle, le cavalier voyage avec elle (`ActorPose.rider`) et les deux sortent en UN seul
 * billboard composite (loi de selle `seatRiderOnMount`, `backends/webgl/sceneMeshes`).
 */
import { useMemo, type MutableRefObject } from 'react';
import { useGame, type BattleState } from '../../state/store';
import { heightAt, type Scene } from '../../state/scene';
import type { Dir8 } from '../../state/dir8';
import type { Pt } from '../../state/path';
import type { LightSource } from '../../state/vision';
import type { Combatant } from '../../engine/types';
import type { Dims } from '../../geometry/iso';
import { subscribeWalkFrames } from '../fx/useWalkAnim';
import { walkGlideM, type WalkTrack } from '../fx/walkPose';
import { buildHighlights, type HighlightEl } from '../builders/highlights';
import { NO_DYNAMIC_MARKS, type DynamicMarks } from '../builders/dynamicMarks';
import { NO_INTERACTION_HALOS, type InteractionHalos } from '../builders/interactHalos';
import type { TokenChromeMark } from '../builders/tokenChrome';
import type { PropEl, TokenEl } from '../builders/types';
import { actorPoseKey, actorPoses, type ActorPose, type KeepEl, type TintAt } from '../backends/webgl/sceneMeshes';
import { combatHighlightsView, type HighlightOpts } from './highlightLayer';
import type { ChromeAt } from './boardPose';
import { GameStage3D, type PercageEntrees, type StageFrame, type StageWalkAnim } from './GameStage3D';

/**
 * REGARD porté sur le monde, à l'échelle de l'hôte. Même union que celle de la caméra (`StageFrame`),
 * le regard de PLATEAU portant en plus le cadrage À UN INSTANT (`camAt`) que la boucle de rendu redemande
 * par frame, et le regard POV le sujet dont la marche déplace l'œil (`cid`).
 */
export type WorldFrame =
  | {
      mode: 'plateau';
      dims: Dims;
      cam: { x: number; y: number };
      /** Caméra à un instant DONNÉ : la boucle de rendu la redemande par frame pendant une marche. */
      camAt: (now: number) => { x: number; y: number };
      zoom: number;
    }
  | { mode: 'pov'; partyPos: { x: number; y: number; z?: number }; facing: Dir8; indoor: boolean; cid: string | null };

export function VolumetricWorld({ scene, mpt, frame, tintAt, keepEl, nappeVue, tokenEls, propEls, walksRef, partyToken, gameTime, lightLevel, lights, battle, highlightOpts, dynMarks, halos, chromes, percage }: {
  scene: Scene;
  mpt: number;
  /** Le REGARD de cet hôte — et la seule chose qui distingue les deux vues (cf. `WorldFrame`). */
  frame: WorldFrame;
  tintAt: TintAt;
  keepEl: KeepEl;
  /** Le même verdict de vue, rendu par SECTION de toiture (#1247) — ce que l'écrêtage de la pluie
   *  interroge. Absent = tout se dessine. */
  nappeVue?: (sectionId: string) => boolean;
  tokenEls: TokenEl[];
  propEls: PropEl[];
  /** Marches vivantes — LUES par la boucle de rendu, jamais par un rendu React (cf. `anim` ci-dessous). */
  walksRef: MutableRefObject<Record<string, WalkTrack>>;
  /** Hors combat : le jeton de GROUPE (le meneur visible), à sa case. En combat, ou vu par ses propres
   *  yeux (POV) : `null`. */
  partyToken: { leader: Combatant; pos: Pt } | null;
  /** Horloge de jeu (minutes) et mise en scène de lumière — la LUMIÈRE du monde volumique (P2-5) : le
   *  soleil suit l'heure et le nord de la scène, l'ambiante suit le palier. L'hôte reste la source. */
  gameTime: number;
  lightLevel: number | null | undefined;
  /** Sources de lumière PONCTUELLES de la scène — celles du champ mécanique, jamais recollectées ici. */
  lights: readonly LightSource[];
  /** Combat en cours, ou `null` hors combat : la seule entrée des MARQUES DE CASES (P3-0c). */
  battle: BattleState | null;
  /** Contexte de tour/ciblage dont les marques dérivent (`stage/highlightLayer`) — avec le combat. */
  highlightOpts?: HighlightOpts;
  /** MARQUES DYNAMIQUES déjà dérivées par l'hôte — les DEUX voies consomment cette même liste. */
  dynMarks?: DynamicMarks;
  /** HALOS D'INTERACTION déjà dérivés par l'hôte — même partage, même liste pour les deux voies. */
  halos?: InteractionHalos;
  /** CHROME des jetons déjà dérivé par l'hôte — cet écran n'en consomme que l'ALLURE (le reste se
   *  peint en overlay SVG, `stage/TokenChromeOverlay`). */
  chromes?: readonly TokenChromeMark[];
  /** DÉCOUPE LOCALE PAR OCCLUSION (#1176, M3) — les entrées du verdict que l'hôte tient déjà pour son
   *  dégagement (nappes projetées + capsules d'alliés). Cette couche ne les dérive pas : elle passe. */
  percage?: PercageEntrees | null;
}) {
  const facings = useGame((s) => s.facing); // orientation MONDE vivante par acteur (Dir8)
  const poses: ActorPose[] = actorPoses(tokenEls, facings);
  if (partyToken) {
    const z = partyToken.pos.z ?? 0;
    poses.push({ c: partyToken.leader, x: partyToken.pos.x, y: partyToken.pos.y, z, facing: facings[partyToken.leader.id] });
  }
  // RÉFÉRENCE STABLE tant que rien de ce que le billboard dessine n'a bougé — même patron de clé que
  // `visualAllies` (`IsoStage`). Un tableau neuf démonte puis remonte les quads de TOUS les sujets ; la
  // clé porte donc tout ce dont la POSE et le DESSIN dépendent : identité, case LOGIQUE, orientation,
  // et la SIGNATURE des entrées de dessin (garde-robe, équipement, apparence vivante, état au sol,
  // échelle). `actorPoseKey` la compose depuis la MÊME signature que l'identité de cache de texture
  // (`BillboardSubject.identity`) : une entrée de dessin ne peut plus périmer l'une sans l'autre.
  // Le GLISSEMENT de marche n'y entre PAS (#1176, P2-4) : la boucle de rendu le lit elle-même et décale
  // des quads déjà montés, là où la clé fractionnaire les remontait tous soixante fois par seconde.
  const posesKey = poses.map(actorPoseKey).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const actors = useMemo(() => poses, [posesKey]);
  const els = useMemo(() => ({ tokens: tokenEls, props: propEls }), [tokenEls, propEls]);
  // MARQUES DE CASES (P3-0c) : le MÊME builder pur que la voie affine, sur la MÊME vue assemblée
  // (`combatHighlightsView`). L'écran volumique n'en connaît que la liste — il la pose à plat au sol.
  const highlights = useMemo<HighlightEl[]>(
    () => (battle && highlightOpts ? buildHighlights(scene, battle, combatHighlightsView(useGame.getState, battle, highlightOpts)) : []),
    [scene, battle, highlightOpts],
  );
  // MARCHE lue par la BOUCLE (P2-4) : l'hôte garde l'intention (la courbe `walkPoseAt`, le cadrage
  // `camAt`), la boucle ne fait que la redemander à SA cadence. Objet reforgé à chaque rendu — c'est
  // voulu : il doit fermer sur les cases logiques du rendu courant.
  const bases = new Map(poses.map((p) => [p.c.id, { x: p.x, y: p.y, z: p.z }]));
  // En POV le meneur ne porte AUCUN billboard (on regarde par ses yeux) : sa base entre quand même
  // dans la table, car c'est son glissement que la caméra suit.
  if (frame.mode === 'pov' && frame.cid) bases.set(frame.cid, { x: frame.partyPos.x, y: frame.partyPos.y, z: frame.partyPos.z ?? 0 });
  const solM = (x: number, y: number, z: number) => heightAt(scene, Math.round(x), Math.round(y), z);
  const anim: StageWalkAnim = {
    subscribe: subscribeWalkFrames,
    glide: (cid) => {
      const base = bases.get(cid);
      return base ? walkGlideM(walksRef.current[cid], base, mpt, performance.now(), solM) : null;
    },
    cam: () => (frame.mode === 'plateau' ? frame.camAt(performance.now()) : { x: 0, y: 0 }),
  };
  // ALLURE des quads : la table du rendu courant, interrogée PAR FRAME dans la passe de pose. Elle se
  // reforge à chaque rendu, comme `anim` — un survol change trois nombres de matériau, rien de monté.
  const allures = new Map((chromes ?? []).map((m) => [m.id, { ghost: m.ghost, dim: m.dim, highlight: m.highlight }]));
  const chromeAt: ChromeAt = (cid) => allures.get(cid) ?? null;
  const frameCam: StageFrame = frame.mode === 'plateau'
    ? { mode: 'plateau', dims: frame.dims, cam: frame.cam, zoom: frame.zoom }
    : { mode: 'pov', partyPos: frame.partyPos, facing: frame.facing, indoor: frame.indoor, cid: frame.cid };
  return <GameStage3D scene={scene} mpt={mpt} frame={frameCam} tintAt={tintAt} keepEl={keepEl} nappeVue={nappeVue} els={els} actors={actors} gameTime={gameTime} lightLevel={lightLevel} lights={lights} highlights={highlights} dynMarks={dynMarks ?? NO_DYNAMIC_MARKS} halos={halos ?? NO_INTERACTION_HALOS} chromeAt={chromeAt} anim={anim} percage={percage ?? null} />;
}
