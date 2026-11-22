// Les formes de la tête dans l'évaluateur (#4413) : posées par leur nom sur l'élément qui les porte, elles changent la
// pile des couches comme Godot la résout sur le corps cuit ; une base qui ne porte que les silhouettes les reçoit.
import { describe, expect, it } from 'vitest';
import { NOMS_DES_FORMES_DE_TETE, VISAGE_INVERSE } from '../../../../src/lib/formesDeTete.ts';
import { tableTotale } from '../../../../src/lib/tableTotale.ts';
import { NOMS_DES_SILHOUETTES } from '../silhouettes.ts';
import { evaluer } from './evaluer.ts';
import { glbFabrique } from './glbFabrique.testkit.ts';
import { glb, type Piece, type Point } from './gardes/pieces.testkit.ts';

/** Une nappe carrée de 0,2 m à la hauteur `z`, centrée en y = 1, en grille de 4 × 4 mailles, tournée vers +Z. */
function nappe(z: number): Pick<Piece, 'sommets' | 'triangles'> {
  const n = 4;
  const sommets: Point[] = [];
  const triangles: number[] = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) sommets.push([(i / n - 0.5) * 0.2, 0.9 + (j / n) * 0.2, z]);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * (n + 1) + i;
    triangles.push(a, a + 1, a + n + 1, a + 1, a + n + 2, a + n + 1);
  }
  return { sommets, triangles };
}

/** La peau de la tête du corps ; une tête portée juste devant, que `visage_inverse` avance de 2 cm ; un casque qui la
 *  couvre au repos, et qu'elle dépasse sous la clé. Aucune pièce ne masque de zone : chacune entre dans la pile. */
const PEAU: Piece = { nom: 'Peau', zone: 'tete', ...nappe(0) };
const TETE: Piece = { nom: 'Tete', zone: 'tete', ...nappe(0.002), formes: { [VISAGE_INVERSE]: () => [0, 0, 0.02] } };
const CASQUE: Piece = { nom: 'Casque', zone: 'tete', ...nappe(0.006) };

const pile = async (poids: number) => (await evaluer({
  base: glb([PEAU], 'Repos'), elements: [glb([TETE]), glb([CASQUE])],
  couches: [{ couche: 'peau', couvre: [] }, { couche: 'armure', couvre: [] }],
  silhouettes: { [VISAGE_INVERSE]: poids }, pas: 0.5,
})).mesures.pile;

describe('evaluer : une forme de la tête se pose sur l’élément qui la porte, avant la pile (#4413)', () => {
  it('au repos, le casque couvre la peau et la tête ; la tête avancée par `visage_inverse` passe devant lui et ne lui cède plus rien', async () => {
    const BILAN = { suiveurs: 0, flottants: 0 };
    expect(await pile(0)).toEqual({ ...BILAN, couverts: 50, recules: 25, masques: 64 });
    expect(await pile(1)).toEqual({ ...BILAN, couverts: 25, recules: 0, masques: 32 });
  });

  it('une base qui ne porte que les silhouettes reçoit chaque forme de la tête avec elles ; un autre nom est une silhouette absente', async () => {
    const base = glbFabrique({ clips: { Repos: [0, 0] }, anneau: tableTotale(NOMS_DES_SILHOUETTES, () => new Array<number>(27).fill(0)) });
    const silhouettes = { ...tableTotale(NOMS_DES_SILHOUETTES, () => 0.5), ...tableTotale(NOMS_DES_FORMES_DE_TETE, () => 1) };
    await expect(evaluer({ base, silhouettes, pas: 0.5 })).resolves.toBeDefined();
    await expect(evaluer({ base, silhouettes: { ...silhouettes, nez_crochu: 1 }, pas: 0.5 })).rejects.toThrow(/\[silhouette-absente\] nez_crochu /);
  });
});
