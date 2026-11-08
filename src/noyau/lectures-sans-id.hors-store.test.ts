/**
 * #2907 L1 : une LECTURE ne forge aucun id. L'affichage du butin, l'aperçu de création, la recomposition de
 * l'équipement et le lancement d'un scénario laissent la source des ids d'objet et de héros là où ils l'ont trouvée ;
 * l'arme re-dérivée d'une source garde son uid, que le choix d'arme d'une attaque en attente désigne.
 */
import { describe, expect, it } from 'vitest';
import { giveTrappingQualities, itemFromTrappingById, newUid, recomputeLoadout } from '../engine/items';
import { attachMutation } from '../engine/corruption';
import { makeRNG } from '../engine/dice';
import { mutationById } from '../data/mutations';
import { pregen, PREGEN } from '../data/pregens';
import { apercuDuHeros } from './creation/brouillon';
import { engagement } from './creation/engagement';
import { brouillonComplet } from './creation/engagement.testkit';
import { rubriquesDeLaPage } from './creation/vueDeLaCreation';
import { pickAttackWeaponList } from './mount';
import { rejouer } from '../hoteTexte/partieTexte';
import { nouvelEntete } from '../hote/partie';

const numero = (id: string): number => Number(/(\d+)$/.exec(id)![1]);
/** Ids consommés à la source des uids d'objet par `lecture` (la sonde `newUid` en prend un de chaque côté). */
const uidsConsommesPar = (lecture: () => void): number => {
  const avant = numero(newUid());
  lecture();
  return numero(newUid()) - avant - 1;
};
/** Ids de héros neufs consommés par `lecture`, entre deux engagements sans id posé. */
const herosConsommesPar = (lecture: () => void): number => {
  const avant = numero(engagement(brouillonComplet('Avant')).hero.id);
  lecture();
  return numero(engagement(brouillonComplet('Après')).hero.id) - avant - 1;
};

describe('une lecture ne forge aucun id (#2907)', () => {
  it('les qualités d’un butin (`giveTrappingQualities`)', () => {
    expect(uidsConsommesPar(() => giveTrappingQualities({ trappingId: 'dague', qualities: ['magique'] }))).toBe(0);
  });

  it('l’aperçu de création (`apercuDuHeros`, page de présentation)', () => {
    const lecture = () => {
      apercuDuHeros(brouillonComplet('Aperçu'));
      rubriquesDeLaPage(brouillonComplet('Aperçu'), 'presentation');
    };
    expect(uidsConsommesPar(lecture)).toBe(0);
    expect(herosConsommesPar(lecture)).toBe(0);
  });

  it('la recomposition de l’équipement d’un porteur d’arme naturelle (`recomputeLoadout`)', () => {
    const c = pregen(PREGEN.soldat);
    attachMutation(c, mutationById('griffes')!, makeRNG(1));
    recomputeLoadout(c);
    expect(c.weapons.some((w) => w.natural)).toBe(true);
    expect(uidsConsommesPar(() => recomputeLoadout(c))).toBe(0);
  });

  it('le lancement d’un scénario : chaque uid consommé depuis la partie neuve est porté par un objet de l’état', () => {
    const r = rejouer(nouvelEntete('dome', { graine: 7 }), []);
    try {
      const consommes = numero(newUid()) - 1;
      const portes = new Set<number>();
      JSON.stringify(r.partie.etat(), (_k, v: unknown) => {
        const n = typeof v === 'string' ? /(?:^|-)it-(\d+)$/.exec(v) : null;
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
    const c = pregen(PREGEN.soldat);
    attachMutation(c, mutationById('griffes')!, makeRNG(1));
    recomputeLoadout(c);
    const choisie = c.weapons.find((w) => w.natural)!;
    recomputeLoadout(c);
    expect(pickAttackWeaponList(undefined, c, pregen(PREGEN.tueur), choisie.uid).uid).toBe(choisie.uid);
  });

  it('l’arme dérivée d’un objet porté (Crochet, LDB 73) a un uid propre, stable, retrouvé après `recomputeLoadout`', () => {
    const c = pregen(PREGEN.soldat);
    const crochet = { ...itemFromTrappingById('crochet')!, equipped: true };
    c.items = [...(c.items ?? []), crochet];
    recomputeLoadout(c);
    const derivee = c.weapons.find((w) => w.derivedFromItem === crochet.uid)!;
    expect(derivee.uid).toBeDefined();
    expect(derivee.uid).not.toBe(crochet.uid);
    recomputeLoadout(c);
    expect(c.weapons.find((w) => w.derivedFromItem === crochet.uid)?.uid).toBe(derivee.uid);
    expect(pickAttackWeaponList(undefined, c, pregen(PREGEN.tueur), derivee.uid).uid).toBe(derivee.uid);
  });
});
