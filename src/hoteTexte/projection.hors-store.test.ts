/**
 * LA VUE LIT CE QUE LE JEU LIT (#2898, M4, sondes `distance` et `mvt` du juge promues) : la distance d'un combattant
 * à l'actif est celle du ciblage (`combatDistance` : empreinte et relief), et le Mouvement du Tour est celui de la
 * jauge de la console (`mouvementDuTour`). `pastilles-entite` porte une monture dont l'empreinte écarte la distance de
 * combat de la distance de case ; `ecuries-clayonnage`, un actif dont le budget du Tour n'est pas sa caractéristique.
 */
import { describe, it, expect } from 'vitest';
import { activeCombatant, combatDistance, mouvementDuTour } from '../noyau/index';
import { nouvelEntete, rejouer, type PartieRejouee } from './partieTexte';
import { pageDeLaCarte, projeter } from './vue';

/** La partie du scénario, sa pause de Round confirmée ; fermée après `faire`. */
function auPremierTour(scenario: string, faire: (r: PartieRejouee) => void) {
  const r = rejouer(nouvelEntete(scenario, { graine: 7 }), [{ type: 'confirmRoundStart', args: [] }]);
  try {
    faire(r);
  } finally {
    r.partie.fermer();
  }
}

describe('la projection lit les lecteurs du jeu', () => {
  it('la distance de chaque combattant est sa distance de combat à l’actif (`combatDistance`)', { timeout: 120_000 }, () => {
    auPremierTour('pastilles-entite', (r) => {
      const etat = r.partie.etat();
      const b = etat.battle!;
      const actif = activeCombatant(b)!;
      const { combattants } = pageDeLaCarte(etat);
      expect(combattants.length, 'témoin : la carte liste les combattants').toBe(b.combatants.length);
      for (const c of combattants) {
        const vrai = combatDistance(actif, b.combatants.find((x) => x.id === c.id)!);
        expect(c.distance, `${c.id} : distance de la vue`).toBe(Number.isFinite(vrai) ? vrai : null);
      }
    });
  });

  it('le Mouvement de l’actif est celui de la jauge (`mouvementDuTour`)', { timeout: 120_000 }, () => {
    auPremierTour('ecuries-clayonnage', (r) => {
      const etat = r.partie.etat();
      const b = etat.battle!;
      const actif = activeCombatant(b)!;
      const jauge = mouvementDuTour(b, actif);
      expect(projeter(etat, 1, r.journal.length).combat!.actif!.mouvement).toEqual([jauge.restant, jauge.total]);
    });
  });
});
