import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { t } from '../i18n';
import { mountMovement } from './mount';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('Course (Courir) — modale du Test `course` (LDB 15 l.41)', () => {
  function setup(prep?: (hero: Combatant) => void) {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    prep?.(hero);
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    H.pos = { x: 10, y: 10 };
    H.engagedWith = []; // pas Engagé → Course autorisée
    const turn = b.order.indexOf(H.id);
    banc.setState({ battle: { ...b, turn, acted: false, movementUsed: 0 }, pendingRun: null });
    return { H };
  }

  it('jetValider@course avant le jet : la clôture est fermée (`jetNonLance`), personne ne court', () => {
    const { H } = setup();
    banc.getState().ouvrirLaCourse({ x: 16, y: 10 });
    banc.getState().jetValider('course');
    const st = banc.getState();
    expect(st.pendingRun, 'la fenêtre reste ouverte').toBeTruthy();
    expect(st.battle!.acted).toBe(false);
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: 10, y: 10 });
  });

  it('ouvrirLaCourse(dest) ouvre pendingRun ; jetLancer@course lance ; jetValider@course court vers la destination + consomme l’Action', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H } = setup();
    const dest = { x: 16, y: 10 }; // 6 cases plein est (au-delà de la Marche M4)
    banc.getState().ouvrirLaCourse(dest);
    const pr = banc.getState().pendingRun;
    expect(pr).toBeTruthy();
    expect(pr!.combatantId).toBe(H.id);
    expect(pr!.dest).toEqual(dest);
    expect(pr!.result).toBeNull();

    banc.getState().jetLancer('course');
    const r = banc.getState().pendingRun!.result!;
    expect(r.bonusCases).toBeGreaterThanOrEqual(0); // Course = 2×Mouvement + DR/2, plancher 0

    banc.getState().jetValider('course');
    const st = banc.getState();
    expect(st.pendingRun).toBeNull();
    expect(st.battle!.acted).toBe(true); // l'Action est consommée par la Course
    const h = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.pos).not.toEqual({ x: 10, y: 10 }); // a couru (vers dest, au max du jet)
    expect(st.battle!.movementUsed).toBeGreaterThan(0);
  });

  // Journal : la fenêtre de Course a MONTRÉ le dé ; le journal ne porte que la CONSÉQUENCE, la distance
  // parcourue (Décision 1b, `noyau/rollSeam.ts` `Consequence`).
  it('jetValider@course journalise la seule conséquence : les cases parcourues', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H } = setup();
    banc.getState().ouvrirLaCourse({ x: 16, y: 10 });
    banc.getState().jetLancer('course');
    const avant = banc.getState().battle!.log.length;
    const parcouru = banc.getState().battle!.movementUsed ?? 0;
    banc.getState().jetValider('course');
    const b = banc.getState().battle!;
    const lignes = b.log.slice(avant).map((e) => e.text);
    const arrivee = b.combatants.find((c) => c.id === H.id)!.pos!;
    const court = arrivee.x !== 16 || arrivee.y !== 10;
    expect(lignes).toEqual([t('cs.run', { name: H.label, cost: (b.movementUsed ?? 0) - parcouru, short: court ? t('cs.fragRunShort') : '' })]);
  });

  it('Engagé → ouvrirLaCourse n’ouvre rien (il faut se désengager d’abord)', () => {
    const { H } = setup();
    H.engagedWith = ['x'];
    banc.setState({ battle: { ...banc.getState().battle! } });
    banc.getState().ouvrirLaCourse({ x: 16, y: 10 });
    expect(banc.getState().pendingRun).toBeNull();
  });

  it('Action déjà dépensée → ouvrirLaCourse n’ouvre rien', () => {
    setup();
    banc.setState({ battle: { ...banc.getState().battle!, acted: true } });
    banc.getState().ouvrirLaCourse({ x: 16, y: 10 });
    expect(banc.getState().pendingRun).toBeNull();
  });

  // LDB 10 (`11 - _3znysh7.md:47`), Sprinter : la Course forcée AVANT le jet (Résilience) court sur le
  // Mouvement compté de la Course, comme le jet tiré.
  for (const sprinter of [false, true]) it(`Course forcée avant le jet : distance sur M${sprinter ? ' + 1 (Sprinter)' : ''}`, () => {
    const { H } = setup((hero) => {
      if (sprinter) hero.talents = [...(hero.talents ?? []), { talentId: 'sprinter', times: 1 }];
      hero.resilience = 2;
    });
    banc.getState().ouvrirLaCourse({ x: 16, y: 10 });
    banc.getState().jetForcerLaReussite('course');
    const r = banc.getState().pendingRun!.result!;
    expect(r.success).toBe(true);
    const M = mountMovement(banc.getState().battle!, H);
    expect(r.bonusCases).toBe(2 * (M + (sprinter ? 1 : 0)));
  });
});
