/**
 * EMPLACEMENT D'AVANCEMENT (L2 #1548, commit 4) — la composition, par les fabriques de `ref.ts`, du
 * champ `skills`/`talents` d'un Niveau de Carrière (`careerLevels.json`) et d'une espèce
 * (`species.json`). C'est un ESPACE DE CHOIX, pas une instance résolue : le joueur y désigne une
 * Compétence/un Talent concret à la création ou à l'avancement.
 *
 * Trois formes, toutes de la grammaire :
 *  - `refOuSpec(type, undefined, 'specOuChoixFacultatifs')` — `{ id }` (aucune spécialisation visée), `{ id, spec }` (spécialisation
 *    précisée), `{ id, choix: true }` (choix libre dans le pool), `{ id, choix: [ids] }` (choix
 *    borné) ;
 *  - `pick(type, [tirage])` — « n parmi » (`{ pick, of: [...] }`), dont une branche peut être un
 *    tirage ;
 *  - `tirageSurTable(ref(…))` — `{ pick, table }`, pour les Talents d'espèce.
 */
import type { z } from 'zod';
import { idDe, pick, ref, refOuSpec, tirageSurTable, unionDeFormes, type TypeEntite } from './ref';

/** LDB 05 l.484, l.514-531 */
const tirage = tirageSurTable(ref(idDe('talentsAleatoires', undefined, { nue: true })));
export type TirageDeTalents = z.output<typeof tirage>;

/** Emplacement d'avancement de `type`. */
export function avancement<T extends TypeEntite>(type: T, options: readonly z.ZodType<TirageDeTalents>[] = []) {
  const reference = refOuSpec<T>(type, undefined, 'specOuChoixFacultatifs');
  return unionDeFormes([reference, pick(type, options), ...options]);
}

/** LDB 05 l.484, l.514-531 */
export const talentDEspece = avancement('talent', [tirage]);

/** Un emplacement d'avancement de `type`, à la sortie du parse (`avancement`). */
export type Avancement<T extends TypeEntite> = z.output<ReturnType<typeof avancement<T>>>;
