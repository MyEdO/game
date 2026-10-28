/**
 * UN VERDICT, LU PAR L'OFFRE ET PAR LE GESTE (#3059) : la Course, le Désengagement, le verrou d'État et les commits
 * publics du Soin, de la Focalisation et de la Dissipation se jouent sans store, sur le duel de
 * `combatDeTest.testkit.ts`. Chaque État se pose par la couture que le jeu appelle (`addCondition`, `engage`).
 */
import { describe, it, expect } from 'vitest';
import { creerPartie, etatInitialDuJeu, activeCombatant, actionGate, type ActionCtx, type EntreesDeLaPartie, type Jeton, type Partie, type ResultatDeLAppel } from './index';
import { auContact, heroDuDuel } from './combatDeTest.testkit';
import { computeMoveReach, computeRunReach } from './combatFlow';
import { mountMovement, mountUp, movementRemaining, mouvementDeCourse } from './mount';
import { testScene } from '../scenes/test-fixture';
import { addCondition, refusVerrouDAction } from '../engine/conditions';
import { engage } from '../engine/engagement';
import { distanceDeCourse } from '../engine/movement';
import { runMovementBonus } from '../engine/combatFeatures/dispatch';
import { effectiveMovement } from '../engine/encumbrance';
import { lancementDuScenario } from '../scenes/test-scenarios/_shared';
import { testScenarios } from '../scenes/test-scenarios';
import { isArcaneSpell } from '../engine/magic';
import { spells } from '../data/index';
import { t } from '../i18n';
import type { Combatant } from '../engine/types';
import type { Get } from './flowTypes';

const ENTREES: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: false, persisterLeHeros: () => {} };

/** Un appel de la partie, puis chaque jeton programmé repris dans l'ordre d'arrivée. */
function jouer(partie: Partie, r: ResultatDeLAppel): void {
  const file: Jeton[] = [];
  const suivre = (x: ResultatDeLAppel): void => {
    for (const e of x.evenements) if (e.type === 'programme') file.push(e.jeton);
    for (let pas = 0; file.length && pas < 500; pas++) suivre(partie.reprendre(file.shift()!));
  };
  suivre(r);
}

const envoyer = (partie: Partie, type: string, ...args: unknown[]): void => jouer(partie, partie.envoyer({ type, args } as never));

/** Le duel ouvert, le tour au héros, H et E au contact sans être Engagés. */
function duel(): { partie: Partie; H: Combatant; E: Combatant } {
  const ouverture = creerPartie({ ...etatInitialDuJeu(), party: [heroDuDuel()] }, ENTREES);
  ouverture.envoyer({ type: 'startScene', args: [testScene()] });
  ouverture.envoyer({ type: 'startCombat', args: ['enc-mutants'] });
  ouverture.envoyer({ type: 'confirmRoundStart', args: [] });
  const garde = ouverture.etat();
  ouverture.fermer();
  const contact = auContact(garde);
  const partie = creerPartie({ ...garde, ...contact.patch }, ENTREES);
  const b = partie.etat().battle!;
  const H = activeCombatant(b)!;
  const E = b.combatants.find((c) => c.id === contact.E.id)!;
  return { partie, H, E };
}

const lire = (partie: Partie): Get => () => partie.etat() as never;
const contexte = (partie: Partie): ActionCtx => {
  const s = partie.etat();
  return { active: activeCombatant(s.battle!)!, battle: s.battle!, netMode: s.net.mode, gameTime: s.gameTime };
};
const refusDit = (partie: Partie): string | undefined => partie.etat().refus?.texte;

/** La case de `reach` au coût le plus haut (hors `sauf`). */
function laPlusLointaine(reach: Map<string, number>, sauf: Map<string, number> = new Map()): { x: number; y: number } {
  const [k] = [...reach].filter(([cle]) => !sauf.has(cle)).sort((a, b) => b[1] - a[1])[0];
  const [x, y] = k.split(',').map(Number);
  return { x, y };
}

describe('Course (LDB 15 l.41) : « la distance couverte vient en plus de celle parcourue par votre Mouvement »', () => {
  it('courir après avoir marché est permis, sans dépasser Mouvement restant + Course', () => {
    const { partie, H } = duel();
    try {
      envoyer(partie, 'battleClickTile', laPlusLointaine(computeMoveReach(lire(partie))), { confirm: true });
      const b0 = partie.etat().battle!;
      expect(b0.movementUsed, 'témoin : le héros a marché').toBeGreaterThan(0);
      expect(actionGate('course', contexte(partie))).toEqual({ ok: true });
      const zone = computeRunReach(lire(partie));
      const plafond = movementRemaining(b0, H) + distanceDeCourse(mouvementDeCourse(b0, H));
      expect(zone.size, 'aucune zone de Course après la Marche').toBeGreaterThan(0);
      expect(Math.max(...zone.values())).toBeLessThanOrEqual(plafond);
      envoyer(partie, 'battleRun', laPlusLointaine(zone, computeMoveReach(lire(partie))));
      const pr = partie.etat().pendingRun;
      expect(pr, 'la Course après la Marche est refusée').toBeTruthy();
      envoyer(partie, 'runRoll');
      const bonus = partie.etat().pendingRun!.result!.bonusCases;
      envoyer(partie, 'runConfirm');
      const b = partie.etat().battle!;
      expect(b.acted).toBe(true);
      expect(b.runBudget).toBe(mountMovement(b, H) + bonus);
      expect(b.movementUsed).toBeLessThanOrEqual(b.runBudget!);
    } finally {
      partie.fermer();
    }
  });

  it('courir Action dépensée est refusé, et le refus est dit', () => {
    const { partie } = duel();
    try {
      const zone = computeRunReach(lire(partie));
      expect(zone.size, 'témoin : la Course est offerte avant l’Action').toBeGreaterThan(0);
      envoyer(partie, 'battleDefendTotal');
      expect(partie.etat().battle!.acted, 'témoin : l’Action est dépensée').toBe(true);
      expect(actionGate('course', contexte(partie))).toEqual({ ok: false, reason: t('agate.actionSpent') });
      envoyer(partie, 'battleRun', laPlusLointaine(zone));
      expect(partie.etat().pendingRun).toBeNull();
      expect(refusDit(partie)).toBe(t('agate.actionSpent'));
    } finally {
      partie.fermer();
    }
  });

  it('Brisé court pour fuir (LDB 16 l.52)', () => {
    const { partie, H } = duel();
    try {
      addCondition(H, 'brise');
      expect(actionGate('course', contexte(partie))).toEqual({ ok: true });
      const zone = computeRunReach(lire(partie));
      expect(zone.size).toBeGreaterThan(0);
      envoyer(partie, 'battleRun', laPlusLointaine(zone));
      expect(partie.etat().pendingRun).toBeTruthy();
    } finally {
      partie.fermer();
    }
  });
});

describe('Course : un seul verdict pour l’offre, le geste et la zone (`refusDeCourse`)', () => {
  it('Mouvement nul : la Course est fermée au gate, au geste et à la zone', () => {
    const { partie, H } = duel();
    try {
      H.movement = 0;
      expect(mountMovement(partie.etat().battle!, H), 'témoin : Mouvement nul').toBe(0);
      expect(actionGate('course', contexte(partie))).toEqual({ ok: false, reason: t('agate.cannotMove') });
      expect(computeRunReach(lire(partie)).size).toBe(0);
      envoyer(partie, 'battleRun', { x: H.pos!.x + 3, y: H.pos!.y });
      expect(partie.etat().pendingRun).toBeNull();
      expect(refusDit(partie)).toBe(t('agate.cannotMove'));
    } finally {
      partie.fermer();
    }
  });

  it('cavalier Sprinter : le Mouvement de la monture (LDB 14 l.179) + le Sprinter du cavalier (LDB 11 l.41-47)', () => {
    const partie = creerPartie(etatInitialDuJeu(), ENTREES);
    try {
      jouer(partie, partie.lancer(lancementDuScenario(testScenarios.find((s) => s.id === 'entrainement')!)));
      if (!partie.etat().battle) envoyer(partie, 'startCombat', 'enc-entrainement');
      for (let pas = 0; pas < 40 && !(activeCombatant(partie.etat().battle!)?.kind === 'hero'); pas++) {
        const e = partie.etat();
        const verbes = e.pendingDefense ? ['defenseRoll', 'defenseConfirm'] : activeCombatant(e.battle!) ? ['battleEndTurn'] : ['confirmRoundStart'];
        for (const v of verbes) envoyer(partie, v);
      }
      const b = partie.etat().battle!;
      const R = activeCombatant(b)!;
      const monture = b.combatants.find((c) => c.mountable)!;
      mountUp(R, monture);
      R.engagedWith = [];
      R.talents = [...(R.talents ?? []), { talentId: 'sprinter', times: 1 }];
      R.resilience = 2;
      expect([mountMovement(b, R), runMovementBonus(R), runMovementBonus(monture)], 'témoin : cheval M7, cavalier Sprinter').toEqual([7, 1, 0]);
      envoyer(partie, 'battleRun', laPlusLointaine(computeRunReach(lire(partie))));
      envoyer(partie, 'runForceSuccess');
      expect(partie.etat().pendingRun!.result!.bonusCases).toBe(16);
    } finally {
      partie.fermer();
    }
  });

  it('À Terre ne laisse que ramper (LDB 16 l.35, `gating.movement: crawl`) : la Course est fermée, et le refus dit', () => {
    const { partie, H } = duel();
    try {
      const zone = computeRunReach(lire(partie));
      expect(zone.size, 'témoin : la Course est offerte debout').toBeGreaterThan(0);
      addCondition(H, 'a-terre');
      expect(actionGate('course', contexte(partie))).toEqual({ ok: false, reason: t('agate.prone') });
      expect(computeRunReach(lire(partie)).size).toBe(0);
      envoyer(partie, 'battleRun', laPlusLointaine(zone));
      expect(partie.etat().pendingRun).toBeNull();
      expect(refusDit(partie)).toBe(t('agate.prone'));
    } finally {
      partie.fermer();
    }
  });

  it('la moitié de Mouvement ne change pas : À Terre (crawl), Sonné (half), les deux (LDB 16 l.35, l.125)', () => {
    const { partie, H } = duel();
    try {
      const plein = effectiveMovement(H);
      const moitie = Math.floor(plein / 2);
      const sous = (etats: string[]): number => {
        for (const e of etats) addCondition(H, e);
        const m = effectiveMovement(H);
        H.conditions = H.conditions.filter((c) => !etats.includes(c.id));
        return m;
      };
      expect([sous(['a-terre']), sous(['sonne']), sous(['a-terre', 'sonne'])]).toEqual([moitie, moitie, moitie]);
    } finally {
      partie.fermer();
    }
  });
});

describe('Clic d’attaque : les refus élémentaires du tour (`refusDuTour.ts`), dits au siège', () => {
  it('Brisé : la frappe est refusée (LDB 16 l.52), et le refus est dit', () => {
    const { partie, H, E } = duel();
    try {
      addCondition(H, 'brise');
      envoyer(partie, 'battleClickEntity', E.id, { confirm: true });
      expect(partie.etat().pendingAttack ?? null).toBeNull();
      expect(refusDit(partie)).toBe(refusVerrouDAction(H));
    } finally {
      partie.fermer();
    }
  });
});

describe('Brisé en donnée (LDB 16 l.52, `restrictsAction`) : la Marche du verrouillé fuit', () => {
  it('la zone de Marche se restreint aux cases qui ne rapprochent pas de l’ennemi', () => {
    const { partie, H, E } = duel();
    try {
      E.pos = { x: H.pos!.x + 4, y: H.pos!.y }; // à distance : des cases rapprocheraient
      const libre = computeMoveReach(lire(partie));
      addCondition(H, 'brise');
      const fuite = computeMoveReach(lire(partie));
      expect(fuite.size).toBeGreaterThan(0);
      expect(fuite.size).toBeLessThan(libre.size);
      const d = (k: string) => { const [x, y] = k.split(',').map(Number); return Math.max(Math.abs(x - E.pos!.x), Math.abs(y - E.pos!.y)); };
      const ici = Math.max(Math.abs(H.pos!.x - E.pos!.x), Math.abs(H.pos!.y - E.pos!.y));
      expect([...fuite.keys()].filter((k) => d(k) < ici)).toEqual([]);
    } finally {
      partie.fermer();
    }
  });
});

/** Marche jusqu'au bout, puis l'Action : plus de Mouvement après l'Action (`canMove`). */
function actionEtMouvementDepenses(partie: Partie): void {
  envoyer(partie, 'battleClickTile', laPlusLointaine(computeMoveReach(lire(partie))), { confirm: true });
  envoyer(partie, 'battleDefendTotal');
  expect(partie.etat().battle, 'témoin : Marche puis Action').toMatchObject({ acted: true, movedPreAction: true });
}

describe('Désengagement (LDB 15 l.43-49) : une option par verdict', () => {
  it('Sonné sans Avantage : l’Esquive est fermée (LDB 16 l.125), la Fuite reste ouverte (LDB 15 l.61)', () => {
    const { partie, H, E } = duel();
    try {
      engage(H, E);
      addCondition(H, 'sonne');
      expect(actionGate('disengage', contexte(partie))).toEqual({ ok: true });
      envoyer(partie, 'battleDisengage');
      expect(partie.etat().pendingDisengage).toMatchObject({ canSacrifice: false, refusEsquive: t('agate.unableToAct'), canFuir: true });
      envoyer(partie, 'disengageRoll');
      expect(partie.etat().pendingDisengage, 'l’Esquive fermée s’est jouée').toMatchObject({ phase: 'choice', def: null });
    } finally {
      partie.fermer();
    }
  });

  it('Action dépensée, Engagé : la Fuite reste ouverte, elle prend le Mouvement (LDB 15 l.61)', () => {
    const { partie, H, E } = duel();
    try {
      engage(H, E);
      envoyer(partie, 'battleDefendTotal');
      expect(partie.etat().battle!.acted, 'témoin : l’Action est dépensée').toBe(true);
      expect(actionGate('disengage', contexte(partie))).toEqual({ ok: true });
      envoyer(partie, 'battleDisengage');
      expect(partie.etat().pendingDisengage).toMatchObject({ canSacrifice: false, refusEsquive: t('agate.actionSpent'), canFuir: true });
      envoyer(partie, 'disengageFlee');
      expect(partie.etat().pendingDisengage?.phase, 'la Fuite ne s’ouvre pas').toBe('fuir');
    } finally {
      partie.fermer();
    }
  });

  it('Action et Mouvement dépensés, sans Avantage : tout est fermé, et le refus est dit', () => {
    const { partie, H, E } = duel();
    try {
      actionEtMouvementDepenses(partie);
      engage(H, E);
      expect(actionGate('disengage', contexte(partie))).toEqual({ ok: false, reason: t('agate.actionSpent') });
      envoyer(partie, 'battleDisengage');
      expect(partie.etat().pendingDisengage).toBeNull();
      expect(refusDit(partie)).toBe(t('agate.actionSpent'));
    } finally {
      partie.fermer();
    }
  });

  it('Action et Mouvement dépensés, Avantage supérieur : seule l’option d’Avantage s’ouvre (LDB 15 l.47)', () => {
    const { partie, H, E } = duel();
    try {
      actionEtMouvementDepenses(partie);
      engage(H, E);
      H.advantage = 2;
      expect(actionGate('disengage', contexte(partie))).toEqual({ ok: true });
      envoyer(partie, 'battleDisengage');
      expect(partie.etat().pendingDisengage).toMatchObject({ canSacrifice: true, refusEsquive: t('agate.actionSpent'), canFuir: false });
    } finally {
      partie.fermer();
    }
  });

  const departs: [string, (H: Combatant, E: Combatant) => void][] = [
    ['plus grand que tous ses Engagés (LDB 85 l.373-374)', (_H, E) => { E.size = 'petite'; }],
    ['Nuée (LDB 85 l.253)', (H) => { H.swarm = true; }],
  ];
  for (const [nom, poser] of departs) {
    it(`${nom} : départ libre, Action et Mouvement dépensés, sans Avantage`, () => {
      const { partie, H, E } = duel();
      try {
        actionEtMouvementDepenses(partie);
        engage(H, E);
        poser(H, E);
        expect(actionGate('disengage', contexte(partie))).toEqual({ ok: true });
        envoyer(partie, 'battleDisengage');
        expect(partie.etat().battle!.combatants.find((c) => c.id === H.id)!.engagedWith ?? []).toEqual([]);
      } finally {
        partie.fermer();
      }
    });
  }
});

describe('Commits publics sous un État qui verrouille l’Action (LDB 16 l.52) : envoyés bruts, refusés et dits', () => {
  const sort = spells.find((s) => isArcaneSpell(s))!;
  const commits: [string, (H: Combatant, E: Combatant) => unknown[]][] = [
    ['battleHeal', (H) => [H.id, 'wounds']],
    ['battleFocusSpell', () => [sort.id]],
    ['battleDispelSpell', (_H, E) => [sort.id, E.id]],
  ];
  for (const [verbe, args] of commits) {
    it(`${verbe} : le Brisé est refusé par le verdict de son entrée`, () => {
      const { partie, H, E } = duel();
      try {
        addCondition(H, 'brise');
        envoyer(partie, verbe, ...args(H, E));
        expect(partie.etat().pendingHeal ?? partie.etat().pendingFocus ?? null).toBeNull();
        expect(refusDit(partie)).toBe(refusVerrouDAction(H));
      } finally {
        partie.fermer();
      }
    });
  }
});
