// @vitest-environment jsdom
/**
 * PROSE DE PAQUET au rendu (#686, EDO 02 l.112-127) : `<Prose paquet>` nomme par les identités figées à la
 * désignation, `<Prose>` nue jamais ; `DocumentModal` nomme le seul document de paquet (`documentId`),
 * pas le rapport de naufrage ; chez l'invité, le masque vaut pour UNE remise. Chemin réel : Effet
 * `designerHeros` puis choix au store ; `remettreDocument`.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act, Profiler } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { runFlow } from '../noyau/combatEffects';
import { createHero } from '../engine/character';
import { emptyScene } from '../noyau/monde/scene';
import { emptyNarratif, type NarratifBlock } from '../noyau/monde/campaignNarratif';
import { Prose } from './Prose';
import { DocumentModal } from './DocumentModal';

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });

const P27 = { book: 'ennemi-dans-l-ombre', page: 27 } as const;
const narratif: NarratifBlock = {
  ...emptyNarratif(),
  documents: [{ id: 'doc-3', titre: 'Document 3', prose: 'Cher Herr Lieberung,' }],
  etats: [{ id: 'sosie', label: 'Le sosie', source: { book: 'ennemi-dans-l-ombre', page: 26 }, forme: { kind: 'heros', identite: {
    ancres: ['Kastor', 'Lieberung'],
    reperes: [{ id: 'sal', fragment: 'Cher Herr Lieberung' }, { id: 'complet', fragment: 'Kastor Lieberung' }],
    lignes: [{ espece: 'nain', sexe: 'F', valeurs: [{ repere: 'sal', valeur: 'Chère Frau Linkassniz', adapteDe: P27 }, { repere: 'complet', valeur: 'Kallar Linkassniz', source: P27 }] }],
  } } }],
};
const heros = (id: string, speciesId: string, sex: 'M' | 'F') => ({ ...createHero({ speciesId, careerId: 'soldat', label: id, seed: 7, apparence: { sex, build: 0.5 } }), id });
const get = () => useGame.getState();
let container: HTMLDivElement | undefined;
let root: Root | undefined;

/** Paquet chargé, naine désignée sosie par l'Effet `designerHeros`. */
function charger(mode: 'local' | 'guest' = 'local') {
  const s = emptyScene(4, 4); s.id = 'sc'; s.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  useGame.setState({ campaignNarratif: null, party: [], scene: null, document: null, flags: {}, etats: {}, identitesFigees: {}, net: { ...get().net, mode: 'local' } });
  get().loadProject({ scenes: [s], entryId: 'sc', narratif, projet: null });
  useGame.setState({ party: [heros('h1', 'humains-reiklander', 'M'), heros('h2', 'nains', 'F')] });
  runFlow(get, useGame.setState, { kind: 'do', effect: { type: 'designerHeros', etat: 'sosie' } });
  get().designerHerosChoisir('h2');
  useGame.setState({ net: { ...get().net, mode } });
}
function monter(el: React.ReactElement) {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  act(() => root!.render(el));
}
afterEach(() => { if (root) act(() => root!.unmount()); container?.remove(); root = undefined; container = undefined; });

describe('<Prose paquet> — le paquet suit le sosie désigné', () => {
  it('`paquet` nomme ; une `<Prose>` nue reste verbatim', () => {
    charger();
    monter(<><div id="p"><Prose md="Kastor Lieberung" paquet /></div><div id="n"><Prose md="Kastor Lieberung" /></div></>);
    expect(container!.querySelector('#p')!.textContent).toBe('Kallar Linkassniz');
    expect(container!.querySelector('#n')!.textContent).toBe('Kastor Lieberung');
  });

  it('un changement de PV ne rerend pas une prose de paquet', () => {
    charger();
    let rendus = 0;
    monter(<Profiler id="p" onRender={() => { rendus++; }}><Prose md="Kastor Lieberung" paquet /></Profiler>);
    const avant = rendus;
    act(() => useGame.setState({ party: get().party.map((h) => ({ ...h, wounds: { ...h.wounds, current: h.wounds.current - 1 } })) }));
    expect(rendus).toBe(avant);
  });
});

describe('DocumentModal — seul un document de paquet est nommé', () => {
  it('document à `documentId` : nommé ; rapport de naufrage : verbatim', () => {
    charger();
    get().remettreDocument({ title: 'D3', text: 'Cher Herr Lieberung,', documentId: 'doc-3' });
    monter(<DocumentModal />);
    expect(document.body.textContent).toContain('Chère Frau Linkassniz,');
    act(() => get().remettreDocument({ title: 'Naufrage', text: 'Cher Herr Lieberung,' }));
    expect(document.body.textContent).toContain('Cher Herr Lieberung,');
    expect(document.body.textContent).not.toContain('Linkassniz');
  });

  it('invité : il masque UNE remise ; la même remise répétée par l’hôte se montre de nouveau', () => {
    charger('guest');
    get().remettreDocument({ title: 'D3', text: 'Cher Herr Lieberung,', documentId: 'doc-3' });
    monter(<DocumentModal />);
    const fermer = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Fermer')!;
    act(() => fermer.click());
    expect(document.body.textContent).not.toContain('Frau Linkassniz');
    expect(get().document, 'l’hôte tient le document').not.toBeNull();
    act(() => get().remettreDocument({ title: 'D3', text: 'Cher Herr Lieberung,', documentId: 'doc-3' }));
    expect(document.body.textContent).toContain('Chère Frau Linkassniz,');
  });
});
