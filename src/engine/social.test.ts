import { idsDeTest } from './idsDeTest.testkit';
import { describe, it, expect, afterEach } from 'vitest';
import { setRule, resetRule } from './policy';
import { statusCharmMod, statusCharmLabel, decalerLeStatut, tirerLaReactionAuStatut } from './social';
import { sousLeDe } from '../data/deDeLaTable.testkit';
import type { Status } from './money';
import { createHero } from './character';
import { applyOps } from './ops';
import { desDuTest, deSelonLaPlage, desEnSuite } from './dice.testkit';
import { conditionCtx, evalCondition } from './flowCore';

const S = (tier: Status['tier'], standing: number): Status => ({ tier, standing });


afterEach(() => {
  resetRule('social-reaction-au-statut');
  resetRule('social-mendicite-statut');
  resetRule('social-statut-meme-echelon');
});

describe('statusCharmMod — inter-Échelon (RAW de base, LDB 08 l.57)', () => {
  it('actor d’un Échelon SUPÉRIEUR → +10', () => {
    expect(statusCharmMod(S('or', 1), S('argent', 5))).toBe(10);
    expect(statusCharmMod(S('argent', 1), S('bronze', 5))).toBe(10);
    expect(statusCharmMod(S('or', 2), S('bronze', 3))).toBe(10);
  });
  it('actor d’un Échelon INFÉRIEUR → −10', () => {
    expect(statusCharmMod(S('bronze', 5), S('argent', 1))).toBe(-10);
    expect(statusCharmMod(S('argent', 5), S('or', 1))).toBe(-10);
  });
  it('même Échelon (toutes options off) → 0 même à Standing différent', () => {
    expect(statusCharmMod(S('argent', 5), S('argent', 1))).toBe(0);
    expect(statusCharmMod(S('bronze', 1), S('bronze', 3))).toBe(0);
  });
});

describe('statusCharmMod — intra-Échelon (option social-statut-meme-echelon, l.88)', () => {
  it('gaté par la règle : sans elle, 0', () => {
    expect(statusCharmMod(S('argent', 5), S('argent', 1))).toBe(0);
  });
  it('avec la règle : ±10 selon le Standing', () => {
    setRule('social-statut-meme-echelon', true);
    expect(statusCharmMod(S('argent', 5), S('argent', 1))).toBe(10);
    expect(statusCharmMod(S('argent', 1), S('argent', 5))).toBe(-10);
    expect(statusCharmMod(S('bronze', 3), S('bronze', 3))).toBe(0); // Standing égal → 0
  });
  it('n’affecte pas l’inter-Échelon (qui reste ±10)', () => {
    setRule('social-statut-meme-echelon', true);
    expect(statusCharmMod(S('or', 1), S('bronze', 5))).toBe(10);
  });
});

describe('statusCharmMod — mendicité (option social-mendicite-statut, l.92)', () => {
  it('Bronze → Argent + begging : +10 au lieu de −10', () => {
    setRule('social-mendicite-statut', true);
    expect(statusCharmMod(S('bronze', 2), S('argent', 1), { begging: true })).toBe(10);
  });
  it('sans begging (option active mais flag faux) : reste −10', () => {
    setRule('social-mendicite-statut', true);
    expect(statusCharmMod(S('bronze', 2), S('argent', 1))).toBe(-10);
  });
  it('uniquement Bronze → Argent (pas Bronze → Or)', () => {
    setRule('social-mendicite-statut', true);
    expect(statusCharmMod(S('bronze', 2), S('or', 1), { begging: true })).toBe(-10);
  });
  it('option off : begging ignoré → −10', () => {
    expect(statusCharmMod(S('bronze', 2), S('argent', 1), { begging: true })).toBe(-10);
  });
});

/** LDB 08 l.40-46 : « lancez 1d10 et consultez le tableau suivant : » | 1-2 Braver le Statut | 3-8
 *  Réactions classiques | 9-10 Opinions extrêmes |. */
describe('tirerLaReactionAuStatut — la table de Réaction au Statut (LDB 08 l.40-46)', () => {
  it.each([
    [1, 'braver-le-statut'], [2, 'braver-le-statut'],
    [3, 'reactions-classiques'], [8, 'reactions-classiques'],
    [9, 'opinions-extremes'], [10, 'opinions-extremes'],
  ] as const)('face %i → %s', (face, issue) => {
    expect(tirerLaReactionAuStatut(desEnSuite([face]))).toBe(issue);
  });

  it('le tirage se fait au dé que porte la table', () => {
    sousLeDe('reactionAuStatut', 'd4', () => {
      const plages: [number, number][] = [];
      tirerLaReactionAuStatut(deSelonLaPlage((min, max) => { plages.push([min, max]); return max; }));
      expect(plages).toEqual([[1, 4]]);
    });
  });
});

describe('statusCharmMod — issue de la Réaction au Statut (option social-reaction-au-statut)', () => {
  it('« Braver le Statut » → 0', () => {
    expect(statusCharmMod(S('or', 1), S('bronze', 1), { reaction: 'braver-le-statut' })).toBe(0);
  });
  it('« Réactions classiques » → mod inchangé', () => {
    expect(statusCharmMod(S('or', 1), S('bronze', 1), { reaction: 'reactions-classiques' })).toBe(10);
    expect(statusCharmMod(S('bronze', 1), S('or', 1), { reaction: 'reactions-classiques' })).toBe(-10);
  });
  it('« Opinions extrêmes » → mod inversé (Or>Bronze +10 → −10 ; Bronze<Or −10 → +10)', () => {
    expect(statusCharmMod(S('or', 1), S('bronze', 1), { reaction: 'opinions-extremes' })).toBe(-10);
    expect(statusCharmMod(S('bronze', 1), S('or', 1), { reaction: 'opinions-extremes' })).toBe(10);
  });
  it('enveloppe aussi un mod de 0 (rien à inverser)', () => {
    expect(statusCharmMod(S('argent', 3), S('argent', 1), { reaction: 'opinions-extremes' })).toBe(-0);
  });
});

describe('statusCharmMod — défaut (toutes règles off)', () => {
  it('seul le ±10 inter-Échelon RAW s’applique ; aucune option ne change un Test', () => {
    expect(statusCharmMod(S('or', 1), S('bronze', 5))).toBe(10);
    expect(statusCharmMod(S('bronze', 5), S('or', 1))).toBe(-10);
    expect(statusCharmMod(S('argent', 1), S('argent', 5))).toBe(0); // intra off
    expect(statusCharmMod(S('bronze', 2), S('argent', 1), { begging: true })).toBe(-10); // begging off
  });
});

describe('statusCharmLabel', () => {
  it('inter-Échelon : libellé orienté', () => {
    expect(statusCharmLabel(S('argent', 3), S('bronze', 2))).toBe('Statut (Argent>Bronze) +10');
    expect(statusCharmLabel(S('bronze', 2), S('or', 1))).toBe('Statut (Bronze<Or) −10');
  });
  it('même Échelon sans mod → undefined', () => {
    expect(statusCharmLabel(S('argent', 3), S('argent', 1))).toBeUndefined();
  });
  it('intra-Échelon (option) compare le Standing', () => {
    setRule('social-statut-meme-echelon', true);
    expect(statusCharmLabel(S('argent', 5), S('argent', 1))).toBe('Statut (Argent 5>1) +10');
  });
  it('mendicité : mentionne le mode', () => {
    setRule('social-mendicite-statut', true);
    expect(statusCharmLabel(S('bronze', 2), S('argent', 1), { begging: true })).toBe('Statut (mendicité Bronze>Argent) +10');
  });
});

describe('Statut EFFECTIF — le Standing temporaire de Réputation compte pendant l’aventure (LDB 23 l.234)', () => {
  it('un héros Argent 1 passe la Condition « au moins Argent 2 » une fois son Standing monté de +1', () => {
    const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Vétéran', seed: 1601 });
    const cond = { kind: 'status' as const, atLeast: 'Argent 2' };
    const ctx = () => conditionCtx({ flags: {}, gameTime: 0, party: [h] });
    expect(evalCondition(cond, ctx()), 'témoin : Argent 1 de carrière').toBe(false);
    applyOps(h, [{ op: 'statusMod', amount: 1 }], { idNeuf: idsDeTest, rng: desDuTest, label: 'Réputation' });
    expect(evalCondition(cond, ctx())).toBe(true);
  });
});

describe('decalerLeStatut — le Standing qui atteint 0 fait descendre l’Échelon (LDB 08 l.101)', () => {
  it.each([
    [S('bronze', 1), -1, S('bronze', 0)],
    [S('argent', 1), -1, S('bronze', 5)],
    [S('or', 1), -1, S('argent', 5)],
    [S('bronze', 0), -1, S('bronze', 0)],
    [S('bronze', 2), -1, S('bronze', 1)],
    [S('bronze', 0), 1, S('bronze', 1)],
    [S('or', 5), 2, S('or', 7)],
  ])('%o décalé de %i → %o', (statut, delta, attendu) => {
    expect(decalerLeStatut(statut, delta)).toEqual(attendu);
  });
});
