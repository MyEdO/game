/** Les nœuds `GameOp` d'un document brut, et ceux que le parse de mesure (`opsDuParse`) n'atteint pas (#847, #1473). */
import { estObjet } from '../lib/objet.mjs';

export interface NoeudDOp {
  readonly path: string;
  readonly op: string;
  readonly noeud: object;
}

/** Les opérations observées dans le document brut, par identité, sans ouvrir son schéma. */
export function* noeudsDOp(valeur: unknown, path: string): Generator<NoeudDOp> {
  if (Array.isArray(valeur)) {
    for (const [rang, enfant] of valeur.entries()) yield* noeudsDOp(enfant, `${path}[${rang}]`);
    return;
  }
  if (!estObjet(valeur)) return;
  if (typeof valeur.op === 'string' && !('kind' in valeur)) yield { path, op: valeur.op, noeud: valeur };
  for (const [cle, enfant] of Object.entries(valeur)) yield* noeudsDOp(enfant, `${path}.${cle}`);
}

export const horsDuParse = (noeuds: readonly NoeudDOp[], atteintes: ReadonlySet<object>) =>
  noeuds.filter((n) => !atteintes.has(n.noeud)).map(({ path, op }) => `${path} : ${op}`);
