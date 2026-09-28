// @vitest-environment jsdom
/**
 * Focus initial et de sauvetage d'un CADRE (`focusTarget`, `Modal.tsx`) : un geste du dialogue,
 * jamais sa croix (`CadreFermer`), dont Entrée fermerait le dialogue, ni un contrôle qui n'est pas
 * un geste (jauge, portrait). Mesuré sur les deux cadres qui portent la croix en tête : `Modal`
 * (`croix`) et `ScreenShell`. Piège Tab : aucune frappe ne sort du dialogue.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { StrictMode, act, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Modal, cibleEmbarquee } from './Modal';
import { useFocusEmprunte, visibleFocusables } from './focus';
import { ScreenShell } from './ScreenShell';
import { Tabs } from './Tabs';
import { OptionChooser } from './OptionChooser';
import { MedicModal } from './MedicModal';
import { useGame } from '../state/store';
import type { Combatant } from '../engine/types';
import { poserLayoutJsdom } from './layoutJsdom.testkit';
import { resetDismissLayers } from './useDismissLayer';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;
let retirerLayout: () => void;

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
});

const actif = () => (document.activeElement?.textContent ?? '').trim();
const surLaCroix = () => !!document.activeElement?.matches('.cadre-fermer');

describe('focus initial d’un cadre — jamais sa croix', () => {
  it('Modal à croix, sans primaire au pied : le focus va au 1er contrôle du corps', () => {
    act(() => root.render(
      <Modal title="Compendium" onClose={() => {}} croix>
        <button className="btn">Carrières</button>
      </Modal>,
    ));
    expect(surLaCroix(), 'la croix n’est pas la cible initiale').toBe(false);
    expect(actif()).toBe('Carrières');
  });

  it('ScreenShell : le focus va au 1er contrôle du corps, pas à « Fermer »', () => {
    act(() => root.render(
      <ScreenShell title="Port" onClose={() => {}} body="centered">
        <button className="btn">Quai</button>
      </ScreenShell>,
    ));
    expect(surLaCroix(), 'la croix n’est pas la cible initiale').toBe(false);
    expect(actif()).toBe('Quai');
  });

  it('croix seule : le focus entre DANS le dialogue, sur la boîte, jamais sur la croix ni sur l’ouvreur', () => {
    const ouvreur = document.createElement('button');
    ouvreur.textContent = 'Ouvrir (arrière-plan)';
    document.body.appendChild(ouvreur);
    ouvreur.focus();
    act(() => root.render(<Modal title="Vide" onClose={() => {}} croix><p>Texte</p></Modal>));
    const dialogue = host.querySelector('[role="dialog"]')!;
    expect(surLaCroix()).toBe(false);
    expect(dialogue.contains(document.activeElement), 'le focus est dans le dialogue').toBe(true);
    expect(document.activeElement).toBe(dialogue);
    ouvreur.remove();
  });
});

/** Frappe RÉELLE d'une touche sur l'élément focalisé (le piège écoute le document) ; rend l'événement. */
function frapper(key: string, shiftKey = false): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
  act(() => { (document.activeElement ?? document.body).dispatchEvent(e); });
  return e;
}

describe('piège Tab — le focus posé sur la boîte (croix seule) ne sort pas du dialogue', () => {
  for (const [touche, shift] of [['Tab', false], ['Maj+Tab', true]] as const) {
    it(`${touche} depuis la boîte : la frappe est consommée, le focus va à un contrôle du dialogue`, () => {
      act(() => root.render(<Modal title="Vide" onClose={() => {}} croix><p>Texte</p></Modal>));
      const dialogue = host.querySelector('[role="dialog"]')!;
      expect(document.activeElement).toBe(dialogue);
      const e = frapper('Tab', shift);
      expect(e.defaultPrevented, 'le navigateur ne déplace pas le focus hors du dialogue').toBe(true);
      expect(document.activeElement).not.toBe(dialogue);
      expect(dialogue.contains(document.activeElement)).toBe(true);
    });
  }
});

describe('repli du focus — un geste du dialogue, jamais une jauge', () => {
  it('Désengagement : l’option mise en avant (`btn-primary`) n’est pas une option retenue — le focus va sur elle, pas sur la jauge du bandeau', () => {
    act(() => root.render(
      <Modal title="Se désengager" onClose={() => {}} footer={<button className="btn btn-ghost">Renoncer</button>}>
        <button className="ptile">11/11</button>
        <div className="rm-loc-grid">
          <button className="btn small">Sacrifier l’Avantage</button>
          <button className="btn small btn-primary">Esquiver (37)</button>
        </div>
      </Modal>,
    ));
    expect(actif()).toBe('Esquiver (37)');
  });

  it('planche à onglets, sans bouton : le focus va à l’onglet ouvert, pas à la jauge de la colonne', () => {
    act(() => root.render(
      <Modal title="Wilhelmina" onClose={() => {}} croix>
        <button className="ptile">7/11</button>
        <Tabs tabs={[{ key: 'a', label: 'Compétences' }, { key: 'b', label: 'État' }]} active="b" onChange={() => {}} />
      </Modal>,
    ));
    expect(actif()).toBe('État');
  });

  it('option RETENUE (`aria-pressed`) : le focus initial va au primaire du pied', () => {
    act(() => root.render(
      <Modal title="Défense" onClose={() => {}} footer={<button className="btn btn-primary">Lancer</button>}>
        <div className="rm-loc-grid">
          <button className="btn small" aria-pressed="true">Parade</button>
          <button className="btn small" aria-pressed="false">Esquive</button>
        </div>
      </Modal>,
    ));
    expect(actif()).toBe('Lancer');
  });

  it('infirmerie à l’ouverture : le focus va au 1er geste du corps (« Soigner les Blessures »), jamais à la sortie « Terminer »', () => {
    act(() => root.render(
      <Modal title="Soins" onClose={() => {}} footer={<button className="btn">Terminer</button>}>
        <button className="ptile">7/11</button>
        <button className="btn medic-act">Soigner les Blessures</button>
      </Modal>,
    ));
    expect(actif()).toBe('Soigner les Blessures');
  });

  it('étapes enchaînées sous un pied qui SURVIT (un bouton, même `key`) : le focus va au groupe de choix de chaque étape, jamais au pied', async () => {
    let etape = (_: number) => {};
    function Suite() {
      const [e, setE] = useState(0);
      etape = setE;
      return (
        <Modal title="Suite" onClose={() => {}} etape={e} footer={<button key="next" className="btn btn-primary">{e === 2 ? 'Terminer' : 'Continuer'}</button>}>
          <p>étape {e}</p>
          {e === 1 && <OptionChooser layout="grid" options={[{ key: 'a', label: 'Tête', onSelect: () => {} }, { key: 'b', label: 'Bras', onSelect: () => {} }]} />}
          {e === 2 && <OptionChooser layout="grid" options={[{ key: 'c', label: 'Gauche', onSelect: () => {} }, { key: 'd', label: 'Droite', onSelect: () => {} }]} />}
        </Modal>
      );
    }
    act(() => root.render(<StrictMode><Suite /></StrictMode>));
    const pied = [...host.querySelectorAll<HTMLElement>('.btn')].find((b) => b.textContent === 'Continuer')!;
    pied.focus();
    act(() => etape(1));
    await act(async () => { await Promise.resolve(); });
    expect(actif(), 'étape 1 : le choix révélé').toBe('Tête');
    pied.focus();
    act(() => etape(2));
    await act(async () => { await Promise.resolve(); });
    expect(pied.isConnected, 'le nœud du pied est réutilisé').toBe(true);
    expect(actif(), 'étape 2 : le choix révélé, pas « Terminer »').toBe('Gauche');
  });
});

const CARAC = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 40, 'force-mentale': 40, sociabilite: 30 };
const heros = (id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ id, name: id, label: id, kind: 'hero', characteristics: { ...CARAC }, conditions: [], traumas: [], engagedWith: [], skills: [], talents: [], items: [],
     weapons: [], advantage: 0, size: 'moyenne', pos: { x: 0, y: 0 }, wounds: { current: 4, max: 12 }, resilience: 2, fortune: 2,
     species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, ...over } as unknown as Combatant);

describe('infirmerie réelle (`MedicModal`) — le focus d’un cadre, rendu à son invocateur, n’ouvre aucune bulle', () => {
  beforeEach(() => {
    const patient = heros('Blessé');
    const soigneur = heros('Soigneur', { skills: [{ id: 'guerison', characteristic: 'intelligence', advances: 10 }] } as never);
    useGame.setState({
      screen: 'campaign', mode: 'exploration', gameMenuOpen: false, dialogue: null, battle: null,
      party: [soigneur, patient], pendingHeal: null, pendingSurgery: null, medic: null,
    } as never);
    act(() => useGame.getState().openMedic({ patientId: patient.id }));
  });
  afterEach(() => {
    act(() => useGame.setState({ battle: null, party: [], pendingHeal: null, pendingSurgery: null, medic: null } as never));
  });
  const bouton = (texte: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.textContent ?? '').trim() === texte)!;
  const bulles = () => document.querySelectorAll('.infobulle').length;

  it('ouverte : le focus est sur « Soigner les Blessures » et aucune infobulle ne couvre les actes', () => {
    act(() => root.render(<MedicModal />));
    expect(actif()).toBe('Soigner les Blessures');
    expect(bulles(), 'le focus posé par le cadre n’ouvre pas la bulle').toBe(0);
  });

  it('Tab puis Maj+Tab vers « Soigner les Blessures » : la navigation du joueur ouvre la bulle', () => {
    act(() => root.render(<MedicModal />));
    const soigner = bouton('Soigner les Blessures');
    const suivant = visibleFocusables(host.querySelector<HTMLElement>('[role="dialog"]')!).find((el) => el !== soigner && !soigner.contains(el))!;
    act(() => suivant.focus());
    act(() => soigner.focus());
    expect(document.activeElement).toBe(soigner);
    expect(bulles(), 'un focus de navigation ouvre la bulle').toBe(1);
  });

  it('jet posé puis annulé : le focus revient au MÊME nœud « Soigner les Blessures », sans bulle', () => {
    act(() => root.render(<MedicModal />));
    const invocateur = bouton('Soigner les Blessures');
    act(() => invocateur.click());
    expect(useGame.getState().pendingHeal, 'le jet est posé').not.toBeNull();
    expect(actif(), 'jet posé : le primaire du pied').toBe('Lancer');
    expect(invocateur.isConnected, 'l’invocateur reste monté pendant le jet').toBe(true);
    act(() => bouton('Annuler').click());
    expect(useGame.getState().pendingHeal, 'le jet est annulé').toBeNull();
    expect(document.activeElement, 'le même nœud, pas un homonyme').toBe(invocateur);
    expect(bulles(), 'le retour du focus n’ouvre pas la bulle').toBe(0);
  });
});

describe('emprunt du focus (`useFocusEmprunte`) — l’invocateur appartient à UNE ouverture', () => {
  it('StrictMode, invocateur NON focalisable pendant l’emprunt : le retrait rend le focus à l’invocateur, pas au geste de la surface', () => {
    const premierBouton = (box: HTMLElement) => box.querySelector<HTMLElement>('button');
    function Surface() {
      const ref = useRef<HTMLDivElement>(null);
      useFocusEmprunte(ref, true, premierBouton);
      return <div ref={ref}><button>Lancer</button></div>;
    }
    let ouvrir = (_: boolean) => {};
    function Hote() {
      const [ouverte, setOuverte] = useState(false);
      ouvrir = setOuverte;
      return <><button disabled={ouverte}>Soigner</button>{ouverte && <Surface />}</>;
    }
    act(() => root.render(<StrictMode><Hote /></StrictMode>));
    const invocateur = host.querySelector('button')!;
    invocateur.focus();
    act(() => ouvrir(true));
    expect(actif(), 'emprunt : le geste de la surface').toBe('Lancer');
    act(() => ouvrir(false));
    expect(document.activeElement, 'retrait : le MÊME nœud invocateur').toBe(invocateur);
  });

  const bouton = (t: string) => [...document.querySelectorAll<HTMLElement>('button')].find((b) => (b.textContent ?? '').trim() === t)!;
  const vider = async () => { await act(async () => { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); }); };

  it('deux modales empilées, StrictMode : chacune rend le focus à son invocateur', async () => {
    let un = (_: boolean) => {};
    let deux = (_: boolean) => {};
    function App() {
      const [m1, s1] = useState(false);
      const [m2, s2] = useState(false);
      un = s1;
      deux = s2;
      return (
        <>
          <button className="btn">A</button>
          {m1 && <Modal title="Un" onClose={() => {}} footer={<button className="btn">Fermer1</button>}><button className="btn">X</button></Modal>}
          {m2 && <Modal title="Deux" onClose={() => {}} footer={<button className="btn">Fermer2</button>}><p>deux</p></Modal>}
        </>
      );
    }
    act(() => root.render(<StrictMode><App /></StrictMode>));
    bouton('A').focus();
    act(() => un(true)); await vider();
    expect(actif(), '1re ouverture').toBe('X');
    act(() => deux(true)); await vider();
    expect(actif(), '2e ouverture, depuis X').toBe('Fermer2');
    act(() => deux(false)); await vider();
    expect(actif(), '2e fermée : retour à X').toBe('X');
    act(() => un(false)); await vider();
    expect(actif(), '1re fermée : retour à A').toBe('A');
  });

  it('dialogue refermé PENDANT l’emprunt d’une surface embarquée, StrictMode : le focus revient à l’invocateur du dialogue', async () => {
    let poserJet = (_: boolean) => {};
    let ouvrir = (_: boolean) => {};
    function Surface() {
      const ref = useRef<HTMLDivElement>(null);
      useFocusEmprunte(ref, true, cibleEmbarquee);
      return <div ref={ref}><p>jet</p></div>;
    }
    function App() {
      const [o, so] = useState(false);
      const [j, sj] = useState(false);
      ouvrir = so;
      poserJet = sj;
      return (
        <>
          <button className="btn">Soins</button>
          {o && (
            <Modal title="Infirmerie" onClose={() => {}} footer={j ? <button className="btn btn-primary">Lancer</button> : <button className="btn">Terminer</button>}>
              <button className="btn" disabled={j}>Soigner</button>{j && <Surface />}
            </Modal>
          )}
        </>
      );
    }
    act(() => root.render(<StrictMode><App /></StrictMode>));
    bouton('Soins').focus();
    act(() => ouvrir(true)); await vider();
    expect(actif(), 'ouverture').toBe('Soigner');
    act(() => poserJet(true)); await vider();
    expect(actif(), 'jet posé').toBe('Lancer');
    act(() => { poserJet(false); ouvrir(false); }); await vider();
    expect(actif(), 'tout refermé : l’invocateur du dialogue').toBe('Soins');
  });

  it('invocateur DÉMONTÉ pendant l’emprunt, StrictMode : le focus reste DANS le dialogue', async () => {
    let poserJet = (_: boolean) => {};
    let garderInvocateur = (_: boolean) => {};
    function Surface() {
      const ref = useRef<HTMLDivElement>(null);
      useFocusEmprunte(ref, true, cibleEmbarquee);
      return <div ref={ref}><p>jet</p></div>;
    }
    function App() {
      const [j, sj] = useState(false);
      const [inv, si] = useState(true);
      poserJet = sj;
      garderInvocateur = si;
      return (
        <Modal title="Infirmerie" onClose={() => {}} footer={j ? <button className="btn btn-primary">Lancer</button> : <button className="btn">Terminer</button>}>
          {inv && <button className="btn">Soigner</button>}<button className="btn">Autre</button>{j && <Surface />}
        </Modal>
      );
    }
    act(() => root.render(<StrictMode><App /></StrictMode>));
    await vider();
    bouton('Soigner').focus();
    act(() => poserJet(true)); await vider();
    expect(actif(), 'jet posé').toBe('Lancer');
    act(() => garderInvocateur(false)); await vider();
    act(() => poserJet(false)); await vider();
    expect(document.querySelector('[role=dialog]')!.contains(document.activeElement), 'le focus est resté dans le dialogue').toBe(true);
  });

  it('modale fermée avec le focus DEDANS, StrictMode : le focus revient à son invocateur', async () => {
    let ouvrir = (_: boolean) => {};
    function App() {
      const [o, so] = useState(false);
      ouvrir = so;
      return (
        <>
          <button className="btn">Ouvrir</button><button className="btn">Voisin</button>
          {o && <Modal title="Un" onClose={() => {}} footer={<button className="btn">Fermer</button>}><button className="btn">Geste</button></Modal>}
        </>
      );
    }
    act(() => root.render(<StrictMode><App /></StrictMode>));
    bouton('Ouvrir').focus();
    act(() => ouvrir(true)); await vider();
    bouton('Fermer').focus();
    expect(document.querySelector('[role=dialog]')!.contains(document.activeElement), 'le focus est dans la modale').toBe(true);
    act(() => ouvrir(false)); await vider();
    expect(actif(), 'fermée : retour à l’invocateur').toBe('Ouvrir');
  });

  it('surface PERSISTANTE (`actif` basculé, patron `GameMenu`) : l’invocateur d’une ouverture dont le retour a échoué ne sert pas à la suivante', async () => {
    let ouvrir = (_: boolean) => {};
    let bloquer = (_: boolean) => {};
    const premier = (box: HTMLElement) => box.querySelector<HTMLElement>('button');
    function Menu({ ouvert }: { ouvert: boolean }) {
      const ref = useRef<HTMLDivElement>(null);
      useFocusEmprunte(ref, ouvert, premier);
      return <div ref={ref} hidden={!ouvert}><button>Reprendre</button></div>;
    }
    function App() {
      const [o, so] = useState(false);
      const [b, sb] = useState(false);
      ouvrir = so;
      bloquer = sb;
      return <><button disabled={b}>A</button><button>B</button><Menu ouvert={o} /></>;
    }
    act(() => root.render(<App />));
    bouton('A').focus();
    act(() => ouvrir(true)); await vider();
    expect(actif(), '1re ouverture, depuis A').toBe('Reprendre');
    act(() => bloquer(true));
    act(() => ouvrir(false)); await vider();
    expect(document.activeElement, 'le retour à A désactivé a échoué').not.toBe(bouton('A'));
    act(() => bloquer(false));
    bouton('B').focus();
    act(() => ouvrir(true)); await vider();
    expect(actif(), '2e ouverture, depuis B').toBe('Reprendre');
    act(() => ouvrir(false)); await vider();
    expect(actif(), 'la 2e ouverture venait de B').toBe('B');
  });
});
