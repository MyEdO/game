/**
 * Progression d'un héros au modèle `'5e'` (`MODELES_DE_PROGRESSION`), jouée par les gestes du noyau : Augmentations de
 * +5 au barème du CRB, Talents à 100 PX, hors carrière, cases de carrière, passage et changement de carrière,
 * Entraînement et Apprentissage. CRB 018 l.19-27, l.67-73 ; CRB 045 ; CRB 048 l.25, l.45, l.72,
 * l.214-226
 */
import { describe, it, expect } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineCascade } from './cascade.testkit';
import { pratiquer } from './interlude.testkit';
import { createHero } from '../engine/character';
import { avecObjet, itemFromTrappingById, contexteDeNaissanceDObjet } from '../engine/items';
import { coutDeLAugmentation } from '../engine/advancement';
import { casesDuNiveau } from '../engine/casesDeCarriere';
import { cleDEntrainement, entrainementOptions, learnableTalents } from '../engine/activities';
import { buildAdvancementView } from './monde/advancement';
import { creditBourse, partyMoneyTotal } from './bourseFlow';
import { fromBrass, toBrass, PA_PER_SC } from '../engine/money';
import { testScene } from '../scenes/test-fixture';
import type { CharKey, Combatant } from '../engine/types';
import { memeSpecialisation } from '../data/schemas/grammaire/ref';

/** Un Voleur (Rôdeur, niveau 1 : Initiative, Agilité, Force Mentale) au modèle `progression`, sans Augmentation, Agilité
 *  27, 100 000 PX : le modèle se pose sur le héros créé, la création au modèle 5e relevant du lot B de #4898. */
function voleur(progression?: '5e'): Combatant {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'voleur', label: 'V', seed: 1 });
  h.characteristics.agilite = 27;
  h.charAdvances = {};
  for (const s of h.skills) s.advances = 0;
  return { ...h, xp: 100_000, ...(progression ? { progression } : {}) };
}

function banc5e(h: Combatant = voleur('5e'), reglesMaison: Record<string, unknown> = {}): { banc: Banc; lu: () => Combatant } {
  const banc = ouvrirLeBanc({ reglesMaison, etat: { party: [h] } });
  return { banc, lu: () => banc.getState().party[0] };
}

/** `n` Augmentations de Caractéristique de carrière achetées par le geste, réparties sur `chars`. */
function acheter(banc: Banc, heroId: string, chars: CharKey[], n: number): void {
  for (let i = 0; i < n; i++) banc.getState().acheterLaCaracteristique(heroId, chars[i % chars.length]);
}

describe('Augmentations au barème du CRB (CRB 045 l.15-52)', () => {
  it('Agilité 27 → 32 pour 125 PX, puis 37 pour 175 PX (CRB 045 l.17)', () => {
    const { banc, lu } = banc5e();
    banc.getState().acheterLaCaracteristique(lu().id, 'agilite');
    expect(lu().characteristics.agilite).toBe(32);
    expect(lu().xp).toBe(100_000 - 125);
    banc.getState().acheterLaCaracteristique(lu().id, 'agilite');
    expect(lu().characteristics.agilite).toBe(37);
    expect(lu().xp).toBe(100_000 - 125 - 175);
    expect(lu().charAdvances?.agilite).toBe(10);
  });
  it('Discrétion : 50 PX puis 75 PX, +5 chacune (CRB 045 l.29)', () => {
    const { banc, lu } = banc5e();
    const discretion = { id: 'discretion', spec: 'urbaine' };
    banc.getState().acheterLaCompetence(lu().id, discretion);
    expect(lu().xp).toBe(100_000 - 50);
    banc.getState().acheterLaCompetence(lu().id, discretion);
    expect(lu().xp).toBe(100_000 - 50 - 75);
    expect(lu().skills.find((s) => s.id === 'discretion' && s.spec === 'urbaine')!.advances).toBe(10);
  });
  it('de 0 à +30 en Agilité : 2 100 PX cumulés (CRB 045 l.19)', () => {
    const { banc, lu } = banc5e();
    acheter(banc, lu().id, ['agilite'], 6);
    expect(lu().xp).toBe(100_000 - 2_100);
    expect(lu().characteristics.agilite).toBe(57);
  });
  it('au-delà de la 15ᵉ Augmentation (+75), l’achat est refusé sans rien dépenser (CRB 045 l.52)', () => {
    const { banc, lu } = banc5e();
    acheter(banc, lu().id, ['agilite'], 15);
    expect(lu().charAdvances?.agilite).toBe(75);
    const xp = lu().xp;
    banc.getState().acheterLaCaracteristique(lu().id, 'agilite');
    expect(lu().charAdvances?.agilite).toBe(75);
    expect(lu().xp).toBe(xp);
    expect(coutDeLAugmentation(lu(), { kind: 'caracteristique', char: 'agilite' }).ok).toBe(false);
    expect(buildAdvancementView(banc.getState(), lu()).chars.find((c) => c.key === 'agilite')!.nextCost).toBeNull();
  });
});

describe('Talents et hors carrière (CRB 045 l.58-60 ; CRB 018 l.67-73)', () => {
  it('un Talent coûte 100 PX, à la 2ᵉ prise comme à la 1ʳᵉ', () => {
    const { banc, lu } = banc5e();
    banc.getState().acheterLeTalent(lu().id, { id: 'chat-de-gouttiere' });
    expect(lu().xp).toBe(100_000 - 100);
    banc.getState().acheterLeTalent(lu().id, { id: 'chat-de-gouttiere' });
    expect(lu().talents.find((t) => t.talentId === 'chat-de-gouttiere')!.times).toBe(2);
    expect(lu().xp).toBe(100_000 - 200);
  });
  it('au niveau 2, un Talent du niveau 1 s’achète en 5e, pas en 4e', () => {
    const niveau2 = (p?: '5e') => ({ ...voleur(p), careerLevel: 2 });
    const tient = (h: Combatant) => h.talents.some((t) => t.talentId === 'chat-de-gouttiere');
    const cinq = banc5e(niveau2('5e'));
    cinq.banc.getState().acheterLeTalent(cinq.lu().id, { id: 'chat-de-gouttiere' });
    expect(tient(cinq.lu())).toBe(true);
    const quatre = banc5e(niveau2());
    quatre.banc.getState().acheterLeTalent(quatre.lu().id, { id: 'chat-de-gouttiere' });
    expect(tient(quatre.lu())).toBe(false);
  });
  it('hors carrière : Caractéristique et Compétence de base au double, Compétence avancée et Talent fermés', () => {
    const h = voleur('5e');
    h.skills.push({ id: 'crochetage', characteristic: 'dexterite', advances: 0 }, { id: 'charme', characteristic: 'sociabilite', advances: 0 });
    const { banc, lu } = banc5e(h);
    banc.getState().acheterLaCaracteristique(lu().id, 'force');
    expect(lu().xp).toBe(100_000 - 250);
    banc.getState().acheterLaCompetence(lu().id, { id: 'charme' });
    expect(lu().xp).toBe(100_000 - 250 - 100);
    banc.getState().acheterLaCompetence(lu().id, { id: 'crochetage' });
    expect(lu().skills.find((s) => s.id === 'crochetage')!.advances).toBe(0);
    expect(buildAdvancementView(banc.getState(), lu()).skills.find((s) => s.skill.id === 'crochetage')!.refus).not.toBeNull();
    banc.getState().acheterLeTalent(lu().id, { id: 'discret' });
    expect(lu().talents.some((t) => t.talentId === 'discret')).toBe(false);
    expect(lu().xp).toBe(100_000 - 350);
  });
  it('les règles optionnelles mentor et saut de niveau du LDB ne touchent pas un héros 5e', () => {
    const regles = { 'progression-mentor': true, 'progression-saut-de-niveau': true };
    const { banc, lu } = banc5e(voleur('5e'), regles);
    banc.getState().acheterLaCaracteristique(lu().id, 'force');
    expect(lu().charAdvances?.force).toBe(5);
    expect(buildAdvancementView(banc.getState(), lu()).targets.map((c) => c.level)).toEqual([2]);
    const quatre = banc5e(voleur(), regles);
    quatre.banc.getState().acheterLaCaracteristique(quatre.lu().id, 'force');
    expect(quatre.lu().charAdvances?.force, 'témoin 4e : le mentor manque').toBeUndefined();
  });
});

describe('Cases de carrière et passage de niveau (CRB 018 l.19-27 ; CRB 048 l.25, l.45)', () => {
  it('9 cases refusent le passage au niveau 2 ; la 10ᵉ l’ouvre pour 100 PX', () => {
    const { banc, lu } = banc5e();
    acheter(banc, lu().id, ['agilite', 'initiative', 'force-mentale'], 9);
    const xp = lu().xp!;
    banc.getState().changerDeCarriere(lu().id, 'voleur', 2);
    expect(lu().careerLevel ?? 1).toBe(1);
    acheter(banc, lu().id, ['agilite'], 1);
    const avant = lu().xp!;
    expect(avant).toBeLessThan(xp);
    banc.getState().changerDeCarriere(lu().id, 'voleur', 2);
    expect(lu().careerLevel).toBe(2);
    expect(lu().xp).toBe(avant - 100);
  });
  it('12 cases au niveau 2, puis 14 au niveau 3, pour atteindre le niveau 4', () => {
    const { banc, lu } = banc5e();
    const monter = (n: number, chars: CharKey[], vers: number) => {
      acheter(banc, lu().id, chars, n - 1);
      banc.getState().changerDeCarriere(lu().id, 'voleur', vers);
      expect(lu().careerLevel ?? 1, `${n - 1} cases refusent le niveau ${vers}`).toBe(vers - 1);
      acheter(banc, lu().id, chars, 1);
      banc.getState().changerDeCarriere(lu().id, 'voleur', vers);
      expect(lu().careerLevel).toBe(vers);
    };
    monter(10, ['agilite', 'initiative'], 2);
    monter(12, ['dexterite', 'force-mentale'], 3);
    monter(14, ['force', 'initiative'], 4);
  });
  it('un Talent de carrière coche une case ; une dotation du niveau suivant reçue deux fois n’en coche qu’une', () => {
    const { banc, lu } = banc5e();
    banc.getState().acheterLeTalent(lu().id, { id: 'chat-de-gouttiere' });
    const corde = () => itemFromTrappingById('corde', banc.getState().forgerUnId, undefined, contexteDeNaissanceDObjet(lu()))!;
    banc.setState({ party: [avecObjet(avecObjet(lu(), corde()), corde())] });
    expect(lu().casesDeCarriere?.voleur?.[1]).toEqual({ achats: 1, dotations: ['corde'] });
    expect(casesDuNiveau(lu(), 'voleur', 1)).toBe(2);
  });
  it('rétrogradé par une Faveur rompue, le héros remonte au niveau perdu pour 100 PX sans nouvelle case', () => {
    const { banc, lu } = banc5e(voleur('5e'), { 'faveur-rumeur-se-repand': true });
    acheter(banc, lu().id, ['agilite', 'initiative'], 10);
    banc.getState().changerDeCarriere(lu().id, 'voleur', 2);
    banc.getState().accorderLaFaveur(lu().id, 'mineure', 'Créancier', 'Dette');
    banc.getState().rompreLaFaveur(lu().id, banc.getState().favors![0].id);
    expect(lu().careerLevel).toBe(1);
    const xp = lu().xp!;
    banc.getState().changerDeCarriere(lu().id, 'voleur', 2);
    expect(lu().careerLevel).toBe(2);
    expect(lu().xp).toBe(xp - 100);
  });
  it('redescendre volontairement dans sa carrière est refusé', () => {
    const { banc, lu } = banc5e({ ...voleur('5e'), careerLevel: 2 });
    banc.getState().changerDeCarriere(lu().id, 'voleur', 1);
    expect(lu().careerLevel).toBe(2);
  });
});

describe('Changement de carrière (CRB 048 l.72)', () => {
  it('100 PX dans la même Classe, 200 PX dans une autre, sans niveau validé, au niveau 1', () => {
    const meme = banc5e();
    meme.banc.getState().changerDeCarriere(meme.lu().id, 'charlatan', 1);
    expect(meme.lu().career).toBe('charlatan');
    expect(meme.lu().xp).toBe(100_000 - 100);
    const autre = banc5e();
    autre.banc.getState().changerDeCarriere(autre.lu().id, 'soldat', 1);
    expect(autre.lu().career).toBe('soldat');
    expect(autre.lu().xp).toBe(100_000 - 200);
  });
});

describe('Entraînement et Apprentissage hors carrière (CRB 048 l.214-226)', () => {
  function interlude(h: Combatant) {
    const banc = ouvrirLeBanc();
    banc.setState({ party: [h], battle: null, interlude: null, bank: [], pendingOrders: [], pendingActivity: null, journal: [] });
    banc.getState().lancerLaScene(testScene());
    creditBourse(banc.getState, banc.setState, h.id, fromBrass(100_000));
    banc.getState().ensemencerLeTirage(13);
    banc.getState().ouvrirLInterlude(3);
    draineCascade(banc.getState);
    const itl = banc.getState().interlude!;
    itl.perHero[h.id] = { ...itl.perHero[h.id], fx: undefined, left: 3 };
    banc.setState({ interlude: { ...itl } });
    return { banc, lu: () => banc.getState().party[0], argent: () => toBrass(partyMoneyTotal(banc.getState)) };
  }

  it('Entraînement : le tuteur coûte le prix en PX en sous de cuivre, le double pour une Compétence avancée, sans tirage', () => {
    const { banc, lu, argent } = interlude(voleur('5e'));
    const base = entrainementOptions(lu()).find((o) => o.kind === 'competence' && !o.advanced)!;
    const avancee = entrainementOptions(lu()).find((o) => o.kind === 'competence' && o.advanced)!;
    expect([base.tutorMinBrass, base.tutorMaxBrass]).toEqual([base.xpCost, base.xpCost]);
    expect([avancee.tutorMinBrass, avancee.tutorMaxBrass]).toEqual([2 * avancee.xpCost, 2 * avancee.xpCost]);
    const avant = argent();
    pratiquer(banc.getState, lu().id, 'entrainement', { entrainement: cleDEntrainement(avancee) });
    expect(argent()).toBe(avant - 2 * avancee.xpCost);
    expect(lu().skills.find((s) => s.id === avancee.id && memeSpecialisation(s.spec, avancee.spec))!.advances).toBe(5);
  });
  it('Apprentissage : premier niveau d’un Talent absent, tuteur 4d10 pistoles, sans Test', () => {
    const { banc, lu, argent } = interlude(voleur('5e'));
    const appris = learnableTalents(lu());
    expect(appris.some((o) => lu().talents.some((t) => t.talentId === o.id))).toBe(false);
    const o = appris[0];
    expect([o.xpCost, o.tutorMinBrass, o.tutorMaxBrass]).toEqual([100, 4 * PA_PER_SC, 40 * PA_PER_SC]);
    const avant = argent();
    pratiquer(banc.getState, lu().id, 'learn', { talentId: o.id });
    expect(banc.getState().pendingActivity, 'aucun Test ne s’ouvre').toBeNull();
    expect(lu().talents.find((t) => t.talentId === o.id)?.times).toBe(1);
    expect(lu().xp).toBe(100_000 - 100);
    const paye = avant - argent();
    expect(paye % PA_PER_SC).toBe(0);
    expect(paye).toBeGreaterThanOrEqual(4 * PA_PER_SC);
    expect(paye).toBeLessThanOrEqual(40 * PA_PER_SC);
  });
});
