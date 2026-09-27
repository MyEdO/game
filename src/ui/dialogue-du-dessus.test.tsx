// @vitest-environment jsdom
/**
 * « Qui est au-dessus ? » — une seule source, la PILE des couches (`dismissStack`), lue par
 * `dialogueDuDessus` (`useDismissLayer.ts`) : le sauvetage du focus, le piège Tab, le clavier et la
 * manette posent la même question qu'Échap (`resoudreEchap`).
 *
 * Flux réel monté dans l'ORDRE de `CampaignView` : `<ActiveModal />` (`CampaignView.tsx:352`) AVANT la
 * fiche (`CampaignView.tsx:431`). L'infirmerie ouverte depuis la fiche est donc AVANT elle dans le
 * document ; monté dans l'ordre inverse, ce banc serait vert sur l'ordre du DOM.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { StrictMode, act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { dismissStackKinds, subscribeDismissStack } from '../state/dismissStack';
import { KEYBINDINGS, runBindingById } from '../state/keybindings';
import { seedBattleRng } from '../state/battleRng';
import { validTargets } from '../state/targeting';
import { testScene } from '../scenes/test-fixture';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { dialogueDuDessus, resetDismissLayers } from './useDismissLayer';
import { useGameKeyboard } from './useGameKeyboard';
import { poserLayoutJsdom } from './layoutJsdom.testkit';
import { ActiveModal } from './ActiveModal';
import { CharacterSheet } from './CharacterSheet';
import { Modal } from './Modal';
import { CodexRef } from './compendium/CodexRef';
import { padButton, padDir } from './useGamepad';
import { DialogueBox } from './DialogueBox';
import { SpeakerBanner } from './SpeakerBanner';
import { PovControls } from './PovControls';
import { campaignStart } from '../engine/clock';
import type { Combatant } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 40, 'force-mentale': 40, sociabilite: 30 };
const mk = (id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ id, name: id, label: id, kind: 'hero', characteristics: { ...chars }, conditions: [], traumas: [], engagedWith: [], skills: [], talents: [], items: [],
     weapons: [], advantage: 0, size: 'moyenne', pos: { x: 0, y: 0 }, wounds: { current: 12, max: 18 }, resilience: 2, fortune: 2,
     species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, ...over } as unknown as Combatant);

let host: HTMLDivElement;
let root: Root;
let retirerLayout: () => void;
const etatInitial = useGame.getState();

beforeEach(() => {
  resetDismissLayers();
  retirerLayout = poserLayoutJsdom();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  retirerLayout();
  resetDismissLayers();
  useGame.setState(etatInitial, true);
});

const vider = async () => { await act(async () => { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); }); };
const sommet = () => { const pile = dismissStackKinds(); return pile[pile.length - 1]; };
const actif = () => (document.activeElement === document.body ? 'BODY' : (document.activeElement?.textContent ?? '').replace(/\s+/g, ' ').trim());
const dialogue = (nom: RegExp) => [...document.querySelectorAll<HTMLElement>('[role="dialog"]')]
  .find((d) => nom.test(d.getAttribute('aria-label') ?? d.querySelector('.modal-title')?.textContent ?? ''))!;
const infirmerie = () => dialogue(/^\s*Soins/);
const bouton = (dans: HTMLElement, texte: string) =>
  [...dans.querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim().startsWith(texte))!;
/** Une frappe au clavier : `keydown` sur l'élément focalisé, puis l'activation NATIVE d'un bouton
 *  (jsdom ne la joue pas) si personne ne l'a consommée. */
const frappe = async (key: 'Enter' | 'Tab') => {
  const cible = (document.activeElement ?? document.body) as HTMLElement;
  const e = new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true });
  act(() => { cible.dispatchEvent(e); });
  if (key === 'Enter' && !e.defaultPrevented && cible instanceof HTMLButtonElement) act(() => cible.click());
  await vider();
};

/** Le frisson du jet (`useRollFrisson`) : roulis puis atterrissage, en temps réel. */
const laisserRouler = () => act(async () => { await new Promise((r) => setTimeout(r, 2000)); });

const mkSoigneur = () => mk('Soigneur', { skills: [{ id: 'guerison', characteristic: 'intelligence', advances: 10 }] } as never);
const mkPatient = () => mk('Blessé', { wounds: { current: 4, max: 12 } } as never);

/** L'ordre de `CampaignView` : l'arbitre des modales, PUIS la fiche. */
async function ouvrirInfirmerieDepuisLaFiche() {
  const soigneur = mkSoigneur();
  const patient = mkPatient();
  useGame.setState({
    screen: 'campaign', mode: 'exploration', gameMenuOpen: false, dialogue: null, battle: null,
    party: [soigneur, patient], pendingHeal: null, pendingSurgery: null, medic: null,
  });
  act(() => root.render(<StrictMode><ActiveModal /><CharacterSheet heroId={patient.id} onClose={() => {}} /></StrictMode>));
  await vider();
  const fiche = document.querySelector<HTMLElement>('[role="dialog"]')!;
  act(() => bouton(fiche, 'Soins').click());
  await vider();
  expect(useGame.getState().medic, 'l’infirmerie est ouverte').not.toBeNull();
  const ordre = [...document.querySelectorAll('[role="dialog"]')];
  expect(ordre.indexOf(infirmerie()), 'l’infirmerie PRÉCÈDE la fiche dans le document').toBeLessThan(ordre.indexOf(fiche));
  act(() => bouton(infirmerie(), 'Soigner les Blessures').click());
  await vider();
  expect(useGame.getState().pendingHeal, 'le jet de soin est posé').not.toBeNull();
  return { fiche, soigneur, patient };
}

describe('infirmerie ouverte depuis la fiche — le dialogue du dessus est celui de la pile', () => {
  it('Tab depuis « Lancer » reste dans l’infirmerie', async () => {
    await ouvrirInfirmerieDepuisLaFiche();
    bouton(infirmerie(), 'Lancer').focus();
    await frappe('Tab');
    expect(infirmerie().contains(document.activeElement), `Tab → « ${actif()} »`).toBe(true);
  });

  it('Lancer résolu : le focus reste dans l’infirmerie, sur « Appliquer » ; Entrée résout ; Terminer rend la fiche', async () => {
    const { fiche, soigneur, patient } = await ouvrirInfirmerieDepuisLaFiche();
    bouton(infirmerie(), 'Lancer').focus();
    await frappe('Enter');
    await laisserRouler();
    expect(useGame.getState().pendingHeal?.roll, 'le jet est lancé').not.toBeNull();
    expect(infirmerie().contains(document.activeElement), `après Lancer → « ${actif()} »`).toBe(true);
    expect(actif()).toBe('Appliquer');
    await frappe('Enter');
    expect(useGame.getState().pendingHeal, 'Entrée résout le jet').toBeNull();
    // Situation : le patient est rétabli, « Soins » (l'invocateur) quitte la fiche.
    act(() => useGame.setState({ party: [soigneur, { ...patient, wounds: { current: 12, max: 12 } }] } as never));
    await vider();
    expect(bouton(fiche, 'Soins'), 'l’invocateur n’existe plus').toBeUndefined();
    act(() => bouton(infirmerie(), 'Terminer').click());
    await vider();
    expect(useGame.getState().medic, 'l’infirmerie est fermée').toBeNull();
    expect(actif(), 'le focus n’est pas laissé sur <body>').not.toBe('BODY');
    expect(fiche.contains(document.activeElement), `il revient dans la fiche, sur « ${actif()} »`).toBe(true);
  });

  it('pointeur sur une puce Codex du corps (couche de survol au sommet) : même flux', async () => {
    await ouvrirInfirmerieDepuisLaFiche();
    const puce = infirmerie().querySelector<HTMLElement>('.modal-body .codex-ref')!;
    expect(puce, 'une puce Codex dans le corps de l’infirmerie').toBeTruthy();
    act(() => { puce.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    await vider();
    expect(sommet(), 'la bulle survolée est la couche du sommet').toBe('popover-codex');
    bouton(infirmerie(), 'Lancer').focus();
    await frappe('Tab');
    expect(infirmerie().contains(document.activeElement), `Tab → « ${actif()} »`).toBe(true);
    bouton(infirmerie(), 'Lancer').focus();
    await frappe('Enter');
    await laisserRouler();
    expect(sommet(), 'la bulle survolée est toujours au sommet').toBe('popover-codex');
    expect(actif(), 'après Lancer').toBe('Appliquer');
    await frappe('Enter');
    expect(useGame.getState().pendingHeal, 'Entrée résout le jet').toBeNull();
  });

  it('manette : la croix depuis « Lancer » navigue dans l’infirmerie', async () => {
    await ouvrirInfirmerieDepuisLaFiche();
    bouton(infirmerie(), 'Lancer').focus();
    act(() => padDir('down'));
    expect(infirmerie().contains(document.activeElement), `croix → « ${actif()} »`).toBe(true);
  });
});

describe('repli quand une couche se retire', () => {
  it('ne vole pas : un élément vivant hors du dialogue garde le focus quand une couche se retire', async () => {
    let fermer = () => {};
    function Scene() {
      const [haut, setHaut] = useState(true);
      fermer = () => setHaut(false);
      return (
        <>
          <button id="dehors">Dehors</button>
          <Modal title="Bas" onClose={() => {}}><button className="btn">Geste du bas</button></Modal>
          {haut && <Modal title="Haut" onClose={() => {}}><button className="btn">Geste du haut</button></Modal>}
        </>
      );
    }
    act(() => root.render(<StrictMode><Scene /></StrictMode>));
    await vider();
    document.querySelector<HTMLElement>('#dehors')!.focus();
    act(() => fermer());
    await vider();
    expect(actif(), 'le focus reste où le joueur l’a mis').toBe('Dehors');
  });
});

describe('repli quand une couche se retire — à la tâche suivante', () => {
  // Séquence de Chrome sur Tab : `blur` du contrôle quitté (la bulle de focus se retire, `pop` de la
  // pile, focus sur <body>) PUIS focus du contrôle suivant. Le repli ne pose rien entre les deux.
  it('une bulle retirée sur blur : rien n’est posé avant la tâche suivante, le contrôle suivant garde le focus', async () => {
    act(() => root.render(
      <StrictMode>
        <Modal title="Taverne" onClose={() => {}} footer={<button className="btn btn-primary">Jouer</button>}>
          <CodexRef category="talents" id="affable" label="Affable"><button type="button" className="btn">Premier</button></CodexRef>
          <button type="button" className="btn">Second</button>
        </Modal>
      </StrictMode>,
    ));
    await vider();
    const [premier, second] = ['Premier', 'Second'].map((t) => [...document.querySelectorAll('button')].find((b) => b.textContent === t)!);
    act(() => premier.focus());
    expect(sommet(), 'la bulle de focus est au sommet').toBe('popover-codex');
    const auPop: string[] = [];
    const desabonner = subscribeDismissStack((e) => { if (e.type === 'pop') auPop.push(actif()); });
    try {
      act(() => { premier.blur(); });
      const entreDeux = actif();
      second.focus();
      await vider();
      expect(auPop, 'la bulle s’est retirée avec le focus sur <body>').toEqual(['BODY']);
      expect(entreDeux, 'aucun focus posé dans le retrait').toBe('BODY');
      expect(actif(), 'le contrôle suivant garde le focus').toBe('Second');
    } finally {
      desabonner();
    }
  });
});

describe('manette — bulle épinglée au-dessus d’un dialogue', () => {
  it('la croix navigue dans la bulle qui tient le focus, pas dans le dialogue dessous', async () => {
    act(() => root.render(
      <StrictMode>
        <Modal title="Talents" onClose={() => {}}>
          <CodexRef category="talents" id="affable" label="Affable" wrap><button type="button" className="btn">Affable ×2</button></CodexRef>
        </Modal>
      </StrictMode>,
    ));
    await vider();
    const declencheur = document.querySelector<HTMLElement>('.codex-ref')!;
    act(() => { declencheur.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
    await vider();
    const bulle = document.querySelector<HTMLElement>('.codex-pop')!;
    expect(bulle, 'la bulle est épinglée').toBeTruthy();
    expect(bulle.contains(document.activeElement), 'elle a pris le focus').toBe(true);
    act(() => padDir('down'));
    expect(bulle.contains(document.activeElement), `croix → « ${actif()} »`).toBe(true);
  });
});

describe('la pile, ordre = ouvertures', () => {
  it('un `kind` qui change ne déplace pas la couche', async () => {
    let setK = (_: string) => {};
    function Bas() { const [k, s] = useState('bas-1'); setK = s; return <Modal title="Bas" kind={k} />; }
    act(() => root.render(<StrictMode><Bas /></StrictMode>));
    await vider();
    act(() => root.render(<StrictMode><Bas /><Modal title="Haut" kind="haut" /></StrictMode>));
    await vider();
    act(() => setK('bas-2'));
    await vider();
    expect(dismissStackKinds(), 'le dialogue ouvert en dernier reste au-dessus').toEqual(['bas-1', 'haut']);
  });

  it('un dialogue monté dans la boîte d’un autre est une erreur de DEV', async () => {
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      act(() => root.render(<StrictMode><Modal title="Parent" kind="parent"><Modal title="Enfant" kind="enfant" /></Modal></StrictMode>));
      await vider();
      expect(erreur.mock.calls.map((c) => String(c[0])).some((m) => /monté dans la boîte du dialogue/.test(m)),
        'l’imbrication est signalée').toBe(true);
    } finally {
      erreur.mockRestore();
    }
  });

  const imbrications = (spy: { mock: { calls: unknown[][] } }) =>
    spy.mock.calls.filter((c) => /monté dans la boîte du dialogue/.test(String(c[0]))).length;

  it('un enfant ouvert APRÈS son parent, à un autre commit, est signalé', async () => {
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      let ouvrir = () => {};
      function Parent() {
        const [enfant, setEnfant] = useState(false);
        ouvrir = () => setEnfant(true);
        return <Modal title="Parent" kind="parent">{enfant && <Modal title="Enfant" kind="enfant" />}</Modal>;
      }
      act(() => root.render(<StrictMode><Parent /></StrictMode>));
      await vider();
      const avant = imbrications(erreur);
      act(() => ouvrir());
      await vider();
      expect(imbrications(erreur), 'l’enfant ouvert après le parent est signalé').toBeGreaterThan(avant);
    } finally {
      erreur.mockRestore();
    }
  });

  it('des dialogues FRÈRES, au même commit puis à un autre, ne sont pas signalés', async () => {
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      let ouvrir = () => {};
      function Freres() {
        const [troisieme, setTroisieme] = useState(false);
        ouvrir = () => setTroisieme(true);
        return <><Modal title="A" kind="a" /><Modal title="B" kind="b" />{troisieme && <Modal title="C" kind="c" />}</>;
      }
      act(() => root.render(<StrictMode><Freres /></StrictMode>));
      await vider();
      act(() => ouvrir());
      await vider();
      expect(dismissStackKinds(), 'les trois frères sont dans la pile').toEqual(['a', 'b', 'c']);
      expect(imbrications(erreur), 'aucun frère signalé').toBe(0);
    } finally {
      erreur.mockRestore();
    }
  });
});

describe('registre de raccourcis — il se tait sous un dialogue de la pile (même verdict que la manette)', () => {
  const Clavier = () => { useGameKeyboard(); return null; };
  let clavier: { hote: HTMLDivElement; root: Root };
  let pris: () => string[];
  beforeEach(() => {
    const hote = document.createElement('div');
    document.body.appendChild(hote);
    clavier = { hote, root: createRoot(hote) };
    act(() => clavier.root.render(<Clavier />));
    const espions = KEYBINDINGS.map((k) => vi.spyOn(k, 'run'));
    pris = () => KEYBINDINGS.filter((_, i) => espions[i].mock.calls.length > 0).map((k) => k.id);
  });
  afterEach(() => {
    act(() => clavier.root.unmount());
    clavier.hote.remove();
    vi.restoreAllMocks();
  });
  /** Une frappe : `keydown` puis `keyup` sur l'élément focalisé (ou <body>), qui remontent jusqu'à `window`. */
  const touche = (code: string, key = code) => {
    const cible = (document.activeElement ?? document.body) as HTMLElement;
    act(() => { cible.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true })); });
    act(() => { cible.dispatchEvent(new KeyboardEvent('keyup', { key, code, bubbles: true, cancelable: true })); });
  };
  const liaison = (id: string) => KEYBINDINGS.find((k) => k.id === id)!;

  /** Combat de la fixture, au tour du héros, un Mutant au contact : Tab a une cible valide. */
  function ouvrirCombat() {
    seedBattleRng(7);
    const heros = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Héros', rng: makeRNG(1) });
    useGame.setState({ party: [heros], screen: 'campaign', gameMenuOpen: false, dialogue: null });
    useGame.getState().startScene(testScene);
    act(() => { useGame.getState().startCombat('enc-mutants'); });
    if (useGame.getState().pendingRoundStart) act(() => useGame.getState().confirmRoundStart());
    const b = useGame.getState().battle!;
    const h = b.combatants.find((c) => c.kind === 'hero')!;
    const cible = b.combatants.find((c) => c.kind !== 'hero')!;
    useGame.setState({
      pendingCascade: null, combatCursor: null,
      battle: {
        ...b, turn: b.order.indexOf(h.id), acted: false, action: null, movementUsed: 0,
        combatants: b.combatants.map((c) => (c.id === cible.id ? { ...c, pos: { x: h.pos!.x + 1, y: h.pos!.y } } : c)),
      },
    });
    return h;
  }

  it('(c) témoin, sans dialogue : F bascule la vue subjective', () => {
    useGame.setState({ screen: 'campaign', mode: 'exploration', dialogue: null, povActive: false, battle: null });
    expect(dialogueDuDessus(), 'aucun dialogue dans la pile').toBeNull();
    touche('KeyF', 'f');
    expect(pris(), 'le registre a pris F').toEqual(['toggle-pov']);
    expect(useGame.getState().povActive, 'F bascule la vue subjective').toBe(true);
  });

  it('(a) infirmerie ouverte depuis la fiche : F, Q, E, W, V, C et ↑ ne partent pas, focus sur <body> puis sur un geste', async () => {
    await ouvrirInfirmerieDepuisLaFiche();
    expect(dialogueDuDessus(), 'l’infirmerie est le dialogue du dessus').toBe(infirmerie());
    const s0 = useGame.getState();
    expect(liaison('toggle-pov').when(s0), 'la situation laisse vivre F hors dialogue').toBe(true);
    (document.activeElement as HTMLElement | null)?.blur();
    expect(actif()).toBe('BODY');
    for (const [code, key] of [['KeyF', 'f'], ['KeyQ', 'q'], ['KeyE', 'e'], ['KeyW', 'w'], ['KeyV', 'v'], ['KeyC', 'c'], ['ArrowUp', 'ArrowUp']]) touche(code, key);
    bouton(infirmerie(), 'Lancer').focus();
    for (const [code, key] of [['KeyF', 'f'], ['KeyQ', 'q'], ['KeyE', 'e'], ['KeyW', 'w']]) touche(code, key);
    expect(pris(), 'aucun raccourci du registre n’est parti').toEqual([]);
    expect(useGame.getState().povActive, 'la vue subjective n’a pas basculé').toBe(s0.povActive);
    expect(useGame.getState().party.map((c) => c.pos), 'le groupe n’a pas bougé').toEqual(s0.party.map((c) => c.pos));
  });

  it('(b) fiche seule, en combat au tour du héros : Espace ne finit pas le tour, 1 ne déclenche rien', async () => {
    const h = ouvrirCombat();
    const s0 = useGame.getState();
    expect(liaison('end-turn').when(s0), 'hors dialogue, Espace finirait le tour').toBe(true);
    expect(liaison('hotbar-1').when(s0), 'hors dialogue, 1 jouerait la 1ʳᵉ case').toBe(true);
    act(() => root.render(<StrictMode><ActiveModal /><CharacterSheet heroId={h.id} onClose={() => {}} /></StrictMode>));
    await vider();
    expect(dialogueDuDessus(), 'la fiche est le dialogue du dessus').not.toBeNull();
    (document.activeElement as HTMLElement | null)?.blur();
    touche('Space', ' ');
    touche('Digit1', '1');
    expect(pris(), 'aucun raccourci du registre n’est parti').toEqual([]);
    expect(useGame.getState().battle!.turn, 'le tour n’est pas fini').toBe(s0.battle!.turn);
  });

  it('fiche ouverte en combat, une cible valide : Tab reste au piège de la fiche, le curseur ne s’aimante pas', async () => {
    const h = ouvrirCombat();
    const s0 = useGame.getState();
    expect(validTargets(useGame.getState).length, 'une cible valide').toBeGreaterThan(0);
    expect(liaison('target-next').when(s0), 'hors dialogue, Tab aimanterait le curseur').toBe(true);
    act(() => root.render(<StrictMode><ActiveModal /><CharacterSheet heroId={h.id} onClose={() => {}} /></StrictMode>));
    await vider();
    const fiche = dialogueDuDessus()!;
    expect(fiche, 'la fiche est le dialogue du dessus').not.toBeNull();
    (document.activeElement as HTMLElement | null)?.blur();
    touche('Tab', 'Tab');
    expect(pris(), 'le registre n’a pas pris Tab').toEqual([]);
    expect(useGame.getState().combatCursor, 'le curseur ne s’est pas aimanté').toBeNull();
    expect(fiche.contains(document.activeElement), `Tab → « ${actif()} », dans la fiche`).toBe(true);
  });

  it('(d) désignation des cibles d’un sort par la carte (aucune fenêtre) : ↑ déplace le curseur', async () => {
    const h = ouvrirCombat();
    act(() => useGame.setState({
      pendingCascade: { participants: [{ actorId: h.id, id: 'c', kind: 'castJet', jet: 'cast' }], cursor: 0 } as never,
      pendingCast: { casterId: h.id, pickingTargets: true } as never,
    }));
    act(() => root.render(<StrictMode><ActiveModal /></StrictMode>));
    await vider();
    expect(document.querySelector('[role="dialog"]'), 'aucune fenêtre pendant la désignation').toBeNull();
    expect(dialogueDuDessus(), 'aucun dialogue dans la pile').toBeNull();
    (document.activeElement as HTMLElement | null)?.blur();
    touche('ArrowUp');
    expect(pris(), 'le registre a pris ↑').toEqual(['cursor-up']);
    expect(useGame.getState().combatCursor, 'le curseur est posé').not.toBeNull();
  });
});

describe('conversation PNJ — une surface de la pile qui suspend le jeu', () => {
  const Clavier = () => { useGameKeyboard(); return null; };
  const dlg = { id: 'd', start: 'n1', nodes: [{ id: 'n1', desc: 'Bonjour.', choices: [{ label: 'Suite' }, { label: 'Adieu' }] }] };
  const scene = { id: 's', nom: 'S', desc: '', size: [4, 4], entities: [{ id: 'e1', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, label: 'Alice' }], dialogues: [dlg], triggers: [], encounters: [] };
  const conversation = () => document.querySelector<HTMLElement>('.dialogue-box')!;
  let pris: () => string[];
  beforeEach(() => {
    const espions = KEYBINDINGS.map((k) => vi.spyOn(k, 'run'));
    pris = () => KEYBINDINGS.filter((_, i) => espions[i].mock.calls.length > 0).map((k) => k.id);
  });
  afterEach(() => { vi.restoreAllMocks(); });
  const parler = () => act(() => useGame.setState({ dialogue: { dialogue: dlg, nodeId: 'n1', speakerId: 'e1' } } as never));
  const poserScene = () => useGame.setState({
    scene, flags: {}, gameTime: campaignStart(), party: [mkPatient()], screen: 'campaign', mode: 'exploration', battle: null, gameMenuOpen: false, dialogue: null,
  } as never);
  const touche = (code: string, key = code) => {
    const cible = (document.activeElement ?? document.body) as HTMLElement;
    act(() => { cible.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true })); });
    act(() => { cible.dispatchEvent(new KeyboardEvent('keyup', { key, code, bubbles: true, cancelable: true })); });
  };

  const ouvrirConversation = async () => {
    poserScene();
    act(() => root.render(<StrictMode><Clavier /><DialogueBox /></StrictMode>));
    parler();
    await vider();
    expect(conversation(), 'la conversation est affichée').toBeTruthy();
    (document.activeElement as HTMLElement | null)?.blur();
    return useGame.getState();
  };

  it('la conversation est le dialogue du dessus', async () => {
    await ouvrirConversation();
    expect(dialogueDuDessus()).toBe(conversation());
  });

  it('sémantique : un dialogue modal, nommé par le locuteur, décrit par sa réplique ; le boniment n’en est pas un', async () => {
    await ouvrirConversation();
    const boite = conversation();
    const parId = (attr: string) => (boite.getAttribute(attr) ?? '').split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
    expect(boite.getAttribute('role')).toBe('dialog');
    expect(boite.getAttribute('aria-modal')).toBe('true');
    expect(parId('aria-labelledby'), 'nom accessible').toBe('Alice');
    expect(parId('aria-describedby'), 'description accessible').toBe('Bonjour.');
    act(() => root.render(<SpeakerBanner label="L’aubergiste" variant="boniment">Entrez donc.</SpeakerBanner>));
    const boniment = document.querySelector<HTMLElement>('.dialogue-box')!;
    expect([boniment.getAttribute('role'), boniment.getAttribute('aria-modal'), boniment.getAttribute('aria-labelledby')]).toEqual([null, null, null]);
  });

  it('sémantique : sans entité nommée, la conversation garde un nom accessible', async () => {
    poserScene();
    act(() => root.render(<StrictMode><DialogueBox /></StrictMode>));
    act(() => useGame.setState({ dialogue: { dialogue: dlg, nodeId: 'n1' } } as never));
    await vider();
    expect([conversation().getAttribute('role'), conversation().getAttribute('aria-labelledby'), conversation().getAttribute('aria-label')]).toEqual(['dialog', null, 'Conversation']);
  });

  it('pavé POV tactile (`PovControls`, hors du registre clavier) : inerte pendant la conversation, témoin sans conversation', async () => {
    const jouer = async (conv: boolean) => {
      useGame.setState({ ...etatInitial, scene, flags: {}, gameTime: campaignStart(), party: [mkPatient()], screen: 'campaign', mode: 'exploration', battle: null,
        gameMenuOpen: false, povActive: true, facing: {}, dialogue: conv ? { dialogue: dlg, nodeId: 'n1', speakerId: 'e1' } : null } as never, true);
      act(() => root.render(<StrictMode><DialogueBox /><PovControls /></StrictMode>));
      await vider();
      const cap0 = JSON.stringify(useGame.getState().facing);
      const pivot = [...document.querySelectorAll<HTMLButtonElement>('.pov-controls button')].find((b) => /Pivoter le regard à gauche/.test(b.title))!;
      act(() => { pivot.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); });
      act(() => { runBindingById('toggle-pov', useGame.getState); });
      const r = { capChange: JSON.stringify(useGame.getState().facing) !== cap0, pov: useGame.getState().povActive };
      act(() => root.render(<></>));
      await vider();
      return r;
    };
    expect(await jouer(true), 'sous conversation : cap et vue subjective inchangés').toEqual({ capChange: false, pov: true });
    expect(await jouer(false), 'témoin : le pavé pivote, la bascule quitte la vue subjective').toEqual({ capChange: true, pov: false });
  });

  it('clavier : aucun autre raccourci ne répond pendant la conversation — C, F, Q, E, V, flèches ; en plein combat, I', async () => {
    const s0 = await ouvrirConversation();
    for (const id of ['cam-recenter', 'cam-left', 'toggle-view']) expect(KEYBINDINGS.find((k) => k.id === id)!.when(s0), `hors pile, ${id} partirait`).toBe(true);
    for (const [code, key] of [['KeyC', 'c'], ['KeyF', 'f'], ['KeyQ', 'q'], ['KeyE', 'e'], ['KeyV', 'v'], ['ArrowUp', 'ArrowUp'], ['ArrowLeft', 'ArrowLeft']]) touche(code, key);
    expect(pris(), 'aucun raccourci du registre n’est parti').toEqual([]);
    expect(useGame.getState().viewMode, 'la vue n’a pas basculé').toBe(s0.viewMode);
    act(() => useGame.setState({ mode: 'battle', inspectEnabled: false, battle: { over: null, order: ['h1'], turn: 0, combatants: [{ id: 'h1', kind: 'hero' }] } as never }));
    expect(KEYBINDINGS.find((k) => k.id === 'toggle-inspect')!.when(useGame.getState()), 'hors pile, I partirait en combat').toBe(true);
    touche('KeyI', 'i');
    expect(pris(), 'en plein combat, I se tait aussi').toEqual([]);
    expect(useGame.getState().inspectEnabled).toBe(false);
  });

  it('manette : Back et LT sont inertes pendant la conversation', async () => {
    const s0 = await ouvrirConversation();
    for (const id of ['cam-recenter', 'cam-left']) expect(KEYBINDINGS.find((k) => k.id === id)!.when(s0), `hors pile, ${id} partirait`).toBe(true);
    act(() => useGame.setState({ zoom: 2 } as never));
    act(() => { padButton('Back'); padButton('LT'); });
    expect(pris(), 'aucun raccourci du registre n’est parti').toEqual([]);
    expect(useGame.getState().zoom, 'Back n’a pas recentré la caméra').toBe(2);
  });

  it('témoin : la conversation close, Back et C repartent', async () => {
    poserScene();
    act(() => root.render(<StrictMode><Clavier /><DialogueBox /></StrictMode>));
    await vider();
    expect(dialogueDuDessus(), 'aucune conversation').toBeNull();
    touche('KeyC', 'c');
    act(() => { padButton('Back'); });
    expect(pris(), 'C et Back partent hors conversation').toEqual(['cam-recenter']);
  });

  const choix = () => [...conversation().querySelectorAll<HTMLButtonElement>('.dlg-choice')];
  /** Scène de `CampaignView` : la conversation, l'arbitre des modales, et la fiche ouverte depuis un
   *  bouton du HUD FOCALISÉ (jamais depuis <body> : la restitution à l'invocateur serait muette). */
  const conversationSousLaFiche = async () => {
    poserScene();
    const patient = useGame.getState().party[0];
    function Hud() {
      const [fiche, setFiche] = useState(false);
      return (
        <>
          <Clavier />
          <DialogueBox />
          <ActiveModal />
          <button type="button" id="ouvrir-fiche" onClick={() => setFiche(true)}>Fiche</button>
          {fiche && <CharacterSheet heroId={patient.id} onClose={() => setFiche(false)} />}
        </>
      );
    }
    act(() => root.render(<StrictMode><Hud /></StrictMode>));
    await vider();
    const invocateur = document.querySelector<HTMLButtonElement>('#ouvrir-fiche')!;
    invocateur.focus();
    act(() => invocateur.click());
    await vider();
    const fiche = dialogueDuDessus()!;
    expect(fiche, 'la fiche est ouverte, dialogue du dessus').not.toBeNull();
    parler();
    await vider();
    expect(conversation(), 'la conversation est affichée').toBeTruthy();
    return fiche;
  };

  it('ouverte SOUS une fiche, la conversation attend : focus et Tab dans la fiche, 1-9 muets, Échap ferme la fiche (refs #1987)', async () => {
    const fiche = await conversationSousLaFiche();
    touche('Digit1', '1');
    touche('Digit2', '2');
    expect(pris(), 'aucune réponse ne part sous la fiche').toEqual([]);
    expect(dismissStackKinds(), 'peinte sous la fiche, la conversation est sous elle dans la pile').toEqual(['dialogue', 'fiche-perso']);
    expect(dialogueDuDessus(), 'la fiche reste le dialogue du dessus').toBe(fiche);
    expect(fiche.contains(document.activeElement), `le focus reste dans la fiche, sur « ${actif()} »`).toBe(true);
    await frappe('Tab');
    expect(fiche.contains(document.activeElement), `Tab → « ${actif()} », dans la fiche`).toBe(true);
    touche('Escape', 'Escape');
    await vider();
    expect(document.body.contains(fiche), 'Échap ferme la fiche, peinte au-dessus').toBe(false);
    expect(useGame.getState().dialogue?.nodeId, 'la conversation est toujours là').toBe('n1');
  });

  it('la fiche fermée, la conversation prend le focus sur la réponse 1 ; Tab et la croix bouclent dans les choix ; 2 répond', async () => {
    await conversationSousLaFiche();
    touche('Escape', 'Escape');
    await vider();
    const [premier, dernier] = choix();
    expect(document.activeElement, `focus sur « ${actif()} »`).toBe(premier);
    dernier.focus();
    await frappe('Tab');
    expect(document.activeElement, 'Tab depuis le dernier choix boucle sur le premier').toBe(premier);
    const arriere = new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    act(() => { premier.dispatchEvent(arriere); });
    await vider();
    expect(document.activeElement, 'Maj+Tab depuis le premier boucle sur le dernier').toBe(dernier);
    premier.focus();
    act(() => { padDir('down'); });
    expect(document.activeElement, 'la croix navigue dans les choix').toBe(dernier);
    act(() => { padDir('down'); });
    expect(document.activeElement, 'et boucle dans les choix').toBe(premier);
    touche('Digit2', '2');
    expect(pris(), 'la conversation a la main : la réponse 2 part').toEqual(['dialogue-choice-2']);
  });
});
