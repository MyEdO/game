/**
 * LES EMPLACEMENTS DE SAUVEGARDE sur le `Stockage` d'un hôte (#3041) : écrire, lire, lister, retirer ; une save
 * d'un autre format ou illisible est retirée à la lecture et son retrait CUMULÉ dans le témoin du même stockage
 * (#2404), pris une fois. Un stockage absent ou qui lève ne casse aucun geste.
 */
import { describe, it, expect } from 'vitest';
import {
  AUTO_SLOT, ecrireLaSauvegarde, lireLaSauvegarde, listerLesSauvegardes, prendreLesRetraitsDeSauvegardes,
  retirerLaSauvegarde,
} from './sauvegardes';
import { etatInitialDuJeu, snapshotSave, type SaveGame } from '../noyau/index';
import type { Stockage } from '../lib/stockage';
import { stockageEnMemoire, stockageQuiLeve } from '../lib/stockage.testkit';

/** Un `Stockage` plein : l'écriture ne prend pas, sans lever. */
const plein: Stockage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };

/** La clé persistée de l'emplacement `slot` : le format du stockage d'un joueur. */
const cleDEmplacement = (slot: number | typeof AUTO_SLOT): string => `wfrp4.save.${slot}`;

const save = (): SaveGame => snapshotSave(etatInitialDuJeu(), '2026-10-27T00:00:00.000Z');
const autreFormat = (): string => JSON.stringify({ ...save(), version: 'autre-format' });

describe('les emplacements de sauvegarde sur un stockage', () => {
  it('écrire puis lire rend la save ; lister la voit ; retirer vide l’emplacement', () => {
    const s = stockageEnMemoire();
    expect(ecrireLaSauvegarde(s, 2, save())).toBe(true);
    expect(lireLaSauvegarde(s, 2)).toEqual(save());
    expect(listerLesSauvegardes(s).map((m) => m?.slot ?? null)).toEqual([null, 2, null]);
    retirerLaSauvegarde(s, 2);
    expect(lireLaSauvegarde(s, 2)).toBeNull();
    expect(prendreLesRetraitsDeSauvegardes(s)).toEqual([]);
  });

  it('quota plein, stockage qui lève ou absent : l’écriture rend `false`, la lecture `null`, sans lever', () => {
    expect(ecrireLaSauvegarde(plein, 1, save())).toBe(false);
    expect(ecrireLaSauvegarde(stockageQuiLeve, 1, save())).toBe(false);
    expect(ecrireLaSauvegarde(null, 1, save())).toBe(false);
    expect(lireLaSauvegarde(stockageQuiLeve, 1)).toBeNull();
    expect(listerLesSauvegardes(null)).toEqual([null, null, null]);
    expect(() => retirerLaSauvegarde(stockageQuiLeve, 1)).not.toThrow();
    expect(prendreLesRetraitsDeSauvegardes(stockageQuiLeve)).toEqual([]);
  });

  it('une save d’un autre format est jetée à la lecture, et son retrait témoigné une fois', () => {
    const s = stockageEnMemoire();
    s.setItem(cleDEmplacement(1), autreFormat());
    expect(lireLaSauvegarde(s, 1)).toBeNull();
    expect(s.contenu.has(cleDEmplacement(1))).toBe(false);
    expect(prendreLesRetraitsDeSauvegardes(s)).toEqual([{ slot: 1, cause: 'autreFormat' }]);
    expect(prendreLesRetraitsDeSauvegardes(s)).toEqual([]);
  });

  it('deux lectures qui jettent deux emplacements avant la prise : les deux retraits, dans l’ordre', () => {
    const s = stockageEnMemoire();
    s.setItem(cleDEmplacement(3), autreFormat());
    s.setItem(cleDEmplacement(AUTO_SLOT), 'pas du json');
    expect(lireLaSauvegarde(s, 3)).toBeNull();
    expect(lireLaSauvegarde(s, AUTO_SLOT)).toBeNull();
    expect(prendreLesRetraitsDeSauvegardes(s)).toEqual([{ slot: 3, cause: 'autreFormat' }, { slot: AUTO_SLOT, cause: 'illisible' }]);
  });

  it('un emplacement jeté, réécrit puis jeté de nouveau avant la prise : une seule entrée', () => {
    const s = stockageEnMemoire();
    s.setItem(cleDEmplacement(1), autreFormat());
    expect(lireLaSauvegarde(s, 1)).toBeNull();
    s.setItem(cleDEmplacement(1), 'pas du json');
    expect(lireLaSauvegarde(s, 1)).toBeNull();
    expect(prendreLesRetraitsDeSauvegardes(s)).toEqual([{ slot: 1, cause: 'autreFormat' }]);
  });
});
