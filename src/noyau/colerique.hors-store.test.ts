/**
 * COLÉRIQUE, de bout en bout sans store (#1463 β2) : le palier se choisit au DR, la personne se désigne,
 * l'amitié ouvre le Test de Calme Accessible, la durée suit le palier et l'horloge retire le Trait.
 * VDM 10 l.324-332. Décideur non surfacé et lecture d'« amis » : #3045.
 */
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineEtapes } from './cascade.testkit';
import { pregenParty, PREGEN } from '../data/pregens';
import { testScene } from '../scenes/test-fixture';
import { castSpell } from './combatFlow';
import { resolveFormula } from '../engine/ops';
import { desDuTest } from '../engine/dice.testkit';
import { ciblePsy } from '../engine/psych/ciblage';
import type { Combatant } from '../engine/types';
import type { CascadeStep } from './pendings';

const SOURCE = { kind: 'spell', id: 'colerique' } as const;
const HEURE = 60;

/** Ce que tranche le joueur : le palier (Haine, Animosité), la personne, le dé du Test de Calme. */
interface Gestes { haine?: boolean; animosite?: boolean; personne?: string; calme?: number }

/** L'incantation ouverte réussit à `dr` DR, puis la cascade se joue selon `gestes` ; rend ses étapes. */
function reussirEtJouer(banc: Banc, dr: number, gestes: Gestes = {}): CascadeStep[] {
  if (!banc.getState().pendingCast!.result) banc.getState().castRoll();
  const pc = banc.getState().pendingCast!;
  banc.setState({ pendingCast: { ...pc, result: { ...pc.result!, cast: true, sl: dr, isCritical: false, isFumble: false } } });
  banc.getState().castConfirm();
  const oui = (v: boolean | undefined) => (v ? 'yes' : 'no');
  return draineEtapes(banc.getState, 20, (e) => (e.kind === 'triggeredTest' ? gestes.calme : undefined), (e) => {
    if (e.kind === 'personneChoisie') return gestes.personne;
    if (e.kind !== 'triggeredChoice') return undefined;
    return e.label?.includes('Haine') ? oui(gestes.haine) : oui(gestes.animosite);
  });
}

const genres = (vues: CascadeStep[]) => vues.map((v) => v.kind);
const bfm = (lanceur: Combatant) => resolveFormula({ bonusOf: 'force-mentale' }, lanceur, desDuTest);
/** Les Traits accordés par Colérique, et l'échéance de leur effet porteur. */
const accordes = (c: Combatant) => ({
  traits: (c.psychTraits ?? []).filter((p) => p.src?.id === SOURCE.id),
  echeances: (c.activeEffects ?? []).filter((e) => e.grantedPsychTrait).map((e) => (e.duration.scale === 'clock' ? e.duration.until : null)),
});

describe('Colérique hors combat — le lanceur du groupe tranche tout (VDM 10 l.324-330)', () => {
  function auCamp() {
    const [w, s, p] = pregenParty(PREGEN.sorcier, PREGEN.soldat, PREGEN.pretre);
    const banc = ouvrirLeBanc({ graine: 7, etat: { party: [w, s, p] } });
    banc.getState().oocCastSpell(w.id, 'colerique', s.id);
    const heros = (id: string) => banc.getState().party.find((c) => c.id === id)!;
    return { banc, w, s, p, heros, maintenant: banc.getState().gameTime };
  }

  it('DR 2 : aucun palier à choisir ; Préjugé envers la personne désignée, (BFM) heures', () => {
    const { banc, w, s, p, heros, maintenant } = auCamp();
    const vues = reussirEtJouer(banc, 2, { personne: p.id, calme: 100 });
    expect(genres(vues)).toEqual(['personneChoisie', 'triggeredTest']);
    expect(vues[0].actorId, 'le lanceur désigne').toBe(w.id);
    expect(vues[0].options?.map((o) => o.key), 'une autre personne que la cible').toEqual([w.id, p.id]);
    expect(accordes(heros(s.id))).toEqual({
      traits: [{ type: 'prejuge', cible: ciblePsy.individu(p.id), src: SOURCE }],
      echeances: [maintenant + bfm(w) * HEURE],
    });
  });

  it('les deux personnes sont amies : le Test de Calme Accessible réussi annule le Sort', () => {
    const { banc, s, p, heros } = auCamp();
    const vues = reussirEtJouer(banc, 2, { personne: p.id, calme: 1 });
    const test = vues.find((v) => v.kind === 'triggeredTest')!;
    expect(test.actorId, 'la cible résiste').toBe(s.id);
    expect(test.difficulty).toBe('accessible');
    expect(accordes(heros(s.id))).toEqual({ traits: [], echeances: [] });
  });

  it('DR 5 : l’Animosité se choisit, (BFM) jours', () => {
    const { banc, w, s, p, heros, maintenant } = auCamp();
    const vues = reussirEtJouer(banc, 5, { animosite: true, personne: p.id, calme: 100 });
    expect(genres(vues)).toEqual(['triggeredChoice', 'personneChoisie', 'triggeredTest']);
    expect(vues[0].actorId).toBe(w.id);
    expect(accordes(heros(s.id))).toEqual({
      traits: [{ type: 'animosite', cible: ciblePsy.individu(p.id), src: SOURCE }],
      echeances: [maintenant + bfm(w) * 24 * HEURE],
    });
  });

  it('DR 5, Animosité refusée : le Préjugé reste', () => {
    const { banc, s, p, heros } = auCamp();
    reussirEtJouer(banc, 5, { animosite: false, personne: p.id, calme: 100 });
    expect(accordes(heros(s.id)).traits.map((t) => t.type)).toEqual(['prejuge']);
  });

  it('DR 9 : la Haine se choisit, (BFM) semaines', () => {
    const { banc, w, s, p, heros, maintenant } = auCamp();
    reussirEtJouer(banc, 9, { haine: true, personne: p.id, calme: 100 });
    expect(accordes(heros(s.id))).toEqual({
      traits: [{ type: 'haine', cible: ciblePsy.individu(p.id), src: SOURCE }],
      echeances: [maintenant + bfm(w) * 168 * HEURE],
    });
  });

  it('DR 9, Haine refusée : l’Animosité s’offre encore', () => {
    const { banc, s, p, heros } = auCamp();
    const vues = reussirEtJouer(banc, 9, { haine: false, animosite: true, personne: p.id, calme: 100 });
    expect(genres(vues)).toEqual(['triggeredChoice', 'triggeredChoice', 'personneChoisie', 'triggeredTest']);
    expect(accordes(heros(s.id)).traits.map((t) => t.type)).toEqual(['animosite']);
  });

  it('l’échéance d’horloge retire le Trait (VDM 10 l.332)', () => {
    const { banc, w, s, p, heros } = auCamp();
    reussirEtJouer(banc, 2, { personne: p.id, calme: 100 });
    banc.getState().avancerLHorloge(bfm(w) * HEURE - 1);
    expect(accordes(heros(s.id)).traits).toHaveLength(1);
    banc.getState().avancerLHorloge(1);
    expect(accordes(heros(s.id))).toEqual({ traits: [], echeances: [] });
  });
});

describe('Colérique en combat', () => {
  function enCombat(lanceur: number) {
    const [a, s, p] = pregenParty(lanceur, PREGEN.soldat, PREGEN.pretre);
    const banc = ouvrirLeBanc({ graine: 7, etat: { party: [a, s, p] } });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const [e0, e1, e2] = b.combatants.filter((c) => c.kind === 'enemy');
    const de = (id: string) => b.combatants.find((c) => c.id === id)!;
    de(a.id).pos = { x: 5, y: 15 };
    de(s.id).pos = { x: 5, y: 11 };
    de(p.id).pos = { x: 5, y: 12 };
    e0.pos = { x: 6, y: 10 };
    e1.pos = { x: 7, y: 10 };
    e2.pos = { x: 6, y: 13 };
    return { banc, de, a: de(a.id), s: de(s.id), p: de(p.id), e0, e1 };
  }

  it('un héros vise un Mutant envers un héros : pas d’amis, pas de Test de Calme', () => {
    const { banc, a, e0, e1 } = enCombat(PREGEN.sorcier);
    castSpell(banc.getState, banc.setState, a, e0, 'colerique');
    const vues = reussirEtJouer(banc, 9, { haine: true, personne: a.id });
    const designation = vues.find((v) => v.kind === 'personneChoisie')!;
    expect(designation.defaultChoice, 'la proposition par défaut est l’allié le plus proche de la cible').toBe(e1.id);
    expect(genres(vues)).not.toContain('triggeredTest');
    expect(accordes(e0).traits).toEqual([{ type: 'haine', cible: ciblePsy.individu(a.id), src: SOURCE }]);
  });

  it('un lanceur PNJ désigne l’allié le plus proche de la cible et prend le palier le plus haut (#3045)', () => {
    const { banc, s, p, e0 } = enCombat(PREGEN.chasseur);
    e0.skills.push({ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 30 } as never);
    castSpell(banc.getState, banc.setState, e0, s, 'colerique');
    const vues = reussirEtJouer(banc, 9, { calme: 100 });
    expect(genres(vues), 'rien ne se surface au camp des héros, sinon le Test de la cible').toEqual(['triggeredTest']);
    expect(accordes(s).traits).toEqual([{ type: 'haine', cible: ciblePsy.individu(p.id), src: SOURCE }]);
  });

  it('un lanceur PNJ sans allié de la cible à désigner : le Trait reste sans effet', () => {
    const [s] = pregenParty(PREGEN.soldat);
    const banc = ouvrirLeBanc({ graine: 7, etat: { party: [s] } });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const S = b.combatants.find((c) => c.id === s.id)!;
    const e0 = b.combatants.find((c) => c.kind === 'enemy')!;
    S.pos = { x: 5, y: 11 };
    e0.pos = { x: 6, y: 11 };
    e0.skills.push({ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 30 } as never);
    castSpell(banc.getState, banc.setState, e0, S, 'colerique');
    reussirEtJouer(banc, 9);
    expect(accordes(S)).toEqual({ traits: [], echeances: [] });
    expect(banc.getState().battle!.log.map((l) => l.text)).toContain('Colérique : aucune personne à désigner pour Sigmund Reikhardt, sans effet.');
  });
});
