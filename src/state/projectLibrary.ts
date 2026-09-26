import { parseProject, exigerUnRefus, refusDeForme, type ProjectDoc } from './worldMap';
import type { NarratifBlock } from './campaignNarratif';
import type { GameState } from './store';

/** Un projet éditeur SÉRIALISÉ en localStorage. Même forme que `ProjectDoc` (SOURCE UNIQUE du schéma
 *  de projet, jamais un littéral `schema`/champs dupliqués), mais RELÂCHÉE pour le stock legacy : un
 *  projet enregistré avant #765 est un schema 2 sans `narratif`, un projet enregistré avant #1467 est
 *  un schema 3 aux anciens rôles de prose ou un schema 4 à poche `meta`, un projet enregistré avant
 *  #1552 est un schema ≤ 6 sans `type` ni identité requise, un projet enregistré avant #1691 est un
 *  schema 7 dont les scènes n'ont pas de matières de relief, un projet enregistré avant #1715 est un
 *  schema 8 dont les scènes n'ont pas de toiture par défaut, un projet enregistré pendant #1687 est
 *  un schema 9 dont les décors à places ne sont pas activés, ou un schema 10 dont les décors
 *  fouillables portent encore un champ `interact`, un projet enregistré avant #877 est un schema 11
 *  dont un décor peut ne NOMMER aucun type, un projet enregistré avant #1882 est un schema 12 dont
 *  un personnage peut ne NOMMER aucune fiche, un projet enregistré avant la T2d de #1882 est un schema 13
 *  dont un effet peut porter une réf. de créature ou de véhicule VIDE. La montée au format courant se fait au CHARGEMENT via
 *  `parseProject` (chaîne 2→3→4→5→6→7→8→9→10→11→12→13→14), jamais dans ce module — et c'est là, pas ici,
 *  que l'absence d'identité se fait REFUSER. */
export type StoredProject = Omit<ProjectDoc, 'schema' | 'narratif' | 'type' | 'id' | 'label' | 'versionContenu'> & {
  schema: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
  narratif?: NarratifBlock;
  type?: 'projet';
  id?: string;
  label?: string;
  versionContenu?: number;
};

/** Une entrée de la bibliothèque de projets (localStorage). `published` = jouable depuis le menu. */
export interface SavedProject {
  id: string;
  label: string;
  startSceneId: string; // scène de départ quand on JOUE la campagne
  savedAt: number;
  published: boolean;
  project: StoredProject;
}

/** Repli d'AFFICHAGE du nom d'un projet : une entrée dont le nom manque (stock d'avant #1552, entrée
 *  fabriquée hors éditeur) se rend NOMMÉE « (sans nom) » plutôt qu'en rangée muette — le geste de
 *  suppression/ouverture reste ainsi désignable. SOURCE UNIQUE des deux écrans qui listent des
 *  projets (« Ouvrir » de l'éditeur, bibliothèque de campagnes). */
export const NOM_DE_PROJET_ABSENT = '(sans nom)';
export function nomDeProjet(label: string | undefined | null): string {
  return label?.trim() || NOM_DE_PROJET_ABSENT;
}

/** Le document de projet d'une entrée de bibliothèque, SOURCE UNIQUE de tout écran qui la lit
 *  (ouverture de l'éditeur, « Jouer » et « Exporter » de la bibliothèque de campagnes), rendu
 *  `unknown` : la porte `parseProject` décide, et refuse nommément ce qui reste sans identité.
 *  - `id` : celui du document ; à défaut (stock d'avant #1552), la clé de l'entrée.
 *  - `label` : le nom de l'entrée dès qu'il n'est pas vide — c'est lui que listent les deux écrans
 *    (`nomDeProjet`) ; à défaut, celui du document (#1343).
 *  - `versionContenu` : 0 quand le document n'en porte pas (dédup #766).
 *  Le `type` et la provenance d'un document antérieur viennent de la migration 6→7
 *  (`PROJECT_MIGRATIONS`), pas d'ici. */
export function documentDeLEntree(p: SavedProject): unknown {
  const doc = p.project as Record<string, unknown>;
  return {
    ...doc,
    id: doc.id ?? p.id,
    label: p.label?.trim() ? p.label : doc.label,
    ...(doc.versionContenu === undefined ? { versionContenu: 0 } : {}),
  };
}

/** La campagne LANCÉE depuis une entrée de bibliothèque (`setPendingCampaign`), SOURCE UNIQUE de tout
 *  écran qui la joue (« Jouer » de la bibliothèque, « Choisir » du picker de `PartyScreen`) : le
 *  document passe la porte `parseProject(documentDeLEntree(p))` — migré, validé — et un refus lève
 *  `ProjetRefuse`, laissé à l'appelant. Le `label` est celui du document PARSÉ, donc déjà celui de
 *  `documentDeLEntree` ; l'`id` et la scène d'entrée sont ceux de l'ENTRÉE (clé du picker), et une
 *  scène d'entrée absente du document lève `ProjetRefuse` de cause `'entree'`. */
export function campagneDeLEntree(p: SavedProject): NonNullable<GameState['pendingCampaign']> {
  const { label, scenes, worldMap, activeAxes, narratif } = parseProject(documentDeLEntree(p));
  // #1627
  if (!scenes.some((s) => s.id === p.startSceneId)) {
    throw refusDeForme('entree', ['startSceneId'], `scène de départ « ${p.startSceneId} » absente du projet`);
  }
  return {
    id: p.id,
    label,
    scenes,
    startSceneId: p.startSceneId,
    worldMap: worldMap ?? null,
    ...(activeAxes !== undefined ? { activeAxes } : {}),
    narratif,
  };
}

/**
 * Les gestes du JOUEUR sur une campagne de sa bibliothèque, chacun avec ce que son refus ÉNONCE : le
 * geste qui a échoué, rien de plus — le départ d'une entrée peut manquer sans que son export échoue.
 */
const GESTES_DU_JOUEUR = {
  jouer: 'Cette campagne ne peut pas être jouée en l’état.',
  exporter: 'Cette campagne ne peut pas être exportée en l’état.',
} as const;

/** Geste du joueur sur une entrée de sa bibliothèque — union FERMÉE. */
export type GesteDuJoueur = keyof typeof GESTES_DU_JOUEUR;

/** Message à afficher au JOUEUR quand une campagne de SA bibliothèque ne passe plus la porte
 *  `parseProject` au moment du `geste` — même frontière que `playerImportError`
 *  (`ui/CampaignLibraryScreen.tsx`). SOURCE UNIQUE des écrans qui la jouent ou l'exportent. */
export function playerEntryError(err: unknown, geste: GesteDuJoueur): string {
  return refusJoueur(
    err,
    'Campagne de bibliothèque refusée :',
    `${GESTES_DU_JOUEUR[geste]} Demandez-en une nouvelle version à son auteur.`,
  );
}

/** Le refus de la porte (`ProjetRefuse`) JOURNALISÉ (`console.error`, diagnostic) puis remplacé par un
 *  message générique : le langage de schéma n'atteint jamais l'écran du joueur. Toute autre erreur
 *  n'est pas un refus de la porte : elle remonte telle quelle (même règle que
 *  `refusDeLaPorteDuProjet`, `ui/editor/ProjectModals.tsx`). */
export function refusJoueur(err: unknown, diagnostic: string, generique: string): string {
  exigerUnRefus(err);
  console.error(diagnostic, err.message);
  return generique;
}

const KEY = 'wfrp4.editor-projects.v1';
const TOMBSTONE_KEY = 'wfrp4.editor-projects.tombstones.v1';

/** Taille sérialisée max (en caractères) d'UNE entrée au-delà de laquelle elle est écartée du miroir
 *  localStorage — la borne porte sur le PROJET, jamais sur la liste entière sérialisée (une seule
 *  grosse campagne ne doit pas priver tous les petits projets de leur filet). Calibrée nettement sous
 *  le quota localStorage usuel (~5 Mio ≈ 2 500 000 caractères UTF-16) pour laisser de la place à
 *  plusieurs projets dans le même magasin. */
const LOCAL_MIRROR_ENTRY_LIMIT = 500_000;

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // accès refusé (mode privé strict, iframe sandbox…)
  }
}

/** Bibliothèque persistée : source de vérité IndexedDB (`backend`) + un MIROIR localStorage tenu à
 *  jour à chaque écriture (borné PAR PROJET par `LOCAL_MIRROR_ENTRY_LIMIT`). `initLibrary` réconcilie
 *  les deux par id à chaque démarrage — c'est CE mécanisme, rejoué à chaque boot (jamais un flag
 *  one-shot), qui absorbe aussi bien la migration initiale que la reprise d'un `backend.put`
 *  précédemment en échec (#776). */
export interface IdbBackend {
  getAll(): Promise<SavedProject[]>;
  put(entry: SavedProject): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

const DB = 'wfrp4-library';
const STORE = 'projects';
const IDB_OPEN_TIMEOUT_MS = 3000;

/** Ouverture bas niveau de la connexion IndexedDB, injectable (`__setOpenIdbRequestForTest`) pour
 *  exercer en test le repli sur bloqué/délai sans navigateur réel (jsdom n'a pas `indexedDB`). */
let openIdbRequest: () => IDBOpenDBRequest = () => indexedDB.open(DB, 1);
let openIdbRequestOverridden = false;

export function __setOpenIdbRequestForTest(fn: (() => IDBOpenDBRequest) | null): void {
  openIdbRequest = fn ?? (() => indexedDB.open(DB, 1));
  openIdbRequestOverridden = fn !== null;
}

/** `indexedDB` réellement disponible (navigateur), ou couture de test active (backend ou ouverture
 *  substitués) — dans les deux cas la couche IndexedDB doit être exercée plutôt que court-circuitée. */
let backendOverridden = false;

function hasIdb(): boolean {
  return backendOverridden || openIdbRequestOverridden || typeof indexedDB !== 'undefined';
}

/** N'attend jamais indéfiniment : un `open` qui ne déclenche ni succès/erreur ni `blocked` avant
 *  `IDB_OPEN_TIMEOUT_MS` (edge d'upgrade coincé) rejette quand même, pour que tout appelant retombe
 *  sur son repli localStorage plutôt que de geler `main.tsx` avant le premier rendu (#776). */
function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = openIdbRequest();
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('IndexedDB open : délai dépassé'));
    }, IDB_OPEN_TIMEOUT_MS);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onblocked = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('IndexedDB open : bloqué par une autre connexion ouverte'));
    };
    req.onsuccess = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(req.result);
    };
    req.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(req.error);
    };
  });
}

const realIdbBackend: IdbBackend = {
  async getAll() {
    if (!hasIdb()) return [];
    const db = await idb();
    return new Promise((resolve, reject) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      r.onsuccess = () => resolve(r.result as SavedProject[]);
      r.onerror = () => reject(r.error);
    });
  },
  async put(entry) {
    if (!hasIdb()) return;
    const db = await idb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async delete(id) {
    if (!hasIdb()) return;
    const db = await idb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async clear() {
    if (!hasIdb()) return;
    const db = await idb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

/** Substitution de la couche IndexedDB entière, injectable (`__setIdbBackendForTest`) pour exercer en
 *  test la migration, la reprise partielle et l'échec d'écriture sans reproduire l'API IndexedDB. */
let backend: IdbBackend = realIdbBackend;

export function __setIdbBackendForTest(b: IdbBackend | null): void {
  backend = b ?? realIdbBackend;
  backendOverridden = b !== null;
}

/** Cache mémoire = source SYNC servie au picker/éditeur/tests. `null` tant qu'`initLibrary` n'a rien chargé. */
let cache: SavedProject[] | null = null;

/** `SavedProject` : nom du projet (top-level, discriminant `startSceneId`+`published`+`project`). */
function isProjectLike(o: Record<string, unknown>): boolean {
  return typeof o.id === 'string' && typeof o.startSceneId === 'string'
    && typeof o.published === 'boolean' && !!o.project;
}

/** `CustomStatblock` (`state/scene.ts`) embarqué dans `project.scenes[].entities[].statblock` — même
 *  discriminant que le formulaire d'édition (`char` structuré, aucun autre porteur de ce dépôt n'a ce
 *  champ). Distinct des `SceneOp` `setVessel`/`adjustVessel` (`name?` d'AUTEUR, hors renommage — leur
 *  forme n'a pas de `char`, jamais reconnue ici). */
function isStatblockLike(o: Record<string, unknown>): boolean {
  return typeof o.char === 'object' && o.char !== null && !Array.isArray(o.char);
}

/** Renommage `name` → `label` (#608) des DEUX porteurs authorés d'un projet éditeur sérialisé —
 *  l'entrée de bibliothèque elle-même (`SavedProject.name`) et tout `CustomStatblock` embarqué dans ses
 *  scènes. `projectLibrary.ts` n'a AUCUN axe de version (liste nue en localStorage) : repli IDEMPOTENT
 *  à chaque lecture, patron
 *  `roster.ts`/`remapNameToLabelDeep` — un projet déjà migré (ou jamais affecté) traverse en no-op. */
export function remapProjectNamesDeep(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(remapProjectNamesDeep);
  if (!node || typeof node !== 'object') return node;
  const o = node as Record<string, unknown>;
  const bearer = isProjectLike(o) || isStatblockLike(o);
  if (bearer && typeof o.name === 'string' && !('label' in o)) {
    const { name, ...rest } = o;
    return Object.fromEntries(
      Object.entries({ label: name, ...rest }).map(([k, v]) => [k, remapProjectNamesDeep(v)]),
    );
  }
  if (bearer && o.label !== undefined && 'name' in o) {
    const { name: _drop, ...rest } = o;
    return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, remapProjectNamesDeep(v)]));
  }
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, remapProjectNamesDeep(v)]));
}

/** Lecture SYNC de secours (localStorage) : sert tant que `cache` vaut `null`, et reste le MIROIR
 *  réconcilié avec IndexedDB à chaque `initLibrary`. Filtre aussi les tombes (`readTombstones`) — ce
 *  filtrage est la SEULE garantie contre la résurrection d'un projet supprimé, pour TOUTE lecture qui
 *  emprunte ce repli (`initLibrary` sans IndexedDB, son `catch`, et `projectsLoad` avant tout chargement) :
 *  ne JAMAIS lire `KEY` sans repasser par cette fonction (#776 pt.2). */
function readLocalStorage(): SavedProject[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const tombstones = readTombstones();
    return (remapProjectNamesDeep(arr) as unknown[])
      .filter(isSavedProject)
      .filter((e) => !tombstones.has(e.id));
  } catch {
    return [];
  }
}

/** Écrit le miroir localStorage (best-effort, borné PAR ENTRÉE par `LOCAL_MIRROR_ENTRY_LIMIT`) : un
 *  `backend.put` qui échouerait en silence laisse quand même le projet retrouvable au reload via ce
 *  miroir (#776 pt.1) — sauf le projet visé ici, dont l'id est retourné dans `skipped` (jamais
 *  laissé en version PÉRIMÉE dans le miroir : une entrée trop grosse est retirée de la liste écrite,
 *  pas ignorée en conservant une copie ancienne). Si la liste filtrée dépasse quand même le quota
 *  réel, les entrées les plus volumineuses sont écartées une à une jusqu'à ce que l'écriture passe.
 *  `storageUnavailable` distingue « ce projet est trop gros pour le miroir » (localStorage
 *  fonctionnel, entrée écartée) de « le stockage local lui-même est hors service » (absent, accès
 *  refusé, ou l'écriture échoue même pour une liste vide) — les deux font grossir `skipped`, mais
 *  seule la 2de justifie un message qui ne parle PAS de volume de campagne (#776 pt.3). */
function writeLocalMirror(list: SavedProject[]): { skipped: Set<string>; storageUnavailable: boolean } {
  const s = storage();
  if (!s) return { skipped: new Set(list.map((e) => e.id)), storageUnavailable: true };
  const sized = list.map((e) => {
    let json: string;
    try {
      json = JSON.stringify(e);
    } catch {
      json = '';
    }
    return { e, json };
  });
  const skipped = new Set<string>();
  let fits = sized.filter(({ e, json }) => {
    const ok = json.length > 0 && json.length <= LOCAL_MIRROR_ENTRY_LIMIT;
    if (!ok) skipped.add(e.id);
    return ok;
  });
  while (true) {
    try {
      s.setItem(KEY, JSON.stringify(fits.map(({ e }) => e)));
      return { skipped, storageUnavailable: false };
    } catch {
      if (fits.length === 0) {
        try {
          s.removeItem(KEY);
        } catch {
          // accès refusé : rien de plus à faire, aucune version périmée n'est laissée volontairement.
        }
        return { skipped: new Set(list.map((e) => e.id)), storageUnavailable: true };
      }
      fits = [...fits].sort((a, b) => b.json.length - a.json.length);
      const dropped = fits.shift()!;
      skipped.add(dropped.e.id);
      console.error(
        `[projectLibrary] projet « ${dropped.e.label} » (id ${dropped.e.id}) écarté du miroir `
        + 'localStorage : quota dépassé, pas de place pour l’ensemble des projets enregistrés.',
      );
    }
  }
}

/** Tombes dont l'écriture localStorage a échoué (quota/accès refusé) : conservées en mémoire pour que
 *  toute lecture/écriture suivante de CETTE session les traite comme persistées (`readTombstones` les
 *  fusionne) — protège contre la résurrection tant que le module reste chargé. Ne survit PAS à un
 *  rechargement réel de page (aucun canal persistant hors localStorage n'existe pour ce cas). */
let pendingTombstones = new Set<string>();

function readTombstones(): Set<string> {
  const s = storage();
  let persisted = new Set<string>();
  if (s) {
    try {
      const raw = s.getItem(TOMBSTONE_KEY);
      if (raw) {
        const arr: unknown = JSON.parse(raw);
        if (Array.isArray(arr)) persisted = new Set(arr.filter((x): x is string => typeof x === 'string'));
      }
    } catch {
      persisted = new Set();
    }
  }
  return new Set([...persisted, ...pendingTombstones]);
}

function writeTombstones(ids: Set<string>): boolean {
  const s = storage();
  if (!s) {
    pendingTombstones = new Set(ids);
    return false;
  }
  try {
    s.setItem(TOMBSTONE_KEY, JSON.stringify([...ids]));
    pendingTombstones = new Set();
    return true;
  } catch (err) {
    pendingTombstones = new Set(ids);
    console.error(
      '[projectLibrary] écriture des tombes de suppression en échec (quota/accès refusé) — '
      + 'conservée en mémoire pour cette session (protège contre la résurrection tant que le module '
      + 'reste chargé) ; retentée seulement au prochain appel à `writeTombstones` (nouvelle '
      + 'suppression, ou levée de cette même tombe via `projectSave`) — pas à toute autre écriture.',
      err,
    );
    return false;
  }
}

function isSavedProject(e: unknown): e is SavedProject {
  return (
    !!e &&
    typeof e === 'object' &&
    typeof (e as SavedProject).id === 'string' &&
    Array.isArray((e as SavedProject).project?.scenes)
  );
}

/**
 * Charge la bibliothèque en `cache` depuis IndexedDB (source de vérité) réconciliée avec le miroir
 * localStorage. À AWAITER une fois au démarrage (`main.tsx`) AVANT le premier rendu. NE REJETTE JAMAIS :
 * toute erreur retombe sur la lecture localStorage. Réconciliation PAR ID à chaque appel (jamais un flag
 * one-shot) : les entrées présentes en localStorage mais absentes d'IndexedDB (migration initiale,
 * `backend.put` précédemment en échec) sont recopiées ; les id tombés en `TOMBSTONE_KEY` (supprimés) sont
 * exclus et leur suppression IndexedDB retentée — jamais ressuscités (#776 pt.2). Une tombe dont la
 * suppression IndexedDB vient d'aboutir ici est purgée du registre (elle ne sert plus à rien, #776 pt.2).
 */
export async function initLibrary(): Promise<void> {
  try {
    if (!hasIdb()) {
      cache = readLocalStorage();
      return;
    }
    const tombstones = readTombstones();
    const stored = (remapProjectNamesDeep(await backend.getAll()) as unknown[])
      .filter(isSavedProject) as SavedProject[];
    const legacy = readLocalStorage();
    const storedIds = new Set(stored.map((e) => e.id));
    const toMigrate = legacy.filter((e) => !storedIds.has(e.id) && !tombstones.has(e.id));
    const toPurge = stored.filter((e) => tombstones.has(e.id));
    await Promise.allSettled(toMigrate.map((e) => backend.put(e)));
    const purgeResults = await Promise.allSettled(toPurge.map((e) => backend.delete(e.id)));
    const purgedFromRetry = toPurge
      .filter((_, i) => purgeResults[i].status === 'fulfilled')
      .map((e) => e.id);
    // Tombes dont IndexedDB confirme déjà l'absence (suppression déjà réussie via `projectRemove`,
    // ou jamais existé) : purgeables SANS attendre un nouveau cycle de retry — sinon elles ne
    // disparaîtraient JAMAIS (`toPurge` ne les contient plus une fois l'entrée absente d'IDB), d'où
    // la croissance monotone (#776 pt.2). Le retrait ne s'applique qu'à la PERSISTANCE : la décision
    // de ce même appel (`merged` ci-dessous) continue d'utiliser `tombstones` tel que lu en entrée.
    const alreadyGone = [...tombstones].filter((id) => !storedIds.has(id));
    const purgedIds = [...new Set([...purgedFromRetry, ...alreadyGone])];
    if (purgedIds.length) {
      const remaining = new Set([...tombstones].filter((id) => !purgedIds.includes(id)));
      writeTombstones(remaining);
    }
    const merged = [...stored.filter((e) => !tombstones.has(e.id)), ...toMigrate];
    cache = merged;
    writeLocalMirror(merged);
  } catch {
    cache = readLocalStorage();
  }
}

export function projectsLoad(): SavedProject[] {
  return cache ?? readLocalStorage();
}

/** Issue attendable d'une écriture (`projectSave`/`projectRemove`) — NE REJETTE JAMAIS (résultat porté
 *  par la valeur, jamais une promesse rejetée) : un appelant qui ignore le retour ne produit aucun
 *  rejet non géré. `ok: false` = risque de perte réel (ni IndexedDB ni le miroir localStorage n'ont pu
 *  absorber l'écriture) — à afficher au joueur ; `ok: true, degraded: true` = ABSORBÉ mais SEULEMENT par
 *  le filet localStorage (IndexedDB en échec) — un appelant qui purge un filet AUTRE sur la foi de ce
 *  succès (ex. l'autosave de secours, #834 audit-2 défaut 6) doit s'abstenir tant que `degraded`. */
export type LibraryWriteOutcome = { ok: true; degraded?: boolean } | { ok: false; message: string };

/** Upsert par id (un même projet ré-enregistré écrase l'ancien). SYNC dans le cache + miroir
 *  localStorage, persistance IndexedDB AWAITÉE (la promesse retournée ne rejette jamais — voir
 *  `LibraryWriteOutcome`). Ré-enregistrer un id précédemment supprimé lève sa tombe (#776 pt.2 : une
 *  sauvegarde explicite n'est jamais une résurrection accidentelle). */
export async function projectSave(entry: SavedProject): Promise<LibraryWriteOutcome> {
  const list = [...projectsLoad().filter((e) => e.id !== entry.id), entry];
  cache = list;
  const { skipped, storageUnavailable } = writeLocalMirror(list);
  const mirrored = !skipped.has(entry.id);
  const tombstones = readTombstones();
  if (tombstones.delete(entry.id)) writeTombstones(tombstones);
  try {
    await backend.put(entry);
    return { ok: true };
  } catch (err) {
    console.error(
      `[projectLibrary] persistance IndexedDB du projet « ${entry.label} » en échec — `
      + (mirrored
        ? 'miroir localStorage actif, reprise au prochain démarrage.'
        : storageUnavailable
          ? 'stockage local indisponible : aucun filet, risque de perte réel.'
          : 'AUCUN filet local (projet trop volumineux pour le miroir) : risque de perte réel.'),
      err,
    );
    if (!mirrored) {
      if (storageUnavailable) {
        return {
          ok: false,
          message:
            `La sauvegarde de « ${entry.label} » a échoué : le stockage local n’est pas disponible `
            + '(navigation privée, accès refusé…), sans filet de secours. Elle pourrait disparaître au '
            + 'prochain démarrage. Réessayez avec un stockage local actif.',
        };
      }
      return {
        ok: false,
        message:
          `La sauvegarde de « ${entry.label} » a échoué : cette campagne est probablement trop `
          + 'volumineuse pour être enregistrée. Elle reste visible dans votre bibliothèque pour cette '
          + 'session, mais pourrait disparaître au prochain démarrage. Réessayez, ou allégez la '
          + 'campagne (moins de scènes ou de contenu) avant de réessayer.',
      };
    }
    return { ok: true, degraded: true };
  }
}

/** Retrait par id : cache + miroir localStorage mis à jour SYNC, id marqué tombe (jamais ressuscité par
 *  la réconciliation d'`initLibrary`), suppression IndexedDB AWAITÉE et retentée au besoin (#776
 *  pt.1/2 ; la promesse retournée ne rejette jamais — voir `LibraryWriteOutcome`). La tombe n'est PAS
 *  purgée ici : `projectRemove` ne constate rien sur l'état réel d'IndexedDB au-delà de son propre
 *  appel — c'est `initLibrary`, au prochain démarrage, qui compare `tombstones` à `storedIds` (ce
 *  qu'IndexedDB contient réellement) et purge celles dont l'absence est confirmée (dans le cas
 *  nominal, dès le tout premier boot suivant, #776 pt.2). */
export async function projectRemove(id: string): Promise<LibraryWriteOutcome> {
  const list = projectsLoad().filter((e) => e.id !== id);
  cache = list;
  writeLocalMirror(list);
  const tombstones = readTombstones();
  tombstones.add(id);
  const tombstoned = writeTombstones(tombstones);
  try {
    await backend.delete(id);
    return { ok: true };
  } catch (err) {
    console.error(
      `[projectLibrary] suppression IndexedDB du projet « ${id} » en échec — retentée au prochain démarrage.`,
      err,
    );
    if (!tombstoned) {
      return {
        ok: false,
        message:
          'La suppression n\'a pas pu être confirmée : cette campagne pourrait réapparaître au prochain '
          + 'démarrage. Réessayez.',
      };
    }
    return { ok: true };
  }
}

/** Les projets marqués « publiés » — proposés au menu principal comme campagnes jouables. */
export function publishedProjects(): SavedProject[] {
  return projectsLoad().filter((e) => e.published);
}

/** Test-only : réinitialise le cache module-level, le miroir localStorage, les tombes (persistées et en
 *  mémoire) et vide IndexedDB si présent — pour l'isolation complète entre tests. */
export async function __resetLibraryForTest(): Promise<void> {
  cache = null;
  pendingTombstones = new Set();
  try {
    const s = storage();
    s?.removeItem(KEY);
    s?.removeItem(TOMBSTONE_KEY);
  } catch {
    // accès refusé : rien à nettoyer côté localStorage.
  }
  await backend.clear().catch(() => { /* idb absent en jsdom */ });
}
