import { careers, findCareerById } from '../../../data';
import { memoParVersion } from '../../../data/versionDataset';
import {
  TENUE_BY_ID, CLASS_TENUE_BY_ID, TENUE_PALETTE_BY_ID, CLASS_PALETTE_BY_ID,
  TENUE_OVERLAYS_BY_ID, CLASS_OVERLAYS_BY_ID,
  TENUE_NUE, SPECIFIC_TENUES, type TenueSet,
} from './tenues';
import type { PaletteDeclaree } from '../palette';
import type { RigOverlay } from '../bones';

// Carrière (id) → tenue spécifique réutilisée (id) ; `careers.json` porte `tenue` (variants MDG
// « (Côtier) » sans archétype de classe dédié, MDG 09 l.255/343/458) — champ optionnel, DÉJÀ un id.
const tenueDeCarriere = (id: string): string | undefined => findCareerById(id)?.tenue;

// Vocabulaire de garde-robe RÉSOLVABLE (id STABLE, jamais un libellé) : carrière (careers.json) ∪ classe
// (CLASS_TENUE_BY_ID) ∪ tenue spécifique (TENUE_BY_ID, dont 'nu'). Hors de cet ensemble = vocabulaire
// INCONNU (faute d'authoring) → repli Nu BRUYANT (#223).
const idsDeGardeRobe = memoParVersion('careers', () => new Set<string>([
  ...careers.map((row) => row.id),
  ...Object.keys(CLASS_TENUE_BY_ID),
  ...Object.keys(TENUE_BY_ID),
]));
/** Une clé de garde-robe (id de carrière/classe/tenue) résout-elle à une garde-robe connue ? */
export function wardrobeKeyResolves(key: string | undefined): boolean {
  const id = key ?? '';
  return id === '' || id === 'nu' || idsDeGardeRobe().has(id);
}

/** Classe (id) d'une CLÉ — id de carrière (héros) ou id de tenue/inconnu → défaut « citadins ». */
export function careerClass(key: string): string {
  return findCareerById(key)?.class ?? 'citadins';
}

/** Tenue d'archétype d'une classe (par id de classe). Aucune tenue générique par classe n'existe
 *  (décision utilisateur 2026-07-21 : « les tenus par classes sont immondes… seule la tenue "Nue" a
 *  un sens ») → classe sans def dédié = corps Nu. */
export function tenueForClass(classId: string): TenueSet {
  return CLASS_TENUE_BY_ID[classId] ?? TENUE_NUE;
}

/** Options du sélecteur de tenue (affiche le LIBELLÉ, stocke l'ID) — tenues spécifiques (dont « Nu »). */
export function tenueOptions(): { id: string; label: string }[] {
  return SPECIFIC_TENUES.slice().sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}
const TENUE_LABEL_BY_ID: Record<string, string> = Object.fromEntries(SPECIFIC_TENUES.map((t) => [t.id, t.label]));
/** Libellé d'affichage d'un id de tenue (ou l'id en repli). */
export function tenueLabel(id: string | undefined): string { return TENUE_LABEL_BY_ID[id ?? ''] ?? id ?? ''; }

/**
 * Palette DÉCLARÉE d'une tenue (clé = id STABLE), en miroir EXACT de `tenueFor` : palette par TENUE si
 * dispo, sinon par id de CLASSE direct (#533), sinon aucune (corps Nu, sans palette). Empilée sous
 * l'espèce.
 */
export function tenuePaletteFor(tenue: string | undefined): PaletteDeclaree {
  const id = tenue ?? '';
  const specificId = tenueDeCarriere(id) ?? id;
  return TENUE_PALETTE_BY_ID[specificId] ?? CLASS_PALETTE_BY_ID[id] ?? {};
}

/**
 * Couches DÉCLARÉES du rig (#1903 D3), de la plus basse à la plus haute : espèce, puis tenue —
 * SOURCE UNIQUE de l'empilage (composeRig ET ses gardes l'appellent). La couche défaut est celle de
 * `buildTokenMap`.
 */
export function couchesDuRig(espece: PaletteDeclaree | undefined, tenue: string | undefined): PaletteDeclaree[] {
  return [espece ?? {}, tenuePaletteFor(tenue)];
}

/**
 * Calques asymétriques (`TenueDef.overlays`) d'une tenue, en miroir EXACT de `tenuePaletteFor` :
 * tenue spécifique par id, sinon id de CLASSE direct, sinon aucun (corps Nu).
 * Vide pour l'écrasante majorité des tenues (canal optionnel — cf. `parts/tenues/types.ts`).
 */
export function tenueOverlaysFor(tenue: string | undefined): RigOverlay[] {
  const id = tenue ?? '';
  const specificId = tenueDeCarriere(id) ?? id;
  return TENUE_OVERLAYS_BY_ID[specificId] ?? CLASS_OVERLAYS_BY_ID[id] ?? [];
}

/** Tenue résolue pour une CLÉ de garde-robe (id STABLE — appearance.tenue = id de tenue, sinon
 *  Combatant.career = id de carrière) : tenue SPÉCIFIQUE si dispo (celle de la carrière, ou celle
 *  réutilisée via `CareerData.tenue` — variants MDG « (Côtier) »), sinon id de CLASSE direct (#533 —
 *  une donnée peut viser un archétype sans carrière, ex. créature). Aucune tenue générique par classe
 *  n'existe (décision utilisateur 2026-07-21) : tout id inconnu / classe sans def → corps Nu, avec
 *  warn BRUYANT (#223) si le vocabulaire ne résout pas. */
export function tenueFor(tenue: string | undefined): TenueSet {
  const id = tenue ?? '';
  if (id === 'nu') return TENUE_NUE; // corps nu (monstres sans habit)
  const specific = TENUE_BY_ID[tenueDeCarriere(id) ?? id];
  if (specific) return specific;
  if (id !== '' && !wardrobeKeyResolves(id))
    console.warn(`[tenue] « ${tenue} » introuvable au catalogue (careers ∪ classes ∪ tenues) — repli Nu (#223)`);
  return id in CLASS_TENUE_BY_ID ? tenueForClass(id) : TENUE_NUE;
}

/** Id de garde-robe RÉSOLU, miroir EXACT de `tenueFor` — clé inconnue → 'nu' (le pied et toute
 *  logique keyée-tenue suivent le corps, divergence fallback pied #633). */
export function resolveWardrobeId(key: string | undefined): string {
  const id = key ?? '';
  if (id === 'nu') return 'nu';
  const specificId = tenueDeCarriere(id) ?? id;
  if (TENUE_BY_ID[specificId]) return specificId;
  if (id in CLASS_TENUE_BY_ID) return id;
  return 'nu';
}
