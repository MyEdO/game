/**
 * LES GESTES D'ACTIVITÉ D'INTERLUDE, sans store (#3059 S1) : un hôte qui n'a que la surface du noyau
 * (`creerPartie`) ouvre un interlude, pose ses dés d'Événement et dépense les Activités de son héros. Un
 * geste qui consomme une Activité est refusé, ET le dit, pendant le tirage (LDB 22 l.5) comme quand il
 * n'en reste plus (LDB 23 l.5) ; engager un Artisanat et retirer une planque n'en consomment pas
 * (LDB 23 l.76, l.170) : seul le tirage les refuse.
 */
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineCascade } from '../state/cascade.testkit';
import { createHero } from '../engine/character';
import { withBourseMoney } from '../engine/bourse';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import { battleActivityById, peutTenterAction } from './massBattleFlow';

/** Texte FIGÉ du refus « plus d'Activité » du héros de ce banc. */
const PLUS_D_ACTIVITE = 'Vétéran n’a plus d’Activité d’interlude.';
/** Texte FIGÉ du refus « tirage en attente » du héros de ce banc. */
const TIRAGE_EN_ATTENTE = 'Vétéran ne peut rien entreprendre tant que les Événements de la période ne sont pas tirés.';

/** Le héros du banc, riche et à Métier (l'Artisanat lui est ouvert). */
function veteran() {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Vétéran', seed: 1601 });
  h.xp = 2000;
  if (!h.skills.some((s) => s.id === 'metier')) h.skills.push({ id: 'metier', spec: 'forgeron', characteristic: 'dexterite', advances: 10 });
  return withBourseMoney(h, { gold: 20, silver: 0, brass: 0 });
}

/** Ce qu'une aventure précédente a laissé : une planque, un investissement, une Faveur Mineure due. */
const HERITAGE = (heroId: string) => ({
  bank: [{ heroId, kind: 'stash' as const, brass: 100, rate: 0 }, { heroId, kind: 'invest' as const, brass: 100, rate: 1 }],
  favors: [{ id: 'favor-1', heroId, level: 'mineure' as const, owedTo: 'Un échevin', desc: 'Un service', progress: 0 }],
});

/** Les lignes que `geste` a ajoutées au journal. */
function journalDe(banc: Banc, geste: () => void): string[] {
  const avant = banc.getState().journal.length;
  geste();
  return banc.getState().journal.slice(avant);
}

/** Un banc ouvert sur un interlude d'une semaine, ses dés d'Événement NON posés (`'tirage'`). */
function enTirage(): { banc: Banc; heroId: string } {
  const h = veteran();
  const banc = ouvrirLeBanc({ graine: 7, desFixes: false, etat: { party: [h], ...HERITAGE(h.id) } });
  banc.actions.startInterlude(1);
  expect(banc.getState().interlude?.phase, 'témoin : le tirage est ouvert').toBe('tirage');
  return { banc, heroId: h.id };
}

/** Pose les dés d'Événement et valide le dénouement de groupe : les Activités ouvrent. */
function apresLeTirage(): { banc: Banc; heroId: string } {
  const ouvert = enTirage();
  draineCascade(ouvert.banc.getState);
  expect(ouvert.banc.getState().interlude?.phase, 'témoin : le tirage est dénoué').toBe('activities');
  return ouvert;
}

/** Dépense les Activités restantes du héros (des dépôts en planque). */
function epuiser(banc: Banc, heroId: string): void {
  const left = () => banc.getState().interlude!.perHero[heroId].left;
  for (let i = 0; i < 3 && left() > 0; i++) banc.actions.interludeBank(heroId, 'stash', 10);
  expect(left(), 'témoin : plus aucune Activité').toBe(0);
}

/** Un banc dont le héros a dépensé sa dernière Activité. */
function sansActivite(): { banc: Banc; heroId: string } {
  const ouvert = apresLeTirage();
  epuiser(ouvert.banc, ouvert.heroId);
  return ouvert;
}

/** L'empreinte de ce qu'un geste d'Activité peut changer. */
const empreinte = (banc: Banc) => {
  const s = banc.getState();
  return JSON.stringify([s.interlude, s.bank, s.favors, s.pendingOrders, s.pendingActivity, s.party.map((h) => [h.items, h.xp, h.skills, h.craft])]);
};

/** Les gestes qui CONSOMMENT une Activité, par leur intention. */
const GESTES_D_ACTIVITE: [string, (a: ActionsDuNoyau, heroId: string) => void][] = [
  ['interludeActivity (Revenus)', (a, heroId) => a.interludeActivity(heroId, 'revenus')],
  ['interludeOrder', (a, heroId) => a.interludeOrder(heroId, 'arquebuse')],
  ['interludeEntrainement', (a, heroId) => a.interludeEntrainement(heroId, 'characteristic', 'intelligence')],
  ['interludeBank (planque)', (a, heroId) => a.interludeBank(heroId, 'stash', 10)],
  ['interludeWithdraw (investissement)', (a) => a.interludeWithdraw(1)],
  ['favorSettle', (a, heroId) => a.favorSettle(heroId, 'favor-1')],
];

describe('refusDActivite — un geste qui consomme une Activité', () => {
  for (const [nom, geste] of GESTES_D_ACTIVITE) {
    it(`${nom} : sans Activité restante, rien ne bouge et le refus se dit`, () => {
      const { banc, heroId } = sansActivite();
      const avant = empreinte(banc);
      expect(journalDe(banc, () => geste(banc.actions, heroId))).toEqual([PLUS_D_ACTIVITE]);
      expect(empreinte(banc), 'le geste a agi sans Activité').toBe(avant);
    });

    it(`${nom} : pendant le tirage, rien ne bouge et le refus se dit`, () => {
      const { banc, heroId } = enTirage();
      const avant = empreinte(banc);
      expect(journalDe(banc, () => geste(banc.actions, heroId))).toEqual([TIRAGE_EN_ATTENTE]);
      expect(empreinte(banc), 'le geste a agi avant le tirage').toBe(avant);
    });
  }

  it('activityConfirm : une Activité ouverte puis plus couverte par le budget se refuse à la validation', () => {
    const { banc, heroId } = apresLeTirage();
    banc.actions.interludeActivity(heroId, 'revenus');
    expect(banc.getState().pendingActivity?.heroId, 'témoin : les Revenus sont ouverts').toBe(heroId);
    banc.actions.activityRoll();
    expect(banc.getState().pendingActivity?.roll, 'témoin : le jet est posé').toBeTypeOf('number');
    epuiser(banc, heroId);
    const st = () => banc.getState().interlude!.perHero[heroId];
    const avant = JSON.stringify(st());
    expect(journalDe(banc, () => banc.actions.activityConfirm())).toEqual([PLUS_D_ACTIVITE]);
    expect(JSON.stringify(st()), 'les Revenus ont été gagnés sans Activité').toBe(avant);
  });

  it('activityConfirm d’une préparation de bataille : sans Activité restante, rien n’est résolu ni consommé, et le refus se dit (ADE II 8 l.65)', () => {
    const { banc, heroId } = apresLeTirage();
    banc.actions.startMassBattle({ allyMight: 50, enemyMight: 55, plannedRounds: 3 });
    expect(banc.getState().massBattle?.phase, 'témoin : la bataille attend sa préparation').toBe('prep');
    banc.actions.massBattleActivity('reperage', heroId);
    expect(banc.getState().pendingActivity?.battle, 'témoin : une préparation est ouverte').toBe('prep');
    banc.actions.activityRoll();
    expect(banc.getState().pendingActivity?.roll, 'témoin : le jet est posé').toBeTypeOf('number');
    epuiser(banc, heroId);
    const bataille = JSON.stringify(banc.getState().massBattle);
    const st = JSON.stringify(banc.getState().interlude!.perHero[heroId]);
    expect(journalDe(banc, () => banc.actions.activityConfirm())).toEqual([PLUS_D_ACTIVITE]);
    expect(JSON.stringify(banc.getState().massBattle), 'la préparation a été résolue sans Activité').toBe(bataille);
    expect(JSON.stringify(banc.getState().interlude!.perHero[heroId])).toBe(st);
    expect(banc.getState().pendingActivity).toBeNull();
  });
});

describe('refusDuTirage — un geste qui ne consomme pas d’Activité', () => {
  it('interludeCraftStart : engager un Artisanat reste PERMIS sans Activité restante (LDB 23 l.76)', () => {
    const { banc, heroId } = sansActivite();
    banc.actions.interludeCraftStart(heroId, 'dague', [], []);
    expect(banc.getState().party[0].craft?.trappingId).toBe('dague');
  });

  it('interludeCraftStart : pendant le tirage, rien ne s’engage et le refus se dit', () => {
    const { banc, heroId } = enTirage();
    expect(journalDe(banc, () => banc.actions.interludeCraftStart(heroId, 'dague', [], []))).toEqual([TIRAGE_EN_ATTENTE]);
    expect(banc.getState().party[0].craft).toBeUndefined();
  });

  it('interludeWithdraw (planque) : retirer reste PERMIS sans Activité restante (LDB 23 l.170)', () => {
    const { banc, heroId } = sansActivite();
    banc.actions.interludeWithdraw(0);
    expect(banc.getState().bank.filter((b) => b.heroId === heroId && b.kind === 'stash' && b.brass === 100)).toEqual([]);
  });

  it('interludeWithdraw (planque) : pendant le tirage, rien ne se retire et le refus se dit', () => {
    const { banc, heroId } = enTirage();
    expect(journalDe(banc, () => banc.actions.interludeWithdraw(0))).toEqual([TIRAGE_EN_ATTENTE]);
    expect(banc.getState().bank[0]).toEqual({ heroId, kind: 'stash', brass: 100, rate: 0 });
  });
});

describe('massBattleActivity — la préparation de bataille est MENÉE par le héros nommé (ADE II 8 l.65)', () => {
  it('meneur sans Activité restante : refusé et dit, sans repli sur un autre héros, rien n’est consommé', () => {
    const veteranne = veteran();
    const compagnon = withBourseMoney(createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Compagnon', seed: 1602 }), { gold: 1, silver: 0, brass: 0 });
    const banc = ouvrirLeBanc({ graine: 7, desFixes: false, etat: { party: [veteranne, compagnon] } });
    banc.actions.startInterlude(1);
    draineCascade(banc.getState);
    epuiser(banc, veteranne.id);
    banc.actions.startMassBattle({ allyMight: 50, enemyMight: 55, plannedRounds: 3 });
    const prepa = ['inspire', 'reperage', 'rassembler-des-forces']
      .find((id) => [veteranne, compagnon].every((h) => peutTenterAction(h, battleActivityById(id)!)))!;
    expect(banc.getState().interlude!.perHero[compagnon.id].left, 'témoin : le compagnon garde une Activité').toBeGreaterThan(0);
    const avant = JSON.stringify([banc.getState().interlude, banc.getState().massBattle]);
    expect(journalDe(banc, () => banc.actions.massBattleActivity(prepa, veteranne.id))).toEqual([PLUS_D_ACTIVITE]);
    expect(banc.getState().pendingActivity, 'la préparation s’est ouverte sur un autre héros').toBeNull();
    expect(JSON.stringify([banc.getState().interlude, banc.getState().massBattle])).toBe(avant);
  });

  it('meneur qui ne peut pas tenter le Test : refusé et dit, sans repli sur un autre héros', () => {
    const { banc, heroId } = apresLeTirage();
    banc.actions.startMassBattle({ allyMight: 50, enemyMight: 55, plannedRounds: 3 });
    expect(peutTenterAction(banc.getState().party[0], battleActivityById('planification')!), 'témoin : sans Savoir (Guerre)').toBe(false);
    expect(journalDe(banc, () => banc.actions.massBattleActivity('planification', heroId)))
      .toEqual(['Aucun Personnage désigné (Vétéran) ne peut tenter « Planification ».']);
    expect(banc.getState().pendingActivity).toBeNull();
  });
});
