/**
 * LA VALIDATION D'UNE FENÊTRE (#3369) : `fenetreValider(fenetre)` joue le corps que la table des validations donne à la
 * fenêtre, dans ce que son registre ouvre (`validation`, `FERMETURES_DE_LA_VALIDATION`), et refuse le reste en le
 * disant ; en coop, elle suit le siège que le registre déclare (`netOwnership.ROUTES`). Une fenêtre à quorum
 * (validation ou sortie) marque prêt le siège qui l'appelle, et ne se joue qu'au quorum (`jouerOuMarquer`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { initialNet } from './etat';
import { intentAllowedFor } from './netOwnership';
import { appliquerLIntentionDUnSiege } from './intentionsDeSiege';
import { fermetureDeLaSortie } from './sortieDeFenetre';
import type { FenetreAValider } from './modalArbiter';
import { groupeDeScenario } from '../scenes/test-scenarios/_heros';
import { t } from '../i18n';

const RECAP = { titre: 'C', px: 0, chronique: [], tombes: [], lieux: [] };
/** La fin de séance qu'ouvre le récap de chapitre avec lui (`armChapterRecap`). */
const SEANCE = { heros: {}, groupe: {} };

/** Chaque fenêtre que l'hôte seul valide, et l'état qui l'ouvre. */
const FENETRES_DE_L_HOTE: readonly (readonly [FenetreAValider, Record<string, unknown>])[] = [
  ['ouverture', { pendingOuverture: { titre: 'O' } }],
  ['finDeChapitre', { pendingChapterRecap: RECAP, finDeSeance: SEANCE }],
  ['finDeSeance', { finDeSeance: SEANCE }],
  ['depart', { pendingDeparture: { mode: 'pied', cause: 'nuit', dawnAt: 0 } }],
  ['interlude', { interlude: { heroes: [] } }],
  ['marchand', { merchant: { pendingDistribution: [{ itemId: 'x' }] } }],
];

/** Coop : l'hôte (siège 0) et un invité (siège 1), un héros chacun. */
function hoteEtUnInvite(banc: Banc): void {
  const [a, b] = groupeDeScenario(idsDeTest, 'soldat', 'tueur');
  banc.setState({ party: [a, b], net: { ...initialNet(), mode: 'hote', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Invité' }, ownership: { [a.id]: 0, [b.id]: 1 }, slots: [1, 1, 0, 0] } });
}

const VICTOIRE = { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, gear: [], defeated: [] };

describe('fenetreValider', () => {
  it('une fenêtre qui ne se valide pas, ou qui n’est pas ouverte, se refuse et le dit', () => {
    const banc = ouvrirLeBanc();
    banc.getState().fenetreValider('cascade' as never);
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('validation.refus.inconnue'));
    banc.getState().fenetreValider('finDeChapitre');
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('validation.refus.fermee'));
    expect(intentAllowedFor({ ...banc.getState(), net: { ...banc.getState().net, mode: 'hote' } }, 0, 'fenetreValider', ['finDeChapitre']), 'fenêtre fermée : aucun siège').toBe(false);
  });

  it.each(FENETRES_DE_L_HOTE)('la validation de l’hôte reste à l’hôte (%s) : refusée dans l’état d’un invité, et au siège d’un invité', (fenetre, ouverte) => {
    const banc = ouvrirLeBanc();
    banc.setState({ ...ouverte, net: { ...banc.getState().net, mode: 'invite' } } as never);
    const avant = banc.getState();
    banc.getState().fenetreValider(fenetre);
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('validation.refus.hoteSeul'));
    for (const cle of Object.keys(ouverte)) expect((banc.getState() as unknown as Record<string, unknown>)[cle], 'la fenêtre reste ouverte').toBe((avant as unknown as Record<string, unknown>)[cle]);

    banc.setState({ net: { ...banc.getState().net, mode: 'hote' } });
    expect(intentAllowedFor(banc.getState(), 1, 'fenetreValider', [fenetre])).toBe(false);
    expect(intentAllowedFor(banc.getState(), 0, 'fenetreValider', [fenetre])).toBe(true);
  });

  it('l’hôte valide le récapitulatif du chapitre : la fenêtre se ferme', () => {
    const banc = ouvrirLeBanc();
    banc.setState({ pendingChapterRecap: RECAP, finDeSeance: SEANCE });
    banc.getState().fenetreValider('finDeChapitre');
    expect(banc.getState().pendingChapterRecap).toBeNull();
    expect(banc.getState().finDeSeance, 'la séance du récap est terminée').toBeNull();
  });
});

describe('la fenêtre à quorum : chaque siège requis se dit prêt, le dernier la joue', () => {
  it('solo : le quorum est l’hôte seul, la victoire se ferme d’un appel', () => {
    const banc = ouvrirLeBanc();
    banc.setState({ party: groupeDeScenario(idsDeTest, 'soldat'), pendingVictory: VICTOIRE } as never);
    banc.getState().fenetreFermer('victoire');
    expect(banc.getState().pendingVictory).toBeNull();
  });

  it('coop : l’appel de l’hôte le marque prêt, sans fermer ; son second appel se refuse ; l’invité, dernier prêt, ferme', () => {
    const banc = ouvrirLeBanc();
    hoteEtUnInvite(banc);
    banc.setState({ pendingVictory: VICTOIRE } as never);
    banc.getState().fenetreFermer('victoire');
    expect(banc.getState().pendingVictory?.readyBySeat, 'l’hôte forçait la fermeture sans le quorum').toEqual({ 0: true });
    expect(fermetureDeLaSortie(banc.getState(), 'victoire')).toBe('quorumAttendu');
    banc.getState().fenetreFermer('victoire');
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('jet.ferme.quorumAttendu'));
    expect(intentAllowedFor(banc.getState(), 1, 'fenetreFermer', ['victoire'])).toBe(true);
    expect(appliquerLIntentionDUnSiege(banc.getState, 1, 'fenetreFermer', ['victoire'])).toBe('appliquee');
    expect(banc.getState().pendingVictory, 'quorum atteint : la victoire se ferme').toBeNull();
  });
});
