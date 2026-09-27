/**
 * ÉVÉNEMENT d'interlude en étapes à TABLE (#942 L7, #1426) — LDB 22 : le d100 « Entre deux aventures »
 * se tire PAR HÉROS, puis les bourses du groupe encaissent le pire tirage de la période. Les dés passent
 * par le résolveur d'étape UNIQUE (`rollTableStep`) : une étape par héros, le dénouement de GROUPE en
 * étape FINALE.
 *
 * La séquence est POUSSÉE INCONDITIONNELLEMENT : ni l'option « Dés fixés » ni le siège n'entrent dans
 * sa DÉCLARATION. Ce que le socle en fait ensuite est SA politique (`cascade.poserLeCurseur`) — fenêtre
 * pour qui tient le héros, résolution d'office sinon — et l'option n'ajoute que la POSE du dé. Le flux
 * d'aléa, lui, ne bouge pas (sonde différentielle ci-dessous).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { INTERLUDE_EVENT_TABLE } from './interludeFlow';
import { INTERLUDE_EVENTS, interludeEventFor } from '../data/interludeEvents';
import { rollTableStep, stepInteraction, tableStepDef } from './cascade';
import { seedBattleRng, battleRng } from './battleRng';
import { makeRNG, d100 } from '../engine/dice';
import { fromBrass, toBrass } from '../engine/money';
import { partyMoneyTotal, creditBourse } from './bourseFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { setDesFixes, resetDesFixes, desFixes } from '../engine/fixedDie';
import { canFixDie } from './netOwnership';
import { draineCascade } from './cascadeTestKit';
import type { Combatant } from '../engine/types';

/** Dés d'événements CHOISIS dans la donnée (fourchettes de `interludeEvents.json`). */
const PREVOT = 22; // « Le Prévôt arrive » — moneyPct −30
const KLEPTO = 83; // « Kleptomane » — moneyPct −50
const AVERTI = 34; // « Un homme averti en vaut deux » — +1 Point de Chance
const FESTIVITES = 37; // −1 Activité
const MONSTRUEUX = 57; // « Complications monstrueuses » — Revenus interdits à TOUTES les Classes

/** Groupe de deux héros, bourses créditées — remis à neuf pour chaque sonde. */
function groupe(): Combatant[] {
  const a = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
  const b = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'B', seed: 2 });
  useGame.setState({ party: [a, b], battle: null, interlude: null, bank: [], pendingOrders: [], journal: [], pendingCascade: null, suspendedCascades: [] });
  useGame.getState().startScene(testScene());
  vi.clearAllTimers();
  creditBourse(useGame.getState, useGame.setState, a.id, fromBrass(2000));
  creditBourse(useGame.getState, useGame.setState, b.id, fromBrass(2000));
  return useGame.getState().party;
}

/** Fake Storage minimal — l'environnement de test est `node` (pas de localStorage), patron `clues.test.ts`. */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
}

const perHeroOf = (id: string) => useGame.getState().interlude!.perHero[id];
const steps = () => useGame.getState().pendingCascade!.participants;

describe('Événement d’interlude — un tirage par héros en étape à table (#942 L7)', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllTimers(); resetDesFixes();
    useGame.setState({ interlude: null, pendingCascade: null, suspendedCascades: [] });
  });
  afterEach(() => {
    vi.clearAllTimers(); vi.useRealTimers(); resetDesFixes();
    // Hygiène de sortie : ces tests laissent des séquences OUVERTES au milieu de leurs tirages.
    useGame.setState({ interlude: null, pendingCascade: null, suspendedCascades: [] });
  });

  it('SENTINELLE : le fichier démarre option « Dés fixés » ÉTEINTE (aucune fuite d’un autre fichier)', () => {
    expect(desFixes()).toBe(false);
  });

  it('registre : le Tableau des Événements est déclaré, lignes prises PAR RÉFÉRENCE dans la donnée', () => {
    const def = tableStepDef(INTERLUDE_EVENT_TABLE)!;
    expect(def).toBeDefined();
    expect(def.rows).toBe(INTERLUDE_EVENTS); // par RÉFÉRENCE : zéro duplication de fourchettes
    expect(def.die).toBe(100);
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
      const avant = toBrass(partyMoneyTotal(useGame.getState));
      const fortunes = party.map((h) => h.fortune ?? 0);
      // Référence : le chemin d'AVANT tirait un d100 par héros, dans l'ordre du groupe.
      seedBattleRng(seed);
      const refRng = battleRng();
      const rolls = party.map(() => d100(refRng));
      const suivant = d100(refRng); // dé SUIVANT → mesure la consommation exacte du flux

      seedBattleRng(seed);
      useGame.getState().startInterlude(2);
      // La séquence s'ouvre même sans l'option : elle se JOUE, dé par dé, au rang de chaque étape.
      expect(draineCascade(useGame.getState), `seed ${seed} : étapes de la séquence`)
        .toEqual(['interludeEvent', 'interludeEvent', 'interludePurse']);
      const apres = d100(battleRng());
      expect(useGame.getState().pendingCascade, `seed ${seed} : la séquence ne s’est pas fermée`).toBeNull();
      expect(party.map((h) => perHeroOf(h.id).eventRoll), `seed ${seed} : événements différents`).toEqual(rolls);
      expect(apres, `seed ${seed} : le flux RNG a été décalé`).toBe(suivant);
      // Activités restantes et Chance : dérivées de la ligne tirée (2 semaines, aucun elfe ici).
      party.forEach((h, i) => {
        const ev = interludeEventFor(rolls[i]);
        expect(perHeroOf(h.id).left, `seed ${seed} : Activités de ${h.label}`).toBe(Math.max(0, 2 - (ev.fx?.loseActivity ? 1 : 0)));
        expect(useGame.getState().party[i].fortune ?? 0).toBe(fortunes[i] + (ev.fx?.fortuneMaxDelta ?? 0));
      });
      // Bourse : le PIRE `moneyPct` de la période, ponctionné UNE fois sur le total du groupe.
      const pire = rolls.reduce((w, r) => Math.min(w, interludeEventFor(r).fx?.moneyPct ?? 0), 0);
      expect(toBrass(partyMoneyTotal(useGame.getState)), `seed ${seed} : bourse`)
        .toBe(avant - Math.floor((avant * -pire) / 100));
    }
  });

  it('option ÉTEINTE : la séquence s’ouvre quand même — aucun dé posable, et les Activités ouvrent une fois jouée', () => {
    const party = groupe();
    seedBattleRng(5);
    useGame.getState().startInterlude(2);
    expect(steps().map((s) => s.kind)).toEqual(['interludeEvent', 'interludeEvent', 'interludePurse']);
    expect(canFixDie(useGame.getState(), party[0].id), 'option ÉTEINTE : la pose n’est pas offerte').toBe(false);
    expect(useGame.getState().interlude!.phase).toBe('tirage');
    draineCascade(useGame.getState);
    expect(useGame.getState().pendingCascade).toBeNull();
    expect(useGame.getState().interlude!.phase).toBe('activities');
  });

  it('option ACTIVE : phase « tirage », une étape NON RÉSOLUE par héros + l’étape des bourses, AUCUN effet appliqué', () => {
    const party = groupe();
    const avant = toBrass(partyMoneyTotal(useGame.getState));
    setDesFixes(true);
    useGame.getState().startInterlude(2);
    expect(useGame.getState().interlude!.phase).toBe('tirage');
    expect(useGame.getState().pendingCascade!.purpose).toBe('interlude');
    expect(steps().map((s) => s.kind)).toEqual(['interludeEvent', 'interludeEvent', 'interludePurse']);
    party.forEach((h, i) => {
      expect(steps()[i].actorId).toBe(h.id); // chaque héros SON étape (en coop, chaque siège pose pour les siens)
      expect(stepInteraction(steps()[i])).toBe('table'); // dé À POSER → les deux affordances de la modale
      expect(steps()[i].table).toMatchObject({ tableId: INTERLUDE_EVENT_TABLE, spec: { n: 1, sides: 100 } });
      expect(steps()[i].table!.result).toBeUndefined();
      // Rien n'est appliqué tant que le dé n'est pas posé.
      expect(perHeroOf(h.id).eventRoll).toBeUndefined();
      expect(perHeroOf(h.id).fx).toBeUndefined();
      expect(perHeroOf(h.id).left).toBe(2);
    });
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(avant);
  });

  it('POSER les dés : l’événement posé est celui APPLIQUÉ, et la bourse n’encaisse qu’à l’étape FINALE', () => {
    const party = groupe();
    const avant = toBrass(partyMoneyTotal(useGame.getState));
    const fortune0 = party[1].fortune ?? 0;
    setDesFixes(true);
    useGame.getState().startInterlude(2);
    // Héros A : « Le Prévôt arrive » (−30 % sur les bourses) — l'effet de GROUPE reste en suspens.
    useGame.getState().cascadeTableSetForcedRoll(steps()[0].id, PREVOT);
    expect(steps()[0].fixed).toBe(true);
    useGame.getState().cascadeNext();
    expect(perHeroOf(party[0].id).eventRoll).toBe(PREVOT);
    expect(perHeroOf(party[0].id).fx?.moneyPct).toBe(-30);
    expect(toBrass(partyMoneyTotal(useGame.getState)), 'la bourse a encaissé avant la fin des tirages').toBe(avant);
    // Héros B : « Un homme averti en vaut deux » (+1 Point de Chance, appliqué à SON dénouement).
    useGame.getState().cascadeTableSetForcedRoll(steps()[1].id, AVERTI);
    useGame.getState().cascadeNext();
    expect(perHeroOf(party[1].id).eventRoll).toBe(AVERTI);
    expect(useGame.getState().party[1].fortune).toBe(fortune0 + 1);
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(avant);
    expect(useGame.getState().interlude!.phase, 'les Activités ont ouvert avant le dernier dé').toBe('tirage');
    // Étape FINALE : le dénouement de GROUPE ponctionne, et les Activités ouvrent.
    useGame.getState().cascadeNext();
    expect(useGame.getState().pendingCascade).toBeNull();
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(avant - Math.floor((avant * 30) / 100));
    expect(useGame.getState().interlude!.phase).toBe('activities');
  });

  it('deux événements d’argent : UNE seule ponction au dénouement de groupe (portée provisoire, #991)', () => {
    // CE QUI EST VERROUILLÉ ICI : la ponction est UNIQUE et tombe au dénouement de GROUPE, jamais à
    // chaque héros. Le CHOIX du pourcentage (le pire, appliqué au total du groupe) est un ARBITRAGE
    // PROVISOIRE — la PORTÉE RAW diffère par événement (cf. docblock de `finishInterludeDraw`) et se
    // règle en #991 ; ce test ne l'affirme pas comme une règle.
    const party = groupe();
    const avant = toBrass(partyMoneyTotal(useGame.getState));
    setDesFixes(true);
    useGame.getState().startInterlude(2);
    useGame.getState().cascadeTableSetForcedRoll(steps()[0].id, PREVOT); // −30
    useGame.getState().cascadeNext();
    useGame.getState().cascadeTableSetForcedRoll(steps()[1].id, KLEPTO); // −50
    useGame.getState().cascadeNext();
    expect(toBrass(partyMoneyTotal(useGame.getState)), 'ponctionné avant le dénouement de groupe').toBe(avant);
    useGame.getState().cascadeNext(); // étape des bourses
    expect(party.map((h) => perHeroOf(h.id).eventRoll)).toEqual([PREVOT, KLEPTO]);
    expect(toBrass(partyMoneyTotal(useGame.getState)), 'ponction DOUBLE (une par héros) au lieu d’une seule')
      .toBe(avant - Math.floor((avant * 50) / 100)); // comportement provisoire : le pire pct, une fois — #991
  });

  it('perte d’Activité (Festivités) : la ligne posée décrémente le budget du héros de l’étape', () => {
    const party = groupe();
    setDesFixes(true);
    useGame.getState().startInterlude(3);
    useGame.getState().cascadeTableSetForcedRoll(steps()[0].id, FESTIVITES);
    useGame.getState().cascadeNext();
    expect(perHeroOf(party[0].id).left).toBe(2); // min(3, 3) − 1
    expect(perHeroOf(party[1].id).left, 'le budget du VOISIN a bougé').toBe(3);
  });

  it('coop : CHAQUE héros a SON étape — celle d’un autre siège n’est pas résolue à sa place', () => {
    const party = groupe();
    const net = useGame.getState().net;
    useGame.setState({ net: { ...net, mode: 'guest', mySeat: 1, ownership: { [party[0].id]: 1, [party[1].id]: 0 } } });
    setDesFixes(true);
    seedBattleRng(3);
    useGame.getState().startInterlude(2);
    // Les deux héros sont tenus par un siège HUMAIN (le local, un distant) : deux étapes à jouer, et
    // l'hôte ne tire pour aucun des deux. Qui VOIT quelle fenêtre appartient à `modalArbiter`, pas ici.
    expect(steps().map((s) => s.kind)).toEqual(['interludeEvent', 'interludeEvent', 'interludePurse']);
    expect(steps().slice(0, 2).map((s) => s.actorId)).toEqual([party[0].id, party[1].id]);
    expect(steps().slice(0, 2).every((s) => s.table!.result === undefined), 'un dé est tombé sans siège').toBe(true);
    expect(perHeroOf(party[0].id).eventRoll).toBeUndefined();
    expect(perHeroOf(party[1].id).eventRoll).toBeUndefined();
    // Seul le porteur du siège LOCAL se voit offrir la pose (`canFixDie`) — l'option ne gate que ça.
    expect(canFixDie(useGame.getState(), party[0].id)).toBe(true);
    expect(canFixDie(useGame.getState(), party[1].id)).toBe(false);
    useGame.setState({ net });
  });

  it('LDB 22 l.5 : le MOTEUR refuse d’entreprendre une Activité tant que le dé n’est pas tombé', () => {
    // « Avant de choisir vos Activités, lancez d'abord 1d100 sur le tableau des Événements ci-après. »
    // Le garde vit dans le flux (toutes les portes d'Activité), pas dans le seul bouton de l'écran :
    // sans lui, une Activité entreprise pendant le tirage ESQUIVE l'interdiction que l'événement pose.
    const party = groupe();
    setDesFixes(true);
    useGame.getState().startInterlude(2);
    useGame.setState({ journal: [] });
    useGame.getState().interludeActivity(party[0].id, 'revenus');
    expect(useGame.getState().pendingActivity, 'Activité ouverte pendant le tirage').toBeNull();
    expect(useGame.getState().journal.join('\n')).toMatch(/ne peut rien entreprendre tant que les Événements/);
    // Les autres portes d'Activité tiennent le même garde (le budget se dépense partout ailleurs aussi).
    useGame.getState().interludeOrder(party[0].id, 'dague');
    useGame.getState().interludeBank(party[0].id, 'stash', 100);
    expect(useGame.getState().pendingOrders).toEqual([]);
    expect(useGame.getState().bank).toEqual([]);
    expect(perHeroOf(party[0].id).left, 'une Activité a été consommée pendant le tirage').toBe(2);
    // Le dé posé APPLIQUE l'interdiction que l'esquive contournait (Complications monstrueuses : Revenus
    // interdits à toutes les Classes) — la même demande est alors refusée pour SA raison.
    useGame.getState().cascadeTableSetForcedRoll(steps()[0].id, MONSTRUEUX);
    useGame.getState().cascadeNext();
    useGame.getState().cascadeTableSetForcedRoll(steps()[1].id, AVERTI);
    useGame.getState().cascadeNext();
    useGame.getState().cascadeNext();
    useGame.setState({ journal: [] });
    useGame.getState().interludeActivity(party[0].id, 'revenus');
    expect(useGame.getState().pendingActivity).toBeNull();
    expect(useGame.getState().journal.join('\n')).toMatch(/ne peut pas entreprendre Revenus/);
  });

  it('SAUVEGARDE en plein tirage : la séquence est restaurée à SON étape, et la reprise dénoue', () => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage(); // env `node` : pas de localStorage
    const party = groupe();
    const avant = toBrass(partyMoneyTotal(useGame.getState));
    setDesFixes(true);
    useGame.getState().startInterlude(2);
    useGame.getState().cascadeTableSetForcedRoll(steps()[0].id, AVERTI);
    useGame.getState().cascadeNext(); // 1ʳᵉ étape validée : le curseur est sur la 2ᵉ (1/3)
    expect(useGame.getState().saveGame(1)).toBe(true);
    // Partie rechargée EN PLEIN TIRAGE (le slot de séquence et la phase sont persistés).
    useGame.setState({ interlude: null, pendingCascade: null });
    expect(useGame.getState().loadGame(1)).toBe(true);
    expect(useGame.getState().interlude!.phase).toBe('tirage');
    const p = useGame.getState().pendingCascade!;
    expect(p.purpose).toBe('interlude');
    expect(p.cursor).toBe(1);
    expect(p.participants).toHaveLength(3);
    expect(perHeroOf(party[0].id).eventRoll, 'le dé déjà posé a été perdu au rechargement').toBe(AVERTI);
    expect(perHeroOf(party[1].id).eventRoll).toBeUndefined();
    // La reprise dénoue normalement : dé du 2ᵉ héros, puis les bourses.
    useGame.getState().cascadeTableSetForcedRoll(steps()[1].id, KLEPTO);
    useGame.getState().cascadeNext();
    useGame.getState().cascadeNext();
    expect(useGame.getState().interlude!.phase).toBe('activities');
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(avant - Math.floor((avant * 50) / 100));
  });

  it('#973 : la ligne du DÉNOUEMENT de groupe ne porte pas « (dé fixé) » — aucun dé n’y est jeté', () => {
    groupe();
    setDesFixes(true);
    useGame.getState().startInterlude(2);
    useGame.getState().cascadeTableSetForcedRoll(steps()[0].id, PREVOT);
    useGame.getState().cascadeNext();
    useGame.getState().cascadeTableSetForcedRoll(steps()[1].id, AVERTI);
    useGame.getState().cascadeNext();
    useGame.setState({ journal: [] });
    useGame.getState().cascadeNext(); // étape des bourses : conséquence journalisée
    const bourse = useGame.getState().journal.join('\n');
    expect(bourse).toMatch(/bourses du groupe perdent/);
    expect(bourse, 'la marque d’un dé posé a fui sur une ligne sans dé').not.toContain('dé fixé');
  });
});
