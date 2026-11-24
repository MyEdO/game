/**
 * LA DOSE D'UNE HERBE OU D'UNE POTION, sans store (#4839) : un même buveur ne prend qu'une dose de l'objet par
 * période (rencontre, jour de jeu, Blessure Critique subie) ; la dose de trop est refusée et dite, l'objet gardé, par
 * le verdict unique `refusDeConsommer`, celui que rend aussi le geste `utiliser` de `gestesDeLObjet`. La période
 * suivante la rouvre. LDB 72 l.22, l.24, l.28, l.30
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { addCondition } from '../engine/conditions';
import { itemFromTrappingById } from '../engine/items';
import { MINUTES_PER_DAY } from '../engine/clock';
import { entreeEnRencontre, sortieDeRencontre } from '../engine/persistence';
import { resolveCritique } from '../engine/critical';
import { desEnSuite } from '../engine/dice.testkit';
import type { Combatant } from '../engine/types';
import { gestesDeLObjet } from './gestesDeLObjet';
import { applyCriticalToTarget } from './combatFlow';

/** Un banc dont le Vétéran porte deux doses du produit `trappingId` (uids `dose-1`, `dose-2`), sa fiche ajustée par
 *  `fiche`. */
function avecDeuxDoses(trappingId: string, fiche: (h: Combatant) => void = () => {}): Banc {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Vétéran', seed: 1601 });
  h.items = [...(h.items ?? []), ...['dose-1', 'dose-2'].map((uid) => ({ ...itemFromTrappingById(trappingId, idsDeTest)!, uid }))];
  fiche(h);
  return ouvrirLeBanc({ graine: 7, etat: { party: [h] } });
}

const veteran = (banc: Banc) => banc.getState().party[0];
const porte = (banc: Banc, uid: string) => !!veteran(banc).items?.some((i) => i.uid === uid);

/** Joue `geste` : les lignes qu'il ajoute au journal. */
function journalDe(banc: Banc, geste: () => void): string[] {
  const avant = banc.getState().journal.length;
  geste();
  return banc.getState().journal.slice(avant);
}

/** Retouche la fiche du Vétéran. */
function retoucher(banc: Banc, f: (h: Combatant) => void): void {
  const h = structuredClone(veteran(banc));
  f(h);
  banc.setState({ party: [h] });
}

const grandBlesse = (h: Combatant) => { h.wounds = { ...h.wounds, current: 1 }; };

describe('Dose — une par période et par buveur', () => {
  it('Potion de guérison : la seconde de la rencontre est refusée et dite, comme le geste de la fiche la ferme', () => {
    const banc = avecDeuxDoses('potion-de-guerison', grandBlesse);
    banc.actions.utiliserLObjet('dose-1');
    expect(porte(banc, 'dose-1'), 'la première est bue').toBe(false);
    const refus = 'Vétéran a déjà pris sa dose de Potion de guérison dans cette rencontre : l’objet est gardé.';
    expect(gestesDeLObjet(banc.getState(), veteran(banc).id, 'dose-2')?.utiliser?.refus).toBe(refus);
    expect(journalDe(banc, () => banc.actions.utiliserLObjet('dose-2'))).toEqual([refus]);
    expect(porte(banc, 'dose-2'), 'l’objet est gardé').toBe(true);
  });

  it('En combat : la seconde Potion de la rencontre est refusée, la dose suit le héros hors du combat, le combat suivant la rouvre', () => {
    const banc = avecDeuxDoses('potion-de-guerison', grandBlesse);
    const h = veteran(banc);
    const H = { ...entreeEnRencontre(h), pos: { x: 1, y: 1 } };
    const E = { ...entreeEnRencontre(h), id: 'ennemi', kind: 'ennemi' as const, items: [], pos: { x: 3, y: 1 } };
    banc.setState({ battle: { combatants: [H, E], order: [H.id, E.id], turn: 0, round: 1, acted: false, log: [], over: null } as never });
    banc.actions.utiliserLObjet('dose-1');
    banc.actions.utiliserLObjet('dose-2');
    expect(banc.getState().refus?.texte).toBe('Vétéran a déjà pris sa dose de Potion de guérison dans cette rencontre : l’objet est gardé.');
    const combattant = banc.getState().battle!.combatants.find((c) => c.id === h.id)!;
    expect(['dose-1', 'dose-2'].map((uid) => !!combattant.items?.some((i) => i.uid === uid)), 'la première bue, la seconde gardée').toEqual([false, true]);
    const sorti = sortieDeRencontre(h, combattant);
    expect(sorti.dosesDeRencontre, 'la dose suit le héros hors du combat').toEqual(['potion-de-guerison']);
    expect(entreeEnRencontre(sorti).dosesDeRencontre, 'le combat suivant la rouvre').toEqual([]);
  });

  it('Soude commune : une par rencontre', () => {
    const banc = avecDeuxDoses('soude-commune', (h) => addCondition(h, 'sonne', 2));
    banc.actions.utiliserLObjet('dose-1');
    expect(journalDe(banc, () => banc.actions.utiliserLObjet('dose-2')))
      .toEqual(['Vétéran a déjà pris sa dose de Soude commune dans cette rencontre : l’objet est gardé.']);
  });

  it('Racine de terre : une par jour, le jour suivant la rouvre', () => {
    const banc = avecDeuxDoses('racine-de-terre');
    banc.actions.utiliserLObjet('dose-1');
    expect(journalDe(banc, () => banc.actions.utiliserLObjet('dose-2')))
      .toEqual(['Vétéran a déjà pris sa dose de Racine de terre aujourd’hui : l’objet est gardé.']);
    banc.setState({ gameTime: banc.getState().gameTime + MINUTES_PER_DAY });
    banc.actions.utiliserLObjet('dose-2');
    expect(porte(banc, 'dose-2'), 'bue le jour suivant').toBe(false);
  });

  it('Faxtoryll : une par Blessure Critique, la Critique suivante la rouvre', () => {
    const hemorragique = (h: Combatant) => addCondition(h, 'hemorragique', 2);
    const banc = avecDeuxDoses('faxtoryll', hemorragique);
    banc.actions.utiliserLObjet('dose-1');
    retoucher(banc, hemorragique);
    expect(journalDe(banc, () => banc.actions.utiliserLObjet('dose-2')))
      .toEqual(['Vétéran a déjà pris sa dose de Faxtoryll depuis sa dernière Blessure Critique : l’objet est gardé.']);
    retoucher(banc, (h) => {
      const crit = resolveCritique('ldb', h, 'brasD', desEnSuite([5], { boucle: true, borne: true }), { overkill: 0 });
      applyCriticalToTarget(h, 'brasD', 0, [], () => {}, { prerolled: crit, suppressReveal: true, get: banc.getState });
    });
    banc.actions.utiliserLObjet('dose-2');
    expect(porte(banc, 'dose-2'), 'appliqué sur la nouvelle Critique').toBe(false);
  });

  it('Potion de vitalité, sans Dose : se boit à volonté', () => {
    const banc = avecDeuxDoses('potion-de-vitalite', (h) => addCondition(h, 'extenue', 2));
    banc.actions.utiliserLObjet('dose-1');
    retoucher(banc, (h) => addCondition(h, 'extenue', 1));
    banc.actions.utiliserLObjet('dose-2');
    expect([porte(banc, 'dose-1'), porte(banc, 'dose-2')]).toEqual([false, false]);
  });
});
