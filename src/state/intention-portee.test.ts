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
 *  (b) l'annulation : Échap (registre clavier) ET re-clic de la case ;
 *  (c) LA NON-RÉGRESSION : sans intention armée, le clic-case et le clic-ennemi font EXACTEMENT ce
 *      qu'ils faisaient (aperçu au 1ᵉʳ tap, attaque sur l'ennemi) ; avec intention, le même clic
 *      commet et l'intention se dissout ;
 *  (d) COOP : l'intention est LOCALE — elle survit au snapshot de l'hôte, ne voyage pas dans ce
 *      snapshot, et son armement n'est pas un intent réseau.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { computeChargeReach, computeRunReach, displayedReach } from './combatFlow';
import { intentReach, armedIntentPortee } from './localIntent';
import { combatHighlightsView } from '../gameIso/stage/highlightLayer';
import type { HighlightsView } from '../gameIso/builders/highlights';
import { runAction } from './actionRegistry';
import { runBindingById } from './keybindings';
import { applyNetSnapshot, netSnapshot } from './netFlow';
import { GUEST_INTENTS } from '../net/intents';
import { chargeReach } from '../engine/movement';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { effectiveMovement } from '../engine/encumbrance';

/** Combat témoin : un héros au tour ENTIER, les ennemis parqués au loin (grille libre autour de lui). */
function setup() {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [hero] });
  useGame.getState().startScene(testScene());
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  const b = useGame.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  let i = 0;
  for (const e of b.combatants.filter((c) => c.kind === 'enemy')) e.pos = { x: 20 + i++, y: 20 };
  H.pos = { x: 6, y: 10 };
  const turn = b.order.indexOf(H.id);
  useGame.setState({ battle: { ...b, turn, action: null, acted: false, movementUsed: 0, movedPreAction: false, preview: null }, localIntent: null });
  return { H, E: b.combatants.find((c) => c.kind === 'enemy')! };
}

/** Première case atteignable à la distance `d` exactement. */
function pickAtDist(reach: Map<string, number>, d: number): { x: number; y: number } {
  for (const [k, v] of reach) if (v === d) { const [x, y] = k.split(',').map(Number); return { x, y }; }
  throw new Error(`aucune case atteignable à distance ${d}`);
}

const get = () => useGame.getState();

beforeEach(() => {
  useGame.setState({ battle: null, pendingAttack: null, localIntent: null });
});

/** La vue de surbrillance du champ telle que l'écran la consomme (`stage/VolumetricWorld`) — le seul
 *  endroit où se lit CE QUI EST PEINT, par nature de marque. */
const vueDuChamp = (): HighlightsView =>
  combatHighlightsView(get, get().battle!, { myTurn: true, pendingAttack: null, pendingCleave: null, pendingDualStrike: null, pendingCast: null, localIntent: get().localIntent, hovered: null });

describe('(a) la portée AFFICHÉE est celle du moteur', () => {
  it('Course armée → la ZONE DE COURSE du champ s’allume, et rien n’est peint deux fois', () => {
    setup();
    runAction('course', get);
    expect(get().localIntent).toEqual({ actionId: 'course' });
    // Depuis la spec HUD § ARBITRAGE 2026-08-19, cette zone n'est plus peinte d'office : elle EST
    // l'affordance de l'intention. Son porteur reste la nature `run` du champ (`HighlightsView.runReach`)
    // — l'intention y DÉLÈGUE, comme la portée d'ARME délègue aux bandes de tir, au lieu d'écrire une
    // 2ᵉ fois la même vérité en nature `intent`.
    const attendu = computeRunReach(get);
    expect(attendu.size).toBeGreaterThan(0);
    const vue = vueDuChamp();
    expect([...vue.runReach.keys()].sort()).toEqual([...attendu.keys()].sort());
    expect(intentReach(get).size, 'la Course peint sa zone DEUX fois').toBe(0);
  });

  it('Charge armée → la bande peinte EST `computeChargeReach`, de rayon `chargeReach` = 2×M', () => {
    const { H } = setup();
    const M = effectiveMovement(H);
    runAction('charge', get);
    const bande = intentReach(get);
    expect([...bande.keys()].sort()).toEqual([...computeChargeReach(get).keys()].sort());
    // La bande DÉBORDE la Marche : c'est tout l'objet du bouton (« difficile de connaître la distance »).
    expect(chargeReach(M)).toBe(2 * M);
    expect(Math.max(...bande.values())).toBeGreaterThan(Math.max(...displayedReach(get).values()));
    expect(Math.max(...bande.values())).toBeLessThanOrEqual(chargeReach(M));
  });

  it('Mouvement armé → la bande peinte EST la portée de Marche affichée', () => {
    setup();
    runAction('mouvement', get);
    expect([...intentReach(get).keys()].sort()).toEqual([...displayedReach(get).keys()].sort());
  });

  it('Attaque armée → AUCUNE bande de cases : sa portée se lit aux bandes de tir existantes', () => {
    setup();
    runAction('attaque', get, { attackId: 'arme' });
    expect(armedIntentPortee(get)).toBe('portee-arme');
    expect(intentReach(get).size).toBe(0);
  });

  it('aucune intention → aucune bande (la portée d’intention ne se peint QUE sur demande)', () => {
    setup();
    expect(get().localIntent).toBeNull();
    expect(intentReach(get).size).toBe(0);
  });

  // INVARIANT TRANSVERSE : aucune intention qui porte SA bande de cases ne se peint VIDE. La SURFACE
  // varie (bande `intent` pour Mouvement et Charge, zone de Course pour la Course), le fait de peindre
  // ne varie pas — c'est ce qui tombe EN BLOC si les portées de `INTENT_REACH` se résolvent à
  // l'évaluation du module au lieu de l'appel, là où chaque contrat par-geste ci-dessus n'en signale
  // qu'un. L'Attaque est hors table : sa portée se lit aux bandes de tir, allumées par le SURVOL d'un
  // tireur (`HighlightsView.rangeBandSource`), pas par l'armement (contrat dédié ci-dessus).
  it('AUCUNE portée d’intention ne se peint VIDE — chaque geste armé montre la sienne', () => {
    const peintures: [string, (v: HighlightsView) => number][] = [
      ['mouvement', (v) => v.intentReach.size],
      ['charge', (v) => v.intentReach.size],
      ['course', (v) => v.runReach.size],
    ];
    for (const [actionId, mesure] of peintures) {
      setup();
      runAction(actionId, get);
      const v = vueDuChamp();
      expect(
        mesure(v),
        `l’intention « ${actionId} » (${armedIntentPortee(get)}) est armée et ne peint RIEN — ` +
          `intent=${v.intentReach.size} run=${v.runReach.size} bandes=${String(v.rangeBandSource)}`,
      ).toBeGreaterThan(0);
    }
  });

  it('rien d’armé : ni bande d’intention ni zone de Course — la MARCHE seule reste peinte', () => {
    setup();
    const v = vueDuChamp();
    expect(v.intentReach.size).toBe(0);
    expect(v.runReach.size, 'la zone de Course se peint sans avoir été armée').toBe(0);
    expect(v.walkReach.size, 'la Marche a disparu du champ').toBeGreaterThan(0);
  });
});

describe('(b) annulation', () => {
  it('Échap (registre clavier `intent-cancel`) dissout l’intention armée', () => {
    setup();
    runAction('charge', get);
    expect(get().localIntent).not.toBeNull();
    runBindingById('intent-cancel', get);
    expect(get().localIntent).toBeNull();
    expect(intentReach(get).size).toBe(0);
  });

  it('re-clic de la MÊME case dissout l’intention (bascule)', () => {
    setup();
    runAction('course', get);
    runAction('course', get);
    expect(get().localIntent).toBeNull();
  });

  it('armer une AUTRE intention remplace la première (une seule à la fois)', () => {
    setup();
    runAction('course', get);
    runAction('charge', get);
    expect(get().localIntent).toEqual({ actionId: 'charge' });
  });

  it('le tour qui s’achève emporte l’intention', () => {
    setup();
    runAction('charge', get);
    get().battleEndTurn();
    expect(get().localIntent).toBeNull();
  });
});

describe('(c) NON-RÉGRESSION : les gestes par défaut du grid ne changent pas', () => {
  it('SANS intention, un clic-case non confirmé reste un APERÇU (le héros ne bouge pas)', () => {
    const { H } = setup();
    const dest = pickAtDist(displayedReach(get), 2);
    get().battleClickTile(dest);
    const h = get().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.pos).toEqual({ x: 6, y: 10 }); // rien n'a bougé
    expect(get().battle!.preview).toMatchObject({ kind: 'move', tile: dest });
  });

  it('SANS intention, un clic-case CONFIRMÉ déplace, comme avant', () => {
    const { H } = setup();
    const dest = pickAtDist(displayedReach(get), 2);
    get().battleClickTile(dest, { confirm: true });
    expect(get().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(dest);
    expect(get().battle!.movementUsed).toBe(2);
  });

  it('SANS intention, un clic-ennemi au contact ouvre l’attaque, comme avant', () => {
    const { H, E } = setup();
    E.pos = { x: H.pos!.x + 1, y: H.pos!.y };
    get().battleClickEntity(E.id, { confirm: true });
    expect(get().pendingAttack).toMatchObject({ attackerId: H.id, targetId: E.id });
  });

  it('AVEC intention, le MÊME clic commet le geste et dissout l’intention', () => {
    const { H } = setup();
    const dest = pickAtDist(displayedReach(get), 2);
    runAction('mouvement', get);
    get().battleClickTile(dest); // pas de `confirm` : l'intention armée VAUT confirmation
    expect(get().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(dest);
    expect(get().localIntent, 'l’intention doit se dissoudre au commit').toBeNull();
  });

  it('AVEC intention de Course, le clic d’une case LOINTAINE part en Course réelle (jet d’Athlétisme)', () => {
    setup();
    const marche = displayedReach(get);
    const course = computeRunReach(get);
    const loin = [...course.keys()].find((k) => !marche.has(k))!;
    const [x, y] = loin.split(',').map(Number);
    runAction('course', get);
    get().battleClickTile({ x, y });
    expect(get().pendingRun ?? get().pendingCascade, 'la Course réelle n’a pas démarré').toBeTruthy();
    expect(get().localIntent).toBeNull();
  });
});

describe('(d) COOP : l’intention est LOCALE au client', () => {
  it('un snapshot de l’hôte NE TUE PAS l’intention armée', () => {
    setup();
    runAction('charge', get);
    const snap = JSON.parse(JSON.stringify({ ...netSnapshot(get) })) as Record<string, unknown>;
    applyNetSnapshot(useGame.setState, snap);
    expect(get().localIntent, 'le snapshot a désarmé la case du client').toEqual({ actionId: 'charge' });
  });

  it('l’intention ne VOYAGE pas dans le snapshot (la case armée de l’hôte n’allume rien chez l’invité)', () => {
    setup();
    runAction('charge', get);
    expect('localIntent' in netSnapshot(get)).toBe(false);
  });

  it('l’ARMEMENT n’est pas un intent réseau (seul le COMMIT du geste en est un)', () => {
    expect(GUEST_INTENTS).not.toContain('battleArmIntent');
    // Le commit, lui, passe par les portes de clic déjà exposées.
    expect(GUEST_INTENTS).toContain('battleClickTile');
    expect(GUEST_INTENTS).toContain('battleClickEntity');
  });
});
