/**
 * L'OUTIL D'UN TEST DE SCÈNE COMPTE À SON DÉ (#4843) : LDB 60 l.22, l.50, l.58. Le dé posé, tiré ou imposé, porte l'issue
 * effective : la ligne de jet, le pending et la branche disent la même ; une réussite forcée (LDB 17 l.68) le reste, sans
 * ligne d'outil. Piloté par la surface (`creerPartie`, `partie.envoyer`).
 */
import { describe, it, expect } from 'vitest';
import { creerPartie, etatInitialDuJeu, jetsEnVue, type EntreesDeLaPartie } from './index';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { emptyScene } from './monde/scene';
import { flowFromEffects } from './monde/flow';
import { evaluateTest } from '../engine/tests';
import { itemFromTrappingById } from '../engine/items';

const ENTREES: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: true, persisterLeHeros: () => {} };

/** Un établi dont l'action `ouvrager` teste la Dextérité au marteau (`trappingId` du catalogue) avec `requireSL` ; le
 *  héros porte un marteau de qualité `qualite` (aucun marteau à `null`). Branche de réussite → drapeau `reussi`, d'échec
 *  → `rate`. Le Test est lancé, sauf `lancer: false`, sur la partie ouverte aux `entrees`. */
function partieALEtabli(qualite: 'pratique' | 'peu-fiable' | 'bacle' | null, requireSL: number, { lancer = true, entrees = ENTREES } = {}) {
  const scene = { ...emptyScene('atelier', 4, 4), id: 'atelier' };
  scene.entities.push({
    id: 'etabli', kind: 'prop', pos: { x: 1, y: 0 }, label: 'Établi',
    usable: { actions: [{ id: 'ouvrager', label: 'Ouvrager', flow: {
      kind: 'test', test: { characteristic: 'dexterite', difficulty: 'intermediaire', tool: 'marteau', requireSL },
      reussite: flowFromEffects([{ type: 'setFlag', flag: 'reussi', value: true }]),
      echec: flowFromEffects([{ type: 'setFlag', flag: 'rate', value: true }]),
    } }] },
  } as never);
  const [h] = tousLesHerosDeScenario(idsDeTest);
  const marteaux = qualite ? [{ ...itemFromTrappingById('marteau', idsDeTest)!, qualities: [{ id: qualite }] }] : [];
  const hero = { ...h, pos: { x: 0, y: 0 }, items: [...(h.items ?? []), ...marteaux] };
  const partie = creerPartie({ ...etatInitialDuJeu(), party: [hero], scene, flags: {} }, entrees);
  partie.envoyer({ type: 'jouerAction', args: ['etabli', 'ouvrager'] });
  if (lancer) partie.envoyer({ type: 'jetLancer', args: ['test'] });
  return partie;
}

/** Le dé réussi à `dr` DR contre la cible `cible`, ni double ni réussite automatique. */
const deADR = (cible: number, dr: number): number => [cible - 10 * dr, cible - 10 * dr - 1].find((d) => d % 11 !== 0 && d > 5)!;

/** Le marteau du héros de la partie. */
const marteauDe = (partie: ReturnType<typeof partieALEtabli>) => partie.etat().party[0].items!.find((i) => i.trappingId === 'marteau')!;

describe('l’outil d’un Test de scène compte à son dé imposé (LDB 60 l.22, l.50, l.58)', () => {
  it('Pratique : un d100 réussi sous le seuil d’un DR se repêche, sur la ligne, le pending et la branche', () => {
    const partie = partieALEtabli('pratique', 1);
    try {
      const cible = partie.etat().pendingTest!.target;
      const de = deADR(cible, 0);
      expect(evaluateTest(de, cible)).toMatchObject({ success: true, sl: 0 });
      partie.envoyer({ type: 'jetImposerLeResultat', args: ['test', de] });
      expect(partie.etat().pendingTest).toMatchObject({ roll: de, sl: 1, success: true });
      const [ligne] = jetsEnVue(partie.etat())[0].lignes;
      expect(ligne.jet).toMatchObject({ d100: de, dr: 1, reussi: true, verdict: 'reussite' });
      expect(ligne).toMatchObject({ modsDR: [{ label: 'Pratique', famille: 'jet', value: 1, ref: { category: 'qualities', id: 'pratique' } }] });
      partie.envoyer({ type: 'jetValider', args: ['test'] });
      expect(partie.etat().flags).toMatchObject({ reussi: true });
      expect(partie.etat().flags.rate).toBeUndefined();
    } finally {
      partie.fermer();
    }
  });

  it('Pratique : un d100 raté reste raté, à son DR +1', () => {
    const partie = partieALEtabli('pratique', 0);
    try {
      const cible = partie.etat().pendingTest!.target;
      const de = cible + 21;
      const brut = evaluateTest(de, cible);
      expect(brut.success).toBe(false);
      partie.envoyer({ type: 'jetImposerLeResultat', args: ['test', de] });
      expect(partie.etat().pendingTest).toMatchObject({ roll: de, sl: brut.sl + 1, success: false });
      expect(jetsEnVue(partie.etat())[0].lignes[0].jet).toMatchObject({ d100: de, dr: brut.sl + 1, reussi: false });
      partie.envoyer({ type: 'jetValider', args: ['test'] });
      expect(partie.etat().flags).toMatchObject({ rate: true });
    } finally {
      partie.fermer();
    }
  });

  it('Peu Fiable : un d100 raté perd un DR, sur la ligne et le pending, et suit la branche d’échec', () => {
    const partie = partieALEtabli('peu-fiable', 0);
    try {
      const cible = partie.etat().pendingTest!.target;
      const de = cible + 21;
      const brut = evaluateTest(de, cible);
      expect(brut.success).toBe(false);
      partie.envoyer({ type: 'jetImposerLeResultat', args: ['test', de] });
      expect(partie.etat().pendingTest).toMatchObject({ roll: de, sl: brut.sl - 1, success: false });
      expect(jetsEnVue(partie.etat())[0].lignes[0].jet).toMatchObject({ d100: de, dr: brut.sl - 1, reussi: false, verdict: 'echec' });
      partie.envoyer({ type: 'jetValider', args: ['test'] });
      expect(partie.etat().flags).toMatchObject({ rate: true });
      expect(partie.etat().flags.reussi).toBeUndefined();
    } finally {
      partie.fermer();
    }
  });

  it('Chance avec Peu Fiable : le +1 DR repart du DR d’avant l’outil, et l’outil ne compte plus au Test réussi', () => {
    const partie = partieALEtabli('peu-fiable', 2);
    try {
      const cible = partie.etat().pendingTest!.target;
      const de = deADR(cible, 1);
      expect(evaluateTest(de, cible)).toMatchObject({ success: true, sl: 1 });
      partie.envoyer({ type: 'jetImposerLeResultat', args: ['test', de] });
      expect(partie.etat().pendingTest).toMatchObject({
        roll: de, sl: 0, success: false, modsDR: [{ label: 'Peu Fiable', famille: 'jet', value: -1, ref: { category: 'qualities', id: 'peu-fiable' } }],
      });
      partie.envoyer({ type: 'jetAjouterUnDR', args: ['test'] });
      expect(partie.etat().pendingTest).toMatchObject({ roll: de, sl: 2, success: true });
      expect(partie.etat().pendingTest!.modsDR).toBeUndefined();
      expect(jetsEnVue(partie.etat())[0].lignes[0]).not.toHaveProperty('modsDR');
      partie.envoyer({ type: 'jetValider', args: ['test'] });
      expect(partie.etat().flags).toMatchObject({ reussi: true });
      expect(partie.etat().flags.rate).toBeUndefined();
    } finally {
      partie.fermer();
    }
  });

  it('Bâclé : un dé imposé double et raté brise l’outil (LDB 60 l.50)', () => {
    const partie = partieALEtabli('bacle', 0);
    try {
      const cible = partie.etat().pendingTest!.target;
      const de = [22, 33, 44, 55, 66, 77, 88].find((d) => d > cible)!;
      expect(evaluateTest(de, cible)).toMatchObject({ success: false, isDouble: true });
      partie.envoyer({ type: 'jetImposerLeResultat', args: ['test', de] });
      expect(partie.etat().pendingTest).toMatchObject({ roll: de, success: false, isDouble: true });
      partie.envoyer({ type: 'jetValider', args: ['test'] });
      expect(marteauDe(partie).destroyed).toBe(true);
      expect(partie.etat().journal.some((l) => l.includes('se brise'))).toBe(true);
    } finally {
      partie.fermer();
    }
  });

  it('jet naturel : Pratique repêche un d100 réussi sous le seuil d’un DR', () => {
    const partie = partieALEtabli('pratique', 1, { entrees: { ...ENTREES, graine: 9, desFixes: false } });
    try {
      const pose = partie.etat().pendingTest!;
      expect({ roll: pose.roll, target: pose.target }).toEqual({ roll: 20, target: 27 });
      expect(evaluateTest(20, 27)).toMatchObject({ success: true, sl: 0 });
      expect(pose).toMatchObject({ sl: 1, success: true, modsDR: [{ label: 'Pratique', value: 1, ref: { category: 'qualities', id: 'pratique' } }] });
      partie.envoyer({ type: 'jetValider', args: ['test'] });
      expect(partie.etat().flags).toMatchObject({ reussi: true });
      expect(partie.etat().flags.rate).toBeUndefined();
    } finally {
      partie.fermer();
    }
  });

  for (const qualite of [null, 'pratique', 'peu-fiable'] as const) {
    it(`Résilience puis dé choisi, ${qualite ?? 'sans outil'} : la réussite achetée tient au seuil (LDB 17 l.68)`, () => {
      const partie = partieALEtabli(qualite, 3, { lancer: false });
      try {
        partie.envoyer({ type: 'jetForcerLaReussite', args: ['test'] });
        const cible = partie.etat().pendingTest!.target;
        partie.envoyer({ type: 'jetImposerLeResultat', args: ['test', cible - 1] });
        const pt = partie.etat().pendingTest!;
        expect(pt).toMatchObject({ roll: cible - 1, success: true, forcee: true });
        expect(pt.sl).toBeGreaterThanOrEqual(3);
        expect(pt.modsDR).toBeUndefined();
        partie.envoyer({ type: 'jetValider', args: ['test'] });
        expect(partie.etat().flags).toMatchObject({ reussi: true });
        expect(partie.etat().flags.rate).toBeUndefined();
      } finally {
        partie.fermer();
      }
    });
  }

  it('Peu Fiable : la Résilience après un jet raté retire la ligne d’outil', () => {
    const partie = partieALEtabli('peu-fiable', 0);
    try {
      const cible = partie.etat().pendingTest!.target;
      partie.envoyer({ type: 'jetImposerLeResultat', args: ['test', cible + 21] });
      expect(partie.etat().pendingTest).toMatchObject({ success: false, modsDR: [{ value: -1, ref: { category: 'qualities', id: 'peu-fiable' } }] });
      partie.envoyer({ type: 'jetForcerLaReussite', args: ['test'] });
      expect(partie.etat().pendingTest).toMatchObject({ success: true, forcee: true });
      expect(partie.etat().pendingTest!.modsDR).toBeUndefined();
      expect(jetsEnVue(partie.etat())[0].lignes[0]).not.toHaveProperty('modsDR');
    } finally {
      partie.fermer();
    }
  });
});
