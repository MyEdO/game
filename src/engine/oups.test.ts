import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { isFumble, rollOups, desDOups, desDeBrisDeLame, type OupsResolved } from './oups';
import { oupsTable, oupsMisfire } from '../data/oups';
import type { Combatant, Weapon } from './types';

const sword: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
const pistol: Weapon = { label: 'Pistolet', type: 'ranged', damage: { plusBF: false, flat: 9 }, qualities: [{ id: 'pistolet' }], subType: 'Poudre noire', range: 20 };

describe('isFumble (LDB 14 l.19)', () => {
  it('échec + double = Maladresse', () => {
    expect(isFumble(33, false)).toBe(true);
    expect(isFumble(100, false)).toBe(true); // 00
    expect(isFumble(33, true)).toBe(false);  // double réussi = Critique, pas Maladresse
    expect(isFumble(34, false)).toBe(false); // pas un double
    expect(isFumble(11, false)).toBe(true);
  });
});

describe('isFumble — escalade Doigts amputés (LDB 18 l.251, #144)', () => {
  it('N doigts perdus + échec + chiffre des unités ∈ [1..N] (non-double) → Maladresse', () => {
    expect(isFumble(42, false, 2)).toBe(true); // unité 2 ≤ N=2
    expect(isFumble(21, false, 2)).toBe(true); // unité 1 ≤ N=2
  });
  it('chiffre des unités > N → PAS de Maladresse par escalade', () => {
    expect(isFumble(43, false, 2)).toBe(false); // unité 3 > N=2
  });
  it('0 doigt perdu (fingersLost omis/0) → comportement inchangé (pas de Maladresse hors double)', () => {
    expect(isFumble(41, false)).toBe(false);
    expect(isFumble(41, false, 0)).toBe(false);
  });
  it('réussite → jamais de Maladresse même dans la fenêtre de doigts perdus', () => {
    expect(isFumble(42, true, 2)).toBe(false);
  });
});

describe('rollOups (Tableau des Oups !)', () => {
  it('le kind correspond toujours à la bande du jet (arme de mêlée, pas de misfire)', () => {
    for (let s = 1; s <= 300; s++) {
      const r = rollOups(sword, makeRNG(s));
      expect(r.roll).toBeGreaterThanOrEqual(1);
      expect(r.roll).toBeLessThanOrEqual(100);
      expect(r.kind).not.toBe('misfire');
      const band = oupsTable().find((e) => r.roll >= e.min && r.roll <= e.max)!;
      expect(r.kind).toBe(band.kind);
    }
  });
  it('couvre plusieurs bandes du tableau', () => {
    const kinds = new Set<string>();
    for (let s = 1; s <= 300; s++) kinds.add(rollOups(sword, makeRNG(s)).kind);
    expect(kinds.size).toBeGreaterThanOrEqual(4);
  });
  it("Incident de Tir : arme à poudre + jet PAIR → misfire", () => {
    let sawMisfire = false;
    for (let s = 1; s <= 200; s++) {
      const r = rollOups(pistol, makeRNG(s));
      if (r.roll % 2 === 0) { expect(r.kind).toBe('misfire'); expect(r.label).toBe(oupsMisfire().label); sawMisfire = true; }
      else expect(r.kind).not.toBe('misfire');
    }
    expect(sawMisfire).toBe(true);
  });
  it("parité #365 : le label Incident de Tir vit dans oups.json, byte-identique à l'ancien code en dur", () => {
    expect(oupsMisfire().label).toBe('Incident de Tir ! L’arme explose dans votre main (Dégâts au Bras principal, arme détruite).');
    expect(oupsTable()).toHaveLength(7); // la table d100 = 7 bandes, le misfire en est exclu (filtré hors table)
  });
  it("arme non à poudre : jamais de misfire", () => {
    for (let s = 1; s <= 200; s++) expect(rollOups(sword, makeRNG(s)).kind).not.toBe('misfire');
  });
});

/**
 * LA GRAPPE DE DÉS d'une Maladresse (#1508 T3b-4) — PURE, ORDONNÉE, DÉPENDANTE.
 *
 * `LDB 60 l.30` (Solide) : « […] gagner un Test de Sauvegarde de 9+ sur un lancer de 1d10 contre une
 * cassure instantanée, issue de sources comme Lame piégée […] Chaque fois qu'il est pris, le Test de
 * Sauvegarde est amélioré de 1 (par exemple de 9+ à 8+). » ; `LDB 62 l.262` (Incassable) : ni dégât ni
 * destruction ; `AA 10 l.264` : une arme à Atout *Salve* qui subit un Incident de tir tire EN PLUS sur
 * le tableau des Incidents par Salve.
 *
 * Ce que ces contrats tiennent : on ne demande QUE ce qui est connaissable avec les dés déjà tombés —
 * la Sauvegarde Solide de la pièce d'artillerie n'existe que si la ligne de Salve TIRÉE la détruit.
 */
const bacle = (over: Partial<Weapon> = {}): Weapon =>
  ({ ...sword, qualities: [{ id: 'bacle' }], ...over }) as Weapon;
const solide = (n: number, ...autres: { id: string; value?: number }[]): Weapon =>
  ({ ...sword, qualities: [{ id: 'solide', value: n }, ...autres] }) as Weapon;
const canon = (...q: { id: string; value?: number }[]): Weapon =>
  ({ label: 'Pièce', type: 'ranged', damage: { plusBF: false, flat: 12 }, qualities: q }) as Weapon;
const porteur = (over: Partial<Combatant> = {}): Combatant =>
  ({ id: 'p', label: 'p', kind: 'hero', items: [], weapons: [], ...over }) as unknown as Combatant;

const MISFIRE: OupsResolved = { roll: 44, kind: 'misfire', label: 'Incident de Tir !' };
const SONNE: OupsResolved = { roll: 33, kind: 'selfWound', label: 'Vous vous blessez' };
const cles = (d: { cle: string }[]): string[] => d.map((x) => x.cle);

describe('desDOups — la grappe d’une Maladresse, dans l’ordre', () => {
  it('Bâclé SANS Solide : aucun dé (l’arme casse, il n’y a rien à sauver)', () => {
    expect(desDOups(porteur(), bacle(), SONNE, new Map())).toEqual([]);
  });

  it('Bâclé + Solide(1) : la seule demande est `bacle-solide`, lue en SEUIL 9+ sur 1d10', () => {
    const d = desDOups(porteur(), { ...solide(1), qualities: [{ id: 'bacle' }, { id: 'solide', value: 1 }] } as Weapon, SONNE, new Map());
    expect(cles(d)).toEqual(['bacle-solide']);
    expect(d[0].spec).toEqual({ n: 1, sides: 10 });
    expect(d[0].lecture).toEqual({ kind: 'seuil', indice: 9, source: { kind: 'qualite', id: 'solide' } });
  });

  it('Solide(3) : le seuil est amélioré de 1 par Indice — 7+ (LDB 60 l.32)', () => {
    const d = desDOups(porteur(), { ...sword, qualities: [{ id: 'bacle' }, { id: 'solide', value: 3 }] } as Weapon, SONNE, new Map());
    expect(d[0].lecture).toEqual({ kind: 'seuil', indice: 7, source: { kind: 'qualite', id: 'solide' } });
  });

  it('Incassable (LDB 62 l.262) : aucun dé, même Solide — rien ne peut casser', () => {
    const arme = { ...sword, qualities: [{ id: 'bacle' }, { id: 'solide', value: 1 }, { id: 'incassable' }] } as Weapon;
    expect(desDOups(porteur(), arme, MISFIRE, new Map())).toEqual([]);
  });

  it('Incident de tir + Solide + Salve : `misfire-solide`, PUIS la table, PUIS `salve-solide` si la ligne détruit', () => {
    const piece = canon({ id: 'salve', value: 9 }, { id: 'solide', value: 1 });
    const p = porteur();
    expect(cles(desDOups(p, piece, MISFIRE, new Map())), 'la table n’existe pas avant que le 1ᵉʳ dé soit tombé… mais elle est déjà connaissable').toEqual(['misfire-solide', 'salve-table']);
    const apresSolide = new Map([['misfire-solide', 3]]);
    expect(cles(desDOups(p, piece, MISFIRE, apresSolide)).filter((c) => !apresSolide.has(c))).toEqual(['salve-table']);
    // Ligne 1-4 : la pièce est DÉTRUITE → sa Sauvegarde Solide s’ouvre.
    const detruite = new Map([['misfire-solide', 3], ['salve-table', 2]]);
    expect(cles(desDOups(p, piece, MISFIRE, detruite)).filter((c) => !detruite.has(c))).toEqual(['salve-solide']);
    // Ligne 10 (tir perdu) : la pièce n’est PAS détruite → aucune sauvegarde de plus.
    const intacte = new Map([['misfire-solide', 3], ['salve-table', 10]]);
    expect(cles(desDOups(p, piece, MISFIRE, intacte)).filter((c) => !intacte.has(c))).toEqual([]);
  });

  it('Salve SANS Solide : la table seule (rien à sauver quand la pièce casse)', () => {
    const d = desDOups(porteur(), canon({ id: 'salve', value: 9 }), MISFIRE, new Map());
    expect(cles(d)).toEqual(['salve-table']);
    expect(d[0].lecture).toEqual({ kind: 'table', tableId: 'artillery-salve-misfire' });
  });

  it('une Maladresse SANS casse (ni Bâclé ni Incident) ne demande rien, même sur une arme Solide', () => {
    expect(desDOups(porteur(), solide(2), SONNE, new Map())).toEqual([]);
  });

  it('tous les dés tombés : la grappe est servie et l’application peut jouer', () => {
    const piece = canon({ id: 'salve', value: 9 }, { id: 'solide', value: 1 });
    const des = new Map([['misfire-solide', 3], ['salve-table', 2], ['salve-solide', 4]]);
    expect(desDOups(porteur(), piece, MISFIRE, des).filter((d) => !des.has(d.cle))).toEqual([]);
  });

  it('Incassable porté par l’ItemInstance SOURCE (et non par le Weapon dérivé) : toujours aucun dé', () => {
    const arme = { ...sword, uid: 'w1', qualities: [{ id: 'bacle' }, { id: 'solide', value: 1 }] } as Weapon;
    const p = porteur({ items: [{ uid: 'w1', qualities: [{ id: 'incassable' }] }] as never });
    expect(desDOups(p, arme, SONNE, new Map())).toEqual([]);
  });
});

describe('desDeBrisDeLame — la MÊME sauvegarde pour le Piège-lame (LDB 62 l.280)', () => {
  it('lame Solide(1) : un 1d10 lu en seuil 9+, sous la clé `bladetrap-solide`', () => {
    const d = desDeBrisDeLame(porteur(), solide(1));
    expect(cles(d)).toEqual(['bladetrap-solide']);
    expect(d[0].lecture).toEqual({ kind: 'seuil', indice: 9, source: { kind: 'qualite', id: 'solide' } });
  });

  it('lame ordinaire : aucun dé — elle se brise sans sauvegarde', () => {
    expect(desDeBrisDeLame(porteur(), sword)).toEqual([]);
  });
});
