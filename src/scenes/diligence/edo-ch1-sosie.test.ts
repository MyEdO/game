// @vitest-environment jsdom
/**
 * Le SOSIE de Kastor Lieberung, désigné par le joueur à la fouille du cadavre — EDO 02 l.91 ; #2219
 * c.6068818868. Puis les Documents 3 et 4 remis l'un après l'autre (EDO 02 l.93-95), nommés par
 * l'identité du sosie (EDO 02 l.112-127, #686), et l'indice qui les garde relisibles. Chemin RÉEL :
 * l'action `fouiller` du paquet `la-diligence`, jouée au store ; la modale montée.
 */
import { describe, it, expect, beforeEach, beforeAll, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DocumentModal } from '../../ui/DocumentModal';
import { useGame } from '../../state/store';
import { createHero } from '../../engine/character';
import { pickActiveModalKey } from '../../noyau/modalArbiter';
import { evalCondition } from '../../engine/flowCore';
import { condCtx } from '../../noyau/bourseFlow';
import { snapshotSave } from '../../state/saves';
import { campagneDuJeu, diligenceCampaign, lancerCampagne, paquetDuJeu } from '../campaign';
import { poserLeGroupe } from '../../noyau/marcheDuGroupe';

const paquet = paquetDuJeu(diligenceCampaign);
const SOSIE = 'campagne-sosie-heros';
const get = () => useGame.getState();
const heros = (label: string, seed: number) => ({ ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label, seed }), id: `h-${seed}` });

beforeEach(() => {
  get().setParty([heros('Vivant', 1), { ...heros('Tombé', 2), dead: true }, heros('Autre', 3)]);
  expect(lancerCampagne(useGame.getState, campagneDuJeu(diligenceCampaign), paquet.scenes[0].id)).toBeNull();
  get().acquitterOuverture();
  get().transitionTo('route-principale-virage');
  poserLeGroupe(get, useGame.setState, { x: 36, y: 3 });
  get().jouerAction('cadavre-kastor-lieberung', 'fouiller');
});

describe('EDO 02 l.91 — la fouille du cadavre ouvre la désignation du sosie', () => {
  it('la fouille ouvre la désignation (modale de groupe, invite de l’Effet) ; la fouille s’achève au choix', () => {
    expect(get().pendingDesignationHeros?.etat).toBe(SOSIE);
    expect(get().pendingDesignationHeros?.invite).toMatch(/sosie/);
    expect(pickActiveModalKey(get())).toBe('designationHeros');
    expect(get().etats[SOSIE]).toBeUndefined();
    expect(get().flags['edo-ch1-corps-kastor-fouille'], 'EDO 02 l.89-91 : la suite de la fouille attend la désignation').toBeUndefined();
    get().designerHerosChoisir('h-1');
    expect(get().flags['edo-ch1-corps-kastor-fouille'], 'EDO 02 l.93-95 : les deux documents se lisent avant').toBeUndefined();
    get().closeDocument();
    get().closeDocument();
    expect(get().flags['edo-ch1-corps-kastor-fouille']).toBe(true);
  });

  it('un héros MORT n’est pas proposable : son choix ne pose rien et la désignation reste ouverte', () => {
    get().designerHerosChoisir('h-2');
    expect(get().etats[SOSIE]).toBeUndefined();
    expect(get().pendingDesignationHeros?.etat).toBe(SOSIE);
  });

  it('le choix d’un héros vivant pose l’état à son id et referme la désignation', () => {
    get().designerHerosChoisir('h-1');
    expect(get().etats[SOSIE]).toBe('h-1');
    expect(get().pendingDesignationHeros).toBeNull();
    expect(evalCondition({ kind: 'species', id: 'humains-reiklander', who: { etat: SOSIE } }, condCtx(get))).toBe(true);
    expect(evalCondition({ kind: 'partyDead', who: { etat: SOSIE } }, condCtx(get))).toBe(false);
  });

  it('la désignation ne s’annule pas : elle survit au changement de scène', () => {
    get().transitionTo('altdorf-porte-sud');
    expect(get().pendingDesignationHeros?.etat).toBe(SOSIE);
  });

  it('sauvegarde puis reprise : l’état désigné est conservé', () => {
    get().designerHerosChoisir('h-3');
    const save = snapshotSave(get() as unknown as Record<string, unknown>, useGame.getInitialState() as unknown as Record<string, unknown>, '2512-01-01T00:00:00Z');
    useGame.setState({ etats: {} });
    expect(get().importGame(JSON.stringify(save))).toBeNull();
    expect(get().etats[SOSIE]).toBe('h-3');
  });
});

describe('EDO 02 l.93-127 — les Documents 3 et 4 nomment le sosie, l’indice les garde', () => {
  beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
  let container: HTMLDivElement | undefined;
  let root: Root | undefined;
  afterEach(() => { if (root) act(() => root!.unmount()); container?.remove(); root = undefined; container = undefined; });
  const naine = () => ({ ...createHero({ speciesId: 'nains', careerId: 'soldat', label: 'Naine', seed: 9, apparence: { sex: 'F', build: 0.5 } }), id: 'h-9' });

  beforeEach(() => {
    get().setParty([heros('Vivant', 1), naine()]);
    get().loadProject({ scenes: paquet.scenes, entryId: paquet.scenes[0].id, worldMap: paquet.worldMap, narratif: paquet.narratif, projet: { id: paquet.id } });
    get().acquitterOuverture();
    get().transitionTo('route-principale-virage');
    poserLeGroupe(get, useGame.setState, { x: 36, y: 3 });
    get().jouerAction('cadavre-kastor-lieberung', 'fouiller');
    get().designerHerosChoisir('h-9');
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    act(() => root!.render(createElement(DocumentModal)));
  });

  it('naine désignée : le Document 3 l’appelle « Chère Frau Linkassniz » ; fermé, le Document 4 la nomme « Kallar Linkassniz »', () => {
    expect(get().identitesFigees[SOSIE]).toEqual({ espece: 'nain', sexe: 'F' });
    expect(get().document?.documentId).toBe('edo-document-3-heritage');
    expect(document.body.textContent).toContain('Chère Frau Linkassniz,');
    expect(document.body.textContent).toContain('la dernière parente vivante de feu le baronet Linkass,');
    expect(document.body.textContent).toContain('du manoir de Linkass et');
    expect(document.body.textContent).not.toContain('Lieberung');
    act(() => get().closeDocument());
    expect(get().document?.documentId).toBe('edo-document-4-affidavit');
    expect(document.body.textContent).toContain('se nomme Kallar Linkassniz.');
    act(() => get().closeDocument());
    expect(get().document).toBeNull();
    expect(get().flags['edo-ch1-corps-kastor-fouille']).toBe(true);
  });

  it('l’indice « L’héritage » révèle ses deux stades, un par document', () => {
    act(() => get().closeDocument());
    act(() => get().closeDocument());
    expect(get().clues['edo-ch1-indice-heritage']?.historique.map((h) => h.stade)).toEqual(['veste', 'poche']);
  });

  it('le sosie mort garde son identité', () => {
    act(() => useGame.setState({ party: get().party.map((h) => (h.id === 'h-9' ? { ...h, dead: true } : h)) }));
    expect(document.body.textContent).toContain('Chère Frau Linkassniz,');
  });
});
