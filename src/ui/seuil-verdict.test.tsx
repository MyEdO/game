// @vitest-environment jsdom
/**
 * RANGÉE « SEUIL » (#2389) — un dé de monde dit SON verdict, porté par le type de l'étape, et ne
 * montre aucune Difficulté (`rollSeam.worldStep`, MSRC 13 l.146, MDG 15 l.362). Mesuré sur la fenêtre
 * MONTÉE (`CascadeBody`), aux deux portes qui posent un dé de monde : l'ouverture MONO
 * (`openWorldTest`) et l'étape de SÉQUENCE (`worldStep`, via `buildAuthorPerilSteps`).
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { startCascade, registerCascadeApplier } from '../noyau/cascade';
import { openWorldTest, worldStep } from '../noyau/rollSeam';
import { buildAuthorPerilSteps } from '../noyau/authorPerils';
import { openPortAt } from '../noyau/seaVoyageFlow';
import { moraleBand } from '../engine/crewMorale';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { DIFFICULTY_LABELS } from '../engine/types';
import { t } from '../i18n';
import { fixtureText } from '../i18n/fixtureText';
import { CascadeBody } from './CascadeModal';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;

const KIND = 'uiSeuilSpy';
const verdictAcheteur = { reussite: t('seuil.acheteurTrouve'), echec: t('seuil.aucunAcheteur') };

function reset() {
  useGame.setState({
    battle: null, party: [], pendingCascade: null, suspendedCascades: [], journal: [],
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
  });
}
const render = () => act(() => { root.render(<CascadeBody />); });
const ligne = () => (host.querySelector('.rm-roll')?.textContent ?? '').replace(/\s+/g, ' ');
const libelle = () => host.querySelector('.rm-roll-label')?.textContent ?? '';
const poser = (roll: number) => {
  const cur = useGame.getState().pendingCascade!.participants[useGame.getState().pendingCascade!.cursor];
  // Le geste de la rangée : LANCER puis SUBSTITUER (`ui/forcedDieRow.ts`).
  act(() => { if (!cur.result) useGame.getState().cascadeRoll(cur.id); useGame.getState().cascadeSetForcedRoll(cur.id, roll); });
  render();
};

beforeEach(() => {
  resetDesFixes();
  setDesFixes(true);
  registerCascadeApplier(KIND, () => {});
  reset();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  resetDesFixes();
  useGame.setState({ pendingCascade: null, suspendedCascades: [], vessel: null, pendingShoreLeave: null });
});

describe('#2389 — la rangée seuil dit le verdict de SON étape', () => {
  it('MONO (`openWorldTest`) : dé ≤ cible → le verdict de réussite de l’étape', () => {
    openWorldTest(useGame.getState, useGame.setState, { actionLabel: 'Trouver un acheteur', cible: 40, verdict: verdictAcheteur }, KIND);
    render();
    poser(12);
    expect(ligne()).toContain(String(verdictAcheteur.reussite));
    expect(ligne()).not.toContain(String(verdictAcheteur.echec));
  });

  it('MONO (`openWorldTest`) : dé > cible → le verdict d’échec de l’étape', () => {
    openWorldTest(useGame.getState, useGame.setState, { actionLabel: 'Trouver un acheteur', cible: 40, verdict: verdictAcheteur }, KIND);
    render();
    poser(77);
    expect(ligne()).toContain(String(verdictAcheteur.echec));
  });

  it('SÉQUENCE (`worldStep` d’un péril d’auteur) : le verdict du péril', () => {
    const [st] = buildAuthorPerilSteps({ id: 'r', from: 'a', to: 'b', km: 10, perils: [{ label: 'Brigands', chancePct: 30, effects: [] }] } as never, 'B', 'x');
    startCascade(useGame.getState, useGame.setState, { title: 'Route', purpose: 'affichage', steps: [st] });
    render();
    poser(10);
    expect(ligne()).toContain(String(t('seuil.survient')));
    poser(90);
    expect(ligne()).toContain(String(t('seuil.evite')));
  });

  it('Désertion à la relâche (MDG 14 l.194) : dé ÉGAL au seuil → « sous le seuil »', () => {
    useGame.setState({ vessel: { vehicleId: 'cogue', label: 'Le Cormoran', morale: { score: 60, lastMoraleWeek: 0, factors: [] } } } as never);
    const seuil = moraleBand(60).desertionRoll!;
    expect(seuil).toBe(4);
    openPortAt(useGame.getState, useGame.setState, { id: 'P', label: 'Erengrad', pos: { x: 0, y: 0 }, scene: 'monde-p', port: { taille: 3, richesse: 3, production: ['bois'] } } as never);
    useGame.getState().resolveShoreLeave(true);
    render();
    poser(seuil);
    expect(ligne()).toContain(String(t('seuil.sousLeSeuil')));
    expect(ligne()).not.toContain(String(t('seuil.auDessus')));
  });

  it('aucune rangée seuil ne montre de Difficulté — ni avant le dé, ni après', () => {
    openWorldTest(useGame.getState, useGame.setState, { actionLabel: 'Trouver un acheteur', cible: 40, verdict: verdictAcheteur }, KIND);
    render();
    const avant = libelle();
    poser(12);
    for (const lu of [avant, libelle()]) {
      for (const d of Object.values(DIFFICULTY_LABELS)) expect(lu, `« ${d} » sur une rangée seuil`).not.toContain(d);
    }
  });

  it('le verdict est EXIGÉ par le type : une étape seuil sans verdict ne compile pas', () => {
    // @ts-expect-error -- `verdict` manquant : `evaluation:'seuil'` l'exige (#2389).
    const st = worldStep({ id: 'w', kind: KIND, label: fixtureText('Péril'), cible: 50 });
    expect(st.target).toBe(50);
  });
});
