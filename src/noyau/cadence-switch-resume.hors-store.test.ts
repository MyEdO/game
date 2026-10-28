/**
 * Bascule de CADENCE en plein combat (retour playtest 2026-06-27) :
 *  1. passer de Manuel/Rapide à AUTO ne doit PAS figer le combat — `resumeCadence` ré-entre la boucle
 *     (l'IA joue le tour de l'acteur courant) ;
 *  2. en AUTO, le joueur n'a AUCUNE affordance sur le héros actif — `controlsActive` est FAUX (la grille de
 *     déplacement, le réticule, la barre d'action et les raccourcis se gatent dessus).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { makeShowcaseParty } from '../data/pregens';
import { scenario as embuscade } from '../scenes/test-scenarios/embuscade';
import { controlsActive } from './netOwnership';
import { setCadence } from '../engine/cadence';
const embuscadeConstruit = embuscade.construire();

describe('Bascule de Cadence en plein combat', () => {
  let banc: Banc;
  beforeEach(() => { banc = ouvrirLeBanc(); });

  function startAtHeroTurn() {
    banc.setState({ party: makeShowcaseParty() });
    banc.getState().startScene(embuscadeConstruit.scene);
    banc.getState().startCombat('enc-mutants', undefined, { noSurprise: true });
    banc.getState().confirmRoundStart();
    const b = banc.getState().battle!;
    const hero = b.combatants.find((c) => c.kind === 'hero')!;
    // place un héros en tête → tour héros, cadence MANUELLE (l'IA n'agit pas, le combat ATTEND le joueur)
    banc.setState({ battle: { ...b, order: [hero.id, ...b.order.filter((id) => id !== hero.id)], turn: 0, action: null } });
    return hero.id;
  }

  it('AUTO : controlsActive est FAUX sur le héros actif (pas d’affordance joueur) ; MANUEL : vrai', () => {
    startAtHeroTurn();
    setCadence('manuel');
    expect(controlsActive(banc.getState())).toBe(true); // manuel → le joueur pilote
    setCadence('auto');
    expect(controlsActive(banc.getState())).toBe(false); // auto → l'IA pilote, UI inerte
  });

  it('passer en AUTO en plein tour héros NE FIGE PAS : resumeCadence relance l’IA (le tour avance)', () => {
    const id = startAtHeroTurn();
    const logBefore = banc.getState().battle!.log.length;
    // bascule manuel → auto en plein tour héros, comme le panneau Règles maison
    setCadence('auto');
    banc.getState().resumeCadence();
    banc.avancer(4000); // laisse jouer le télégraphe + l'action de l'IA
    const b = banc.getState().battle!;
    const activeNow = b.order[b.turn];
    const acted = activeNow !== id || b.acted || b.combatants.find((c) => c.id === id)!.pos != null && b.log.length > logBefore;
    expect(b.log.length).toBeGreaterThan(logBefore); // l'IA a AGI (journal enrichi) → plus figé
    expect(acted).toBeTruthy();
  });
});
