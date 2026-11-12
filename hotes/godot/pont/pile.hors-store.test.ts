// La pile des couches demandée par Godot (#3842) : la demande en base64, résolue par `resoudreLaPile`.
import { describe, expect, it } from 'vitest';
import { SERRAGE_M } from '../asset/pile';
import { depuisBase64, enBase64 } from '../../../src/lib/base64';
import { resoudreLaPileDUneTenue, type MaillageDeLaPile, type PileDemandee, type PileResolue } from './pile';

const base64De = (t: Float32Array | Int32Array): string => enBase64(new Uint8Array(t.buffer));
const flottants = (base64: string): number[] => [...new Float32Array(depuisBase64(base64).buffer)];
const entiers = (base64: string): number[] => [...new Int32Array(depuisBase64(base64).buffer)];

/** Un carré de 10 cm de côté à la hauteur `z`, tourné vers +Z (face avant dans le sens horaire, comme dans Godot), tout
 *  entier sur l'os `os` ; `zNeutre`, sa hauteur sans forme. */
function carre(z: number, os: string, zNeutre?: number): MaillageDeLaPile {
  const a = (h: number) => base64De(Float32Array.from([0, 0, h, 0.1, 0, h, 0, 0.1, h, 0.1, 0.1, h]));
  return {
    positions: a(z), ...(zNeutre === undefined ? {} : { neutres: a(zNeutre) }), indices: base64De(Int32Array.from([0, 2, 1, 1, 2, 3])),
    os: base64De(new Int32Array(16)), poids: base64De(Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])), noms: [os],
  };
}
const resoudre = (pieces: PileDemandee['pieces'], peau: PileDemandee['peau'] = []) =>
  JSON.parse(resoudreLaPileDUneTenue(JSON.stringify({ pieces, peau, parents: { manche: 'bras' }, osDeChaine: [] } satisfies PileDemandee))) as PileResolue & { ok: true };
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

  describe('la peau de la tenue (#3842)', () => {
    const nappes = (): PileDemandee['pieces'] => [
      { rang: 1, accessoire: false, maillages: [carre(0.01, 'bras')] },
      { rang: 1, accessoire: false, maillages: [carre(0.02, 'manche')] },
    ];
    const peauSous = carre(0, 'bras').positions;

    it('sous deux nappes de même couche, la nappe du dessus couvre l’autre', () => {
      expect(resoudre(nappes(), [{ positions: peauSous }]).bilan.couverts).toBeGreaterThan(0);
    });

    it('l’ordre se vote sur la peau sans forme : au-dessus des nappes au repos neutre, aucune ne couvre l’autre', () => {
      expect(resoudre(nappes(), [{ positions: peauSous, neutres: carre(0.07, 'bras').positions }]).bilan.couverts).toBe(0);
    });
  });

  it('refuse une demande illisible', () => {
    expect(JSON.parse(resoudreLaPileDUneTenue('{'))).toMatchObject({ ok: false, erreur: { categorie: 'validation' } });
  });
});
