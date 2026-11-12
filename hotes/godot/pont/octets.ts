/**
 * LES TABLEAUX D'UNE RÉPONSE DE `morceaux` EN OCTETS (#3948) : la porte `appelerEnOctets` du pont (`pont.ts`, section
 * « Transport ») les passe à Godot en un seul tampon de `Float32`, et la réponse JSON n'en garde que les bornes.
 */
import type { MorceauDuMonde, NappeDuMonde } from '../../../src/noyau/index';
import type { MorceauxDuPont } from './pont';

/** Les tableaux d'une géométrie du monde, dans l'ordre du tampon. */
const TABLEAUX = ['positions', 'normales', 'couleurs', 'cases'] as const;
type Tableau = (typeof TABLEAUX)[number];

/** `[debut, fin]` : les bornes d'un tableau dans le tampon, en octets, `fin` exclu. */
export type BornesEnOctets = [number, number];

/** Une géométrie dont chaque tableau est remplacé par ses bornes dans le tampon. */
export type GeometrieEnOctets<G extends Record<Tableau, number[]>> = Omit<G, Tableau> & Record<Tableau, BornesEnOctets>;

/**
 * @contrat Monde
 * L'en-tête d'une réponse de `morceaux` passée en octets.
 */
export interface EnteteDesMorceaux {
  /** la longueur du tampon, en octets. */
  octets: number;
  /** les morceaux du volume, leurs tableaux en bornes. */
  volume: GeometrieEnOctets<MorceauDuMonde>[];
  /** les nappes de toit, leurs tableaux en bornes. */
  toits: GeometrieEnOctets<NappeDuMonde>[];
  /** les couronnes crénelées, leurs tableaux en bornes. */
  couronnes: GeometrieEnOctets<NappeDuMonde>[];
}

/**
 * Les tableaux de `reponse` en un tampon de `Float32` (ordre des octets de la machine), à la suite depuis l'octet 0 :
 * familles `volume`, `toits`, `couronnes`, puis géométries, puis `TABLEAUX` ; et l'en-tête qui porte leurs bornes.
 */
export function enOctets(reponse: MorceauxDuPont): { entete: EnteteDesMorceaux; octets: ArrayBuffer } {
  const geometries = [...reponse.volume, ...reponse.toits, ...reponse.couronnes];
  const tampon = new Float32Array(geometries.reduce((n, g) => TABLEAUX.reduce((m, champ) => m + g[champ].length, n), 0));
  let rang = 0;
  const borner = <G extends Record<Tableau, number[]>>(g: G): GeometrieEnOctets<G> => {
    const bornes = {} as Record<Tableau, BornesEnOctets>;
    for (const champ of TABLEAUX) {
      tampon.set(g[champ], rang);
      bornes[champ] = [rang * Float32Array.BYTES_PER_ELEMENT, (rang += g[champ].length) * Float32Array.BYTES_PER_ELEMENT];
    }
    return { ...g, ...bornes };
  };
  const entete: EnteteDesMorceaux = {
    octets: tampon.byteLength,
    volume: reponse.volume.map(borner),
    toits: reponse.toits.map(borner),
    couronnes: reponse.couronnes.map(borner),
  };
  return { entete, octets: tampon.buffer };
}
