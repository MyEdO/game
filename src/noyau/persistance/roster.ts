/**
 * LE ROSTER ET L'EXPORT DE HÉROS (#2404, #3041), leur forme et leurs transformations pures : la lecture d'un roster
 * stocké (format contrôlé, élagage `elaguerLePersiste`), son écriture sous `FORMAT_ROSTER`, la mise à jour d'une
 * entrée, et l'export/import d'un héros sous `FORMAT_EXPORT_HEROS`. La procédure sur un stockage : `hote/roster.ts`.
 */
import type { Combatant } from '../../engine/types';
import type { Money } from '../../engine/money';
import type { CreatorDraft } from '../creation/brouillon';
import { t } from '../../i18n';
import { FORMAT_EXPORT_HEROS, FORMAT_ROSTER } from './formats.generated';
import { elaguerLePersiste, rienDElague, type RetraitsDElagage } from './elagage';

/** Un personnage du roster, tel que sorti du créateur : le héros, sa Richesse initiale (absente du Combatant,
 *  rejouée quand il rejoint un groupe), et `draft`, le brouillon EXACT du créateur qui le rouvre sans perte
 *  (absent : édition reconstruite). */
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

/** Un roster lu : ses entrées, et ce que l'élagage leur a retiré (`null` : rien). */
interface RosterLu {
  heros: RosterEntry[];
  retraits: RetraitsDElagage | null;
}

/** Le roster stocké `brut`, élagué de ses États inconnus (#1463 LD.1) ; `null` s'il est d'un autre format ou
 *  illisible. */
export function lireLeRoster(brut: string): RosterLu | null {
  let doc: Partial<RosterStocke> | null;
  try {
    doc = JSON.parse(brut) as Partial<RosterStocke> | null;
  } catch {
    return null;
  }
  if (doc?.version !== FORMAT_ROSTER || !Array.isArray(doc.heros)) return null;
  const { porteurs, retraits } = elaguerLePersiste({ porteurs: doc.heros.map((e) => e.hero) });
  if (rienDElague(retraits)) return { heros: doc.heros, retraits: null };
  return { heros: doc.heros.map((e, i) => ({ ...e, hero: porteurs[i] })), retraits };
}

/** Le texte stocké du roster `heros`, sous `FORMAT_ROSTER`. */
export function ecrireLeRoster(heros: RosterEntry[]): string {
  const doc: RosterStocke = { version: FORMAT_ROSTER, heros };
  return JSON.stringify(doc);
}

/** Le roster `heros` dont l'entrée du héros `hero` porte `hero`, brouillon resynchronisé (motivation,
 *  ambitions) ; `null` quand `hero` n'y est pas : la mise à jour n'ajoute aucun héros. */
export function rosterAvecLeHeros(heros: readonly RosterEntry[], hero: Combatant): RosterEntry[] | null {
  const i = heros.findIndex((e) => e.hero.id === hero.id);
  if (i < 0) return null;
  const prev = heros[i];
  const draft: CreatorDraft | undefined = prev.draft
    ? { ...prev.draft, motivation: hero.motivation ?? '', ambitionShort: hero.details?.ambitionShort ?? '', ambitionLong: hero.details?.ambitionLong ?? '' }
    : prev.draft;
  return heros.map((e, j) => (j === i ? { ...prev, hero, draft } : e));
}

const EXPORT_KIND = 'wfrp4-hero';

/** Le fichier d'export d'un héros : `version` vaut `FORMAT_EXPORT_HEROS` (#2404). */
export interface ExportDeHeros {
  kind: typeof EXPORT_KIND;
  version: string;
  hero: Combatant;
  wealth: Money;
}

/** Sérialise un héros (avec sa Richesse) en chaîne portable, sous son `kind` et `FORMAT_EXPORT_HEROS`. */
export function rosterExport(entry: RosterEntry): string {
  const doc: ExportDeHeros = { kind: EXPORT_KIND, version: FORMAT_EXPORT_HEROS, hero: entry.hero, wealth: entry.wealth };
  return JSON.stringify(doc, null, 2);
}

/** Résultat de `rosterImport` : soit l'entrée reconstruite (et ce que l'élagage lui a retiré, à nommer au
 *  joueur), soit un message d'erreur EXPLICITE (jamais un `null` muet) — l'appelant UI l'affiche tel quel. */
export type RosterImportResult = { entry: RosterEntry; retraits?: RetraitsDElagage; error?: undefined } | { entry?: undefined; retraits?: undefined; error: string };

/** Lit une chaîne `rosterExport` → `RosterEntry`, ou une erreur EXPLICITE : un fichier illisible ou
 *  d'un autre `kind` est invalide, un export d'un autre format est d'un autre format. Le héros qui porte un
 *  État hors du registre courant est importé sans cet État, retrait rendu (#1463 LD.1). */
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
  const { porteurs: [hero], retraits } = elaguerLePersiste({ porteurs: [doc.hero] });
  return { entry: { hero, wealth: doc.wealth }, ...(rienDElague(retraits) ? {} : { retraits }) };
}
