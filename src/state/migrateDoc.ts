/**
 * Primitive GÉNÉRIQUE de migration séquentielle de document versionné.
 * Consommée par `roster.ts` (`ROSTER_MIGRATIONS`, export de héros) et `worldMap.ts`
 * (`PROJECT_MIGRATIONS` de `data/migrationsDeProjet.ts`, documents de campagne authorés) — des documents PORTABLES, produits par un
 * auteur ou exportés vers une autre machine.
 *
 * Les sauvegardes de PARTIE ne migrent pas (2026-08-17,
 * `.claude/memory/user-arbitrage-saves-reset-pas-migration.md`) : au changement de forme persistée,
 * `SAVE_VERSION` monte et les saves antérieures se JETTENT (`saves.ts`). Ne pas purger le roster ni
 * les projets par imitation : ce sont d'autres axes persistants, avec leurs consommateurs.
 *
 * Sémantique : un doc `vN` traverse `migrations[N]`, `[N+1]`… jusqu'à la version courante de la table
 * (`versionCourante`, #2226) ; chaque pas pose lui-même `version` à N+1. Refus explicite et NOMMÉ
 * (`RaisonDeRefus`, jamais une exception ni une donnée corrompue) si : pas un objet, `version`
 * absente/non numérique, version FUTURE (plus récente que l'app — on ne devine pas une structure
 * inconnue), trou dans la chaîne (pas de migrateur pour une version rencontrée), ou migrateur qui LÈVE
 * sur un document qu'il ne sait pas lire.
 */
import { versionCourante } from '../lib/versionCourante';

/** Table de migrations séquentielles : la clé N met à niveau un doc vN → v(N+1). */
export type MigrationMap = Record<number, (doc: Record<string, unknown>) => Record<string, unknown>>;

/** Pourquoi la migration refuse — union FERMÉE, lue par l'appelant pour dire son refus. */
export type RaisonDeRefus =
  | 'non-objet'
  | 'version-absente'
  | 'version-future'
  | 'migrateur-manquant'
  | 'migrateur-en-echec';

/** Issue d'une migration : le document à jour, ou la raison du refus, la version où la chaîne s'est
 *  arrêtée et, pour un migrateur qui a levé, son message. */
export type IssueDeMigration =
  | { readonly ok: true; readonly doc: Record<string, unknown> }
  | { readonly ok: false; readonly raison: RaisonDeRefus; readonly version: unknown; readonly detail?: string };

export function migrateDoc(parsed: unknown, migrations: MigrationMap): IssueDeMigration {
  if (!parsed || typeof parsed !== 'object') return { ok: false, raison: 'non-objet', version: undefined };
  let doc = parsed as Record<string, unknown>;
  const v0 = typeof doc.version === 'number' ? doc.version : NaN;
  if (!Number.isFinite(v0)) return { ok: false, raison: 'version-absente', version: doc.version };
  const cible = versionCourante(migrations);
  if (v0 > cible) return { ok: false, raison: 'version-future', version: v0 };
  for (let v = v0; v < cible; v++) {
    const up = migrations[v];
    if (!up) return { ok: false, raison: 'migrateur-manquant', version: v };
    try {
      doc = { ...up(doc), version: v + 1 };
    } catch (e) {
      return { ok: false, raison: 'migrateur-en-echec', version: v, detail: e instanceof Error ? e.message : String(e) };
    }
  }
  return { ok: true, doc };
}
