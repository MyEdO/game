/**
 * ÉVÉNEMENT d'interlude en étapes à TABLE (#942 L7, #1426) — LDB 22 : le d100 « Entre deux aventures »
 * se tire PAR HÉROS, puis chaque bourse encaisse les pertes d'argent de la période (l.5, l.36, l.115). Les dés passent
 * par le résolveur d'étape UNIQUE (`rollTableStep`) : une étape par héros, le dénouement de GROUPE en
 * étape FINALE.
 *
 * La séquence est POUSSÉE INCONDITIONNELLEMENT : ni l'option « Dés fixés » ni le siège n'entrent dans
 * sa DÉCLARATION. Ce que le socle en fait ensuite est SA politique (`cascade.poserLeCurseur`) — fenêtre
 * pour qui tient le héros, résolution d'office sinon — et l'option n'ajoute que la POSE du dé. Le flux
 * d'aléa, lui, ne bouge pas (sonde différentielle ci-dessous).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { chargerSurLeBanc, sauverLeBanc } from './persistance/save.testkit';
import { INTERLUDE_EVENT_TABLE } from './interludeFlow';
import { INTERLUDE_EVENTS, interludeEventFor } from '../data/interludeEvents';
import { rollTableStep, stepInteraction, tableStepDef } from './cascade';
import { seedBattleRng, battleRng } from './battleRng';
import { makeRNG, d100 } from '../engine/dice';
import { fromBrass, toBrass } from '../engine/money';
import { partyMoneyTotal, creditBourse } from './bourseFlow';
import { createHero } from '../engine/character';
import { bourseOf } from '../engine/bourse';
import { testScene } from '../scenes/test-fixture';
import { setDesFixes, resetDesFixes, desFixes } from '../engine/fixedDie';
import { canFixDie } from './netOwnership';
import { draineCascade } from './cascade.testkit';
import type { Combatant } from '../engine/types';
import { pratiquer } from './interlude.testkit';

/** Dés d'événements CHOISIS dans la donnée (fourchettes de `interludeEvents.json`). */
const PREVOT = 22; // « Le Prévôt arrive » — moneyPct −30
const KLEPTO = 83; // « Kleptomane » — moneyPct −50
const AVERTI = 34; // « Un homme averti en vaut deux » — +1 Point de Chance
const FESTIVITES = 37; // −1 Activité
const MONSTRUEUX = 57; // « Complications monstrueuses » — Revenus interdits à TOUTES les Classes

let banc: Banc;

/** Groupe de deux héros, bourses créditées — remis à neuf pour chaque sonde. */
function groupe(): Combatant[] {
  const a = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
  const b = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'B', seed: 2 });
  banc.setState({ party: [a, b], battle: null, interlude: null, bank: [], pendingOrders: [], journal: [], pendingCascade: null, suspendedCascades: [] });
  banc.getState().lancerLaScene(testScene());
  banc.abandonner();
  creditBourse(banc.getState, banc.setState, a.id, fromBrass(2000));
  creditBourse(banc.getState, banc.setState, b.id, fromBrass(2000));
  return banc.getState().party;
}

const partyBourse = (i: number) => bourseOf(banc.getState().party[i]);
const perHeroOf = (id: string) => banc.getState().interlude!.perHero[id];
const steps = () => banc.getState().pendingCascade!.participants;

describe('Événement d’interlude — un tirage par héros en étape à table (#942 L7)', () => {
  beforeEach(() => {
    banc = ouvrirLeBanc(); resetDesFixes();
    banc.setState({ interlude: null, pendingCascade: null, suspendedCascades: [] });
  });
  afterEach(() => {
    banc.abandonner(); resetDesFixes();
    // Hygiène de sortie : ces tests laissent des séquences OUVERTES au milieu de leurs tirages.
    banc.setState({ interlude: null, pendingCascade: null, suspendedCascades: [] });
  });

  it('SENTINELLE : le fichier démarre option « Dés fixés » ÉTEINTE (aucune fuite d’un autre fichier)', () => {
    expect(desFixes()).toBe(false);
  });

  it('registre : le Tableau des Événements est déclaré, lignes prises PAR RÉFÉRENCE dans la donnée', () => {
    const def = tableStepDef(INTERLUDE_EVENT_TABLE)!;
    expect(def).toBeDefined();
    expect(def.rows).toBe(INTERLUDE_EVENTS); // par RÉFÉRENCE : zéro duplication de fourchettes
    expect(def.die).toEqual({ n: 1, sides: 100 });
    // Ligne d'affichage = le libellé + le texte de l'entrée atteinte (lookup de la donnée).
    expect(def.lines(PREVOT)).toEqual([interludeEventFor(PREVOT).label, interludeEventFor(PREVOT).desc]);
    // Sur TOUT le dé, l'id de ligne EST l'événement du lookup partagé — jamais un second chemin.
    for (let die = 1; die <= 100; die++) {
      expect(rollTableStep({ tableId: INTERLUDE_EVENT_TABLE, forcedRoll: die }, makeRNG(1)).id, `dé ${die}`)
        .toBe(interludeEventFor(die).id);
    }
    // Mode table joueur : chaque ligne porte son libellé (la grille de `CascadeModal` est data-driven).
    expect(def.rows.every((r) => !!r.label)).toBe(true);
  });

  it('SONDE DIFFÉRENTIELLE (option ÉTEINTE) : mêmes événements, mêmes effets, même bourse, même flux RNG', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const party = groupe();
      const fortunes = party.map((h) => h.fortune ?? 0);
      // Référence : le chemin d'AVANT tirait un d100 par héros, dans l'ordre du groupe.
      seedBattleRng(seed);
      const refRng = battleRng();
      const rolls = party.map(() => d100(refRng));
      const suivant = d100(refRng); // dé SUIVANT → mesure la consommation exacte du flux

      seedBattleRng(seed);
      banc.getState().ouvrirLInterlude(2);
      // La séquence s'ouvre même sans l'option : elle se JOUE, dé par dé, au rang de chaque étape.
      expect(draineCascade(banc.getState), `seed ${seed} : étapes de la séquence`)
        .toEqual(['evenementDInterlude', 'evenementDInterlude', 'bourseDInterlude']);
      const apres = d100(battleRng());
      expect(banc.getState().pendingCascade, `seed ${seed} : la séquence ne s’est pas fermée`).toBeNull();
      expect(party.map((h) => perHeroOf(h.id).eventRoll), `seed ${seed} : événements différents`).toEqual(rolls);
      expect(apres, `seed ${seed} : le flux RNG a été décalé`).toBe(suivant);
      // Activités restantes et Chance : dérivées de la ligne tirée (2 semaines, aucun elfe ici).
      party.forEach((h, i) => {
        const ev = interludeEventFor(rolls[i]);
        expect(perHeroOf(h.id).left, `seed ${seed} : Activités de ${h.label}`).toBe(Math.max(0, 2 - (ev.fx?.loseActivity ? 1 : 0)));
        expect(banc.getState().party[i].fortune ?? 0).toBe(fortunes[i] + (ev.fx?.fortuneMaxDelta ?? 0));
      });
      // Bourses (LDB 22 l.36, l.115) : le Prévôt, tiré par qui que ce soit, ôte 30 % à chacun, une fois ;
      // le Kleptomane ôte 50 % au seul héros qui l'a tiré. Oracle par id d'Événement.
      const ids = rolls.map((r) => interludeEventFor(r).id);
      const prevot = ids.includes('le-prevot-arrive') ? 30 : 0;
      party.forEach((h, i) => {
        const pct = Math.min(100, prevot + (ids[i] === 'kleptomane' ? 50 : 0));
        expect(toBrass(partyBourse(i)), `seed ${seed} : bourse de ${h.label}`)
          .toBe(2000 - Math.floor((2000 * pct) / 100));
      });
    }
  });

  it('option ÉTEINTE : la séquence s’ouvre quand même — aucun dé posable, et les Activités ouvrent une fois jouée', () => {
    const party = groupe();
    seedBattleRng(5);
    banc.getState().ouvrirLInterlude(2);
    expect(steps().map((s) => s.kind)).toEqual(['evenementDInterlude', 'evenementDInterlude', 'bourseDInterlude']);
    expect(canFixDie(banc.getState(), party[0].id), 'option ÉTEINTE : la pose n’est pas offerte').toBe(false);
    expect(banc.getState().interlude!.phase).toBe('tirage');
    draineCascade(banc.getState);
    expect(banc.getState().pendingCascade).toBeNull();
    expect(banc.getState().interlude!.phase).toBe('activities');
  });

  it('option ACTIVE : phase « tirage », une étape NON RÉSOLUE par héros + l’étape des bourses, AUCUN effet appliqué', () => {
    const party = groupe();
    const avant = toBrass(partyMoneyTotal(banc.getState));
    setDesFixes(true);
    banc.getState().ouvrirLInterlude(2);
    expect(banc.getState().interlude!.phase).toBe('tirage');
    expect(banc.getState().pendingCascade!.purpose).toBe('interlude');
    expect(steps().map((s) => s.kind)).toEqual(['evenementDInterlude', 'evenementDInterlude', 'bourseDInterlude']);
    party.forEach((h, i) => {
      expect(steps()[i].actorId).toBe(h.id); // chaque héros SON étape (en coop, chaque siège pose pour les siens)
      expect(steps()[i].label, 'l’étape se nomme ; son héros, l’acteur, ne s’y redit pas').toBe('Événement');
      expect(stepInteraction(steps()[i])).toBe('table'); // dé À POSER → les deux affordances de la modale
      expect(steps()[i].table).toMatchObject({ tableId: INTERLUDE_EVENT_TABLE });
      expect(steps()[i].table!.result).toBeUndefined();
      // Rien n'est appliqué tant que le dé n'est pas posé.
      expect(perHeroOf(h.id).eventRoll).toBeUndefined();
      expect(perHeroOf(h.id).fx).toBeUndefined();
      expect(perHeroOf(h.id).left).toBe(2);
    });
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(avant);
  });

  it('POSER les dés : l’événement posé est celui APPLIQUÉ, et la bourse n’encaisse qu’à l’étape FINALE', () => {
    const party = groupe();
    const avant = toBrass(partyMoneyTotal(banc.getState));
    const fortune0 = party[1].fortune ?? 0;
    setDesFixes(true);
    banc.getState().ouvrirLInterlude(2);
    // Héros A : « Le Prévôt arrive » (−30 % sur les bourses) — l'effet de GROUPE reste en suspens.
    banc.getState().jetImposerLeResultat('cascadeTirage', PREVOT, steps()[0].id);
    expect(steps()[0].fixed).toBe(true);
    banc.getState().jetValider('cascade');
    expect(perHeroOf(party[0].id).eventRoll).toBe(PREVOT);
    expect(perHeroOf(party[0].id).fx?.moneyPct).toBe(-30);
    expect(toBrass(partyMoneyTotal(banc.getState)), 'la bourse a encaissé avant la fin des tirages').toBe(avant);
    // Héros B : « Un homme averti en vaut deux » (+1 Point de Chance, appliqué à SON dénouement).
    banc.getState().jetImposerLeResultat('cascadeTirage', AVERTI, steps()[1].id);
    banc.getState().jetValider('cascade');
    expect(perHeroOf(party[1].id).eventRoll).toBe(AVERTI);
    expect(banc.getState().party[1].fortune).toBe(fortune0 + 1);
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(avant);
    expect(banc.getState().interlude!.phase, 'les Activités ont ouvert avant le dernier dé').toBe('tirage');
    // Étape FINALE : le dénouement de GROUPE ponctionne, et les Activités ouvrent.
    banc.getState().jetValider('cascade');
    expect(banc.getState().pendingCascade).toBeNull();
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(avant - Math.floor((avant * 30) / 100));
    expect(banc.getState().interlude!.phase).toBe('activities');
  });

  it('deux événements d’argent : le Prévôt frappe chaque bourse, le Kleptomane la seule du héros qui l’a tiré (LDB 22 l.36, l.115)', () => {
    const party = groupe();
    const avant = toBrass(partyMoneyTotal(banc.getState));
    setDesFixes(true);
    banc.getState().ouvrirLInterlude(2);
    banc.getState().jetImposerLeResultat('cascadeTirage', PREVOT, steps()[0].id); // −30
    banc.getState().jetValider('cascade');
    banc.getState().jetImposerLeResultat('cascadeTirage', KLEPTO, steps()[1].id); // −50
    banc.getState().jetValider('cascade');
    expect(toBrass(partyMoneyTotal(banc.getState)), 'ponctionné avant le dénouement de groupe').toBe(avant);
    banc.getState().jetValider('cascade'); // étape des bourses
    expect(party.map((h) => perHeroOf(h.id).eventRoll)).toEqual([PREVOT, KLEPTO]);
    expect(party.map((_, i) => toBrass(partyBourse(i))), 'A : −30 % (Prévôt) ; B : −30 % et −50 % de sa bourse d’avant les Activités')
      .toEqual([1400, 400]);
  });

  it('perte d’Activité (Festivités) : la ligne posée décrémente le budget du héros de l’étape', () => {
    const party = groupe();
    setDesFixes(true);
    banc.getState().ouvrirLInterlude(3);
    banc.getState().jetImposerLeResultat('cascadeTirage', FESTIVITES, steps()[0].id);
    banc.getState().jetValider('cascade');
    expect(perHeroOf(party[0].id).left).toBe(2); // min(3, 3) − 1
    expect(perHeroOf(party[1].id).left, 'le budget du VOISIN a bougé').toBe(3);
  });

  it('coop : CHAQUE héros a SON étape — celle d’un autre siège n’est pas résolue à sa place', () => {
    const party = groupe();
    const net = banc.getState().net;
    banc.setState({ net: { ...net, mode: 'invite', mySeat: 1, ownership: { [party[0].id]: 1, [party[1].id]: 0 } } });
    setDesFixes(true);
    seedBattleRng(3);
    banc.getState().ouvrirLInterlude(2);
    // Les deux héros sont tenus par un siège HUMAIN (le local, un distant) : deux étapes à jouer, et
    // l'hôte ne tire pour aucun des deux. Qui VOIT quelle fenêtre appartient à `modalArbiter`, pas ici.
    expect(steps().map((s) => s.kind)).toEqual(['evenementDInterlude', 'evenementDInterlude', 'bourseDInterlude']);
    expect(steps().slice(0, 2).map((s) => s.actorId)).toEqual([party[0].id, party[1].id]);
    expect(steps().slice(0, 2).every((s) => s.table!.result === undefined), 'un dé est tombé sans siège').toBe(true);
    expect(perHeroOf(party[0].id).eventRoll).toBeUndefined();
    expect(perHeroOf(party[1].id).eventRoll).toBeUndefined();
    // Seul le porteur du siège LOCAL se voit offrir la pose (`canFixDie`) — l'option ne gate que ça.
    expect(canFixDie(banc.getState(), party[0].id)).toBe(true);
    expect(canFixDie(banc.getState(), party[1].id)).toBe(false);
    banc.setState({ net });
  });

  it('LDB 22 l.5 : le MOTEUR refuse d’entreprendre une Activité tant que le dé n’est pas tombé', () => {
    // « Avant de choisir vos Activités, lancez d'abord 1d100 sur le tableau des Événements ci-après. »
    // Le garde vit dans le flux (toutes les portes d'Activité), pas dans le seul bouton de l'écran :
    // sans lui, une Activité entreprise pendant le tirage ESQUIVE l'interdiction que l'événement pose.
    const party = groupe();
    setDesFixes(true);
    banc.getState().ouvrirLInterlude(2);
    banc.setState({ journal: [] });
    pratiquer(banc.getState, party[0].id, 'revenus');
    expect(banc.getState().pendingActivity, 'Activité ouverte pendant le tirage').toBeNull();
    expect(banc.getState().journal.join('\n')).toMatch(/ne peut rien entreprendre tant que les Événements/);
    // Les autres portes d'Activité tiennent le même garde (le budget se dépense partout ailleurs aussi).
    banc.getState().commanderLObjet(party[0].id, 'dague');
    banc.getState().deposerALaBanque(party[0].id, 'planque', 100);
    expect(banc.getState().pendingOrders).toEqual([]);
    expect(banc.getState().bank).toEqual([]);
    expect(perHeroOf(party[0].id).left, 'une Activité a été consommée pendant le tirage').toBe(2);
    // Le dé posé APPLIQUE l'interdiction que l'esquive contournait (Complications monstrueuses : Revenus
    // interdits à toutes les Classes) — la même demande est alors refusée pour SA raison.
    banc.getState().jetImposerLeResultat('cascadeTirage', MONSTRUEUX, steps()[0].id);
    banc.getState().jetValider('cascade');
    banc.getState().jetImposerLeResultat('cascadeTirage', AVERTI, steps()[1].id);
    banc.getState().jetValider('cascade');
    banc.getState().jetValider('cascade');
    banc.setState({ journal: [] });
    pratiquer(banc.getState, party[0].id, 'revenus');
    expect(banc.getState().pendingActivity).toBeNull();
    expect(banc.getState().journal.join('\n')).toMatch(/ne peut pas entreprendre Revenus/);
  });

  it('SAUVEGARDE en plein tirage : la séquence est restaurée à SON étape, et la reprise dénoue', () => {
    const party = groupe();
    const avant = toBrass(partyMoneyTotal(banc.getState));
    setDesFixes(true);
    banc.getState().ouvrirLInterlude(2);
    banc.getState().jetImposerLeResultat('cascadeTirage', AVERTI, steps()[0].id);
    banc.getState().jetValider('cascade'); // 1ʳᵉ étape validée : le curseur est sur la 2ᵉ (1/3)
    const save = sauverLeBanc(banc);
    // Partie rechargée EN PLEIN TIRAGE (le slot de séquence et la phase sont persistés).
    banc.setState({ interlude: null, pendingCascade: null });
    chargerSurLeBanc(banc, save);
    expect(banc.getState().interlude!.phase).toBe('tirage');
    const p = banc.getState().pendingCascade!;
    expect(p.purpose).toBe('interlude');
    expect(p.cursor).toBe(1);
    expect(p.participants).toHaveLength(3);
    expect(perHeroOf(party[0].id).eventRoll, 'le dé déjà posé a été perdu au rechargement').toBe(AVERTI);
    expect(perHeroOf(party[1].id).eventRoll).toBeUndefined();
    // La reprise dénoue normalement : dé du 2ᵉ héros, puis les bourses.
    banc.getState().jetImposerLeResultat('cascadeTirage', KLEPTO, steps()[1].id);
    banc.getState().jetValider('cascade');
    banc.getState().jetValider('cascade');
    expect(banc.getState().interlude!.phase).toBe('activities');
    expect(toBrass(partyMoneyTotal(banc.getState)), 'le Kleptomane de B n’entame que sa bourse').toBe(avant - 1000);
  });

  it('les bourses du groupe annoncent leurs pertes avant « Continuer », qui les applique telles quelles', () => {
    groupe();
    banc.getState().ouvrirLInterlude(2);
    banc.getState().jetImposerLeResultat('cascadeTirage', PREVOT, steps()[0].id);
    banc.getState().jetValider('cascade');
    banc.getState().jetImposerLeResultat('cascadeTirage', AVERTI, steps()[1].id);
    banc.getState().jetValider('cascade');
    const bourses = banc.getState().pendingCascade!.participants[2];
    expect(bourses.kind).toBe('bourseDInterlude');
    const annonce = (bourses.outcome ?? []).map((l) => l.text);
    expect(annonce, 'le Prévôt frappe chaque bourse, dit avant d’appliquer').toEqual([expect.stringContaining('La bourse de A perd 30 %'), expect.stringContaining('La bourse de B perd 30 %')]);
    const avant = toBrass(partyMoneyTotal(banc.getState));
    banc.setState({ journal: [] });
    banc.getState().jetValider('cascade');
    expect(banc.getState().journal, 'ce que « Continuer » applique est ce que la fenêtre annonçait').toEqual(annonce);
    expect(toBrass(partyMoneyTotal(banc.getState)), 'et les bourses le paient').toBeLessThan(avant);
  });

  it('#973 : la ligne du DÉNOUEMENT de groupe ne porte pas « (dé fixé) » — aucun dé n’y est jeté', () => {
    groupe();
    setDesFixes(true);
    banc.getState().ouvrirLInterlude(2);
    banc.getState().jetImposerLeResultat('cascadeTirage', PREVOT, steps()[0].id);
    banc.getState().jetValider('cascade');
    banc.getState().jetImposerLeResultat('cascadeTirage', AVERTI, steps()[1].id);
    banc.getState().jetValider('cascade');
    banc.setState({ journal: [] });
    banc.getState().jetValider('cascade'); // étape des bourses : conséquence journalisée
    const bourse = banc.getState().journal.join('\n');
    expect(bourse).toContain('La bourse de A perd 30 %');
    expect(bourse).toContain('La bourse de B perd 30 %');
    expect(bourse, 'la marque d’un dé posé a fui sur une ligne sans dé').not.toContain('dé fixé');
  });
});
