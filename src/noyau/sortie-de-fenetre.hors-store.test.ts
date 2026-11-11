/**
 * LA SORTIE D'UNE FENÊTRE (#3367) : `fenetreFermer(fenetre)` joue le corps que la table des sorties donne à la fenêtre,
 * dans ce que son registre ouvre (`sortie`, `sortieFermee`), et refuse le reste en le disant ; en coop, elle suit le
 * siège que le registre déclare (`netOwnership.ROUTES`).
 */
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc } from './banc.testkit';
import { cascadeDeTest } from './cascade.testkit';
import { fermeturesDeLaFenetre } from './verbesOuverts';
import { intentAllowedFor } from './netOwnership';
import { t } from '../i18n';
import { cleDeFixture } from './noyau.testkit';
import { fixtureText } from '../i18n/fixtureText';
import type { CascadeStep } from './pendings';

/** Une séquence de trois étapes d'affichage, curseur sur la première. */
const TROIS_ETAPES: CascadeStep[] = ['e1', 'e2', 'e3'].map((id) => ({ id, kind: cleDeFixture('note'), label: fixtureText(id) }));

describe('fenetreFermer', () => {
  it('la cascade ne se ferme qu’à son bilan : avant, sa sortie est fermée et le refus se dit', () => {
    const banc = ouvrirLeBanc();
    banc.setState({ pendingCascade: cascadeDeTest(TROIS_ETAPES) });
    expect(fermeturesDeLaFenetre(banc.getState()).get('fenetreFermer@cascade')).toBe('etapesDues');

    banc.getState().fenetreFermer('cascade');
    expect(banc.getState().pendingCascade?.cursor, 'la séquence reste à sa première étape').toBe(0);
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('jet.ferme.etapesDues'));

    banc.getState().jetLancer('cascade');
    expect(banc.getState().pendingCascade?.cursor, 'bilan').toBe(TROIS_ETAPES.length);
    expect(fermeturesDeLaFenetre(banc.getState()).get('fenetreFermer@cascade')).toBeNull();
    banc.getState().fenetreFermer('cascade');
    expect(banc.getState().pendingCascade).toBeNull();
  });

  it('une fenêtre qui ne se ferme pas, ou qui n’est pas ouverte, se refuse et le dit', () => {
    const banc = ouvrirLeBanc();
    banc.getState().fenetreFermer('destin' as never);
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('sortie.refus.inconnue'));
    banc.getState().fenetreFermer('conseil');
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('sortie.refus.fermee'));
  });

  it('la sortie de l’hôte reste à l’hôte : refusée dans l’état d’un invité, et au siège d’un invité', () => {
    const banc = ouvrirLeBanc();
    banc.setState({ pendingChapterRecap: { titre: 'C', px: 0, chronique: [], tombes: [], lieux: [] }, net: { ...banc.getState().net, mode: 'invite' } });
    banc.getState().fenetreFermer('finDeChapitre');
    expect(banc.getState().pendingChapterRecap).not.toBeNull();
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('sortie.refus.hoteSeul'));

    banc.setState({ net: { ...banc.getState().net, mode: 'hote' } });
    expect(intentAllowedFor(banc.getState(), 1, 'fenetreFermer', ['finDeChapitre'])).toBe(false);
    expect(intentAllowedFor(banc.getState(), 0, 'fenetreFermer', ['finDeChapitre'])).toBe(true);
    banc.getState().fenetreFermer('finDeChapitre');
    expect(banc.getState().pendingChapterRecap).toBeNull();
  });

  it('l’infirmerie ne se ferme pas tant qu’une passe d’opération est posée : refusée et dite', () => {
    const banc = ouvrirLeBanc();
    banc.setState({ medic: { patientId: null }, pendingSurgery: { healerId: 'h1' } as never });
    expect(fermeturesDeLaFenetre(banc.getState()).get('fenetreFermer@infirmerie')).toBe('soinEnCours');
    banc.getState().fenetreFermer('infirmerie');
    expect(banc.getState().medic, 'l’infirmerie reste ouverte').not.toBeNull();
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('jet.ferme.soinEnCours'));
  });

  it('la sortie du propriétaire suit son siège : l’infirmerie, à tous, se ferme d’un invité ; une fenêtre inconnue, de personne', () => {
    const banc = ouvrirLeBanc();
    banc.setState({ medic: { patientId: null }, net: { ...banc.getState().net, mode: 'hote' } });
    expect(intentAllowedFor(banc.getState(), 1, 'fenetreFermer', ['infirmerie'])).toBe(true);
    expect(intentAllowedFor(banc.getState(), 0, 'fenetreFermer', ['inconnue'])).toBe(false);
  });
});
