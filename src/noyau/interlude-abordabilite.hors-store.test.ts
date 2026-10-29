/**
 * L'ABORDABILITÉ DES ACTIVITÉS D'INTERLUDE, sans store (#3059 S4) : Apprentissage particulier, Entraînement
 * et Réputation sont refusés, ET le disent, quand les PX ou la bourse PERSONNELLE du héros ne suivent pas :
 * avant le tirage du tuteur si la bourse est sous son coût minimal (le dé ne roule pas), après le tirage
 * sinon, et à la confirmation avant tout débit. Rien n'est débité, aucune Activité consommée.
 * LDB 23 l.66-72, l.132-136, l.228-234
 */
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineCascade } from './cascade.testkit';
import { battleRng } from './battleRng';
import { debitBourse } from './bourseFlow';
import { createHero } from '../engine/character';
import { bourseOf, withBourseMoney } from '../engine/bourse';
import { entrainementOptions, learnableTalents } from '../engine/activities';
import { makeRNG } from '../engine/dice';
import { fromBrass, type Money } from '../engine/money';
import { actorStatus } from '../engine/social';
import { conditionCtx, evalCondition } from '../engine/flowCore';

/** Le Talent appris : 100 PX à la première acquisition, tuteur de 2 à 20 pa. */
const TALENT = 'chanceux';
const GRAINE_DU_GESTE = 42;
/** Revenus réussis d'un Argent 1 sous `GRAINE_DU_GESTE` (oracle figé). */
const REVENUS_ARGENT_1 = 60;
/** Un Talent que le héros du banc porte déjà au Maxi : hors de la liste d'Apprentissage. */
const TALENT_AU_MAXI = 'affable';

/** Un banc sur un interlude d'une semaine, dés d'Événement posés, dont le héros a `xp` PX et `bourse`. */
function apresLeTirage(xp: number, bourse: Money): { banc: Banc; heroId: string } {
  const h = withBourseMoney(createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Vétéran', seed: 1601 }), bourse);
  h.xp = xp;
  const banc = ouvrirLeBanc({ graine: 7, desFixes: false, etat: { party: [h] } });
  banc.actions.startInterlude(1);
  draineCascade(banc.getState);
  expect(banc.getState().interlude?.phase, 'témoin : le tirage est dénoué').toBe('activities');
  expect(banc.getState().interlude?.perHero[h.id].left, 'témoin : une Activité reste').toBeGreaterThan(0);
  return { banc, heroId: h.id };
}

/** L'empreinte de ce qu'un geste d'Activité refusé ne doit pas changer. */
const empreinte = (banc: Banc) => {
  const s = banc.getState();
  return JSON.stringify([s.interlude, s.pendingActivity, s.party.map((h) => [h.xp, h.talents, h.skills, h.charAdvances, h.activeEffects, bourseOf(h)])]);
};

/** Joue `geste` sur un RNG réensemencé : les lignes qu'il ajoute au journal, et si le dé a roulé. */
function jouer(banc: Banc, geste: () => void): { journal: string[]; deRoule: boolean } {
  banc.actions.seedRng(GRAINE_DU_GESTE);
  const avant = banc.getState().journal.length;
  geste();
  return { journal: banc.getState().journal.slice(avant), deRoule: battleRng().int(1, 1e9) !== makeRNG(GRAINE_DU_GESTE).int(1, 1e9) };
}

/** Vide la bourse du héros par la couture de débit. */
function viderLaBourse(banc: Banc, heroId: string): void {
  const h = banc.getState().party.find((x) => x.id === heroId)!;
  expect(debitBourse(banc.getState, banc.setState, heroId, bourseOf(h)), 'témoin : la bourse est vidée').toBe(true);
}

/** Lance le jet d'Activité ouvert, le pose réussi, puis le confirme. */
function confirmerReussi(banc: Banc): void {
  banc.actions.activityRoll();
  banc.setState((s) => ({ pendingActivity: { ...s.pendingActivity!, roll: 10, success: true, sl: 3 } }));
  banc.actions.activityConfirm();
}

describe('Apprentissage particulier — PX et tuteur', () => {
  it('PX insuffisants : refusé et dit, avant le tirage, rien consommé', () => {
    const { banc, heroId } = apresLeTirage(50, { gold: 20, silver: 0, brass: 0 });
    const avant = empreinte(banc);
    const r = jouer(banc, () => banc.actions.interludeActivity(heroId, 'learn', { talentId: TALENT }));
    expect(r.journal).toEqual(['Vétéran : PX insuffisants (100).']);
    expect(r.deRoule, 'le tuteur a été tiré').toBe(false);
    expect(empreinte(banc)).toBe(avant);
  });

  it('bourse sous le tuteur le moins cher : refusé et dit AVANT le tirage, le dé ne roule pas', () => {
    const { banc, heroId } = apresLeTirage(300, fromBrass(23));
    const avant = empreinte(banc);
    const r = jouer(banc, () => banc.actions.interludeActivity(heroId, 'learn', { talentId: TALENT }));
    expect(r.journal).toEqual(['Vétéran : la bourse ne couvre même pas le tuteur le moins cher (2/–).']);
    expect(r.deRoule, 'le tuteur a été tiré').toBe(false);
    expect(empreinte(banc)).toBe(avant);
  });

  it('bourse entre le minimum et le tuteur tiré : refusé et dit APRÈS le tirage, rien débité', () => {
    const { banc, heroId } = apresLeTirage(300, fromBrass(24));
    const avant = empreinte(banc);
    const r = jouer(banc, () => banc.actions.interludeActivity(heroId, 'learn', { talentId: TALENT }));
    expect(r.journal).toEqual(['Vétéran : le tuteur demande 12/–, la bourse ne suit pas.']);
    expect(r.deRoule, 'témoin : le tuteur est tiré').toBe(true);
    expect(empreinte(banc)).toBe(avant);
  });

  it('bourse vidée entre l’ouverture et la confirmation : refusé et dit, ni Talent ni PX ni Activité', () => {
    const { banc, heroId } = apresLeTirage(300, { gold: 20, silver: 0, brass: 0 });
    banc.actions.interludeActivity(heroId, 'learn', { talentId: TALENT });
    const tuteur = banc.getState().pendingActivity?.tutorBrass;
    expect(tuteur, 'témoin : le tuteur tiré à l’ouverture (11 pa)').toBe(132);
    viderLaBourse(banc, heroId);
    const avant = JSON.stringify([banc.getState().interlude, banc.getState().party[0].talents, banc.getState().party[0].xp]);
    const journal = banc.getState().journal.length;
    confirmerReussi(banc);
    expect(banc.getState().journal.slice(journal)).toEqual(['Vétéran : le tuteur demande 11/–, la bourse ne suit pas.']);
    expect(JSON.stringify([banc.getState().interlude, banc.getState().party[0].talents, banc.getState().party[0].xp]), 'Talent appris, PX ou Activité dépensés').toBe(avant);
    expect(banc.getState().pendingActivity).toBeNull();
  });
});

describe('Entraînement — PX et tuteur', () => {
  it('bourse sous le tuteur le moins cher : refusé et dit AVANT le tirage, le dé ne roule pas', () => {
    const { banc, heroId } = apresLeTirage(2000, fromBrass(0));
    const opt = entrainementOptions(banc.getState().party[0]).find((o) => o.kind === 'characteristic')!;
    const avant = empreinte(banc);
    const r = jouer(banc, () => banc.actions.interludeEntrainement(heroId, opt.kind, opt.id, opt.spec));
    expect(r.journal).toEqual(['Vétéran : la bourse ne couvre même pas le tuteur le moins cher (1 sc).']);
    expect(r.deRoule, 'le tuteur a été tiré').toBe(false);
    expect(empreinte(banc)).toBe(avant);
  });

  it('PX insuffisants : refusé et dit par le verdict des PX, avant le tirage', () => {
    const { banc, heroId } = apresLeTirage(0, { gold: 20, silver: 0, brass: 0 });
    const opt = entrainementOptions(banc.getState().party[0]).find((o) => o.kind === 'characteristic')!;
    const avant = empreinte(banc);
    const r = jouer(banc, () => banc.actions.interludeEntrainement(heroId, opt.kind, opt.id, opt.spec));
    expect(r.journal).toEqual([`Vétéran : PX insuffisants (${opt.xpCost}).`]);
    expect(r.deRoule, 'le tuteur a été tiré').toBe(false);
    expect(empreinte(banc)).toBe(avant);
  });
});

describe('Réputation — la dépense débitée à la confirmation', () => {
  it('bourse vidée entre l’ouverture et la confirmation : refusé et dit, ni Statut ni Activité', () => {
    const { banc, heroId } = apresLeTirage(0, { gold: 20, silver: 0, brass: 0 });
    banc.actions.interludeActivity(heroId, 'reputation');
    expect(banc.getState().pendingActivity?.costBrass, 'témoin : la dépense est chiffrée à l’ouverture').toBeGreaterThan(0);
    viderLaBourse(banc, heroId);
    const avant = JSON.stringify([banc.getState().interlude, banc.getState().party[0].activeEffects]);
    const journal = banc.getState().journal.length;
    confirmerReussi(banc);
    expect(banc.getState().journal.slice(journal)).toEqual(['Vétéran : la bourse ne couvre pas la dépense de Réputation requise (10/–).']);
    expect(JSON.stringify([banc.getState().interlude, banc.getState().party[0].activeEffects]), 'Statut ou Activité dépensés').toBe(avant);
    expect(banc.getState().pendingActivity).toBeNull();
  });
});

describe('Apprentissage particulier — seul un Talent de la liste du volet s’apprend', () => {
  it('Talent au Maxi : refusé et dit à l’ouverture, ni tuteur tiré ni Activité', () => {
    const { banc, heroId } = apresLeTirage(5000, { gold: 20, silver: 0, brass: 0 });
    expect(learnableTalents(banc.getState().party[0]).some((o) => o.id === TALENT_AU_MAXI), 'témoin : hors de la liste').toBe(false);
    const avant = empreinte(banc);
    const r = jouer(banc, () => banc.actions.interludeActivity(heroId, 'learn', { talentId: TALENT_AU_MAXI }));
    expect(r.journal).toEqual(['Vétéran ne peut pas apprendre Affable par Apprentissage particulier (Talent de carrière, au Maxi, ou à spécialisation).']);
    expect(r.deRoule, 'le tuteur a été tiré').toBe(false);
    expect(empreinte(banc)).toBe(avant);
  });

  it('Talent devenu inapprenable avant la confirmation : refusé et dit, bourse, PX et Activité intacts', () => {
    const { banc, heroId } = apresLeTirage(5000, { gold: 20, silver: 0, brass: 0 });
    banc.actions.interludeActivity(heroId, 'learn', { talentId: TALENT });
    expect(banc.getState().pendingActivity?.talent, 'témoin : le jet est ouvert').toBe(TALENT);
    banc.setState((s) => ({ party: s.party.map((h) => (h.id === heroId ? { ...h, talents: [...h.talents, { talentId: TALENT, times: 99 }] } : h)) }));
    const horsDuJet = () => JSON.stringify([banc.getState().interlude, banc.getState().party.map((h) => [h.xp, h.talents, bourseOf(h)])]);
    const avant = horsDuJet();
    const journal = banc.getState().journal.length;
    banc.actions.activityRoll();
    banc.setState((s) => ({ pendingActivity: { ...s.pendingActivity!, roll: 10, success: true, sl: 3 } }));
    banc.actions.activityConfirm();
    expect(banc.getState().journal.slice(journal)).toEqual(['Vétéran ne peut pas apprendre Chanceux par Apprentissage particulier (Talent de carrière, au Maxi, ou à spécialisation).']);
    expect(horsDuJet(), 'bourse, PX ou Activité dépensés').toBe(avant);
  });
});

describe('Apprentissage particulier — l’achat jugé avant tout débit', () => {
  it('PX dépensés entre l’ouverture et un succès : refusé et dit, bourse et Activité intactes', () => {
    const { banc, heroId } = apresLeTirage(300, { gold: 20, silver: 0, brass: 0 });
    banc.actions.interludeActivity(heroId, 'learn', { talentId: TALENT });
    expect(banc.getState().pendingActivity?.talent, 'témoin : le jet est ouvert').toBe(TALENT);
    banc.setState((s) => ({ party: s.party.map((h) => (h.id === heroId ? { ...h, xp: 0 } : h)) }));
    const horsDuJet = () => JSON.stringify([banc.getState().interlude, banc.getState().party.map((h) => [h.xp, h.talents, bourseOf(h)])]);
    const avant = horsDuJet();
    const journal = banc.getState().journal.length;
    confirmerReussi(banc);
    expect(banc.getState().journal.slice(journal)).toEqual(['Vétéran : PX insuffisants (100).']);
    expect(horsDuJet(), 'Talent, bourse ou Activité dépensés').toBe(avant);
  });
});

describe('Mécénat — hors de son lieu', () => {
  it('refusé et dit, rien débité ni déposé, aucune Activité', () => {
    const { banc, heroId } = apresLeTirage(0, { gold: 20, silver: 0, brass: 0 });
    const avant = JSON.stringify([empreinte(banc), banc.getState().bank]);
    const r = jouer(banc, () => banc.actions.interludeBank(heroId, 'mecenat', 1200));
    expect(r.journal).toEqual(['Le Mécénat ne se pratique pas ici.']);
    expect(JSON.stringify([empreinte(banc), banc.getState().bank])).toBe(avant);
  });
});

describe('Réputation — le Standing gagné vaut pour la PROCHAINE aventure, pas pour l’interlude (LDB 23 l.234)', () => {
  it('Réputation réussie puis Revenus et seconde Réputation dans le même interlude : Standing de carrière', () => {
    const h = withBourseMoney(createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Vétéran', seed: 1601 }), { gold: 20, silver: 0, brass: 0 });
    const banc = ouvrirLeBanc({ graine: 7, desFixes: false, etat: { party: [h] } });
    banc.actions.startInterlude(3);
    draineCascade(banc.getState);
    expect(banc.getState().interlude?.perHero[h.id].left, 'témoin : trois Activités').toBe(3);
    banc.actions.interludeActivity(h.id, 'reputation');
    const coutDeCarriere = banc.getState().pendingActivity?.costBrass;
    confirmerReussi(banc);
    expect(banc.getState().interlude?.perHero[h.id].closeOps?.flatMap((l) => l.ops), 'témoin : +1 Standing retenu pour la clôture').toEqual([{ op: 'statusMod', amount: 1 }]);
    banc.actions.interludeActivity(h.id, 'reputation');
    expect(banc.getState().pendingActivity?.costBrass, 'la seconde Réputation coûte le Standing de carrière').toBe(coutDeCarriere);
    banc.setState({ pendingActivity: null });
    banc.actions.seedRng(GRAINE_DU_GESTE);
    banc.actions.interludeActivity(h.id, 'revenus');
    confirmerReussi(banc);
    expect(banc.getState().interlude?.perHero[h.id].revenueBrass, 'Revenus au Standing de carrière (Argent 1)').toBe(REVENUS_ARGENT_1);
  });
});

/** Un banc sur un interlude de trois semaines, dés posés, dont le Soldat (Argent 1) a tenté une Réputation
 *  posée à `roll`/`sl`. */
function apresUneReputation(success: boolean, sl: number): { banc: Banc; heroId: string } {
  const h = withBourseMoney(createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Vétéran', seed: 1601 }), { gold: 20, silver: 0, brass: 0 });
  const banc = ouvrirLeBanc({ graine: 7, desFixes: false, etat: { party: [h] } });
  banc.actions.startInterlude(3);
  draineCascade(banc.getState);
  banc.actions.interludeActivity(h.id, 'reputation');
  banc.actions.activityRoll();
  banc.setState((s) => ({ pendingActivity: { ...s.pendingActivity!, roll: success ? 10 : 99, success, sl } }));
  banc.actions.activityConfirm();
  expect(actorStatus(banc.getState().party[0]), 'témoin : Argent 1 pendant l’interlude').toEqual({ tier: 'argent', standing: 1 });
  return { banc, heroId: h.id };
}

describe('Réputation — le Standing se pose à la clôture, pour l’aventure qui suit (LDB 23 l.234)', () => {
  it('succès : après la clôture, le Statut effectif porte +1 et la Condition « au moins Argent 2 » le voit', () => {
    const { banc } = apresUneReputation(true, 3);
    banc.actions.interludeEnd();
    const h = banc.getState().party[0];
    expect(actorStatus(h)).toEqual({ tier: 'argent', standing: 2 });
    expect(evalCondition({ kind: 'status', atLeast: 'Argent 2' }, conditionCtx({ flags: {}, gameTime: 0, party: [h] }))).toBe(true);
  });

  it('l’effet posé à la clôture porte le libellé de l’Activité, et se dissipe sous ce libellé à l’interlude suivant', () => {
    const { banc } = apresUneReputation(true, 3);
    banc.actions.interludeEnd();
    expect(banc.getState().party[0].activeEffects?.filter((e) => e.statusMod).map((e) => e.label)).toEqual(['Réputation']);
    const journal = banc.getState().journal.length;
    banc.actions.startInterlude(1);
    expect(banc.getState().journal.slice(journal)).toContain('Vétéran : Réputation se dissipe (fin de l\'aventure).');
  });

  it('Échec Stupéfiant : après la clôture, Argent 1 devient Bronze 5 pendant l’aventure (LDB 08 l.101)', () => {
    const { banc } = apresUneReputation(false, -6);
    banc.actions.interludeEnd();
    expect(actorStatus(banc.getState().party[0])).toEqual({ tier: 'bronze', standing: 5 });
  });
});
