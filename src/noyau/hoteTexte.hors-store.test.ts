/**
 * CE QUE LE NOYAU DOIT À UN HÔTE TEXTE (#2898), sans store : un hôte qui n'a que la surface (`./index`) et un
 * lancement construit lance un scénario de test par la partie, joue les offres du registre par `jouerLOffre`, et
 * lit sa vue par les lecteurs de la surface. Le scénario est `pastilles-entite` (combat direct, monture, pièce et
 * tas au sol).
 */
import { describe, it, expect } from 'vitest';
import {
  creerPartie, etatInitialDuJeu, activeCombatant, actionGate, endTurnArmed, offresDuRegistre,
  type ActionCtx, type EntreesDeLaPartie, type Jeton, type Partie, type ResultatDeLAppel,
} from './index';
import { lancementDuScenario } from '../scenes/test-scenarios/_shared';
import { testScenarios } from '../scenes/test-scenarios';

const ENTREES: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: false, persisterLeHeros: () => {} };
const PASTILLES = testScenarios.find((s) => s.id === 'pastilles-entite')!;

const emis = ({ evenements }: ResultatDeLAppel) => evenements.flatMap((e) => (e.type === 'emis' ? [e.evt] : []));

/** La partie au tour d'un héros : le lancement, puis les débuts de Round confirmés, chaque jeton programmé repris
 *  dans l'ordre d'arrivée. */
function auTourDUnHeros(): Partie {
  const partie = creerPartie(etatInitialDuJeu(), ENTREES);
  const file: Jeton[] = [];
  const jouer = (r: ResultatDeLAppel): void => {
    for (const e of r.evenements) if (e.type === 'programme') file.push(e.jeton);
    for (let pas = 0; file.length && pas < 500; pas++) jouer(partie.reprendre(file.shift()!));
  };
  jouer(partie.lancer(lancementDuScenario(PASTILLES)));
  for (let pas = 0; pas < 20 && activeCombatant(partie.etat().battle!)?.kind !== 'hero'; pas++) jouer(partie.envoyer({ type: 'confirmRoundStart', args: [] }));
  expect(activeCombatant(partie.etat().battle!)?.kind, 'témoin : aucun héros n’est venu au tour').toBe('hero');
  return partie;
}

const contexte = (partie: Partie): ActionCtx => {
  const s = partie.etat();
  return { active: activeCombatant(s.battle!)!, battle: s.battle!, netMode: s.net.mode };
};

describe('Partie.lancer — le lancement d’un scénario est un appel de la partie', () => {
  it('rend `arrivee_en_scene` et les lignes du lancement dans SON résultat ; l’appel suivant n’en rend aucune', () => {
    const partie = creerPartie(etatInitialDuJeu(), ENTREES);
    try {
      const lancement = partie.lancer(lancementDuScenario(PASTILLES));
      expect(lancement.issue).toBe('appliquee');
      expect(emis(lancement), 'le lancement ne rend pas son entrée en scène').toContain('arrivee_en_scene');
      expect(lancement.journal.length, 'le lancement ne rend pas les lignes qu’il a écrites').toBeGreaterThan(0);
      expect(partie.etat().battle, 'le combat direct du scénario n’a pas démarré').toBeTruthy();
      expect(partie.etat().screen, 'sans bataille de masse, le lancement mène à la campagne').toBe('campaign');
      const suivant = partie.envoyer({ type: 'log', args: ['TÉMOIN'] });
      expect(emis(suivant), 'l’appel suivant rend les événements du lancement').toEqual([]);
      expect(suivant.journal, 'l’appel suivant rend les lignes du lancement').toEqual([{ de: 'journal', texte: 'TÉMOIN' }]);
    } finally {
      partie.fermer();
    }
  });
});

describe('jouerLOffre — la porte des offres, en intention', () => {
  it('une Charge jouée arme l’intention locale ; au nom d’un siège, elle est hors allowlist', () => {
    const partie = auTourDUnHeros();
    try {
      expect(actionGate('charge', contexte(partie)), 'témoin : la Charge est fermée').toEqual({ ok: true });
      expect(partie.etat().localIntent).toBeNull();
      expect(partie.envoyer({ type: 'jouerLOffre', args: ['charge'], siege: 0 }).issue).toBe('hors-allowlist');
      expect(partie.etat().localIntent, 'une intention hors allowlist a couru').toBeNull();
      expect(partie.envoyer({ type: 'jouerLOffre', args: ['charge'] }).issue).toBe('appliquee');
      expect(partie.etat().localIntent).toEqual({ actionId: 'charge' });
    } finally {
      partie.fermer();
    }
  });

  it('`end-turn`, l’Action intacte, arme le garde-fou du tour gâché sans finir le tour', () => {
    const partie = auTourDUnHeros();
    try {
      const actif = activeCombatant(partie.etat().battle!)!.id;
      expect(endTurnArmed(partie.etat().battle!), 'témoin : le garde-fou est déjà armé').toBe(false);
      partie.envoyer({ type: 'jouerLOffre', args: ['end-turn'] });
      expect(endTurnArmed(partie.etat().battle!)).toBe(true);
      expect(activeCombatant(partie.etat().battle!)!.id, 'le premier geste a fini le tour').toBe(actif);
    } finally {
      partie.fermer();
    }
  });
});

describe('les lecteurs de la vue', () => {
  it('`actionGate` rend sa raison sur une offre fermée', () => {
    const partie = auTourDUnHeros();
    try {
      const gate = actionGate('focus-spell', contexte(partie));
      expect(gate.ok).toBe(false);
      expect(gate.reason, 'une offre fermée sans raison').toBeTruthy();
    } finally {
      partie.fermer();
    }
  });

  it('`offresDuRegistre` n’offre rien sans candidat, même quand le prédicat d’offre est ouvert', () => {
    const partie = auTourDUnHeros();
    try {
      const ctx = { ...contexte(partie), state: partie.etat() };
      const offertes = (surface: Parameters<typeof offresDuRegistre>[0]) => offresDuRegistre(surface, ctx).flatMap((g) => g.offres.map((o) => o.actionId));
      expect(actionGate('reload', ctx).ok, 'témoin : le prédicat de Recharger est fermé').toBe(true);
      expect(offertes('deduite-du-set'), 'Recharger est offert sans munition à charger').not.toContain('reload');
      expect(offertes('pastille-entite'), 'témoin : le champ n’offre plus ses gestes').toEqual(expect.arrayContaining(['mount', 'pickup']));
      expect(offertes('pastille-entite'), 'Servir est offert sans poste à servir').not.toContain('man-poste');
    } finally {
      partie.fermer();
    }
  });
});
