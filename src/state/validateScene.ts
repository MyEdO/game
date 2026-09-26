import { heightAt, isMerScene, isWalkable, type Scene, type Effect } from './scene';
import { startOf, unreachableDescriptiveZones } from './mapQC';
import { footprintTiles, sizeFootprint } from './footprint';
import { entitySize } from './spawn';
import { refEntiteResolue } from '../data';
import { METRES_PER_LEVEL } from './relief';
import { realFloorAt } from './sceneEdit';
import { CHAR_KEYS } from '../engine/types';
import { type Flow, type Condition, walkFlow, walkConditionTimes, flowHasTest, carriedFlows, EMPTY_FLOW } from './flow';
import { refEstVolumique, stakeSpeaks, findPropById, matieresCouvrantes } from '../data';
import { capDecorAdmis } from '../data/props.types';
import { PENTE_TOIT_DEG, typeNonNomme } from '../data/schemas/defs-scenes/scene';
// Registre des effets (réfs de validation `handler.refs`) — importé via le BARIL `combatFlow` (qui
// ré-exporte combatEffects), comme le store : entrer le cycle d'effets/combat par le MÊME nœud
// canonique préserve l'ordre d'évaluation (un import direct de `combatEffects` ici casse la
// liaison vive `fireScheduledEffects` que le store lit du baril sous le bundler).
import { EFFECT_HANDLERS, type EffectHandler, type EffectRefCtx } from './combatFlow';
import { sceneNpc } from './sceneNpc';
import { placeServices, type WorldMap } from './worldMap';
import { allMusicDefs } from '../audio/music';
import { scenePlanDefects, type PlanDefectAt, type PlanDefectFamily } from './planDefects';
import { seatAssignmentDefects } from './seating';

/** Clés valides de `CustomStatblock.char` : les 10 `CharKey` (slugs pleins, #311) ∪ `M`/`B`
 *  (Mouvement/Blessures, hors `CharKey` — cf. `CustomStatblock` dans `./scene`). */
const VALID_STATBLOCK_CHAR_KEYS = new Set<string>([...CHAR_KEYS, 'M', 'B']);
/** Ids POSABLES sur une masse de toit : les matériaux que la DONNÉE déclare couvrants
 *  (`materials.json` domaine `roof`, champ `couverture`) — même source que les sélecteurs de l'éditeur
 *  (`matieresCouvrantes`). CALCULÉ À L'APPEL : le document des matières se mute EN PLACE à l'édition,
 *  un ensemble cuit à l'import refuserait encore une couverture qui vient d'être déclarée. */
const roofCoveringIds = (): ReadonlySet<string> => new Set(matieresCouvrantes().map((material) => material.id));

export interface Warning {
  level: 'error' | 'warn';
  sceneId: string;
  scope: 'architecture' | 'entity' | 'trigger' | 'dialogue' | 'encounter' | 'scene' | 'worldMap' | 'plan';
  /** Id du fautif (pour clic → sélection dans l'éditeur). */
  refId?: string;
  architectureRef?: ArchitectureWarningRef;
  /** Défaut de PLAN (`scope: 'plan'`) : famille + endroit à corriger, pour que l'éditeur y emmène. */
  plan?: { family: PlanDefectFamily; at: PlanDefectAt };
  message: string;
}

export type ArchitectureWarningRef =
  | { type: 'architectureBody'; id: string }
  | { type: 'architectureStorey'; bodyId: string; id: string }
  | { type: 'architecturePart'; bodyId: string; storeyId: string; id: string }
  | { type: 'facadeSection'; bodyId: string; id: string }
  | { type: 'roofSection'; bodyId: string; id: string };

/**
 * Vérifie un PROJET (liste de scènes + carte du monde optionnelle) avant le runtime : réfs cassées
 * (dialogue / rencontre / scène / scène intérieure / nœud de dialogue / lieu et route de la carte),
 * zones hors-carte, ids dupliqués. PUR.
 */
export function validateScene(project: Scene[], worldMap?: WorldMap | null): Warning[] {
  const out: Warning[] = [];
  const sceneIds = new Set(project.map((s) => s.id));
  if (worldMap) {
    const addWm = (refId: string, message: string) =>
      out.push({ level: 'error', sceneId: worldMap.id, scope: 'worldMap', refId, message });
    const placeIds = new Set(worldMap.places.map((p) => p.id));
    const poiIds = new Set<string>();
    for (const p of worldMap.places) {
      if (!sceneIds.has(p.scene)) addWm(p.id, `Lieu « ${p.label} » → scène inexistante « ${p.scene} »`);
      // Cible RÉSOLUE via `placeServices` (source unique, `state/worldMap.ts`) — pas le seul catalogue
      // `lieux-services.json` : un POI peut aussi cibler le port/marché AUTOMATIQUES du lieu (`id`
      // `'port'`/`'marche'`), exactement ce que `CityHubScreen` résout à l'affichage (#360).
      const resolvedServiceIds = new Set(placeServices(p).map((s) => s.id));
      for (const poi of p.poi ?? []) {
        if (poiIds.has(poi.id)) addWm(poi.id, `POI « ${poi.id} » du lieu « ${p.label} » : id dupliqué`);
        poiIds.add(poi.id);
        const hasScene = poi.sceneId != null, hasService = poi.serviceKind != null;
        if (hasScene === hasService) addWm(poi.id, `POI « ${poi.label} » (lieu « ${p.label} ») : cible EXCLUSIVE scène XOR service requise`);
        if (hasScene && !sceneIds.has(poi.sceneId!)) addWm(poi.id, `POI « ${poi.label} » → scène inexistante « ${poi.sceneId} »`);
        if (hasService && !resolvedServiceIds.has(poi.serviceKind!)) addWm(poi.id, `POI « ${poi.label} » → service inconnu « ${poi.serviceKind} »`);
      }
    }
    for (const r of worldMap.routes) {
      for (const end of [r.a, r.b] as const) if (!placeIds.has(end)) addWm(r.id, `Route « ${r.id} » → lieu inexistant « ${end} »`);
      const amb = r.ambush;
      if (amb) {
        const target = project.find((s) => s.id === amb.scene);
        if (!target) addWm(r.id, `Route « ${r.id} » → scène d'embuscade inexistante « ${amb.scene} »`);
        else if (!target.encounters.some((e) => e.id === amb.encounter))
          addWm(r.id, `Route « ${r.id} » → rencontre d'embuscade inexistante « ${amb.encounter} » dans « ${amb.scene} »`);
      }
    }
    // DÉPART DU GROUPE d'une scène-DESTINATION. Le runtime replie toujours (`store.ts` : `startScene`
    // prend `findFreeTile` à défaut de `heroStart` ; `transitionTo` prend `pos`, puis le point d'arrivée
    // NOMMÉ, puis `heroStart`, puis `findFreeTile`) — d'où un `warn`, jamais une erreur. Ne sont
    // concernées que les scènes où l'on débarque SANS point d'arrivée nommé : un lieu qui déclare son
    // `entry` (`MapPlace.entry`) désigne déjà sa case, un POI de plan n'en porte aucun.
    const portesSansEntree = new Map<string, string>();
    for (const p of worldMap.places) {
      if (!p.entry) portesSansEntree.set(p.scene, `le lieu « ${p.label} »`);
      for (const poi of p.poi ?? [])
        if (poi.sceneId) portesSansEntree.set(poi.sceneId, `le point d'intérêt « ${poi.label} » du lieu « ${p.label} »`);
    }
    for (const [sceneId, porte] of portesSansEntree) {
      const cible = project.find((s) => s.id === sceneId);
      if (!cible || startOf(cible)) continue;
      out.push({
        level: 'warn', sceneId, scope: 'scene', refId: sceneId,
        message: `Aucun départ du groupe (heroStart) dans « ${cible.label} », où mène ${porte} sans point d'arrivée nommé — le jeu posera le groupe sur la première case libre venue. Pose un départ, ou nomme un point d'arrivée sur la porte.`,
      });
    }
  }
  const musicIds = new Set(allMusicDefs().map((d) => d.id));
  for (const s of project) {
    const dlgIds = new Set(s.dialogues.map((d) => d.id));
    const encIds = new Set(s.encounters.map((e) => e.id));
    const { w, h } = s.dimensions;
    const within = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
    const add = (
      level: Warning['level'],
      scope: Warning['scope'],
      refId: string | undefined,
      message: string,
      architectureRef?: ArchitectureWarningRef,
    ) => out.push({ level, sceneId: s.id, scope, refId, message, architectureRef });
    // Contexte de réfs PARTAGÉ pour cette scène : les `refs?` des handlers (state/combatEffects) le lisent
    // pour valider leurs réfs cassées (dialogue/rencontre/scène) et valeurs invalides (souffle de zone).
    const refCtx: EffectRefCtx = {
      sceneIds, dialogueIds: dlgIds, encounterIds: encIds,
      entityIds: new Set(s.entities.filter((e) => e.kind === 'personnage').map((e) => e.id)),
      npcSheet: (id) => sceneNpc(s, id),
      within,
    };
    const checkEffect = (eff: Effect, refId: string, scope: Warning['scope']) => {
      const refs = (EFFECT_HANDLERS[eff.type] as EffectHandler).refs;
      if (refs) for (const issue of refs(eff, refCtx)) add(issue.level, scope, refId, issue.message);
    };
    const dup = (
      ids: string[],
      scope: Warning['scope'],
      architectureRef?: (id: string) => ArchitectureWarningRef,
    ) => {
      const seen = new Set<string>();
      for (const id of ids) {
        if (seen.has(id)) add('error', scope, id, `Id dupliqué « ${id} »`, architectureRef?.(id));
        seen.add(id);
      }
    };

    for (const [slot, v] of Object.entries(s.music ?? {}))
      if (typeof v === 'string' && !musicIds.has(v)) add('warn', 'scene', undefined, `Musique (${slot === 'ambient' ? 'ambiance' : 'combat'}) inconnue au registre « ${v} »`);

    dup(s.entities.map((e) => e.id), 'entity');
    dup(s.triggers.map((t) => t.id), 'trigger');
    dup(s.dialogues.map((d) => d.id), 'dialogue');
    dup(s.encounters.map((e) => e.id), 'encounter');
    dup((s.effectZones ?? []).map((zone) => zone.id), 'scene');

    // Couches (`Scene.layers`) : ids d'étage valides pour rattacher les entités posées en hauteur.
    const layerZs = new Set(s.layers.map((l) => l.z));
    const realFloor = realFloorAt(s); // plancher RÉEL par étage — la vérité partagée avec la dérivation
    for (const e of s.entities) {
      if (e.dialogueId && !dlgIds.has(e.dialogueId)) add('error', 'entity', e.id, `${e.label ?? e.id} → dialogue inexistant « ${e.dialogueId} »`);
      if (!within(e.pos.x, e.pos.y)) add('warn', 'entity', e.id, `${e.label ?? e.id} hors carte (${e.pos.x},${e.pos.y})`);
      if (e.z && !layerZs.has(e.z)) add('warn', 'entity', e.id, `${e.label ?? e.id} sur étage ${e.z} inexistant`);
      // Un décor VOLUMIQUE ne prend qu'un cap CARDINAL : `data/props.types.ts` `capVolumique`.
      // L'émetteur unique (`gameIso/builders/props.ts`) le refuse en dur — c'est ici que l'auteur l'apprend.
      if (e.kind === 'prop' && !capDecorAdmis(refEstVolumique(e.ref), e.facing))
        add('error', 'entity', e.id, `${e.label ?? e.id} : décor volumique « ${e.ref} » au cap ${e.facing} — un décor volumique ne prend qu'un cap cardinal (N/E/S/O)`);
      // TYPE NOMMÉ, tout `kind` (`typeNonNomme`, source unique avec le schéma, #877, #1882) — c'est ICI
      // que l'auteur l'apprend d'une scène VIVANTE de l'éditeur, qui ne repasse pas par le parse.
      const typeAbsent = typeNonNomme(e);
      if (typeAbsent) add('error', 'entity', e.id, `${e.label ?? e.id} : ${typeAbsent}`);
      // RÉF de décor : résolue au catalogue (#877). Sans type résolu, le rendu pose la silhouette
      // d'erreur (`missingPropSvg`) : un décor se DIT, il ne se remplace jamais.
      if (e.kind === 'prop' && e.ref !== undefined && !findPropById(e.ref))
        add('error', 'entity', e.id, `${e.label ?? e.id} → décor inexistant « ${e.ref} »`);
      // RÉF de personnage : la résolution est CELLE du spawn (`refEntiteResolue`, `data/index.ts`), qu'un
      // autre porteur la côtoie ou non (#1882) ; la réf vide est dite par `typeNonNomme`.
      if (e.kind === 'personnage' && e.ref && !refEntiteResolue(e.ref))
        add('error', 'entity', e.id, `${e.label ?? e.id} → créature inexistante « ${e.ref} »`);
      if (e.statblock?.char)
        for (const k of Object.keys(e.statblock.char))
          if (!VALID_STATBLOCK_CHAR_KEYS.has(k)) add('error', 'entity', e.id, `${e.label ?? e.id} : statblock.char porte une clé étrangère « ${k} » (format canonique = CharKey slug plein, cf. #311)`);
    }
    // ASSISE AUTHORÉE (`Scene.seatAssignments`) : les règles vivent dans `state/seating`, source
    // unique partagée avec le compilateur d'authoring (`mapSpec.buildScene`, fail-fast).
    for (const defect of seatAssignmentDefects(s)) add('error', 'entity', defect.at, defect.message);
    // Les familles qui MARCHENT (départ, connectivité, empreinte au sol) n'ont de sujet qu'à l'échelle du
    // PAS : à l'échelle MER (`isMerScene`, source unique — case ≥ 4 m, navire-unité), la grille est de l'eau
    // de bout en bout et tout le monde y flotte à bord. Mesuré sur les paquets livrés : les 3 scènes
    // d'abordage (10 m/case, 336 cases d'`eau`) rendaient 31 avertissements « non marchable », tous faux.
    const echelleDuPas = !isMerScene(s);
    // CONNECTIVITÉ À PIED depuis le départ du groupe (`state/mapQC`, harnais #778 : la même marche que
    // `walkNeighbors` au jeu). Une pièce nommée qu'aucun chemin ne rejoint est du contenu écrit pour rien.
    const start = startOf(s);
    const startEntity = s.entities.find((e) => e.kind === 'heroStart');
    if (start && startEntity && echelleDuPas) {
      if (!isWalkable(s, start.x, start.y, start.z)) {
        add('warn', 'entity', startEntity.id, `Départ du groupe en (${start.x},${start.y}) à l'étage ${start.z} : la case n'est pas marchable — pose-le sur un sol praticable, sinon le groupe apparaît dans le décor.`);
      } else {
        // Zones évaluées SEULEMENT depuis un départ praticable : depuis une case murée, la marche ne
        // rejoint rien et TOUTES les pièces se signaleraient — un seul défaut, pas N faux.
        for (const zone of unreachableDescriptiveZones(s, start))
          add('warn', 'scene', zone.id, `Pièce « ${zone.label ?? zone.id} » inatteignable à pied depuis le départ du groupe (${start.x},${start.y}, étage ${start.z}) — perce une porte, ou relie-la par un escalier ou une rampe.`);
      }
    }
    const validRect = (rect: { x: number; y: number; w: number; h: number }) =>
      Number.isInteger(rect.x) && Number.isInteger(rect.y) && Number.isInteger(rect.w) && Number.isInteger(rect.h)
      && rect.w > 0 && rect.h > 0 && within(rect.x, rect.y) && within(rect.x + rect.w - 1, rect.y + rect.h - 1);
    const zoneInterior = (id: string) => s.effectZones?.find((zone) => zone.id === id && zone.presentation === 'interior');
    /** `revealBelow` : une TOITURE révèle par cutaway les pièces qu'elle COUVRE, potentiellement à
     *  un étage inférieur au sien (`architectureVisibility.ts` ne compare aucun z — seule
     *  l'appartenance de la zone à l'ensemble `roomZoneIds` compte) — jamais au-dessus (une toiture
     *  ne découvre pas ce qu'il y a au-dessus d'elle). Un ÉTAGE (`ArchitectureStorey.roomZoneIds`)
     *  n'a AUCUN consommateur de rendu (seul `mapSpec.ts` le recopie) : sa règle reste STRICTE
     *  (`revealBelow` par défaut `false`, comme les façades) — une zone d'un autre étage doit
     *  échouer, l'authoring dérive `storey.roomZoneIds` des SEULES zones de son propre étage
     *  (`floorplan.ts`). */
    const checkZoneRefs = (
      ids: string[],
      z: number,
      refId: string,
      architectureRef?: ArchitectureWarningRef,
      revealBelow = false,
    ) => {
      for (const id of ids) {
        const zone = zoneInterior(id);
        if (!zone) { add('error', 'architecture', refId, `Architecture « ${refId} » → zone intérieure « ${id} » inexistante`, architectureRef); continue; }
        const zoneZ = zone.z ?? 0;
        if (revealBelow ? zoneZ <= z : zoneZ === z) continue;
        const message = revealBelow
          ? `Architecture « ${refId} » → zone intérieure « ${id} » à l’étage ${zoneZ}, au-dessus de la section (étage ${z})`
          : `Architecture « ${refId} » → zone intérieure « ${id} » inexistante à l’étage ${z}`;
        add('error', 'architecture', refId, message, architectureRef);
      }
    };
    const checkEdge = (
      edge: { x: number; y: number; side: string; z?: number },
      z: number,
      refId: string,
      architectureRef: ArchitectureWarningRef,
    ) => {
      if (edge.side !== 'N' && edge.side !== 'E') add('error', 'architecture', refId, `Architecture « ${refId} » : arête non canonique « ${edge.side} »`, architectureRef);
      if (!Number.isInteger(edge.x) || !Number.isInteger(edge.y) || !within(edge.x, edge.y)) add('error', 'architecture', refId, `Architecture « ${refId} » : arête hors carte`, architectureRef);
      if (edge.z !== undefined && edge.z !== z) add('error', 'architecture', refId, `Architecture « ${refId} » : arête sur étage ${edge.z} différent de la section ${z}`, architectureRef);
    };
    dup((s.architecture ?? []).map((body) => body.id), 'architecture', (id) => ({ type: 'architectureBody', id }));
    const couvertures = roofCoveringIds();
    for (const body of s.architecture ?? []) {
      dup(body.storeys.map((storey) => storey.id), 'architecture', (id) => ({ type: 'architectureStorey', bodyId: body.id, id }));
      dup(body.facades.map((facade) => facade.id), 'architecture', (id) => ({ type: 'facadeSection', bodyId: body.id, id }));
      dup(body.masses.map((mass) => mass.id), 'architecture', (id) => ({ type: 'roofSection', bodyId: body.id, id }));
      // Intention de toiture (`RoofDefaults`) : un appentis sans côté d'égout ne se devine pas — la
      // dérivation ne pose alors AUCUN `eaveSide` et chaque masse produite est invalide. Nommé sur le
      // CORPS, là où le réglage se fait.
      if (body.roofDefaults?.profile === 'shed' && !body.roofDefaults.eaveSide)
        add('error', 'architecture', body.id, `Corps « ${body.label ?? body.id} » : toiture en appentis sans côté d’égout — déclare le versant bas (N/E/S/O)`, { type: 'architectureBody', id: body.id });
      for (const storey of body.storeys) {
        const storeyRef: ArchitectureWarningRef = { type: 'architectureStorey', bodyId: body.id, id: storey.id };
        if (storey.z !== 0 && !layerZs.has(storey.z)) add('error', 'architecture', storey.id, `Étage ${storey.z} inexistant`, storeyRef);
        dup(storey.parts.map((part) => part.id), 'architecture', (id) => ({
          type: 'architecturePart',
          bodyId: body.id,
          storeyId: storey.id,
          id,
        }));
        for (const part of storey.parts) {
          const partRef: ArchitectureWarningRef = { type: 'architecturePart', bodyId: body.id, storeyId: storey.id, id: part.id };
          if (!validRect(part.foot)) add('error', 'architecture', part.id, `Partie « ${part.id} » hors carte ou d’emprise invalide`, partRef);
        }
        checkZoneRefs(storey.roomZoneIds, storey.z, storey.id, storeyRef);
      }
      for (const facade of body.facades) {
        const facadeRef: ArchitectureWarningRef = { type: 'facadeSection', bodyId: body.id, id: facade.id };
        if (facade.z !== 0 && !layerZs.has(facade.z)) add('error', 'architecture', facade.id, `Étage ${facade.z} inexistant`, facadeRef);
        for (const edge of facade.edges) checkEdge(edge, facade.z, facade.id, facadeRef);
        checkZoneRefs(facade.roomZoneIds ?? [], facade.z, facade.id, facadeRef);
        dup((facade.features ?? []).map((feature) => feature.id), 'architecture', () => facadeRef);
        for (const feature of facade.features ?? []) {
          checkEdge(feature.edge, facade.z, feature.id, facadeRef);
          if (feature.offset !== undefined && (!Number.isFinite(feature.offset) || feature.offset < 0 || feature.offset > 1))
            add('error', 'architecture', feature.id, `Feature « ${feature.id} » : offset hors 0-1`, facadeRef);
          if (feature.width !== undefined && (!Number.isFinite(feature.width) || feature.width <= 0))
            add('error', 'architecture', feature.id, `Feature « ${feature.id} » : largeur invalide`, facadeRef);
        }
      }
      for (const mass of body.masses) {
        const massRef: ArchitectureWarningRef = { type: 'roofSection', bodyId: body.id, id: mass.id };
        if (mass.z !== 0 && !layerZs.has(mass.z)) add('error', 'architecture', mass.id, `Étage ${mass.z} inexistant`, massRef);
        if (!Array.isArray(mass.footprint) || mass.footprint.length === 0)
          add('error', 'architecture', mass.id, `Masse « ${mass.id} » sans partie`, massRef);
        for (const part of mass.footprint ?? [])
          if (!validRect(part)) add('error', 'architecture', mass.id, `Masse « ${mass.id} » hors carte ou d’emprise invalide`, massRef);
        if (!['gable', 'hip', 'shed', 'flat'].includes(mass.profile)) add('error', 'architecture', mass.id, `Masse « ${mass.id} » : profil invalide`, massRef);
        if (mass.ridge !== undefined && mass.ridge !== 'x' && mass.ridge !== 'y') add('error', 'architecture', mass.id, `Masse « ${mass.id} » : faîtage invalide`, massRef);
        if (mass.profile === 'shed' && !mass.eaveSide) add('error', 'architecture', mass.id, `Masse « ${mass.id} » : profil appentis sans côté d’égout`, massRef);
        if (!couvertures.has(mass.material))
          add('error', 'architecture', mass.id, `Masse « ${mass.id} » : « ${mass.material} » n’est pas une couverture de toit`, massRef);
        if (!Number.isInteger(mass.levels) || mass.levels < 1) add('error', 'architecture', mass.id, `Masse « ${mass.id} » : niveaux invalides`, massRef);
        if (!Number.isFinite(mass.pitchDeg) || mass.pitchDeg < PENTE_TOIT_DEG.min || mass.pitchDeg > PENTE_TOIT_DEG.max)
          add('error', 'architecture', mass.id, `Masse « ${mass.id} » : pente hors plage`, massRef);
        // INVARIANT d'ALTITUDE — les deux encodages de la même hauteur (l'INDEX d'étage `z` et la COTE
        // métrique que `layer.height` porte, lue par `heightAt`) ne peuvent pas diverger sans le dire.
        // L'égout dérivé (`gameIso/builders/roofs.resolveMass`) et les murs qui le portent
        // (`buildWalls`) lisent tous deux la COTE : le relief est donc libre — une masse sur une butte,
        // une terrasse, un quai surélevé est une carte légitime. Ce qui reste falsifiable est
        // l'EMPILEMENT : le plancher de l'étage `z` doit dominer celui de l'étage `z-1` d'au moins la
        // hauteur qu'un étage REPRÉSENTE (`METRES_PER_LEVEL`, `state/relief`), sinon ce qui remplit
        // l'étage du dessous traverse le plancher du dessus — et le toit posé dessus descend dedans.
        // Cas nommé par la garde : une couche d'étage laissée SANS cote (`layer.height` absent) — ses
        // planchers, ses murs et sa toiture retombent tous au rez sans un mot.
        // L'invariant ne porte QUE là où l'étage a un PLANCHER RÉEL (`realFloorAt`, la même vérité que la
        // dérivation et `validateBuildingMasses`) : une masse couvre aussi les colonnes OUVERTES qu'elle
        // adopte — trémie de volée, puits de rampe — où il n'y a rien à empiler, et où la case du dessous
        // rejoint précisément la cote du dessus : c'est par là qu'on MONTE.
        if (mass.z > 0 && layerZs.has(mass.z - 1)) {
          const plancherHaut = realFloor(mass.z);
          const tropBas = (mass.footprint ?? []).flatMap((rect) => {
            const out: { x: number; y: number; h: number; sous: number }[] = [];
            for (let y = rect.y; y < rect.y + rect.h; y++)
              for (let x = rect.x; x < rect.x + rect.w; x++) {
                if (!plancherHaut.has(`${x},${y}`)) continue;
                const h = heightAt(s, x, y, mass.z);
                const sous = heightAt(s, x, y, mass.z - 1);
                if (h - sous < METRES_PER_LEVEL - 1e-6) out.push({ x, y, h, sous });
              }
            return out;
          });
          if (tropBas.length) {
            const { x, y, h, sous } = tropBas[0];
            add('error', 'architecture', mass.id, `Masse « ${mass.id} » : plancher (${x},${y}) à ${h} m alors que l’étage ${mass.z - 1} y est coté ${sous} m — un étage se pose sur le dessus de celui du dessous (${METRES_PER_LEVEL} m) ; côte la couche ${mass.z} ou change l’étage de la masse`, massRef);
          }
        }
      }
    }
    /** Bornes des fenêtres horaires d'une Condition (trigger `when`, choix `when`, nœud `si`). */
    const checkCondTimes = (cond: Condition, refId: string, scope: Warning['scope']) =>
      walkConditionTimes(cond, (tc) => {
        for (const [k, v] of [['afterHour', tc.afterHour], ['beforeHour', tc.beforeHour]] as const)
          if (v != null && (v < 0 || v > 23)) add('error', scope, refId, `Fenêtre horaire « ${refId} » : ${k} ${v} hors 0-23`);
        for (const [k, v] of [['afterMinute', tc.afterMinute], ['beforeMinute', tc.beforeMinute]] as const)
          if (v != null && (v < 0 || v > 59)) add('error', scope, refId, `Fenêtre horaire « ${refId} » : ${k} ${v} hors 0-59`);
      });
    /** Parcours RÉCURSIF d'un Flow (branches `if`/`test`, et le `flow` imbriqué d'un `delayedEffect`) :
     *  effets référencés + bornes des conditions horaires + ENJEU des jets. ENVELOPPÉ : un Flow corrompu
     *  (nœud manquant/réf pendante — document ANCIEN qu'un `normalizeScene` ne peut pas tout réparer sans
     *  inventer de donnée) rapporte un Warning `error` au lieu de faire tomber la validation de TOUTE la
     *  scène — chaque flow est indépendant, un flow cassé ne masque pas les autres.
     *
     *  FLOWS PORTÉS par une feuille : trouvés PAR LA FORME (`carriedFlows`, `engine/flowCore`) — l'échéance
     *  d'un `delayedEffect`, la récompense d'une `petitePriere`, et tout champ `Flow` d'un effet à écrire.
     *  Une liste nominative serait périmée au prochain effet porteur, et ce qui échappe à ce parcours
     *  échappe à TOUTE validation d'arbre (réfs cassées et jets muets compris).
     *
     *  ENJEU (#1117, arbitrage user 2026-08-12 / #1262) : un nœud `test` LANCE un jet, et son enjeu
     *  s'AUTHORE dans le document (`FlowTest.stake`, champ de l'éditeur de Flow) — la validation le
     *  refuse muet. C'est la porte que le catalogue app-owned ne peut pas servir : ce qu'un jet de scène
     *  met en jeu appartient à la scène. Le critère est celui du RUNTIME (`stakeSpeaks`, `src/data`) :
     *  un enjeu authoré BLANC est un enjeu absent — sans ce partage, l'authoring déclarerait bon un
     *  document que `resolveStake` refuse d'afficher. */
    const checkFlow = (flow: Flow, refId: string, scope: Warning['scope']) => {
      try {
        walkFlow(flow, (node) => {
          if (node.kind === 'do') {
            checkEffect(node.effect, refId, scope);
            for (const porte of carriedFlows(node.effect)) checkFlow(porte, refId, scope);
          } else if (node.kind === 'if') checkCondTimes(node.cond, refId, scope);
          else if (node.kind === 'test' && !stakeSpeaks(node.test.stake)) {
            add('error', scope, refId, `Jet « ${node.test.label ?? node.test.skill ?? node.test.characteristic ?? 'Test'} » sans enjeu : dites ce que ce jet met en jeu (champ Enjeu du bloc Test)`);
          }
        });
      } catch {
        add('error', scope, refId, `Flow « ${refId} » corrompu (nœud invalide/réf pendante)`);
      }
    };

    for (const t of s.triggers) {
      if (!within(t.rect.x, t.rect.y) || !within(t.rect.x + t.rect.w - 1, t.rect.y + t.rect.h - 1)) add('warn', 'trigger', t.id, `Zone « ${t.id} » déborde de la carte`);
      if (t.when) checkCondTimes(t.when, t.id, 'trigger');
      checkFlow(t.flow, t.id, 'trigger');
    }
    // Flow d'INTERACTION d'une entité (fouiller, crocheter, examiner) : une PORTE de Flow authoré au
    // même titre qu'une zone ou un choix de dialogue — donc validée par le même parcours (réfs d'effets,
    // fenêtres horaires, enjeu des jets). Sans elle, la moitié des jets d'une scène échapperait à la garde.
    for (const e of s.entities) for (const a of e.usable?.actions ?? []) checkFlow(a.flow, `${e.id}›${a.id}`, 'entity');
    for (const d of s.dialogues) {
      const nodeIds = new Set(d.nodes.map((n) => n.id));
      if (!nodeIds.has(d.start)) add('error', 'dialogue', d.id, `Dialogue « ${d.id} » : départ « ${d.start} » inexistant`);
      for (const n of d.nodes)
        for (const c of n.choices) {
          if (c.next && !nodeIds.has(c.next)) add('error', 'dialogue', d.id, `Dialogue « ${d.id} » : choix → « ${c.next} » inexistant`);
          if (c.when) checkCondTimes(c.when, d.id, 'dialogue');
          if (c.flow) checkFlow(c.flow, d.id, 'dialogue');
        }
    }
    const entById = new Map(s.entities.map((e) => [e.id, e] as const));
    for (const e of s.encounters) {
      checkFlow(e.onVictory ?? EMPTY_FLOW, e.id, 'encounter'); // onVictory est déjà un Flow (delayedEffect.flow récursé)
      // onVictory est APPLIQUÉ À PLAT à la victoire (finishVictory → flattenFlow), pour préserver la
      // déférence transition/dialogue → « Continuer ». flattenFlow lève sur un nœud interactif → on
      // l'interdit ici (les `if` conditionnels restent permis, eux, car flattenFlow les évalue).
      if (e.onVictory && flowHasTest(e.onVictory)) add('error', 'encounter', e.id, `Rencontre « ${e.id} » : onVictory ne peut pas contenir de jet interactif (Test/Choix) — il est appliqué à plat à la victoire`);
      for (const m of e.members ?? []) {
        const membre = entById.get(m.entityId);
        if (!membre) add('error', 'encounter', e.id, `Rencontre « ${e.id} » → membre inexistant « ${m.entityId} »`);
        if (m.ridesEntityId && !entById.has(m.ridesEntityId)) add('error', 'encounter', e.id, `Rencontre « ${e.id} » → monture inexistante « ${m.ridesEntityId} »`);
        if (!membre) continue;
        // EMPREINTE du combattant (`state/footprint`, la même géométrie qu'au spawn) : une Grande 2×2 posée
        // au ras d'un mur déborde sur des cases qui ne l'accueillent pas — le placement se corrige à
        // l'authoring, pas au jeu. L'ancre seule ne suffit donc pas à juger la pose.
        const n = sizeFootprint(entitySize(membre));
        const z = membre.z ?? 0;
        const tuiles = footprintTiles(membre.pos, n);
        const nom = membre.label ?? membre.ref ?? membre.id;
        const dehors = tuiles.filter((t) => !within(t.x, t.y));
        if (dehors.length)
          add('warn', 'entity', membre.id, `${nom} : empreinte ${n}×${n} débordant hors de la carte — ${dehors.map((t) => `(${t.x},${t.y})`).join(' ')}.`);
        const barrees = echelleDuPas ? tuiles.filter((t) => within(t.x, t.y) && !isWalkable(s, t.x, t.y, z)) : [];
        if (barrees.length)
          add('warn', 'entity', membre.id, `${nom} : empreinte ${n}×${n} posée sur ${barrees.length} case(s) non marchable(s) (mur, eau ou décor) — ${barrees.map((t) => `(${t.x},${t.y})`).join(' ')} à l'étage ${z}.`);
      }
    }
    // Défauts de PLAN (`state/planDefects`, la MÊME détection que `npm run map:check`) : l'auteur les
    // corrige dans l'éditeur, pas en ligne de commande — chaque défaut porte sa famille et l'endroit.
    for (const d of scenePlanDefects(s))
      out.push({
        level: 'warn',
        sceneId: s.id,
        scope: 'plan',
        refId: d.at.kind === 'zone' ? d.at.zoneId : undefined,
        plan: { family: d.family, at: d.at },
        message: d.message,
      });
  }
  return out;
}
