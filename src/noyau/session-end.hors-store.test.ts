/**
 * La fin de séance (LDB 05 Ambitions + LDB 17 Détermination) : chaque case est un choix de la fenêtre `finDeSeance`
 * (`fenetreChoisir('finDeSeance', axe, valeur[, héros])`), que `fenetreValider('finDeSeance')` applique :
 *  - PX d'Ambition accomplie (+50 court / +500 long ; groupe = à chaque héros) ;
 *  - regain de Détermination pour un héros ayant agi selon sa Motivation (plafonné au max) ;
 *  - restauration de la Chance (couture `restoreFortune`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { initialNet } from './etat';
import { intentAllowedFor } from './netOwnership';
import { libelleDeLaFermeture } from './libelles';
import { herosDeScenario, groupeDeScenario } from '../scenes/test-scenarios/_heros';
import { resolveMax } from '../engine/talentEffects';
import { t } from '../i18n';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('fenetreValider(\'finDeSeance\') (LDB 05 / LDB 17)', () => {
  beforeEach(() => { banc.setState({ party: [], journal: [], flags: {} }); });

  it('octroie +50/+500 PX d’Ambition (perso + groupe à chaque héros), puis ferme la fin de séance', () => {
    const a = herosDeScenario(idsDeTest, 'soldat'); a.xp = 0;
    const b = herosDeScenario(idsDeTest, 'tueur'); b.xp = 0;
    banc.setState({ party: [a, b] });
    banc.getState().ouvrirLaFinDeSeance();
    banc.getState().fenetreChoisir('finDeSeance', 'ambitionPersonnelleCourte', true, a.id);
    banc.getState().fenetreChoisir('finDeSeance', 'ambitionPersonnelleLongue', true, a.id);
    banc.getState().fenetreChoisir('finDeSeance', 'ambitionCourte', true);
    banc.getState().fenetreChoisir('finDeSeance', 'ambitionLongue', true);
    banc.getState().fenetreChoisir('finDeSeance', 'ambitionLongue', false);
    banc.getState().fenetreValider('finDeSeance');
    const st = banc.getState();
    expect(st.party.find((h) => h.id === a.id)!.xp).toBe(50 + 500 + 50); // perso court + long + groupe court
    expect(st.party.find((h) => h.id === b.id)!.xp).toBe(50); // groupe court seulement
    expect(st.finDeSeance).toBeNull();
  });

  it('regagne 1 Point de Détermination pour un héros ayant agi selon sa Motivation (plafonné)', () => {
    const a = herosDeScenario(idsDeTest, 'tueur'); a.resolve = 0;
    banc.setState({ party: [a] });
    banc.getState().ouvrirLaFinDeSeance();
    banc.getState().fenetreChoisir('finDeSeance', 'motivation', true, a.id);
    banc.getState().fenetreValider('finDeSeance');
    const h = banc.getState().party.find((x) => x.id === a.id)!;
    expect(h.resolve).toBe(Math.min(resolveMax(h), 1));
  });

  it('restaure la Chance du groupe au niveau du Destin', () => {
    const a = herosDeScenario(idsDeTest, 'soldat');
    if (a.fate != null) a.fortune = 0; // dépensée
    banc.setState({ party: [a] });
    banc.getState().ouvrirLaFinDeSeance();
    banc.getState().fenetreValider('finDeSeance');
    const h = banc.getState().party.find((x) => x.id === a.id)!;
    if (h.fate != null) expect(h.fortune).toBe(h.fate);
  });

  it('le menu de jeu n’ouvre la fin de séance qu’en exploration et chez l’hôte : sinon refusée et dite', () => {
    banc.setState({ party: [herosDeScenario(idsDeTest, 'soldat')], mode: 'battle' });
    banc.getState().ouvrirLaFinDeSeance();
    expect(banc.getState().finDeSeance).toBeNull();
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('gameMenu.finDeSeance.horsExploration'));
    banc.setState({ mode: 'exploration', net: { ...initialNet(), mode: 'invite', mySeat: 1 } });
    banc.getState().ouvrirLaFinDeSeance();
    expect(banc.getState().finDeSeance).toBeNull();
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('gameMenu.finDeSeance.invite'));
  });
});

describe('les cases de la fin de séance : celles du groupe sans héros, celles d’un héros sur sa rangée, à l’hôte', () => {
  /** Coop : l'hôte (siège 0) et un invité (siège 1), un héros chacun, la fin de séance ouverte. */
  function seance(): { a: string; b: string } {
    const [a, b] = groupeDeScenario(idsDeTest, 'soldat', 'tueur');
    banc.setState({ party: [a, b], net: { ...initialNet(), mode: 'hote', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Invité' }, ownership: { [a.id]: 0, [b.id]: 1 }, slots: [1, 1, 0, 0] } });
    banc.getState().ouvrirLaFinDeSeance();
    return { a: a.id, b: b.id };
  }

  it('une case de héros sans héros, une case du groupe sur un héros : refusées et dites', () => {
    const { a } = seance();
    banc.getState().fenetreChoisir('finDeSeance', 'motivation', true);
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('choix.refus.rangee'));
    banc.getState().fenetreChoisir('finDeSeance', 'ambitionCourte', true, a);
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('choix.refus.rangee'));
    expect(banc.getState().finDeSeance).toEqual({ heros: {}, groupe: {} });
  });

  it('l’hôte coche pour chaque héros, celui de l’invité compris ; l’invité ne coche rien', () => {
    const { b } = seance();
    expect([0, 1].filter((x) => intentAllowedFor(banc.getState(), x, 'fenetreChoisir', ['finDeSeance', 'motivation', true, b])), 'le héros de l’invité').toEqual([0]);
    expect([0, 1].filter((x) => intentAllowedFor(banc.getState(), x, 'fenetreChoisir', ['finDeSeance', 'ambitionCourte', true])), 'le groupe').toEqual([0]);
    banc.getState().fenetreChoisir('finDeSeance', 'motivation', true, b);
    expect(banc.getState().finDeSeance?.heros[b]).toEqual({ motivation: true });
    banc.setState({ net: { ...banc.getState().net, mode: 'invite', mySeat: 1 } });
    banc.getState().fenetreChoisir('finDeSeance', 'motivation', false, b);
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('choix.refus.hoteSeul'));
    expect(banc.getState().finDeSeance?.heros[b]).toEqual({ motivation: true });
  });

  it('pendant le récap de chapitre, la fin de séance se joue par lui : sa validation et sa sortie sont fermées et le disent', () => {
    seance();
    banc.setState({ pendingChapterRecap: { titre: 'C', px: 0, chronique: [], tombes: [], lieux: [] } });
    banc.getState().fenetreValider('finDeSeance');
    expect(banc.getState().journal.slice(-1)[0]).toBe(libelleDeLaFermeture('seanceDuChapitre'));
    banc.getState().fenetreFermer('finDeSeance');
    expect(banc.getState().journal.slice(-1)[0]).toBe(libelleDeLaFermeture('seanceDuChapitre'));
    expect(banc.getState().finDeSeance, 'la fin de séance reste ouverte').toEqual({ heros: {}, groupe: {} });
    banc.getState().fenetreFermer('finDeChapitre');
    expect(banc.getState().finDeSeance, 'ajourner le récap ajourne sa séance').toBeNull();
  });
});
