/**
 * LE MODÈLE DE GESTES DU CHAMP (#1411, P0-A) — spec HUD § « ARBITRAGE 2026-08-19 »
 * (`docs/plans/2026-08-16-spec-hud-combat.md`), côté web : la zone de Course ne se peint qu'à l'armement de sa case
 * (option 3 de la spec), et l'annulation par Échap reste GRATUITE. Les gestes du champ (clic-sol, clic-ennemi, mode de
 * ciblage sous une intention) se jouent au banc du noyau (`src/noyau/intention-geste-par-defaut.hors-store.test.ts`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { combatHighlightsView } from '../gameIso/stage/highlightLayer';
import { runBindingById } from './clavier/keybindings';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';

/** Même combat témoin que `intention-portee.hors-store.test.ts` : un héros au tour ENTIER, ennemis parqués loin. */
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
  useGame.setState({ battle: null, pendingAttack: null, pendingRun: null, pendingCascade: null, localIntent: null, refus: null });
});

describe('(a) le clic-SOL au-delà de la Marche exige la Course ARMÉE', () => {
  it('la zone de COURSE ne se peint QU’À l’armement (par défaut : la Marche seule)', () => {
    setup();
    const vue = () => combatHighlightsView(get, get().battle!, { myTurn: true, pendingAttack: null, pendingCleave: null, pendingDualStrike: null, pendingCast: null, localIntent: get().localIntent, hovered: null });
    expect(vue().walkReach.size, 'témoin : la Marche est bien peinte').toBeGreaterThan(0);
    expect(vue().runReach.size, 'la zone de Course se peint sans avoir été demandée').toBe(0);
    get().armerLIntention('course');
    expect(vue().runReach.size, 'la Course armée ne peint pas sa zone').toBeGreaterThan(0);
    runBindingById('intention-annuler', get);
    expect(vue().runReach.size, 'Échap laisse la zone de Course à l’écran').toBe(0);
  });
});

describe('(d) l’annulation reste GRATUITE par construction', () => {
  it('armer puis Échap ne dépense NI Mouvement, NI Action, NI Avantage', () => {
    const { H } = setup();
    const avant = { mv: get().battle!.movementUsed ?? 0, acted: get().battle!.acted, adv: H.advantage };
    get().armerLIntention('course');
    runBindingById('intention-annuler', get);
    expect(get().localIntent).toBeNull();
    const b = get().battle!;
    expect({ mv: b.movementUsed ?? 0, acted: b.acted, adv: b.combatants.find((c) => c.id === H.id)!.advantage }).toEqual(avant);
  });
});
