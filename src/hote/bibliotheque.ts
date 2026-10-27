/**
 * LA PROCÉDURE DE LA BIBLIOTHÈQUE DE CAMPAGNES d'un hôte (#3041), sur ses ports : une `Base` asynchrone de
 * documents, source de vérité, et un `Stockage` synchrone qui porte son MIROIR (borné PAR ENTRÉE) et ses TOMBES de
 * suppression. Chaque port est relu à chaque appel : `null` dit le port indisponible à cet appel. La forme et ses
 * transformations sont celles du noyau (`noyau/persistance/bibliotheque.ts`). L'état (cache synchrone, tombes en
 * attente, refus au geste) vit dans la poignée que l'hôte ouvre (`ouvrirLaBibliotheque`).
 */
import {
  aEcrire,
  campagneDUneEntree,
  entreesRelues,
  idDesignable,
  projetDUneEntree,
  ProjetRefuse,
  type CampagneLancee,
  type EntreeListee,
  type ProjectDoc,
  type SavedProject,
} from '../noyau/index';
import type { Base, Stockage } from '../lib/stockage';

const KEY = 'wfrp4.editor-projects';
const TOMBSTONE_KEY = 'wfrp4.editor-projects.tombstones';

/** Taille sérialisée max (en caractères) d'UNE entrée au-delà de laquelle elle est écartée du miroir — la borne
 *  porte sur le PROJET, jamais sur la liste entière sérialisée (une seule grosse campagne ne doit pas priver tous
 *  les petits projets de leur filet). Calibrée nettement sous le quota localStorage usuel (~5 Mio ≈ 2 500 000
 *  caractères UTF-16) pour laisser de la place à plusieurs projets dans le même magasin. */
const LOCAL_MIRROR_ENTRY_LIMIT = 500_000;

/** La base des entrées de la bibliothèque, keyée par `id`. */
export type BaseDeLaBibliotheque = Base<unknown, string>;

/** Issue attendable d'une écriture (`projectSave`/`projectRemove`) — NE REJETTE JAMAIS (résultat porté par la
 *  valeur, jamais une promesse rejetée) : un appelant qui ignore le retour ne produit aucun rejet non géré.
 *  `ok: false` = risque de perte réel (ni la base ni le miroir n'ont pu absorber l'écriture) — à afficher au
 *  joueur ; `ok: true, degraded: true` = ABSORBÉ mais SEULEMENT par le miroir (base en échec) — un appelant qui
 *  purge un filet AUTRE sur la foi de ce succès (ex. l'autosave de secours, #834 audit-2 défaut 6) doit
 *  s'abstenir tant que `degraded`. */
export type LibraryWriteOutcome = { ok: true; degraded?: boolean } | { ok: false; message: string };

/** La poignée d'une bibliothèque ouverte : sa procédure, et l'état qu'elle porte. */
export interface Bibliotheque {
  /** Charge le cache depuis la base réconciliée avec le miroir ; à AWAITER au démarrage, ne rejette jamais. */
  initLibrary(): Promise<void>;
  /** Les entrées listées : le cache, ou le miroir tant que rien n'est chargé. */
  projectsLoad(): EntreeListee[];
  /** Les entrées marquées « publiées » — proposées au menu principal comme campagnes jouables. */
  publishedProjects(): EntreeListee[];
  projectSave(entry: SavedProject): Promise<LibraryWriteOutcome>;
  projectRemove(id: string): Promise<LibraryWriteOutcome>;
  /** L'entrée est refusée : par son enveloppe à la relecture, ou par la porte à un geste. SOURCE UNIQUE de la
   *  marque `MARQUE_AUTRE_FORMAT` et du rang de ses actions dans chaque écran qui la liste. */
  estRefusee(p: EntreeListee): boolean;
  /** Le projet d'une entrée par la porte (`projetDUneEntree`) ; un refus marque l'entrée refusée, puis remonte.
   *  SOURCE UNIQUE des gestes (ouvrir, jouer, exporter). */
  projetDeLEntree(p: EntreeListee): ProjectDoc;
  /** La campagne lancée d'une entrée (`campagneDUneEntree`) ; un refus marque l'entrée refusée, puis remonte.
   *  SOURCE UNIQUE de tout écran qui la joue (« Jouer » de la bibliothèque, « Choisir » du picker de `PartyScreen`). */
  campagneDeLEntree(p: EntreeListee): CampagneLancee;
  /** Test : oublie le cache, les tombes (persistées et en attente), les refus au geste, et retire le miroir du
   *  stockage. La base n'est pas touchée. */
  reinitialiser(): void;
}

/**
 * Ouvre la bibliothèque sur les ports `base` et `stockage`. Réconciliation PAR ID à chaque `initLibrary` (jamais
 * un drapeau one-shot) : c'est CE mécanisme, rejoué à chaque démarrage, qui absorbe la recréation de la base comme
 * la reprise d'une écriture précédemment en échec (#776).
 */
export function ouvrirLaBibliotheque(base: () => BaseDeLaBibliotheque | null, stockage: () => Stockage | null): Bibliotheque {
  /** Cache mémoire = source SYNC servie au picker/éditeur/tests. `null` tant qu'`initLibrary` n'a rien chargé. */
  let cache: EntreeListee[] | null = null;
  /** Tombes dont l'écriture a échoué (quota/accès refusé) : fusionnées à toute lecture des tombes de la poignée
   *  (`readTombstones`) — protège contre la résurrection tant que la poignée vit. */
  let pendingTombstones = new Set<string>();
  /** Les entrées dont un geste a été refusé par la porte, par `id` ; levé par la réécriture ou le retrait de
   *  l'entrée (#2404). */
  let refuseesAuGeste = new Set<string>();

  /** Lecture SYNC de secours (miroir) : sert tant que `cache` vaut `null`, et reste le MIROIR réconcilié avec la
   *  base à chaque `initLibrary`. Filtre aussi les tombes (`readTombstones`) — ce filtrage est la SEULE garantie
   *  contre la résurrection d'un projet supprimé, pour TOUTE lecture qui emprunte ce repli : ne JAMAIS lire `KEY`
   *  sans repasser par cette fonction (#776 pt.2). */
  function readLocalStorage(): EntreeListee[] {
    const s = stockage();
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

  /** Écrit le miroir (best-effort, borné PAR ENTRÉE par `LOCAL_MIRROR_ENTRY_LIMIT`) : une écriture en base qui
   *  échouerait en silence laisse quand même le projet retrouvable au rechargement (#776 pt.1) — sauf le projet
   *  dont l'id est retourné dans `skipped` (jamais laissé en version PÉRIMÉE : une entrée trop grosse est retirée de
   *  la liste écrite). Si la liste filtrée dépasse quand même le quota réel, les entrées les plus volumineuses sont
   *  écartées une à une jusqu'à ce que l'écriture passe. Les entrées qu'aucun `id` ne désigne sont réécrites telles
   *  quelles (#2404). `storageUnavailable` distingue « ce projet est trop gros pour le miroir » de « le stockage
   *  lui-même est hors service » (#776 pt.3). */
  function writeLocalMirror(list: EntreeListee[]): { skipped: Set<string>; storageUnavailable: boolean } {
    const s = stockage();
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
              // accès refusé : aucune version périmée n'est laissée volontairement
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

  function readTombstones(): Set<string> {
    const s = stockage();
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
    const s = stockage();
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
        + 'conservée en mémoire pour cette session (protège contre la résurrection tant que la poignée '
        + 'reste ouverte) ; retentée seulement au prochain appel à `writeTombstones` (nouvelle '
        + 'suppression, ou levée de cette même tombe via `projectSave`) — pas à toute autre écriture.',
        err,
      );
      return false;
    }
  }

  /** Le `geste` sur l'entrée `p` ; un refus de la porte (`ProjetRefuse`) la note refusée, puis remonte. */
  function auGeste<T>(p: EntreeListee, geste: () => T): T {
    try {
      return geste();
    } catch (err) {
      if (err instanceof ProjetRefuse) refuseesAuGeste.add(p.id);
      throw err;
    }
  }

  function projectsLoad(): EntreeListee[] {
    return cache ?? readLocalStorage();
  }

  return {
    /** Les id tombés (supprimés) sont exclus et leur suppression en base retentée — jamais ressuscités ; une tombe
     *  dont la base confirme l'absence est purgée du registre (#776 pt.2). Toute erreur retombe sur le miroir. */
    async initLibrary() {
      try {
        const b = base();
        if (!b) {
          cache = readLocalStorage();
          return;
        }
        const tombstones = readTombstones();
        const stored = entreesRelues(await b.lireTout());
        const miroir = readLocalStorage();
        const storedIds = new Set(stored.map((e) => e.id));
        const aReprendre = miroir.filter((e) => !storedIds.has(e.id) && !tombstones.has(e.id));
        const toPurge = stored.filter((e) => tombstones.has(e.id));
        await Promise.allSettled(aReprendre.map((e) => b.ecrire(aEcrire(e))));
        const purgeResults = await Promise.allSettled(toPurge.map((e) => b.supprimer(e.id)));
        const purgedFromRetry = toPurge
          .filter((_, i) => purgeResults[i].status === 'fulfilled')
          .map((e) => e.id);
        // #776 pt.2
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
    },

    projectsLoad,

    publishedProjects: () => projectsLoad().filter((e) => e.published),

    /** Upsert par id. SYNC dans le cache et le miroir, écriture en base AWAITÉE. Ré-enregistrer un id supprimé
     *  lève sa tombe (#776 pt.2 : une sauvegarde explicite n'est jamais une résurrection accidentelle). */
    async projectSave(entry) {
      const list = [...projectsLoad().filter((e) => e.id !== entry.id), entry];
      cache = list;
      refuseesAuGeste.delete(entry.id);
      const { skipped, storageUnavailable } = writeLocalMirror(list);
      const mirrored = !skipped.has(entry.id);
      const tombstones = readTombstones();
      if (tombstones.delete(entry.id)) writeTombstones(tombstones);
      try {
        const b = base();
        if (b) await b.ecrire(entry);
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
    },

    /** Retrait par id : cache et miroir SYNC, id marqué tombe, suppression en base AWAITÉE. La tombe n'est PAS
     *  purgée ici : `initLibrary` la purge quand la base en confirme l'absence (#776 pt.1/2). */
    async projectRemove(id) {
      const list = projectsLoad().filter((e) => e.id !== id);
      cache = list;
      refuseesAuGeste.delete(id);
      writeLocalMirror(list);
      const tombstones = readTombstones();
      tombstones.add(id);
      const tombstoned = writeTombstones(tombstones);
      try {
        const b = base();
        if (b) await b.supprimer(id);
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
    },

    estRefusee: (p) => p.refus !== undefined || refuseesAuGeste.has(p.id),

    projetDeLEntree: (p) => auGeste(p, () => projetDUneEntree(p)),

    campagneDeLEntree: (p) => auGeste(p, () => campagneDUneEntree(p)),

    reinitialiser() {
      cache = null;
      pendingTombstones = new Set();
      refuseesAuGeste = new Set();
      try {
        const s = stockage();
        s?.removeItem(KEY);
        s?.removeItem(TOMBSTONE_KEY);
      } catch {
        // accès refusé : rien à nettoyer
      }
    },
  };
}

/** Les entrées du miroir qu'aucun `id` ne désigne : relues telles quelles pour être RÉÉCRITES, jamais retirées par
 *  une écriture (#2404). */
function entreesIndesignables(s: Stockage): unknown[] {
  try {
    const raw = s.getItem(KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((brut) => idDesignable(brut) === null) : [];
  } catch {
    return [];
  }
}
