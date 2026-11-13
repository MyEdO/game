/**
 * #2907 L1 : une LECTURE ne forge aucun id. L'affichage du butin, l'aperçu de création, la recomposition de
 * l'équipement et le lancement d'un scénario laissent la source des ids d'objet et de héros là où ils l'ont trouvée ;
 * l'arme re-dérivée d'une source garde son uid, que le choix d'arme d'une attaque en attente désigne.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, expect, it } from 'vitest';
import { giveTrappingQualities, itemFromTrappingById, recomputeLoadout } from '../engine/items';
import { attachMutation } from '../engine/corruption';
import { makeRNG } from '../engine/dice';
import { mutationById } from '../data/mutations';
import { herosDeScenario } from '../scenes/test-scenarios/_heros';
import { apercuDuHeros } from './creation/brouillon';
import { brouillonComplet } from './creation/engagement.testkit';
import { rubriquesDeLaPage } from './creation/vueDeLaCreation';
import { pickAttackWeaponList } from './mount';
import { rejouer } from '../hoteTexte/partieTexte';
import { nouvelEntete } from '../hote/partie';
import { ouvrirLeBanc } from './banc.testkit';

/** Ids consommés au compteur de la partie (`prochainId`, #2907) par `lecture`. */
const idsConsommesPar = (lecture: () => void): number => {
  const banc = ouvrirLeBanc();
  const avant = banc.getState().prochainId;
  lecture();
  return banc.getState().prochainId - avant;
};

describe('une lecture ne forge aucun id (#2907)', () => {
  it('les qualités d’un butin (`giveTrappingQualities`)', () => {
    expect(idsConsommesPar(() => giveTrappingQualities({ trappingId: 'dague', qualities: ['magique'] }))).toBe(0);
  });

  it('l’aperçu de création (`apercuDuHeros`, page de présentation)', () => {
    const lecture = () => {
      apercuDuHeros(brouillonComplet('Aperçu'));
      rubriquesDeLaPage(brouillonComplet('Aperçu'), 'presentation');
    };
    expect(idsConsommesPar(lecture)).toBe(0);
  });

  it('la recomposition de l’équipement d’un porteur d’arme naturelle (`recomputeLoadout`)', () => {
    const c = herosDeScenario(idsDeTest, 'soldat');
    attachMutation(c, mutationById('griffes')!, makeRNG(1));
    recomputeLoadout(c);
    expect(c.weapons.some((w) => w.natural)).toBe(true);
    expect(idsConsommesPar(() => recomputeLoadout(c))).toBe(0);
  });

  it('le lancement d’un scénario : chaque id consommé depuis la partie neuve est porté par l’état', () => {
    const r = rejouer(nouvelEntete('dome', { graine: 7 }), []);
    try {
      const consommes = r.partie.etat().prochainId - 1;
      const portes = new Set<number>();
      JSON.stringify(r.partie.etat(), (_k, v: unknown) => {
        const n = typeof v === 'string' ? /(?:^|-)(?:it|hero|pos|favor)-(\d+)$/.exec(v) : null;
        if (n && Number(n[1]) <= consommes) portes.add(Number(n[1]));
        return v;
      });
      expect(consommes).toBeGreaterThan(0);
      expect(portes.size).toBe(consommes);
    } finally {
      r.partie.fermer();
    }
  });
});

describe('l’arme re-dérivée garde son uid (#2907)', () => {
  it('l’arme naturelle choisie par uid se retrouve après `recomputeLoadout`', () => {
    const c = herosDeScenario(idsDeTest, 'soldat');
    attachMutation(c, mutationById('griffes')!, makeRNG(1));
    recomputeLoadout(c);
    const choisie = c.weapons.find((w) => w.natural)!;
    recomputeLoadout(c);
    expect(pickAttackWeaponList(null, undefined, c, herosDeScenario(idsDeTest, 'tueur'), choisie.uid).uid).toBe(choisie.uid);
  });

  it('l’arme dérivée d’un objet porté (Crochet, LDB 73) a un uid propre, stable, retrouvé après `recomputeLoadout`', () => {
    const c = herosDeScenario(idsDeTest, 'soldat');
    const crochet = { ...itemFromTrappingById('crochet', idsDeTest)!, equipped: true };
    c.items = [...(c.items ?? []), crochet];
    recomputeLoadout(c);
    const derivee = c.weapons.find((w) => w.derivedFromItem === crochet.uid)!;
    expect(derivee.uid).toBeDefined();
    expect(derivee.uid).not.toBe(crochet.uid);
    recomputeLoadout(c);
    expect(c.weapons.find((w) => w.derivedFromItem === crochet.uid)?.uid).toBe(derivee.uid);
    expect(pickAttackWeaponList(null, undefined, c, herosDeScenario(idsDeTest, 'tueur'), derivee.uid).uid).toBe(derivee.uid);
  });
});
