/**
 * UN VERDICT, LU PAR L'OFFRE ET PAR LE GESTE (#3059) : la Course, le Désengagement, le verrou d'État et les commits
 * publics du Soin, de la Focalisation et de la Dissipation se jouent sans store, sur le duel de
 * `combatDeTest.testkit.ts`. Chaque État se pose par la couture que le jeu appelle (`addCondition`, `engage`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { creerPartie, etatInitialDuJeu, activeCombatant, actionGate, type ActionCtx, type EntreesDeLaPartie, type Jeton, type Partie, type ResultatDeLAppel } from './index';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { Intention } from './partie';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { EtatDeJeu, Jeu } from './etat';
import { auContact, heroDuDuel } from './combatDeTest.testkit';
import { computeMoveReach, computeRunReach } from './combatFlow';
import { mountMovement, mountUp, movementRemaining, mouvementDeCourse } from './mount';
import { testScene } from '../scenes/test-fixture';
import { addCondition, refusVerrouDAction } from '../engine/conditions';
import { engage } from '../engine/engagement';
import { chebyshev } from '../engine/grid';
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

const envoyer = <K extends keyof ActionsDuNoyau>(partie: Partie, type: K, ...args: Parameters<ActionsDuNoyau[K]>): void =>
  jouer(partie, partie.envoyer({ type, args } as Intention));

/** La Course, telle que l'hôte la joue : l'offre `course` arme sa portée, le clic confirmé sur `pt` la commet. */
const courir = (partie: Partie, pt: { x: number; y: number }): void => {
  envoyer(partie, 'armerLIntention', 'course');
  envoyer(partie, 'cliquerLaCase', pt, undefined, { confirm: true });
};

/** L'état du duel ouvert, le tour au héros, H et E au contact sans être Engagés. */
function etatDuDuel(): { etat: EtatDeJeu; idDeE: string } {
  const ouverture = creerPartie(etatInitialDuJeu(), ENTREES);
  ouverture.lancer({ party: [heroDuDuel()], scene: testScene(), projet: null, combatDirect: 'enc-mutants' });
  ouverture.envoyer({ type: 'fenetreValider', args: ['debutDuRound'] });
  const garde = ouverture.etat();
  ouverture.fermer();
  const contact = auContact(garde);
  return { etat: { ...garde, ...contact.patch }, idDeE: contact.E.id };
}

/** Le duel joué par la partie. */
function duel(): { partie: Partie; H: Combatant; E: Combatant } {
  const { etat, idDeE } = etatDuDuel();
  const partie = creerPartie(etat, ENTREES);
  const b = partie.etat().battle!;
  return { partie, H: activeCombatant(b)!, E: b.combatants.find((c) => c.id === idDeE)! };
}

/** Le duel sur le banc : le banc lit aussi la machinerie (`ouvrirLaGuerison`, le corps qui commet le clic du Soin), qu’aucun hôte n’appelle. */
function duelSurLeBanc(): { banc: Banc; H: Combatant } {
  const banc = ouvrirLeBanc({ ...ENTREES, etat: etatDuDuel().etat });
  return { banc, H: activeCombatant(banc.getState().battle!)! };
}

const etatDe = (j: Partie | Banc): Jeu => ('getState' in j ? j.getState() : j.etat());
const lire = (j: Partie | Banc): Get => () => etatDe(j) as never;
const contexte = (j: Partie | Banc): ActionCtx => {
  const s = etatDe(j);
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
      envoyer(partie, 'cliquerLaCase', laPlusLointaine(computeMoveReach(lire(partie))), undefined, { confirm: true });
      const b0 = partie.etat().battle!;
      expect(b0.movementUsed, 'témoin : le héros a marché').toBeGreaterThan(0);
      expect(actionGate('course', contexte(partie))).toEqual({ ok: true });
      const zone = computeRunReach(lire(partie));
      const plafond = movementRemaining(b0, H) + distanceDeCourse(mouvementDeCourse(b0, H));
      expect(zone.size, 'aucune zone de Course après la Marche').toBeGreaterThan(0);
      expect(Math.max(...zone.values())).toBeLessThanOrEqual(plafond);
      courir(partie, laPlusLointaine(zone, computeMoveReach(lire(partie))));
      const pr = partie.etat().pendingRun;
      expect(pr, 'la Course après la Marche est refusée').toBeTruthy();
      envoyer(partie, 'jetLancer', 'course');
      const bonus = partie.etat().pendingRun!.result!.bonusCases;
      envoyer(partie, 'jetValider', 'course');
      const b = partie.etat().battle!;
      expect(b.acted).toBe(true);
      expect(b.runBudget).toBe(mountMovement(b, H) + bonus);
      expect(b.movementUsed).toBeLessThanOrEqual(b.runBudget!);
    } finally {
      partie.fermer();
    }
  });

  it('courir Action dépensée : l’offre est refusée par son verdict, et le refus est dit', () => {
    const { partie } = duel();
    try {
      expect(computeRunReach(lire(partie)).size, 'témoin : la Course est offerte avant l’Action').toBeGreaterThan(0);
      envoyer(partie, 'prendreLaDefensive');
      expect(partie.etat().battle!.acted, 'témoin : l’Action est dépensée').toBe(true);
      expect(actionGate('course', contexte(partie))).toEqual({ ok: false, reason: t('agate.actionSpent') });
      envoyer(partie, 'armerLIntention', 'course');
      expect(partie.etat().localIntent?.actionId, 'la Course refusée a armé sa portée').not.toBe('course');
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
      courir(partie, laPlusLointaine(zone));
      expect(partie.etat().pendingRun).toBeTruthy();
    } finally {
      partie.fermer();
    }
  });
});

describe('Course : un seul verdict pour l’offre, le geste et la zone (`refusDeCourse`)', () => {
  it('Mouvement nul : la Course est fermée au gate, au geste et à la zone', () => {
    const { banc, H } = duelSurLeBanc();
    H.movement = 0;
    expect(mountMovement(banc.getState().battle!, H), 'témoin : Mouvement nul').toBe(0);
    expect(actionGate('course', contexte(banc))).toEqual({ ok: false, reason: t('agate.cannotMove') });
    expect(computeRunReach(lire(banc)).size).toBe(0);
    banc.jouerLaCase('course');
    expect(banc.getState().localIntent?.actionId, 'la Course refusée a armé sa portée').not.toBe('course');
    expect(banc.getState().refus?.texte).toBe(t('agate.cannotMove'));
  });

  it('cavalier Sprinter : le Mouvement de la monture (LDB 14 l.179) + le Sprinter du cavalier (LDB 11 l.41-47)', () => {
    const partie = creerPartie(etatInitialDuJeu(), ENTREES);
    try {
      jouer(partie, partie.lancer({ ...lancementDuScenario(testScenarios.find((s) => s.id === 'entrainement')!, idsDeTest), combatDirect: 'enc-entrainement' }));
      for (let pas = 0; pas < 40 && !(activeCombatant(partie.etat().battle!)?.kind === 'heros'); pas++) {
        const e = partie.etat();
        const intentions: Intention[] = e.pendingDefense
          ? [{ type: 'jetLancer', args: ['defense'] }, { type: 'jetValider', args: ['defense'] }]
          : activeCombatant(e.battle!) ? [{ type: 'terminerLeTour', args: [] }] : [{ type: 'fenetreValider', args: ['debutDuRound'] }];
        for (const intention of intentions) jouer(partie, partie.envoyer(intention));
      }
      const b = partie.etat().battle!;
      const R = activeCombatant(b)!;
      const monture = b.combatants.find((c) => c.mountable)!;
      mountUp(R, monture);
      R.engagedWith = [];
      R.talents = [...(R.talents ?? []), { talentId: 'sprinter', times: 1 }];
      R.resilience = 2;
      expect([mountMovement(b, R), runMovementBonus(R), runMovementBonus(monture)], 'témoin : cheval M7, cavalier Sprinter').toEqual([7, 1, 0]);
      courir(partie, laPlusLointaine(computeRunReach(lire(partie))));
      envoyer(partie, 'jetForcerLaReussite', 'course');
      expect(partie.etat().pendingRun!.result!.bonusCases).toBe(16);
    } finally {
      partie.fermer();
    }
  });

  it('À Terre ne laisse que ramper (LDB 16 l.35, `gating.movement: crawl`) : la Course est fermée, et le refus dit', () => {
    const { banc, H } = duelSurLeBanc();
    const zone = computeRunReach(lire(banc));
    expect(zone.size, 'témoin : la Course est offerte debout').toBeGreaterThan(0);
    addCondition(H, 'a-terre');
    expect(actionGate('course', contexte(banc))).toEqual({ ok: false, reason: t('agate.prone') });
    expect(computeRunReach(lire(banc)).size).toBe(0);
    banc.jouerLaCase('course');
    expect(banc.getState().localIntent?.actionId, 'la Course refusée a armé sa portée').not.toBe('course');
    expect(banc.getState().refus?.texte).toBe(t('agate.prone'));
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
      envoyer(partie, 'cliquerLaCase', { ...E.pos! }, E.id, { confirm: true });
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
      const d = (k: string) => { const [x, y] = k.split(',').map(Number); return chebyshev({ x, y }, E.pos!); };
      const ici = chebyshev(H.pos!, E.pos!);
      expect([...fuite.keys()].filter((k) => d(k) < ici)).toEqual([]);
    } finally {
      partie.fermer();
    }
  });
});

/** Marche jusqu'au bout, puis l'Action : plus de Mouvement après l'Action (`canMove`). */
function actionEtMouvementDepenses(partie: Partie): void {
  envoyer(partie, 'cliquerLaCase', laPlusLointaine(computeMoveReach(lire(partie))), undefined, { confirm: true });
  envoyer(partie, 'prendreLaDefensive');
  expect(partie.etat().battle, 'témoin : Marche puis Action').toMatchObject({ acted: true, movedPreAction: true });
}

describe('Désengagement (LDB 15 l.43-49) : une option par verdict', () => {
  it('Sonné sans Avantage : l’Esquive est fermée (LDB 16 l.125), la Fuite reste ouverte (LDB 15 l.61)', () => {
    const { partie, H, E } = duel();
    try {
      engage(H, E);
      addCondition(H, 'sonne');
      expect(actionGate('desengagement', contexte(partie))).toEqual({ ok: true });
      envoyer(partie, 'rompreLEngagement');
      expect(partie.etat().pendingDisengage).toMatchObject({ canSacrifice: false, refusEsquive: t('agate.unableToAct'), canFuir: true });
      envoyer(partie, 'jetLancer', 'desengagement');
      expect(partie.etat().pendingDisengage, 'l’Esquive fermée s’est jouée').toMatchObject({ phase: 'choix', def: null });
    } finally {
      partie.fermer();
    }
  });

  it('Action dépensée, Engagé : la Fuite reste ouverte, elle prend le Mouvement (LDB 15 l.61)', () => {
    const { partie, H, E } = duel();
    try {
      engage(H, E);
      envoyer(partie, 'prendreLaDefensive');
      expect(partie.etat().battle!.acted, 'témoin : l’Action est dépensée').toBe(true);
      expect(actionGate('desengagement', contexte(partie))).toEqual({ ok: true });
      envoyer(partie, 'rompreLEngagement');
      expect(partie.etat().pendingDisengage).toMatchObject({ canSacrifice: false, refusEsquive: t('agate.actionSpent'), canFuir: true });
      envoyer(partie, 'jetRegler', 'desengagement', 'fuir', true);
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
      expect(actionGate('desengagement', contexte(partie))).toEqual({ ok: false, reason: t('agate.actionSpent') });
      envoyer(partie, 'rompreLEngagement');
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
      expect(actionGate('desengagement', contexte(partie))).toEqual({ ok: true });
      envoyer(partie, 'rompreLEngagement');
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
        expect(actionGate('desengagement', contexte(partie))).toEqual({ ok: true });
        envoyer(partie, 'rompreLEngagement');
        expect(partie.etat().battle!.combatants.find((c) => c.id === H.id)!.engagedWith ?? []).toEqual([]);
      } finally {
        partie.fermer();
      }
    });
  }
});

describe('Commits publics sous un État qui verrouille l’Action (LDB 16 l.52) : envoyés bruts, refusés et dits', () => {
  const sort = spells.find((s) => isArcaneSpell(s))!;
  const commits: ((H: Combatant, E: Combatant) => Intention)[] = [
    (H) => ({ type: 'focaliserLeSort', args: [H.id, sort.id] }),
    (H, E) => ({ type: 'dissiperLeSort', args: [H.id, sort.id, E.id] }),
  ];
  for (const commit of commits) {
    it(`${commit({ id: 'H' } as Combatant, { id: 'E' } as Combatant).type} : le Brisé est refusé par le verdict de son entrée`, () => {
      const { partie, H, E } = duel();
      try {
        addCondition(H, 'brise');
        jouer(partie, partie.envoyer(commit(H, E)));
        expect(partie.etat().pendingFocus).toBeNull();
        expect(refusDit(partie)).toBe(refusVerrouDAction(H));
      } finally {
        partie.fermer();
      }
    });
  }

  it('ouvrirLaGuerison, que commet le clic du Soin : le Brisé est refusé par le verdict de son entrée', () => {
    const { banc, H } = duelSurLeBanc();
    addCondition(H, 'brise');
    banc.getState().ouvrirLaGuerison(H.id);
    expect(banc.getState().pendingHeal).toBeNull();
    expect(banc.getState().refus?.texte).toBe(refusVerrouDAction(H));
  });
});
