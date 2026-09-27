import type { TraceTransform } from './traceCalibration';
import { ecrireDansBase, lireDansBase, type BaseIdb } from '../lib/indexedDb';

/**
 * Persistance du CALQUE DE RÉFÉRENCE de l'éditeur (planche de livre décalquée, #830) — jamais de la
 * donnée de scène : ne fait PARTIE d'aucun `Scene`/`ProjectDoc`, n'entre dans AUCUN export (JSON,
 * ASCII, projet partagé). Purement une aide d'AUTHORING locale, gitignorée de fait (l'image vit en
 * `data:` URL dans SON PROPRE magasin IndexedDB), keyée par **(id de scène, couche z)** — retour
 * user 2026-07-25 : « j'ai un plan pour chaque niveau » (rez-de-chaussée / étage sur la MÊME planche
 * source, cf. `art-ref/page012_full.png`) — chaque couche garde son PROPRE calque (image, calage,
 * opacité, position). Magasin dédié, DÉLIBÉRÉMENT séparé de `state/projectLibrary.ts` : une planche
 * de livre sous droits n'a rien à faire dans la bibliothèque de PROJETS, et sa taille — plusieurs Mo
 * par image — n'a pas à peser sur le quota/miroir localStorage de cette dernière. Un second magasin,
 * `panelExpanded`, garde le repli/dépli du panneau — keyé par SCÈNE SEULE (pas par couche : un
 * panneau replié doit le rester en changeant de couche, cf. #830 suite).
 */
export interface TraceLayerRecord {
  sceneId: string;
  /** Couche (z) — clé composite avec `sceneId` : un même bâtiment peut avoir un plan par étage. */
  z: number;
  imageDataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  opacity: number; // 0..1
  visible: boolean;
  /** `above` (défaut) = décalquer/comparer par-dessus la scène construite (le terrain est OPAQUE —
   *  « en dessous » y est invisible partout où il y a du sol) ; `below` = dessiner sur du vide, utile
   *  sur une carte neuve. Retour user 2026-07-25 : le défaut initial « toujours en dessous » était
   *  une erreur de spec, corrigée ici. */
  position: 'above' | 'below';
  /** Autorise la calibration à déduire une ROTATION (planche scannée de travers) — faux par défaut :
   *  une planche est normalement scannée droite, verrouiller l'angle à 0 évite l'inclinaison parasite
   *  d'un calage au pixel près (retour user 2026-07-25). */
  allowRotation: boolean;
  /** MODE CALAGE : tant que le calque est VISIBLE, le mobilier volumique de la scène se rend en aplat
   *  cyan contrasté + arêtes (`gameIso/backends/webgl/calageProps.ts`), pour que le plan dessiné et la
   *  scène construite se distinguent à l'œil. Faux par défaut : le mode sert à COMPARER, pas à
   *  construire. Aide d'authoring comme le reste du record — jamais une donnée de scène. */
  contraste: boolean;
  transform: TraceTransform;
  savedAt: number;
}

export interface TraceLayerBackend {
  get(sceneId: string, z: number): Promise<TraceLayerRecord | null>;
  put(entry: TraceLayerRecord): Promise<void>;
  delete(sceneId: string, z: number): Promise<void>;
  getExpanded(sceneId: string): Promise<boolean | null>; // null = jamais réglé, l'appelant applique son défaut
  putExpanded(sceneId: string, expanded: boolean): Promise<void>;
  clear(): Promise<void>;
}

const STORE = 'layers';
const PANEL_STORE = 'panelExpanded';

/** Montée de `wfrp4-trace-layers` (#830) : en v2, `layers` est keyé `(sceneId, z)`. */
export const upgradeCalques: BaseIdb['upgrade'] = (db, ancienneVersion) => {
  if (ancienneVersion < 2) {
    if (db.objectStoreNames.contains(STORE)) db.deleteObjectStore(STORE);
    db.createObjectStore(STORE, { keyPath: ['sceneId', 'z'] });
  }
  if (!db.objectStoreNames.contains(PANEL_STORE)) db.createObjectStore(PANEL_STORE, { keyPath: 'sceneId' });
};

const BASE: BaseIdb = { nom: 'wfrp4-trace-layers', version: 2, upgrade: upgradeCalques };

const realBackend: TraceLayerBackend = {
  async get(sceneId, z) {
    return ((await lireDansBase(BASE, STORE, (m) => m.get([sceneId, z]))) as TraceLayerRecord | undefined) ?? null;
  },
  put: (entry) => ecrireDansBase(BASE, STORE, (tx) => { tx.objectStore(STORE).put(entry); }),
  delete: (sceneId, z) => ecrireDansBase(BASE, STORE, (tx) => { tx.objectStore(STORE).delete([sceneId, z]); }),
  async getExpanded(sceneId) {
    const r = (await lireDansBase(BASE, PANEL_STORE, (m) => m.get(sceneId))) as { sceneId: string; expanded: boolean } | undefined;
    return r?.expanded ?? null;
  },
  putExpanded: (sceneId, expanded) =>
    ecrireDansBase(BASE, PANEL_STORE, (tx) => { tx.objectStore(PANEL_STORE).put({ sceneId, expanded }); }),
  clear: () => ecrireDansBase(BASE, [STORE, PANEL_STORE], (tx) => {
    tx.objectStore(STORE).clear();
    tx.objectStore(PANEL_STORE).clear();
  }),
};

let backend: TraceLayerBackend = realBackend;

export function __setTraceLayerBackendForTest(b: TraceLayerBackend | null): void {
  backend = b ?? realBackend;
}

/** Lecture — `null` si aucun calque enregistré pour cette (scène, couche), ou si IndexedDB est
 *  indisponible (mode privé strict, jsdom…) : le calque reste alors une aide de SESSION, jamais une
 *  donnée qui bloque l'ouverture de l'éditeur. */
export async function traceLayerLoad(sceneId: string, z: number): Promise<TraceLayerRecord | null> {
  try {
    return await backend.get(sceneId, z);
  } catch {
    return null;
  }
}

/** Écriture best-effort : une persistance en échec (quota IndexedDB dépassé par une image trop
 *  lourde, accès refusé…) ne doit jamais faire planter l'éditeur — le calque reste utilisable pour
 *  la session, seul le round-trip disque est perdu. */
export async function traceLayerSave(entry: TraceLayerRecord): Promise<void> {
  try {
    await backend.put(entry);
  } catch (err) {
    console.error(`[traceLayer] persistance du calque de « ${entry.sceneId} » (couche ${entry.z}) en échec (session non affectée).`, err);
  }
}

export async function traceLayerDelete(sceneId: string, z: number): Promise<void> {
  try {
    await backend.delete(sceneId, z);
  } catch (err) {
    console.error(`[traceLayer] suppression du calque de « ${sceneId} » (couche ${z}) en échec.`, err);
  }
}

/** Repli/dépli du panneau « Calque de référence » — PAR SCÈNE (pas par couche, volontairement : il ne
 *  doit pas ressurgir de force en changeant de couche). `null`/erreur = jamais réglé, l'appelant
 *  applique son propre défaut (déplié). */
export async function panelExpandedLoad(sceneId: string): Promise<boolean | null> {
  try {
    return await backend.getExpanded(sceneId);
  } catch {
    return null;
  }
}

export async function panelExpandedSave(sceneId: string, expanded: boolean): Promise<void> {
  try {
    await backend.putExpanded(sceneId, expanded);
  } catch (err) {
    console.error(`[traceLayer] persistance du repli du panneau de « ${sceneId} » en échec.`, err);
  }
}

/** Test-only : vide les magasins pour l'isolation entre tests. */
export async function __resetTraceLayerForTest(): Promise<void> {
  await backend.clear();
}
