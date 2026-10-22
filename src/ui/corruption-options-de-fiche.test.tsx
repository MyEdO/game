// @vitest-environment jsdom
/**
 * Exposition à compétence indéterminée (LDB 19 l.29) : chaque option de la modale est un Test de la fiche
 * `influences-corruptrices` (#2779) — sa compétence pour libellé, sa valeur pour l'acteur, le libellé de
 * l'entrée pour titre ; la ligne du jet porte la compétence et la Difficulté du Test retenu. Fiche :
 * `ficheDeTest.testkit.ts`.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useGame } from '../state/store';
import { CorruptionModal } from './CorruptionModal';
import { expositionPending } from '../noyau/corruptionFlow';
import { testValue } from '../engine/skills';
import { refLabel } from '../data';
import { testDeRegle } from '../engine/reglesChiffrees';
import { difficultyText } from '../noyau/difficultyText';
import { poserFicheDeTest, restaurerFiche, testDeFiche } from '../state/ficheDeTest.testkit';
import { lignesDeJet } from './ligneDeJet.testkit';
import { combattantDeModale } from './combattantDeModale.testkit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  restaurerFiche();
  useGame.setState({ battle: null, party: [], pendingCorruption: null } as never);
});

describe('CorruptionModal — options de la fiche `influences-corruptrices`', () => {
  it('options : compétence, valeur et titre de chaque entrée ; ligne : compétence et Difficulté du Test retenu', () => {
    poserFicheDeTest();
    const h = combattantDeModale('A');
    useGame.setState({ battle: null, party: [h], pendingCorruption: expositionPending(h.id, 'mineure', undefined) } as never);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<CorruptionModal />));
    const texte = (e: Element | null) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const options = [...host.querySelectorAll('.rm-options button')].map((b) => ({ texte: texte(b), titre: b.getAttribute('title') }));
    const [ligne] = lignesDeJet(host);
    act(() => root.unmount());
    host.remove();
    expect(options).toEqual((['physique', 'spirituelle'] as const).map((cle) => {
      const { skill } = testDeFiche('influences-corruptrices', cle);
      return { texte: `${refLabel('skills', skill)} ${testValue(h, skill.id)}`, titre: testDeRegle('influences-corruptrices', cle).label };
    }));
    const retenu = testDeFiche('influences-corruptrices', 'physique');
    expect(ligne).toEqual({ label: refLabel('skills', retenu.skill), diff: difficultyText(retenu.difficulty) });
  });
});
