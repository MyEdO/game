import type { JSX } from 'react';
/**
 * Inspecteur v2 — volet droit DOCKÉ (fini la modale du POC qui masquait le canvas) :
 * la sélection s'édite EN PLACE, en sections repliables `.fold`, pendant que la carte reste
 * visible. Rien de sélectionné → PROPRIÉTÉS DE LA SCÈNE (identité, dimensions, ambiance,
 * musique, repos, points d'entrée) + liste filtrable du contenu (sélection au clic).
 * Composant de PRÉSENTATION : la scène et la sélection vivent dans Editor.
 */
import { useEffect, useRef, useState, type ComponentProps, type ReactNode, type RefObject } from 'react';
import {
  Scene,
  SceneEntity,
  Trigger,
  SceneEffectZone,
  WallSeg,
  type ActionAuthoree,
  type ArchitectureBody,
  type ArchitecturePart,
  type ArchitectureStorey,
  type FacadeSection,
  type BuildingMass,
  type RoofDefaults,
  type ArchitectureRect,
  type SceneStationAnchor,
  type FaceDArete,
  type WallSecret,
  isDescriptiveZone,
  idDuCorps,
  porteAuteur,
  reposDeScene,
  sceneMetresPerTile,
  secretAuteur,
} from '../../noyau/monde/scene';
import type { NarratifBlock } from '../../data/schemas/defs-scenes/narratif';
import { isRoomZone } from '../../noyau/monde/rooms';
import { PARTS_RELIEF } from '../../data/materials.types';
import { useVersionDesDatasets } from '../useVersionDesDatasets';
import { NumberField } from '../NumberField';
import { ProseField } from '../ProseField';
import { ProvenanceDuTexte } from './ProvenanceDuTexte';
import { EntryRename } from './EntryRename';
import { useClesDeRangees } from '../useClesDeRangees';
import { TIME_COST } from '../../engine/timeCost';
import { sceneZoneTiles, zoneAreaTiles } from '../../noyau/monde/zones';
import type { WorldMap } from '../../noyau/worldMap';
import { nomDEntite } from '../../noyau/monde/sceneNpc';
import { presetDuNarratif, objetDuNarratif } from '../../noyau/monde/resolveursDuNarratif';
import type { Settlement } from '../../data/schemas/grammaire/valeurs';
import { roleAmbiantSchema } from '../../data/schemas/grammaire/valeurs';
import { decorsDuCatalogue } from '../../gameIso/catalog/decor';
import { buildingsMeta } from '../../noyau/monde/buildings';
import { FACADE_APPEARANCE_IDS } from '../../noyau/monde/facades';
import { TAVERN_GAMES } from '../../engine/tavernGame';
import { allMusicDefs } from '../../data/sons/musique';
import {
  findCreatureById,
  creatureLabel,
  lightLevels,
  lightTones,
  findPropById,
  matieresCouvrantes,
  matieresDe,
  structureAppearances,
  siegeEngines,
  libelleDAuteur,
  MERCHANT_ARCHETYPES,
} from '../../data';
import {
  renameActionAuthoree,
  toitureEffective,
  TypeNonNomme,
  changePropRef,
  deleteSel,
  renameEntry,
  renameEffectZone,
  addMember,
  removeMember,
  patchMember,
  setEffectZoneArea,
  clearEffectZoneCarve,
  setPosteCrew,
  setPosteSide,
  setPosteEngine,
  editEntity,
  editEntityCombat,
  patchWall,
  setNorthDeg,
  setSceneFlags,
  removeSceneFlag,
  setSceneScalaires,
  setSceneLabel,
  renameScene,
  editEntry,
  addStation,
  patchStation,
  removeStation,
  setSceneMusic,
  setStartMessageTexte,
  patchStartMessage,
  setReliefDefault,
  patchSceneRoofDefaults,
  setSceneRest,
  patchTrigger,
  patchRestZone,
  patchZone,
  replaceEffectZone,
  patchArchitectureBody,
  poseToitureDuCorps,
  addRoofExclusion,
  patchRoofExclusion,
  removeRoofExclusion,
  patchArchitectureStorey,
  patchArchitecturePart,
  patchFacadeSection,
  setFacadeSectionZ,
  patchBuildingMass,
  addFacadeFeature,
  patchFacadeFeature,
  removeFacadeFeature,
  BORNES_D_OUVERTURE,
} from '../../noyau/sceneEdit';
import { ciblesDAncreDeBataille } from '../../noyau/massBattleFlow';
import { hintDeValeur, libelleDeValeur, optionsDuNoeud } from '../../data/schemas/grammaire/meta';
import { idsDe } from '../../data/schemas/grammaire/ref';
import { amateurSchema } from '../../data/schemas/grammaire/valeurs';
import {
  entityKindSchema,
  facadeFeatureKindSchema,
  faceDAreteSchema,
  roofProfileSchema,
  sceneEffectZoneSchema,
  sceneSchema,
  sceneWeatherSchema,
  type ReliefDefaults,
} from '../../data/schemas/defs-scenes/scene';

import { ApparencesObjetsField, ReglagesApparence } from './ReglagesApparence';
import { armesDEntite, equipementDAuteurDe } from '../../noyau/equipementDessine';
import { effectCtxOf } from './EffectList';
import { ListeDIds, RefNarrativeField } from '../compendium/refField/RefField';
import { GameOpEditor } from './GameOpEditor';
import { FlowEditor, TestFields } from './FlowEditor';
import { actionsDe, actionNeuve } from '../../noyau/monde/usable';
import { StatblockEditor } from './StatblockEditor';
import { emptyStatblock } from '../../data/valeursNeuves';
import { CreatureProfile, OptionalTraitsPicker, SpellsField } from './OptionalTraitsPicker';
import { SeatAssignmentsField } from './SeatAssignmentsField';
import { type Sel, type Tool, capDeLEntite, capsOfferts, effectZoneRect, lumiereAllumee, effectZoneArea, flowEffectCount } from '../../noyau/sceneEditLecture';
import { scrollElementIntoPort } from './useEditorView';
import type { FireArc, StructureData, NavalTraitRef } from '../../engine/types';
import { DIFFICULTE_PAR_DEFAUT, DIFFICULTY_LABELS, type Difficulty } from '../../engine/types';
import { isWallEdgeStructure, isDoorEdgeStructure } from '../../engine/structures';
import { RefField } from '../compendium/refField/RefField';
import { SearchFilterField, filterByLabel } from '../SearchFilterField';
import { Icon } from '../Icon';
import type { IconId } from '../../data/icons';
import { ListRow } from '../ListRow';
import { OptionChooser } from '../OptionChooser';
import { LayerField, LayerChip, sceneLayerZs } from './LayerField';
import { t } from '../../i18n';
import { propFootTiles } from '../../noyau/monde/footprint';
import { Row, Stack } from '../Layout';
import { ChipDeRefus } from '../ChipDeRefus';
import { CouvreField } from './CouvreField';


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

const ENT_ICON: Record<string, IconId> = { heroStart: 'outil-de-carte/depart', personnage: 'outil-de-carte/personnage', prop: 'outil-de-carte/decor' };
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
  const efz = sel?.type === 'effectZone' ? scene.effectZones?.find((z) => z.id === sel.id) ?? null : null;
  // Identité STABLE de la zone sélectionnée : elle survit au renommage de son id (`EntryRename`).
  const clesZones = useClesDeRangees(scene.effectZones);
  const cleZone = sel?.type === 'effectZone' ? clesZones[(scene.effectZones ?? []).findIndex((z) => z.id === sel.id)] : undefined;
  const setEfz = (z: SceneEffectZone) => {
    if (sel?.type !== 'effectZone') return;
    setScene(replaceEffectZone(scene, sel.id, z));
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
    isRoomZone(zone)
    && selectedArchitectureZ !== undefined
    && (zone.z ?? 0) === selectedArchitectureZ);
  const patchSelW = (patch: Partial<WallSeg>) => {
    if (sel?.type !== 'wall') return;
    setScene(patchWall(scene, sel.x, sel.y, sel.side, sel.z, patch));
  };
  // BROUILLON d'arête : ce que le schéma EXIGE de l'auteur sans valeur par défaut (`wallSegSchema` —
  // `secret.difficulty`/`secret.face`, `LDB 12 l.137` ; `allege`, arbitrage #700 du 2026-10-04) se
  // choisit ICI, hors de la Scène, et ne s'y écrit qu'entier : la Scène reste valide, l'état incomplet
  // est NOMMÉ. Lié à l'arête où il a été ouvert.
  const cleSelW = sel?.type === 'wall' ? `${sel.x},${sel.y},${sel.side},${sel.z}` : null;
  // `allegeVide` : le champ d'allège vidé sur une croisée DÉJÀ franchissable — la Scène garde sa croisée
  // (allège et `suspendu` compris) tant qu'une nouvelle valeur n'est pas saisie.
  type BrouillonW = { crossable?: true; allegeVide?: true; secret?: Partial<WallSecret> };
  const [brouillonW, setBrouillonW] = useState<BrouillonW & { cle: string } | null>(null);
  const brouillon = brouillonW && brouillonW.cle === cleSelW ? brouillonW : null;
  const brouillonner = (patch: BrouillonW) => {
    if (cleSelW) setBrouillonW({ ...(brouillon ?? {}), ...patch, cle: cleSelW });
  };
  const choisirSecret = (secret: Partial<WallSecret>) => {
    if (secret.difficulty && secret.face) {
      patchSelW({ secret: { difficulty: secret.difficulty, face: secret.face }, closed: true });
      brouillonner({ secret: undefined });
    } else brouillonner({ secret });
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
  const updateSelT = (patch: Partial<Trigger>) => {
    if (selT) setScene(patchTrigger(scene, selT.id, patch));
  };
  const updateZone = (patch: Partial<NonNullable<Scene['restZones']>[number]>) => {
    if (sel?.type !== 'restZone') return;
    setScene(patchRestZone(scene, sel.idx, patch));
  };
  // Toute écriture d'un corps passe par son écrivain du noyau : l'INTENTION de toiture (type, surcharge,
  // exclusions) re-dérive les masses dans le geste (`rederiveRoofMasses`) — le rendu ne lit que les masses
  // matérialisées (#829/#841) —, et chaque emprise est plafonnée à la carte.
  // Ce que la dérivation appliquerait MAINTENANT à ce corps : surcharge du corps, sinon couverture de
  // son TYPE de bâtiment, sinon toiture de la scène (#1715).
  const toiture = architectureBody ? toitureEffective(scene, architectureBody) : null;
  const poseToiture = (champ: keyof RoofDefaults, valeur: RoofDefaults[keyof RoofDefaults] | undefined) => {
    if (architectureBody) setScene(poseToitureDuCorps(scene, architectureBody.id, champ, valeur));
  };
  const patchExclusion = (i: number, patch: Partial<{ z: number; rect: ArchitectureRect }>) => {
    if (architectureBody) setScene(patchRoofExclusion(scene, architectureBody.id, i, patch));
  };
  const addExclusion = () => {
    if (architectureBody) setScene(addRoofExclusion(scene, architectureBody.id, architectureStorey?.z ?? 0, { x: 0, y: 0, w: 2, h: 2 }));
  };
  const removeExclusion = (i: number) => {
    if (architectureBody) setScene(removeRoofExclusion(scene, architectureBody.id, i));
  };
  const patchBody = (patch: Partial<Pick<ArchitectureBody, 'label' | 'style'>>) => {
    if (architectureBody) setScene(patchArchitectureBody(scene, architectureBody.id, patch));
  };
  const updateArchitectureStorey = (patch: Partial<ArchitectureStorey>) => {
    if (architectureBody && architectureStorey) setScene(patchArchitectureStorey(scene, architectureBody.id, architectureStorey.id, patch));
  };
  const updateArchitecturePart = (patch: Partial<ArchitecturePart>) => {
    if (architectureBody && architectureStorey && architecturePart) setScene(patchArchitecturePart(scene, architectureBody.id, architectureStorey.id, architecturePart.id, patch));
  };
  const updateFacadeSection = (patch: Partial<FacadeSection>) => {
    if (architectureBody && facadeSection) setScene(patchFacadeSection(scene, architectureBody.id, facadeSection.id, patch));
  };
  const patchFeature = (featureId: string, patch: Parameters<typeof patchFacadeFeature>[4]) => {
    if (architectureBody && facadeSection) setScene(patchFacadeFeature(scene, architectureBody.id, facadeSection.id, featureId, patch));
  };
  const updateRoofSection = (patch: Partial<BuildingMass>) => {
    if (architectureBody && roofSection) setScene(patchBuildingMass(scene, architectureBody.id, roofSection.id, patch));
  };
  const removeSel = () => {
    setScene(deleteSel(scene, sel));
    setSel(null);
  };

  const title = ent
    ? <>{entIcon(ent)} {nomDEntite(ent, presetDuNarratif(narratif)) ?? libelleDeValeur(entityKindSchema, ent.kind)}</>
    : selT
        ? <><Icon id="outil-de-carte/zone" size="sm" /> {selT.id}</>
        : zone
          ? <><Icon id="repos/campement" size="sm" /> Zone de repos</>
          : efz
            ? <><Icon id="interface/attention" size="sm" /> {efz.label || 'Piège'}</>
            : selW
              ? (porteAuteur(selW) ? <><Icon id="outil-de-carte/porte" size="sm" /> Porte</> : <><Icon id="outil-de-carte/mur" size="sm" /> Cloison</>)
              : entry
                ? <><Icon id="navigation/point-d-entree" size="sm" /> {sel?.type === 'entry' ? sel.id : ''}</>
                : sel?.type === 'architectureBody' && architectureBody
                  ? <><Icon id="repos/chez-soi" size="sm" /> {architectureBody.label ?? architectureBody.id}</>
                  : sel?.type === 'architectureStorey' && architectureStorey
                    ? <><Icon id="repos/chez-soi" size="sm" /> {architectureStorey.id}</>
                : architecturePart
                  ? <><Icon id="repos/chez-soi" size="sm" /> {architecturePart.id}</>
                  : facadeSection
                    ? <><Icon id="outil-de-carte/mur" size="sm" /> {facadeSection.id}</>
                    : roofSection
                      ? <><Icon id="repos/chez-soi" size="sm" /> {roofSection.id}</>
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

          {ent && refusPatch?.id === ent.id && <ChipDeRefus refus={{ message: refusPatch.message }} />}
          {ent && <EntityPanel ent={ent} scene={scene} otherScenes={otherScenes} worldMap={worldMap} narratif={narratif} setScene={setScene} updateSel={updateSel} removeSel={removeSel} />}

          {sel?.type === 'architectureBody' && architectureBody && toiture && (
            <>
              <Fold title="Corps" open>
                <label className="ed-field">
                  Libellé
                  <input
                    value={architectureBody.label ?? ''}
                    onChange={(event) => patchBody({ label: event.target.value || undefined })}
                  />
                </label>
                <label className="ed-field">
                  Type de bâtiment
                  <select
                    value={architectureBody.style?.id ?? ''}
                    onChange={(event) => patchBody({ style: event.target.value ? { id: event.target.value } : undefined })}
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
                  Appliqué en l'état : {matieresCouvrantes().find((m) => m.id === toiture.material.id)?.label ?? toiture.material.id},
                  pente de référence {toiture.penteReference}°, comble {toiture.riseMaxStoreys} étage{toiture.riseMaxStoreys > 1 ? 's' : ''}.
                </p>
                <label className="ed-field">
                  Profil
                  <select
                    value={architectureBody.roofDefaults?.profile ?? ''}
                    onChange={(event) => poseToiture('profile', (event.target.value || undefined) as RoofDefaults['profile'])}
                  >
                    <option value="" />
                    {optionsDuNoeud(roofProfileSchema).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
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
                    value={architectureBody.roofDefaults?.material?.id ?? ''}
                    onChange={(event) => poseToiture('material', event.target.value ? { id: event.target.value } : undefined)}
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
                        onChange={(event) => updateArchitecturePart({ foot: { ...architecturePart.foot, [key]: Number(event.target.value) || 0 } })}
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
                  onChange={(z) => architectureBody && setScene(setFacadeSectionZ(scene, architectureBody.id, facadeSection.id, z))}
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
                          onChange={(event) => patchFeature(feature.id, { kind: event.target.value as typeof feature.kind })}
                        >
                          {optionsDuNoeud(facadeFeatureKindSchema).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                        </select>
                      </label>
                      <label className="ed-field">
                        Apparence (id)
                        <input
                          value={feature.appearance ?? ''}
                          onChange={(event) => patchFeature(feature.id, { appearance: event.target.value || undefined })}
                        />
                      </label>
                      <div className="ed-dim">
                        {([
                          ['offset', 'Position', 'Position du centre le long de l’arête (0 = début, 1 = fin). Vide = défaut de rendu.'],
                          ['width', 'Largeur', 'Largeur de l’ouverture en fraction de l’arête. Vide = défaut de rendu.'],
                        ] as const).map(([key, lab, title]) => (
                          <label key={key} title={title}>
                            {lab}
                            <input
                              type="number"
                              min={BORNES_D_OUVERTURE[key].min}
                              max={BORNES_D_OUVERTURE[key].max}
                              step={0.05}
                              value={feature[key] ?? ''}
                              placeholder="défaut"
                              onChange={(event) => patchFeature(feature.id, { [key]: event.target.value === '' ? undefined : Number(event.target.value) })}
                            />
                          </label>
                        ))}
                      </div>
                      <button className="btn small danger" onClick={() => architectureBody && setScene(removeFacadeFeature(scene, architectureBody.id, facadeSection.id, feature.id))}>Retirer</button>
                    </Stack>
                  ))}
                  <button
                    className="btn small"
                    disabled={!facadeSection.edges[0]}
                    onClick={() => {
                      const out = architectureBody && addFacadeFeature(scene, architectureBody.id, facadeSection.id);
                      if (out) setScene(out.scene);
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
                  <input type="number" min={1} step={1} value={roofSection.levels} onChange={(event) => updateRoofSection({ levels: Number(event.target.value) })} />
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
                              const next = { ...part, [key]: Number(event.target.value) || 0 };
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
                    updateRoofSection({ footprint: [...roofSection.footprint, { x: (last?.x ?? 0) + (last?.w ?? 1), y: last?.y ?? 0, w: 1, h: 1 }] });
                  }}
                >
                  Ajouter une partie
                </button>
                <label className="ed-field">
                  Profil
                  <select value={roofSection.profile} onChange={(event) => updateRoofSection({ profile: event.target.value as BuildingMass['profile'] })}>
                    {optionsDuNoeud(roofProfileSchema).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
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
                  <input type="number" min={5} max={75} step={1} value={roofSection.pitchDeg} onChange={(event) => updateRoofSection({ pitchDeg: Number(event.target.value) })} />
                </label>
                <label className="ed-field">
                  Matériau
                  <select value={roofSection.material.id} onChange={(event) => updateRoofSection({ material: { id: event.target.value } })}>
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
            <Fold title={<><Icon id="action/attaquer" size="sm" /> Combat</>}>
              <p className="hint">Donne à ce personnage un rôle de COMBAT : profil, traits, et rattachement à une ou plusieurs rencontres. Un embusqué reste invisible jusqu'au combat.</p>
              <label className="ed-check">
                <input
                  type="checkbox"
                  checked={!!ent.combat?.hiddenUntilCombat}
                  onChange={(e) => updateSelCombat({ hiddenUntilCombat: e.target.checked || undefined })}
                />{' '}
                <Icon id="drapeau/embusque" size="sm" /> Embusqué (invisible hors combat)
              </label>
              {/* #1882 : le preset SEUL porteur de fiche ne se retire pas (`PORTEURS_DU_TYPE`). */}
              <RefNarrativeField
                cle="presetId"
                narratif={narratif}
                label="Preset PNJ (bloc Narratif du projet)"
                value={ent.presetId}
                onChange={(presetId) => updateSel({ presetId })}
                nullable
                aucunIneligible={idDuCorps(ent) === undefined && !ent.statblock}
              />
              {ent.presetId && ent.statblock && (
                <p className="hint" style={{ color: 'var(--danger)' }}>
                  Preset PNJ ET profil personnalisé présents — le preset prime (`sceneNpc.ts`,
                  `porteurDeFiche`) : le profil ci-dessous est ignoré tant que le preset reste renseigné.
                </p>
              )}
              {ent.statblock ? (
                <>
                  <StatblockEditor chemin={`${ent.id}/statblock`} stat={ent.statblock} onChange={(sb) => updateSel({ statblock: sb })} />
                  {/* #1882 : quitter le profil personnalisé NOMME la fiche qui le remplace, dans le même geste. */}
                  {ent.creature !== undefined ? (
                    <button className="btn small" onClick={() => updateSel({ statblock: undefined })}>↩ Revenir à la fiche du bestiaire ({creatureLabel(ent.creature.id)})</button>
                  ) : (
                    <label className="ed-field">
                      Remplacer par une fiche du bestiaire
                      <select value="" onChange={(e) => { const cid = e.target.value; updateSel({ statblock: undefined, creature: { id: cid } }); }}>
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
                    <select value={ent.creature?.id ?? ''} onChange={(e) => { const cid = e.target.value; updateSel({ creature: { id: cid }, vehicule: undefined, engin: undefined }); }}>
                      {ent.creature === undefined && <option value="" disabled>— fiche —</option>}
                      {enemyCreatures.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </label>
                  {(() => {
                    const cr = findCreatureById(ent.creature?.id);
                    if (!cr) return null;
                    return (
                      <>
                        <CreatureProfile creature={cr} />
                        <OptionalTraitsPicker creature={cr} value={ent.combat?.optionals} onChange={(optionals) => updateSelCombat({ optionals })} />
                        <SpellsField value={ent.combat?.spells} onChange={(spells) => updateSelCombat({ spells })} />
                        <RefField
                          cfg={{ ds: 'skills', value: true, spec: true }}
                          fieldKey="Compétences ajoutées (fusionnées à celles du bestiaire au spawn)"
                          value={ent.combat?.skills ?? []}
                          onChange={(v) => {
                            const skills = (v as { id: string; spec?: string; value?: number }[]).map((r) => ({ ...r, value: r.value ?? 0 }));
                            updateSelCombat({ skills: skills.length ? skills : undefined });
                          }}
                        />
                        <label className="ed-check" title="LDB 77 l.108 : « soustrayez -10 et ajoutez 2d10 ». Tirage stable au spawn (rejouable).">
                          <input
                            type="checkbox"
                            checked={ent.combat?.randomChars ?? false}
                            onChange={(e) => updateSelCombat({ randomChars: e.target.checked || undefined })}
                          />{' '}
                          <Icon id="navigation/des" size="sm" /> Caractéristiques aléatoires (LDB 77 l.108 : −10 + 2d10)
                        </label>
                      </>
                    );
                  })()}
                  <button className="btn small" onClick={() => updateSel({ statblock: emptyStatblock(nomDEntite(ent, presetDuNarratif(narratif))) })}><Icon id="interface/reglages" size="sm" /> Profil personnalisé…</button>
                </>
              )}
              <div className="mini-title">Rencontres</div>
              {scene.encounters.length === 0 && <p className="hint">Aucune rencontre — l'outil <Icon id="action/attaquer" size="sm" /> en crée une, ou utilisez le dock Logique.</p>}
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
                        value={m.side ?? 'ennemi'}
                        onChange={(e) => {
                          const ally = e.target.value === 'allie';
                          setScene(patchMember(scene, enc.id, ent.id, { side: ally ? 'allie' : undefined, ai: ally ? m.ai : undefined }));
                        }}
                      >
                        <option value="ennemi">Ennemi</option>
                        <option value="allie">Allié</option>
                      </select>
                    )}
                    {m?.side === 'allie' && (
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

          {ent && (!!ent.postes?.length || !!ent.vehicule) && <EmplacementFold ent={ent} scene={scene} setScene={setScene} />}

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
                <LayerField z={selT.rect.z} layers={sceneLayerZs(scene)} onChange={(z) => setScene(patchZone(scene, sel, { z }))} />
              </Fold>
              <div className="insp-actions">
                <button className="btn small btn-primary" onClick={() => openLogic('triggers', selT.id)}>
                  <Icon id="interface/reglages" size="sm" /> Effets ({flowEffectCount(selT.flow)})…
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
                <LayerField z={zone.rect.z} layers={sceneLayerZs(scene)} onChange={(z) => setScene(patchZone(scene, sel, { z }))} />
                <div className="ed-rest-places">
                  {([['auberge', <><Icon id="repos/lit" size="sm" /> Auberge</>], ['maison', <><Icon id="repos/chez-soi" size="sm" /> Chez soi</>], ['camp', <><Icon id="repos/campement" size="sm" /> Camper</>]] as const).map(([k, label]) => (
                    <label key={k} className="ed-check">
                      <input type="checkbox" checked={zone.places[k] ?? false} onChange={(e) => updateZone({ places: { ...zone.places, [k]: e.target.checked } })} />
                      {label}
                    </label>
                  ))}
                  <label className="ed-check">
                    <input type="checkbox" checked={zone.quality === 'pietre'} onChange={(e) => updateZone({ quality: e.target.checked ? 'pietre' : undefined })} />
                    <Icon id="ressource/bourse" size="sm" /> Piètre (½ prix, tambouille à risque)
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
                <Fold title={isRoomZone(efz) ? 'Pièce' : 'Zone'} open>
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
                  <EntryRename label={efz.id} caption="Identifiant (référencé par les façades — « Pièces révélées »)" onRename={(next) => {
                    const out = renameEffectZone(scene, efz.id, next);
                    if (out !== scene) {
                      setScene(out);
                      setSel({ type: 'effectZone', id: next.trim() });
                    }
                  }} />
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
                  <LayerField z={efz.z} layers={sceneLayerZs(scene)} onChange={(z) => setScene(patchZone(scene, sel, { z }))} />
                  <ZoneTilesBrush zone={efz} tool={tool} onArm={armZoneTiles} onChange={setEfz} focusKey={zoneFocusKey} port={panelRef} />
                  <CouvreField value={efz.couvre} sujet="de la zone" onChange={(couvre) => setEfz({ ...efz, couvre })} />
                </Fold>
                {/* Une zone est DESCRIPTIVE tant qu'elle ne porte AUCUN de ces cinq champs, et MÉCANIQUE dès
                    qu'elle en porte un (`isDescriptiveZone`) : ce n'est pas un genre à choisir, c'est l'état
                    que l'appareil ci-dessous décrit. Il s'ouvre donc sur les zones qui agissent, et se
                    présente REPLIÉ — armable en un clic — sur celles qui ne font que nommer un lieu. */}
                <Fold key={cleZone} title={<><Icon id="interface/attention" size="sm" /> Piège / zone d'effet</>} open={!isDescriptiveZone(efz)}>
                  <p className="hint">
                    Tout combattant qui TRAVERSE ou STATIONNE dans la zone y subit ce qui suit (en combat). Une
                    pièce reste un simple nom de lieu tant que rien n'est posé ici.
                  </p>
                  <div className="mini-title"><Icon id="ressource/mouvement" size="sm" /> À la traversée (effets mécaniques)</div>
                  <p className="hint">Dégâts mitigés BE+PA : op « Blessures », forme Dés, puis cocher « déduit BE / PA ». État entretenu : op « Poser un État » + paramètre <code>unlessCondition</code> (= le même État).</p>
                  <GameOpEditor ops={efz.onCross ?? []} onChange={(onCross) => setEfz({ ...efz, onCross: onCross.length ? onCross : undefined })} />
                  <div className="mini-title"><Icon id="interface/attendre" size="sm" /> Au stationnement (chaque round)</div>
                  <GameOpEditor ops={efz.perRound ?? []} onChange={(perRound) => setEfz({ ...efz, perRound: perRound.length ? perRound : undefined })} />
                  <label className="ed-check">
                    <input
                      type="checkbox"
                      checked={!!efz.crossTest}
                      onChange={(e) => setEfz({ ...efz, crossTest: e.target.checked ? { skill: { id: '' }, difficulty: 'intermediaire', requireSL: 0 } : undefined })}
                    />
                    <Icon id="navigation/des" size="sm" /> Test requis pour franchir (piège/hasard GATÉ)
                  </label>
                  {efz.crossTest && <TestFields test={efz.crossTest} onChange={(crossTest) => setEfz({ ...efz, crossTest })} />}
                  <label className="ed-check">
                    <input type="checkbox" checked={!!efz.blocksLoS} onChange={(e) => setEfz({ ...efz, blocksLoS: e.target.checked || undefined })} />
                    <Icon id="interface/oeil" size="sm" /> Masque la ligne de vue (fumée, ténèbres)
                  </label>
                  <label className="ed-check">
                    <input type="checkbox" checked={!!efz.barrier} onChange={(e) => setEfz({ ...efz, barrier: e.target.checked ? { blockGroups: efz.barrier?.blockGroups } : undefined })} />
                    <Icon id="mecanique/protection" size="sm" /> Barrière infranchissable (mur magique, cercle de ward)
                  </label>
                  {efz.barrier && (
                    <ListeDIds
                      noeud={sceneEffectZoneSchema.shape.barrier.unwrap().shape.blockGroups}
                      label="Bloque les groupes (vide = tout le monde)"
                      value={efz.barrier.blockGroups}
                      onChange={(blockGroups) => setEfz({ ...efz, barrier: { blockGroups } })}
                    />
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
              <Fold title={porteAuteur(selW) ? <><Icon id="outil-de-carte/porte" size="sm" /> Porte</> : <><Icon id="outil-de-carte/mur" size="sm" /> Cloison</>} open>
                <p className="hint">Arête @ ({sel.x},{sel.y}) {sel.side}{sel.z ? ` · étage ${sel.z}` : ''}.</p>
                <div className="ed-field">
                  <span>Type</span>
                  <Row>
                    <button className="btn small" aria-pressed={!porteAuteur(selW)} title="Cloison pleine (bloque vue et passage)" onClick={() => patchSelW({ door: undefined, closed: undefined })}>
                      ▮ Cloison
                    </button>
                    <button className="btn small" aria-pressed={porteAuteur(selW)} title="Arête franchissable (porte)" onClick={() => { patchSelW({ door: true, window: undefined, shuttered: undefined, crossable: undefined, allege: undefined, suspendu: undefined }); brouillonner({ crossable: undefined, allegeVide: undefined }); }}>
                      <Icon id="outil-de-carte/porte" size="sm" /> Porte
                    </button>
                  </Row>
                </div>
                {porteAuteur(selW) && (
                  <label className="ed-check" title={secretAuteur(selW) ? 'Une porte secrète est fermée au départ : décochez d’abord « Porte secrète »' : undefined}>
                    <input type="checkbox" checked={!!selW.closed} disabled={!!secretAuteur(selW)} onChange={(e) => patchSelW({ closed: e.target.checked || undefined })} />
                    <Icon id="interface/verrou" size="sm" /> Fermée au départ
                  </label>
                )}
                {porteAuteur(selW) && (
                  <label className="ed-check" title="Masquée en jeu tant qu'elle n'est pas découverte (EDO 08 l.404)">
                    <input type="checkbox" checked={!!(secretAuteur(selW) ?? brouillon?.secret)} onChange={(e) => { if (e.target.checked) brouillonner({ secret: {} }); else { patchSelW({ secret: undefined }); brouillonner({ secret: undefined }); } }} />
                    Porte secrète
                  </label>
                )}
                {(() => {
                  const secret: Partial<WallSecret> | undefined = secretAuteur(selW) ?? brouillon?.secret;
                  if (!porteAuteur(selW) || !secret) return null;
                  const etat = secret.difficulty && secret.face ? null : 'Porte secrète incomplète — choisissez sa difficulté de Perception et sa face découvrable';
                  return (
                    <>
                      <div className="ed-field">
                        <span>Difficulté de Perception</span>
                        <select value={secret.difficulty ?? ''} aria-invalid={!secret.difficulty || undefined} onChange={(e) => choisirSecret({ ...secret, difficulty: e.target.value as Difficulty })}>
                          {!secret.difficulty && <option value="" disabled>— à choisir —</option>}
                          {Object.entries(DIFFICULTY_LABELS).map(([k, lbl]) => (<option key={k} value={k}>{lbl}</option>))}
                        </select>
                      </div>
                      <div className="ed-field" title="EDO 07 l.263 : une porte secrète peut n'être découvrable que d'un côté">
                        <span>Découvrable depuis</span>
                        <select value={secret.face ?? ''} aria-invalid={!secret.face || undefined} onChange={(e) => choisirSecret({ ...secret, face: e.target.value as FaceDArete })}>
                          {!secret.face && <option value="" disabled>— à choisir —</option>}
                          {optionsDuNoeud(faceDAreteSchema).map(([k, lbl]) => (<option key={k} value={k}>{lbl}</option>))}
                        </select>
                      </div>
                      {etat && <ChipDeRefus fixe refus={{ message: etat }} />}
                    </>
                  );
                })()}
                {!porteAuteur(selW) && (
                  <label className="ed-check">
                    <input type="checkbox" checked={!!selW.window} onChange={(e) => { patchSelW({ window: e.target.checked || undefined }); if (!e.target.checked) brouillonner({ crossable: undefined, allegeVide: undefined }); }} />
                    Fenêtre
                  </label>
                )}
                {!porteAuteur(selW) && selW.window && (
                  <label className="ed-check" title="Une croisée laisse passer la vue, pas le pas ; volets clos, elle coupe la vue">
                    <input type="checkbox" checked={!!selW.shuttered} onChange={(e) => patchSelW({ shuttered: e.target.checked || undefined })} />
                    Volets clos (coupe la vue)
                  </label>
                )}
                {!porteAuteur(selW) && selW.window && (
                  <label className="ed-check" title="Geste explicite (LDB 15 l.82 pour sauter, LDB 15 l.55 pour enjamber son allège) ; le déplacement reste bloqué">
                    <input type="checkbox" checked={!!(selW.crossable || brouillon?.crossable)} onChange={(e) => { if (e.target.checked) brouillonner({ crossable: true }); else { patchSelW({ crossable: undefined }); brouillonner({ crossable: undefined, allegeVide: undefined }); } }} />
                    Franchissable (enjamber / sauter)
                  </label>
                )}
                {!porteAuteur(selW) && selW.window && (selW.crossable || brouillon?.crossable) && (() => {
                  const allegeSaisie = brouillon?.allegeVide ? undefined : selW.allege;
                  return (
                  <>
                    <NumberField
                      variant="champ"
                      label="Hauteur d’allège (m)"
                      title="LDB 15 l.55 — enjambée à mi-vitesse, sans Test"
                      min={0}
                      step={0.1}
                      vide
                      invalide={allegeSaisie === undefined}
                      describedBy={allegeSaisie === undefined ? 'insp-allege-etat' : undefined}
                      value={allegeSaisie ?? null}
                      onChange={(allege) => {
                        if (allege === null) { if (selW.crossable) brouillonner({ allegeVide: true }); return; }
                        patchSelW({ crossable: true, allege });
                        brouillonner({ crossable: undefined, allegeVide: undefined });
                      }}
                    />
                    {allegeSaisie === undefined && <ChipDeRefus fixe id="insp-allege-etat" refus={{ message: 'Croisée franchissable sans hauteur d’allège — saisissez-la' }} />}
                  </>
                  );
                })()}
                {!porteAuteur(selW) && selW.window && selW.crossable && (
                  <NumberField
                    variant="champ"
                    label="Chute si l’on se suspend d’abord (m)"
                    title="EDO 01 l.231 — vide : pas de suspension offerte ; offerte au saut seulement sous la hauteur réelle"
                    min={0.5}
                    step={0.5}
                    vide
                    value={selW.suspendu ?? null}
                    onChange={(suspendu) => patchSelW({ suspendu: suspendu ?? undefined })}
                  />
                )}
                <RefField
                  cfg={{
                    ds: 'structures',
                    single: true,
                    filter: (e) => (porteAuteur(selW) ? isDoorEdgeStructure(e as unknown as StructureData) : isWallEdgeStructure(e as unknown as StructureData)),
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
                <p className="hint">Posée, l'arête tient (bloque vue + passage) jusqu'à être abattue en combat ; elle devient alors une brèche franchissable. « — (aucun) — » = pas de structure. La HAUTEUR d'un rempart se peint désormais à l'outil <Icon id="outil-de-carte/hauteur" size="sm" /> (hauteur des cases qu'il borde), plus de réglage par segment.</p>
                <div className="ed-field">
                  <span>Escaladable</span>
                  <Row>
                    <button className="btn small" aria-pressed={!selW.climb} title="Arête non grimpable" onClick={() => patchSelW({ climb: undefined })}>Non</button>
                    <button className="btn small" aria-pressed={selW.climb?.kind === 'ladder'} title="Échelle / surface facile : pas de Test (LDB 15 l.55)" onClick={() => patchSelW({ climb: { kind: 'ladder' } })}>Échelle</button>
                    <button className="btn small" aria-pressed={selW.climb?.kind === 'surface'} title="Paroi à prises : Test d'Escalade (LDB 15 l.57)" onClick={() => patchSelW({ climb: { kind: 'surface', ...(selW.climb?.kind === 'surface' ? selW.climb : {}) } })}>Paroi</button>
                  </Row>
                </div>
                {selW.climb?.kind === 'surface' && (
                  <>
                    <div className="ed-field">
                      <span>Difficulté du Test</span>
                      <select value={selW.climb.difficulty ?? DIFFICULTE_PAR_DEFAUT} onChange={(e) => patchSelW({ climb: { ...selW.climb!, difficulty: e.target.value as Difficulty } })}>
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
                      onChange={(e) => setScene(editEntry(scene, sel.id, { x: Number(e.target.value) }))}
                    />
                  </label>
                  <label>
                    Y
                    <input
                      type="number"
                      value={entry.y}
                      onChange={(e) => setScene(editEntry(scene, sel.id, { y: Number(e.target.value) }))}
                    />
                  </label>
                </div>
                <LayerField
                  z={entry.z}
                  layers={sceneLayerZs(scene)}
                  onChange={(z) => setScene(editEntry(scene, sel.id, { z }))}
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
        <SceneProps scene={scene} otherScenes={otherScenes} narratif={narratif} setScene={setScene} setSel={setSel} resizeScene={resizeScene} />
      )}
    </aside>
  );
}

/**
 * TYPE d'un décor — et l'ÉTAT de la donnée quand le catalogue ne le résout pas (#877 : « Rien en
 * dure, pas de fallback »). Ce que le sélecteur MONTRE est ce que la donnée DIT : sans cet état, le
 * DOM afficherait la PREMIÈRE entrée du catalogue comme si c'était le type de l'instance.
 *
 * L'état est dit DEUX fois, et ce n'est pas une redite : un `<option>` natif est TRONQUÉ à la largeur
 * du champ — or l'id fautif EST l'information utile —, donc il se relit ENTIER hors du champ
 * (primitive `ChipDeRefus`) et au survol (`title`). L'option, elle,
 * n'est pas ÉLISIBLE : on n'élit pas une absence. Les mots sont ceux de `noyau/validateScene.ts` —
 * l'inspecteur et le validateur disent la MÊME chose. Élire un vrai type l'ÉCRIT (`changePropRef`).
 */
function SelecteurDeDecor({ scene, ent, setScene }: { scene: Scene; ent: SceneEntity; setScene: (s: Scene) => void }) {
  const etat = findPropById(ent.decor?.id)
    ? null
    : ent.decor === undefined
      ? 'Décor sans type — choisissez-en un'
      : `Décor inexistant « ${ent.decor.id} »`;
  return (
    <>
      <label className="ed-field">
        Décor
        <select
          value={ent.decor?.id ?? REF_DECOR_NON_NOMMEE}
          title={etat ?? undefined}
          onChange={(e) => setScene(changePropRef(scene, ent.id, e.target.value))}
        >
          {etat && (
            <option value={ent.decor?.id ?? REF_DECOR_NON_NOMMEE} disabled>
              {etat}
            </option>
          )}
          {decorsDuCatalogue().map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      {etat && <ChipDeRefus fixe refus={{ message: etat }} />}
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
  const cases = propFootTiles(ent.decor?.id, ent.pos, ent.facing, sceneMetresPerTile(scene));
  const w = Math.max(...cases.map((c) => c.x)) - ent.pos.x + 1;
  const h = Math.max(...cases.map((c) => c.y)) - ent.pos.y + 1;
  return (
    <p className="hint">
      Empreinte <span className="chip">{w}×{h}</span>{' '}
      {cases.map((c) => `(${c.x}, ${c.y})`).join(' ')}
    </p>
  );
}

/**
 * ORIENTATION d'une entité : les caps que son type admet (`capsOfferts`, #1509, #1680 ligne 3), la même
 * règle que lit le schéma de scène au parse et `validateScene` à l'écran. Un cap que la donnée porte HORS de l'offre se MONTRE en option
 * non élisible, comme l'état de `SelecteurDeDecor` : sans elle, le DOM afficherait la première option
 * comme si c'était le cap de l'instance, et la choisir n'émettrait aucun `change`.
 */
function SelecteurDOrientation({ ent, updateSel }: { ent: SceneEntity; updateSel: (patch: Partial<SceneEntity>) => void }) {
  const offerts = capsOfferts(ent);
  const cap = capDeLEntite(ent);
  return (
    <label className="ed-field">
      Orientation
      <select value={cap} onChange={(e) => updateSel({ facing: e.target.value as SceneEntity['facing'] })}>
        {!offerts.includes(cap) && <option value={cap} disabled>{t(`ecran.editeur.cap.${cap}`)} — refusé pour ce décor</option>}
        {offerts.map((c) => (
          <option key={c} value={c}>{t(`ecran.editeur.cap.${c}`)}</option>
        ))}
      </select>
    </label>
  );
}

/** Panneau d'une ENTITÉ sélectionnée (personnage / décor / départ héros). */
function EntityPanel({
  ent,
  scene,
  otherScenes,
  worldMap,
  narratif,
  setScene,
  updateSel,
  removeSel,
}: {
  ent: SceneEntity;
  scene: Scene;
  otherScenes: Scene[];
  worldMap: WorldMap | null;
  narratif: NarratifBlock;
  setScene: (s: Scene) => void;
  updateSel: (patch: Partial<SceneEntity>) => void;
  removeSel: () => void;
}) {
  useVersionDesDatasets();
  const jeuOrphelin = !!ent.tavernGame && !idsDe('tavernGame').has(ent.tavernGame.id);
  return (
    <>
      <div className="ent-preview">
        <span className="hint">
          {libelleDeValeur(entityKindSchema, ent.kind)} @ ({ent.pos.x}, {ent.pos.y})
        </span>
      </div>
      <Fold title="Identité" open>
        <label className="ed-field">
          Libellé
          <input value={ent.label ?? ''} placeholder={nomDEntite({ ...ent, label: undefined }, presetDuNarratif(narratif))} onChange={(e) => updateSel({ label: e.target.value || undefined })} />
        </label>
        <SelecteurDOrientation ent={ent} updateSel={updateSel} />
        <LayerField z={ent.z} layers={sceneLayerZs(scene)} onChange={(z) => updateSel({ z: z || undefined })} />
        <CouvreField value={ent.couvre} sujet="de l'entité" onChange={(couvre) => updateSel({ couvre })} />
      </Fold>
      {ent.kind === 'personnage' && (
        <>
          <Fold title="Apparence" open>
            {/* Espèce EXPLICITE (`appearance.species`) — découple l'espèce du nom/ref (cf. scene.ts). Le
                profil de stats se choisit via la réf de créature (fold Rôle/Combat). */}
            <div className="ed-field">
              <ReglagesApparence
                appearance={ent.appearance ?? {}}
                onChange={(appearance) => updateSel({ appearance })}
                reglages={['species', 'sex']}
              />
            </div>
            <label className="ed-field">
              Animation d'ambiance
              <select value={ent.anim ?? ''} onChange={(e) => updateSel({ anim: roleAmbiantSchema.safeParse(e.target.value).data })}>
                <option value="">— aucune —</option>
                {optionsDuNoeud(roleAmbiantSchema).map(([role, libelle]) => <option key={role} value={role}>{libelle}</option>)}
              </select>
            </label>
            <ApparencesObjetsField resolveTrapping={objetDuNarratif(narratif)}
              appearance={ent.appearance ?? {}}
              onChange={(appearance) => updateSel({ appearance })}
              weapons={armesDEntite(objetDuNarratif(narratif), ent.creature?.id, equipementDAuteurDe(ent, scene))}
            />
          </Fold>
          <Fold title="Rôle (dialogue, marchand)">
            <label className="ed-field">
              Dialogue / quête
              <select value={ent.dialogueId?.id ?? ''} onChange={(e) => updateSel({ dialogueId: e.target.value ? { id: e.target.value } : undefined })}>
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
                value={ent.tavernGame?.id ?? ''}
                aria-invalid={jeuOrphelin || undefined}
                onChange={(e) => updateSel({ tavernGame: e.target.value ? { ...ent.tavernGame, id: e.target.value } : undefined })}
              >
                <option value="">— aucun —</option>
                {jeuOrphelin && <option value={ent.tavernGame!.id}>{ent.tavernGame!.id} (introuvable)</option>}
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
              {/* Contrepartie d'un Test de Sociabilité (jetons de Mécénat) — arbitrage maison, ACE 12 l.60-62. */}
              Amateur des arts (maison)
              <select value={ent.amateur ?? ''} onChange={(e) => updateSel({ amateur: e.target.value ? amateurSchema.parse(e.target.value) : undefined })}>
                <option value="">— aucun —</option>
                {optionsDuNoeud(amateurSchema).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
            <label className="ed-field">
              Marchand (archétype)
              <select value={ent.merchant?.archetype.id ?? ''} onChange={(e) => updateSel({ merchant: e.target.value ? { ...ent.merchant, archetype: { id: e.target.value } } : undefined })}>
                <option value="">— aucun —</option>
                {MERCHANT_ARCHETYPES.map((a) => (
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
              onChange={(e) => updateSel({ light: e.target.checked ? lumiereAllumee(ent) : undefined })}
            />{' '}
            <Icon id="interface/oeil" size="sm" /> Source de lumière (override de l'instance — sinon rayon du type de décor)
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
            key={ent.id}
            ent={ent}
            scene={scene}
            updateSel={updateSel}
            flowCtx={effectCtxOf({ scenes: [scene, ...otherScenes], worldMap, narratif }, scene)}
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
 * verra est RENDU ici en lecture par le dériveur UNIQUE (`actionsDe`, `noyau/monde/usable.ts`) : l'auteur
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
  const cles = useClesDeRangees(actions);
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
        <div className="ed-field" key={cles[i]}>
          <span className="mini-title">Action « {a.label ?? a.id} »</span>
          {/* L'id n'est écrit au document qu'au COMMIT (blur/Entrée) — la primitive du fichier, déjà
              servie par les points d'entrée et les zones d'effet. Frappé lettre à lettre, il posait
              `f`, `fo`, `fou` dans la scène. L'unicité, elle, se garde AU GESTE
              (`noyau/sceneEdit.renameActionAuthoree`) : le `refine` du schéma ne mord qu'au parse, et
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
        onClick={() => poser({ actions: [...actions, actionNeuve(actions)] })}
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
          <p className="hint">Pièce d'artillerie servie par un équipage. Enrôlez l'emplacement ET ses servants dans une rencontre (fold <Icon id="action/attaquer" size="sm" /> Combat) ; au combat, le chef (1ᵉʳ servant) sert la pièce et tire.</p>
          <label className="ed-field">
            Engin
            <select value={poste.trappingId} onChange={(e) => setScene(setPosteEngine(scene, ent.id, e.target.value))}>
              {siegeEngines().map((t) => (
                <option key={t.id} value={t.id}>{libelleDAuteur(t)}</option>
              ))}
            </select>
          </label>
          <div className="ed-field">
            <span>Créneau de tir</span>
            <Row>
              <button className="btn small" aria-pressed={!directional} title="Pivot libre — tire dans toutes les directions" onClick={() => setScene(setPosteSide(scene, ent.id, undefined))}>
                ↻ Omni
              </button>
              <button className="btn small" aria-pressed={directional} title="Arc fixe, relatif à l'orientation-monde du chef de pièce" onClick={() => setScene(setPosteSide(scene, ent.id, poste.side ?? 'proue'))}>
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
            caption={<>Servants du poste <em className="ed-hint">(le 1ᵉʳ = chef de pièce ★)</em></>}
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
        caption={<>Équipage exposé à bord <em className="ed-hint">(MDG 14 — encaisse les critiques de coque)</em></>}
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
  const armed = tool.mode === 'casesDeZone' && tool.zoneId === zone.id ? tool.paint : null;
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
        Emprise <em className="ed-hint">({retenues} cases{retenues === cadre ? '' : ` sur ${cadre} du cadre`})</em>
      </span>
      <OptionChooser
        layout="seg"
        groupLabel="Pinceau d'emprise"
        options={[
          {
            key: 'add',
            label: <><Icon id="outil-de-carte/peindre" size="sm" /> Ajouter</>,
            title: 'Peindre des cases DANS la zone',
            selected: armed === 'add',
            onSelect: () => onArm(zone.id, 'add'),
          },
          {
            key: 'remove',
            label: <><Icon id="outil-de-carte/gomme" size="sm" /> Retirer</>,
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
    return e ? e.label ?? idDuCorps(e) ?? e.id : `${id} (supprimé)`;
  };
  const addable = candidates.filter((c) => !ids.includes(c.id));
  return (
    <div className="ed-field">
      <span>{caption}</span>
      {ids.map((id, i) => (
        <div key={`${id}-${i}`} className="fieldrow">
          <span className="chip" title={head && i === 0 ? head : `Membre ${i + 1}`}>{head && i === 0 ? '★' : i + 1}</span>
          <select value={id} onChange={(e) => onChange(ids.map((c, j) => (j === i ? e.target.value : c)))}>
            {!candidates.some((c) => c.id === id) && <option value={id}>{labelOf(id)}</option>}
            {candidates.map((c) => (
              <option key={c.id} value={c.id} disabled={ids.includes(c.id) && c.id !== id}>
                {c.label ?? idDuCorps(c) ?? c.id}
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
function sceneContent(scene: Scene, narratif: NarratifBlock): ContentRow[] {
  const rows: ContentRow[] = [];
  for (const e of scene.entities)
    rows.push({ key: `ent:${e.id}`, icon: entIcon(e), label: nomDEntite(e, presetDuNarratif(narratif)) ?? e.id, at: `(${e.pos.x},${e.pos.y})`, z: e.z, sel: { type: 'entity', id: e.id } });
  (scene.effectZones ?? []).forEach((efz) => {
    const r = effectZoneRect(efz.area);
    rows.push({
      key: `zone:${efz.id}`,
      icon: <Icon id="outil-de-carte/zone" size="sm" />,
      label: efz.label || efz.id,
      at: `(${r.x},${r.y})`,
      tag: isDescriptiveZone(efz) ? undefined : 'mécanique',
      z: efz.z,
      sel: { type: 'effectZone', id: efz.id },
    });
  });
  for (const [name, pos] of Object.entries(scene.entryPoints ?? {}))
    rows.push({ key: `entry:${name}`, icon: <Icon id="navigation/point-d-entree" size="sm" />, label: name, at: `(${pos.x},${pos.y})`, tag: 'entrée', z: pos.z, sel: { type: 'entry', id: name } });
  (scene.restZones ?? []).forEach((z, i) =>
    rows.push({ key: `rest:${i}`, icon: <Icon id="repos/campement" size="sm" />, label: `Repos ${z.rect.w}×${z.rect.h}`, at: `(${z.rect.x},${z.rect.y})`, tag: 'repos', z: z.rect.z, sel: { type: 'restZone', idx: i } }),
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
  otherScenes,
  setScene,
  narratif,
  setSel,
  resizeScene,
}: {
  scene: Scene;
  /** Les autres scènes du projet : l'identifiant de la scène y est unique (`renameScene`). */
  otherScenes: readonly Scene[];
  narratif: NarratifBlock;
  setScene: (s: Scene) => void;
  setSel: (s: Sel) => void;
  resizeScene: (w: number, h: number) => void;
}) {
  const [filter, setFilter] = useState('');
  const content = sceneContent(scene, narratif);
  const shown = filterByLabel(content, (row) => `${row.label} ${row.key}`, filter);
  const layerZs = sceneLayerZs(scene);
  const patchStationDe = (i: number, patch: Partial<SceneStationAnchor>) => setScene(patchStation(scene, i, patch));
  const anchorTargets = ciblesDAncreDeBataille();
  const ajouterStation = () => setScene(addStation(scene, anchorTargets[0]!.id));
  const retirerStation = (i: number) => setScene(removeStation(scene, i));
  const [newFlagKey, setNewFlagKey] = useState('');
  const flagEntries = Object.entries(scene.flags);
  const addFlag = () => {
    const key = newFlagKey.trim();
    if (!key || key in scene.flags) return;
    setScene(setSceneFlags(scene, { [key]: true }));
    setNewFlagKey('');
  };
  const removeFlag = (key: string) => setScene(removeSceneFlag(scene, key));
  return (
    <>
      <div className="insp-head">
        <span className="insp-title"><Icon id="fichier/document" size="sm" /> {scene.label || scene.id}</span>
      </div>
      <Fold title="Identité" open>
        <EntryRename
          label={scene.id}
          caption="Identifiant (référencé par les transitions et la carte du monde)"
          onRename={(next) => setScene(renameScene(scene, otherScenes, next))}
        />
        <label className="ed-field">
          Nom
          <input value={scene.label} onChange={(e) => setScene(setSceneLabel(scene, e.target.value))} />
        </label>
        <label className="ed-field">
          Description (notes d'auteur)
          <textarea value={scene.desc ?? ''} onChange={(e) => setScene(setSceneScalaires(scene, { desc: e.target.value }))} />
        </label>
        <div className="ed-field">
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
        </div>
        <CouvreField value={scene.couvre} sujet="de la scène" onChange={(couvre) => setScene(setSceneScalaires(scene, { couvre }))} />
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
          <select value={scene.ambiance === 'interieur' ? 'interieur' : 'exterieur'} onChange={(e) => setScene(setSceneScalaires(scene, { ambiance: e.target.value as Scene['ambiance'] }))}>
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
            onChange={(e) => setScene(setSceneScalaires(scene, { metresPerTile: Math.max(1, Number(e.target.value) || 2) }))}
          />
        </label>
        <label className="ed-field">
          Lumière ambiante
          <select value={scene.ambientLight ?? 'auto'} onChange={(e) => setScene(setSceneScalaires(scene, { ambientLight: e.target.value === 'auto' ? undefined : e.target.value }))}>
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
          <select value={scene.environment ?? ''} onChange={(e) => setScene(setSceneScalaires(scene, { environment: (e.target.value || undefined) as Scene['environment'] }))}>
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
          <select value={scene.weather ?? ''} onChange={(e) => setScene(setSceneScalaires(scene, { weather: (e.target.value || undefined) as Scene['weather'] }))}>
            <option value="">Non spécifiée</option>
            {optionsDuNoeud(sceneWeatherSchema).map(([id, label]) => (
              <option key={id} value={id} title={hintDeValeur(sceneWeatherSchema, id)}>{label}</option>
            ))}
          </select>
        </label>
        <ListeDIds
          noeud={sceneSchema.shape.groups}
          label="Groupes du lieu"
          title="Source de Peur ou de Haine des personnages dont un Trait vise l’un de ces Groupes"
          value={scene.groups}
          onChange={(groups) => setScene(setSceneScalaires(scene, { groups }))}
        />
        <MusicSelect
          label="Musique (ambiance)"
          value={scene.music?.ambient}
          onChange={(v) => setScene(setSceneMusic(scene, 'ambient', v))}
        />
        <MusicSelect
          label="Musique (combat)"
          value={scene.music?.combat}
          onChange={(v) => setScene(setSceneMusic(scene, 'combat', v))}
        />
        <ProseField label="Message d'introduction" value={scene.startMessage?.texte ?? ''} onChange={(texte) => setScene(setStartMessageTexte(scene, texte))} />
        {scene.startMessage && <ProvenanceDuTexte copie identite={`${scene.id}/introduction`} sujet="du message d'introduction" value={scene.startMessage} onChange={(patch) => setScene(patchStartMessage(scene, patch))} />}
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
              value={scene.reliefDefaults[part].id}
              onChange={(e) => setScene(setReliefDefault(scene, part, { id: e.target.value }))}
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
            value={scene.roofDefaults.material.id}
            onChange={(e) => setScene(patchSceneRoofDefaults(scene, { material: { id: e.target.value } }))}
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
          onChange={(pitchDeg) => setScene(patchSceneRoofDefaults(scene, { pitchDeg }))}
        />
        <NumberField
          variant="champ"
          label="Comble (étages)"
          min={1}
          value={scene.roofDefaults.riseMaxStoreys}
          onChange={(riseMaxStoreys) => setScene(patchSceneRoofDefaults(scene, { riseMaxStoreys }))}
        />
      </Fold>
      <Fold title="Repos sur place">
        <p className="hint">Offre du bouton <Icon id="temps/nuit" size="sm" /> d'exploration, pour TOUT le plan. Affinable par ZONE : outil <Icon id="outil-de-carte/zone" size="sm" /> → Zone de repos, dessinée sur la carte et listée dans le contenu du plan.</p>
        <div className="ed-rest-places">
          {([['auberge', <><Icon id="repos/lit" size="sm" /> Auberge</>], ['maison', <><Icon id="repos/chez-soi" size="sm" /> Chez soi</>], ['camp', <><Icon id="repos/campement" size="sm" /> Camper</>]] as const).map(([k, label]) => (
            <label key={k} className="ed-check">
              <input
                type="checkbox"
                checked={reposDeScene(scene)[k] ?? false}
                onChange={(e) => setScene(setSceneRest(scene, { [k]: e.target.checked }))}
              />
              {label}
            </label>
          ))}
          <label className="ed-check">
            <input
              type="checkbox"
              checked={scene.rest?.quality === 'pietre'}
              onChange={(e) => setScene(setSceneRest(scene, { quality: e.target.checked ? 'pietre' : undefined }))}
            />
            <Icon id="ressource/bourse" size="sm" /> Piètre (½ prix, tambouille à risque)
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
                  onChange={(e) => patchStationDe(i, { sceneId: e.target.value })}
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
                    onChange={(e) => patchStationDe(i, { pos: { ...st.pos, [key]: Number(e.target.value) } })}
                  />
                </label>
              ))}
              <LayerField z={st.pos.z} layers={sceneLayerZs(scene)} onChange={(z) => patchStationDe(i, { pos: { ...st.pos, z } })} />
              <button className="btn small danger" onClick={() => retirerStation(i)}>Retirer</button>
            </div>
          ))}
          <button className="btn small" disabled={!anchorTargets.length} onClick={ajouterStation}>+ Ancre</button>
        </Stack>
      </Fold>
    </>
  );
}
