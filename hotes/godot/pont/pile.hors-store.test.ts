// La pile des couches demandée par Godot (#3842) : la demande en base64, résolue par `resoudreLaPile`.
import { describe, expect, it } from 'vitest';
import { SERRAGE_M } from '../asset/pile';
import { resoudreLaPileDUneTenue, type MaillageDeLaPile, type PileDemandee, type PileResolue } from './pile';

const enBase64 = (t: Float32Array | Int32Array): string => Buffer.from(t.buffer).toString('base64');
const flottants = (base64: string): number[] => { const o = Buffer.from(base64, 'base64'); return [...new Float32Array(o.buffer, o.byteOffset, o.length / 4)]; };
const entiers = (base64: string): number[] => { const o = Buffer.from(base64, 'base64'); return [...new Int32Array(o.buffer, o.byteOffset, o.length / 4)]; };

/** Un carré de 10 cm de côté à la hauteur `z`, tourné vers +Z (face avant dans le sens horaire, comme dans Godot), tout
 *  entier sur l'os `os` ; `zNeutre`, sa hauteur sans forme. */
function carre(z: number, os: string, zNeutre?: number): MaillageDeLaPile {
  const a = (h: number) => enBase64(Float32Array.from([0, 0, h, 0.1, 0, h, 0, 0.1, h, 0.1, 0.1, h]));
  return {
    positions: a(z), ...(zNeutre === undefined ? {} : { neutres: a(zNeutre) }), indices: enBase64(Int32Array.from([0, 2, 1, 1, 2, 3])),
    os: enBase64(new Int32Array(16)), poids: enBase64(Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])), noms: [os],
  };
}
const resoudre = (pieces: PileDemandee['pieces']) =>
  JSON.parse(resoudreLaPileDUneTenue(JSON.stringify({ pieces, parents: { manche: 'bras' }, osDeChaine: [] } satisfies PileDemandee))) as PileResolue & { ok: true };
/** Le poids du premier sommet de `m` sur l'os `nom`. */
const poidsSur = (m: MaillageDeLaPile, nom: string): number => flottants(m.poids).slice(0, 4).reduce((t, p, k) => t + (m.noms[entiers(m.os)[k]] === nom ? p : 0), 0);

describe('resoudreLaPileDUneTenue', () => {
  it('rend chaque maillage dans l’ordre de la demande : la pièce couverte reprend les poids de sa couverture, qu’elle gagne, et ne se dessine plus', () => {
    const reponse = resoudre([{ rang: -1, accessoire: false, maillages: [carre(0, 'bras')] }, { rang: 2, accessoire: false, maillages: [carre(SERRAGE_M, 'manche')] }]);
    expect(reponse.bilan).toEqual({ couverts: 4, suiveurs: 0, recules: 0, flottants: 0, masques: 2 });
    const [[corps], [manche]] = reponse.pieces.map((p) => p.maillages);
    expect(corps.noms).toEqual(['bras', 'manche']);
    expect(poidsSur(corps, 'manche')).toBeCloseTo(1, 6);
    expect(entiers(corps.indices)).toEqual([]);
    expect(entiers(manche.indices)).toEqual([0, 2, 1, 1, 2, 3]);
    expect(flottants(manche.positions)[2]).toBeCloseTo(SERRAGE_M, 6);
    expect(corps).not.toHaveProperty('neutres');
  });

  it('à couche égale, l’ordre se vote sur les positions sans forme', () => {
    const tenue = (zNeutreDuBras: number) => resoudre([
      { rang: 1, accessoire: false, maillages: [carre(0, 'bras', zNeutreDuBras)] },
      { rang: 1, accessoire: false, maillages: [carre(SERRAGE_M, 'manche', SERRAGE_M)] },
    ]).pieces.map((p) => entiers(p.maillages[0].indices).length);
    expect(tenue(0)).toEqual([0, 6]);
    expect(tenue(2 * SERRAGE_M)).toEqual([6, 0]);
  });

  it('refuse une demande illisible', () => {
    expect(JSON.parse(resoudreLaPileDUneTenue('{'))).toMatchObject({ ok: false, erreur: { categorie: 'validation' } });
  });
});
