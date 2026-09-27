// @vitest-environment jsdom
/**
 * LA PHASE D'UNE RANGÉE D'ÉTAPE DE CASCADE (#1262) — la rangée de l'étape courante tient sa phase du
 * NOYAU (`rollRowBuild.buildRollRow`), qui DÉRIVE `rolled` du dé de la ligne (`!!row.d`) : une seule
 * définition de « la rangée affiche un dé », pour tous les monteurs.
 *
 * Ce que ce test verrouille, et qu'aucun autre ne mesure : cette dérivation vaut la PHASE RÉELLE de
 * l'étape. Une étape n'atteint cette branche que si `stepInteraction` rend `'jet'`, donc avec
 * `target != null` (`state/cascade.ts`) — la ligne porte alors son `d` exactement quand `result` est
 * posé. Mesuré sur la fenêtre MONTÉE (patron `cascade-subtitle.test.tsx`), aux DEUX phases : ce que
 * `rolled` pilote se LIT à l'écran — bouton « Lancer » avant, cycle d'influence après. Une
 * dérivation fausse inverse l'un ou l'autre.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { createHero } from '../engine/character';
import { CascadeBody } from './CascadeModal';
import type { CascadeStep, CascadeRoll } from '../state/pendings';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;

/** Étape-JET (elle porte sa cible : c'est la SEULE forme qui atteint la branche mesurée). */
const jetStep = (actorId: string, result: CascadeRoll | null): CascadeStep =>
  ({ id: 'j1', kind: 'tally', actorId, label: 'Résistance', rollLabel: 'Résistance', base: 40, target: 40, result, interactive: true } as unknown as CascadeStep);

function ouvrir(result: CascadeRoll | null) {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 1 });
  useGame.setState({
    battle: null, party: [hero], suspendedCascades: [], journal: [],
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
    pendingCascade: { title: 'Épreuve', icon: 'nav/dice', purpose: 'affichage', cursor: 0, log: [], participants: [jetStep(hero.id, result)] },
  });
  act(() => { root.render(<CascadeBody />); });
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ pendingCascade: null, party: [], suspendedCascades: [] });
});

const texte = () => (host.textContent ?? '').replace(/\s+/g, ' ');
const influence = () => host.querySelector('.rm-influence');

describe('#1262 L1 — `rolled` dérivé au noyau : la PHASE de la rangée est celle d’avant', () => {
  it('PRÉ-JET (`result: null`) : « Lancer » servi, aucun cycle d’influence', () => {
    ouvrir(null);
    expect(texte(), 'la phase pré-jet offre le lancer').toContain('Lancer');
    expect(influence(), 'rien à influencer avant le dé').toBeNull();
  });

  it('POST-JET (`result` posé) : le dé se lit, le cycle d’influence remplace « Lancer »', () => {
    ouvrir({ roll: 55, target: 40, sl: -1, success: false } as CascadeRoll);
    const t = texte();
    expect(t, 'le dé tombé est affiché').toContain('55');
    expect(influence(), 'la rangée est en phase POST : Chance/+1 DR/Résilience').not.toBeNull();
    expect(t.includes('Continuer') || t.includes('Terminer'), 'la barre passe en phase post').toBe(true);
  });
});
