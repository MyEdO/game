import { describe, it, expect, afterEach } from 'vitest';
import { makeRNG } from './dice';
import { AVAILABILITIES } from './types';
import {
  rollAvailability, rollStock, fullStock, dispoPct, type CatalogItem,
  barterRatio, barterRatios, availabilityAfterHalvings, priceAfterHalvings, availabilitySearchBonus,
  isTradable, outOfTradeReason,
} from './disponibilite';
import dispoJson from '../data/disponibilite.json';
import { setRule, resetRule } from './policy';

describe('disponibilite — Disponibilité RAW (LDB 59 l.13-34, p.290-291)', () => {
  it('table RAW : Limitée 30/60/90, Rare 15/30/45', () => {
    expect(dispoPct().Limitée).toEqual({ village: 30, ville: 60, cite: 90 });
    expect(dispoPct().Rare).toEqual({ village: 15, ville: 30, cite: 45 });
  });
  it('Commune → toujours en stock (sans Test)', () => {
    const r = rollAvailability('Commune', 'village', makeRNG(1));
    expect(r.inStock).toBe(true);
    expect(r.test).toBeUndefined();
    expect(r.qty).toBe(2); // base 1 × 2 (Commune)
  });
  it('Exotique → jamais en stock', () => {
    expect(rollAvailability('Exotique', 'cite', makeRNG(1)).inStock).toBe(false);
  });
  it('Limitée à la Ville : un seed réussit, un autre échoue ; Test exposé', () => {
    let win = -1, lose = -1;
    for (let s = 1; s < 50 && (win < 0 || lose < 0); s++) {
      const r = rollAvailability('Limitée', 'ville', makeRNG(s));
      if (r.inStock && win < 0) win = s;
      if (!r.inStock && lose < 0) lose = s;
    }
    expect(win).toBeGreaterThan(0);
    expect(lose).toBeGreaterThan(0);
    const r = rollAvailability('Limitée', 'ville', makeRNG(win));
    expect(r.test).toMatchObject({ target: 60 });
    expect(r.qty).toBeGreaterThanOrEqual(1); // Ville 1d10, Limitée = base
  });
  it('Rare en stock : quantité = ceil(base/2) (÷2 arrondi sup.)', () => {
    let s = 1;
    while (!rollAvailability('Rare', 'village', makeRNG(s)).inStock && s < 200) s++;
    expect(rollAvailability('Rare', 'village', makeRNG(s)).qty).toBe(1);
  });
  it('rollStock : déterministe (même seed → même stock), filtre Exotique, curaté forcé', () => {
    const cat: CatalogItem[] = [
      { id: 'epee', label: 'Épée', availability: 'Commune' },
      { id: 'arquebuse', label: 'Arquebuse', availability: 'Rare' },
      { id: 'clavecin', label: 'Clavecin', availability: 'Exotique' },
    ];
    const a = rollStock(cat, 'ville', makeRNG(7));
    const b = rollStock(cat, 'ville', makeRNG(7));
    expect(a).toEqual(b); // déterministe
    expect(a.find((l) => l.label === 'Épée')!.qty).toBeGreaterThan(0); // Commune toujours
    expect(a.find((l) => l.label === 'Clavecin')).toBeUndefined(); // Exotique exclu
    const withCurated = rollStock(cat, 'ville', makeRNG(7), ['clavecin']); // curated = ids stables
    expect(withCurated.find((l) => l.label === 'Clavecin')!.qty).toBeGreaterThan(0); // curaté forcé
  });
  it('fullStock (système simplifié, LDB 59 l.15) : tout sauf Exotique/null en stock sans Test', () => {
    const cat: CatalogItem[] = [
      { id: 'epee', label: 'Épée', availability: 'Commune' },
      { id: 'arquebuse', label: 'Arquebuse', availability: 'Rare' },
      { id: 'clavecin', label: 'Clavecin', availability: 'Exotique' },
      { id: 'nd', label: 'Inconnu', availability: null },
    ];
    const s = fullStock(cat, 'ville', makeRNG(7));
    expect(s.find((l) => l.label === 'Épée')!.qty).toBeGreaterThan(0);
    expect(s.find((l) => l.label === 'Arquebuse')!.qty).toBeGreaterThan(0); // Rare présente SANS Test de Disponibilité
    expect(s.every((l) => l.test === undefined)).toBe(true); // aucun Test de Disponibilité
    expect(s.find((l) => l.label === 'Clavecin')).toBeUndefined(); // Exotique exclu
    expect(s.find((l) => l.label === 'Inconnu')).toBeUndefined(); // availability nulle exclue
  });
});

describe('disponibilite — recherche active (LDB 59 l.50)', () => {
  it('availabilitySearchBonus : +10 par circonstance, plafonné à +20', () => {
    expect(availabilitySearchBonus({})).toBe(0);
    expect(availabilitySearchBonus({ coherentCareer: true })).toBe(10);
    expect(availabilitySearchBonus({ diligent: true, coherentCareer: true })).toBe(20);
    expect(availabilitySearchBonus({ diligent: true, coherentCareer: true, gossipDay: true })).toBe(20); // plafond
  });
  it('rollAvailability : +bonus élève la cible du Test (Rare Village 15 % → 35 % à +20)', () => {
    // Un seed qui échoue à 15 % mais réussit à 35 % prouve que le bonus a bougé la cible.
    let s = 1;
    for (; s < 300; s++) {
      const base = rollAvailability('Rare', 'village', makeRNG(s));
      const boosted = rollAvailability('Rare', 'village', makeRNG(s), 20);
      if (!base.inStock && boosted.inStock) break;
    }
    expect(s).toBeLessThan(300);
    expect(rollAvailability('Rare', 'village', makeRNG(s), 20).test).toMatchObject({ target: 35 }); // 15 + 20
  });
});

describe('disponibilite — Baisse des prix : Disponibilité acheteur (LDB 59 l.60-62)', () => {
  it('chaque division par deux monte la Disponibilité d’un cran (Exotique + 2 = Limitée)', () => {
    expect(availabilityAfterHalvings('Exotique', 0)).toBe('Exotique');
    expect(availabilityAfterHalvings('Exotique', 1)).toBe('Rare');
    expect(availabilityAfterHalvings('Exotique', 2)).toBe('Limitée'); // exemple canon (l.62)
    expect(availabilityAfterHalvings('Exotique', 5)).toBe('Commune'); // borné à Commune
    expect(availabilityAfterHalvings('Commune', 3)).toBe('Commune');
  });
  it('priceAfterHalvings : base ÷ 2^n (100 CO → 25 CO après 2 baisses)', () => {
    expect(priceAfterHalvings(240 * 100, 0)).toBe(240 * 100); // 100 CO en sous
    expect(priceAfterHalvings(240 * 100, 2)).toBe(240 * 25); // 100 CO ÷ 4 = 25 CO
  });
});

describe('disponibilite — Troc (LDB 59 l.64-76)', () => {
  it('table RATIOS DE TROC recopiée verbatim', () => {
    expect(barterRatios().Commune.Exotique).toEqual([8, 1]);
    expect(barterRatios().Exotique.Commune).toEqual([1, 8]);
    expect(barterRatios().Limitée.Rare).toEqual([2, 1]);
    expect(barterRatios().Rare.Limitée).toEqual([1, 2]);
  });
  it('barterRatio : 8 unités communes contre 1 exotique ; réflexivité même Disponibilité = 1:1', () => {
    expect(barterRatio('Commune', 'Exotique')).toEqual({ give: 8, get: 1 });
    expect(barterRatio('Exotique', 'Commune')).toEqual({ give: 1, get: 8 });
    expect(barterRatio('Rare', 'Rare')).toEqual({ give: 1, get: 1 });
  });
});

describe('disponibilite — donnée éditable (src/data/disponibilite.json, #366)', () => {
  it('chaque entrée migrée porte sa source (book + page)', () => {
    const entries = [...dispoJson.dispoPct, ...dispoJson.barterRatios];
    expect(entries.length).toBe(6); // 2 lignes de %, 4 lignes de troc
    for (const e of entries) {
      expect(e.source.book).toBe('livre-de-base');
      expect(typeof e.source.page).toBe('number');
      expect(e.source.page).toBeGreaterThan(0);
    }
  });
});

/**
 * Quantité en CITÉ — LDB 59 l.34 : « les cités en possèdent autant que le MJ le juge approprié ». Le RAW
 * ne chiffre rien : la valeur est MAISON, donc éditable comme les autres (règle `market-cite-stock`).
 */
describe('quantité en Cité — règle éditable `market-cite-stock` (LDB 59 l.34, non chiffré)', () => {
  afterEach(() => resetRule('market-cite-stock'));

  it('défaut 99 (stock pratiquement illimité), ×2 pour un objet Commun', () => {
    const cat: CatalogItem[] = [{ id: 'epee', label: 'Épée', availability: 'Commune' }];
    expect(fullStock(cat, 'cite', makeRNG(1))[0].qty).toBe(198);
  });

  it('surchargée : la Cité suit la valeur éditée (cité rationnée)', () => {
    setRule('market-cite-stock', 3);
    const cat: CatalogItem[] = [{ id: 'epee', label: 'Épée', availability: 'Commune' }];
    expect(fullStock(cat, 'cite', makeRNG(1))[0].qty).toBe(6);
  });
});

/**
 * `curated` (« Articles garantis en stock […] Disponibilité ignorée », `state/merchants/types.ts`) est
 * un contrat de l'ARCHÉTYPE, pas du mode de marché : les deux instantanés de stock l'honorent.
 */
describe('fullStock — le stock garanti (`curated`) passe outre la Disponibilité', () => {
  const cat: CatalogItem[] = [
    { id: 'clavecin', label: 'Clavecin', availability: 'Exotique' },
    { id: 'nd', label: 'Inconnu', availability: null },
  ];

  it('sans curated : Exotique et absence restent exclus', () => {
    expect(fullStock(cat, 'ville', makeRNG(7)).map((l) => l.id)).toEqual([]);
  });

  it('avec curated : les deux entrent en stock, quantité ≥ 1', () => {
    const s = fullStock(cat, 'ville', makeRNG(7), ['clavecin', 'nd']);
    expect(s.map((l) => l.id)).toEqual(['clavecin', 'nd']);
    expect(s.every((l) => l.qty >= 1)).toBe(true);
  });
});

/**
 * HORS COMMERCE (LDB 59 l.15) — les quatre classes forment l'ensemble FERMÉ des Possessions du commerce
 * ordinaire. Une ligne qui n'en porte aucune (marque « ND » de LDB 62 l.31 / LDB 68 l.11, ou aucune
 * valeur imprimée : tiret de LDB 62 l.28, entrée hors table) n'est pas mal classée — elle est hors du
 * commerce. Contrat du chemin ACHAT : elle n'a pas de Test de Disponibilité, donc pas de stock — sauf
 * déclaration nommée du marchand (`curated`).
 */
describe('hors commerce — `isTradable` et le chemin ACHAT', () => {
  it('les 4 classes RAW sont commerçables ; « ND », null et undefined ne le sont pas', () => {
    for (const av of AVAILABILITIES) expect(isTradable(av)).toBe(true);
    expect(isTradable('ND')).toBe(false);
    expect(isTradable(null)).toBe(false);
    expect(isTradable(undefined)).toBe(false);
  });

  it('le refus porte sa RAISON, nommant l’objet', () => {
    expect(outOfTradeReason('Licence de Guilde')).toContain('Licence de Guilde');
    expect(outOfTradeReason('Licence de Guilde')).toContain('Disponibilité');
  });

  it('ACHAT : ni « ND » ni l’absence n’entrent en stock (rollStock comme fullStock)', () => {
    const cat: CatalogItem[] = [
      { id: 'epee', label: 'Épée', availability: 'Commune' },
      { id: 'licence', label: 'Licence de Guilde', availability: 'ND' as unknown as null },
      { id: 'mains', label: 'Mains nues', availability: null },
    ];
    expect(rollStock(cat, 'cite', makeRNG(3)).map((l) => l.id)).toEqual(['epee']);
    expect(fullStock(cat, 'cite', makeRNG(3)).map((l) => l.id)).toEqual(['epee']);
  });

  it('CONTRE-ÉPREUVE : nommément `curated`, le marchand les tient — sans modulation de classe', () => {
    const cat: CatalogItem[] = [{ id: 'licence', label: 'Licence de Guilde', availability: null }];
    const s = fullStock(cat, 'village', makeRNG(3), ['licence']);
    expect(s.map((l) => l.id)).toEqual(['licence']);
    expect(s[0].qty).toBe(1); // Village = 1, aucun ×2 de classe Commune inventé
    expect(rollStock(cat, 'village', makeRNG(3), ['licence']).map((l) => l.id)).toEqual(['licence']);
  });
});
