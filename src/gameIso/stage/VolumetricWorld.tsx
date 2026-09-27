/**
 * MONDE VOLUMIQUE (#1176) monté sous une vue — la couche PARTAGÉE des deux regards, servie par l'hôte
 * unique de l'écran de campagne (`stage/MondeDeCampagne`, #1385) : regard de plateau et regard à
 * hauteur d'homme. Un seul montage volumique, donc une seule dérivation d'acteurs, une seule marche lue
 * à la frame, une seule liste de marques — les deux vues ne peuvent pas diverger sur ce que le monde
 * contient, seulement sur le REGARD porté dessus (`frame`, cf. `StageFrame`).
 *
 * Composant à part, et c'est STRUCTUREL : les abonnements au store qui n'ont de sens qu'ici y vivent.
 * `facing` en est le cas d'école — toute écriture de cap reforge la référence de la table
 * (`store.ts`, à chaque pas et à chaque attaque) : lu par l'hôte, il re-rendrait le stage ENTIER.
 * Un hook conditionnel est interdit ; un composant conditionnel, non.
 *
 * Les ACTEURS se dérivent des ÉLÉMENTS DU BUILDER (`tokenEls`), pas de `battle.combatants` : les
 * filtres du builder valent pour eux (passager de navire abstrait, structure de siège rendue sur son
 * arête, étage isolé, surplomb, brouillard). Un couple MONTÉ y entre comme UN acteur : la monture porte
 * la case et l'échelle, le cavalier voyage avec elle (`ActorPose.rider`) et les deux sortent en UN seul
 * billboard composite (loi de selle `seatRiderOnMount`, `backends/webgl/sceneMeshes`).
 */
import { useMemo, useState, type MutableRefObject } from 'react';
import { useGame, type BattleState } from '../../state/store';
import { hauteurDe, type Scene } from '../../state/scene';
import type { Dir8 } from '../../state/dir8';
import type { LightSource } from '../../state/vision';
import type { Dims } from '../../geometry/iso';
import { walkGlideM, type WalkTrack } from '../fx/walkPose';
import { buildHighlights, type HighlightEl } from '../builders/highlights';
import { NO_DYNAMIC_MARKS, type DynamicMarks } from '../builders/dynamicMarks';
import { NO_INTERACTION_HALOS, type InteractHalo } from '../builders/interactHalos';
import type { TokenChromeMark } from '../builders/tokenChrome';
import type { PropEl, TokenEl } from '../builders/types';
import { actorPoseKey, actorPoses, partyActorPose, type ActorPose, type KeepEl, type TintAt } from '../backends/webgl/sceneMeshes';
import type { PartyToken } from '../builders/tokens';
import { combatHighlightsView, type HighlightOpts } from './highlightLayer';
import type { ChromeAt } from './boardPose';
import { GameStage3D, type PercageEntrees, type StageFrame, type StageWalkAnim } from './GameStage3D';

/**
 * REGARD porté sur le monde, à l'échelle de l'hôte. Même union que celle de la caméra (`StageFrame`),
 * le regard de PLATEAU ne portant PAS de position de caméra mais le cadrage À UN INSTANT (`camAt`) que
 * la boucle de rendu redemande par frame — une valeur figée dans le cadre reforgerait celui-ci à chaque
 * image. Le regard POV, lui, porte le sujet dont la marche déplace l'œil (`cid`).
 */
export type WorldFrame =
  | {
      mode: 'plateau';
      dims: Dims;
      /** Caméra à un instant DONNÉ — la seule forme sous laquelle la vue de plateau la fournit. */
      camAt: (now: number) => { x: number; y: number };
      /** LACET à l'instant de l'IMAGE (#1403), même raison : sous rotation continue, `dims` porte le
       *  lacet du dernier commit et le monde tournerait de cran en cran. */
      yawAt?: () => number;
      zoom: number;
    }
  | {
      mode: 'pov';
      partyPos: { x: number; y: number; z?: number };
      facing: Dir8;
      indoor: boolean;
      cid: string | null;
      /** Hauteur d'œil au-dessus du sol — absente = le regard DEBOUT ; le meneur attablé la tient de sa place. */
      eyeH?: number;
    };

export function VolumetricWorld({ scene, mpt, frame, tintAt, keepEl, nappeVue, tokenEls, propEls, walksRef, partyToken, gameTime, lightLevel, lights, battle, highlightOpts, dynMarks, halos, chromes, percage, pionsEnDisques }: {
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
  /** Hors combat : le jeton de GROUPE (le meneur visible), à sa position de RENDU, et la place qu'il
   *  occupe s'il est attablé (`builders/tokens.partyTokenOf` — l'ancre de la place est déjà dans
   *  `pos`). En combat, ou vu par ses propres yeux (POV) : `null`. */
  partyToken: PartyToken | null;
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
  /** MARQUES DYNAMIQUES déjà dérivées par l'hôte (`builders/dynamicMarks`) — cette couche les pose. */
  dynMarks?: DynamicMarks;
  /** HALOS D'INTERACTION déjà dérivés par l'hôte (`builders/interactHalos`) — même partage. */
  halos?: readonly InteractHalo[];
  /** CHROME des jetons déjà dérivé par l'hôte — cet écran n'en consomme que l'ALLURE (le reste se
   *  peint en overlay SVG, `stage/TokenChromeOverlay`). */
  chromes?: readonly TokenChromeMark[];
  /** DÉCOUPE LOCALE PAR OCCLUSION (#1176, M3) — les entrées du verdict que l'hôte tient déjà pour son
   *  dégagement (nappes projetées + capsules d'alliés). Cette couche ne les dérive pas : elle passe. */
  percage?: PercageEntrees | null;
  /** Verdict `pionsEnDisques` de l'hôte (#1176, P3-5c) : sous lui le monde ne monte AUCUN sujet
   *  `kind:'personnage'` — c'est l'hôte qui les peint, en disques SVG. Cette couche PASSE le verdict,
   *  elle ne le dérive pas : le POV et l'éditeur regardent d'autres plateaux. */
  pionsEnDisques?: boolean;
}) {
  const facings = useGame((s) => s.facing); // orientation MONDE vivante par acteur (Dir8)
  // VOILE D'ENTRÉE EN SCÈNE (#1372) : l'écran volumique dit quand il tient son chargement, cette
  // couche le PEINT — un simple élément de DOM par-dessus le canevas (même boîte, `.iso-stage`), et
  // aucun chemin de rendu de plus. Il vit ici et pas dans un hôte : les deux vues (plateau, première
  // personne) montent ce même monde, et un voile par hôte en ferait deux à tenir d'accord.
  const [voile, setVoile] = useState(false);
  const poses: ActorPose[] = actorPoses(tokenEls, facings);
  if (partyToken) poses.push(partyActorPose(partyToken, facings));
  // RÉFÉRENCE STABLE tant que rien de ce que le billboard dessine n'a bougé — même patron de clé que
  // `visualAllies` (`stage/MondeDeCampagne`). Un tableau neuf démonte puis remonte les quads de TOUS les sujets ; la
  // clé porte donc tout ce dont la POSE et le DESSIN dépendent : identité, case LOGIQUE, orientation,
  // et la SIGNATURE des entrées de dessin (garde-robe, équipement, apparence vivante, état au sol,
  // échelle). `actorPoseKey` la compose depuis la MÊME signature que l'identité de cache de texture
  // (`BillboardSubject.identity`) : une entrée de dessin ne peut plus périmer l'une sans l'autre.
  // Le GLISSEMENT de marche n'y entre PAS (#1176, P2-4) : la boucle de rendu le lit elle-même et décale
  // des quads déjà montés, là où la clé fractionnaire les remontait tous soixante fois par seconde.
  const posesKey = poses.map(actorPoseKey).join('|');
  const actors = useMemo(() => poses, [posesKey]);
  // Les éléments du DÉCOR passent tels quels : leur rétention par CONTENU vit au socle
  // (`GameStage3D`, `memesBillboardEls`) — l'éditeur monte cet écran sans passer par ici.
  const els = useMemo(() => ({ tokens: tokenEls, props: propEls }), [tokenEls, propEls]);
  // MARQUES DE CASES (P3-0c) : le builder PUR `builders/highlights`, sur la vue assemblée
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
  const solM = (x: number, y: number, z: number) => hauteurDe(scene, { x, y, z });
  const anim: StageWalkAnim = {
    glide: (cid) => {
      const base = bases.get(cid);
      return base ? walkGlideM(walksRef.current[cid], base, mpt, performance.now(), solM) : null;
    },
    cam: () => (frame.mode === 'plateau' ? frame.camAt(performance.now()) : { x: 0, y: 0 }),
  };
  // ALLURE des quads : la table du rendu courant, interrogée PAR FRAME dans la passe de pose — un
  // survol change trois nombres de matériau, rien de monté. RETENUE sur la SIGNATURE des allures
  // (#1371) : la fonction est une DÉPENDANCE du redessin de l'écran, et une fermeture neuve sur une
  // `Map` neuve y faisait peindre une image à chaque commit de l'hôte, quelle qu'en fût la cause.
  const cléAllures = (chromes ?? []).map((m) => `${m.id}:${m.ghost ? 1 : 0}${m.dim ? 1 : 0}:${m.highlight ?? ''}`).join('|');
  const chromeAt = useMemo<ChromeAt>(
    () => {
      const allures = new Map((chromes ?? []).map((m) => [m.id, { ghost: m.ghost, dim: m.dim, highlight: m.highlight }]));
      return (cid) => allures.get(cid) ?? null;
    },
    [cléAllures],
  );
  // CADRE servi à l'écran — RÉFÉRENCE STABLE tant que le cadrage ne bouge pas (#1371), même raison.
  // La caméra de plateau n'y sert PAS à cadrer : `dessiner` prend la sienne du pilote à chaque image
  // (`anim.cam()`, `GameStage3D`), et `frame.cam` n'est que le repli d'un hôte qui n'en fournit aucun
  // (l'éditeur). Elle entre ici en CLÉ DE CHANGEMENT, échantillonnée à l'instant du rendu : deux
  // commits au même cadrage rendent le même objet, un panoramique en rend un neuf. Rien n'y bat à la
  // frame — c'est un objet de rendu React, pas une valeur d'image.
  const camRendu = frame.mode === 'plateau' ? frame.camAt(performance.now()) : null;
  const cléCadre = frame.mode === 'plateau'
    ? `plateau|${frame.zoom}|${camRendu!.x}|${camRendu!.y}`
    : `pov|${frame.partyPos.x},${frame.partyPos.y},${frame.partyPos.z ?? 0}|${frame.facing}|${frame.indoor}|${frame.cid ?? ''}|${frame.eyeH ?? ''}`;
  const frameCam = useMemo<StageFrame>(
    () => (frame.mode === 'plateau'
      ? { mode: 'plateau', dims: frame.dims, cam: { x: camRendu!.x, y: camRendu!.y }, yawAt: frame.yawAt, zoom: frame.zoom }
      : { mode: 'pov', partyPos: frame.partyPos, facing: frame.facing, indoor: frame.indoor, cid: frame.cid, ...(frame.eyeH !== undefined ? { eyeH: frame.eyeH } : {}) }),
    // Le CRAN de vue (`dims`) entre par sa référence : l'hôte le retient déjà sur sa géométrie
    // (`MondeDeCampagne.dimsVue`), et le sérialiser ici en ferait une seconde vérité à tenir d'accord.
    [cléCadre, frame.mode === 'plateau' ? frame.dims : null],
  );
  return (
    <>
      <GameStage3D scene={scene} mpt={mpt} frame={frameCam} tintAt={tintAt} keepEl={keepEl} nappeVue={nappeVue} els={els} actors={actors} gameTime={gameTime} lightLevel={lightLevel} lights={lights} highlights={highlights} dynMarks={dynMarks ?? NO_DYNAMIC_MARKS} halos={halos ?? NO_INTERACTION_HALOS} chromeAt={chromeAt} anim={anim} percage={percage ?? null} pionsEnDisques={pionsEnDisques} onEntreeEnScene={setVoile} />
      {/* Le chargement de l'app, RÉUTILISÉ tel quel (`.lazy-fallback`, repli de `Suspense` dans
          `ui/App.tsx`) : `role="status"` et le mot « Chargement… », rien de plus — aucune classe de
          domaine de plus (cliquet `ui-ratchets` xii). Ce qui lui est PROPRE tient en trois réglages
          de boîte : il se cale sur le canevas (`.iso-stage`, absolu inset 0) au lieu d'occuper une
          hauteur d'écran. Il AVALE les clics tant qu'il tient : la surcouche SVG qu'il couvre reste
          cliquable, et un clic porté sur un monde invisible est un clic à l'aveugle. */}
      {voile && (
        <div
          className="lazy-fallback"
          role="status"
          data-voile="1"
          style={{ position: 'absolute', inset: 0, minHeight: 0, background: 'var(--bg)' }}
        >
          Chargement…
        </div>
      )}
    </>
  );
}
