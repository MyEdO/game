import type { Combatant } from '../engine/types';
import type { Money } from '../engine/money';
import type { CreatorDraft } from '../ui/creator/draft';
import { t } from '../i18n';
import { stockageWeb } from '../lib/stockageWeb';
import { FORMAT_EXPORT_HEROS, FORMAT_ROSTER } from './formats.generated';

/** Roster persistant (localStorage) des personnages créés via le créateur.
 *  Snapshot À LA CRÉATION : le héros tel que sorti de `buildHero`, plus sa
 *  Richesse initiale (créditée au groupe à la création, absente du Combatant —
 *  on la rejoue quand le personnage est repris dans un nouveau groupe).
 *  `draft` (optionnel) = le brouillon EXACT du créateur (tirages figés + choix
 *  étape par étape) : permet de RÉOUVRIR le personnage dans le créateur sans perte
 *  (un Combatant seul ne retient pas ces choix). Absent → édition reconstruite. */
export interface RosterEntry {
  hero: Combatant;
  wealth: Money;
  draft?: CreatorDraft;
}

/** Le roster tel que stocké : `version` vaut `FORMAT_ROSTER` (#2404). */
export interface RosterStocke {
  version: string;
  heros: RosterEntry[];
}

const KEY = 'wfrp4.roster';

/** Témoin « un roster d'un autre format a été trouvé puis retiré » — posé par `rosterLoad`, consommé
 *  par l'écran de sélection des personnages (`ui/PartyScreen`). */
let rosterRetire = false;

/** Consomme le témoin de retrait du roster (et le remet à zéro). */
export function takeRosterNotice(): boolean {
  const r = rosterRetire;
  rosterRetire = false;
  return r;
}

/** Le roster stocké, ou `[]`. Un contenu d'un autre format, ou illisible, est RETIRÉ, témoin posé. */
export function rosterLoad(): RosterEntry[] {
  const s = stockageWeb('localStorage');
  if (!s) return [];
  let raw: string | null;
  try {
    raw = s.getItem(KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const doc = parsed as Partial<RosterStocke> | null;
  if (doc?.version === FORMAT_ROSTER && Array.isArray(doc.heros)) return doc.heros;
  rosterRetire = true;
  try {
    s.removeItem(KEY);
  } catch {
    // stockage indisponible : rien à supprimer
  }
  return [];
}

export function rosterAdd(entry: RosterEntry): void {
  save([...rosterLoad().filter((e) => e.hero.id !== entry.hero.id), entry]);
}

export function rosterRemove(heroId: string): void {
  save(rosterLoad().filter((e) => e.hero.id !== heroId));
}

/** Met à jour l'entrée roster d'un héros DÉJÀ présent (édition de bio en jeu) — n'AJOUTE pas un héros
 *  absent du roster (un prétiré édité ne s'y invite pas). Resynchronise aussi `draft` (motivation/ambitions)
 *  pour le round-trip créateur. */
export function rosterUpdate(hero: Combatant): void {
  const list = rosterLoad();
  const i = list.findIndex((e) => e.hero.id === hero.id);
  if (i < 0) return;
  const prev = list[i];
  const draft: CreatorDraft | undefined = prev.draft
    ? { ...prev.draft, motivation: hero.motivation ?? '', ambitionShort: hero.details?.ambitionShort ?? '', ambitionLong: hero.details?.ambitionLong ?? '' }
    : prev.draft;
  list[i] = { ...prev, hero, draft };
  save(list);
}

const EXPORT_KIND = 'wfrp4-hero';

/** Le fichier d'export d'un héros : `version` vaut `FORMAT_EXPORT_HEROS` (#2404). */
export interface ExportDeHeros {
  kind: typeof EXPORT_KIND;
  version: string;
  hero: Combatant;
  wealth: Money;
}

/** Sérialise un héros (avec sa Richesse) en chaîne portable — sauvegarde, transfert d'appareil,
 *  ou partage pour rejoindre la coop d'un ami. Format taggé pour une réimportation robuste. */
export function rosterExport(entry: RosterEntry): string {
  const doc: ExportDeHeros = { kind: EXPORT_KIND, version: FORMAT_EXPORT_HEROS, hero: entry.hero, wealth: entry.wealth };
  return JSON.stringify(doc, null, 2);
}

/** Résultat de `rosterImport` : soit l'entrée reconstruite, soit un message d'erreur EXPLICITE
 *  (jamais un `null` muet) — l'appelant UI l'affiche tel quel. */
export type RosterImportResult = { entry: RosterEntry; error?: undefined } | { entry?: undefined; error: string };

/** Lit une chaîne `rosterExport` → `RosterEntry`, ou une erreur EXPLICITE : un fichier illisible ou
 *  d'un autre `kind` est invalide, un export d'un autre format est d'un autre format. */
export function rosterImport(str: string): RosterImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(str);
  } catch {
    return { error: t('picker.import.error') };
  }
  const doc = parsed as Partial<ExportDeHeros> | null;
  if (!doc || typeof doc !== 'object' || doc.kind !== EXPORT_KIND) return { error: t('picker.import.error') };
  if (doc.version !== FORMAT_EXPORT_HEROS) return { error: t('picker.import.error.autreFormat') };
  if (!doc.hero || typeof doc.hero.id !== 'string' || !doc.wealth) return { error: t('picker.import.error') };
  return { entry: { hero: doc.hero, wealth: doc.wealth } };
}

function save(list: RosterEntry[]): void {
  try {
    const doc: RosterStocke = { version: FORMAT_ROSTER, heros: list };
    stockageWeb('localStorage')?.setItem(KEY, JSON.stringify(doc));
  } catch {
    // quota plein / stockage indisponible : on ne casse pas la création pour ça
  }
}
