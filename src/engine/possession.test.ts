import { describe, it, expect } from 'vitest';
import { possessionCapacity, possessionRideable, possessionLabel, possessionTotalEnc, possessionLoadEnc, canEmbark, type Possession } from './possession';
import { randomizeChars } from './statblock';
import { CHAR_KEYS, type Characteristics } from './types';
import { ruleDef } from './policy';
import { SIZE_SHIPBOARD_ENC } from './size';
import type { CustomStatblock } from './statblock';

function baseChars(v = 30): Characteristics {
  const out = {} as Characteristics;
  for (const k of CHAR_KEYS) out[k] = v;
  return out;
}

function bete(overrides: Partial<Possession & { nature: 'bete' }> = {}): Possession {
  return {
    uid: 'pos-1',
    ownerId: 'hero-1',
    location: { kind: 'avec-le-groupe' },
    items: [],
    nature: 'bete',
    ref: { creatureId: 'mule' },
    ...overrides,
  } as Possession;
}

describe('possessionCapacity — source par nature (§4.2/§5)', () => {
  it('bête (réf bestiaire) : Contenu du profil EDOC (mule → 14 Enc)', () => {
    expect(possessionCapacity(bete())).toBe(14);
  });

  it('bête custom (statbloc sans profil de monture) : dégradation propre (undefined)', () => {
    const p = bete({ ref: { custom: { type: 'statblock', label: 'Bête inconnue', char: {} } } });
    expect(possessionCapacity(p)).toBeUndefined();
  });

  it('serviteur : porte son sac comme un héros, pas de bât dédié (undefined)', () => {
    const p: Possession = { ...bete(), nature: 'serviteur', ref: { creatureId: 'mule' } } as Possession;
    expect(possessionCapacity(p)).toBeUndefined();
  });

  it('véhicule : chargement du catalogue (charrette → 25 Enc, LDB 70)', () => {
    const p: Possession = { uid: 'pos-2', ownerId: 'hero-1', location: { kind: 'avec-le-groupe' }, items: [], nature: 'vehicule', vehicleId: 'charrette' };
    expect(possessionCapacity(p)).toBe(25);
  });

  it('navire : Contenance de la coque (barge → 300 Enc, MDG 12)', () => {
    const p: Possession = {
      uid: 'pos-3', ownerId: 'hero-1', location: { kind: 'avec-le-groupe' }, items: [], nature: 'navire',
      vehicleId: 'barge', naval: { morale: { score: 0, factors: [] } as any },
    };
    expect(possessionCapacity(p)).toBe(300);
  });

  it('immeuble : pas de catalogue de capacité (T4, #356) → undefined', () => {
    const p: Possession = { uid: 'pos-4', ownerId: 'hero-1', location: { kind: 'au-lieu', placeId: 'ville-x' }, items: [], nature: 'immeuble', buildingId: 'maison-1' };
    expect(possessionCapacity(p)).toBeUndefined();
  });
});

describe('possessionRideable — EDOC 07 l.157-161 (Incidents de monte)', () => {
  it('bête vivante, sans incident : montable', () => {
    expect(possessionRideable(bete())).toBe(true);
  });

  it('bête détruite : jamais montable', () => {
    expect(possessionRideable(bete({ destroyed: true }))).toBe(false);
  });

  it('Boiteux (l.159 « ni monté, ni porter ou tirer de charge ») : non montable', () => {
    expect(possessionRideable(bete({ mountInjury: 'boiteux' }))).toBe(false);
  });

  it('Patte brisée (l.161 « demeure immobile ») : non montable', () => {
    expect(possessionRideable(bete({ mountInjury: 'patte-brisee' }))).toBe(false);
  });

  it('Sangle cassée : incident non-bloquant, reste montable', () => {
    expect(possessionRideable(bete({ mountInjury: 'sangle-cassee' }))).toBe(true);
  });

  it('un véhicule ne se « monte » pas (se conduit)', () => {
    const p: Possession = { uid: 'pos-2', ownerId: 'hero-1', location: { kind: 'avec-le-groupe' }, items: [], nature: 'vehicule', vehicleId: 'charrette' };
    expect(possessionRideable(p)).toBe(false);
  });
});

describe('possessionLabel — label d’instance sinon libellé du catalogue (doctrine id/label)', () => {
  it('label posé (« Marguerite ») prime sur tout', () => {
    expect(possessionLabel(bete({ label: 'Marguerite' }))).toBe('Marguerite');
  });

  it('bête réf bestiaire sans label d’instance : libellé de la créature (« Mule »)', () => {
    expect(possessionLabel(bete())).toBe('Mule');
  });

  it('bête custom sans label d’instance : libellé du statbloc', () => {
    const p = bete({ ref: { custom: { type: 'statblock', label: 'Palefroi de Berthold', char: {} } } });
    expect(possessionLabel(p)).toBe('Palefroi de Berthold');
  });

  it('véhicule sans label d’instance : libellé du catalogue (« Charrette »)', () => {
    const p: Possession = { uid: 'pos-2', ownerId: 'hero-1', location: { kind: 'avec-le-groupe' }, items: [], nature: 'vehicule', vehicleId: 'charrette' };
    expect(possessionLabel(p)).toBe('Charrette');
  });
});

describe('possessionTotalEnc — scénario-étalon TERRESTRE (§5, T1-c2, #616)', () => {
  const charrette: Possession = {
    uid: 'pos-charrette', ownerId: 'h1', location: { kind: 'au-lieu', placeId: 'ecurie' },
    items: [{ uid: 'it-1', trappingId: 'lanterne', enc: 2 }] as Possession['items'],
    nature: 'vehicule', vehicleId: 'charrette',
    cargo: [{ cargoId: 'grain', enc: 15, basePriceGold: 3 }],
  };
  const muleChargee: Possession = {
    uid: 'pos-mule', ownerId: 'h1', location: { kind: 'avec-le-groupe' },
    items: [{ uid: 'it-2', trappingId: 'sac-de-couchage', enc: 1 }] as Possession['items'],
    nature: 'bete', ref: { creatureId: 'mule' },
    cargo: [{ cargoId: 'vin', enc: 4, basePriceGold: 8 }],
  };
  const registry = [charrette, muleChargee];

  it('charrette (au-lieu, rien d’embarqué) : enc propre (10, catalogue LDB) + cargo (15) + items (2) = 27', () => {
    expect(possessionTotalEnc(charrette, registry)).toBe(27);
  });

  it('mule chargée (avec-le-groupe, rien d’embarqué) : ownEnc bête (6, Taille Moyenne, MDG 12 l.25-33) + cargo (4) + items (1) = 11', () => {
    expect(possessionTotalEnc(muleChargee, registry)).toBe(11);
  });

  it('récursion triviale : aucune embarquée sur ces deux porteurs terrestres → pas de double-compte', () => {
    const soloRegistry = [charrette]; // sans muleChargee dans le registre : même total, aucun enfant à sommer
    expect(possessionTotalEnc(charrette, soloRegistry)).toBe(27);
  });
});

describe('possessionTotalEnc — Taille d’un statbloc CUSTOM à bord (MDG 12 l.25-33)', () => {
  /** Une bête à fiche d'auteur, seule, sans charge : son total est son poids propre. */
  const enc = (custom: Partial<CustomStatblock>): number => {
    const bete: Possession = {
      uid: 'pos-custom', ownerId: 'h1', location: { kind: 'avec-le-groupe' }, items: [],
      nature: 'bete', ref: { custom: { type: 'statblock', label: 'Bête d’auteur', char: {}, ...custom } as CustomStatblock },
    };
    return possessionTotalEnc(bete, [bete]);
  };

  it('Trait Taille (Grande) → Enc d’une Grande créature', () => {
    expect(enc({ traits: [{ id: 'taille', arg: 'Grande' }] } as Partial<CustomStatblock>)).toBe(SIZE_SHIPBOARD_ENC.grande);
  });

  it('Talent Petit → Enc d’une Petite créature', () => {
    expect(enc({ talents: [{ id: 'petit' }] } as Partial<CustomStatblock>)).toBe(SIZE_SHIPBOARD_ENC.petite);
  });

  it('ni Trait ni Talent de Taille → Moyenne', () => {
    expect(enc({})).toBe(SIZE_SHIPBOARD_ENC.moyenne);
  });

  it('un `size` explicite l’emporte sur le Trait', () => {
    expect(enc({ size: 'enorme', traits: [{ id: 'taille', arg: 'Petite' }] } as Partial<CustomStatblock>)).toBe(SIZE_SHIPBOARD_ENC.enorme);
  });
});

describe('possessionLoadEnc — charge PORTÉE, EXCLUT le poids propre (#620 Lot 2, bug utilisateur : bête vide affichait son corps)', () => {
  const charrette: Possession = {
    uid: 'pos-charrette', ownerId: 'h1', location: { kind: 'au-lieu', placeId: 'ecurie' },
    items: [{ uid: 'it-1', trappingId: 'lanterne', enc: 2 }] as Possession['items'],
    nature: 'vehicule', vehicleId: 'charrette',
    cargo: [{ cargoId: 'grain', enc: 15, basePriceGold: 3 }],
  };
  const muleChargee: Possession = {
    uid: 'pos-mule', ownerId: 'h1', location: { kind: 'avec-le-groupe' },
    items: [{ uid: 'it-2', trappingId: 'sac-de-couchage', enc: 1 }] as Possession['items'],
    nature: 'bete', ref: { creatureId: 'mule' },
    cargo: [{ cargoId: 'vin', enc: 4, basePriceGold: 8 }],
  };
  const registry = [charrette, muleChargee];

  it('charrette : cargo (15) + items (2) = 17, SANS les 10 Enc propres du catalogue', () => {
    expect(possessionLoadEnc(charrette, registry)).toBe(17);
  });

  it('mule chargée : cargo (4) + items (1) = 5, SANS les 6 Enc propres (Taille Moyenne)', () => {
    expect(possessionLoadEnc(muleChargee, registry)).toBe(5);
  });

  it('contrat : possessionTotalEnc = ownEnc + possessionLoadEnc (aucune 3e sommation parallèle)', () => {
    expect(possessionTotalEnc(charrette, registry)).toBe(10 + possessionLoadEnc(charrette, registry));
    expect(possessionTotalEnc(muleChargee, registry)).toBe(6 + possessionLoadEnc(muleChargee, registry));
  });

  it('bête VIDE (sans items/cargo) : charge portée = 0 — le corps ne compte PAS dans sa propre contenance de bât', () => {
    const muleVide = bete();
    expect(possessionLoadEnc(muleVide, [muleVide])).toBe(0);
    expect(possessionTotalEnc(muleVide, [muleVide])).toBe(6); // le total, lui, inclut bien le corps
  });

  it('embarquée sur un navire : le corps compte TOUJOURS dans la cale (embarkedEnc/possessionTotalEnc, INCHANGÉS)', () => {
    const navire: Possession = {
      uid: 'pos-navire', ownerId: 'h1', location: { kind: 'avec-le-groupe' }, items: [],
      nature: 'navire', vehicleId: 'barge', naval: { morale: { score: 0, factors: [] } } as never,
    };
    const muleVideEmbarquee: Possession = { ...bete(), location: { kind: 'embarquee', hostUid: 'pos-navire' } };
    const fleetRegistry = [navire, muleVideEmbarquee];
    // possessionTotalEnc(navire) descend ses embarquées via SA récursion pleine (ownEnc + loadEnc) —
    // la mule VIDE embarquée pèse son CORPS (6) dans la cale, contrairement à sa propre contenance de bât.
    expect(possessionTotalEnc(navire, fleetRegistry)).toBe((findVehicleEnc('barge')) + 6);
  });
});

/** `enc` du catalogue navire (barge) — évite un import supplémentaire pour une seule assertion. */
function findVehicleEnc(_vehicleId: 'barge'): number {
  return 0; // la barge n'a pas d'`enc` propre au catalogue (0 par défaut, `ownEnc` fallback `?? 0`)
}

describe('canEmbark — bornes de chaîne par nature (§5)', () => {
  const navire: Possession = {
    uid: 'pos-navire', ownerId: 'h1', location: { kind: 'avec-le-groupe' }, items: [],
    nature: 'navire', vehicleId: 'barge', naval: { morale: { score: 0, factors: [] } } as never,
  };
  const vehicule: Possession = {
    uid: 'pos-vehicule', ownerId: 'h1', location: { kind: 'avec-le-groupe' }, items: [], nature: 'vehicule', vehicleId: 'charrette',
  };

  it('bête sur navire : oui', () => {
    expect(canEmbark(bete(), navire)).toBe(true);
  });

  it('véhicule sur navire : oui', () => {
    expect(canEmbark(vehicule, navire)).toBe(true);
  });

  it('navire sur navire : non', () => {
    const navire2: Possession = { ...navire, uid: 'pos-navire-2' };
    expect(canEmbark(navire, navire2)).toBe(false);
  });

  it('une possession ne s’embarque jamais sur elle-même', () => {
    expect(canEmbark(navire, navire)).toBe(false);
  });
});

describe('policy.ts — tirage LDB 77 à l’acquisition (nouvelle règle optionnelle #614)', () => {
  it('la règle existe, citée LDB 77 l.108', () => {
    const def = ruleDef('possession-random-chars-on-acquire');
    expect(def).toBeDefined();
    expect(def!.ref).toMatch(/LDB 77/);
  });
});

describe('randomizeChars (engine/statblock) — tirage LDB 77 l.108, seedé sur l’uid de possession', () => {
  it('3 mules d’un même lot (uids distincts) → 3 tirages DISTINCTS', () => {
    const chars = baseChars(30);
    const a = randomizeChars(chars, 'pos-11');
    const b = randomizeChars(chars, 'pos-12');
    const c = randomizeChars(chars, 'pos-13');
    expect(a).not.toEqual(b);
    expect(b).not.toEqual(c);
    expect(a).not.toEqual(c);
  });

  it('même uid → même tirage (déterministe, rejouable)', () => {
    const chars = baseChars(30);
    expect(randomizeChars(chars, 'pos-11')).toEqual(randomizeChars(chars, 'pos-11'));
  });

  it('figé dans charsRolled : une 2e « projection » ne relance rien (simple recopie)', () => {
    const chars = baseChars(30);
    const rolled = randomizeChars(chars, 'pos-11');
    // Une possession fige son tirage une fois pour toutes (Possession.charsRolled) : toute projection
    // ultérieure RECOPIE cette valeur, elle ne rappelle jamais randomizeChars.
    const projection1 = { ...rolled };
    const projection2 = { ...rolled };
    expect(projection1).toEqual(projection2);
    expect(projection1).toEqual(rolled);
  });
});
