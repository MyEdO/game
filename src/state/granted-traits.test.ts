import { describe, it, expect } from 'vitest';
import { moveReachFor } from './path';
import type { Scene } from './scene';
import { grantTrait, removeGrantedTrait } from '../engine/grantedTraits';
import { applyOps } from '../engine/ops';
import { endOfRound } from '../engine/conditions';
import { hasTrait } from '../engine/traits/dispatch';
import type { Combatant } from '../engine/types';

/**
 * Jalon 2.6 — Traits temporisés accordés par un sort (op `grantTrait`) : Envol (Vol héros),
 * Effrayant (Peur + échelle DR), Vaincre les impies (Haine ciblée)… Le trait est posé dans
 * `c.traits` (vu par les consommateurs existants), la psy dérivée re-synchronisée, et tout
 * est retiré à l'expiration de l'ActiveEffect porteur (fin de Round OU purge d'horloge).
 */
const dummy = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'x', label: 'X', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 35, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

const scene = (w: number, h: number, walls: string[] = []): Scene => {
  const tiles = new Array(w * h).fill('herbe');
  for (const k of walls) {
    const [x, y] = k.split(',').map(Number);
    tiles[y * w + x] = 'mur';
  }
  return {
    id: 's', name: 's', dimensions: { w, h }, ambiance: 'jour',
    layers: [{ z: 0, tiles }], entities: [], dialogues: [], triggers: [], encounters: [],
  } as unknown as Scene;
};

describe('grantTrait / removeGrantedTrait (engine/grantedTraits)', () => {
  it('pose le trait, le retrait n’enlève qu’UNE instance (jamais le natif)', () => {
    const c = dummy({ traits: [{ id: 'vol', value: 60 }] }); // Vol NATIF
    grantTrait(c, { id: 'vol', value: 35 }); // Envol par-dessus
    expect(c.traits).toEqual([{ id: 'vol', value: 60 }, { id: 'vol', value: 35 }]);
    removeGrantedTrait(c, { id: 'vol', value: 35 });
    expect(c.traits).toEqual([{ id: 'vol', value: 60 }]); // le natif survit
    removeGrantedTrait(c, { id: 'vol', value: 35 }); // déjà retiré → no-op
    expect(c.traits).toEqual([{ id: 'vol', value: 60 }]);
  });

  it('Peur accordée → causesPeur dérivé ; retirée → champ nettoyé ; psychTraits de MUTATION préservés', () => {
    const c = dummy({ psychTraits: [{ type: 'frenesie' }] }); // « Colère impie » (mutation)
    grantTrait(c, { id: 'peur', value: 2 });
    expect(c.causesPeur).toBe(2);
    removeGrantedTrait(c, { id: 'peur', value: 2 });
    expect(c.causesPeur).toBeUndefined();
    expect(c.psychTraits).toEqual([{ type: 'frenesie' }]); // la mutation n'est PAS perdue
  });

  it('Haine accordée (Vaincre les impies) → psychTrait ciblé, retiré proprement', () => {
    const c = dummy({});
    grantTrait(c, { id: 'haine', arg: 'Morts-vivants' });
    expect(c.psychTraits?.some((t) => t.type === 'haine')).toBe(true);
    removeGrantedTrait(c, { id: 'haine', arg: 'Morts-vivants' });
    expect(c.psychTraits?.some((t) => t.type === 'haine') ?? false).toBe(false);
  });
});

describe('op grantTrait (ops) + expiration de fin de Round', () => {
  it('Effrayant : Peur 1 (+1 par +3 DR) — Indice échelonné au DR du jet', () => {
    const c = dummy({});
    applyOps(c, [{ op: 'grantTrait', traitId: 'peur', indice: 1, indicePerSL: { every: 3, amount: 1 } }], {
      label: 'Effrayant', defaultDurationRounds: 4, sl: 6,
    });
    expect(c.traits).toContainEqual({ id: 'peur', value: 3 }); // 1 + ⌊6/3⌋
    expect(c.causesPeur).toBe(3);
    expect(c.activeEffects?.[0]?.grantedTrait).toEqual({ id: 'peur', value: 3 });
  });

  it('Envol : Vol (Agilité) — l’Indice est l’Agilité du lanceur ; expire en fin de Round', () => {
    const c = dummy({}); // Ag 35
    applyOps(c, [{ op: 'grantTrait', traitId: 'vol', indice: { charOf: 'agilite' } }], {
      label: 'Envol', defaultDurationRounds: 1,
    });
    expect(hasTrait(c.traits, 'vol')).toBe(true);
    expect(c.traits).toContainEqual({ id: 'vol', value: 35 });
    endOfRound(c); // 1 Round écoulé → l'effet expire et retire le trait
    expect(hasTrait(c.traits, 'vol')).toBe(false);
    expect(c.activeEffects ?? []).toHaveLength(0);
  });
});

describe('moveReachFor — Vol héros (Envol, Jalon 2.6)', () => {
  it('au sol, un mur infranchissable bloque ; en Vol, on le survole (atterrissage libre)', () => {
    // mur vertical complet en x=2 : aucune case au-delà n'est atteignable au sol.
    const s = scene(6, 3, ['2,0', '2,1', '2,2']);
    const walker = dummy({});
    const flyer = dummy({ traits: [{ id: 'vol', value: 35 }] });
    const ground = moveReachFor(walker, s, { x: 0, y: 1 }, 4, { blocked: new Set() });
    expect(ground.has('4,1')).toBe(false);
    const air = moveReachFor(flyer, s, { x: 0, y: 1 }, 4, { blocked: new Set() });
    expect(air.has('4,1')).toBe(true); // survole le mur
    expect(air.has('2,1')).toBe(false); // mais n'ATTERRIT pas sur le mur
  });
});

describe('op grantTalent — talents temporisés (Flambeau de Vertu / Cœurs ardents, Jalon 2.6)', () => {
  it('Sans peur accordé : featuresOf/sansPeurVs le voit (Test de Calme +20, PAS immunité auto) ; expire', async () => {
    const { fearImmuneVs } = await import('../engine/combatFeatures/dispatch');
    const { fearSourceFor, sansPeurVs } = await import('../engine/psychology');
    const c = dummy({});
    const ogre = dummy({ id: 'o', causesPeur: 2, groups: ['Ogre'] });
    expect(fearSourceFor(c, ogre)?.kind).toBe('peur'); // avant le sort : la Peur mord
    applyOps(c, [{ op: 'grantTalent', talent: { id: 'sans-peur' } }], { label: 'Flambeau de Vertu', defaultDurationRounds: 1 });
    expect(fearImmuneVs(c, ogre)).toBe(true); // le talent (temporisé) est détecté
    expect(sansPeurVs(c, ogre)).toBe(true);
    // RAW (LDB 10 l.1051) : Sans Peur n'immunise PAS d'office — la source RESTE détectée, le porteur
    // la teste par un seul Calme Accessible (+20).
    expect(fearSourceFor(c, ogre)?.kind).toBe('peur');
    expect(c.talents).toHaveLength(0); // PAS posé dans les talents possédés (fiche intacte)
    endOfRound(c);
    expect(fearImmuneVs(c, ogre)).toBe(false); // dissipé avec l'effet
  });

  it('Sans Peur POSSÉDÉ ciblé (LDB 10 l.1051) : immunise vs l’Ennemi spécifié seulement', async () => {
    const { fearImmuneVs } = await import('../engine/combatFeatures/dispatch');
    const c = dummy({ talents: [{ talentId: 'sans-peur', spec: 'mort-vivant', times: 1 }] });
    expect(fearImmuneVs(c, { groups: ['mort-vivant'] })).toBe(true);
    expect(fearImmuneVs(c, { groups: ['ogre'] })).toBe(false); // pas l'Ennemi du talent
  });

  it('Cœur vaillant accordé (Cœurs ardents) : la capacité braveheart est active via featuresOf', async () => {
    const { featuresOf } = await import('../engine/combatFeatures/dispatch');
    const c = dummy({});
    applyOps(c, [{ op: 'grantTalent', talent: { id: 'coeur-vaillant' } }], { label: 'Cœurs ardents', defaultDurationRounds: 3 });
    expect(featuresOf(c).some(({ def }) => def.braveheart)).toBe(true);
  });
});
