import type { TraceTransform } from './traceCalibration';
import { accesBase, type BaseIdb } from '../lib/indexedDb';

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

const base = accesBase({ nom: 'wfrp4-trace-layers', version: 2, upgrade: upgradeCalques });
const calques = base.magasin<TraceLayerRecord, [string, number]>(STORE);
const panneaux = base.magasin<{ sceneId: string; expanded: boolean }, string>(PANEL_STORE);

/** Lecture — `null` si aucun calque enregistré pour cette (scène, couche), ou si IndexedDB est
 *  indisponible (mode privé strict, jsdom…) : le calque reste alors une aide de SESSION, jamais une
 *  donnée qui bloque l'ouverture de l'éditeur. */
export async function traceLayerLoad(sceneId: string, z: number): Promise<TraceLayerRecord | null> {
  try {
    return await calques.lire([sceneId, z]);
  } catch {
    return null;
  }
}

/** Écriture best-effort : une persistance en échec (quota IndexedDB dépassé par une image trop
 *  lourde, accès refusé…) ne doit jamais faire planter l'éditeur — le calque reste utilisable pour
 *  la session, seul le round-trip disque est perdu. */
export async function traceLayerSave(entry: TraceLayerRecord): Promise<void> {
  try {
    await calques.ecrire(entry);
  } catch (err) {
    console.error(`[traceLayer] persistance du calque de « ${entry.sceneId} » (couche ${entry.z}) en échec (session non affectée).`, err);
  }
}

export async function traceLayerDelete(sceneId: string, z: number): Promise<void> {
  try {
    await calques.supprimer([sceneId, z]);
  } catch (err) {
    console.error(`[traceLayer] suppression du calque de « ${sceneId} » (couche ${z}) en échec.`, err);
  }
}

/** Repli/dépli du panneau « Calque de référence » — PAR SCÈNE (pas par couche, volontairement : il ne
 *  doit pas ressurgir de force en changeant de couche). `null`/erreur = jamais réglé, l'appelant
 *  applique son propre défaut (déplié). */
export async function panelExpandedLoad(sceneId: string): Promise<boolean | null> {
  try {
    return (await panneaux.lire(sceneId))?.expanded ?? null;
  } catch {
    return null;
  }
}

export async function panelExpandedSave(sceneId: string, expanded: boolean): Promise<void> {
  try {
    await panneaux.ecrire({ sceneId, expanded });
  } catch (err) {
    console.error(`[traceLayer] persistance du repli du panneau de « ${sceneId} » en échec.`, err);
  }
}

/** Test-only : vide la base pour l'isolation entre tests. */
export async function __resetTraceLayerForTest(): Promise<void> {
  await base.vider();
}
