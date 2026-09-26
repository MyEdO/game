/**
 * #61 — Équipement des ogres (ADE II 2 l.600-703) + fidélité des 4 PNJ ogres nommés (ADE II 1 l.217/231 / ADE II 2 l.484/492).
 * La table « Armes à distance des ogres » du .md étant mutilée par l'extraction, les valeurs ont été
 * reconstituées depuis le PDF (p.29) — ce test fige les stats imprimées.
 */
import { describe, it, expect } from 'vitest';
import { findTrappingById, findCreatureById } from './index';
import { itemFromTrappingById } from '../engine/items';

const q = (id: string) => findTrappingById(id)!;
const qualIds = (id: string) => q(id).qualities.map((x) => x.id).sort();

describe('#61 — armes de corps à corps des ogres (ADE II 2 l.607-615)', () => {
  it('Massue ogre : 1 CO, Enc 2, Commune, Moyenne, BF+4 (personnalisation en desc)', () => {
    const e = q('massue-ogre');
    expect(e.price).toEqual({ gold: 1, silver: 0, brass: 0 });
    expect(e.enc).toBe(2);
    expect(e.availability).toBe('Commune'); // « Courante » (ADE II) → enum de la donnée
    expect(e.reach).toBe('Moyenne');
    expect(e.damage).toEqual({ plusBF: true, flat: 4 });
  });
  it('Poing de fer : BF+3, Défensive + Protectrice 1, Courte', () => {
    const e = q('poing-de-fer');
    expect(e.damage).toEqual({ plusBF: true, flat: 3 });
    expect(e.qualities).toEqual([{ id: 'defensive' }, { id: 'protectrice', value: 1 }]);
  });
  it('Grande massue ogre : (2M), BF+6, Dévastatrice, Longue', () => {
    const e = q('grande-massue-ogre');
    expect(e.hands).toBe(2);
    expect(e.damage).toEqual({ plusBF: true, flat: 6 });
    expect(qualIds('grande-massue-ogre')).toEqual(['devastatrice']);
  });
});

describe('#61 — armes à distance des ogres (ADE II 2 l.619-631, reconstituées du PDF)', () => {
  it('Lance-harpon : 8 CO, Enc 5, Exotique, Portée 20, +10, Entraves (→ Immobilisante) + Recharge 2', () => {
    const e = q('lance-harpon');
    expect(e.subType).toBe('entraves');
    expect(e.range).toBe(20);
    expect(e.damage).toEqual({ plusBF: false, flat: 10 });
    expect(e.qualities).toEqual([{ id: 'immobilisante' }, { id: 'recharge', value: 2 }]);
  });
  it('Piège à chaînes : Portée BF×2, +7, Immobilisante', () => {
    const e = q('piege-a-chaines');
    expect(e.range).toEqual({ bf: 2 });
    expect(e.damage).toEqual({ plusBF: false, flat: 7 });
    expect(qualIds('piege-a-chaines')).toEqual(['immobilisante']);
  });
  it('Grande lance : Lancer, BF×3, BF+4, Empaleuse', () => {
    const e = q('grande-lance');
    expect(e.subType).toBe('lancer');
    expect(e.range).toEqual({ bf: 3 });
    expect(e.damage).toEqual({ plusBF: true, flat: 4 });
    expect(qualIds('grande-lance')).toEqual(['empaleuse']);
  });
  it('Canon crache-plomb : (2M), 14 CO, Portée 50, +10, Dangereuse + Recharge 5', () => {
    const e = q('canon-crache-plomb');
    expect(e.hands).toBe(2);
    expect(e.range).toBe(50);
    expect(e.qualities).toEqual([{ id: 'dangereuse' }, { id: 'recharge', value: 5 }]);
  });
  it('Pistolet ogre : Portée 20, +8, Pistolet + Recharge 1 (Atouts imprimés SEULS — pas d\'analogie LDB)', () => {
    const e = q('pistolet-ogre');
    expect(e.range).toBe(20);
    expect(e.damage).toEqual({ plusBF: false, flat: 8 });
    expect(e.qualities).toEqual([{ id: 'pistolet' }, { id: 'recharge', value: 1 }]);
  });
});

describe('#61 — munitions & armure des ogres (ADE II 2 l.635-652)', () => {
  it('Harpon (6) : Empaleuse, portée comme l\'arme (pas d\'ammoRangeMod)', () => {
    const e = q('harpon');
    expect(e.packSize).toBe(6);
    expect(e.categorie).toBe('ammunition');
    expect(qualIds('harpon')).toEqual(['empaleuse']);
    expect(e.ammoRangeMod).toBeUndefined();
  });
  it('Balle crache-plomb (12) : Explosion 3, moitié de la portée de l\'arme', () => {
    const e = q('balle-crache-plomb');
    expect(e.packSize).toBe(12);
    expect(e.qualities).toEqual([{ id: 'a-explosion', value: 3 }]);
    expect(e.ammoRangeMod).toEqual({ mult: 0.5 });
  });
  it('Boulet crache-plomb (1) : +4, Empaleuse + Percutante + Perforante', () => {
    const e = q('boulet-crache-plomb');
    expect(e.damage).toEqual({ plusBF: false, flat: 4 });
    expect(qualIds('boulet-crache-plomb')).toEqual(['empaleuse', 'percutante', 'perforante']);
  });
  it('Pansière ogre : Plate, Corps, 3 PA, Impénétrable, 20 CO', () => {
    const e = q('pansiere-ogre');
    expect(e.subType).toBe('plate');
    expect(e.loc).toBe('Corps');
    expect(e.pa).toBe(3);
    expect(qualIds('pansiere-ogre')).toEqual(['impenetrable']);
    expect(e.price).toEqual({ gold: 20, silver: 0, brass: 0 });
  });
  it('les 12 objets se construisent en ItemInstance (qualités du registre, aucune inconnue)', () => {
    for (const id of ['massue-ogre', 'poing-de-fer', 'grande-massue-ogre', 'lance-harpon', 'piege-a-chaines', 'grande-lance', 'canon-crache-plomb', 'pistolet-ogre', 'harpon', 'balle-crache-plomb', 'boulet-crache-plomb', 'pansiere-ogre']) {
      expect(itemFromTrappingById(id), id).toBeTruthy();
    }
  });
});

describe('#61 — les 4 PNJ ogres nommés (ADE II 1 l.217/231 / ADE II 2 l.484/492)', () => {
  it('Isrogdal : « Combat déloyal 2 » (l.227) porté par TalentRef.times', () => {
    const tal = findCreatureById('isrogdal-lempresse')!.talents!.find((t) => t.id === 'combat-deloyal') as { id: string; times?: number };
    expect(tal.times).toBe(2);
  });
  it('les Possessions imprimées sont encodées et résolvent (Isrogdal l.229, Ugrik l.245, Nazzaalta l.515, Artur l.533)', () => {
    for (const cid of ['isrogdal-lempresse', 'ugrik-legaree', 'nazzaalta-affabule', 'artur-piedmarteau']) {
      const c = findCreatureById(cid)!;
      expect(c.trappings!.length, cid).toBeGreaterThan(0);
      for (const tr of c.trappings!) {
        if ('id' in tr) expect(itemFromTrappingById(tr.id as string), `${cid} → ${(tr as { id: string }).id}`).toBeTruthy();
      }
    }
  });
  it('Isrogdal porte la pansière ogre et sa massue ogre (réfs par id, plus des [] vides)', () => {
    const ids = findCreatureById('isrogdal-lempresse')!.trappings!.filter((t) => 'id' in t).map((t) => (t as { id: string }).id);
    expect(ids).toContain('pansiere-ogre');
    expect(ids).toContain('massue-ogre');
    expect(ids).toContain('coup-de-poing');
  });
  it('Golgfag / Hrothyogg : PAS de statbloc en VF (prose seule, ADE II 1 l.198/210) → absents du bestiaire (règle 1)', () => {
    expect(findCreatureById('golgfag-mangehomme')).toBeUndefined();
    expect(findCreatureById('capitaine-hrothyogg')).toBeUndefined();
  });
});
