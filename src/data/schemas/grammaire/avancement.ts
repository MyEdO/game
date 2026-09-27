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
 *  - `tirage` — `{ random: n }` : « n Talents aléatoires » d'une liste d'espèce. Cette forme SURVIT
 *    au lot : sa cible de grammaire est le `{ pick, table }`
 *    de `pick()`, dont la table d100 des Talents aléatoires est une donnée du lot L4 (#1463).
 *    21 occurrences (`species.json` : 19 à la racine du champ, 2 en branche de `pick`).
 */
import { z } from 'zod';
import { pick, refOuSpec, type TypeEntite } from './ref';

/** « n Talents aléatoires » — la seule graphie d'avancement encore hors des fabriques (cf. en-tête). */
const tirage = z.strictObject({ random: z.number().int().positive() });

/** Emplacement d'avancement de `type` — composition FERMÉE, écrite UNE fois pour les deux defs. */
export function avancement<T extends TypeEntite>(type: T): z.ZodType<unknown> {
  return z.union([refOuSpec(type, undefined, 'specOuChoixFacultatifs'), pick(type, [tirage]), tirage]);
}
