import { z } from 'zod';
import { parseProject, exigerUnRefus, refusDeForme, ProjetRefuse, PROJET_AUTRE_FORMAT, type ProjectDoc } from './worldMap';
import { validateDocument, rapportDeFautes } from '../data/schemas/validate';
import type { GameState } from './store';
import { accesBase, idbDisponible } from '../lib/indexedDb';
import { stockageWeb } from '../lib/stockageWeb';

/** Ce qu'un écran LIT d'un projet de la bibliothèque SANS l'ouvrir (liste, détail, dédup d'import).
 *  Le document entier passe la porte `parseProject` au GESTE (ouvrir, jouer, exporter) : un projet
 *  d'un autre format reste ainsi listé, son refus affiché au geste, et sa suppression reste un geste
 *  de l'auteur (#2404). */
const apercuDeProjetSchema = z.looseObject({
  scenes: z.array(z.unknown()),
  versionContenu: z.number().optional(),
  desc: z.string().optional(),
  auteur: z.string().optional(),
});

/** Une entrée de la bibliothèque de projets (localStorage, IndexedDB). `published` = jouable depuis le
 *  menu ; `startSceneId` = scène de départ quand on JOUE la campagne. */
export const savedProjectSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string(),
  startSceneId: z.string(),
  savedAt: z.number(),
  published: z.boolean(),
  project: apercuDeProjetSchema,
});

/** Une entrée PROUVÉE par `savedProjectSchema`. */
export type SavedProject = Omit<z.infer<typeof savedProjectSchema>, 'project'> & {
  project: z.infer<typeof apercuDeProjetSchema> | ProjectDoc;
  refus?: undefined;
};

/** Une entrée relue qui porte un `id` mais que l'ENVELOPPE refuse : LISTÉE, son refus levé au geste
 *  (`projetDeLEntree`), son contenu `brut` réécrit tel quel par toute écriture du stockage (#2404). Les
 *  champs d'affichage sont ceux du brut quand il les type, sinon vides. */
export type EntreeRefusee = Omit<SavedProject, 'project' | 'refus'> & {
  project: z.infer<typeof apercuDeProjetSchema>;
  refus: ProjetRefuse;
  brut: unknown;
};

/** Une entrée LISTÉE de la bibliothèque. */
export type EntreeListee = SavedProject | EntreeRefusee;

/** L'entrée que l'application ÉCRIT : son projet est un `ProjectDoc` entier. */
export type EntreeEcrite = SavedProject & { project: ProjectDoc };

/** Sujet du rapport d'une enveloppe refusée. */
const SUJET_DU_REFUS_D_ENVELOPPE = 'Entrée de bibliothèque d’un autre format, ou mal formée';

/** L'`id` qui désigne une entrée relue : une chaîne non vide, ou rien. */
function idDesignable(brut: unknown): string | null {
  if (brut === null || typeof brut !== 'object') return null;
  const id = (brut as { id?: unknown }).id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/** Une entrée relue du stockage : PROUVÉE, REFUSÉE (listée, refus au geste) si elle porte un `id`,
 *  sinon `null` — journalisée, jamais listée, et conservée dans le stockage (`writeLocalMirror`). */
function entreeRelue(brut: unknown): EntreeListee | null {
  const fautes = validateDocument(savedProjectSchema, brut);
  if (!fautes) return brut as SavedProject;
  const rapport = rapportDeFautes(SUJET_DU_REFUS_D_ENVELOPPE, fautes);
  console.error('[projectLibrary]', rapport);
  const id = idDesignable(brut);
  if (id === null) return null;
  const champs = brut as { label?: unknown; published?: unknown; savedAt?: unknown };
  return {
    id,
    label: typeof champs.label === 'string' ? champs.label : '',
    startSceneId: '',
    savedAt: typeof champs.savedAt === 'number' ? champs.savedAt : 0,
    published: champs.published === true,
    project: { scenes: [] },
    refus: new ProjetRefuse('schema', fautes, rapport),
    brut,
  };
}

function entreesRelues(liste: readonly unknown[]): EntreeListee[] {
  return liste.flatMap((brut) => entreeRelue(brut) ?? []);
}

/** Ce que le stockage reçoit d'une entrée listée : le brut d'une entrée refusée, jamais une réécriture. */
function aEcrire(e: EntreeListee): unknown {
  return e.refus ? e.brut : e;
}

/** Les entrées dont un geste a été refusé par la porte, par `id` : témoin de module, lu par chaque
 *  écran qui liste la bibliothèque, levé par la réécriture ou le retrait de l'entrée (#2404). */
let refuseesAuGeste = new Set<string>();

/** Le `geste` sur l'entrée `p` ; un refus de la porte (`ProjetRefuse`) la note refusée, puis remonte. */
function auGeste<T>(p: EntreeListee, geste: () => T): T {
  try {
    return geste();
  } catch (err) {
    if (err instanceof ProjetRefuse) refuseesAuGeste.add(p.id);
    throw err;
  }
}

/** L'entrée est refusée : par son enveloppe à la relecture, ou par la porte à un geste. SOURCE UNIQUE
 *  de la marque `MARQUE_AUTRE_FORMAT` et du rang de ses actions dans chaque écran qui la liste. */
export function estRefusee(p: EntreeListee): boolean {
  return p.refus !== undefined || refuseesAuGeste.has(p.id);
}

/** Le projet d'une entrée, passé par la porte `parseProject` : une entrée refusée lève son refus.
 *  SOURCE UNIQUE des gestes (ouvrir, jouer, exporter). */
export function projetDeLEntree(p: EntreeListee): ProjectDoc {
  return auGeste(p, () => {
    if (p.refus) throw p.refus;
    return parseProject(p.project);
  });
}

/** Repli d'AFFICHAGE du nom d'un projet : une entrée dont le nom est vide (entrée fabriquée hors
 *  éditeur) se rend NOMMÉE « (sans nom) » plutôt qu'en rangée muette — le geste de
 *  suppression/ouverture reste ainsi désignable. SOURCE UNIQUE des deux écrans qui listent des
 *  projets (« Ouvrir » de l'éditeur, bibliothèque de campagnes). */
export const NOM_DE_PROJET_ABSENT = '(sans nom)';
export function nomDeProjet(label: string | undefined | null): string {
  return label?.trim() || NOM_DE_PROJET_ABSENT;
}

/** La campagne LANCÉE depuis une entrée de bibliothèque (`setPendingCampaign`), SOURCE UNIQUE de tout
 *  écran qui la joue (« Jouer » de la bibliothèque, « Choisir » du picker de `PartyScreen`) : le
 *  document passe la porte `parseProject` et un refus lève `ProjetRefuse`, laissé à l'appelant. Le
 *  `label` est celui du document PARSÉ ; l'`id` et la scène d'entrée sont ceux de l'ENTRÉE (clé du
 *  picker), et une scène d'entrée absente du document lève `ProjetRefuse` de cause `'entree'`. */
export function campagneDeLEntree(p: EntreeListee): NonNullable<GameState['pendingCampaign']> {
  const { label, scenes, worldMap, activeAxes, narratif } = projetDeLEntree(p);
  // #1627
  if (!scenes.some((s) => s.id === p.startSceneId)) {
    refuseesAuGeste.add(p.id);
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

/** La marque, dans une liste, d'une entrée dont le projet est refusé. */
export const MARQUE_AUTRE_FORMAT = 'Autre format';

/**
 * Les gestes du JOUEUR sur une campagne de sa bibliothèque, chacun avec ce que son refus ÉNONCE : le
 * geste qui a échoué, rien de plus — le départ d'une entrée peut manquer sans que son export échoue.
 */
const GESTES_DU_JOUEUR = {
  jouer: 'cette campagne ne peut pas être jouée',
  exporter: 'cette campagne ne peut pas être exportée',
} as const;

/** Geste du joueur sur une entrée de sa bibliothèque — union FERMÉE. */
export type GesteDuJoueur = keyof typeof GESTES_DU_JOUEUR;

/** Ce que dit au JOUEUR le refus du `geste` sur une campagne que la porte refuse. */
export function messageDeRefusJoueur(geste: GesteDuJoueur): string {
  return `${PROJET_AUTRE_FORMAT} : ${GESTES_DU_JOUEUR[geste]}.`;
}

/** Message à afficher au JOUEUR quand une campagne de SA bibliothèque ne passe plus la porte
 *  `parseProject` au moment du `geste` — même frontière que `playerImportError`
 *  (`ui/CampaignLibraryScreen.tsx`). SOURCE UNIQUE des écrans qui la jouent ou l'exportent. */
export function playerEntryError(err: unknown, geste: GesteDuJoueur): string {
  return refusJoueur(
    err,
    'Campagne de bibliothèque refusée :',
    messageDeRefusJoueur(geste),
  );
}

/** Ce qu'un refus `prose-non-materialisee` dit à qui importe : le fichier est la forme DÉPÔT d'une
 *  campagne livrée, pas son export. SOURCE UNIQUE de l'import joueur et de l'import de l'éditeur. */
export const IMPORT_FORME_DEPOT =
  'Ce fichier est la version de travail d’une campagne : les textes du livre n’y sont pas. Importez le fichier exporté par le jeu.';

/** Le refus de la porte (`ProjetRefuse`) JOURNALISÉ (`console.error`, diagnostic) puis remplacé par un
 *  message générique : le langage de schéma n'atteint jamais l'écran du joueur. Toute autre erreur
 *  n'est pas un refus de la porte : elle remonte telle quelle (même règle que
 *  `refusDeLaPorteDuProjet`, `ui/editor/ProjectModals.tsx`). */
export function refusJoueur(err: unknown, diagnostic: string, generique: string): string {
  exigerUnRefus(err);
  console.error(diagnostic, err.message);
  return generique;
}

const KEY = 'wfrp4.editor-projects';
const TOMBSTONE_KEY = 'wfrp4.editor-projects.tombstones';

/** Taille sérialisée max (en caractères) d'UNE entrée au-delà de laquelle elle est écartée du miroir
 *  localStorage — la borne porte sur le PROJET, jamais sur la liste entière sérialisée (une seule
 *  grosse campagne ne doit pas priver tous les petits projets de leur filet). Calibrée nettement sous
 *  le quota localStorage usuel (~5 Mio ≈ 2 500 000 caractères UTF-16) pour laisser de la place à
 *  plusieurs projets dans le même magasin. */
const LOCAL_MIRROR_ENTRY_LIMIT = 500_000;

const STORE = 'projects';

/** Bibliothèque persistée : source de vérité IndexedDB (base `wfrp4-library`) + un MIROIR localStorage
 *  tenu à jour à chaque écriture (borné PAR PROJET par `LOCAL_MIRROR_ENTRY_LIMIT`). `initLibrary`
 *  réconcilie les deux par id à chaque démarrage — c'est CE mécanisme, rejoué à chaque boot (jamais un
 *  flag one-shot), qui absorbe aussi bien la recréation de la base (`lib/indexedDb.ts`) que la reprise d'une écriture IndexedDB
 *  précédemment en échec (#776). */
const bibliotheque = accesBase({ nom: 'wfrp4-library', magasins: { [STORE]: { keyPath: 'id' } } });
const projets = bibliotheque.magasin<unknown, string>(STORE);

/** Cache mémoire = source SYNC servie au picker/éditeur/tests. `null` tant qu'`initLibrary` n'a rien chargé. */
let cache: EntreeListee[] | null = null;

/** Lecture SYNC de secours (localStorage) : sert tant que `cache` vaut `null`, et reste le MIROIR
 *  réconcilié avec IndexedDB à chaque `initLibrary`. Filtre aussi les tombes (`readTombstones`) — ce
 *  filtrage est la SEULE garantie contre la résurrection d'un projet supprimé, pour TOUTE lecture qui
 *  emprunte ce repli (`initLibrary` sans IndexedDB, son `catch`, et `projectsLoad` avant tout chargement) :
 *  ne JAMAIS lire `KEY` sans repasser par cette fonction (#776 pt.2). */
function readLocalStorage(): EntreeListee[] {
  const s = stockageWeb('localStorage');
  if (!s) return [];
  try {
    const raw = s.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const tombstones = readTombstones();
    return entreesRelues(arr).filter((e) => !tombstones.has(e.id));
  } catch {
    return [];
  }
}

/** Les entrées du miroir qu'aucun `id` ne désigne : relues telles quelles pour être RÉÉCRITES, jamais
 *  retirées par une écriture (#2404). */
function entreesIndesignables(s: Storage): unknown[] {
  try {
    const raw = s.getItem(KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((brut) => idDesignable(brut) === null) : [];
  } catch {
    return [];
  }
}

/** Écrit le miroir localStorage (best-effort, borné PAR ENTRÉE par `LOCAL_MIRROR_ENTRY_LIMIT`) : un
 *  écriture IndexedDB qui échouerait en silence laisse quand même le projet retrouvable au reload via ce
 *  miroir (#776 pt.1) — sauf le projet visé ici, dont l'id est retourné dans `skipped` (jamais
 *  laissé en version PÉRIMÉE dans le miroir : une entrée trop grosse est retirée de la liste écrite,
 *  pas ignorée en conservant une copie ancienne). Si la liste filtrée dépasse quand même le quota
 *  réel, les entrées les plus volumineuses sont écartées une à une jusqu'à ce que l'écriture passe.
 *  `storageUnavailable` distingue « ce projet est trop gros pour le miroir » (localStorage
 *  fonctionnel, entrée écartée) de « le stockage local lui-même est hors service » (absent, accès
 *  refusé, ou l'écriture échoue même pour une liste vide) — les deux font grossir `skipped`, mais
 *  seule la 2de justifie un message qui ne parle PAS de volume de campagne (#776 pt.3). */
function writeLocalMirror(list: EntreeListee[]): { skipped: Set<string>; storageUnavailable: boolean } {
  const s = stockageWeb('localStorage');
  if (!s) return { skipped: new Set(list.map((e) => e.id)), storageUnavailable: true };
  const indesignables = entreesIndesignables(s);
  const sized = list.map((e) => {
    let json: string;
    try {
      json = JSON.stringify(aEcrire(e));
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
      s.setItem(KEY, JSON.stringify([...indesignables, ...fits.map(({ e }) => aEcrire(e))]));
      return { skipped, storageUnavailable: false };
    } catch {
      if (fits.length === 0) {
        if (indesignables.length === 0) {
          try {
            s.removeItem(KEY);
          } catch {
            // accès refusé : rien de plus à faire, aucune version périmée n'est laissée volontairement.
          }
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
  const s = stockageWeb('localStorage');
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
  const s = stockageWeb('localStorage');
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

/**
 * Charge la bibliothèque en `cache` depuis IndexedDB (source de vérité) réconciliée avec le miroir
 * localStorage. À AWAITER une fois au démarrage (`main.tsx`) AVANT le premier rendu. NE REJETTE JAMAIS :
 * toute erreur retombe sur la lecture localStorage. Réconciliation PAR ID à chaque appel (jamais un flag
 * one-shot) : les entrées présentes en localStorage mais absentes d'IndexedDB (base recréée,
 * écriture IndexedDB précédemment en échec) sont recopiées ; les id tombés en `TOMBSTONE_KEY` (supprimés) sont
 * exclus et leur suppression IndexedDB retentée — jamais ressuscités (#776 pt.2). Une tombe dont la
 * suppression IndexedDB vient d'aboutir ici est purgée du registre (elle ne sert plus à rien, #776 pt.2).
 */
export async function initLibrary(): Promise<void> {
  try {
    if (!idbDisponible()) {
      cache = readLocalStorage();
      return;
    }
    const tombstones = readTombstones();
    const stored = entreesRelues(await projets.lireTout());
    const miroir = readLocalStorage();
    const storedIds = new Set(stored.map((e) => e.id));
    const aReprendre = miroir.filter((e) => !storedIds.has(e.id) && !tombstones.has(e.id));
    const toPurge = stored.filter((e) => tombstones.has(e.id));
    await Promise.allSettled(aReprendre.map((e) => projets.ecrire(aEcrire(e))));
    const purgeResults = await Promise.allSettled(toPurge.map((e) => projets.supprimer(e.id)));
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
    const merged = [...stored.filter((e) => !tombstones.has(e.id)), ...aReprendre];
    cache = merged;
    writeLocalMirror(merged);
  } catch {
    cache = readLocalStorage();
  }
}

export function projectsLoad(): EntreeListee[] {
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
  refuseesAuGeste.delete(entry.id);
  const { skipped, storageUnavailable } = writeLocalMirror(list);
  const mirrored = !skipped.has(entry.id);
  const tombstones = readTombstones();
  if (tombstones.delete(entry.id)) writeTombstones(tombstones);
  try {
    await projets.ecrire(entry);
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
  refuseesAuGeste.delete(id);
  writeLocalMirror(list);
  const tombstones = readTombstones();
  tombstones.add(id);
  const tombstoned = writeTombstones(tombstones);
  try {
    await projets.supprimer(id);
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
export function publishedProjects(): EntreeListee[] {
  return projectsLoad().filter((e) => e.published);
}

/** Test-only : réinitialise le cache module-level, le miroir localStorage, les tombes (persistées et en
 *  mémoire), les refus au geste, et vide IndexedDB si présent — pour l'isolation complète entre tests. */
export async function __resetLibraryForTest(): Promise<void> {
  cache = null;
  pendingTombstones = new Set();
  refuseesAuGeste = new Set();
  try {
    const s = stockageWeb('localStorage');
    s?.removeItem(KEY);
    s?.removeItem(TOMBSTONE_KEY);
  } catch {
    // accès refusé : rien à nettoyer côté localStorage.
  }
  await bibliotheque.vider();
}
