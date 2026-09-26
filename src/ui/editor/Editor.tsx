import { useRef, useState, useEffect, useMemo } from 'react';
import { useGame } from '../../state/store';
import { Scene, emptyScene, tileAt } from '../../state/scene';
import { resizeGrid, editEntity, TypeNonNomme } from '../../state/sceneEdit';
import { validateScene, type Warning } from '../../state/validateScene';
import { planFocusTiles, type PlanDefectAt, type PlanDefectFamily } from '../../state/planDefects';
import { testScene } from '../../scenes/test-fixture';
import { creatures, premierOffert } from '../../data';
import { useSceneHistory } from './useSceneHistory';
import { useEditorView } from './useEditorView';
import { EditorToolbar } from './EditorToolbar';
import { EditorCanvas } from './EditorCanvas';
import { StatusBar } from './StatusBar';
import { Palette } from './Palette';
import { Inspector } from './Inspector';
import { LogicDock, LogicTab } from './LogicDock';
import { WorldMapEditor } from './WorldMapEditor';
import { NarratifEditor } from './NarratifEditor';
import { OpenProjectModal, SaveProjectModal, ChipDeRefus, refusDeLaPorteDuProjet, refusMotive, type GesteDePorte, type RefusRendu } from './ProjectModals';
import { projectSave, projectsLoad, documentDeLEntree, SavedProject } from '../../state/projectLibrary';
import { downloadText } from '../../state/fileIo';
import { sceneToAscii, type SceneAsciiExport } from '../../state/sceneToAscii';
import { testScenarios, type TestScenario } from '../../scenes/test-scenarios';
import { allBuiltinCampaigns, copieDuJeu, type BuiltinCampaign } from '../../scenes/campaign';
import { WorldMap, parseProject, documentDeProjet, MAISON_PROJET_AUTHORE, type ProjectDoc, type ProjectIdentite } from '../../state/worldMap';
import { type NarratifBlock, emptyNarratif } from '../../state/campaignNarratif';
import { nextEntityId } from '../../state/entityId';
import { publierEditeur } from '../../state/editeurBridge';
import {
  Tool, Sel, Pt, deleteSel, moveSel, selPos, pasteEntity, addLayer, removeLayer,
  addArchitectureBody, addArchitectureStorey, addArchitecturePart, addBuildingMass,
  planStairFlight, applyStairFlight,
} from './editorState';
import { Icon } from '../Icon';
import { Modal } from '../Modal';
import { TraceLayerPanel } from './TraceLayerPanel';
import { useEditorAutosave } from './useEditorAutosave';
import { autosaveDelete } from '../../state/editorAutosave';
import { advanceCalibration, identityTransform, nearestNode, type CalibProgress } from '../../state/traceCalibration';
import {
  traceLayerLoad, traceLayerSave, traceLayerDelete, panelExpandedLoad, panelExpandedSave, type TraceLayerRecord,
} from '../../state/traceLayer';
import { Dims, tileCenter, screenToTileF } from '../../geometry/iso';
import { useLowerLayerOpacity, setLowerLayerOpacity, useLowerLayerMode, setLowerLayerMode } from './lowerLayerGabarit';
import { useEditorLayers } from './editorLayers';
import { LayerField, sceneLayerZs } from './LayerField';
import { OptionChooser } from '../OptionChooser';
import { z } from 'zod';
import { dialogueSchema, triggerSchema, encounterDefSchema } from '../../data/schemas/defs-scenes/scene';
import { formatZodError } from '../../data/schemas/validate';

/** Titres des gestes du menu Fichier dont le refus n'a aucune modale à lui (`refusDuGeste`) : le
 *  même mot que le contrôle cliqué — l'auteur retrouve SON geste en tête de la fenêtre. */
const TITRE_EXPORT = 'Exporter JSON';
const TITRE_IMPORT = 'Importer JSON';
const TITRE_TEST = 'Tester la scène';

/** POSITION d'une `SyntaxError` de `JSON.parse` : le moteur JS la donne en ANGLAIS, avec un décalage
 *  d'octets (`at position 42 (line 3 column 7)`) selon la version. Seule la position se traduit — le
 *  message du moteur ne part jamais à l'auteur (règle 4). Vide si la position ne s'extrait pas.
 *  Source unique des DEUX sites qui parsent du JSON d'auteur (import de fichier, modale Avancé). */
export function ouCaCasse(erreur: unknown): string {
  const brut = erreur instanceof Error ? erreur.message : String(erreur);
  const lc = /line (\d+) column (\d+)/.exec(brut);
  if (lc) return ` — ligne ${lc[1]}, colonne ${lc[2]}`;
  const pos = /position (\d+)/.exec(brut);
  return pos ? ` — caractère n° ${Number(pos[1]) + 1}` : '';
}

/** Les TROIS blocs de logique que la modale « Avancé » édite en masse. Les ÉLÉMENTS sont ceux du
 *  schéma de Scène (`dialogueSchema`/`triggerSchema`/`encounterDefSchema`, `scene.ts:785-787`), pas
 *  une redite : ce que l'auteur colle est tenu à la même exigence que ce que le document porte. Le
 *  conteneur est réécrit parce que `sceneSchema.pick()` est refusé par zod sur un objet PORTANT DES
 *  RAFFINEMENTS, et un sous-ensemble de trois clés n'en hérite aucun.
 *  EXPORTÉ pour que la porte de cette modale (`saveAdvanced` : ce schéma + `formatZodError`) soit
 *  mesurable hors montage — c'est elle qui rend le refus que l'auteur lit (#1588). */
export const SCHEMA_BLOCS_AVANCES = z.strictObject({
  dialogues: z.array(dialogueSchema).optional(),
  triggers: z.array(triggerSchema).optional(),
  encounters: z.array(encounterDefSchema).optional(),
});

export function architectureSelectionForWarning(warning: Warning): Warning['architectureRef'] | null {
  return warning.scope === 'architecture' ? warning.architectureRef ?? null : null;
}

/** IDENTITÉ d'un défaut de plan : sa famille et l'endroit visé — JAMAIS ses cases, qui décroissent à
 *  mesure qu'on le corrige. C'est par elle qu'on retrouve le MÊME défaut dans des avertissements frais. */
export function planDefectKey(plan: { family: PlanDefectFamily; at: PlanDefectAt }): string {
  const at = plan.at;
  const place =
    at.kind === 'zone' ? `zone:${at.zoneId}`
      : at.kind === 'edge' ? `edge:${at.x}:${at.y}:${at.side}`
        : `cell:${at.x}:${at.y}`;
  return `${plan.family}|${place}|z${at.z}`;
}

/** Cases FRAÎCHES du défaut suivi : `null` si plus aucun avertissement ne le porte (il est corrigé). */
export function planFocusAt(warnings: readonly Warning[], key: string | null): PlanDefectAt | null {
  if (!key) return null;
  for (const w of warnings) if (w.plan && planDefectKey(w.plan) === key) return w.plan.at;
  return null;
}

/**
 * Éditeur de niveau v2 — SHELL d'orchestration : toolbar (Fichier/scènes/Tester), Palette
 * (rail d'outils), canvas WYSIWYG, Inspecteur DOCKÉ, barre de statut et PANNEAU LOGIQUE
 * (triggers/dialogues/rencontres/validation — fini les modales). Toute édition passe par
 * `setScene` (useSceneHistory) → UN SEUL historique d'undo. La sélection est UNIFIÉE (`Sel`)
 * et synchronisée carte ⇄ inspecteur ⇄ dock.
 */
export function Editor({
  initialScene,
  onSceneChange,
}: {
  initialScene?: Scene;
  onSceneChange?: (scene: Scene) => void;
} = {}) {
  const setScreen = useGame((s) => s.setScreen);
  const loadProject = useGame((s) => s.loadProject);
  const party = useGame((s) => s.party);

  const { scene, setScene, setSceneNoHistory, pushSnapshot, undo, redo, resetScene, canUndo, canRedo } = useSceneHistory(() => clone(initialScene ?? testScene));
  // Filet de crash : sauvegarde locale débattue de LA scène active, indépendante de
  // « Fichier → Enregistrer » — un crash de rendu (`SceneErrorBoundary`) ne perd plus le travail en
  // mémoire. `setScene` (jamais `resetScene`) au restaurer : une restauration erronée reste ANNULABLE
  // (Ctrl+Z, #834 audit-2 défaut 5) — rien ne prouve la fraîcheur relative d'un enregistrement local.
  const {
    ecartee: autosaveEcartee,
    oublierEcartee: oublierAutosaveEcartee,
    recovery: autosaveRecovery,
    hasHiddenRecovery: autosaveRecoveryHidden,
    restore: restoreAutosave,
    dismiss: dismissAutosave,
    hide: hideAutosaveRecovery,
    show: showAutosaveRecovery,
  } = useEditorAutosave(scene, (s) => setScene(clone(s)));
  const [tool, setTool] = useState<Tool>({ mode: 'select' });
  const [architectureMode, setArchitectureMode] = useState(false);
  const [architectureBodyId, setArchitectureBodyId] = useState<string | null>(null);
  const [architectureStoreyId, setArchitectureStoreyId] = useState<string | null>(null);
  const [architectureAction, setArchitectureAction] = useState<'select' | 'facade'>('select');
  const [sel, setSel] = useState<Sel>(null);
  // Défaut de plan MIS EN ÉVIDENCE sur la carte — ANNOTATION, pas sélection : un défaut porte souvent
  // un ENSEMBLE de cases (`PlanDefectAt`), là où `sel` ne désigne qu'un objet éditable. Les deux
  // coexistent (la zone reste sélectionnée pour l'inspecteur, ses cases fautives restent allumées).
  // On retient son IDENTITÉ, jamais ses cases : celles-ci se re-résolvent contre les avertissements
  // FRAIS à chaque édition — elles fondent au fur et à mesure de la correction, et l'annotation
  // s'éteint d'elle-même quand le défaut disparaît.
  const [planFocusKey, setPlanFocusKey] = useState<string | null>(null);
  const [layers, setLayers] = useEditorLayers(); // défaut (tout visible) + choix persistés de l'auteur
  const [brush, setBrush] = useState(1); // taille de pinceau terrain (1/3/5)
  const [currentLayer, setCurrentLayer] = useState(0); // couche (z) en cours d'édition (multi-niveaux)
  const lowerLayerOpacity = useLowerLayerOpacity(); // opacité du gabarit de couche inférieure (curseur, persisté)
  const lowerLayerMode = useLowerLayerMode(); // gabarit / isolation de la couche active (persisté)
  const [terrainRect, setTerrainRect] = useState(false); // pinceau terrain en mode Rectangle
  const [stairRun, setStairRun] = useState<Pt[]>([]); // file de cases tracée pour l'outil Volée (aucune écriture avant validation)
  const [encTarget, setEncTarget] = useState(''); // rencontre cible de l'outil de placement d'ennemis
  const [encRef, setEncRef] = useState(''); // créature à placer
  const [clip, setClip] = useState<Scene['entities'][number] | null>(null); // presse-papier (Ctrl+C/V)
  const hoverRef = useRef<Pt>({ x: 0, y: 0 }); // dernière case survolée (cible de Ctrl+V)
  const [hover, setHover] = useState<Pt | null>(null); // barre de statut

  // --- Projet multi-scènes + métadonnées ---
  const [otherScenes, setOtherScenes] = useState<Scene[]>([]);
  const [worldMap, setWorldMap] = useState<WorldMap | null>(null);
  /** Axes de forces/faiblesses ACTIFS de la campagne (#409) — `undefined` = socle de base. */
  const [activeAxes, setActiveAxes] = useState<string[] | undefined>(undefined);
  /** Bloc NARRATIF du paquet de campagne (#765) — affaires/indices/PNJ/objets, préservé au round-trip. */
  const [narratif, setNarratif] = useState<NarratifBlock>(emptyNarratif());
  /** Identité de campagne (#765/#766) — préservée au round-trip, absente d'un projet legacy sans identité.
   *  SANS son `label` : le nom du projet a UNE source, `projectName`. */
  const [identite, setIdentite] = useState<Omit<ProjectIdentite, 'label'> | undefined>(undefined);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('La Diligence');
  const [published, setPublished] = useState(false);
  const [saveError, setSaveError] = useState<RefusRendu | null>(null);
  /** Refus d'un geste du menu Fichier — export, import, mise à l'essai : ces gestes n'ont AUCUNE
   *  modale à eux où poser leur refus, là où `saveError`/`loadError` tiennent dans la leur. UN seul
   *  état pour les trois, portant le TITRE du geste refusé : même matière (`.chip.tone-danger` en
   *  `role="alert"`, dans une modale), et jamais une boîte du navigateur (#877). */
  const [refusDuGeste, setRefusDuGeste] = useState<({ titre: string } & RefusRendu) | null>(null);
  /** Refus du JSON collé dans la modale « Avancé » — rendu DANS cette modale, comme `saveError` dans
   *  la sienne : un refus se lit là où le geste a été fait. */
  const [advError, setAdvError] = useState<string | null>(null);
  /** Refus de la porte `parseProject` à l'ouverture d'un projet : rendu DANS la modale « Ouvrir »
   *  (même contrat que `saveError`, #811), jamais jeté à l'auteur par une boîte du navigateur. */
  const [loadError, setLoadError] = useState<RefusRendu | null>(null);

  // --- Panneau Logique (dock bas) ---
  // Un SEUL état pour le dock : l'onglet déplié, ou `null` = replié. « Ouvert » n'est pas un fait
  // séparé de « quel onglet » — deux états pour une chose, ce sont deux contrôles qui divergent.
  const [dockTab, setDockTab] = useState<LogicTab | null>(null);
  const [dockH, setDockH] = useState(300);
  const [dlgSel, setDlgSel] = useState<string | null>(null);
  const [encSel, setEncSel] = useState<string | null>(null);
  const openLogic = (tab: LogicTab, id?: string) => {
    setDockTab(tab);
    if (tab === 'dialogues' && id) setDlgSel(id);
    if (tab === 'encounters' && id) setEncSel(id);
    if (tab === 'triggers' && id) setSel({ type: 'trigger', id });
  };

  // --- Modales restantes (fichiers/monde/JSON — jamais pour ÉDITER la scène) ---
  const [openOpen, setOpenOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [worldOpen, setWorldOpen] = useState(false);
  const [narratifOpen, setNarratifOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const [advText, setAdvText] = useState('');
  const [asciiExport, setAsciiExport] = useState<SceneAsciiExport | null>(null);
  const [drawer, setDrawer] = useState<null | 'palette' | 'inspector'>(null); // tiroirs tactiles (≤900px)

  const view = useEditorView();
  const enemyCreatures = creatures.filter((c) => typeof c.char.B === 'number');
  // Fiche que l'outil de rencontre pose : l'élue, sinon la première offerte (`premierOffert`).
  const encFiche = encRef || premierOffert(enemyCreatures, 'Fiche de rencontre');

  function clone(s: Scene): Scene {
    return JSON.parse(JSON.stringify(s));
  }

  useEffect(() => {
    onSceneChange?.(scene);
  }, [scene, onSceneChange]);

  // --- Calque de RÉFÉRENCE (décalquage d'une planche de livre, #830) — aide d'AUTHORING purement
  // locale : jamais dans la Scène ni un export (JSON/ASCII/projet). Persisté PAR (SCÈNE, COUCHE)
  // (IndexedDB, `state/traceLayer.ts`) — retour user 2026-07-25 : « un plan pour chaque niveau » —
  // rechargé à CHAQUE bascule de scène OU de couche. Le repli/dépli du panneau, lui, est PAR SCÈNE
  // SEULE (persiste au changement de couche, ne doit jamais ressurgir de force).
  const [traceLayer, setTraceLayerState] = useState<TraceLayerRecord | null>(null);
  const [traceCalib, setTraceCalib] = useState<CalibProgress>({ step: 'idle' });
  const [tracePanelExpanded, setTracePanelExpanded] = useState(true); // défaut déplié tant que rien n'est réglé

  useEffect(() => {
    let cancelled = false;
    setTraceCalib({ step: 'idle' });
    traceLayerLoad(scene.id, currentLayer).then((rec) => {
      if (!cancelled) setTraceLayerState(rec);
    });
    return () => {
      cancelled = true;
    };
  }, [scene.id, currentLayer]);

  useEffect(() => {
    let cancelled = false;
    panelExpandedLoad(scene.id).then((v) => {
      if (!cancelled && v !== null) setTracePanelExpanded(v);
    });
    return () => {
      cancelled = true;
    };
    // Dépendance SCÈNE SEULE : un changement de couche ne doit JAMAIS réinitialiser le repli/dépli.
  }, [scene.id]);

  function toggleTracePanelExpanded() {
    const next = !tracePanelExpanded;
    setTracePanelExpanded(next);
    panelExpandedSave(scene.id, next);
  }

  function persistTraceLayer(next: TraceLayerRecord | null) {
    setTraceLayerState(next);
    if (next) traceLayerSave(next);
    else traceLayerDelete(scene.id, currentLayer);
  }

  function loadTraceImage(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string') return;
      const img = new Image();
      img.onload = () => {
        persistTraceLayer({
          sceneId: scene.id,
          z: currentLayer,
          imageDataUrl: dataUrl,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          opacity: 0.6,
          visible: true,
          position: 'above', // défaut : décalquer/comparer (le terrain est opaque, retour user 2026-07-25)
          allowRotation: false, // défaut : rotation VERROUILLÉE (planche scannée droite, retour user 2026-07-25)
          contraste: false, // défaut : mobilier au rendu normal — le mode calage se demande
          transform: identityTransform(),
          savedAt: Date.now(),
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function traceDims(): Dims {
    return { ...scene.dimensions, rot: view.rot, view: view.viewMode };
  }

  function onTraceCalibClick(pt: { x: number; y: number }) {
    if (!traceLayer) return;
    const dims = traceDims();
    const out = advanceCalibration(
      traceCalib,
      pt,
      traceLayer.transform,
      // Accroche au NŒUD de grille (intersection), jamais au centre de case — les murs vivent sur
      // les arêtes (retour user 2026-07-25).
      (p) => nearestNode(screenToTileF(p.x, p.y, dims, currentLayer)),
      (x, y) => tileCenter(x, y, dims, currentLayer),
      traceLayer.allowRotation,
    );
    setTraceCalib(out.progress);
    if (out.transform) persistTraceLayer({ ...traceLayer, transform: out.transform });
  }

  const architectureBody = scene.architecture?.find((body) => body.id === architectureBodyId) ?? scene.architecture?.[0] ?? null;
  const architectureStorey = architectureBody?.storeys.find((storey) => storey.id === architectureStoreyId) ?? architectureBody?.storeys[0] ?? null;

  function selectMapTool(next: Tool) {
    setArchitectureMode(false);
    setArchitectureAction('select');
    if (next.mode !== 'stair') setStairRun([]);
    setTool(next);
  }

  /** Arme le pinceau d'EMPRISE sur une zone et ALLUME le calque des zones s'il a été éteint :
   *  peindre une zone invisible serait peindre à l'aveugle. */
  function armZoneTiles(zoneId: string, paint: 'add' | 'remove') {
    if (!scene.effectZones?.some((z) => z.id === zoneId)) return;
    setLayers((prev) => (prev.zones ? prev : { ...prev, zones: true }));
    selectMapTool({ mode: 'zoneTiles', zoneId, paint });
  }

  /** Ajoute la case au tracé de volée, ou l'en retire si elle y est déjà (même geste, deux sens). */
  function traceStairCell(p: Pt) {
    setStairRun((run) => (run.some((c) => c.x === p.x && c.y === p.y) ? run.filter((c) => !(c.x === p.x && c.y === p.y)) : [...run, { x: p.x, y: p.y }]));
  }

  /** Pose la volée planifiée : des COTES, rien d'autre — la traversée verticale s'en dérive. */
  function applyStairRun() {
    if (tool.mode !== 'stair') return;
    const plan = planStairFlight(scene, stairRun, currentLayer, tool.toZ);
    if (!plan.ok) return;
    setScene(applyStairFlight(scene, plan.steps, currentLayer));
    setStairRun([]);
  }

  function enterArchitectureMode() {
    setTool({ mode: 'select' });
    setArchitectureMode(true);
    setArchitectureAction('select');
    if (architectureBody) {
      setArchitectureBodyId(architectureBody.id);
      setArchitectureStoreyId(architectureStorey?.id ?? null);
      if (architectureStorey && scene.layers.some((layer) => layer.z === architectureStorey.z)) {
        setCurrentLayer(architectureStorey.z);
      }
      // Entrer dans le mode SÉLECTIONNE le corps visé : l'inspecteur est le propriétaire unique de
      // ses propriétés (libellé, style, toiture), et un corps sans partie ni masse n'a aucune
      // empreinte à cliquer sur la carte — sans cette pose, il resterait inatteignable.
      setSel({ type: 'architectureBody', id: architectureBody.id });
    }
  }

  function selectArchitectureBody(id: string) {
    const body = scene.architecture?.find((candidate) => candidate.id === id);
    setArchitectureBodyId(id);
    setArchitectureStoreyId(body?.storeys[0]?.id ?? null);
    if (body?.storeys[0] && scene.layers.some((layer) => layer.z === body.storeys[0].z)) {
      setCurrentLayer(body.storeys[0].z);
    }
    setArchitectureAction('select');
    setSel({ type: 'architectureBody', id });
  }

  function selectArchitectureStorey(id: string) {
    const storey = architectureBody?.storeys.find((candidate) => candidate.id === id);
    setArchitectureStoreyId(id);
    if (storey && scene.layers.some((layer) => layer.z === storey.z)) setCurrentLayer(storey.z);
    setArchitectureAction('select');
    if (architectureBody) setSel({ type: 'architectureStorey', bodyId: architectureBody.id, id });
  }

  /** Le corps naît BORNÉ : son volume de départ est la case visée (`hoverRef`, la même cible que le
   *  collage), à redimensionner ensuite. Un corps sans emprise revendiquerait tout le plancher libre de
   *  la scène, et à deux ce serait l'ordre du tableau qui trancherait (`validateArchitectureResiduals`).
   *  Il naît SANS type de bâtiment : le type est un choix d'auteur, posé à l'inspecteur (case vide). */
  function createArchitectureBody() {
    const out = addArchitectureBody(scene, undefined, { ...hoverRef.current, w: 1, h: 1 });
    setScene(out.scene);
    setArchitectureBodyId(out.id);
    setArchitectureStoreyId('z0');
    setArchitectureAction('select');
    setSel({ type: 'architectureBody', id: out.id });
  }

  /** Ajoute un étage au corps actif, à la couche juste au-dessus du plus haut étage existant (#841
   *  FU-C — `addArchitectureBody` ne posait qu'un seul étage `z0`, sans moyen d'en ajouter un second).
   *  Crée la couche de scène correspondante si elle manque encore (`addLayer`, no-op si déjà présente). */
  function createArchitectureStorey() {
    if (!architectureBody) return;
    const z = Math.max(...architectureBody.storeys.map((storey) => storey.z)) + 1;
    const out = addArchitectureStorey(scene, architectureBody.id, z);
    if (!out) return;
    setScene(addLayer(out.scene, z));
    setArchitectureStoreyId(out.id);
    setCurrentLayer(z);
    setArchitectureAction('select');
    setSel({ type: 'architectureStorey', bodyId: architectureBody.id, id: out.id });
  }

  function createArchitecturePart() {
    if (!architectureBody || !architectureStorey) return;
    const out = addArchitecturePart(scene, architectureBody.id, architectureStorey.id, { ...hoverRef.current, w: 1, h: 1 });
    if (!out) return;
    setScene(out.scene);
    setSel({ type: 'architecturePart', bodyId: architectureBody.id, storeyId: architectureStorey.id, id: out.id });
  }

  function createRoofSection() {
    if (!architectureBody || !architectureStorey) return;
    const out = addBuildingMass(scene, architectureBody.id, { ...hoverRef.current, w: 1, h: 1 }, architectureStorey.z);
    if (!out) return;
    setScene(out.scene);
    setSel({ type: 'roofSection', bodyId: architectureBody.id, id: out.id });
  }

  /** Sélection depuis le CANVAS : un trigger ouvre aussi son détail dans le dock Logique. */
  function selectFromCanvas(s: Sel) {
    setSel(s);
    if (s?.type === 'trigger') setDockTab('triggers');
  }
  const onHover = (p: Pt) => {
    hoverRef.current = p;
    setHover((h) => (h && h.x === p.x && h.y === p.y ? h : p));
  };

  // --- Projet multi-scènes : la scène éditée (avec historique) + les autres en réserve. ---
  function switchScene(id: string) {
    if (id === scene.id) return;
    const target = otherScenes.find((s) => s.id === id);
    if (!target) return;
    setOtherScenes([...otherScenes.filter((s) => s.id !== id), scene]); // ranger l'active, sortir la cible
    setSel(null);
    resetScene(target);
  }
  function addScene() {
    const s = emptyScene();
    s.id = `scene-${Date.now().toString(36)}`;
    s.label = 'Nouvelle scène';
    setOtherScenes([...otherScenes, scene]);
    setSel(null);
    resetScene(s);
  }
  function duplicateScene() {
    const dup = clone(scene);
    dup.id = nextEntityId(scene.id, [scene.id, ...otherScenes.map((s) => s.id)]);
    dup.label = `${scene.label || scene.id} (copie)`;
    setOtherScenes([...otherScenes, scene]);
    setSel(null);
    resetScene(dup);
  }
  function deleteScene() {
    if (otherScenes.length === 0) return; // ne pas supprimer la dernière scène
    const [next, ...rest] = otherScenes;
    setOtherScenes(rest);
    setSel(null);
    resetScene(next);
  }

  // Commandes d'édition publiées au PONT (`state/editeurBridge`) : le registre de raccourcis unique
  // porte leurs touches (section `editeur`) et leur remap. Republiées à chaque changement de scène /
  // sélection / presse-papier — ces états sont LOCAUX, seule l'intention traverse le pont.
  useEffect(
    () =>
      publierEditeur({
        annuler: undo,
        retablir: redo,
        copier: () => {
          if (sel?.type !== 'entity') return;
          const ent = scene.entities.find((x) => x.id === sel.id);
          if (ent) setClip(JSON.parse(JSON.stringify(ent)));
        },
        coller: () => {
          if (!clip) return;
          const out = pasteEntity(scene, clip, hoverRef.current);
          setScene(out.scene);
          setSel({ type: 'entity', id: out.id });
        },
        dupliquer: () => {
          if (sel?.type !== 'entity') return;
          const ent = scene.entities.find((x) => x.id === sel.id);
          if (!ent) return;
          const { w, h } = scene.dimensions;
          const out = pasteEntity(scene, ent, { x: Math.min(w - 1, ent.pos.x + 1), y: Math.min(h - 1, ent.pos.y + 1) });
          setScene(out.scene);
          setSel({ type: 'entity', id: out.id });
        },
        supprimer: () => {
          if (!sel) return;
          setScene(deleteSel(scene, sel));
          setSel(null);
        },
        deplacer: (dx, dy) => {
          if (!sel) return;
          const p = selPos(scene, sel);
          if (p) setScene(moveSel(scene, sel, { x: p.x + dx, y: p.y + dy }));
        },
        deselectionner: () => setSel(null),
        // Recette #1478 : ouvrir par id sans passer par la modale (donc sans dialogue OS).
        ouvrir: (id: string) => {
          const projets = projectsLoad();
          const p = projets.find((x) => x.id === id);
          if (p) {
            const refus = loadSaved(p);
            return refus
              ? `✗ projet « ${p.label} » refusé — ${refus.message}`
              : `✓ projet enregistré « ${p.label} » ouvert`;
          }
          const bc = allBuiltinCampaigns.find((x) => x.id === id);
          if (bc) { loadBuiltin(bc); return `✓ campagne « ${bc.label} » ouverte (copie)`; }
          const sc = testScenarios.find((x) => x.id === id);
          if (sc) { loadScenario(sc); return `✓ scénario de test « ${sc.title} » ouvert`; }
          return `✗ « ${id} » introuvable — projets : ${projets.map((x) => x.id).join(', ') || '(aucun)'}`
            + ` | campagnes : ${allBuiltinCampaigns.map((x) => x.id).join(', ')}`
            + ` | scénarios : ${testScenarios.map((x) => x.id).join(', ')}`;
        },
        // Recette #877 : INVENTAIRE du brouillon — les quatre champs qui identifient une entité,
        // COPIÉS à plat (`pos` comprise), jamais la référence de l'entité elle-même.
        listerEntites: () => scene.entities.map((e) => ({
          id: e.id, kind: e.kind, ...(e.ref !== undefined ? { ref: e.ref } : {}), pos: { ...e.pos },
        })),
        // Recette #877 : patch PARTIEL d'une entité par le seam d'assise de l'éditeur — même voie
        // qu'une édition d'auteur, donc normalisée et annulable.
        patcherEntite: (entityId: string, patch: Record<string, unknown>) => {
          const ent = scene.entities.find((x) => x.id === entityId);
          if (!ent) {
            return `✗ « ${entityId} » introuvable — entités de la scène « ${scene.id} » : `
              + `${scene.entities.map((x) => x.id).join(', ') || '(aucune)'}`;
          }
          // L'IDENTITÉ d'une entité n'est pas un champ que l'on patche : changer `id` délie la
          // sélection, les triggers et les dialogues qui la nomment, changer `kind` casse l'union du
          // schéma. Refus NOMMÉ plutôt qu'un `✓ posé : id` annonçant une scène corrompue.
          const identite = Object.keys(patch).filter((c) => c === 'id' || c === 'kind');
          if (identite.length) {
            return `✗ « ${identite.join(', ')} » : clé d'IDENTITÉ, jamais patchable — supprimez l'entité et reposez-la pour changer son id ou sa nature`;
          }
          const cles = Object.entries(patch);
          // `undefined` vaut ABSENT : c'est la convention du modèle de scène, celle que l'inspecteur
          // applique déjà (`updateSel({ statblock: undefined })`, `Inspector.tsx`) — le champ ne part
          // pas au document (`JSON.stringify`) et le schéma le lit comme manquant.
          try {
            setScene(editEntity(scene, entityId, patch as Partial<typeof ent>));
          } catch (e) {
            if (e instanceof TypeNonNomme) return `✗ « ${entityId} » : ${e.message}`;
            throw e;
          }
          const nommer = (garde: boolean) => cles.filter(([, v]) => (v !== undefined) === garde).map(([c]) => c).join(', ') || '(rien)';
          return `✓ entité « ${entityId} » patchée — posé : ${nommer(true)} | retiré : ${nommer(false)}`;
        },
      }),
    [scene, sel, clip, undo, redo, setScene],
  );

  // Avertissements de LA scène éditée + ceux de la carte du monde.
  const warnings = useMemo(
    () => validateScene([scene, ...otherScenes], worldMap)
      .filter((w) => w.sceneId === scene.id || w.scope === 'worldMap'),
    [scene, otherScenes, worldMap],
  );
  // Cases fautives à allumer MAINTENANT : re-résolution du défaut suivi contre les avertissements frais.
  const planFocus = useMemo(() => planFocusAt(warnings, planFocusKey), [warnings, planFocusKey]);
  // Le défaut suivi est AMENÉ dans le champ (la carte dépasse la fenêtre : ses cases tombent souvent
  // sous le dock, sous la barre d'étages ou sous le panneau de calque, qui avalent le clic). DEUX
  // régimes, sur le même effet : à la PRISE d'un défaut (ou changement d'étage/rotation/projection) on
  // le cadre ENTIER ; ensuite, tant que l'auteur peint le même défaut, la vue ne bouge que si la cible
  // devient INATTEIGNABLE — peindre dans une zone dégagée ne recadre jamais sous les doigts.
  const framedRef = useRef('');
  useEffect(() => {
    const anchor = `${planFocusKey}|${currentLayer}|${view.rot}|${view.viewMode}`;
    const fresh = framedRef.current !== anchor;
    framedRef.current = anchor;
    if (!planFocus) return;
    view.scrollTilesIntoView(
      planFocusTiles(planFocus),
      { ...scene.dimensions, rot: view.rot, view: view.viewMode },
      fresh ? 'whole' : 'reachable',
    );
  }, [planFocus, planFocusKey, currentLayer, view.rot, view.viewMode]);
  // Défaut de ZONE mis en évidence : son REMÈDE est le pinceau d'emprise de l'inspecteur, qui tombe
  // sous la ligne de flottaison du panneau. Sa clé (et elle seule) l'amène dans le champ — même
  // discipline que le recadrage de la carte : au CHANGEMENT de défaut, jamais à chaque rendu.
  const zoneFocusKey = planFocus?.kind === 'zone' ? planFocusKey : null;
  /** Clic sur un avertissement → sélectionne/ouvre le fautif. */
  function selectWarning(w: Warning) {
    // L'annotation de carte suit LE clic : un défaut de plan allume ses cases, tout autre
    // avertissement l'éteint (une mise en évidence périmée désignerait des cases étrangères).
    setPlanFocusKey(w.scope === 'plan' && w.plan ? planDefectKey(w.plan) : null);
    if (w.scope === 'dialogue') return openLogic('dialogues', w.refId);
    if (w.scope === 'encounter') return openLogic('encounters', w.refId);
    if (w.scope === 'plan' && w.plan) {
      // Défaut de PLAN : l'auteur atterrit sur l'ÉTAGE fautif, l'outil en Sélection ; une ZONE se
      // sélectionne EN PLUS comme zone (l'inspecteur reste le moyen de la retailler).
      const at = w.plan.at;
      if (scene.layers.some((layer) => layer.z === at.z)) setCurrentLayer(at.z);
      setTool({ mode: 'select' });
      if (at.kind === 'zone') {
        const idx = (scene.effectZones ?? []).findIndex((z) => z.id === at.zoneId);
        if (idx >= 0) setSel({ type: 'effectZone', idx });
      }
      return;
    }
    const architectureSel = architectureSelectionForWarning(w);
    if (architectureSel) {
      const bodyId = architectureSel.type === 'architectureBody' ? architectureSel.id : architectureSel.bodyId;
      const body = scene.architecture?.find((candidate) => candidate.id === bodyId);
      const storeyId = architectureSel.type === 'architectureStorey'
        ? architectureSel.id
        : architectureSel.type === 'architecturePart'
          ? architectureSel.storeyId
          : undefined;
      const z = storeyId !== undefined
        ? body?.storeys.find((storey) => storey.id === storeyId)?.z
        : architectureSel.type === 'facadeSection'
          ? body?.facades.find((facade) => facade.id === architectureSel.id)?.z
          : architectureSel.type === 'roofSection'
            ? body?.masses.find((mass) => mass.id === architectureSel.id)?.z
            : undefined;
      setArchitectureMode(true);
      setArchitectureBodyId(bodyId);
      if (storeyId !== undefined) setArchitectureStoreyId(storeyId);
      else if (z !== undefined) setArchitectureStoreyId(body?.storeys.find((storey) => storey.z === z)?.id ?? null);
      else setArchitectureStoreyId(body?.storeys[0]?.id ?? null);
      if (z !== undefined && scene.layers.some((layer) => layer.z === z)) setCurrentLayer(z);
      setTool({ mode: 'select' });
      setArchitectureAction('select');
      setSel(architectureSel);
      return;
    }
    if (!w.refId) return;
    if (w.scope === 'entity') setSel({ type: 'entity', id: w.refId });
    else if (w.scope === 'trigger') selectFromCanvas({ type: 'trigger', id: w.refId });
  }

  // --- Fichier : import/export/bibliothèque/test ---
  /**
   * L'identité du document en cours : celle du paquet chargé, ou celle que NOMME le geste
   * d'enregistrement — le champ pré-rempli de `SaveProjectModal` (arbitrage utilisateur
   * 2026-08-31 : « Un projet se NOMME avant d'être enregistré »). Un brouillon jamais nommé ne
   * franchit plus `parseProject` : l'enveloppe exige `id`/`label` et une provenance.
   */
  function identiteCourante(nom: string, id: string): ProjectIdentite {
    return { ...(identite ?? { type: 'projet' as const, id, versionContenu: 1, maison: MAISON_PROJET_AUTHORE }), label: nom };
  }
  /** L'ÉTAT VIVANT de l'éditeur lié au constructeur unique du document (`state/worldMap`) — les
   *  trois sorties du projet (enregistrer, exporter, mettre à l'essai) partent d'ici. */
  function documentCourant(nom: string, id: string): ProjectDoc {
    return documentDeProjet(identiteCourante(nom, id), [scene, ...otherScenes], { worldMap, activeAxes, narratif });
  }
  /** La porte UNIQUE du document (`parseProject`), passée AVANT toute écriture : rend le refus À LIRE,
   *  ou `null`. */
  function refusDeLaPorte(doc: ProjectDoc, geste: GesteDePorte): RefusRendu | null {
    try {
      parseProject(doc);
      return null;
    } catch (refus) {
      return refusDeLaPorteDuProjet(refus, doc, geste);
    }
  }
  function exportJson() {
    // Exporte le PROJET (scènes + carte du monde) ; la première scène est l'entrée, et son id
    // nomme le fichier — c'est donc lui qui identifie un projet encore jamais enregistré.
    const project = documentCourant(projectName, projectId ?? scene.id);
    // Ce qui part au disque passe la porte unique du document, comme ce qui s'enregistre et ce qui
    // s'importe (#877) : refusé, rien n'est téléchargé et l'auteur le lit.
    const refus = refusDeLaPorte(project, 'export');
    if (refus) {
      setRefusDuGeste({ titre: TITRE_EXPORT, ...refus });
      return;
    }
    setRefusDuGeste(null);
    downloadText(`${scene.id}-projet.json`, JSON.stringify(project, null, 2));
  }
  /**
   * Un fichier peut être refusé pour DEUX causes, et l'auteur ne corrige pas la même chose : le
   * fichier n'est pas du JSON (éditeur de texte), ou c'est un JSON que la porte du document refuse
   * (#877 — le refus NOMME alors la scène et l'entité). Rien n'est chargé dans les deux cas.
   */
  function importJson(file: File) {
    file.text().then((txt) => {
      let data: unknown;
      try {
        data = JSON.parse(txt);
      } catch (erreur) {
        setRefusDuGeste({ titre: TITRE_IMPORT, ...refusMotive('import', `ce fichier n’est pas du JSON${ouCaCasse(erreur)}`) });
        return;
      }
      let paquet: ReturnType<typeof parseProject>;
      try {
        paquet = parseProject(data);
      } catch (refus) {
        setRefusDuGeste({ titre: TITRE_IMPORT, ...refusDeLaPorteDuProjet(refus, data, 'import') });
        return;
      }
      const { scenes, worldMap: wm, activeAxes: aa, narratif: na, label, ...ident } = paquet;
      setRefusDuGeste(null);
      setOtherScenes(scenes.slice(1).map(clone));
      setWorldMap(wm ?? null);
      setActiveAxes(aa);
      setNarratif(na);
      // L'identité du document importé est reconduite JUSQU'À l'entrée de bibliothèque, comme au
      // chargement d'un projet enregistré (`loadSaved`) : `identite` porte le document, `projectId`
      // et `projectName` portent l'entrée que « Enregistrer » écrira. Sans cette reconduite, la
      // modale se pré-remplissait du nom de l'éditeur et l'enregistrement fabriquait une entrée
      // dont le document gardait l'id et le nom importés — entrée et document divergents, le nom
      // du document masqué à l'écran.
      setIdentite(ident);
      setProjectId(ident.id);
      setProjectName(label);
      setSel(null);
      resetScene(clone(scenes[0]));
    });
  }
  /** « ▶ Tester » charge le projet EN JEU : il passe donc la même porte que les autres sorties du
   *  document (#877) — mettre à l'essai un projet que le schéma refuse jetterait l'auteur dans un
   *  monde à moitié cuit, loin de l'écran où il peut corriger. */
  function test() {
    if (party.length === 0) {
      setRefusDuGeste({
        titre: TITRE_TEST,
        ...refusMotive('test', 'aucun aventurier au groupe. Ajoutez-en au moins un par « Nouvelle partie » avant de tester la scène'),
      });
      return;
    }
    const refus = refusDeLaPorte(documentCourant(projectName, projectId ?? scene.id), 'test');
    if (refus) {
      setRefusDuGeste({ titre: TITRE_TEST, ...refus });
      return;
    }
    setRefusDuGeste(null);
    loadProject([scene, ...otherScenes], scene.id, worldMap, narratif);
    setScreen('campaign');
  }
  function loadScenario(sc: TestScenario) {
    setOtherScenes((sc.extraScenes ?? []).map(clone));
    setWorldMap(sc.worldMap ? JSON.parse(JSON.stringify(sc.worldMap)) : null);
    setActiveAxes(undefined);
    setNarratif(emptyNarratif());
    setIdentite(undefined);
    setProjectId(null);
    setProjectName(sc.title);
    setPublished(false);
    setSel(null);
    resetScene(clone(sc.scene));
    setOpenOpen(false);
  }
  /** Ouvrir une campagne BUILT-IN (Arène ou campagne du jeu) : jamais en édition directe du JSON
   *  commité — `projectId` reste `null`, donc « Enregistrer » crée un NOUVEAU projet localStorage
   *  (#367, même garantie que `loadScenario` pour les scénarios de test). */
  function loadBuiltin(bc: BuiltinCampaign) {
    const copie = copieDuJeu(bc);
    setOtherScenes(copie.autresScenes);
    setWorldMap(copie.worldMap);
    setActiveAxes(copie.activeAxes);
    setNarratif(copie.narratif);
    // Seul `projectId` reste `null` — l'enregistrement crée une entrée neuve.
    setIdentite(copie.identite);
    setProjectId(null);
    setProjectName(`Copie de ${bc.label}`);
    setPublished(false);
    setSel(null);
    resetScene(copie.depart);
    setOpenOpen(false);
  }
  /** Rend le REFUS quand le document ne s'ouvre pas (porte du document), `null`
   *  quand la scène est posée. La modale ignore cette valeur (elle lit `loadError`) ; le pont de
   *  recette (`editeur.ouvrir`, #1478) en fait son verdict — un `✓` sur un document refusé mentirait. */
  function loadSaved(p: SavedProject): RefusRendu | null {
    let scenes: Scene[];
    let wm: WorldMap | undefined;
    let aa: string[] | undefined;
    let na: NarratifBlock;
    let label: string;
    let ident: Omit<ProjectIdentite, 'label'>;
    const doc = documentDeLEntree(p);
    try {
      ({ scenes, worldMap: wm, activeAxes: aa, narratif: na, label, ...ident } = parseProject(doc)); // même validation/migration que l'import JSON
    } catch (e) {
      const refus = refusDeLaPorteDuProjet(e, doc, 'ouverture');
      setLoadError(refus);
      return refus;
    }
    setLoadError(null);
    setOtherScenes(scenes.slice(1).map(clone));
    setWorldMap(wm ? JSON.parse(JSON.stringify(wm)) : null);
    setActiveAxes(aa);
    setNarratif(na);
    setIdentite(ident);
    setProjectId(p.id);
    setProjectName(label);
    setPublished(p.published);
    setSel(null);
    resetScene(clone(scenes[0]));
    setOpenOpen(false);
    return null;
  }
  /** #811 : le résultat de `projectSave` est CONSULTÉ — un échec (quota, écriture refusée…) est
   *  rendu visible à l'auteur (`saveError`, modale conservée ouverte) au lieu d'être jeté.
   *
   *  ET ce qu'on ÉCRIT passe la MÊME porte que ce qu'on OUVRE (`parseProject`, la porte unique du
   *  document) : sans elle, l'éditeur couchait en silence un projet que « Ouvrir » refuse ensuite en
   *  bloc — un piège à perte de travail, pour TOUTE contrainte du schéma. Refusé = rien n'est écrit,
   *  la modale reste ouverte, et le filet d'autosave n'est PAS purgé (il est alors le seul recours). */
  async function saveProject(name: string, pub: boolean, startSceneId: string) {
    const id = projectId ?? `proj-${Date.now().toString(36)}`;
    const project = documentCourant(name, id);
    const refus = refusDeLaPorte(project, 'enregistrement');
    if (refus) {
      setSaveError(refus);
      return;
    }
    const res = await projectSave({
      id,
      label: name,
      startSceneId,
      savedAt: Date.now(),
      published: pub,
      project,
    });
    if (!res.ok) {
      setSaveError({ message: res.message });
      return;
    }
    setSaveError(null);
    setProjectId(id);
    setProjectName(name);
    setPublished(pub);
    setSaveOpen(false);
    // #834 audit pt. B : le filet de crash des scènes du projet devient caduc dès l'enregistrement
    // EXPLICITE réussi — le laisser vivre proposerait plus tard une « reprise » d'un brouillon
    // déjà couché dans le projet, sans qu'aucune comparaison de date ne le distingue. #834 audit-2
    // défaut 4 : TOUTES les scènes du projet couché, pas seulement l'active (l.559 en enregistre N).
    // #834 audit-2 défaut 6 : un succès DÉGRADÉ (IndexedDB en échec, seul le miroir localStorage a
    // absorbé) ne purge RIEN — le projet ne vit alors QUE sur le miroir, le filet local reste le seul
    // recours tant qu'IndexedDB n'a pas absorbé une écriture réussie.
    if (!res.degraded) {
      for (const s of [scene, ...otherScenes]) autosaveDelete(s.id);
    }
  }
  function newProject() {
    setOtherScenes([]);
    setWorldMap(null);
    setActiveAxes(undefined);
    setNarratif(emptyNarratif());
    setIdentite(undefined);
    setProjectId(null);
    setProjectName('Nouveau projet');
    setPublished(false);
    setSel(null);
    resetScene(emptyScene());
  }
  function openAdvanced() {
    setAdvText(JSON.stringify({ dialogues: scene.dialogues, triggers: scene.triggers, encounters: scene.encounters }, null, 2));
    setAdvOpen(true);
  }
  /** Export ASCII (grilles `walled`/`zoneMap` de la scène active, `state/sceneToAscii.ts`) — copiable/
   *  téléchargeable, prêt à coller dans un `*.ascii.ts` source. Voir `SceneAsciiExport.notRestored`
   *  pour ce que cet export NE restitue PAS (bind/cells/entities/architecture/…, cf. modale). */
  function exportAscii() {
    setAsciiExport(sceneToAscii(scene));
  }
  function downloadAscii() {
    if (asciiExport) downloadText(`${scene.id}.ascii.ts`, asciiExport.text, 'text/plain');
  }
  /**
   * Le JSON collé passe le SCHÉMA des blocs qu'il édite (#877) avant de toucher la scène : sans
   * lui, l'éditeur couchait n'importe quelle valeur sous `dialogues`/`triggers`/`encounters`.
   * Une clé ABSENTE laisse le bloc de la scène INTACT — un repli `?? []` effacerait le travail que
   * le texte collé ne mentionne simplement pas.
   */
  function saveAdvanced() {
    let brut: unknown;
    try {
      brut = JSON.parse(advText);
    } catch (erreur) {
      setAdvError(`Ce texte n’est pas du JSON${ouCaCasse(erreur)}.`);
      return;
    }
    const lu = SCHEMA_BLOCS_AVANCES.safeParse(brut);
    if (!lu.success) {
      setAdvError(formatZodError('Blocs de logique', lu.error));
      return;
    }
    setAdvError(null);
    setScene({
      ...scene,
      ...(lu.data.dialogues !== undefined ? { dialogues: lu.data.dialogues } : {}),
      ...(lu.data.triggers !== undefined ? { triggers: lu.data.triggers } : {}),
      ...(lu.data.encounters !== undefined ? { encounters: lu.data.encounters } : {}),
    });
    setAdvOpen(false);
  }
  function resize(w: number, h: number) {
    setScene(resizeGrid(scene, w, h));
  }

  const { w, h } = scene.dimensions;
  const hoverIn = hover && hover.x >= 0 && hover.y >= 0 && hover.x < w && hover.y < h ? hover : null;

  return (
    <div className="screen editor-screen">
      <EditorToolbar
        onBack={() => setScreen('menu')}
        projectName={projectName}
        onNew={newProject}
        onOpen={() => setOpenOpen(true)}
        onSave={() => setSaveOpen(true)}
        onImport={importJson}
        onExport={exportJson}
        onExportAscii={exportAscii}
        onAdvanced={openAdvanced}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        scenes={[scene, ...otherScenes]}
        activeId={scene.id}
        onSwitchScene={switchScene}
        onAddScene={addScene}
        onDuplicateScene={duplicateScene}
        onDeleteScene={deleteScene}
        worldCount={worldMap ? worldMap.places.length : null}
        onWorld={() => setWorldOpen(true)}
        narratifCount={narratif.affaires.length + narratif.indices.length + narratif.presetsPnj.length + narratif.objets.length}
        onNarratif={() => setNarratifOpen(true)}
        onTest={test}
      />

      <div className="editor-main" data-drawer={drawer ?? undefined}>
        <Palette
          scene={scene}
          tool={tool}
          setTool={selectMapTool}
          brush={brush}
          setBrush={setBrush}
          terrainRect={terrainRect}
          setTerrainRect={setTerrainRect}
          encTarget={encTarget}
          setEncTarget={setEncTarget}
          encRef={encFiche}
          setEncRef={setEncRef}
          enemyCreatures={enemyCreatures}
          currentLayer={currentLayer}
          stairRun={stairRun}
          onStairApply={applyStairRun}
          onStairClear={() => setStairRun([])}
          architectureMode={architectureMode}
          architectureBodyId={architectureBody?.id ?? null}
          architectureStoreyId={architectureStorey?.id ?? null}
          architectureAction={architectureAction}
          onArchitectureMode={enterArchitectureMode}
          onArchitectureBody={selectArchitectureBody}
          onArchitectureStorey={selectArchitectureStorey}
          onAddArchitectureBody={createArchitectureBody}
          onAddArchitecturePart={createArchitecturePart}
          onAddArchitectureStorey={createArchitectureStorey}
          onAddRoofSection={createRoofSection}
          onArmFacade={() => setArchitectureAction('facade')}
        />

        {/* Colonne centrale de la grille (1 enfant par colonne, sinon la grille 3 colonnes déborde en
            ligne implicite et s'effondre) : le canvas + la barre d'étages en OVERLAY ancré dessus. */}
        <div className="editor-canvas-col">
        <EditorCanvas
          scene={scene}
          view={view}
          setScene={setScene}
          setSceneNoHistory={setSceneNoHistory}
          pushSnapshot={pushSnapshot}
          tool={tool}
          brush={brush}
          terrainRect={terrainRect}
          encTarget={encTarget}
          setEncTarget={setEncTarget}
          encRef={encFiche}
          layers={layers}
          sel={sel}
          planFocus={planFocus}
          onSelect={selectFromCanvas}
          onHover={onHover}
          stairRun={stairRun}
          onStairTrace={traceStairCell}
          currentLayer={currentLayer}
          architectureMode={architectureMode}
          architectureBodyId={architectureBody?.id ?? null}
          architectureZ={architectureStorey?.z ?? null}
          architectureAction={architectureAction}
          onArchitectureActionComplete={() => setArchitectureAction('select')}
          traceLayer={traceLayer}
          lowerLayerOpacity={lowerLayerOpacity}
          lowerLayerMode={lowerLayerMode}
          traceCalibStep={traceCalib.step}
          onTraceCalibClick={onTraceCalibClick}
        />

        <TraceLayerPanel
          hasLayer={!!traceLayer}
          visible={traceLayer?.visible ?? false}
          opacity={traceLayer?.opacity ?? 0.6}
          calibStep={traceCalib.step}
          position={traceLayer?.position ?? 'above'}
          allowRotation={traceLayer?.allowRotation ?? false}
          contraste={traceLayer?.contraste ?? false}
          layerZ={currentLayer}
          expanded={tracePanelExpanded}
          onLoadFile={loadTraceImage}
          onToggleVisible={() => traceLayer && persistTraceLayer({ ...traceLayer, visible: !traceLayer.visible })}
          onOpacityChange={(opacity) => traceLayer && persistTraceLayer({ ...traceLayer, opacity })}
          onPositionChange={(position) => traceLayer && persistTraceLayer({ ...traceLayer, position })}
          onAllowRotationChange={(allowRotation) => traceLayer && persistTraceLayer({ ...traceLayer, allowRotation })}
          onContrasteChange={(contraste) => traceLayer && persistTraceLayer({ ...traceLayer, contraste })}
          onToggleExpanded={toggleTracePanelExpanded}
          onStartCalibration={() => setTraceCalib({ step: 'image1' })}
          onCancelCalibration={() => setTraceCalib({ step: 'idle' })}
          onRemove={() => { persistTraceLayer(null); setTraceCalib({ step: 'idle' }); }}
          panelRef={(el) => { view.bottomOverlayRef.current = el; }}
        />

        <div
          className="ed-level-bar"
          ref={(el) => { view.topOverlayRef.current = el; }}
          title="Étages du plan : le rez, puis les surplombs (loges/galeries/passerelles)"
        >
          <LayerField z={currentLayer} layers={sceneLayerZs(scene)} onChange={setCurrentLayer} />
          <button
            className="btn small"
            title="Ajouter un étage au-dessus"
            onClick={() => {
              const z = Math.max(...scene.layers.map((l) => l.z)) + 1;
              setScene(addLayer(scene, z));
              setCurrentLayer(z);
            }}
          >
            ＋
          </button>
          <button
            className="btn small danger"
            disabled={currentLayer === 0}
            title="Supprimer cet étage"
            onClick={() => {
              setScene(removeLayer(scene, currentLayer));
              setCurrentLayer(0);
            }}
          >
            －
          </button>
          <OptionChooser
            layout="seg"
            options={[
              {
                key: 'gabarit',
                label: 'Gabarit',
                title: 'Les étages du dessous restent dessinés, voilés — repère d’alignement',
                selected: lowerLayerMode === 'gabarit',
                onSelect: () => setLowerLayerMode('gabarit'),
              },
              {
                key: 'isolee',
                label: 'Isolée',
                title: 'Seul l’étage actif est dessiné — aucun tracé du dessous à l’écran',
                selected: lowerLayerMode === 'isolee',
                onSelect: () => setLowerLayerMode('isolee'),
              },
            ]}
          />
          <label
            className="ed-subfield"
            title="Opacité du gabarit de l’étage inférieur — 0 = masqué, 1 = plein (repère net pour aligner)"
          >
            <span>Opacité</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(lowerLayerOpacity * 100)}
              disabled={lowerLayerMode === 'isolee' || !scene.layers.some((l) => l.z < currentLayer)}
              onChange={(e) => setLowerLayerOpacity(Number(e.target.value) / 100)}
              aria-label="Opacité du gabarit de l’étage inférieur"
            />
          </label>
        </div>
        </div>

        <Inspector
          scene={scene}
          otherScenes={otherScenes}
          worldMap={worldMap}
          setScene={setScene}
          sel={sel}
          setSel={setSel}
          enemyCreatures={enemyCreatures}
          openLogic={openLogic}
          resizeScene={resize}
          narratif={narratif}
          tool={tool}
          armZoneTiles={armZoneTiles}
          zoneFocusKey={zoneFocusKey}
        />

        {drawer && <div className="editor-drawer-backdrop" onClick={() => setDrawer(null)} />}
      </div>

      <StatusBar
        hover={hoverIn}
        hoverTerrain={hoverIn ? tileAt(scene, hoverIn.x, hoverIn.y) : null}
        tool={tool}
        dims={scene.dimensions}
        layers={layers}
        setLayers={setLayers}
      />

      <LogicDock
        scene={scene}
        otherScenes={otherScenes}
        worldMap={worldMap}
        setScene={setScene}
        warnings={warnings}
        onSelectWarning={selectWarning}
        tab={dockTab}
        setTab={setDockTab}
        height={dockH}
        setHeight={setDockH}
        trigSel={sel?.type === 'trigger' ? sel.id : null}
        setTrigSel={(id) => setSel(id ? { type: 'trigger', id } : null)}
        dlgSel={dlgSel}
        setDlgSel={setDlgSel}
        encSel={encSel}
        setEncSel={setEncSel}
        onSelectEntity={(id) => { setSel({ type: 'entity', id }); setDrawer('inspector'); }}
        currentLayer={currentLayer}
      />

      <div className="editor-mobile-bar">
        <button className={`btn${drawer === 'palette' ? ' btn-primary' : ''}`} onClick={() => setDrawer(drawer === 'palette' ? null : 'palette')}>
          <Icon id="map-tool/paint" size="sm" /> Outils
        </button>
        <button className={`btn${drawer === 'inspector' ? ' btn-primary' : ''}`} onClick={() => setDrawer(drawer === 'inspector' ? null : 'inspector')}>
          <Icon id="ui/search" size="sm" /> Inspecteur
        </button>
      </div>

      {autosaveEcartee && (
        <button type="button" className="btn small autosave-recovery-pill" role="status" onClick={oublierAutosaveEcartee}>
          <Icon id="ui/warning" size="sm" /> Sauvegarde locale écartée : {autosaveEcartee} — Compris
        </button>
      )}
      {autosaveRecoveryHidden && (
        <button type="button" className="btn small autosave-recovery-pill" onClick={showAutosaveRecovery}>
          <Icon id="ui/undo" size="sm" /> Sauvegarde locale en attente…
        </button>
      )}
      {autosaveRecovery && (
        <Modal
          variant="plain"
          title="Reprendre une sauvegarde locale ?"
          onClose={hideAutosaveRecovery}
        >
          <p className="hint">
            Une sauvegarde automatique de « {autosaveRecovery.scene.label || autosaveRecovery.scene.id} » diffère de
            la version actuellement chargée. Elle date du {new Date(autosaveRecovery.savedAt).toLocaleString('fr-FR')}.
            La restaurer, ou l'ignorer et repartir de la version chargée ?
          </p>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={dismissAutosave}>
              Ignorer et supprimer
            </button>
            <button type="button" className="btn" onClick={restoreAutosave} title="Annulable ensuite par Ctrl+Z — rien ne prouve que cette sauvegarde locale est plus récente que la version chargée">
              Restaurer
            </button>
          </div>
        </Modal>
      )}
      {worldOpen && (
        <WorldMapEditor map={worldMap} setMap={setWorldMap} scenes={[scene, ...otherScenes]} onClose={() => setWorldOpen(false)} activeAxes={activeAxes} setActiveAxes={setActiveAxes} />
      )}
      {narratifOpen && (
        <NarratifEditor narratif={narratif} onChange={setNarratif} onClose={() => setNarratifOpen(false)} />
      )}
      {openOpen && (
        <OpenProjectModal onScenario={loadScenario} onProject={loadSaved} onBuiltin={loadBuiltin} error={loadError} onClose={() => { setOpenOpen(false); setLoadError(null); }} />
      )}
      {refusDuGeste && (
        <Modal variant="plain" title={refusDuGeste.titre} onClose={() => setRefusDuGeste(null)}>
          <ChipDeRefus refus={refusDuGeste} />
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={() => setRefusDuGeste(null)}>
              Fermer
            </button>
          </div>
        </Modal>
      )}
      {saveOpen && (
        <SaveProjectModal
          initialName={projectName}
          initialPublished={published}
          scenes={[scene, ...otherScenes]}
          initialStartId={scene.id}
          onSave={saveProject}
          onClose={() => { setSaveOpen(false); setSaveError(null); }}
          error={saveError}
        />
      )}

      {advOpen && (
        <Modal
          variant="plain"
          className="wide"
          title="Avancé — JSON de la scène (dialogues, triggers, rencontres)"
          onClose={() => setAdvOpen(false)}
          backdropClose
        >
          <p className="hint">Filet de sécurité pour l'édition en masse ; le format est celui du schéma de Scène.</p>
          {advError && <p className="chip tone-danger" role="alert">{advError}</p>}
          <textarea className="json-editor" value={advText} onChange={(e) => setAdvText(e.target.value)} />
          <div className="modal-actions">
            <button className="btn" onClick={() => setAdvOpen(false)}>
              Annuler
            </button>
            <button className="btn btn-primary" onClick={saveAdvanced}>
              Appliquer
            </button>
          </div>
        </Modal>
      )}
      {asciiExport && (
        <Modal
          variant="plain"
          className="wide"
          title="Export ASCII — grilles de la carte (walled/zoneMap)"
          onClose={() => setAsciiExport(null)}
          backdropClose
        >
          <p className="hint">
            Export PARTIEL : seules les grilles walled/zoneMap et les tables legend/wallLegend/zoneLegend/relief sont
            réémises. Ne remplacez QUE ces éléments dans le fichier <code>*.ascii.ts</code> source — le reste du <code>MapSpec</code>
            (marqueurs, recettes, entités, logique) reste à reporter à la main. Ce qui n'est PAS restitué :
          </p>
          <ul className="hint">
            {asciiExport.notRestored.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
          <textarea className="json-editor" readOnly value={asciiExport.text} />
          <div className="modal-actions">
            <button className="btn" onClick={() => setAsciiExport(null)}>
              Fermer
            </button>
            <button className="btn" onClick={() => navigator.clipboard?.writeText(asciiExport.text)}>
              Copier
            </button>
            <button className="btn btn-primary" onClick={downloadAscii}>
              Télécharger
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
