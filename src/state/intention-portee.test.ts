/**
 * LE PATRON D'INTENTION (spec HUD zone 4) — armer un geste depuis l'interface pour EN VOIR LA PORTÉE
 * avant de cliquer le champ.
 *
 * Arbitrage fondateur (utilisateur, 2026-08-16, verbatim) : « Ca ne change pas les actions par défaut
 * sur le grid comme le déplacement/attaque, ou la charge/course, c'est juste pour qu'on les
 * selectionner volontairement depuis l'interface. Car actuellement pour charger, il est difficile de
 * connaitre la distance. »
 *
 * Ce que cette sonde mesure, côté web : la vue de surbrillance du champ (`combatHighlightsView`) peint
 * la portée du moteur, et Échap (registre clavier `intention-annuler`) dissout l'intention. Le reste du
 * patron se joue au banc du noyau (`src/noyau/intention-portee.hors-store.test.ts`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { computeRunReach } from '../noyau/combatFlow';
import { intentReach, armedIntentPortee } from '../noyau/localIntent';
import { combatHighlightsView } from '../gameIso/stage/highlightLayer';
import type { HighlightsView } from '../gameIso/builders/highlights';
import { runBindingById } from './clavier/keybindings';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';

/** Combat témoin : un héros au tour ENTIER, les ennemis parqués au loin (grille libre autour de lui). */
function setup() {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [hero], screen: 'campaign' });
  useGame.getState().lancerLaScene(testScene());
  useGame.getState().lancerLeCombat('enc-mutants');
  useGame.getState().fenetreValider('debutDuRound');
  const b = useGame.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  let i = 0;
  for (const e of b.combatants.filter((c) => c.kind === 'ennemi')) e.pos = { x: 20 + i++, y: 20 };
  H.pos = { x: 6, y: 10 };
  const turn = b.order.indexOf(H.id);
  useGame.setState({ battle: { ...b, turn, action: null, acted: false, movementUsed: 0, movedPreAction: false, preview: null }, localIntent: null });
  return { H, E: b.combatants.find((c) => c.kind === 'ennemi')! };
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
    get().armerLIntention('course');
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
      get().armerLIntention(actionId);
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
  it('Échap (registre clavier `intention-annuler`) dissout l’intention armée', () => {
    setup();
    get().armerLIntention('charge');
    expect(get().localIntent).not.toBeNull();
    runBindingById('intention-annuler', get);
    expect(get().localIntent).toBeNull();
    expect(intentReach(get).size).toBe(0);
  });
});
