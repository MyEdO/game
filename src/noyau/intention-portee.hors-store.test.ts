/**
 * LE PATRON D'INTENTION (spec HUD zone 4) — armer un geste depuis l'interface pour EN VOIR LA PORTÉE
 * avant de cliquer le champ.
 *
 * Arbitrage fondateur (utilisateur, 2026-08-16, verbatim) : « Ca ne change pas les actions par défaut
 * sur le grid comme le déplacement/attaque, ou la charge/course, c'est juste pour qu'on les
 * selectionner volontairement depuis l'interface. Car actuellement pour charger, il est difficile de
 * connaitre la distance. »
 *
 * Ce que cette sonde mesure, dans cet ordre :
 *  (a) la portée peinte est EXACTEMENT celle du moteur (Course, Charge, Mouvement) — jamais un calcul
 *      parallèle ; la bande de Charge vaut `chargeReach` = 2×M cases (LDB 15 l.35-37, la Course du
 *      Tableau des Mouvements, LDB 15 l.18-31) ;
 *  (b) l'annulation : re-clic de la case, autre intention, fin de tour ;
 *  (c) LA NON-RÉGRESSION : sans intention armée, le clic-case et le clic-ennemi font EXACTEMENT ce
 *      qu'ils faisaient (aperçu au 1ᵉʳ tap, attaque sur l'ennemi) ; avec intention, le même clic
 *      commet et l'intention se dissout ;
 *  (d) COOP : l'intention est LOCALE — elle survit au snapshot de l'hôte, ne voyage pas dans ce
 *      snapshot, et son armement n'est pas un intent réseau.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { computeChargeReach, computeRunReach, displayedReach } from './combatFlow';
import { intentReach, armedIntentPortee, porteesDuTour } from './localIntent';
import { appliquerLInstantane, instantaneDeLaCoop } from './coop';
import { GUEST_INTENTS } from './intentionsDeSiege';
import { chargeReach } from '../engine/movement';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { effectiveMovement } from '../engine/encumbrance';
import { cliquerSurLeCombattant } from './combatOrParty';

/** Combat témoin : un héros au tour ENTIER, les ennemis parqués au loin (grille libre autour de lui). */
function setup() {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [hero], screen: 'campaign' });
  banc.getState().lancerLaScene(testScene());
  banc.getState().lancerLeCombat('enc-mutants');
  banc.getState().fenetreValider('debutDuRound');
  const b = banc.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  let i = 0;
  for (const e of b.combatants.filter((c) => c.kind === 'ennemi')) e.pos = { x: 20 + i++, y: 20 };
  H.pos = { x: 6, y: 10 };
  const turn = b.order.indexOf(H.id);
  banc.setState({ battle: { ...b, turn, action: null, acted: false, movementUsed: 0, movedPreAction: false, preview: null }, localIntent: null });
  return { H, E: b.combatants.find((c) => c.kind === 'ennemi')! };
}

/** Première case atteignable à la distance `d` exactement. */
function pickAtDist(reach: Map<string, number>, d: number): { x: number; y: number } {
  for (const [k, v] of reach) if (v === d) { const [x, y] = k.split(',').map(Number); return { x, y }; }
  throw new Error(`aucune case atteignable à distance ${d}`);
}

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const get = () => banc.getState();

describe('(a) la portée AFFICHÉE est celle du moteur', () => {
  it('Charge armée → la bande peinte EST `computeChargeReach`, de rayon `chargeReach` = 2×M', () => {
    const { H } = setup();
    const M = effectiveMovement(H);
    banc.jouerLaCase('charge');
    const bande = intentReach(get);
    expect([...bande.keys()].sort()).toEqual([...computeChargeReach(get).keys()].sort());
    // La bande DÉBORDE la Marche : c'est tout l'objet du bouton (« difficile de connaître la distance »).
    expect(chargeReach(M)).toBe(2 * M);
    expect(Math.max(...bande.values())).toBeGreaterThan(Math.max(...displayedReach(get).values()));
    expect(Math.max(...bande.values())).toBeLessThanOrEqual(chargeReach(M));
  });

  it('Mouvement armé → la bande peinte EST la portée de Marche affichée', () => {
    setup();
    banc.jouerLaCase('mouvement');
    expect([...intentReach(get).keys()].sort()).toEqual([...displayedReach(get).keys()].sort());
  });

  it('Attaque armée → AUCUNE bande de cases : sa portée se lit aux bandes de tir existantes', () => {
    setup();
    banc.jouerLaCase('attaque', { attackId: 'arme' });
    expect(armedIntentPortee(get)).toBe('portee-arme');
    expect(intentReach(get).size).toBe(0);
  });

  it('aucune intention → aucune bande (la portée d’intention ne se peint QUE sur demande)', () => {
    setup();
    expect(get().localIntent).toBeNull();
    expect(intentReach(get).size).toBe(0);
  });

  it('Course armée → sa zone est `computeRunReach`, jamais une 2ᵉ bande d’intention (`porteesDuTour`)', () => {
    setup();
    banc.jouerLaCase('course');
    expect(get().localIntent).toEqual({ actionId: 'course' });
    const attendu = computeRunReach(get);
    expect(attendu.size).toBeGreaterThan(0);
    const portees = porteesDuTour(get, true);
    expect([...portees.course.keys()].sort()).toEqual([...attendu.keys()].sort());
    expect(portees.intention.size, 'la Course peint sa zone DEUX fois').toBe(0);
  });

  it('AUCUNE portée d’intention ne se peint VIDE — chaque geste armé montre la sienne (`porteesDuTour`)', () => {
    const mesures: [string, (p: ReturnType<typeof porteesDuTour>) => number][] = [
      ['mouvement', (p) => p.intention.size],
      ['charge', (p) => p.intention.size],
      ['course', (p) => p.course.size],
    ];
    for (const [actionId, mesure] of mesures) {
      setup();
      banc.jouerLaCase(actionId);
      const p = porteesDuTour(get, true);
      expect(mesure(p), `l’intention « ${actionId} » (${armedIntentPortee(get)}) est armée et ne peint RIEN — intention=${p.intention.size} course=${p.course.size}`).toBeGreaterThan(0);
    }
  });
});

describe('(b) annulation', () => {
  it('re-clic de la MÊME case dissout l’intention (bascule)', () => {
    setup();
    banc.jouerLaCase('course');
    banc.jouerLaCase('course');
    expect(get().localIntent).toBeNull();
  });

  it('armer une AUTRE intention remplace la première (une seule à la fois)', () => {
    setup();
    banc.jouerLaCase('course');
    banc.jouerLaCase('charge');
    expect(get().localIntent).toEqual({ actionId: 'charge' });
  });

  it('désarmer (`desarmerLeMode`) dissout l’intention et sa bande', () => {
    setup();
    banc.jouerLaCase('charge');
    expect(get().localIntent).not.toBeNull();
    get().desarmerLeMode();
    expect(get().localIntent).toBeNull();
    expect(intentReach(get).size).toBe(0);
  });

  it('le tour qui s’achève emporte l’intention', () => {
    setup();
    banc.jouerLaCase('charge');
    const tour = get().battle!.turn;
    get().terminerLeTour(); // l'Action intacte : le 1er geste arme la fin du tour, il ne la passe pas
    expect(get().localIntent).toEqual({ actionId: 'charge' });
    get().terminerLeTour();
    expect(get().battle!.turn).not.toBe(tour);
    expect(get().localIntent).toBeNull();
  });
});

describe('(c) NON-RÉGRESSION : les gestes par défaut du grid ne changent pas', () => {
  it('SANS intention, un clic-case non confirmé reste un APERÇU (le héros ne bouge pas)', () => {
    const { H } = setup();
    const dest = pickAtDist(displayedReach(get), 2);
    get().cliquerLaCase(dest);
    const h = get().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.pos).toEqual({ x: 6, y: 10 }); // rien n'a bougé
    expect(get().battle!.preview).toMatchObject({ kind: 'deplacement', tile: dest });
  });

  it('SANS intention, un clic-case CONFIRMÉ déplace, comme avant', () => {
    const { H } = setup();
    const dest = pickAtDist(displayedReach(get), 2);
    get().cliquerLaCase(dest, undefined, { confirm: true });
    expect(get().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(dest);
    expect(get().battle!.movementUsed).toBe(2);
  });

  it('SANS intention, un clic-ennemi au contact ouvre l’attaque, comme avant', () => {
    const { H, E } = setup();
    E.pos = { x: H.pos!.x + 1, y: H.pos!.y };
    cliquerSurLeCombattant(get, E.id, { confirm: true });
    expect(get().pendingAttack).toMatchObject({ attackerId: H.id, targetId: E.id });
  });

  it('AVEC intention, le MÊME clic commet le geste et dissout l’intention', () => {
    const { H } = setup();
    const dest = pickAtDist(displayedReach(get), 2);
    banc.jouerLaCase('mouvement');
    get().cliquerLaCase(dest); // pas de `confirm` : l'intention armée VAUT confirmation
    expect(get().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(dest);
    expect(get().localIntent, 'l’intention doit se dissoudre au commit').toBeNull();
  });

  it('AVEC intention de Course, le clic d’une case LOINTAINE part en Course réelle (Test de `course`)', () => {
    setup();
    const marche = displayedReach(get);
    const course = computeRunReach(get);
    const loin = [...course.keys()].find((k) => !marche.has(k))!;
    const [x, y] = loin.split(',').map(Number);
    banc.jouerLaCase('course');
    get().cliquerLaCase({ x, y });
    expect(get().pendingRun ?? get().pendingCascade, 'la Course réelle n’a pas démarré').toBeTruthy();
    expect(get().localIntent).toBeNull();
  });
});

describe('(d) COOP : l’intention est LOCALE au client', () => {
  it('un snapshot de l’hôte NE TUE PAS l’intention armée', () => {
    setup();
    banc.jouerLaCase('charge');
    const snap = JSON.parse(JSON.stringify({ ...instantaneDeLaCoop(get()) })) as Record<string, unknown>;
    banc.setState(appliquerLInstantane(snap, banc.getState()).etat);
    expect(get().localIntent, 'le snapshot a désarmé la case du client').toEqual({ actionId: 'charge' });
  });

  it('l’intention ne VOYAGE pas dans le snapshot (la case armée de l’hôte n’allume rien chez l’invité)', () => {
    setup();
    banc.jouerLaCase('charge');
    expect('localIntent' in instantaneDeLaCoop(get())).toBe(false);
  });

  it('l’ARMEMENT n’est pas un intent réseau (seul le COMMIT du geste en est un)', () => {
    expect(GUEST_INTENTS).not.toContain('armerLIntention');
    // Le commit, lui, passe par les portes de clic déjà exposées.
    expect(GUEST_INTENTS).toContain('cliquerLaCase');
  });
});
