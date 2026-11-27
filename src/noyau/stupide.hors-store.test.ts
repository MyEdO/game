/**
 * Stupide (LDB 85 l.335) : effet du trait en donnée (`traits.json` › `stupide`, `onRoundStart`), un seul chemin pour
 * tout porteur (#5042 V3a). Sans allié non Stupide au contact au début du Round, Test d'Intelligence Facile ; sur un
 * échec, l'Action et le Mouvement de son tour du MÊME Round sont perdus (`loseTurn`, replié par `ouvrirLeTour`).
 * Matrice : porteur × guidé/seul × réussite/échec, au franchissement de Round et à l'ouverture du Round 1.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { heroDuDuel, ouvrirLeCombat } from './combatDeTest.testkit';
import { deDeCombat, franchirLeRound, lancerLeRoundDu } from './ouvertureDuTour.testkit';
import { advanceTurn } from './combatFlow';
import { mountMovement } from './mount';
import { seedBattleRng } from './battleRng';
import { attachMutation } from '../engine/corruption';
import { mutationById } from '../data/mutations';
import { makeRNG } from '../engine/dice';
import { setCadence, type Cadence } from '../engine/cadence';
import { testScene } from '../scenes/test-fixture';
import { scenario } from '../scenes/test-scenarios/entrainement';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { placeCombatant } from './monde/spawn';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
afterEach(() => setCadence('manuel'));

const g = () => banc.getState();
/** Ce que le journal porte pour le porteur : la ligne de son Test, celle de sa perte (`loseTurn`), et les deux que
 *  l'ouverture de son tour écrit en la repliant (Mouvement, Action perdus). */
const LIGNE_DU_TEST = 1;
const LIGNE_DE_LA_PERTE = 1;
const LIGNES_DU_TOUR_PERDU = 2;
/** Le d100 qui réussit ou échoue tout Test. */
const DE = { reussite: 1, echec: 100 } as const;
const relu = (id: string): Combatant => g().battle!.combatants.find((c) => c.id === id)!;

type Porteur = 'heros-manuel' | 'heros-rapide' | 'heros-auto' | 'ia' | 'ennemi-du-mj';
const PORTEURS: readonly Porteur[] = ['heros-manuel', 'heros-rapide', 'heros-auto', 'ia', 'ennemi-du-mj'];
const CADENCE: Record<Porteur, Cadence> = { 'heros-manuel': 'manuel', 'heros-rapide': 'rapide', 'heros-auto': 'auto', ia: 'manuel', 'ennemi-du-mj': 'manuel' };
const estHeros = (p: Porteur) => p.startsWith('heros');

/** Un héros Stupide par la mutation Crétin (EDO, `grantTrait` stupide), le chemin d'un héros réel. */
function herosCretin(): Combatant {
  const h = heroDuDuel();
  attachMutation(h, mutationById('cretin')!, makeRNG(1));
  return h;
}

/** Le budget du tour de `id`, s'il est l'actif. */
function budgetDe(id: string) {
  const b = g().battle!;
  return { actif: b.order[b.turn] === id, acted: b.acted, movementUsed: b.movementUsed };
}

/** Le budget attendu : perdu sur un échec du porteur seul, intact sinon. */
function attendu(id: string, perdu: boolean) {
  return { actif: true, acted: perdu, movementUsed: perdu ? mountMovement(g().battle!, relu(id)) : 0 };
}

/** Monte le Round 1 joué jusqu'au dernier de l'ordre : deux héros, deux ennemis vivants, le porteur et son allié posés
 *  au contact (`guide`) ou loin. Rend le porteur, son allié et un adversaire. */
function monter(porteur: Porteur, guide: boolean): { P: Combatant; allie: Combatant } {
  setCadence(CADENCE[porteur]);
  seedBattleRng(11);
  const [h1, h2] = [estHeros(porteur) ? herosCretin() : heroDuDuel(), heroDuDuel()];
  ouvrirLeCombat(banc, testScene(), [h1, h2], 'enc-mutants');
  lancerLeRoundDu(banc); // le Test du Round 1, dû si le spawn n'a pas mis le porteur au contact de son allié
  const b = g().battle!;
  const [H1, H2] = b.combatants.filter((c) => c.kind === 'heros');
  const [E1, E2, ...morts] = b.combatants.filter((c) => c.kind === 'ennemi');
  for (const m of morts) m.dead = true;
  H1.pos = { x: 4, y: 4 }; H2.pos = guide && estHeros(porteur) ? { x: 4, y: 5 } : { x: 4, y: 14 };
  E1.pos = { x: 18, y: 4 }; E2.pos = guide && !estHeros(porteur) ? { x: 18, y: 5 } : { x: 18, y: 14 };
  if (!estHeros(porteur)) E1.traits = [...(E1.traits ?? []), { id: 'stupide' }];
  banc.setState({ battle: { ...b }, ...(porteur === 'ennemi-du-mj' ? { net: { ...g().net, gmSeat: 0 } } : {}) });
  banc.abandonner();
  return estHeros(porteur) ? { P: H1, allie: H2 } : { P: E1, allie: E2 };
}

describe('Stupide au début du Round : même Test, même perte, quel que soit le porteur (LDB 85 l.335)', () => {
  for (const porteur of PORTEURS) for (const guide of [true, false]) for (const issue of ['reussite', 'echec'] as const) {
    it(`${porteur}, ${guide ? 'guidé' : 'seul'}, ${issue} — franchissement de Round`, () => {
      const { P } = monter(porteur, guide);
      const avant = { ...P.pos! };
      deDeCombat(DE[issue]);
      franchirLeRound(banc, [P.id]);
      lancerLeRoundDu(banc);
      const perdu = !guide && issue === 'echec';
      expect(budgetDe(P.id)).toEqual(attendu(P.id, perdu));
      // Joué sans fenêtre, le Test s'écrit UNE fois à l'entretien du franchissement (`etat`), suivi de sa perte sur un
      // échec ; guidé, rien ne se passe.
      const lignes = g().battle!.log.filter((l) => l.actorId === P.id && l.kind === 'etat').length;
      if (guide) expect(lignes).toBe(0);
      else if (porteur !== 'heros-manuel' && porteur !== 'ennemi-du-mj') expect(lignes).toBe(LIGNE_DU_TEST + (perdu ? LIGNE_DE_LA_PERTE : 0));
      if (!perdu) return;
      // Le tour perdu ne joue rien : ni Mouvement ni Action, puis la main passe.
      banc.jusquA((s) => s.battle!.order[s.battle!.turn] !== P.id, 20);
      if (porteur === 'ia' || porteur === 'heros-auto') {
        expect(g().battle!.order[g().battle!.turn]).not.toBe(P.id);
        expect(relu(P.id).pos).toEqual(avant);
      }
    });
  }

  it('l’IA Stupide qui échoue au contact d’un adversaire ne frappe pas : la main passe', () => {
    const { P } = monter('ia', false);
    const H = g().battle!.combatants.find((c) => c.kind === 'heros')!;
    relu(H.id).pos = { x: P.pos!.x - 1, y: P.pos!.y };
    const blessures = relu(H.id).wounds.current;
    deDeCombat(DE.echec);
    franchirLeRound(banc, [P.id]);
    lancerLeRoundDu(banc);
    expect(budgetDe(P.id)).toEqual(attendu(P.id, true));
    banc.jusquA((s) => s.battle!.order[s.battle!.turn] !== P.id || !!s.pendingDefense, 20);
    expect(g().pendingDefense).toBeNull();
    expect(g().battle!.order[g().battle!.turn]).not.toBe(P.id);
    expect(relu(H.id).wounds.current).toBe(blessures);
  });

  it('l’allié qui vient au contact avant le tour du porteur ne le guide plus : le Test du début du Round tient', () => {
    const { P, allie } = monter('ia', false);
    const H = g().battle!.combatants.find((c) => c.kind === 'heros')!;
    deDeCombat(DE.echec);
    franchirLeRound(banc, [H.id, P.id]);
    lancerLeRoundDu(banc);
    expect(budgetDe(H.id).actif).toBe(true);
    relu(allie.id).pos = { x: P.pos!.x, y: P.pos!.y + 1 };
    advanceTurn(g, banc.setState);
    banc.abandonner();
    expect(budgetDe(P.id)).toEqual(attendu(P.id, true));
  });
});

describe('Stupide à l’ouverture du Round 1 : le héros premier de l’ordre (LDB 85 l.335)', () => {
  for (const porteur of ['heros-manuel', 'heros-rapide', 'heros-auto'] as const) for (const issue of ['reussite', 'echec'] as const) {
    it(`${porteur}, seul, ${issue}`, () => {
      setCadence(CADENCE[porteur]);
      seedBattleRng(11);
      const h = herosCretin();
      h.characteristics = { ...h.characteristics, initiative: 99, agilite: 99 };
      banc.setState({ screen: 'campaign', party: [h] });
      g().lancerLaScene(testScene());
      deDeCombat(DE[issue]);
      g().lancerLeCombat('enc-mutants');
      lancerLeRoundDu(banc);
      banc.abandonner();
      expect(g().battle!.round).toBe(1);
      expect(budgetDe(h.id)).toEqual(attendu(h.id, issue === 'echec'));
      // Joué sans fenêtre, le Test s'écrit UNE fois (`detail`), suivi sur un échec de sa perte puis des deux pertes que
      // l'ouverture de son tour replie (Mouvement, Action).
      if (porteur !== 'heros-manuel') expect(g().battle!.log.filter((l) => l.actorId === h.id && l.kind === 'detail').length).toBe(LIGNE_DU_TEST + (issue === 'echec' ? LIGNE_DE_LA_PERTE + LIGNES_DU_TOUR_PERDU : 0));
    });
  }
});

describe('Stupide au Round 1, la pause validée avant le Test d’ouverture : héros manuel premier de l’ordre (LDB 85 l.335)', () => {
  it('échec : son tour du Round 1 est perdu, et lui seul', () => {
    setCadence('manuel');
    seedBattleRng(11);
    const h = herosCretin();
    h.characteristics = { ...h.characteristics, initiative: 99, agilite: 99 };
    banc.setState({ screen: 'campaign', party: [h] });
    g().lancerLaScene(testScene());
    deDeCombat(DE.echec);
    g().lancerLeCombat('enc-mutants');
    // Le Test d'ouverture tient la main : la validation de la pause, jouée avant lui, n'ouvre aucun tour.
    g().fenetreValider('debutDuRound');
    expect(g().battle!.turn).toBe(-1);
    lancerLeRoundDu(banc);
    banc.abandonner();
    expect(g().battle!.round).toBe(1);
    expect(budgetDe(h.id)).toEqual(attendu(h.id, true));
    // Au Round 2, sans nouvel échec, rien n'est perdu : la perte du Round 1 ne se reporte pas.
    deDeCombat(DE.reussite);
    franchirLeRound(banc, [h.id]);
    lancerLeRoundDu(banc);
    banc.abandonner();
    expect(g().battle!.round).toBe(2);
    expect(budgetDe(h.id)).toEqual(attendu(h.id, false));
  });
});

describe('Stupide : l’IA qui perd son tour ne joue aucun geste de son budget (LDB 85 l.335 ; LDB 14 l.175-187)', () => {
  it('Empêtrée, elle ne tente pas de se libérer : l’Action est perdue', () => {
    const { P } = monter('ia', false);
    relu(P.id).conditions = [...relu(P.id).conditions, { id: 'empetre', value: 1 }];
    deDeCombat(DE.echec);
    franchirLeRound(banc, [P.id]);
    lancerLeRoundDu(banc);
    expect(budgetDe(P.id)).toEqual(attendu(P.id, true));
    deDeCombat(DE.reussite); // une tentative de se libérer réussirait : l'Empêtré qui reste dit qu'elle n'a pas eu lieu
    banc.jusquA((s) => s.battle!.order[s.battle!.turn] !== P.id, 30);
    expect(g().battle!.order[g().battle!.turn]).not.toBe(P.id);
    expect(relu(P.id).conditions.find((c) => c.id === 'empetre')?.value).toBe(1);
  });

  it('à côté d’une monture libre, elle n’enfourche pas', () => {
    const contenu = scenario.construire(idsDeTest);
    const enc = contenu.scene.encounters!.find((e) => e.id === 'enc-entrainement')!;
    const gobelin = enc.members!.find((m) => contenu.scene.entities.find((x) => x.id === m.entityId)?.creature?.id === 'gobelin')!;
    Object.assign(gobelin, { side: 'allie', ai: true });
    ouvrirLeCombat(banc, contenu.scene, contenu.party, 'enc-entrainement');
    const b = g().battle!;
    const cheval = b.combatants.find((c) => c.mountable)!;
    const P = b.combatants.find((c) => c.aiControlled && c.kind === 'heros' && !contenu.party.some((h) => h.id === c.id))!;
    const cible = b.combatants.filter((c) => c.kind === 'ennemi').sort((x, y) => (y.pos?.x ?? 0) - (x.pos?.x ?? 0))[0];
    for (const c of b.combatants) if (c !== cheval && c !== P && c !== cible) c.dead = true;
    placeCombatant(P, g().scene, { x: cheval.pos!.x + 1, y: cheval.pos!.y });
    // Le Cheval, Stupide lui aussi, ne guide pas le porteur.
    for (const c of [P, cheval]) c.traits = [...(c.traits ?? []), { id: 'stupide' }];
    banc.setState({ battle: { ...b } });
    deDeCombat(DE.echec);
    franchirLeRound(banc, [P.id]);
    lancerLeRoundDu(banc);
    expect(budgetDe(P.id)).toEqual(attendu(P.id, true));
    banc.jusquA((s) => s.battle!.order[s.battle!.turn] !== P.id, 30);
    expect(g().battle!.order[g().battle!.turn]).not.toBe(P.id);
    expect(relu(P.id).mountId).toBeUndefined();
  });
});

describe('Stupide : le journal du début de Round suit l’ordre des porteurs, au Round 1 comme au franchissement', () => {
  /** Les porteurs des lignes `kind` écrites depuis le rang `depuis`, regroupés par suite : un porteur par bloc. */
  const blocs = (depuis: number, kind: 'detail' | 'etat', ids: readonly string[]): string[] =>
    g().battle!.log.slice(depuis).filter((l) => l.kind === kind && ids.includes(l.actorId ?? '')).map((l) => l.actorId!).filter((id, i, t) => id !== t[i - 1]);

  it('deux héros Crétins régénérants en Rapide, en échec : les lignes de chacun se suivent', () => {
    setCadence('rapide');
    seedBattleRng(11);
    // La Régénération écrit sa ligne sur-le-champ, le Test de Stupide par la file différée : un seul vidage en fin
    // d'émission les entrelacerait d'un porteur à l'autre.
    const regenerant = (): Combatant => {
      const h = herosCretin();
      h.traits = [...(h.traits ?? []), { id: 'regeneration' }];
      h.wounds = { ...h.wounds, current: h.wounds.max - 5 };
      return h;
    };
    const [a, b] = [regenerant(), regenerant()];
    banc.setState({ screen: 'campaign', party: [a, b] });
    g().lancerLaScene(testScene());
    deDeCombat(DE.echec);
    g().lancerLeCombat('enc-mutants');
    const ids = [a.id, b.id];
    expect(blocs(0, 'detail', ids)).toHaveLength(2);
    lancerLeRoundDu(banc);
    banc.abandonner();
    const avant = g().battle!.log.length;
    franchirLeRound(banc, ids);
    expect(blocs(avant, 'etat', ids)).toHaveLength(2);
  });
});
