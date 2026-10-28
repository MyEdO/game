/**
 * LES VERROUS DE LA CONSOLE SONT CEUX DU NOYAU (#3059) : ce que la console grisait par un second verrou, le registre
 * (`actionGate`, lu par l'hôte texte et par la console) le refuse lui-même. Sans store : la partie lance un scénario,
 * et l'État se pose par la couture que le jeu appelle (`addCondition`).
 */
import { describe, it, expect } from 'vitest';
import {
  creerPartie, etatInitialDuJeu, activeCombatant, actionGate, offresDeLActif,
  type ActionCtx, type EntreesDeLaPartie, type Jeton, type Partie, type ResultatDeLAppel,
} from './index';
import { addCondition } from '../engine/conditions';
import { ACTION_GATES } from './actionRegistry';
import { ACTIONS, findConditionById, type ActionDef } from '../data/index';
import { aRecharger } from '../engine/weaponLoad';
import { lancementDuScenario } from '../scenes/test-scenarios/_shared';
import { testScenarios } from '../scenes/test-scenarios';
import { t } from '../i18n';
import type { Combatant } from '../engine/types';

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

/** Jusqu'au premier tour que `tenu` accepte : pause de Round confirmée, défense jouée, tour d'un autre héros fini. */
function jusquAuTour(partie: Partie, tenu: (c: Combatant) => boolean): Combatant {
  for (let pas = 0; pas < 40; pas++) {
    const actif = activeCombatant(partie.etat().battle!);
    if (actif && tenu(actif)) return actif;
    const e = partie.etat();
    const verbes = e.pendingDefense ? (['defenseRoll', 'defenseConfirm'] as const) : actif ? (['battleEndTurn'] as const) : (['confirmRoundStart'] as const);
    for (const type of verbes) jouer(partie, partie.envoyer({ type, args: [] }));
  }
  throw new Error('témoin : le tour attendu n’est pas venu');
}

/** La partie du scénario `id`, au premier tour que `tenu` accepte. */
function auTour(id: string, tenu: (c: Combatant) => boolean): Partie {
  const partie = creerPartie(etatInitialDuJeu(), ENTREES);
  try {
    jouer(partie, partie.lancer(lancementDuScenario(testScenarios.find((s) => s.id === id)!)));
    jusquAuTour(partie, tenu);
    return partie;
  } catch (e) {
    partie.fermer();
    throw e;
  }
}

const contexte = (partie: Partie): ActionCtx => {
  const s = partie.etat();
  return { active: activeCombatant(s.battle!)!, battle: s.battle!, netMode: s.net.mode, gameTime: s.gameTime };
};

/** L'attendu par entrée : `true` = un gate de l'entrée se FERME sous l'État, avec la raison de l'État ; `false` = aucun
 *  gate de l'entrée ne bouge. Brisé : LDB 16 l.52. Sonné : LDB 16 l.125 ; Distraire coûte le Mouvement, LDB 10 l.364 ;
 *  Course coûte l'Action, LDB 15 l.41, et Brisé court pour fuir, LDB 16 l.52 ; Désengagement : l'Esquive coûte l'Action,
 *  LDB 15 l.49, Brisé s'éloigne, LDB 16 l.52 (porteur sans Avantage ni départ libre, LDB 15 l.47, LDB 85 l.253, l.373-374). */
const MATRICE: Record<string, { brise: boolean; sonne: boolean }> = {
  reload: { brise: true, sonne: true },
  aim: { brise: true, sonne: true },
  'use-item': { brise: true, sonne: true },
  heal: { brise: true, sonne: true },
  water: { brise: true, sonne: true },
  defend: { brise: true, sonne: true },
  'gain-advantage': { brise: true, sonne: true },
  battement: { brise: true, sonne: true },
  'aid-team': { brise: true, sonne: true },
  dispel: { brise: true, sonne: true },
  'self-maneuver': { brise: true, sonne: true },
  'maneuver-area': { brise: true, sonne: true },
  'cast-spell': { brise: true, sonne: true },
  'leave-poste': { brise: true, sonne: true },
  'maneuver-ship': { brise: true, sonne: true },
  'select-attack': { brise: true, sonne: true },
  dismount: { brise: true, sonne: false },
  distraire: { brise: true, sonne: false },
  mouvement: { brise: false, sonne: false },
  course: { brise: false, sonne: true },
  disengage: { brise: false, sonne: true },
  'posture-tir': { brise: false, sonne: false },
  'posture-tas': { brise: false, sonne: false },
  stand: { brise: false, sonne: false },
  'resolve-psych-immune': { brise: false, sonne: false },
  'resolve-ignore-crit': { brise: false, sonne: false },
  'resolve-remove-condition': { brise: false, sonne: false },
};

/** Les gates de `def` que l'État `etat`, posé par `addCondition`, fait passer d'ouvert à fermé, avec leur raison. */
function gatesFermesPar(ctx: ActionCtx, def: ActionDef, etat: string): Map<string, string | undefined> {
  const noms = [def.gate].flat();
  const avant = new Map(noms.map((g) => [g, ACTION_GATES[g]({ ...ctx, def }).ok]));
  addCondition(ctx.active, etat);
  try {
    const fermes = new Map<string, string | undefined>();
    for (const g of noms) {
      const apres = ACTION_GATES[g]({ ...ctx, def });
      if (avant.get(g) && !apres.ok) fermes.set(g, apres.reason);
    }
    return fermes;
  } finally {
    ctx.active.conditions = ctx.active.conditions.filter((c) => c.id !== etat);
  }
}

describe('Matrice des verrous d’État : le registre ferme ce que la console grisait, et rien d’autre', () => {
  const raisons: Record<'brise' | 'sonne', (c: Combatant) => string> = {
    brise: (c) => t('cs.stateLockFlee', { name: c.label, etat: findConditionById('brise')!.label }),
    sonne: () => t('agate.unableToAct'),
  };
  for (const etat of ['brise', 'sonne'] as const) {
    it(`${etat} : chaque entrée se ferme ou reste ouverte selon son attendu`, () => {
      const partie = auTour('pastilles-entite', (c) => c.kind === 'hero');
      try {
        const ctx = contexte(partie);
        const ecarts: string[] = [];
        const attendus = Object.entries(MATRICE).map(([id, a]) => [id, a[etat]] as const);
        for (const [id, ferme] of attendus) {
          const def = ACTIONS.find((a) => a.id === id);
          if (!def) { ecarts.push(`${id} : absent du registre`); continue; }
          const fermes = gatesFermesPar(ctx, def, etat);
          const raison = raisons[etat](ctx.active);
          if (ferme && ![...fermes.values()].includes(raison)) ecarts.push(`${id} : reste ouvert (${[def.gate].flat().join(', ')})`);
          if (!ferme && fermes.size) ecarts.push(`${id} : fermé par ${[...fermes.keys()].join(', ')}`);
        }
        expect(ecarts).toEqual([]);
      } finally {
        partie.fermer();
      }
    });
  }
});

describe('État qui verrouille l’Action (LDB 16 l.52) : la raison du verdict est celle du dispatcher', () => {
  it('Brisé : le mode armé que refuse `battleSelectAction` porte la MÊME raison que le gate', () => {
    const partie = auTour('pastilles-entite', (c) => c.kind === 'hero');
    try {
      const ctx = contexte(partie);
      addCondition(ctx.active, 'brise');
      const r = partie.envoyer({ type: 'battleSelectAction', args: ['heal'] });
      expect(partie.etat().battle!.action, 'le Brisé a armé le Soin').toBeNull();
      expect(r.journal.flatMap((l) => (l.de === 'journal' ? [l.texte] : []))).toContain(actionGate('defend', ctx).reason);
    } finally {
      partie.fermer();
    }
  });
});

describe('Préalables et pertinence : l’offre refuse ce que le dispatcher refuse', () => {
  it('Recharger sans arme à recharger est fermé', () => {
    const partie = auTour('pastilles-entite', (c) => c.kind === 'hero');
    try {
      const ctx = contexte(partie);
      expect(ctx.active.weapons.some((w) => aRecharger(ctx.active, w)), 'témoin : une arme est à recharger').toBe(false);
      expect(actionGate('reload', ctx)).toEqual({ ok: false, reason: t('agate.nothingToReload') });
    } finally {
      partie.fermer();
    }
  });

  it('Viser n’est plus offert au tireur déjà en joue (pertinence, LDB 14 l.61)', () => {
    const tireur = (c: Combatant) => c.kind === 'hero' && c.weapons.some((w) => w.type === 'ranged');
    const partie = auTour('ecuries-clayonnage', tireur);
    try {
      const id = activeCombatant(partie.etat().battle!)!.id;
      jouer(partie, partie.envoyer({ type: 'battleAim', args: [] }));
      expect(activeCombatant(partie.etat().battle!)!.aiming, 'témoin : la visée n’a pas pris').toBe(true);
      jouer(partie, partie.envoyer({ type: 'battleEndTurn', args: [] }));
      jusquAuTour(partie, (c) => c.id === id && !partie.etat().battle!.acted);
      const ctx = contexte(partie);
      expect(actionGate('aim', ctx)).toEqual({ ok: false, reason: t('agate.alreadyAiming') });
      expect(offresDeLActif(ctx).some((o) => o.actionId === 'aim'), 'Viser reste offert en joue').toBe(false);
    } finally {
      partie.fermer();
    }
  });

  it('Coque : la Bordée se ferme quand aucune pièce n’est chargée (`postesPretsAFaireFeu`, lu par `battleShipBattery`)', () => {
    const partie = auTour('duel-naval', (c) => !!c.postes?.length && c.kind === 'hero');
    try {
      const ctx = contexte(partie);
      expect(actionGate('battery', ctx), 'témoin : pièces chargées, la Bordée est ouverte').toEqual({ ok: true });
      for (const p of ctx.active.postes!) p.loaded = false;
      expect(actionGate('battery', ctx)).toEqual({ ok: false, reason: t('agate.noLoadedPostes') });
    } finally {
      partie.fermer();
    }
  });

  it('Coque : chant sans chanteur et recharge sans pièce déchargée sont fermés', () => {
    const partie = auTour('duel-naval', (c) => !!c.postes?.length && c.kind === 'hero');
    try {
      const ctx = contexte(partie);
      expect(actionGate('sing-shanty', { ...ctx, args: { shipId: ctx.active.id } }).reason).toBe(t('agate.noShantySinger'));
      const poste = ctx.active.postes![0];
      expect(poste.loaded, 'témoin : la pièce est déchargée').not.toBe(false);
      expect(actionGate('ship-reload', { ...ctx, args: { shipId: ctx.active.id, posteUid: poste.item.uid } }).reason).toBe(t('agate.noPosteToReload'));
    } finally {
      partie.fermer();
    }
  });
});
