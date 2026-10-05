/**
 * Phase 0 — fondation inventaire RAW : généralisation de l'état « porté » aux accessoires
 * (LDB 61 l.21 : objet porté → Enc −1) + modèle de CONTENANTS (LDB 64 l.5 : le contenu rangé
 * est absorbé par le contenant et ne compte plus au total ; seul l'Enc du contenant compte).
 */
import { describe, it, expect } from 'vitest';
import { totalEncumbrance, containerFillEnc, canStow, defaultContainerFor } from './items';
import type { Combatant, ItemInstance } from './types';
import { objetDeTest, type SurchargeDObjet } from './objetDeTest.testkit';

const mk = (items: ItemInstance[]): Combatant => ({ items } as unknown as Combatant);
const item = (o: SurchargeDObjet): ItemInstance =>
  objetDeTest({ uid: o.uid ?? 'x', trappingId: 'corde', ...o });

describe('Encombrement — objet PORTÉ (accessoire) : LDB 61 l.21', () => {
  it('un accessoire misc porté (equipped) voit son Enc réduit de 1', () => {
    // Cape Enc1 portée → 0 ; en vrac → 1.
    const cape = item({ uid: 'cape', trappingId: 'cape', enc: 1, subType: 'vetements-et-accessoires' });
    expect(totalEncumbrance(mk([{ ...cape, equipped: true }]))).toBe(0);
    expect(totalEncumbrance(mk([{ ...cape, equipped: false }]))).toBe(1);
  });

  it('des bésicles Enc0 portées restent à 0 (max(0, 0−1) = 0)', () => {
    const besicles = item({ uid: 'b', trappingId: 'besicles', enc: 0, equipped: true, subType: 'vetements-et-accessoires' });
    expect(totalEncumbrance(mk([besicles]))).toBe(0);
  });

  it('un objet en vrac (ni porté ni rangé) compte son Enc plein', () => {
    const corde = item({ uid: 'c', trappingId: 'corde', enc: 1 });
    expect(totalEncumbrance(mk([corde]))).toBe(1);
  });
});

describe('Encombrement — CONTENANTS : LDB 64 l.5', () => {
  it('un objet rangé DANS un contenant ne compte pas ; seul l’Enc du contenant compte', () => {
    const sac = item({ uid: 'sac', trappingId: 'sac', enc: 2, container: { capacity: 4 } });
    const corde = item({ uid: 'corde', trappingId: 'corde', enc: 1, inside: 'sac' });
    const torches = item({ uid: 'torches', trappingId: 'lanterne', enc: 2, inside: 'sac' });
    // Sac 2 (compte) + corde 1 (absorbée) + torches 2 (absorbées) → 2.
    expect(totalEncumbrance(mk([sac, corde, torches]))).toBe(2);
  });

  it('containerFillEnc somme l’Enc des objets rangés dedans', () => {
    const sac = item({ uid: 'sac', enc: 2, container: { capacity: 4 } });
    const corde = item({ uid: 'corde', enc: 1, inside: 'sac' });
    const torches = item({ uid: 'torches', enc: 2, inside: 'sac' });
    expect(containerFillEnc(mk([sac, corde, torches]), 'sac')).toBe(3);
  });

  it('canStow accepte tant que le Contenu restant suffit, refuse au-delà de la capacité', () => {
    const sac = item({ uid: 'sac', enc: 2, container: { capacity: 4 } });
    const dejaDedans = item({ uid: 'd', enc: 3, inside: 'sac' }); // remplissage 3 / capacité 4
    const c = mk([sac, dejaDedans]);
    const petit = item({ uid: 'petit', enc: 1 }); // 3 + 1 = 4 ≤ 4 → ok
    const gros = item({ uid: 'gros', enc: 2 }); //  3 + 2 = 5 > 4 → refus
    expect(canStow(c, petit, 'sac')).toBe(true);
    expect(canStow(c, gros, 'sac')).toBe(false);
  });

  it('canStow refuse de ranger un contenant dans un autre (pas d’imbrication) et de s’auto-ranger', () => {
    const sac = item({ uid: 'sac', enc: 2, container: { capacity: 4 } });
    const besace = item({ uid: 'besace', enc: 1, container: { capacity: 2 } });
    const c = mk([sac, besace]);
    expect(canStow(c, besace, 'sac')).toBe(false); // un sac dans un sac
    expect(canStow(c, sac, 'sac')).toBe(false); // s'auto-ranger
  });

  it('canStow refuse un contenant cible inexistant ou sans capacité', () => {
    const sac = item({ uid: 'sac', enc: 2, container: { capacity: 4 } });
    const objet = item({ uid: 'o', enc: 1 });
    expect(canStow(mk([sac, objet]), objet, 'inconnu')).toBe(false);
    const nonSac = item({ uid: 'nonSac', enc: 1 }); // pas de container
    expect(canStow(mk([nonSac, objet]), objet, 'nonSac')).toBe(false);
  });
});

describe('defaultContainerFor — rangement par défaut d’un objet acquis (#204)', () => {
  it('rend le contenant avec le PLUS de place LIBRE parmi ceux compatibles', () => {
    const petitSac = item({ uid: 'petit', enc: 1, container: { capacity: 3 } }); // libre 3
    const grandSac = item({ uid: 'grand', enc: 1, container: { capacity: 6 } }); // libre 6
    const dedans = item({ uid: 'd', enc: 2, inside: 'grand' }); // grand : libre 4
    const c = mk([petitSac, grandSac, dedans]);
    const trouve = item({ uid: 'nouveau', enc: 1 });
    expect(defaultContainerFor(c, trouve)).toBe('grand'); // 3 libre vs 4 libre
  });

  it('null si aucun contenant ne peut l’accueillir (aucun sac, ou tous pleins)', () => {
    const sansSac = mk([item({ uid: 'o', enc: 1 })]);
    expect(defaultContainerFor(sansSac, item({ uid: 'n', enc: 1 }))).toBeNull();

    const pleinSac = item({ uid: 'sac', enc: 1, container: { capacity: 2 } });
    const dedans = item({ uid: 'd', enc: 2, inside: 'sac' }); // 0 libre
    const c = mk([pleinSac, dedans]);
    expect(defaultContainerFor(c, item({ uid: 'trop-gros', enc: 1 }))).toBeNull();
  });

  it('ne range jamais un contenant DANS un autre contenant (canStow refuse l’imbrication)', () => {
    const sac = item({ uid: 'sac', enc: 1, container: { capacity: 6 } });
    const besace = item({ uid: 'besace', enc: 1, container: { capacity: 2 } }); // objet lui-même un contenant
    const c = mk([sac, besace]);
    expect(defaultContainerFor(c, besace)).toBeNull();
  });

  it('départage déterministe à égalité : le PREMIER contenant rencontré (ordre de c.items)', () => {
    const sacA = item({ uid: 'a', enc: 1, container: { capacity: 4 } }); // libre 4
    const sacB = item({ uid: 'b', enc: 1, container: { capacity: 4 } }); // libre 4 (égalité)
    const c = mk([sacA, sacB]);
    expect(defaultContainerFor(c, item({ uid: 'n', enc: 1 }))).toBe('a');
  });
});

describe('Encombrement — régressions préservées', () => {
  it('une prothèse PORTÉE compte Enc 0 (LDB 73)', () => {
    const jambe = item({ uid: 'j', trappingId: 'fausse-jambe', enc: 1, subType: 'protheses', equipped: true });
    expect(totalEncumbrance(mk([jambe]))).toBe(0);
  });

  it('une armure portée voit aussi son Enc réduit de 1', () => {
    const cuir = item({ uid: 'a', trappingId: 'veste-de-cuir', kind: 'armor', enc: 1, equipped: true });
    expect(totalEncumbrance(mk([cuir]))).toBe(0);
  });
});
