/**
 * LA CLÔTURE D'INTERLUDE, sans store (#3059 S7) : ce que `devisDeCloture` annonce est exactement ce que
 * La validation de l'interlude (`fenetreValider('interlude')`) applique (bourses, Revenus, dépôts, Niveaux de Carrière, horloge, issues différées), un
 * invité ne clôt pas, et les pertes d'argent des Événements frappent la bourse que l'Événement désigne.
 * LDB 23 l.15, l.33, l.191 ; LDB 22 l.5, l.36, l.115
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { avanceEtapeCascade } from './cascade.testkit';
import { emptyScene } from './monde/scene';
import { createHero } from '../engine/character';
import { bourseOf, withBourseMoney } from '../engine/bourse';
import { fromBrass, toBrass, type Money } from '../engine/money';
import { makeRNG } from '../engine/dice';
import { MINUTES_PER_DAY } from '../engine/clock';
import { hasCondition } from '../engine/conditions';
import { devisDeCloture } from './verdictsDInterlude';
import { refusDeLaValidationNommee } from './validationDeFenetre';
import { t } from '../i18n';
import type { Combatant } from '../engine/types';

const SCENE = { ...emptyScene('altdorf-centre', 2, 2), label: 'Altdorf', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] };

/** Dés d'Événement choisis dans la donnée (`interludeEvents.json`). */
const SANS_EFFET = 1; // « Allié inculpé » : aucun effet chiffré
const PREVOT = 22; // « Le Prévôt arrive »
const KLEPTO = 83; // « Kleptomane »

const heros = (label: string, seed: number, careerLevel: number, bourse: Money): Combatant =>
  withBourseMoney({ ...createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label, seed }), careerLevel }, bourse, idsDeTest);

/** Un banc à Altdorf, dés d'Événement POSÉS (`des`, un par héros), séquence dénouée. */
function apresLeTirage(party: Combatant[], des: number[]): Banc {
  const banc = ouvrirLeBanc({ graine: 7, desFixes: true, etat: { party, scene: SCENE, lieu: 'altdorf' } });
  banc.actions.ouvrirLInterlude(2);
  for (const de of des) avanceEtapeCascade(banc.getState, () => de);
  avanceEtapeCascade(banc.getState); // dénouement de groupe
  expect(banc.getState().interlude?.phase, 'témoin : le tirage est dénoué').toBe('activities');
  return banc;
}

const bourses = (banc: Banc) => banc.getState().party.map((h) => toBrass(bourseOf(h)));

describe('Clôture — le devis est ce que le geste applique', () => {
  /** Vétéran (Niveau 3, Revenus, Mécénat), Forgeron (Niveau 4, sans Revenus, mort pendant la période),
   *  Recrue (Niveau 3, sans Revenus, une issue différée), une commande en cours. */
  function groupeDeTrois(): Banc {
    const banc = apresLeTirage([
      heros('Vétéran', 1601, 3, { gold: 20, silver: 0, brass: 0 }),
      heros('Forgeron', 1602, 4, { gold: 0, silver: 5, brass: 0 }),
      heros('Recrue', 1603, 3, { gold: 0, silver: 0, brass: 0 }),
    ], [SANS_EFFET, SANS_EFFET, SANS_EFFET]);
    const [a, b, c] = banc.getState().party.map((h) => h.id);
    banc.actions.deposerALaBanque(a, 'mecenat', 1200);
    expect(banc.getState().bank, 'témoin : le Mécénat est déposé').toEqual([{ uid: expect.any(String), heroId: a, kind: 'mecenat', brass: 1200, rate: 0 }]);
    banc.setState((s) => ({
      gameTime: 120,
      pendingOrders: [{ heroId: c, trappingId: 'dague' }],
      party: s.party.map((h) => (h.id === b ? { ...h, dead: true } : h)),
      interlude: { ...s.interlude!, perHero: {
        ...s.interlude!.perHero,
        [a]: { ...s.interlude!.perHero[a], didRevenus: true, revenueBrass: 120 },
        [c]: { ...s.interlude!.perHero[c], closeOps: [{ ops: [{ op: 'condition', id: { id: 'extenue' }, value: 1 }], ctx: { label: 'Faire jaser la cour' } }] },
      } },
    }));
    return banc;
  }

  it('trois héros, plusieurs bourses, Revenus, Mécénat, un mort de Niveau 4 (gaspillé, non rétrogradé) : devis littéral, puis appliqué tel quel', () => {
    const banc = groupeDeTrois();
    const [a, b, c] = banc.getState().party.map((h) => h.id);
    const devis = devisDeCloture(banc.getState());
    expect(devis).toEqual({
      gaspillages: [{ heroId: a, brass: 3600 }, { heroId: b, brass: 60 }], gaspille: 3660,
      revenus: [{ heroId: a, brass: 120 }], revenu: 120,
      retrogradations: [{ heroId: c, niveau: 2 }], // le mort ne poursuit pas sa Carrière
      conserve: 1200,
      commandes: ['dague'],
      ouvrages: [],
      lots: [{ heroId: c, lots: [{ ops: [{ op: 'condition', id: { id: 'extenue' }, value: 1 }], ctx: { label: 'Faire jaser la cour' } }] }],
      jours: 14,
      reprise: 19020, // aube (05:00) du 13ᵉ jour après Hexenstag 2512, 02:00
    });
    banc.actions.fenetreValider('interlude');
    const s = banc.getState();
    expect(s.interlude).toBeNull();
    expect(bourses(banc), 'bourses : gaspillées, puis les seuls Revenus').toEqual([120, 0, 0]);
    expect(s.party.map((h) => h.careerLevel), 'Niveaux : ceux du devis').toEqual([3, 4, 2]);
    expect(s.bank, 'le dépôt survit à la clôture').toEqual([{ uid: expect.any(String), heroId: a, kind: 'mecenat', brass: 1200, rate: 0 }]);
    expect(s.gameTime, 'reprise : celle du devis').toBe(19020);
    expect(hasCondition(s.party[2], 'extenue'), 'l’issue différée est posée après le repos').toBe(true);
  });

  it('un invité ne clôt pas : refusé et dit, rien de changé', () => {
    const banc = groupeDeTrois();
    banc.setState((s) => ({ net: { ...s.net, mode: 'invite' } }));
    const avant = JSON.stringify([banc.getState().interlude, banc.getState().party, banc.getState().gameTime]);
    const journal = banc.getState().journal.length;
    banc.actions.fenetreValider('interlude');
    expect(banc.getState().journal.slice(journal)).toEqual([t('validation.refus.hoteSeul')]);
    expect(JSON.stringify([banc.getState().interlude, banc.getState().party, banc.getState().gameTime])).toBe(avant);
  });

  it('les Événements encore à tirer : la clôture est refusée et dite, rien de changé (LDB 22 l.5)', () => {
    const banc = ouvrirLeBanc({ graine: 7, desFixes: true, etat: { party: [heros('Vétéran', 1601, 3, { gold: 2, silver: 0, brass: 0 })], scene: SCENE, lieu: 'altdorf' } });
    banc.actions.ouvrirLInterlude(2);
    expect(banc.getState().interlude?.phase, 'témoin : le tirage est ouvert').toBe('tirage');
    expect(refusDeLaValidationNommee(banc.getState(), 'interlude')).toBe('L’interlude ne se clôt pas tant que les Événements de la période ne sont pas tirés.');
    const avant = JSON.stringify([banc.getState().interlude, banc.getState().party, banc.getState().gameTime]);
    const journal = banc.getState().journal.length;
    banc.actions.fenetreValider('interlude');
    expect(banc.getState().journal.slice(journal)).toEqual(['L’interlude ne se clôt pas tant que les Événements de la période ne sont pas tirés.']);
    expect(JSON.stringify([banc.getState().interlude, banc.getState().party, banc.getState().gameTime])).toBe(avant);
  });

  it('le tirage dénoué : la clôture est offerte à l’hôte', () => {
    expect(refusDeLaValidationNommee(groupeDeTrois().getState(), 'interlude')).toBeNull();
  });
});

describe('Clôture — devis = geste = oracle, sur 60 groupes tirés', () => {
  // Oracle de la reprise : première nuit jusqu'à l'aube (05:00, `calendarPhases`), puis un jour par nuit.
  const AUBE = 300;
  const premiereNuit = (from: number) => ((AUBE - (from % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY) || MINUTES_PER_DAY;
  it.each(Array.from({ length: 60 }, (_, i) => i + 1))('groupe %i', (graine) => {
    const g = makeRNG(graine * 7919);
    const ri = (a: number, b: number) => g.int(a, b);
    const n = ri(1, 4);
    const party = Array.from({ length: n }, (_, i) => heros(`H${i}`, graine * 10 + i, ri(1, 4), fromBrass(ri(0, 3) === 0 ? 0 : ri(1, 9000))));
    const weeks = ri(1, 4);
    const banc = ouvrirLeBanc({ graine, desFixes: true, etat: { party, scene: SCENE, lieu: 'altdorf' } });
    banc.actions.ouvrirLInterlude(weeks);
    for (let i = 0; i < n; i++) avanceEtapeCascade(banc.getState, () => SANS_EFFET);
    avanceEtapeCascade(banc.getState);
    const ids = banc.getState().party.map((h) => h.id);
    const intrus = ri(0, 2) === 0 ? { ...heros('Intrus', graine * 10 + 9, ri(1, 4), fromBrass(ri(0, 500))), id: 'intrus' } : null;
    const gameTime = ri(0, 5 * MINUTES_PER_DAY);
    const morts = new Set(ids.filter(() => ri(0, 3) === 0));
    banc.setState((s) => {
      const perHero = { ...s.interlude!.perHero };
      for (const id of ids) {
        const did = ri(0, 1) === 1;
        perHero[id] = { ...perHero[id], didRevenus: did, revenueBrass: did ? ri(0, 600) : 0,
          ...(ri(0, 4) < 2 ? { closeOps: [{ ops: [{ op: 'condition', id: { id: 'extenue' }, value: 1 }], ctx: { label: 'Sonde' } }] } : {}) };
      }
      return {
        gameTime,
        bank: ri(0, 4) < 3 ? [{ uid: 'depot-sonde', heroId: ids[0], kind: 'planque' as const, brass: ri(1, 900), rate: 0 }] : [],
        pendingOrders: ri(0, 4) < 2 ? [{ heroId: ids[0], trappingId: 'dague' }] : [],
        party: [...s.party.map((h) => (morts.has(h.id) ? { ...h, dead: true } : h)), ...(intrus ? [intrus] : [])],
        interlude: { ...s.interlude!, perHero },
      };
    });
    const s0 = banc.getState();
    const vivants = s0.party.filter((h) => s0.interlude!.perHero[h.id] && !h.dead);
    const devis = devisDeCloture(s0)!;
    // Oracle (LDB 23 l.15, l.33, l.191), écrit sans le devis.
    expect({ gaspille: devis.gaspille, retro: devis.retrogradations.map((r) => r.heroId), reprise: devis.reprise, conserve: devis.conserve, lots: devis.lots.map((l) => l.heroId) }).toEqual({
      gaspille: s0.party.reduce((a, h) => a + toBrass(bourseOf(h)), 0),
      retro: vivants.filter((h) => (h.careerLevel ?? 1) >= 3 && !s0.interlude!.perHero[h.id].didRevenus).map((h) => h.id),
      reprise: gameTime + premiereNuit(gameTime) + (weeks * 7 - 1) * MINUTES_PER_DAY,
      conserve: s0.bank.reduce((a, b) => a + b.brass, 0),
      lots: vivants.filter((h) => s0.interlude!.perHero[h.id].closeOps).map((h) => h.id),
    });
    banc.actions.fenetreValider('interlude');
    const s1 = banc.getState();
    expect({
      interlude: s1.interlude,
      bourses: s1.party.map((h) => toBrass(bourseOf(h))),
      niveaux: s1.party.map((h) => h.careerLevel ?? 1),
      bank: s1.bank,
      gameTime: s1.gameTime,
      extenues: s1.party.filter((h) => hasCondition(h, 'extenue')).map((h) => h.id),
    }, 'le geste applique le devis').toEqual({
      interlude: null,
      bourses: s0.party.map((h) => devis.revenus.find((r) => r.heroId === h.id)?.brass ?? 0),
      niveaux: s0.party.map((h) => devis.retrogradations.find((r) => r.heroId === h.id)?.niveau ?? h.careerLevel ?? 1),
      bank: s0.bank,
      gameTime: devis.reprise,
      extenues: devis.lots.map((l) => l.heroId),
    });
  });
});

describe('Pertes d’argent des Événements — la bourse que l’Événement désigne', () => {
  const deux = () => [heros('A', 1, 1, { gold: 10, silver: 0, brass: 0 }), heros('B', 2, 1, { gold: 10, silver: 0, brass: 0 })];

  it('Kleptomane : la moitié de la bourse du seul héros qui l’a tiré (LDB 22 l.115)', () => {
    expect(bourses(apresLeTirage(deux(), [KLEPTO, SANS_EFFET]))).toEqual([1200, 2400]);
  });

  it('Prévôt tiré deux fois : 30 % de chaque bourse, une fois (LDB 22 l.36)', () => {
    expect(bourses(apresLeTirage(deux(), [PREVOT, PREVOT]))).toEqual([1680, 1680]);
  });

  it('Prévôt et Kleptomane : chacun perd 30 %, le Kleptomane aussi la moitié de sa bourse d’avant les Activités', () => {
    expect(bourses(apresLeTirage(deux(), [PREVOT, KLEPTO]))).toEqual([1680, 480]);
  });
});
