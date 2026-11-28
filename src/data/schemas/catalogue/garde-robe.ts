/**
 * LECTURES de la GARDE-ROBE sous un catalogue (#5070) : la variante, l'ensemble qui habille un objet ou une tenue, et
 * les pièces que revêt un objet porté (#3456).
 */
import { collectionDuCatalogue, entreeDe, type Catalogue, type EntreeDuDataset } from './catalogue';
import { cleDHabille, type HabilleDEnsemble, type PieceId } from '../defs/garde-robe';
import { localisationsDeLoc } from '../../../engine/classementDeTrait';
import type { HitLocation } from '../../../engine/types';
import { memoParIdentiteEtDeps } from '../../../lib/memoParIdentite';

/** Une ligne de la garde-robe de nature `K`. */
type LigneDeNature<K extends EntreeDuDataset<'gardeRobe'>['kind']> = Extract<EntreeDuDataset<'gardeRobe'>, { kind: K }>;

/** La variante `id` de la garde-robe de `cat` ; une ligne d'une autre nature n'en est pas une. */
export function varianteDePiece(id: string | null | undefined, cat: Catalogue): LigneDeNature<'variante'> | undefined {
  const ligne = entreeDe('gardeRobe', id, cat);
  return ligne?.kind === 'variante' ? ligne : undefined;
}

/** L'index des ensembles par `cleDHabille`, mémoïsé par l'identité de la collection et par celle du catalogue. */
const ensemblesParHabille = memoParIdentiteEtDeps<readonly EntreeDuDataset<'gardeRobe'>[], ReadonlyMap<string, LigneDeNature<'ensemble'>>>();

/** L'ensemble de la garde-robe de `cat` qui habille `habille` (égalité de `{ id, type }`), `undefined` si aucun. */
export function ensembleDe(habille: HabilleDEnsemble, cat: Catalogue): LigneDeNature<'ensemble'> | undefined {
  const collection = collectionDuCatalogue('gardeRobe', cat);
  const index = ensemblesParHabille(collection, [cat], () =>
    new Map(collection.flatMap((e) => (e.kind === 'ensemble' ? [[cleDHabille(e.habille), e] as const] : []))));
  return index.get(cleDHabille(habille));
}

/** Les pièces d'armure de la garde-robe de `cat` qui couvrent une des localisations `locs` (`localisations`, #3456),
 *  dans l'ordre de la garde-robe. */
const piecesCouvrant = (locs: readonly HitLocation[], cat: Catalogue): PieceId[] =>
  collectionDuCatalogue('gardeRobe', cat).flatMap((e) => (e.kind === 'piece' && e.localisations?.some((l) => locs.includes(l)) ? [e.id] : []));

/** Les pièces que revêt un objet porté sous `cat` : celles de l'ensemble qui habille son trapping `trappingId`, à défaut
 *  celles qui couvrent ses localisations, `locs`, à défaut celles de son trapping (`localisationsDeLoc`). #3456 */
export function piecesDeLObjet(trappingId: string | undefined, locs: readonly HitLocation[] | undefined, cat: Catalogue): readonly PieceId[] {
  const ensemble = trappingId === undefined ? undefined : ensembleDe({ type: 'trapping', id: trappingId }, cat);
  return ensemble?.pieces ?? piecesCouvrant(locs ?? localisationsDeLoc(entreeDe('trappings', trappingId, cat)?.loc), cat);
}
