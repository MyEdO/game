/**
 * LA PILE DES COUCHES D'UNE TENUE MONTÉE, DEMANDÉE PAR GODOT (#3842) : `resoudreLaPile` (`asset/pile.ts`) sur les
 * pièces que le montage fond (`MontageDeComposition.refondre`), leurs tableaux échangés en base64. La page la résout
 * hors du fil de l'image (`pileEnFond.ts`).
 */
import { depuisBase64, enBase64 } from '../../../src/lib/base64';
import { ordreDesCouches, resoudreLaPile, type BilanDePile, type MaillageDePile } from '../asset/pile';

/**
 * @contrat Pile des couches
 * Un maillage d'une pièce : une surface skinnée que le montage fond, dans le repère du squelette de la base. Chaque
 * tableau est la suite de ses octets, petit-boutiste, en base64.
 */
export interface MaillageDeLaPile {
  /** les positions de ses sommets au repos, formes cuites, sans gabarit : trois flottants de 32 bits par sommet. */
  positions: string;
  /** les mêmes sans aucune forme ; absent d'un maillage sans shape key. */
  neutres?: string;
  /** ses triangles : trois indices de sommet par triangle, en entiers de 32 bits, sa face avant dans le sens horaire,
   *  comme Godot range ceux d'un mesh. */
  indices: string;
  /** par sommet, quatre rangs dans `noms`, en entiers de 32 bits. */
  os: string;
  /** par sommet, quatre poids de peau, en flottants de 32 bits. */
  poids: string;
  /** les noms des os que `os` désigne. */
  noms: string[];
}

/**
 * @contrat Pile des couches
 * Une pièce d'une tenue : le corps de la base, ou un élément monté qui déclare une couche.
 */
export interface PieceDeLaPile {
  /** le rang de sa couche (`couches` de `modeles`), -1 pour le corps. */
  rang: number;
  /** vrai pour un accessoire (`couches` de `modeles`). */
  accessoire: boolean;
  /** ses surfaces skinnées, visibles et fondues. */
  maillages: MaillageDeLaPile[];
}

/**
 * @contrat Pile des couches
 * Une surface de la peau de la tenue, dans le repère du squelette de la base. Chaque tableau est la suite de ses octets,
 * petit-boutiste, en base64.
 */
export interface SurfaceDePeau {
  /** les positions de ses sommets au repos, formes cuites : trois flottants de 32 bits par sommet. */
  positions: string;
  /** les mêmes sans aucune forme ; absent d'une surface sans shape key. */
  neutres?: string;
}

/**
 * @contrat Pile des couches
 * La pile demandée.
 */
export interface PileDemandee {
  /** les pièces de la tenue. */
  pieces: PieceDeLaPile[];
  /** la peau de la tenue (#3842) : chaque surface skinnée de la base, montrée ou masquée, hors des zones que couvrent
   *  les éléments montés de la couche `peau`, puis chaque surface skinnée de ceux qui en couvrent une ; l'ordre des
   *  couches se vote sur ses `neutres` (`ordreDesCouches`, `asset/pile.ts`), l'endroit d'une pièce se lit sur ses
   *  `positions` (`endroitDe`). */
  peau: SurfaceDePeau[];
  /** le parent de chaque os du squelette de la base qui en a un, par nom. */
  parents: Record<string, string>;
  /** les os des chaînes de la base (`osDeChaine` de sa base dans `modeles`). */
  osDeChaine: string[];
}

/**
 * @contrat Pile des couches
 * La pile résolue, ou son refus.
 */
export type PileResolue =
  /** le bilan de la résolution (`BilanDePile`, `asset/pile.ts`) et, dans l'ordre de la demande, chaque maillage de
   *  chaque pièce : ses sommets reculés, ses triangles encore dessinés, ses os et ses poids, `noms` allongé des os
   *  qu'il a gagnés ; sans `neutres`. */
  | { ok: true; bilan: BilanDePile; pieces: { maillages: MaillageDeLaPile[] }[] }
  /** une demande illisible. */
  | { ok: false; erreur: { categorie: 'validation'; message: string } };

/** Les octets du tableau base64 `base64`. */
const octetsDe = (base64: string): ArrayBuffer => depuisBase64(base64).buffer;

/** Les octets de `tableau` en base64. */
const enBase64DuTableau = (tableau: Float32Array | Int32Array): string => enBase64(new Uint8Array(tableau.buffer, tableau.byteOffset, tableau.byteLength));

/** Les triangles `indices` tournés dans l'autre sens : du sens horaire de Godot au sens trigonométrique de la pile, et
 *  retour. */
function retournes<T extends Int32Array | Uint32Array>(indices: T): T {
  for (let t = 0; t + 2 < indices.length; t += 3) [indices[t + 1], indices[t + 2]] = [indices[t + 2], indices[t + 1]];
  return indices;
}

const lire = (m: MaillageDeLaPile): MaillageDePile => ({
  positions: new Float32Array(octetsDe(m.positions)),
  indices: retournes(Uint32Array.from(new Int32Array(octetsDe(m.indices)))),
  os: Uint16Array.from(new Int32Array(octetsDe(m.os))),
  poids: new Float32Array(octetsDe(m.poids)),
  noms: [...m.noms],
});

const ecrire = (m: MaillageDePile): MaillageDeLaPile => ({
  positions: enBase64DuTableau(m.positions),
  indices: enBase64DuTableau(retournes(Int32Array.from(m.indices))),
  os: enBase64DuTableau(Int32Array.from(m.os)),
  poids: enBase64DuTableau(m.poids),
  noms: m.noms,
});

/** La réponse, en JSON (`PileResolue`), à la demande `json` (`PileDemandee`). */
export function resoudreLaPileDUneTenue(json: string): string {
  let reponse: PileResolue;
  try {
    const demande = JSON.parse(json) as PileDemandee;
    const pieces = demande.pieces.map(({ rang, accessoire, maillages: demandes }) => {
      const maillages = demandes.map(lire);
      const neutres = demandes.map((m, i) => ({ positions: m.neutres === undefined ? Float32Array.from(maillages[i].positions) : new Float32Array(octetsDe(m.neutres)), indices: maillages[i].indices }));
      return { rang, accessoire, maillages, neutres };
    });
    const peaux = demande.peau.map((s) => new Float32Array(octetsDe(s.positions)));
    const neutres = demande.peau.map((s) => new Float32Array(octetsDe(s.neutres ?? s.positions)));
    const bilan = resoudreLaPile(pieces, ordreDesCouches(neutres), { parents: new Map(Object.entries(demande.parents)), osDeChaine: new Set(demande.osDeChaine) }, peaux);
    reponse = { ok: true, bilan, pieces: pieces.map((p) => ({ maillages: p.maillages.map(ecrire) })) };
  } catch (erreur) {
    reponse = { ok: false, erreur: { categorie: 'validation', message: `pile : demande illisible (${erreur instanceof Error ? erreur.message : String(erreur)})` } };
  }
  return JSON.stringify(reponse);
}
