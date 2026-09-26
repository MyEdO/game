import { TENUE_DEFS } from './_registry.generated';
import { careers } from '../../../../data';
import { memoParVersion } from '../../../../data/versionDataset';
import type { TenueSet } from './types';
import type { PaletteDeclaree } from '../../palette';
import type { RigOverlay } from '../../bones';

export type { TenueSet, TenueDef } from './types';

/**
 * Table des tenues DÉRIVÉE des seuls fichiers `defs/` (plus d'AUTO/MANUAL/merge). Ajouter une
 * tenue = déposer un fichier dans `defs/` (puis `npm run gen` hors dev). La taxonomie des classes
 * (careers.json) discrimine les archétypes de CLASSE (repli) des tenues SPÉCIFIQUES (par id) —
 * aucun flag `career` sur le def : la donnée des carrières est l'unique autorité. Une carrière sans
 * tenue dédiée peut réutiliser celle d'une autre via `CareerData.tenue` (résolu dans `career.ts`).
 */
const classIds = memoParVersion('careers', () => new Set((careers as Array<{ class: string }>).map((c) => c.class)));
const isClassDef = (id: string): boolean => classIds().has(id);

/** Tenues SPÉCIFIQUES (carrière / créature / PNJ / 'Nu') par id de tenue — lookup direct. */
export const TENUE_BY_ID: Record<string, TenueSet> = Object.fromEntries(
  TENUE_DEFS.filter((d) => !isClassDef(d.id)).map((d) => [d.id, d.set]),
);
/** Tenues d'ARCHÉTYPE DE CLASSE par id de classe — repli quand une carrière n'a pas de tenue dédiée. */
export const CLASS_TENUE_BY_ID: Record<string, TenueSet> = Object.fromEntries(
  TENUE_DEFS.filter((d) => isClassDef(d.id)).map((d) => [d.id, d.set]),
);
/** Palettes par défaut : tenue spécifique (par id) puis classe (par id de classe). */
export const TENUE_PALETTE_BY_ID: Record<string, PaletteDeclaree> = Object.fromEntries(
  TENUE_DEFS.filter((d) => !isClassDef(d.id) && d.palette).map((d) => [d.id, d.palette!]),
);
export const CLASS_PALETTE_BY_ID: Record<string, PaletteDeclaree> = Object.fromEntries(
  TENUE_DEFS.filter((d) => isClassDef(d.id) && d.palette).map((d) => [d.id, d.palette!]),
);
/** Calques asymétriques (`TenueDef.overlays`) par tenue spécifique puis par classe — même
 *  résolution que la palette (`tenuePaletteFor`). Absent chez la quasi-totalité des tenues
 *  (canal optionnel, cf. types.ts). */
export const TENUE_OVERLAYS_BY_ID: Record<string, RigOverlay[]> = Object.fromEntries(
  TENUE_DEFS.filter((d) => !isClassDef(d.id) && d.overlays).map((d) => [d.id, d.overlays!]),
);
export const CLASS_OVERLAYS_BY_ID: Record<string, RigOverlay[]> = Object.fromEntries(
  TENUE_DEFS.filter((d) => isClassDef(d.id) && d.overlays).map((d) => [d.id, d.overlays!]),
);
/** Tenue « nue » (corps de chair) — référencée à part par tenueFor pour le cas 'Nu'. */
export const TENUE_NUE: TenueSet = TENUE_BY_ID.nu;
/** Tenues SPÉCIFIQUES `{ id, label }` — `id` explicite et stable porté par le def (clé de `TENUE_BY_ID`).
 *  Consommé par les pickers éditeur (id stocké, label affiché). */
export const SPECIFIC_TENUES: { id: string; label: string }[] = TENUE_DEFS.filter((d) => !isClassDef(d.id)).map((d) => ({ id: d.id, label: d.label }));
