/**
 * Surincantation jugée par le NOYAU (#3059) : ce qu'un hôte sans écran (hôte texte, invité) envoie à
 * `castAllocOvercast` passe par la même règle que ce que la modale propose (`overcastAxesFor`,
 * `castOvercastBudget`). Le jet se pose par ses coutures : `castRoll`, puis `castSetForcedRoll`.
 * Axes : `LDB 47 l.15`, `l.17`, `l.27`, `l.28` ; `LDB 41 l.21-27` ; `LDB 42 l.11` ; `VDM 02 l.199`.
 * Budget : `LDB 47 l.17`, `l.21` ; `LDB 46 l.31`, `l.156`. Décision #3059 (issuecomment-6452965421).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { creerPartie, etatInitialDuJeu, type EntreesDeLaPartie, type Partie } from './index';
import { pregen, PREGEN } from '../data/pregens';
import { spells, type SpellData } from '../data/index';
import { setDataset } from '../data/overrides';
import { findSpellById } from '../data/index';
import { overcastAxesFor, type OvercastAxis } from '../engine/overcast';
import { castAfterCrit, castOvercastBudget } from '../engine/magic';
import { castOvercastAxes, aiOvercastPlan } from './combatFlow';

const ENTREES: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: true, persisterLeHeros: () => {} };

/** Sort d'épreuve : seuls Portée, Cible, Durée, famille et NI comptent ici. */
const sort = (id: string, champs: Pick<SpellData, 'family' | 'range' | 'target' | 'duration' | 'cn'>): SpellData => ({
  id, type: 'spells', label: id, ecole: 'Épreuve', subType: null, desc: '', effects: { kind: 'seq', steps: [] },
  source: { book: 'livre-de-base', page: 243 }, ...champs,
} as SpellData);

const UN = { kind: 'count', n: 1 } as const;
const ROUNDS = { kind: 'rounds', value: { charOf: 'force-mentale' } } as const;
const FIXTURES = {
  vous: sort('epreuve-vous', { family: 'arcane', cn: 0, range: { kind: 'self' }, target: { kind: 'self' }, duration: ROUNDS }),
  contactSort: sort('epreuve-contact-sort', { family: 'arcane', cn: 0, range: { kind: 'touch' }, target: UN, duration: ROUNDS }),
  contactBeni: sort('epreuve-contact-beni', { family: 'beni', cn: null, range: { kind: 'touch' }, target: UN, duration: ROUNDS }),
  minutes: sort('epreuve-minutes', { family: 'arcane', cn: 0, range: { kind: 'distance', value: 6, unit: 'm' }, target: UN, duration: { kind: 'clock', value: 1, unit: 'minutes' } }),
  instantane: sort('epreuve-instantane', { family: 'arcane', cn: 0, range: { kind: 'distance', value: 6, unit: 'm' }, target: UN, duration: { kind: 'instant' } }),
  grimoire: sort('epreuve-grimoire', { family: 'arcane', cn: 2, range: { kind: 'distance', value: 6, unit: 'm' }, target: UN, duration: ROUNDS }),
  critique: sort('epreuve-critique', { family: 'arcane', cn: 0, range: { kind: 'distance', value: 6, unit: 'm' }, target: UN, duration: ROUNDS }),
  puissanceVdm: sort('epreuve-puissance-vdm', { family: 'arcane', cn: 5, range: { kind: 'distance', value: 6, unit: 'm' }, target: UN, duration: ROUNDS }),
  puissance: sort('epreuve-puissance', { family: 'arcane', cn: 30, range: { kind: 'distance', value: 6, unit: 'm' }, target: UN, duration: ROUNDS }),
  priere: sort('epreuve-priere', { family: 'beni', cn: 4, range: { kind: 'distance', value: 6, unit: 'm' }, target: UN, duration: ROUNDS }),
} satisfies Record<string, SpellData>;

const original = [...spells];
beforeAll(() => { setDataset('spells', [...original, ...Object.values(FIXTURES)]); });
afterAll(() => { setDataset('spells', original); });

/** Lanceur maîtrisant Langue (Magick) et Prière : le dé fixé 03 réussit largement les deux. */
function lanceur() {
  const h = pregen(PREGEN.sorcier);
  h.id = 'L'; h.label = 'L';
  h.skills = [
    ...h.skills.filter((s) => s.id !== 'langue' && s.id !== 'priere'),
    { id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 60 },
    { id: 'priere', characteristic: 'sociabilite', advances: 60 },
  ] as typeof h.skills;
  return h;
}

/** Ouvre l'incantation de `spell` hors combat, pose le jet par ses coutures (`castRoll`, dé fixé `de`),
 *  joue `corps` puis ferme la partie. */
function lancer(spell: SpellData, corps: (partie: Partie) => void, extra: { grimoire?: true } = {}, de = 3, reglesMaison: Record<string, unknown> = {}): void {
  const L = lanceur();
  const partie = creerPartie({
    ...etatInitialDuJeu(), party: [L],
    pendingCast: { casterId: L.id, targetId: L.id, spellId: spell.id, missile: false, focused: false, result: null, ...extra },
  }, { ...ENTREES, reglesMaison });
  try {
    partie.envoyer({ type: 'castRoll', args: [] });
    partie.envoyer({ type: 'castSetForcedRoll', args: [de] });
    expect(partie.etat().pendingCast?.result, `${spell.id} n'a pas de jet`).toBeTruthy();
    corps(partie);
  } finally {
    partie.fermer();
  }
}

/** Pas alloués à `axis` après `n` demandes d'un pas. */
function allouer(partie: Partie, axis: OvercastAxis, n = 1): number {
  for (let i = 0; i < n; i++) partie.envoyer({ type: 'castAllocOvercast', args: [axis, 1] });
  return partie.etat().pendingCast?.overcast?.[axis] ?? 0;
}

describe('Surincantation — axes jugés par le noyau pour CE sort', () => {
  it('Portée « Vous » : aucun pas de Portée ni de Cibles (`LDB 47 l.15`)', () => {
    lancer(FIXTURES.vous, (p) => {
      expect(allouer(p, 'range')).toBe(0);
      expect(allouer(p, 'targets')).toBe(0);
    });
  });
  it('Portée « Contact » : refusée à un Sort (`LDB 47 l.15`), permise à une Bénédiction (`LDB 41 l.27`)', () => {
    lancer(FIXTURES.contactSort, (p) => {
      expect(allouer(p, 'range')).toBe(0);
      expect(allouer(p, 'targets'), 'les Cibles d’un Contact restent extensibles').toBe(1);
    });
    lancer(FIXTURES.contactBeni, (p) => expect(allouer(p, 'range')).toBe(1));
  });
  it('Durée en minutes : prolongeable ; Instantané : non (`LDB 47 l.15`)', () => {
    expect(castOvercastAxes({ missile: false }, FIXTURES.minutes)).toContain('duration');
    lancer(FIXTURES.minutes, (p) => expect(allouer(p, 'duration')).toBe(1));
    lancer(FIXTURES.instantane, (p) => {
      expect(allouer(p, 'duration')).toBe(0);
      expect(allouer(p, 'zone'), 'un sort sans Zone d’effet ne s’agrandit pas').toBe(0);
    });
  });
});

describe('Surincantation — Portée chiffrée et Cible « Vous »', () => {
  it('la Portée reste extensible, les Cibles non (`LDB 47 l.15`, `VDM 02 l.199`)', () => {
    for (const id of ['portail-d-ombre', 'oeil-de-l-aigle']) {
      const spell = findSpellById(id)!;
      expect(spell, id).toMatchObject({ range: { kind: 'distance' }, target: { kind: 'self' } });
      expect(overcastAxesFor(spell, false), id).toContain('range');
      expect(overcastAxesFor(spell, false), id).not.toContain('targets');
    }
    lancer(findSpellById('oeil-de-l-aigle')!, (p) => {
      expect(allouer(p, 'range')).toBe(1);
      expect(allouer(p, 'targets')).toBe(0);
    });
  });
  it('Portée et Cible « Vous » (Lance de Myrmidia) : ni Portée ni Cibles (`LDB 42 l.11`)', () => {
    const axes = overcastAxesFor(findSpellById('lance-de-myrmidia')!, false);
    expect(axes).not.toContain('range');
    expect(axes).not.toContain('targets');
  });
});

describe('Surincantation — budget sur le NI effectif du jet', () => {
  it('lecture au grimoire : le surplus se compte au-delà du NI DOUBLÉ (`LDB 47 l.21`)', () => {
    lancer(FIXTURES.grimoire, (p) => {
      const { sl, niRequired } = p.etat().pendingCast!.result!;
      expect(niRequired, 'le jet porte le NI doublé').toBe(4);
      expect(allouer(p, 'duration', 20)).toBe(Math.floor((sl - 4) / 2));
    }, { grimoire: true });
  });
  it('Prière : tout le DR, le NI imprimé ne compte pas (`LDB 41 l.21`)', () => {
    lancer(FIXTURES.priere, (p) => {
      const { sl } = p.etat().pendingCast!.result!;
      expect(allouer(p, 'duration', 20)).toBe(Math.floor(sl / 2));
    });
  });
  it('« Puissance totale » sur un jet sous le NI : le Sort part, sans aucun pas (`LDB 46 l.31`)', () => {
    lancer(FIXTURES.puissance, (p) => {
      const res = p.etat().pendingCast!.result!;
      expect(res, 'le double 11 est une Incantation Critique qui ne lance pas le Sort').toMatchObject({ cast: false, isCritical: true });
      p.envoyer({ type: 'castSetCritChoice', args: ['puissance'] });
      expect(castAfterCrit(res, 'puissance', false)).toBe(true);
      expect(allouer(p, 'duration', 20)).toBe(0);
    }, {}, 11);
  });
  it('« Puissance totale » sous `magic-vdm-incantation` : les dizaines ne donnent aucun pas à un jet sous le NI (`VDM 02 l.55`)', () => {
    lancer(FIXTURES.puissanceVdm, (p) => {
      const res = p.etat().pendingCast!.result!;
      expect(res, 'le double 88 réussit sous le NI 5').toMatchObject({ cast: false, isCritical: true });
      expect(res.sl + 8, 'les dizaines du lancer dépassent le NI').toBeGreaterThanOrEqual(5 + 2);
      p.envoyer({ type: 'castSetCritChoice', args: ['puissance'] });
      expect(allouer(p, 'duration', 20)).toBe(0);
    }, {}, 88, { 'magic-vdm-incantation': true });
  });
  it('Sort dissipé : ni lancé, ni budget, ni plan de l’IA (`LDB 46 l.156`)', () => {
    lancer(FIXTURES.critique, (p) => {
      const pc = p.etat().pendingCast!;
      const L = p.etat().party.find((c) => c.id === pc.casterId)!;
      const ennemi = { ...L, id: 'E', label: 'E', kind: 'enemy' as const, pos: { x: 1, y: 0 } };
      const lanceurPose = { ...L, pos: { x: 0, y: 0 } };
      const plan = (r: typeof pc.result & object) => aiOvercastPlan(lanceurPose, 'X', FIXTURES.critique, r, [lanceurPose, ennemi], undefined, false);
      expect(plan(pc.result!), 'témoin : le jet lancé a un plan').toHaveProperty('extraTargetIds', ['E']);
      // Forme que pose l'issue d'un Contre-sort gagnant (`applyCounterspellOutcome`).
      const dissipe = { ...pc.result!, cast: false, dispelled: true };
      for (const choix of [undefined, 'puissance'] as const) {
        expect(castAfterCrit(dissipe, choix, false)).toBe(false);
        expect(castOvercastBudget(FIXTURES.critique, dissipe, choix, false)).toBe(0);
      }
      expect(plan(dissipe)).toEqual({});
    }, {}, 11);
  });
});

describe('Surincantation — un budget changé remet l’allocation à zéro', () => {
  it('effet d’Incantation Critique changé après 2 pas : l’allocation retombe (décision #3059)', () => {
    lancer(FIXTURES.critique, (p) => {
      expect(p.etat().pendingCast!.result, 'le double 11 lance le Sort de NI 0').toMatchObject({ cast: true, isCritical: true });
      p.envoyer({ type: 'castSetCritChoice', args: ['puissance'] });
      expect(allouer(p, 'duration', 2)).toBe(2);
      p.envoyer({ type: 'castSetCritChoice', args: ['puissance'] });
      expect(p.etat().pendingCast!.overcast?.duration, 'le même effet ne change rien').toBe(2);
      p.envoyer({ type: 'castSetCritChoice', args: ['ineluctable'] });
      expect(p.etat().pendingCast!.overcast).toBeUndefined();
    }, {}, 11);
  });  it('« +1 DR » de Chance après 2 pas : l’allocation retombe (décision #3059)', () => {
    lancer(FIXTURES.critique, (p) => {
      expect(allouer(p, 'duration', 2)).toBe(2);
      const sl = p.etat().pendingCast!.result!.sl;
      p.envoyer({ type: 'castBonusSL', args: [] });
      expect(p.etat().pendingCast!.result!.sl, 'la Chance a ajouté son DR').toBe(sl + 1);
      expect(p.etat().pendingCast!.overcast).toBeUndefined();
    });
  });
});
