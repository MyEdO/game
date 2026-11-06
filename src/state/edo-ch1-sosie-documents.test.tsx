// @vitest-environment jsdom
/**
 * Les Documents 3 et 4 du sosie de Kastor Lieberung, nommés par son identité (EDO 02 l.112-127, #686), lus dans la
 * modale montée (`DocumentModal`) sur le store : chemin RÉEL de la fouille du paquet `la-diligence`. La désignation,
 * la remise des documents et l'indice se jouent au banc du noyau (`src/noyau/scenarios/edo-ch1-sosie.hors-store.test.ts`).
 */
import { describe, it, expect, beforeEach, beforeAll, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DocumentModal } from '../ui/DocumentModal';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { diligenceCampaign, paquetDuJeu } from '../scenes/campaign';
import { poserLeGroupe } from '../noyau/marcheDuGroupe';

const paquet = paquetDuJeu(diligenceCampaign);
const get = useGame.getState;
const heros = (label: string, seed: number) => ({ ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label, seed }), id: `h-${seed}` });

describe('EDO 02 l.93-127 — les Documents 3 et 4 nomment le sosie', () => {
  beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
  let container: HTMLDivElement | undefined;
  let root: Root | undefined;
  afterEach(() => { if (root) act(() => root!.unmount()); container?.remove(); root = undefined; container = undefined; });
  const naine = () => ({ ...createHero({ speciesId: 'nains', careerId: 'soldat', label: 'Naine', seed: 9, apparence: { sex: 'F' } }), id: 'h-9' });

  beforeEach(() => {
    get().setParty([heros('Vivant', 1), naine()]);
    get().loadProject({ scenes: paquet.scenes, entryId: paquet.scenes[0].id, worldMap: paquet.worldMap, narratif: paquet.narratif, projet: { id: paquet.id } });
    get().fenetreValider('ouverture');
    get().transitionTo('route-principale-virage');
    poserLeGroupe(get, useGame.setState, { x: 36, y: 3 });
    get().jouerAction('cadavre-kastor-lieberung', 'fouiller');
    get().designerHerosChoisir('h-9');
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    act(() => root!.render(createElement(DocumentModal)));
  });

  it('naine désignée : le Document 3 l’appelle « Chère Frau Linkassniz » ; fermé, le Document 4 la nomme « Kallar Linkassniz »', () => {
    expect(document.body.textContent).toContain('Chère Frau Linkassniz,');
    expect(document.body.textContent).toContain('la dernière parente vivante de feu le baronet Linkass,');
    expect(document.body.textContent).toContain('du manoir de Linkass et');
    expect(document.body.textContent).not.toContain('Lieberung');
    act(() => get().fenetreFermer('document'));
    expect(document.body.textContent).toContain('se nomme Kallar Linkassniz.');
  });

  it('le sosie mort garde son identité', () => {
    act(() => useGame.setState({ party: get().party.map((h) => (h.id === 'h-9' ? { ...h, dead: true } : h)) }));
    expect(document.body.textContent).toContain('Chère Frau Linkassniz,');
  });
});
