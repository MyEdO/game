/**
 * LES REVENUS BLOQUÉS PAR L'ÉVÉNEMENT DE LA PÉRIODE, sans store (#3059 S3) : le geste d'Activité
 * Revenus d'un héros dont l'Événement bloque la Classe est refusé en tête par `refusDeRevenus`, dit au
 * journal, sans consommer d'Activité ni ouvrir de jet. LDB 22, LDB 08 l.105-120
 */
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineCascade, poseSurDeNonTombe } from './cascade.testkit';
import { createHero } from '../engine/character';
import { refusDeRevenus } from './verdictsDInterlude';

/** d100 de « Répression du crime » (`interludeEvents.json`, 19-21) : Revenus bloqués aux roublards. */
const REPRESSION_DU_CRIME = 20;

/** Un banc sur un interlude d'une semaine dont l'Événement est tombé à `REPRESSION_DU_CRIME`. */
function apresLaRepression(careerId: string, label: string): { banc: Banc; heroId: string } {
  const h = createHero({ speciesId: 'humains-reiklander', careerId, label, seed: 1701 });
  const banc = ouvrirLeBanc({ graine: 7, desFixes: false, etat: { party: [h] } });
  banc.actions.startInterlude(1);
  draineCascade(banc.getState, 200, poseSurDeNonTombe(REPRESSION_DU_CRIME));
  expect(banc.getState().interlude?.phase, 'témoin : le tirage est dénoué').toBe('activities');
  expect(banc.getState().interlude?.perHero[h.id].eventRoll, 'témoin : l’Événement posé').toBe(REPRESSION_DU_CRIME);
  return { banc, heroId: h.id };
}

describe('refusDeRevenus — le geste Revenus d’un héros dont la Classe est bloquée', () => {
  it('un roublard : le geste est refusé, la raison est dite, aucune Activité consommée, rien en attente', () => {
    const { banc, heroId } = apresLaRepression('voleur', 'Larron');
    const raison = refusDeRevenus(banc.getState(), heroId);
    expect(raison).toBe('Larron ne peut pas entreprendre Revenus (événement : Répression du crime).');
    const avant = JSON.stringify(banc.getState().interlude);
    const journal = banc.getState().journal.length;
    banc.actions.interludeActivity(heroId, 'revenus');
    expect(banc.getState().journal.slice(journal)).toEqual([raison]);
    expect(JSON.stringify(banc.getState().interlude), 'une Activité a été consommée').toBe(avant);
    expect(banc.getState().pendingActivity).toBeNull();
  });

  it('un guerrier sous le même Événement : aucun refus, les Revenus s’ouvrent', () => {
    const { banc, heroId } = apresLaRepression('soldat', 'Vétéran');
    expect(refusDeRevenus(banc.getState(), heroId)).toBeNull();
    banc.actions.interludeActivity(heroId, 'revenus');
    expect(banc.getState().pendingActivity?.heroId).toBe(heroId);
  });
});
