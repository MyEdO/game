/**
 * Inspecteur v2 — volet droit DOCKÉ (fini la modale du POC qui masquait le canvas) :
 * la sélection s'édite EN PLACE, en sections repliables `.fold`, pendant que la carte reste
 * visible. Rien de sélectionné → PROPRIÉTÉS DE LA SCÈNE (identité, dimensions, ambiance,
 * musique, repos, points d'entrée) + liste filtrable du contenu (sélection au clic).
 * Composant de PRÉSENTATION : la scène et la sélection vivent dans Editor.
 */
import { useEffect, useRef, useState, type ComponentProps, type ReactNode, type RefObject } from 'react';
import {
  Scene, SceneEntity, Trigger, SceneEffectZone, WallSeg, type ActionAuthoree,
  type ArchitecturePart, type ArchitectureStorey, type FacadeSection, type BuildingMass, type RoofDefaults,
  type ArchitectureRect, type SceneStationAnchor, type ReliefDefaults, isDescriptiveZone, sceneMetresPerTile,
} from '../../state/scene';
import { PARTS_RELIEF } from '../../data/materials.types';
import { NumberField } from '../NumberField';
import { TIME_COST } from '../../engine/timeCost';
import { sceneZoneTiles, zoneAreaTiles } from '../../state/zones';
import type { WorldMap } from '../../state/worldMap';
import type { NarratifBlock } from '../../state/campaignNarratif';
import type { Settlement } from '../../engine/disponibilite';
import { hashSeed } from '../../engine/dice';
import { SCENE_ANIMS } from '../../gameIso/sceneAnims';
import { tokenBodyKind } from '../../gameIso/tokenBodyKind';
import { creatureSpeciesOptions } from '../../gameIso/rig/creatures';
import { PROPS } from '../../gameIso/catalog/decor';
import { buildingsMeta } from '../../state/buildings';
import { FACADE_APPEARANCE_IDS } from '../../gameIso/catalog/facades';
import { MERCHANTS } from '../../state/merchants/index';
import { TAVERN_GAMES } from '../../engine/tavernGame';
import { allMusicDefs } from '../../audio/music';
import { findCreatureById, creatureLabel, lightLevels, lightTones, findVehicleById, findPropById, matieresCouvrantes, matieresDe, structureAppearances, refEstVolumique, siegeEngines } from '../../data';
import { poseToitureDeCorps, rederiveRoofMasses, renameActionAuthoree, toitureEffective, TypeNonNomme } from '../../state/sceneEdit';
import { activitiesFor } from '../../engine/activities';
import { hintDeValeur, libelleDeValeur, valeursDe } from '../../data/schemas/grammaire/meta';
import { entityKindSchema, facadeFeatureKindSchema, roofProfileSchema, sceneWeatherSchema } from '../../data/schemas/defs-scenes/scene';

/** Cibles d'une ANCRE de bataille (`Scene.stations[].sceneId`) : les Scènes de Round du catalogue
 *  d'Activités (contexte `bataille-round`) — le SEUL espace d'ids que le consommateur sait résoudre
 *  (`state/stations.battleScenesToStations` → `battleSceneById`). Les Scènes du PROJET sont un autre
 *  espace : une ancre qui en nomme une est ignorée sans un mot (#841). */
const battleAnchorTargets = (): { id: string; label: string }[] =>
  activitiesFor('bataille-round').map((def) => ({ id: def.id, label: def.label }));
import { MonsterPartsFields } from './MonsterPartsFields';
import { effectCtxOf } from './EffectList';
import { GameOpEditor } from './GameOpEditor';
import { FlowEditor, TestFields } from './FlowEditor';
import { actionsDe, ACTION_FOUILLER } from '../../state/usable';
import { EMPTY_FLOW } from '../../state/flow';
import { StatblockEditor, emptyStatblock } from './StatblockEditor';
import { CreatureProfile, OptionalTraitsPicker, SpellsField } from './OptionalTraitsPicker';
import { SeatAssignmentsField } from './SeatAssignmentsField';
import { Sel, type Tool, changePropRef, deleteSel, renameEntry, renameEffectZone, addMember, removeMember, patchMember, effectZoneRect, effectZoneArea, setEffectZoneArea, clearEffectZoneCarve, flowEffectCount, setPosteCrew, setPosteSide, setPosteEngine, editEntity, editEntityCombat, patchWall, setMetresPerTile, setAmbientLight, setNorthDeg, setEnvironment, setSceneFlags } from './editorState';
import { scrollElementIntoPort } from './useEditorView';
import type { FireArc, StructureData, NavalTraitRef } from '../../engine/types';
import { DIFFICULTY_LABELS } from '../../engine/types';
import { isWallEdgeStructure, isDoorEdgeStructure } from '../../engine/structures';
import { RefField } from '../compendium/RefField';
import { SearchFilterField, filterByLabel } from '../SearchFilterField';
import { Icon } from '../Icon';
import type { IconIdInput } from '../icons';
import { nextEntityId } from '../../state/entityId';
import { ListRow } from '../ListRow';
import { OptionChooser } from '../OptionChooser';
import { LayerField, LayerChip, sceneLayerZs } from './LayerField';
import { estCardinal, type Dir8 } from '../../state/dir8';
import { propFootTiles } from '../../state/footprint';
import { Row, Stack } from '../Layout';

/** Caps OFFERTS au sélecteur d'orientation, dans l'ordre horaire de `DIR8_ORDER` : les huit pour une
 *  entité ordinaire, les quatre CARDINAUX pour un décor volumique (`Dir4`, #1680 ligne 3). Un seul
 *  couple id→libellé, jamais deux listes de `<option>` recopiées. */
const CAPS_OFFERTS: readonly (readonly [Dir8, string])[] = [
  ['N', 'Nord'], ['NE', 'Nord-Est'], ['E', 'Est'], ['SE', 'Sud-Est'],
  ['S', 'Sud'], ['SO', 'Sud-Ouest'], ['O', 'Ouest'], ['NO', 'Nord-Ouest'],
];
const CAPS_OFFERTS_CARDINAUX = CAPS_OFFERTS.filter(([cap]) => estCardinal(cap));

/** Valeur que porte le sélecteur de décor quand l'instance ne NOMME aucun type : SENTINELLE de
 *  FORMULAIRE — un `<select>` doit avoir une valeur, et sans valeur explicite le DOM élit la première
 *  option. Ce n'est PAS un id de repli : aucune entrée de `props.json` ne la porte, son option n'est
 *  pas élisible, et rien ne l'écrit jamais sur une entité (#877). */
const REF_DECOR_NON_NOMMEE = '';

/** Section repliable de l'inspecteur (primitive .fold). */
function Fold({ title, open, children }: { title: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details className="fold insp-fold" open={open}>
      <summary>
        <span className="fold-title">{title}</span>
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}

function RoomZoneSelect({
  zones,
  value,
  onChange,
}: {
  zones: SceneEffectZone[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <label className="ed-field">
      Pièces révélées
      <select
        multiple
        size={Math.max(2, Math.min(6, zones.length))}
        value={value}
        onChange={(event) => onChange(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}
      >
        {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.label}</option>)}
      </select>
    </label>
  );
}

/** Sélecteur de musique de scène (ambiance/combat) : Auto (contexte) / Aucune / pistes du registre. */
function MusicSelect({ label, value, onChange }: { label: string; value: string | null | undefined; onChange: (v: string | null | undefined) => void }) {
  return (
    <label className="ed-field">
      {label}
      <select
        value={value === undefined ? '__auto' : value === null ? '__silence' : value}
        onChange={(e) => onChange(e.target.value === '__auto' ? undefined : e.target.value === '__silence' ? null : e.target.value)}
      >
        <option value="__auto">Automatique</option>
        <option value="__silence">Aucune</option>
        {allMusicDefs().map((d) => (
          <option key={d.id} value={d.id}>{d.id.replace(/^musique-/, '')}</option>
        ))}
      </select>
    </label>
  );
}

const ENT_ICON: Record<string, IconIdInput> = { heroStart: 'map-tool/start-flag', personnage: 'map-tool/npc', prop: 'map-tool/prop' };
/** Icône d'entité — un emplacement de siège (entité portant un poste) prime sur l'icône de kind. */
const entIcon = (ent: SceneEntity): JSX.Element => (
  ent.postes?.length ? <Icon id="scenario/siege" size="sm" /> : ENT_ICON[ent.kind] ? <Icon id={ENT_ICON[ent.kind]} size="sm" /> : <>•</>
);

/** Arcs de tir d'un créneau directionnel (FireArc), libellés terrestres (relatifs au facing du chef de pièce). */
const FIRE_ARCS: { side: FireArc; label: string }[] = [
  { side: 'proue', label: 'Avant (proue)' },
  { side: 'tribord', label: 'Droite (tribord)' },
  { side: 'poupe', label: 'Arrière (poupe)' },
  { side: 'babord', label: 'Gauche (bâbord)' },
];

export function Inspector({
  scene,
  otherScenes,
  worldMap,
  setScene,
  sel,
  setSel,
  enemyCreatures,
  openLogic,
  resizeScene,
  narratif,
  tool,
  armZoneTiles,
  zoneFocusKey,
}: {
  scene: Scene;
  otherScenes: Scene[];
  /** Carte du monde du projet (id + label des lieux) pour `openPort` — absente ⇒ fallback texte. */
  worldMap: WorldMap | null;
  setScene: (s: Scene) => void;
  sel: Sel;
  setSel: (s: Sel) => void;
  enemyCreatures: { id: string; label: string }[];
  /** Ouvre le panneau Logique sur un onglet (+ élément). */
  openLogic: (tab: 'triggers' | 'dialogues' | 'encounters', id?: string) => void;
  resizeScene: (w: number, h: number) => void;
  /** Bloc Narratif du PROJET (#671) — source des presets PNJ proposés au picker de l'entité. */
  narratif: NarratifBlock;
  /** Outil actif de la carte — dit si le pinceau d'emprise est armé sur la zone sélectionnée. */
  tool: Tool;
  /** Arme le pinceau d'emprise sur une zone (id STABLE) et allume son calque : l'emprise se peint
   *  SUR la carte, au geste (appui + glissé). */
  armZoneTiles: (zoneId: string, paint: 'add' | 'remove') => void;
  /** Clé du défaut de plan de ZONE mis en évidence (`null` = aucun) : son remède, le pinceau
   *  d'emprise, est amené dans le champ du panneau à CHAQUE changement de clé. */
  zoneFocusKey: string | null;
}) {
  const ent = sel?.type === 'entity' ? scene.entities.find((e) => e.id === sel.id) ?? null : null;
  /** Le panneau lui-même : conteneur DÉFILABLE (`overflow: auto`) dans lequel un bloc se ramène. */
  const panelRef = useRef<HTMLElement>(null);
  const selT = sel?.type === 'trigger' ? scene.triggers.find((t) => t.id === sel.id) ?? null : null;
  const zone = sel?.type === 'restZone' ? scene.restZones?.[sel.idx] ?? null : null;
  const efz = sel?.type === 'effectZone' ? scene.effectZones?.[sel.idx] ?? null : null;
  const setEfz = (z: SceneEffectZone) => {
    if (sel?.type !== 'effectZone') return;
    setScene({ ...scene, effectZones: (scene.effectZones ?? []).map((x, i) => (i === sel.idx ? z : x)) });
  };
  const entry = sel?.type === 'entry' ? scene.entryPoints?.[sel.id] ?? null : null;
  const selW = sel?.type === 'wall' ? scene.walls?.find((w) => w.x === sel.x && w.y === sel.y && w.side === sel.side && (w.z ?? 0) === sel.z) ?? null : null;
  const architectureBody = sel && (
    sel.type === 'architectureBody'
    || sel.type === 'architectureStorey'
    || sel.type === 'architecturePart'
    || sel.type === 'facadeSection'
    || sel.type === 'roofSection'
  )
    ? scene.architecture?.find((body) => body.id === (sel.type === 'architectureBody' ? sel.id : sel.bodyId)) ?? null
    : null;
  const architectureStorey = sel?.type === 'architectureStorey' || sel?.type === 'architecturePart'
    ? architectureBody?.storeys.find((storey) => storey.id === (sel.type === 'architecturePart' ? sel.storeyId : sel.id)) ?? null
    : null;
  const architecturePart = sel?.type === 'architecturePart'
    ? architectureStorey?.parts.find((part) => part.id === sel.id) ?? null
    : null;
  const facadeSection = sel?.type === 'facadeSection'
    ? architectureBody?.facades.find((facade) => facade.id === sel.id) ?? null
    : null;
  const roofSection = sel?.type === 'roofSection'
    ? architectureBody?.masses.find((mass) => mass.id === sel.id) ?? null
    : null;
  const selectedArchitectureZ = architectureStorey?.z ?? facadeSection?.z ?? roofSection?.z;
  const roomZones = (scene.effectZones ?? []).filter((zone) =>
    zone.presentation === 'interior'
    && isDescriptiveZone(zone)
    && selectedArchitectureZ !== undefined
    && (zone.z ?? 0) === selectedArchitectureZ);
  const patchSelW = (patch: Partial<WallSeg>) => {
    if (sel?.type !== 'wall') return;
    setScene(patchWall(scene, sel.x, sel.y, sel.side, sel.z, patch));
  };

  // Toute écriture d'entité de l'inspecteur (libellé, orientation, étage, ref, apparence, statblock…)
  // passe par le seam d'assise : tourner ou monter d'un étage un meuble attablé recale ou lève ses
  // places dans la MÊME mutation. Aucun `entities:` en direct ici.
  // Un patch qui retirerait le type de l'entité (`TypeNonNomme`, #1882) est REFUSÉ et dit à l'auteur.
  const [refusPatch, setRefusPatch] = useState<{ id: string; message: string } | null>(null);
  const updateSel = (patch: Partial<SceneEntity>) => {
    if (!ent) return;
    try {
      setScene(editEntity(scene, ent.id, patch));
      setRefusPatch(null);
    } catch (err) {
      if (!(err instanceof TypeNonNomme)) throw err;
      setRefusPatch({ id: ent.id, message: err.message });
    }
  };
  const updateSelCombat = (patch: Partial<NonNullable<SceneEntity['combat']>>) => {
    if (!ent) return;
    setScene(editEntityCombat(scene, ent.id, patch));
  };
  const updateSelT = (patch: Partial<Trigger>) =>
    setScene({ ...scene, triggers: scene.triggers.map((t) => (selT && t.id === selT.id ? { ...t, ...patch } : t)) });
  const updateZone = (patch: Partial<NonNullable<Scene['restZones']>[number]>) => {
    if (sel?.type !== 'restZone') return;
    setScene({ ...scene, restZones: (scene.restZones ?? []).map((z, i) => (i === sel.idx ? { ...z, ...patch } : z)) });
  };
  type Body = NonNullable<Scene['architecture']>[number];
  const sceneWithBody = (update: (body: Body) => Body): Scene =>
    ({ ...scene, architecture: scene.architecture?.map((body) => body.id === architectureBody!.id ? update(body) : body) });
  const updateArchitectureBody = (update: (body: Body) => Body) => {
    if (!architectureBody) return;
    setScene(sceneWithBody(update));
  };
  // Édition d'INTENTION de toiture : le rendu (`gameIso/builders/roofs.buildRoofs`) ne lit QUE les
  // masses matérialisées, jamais `roofDefaults`/`roofExclusions` — l'intention re-dérive donc les
  // masses dans le geste (`rederiveRoofMasses`), les surcharges authorées préservées (#829/#841).
  const updateArchitectureRoof = (update: (body: Body) => Body) => {
    if (!architectureBody) return;
    setScene(rederiveRoofMasses(sceneWithBody(update)));
  };
  // Ce que la dérivation appliquerait MAINTENANT à ce corps : surcharge du corps, sinon couverture de
  // son TYPE de bâtiment, sinon toiture de la scène (#1715).
  const toiture = architectureBody ? toitureEffective(scene, architectureBody) : null;
  const poseToiture = (champ: keyof RoofDefaults, valeur: RoofDefaults[keyof RoofDefaults] | undefined) =>
    updateArchitectureRoof((body) => poseToitureDeCorps(body, champ, valeur));
  const patchExclusion = (i: number, patch: Partial<{ z: number; rect: ArchitectureRect }>) =>
    updateArchitectureRoof((body) => ({
      ...body,
      roofExclusions: (body.roofExclusions ?? []).map((ex, j) => (j === i ? { ...ex, ...patch } : ex)),
    }));
  const addExclusion = () =>
    updateArchitectureRoof((body) => ({
      ...body,
      roofExclusions: [...(body.roofExclusions ?? []), { z: architectureStorey?.z ?? 0, rect: { x: 0, y: 0, w: 2, h: 2 } }],
    }));
  const removeExclusion = (i: number) =>
    updateArchitectureRoof((body) => {
      const next = (body.roofExclusions ?? []).filter((_, j) => j !== i);
      return { ...body, roofExclusions: next.length ? next : undefined };
    });
  const updateArchitectureStorey = (patch: Partial<ArchitectureStorey>) => {
    if (!architectureStorey) return;
    updateArchitectureBody((body) => ({
      ...body,
      storeys: body.storeys.map((storey) => storey.id === architectureStorey.id ? { ...storey, ...patch } : storey),
    }));
  };
  const updateArchitecturePart = (patch: Partial<ArchitecturePart>) => {
    if (!architectureStorey || !architecturePart) return;
    updateArchitectureStorey({
      parts: architectureStorey.parts.map((part) => part.id === architecturePart.id ? { ...part, ...patch } : part),
    });
  };
  const updateFacadeSection = (patch: Partial<FacadeSection>) => {
    if (!facadeSection) return;
    updateArchitectureBody((body) => ({
      ...body,
      facades: body.facades.map((facade) => facade.id === facadeSection.id ? { ...facade, ...patch } : facade),
    }));
  };
  const updateRoofSection = (patch: Partial<BuildingMass>) => {
    if (!roofSection) return;
    updateArchitectureBody((body) => ({
      ...body,
      masses: body.masses.map((mass) => mass.id === roofSection.id ? { ...mass, ...patch } : mass),
    }));
  };
  const edgeAtZ = <T extends { z?: number }>(edge: T, z: number): T => {
    const next = { ...edge, z };
    if (z === 0) Reflect.deleteProperty(next, 'z');
    return next;
  };
  const removeSel = () => {
    setScene(deleteSel(scene, sel));
    setSel(null);
  };

  const title = ent
    ? <>{entIcon(ent)} {ent.label ?? ent.ref ?? libelleDeValeur(entityKindSchema, ent.kind)}</>
    : selT
        ? <><Icon id="map-tool/zone" size="sm" /> {selT.id}</>
        : zone
          ? <><Icon id="rest/camp" size="sm" /> Zone de repos</>
          : efz
            ? <><Icon id="ui/warning" size="sm" /> {efz.label || 'Piège'}</>
            : selW
              ? (selW.door ? <><Icon id="map-tool/door" size="sm" /> Porte</> : <><Icon id="map-tool/wall" size="sm" /> Cloison</>)
              : entry
                ? <><Icon id="nav/entry-point" size="sm" /> {sel?.type === 'entry' ? sel.id : ''}</>
                : sel?.type === 'architectureBody' && architectureBody
                  ? <><Icon id="rest/home" size="sm" /> {architectureBody.label ?? architectureBody.id}</>
                  : sel?.type === 'architectureStorey' && architectureStorey
                    ? <><Icon id="rest/home" size="sm" /> {architectureStorey.id}</>
                : architecturePart
                  ? <><Icon id="rest/home" size="sm" /> {architecturePart.id}</>
                  : facadeSection
                    ? <><Icon id="map-tool/wall" size="sm" /> {facadeSection.id}</>
                    : roofSection
                      ? <><Icon id="rest/home" size="sm" /> {roofSection.id}</>
                : null;

  return (
    <aside className="editor-inspector" ref={panelRef}>
      {sel && title ? (
        <>
          <div className="insp-head">
            <span className="insp-title">{title}</span>
            <button className="btn small" onClick={() => setSel(null)} title="Désélectionner (Échap)">
              ✕
            </button>
          </div>

          {ent && refusPatch?.id === ent.id && <p className="chip tone-danger" role="alert">{refusPatch.message}</p>}
          {ent && <EntityPanel ent={ent} scene={scene} otherScenes={otherScenes} worldMap={worldMap} setScene={setScene} updateSel={updateSel} removeSel={removeSel} />}

          {sel?.type === 'architectureBody' && architectureBody && toiture && (
            <>
              <Fold title="Corps" open>
                <label className="ed-field">
                  Libellé
                  <input
                    value={architectureBody.label ?? ''}
                    onChange={(event) => updateArchitectureBody((body) => ({ ...body, label: event.target.value || undefined }))}
                  />
                </label>
                <label className="ed-field">
                  Type de bâtiment
                  <select
                    value={architectureBody.style ?? ''}
                    onChange={(event) => updateArchitectureBody((body) => ({ ...body, style: event.target.value || undefined }))}
                  >
                    <option value="" />
                    {Object.values(buildingsMeta()).map((meta) => <option key={meta.id} value={meta.id}>{meta.label}</option>)}
                  </select>
                </label>
                <p className="hint">{architectureBody.storeys.length} étage{architectureBody.storeys.length > 1 ? 's' : ''}.</p>
              </Fold>
              {/* INTENTION de toiture du corps : profil/pente/matériau des masses DÉRIVÉES, et cases
                  qu'on refuse de coiffer. Les deux n'existaient qu'en MapSpec — une cour intérieure à
                  ciel ouvert n'était décoiffable que par un fichier de code (#841). */}
              <Fold title="Toiture du corps">
                <p className="hint">
                  Profil, pente et matériau des masses DÉRIVÉES du plancher de ce corps. Une masse déclarée
                  à la main (surcharge) garde les siens. Un réglage laissé vide SUIT : la couverture du
                  type de bâtiment, sinon la toiture de la scène ; le profil, lui, suit la portée.
                </p>
                <p className="hint">
                  Appliqué en l'état : {matieresCouvrantes().find((m) => m.id === toiture.material)?.label ?? toiture.material},
                  pente de référence {toiture.penteReference}°, comble {toiture.riseMaxStoreys} étage{toiture.riseMaxStoreys > 1 ? 's' : ''}.
                </p>
                <label className="ed-field">
                  Profil
                  <select
                    value={architectureBody.roofDefaults?.profile ?? ''}
                    onChange={(event) => poseToiture('profile', (event.target.value || undefined) as RoofDefaults['profile'])}
                  >
                    <option value="" />
                    {Object.entries(valeursDe(roofProfileSchema) ?? {}).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </label>
                {toiture.profile === 'shed' && (
                  <label className="ed-field">
                    Côté d'égout bas (obligatoire en appentis)
                    <select
                      value={architectureBody.roofDefaults?.eaveSide ?? ''}
                      onChange={(event) => poseToiture('eaveSide', (event.target.value || undefined) as RoofDefaults['eaveSide'])}
                    >
                      <option value="">— à déclarer —</option>
                      <option value="N">Nord</option>
                      <option value="E">Est</option>
                      <option value="S">Sud</option>
                      <option value="O">Ouest</option>
                    </select>
                  </label>
                )}
                <NumberField
                  variant="champ"
                  label="Pente (degrés)"
                  min={5}
                  max={75}
                  vide
                  placeholder={String(toiture.penteReference)}
                  value={architectureBody.roofDefaults?.pitchDeg ?? null}
                  onChange={(pitchDeg) => poseToiture('pitchDeg', pitchDeg ?? undefined)}
                />
                <NumberField
                  variant="champ"
                  label="Comble (étages)"
                  min={1}
                  vide
                  placeholder={String(toiture.riseMaxStoreys)}
                  value={architectureBody.roofDefaults?.riseMaxStoreys ?? null}
                  onChange={(riseMaxStoreys) => poseToiture('riseMaxStoreys', riseMaxStoreys ?? undefined)}
                />
                <label className="ed-field">
                  Couverture
                  <select
                    value={architectureBody.roofDefaults?.material ?? ''}
                    onChange={(event) => poseToiture('material', event.target.value || undefined)}
                  >
                    <option value="" />
                    {matieresCouvrantes().map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </label>
                <p className="hint">
                  Exclusions — cases à NE JAMAIS coiffer (cour intérieure, puits de lumière), par étage.
                </p>
                <Stack>
                  {(architectureBody.roofExclusions ?? []).map((ex, i) => (
                    <div key={i} className="ed-dim">
                      <LayerField z={ex.z} layers={architectureBody.storeys.map((storey) => storey.z)} onChange={(z) => patchExclusion(i, { z })} />
                      {(['x', 'y', 'w', 'h'] as const).map((key) => (
                        <label key={key}>
                          {key === 'w' ? 'L' : key === 'h' ? 'H' : key.toUpperCase()}
                          <input
                            type="number"
                            min={key === 'w' || key === 'h' ? 1 : 0}
                            value={ex.rect[key]}
                            onChange={(event) => patchExclusion(i, { rect: { ...ex.rect, [key]: Number(event.target.value) } })}
                          />
                        </label>
                      ))}
                      <button className="btn small danger" onClick={() => removeExclusion(i)}>Retirer</button>
                    </div>
                  ))}
                  <button className="btn small" onClick={addExclusion}>+ Exclusion</button>
                </Stack>
              </Fold>
              <div className="insp-actions">
                <button className="btn small danger" onClick={removeSel}>Supprimer le corps</button>
              </div>
            </>
          )}

          {sel?.type === 'architectureStorey' && architectureStorey && (
            <>
              <Fold title="Étage" open>
                <p className="hint">{architectureStorey.id} · z {architectureStorey.z}</p>
              </Fold>
              <Fold title="Pièces révélées" open>
                <RoomZoneSelect zones={roomZones} value={architectureStorey.roomZoneIds} onChange={(roomZoneIds) => updateArchitectureStorey({ roomZoneIds })} />
              </Fold>
              <div className="insp-actions">
                <button
                  className="btn small danger"
                  disabled={(architectureBody?.storeys.length ?? 0) <= 1}
                  title={(architectureBody?.storeys.length ?? 0) <= 1 ? 'Dernier étage du corps — supprimez le corps entier plutôt' : undefined}
                  onClick={removeSel}
                >
                  Supprimer l'étage
                </button>
              </div>
            </>
          )}

          {architecturePart && architectureStorey && (
            <>
              <Fold title="Étage et parties" open>
                <p className="hint">Partie {architecturePart.id} · étage {architectureStorey.id} (z {architectureStorey.z}).</p>
                <div className="ed-dim">
                  {(['x', 'y', 'w', 'h'] as const).map((key) => (
                    <label key={key}>
                      {key === 'w' ? 'L' : key === 'h' ? 'H' : key.toUpperCase()}
                      <input
                        type="number"
                        min={key === 'w' || key === 'h' ? 1 : 0}
                        value={architecturePart.foot[key]}
                        onChange={(event) => updateArchitecturePart({
                          foot: {
                            ...architecturePart.foot,
                            [key]: Math.max(key === 'w' || key === 'h' ? 1 : 0, Number(event.target.value)),
                          },
                        })}
                      />
                    </label>
                  ))}
                </div>
              </Fold>
              <div className="insp-actions">
                <button className="btn small danger" onClick={removeSel}>Supprimer</button>
              </div>
            </>
          )}

          {facadeSection && (
            <>
              <Fold title="Façades et features" open>
                <label className="ed-field">
                  Apparence
                  <select value={facadeSection.appearance} onChange={(event) => updateFacadeSection({ appearance: event.target.value })}>
                    {!FACADE_APPEARANCE_IDS.includes(facadeSection.appearance) && <option value={facadeSection.appearance}>{facadeSection.appearance} (inconnu)</option>}
                    {FACADE_APPEARANCE_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
                  </select>
                </label>
                <LayerField
                  z={facadeSection.z}
                  layers={architectureBody?.storeys.map((storey) => storey.z) ?? []}
                  onChange={(z) => updateFacadeSection({
                    z,
                    edges: facadeSection.edges.map((edge) => edgeAtZ(edge, z)),
                    features: facadeSection.features?.map((feature) => ({ ...feature, edge: edgeAtZ(feature.edge, z) })),
                  })}
                />
                <div className="mini-title">Features</div>
                <Stack>
                  {(facadeSection.features ?? []).map((feature, index) => (
                    <Stack className="panel sunken" key={`${feature.id}:${index}`}>
                      <span className="chip">{feature.id}</span>
                      <label className="ed-field">
                        Type
                        <select
                          value={feature.kind}
                          onChange={(event) => updateFacadeSection({
                            features: facadeSection.features?.map((candidate) => candidate.id === feature.id
                              ? { ...candidate, kind: event.target.value as typeof feature.kind }
                              : candidate),
                          })}
                        >
                          {Object.entries(valeursDe(facadeFeatureKindSchema) ?? {}).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                        </select>
                      </label>
                      <label className="ed-field">
                        Apparence (id)
                        <input
                          value={feature.appearance ?? ''}
                          onChange={(event) => updateFacadeSection({
                            features: facadeSection.features?.map((candidate) => candidate.id === feature.id
                              ? { ...candidate, appearance: event.target.value || undefined }
                              : candidate),
                          })}
                        />
                      </label>
                      <div className="ed-dim">
                        {([
                          ['offset', 'Position', 0, 1, 'Position du centre le long de l’arête (0 = début, 1 = fin). Vide = défaut de rendu.'],
                          ['width', 'Largeur', 0.05, 1, 'Largeur de l’ouverture en fraction de l’arête. Vide = défaut de rendu.'],
                        ] as const).map(([key, lab, min, max, title]) => (
                          <label key={key} title={title}>
                            {lab}
                            <input
                              type="number"
                              min={min}
                              max={max}
                              step={0.05}
                              value={feature[key] ?? ''}
                              placeholder="défaut"
                              onChange={(event) => {
                                const raw = event.target.value;
                                const next = raw === '' ? undefined : Math.max(min, Math.min(max, Number(raw)));
                                updateFacadeSection({
                                  features: facadeSection.features?.map((candidate) => candidate.id === feature.id
                                    ? { ...candidate, [key]: next }
                                    : candidate),
                                });
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    </Stack>
                  ))}
                  <button
                    className="btn small"
                    disabled={!facadeSection.edges[0]}
                    onClick={() => {
                      const edge = facadeSection.edges[0];
                      if (!edge) return;
                      const id = nextEntityId('feature', (facadeSection.features ?? []).map((feature) => feature.id));
                      updateFacadeSection({ features: [...(facadeSection.features ?? []), { id, kind: 'gable', edge: { ...edge } }] });
                    }}
                  >
                    Nouvelle feature
                  </button>
                </Stack>
              </Fold>
              <Fold title="Pièces révélées" open>
                <RoomZoneSelect zones={roomZones} value={facadeSection.roomZoneIds ?? []} onChange={(roomZoneIds) => updateFacadeSection({ roomZoneIds })} />
              </Fold>
              <div className="insp-actions">
                <button className="btn small danger" onClick={removeSel}>Supprimer</button>
              </div>
            </>
          )}

          {roofSection && (
            <>
              <Fold title="Masse de toiture" open>
                <p className="hint">Le toit se DÉRIVE de cette masse (emprise + niveaux + pente) — les pans, le faîtage, les noues et croupes ne s'authorent plus, ils se calculent.</p>
                <LayerField
                  label="Étage sommet"
                  z={roofSection.z}
                  layers={architectureBody?.storeys.map((storey) => storey.z) ?? []}
                  onChange={(z) => updateRoofSection({ z })}
                />
                <label className="ed-field">
                  Niveaux (hauteur d'égout = niveaux × hauteur d'étage)
                  <input type="number" min={1} step={1} value={roofSection.levels} onChange={(event) => updateRoofSection({ levels: Math.max(1, Math.round(Number(event.target.value) || 1)) })} />
                </label>
                {roofSection.footprint.map((part, partIndex) => (
                  <div key={partIndex} className="ed-field">
                    <span>Partie {partIndex + 1}</span>
                    <div className="ed-dim">
                      {(['x', 'y', 'w', 'h'] as const).map((key) => (
                        <label key={key}>
                          {key === 'w' ? 'L' : key === 'h' ? 'H' : key.toUpperCase()}
                          <input
                            aria-label={`Partie ${partIndex + 1} ${key}`}
                            type="number"
                            min={key === 'w' || key === 'h' ? 1 : 0}
                            max={key === 'x' || key === 'w' ? scene.dimensions.w : scene.dimensions.h}
                            value={part[key]}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              const next = { ...part };
                              if (key === 'w') {
                                next.w = Math.max(1, Math.min(Number.isFinite(value) ? value : 1, scene.dimensions.w));
                                next.x = Math.min(next.x, scene.dimensions.w - next.w);
                              } else if (key === 'h') {
                                next.h = Math.max(1, Math.min(Number.isFinite(value) ? value : 1, scene.dimensions.h));
                                next.y = Math.min(next.y, scene.dimensions.h - next.h);
                              } else if (key === 'x') {
                                next.x = Math.max(0, Math.min(Number.isFinite(value) ? value : 0, scene.dimensions.w - next.w));
                              } else {
                                next.y = Math.max(0, Math.min(Number.isFinite(value) ? value : 0, scene.dimensions.h - next.h));
                              }
                              updateRoofSection({ footprint: roofSection.footprint.map((candidate, index) => index === partIndex ? next : candidate) });
                            }}
                          />
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="btn small danger"
                      disabled={roofSection.footprint.length === 1}
                      onClick={() => updateRoofSection({ footprint: roofSection.footprint.filter((_, index) => index !== partIndex) })}
                    >
                      Supprimer la partie
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn small"
                  onClick={() => {
                    const last = roofSection.footprint[roofSection.footprint.length - 1];
                    const x = Math.min((last?.x ?? 0) + (last?.w ?? 1), scene.dimensions.w - 1);
                    const y = Math.min(last?.y ?? 0, scene.dimensions.h - 1);
                    updateRoofSection({ footprint: [...roofSection.footprint, { x: Math.max(0, x), y: Math.max(0, y), w: 1, h: 1 }] });
                  }}
                >
                  Ajouter une partie
                </button>
                <label className="ed-field">
                  Profil
                  <select value={roofSection.profile} onChange={(event) => updateRoofSection({ profile: event.target.value as BuildingMass['profile'] })}>
                    {Object.entries(valeursDe(roofProfileSchema) ?? {}).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </label>
                <label className="ed-field">
                  Axe du faîtage (vide = long axe de l'emprise ; OBLIGATOIRE si l'emprise est carrée)
                  <select value={roofSection.ridge ?? ''} onChange={(event) => updateRoofSection({ ridge: (event.target.value || undefined) as BuildingMass['ridge'] })}>
                    <option value="">— auto —</option>
                    <option value="x">X</option>
                    <option value="y">Y</option>
                  </select>
                </label>
                {roofSection.profile === 'shed' && (
                  <label className="ed-field">
                    Côté d'égout bas (obligatoire en appentis)
                    <select value={roofSection.eaveSide ?? ''} onChange={(event) => updateRoofSection({ eaveSide: (event.target.value || undefined) as BuildingMass['eaveSide'] })}>
                      <option value="">— à déclarer —</option>
                      <option value="N">Nord</option>
                      <option value="E">Est</option>
                      <option value="S">Sud</option>
                      <option value="O">Ouest</option>
                    </select>
                  </label>
                )}
                <label className="ed-field">
                  Pente (degrés)
                  <input type="number" min={5} max={75} step={1} value={roofSection.pitchDeg} onChange={(event) => updateRoofSection({ pitchDeg: Math.max(5, Math.min(75, Number(event.target.value) || 5)) })} />
                </label>
                <label className="ed-field">
                  Matériau
                  <select value={roofSection.material} onChange={(event) => updateRoofSection({ material: event.target.value })}>
                    {matieresCouvrantes().map((material) => <option key={material.id} value={material.id}>{material.label}</option>)}
                  </select>
                </label>
              </Fold>
              <div className="insp-actions">
                <button className="btn small danger" onClick={removeSel}>Supprimer</button>
              </div>
            </>
          )}

          {ent && ent.kind === 'personnage' && (
            <Fold title={<><Icon id="action/attack" size="sm" /> Combat</>}>
              <p className="hint">Donne à ce personnage un rôle de COMBAT : profil, traits, et rattachement à une ou plusieurs rencontres. Un embusqué reste invisible jusqu'au combat.</p>
              <label className="ed-check">
                <input
                  type="checkbox"
                  checked={!!ent.combat?.hiddenUntilCombat}
                  onChange={(e) => updateSelCombat({ hiddenUntilCombat: e.target.checked || undefined })}
                />{' '}
                <Icon id="flag/hidden" size="sm" /> Embusqué (invisible hors combat)
              </label>
              <label className="ed-field">
                Preset PNJ (bloc Narratif du projet)
                <select
                  value={ent.presetId ?? ''}
                  onChange={(e) => updateSel({ presetId: e.target.value || undefined })}
                >
                  {/* #1882 : le preset SEUL porteur de fiche ne se retire pas (`PORTEURS_DU_TYPE`). */}
                  <option value="" disabled={ent.ref === undefined && !ent.statblock}>— aucun (réf./profil ci-dessous) —</option>
                  {narratif.presetsPnj.map((p) => (
                    <option key={p.id} value={p.id}>{p.profil?.label ?? p.id}</option>
                  ))}
                </select>
              </label>
              {ent.presetId && ent.statblock && (
                <p className="hint" style={{ color: 'var(--danger)' }}>
                  Preset PNJ ET profil personnalisé présents — le preset prime (`sceneNpc.ts`,
                  `porteurDeFiche`) : le profil ci-dessous est ignoré tant que le preset reste renseigné.
                </p>
              )}
              {ent.statblock ? (
                <>
                  <StatblockEditor stat={ent.statblock} onChange={(sb) => updateSel({ statblock: sb })} />
                  {/* #1882 : quitter le profil personnalisé NOMME la fiche qui le remplace, dans le même geste. */}
                  {ent.ref !== undefined ? (
                    <button className="btn small" onClick={() => updateSel({ statblock: undefined })}>↩ Revenir à la fiche du bestiaire ({creatureLabel(ent.ref)})</button>
                  ) : (
                    <label className="ed-field">
                      Remplacer par une fiche du bestiaire
                      <select value="" onChange={(e) => { const cid = e.target.value; updateSel({ statblock: undefined, ref: cid, label: ent.label ?? creatureLabel(cid) }); }}>
                        <option value="" disabled>— fiche —</option>
                        {enemyCreatures.map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </>
              ) : (
                <>
                  <label className="ed-field">
                    Fiche (bestiaire)
                    {/* #1882 : aucune option ne retire la fiche ; la mention vide n'existe que tant qu'aucune n'est choisie. */}
                    <select value={ent.ref ?? ''} onChange={(e) => { const cid = e.target.value; updateSel({ ref: cid, label: ent.label ?? creatureLabel(cid) }); }}>
                      {ent.ref === undefined && <option value="" disabled>— fiche —</option>}
                      {enemyCreatures.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </label>
                  {(() => {
                    const cr = ent.ref ? findCreatureById(ent.ref) : undefined;
                    if (!cr) return null;
                    return (
                      <>
                        <CreatureProfile creature={cr} />
                        <OptionalTraitsPicker creature={cr} value={ent.combat?.optionals} onChange={(optionals) => updateSelCombat({ optionals })} />
                        <SpellsField value={ent.combat?.spells} onChange={(spells) => updateSelCombat({ spells })} />
                        <RefField
                          cfg={{ ds: 'skills', value: true }}
                          fieldKey="Compétences ajoutées (fusionnées à celles du bestiaire au spawn)"
                          value={ent.combat?.skills ?? []}
                          onChange={(v) => {
                            const skills = (v as { id: string; value?: number }[]).map((r) => ({ id: r.id, value: r.value ?? 0 }));
                            updateSelCombat({ skills: skills.length ? skills : undefined });
                          }}
                        />
                        <label className="ed-check" title="LDB 77 l.108 : « soustrayez -10 et ajoutez 2d10 ». Tirage stable au spawn (rejouable).">
                          <input
                            type="checkbox"
                            checked={ent.combat?.randomChars ?? false}
                            onChange={(e) => updateSelCombat({ randomChars: e.target.checked || undefined })}
                          />{' '}
                          <Icon id="nav/dice" size="sm" /> Caractéristiques aléatoires (LDB 77 l.108 : −10 + 2d10)
                        </label>
                      </>
                    );
                  })()}
                  <button className="btn small" onClick={() => updateSel({ statblock: emptyStatblock(ent.label ?? (ent.ref !== undefined ? creatureLabel(ent.ref) : undefined)) })}><Icon id="ui/settings" size="sm" /> Profil personnalisé…</button>
                </>
              )}
              <div className="mini-title">Rencontres</div>
              {scene.encounters.length === 0 && <p className="hint">Aucune rencontre — l'outil <Icon id="action/attack" size="sm" /> en crée une, ou utilisez le dock Logique.</p>}
              {scene.encounters.map((enc) => {
                const m = (enc.members ?? []).find((mm) => mm.entityId === ent.id);
                return (
                  <div key={enc.id} className="ed-subfield">
                    <label title="Enrôler ce personnage dans cette rencontre">
                      <input
                        type="checkbox"
                        checked={!!m}
                        onChange={(e) => setScene(e.target.checked ? addMember(scene, enc.id, ent.id).scene : removeMember(scene, enc.id, ent.id))}
                      />{' '}
                      {enc.id}
                    </label>
                    {m && (
                      <select
                        value={m.side ?? 'enemy'}
                        onChange={(e) => {
                          const ally = e.target.value === 'ally';
                          setScene(patchMember(scene, enc.id, ent.id, { side: ally ? 'ally' : undefined, ai: ally ? m.ai : undefined }));
                        }}
                      >
                        <option value="enemy">Ennemi</option>
                        <option value="ally">Allié</option>
                      </select>
                    )}
                    {m?.side === 'ally' && (
                      <label className="ed-check" title="L'allié AGIT SEUL à son tour (défenseur de siège, servant de pièce) au lieu d'être joué par le joueur.">
                        <input
                          type="checkbox"
                          checked={!!m.ai}
                          onChange={(e) => setScene(patchMember(scene, enc.id, ent.id, { ai: e.target.checked || undefined }))}
                        />{' '}
                        Piloté par l'IA
                      </label>
                    )}
                  </div>
                );
              })}
            </Fold>
          )}

          {ent && (!!ent.postes?.length || (ent.ref && !!findVehicleById(ent.ref)?.hull)) && <EmplacementFold ent={ent} scene={scene} setScene={setScene} />}

          {selT && (
            <>
              <Fold title="Zone trigger" open>
                <p className="hint">Déclenche ses effets quand le groupe entre dans le rectangle. Poignée au coin SE pour redimensionner.</p>
                <div className="ed-dim">
                  {(['x', 'y', 'w', 'h'] as const).map((k) => (
                    <label key={k}>
                      {k === 'w' ? 'L' : k === 'h' ? 'H' : k.toUpperCase()}
                      <input
                        type="number"
                        min={k === 'w' || k === 'h' ? 1 : 0}
                        value={selT.rect[k]}
                        onChange={(e) => updateSelT({ rect: { ...selT.rect, [k]: Math.max(k === 'w' || k === 'h' ? 1 : 0, Number(e.target.value)) } })}
                      />
                    </label>
                  ))}
                </div>
                <LayerField z={selT.rect.z} layers={sceneLayerZs(scene)} onChange={(z) => updateSelT({ rect: { ...selT.rect, z: z || undefined } })} />
              </Fold>
              <div className="insp-actions">
                <button className="btn small btn-primary" onClick={() => openLogic('triggers', selT.id)}>
                  <Icon id="ui/settings" size="sm" /> Effets ({flowEffectCount(selT.flow)})…
                </button>
                <button className="btn small danger" onClick={removeSel}>
                  Supprimer
                </button>
              </div>
            </>
          )}

          {zone && (
            <>
              <Fold title="Zone de repos" open>
                <p className="hint">Offre de repos LOCALE (prioritaire sur celle de la scène quand le groupe s'y tient). Poignée au coin SE pour redimensionner.</p>
                <div className="ed-dim">
                  {(['x', 'y', 'w', 'h'] as const).map((k) => (
                    <label key={k}>
                      {k === 'w' ? 'L' : k === 'h' ? 'H' : k.toUpperCase()}
                      <input
                        type="number"
                        min={k === 'w' || k === 'h' ? 1 : 0}
                        value={zone.rect[k]}
                        onChange={(e) => updateZone({ rect: { ...zone.rect, [k]: Math.max(k === 'w' || k === 'h' ? 1 : 0, Number(e.target.value)) } })}
                      />
                    </label>
                  ))}
                </div>
                <LayerField z={zone.rect.z} layers={sceneLayerZs(scene)} onChange={(z) => updateZone({ rect: { ...zone.rect, z: z || undefined } })} />
                <div className="ed-rest-places">
                  {([['auberge', <><Icon id="rest/bed" size="sm" /> Auberge</>], ['maison', <><Icon id="rest/home" size="sm" /> Chez soi</>], ['camp', <><Icon id="rest/camp" size="sm" /> Camper</>]] as const).map(([k, label]) => (
                    <label key={k} className="ed-check">
                      <input type="checkbox" checked={zone.places[k] ?? false} onChange={(e) => updateZone({ places: { ...zone.places, [k]: e.target.checked } })} />
                      {label}
                    </label>
                  ))}
                  <label className="ed-check">
                    <input type="checkbox" checked={zone.quality === 'pietre'} onChange={(e) => updateZone({ quality: e.target.checked ? 'pietre' : undefined })} />
                    <Icon id="resource/gold-purse" size="sm" /> Piètre (½ prix, tambouille à risque)
                  </label>
                </div>
              </Fold>
              <div className="insp-actions">
                <button className="btn small danger" onClick={removeSel}>
                  Supprimer
                </button>
              </div>
            </>
          )}

          {efz && sel?.type === 'effectZone' && (() => {
            const r = effectZoneRect(efz.area);
            return (
              <>
                <Fold title={efz.presentation === 'interior' ? 'Pièce' : 'Zone'} open>
                  <p className="hint">
                    Zone nommée : elle situe et se dit. Ce sont les MURS qui font le bâtiment — plancher, toiture,
                    enveloppe et accès se dérivent de la boucle de murs qui enclot la case. La zone, elle, NOMME la
                    pièce, et déclare en extérieur ce qui reste à ciel ouvert dans l’enceinte (cour, jardin, potager)
                    pour qu’aucune toiture ne s’y pose. Poignée au coin SE pour redimensionner.
                  </p>
                  <label className="ed-field">
                    Nom
                    <input value={efz.label} onChange={(e) => setEfz({ ...efz, label: e.target.value })} />
                  </label>
                  <EntryRename label={efz.id} caption="Identifiant (référencé par les façades — « Pièces révélées »)" onRename={(next) => setScene(renameEffectZone(scene, efz.id, next))} />
                  <label className="ed-field">
                    Nature
                    <select
                      value={efz.presentation ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEfz({ ...efz, presentation: v === 'interior' || v === 'exterior' ? v : undefined });
                      }}
                    >
                      <option value="">Non déclarée (zone mécanique : piège, hasard)</option>
                      <option value="exterior">Extérieur — à ciel ouvert (cour, jardin : aucune toiture)</option>
                      <option value="interior">Intérieur (pièce reliée à une façade)</option>
                    </select>
                  </label>
                  <label className="ed-field">
                    Forme
                    <select
                      value={efz.area.kind}
                      onChange={(e) => setEfz(setEffectZoneArea(efz, effectZoneArea(e.target.value === 'disc' ? 'disc' : 'rect', r)))}
                    >
                      <option value="rect">Rectangle</option>
                      <option value="disc">Disque (rayon en cases)</option>
                    </select>
                  </label>
                  {efz.area.kind === 'disc' ? (
                    <div className="ed-dim">
                      {([['cx', 'X'], ['cy', 'Y'], ['radius', 'Rayon']] as const).map(([k, lab]) => (
                        <label key={k}>
                          {lab}
                          <input
                            type="number"
                            min={0}
                            value={efz.area.kind === 'disc' ? efz.area[k] : 0}
                            onChange={(e) => efz.area.kind === 'disc' && setEfz(setEffectZoneArea(efz, { ...efz.area, [k]: Math.max(0, Number(e.target.value)) }))}
                          />
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="ed-dim">
                      {(['x', 'y', 'w', 'h'] as const).map((k) => (
                        <label key={k}>
                          {k === 'w' ? 'L' : k === 'h' ? 'H' : k.toUpperCase()}
                          <input
                            type="number"
                            min={k === 'w' || k === 'h' ? 1 : 0}
                            value={r[k]}
                            onChange={(e) => setEfz(setEffectZoneArea(efz, { kind: 'rect', ...r, [k]: Math.max(k === 'w' || k === 'h' ? 1 : 0, Number(e.target.value)) }))}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                  <LayerField z={efz.z} layers={sceneLayerZs(scene)} onChange={(z) => setEfz({ ...efz, z: z || undefined })} />
                  <ZoneTilesBrush zone={efz} tool={tool} onArm={armZoneTiles} onChange={setEfz} focusKey={zoneFocusKey} port={panelRef} />
                </Fold>
                {/* Une zone est DESCRIPTIVE tant qu'elle ne porte AUCUN de ces cinq champs, et MÉCANIQUE dès
                    qu'elle en porte un (`isDescriptiveZone`) : ce n'est pas un genre à choisir, c'est l'état
                    que l'appareil ci-dessous décrit. Il s'ouvre donc sur les zones qui agissent, et se
                    présente REPLIÉ — armable en un clic — sur celles qui ne font que nommer un lieu. */}
                <Fold key={efz.id} title={<><Icon id="ui/warning" size="sm" /> Piège / zone d'effet</>} open={!isDescriptiveZone(efz)}>
                  <p className="hint">
                    Tout combattant qui TRAVERSE ou STATIONNE dans la zone y subit ce qui suit (en combat). Une
                    pièce reste un simple nom de lieu tant que rien n'est posé ici.
                  </p>
                  <div className="mini-title"><Icon id="resource/movement" size="sm" /> À la traversée (effets mécaniques)</div>
                  <p className="hint">Dégâts mitigés BE+PA : op « Blessures », forme Dés, puis cocher « déduit BE / PA ». État entretenu : op « Poser un État » + paramètre <code>unlessCondition</code> (= le même État).</p>
                  <GameOpEditor ops={efz.onCross ?? []} onChange={(onCross) => setEfz({ ...efz, onCross: onCross.length ? onCross : undefined })} />
                  <div className="mini-title"><Icon id="ui/wait" size="sm" /> Au stationnement (chaque round)</div>
                  <GameOpEditor ops={efz.perRound ?? []} onChange={(perRound) => setEfz({ ...efz, perRound: perRound.length ? perRound : undefined })} />
                  <label className="ed-check">
                    <input
                      type="checkbox"
                      checked={!!efz.crossTest}
                      onChange={(e) => setEfz({ ...efz, crossTest: e.target.checked ? { skill: { id: '' }, difficulty: 'intermediaire', requireSL: 0 } : undefined })}
                    />
                    <Icon id="nav/dice" size="sm" /> Test requis pour franchir (piège/hasard GATÉ)
                  </label>
                  {efz.crossTest && <TestFields test={efz.crossTest} onChange={(crossTest) => setEfz({ ...efz, crossTest })} />}
                  <label className="ed-check">
                    <input type="checkbox" checked={!!efz.blocksLoS} onChange={(e) => setEfz({ ...efz, blocksLoS: e.target.checked || undefined })} />
                    <Icon id="ui/eye" size="sm" /> Masque la ligne de vue (fumée, ténèbres)
                  </label>
                  <label className="ed-check">
                    <input type="checkbox" checked={!!efz.barrier} onChange={(e) => setEfz({ ...efz, barrier: e.target.checked ? { blockGroups: efz.barrier?.blockGroups } : undefined })} />
                    <Icon id="mechanic/ward" size="sm" /> Barrière infranchissable (mur magique, cercle de ward)
                  </label>
                  {efz.barrier && (
                    <label className="ed-field">
                      Bloque les groupes (vide = tout le monde)
                      <input
                        value={(efz.barrier.blockGroups ?? []).join(', ')}
                        placeholder="Démon, Mort-vivant"
                        onChange={(e) => {
                          const blockGroups = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                          setEfz({ ...efz, barrier: { blockGroups: blockGroups.length ? blockGroups : undefined } });
                        }}
                      />
                    </label>
                  )}
                </Fold>
                <div className="insp-actions">
                  <button className="btn small danger" onClick={removeSel}>
                    Supprimer
                  </button>
                </div>
              </>
            );
          })()}

          {selW && sel?.type === 'wall' && (
            <>
              <Fold title={selW.door ? <><Icon id="map-tool/door" size="sm" /> Porte</> : <><Icon id="map-tool/wall" size="sm" /> Cloison</>} open>
                <p className="hint">Arête @ ({sel.x},{sel.y}) {sel.side}{sel.z ? ` · étage ${sel.z}` : ''}.</p>
                <div className="ed-field">
                  <span>Type</span>
                  <Row>
                    <button className={`btn small ${selW.door ? '' : 'btn-primary'}`} title="Cloison pleine (bloque vue et passage)" onClick={() => patchSelW({ door: undefined, closed: undefined })}>
                      ▮ Cloison
                    </button>
                    <button className={`btn small ${selW.door ? 'btn-primary' : ''}`} title="Arête franchissable (porte)" onClick={() => patchSelW({ door: true })}>
                      <Icon id="map-tool/door" size="sm" /> Porte
                    </button>
                  </Row>
                </div>
                {selW.door && (
                  <label className="ed-check">
                    <input type="checkbox" checked={!!selW.closed} onChange={(e) => patchSelW({ closed: e.target.checked || undefined })} />
                    <Icon id="ui/lock" size="sm" /> Fermée au départ
                  </label>
                )}
                {!selW.door && (
                  <label className="ed-check">
                    <input type="checkbox" checked={!!selW.window} onChange={(e) => patchSelW({ window: e.target.checked || undefined })} />
                    Fenêtre décorative
                  </label>
                )}
                <RefField
                  cfg={{
                    ds: 'structures',
                    single: true,
                    filter: (e) => (selW.door ? isDoorEdgeStructure(e as unknown as StructureData) : isWallEdgeStructure(e as unknown as StructureData)),
                  }}
                  fieldKey="Matériau du mur"
                  value={selW.structure}
                  onChange={(v) => patchSelW({ structure: (v as string | null) || undefined })}
                  nullable
                />
                <label className="ed-field">
                  <span>Apparence visuelle</span>
                  <select value={selW.appearance ?? ''} onChange={(e) => patchSelW({ appearance: e.target.value || undefined })}>
                    <option value="">— Dérivée de la structure/façade —</option>
                    {structureAppearances.map((appearance) => (
                      <option key={appearance.id} value={appearance.id}>{appearance.label}</option>
                    ))}
                  </select>
                </label>
                <p className="hint">Posée, l'arête tient (bloque vue + passage) jusqu'à être abattue en combat ; elle devient alors une brèche franchissable. « — (aucun) — » = pas de structure. La HAUTEUR d'un rempart se peint désormais à l'outil <Icon id="map-tool/height" size="sm" /> (hauteur des cases qu'il borde), plus de réglage par segment.</p>
                <div className="ed-field">
                  <span>Escaladable</span>
                  <Row>
                    <button className={`btn small ${selW.climb ? '' : 'btn-primary'}`} title="Arête non grimpable" onClick={() => patchSelW({ climb: undefined })}>Non</button>
                    <button className={`btn small ${selW.climb?.kind === 'ladder' ? 'btn-primary' : ''}`} title="Échelle / surface facile : pas de Test (LDB 15 l.53)" onClick={() => patchSelW({ climb: { kind: 'ladder' } })}>Échelle</button>
                    <button className={`btn small ${selW.climb?.kind === 'surface' ? 'btn-primary' : ''}`} title="Paroi à prises : Test d'Escalade (LDB 15 l.57)" onClick={() => patchSelW({ climb: { kind: 'surface', ...(selW.climb?.kind === 'surface' ? selW.climb : {}) } })}>Paroi</button>
                  </Row>
                </div>
                {selW.climb?.kind === 'surface' && (
                  <>
                    <div className="ed-field">
                      <span>Difficulté du Test</span>
                      <select value={selW.climb.difficulty ?? 'intermediaire'} onChange={(e) => patchSelW({ climb: { ...selW.climb!, difficulty: e.target.value as import('../../engine/types').Difficulty } })}>
                        {Object.entries(DIFFICULTY_LABELS).map(([k, lbl]) => (<option key={k} value={k}>{lbl}</option>))}
                      </select>
                    </div>
                    <label className="ed-check">
                      <input type="checkbox" checked={!!selW.climb.requiresGrimpeur} onChange={(e) => patchSelW({ climb: { ...selW.climb!, requiresGrimpeur: e.target.checked || undefined } })} />
                      Talent Grimpeur requis (LDB 15 l.57)
                    </label>
                  </>
                )}
                <p className="hint">Une arête escaladable borde deux surfaces de hauteurs différentes (falaise) : cliquer le marqueur pointillé grimpe vers la case d'en face. « Non » = mur/porte ordinaire.</p>
              </Fold>
              <div className="insp-actions">
                <button className="btn small danger" onClick={removeSel}>
                  Supprimer
                </button>
              </div>
            </>
          )}

          {entry && sel?.type === 'entry' && (
            <>
              <Fold title="Point d'entrée" open>
                <p className="hint">Cible nommée des transitions (« Vers scène @ entrée ») et des arrivées de voyage.</p>
                <EntryRename
                  label={sel.id}
                  onRename={(next) => {
                    const out = renameEntry(scene, sel.id, next);
                    if (out !== scene) {
                      setScene(out);
                      setSel({ type: 'entry', id: next.trim() });
                    }
                  }}
                />
                <div className="ed-dim">
                  <label>
                    X
                    <input
                      type="number"
                      value={entry.x}
                      onChange={(e) => setScene({ ...scene, entryPoints: { ...scene.entryPoints, [sel.id]: { ...entry, x: Number(e.target.value) } } })}
                    />
                  </label>
                  <label>
                    Y
                    <input
                      type="number"
                      value={entry.y}
                      onChange={(e) => setScene({ ...scene, entryPoints: { ...scene.entryPoints, [sel.id]: { ...entry, y: Number(e.target.value) } } })}
                    />
                  </label>
                </div>
                <LayerField
                  z={entry.z}
                  layers={sceneLayerZs(scene)}
                  onChange={(z) => setScene({ ...scene, entryPoints: { ...scene.entryPoints, [sel.id]: { ...entry, z: z || undefined } } })}
                />
              </Fold>
              <div className="insp-actions">
                <button className="btn small danger" onClick={removeSel}>
                  Supprimer
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <SceneProps scene={scene} setScene={setScene} setSel={setSel} resizeScene={resizeScene} />
      )}
    </aside>
  );
}

/** Renommage d'un id STABLE (point d'entrée, zone d'effet…) — champ local appliqué au blur/Entrée (la clé doit rester unique). */
function EntryRename({ label, caption = 'Nom (référencé par les transitions)', onRename }: { label: string; caption?: string; onRename: (next: string) => void }) {
  const [val, setVal] = useState(label);
  // L'inspecteur RÉUTILISE l'instance d'un objet sélectionné au suivant : sans resynchronisation, le
  // champ garderait l'id de l'objet PRÉCÉDENT — un id faux qu'un auteur recopie câble la mauvaise pièce.
  // Le pilote est l'id AFFICHÉ (`label`), pas un montage : la saisie en cours d'un même objet survit.
  const [shown, setShown] = useState(label);
  if (shown !== label) {
    setShown(label);
    setVal(label);
  }
  return (
    <label className="ed-field">
      {caption}
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          if (val.trim() && val !== label) onRename(val);
          // Le champ ne garde JAMAIS un id que le document a REFUSÉ (doublon) : il se recale sur l'id
          // en vigueur. Renommage accepté → `label` change au rendu suivant et la resynchro ci-dessus
          // reprend la main ; refusé → `label` est resté le même, et c'est lui qui s'affiche.
          setVal(label);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

/**
 * TYPE d'un décor — et l'ÉTAT de la donnée quand le catalogue ne le résout pas (#877 : « Rien en
 * dure, pas de fallback »). Ce que le sélecteur MONTRE est ce que la donnée DIT : sans cet état, le
 * DOM afficherait la PREMIÈRE entrée du catalogue comme si c'était le type de l'instance.
 *
 * L'état est dit DEUX fois, et ce n'est pas une redite : un `<option>` natif est TRONQUÉ à la largeur
 * du champ — or l'id fautif EST l'information utile —, donc il se relit ENTIER hors du champ
 * (primitive `.chip.tone-danger`, `ui/styles/components.css`) et au survol (`title`). L'option, elle,
 * n'est pas ÉLISIBLE : on n'élit pas une absence. Les mots sont ceux de `state/validateScene.ts` —
 * l'inspecteur et le validateur disent la MÊME chose. Élire un vrai type l'ÉCRIT (`changePropRef`).
 */
function SelecteurDeDecor({ scene, ent, setScene }: { scene: Scene; ent: SceneEntity; setScene: (s: Scene) => void }) {
  const etat = findPropById(ent.ref)
    ? null
    : ent.ref === undefined
      ? 'Décor sans type — choisis-en un'
      : `Décor inexistant « ${ent.ref} »`;
  return (
    <>
      <label className="ed-field">
        Décor
        <select
          value={ent.ref ?? REF_DECOR_NON_NOMMEE}
          title={etat ?? undefined}
          onChange={(e) => setScene(changePropRef(scene, ent.id, e.target.value))}
        >
          {etat && (
            <option value={ent.ref ?? REF_DECOR_NON_NOMMEE} disabled>
              {etat}
            </option>
          )}
          {Object.values(PROPS).map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      {etat && <p className="chip tone-danger" role="alert">{etat}</p>}
    </>
  );
}

/**
 * EMPREINTE de l'instance SÉLECTIONNÉE — les cases que CE décor occupe, à SON cap et à l'échelle de
 * CETTE scène (`propFootTiles`, la couture unique que lisent la marchabilité, la ligne de vue et le
 * halo). Rien n'est recalculé ici : l'inspecteur MONTRE ce que le monde applique.
 *
 * Au cap réel, donc : la même `table-2x1` annonce 2×1 au sud et 1×2 à l'est, et ses cases suivent le
 * changement d'orientation fait juste au-dessus (#1509 L7′). L'aperçu de la PALETTE, lui, ne connaît
 * pas d'instance : il annonce l'empreinte au CAP D'IDENTITÉ (`Palette.tsx`).
 */
function EmpreinteDeLInstance({ scene, ent }: { scene: Scene; ent: SceneEntity }) {
  const cases = propFootTiles(ent.ref, ent.pos, ent.facing, sceneMetresPerTile(scene));
  const w = Math.max(...cases.map((c) => c.x)) - ent.pos.x + 1;
  const h = Math.max(...cases.map((c) => c.y)) - ent.pos.y + 1;
  return (
    <p className="hint">
      Empreinte <span className="chip">{w}×{h}</span>{' '}
      {cases.map((c) => `(${c.x}, ${c.y})`).join(' ')}
    </p>
  );
}

/** Panneau d'une ENTITÉ sélectionnée (personnage / décor / départ héros). */
function EntityPanel({
  ent,
  scene,
  otherScenes,
  worldMap,
  setScene,
  updateSel,
  removeSel,
}: {
  ent: SceneEntity;
  scene: Scene;
  otherScenes: Scene[];
  worldMap: WorldMap | null;
  setScene: (s: Scene) => void;
  updateSel: (patch: Partial<SceneEntity>) => void;
  removeSel: () => void;
}) {
  return (
    <>
      <div className="ent-preview">
        <svg viewBox="0 0 120 150" width="84" height="105">
          {ent.kind === 'heroStart' ? (
            <text x="60" y="92" textAnchor="middle" fontSize="44" fill="#2ecc71">
              ★
            </text>
          ) : (
            // Aperçu unifié via le MÊME classifieur que le canvas (tokenBodyKind) — le classifieur route
            // par la NATURE de l'entité (`kind`), un décor n'atteint jamais le registre créature/véhicule.
            tokenBodyKind({ kind: 'sceneEntity', ent }).body
          )}
        </svg>
        <span className="hint">
          {libelleDeValeur(entityKindSchema, ent.kind)} @ ({ent.pos.x}, {ent.pos.y})
        </span>
      </div>
      <Fold title="Identité" open>
        <label className="ed-field">
          Libellé
          <input value={ent.label ?? ''} onChange={(e) => updateSel({ label: e.target.value })} />
        </label>
        <label className="ed-field">
          Orientation
          {/* Un décor VOLUMIQUE n'a que les quatre cardinaux À OFFRIR : `data/props.types.ts`
              `capVolumique`. Le geste n'est pas proposable, donc jamais à réparer après coup. Source :
              le CATALOGUE (`refEstVolumique`), la même que lit le schéma de scène au parse et
              `validateScene` à l'écran. */}
          <select value={ent.facing ?? 'S'} onChange={(e) => updateSel({ facing: e.target.value as SceneEntity['facing'] })}>
            {(refEstVolumique(ent.ref) && ent.kind === 'prop' ? CAPS_OFFERTS_CARDINAUX : CAPS_OFFERTS).map(([cap, libelle]) => (
              <option key={cap} value={cap}>{libelle}</option>
            ))}
          </select>
        </label>
        <LayerField z={ent.z} layers={sceneLayerZs(scene)} onChange={(z) => updateSel({ z: z || undefined })} />
      </Fold>
      {ent.kind === 'personnage' && (
        <>
          <Fold title="Apparence" open>
            <label className="ed-field">
              Espèce (rig)
              {/* Espèce EXPLICITE de rendu (`appearance.species`) — découple l'apparence du nom/ref
                  (cf. scene.ts). Vide = bipède Humain par défaut. Le profil de stats se choisit via la
                  réf de créature (fold Rôle/Combat), distincte de l'apparence. */}
              <select value={ent.appearance?.species ?? ''} onChange={(e) => updateSel({ appearance: { ...ent.appearance, species: e.target.value || undefined } })}>
                <option value="">(par défaut : Humain)</option>
                {creatureSpeciesOptions().map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="ed-field">
              Animation d'ambiance
              <select value={ent.anim ?? ''} onChange={(e) => updateSel({ anim: e.target.value || undefined })}>
                {SCENE_ANIMS.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="ed-field">
              <span>Apparence aléatoire</span>
              <button
                className="btn small"
                onClick={() => updateSel({ appearance: { ...ent.appearance, seed: hashSeed(ent.id + ':' + Math.floor(performance.now())) } })}
              >
                <Icon id="nav/dice" size="sm" /> Relancer
              </button>
            </div>
            <MonsterPartsFields
              monster={ent.appearance?.monster}
              weapon={ent.weapon}
              colors={ent.appearance?.colors}
              sex={ent.appearance?.sex}
              build={ent.appearance?.build}
              hairstyle={ent.appearance?.hairstyle}
              tenue={ent.appearance?.tenue}
              onMonster={(patch) => updateSel({ appearance: { ...ent.appearance, monster: { ...(ent.appearance?.monster ?? {}), ...patch } } })}
              onWeapon={(w) => updateSel({ weapon: w })}
              onColors={(patch) => updateSel({ appearance: { ...ent.appearance, colors: { ...(ent.appearance?.colors ?? {}), ...patch } } })}
              onSex={(s) => updateSel({ appearance: { ...ent.appearance, sex: s } })}
              onBuild={(b) => updateSel({ appearance: { ...ent.appearance, build: b } })}
              onHairstyle={(id) => updateSel({ appearance: { ...ent.appearance, hairstyle: id } })}
              onTenue={(c) => updateSel({ appearance: { ...ent.appearance, tenue: c } })}
              eyes={ent.appearance?.eyes}
              onEyes={(patch) => updateSel({ appearance: { ...ent.appearance, eyes: { ...(ent.appearance?.eyes ?? {}), ...patch } } })}
              features={ent.appearance?.features}
              onFeatures={(f) => updateSel({ appearance: { ...ent.appearance, features: f.length ? f : undefined } })}
            />
          </Fold>
          <Fold title="Rôle (dialogue, marchand)">
            <label className="ed-field">
              Dialogue / quête
              <select value={ent.dialogueId ?? ''} onChange={(e) => updateSel({ dialogueId: e.target.value || undefined })}>
                <option value="">— aucun —</option>
                {scene.dialogues.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id}
                  </option>
                ))}
              </select>
            </label>
            {/* JOUEUR de taverne (#1279 S4) : ce PNJ propose une partie, jouée de SA fiche. Même
                forme que le rôle « Marchand » juste dessous — un rôle optionnel, un select qui
                l'ouvre ou le retire, et son réglage d'auteur (la mise de départ, `NADJ 04 l.72`). */}
            <label className="ed-field">
              Joueur de taverne (jeu proposé)
              <select
                value={ent.tavernGame?.gameId ?? ''}
                onChange={(e) => updateSel({ tavernGame: e.target.value ? { ...ent.tavernGame, gameId: e.target.value } : undefined })}
              >
                <option value="">— aucun —</option>
                {TAVERN_GAMES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            {ent.tavernGame && (
              <label className="ed-field">
                Mise de départ (sous de cuivre)
                <input
                  type="number"
                  min={0}
                  value={ent.tavernGame.stakeBrass ?? ''}
                  onChange={(e) => updateSel({ tavernGame: { ...ent.tavernGame!, stakeBrass: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) } })}
                />
              </label>
            )}
            <label className="ed-field">
              Marchand (archétype)
              <select value={ent.merchant?.archetype ?? ''} onChange={(e) => updateSel({ merchant: e.target.value ? { ...ent.merchant, archetype: e.target.value } : undefined })}>
                <option value="">— aucun —</option>
                {Object.values(MERCHANTS).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            {ent.merchant && (
              <>
                <label className="ed-field">
                  ↳ Bourg (override Disponibilité)
                  <select
                    value={ent.merchant.settlement ?? ''}
                    onChange={(e) => updateSel({ merchant: { ...ent.merchant!, settlement: (e.target.value || undefined) as Settlement | undefined } })}
                  >
                    <option value="">— défaut (archétype) —</option>
                    <option value="village">Village</option>
                    <option value="ville">Ville</option>
                    <option value="cite">Cité</option>
                  </select>
                </label>
                <label className="ed-field">
                  ↳ Taux de rachat à la vente (override, ex. 0.5 = ½ si marchandé, ¼ sinon)
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    placeholder="défaut archétype"
                    value={ent.merchant.resaleRate ?? ''}
                    onChange={(e) => updateSel({ merchant: { ...ent.merchant!, resaleRate: e.target.value === '' ? undefined : Number(e.target.value) } })}
                  />
                </label>
                <label className="ed-field">
                  ↳ Majoration d'achat (override, 1 = prix listé ; 1.25 = +25 %)
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    placeholder="défaut archétype (1)"
                    value={ent.merchant.buyMarkup ?? ''}
                    onChange={(e) => updateSel({ merchant: { ...ent.merchant!, buyMarkup: e.target.value === '' ? undefined : Number(e.target.value) } })}
                  />
                </label>
                <label className="ed-field">
                  ↳ Réassort (jours, override — défaut 1)
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="défaut archétype (1 j)"
                    value={ent.merchant.restockDays ?? ''}
                    onChange={(e) => updateSel({ merchant: { ...ent.merchant!, restockDays: e.target.value === '' ? undefined : Number(e.target.value) } })}
                  />
                </label>
                <label className="ed-field">
                  ↳ Système d'achat / vente (override, LDB 59 l.15)
                  <select
                    value={ent.merchant.marketMode ?? ''}
                    onChange={(e) => updateSel({ merchant: { ...ent.merchant!, marketMode: (e.target.value || undefined) as NonNullable<SceneEntity['merchant']>['marketMode'] } })}
                  >
                    <option value="">— (hériter du global) —</option>
                    <option value="complet">Complet (Disponibilité + Marchandage)</option>
                    <option value="sans-disponibilite">Sans Disponibilité (tout en stock)</option>
                    <option value="sans-marchandage">Sans Marchandage (prix fixes)</option>
                    <option value="simplifie">Simplifié (les deux désactivés)</option>
                  </select>
                </label>
                <label className="ed-field">
                  ↳ Guildes d'Artisans (override, LDB 60 l.38)
                  <select
                    value={ent.merchant.guild == null ? '' : String(ent.merchant.guild)}
                    onChange={(e) => updateSel({ merchant: { ...ent.merchant!, guild: e.target.value === '' ? undefined : e.target.value === 'true' } })}
                  >
                    <option value="">— (hériter du global) —</option>
                    <option value="true">Activées</option>
                    <option value="false">Désactivées</option>
                  </select>
                </label>
                <label className="ed-field">
                  ↳ Tenir les comptes (override, LDB 59 l.9)
                  <select
                    value={ent.merchant.tenirComptes == null ? '' : String(ent.merchant.tenirComptes)}
                    onChange={(e) => updateSel({ merchant: { ...ent.merchant!, tenirComptes: e.target.value === '' ? undefined : e.target.value === 'true' } })}
                  >
                    <option value="">— (hériter du global) —</option>
                    <option value="true">Activé</option>
                    <option value="false">Désactivé</option>
                  </select>
                </label>
              </>
            )}
          </Fold>
        </>
      )}
      {ent.kind === 'prop' && (
        <Fold title="Décor & interaction" open>
          <SelecteurDeDecor scene={scene} ent={ent} setScene={setScene} />
          <EmpreinteDeLInstance scene={scene} ent={ent} />
          <SeatAssignmentsField scene={scene} propId={ent.id} onChange={setScene} />
          <label className="ed-check">
            <input
              type="checkbox"
              checked={!!ent.light}
              onChange={(e) => updateSel({ light: e.target.checked ? { ...ent.light, radiusM: ent.light?.radiusM ?? 6 } : undefined })}
            />{' '}
            <Icon id="ui/eye" size="sm" /> Source de lumière (override de l'instance — sinon rayon du type de décor)
          </label>
          {ent.light && (
            <>
              <label className="ed-field">
                Rayon d'éclairage (mètres)
                <NumberField
                  variant="nu"
                  label="Rayon d'éclairage (mètres)"
                  min={1}
                  value={ent.light.radiusM}
                  onChange={(radiusM) => updateSel({ light: { ...ent.light!, radiusM } })}
                />
              </label>
              <label className="ed-field">
                Ton de la lumière (apparence — couleur, intensité, vacillement)
                <select
                  value={ent.light.tone ?? ''}
                  onChange={(e) => updateSel({ light: { ...ent.light!, tone: e.target.value || undefined } })}
                >
                  <option value="">— (hériter du type de décor) —</option>
                  {lightTones.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          <UsableFields
            ent={ent}
            scene={scene}
            updateSel={updateSel}
            flowCtx={{ encounters: scene.encounters, dialogues: scene.dialogues, ...effectCtxOf(scene, otherScenes, worldMap ?? undefined) }}
          />
        </Fold>
      )}
      <div className="insp-actions">
        <button className="btn small danger" onClick={removeSel}>
          Supprimer
        </button>
      </div>
    </>
  );
}

/**
 * DÉCOR UTILISABLE (#1687) — la case que l'auteur coche pour ACTIVER cette instance. Ce que le joueur
 * verra est RENDU ici en lecture par le dériveur UNIQUE (`actionsDe`, `state/usable.ts`) : l'auteur
 * lit la même liste que le jeu, jamais une liste recopiée.
 *
 * L'activation n'a d'effet PROPRE que sur un décor dont le TYPE porte des places (c'est la seule
 * capacité qui vive sur le type) ; les autres capacités se dérivent sans elle, et la liste le montre.
 */
function UsableFields({ ent, scene, updateSel, flowCtx }: {
  ent: SceneEntity;
  scene: Scene;
  updateSel: (patch: Partial<SceneEntity>) => void;
  flowCtx: ComponentProps<typeof FlowEditor>['ctx'];
}) {
  const actions = ent.usable?.actions ?? [];
  const poser = (patch: Partial<NonNullable<SceneEntity['usable']>>) => {
    const suivant = { ...ent.usable, ...patch };
    if (!suivant.assise && !suivant.actions?.length) return updateSel({ usable: undefined });
    updateSel({ usable: suivant });
  };
  const editerAction = (i: number, patch: Partial<ActionAuthoree>) =>
    poser({ actions: actions.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  // L'OPÉRATEUR de scène décide, l'éditeur écrit ce qu'il rend : liste inchangée = refus (id déjà
  // porté sur ce décor), et le champ se recale tout seul sur l'id EN VIGUEUR.
  const renommerAction = (from: string, to: string) => {
    const suivant = renameActionAuthoree(actions, from, to);
    if (suivant !== actions) poser({ actions: suivant });
  };
  return (
    <>
      <label className="ed-check">
        <input
          type="checkbox"
          checked={!!ent.usable?.assise}
          onChange={(e) => poser({ assise: e.target.checked ? true : undefined })}
        />{' '}
        Assise (ouvre les places que le TYPE de décor porte)
      </label>
      {actions.map((a, i) => (
        <div className="ed-field" key={a.id}>
          <span className="mini-title">Action « {a.label ?? a.id} »</span>
          {/* L'id n'est écrit au document qu'au COMMIT (blur/Entrée) — la primitive du fichier, déjà
              servie par les points d'entrée et les zones d'effet. Frappé lettre à lettre, il posait
              `f`, `fo`, `fou` dans la scène. L'unicité, elle, se garde AU GESTE
              (`state/sceneEdit.renameActionAuthoree`) : le `refine` du schéma ne mord qu'au parse, et
              une scène VIVANTE à deux actions homonymes se joue faux avant d'être relue. */}
          <EntryRename
            label={a.id}
            caption="Identifiant (logique — stable, unique sur ce décor)"
            onRename={(next) => renommerAction(a.id, next)}
          />
          <label className="ed-field">
            Libellé affiché (vide = libellé du catalogue pour cet identifiant)
            <input value={a.label ?? ''} onChange={(e) => editerAction(i, { label: e.target.value || undefined })} />
          </label>
          <label className="ed-check">
            <input type="checkbox" checked={!!a.consume} onChange={(e) => editerAction(i, { consume: e.target.checked || undefined })} />{' '}
            Le décor disparaît une fois l'action jouée (butin)
          </label>
          <label className="ed-check">
            <input type="checkbox" checked={!!a.unique} onChange={(e) => editerAction(i, { unique: e.target.checked || undefined })} />{' '}
            Jouable une seule fois (sinon rejouable indéfiniment)
          </label>
          <NumberField
            variant="champ"
            label="Temps que l'action coûte (minutes)"
            ariaLabel={`Temps que l'action « ${a.label ?? a.id} » coûte (minutes)`}
            min={0}
            vide
            value={a.minutes ?? null}
            placeholder={String(TIME_COST.search)}
            onChange={(minutes) => editerAction(i, { minutes: minutes ?? undefined })}
          />
          <FlowEditor flow={a.flow} onChange={(flow) => editerAction(i, { flow })} ctx={flowCtx} />
          <button className="btn small danger" onClick={() => poser({ actions: actions.filter((_, j) => j !== i) })}>
            Supprimer l'action
          </button>
        </div>
      ))}
      <button
        className="btn small"
        onClick={() => poser({ actions: [...actions, { id: idActionLibre(actions), flow: EMPTY_FLOW, unique: true }] })}
      >
        Ajouter une action
      </button>
      <div className="ed-field">
        <span className="mini-title">Ce que le joueur verra</span>
        <div className="chips">
          {actionsDe(scene, ent).map((a) => (
            <span key={a.id} className="chip">{a.label}</span>
          ))}
        </div>
      </div>
    </>
  );
}

/** Premier id LIBRE pour une action neuve : `fouiller`, puis `fouiller-2`, `fouiller-3`… L'unicité est
 *  un invariant du schéma (`usable` `refine`) — l'éditeur ne laisse donc pas l'auteur la violer au
 *  premier clic, il lui donne un id qui passe et qu'il renommera. */
function idActionLibre(actions: readonly ActionAuthoree[]): string {
  const pris = new Set(actions.map((a) => a.id));
  if (!pris.has(ACTION_FOUILLER)) return ACTION_FOUILLER;
  for (let n = 2; ; n++) if (!pris.has(`${ACTION_FOUILLER}-${n}`)) return `${ACTION_FOUILLER}-${n}`;
}

/** Emplacement de siège (poste d'artillerie éventuel) + équipage EXPOSÉ à bord + Améliorations
 *  d'INSTANCE (MDG 12) d'une coque — le poste est OPTIONNEL (une coque peut n'avoir que Blindage/
 *  Lissage, #834 audit-2 défaut 8), équipage et Améliorations restent toujours authorables EN PLACE ;
 *  chaque changement passe par `setScene` → undo global. */
function EmplacementFold({ ent, scene, setScene }: { ent: SceneEntity; scene: Scene; setScene: (s: Scene) => void }) {
  const poste = ent.postes?.[0]; // absent — coque sans emplacement d'artillerie (Blindage/Lissage seuls, MDG 12) : les Améliorations restent authorables
  const directional = !!poste?.side;
  const setUpgrades = (upgrades: NavalTraitRef[] | undefined) => setScene(editEntity(scene, ent.id, { upgrades }));
  return (
    <Fold title={<><Icon id="scenario/siege" size="sm" /> Emplacement de siège, équipage & Améliorations</>} open>
      {poste && (
        <>
          <p className="hint">Pièce d'artillerie servie par un équipage. Enrôlez l'emplacement ET ses servants dans une rencontre (fold <Icon id="action/attack" size="sm" /> Combat) ; au combat, le chef (1ᵉʳ servant) sert la pièce et tire.</p>
          <label className="ed-field">
            Engin
            <select value={poste.trappingId ?? poste.item?.trappingId ?? ''} onChange={(e) => setScene(setPosteEngine(scene, ent.id, e.target.value))}>
              {siegeEngines().map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>
          <div className="ed-field">
            <span>Créneau de tir</span>
            <Row>
              <button className={`btn small ${directional ? '' : 'btn-primary'}`} title="Pivot libre — tire dans toutes les directions" onClick={() => setScene(setPosteSide(scene, ent.id, undefined))}>
                ↻ Omni
              </button>
              <button className={`btn small ${directional ? 'btn-primary' : ''}`} title="Arc fixe, relatif à l'orientation-monde du chef de pièce" onClick={() => setScene(setPosteSide(scene, ent.id, poste.side ?? 'proue'))}>
                → Directionnel
              </button>
            </Row>
          </div>
          {directional && (
            <label className="ed-field">
              Arc (relatif au cap du chef de pièce)
              <select value={poste.side} onChange={(e) => setScene(setPosteSide(scene, ent.id, e.target.value as FireArc))}>
                {FIRE_ARCS.map((a) => (
                  <option key={a.side} value={a.side}>{a.label}</option>
                ))}
              </select>
            </label>
          )}
          <CrewPicker
            ent={ent}
            scene={scene}
            ids={poste.crewIds ?? []}
            onChange={(next) => setScene(setPosteCrew(scene, ent.id, next))}
            caption={<>Servants du poste <em className="de-hint">(le 1ᵉʳ = chef de pièce ★)</em></>}
            head="Chef de pièce"
            addLabel="+ Affecter un servant"
            emptyHint="Posez des personnages (servants) sur la carte, puis affectez-les ici."
          >
            <p className="hint">
              Un servant affecté ici GARDE sa position sur la carte : la formation en anneau (ADE II 8 l.258)
              ne se pose automatiquement qu'au spawn de combat, et seulement si sa position COÏNCIDE encore avec
              celle de la pièce (un placement d'auteur distinct n'est jamais déplacé, #255). Pour une formation
              visible dès l'éditeur, posez le servant sur la case de la pièce avant de l'affecter, ou déplacez-le
              vous-même autour après affectation.
            </p>
          </CrewPicker>
        </>
      )}
      {/* Équipage EXPOSÉ à bord (MDG 14) : ces personnages encaissent les critiques Équipage/Éclats de
          la coque et sont pris dans l'aire d'un tir de bord. Indépendant des postes (un navire sans
          artillerie a de l'équipage). */}
      <CrewPicker
        ent={ent}
        scene={scene}
        ids={ent.crewIds ?? []}
        onChange={(next) => setScene(editEntity(scene, ent.id, { crewIds: next.length ? next : undefined }))}
        caption={<>Équipage exposé à bord <em className="de-hint">(MDG 14 — encaisse les critiques de coque)</em></>}
        addLabel="+ Embarquer un membre d'équipage"
        emptyHint="Posez des personnages sur la carte, puis embarquez-les ici."
      />
      <RefField
        cfg={{ ds: 'navalTraits', value: true }}
        fieldKey="Améliorations d'instance (MDG 12 — Sabord, Bélier, Blindage, Lissage…)"
        value={ent.upgrades ?? []}
        onChange={(v) => setUpgrades((v as NavalTraitRef[]).length ? (v as NavalTraitRef[]) : undefined)}
      />
    </Fold>
  );
}

/** EMPRISE d'une zone (`SceneEffectZone.tiles`) : le geste vit SUR la carte — ce contrôle ARME le
 *  pinceau (`Tool.zoneTiles`) dans un sens ou l'autre sur cette zone, affiche le compte courant et
 *  rétablit l'emprise pleine. Ce que l'auteur peint entre/sort de la zone pour TOUS ses lecteurs
 *  (`sceneZoneTiles` : combat, cutaway de pièce, enveloppe de façade, étiquettes). */
function ZoneTilesBrush({
  zone,
  tool,
  onArm,
  onChange,
  focusKey,
  port,
}: {
  zone: SceneEffectZone;
  tool: Tool;
  onArm: (zoneId: string, paint: 'add' | 'remove') => void;
  onChange: (z: SceneEffectZone) => void;
  /** Clé du défaut de zone mis en évidence : à chaque CHANGEMENT, le bloc est amené dans le champ. */
  focusKey: string | null;
  /** Conteneur défilable dans lequel le ramener — seul lui bouge. */
  port: RefObject<HTMLElement | null>;
}) {
  const armed = tool.mode === 'zoneTiles' && tool.zoneId === zone.id ? tool.paint : null;
  const blockRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusKey || !blockRef.current || !port.current) return;
    scrollElementIntoPort(blockRef.current, port.current);
  }, [focusKey, port]);
  // Compte des cases RETENUES et compte du CADRE : sur une zone découpée, l'écart chiffre ce que la
  // carte montre déjà en forme (la silhouette peinte, pas le rectangle).
  const retenues = sceneZoneTiles(zone).length;
  const cadre = zoneAreaTiles(zone.area, zone.z).length;
  return (
    <div className="ed-field" ref={blockRef}>
      <span>
        Emprise <em className="de-hint">({retenues} cases{retenues === cadre ? '' : ` sur ${cadre} du cadre`})</em>
      </span>
      <OptionChooser
        layout="seg"
        groupLabel="Pinceau d'emprise"
        options={[
          {
            key: 'add',
            label: <><Icon id="map-tool/paint" size="sm" /> Ajouter</>,
            title: 'Peindre des cases DANS la zone',
            selected: armed === 'add',
            onSelect: () => onArm(zone.id, 'add'),
          },
          {
            key: 'remove',
            label: <><Icon id="map-tool/erase" size="sm" /> Retirer</>,
            title: 'Peindre des cases HORS de la zone',
            selected: armed === 'remove',
            onSelect: () => onArm(zone.id, 'remove'),
          },
        ]}
      />
      <p className="hint">
        {armed
          ? 'Cliquez ou glissez sur la carte : les cases parcourues entrent dans la zone (ou en sortent).'
          : 'Choisissez un sens, puis peignez la forme de la pièce directement sur la carte.'}
      </p>
      {zone.tiles && (
        <button className="btn small" onClick={() => onChange(clearEffectZoneCarve(zone))}>
          Rétablir l'emprise pleine
        </button>
      )}
    </div>
  );
}

/** Picker multi-réf de SceneEntity-personnages (JAMAIS d'id tapé) — source UNIQUE des deux listes
 *  d'équipage d'une coque : les servants d'un poste (ordonnés, `head` = rôle du 1ᵉʳ) et l'équipage
 *  EXPOSÉ à bord (`SceneEntity.crewIds`, sans hiérarchie → pas de ▲). Candidats = autres personnages
 *  de la scène ; `head` absent = aucun rôle de tête inventé. */
function CrewPicker({
  ent,
  scene,
  ids,
  onChange,
  caption,
  head,
  addLabel,
  emptyHint,
  children,
}: {
  ent: SceneEntity;
  scene: Scene;
  ids: string[];
  onChange: (next: string[]) => void;
  caption: ReactNode;
  head?: string;
  addLabel: string;
  emptyHint: string;
  children?: ReactNode;
}) {
  const candidates = scene.entities.filter((e) => e.kind === 'personnage' && e.id !== ent.id);
  const labelOf = (id: string) => {
    const e = scene.entities.find((x) => x.id === id);
    return e ? e.label ?? e.ref ?? e.id : `${id} (supprimé)`;
  };
  const addable = candidates.filter((c) => !ids.includes(c.id));
  return (
    <div className="ed-field">
      <span>{caption}</span>
      {ids.map((id, i) => (
        <div key={`${id}-${i}`} className="de-reflrow">
          <span className="chip" title={head && i === 0 ? head : `Membre ${i + 1}`}>{head && i === 0 ? '★' : i + 1}</span>
          <select value={id} onChange={(e) => onChange(ids.map((c, j) => (j === i ? e.target.value : c)))}>
            {!candidates.some((c) => c.id === id) && <option value={id}>{labelOf(id)}</option>}
            {candidates.map((c) => (
              <option key={c.id} value={c.id} disabled={ids.includes(c.id) && c.id !== id}>
                {c.label ?? c.ref ?? c.id}
              </option>
            ))}
          </select>
          {head && (
            <button className="btn small" title={`Promouvoir (vers : ${head})`} disabled={i === 0} onClick={() => { const n = [...ids]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n); }}>
              ▲
            </button>
          )}
          <button className="btn small danger" title="Retirer de la liste" onClick={() => onChange(ids.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      {addable.length > 0 ? (
        <button className="btn small" onClick={() => onChange([...ids, addable[0].id])}>{addLabel}</button>
      ) : candidates.length === 0 ? (
        <p className="hint">{emptyHint}</p>
      ) : null}
      {ids.length > 0 && children}
    </div>
  );
}

/** Une RANGÉE de l'inventaire du plan : ce qu'on voit, où c'est, et ce que la sélectionner désigne. */
type ContentRow = { key: string; icon: JSX.Element; label: string; at: string; tag?: string; z?: number; sel: Sel };

/** TOUT ce que le plan porte, en UNE liste — entités, zones, points d'entrée, zones de repos.
 *  UNE liste et UN champ de filtre : chercher un élément par son nom ne demande de savoir ni sa
 *  famille, ni quel repli la porte. Une famille de plus s'ajoute ICI, jamais dans une n-ième liste. */
function sceneContent(scene: Scene): ContentRow[] {
  const rows: ContentRow[] = [];
  for (const e of scene.entities)
    rows.push({ key: `ent:${e.id}`, icon: entIcon(e), label: e.label ?? e.ref ?? e.id, at: `(${e.pos.x},${e.pos.y})`, z: e.z, sel: { type: 'entity', id: e.id } });
  (scene.effectZones ?? []).forEach((efz, i) => {
    const r = effectZoneRect(efz.area);
    rows.push({
      key: `zone:${efz.id}`,
      icon: <Icon id="map-tool/zone" size="sm" />,
      label: efz.label || efz.id,
      at: `(${r.x},${r.y})`,
      tag: isDescriptiveZone(efz) ? undefined : 'mécanique',
      z: efz.z,
      sel: { type: 'effectZone', idx: i },
    });
  });
  for (const [name, pos] of Object.entries(scene.entryPoints ?? {}))
    rows.push({ key: `entry:${name}`, icon: <Icon id="nav/entry-point" size="sm" />, label: name, at: `(${pos.x},${pos.y})`, tag: 'entrée', z: pos.z, sel: { type: 'entry', id: name } });
  (scene.restZones ?? []).forEach((z, i) =>
    rows.push({ key: `rest:${i}`, icon: <Icon id="rest/camp" size="sm" />, label: `Repos ${z.rect.w}×${z.rect.h}`, at: `(${z.rect.x},${z.rect.y})`, tag: 'repos', z: z.rect.z, sel: { type: 'restZone', idx: i } }),
  );
  return rows;
}

/** Nom d'AFFICHAGE de chaque partie de relief (#1691) — la logique, elle, ne connaît que les ids. */
const LIBELLE_DE_PARTIE: Record<keyof ReliefDefaults, string> = {
  cliff: 'Falaise (dénivelé infranchissable)',
  ramp: 'Rampe (dénivelé franchissable)',
  deck: 'Dalle de tablier (bord sur le vide)',
  pilier: 'Pilier de tablier',
};

/** Propriétés de la SCÈNE (rien de sélectionné) + inventaire filtrable du plan. */
function SceneProps({
  scene,
  setScene,
  setSel,
  resizeScene,
}: {
  scene: Scene;
  setScene: (s: Scene) => void;
  setSel: (s: Sel) => void;
  resizeScene: (w: number, h: number) => void;
}) {
  const [filter, setFilter] = useState('');
  const content = sceneContent(scene);
  const shown = filterByLabel(content, (row) => `${row.label} ${row.key}`, filter);
  const layerZs = sceneLayerZs(scene);
  const patchStation = (i: number, patch: Partial<SceneStationAnchor>) =>
    setScene({ ...scene, stations: (scene.stations ?? []).map((st, j) => (j === i ? { ...st, ...patch } : st)) });
  // Cibles = Scènes de bataille du CATALOGUE (cf. `battleAnchorTargets`), jamais les Scènes du projet.
  const anchorTargets = battleAnchorTargets();
  const addStation = () =>
    setScene({ ...scene, stations: [...(scene.stations ?? []), { sceneId: anchorTargets[0]!.id, pos: { x: 0, y: 0 } }] });
  const removeStation = (i: number) => {
    const next = (scene.stations ?? []).filter((_, j) => j !== i);
    setScene({ ...scene, stations: next.length ? next : undefined });
  };
  const [newFlagKey, setNewFlagKey] = useState('');
  const flagEntries = Object.entries(scene.flags);
  const addFlag = () => {
    const key = newFlagKey.trim();
    if (!key || key in scene.flags) return;
    setScene(setSceneFlags(scene, { [key]: true }));
    setNewFlagKey('');
  };
  const removeFlag = (key: string) =>
    setScene({ ...scene, flags: Object.fromEntries(flagEntries.filter(([k]) => k !== key)) });
  return (
    <>
      <div className="insp-head">
        <span className="insp-title"><Icon id="file/document" size="sm" /> {scene.label || scene.id}</span>
      </div>
      <Fold title="Identité" open>
        <label className="ed-field">
          Identifiant (référencé par les transitions et la carte du monde)
          <input value={scene.id} onChange={(e) => setScene({ ...scene, id: e.target.value })} />
        </label>
        <label className="ed-field">
          Nom
          <input value={scene.label} onChange={(e) => setScene({ ...scene, label: e.target.value })} />
        </label>
        <label className="ed-field">
          Description (notes d'auteur)
          <textarea value={scene.desc ?? ''} onChange={(e) => setScene({ ...scene, desc: e.target.value })} />
        </label>
        <div className="ed-dim">
          <label>
            L
            <input type="number" value={scene.dimensions.w} min={5} max={40} onChange={(e) => resizeScene(Number(e.target.value) || 5, scene.dimensions.h)} />
          </label>
          <label>
            H
            <input type="number" value={scene.dimensions.h} min={5} max={40} onChange={(e) => resizeScene(scene.dimensions.w, Number(e.target.value) || 5)} />
          </label>
        </div>
      </Fold>
      <Fold title={`Contenu du plan (${content.length})`} open>
        <p className="hint">
          Tout ce que ce plan porte : personnages, décors, pièces et zones, points d'entrée, zones de
          repos. Cliquez une ligne pour l'éditer — la carte suit.
        </p>
        <SearchFilterField icon className="pal-search" placeholder="filtrer…" value={filter} onChange={setFilter} />
        <Stack className="insp-content">
          {shown.map((row) => (
            <ListRow key={row.key} onClick={() => setSel(row.sel)} label={<>{row.icon} {row.label}</>}>
              {row.tag && <span className="chip">{row.tag}</span>}
              <span className="chip">{row.at}</span>
              <LayerChip z={row.z} layers={layerZs} />
            </ListRow>
          ))}
        </Stack>
      </Fold>
      <Fold title="Ambiance & météo">
        <label className="ed-field">
          Ambiance
          <select value={scene.ambiance === 'interieur' ? 'interieur' : 'exterieur'} onChange={(e) => setScene({ ...scene, ambiance: e.target.value as Scene['ambiance'] })}>
            <option value="exterieur">Extérieur (jour/nuit = horloge)</option>
            <option value="interieur">Intérieur (éclairé)</option>
          </select>
        </label>
        <label className="ed-field">
          Échelle (mètres/case)
          <input
            type="number"
            min={1}
            value={sceneMetresPerTile(scene)}
            onChange={(e) => setScene(setMetresPerTile(scene, Math.max(1, Number(e.target.value) || 2)))}
          />
        </label>
        <label className="ed-field">
          Lumière ambiante
          <select value={scene.ambientLight ?? 'auto'} onChange={(e) => setScene(setAmbientLight(scene, e.target.value === 'auto' ? undefined : e.target.value))}>
            <option value="auto">Automatique (suit l'horloge)</option>
            {lightLevels.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </label>
        <label className="ed-field">
          Nord de la carte (degrés horaires ; vide = nord vers le haut du plan)
          {/* Champ VIDABLE : vide → `undefined` → le champ quitte le document. Un `Number(v) || 0`
              écrivait `northDeg: 0` dès le premier effleurement, et rendait le retrait inatteignable. */}
          <input
            type="number"
            min={0}
            max={359}
            step={15}
            value={scene.northDeg ?? ''}
            onChange={(e) => setScene(setNorthDeg(scene, e.target.value === '' ? undefined : Number(e.target.value)))}
          />
        </label>
        <label className="ed-field">
          Environnement (bonus de Domaine Ghyran en rural/sauvage, LDB 48)
          <select value={scene.environment ?? ''} onChange={(e) => setScene(setEnvironment(scene, (e.target.value || undefined) as Scene['environment']))}>
            <option value="">Non spécifié</option>
            <option value="rural">Rural</option>
            <option value="urbain">Urbain</option>
            <option value="sauvage">Sauvage</option>
          </select>
        </label>
        <label className="ed-field">
          Météo
          {/* Vocabulaire ET libellés DE L'ENUM (`sceneWeatherSchema`, `defs-scenes/scene.ts`) : une météo
              ajoutée au schéma s'offre ici le jour même. L'absence est une VALEUR d'authoring — le hub de
              ville ne nomme alors aucune météo, et aucun modificateur de combat ne s'applique. */}
          <select value={scene.weather ?? ''} onChange={(e) => setScene({ ...scene, weather: (e.target.value || undefined) as Scene['weather'] })}>
            <option value="">Non spécifiée</option>
            {Object.entries(valeursDe(sceneWeatherSchema) ?? {}).map(([id, label]) => (
              <option key={id} value={id} title={hintDeValeur(sceneWeatherSchema, id)}>{label}</option>
            ))}
          </select>
        </label>
        <MusicSelect
          label="Musique (ambiance)"
          value={scene.music?.ambient}
          onChange={(v) => {
            const m = { ...scene.music, ambient: v };
            setScene({ ...scene, music: m.ambient === undefined && m.combat === undefined ? undefined : m });
          }}
        />
        <MusicSelect
          label="Musique (combat)"
          value={scene.music?.combat}
          onChange={(v) => {
            const m = { ...scene.music, combat: v };
            setScene({ ...scene, music: m.ambient === undefined && m.combat === undefined ? undefined : m });
          }}
        />
        <label className="ed-field">
          Message d'introduction
          <textarea value={scene.startMessage ?? ''} onChange={(e) => setScene({ ...scene, startMessage: e.target.value || undefined })} />
        </label>
      </Fold>
      <Fold title="Matières de relief">
        <p className="hint">
          Matière peinte sur chaque partie de relief que le plan dessine. Un terrain à bloc plein (mur)
          garde celle de son terrain.
        </p>
        {PARTS_RELIEF.map((part) => (
          <label key={part} className="ed-field">
            {LIBELLE_DE_PARTIE[part]}
            <select
              value={scene.reliefDefaults[part]}
              onChange={(e) => setScene({ ...scene, reliefDefaults: { ...scene.reliefDefaults, [part]: e.target.value } })}
            >
              {matieresDe('relief').map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
        ))}
      </Fold>
      <Fold title="Toiture par défaut">
        <p className="hint">
          Couverture, pente de référence et hauteur de comble des toitures DÉRIVÉES du plan. Un corps
          les surcharge champ par champ, et un corps qui porte un type de bâtiment prend la couverture
          de son type.
        </p>
        <label className="ed-field">
          Couverture
          <select
            value={scene.roofDefaults.material}
            onChange={(e) => setScene(rederiveRoofMasses({ ...scene, roofDefaults: { ...scene.roofDefaults, material: e.target.value } }))}
          >
            {matieresCouvrantes().map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <NumberField
          variant="champ"
          label="Pente de référence (degrés)"
          min={5}
          max={75}
          value={scene.roofDefaults.pitchDeg}
          onChange={(pitchDeg) => setScene(rederiveRoofMasses({ ...scene, roofDefaults: { ...scene.roofDefaults, pitchDeg } }))}
        />
        <NumberField
          variant="champ"
          label="Comble (étages)"
          min={1}
          value={scene.roofDefaults.riseMaxStoreys}
          onChange={(riseMaxStoreys) => setScene(rederiveRoofMasses({ ...scene, roofDefaults: { ...scene.roofDefaults, riseMaxStoreys } }))}
        />
      </Fold>
      <Fold title="Repos sur place">
        <p className="hint">Offre du bouton <Icon id="time/night" size="sm" /> d'exploration, pour TOUT le plan. Affinable par ZONE : outil <Icon id="map-tool/zone" size="sm" /> → Zone de repos, dessinée sur la carte et listée dans le contenu du plan.</p>
        <div className="ed-rest-places">
          {([['auberge', <><Icon id="rest/bed" size="sm" /> Auberge</>], ['maison', <><Icon id="rest/home" size="sm" /> Chez soi</>], ['camp', <><Icon id="rest/camp" size="sm" /> Camper</>]] as const).map(([k, label]) => (
            <label key={k} className="ed-check">
              <input
                type="checkbox"
                checked={(scene.rest ?? { camp: true })[k] ?? false}
                onChange={(e) => setScene({ ...scene, rest: { ...(scene.rest ?? { camp: true }), [k]: e.target.checked } })}
              />
              {label}
            </label>
          ))}
          <label className="ed-check">
            <input
              type="checkbox"
              checked={scene.rest?.quality === 'pietre'}
              onChange={(e) => setScene({ ...scene, rest: { ...(scene.rest ?? { camp: true }), quality: e.target.checked ? 'pietre' : undefined } })}
            />
            <Icon id="resource/gold-purse" size="sm" /> Piètre (½ prix, tambouille à risque)
          </label>
        </div>
      </Fold>
      <Fold title={`Drapeaux de départ (${flagEntries.length})`}>
        <p className="hint">
          État initial lu par les conditions <code>flag</code> (dialogues, déclencheurs) au chargement de
          la scène — jalon déjà posé, événement déjà survenu. Portes/structures/passerelles s'auto-gèrent
          (icônes dédiées) ; ce registre couvre les drapeaux LIBRES d'auteur.
        </p>
        <Stack>
          {flagEntries.map(([key, value]) => (
            <div key={key} className="ed-dim">
              <span className="chip">{key}</span>
              <label className="ed-check">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => setScene(setSceneFlags(scene, { [key]: e.target.checked }))}
                />{' '}
                vrai
              </label>
              <button className="btn small danger" onClick={() => removeFlag(key)}>Retirer</button>
            </div>
          ))}
          <div className="ed-dim">
            <input
              placeholder="nom du drapeau"
              value={newFlagKey}
              onChange={(e) => setNewFlagKey(e.target.value)}
            />
            <button className="btn small" disabled={!newFlagKey.trim() || newFlagKey.trim() in scene.flags} onClick={addFlag}>+ Drapeau</button>
          </div>
        </Stack>
      </Fold>
      {/* Ancres de bataille (`stations[]`) : chaque Scène de la pioche de Puissance de Bataille reçoit
          son emplacement sur ce plan. Sans ancre, le consommateur étale les Scènes en repli
          déterministe — l'auteur n'avait aucun moyen de POSER la sienne autrement qu'en MapSpec (#841 FU-I). */}
      <Fold title={`Ancres de bataille (${(scene.stations ?? []).length})`}>
        <p className="hint">
          Emplacement, sur ce plan, de chaque Scène de bataille de la pioche. Aucune ancre = les Scènes
          sont étalées automatiquement.
        </p>
        <Stack>
          {(scene.stations ?? []).map((st, i) => (
            <div key={i} className="ed-dim">
              <label>
                Scène
                <select
                  value={st.sceneId}
                  onChange={(e) => patchStation(i, { sceneId: e.target.value })}
                >
                  {!anchorTargets.some((t) => t.id === st.sceneId) && <option value={st.sceneId}>{st.sceneId} (hors catalogue)</option>}
                  {anchorTargets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </label>
              {(['x', 'y'] as const).map((key) => (
                <label key={key}>
                  {key.toUpperCase()}
                  <input
                    type="number"
                    min={0}
                    value={st.pos[key] ?? 0}
                    onChange={(e) => patchStation(i, { pos: { ...st.pos, [key]: Number(e.target.value) } })}
                  />
                </label>
              ))}
              <LayerField z={st.pos.z} layers={sceneLayerZs(scene)} onChange={(z) => patchStation(i, { pos: { ...st.pos, z } })} />
              <button className="btn small danger" onClick={() => removeStation(i)}>Retirer</button>
            </div>
          ))}
          <button className="btn small" disabled={!anchorTargets.length} onClick={addStation}>+ Ancre</button>
        </Stack>
      </Fold>
    </>
  );
}
