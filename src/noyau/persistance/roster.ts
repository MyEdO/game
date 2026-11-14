/**
 * LE ROSTER ET L'EXPORT DE HÉROS (#2404, #3041), leur forme et leurs transformations pures : la lecture d'un roster
 * stocké (format contrôlé, élagage `elaguerLePersiste`), son écriture sous `FORMAT_ROSTER`, la mise à jour d'une
 * entrée, et l'export/import d'un héros sous `FORMAT_EXPORT_HEROS`. La procédure sur un stockage : `hote/roster.ts`.
 */
import type { Combatant } from '../../engine/types';
import type { IdDeHerosDuRoster } from '../../lib/idDeHerosDuRoster';
import type { Money } from '../../engine/money';
import type { CreatorDraft } from '../creation/brouillon';
import { t } from '../../i18n';
import { FORMAT_EXPORT_HEROS, FORMAT_ROSTER } from './formats.generated';
import { elaguerLePersiste, rienDElague, type RetraitsDElagage } from './elagage';
import { pregens } from '../../data';
import { idDuPretire } from '../../data/pregens';

/** Un personnage du roster, tel que sorti du créateur : le héros, sa Richesse initiale (absente du Combatant), et
 *  `draft`, le brouillon EXACT du créateur qui le rouvre sans perte et que le geste engage au groupe, où le noyau
 *  rebâtit le héros (`HerosEngage`). */
export interface RosterEntry {
  hero: HerosDuRoster;
  wealth: Money;
  draft: CreatorDraft;
}

/** Un héros du roster : son id est un `IdDeHerosDuRoster`. */
export type HerosDuRoster = Combatant & { id: IdDeHerosDuRoster };

/** L'id sous lequel le roster connaît le membre `h` du groupe : son `idDeRoster`, sinon son `id`. */
export const idDeRosterDuMembre = (h: Combatant): string => h.idDeRoster ?? h.id;

/** L'id de roster du membre `h` du groupe : celui de son entrée dans `heros`, ou celui de son pré-tiré ; `undefined`
 *  sinon. */
export function idDeRosterDuHeros(heros: readonly RosterEntry[], h: Combatant): IdDeHerosDuRoster | undefined {
  const id = idDeRosterDuMembre(h);
  return heros.find((e) => e.hero.id === id)?.hero.id ?? pregens.map((p) => idDuPretire(p.id)).find((p) => p === id);
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

/** Le roster stocké `brut`, élagué de ses États et Traits psychologiques à Cible inconnus (#1463 LD.1) ; `null` s'il est d'un autre format ou
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
  return { heros: doc.heros.map((e, i) => ({ ...e, hero: { ...porteurs[i], id: e.hero.id } })), retraits: rienDElague(retraits) ? null : retraits };
}

/** Le texte stocké du roster `heros`, sous `FORMAT_ROSTER`. */
export function ecrireLeRoster(heros: RosterEntry[]): string {
  const doc: RosterStocke = { version: FORMAT_ROSTER, heros };
  return JSON.stringify(doc);
}

/** Le roster `heros` dont l'entrée du héros `hero` porte `hero`, brouillon resynchronisé (motivation,
 *  ambitions) ; `null` quand `hero` n'y est pas : la mise à jour n'ajoute aucun héros. */
export function rosterAvecLeHeros(heros: readonly RosterEntry[], hero: Combatant): RosterEntry[] | null {
  const i = heros.findIndex((e) => e.hero.id === idDeRosterDuMembre(hero));
  if (i < 0) return null;
  const prev = heros[i];
  const draft: CreatorDraft = { ...prev.draft, motivation: hero.motivation ?? '', ambitionShort: hero.details?.ambitionShort ?? '', ambitionLong: hero.details?.ambitionLong ?? '' };
  const porte: HerosDuRoster = { ...hero, id: prev.hero.id };
  delete porte.idDeRoster;
  return heros.map((e, j) => (j === i ? { ...prev, hero: porte, draft } : e));
}

const EXPORT_KIND = 'wfrp4-hero';

/** Le fichier d'export d'un héros : `version` vaut `FORMAT_EXPORT_HEROS` (#2404). */
export interface ExportDeHeros {
  kind: typeof EXPORT_KIND;
  version: string;
  hero: HerosDuRoster;
  wealth: Money;
  draft: CreatorDraft;
}

/** Sérialise un héros (avec sa Richesse et son brouillon) en chaîne portable, sous son `kind` et `FORMAT_EXPORT_HEROS`. */
export function rosterExport(entry: RosterEntry): string {
  const doc: ExportDeHeros = { kind: EXPORT_KIND, version: FORMAT_EXPORT_HEROS, hero: entry.hero, wealth: entry.wealth, draft: entry.draft };
  return JSON.stringify(doc, null, 2);
}

/** Résultat de `rosterImport` : soit l'entrée reconstruite (et ce que l'élagage lui a retiré, à nommer au
 *  joueur), soit un message d'erreur EXPLICITE (jamais un `null` muet) — l'appelant UI l'affiche tel quel. */
export type RosterImportResult = { entry: RosterEntry; retraits?: RetraitsDElagage; error?: undefined } | { entry?: undefined; retraits?: undefined; error: string };

/** Lit une chaîne `rosterExport` → `RosterEntry`, ou une erreur EXPLICITE : un fichier illisible ou
 *  d'un autre `kind` est invalide, un export d'un autre format est d'un autre format. Le héros qui porte un
 *  État, ou un Trait psychologique à Cible hors de `groups.json`, est importé sans eux, retrait rendu (#1463 LD.1). */
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
  if (!doc.hero || typeof doc.hero.id !== 'string' || !doc.wealth || !doc.draft) return { error: t('picker.import.error') };
  const { porteurs: [hero], retraits } = elaguerLePersiste({ porteurs: [doc.hero] });
  return { entry: { hero: { ...hero, id: doc.hero.id }, wealth: doc.wealth, draft: doc.draft }, ...(rienDElague(retraits) ? {} : { retraits }) };
}
