import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import {
  isFumble,
  incidentDeTir,
  armeAPoudre,
  rollOups,
  desDOups,
  desDeBrisDeLame,
  ligneDeSolide,
  SOURCE_SOLIDE,
  type OupsResolved,
  type DemandeDeCasse,
} from './oups';
import { oupsTable, oupsMisfire } from '../data/oups';
import type { Combatant, Weapon } from './types';
import { t } from '../i18n';
import { armeDeTest } from './objetsDeTest.testkit';

const sword: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
const pistol: Weapon = { label: 'Pistolet', type: 'distance', damage: { plusBF: false, flat: 9 }, qualities: [{ id: 'pistolet' }], subType: 'poudre-noire', range: 20 };

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

describe('rollOups (Tableau des Oups !, LDB 14 l.21-30)', () => {
  it('le kind correspond toujours à la bande du d100 tiré', () => {
    for (let s = 1; s <= 300; s++) {
      const r = rollOups(makeRNG(s));
      expect(r.roll).toBeGreaterThanOrEqual(1);
      expect(r.roll).toBeLessThanOrEqual(100);
      const band = oupsTable().find((e) => r.roll >= e.min && r.roll <= e.max)!;
      expect(r.kind).toBe(band.kind);
    }
  });
  it('couvre plusieurs bandes du tableau', () => {
    const kinds = new Set<string>();
    for (let s = 1; s <= 300; s++) kinds.add(rollOups(makeRNG(s)).kind);
    expect(kinds.size).toBeGreaterThanOrEqual(4);
  });
  it("l'Incident de Tir vit dans oups.json, hors de la table d100 (son libellé : src/data/oups-verbatim.test.ts)", () => {
    expect(oupsMisfire().kind).toBe('misfire');
    expect(oupsTable().map((e) => e.kind)).not.toContain('misfire');
  });
});

/**
 * L'INCIDENT DE TIR se lit sur le jet du Test de combat qui a produit la Maladresse, jamais sur un jet du
 * Tableau des Oups ! — `LDB 14 l.34` : « Si vous utilisez une arme à Poudre noire, mécanique ou
 * explosive et que vous effectuez une Maladresse qui est aussi un nombre pair – 00, 88 etc. –, votre
 * arme a un raté d'allumage […] en utilisant le dé des unités comme DR pour toucher ».
 */
describe('incidentDeTir (LDB 14 l.19, l.34)', () => {
  it('arme à poudre, Maladresse paire (00, 22, 44, 66, 88) → raté d’allumage, porté par CE jet', () => {
    for (const jet of [100, 22, 44, 66, 88]) {
      expect(incidentDeTir(pistol, jet), `jet ${jet}`).toEqual({ roll: jet, kind: 'misfire', label: oupsMisfire().label });
    }
  });
  it('arme à poudre, Maladresse impaire (11, 33, 55, 77, 99) → jamais d’Incident : le Tableau des Oups !', () => {
    for (const jet of [11, 33, 55, 77, 99]) expect(incidentDeTir(pistol, jet), `jet ${jet}`).toBeNull();
  });
  it('arme Dangereuse, Maladresse sur un 9 (98, LDB 62 l.315) : pair → raté', () => {
    expect(incidentDeTir({ ...pistol, qualities: [{ id: 'dangereuse' }] }, 98)?.kind).toBe('misfire');
  });
  it('Doigts amputés (LDB 18 l.251) : Maladresse sur 32 (deux doigts perdus) → pair, raté', () => {
    expect(isFumble(32, false, 2)).toBe(true);
    expect(incidentDeTir(pistol, 32)?.roll).toBe(32);
  });
  it('le dé des unités du jet de Maladresse porte le DR : jet 44 → 4', () => {
    expect(incidentDeTir(pistol, 44)!.roll % 10).toBe(4);
  });
  it('arme hors Poudre noire, mécanique ou explosive : jamais d’Incident, même sur un jet pair', () => {
    for (const jet of [100, 22, 44, 66, 88]) expect(incidentDeTir(sword, jet)).toBeNull();
  });

  it('mangonneau (À Explosion, sans poudre) : jamais d’Incident, même sur un jet pair (#4345)', () => {
    for (const jet of [100, 22, 44, 66, 88]) expect(incidentDeTir(armeDeTest('mangonneau-ade2'), jet)).toBeNull();
  });
});

/** LDB 14 l.34 ; LDB 62 l.178 ; AA 10 l.150, l.154, l.165 ; ADE II 08 l.270 ; #4345 */
describe('armeAPoudre (LDB 14 l.34 ; #4345)', () => {
  const A_POUDRE = ['pistolet', 'arquebuse', 'arquebus-a-repetition', 'bombe', 'canon-petit', 'canon-moyen', 'canon-grand', 'mortier', 'pierrier', 'canon-a-repetition', 'canon-a-repetition-feu-d-enfer', 'canon-ade2', 'mortier-ade2', 'batterie-tonnerre-de-feu-ade2'];
  const HORS = ['arc-long', 'arbalete', 'baliste', 'fronde', 'javelot', 'mangonneau-ade2', 'onagre-ade2', 'trebuchet-ade2', 'canon-a-flammes-nain-ade2'];
  it.each(A_POUDRE)('%s : arme à poudre', (id) => {
    expect(armeAPoudre(armeDeTest(id))).toBe(true);
  });
  it.each(HORS)('%s : hors', (id) => {
    expect(armeAPoudre(armeDeTest(id))).toBe(false);
  });
});

/**
 * LA GRAPPE DE DÉS d'une Maladresse (#1508 T3b-4) — PURE et ORDONNÉE.
 *
 * `LDB 60 l.30` (Solide) : « […] gagner un Test de Sauvegarde de 9+ sur un lancer de 1d10 contre une
 * cassure instantanée, issue de sources comme Lame piégée […] Chaque fois qu'il est pris, le Test de
 * Sauvegarde est amélioré de 1 (par exemple de 9+ à 8+). » ; `LDB 62 l.262` (Incassable) : « Dans presque
 * toutes les circonstances, cette arme ne sera ni brisée, ni corrodée, ni émoussée. » ; `AA 10 l.264` :
 * « Si l'arme subit un Incident de tir à n'importe quel moment du processus, déterminez-en les effets
 * puis faites un jet dans le tableau suivant. »
 *
 * Ce que ces contrats tiennent : UNE Sauvegarde Solide par Maladresse, lue par chacune de ses causes
 * de cassure (#1508, commentaire du 2026-09-26 ; #1764, commentaire du 2026-09-27), et toutes les
 * demandes connaissables d'emblée — aucune ne dépend d'un dé tombé.
 */
const bacle = (over: Partial<Weapon> = {}): Weapon =>
  ({ ...sword, qualities: [{ id: 'bacle' }], ...over }) as Weapon;
const solide = (n: number, ...autres: { id: string; value?: number }[]): Weapon =>
  ({ ...sword, qualities: [{ id: 'solide', value: n }, ...autres] }) as Weapon;
const canon = (...q: { id: string; value?: number }[]): Weapon =>
  ({ label: 'Pièce', type: 'distance', damage: { plusBF: false, flat: 12 }, qualities: q }) as Weapon;
const porteur = (over: Partial<Combatant> = {}): Combatant =>
  ({ id: 'p', label: 'p', kind: 'heros', items: [], weapons: [], ...over }) as unknown as Combatant;

const MISFIRE: OupsResolved = { roll: 44, kind: 'misfire', label: 'Incident de Tir !' };
const SONNE: OupsResolved = { roll: 33, kind: 'selfWound', label: 'Vous vous blessez' };
const cles = (d: { cle: string }[]): string[] => d.map((x) => x.cle);

describe('desDOups — la grappe d’une Maladresse, dans l’ordre', () => {
  it('Bâclé SANS Solide : aucun dé (l’arme casse, il n’y a rien à sauver)', () => {
    expect(desDOups(porteur(), bacle(), SONNE)).toEqual([]);
  });

  it('Bâclé + Solide(1) : la seule demande est `solide`, lue en SEUIL 9+ sur 1d10', () => {
    const d = desDOups(porteur(), { ...solide(1), qualities: [{ id: 'bacle' }, { id: 'solide', value: 1 }] } as Weapon, SONNE);
    expect(cles(d)).toEqual(['solide']);
    expect(d[0]).toMatchObject({ spec: { n: 1, sides: 10 } });
    expect(d[0].lecture).toEqual({ kind: 'seuil', indice: 9, source: { kind: 'qualite', id: 'solide' } });
  });

  it('Solide(3) : le seuil est amélioré de 1 par Indice — 7+ (LDB 60 l.32)', () => {
    const d = desDOups(porteur(), { ...sword, qualities: [{ id: 'bacle' }, { id: 'solide', value: 3 }] } as Weapon, SONNE);
    expect(d[0].lecture).toEqual({ kind: 'seuil', indice: 7, source: { kind: 'qualite', id: 'solide' } });
  });

  it('Incassable (LDB 62 l.262) : aucun dé, même Solide — rien ne peut casser', () => {
    const arme = { ...sword, qualities: [{ id: 'bacle' }, { id: 'solide', value: 1 }, { id: 'incassable' }] } as Weapon;
    expect(desDOups(porteur(), arme, MISFIRE)).toEqual([]);
  });

  // UNE sauvegarde Solide par Maladresse : #1508 (commentaire du 2026-09-26), #1764 (commentaire du 2026-09-27) ; `AA 10 l.264`, `l.274-276`, `LDB 14 l.34`, `LDB 60 l.30`.
  it('Incident de tir + Solide + Salve : la sauvegarde PUIS la table — et aucune 2ᵉ sauvegarde, même sur une ligne qui détruit', () => {
    const piece = canon({ id: 'salve', value: 9 }, { id: 'solide', value: 1 });
    expect(cles(desDOups(porteur(), piece, MISFIRE)), 'les deux demandes sont connaissables d’emblée').toEqual(['solide', 'salve-table']);
  });

  it('Bâclé + Poudre noire + Solide(1), Incident de tir : UNE sauvegarde pour l’événement, lue par les deux causes', () => {
    const arme = { ...sword, subType: 'poudre-noire', qualities: [{ id: 'bacle' }, { id: 'solide', value: 1 }] } as Weapon;
    const d = desDOups(porteur(), arme, MISFIRE);
    expect(cles(d), 'un seul dé Solide, quelle que soit la cause').toEqual(['solide']);
    expect(d[0].lecture).toEqual({ kind: 'seuil', indice: 9, source: { kind: 'qualite', id: 'solide' } });
  });

  it('Solide(9) : le seuil « amélioré de 1 » atteint 1+ — aucun 1d10 ne le rate, donc aucun dé ne s’ouvre', () => {
    const arme = { ...sword, qualities: [{ id: 'bacle' }, { id: 'solide', value: 9 }] } as Weapon;
    expect(desDOups(porteur(), arme, SONNE), 'un dé qui ne décide rien ne se demande pas').toEqual([]);
  });

  it('Solide(8) : 2+ — le dé décide encore (un 1 le rate), il s’ouvre', () => {
    const arme = { ...sword, qualities: [{ id: 'bacle' }, { id: 'solide', value: 8 }] } as Weapon;
    const d = desDOups(porteur(), arme, SONNE);
    expect(cles(d)).toEqual(['solide']);
    expect(d[0].lecture).toEqual({ kind: 'seuil', indice: 2, source: { kind: 'qualite', id: 'solide' } });
  });

  it('Salve SANS Solide : la table seule (rien à sauver quand la pièce casse)', () => {
    const d = desDOups(porteur(), canon({ id: 'salve', value: 9 }), MISFIRE);
    expect(cles(d)).toEqual(['salve-table']);
    expect(d[0].lecture).toEqual({ kind: 'table', tableId: 'artillerie-salve-incident' });
  });

  it('une demande lue en TABLE ne porte aucun dé : sa table est le seul porteur du sien (#1667)', () => {
    // @ts-expect-error -- `spec` refusé sur le membre table de `DemandeDeCasse`
    const fautive: DemandeDeCasse = { cle: 'salve-table', spec: { n: 1, sides: 10 }, libelle: t('step.salveMisfire', { weapon: 'x' }), lecture: { kind: 'table', tableId: 'artillerie-salve-incident' } };
    expect(fautive.lecture.kind).toBe('table');
  });

  it('objet SOURCE DÉJÀ détruit (Bâclé + Solide(1)) : aucun dé — la cassure a eu lieu, rien à sauver (`LDB 60 l.30`)', () => {
    const arme = { ...sword, uid: 'w1', qualities: [{ id: 'bacle' }, { id: 'solide', value: 1 }] } as Weapon;
    const p = porteur({ items: [{ uid: 'w1', destroyed: true, qualities: [] }] as never });
    expect(desDOups(p, arme, SONNE), 'l’ItemInstance SOURCE fait foi').toEqual([]);
  });

  it('une Maladresse SANS casse (ni Bâclé ni Incident) ne demande rien, même sur une arme Solide', () => {
    expect(desDOups(porteur(), solide(2), SONNE)).toEqual([]);
  });

  it('Incassable porté par l’ItemInstance SOURCE (et non par le Weapon dérivé) : toujours aucun dé', () => {
    const arme = { ...sword, uid: 'w1', qualities: [{ id: 'bacle' }, { id: 'solide', value: 1 }] } as Weapon;
    const p = porteur({ items: [{ uid: 'w1', qualities: [{ id: 'incassable' }] }] as never });
    expect(desDOups(p, arme, SONNE)).toEqual([]);
  });
});

describe('desDeBrisDeLame — la MÊME sauvegarde pour le Piège-lame (LDB 62 l.280)', () => {
  it('lame Solide(1) : un 1d10 lu en seuil 9+, sous la clé `piege-a-lame-solide`', () => {
    const d = desDeBrisDeLame(porteur(), solide(1));
    expect(cles(d)).toEqual(['piege-a-lame-solide']);
    expect(d[0].lecture).toEqual({ kind: 'seuil', indice: 9, source: { kind: 'qualite', id: 'solide' } });
  });

  it('lame ordinaire : aucun dé — elle se brise sans sauvegarde', () => {
    expect(desDeBrisDeLame(porteur(), sword)).toEqual([]);
  });
});

describe('ligneDeSolide — l’écriture unique des lignes de Sauvegarde Solide (LDB 60 l.30)', () => {
  it('dé lu en seuil : « tient le choc » à 9+, « ne résiste pas » en dessous', () => {
    expect(ligneDeSolide('Épée', { indice: 9, source: SOURCE_SOLIDE }, 9)).toMatch(/^Épée tient le choc — Sauvegarde 1d10 : 9 ≥ /);
    expect(ligneDeSolide('Épée', { indice: 9, source: SOURCE_SOLIDE }, 8)).toMatch(/^Épée ne résiste pas — Sauvegarde 1d10 : 8 < /);
  });

  it('seuil imperdable (aucun dé) : la sauvegarde se DIT, sans jet', () => {
    const l = ligneDeSolide('Épée', { indice: 1, source: SOURCE_SOLIDE });
    expect(l).toMatch(/^Épée résiste — .* : la Sauvegarde ne peut pas échouer\.$/);
    expect(l, 'aucun jet à citer').not.toMatch(/1d10 :/);
  });
});
