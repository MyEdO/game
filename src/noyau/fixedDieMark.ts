/**
 * MARQUAGE « dé fixé » du JOURNAL — pendant de la mention portée par la rangée de la modale.
 *
 * Le jet saisi est marqué PARTOUT — rangée ET journal (transparence du dé fixé, #939 ; décision
 * d'affichage révisable). La rangée le porte via `RollRow.fixedMark` ; le journal, lui, n'a qu'UN seul puits (`log` du
 * store) : c'est donc là que la mention s'ajoute, et nulle part ailleurs. Chaque flux compose sa ligne
 * autrement (`res.log` du moteur, `describeX`, `logLines` d'applicateur) — marquer chez eux serait
 * trente copies, et la trentième manquerait.
 *
 * FENÊTRE : un pending reste ouvert pendant que son « Appliquer » compose ses lignes. Tant qu'un slot
 * OUVERT porte `fixed`, les lignes émises sont les conséquences de CE jet — c'est exactement ce qu'il
 * faut marquer. Hors modale, aucun pending n'est ouvert : aucune ligne n'est touchée.
 */
import type { GameState } from '../state/store';

/** Mention ajoutée en fin de ligne (sobre : le journal n'a pas d'autre décoration de provenance). */
export const FIXED_DIE_MARK = '(dé fixé)';

/**
 * Le jet qui ÉMET la ligne porte-t-il la provenance « dé fixé » ? (#973)
 *
 * GRANULARITÉ = l'ÉTAPE, pas le slot. Une séquence à `cursor` (cascade — jets, tables) porte N étapes
 * dont une SEULE joue : les validées sont derrière, les suivantes ne sont pas jouées. Consulter tout
 * le slot marquait les lignes d'une étape NATURELLE dès qu'une sœur avait été saisie — d'autant plus
 * visible depuis que les tirages sur table ouvrent une séquence pour toute la durée d'un dénouement.
 *
 * Slot MULTI sans curseur (contre-lanceurs, batch d'équipage) : aucune étape ne se désigne comme
 * émettrice. Un dé NATUREL dans le lot suffit à ce que la ligne ne soit plus imputable à un dé saisi —
 * on ne marque donc que si TOUS les jets déjà posés le sont (le mono reste le cas N=1 : un participant
 * fixé, tous fixés). Sous-marquer est le seul écart tolérable ; marquer à tort est un mensonge.
 */
function slotFixed(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (o.fixed === true) return true;
  const parts = o.participants;
  if (Array.isArray(parts)) {
    if (typeof o.cursor === 'number') return slotFixed(parts[o.cursor]);
    const poses = parts.filter((p) => !!p && typeof p === 'object' && (p as Record<string, unknown>).result != null);
    return poses.length ? poses.every(slotFixed) : parts.some(slotFixed);
  }
  const rounds = o.rounds;
  if (Array.isArray(rounds) && rounds.some(slotFixed)) return true;
  // Fuir : ses slots vivent sous `fuir.participants`.
  return slotFixed(o.fuir);
}

/** Un jet SAISI par le joueur est-il ouvert (donc en cours d'application) ? */
export function fixedJetOpen(s: GameState): boolean {
  const st = s as unknown as Record<string, unknown>;
  return Object.keys(st).some((k) => k.startsWith('pending') && slotFixed(st[k]));
}

/** Ajoute la mention à une ligne qui ne la porte pas déjà (le journal reste lisible, sans doublon). */
export function markFixedDie(line: string): string {
  return line.includes('dé fixé') ? line : `${line} ${FIXED_DIE_MARK}`;
}
