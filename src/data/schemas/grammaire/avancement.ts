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
 *  - `tirage` — `{ random: n }`.
 */
import { z } from 'zod';
import { nommerChamps } from './meta';
import { pick, refOuSpec, type TypeEntite } from './ref';

/** « n Talents aléatoires » — la seule graphie d'avancement encore hors des fabriques (cf. en-tête). */
const tirage = nommerChamps(z.strictObject({ random: z.number().int().positive() }), { random: { label: 'nombre de tirages' } });

/** Emplacement d'avancement de `type` — composition FERMÉE, écrite UNE fois pour les deux defs. */
export function avancement<T extends TypeEntite>(type: T): z.ZodType<unknown> {
  return z.union([refOuSpec(type, undefined, 'specOuChoixFacultatifs'), pick(type, [tirage]), tirage]);
}
