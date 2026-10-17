// @vitest-environment jsdom
/**
 * Focus d'ÉTAPE d'un cadre ouvert (`useFocusEmprunte`, paramètre `etape`) mesuré sur le `CascadeBody`
 * RÉEL, dont le geste d'enchaînement (`next`) survit d'une étape à l'autre : en modale, embarqué dans
 * un `ScreenShell`, à l'append d'un bilan et au changement de `purpose` (`cascade.ts`, `startCascade`) ;
 * puis dans une zone EMBARQUÉE (`EmbeddedShell`) dont l'entrée est au pied de l'hôte, hors de sa boîte.
 * L'invocateur appartient à l'ouverture (APG, Dialog (Modal) Pattern), l'entrée à l'étape (`focus.ts`).
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { StrictMode, act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CascadeBody } from './CascadeModal';
import { ScreenShell } from './ScreenShell';
import { Modal } from './Modal';
import { EmbeddedShell } from './RollShell';
import { poserLayoutJsdom } from './layoutJsdom.testkit';
import { resetDismissLayers } from './useDismissLayer';
import { useGame } from '../state/store';
import { startCascade } from '../state/cascade';
import { createHero } from '../engine/character';
import type { Combatant } from '../engine/types';
import { tacheSuivante } from './focus.testkit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;
let retirerLayout: () => void;
let sigmund: Combatant;
let aelindra: Combatant;

beforeEach(() => {
  resetDismissLayers();
  retirerLayout = poserLayoutJsdom();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  sigmund = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Sigmund', seed: 1 });
  aelindra = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Aelindra', seed: 2 });
  useGame.setState({
    battle: null, party: [sigmund, aelindra], suspendedCascades: [], journal: [], pendingCascade: null,
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} },
  } as never);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  retirerLayout();
  resetDismissLayers();
  useGame.setState({ pendingCascade: null, suspendedCascades: [], party: [] } as never);
});

const OPTIONS = [{ key: '0', label: 'Corps à corps' }, { key: '1', label: 'Esquive' }];
const choix = (id: string, qui: Combatant, options = OPTIONS) =>
  ({ id, kind: 'tavern-choice', actorId: qui.id, label: `${qui.label} — comment jouer ce tour ?`, options });
const ouvrir = (purpose: string, steps: ReturnType<typeof choix>[]) =>
  startCascade(useGame.getState, useGame.setState, { title: 'Middenball', icon: 'nav/dice', purpose: purpose as never, steps: steps as never });

const actif = () => (document.activeElement === document.body ? 'BODY' : (document.activeElement?.textContent ?? '').trim());
const bouton = (texte: string) =>
  [...document.querySelectorAll<HTMLElement>('button')].find((b) => (b.textContent ?? '').trim().startsWith(texte))!;
const vider = tacheSuivante;
/** Le joueur retient l'option offerte, puis active « Continuer » au pied : le nœud du pied survit. */
const choisirPuisContinuer = async () => {
  const option = bouton('Corps à corps');
  option.focus();
  act(() => option.click());
  await vider();
  const continuer = bouton('Continuer');
  continuer.focus();
  act(() => continuer.click());
  await vider();
};

describe('focus d’étape — `CascadeBody` réel, le geste d’enchaînement survit à l’étape', () => {
  it('en modale : à l’étape 2, le focus est sur le choix révélé, pas sur « Terminer »', async () => {
    ouvrir('affichage', [choix('c-a', sigmund), choix('c-b', aelindra)]);
    act(() => root.render(<StrictMode><button>Jouer</button><CascadeBody /></StrictMode>));
    await vider();
    await choisirPuisContinuer();
    expect(useGame.getState().pendingCascade?.cursor, 'étape 2 atteinte').toBe(1);
    expect(actif(), 'le choix d’Aelindra, jamais le pied').toBe('Corps à corps');
    expect(document.activeElement?.getAttribute('aria-pressed')).toBe('false');
  });

  it('embarquée dans un `ScreenShell` (écran de voyage) : même entrée à l’étape 2', async () => {
    ouvrir('affichage', [choix('c-a', sigmund), choix('c-b', aelindra)]);
    act(() => root.render(<StrictMode><ScreenShell title="Voyage" onClose={() => {}}><CascadeBody embedded /></ScreenShell></StrictMode>));
    await vider();
    await choisirPuisContinuer();
    expect(useGame.getState().pendingCascade?.cursor, 'étape 2 atteinte').toBe(1);
    expect(actif(), 'le choix d’Aelindra, jamais le pied').toBe('Corps à corps');
  });

  it('ne vole pas : l’étape avance hors geste pendant que le focus est sur un élément vivant hors du dialogue', async () => {
    ouvrir('affichage', [{ ...choix('c-a', sigmund), chosen: '0' } as never, choix('c-b', aelindra)]);
    act(() => root.render(<StrictMode><button id="dehors">Dehors</button><CascadeBody /></StrictMode>));
    await vider();
    document.querySelector<HTMLElement>('#dehors')!.focus();
    act(() => useGame.getState().cascadeNext());
    await vider();
    expect(useGame.getState().pendingCascade?.cursor, 'étape 2 atteinte').toBe(1);
    expect(actif(), 'le focus reste où le joueur l’a mis').toBe('Dehors');
  });

  it('l’invocateur ne reçoit rien entre deux étapes, et reçoit le focus à la fermeture', async () => {
    act(() => root.render(<StrictMode><button id="jouer">Jouer</button><CascadeBody /></StrictMode>));
    const jouer = document.querySelector<HTMLElement>('#jouer')!;
    jouer.focus();
    act(() => ouvrir('affichage', [choix('c-a', sigmund), choix('c-b', aelindra)]));
    await vider();
    expect(actif(), 'ouverture : le choix de Sigmund').toBe('Corps à corps');
    const recus: string[] = [];
    jouer.addEventListener('focus', () => recus.push('focus'));
    await choisirPuisContinuer();
    expect(actif(), 'étape 2 : le choix d’Aelindra').toBe('Corps à corps');
    expect(recus, 'aucun passage par l’invocateur entre deux étapes').toEqual([]);
    act(() => useGame.setState({ pendingCascade: null } as never));
    await vider();
    expect(document.activeElement, 'fermeture : l’invocateur').toBe(jouer);
    expect(recus).toEqual(['focus']);
  });

  it('append au bilan (même `purpose`) : le focus va à la première étape appendue', async () => {
    ouvrir('affichage', [{ ...choix('c-a', sigmund), chosen: '0' } as never]);
    act(() => root.render(<StrictMode><button>Jouer</button><CascadeBody /></StrictMode>));
    await vider();
    act(() => useGame.getState().cascadeResolveAll());
    await vider();
    const bilan = useGame.getState().pendingCascade!;
    expect(bilan.cursor, 'bilan : curseur en fin').toBe(bilan.participants.length);
    bouton('Terminer').focus();
    act(() => ouvrir('affichage', [choix('c-b', aelindra)]));
    await vider();
    const p = useGame.getState().pendingCascade!;
    expect(p.cursor, 'le curseur n’a pas bougé : même valeur, étape neuve').toBe(bilan.cursor);
    expect(p.participants[p.cursor]?.id).toBe('c-b');
    expect(actif(), 'le choix de l’étape appendue').toBe('Corps à corps');
  });

  it('autre `purpose` pendant une étape, MÊME id d’étape : la cascade courante est suspendue, le focus va au choix de la nouvelle', async () => {
    ouvrir('affichage', [choix('c-a', sigmund), choix('c-b', aelindra)]);
    act(() => root.render(<StrictMode><button>Jouer</button><CascadeBody /></StrictMode>));
    await vider();
    const option = bouton('Corps à corps');
    act(() => option.click());
    await vider();
    bouton('Continuer').focus();
    // `startCascade` n'exige l'unicité des ids qu'au sein d'un même `purpose` : `c-a` revient.
    act(() => ouvrir('test', [choix('c-a', aelindra, [{ key: '0', label: 'Tenir' }, { key: '1', label: 'Rompre' }]), choix('d-b', sigmund)]));
    await vider();
    const p = useGame.getState().pendingCascade!;
    expect(p.purpose).toBe('test');
    expect(p.participants[p.cursor]?.id, 'même id que l’étape suspendue').toBe('c-a');
    expect(p.cursor, 'le curseur repart à 0 : même valeur, étape neuve').toBe(0);
    expect(actif(), 'le choix de la nouvelle cascade').toBe('Tenir');
  });
});

/** Hôte `Modal` d'une zone embarquée : « Acte » (l'invocateur) dans le corps, les gestes de la zone au
 *  PIED de l'hôte, donc hors de la boîte de la zone. « Lancer » survit à l'étape 1 : c'est l'effet
 *  d'étape, pas le sauvetage de l'hôte, qui déplace le focus. */
function hoteDeZone() {
  const ctl = { etape: (_: number) => {}, zone: (_: boolean) => {} };
  function Hote() {
    const [e, setE] = useState(0);
    const [zone, setZone] = useState(false);
    ctl.etape = setE;
    ctl.zone = setZone;
    const pied = zone
      ? <>
          <button key="a" className={e === 0 ? 'btn btn-primary' : 'btn'}>Lancer</button>
          <button key="b" className={e === 1 ? 'btn btn-primary' : 'btn'}>Appliquer</button>
        </>
      : <button key="b" className="btn">Appliquer</button>;
    return (
      <Modal title="Hôte" onClose={() => {}} footer={pied}>
        <button className="btn" id="acte">Acte</button>
        {zone && <EmbeddedShell title="Jet" etape={`z:${e}`}><p>jet</p></EmbeddedShell>}
      </Modal>
    );
  }
  return { Hote, ctl };
}

describe('focus d’étape — zone embarquée, entrée au pied de l’hôte (hors de la boîte de la zone)', () => {
  it('à l’étape, le focus resté sur l’entrée précédente passe à l’entrée de l’étape', async () => {
    const { Hote, ctl } = hoteDeZone();
    act(() => root.render(<StrictMode><Hote /></StrictMode>));
    await vider();
    document.querySelector<HTMLElement>('#acte')!.focus();
    act(() => ctl.zone(true));
    await vider();
    expect(actif(), 'ouverture de la zone : son entrée, au pied').toBe('Lancer');
    act(() => ctl.etape(1));
    await vider();
    expect(bouton('Lancer'), '« Lancer » survit à l’étape').toBeTruthy();
    expect(actif(), 'l’entrée de l’étape').toBe('Appliquer');
  });

  it('à la fermeture de la zone, l’invocateur est rendu même si le focus est sur l’entrée de l’étape', async () => {
    const { Hote, ctl } = hoteDeZone();
    act(() => root.render(<StrictMode><Hote /></StrictMode>));
    await vider();
    document.querySelector<HTMLElement>('#acte')!.focus();
    act(() => ctl.zone(true));
    await vider();
    act(() => ctl.etape(1));
    await vider();
    expect(actif(), 'étape : l’entrée de l’étape').toBe('Appliquer');
    act(() => ctl.zone(false));
    await vider();
    expect(actif(), 'fermeture : l’invocateur').toBe('Acte');
  });
});

/**
 * Règle d'étape (#2533, décision d'ingénierie, `useFocusEmprunte`) : à un changement d'étape, le geste
 * DISPARU cède au groupe révélé (sauvetage, option retenue comprise) ; le geste SURVIVANT laisse la
 * cible d'étape (ouverture), même quand le focus l'a quitté pour <body>.
 */
describe('changement d’étape — geste survivant ou disparu (#2533)', () => {
  const focusNomme = () => (document.activeElement === document.body ? 'BODY' : (document.activeElement?.textContent ?? '').trim());
  const bouton = (t: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.textContent ?? '').trim() === t)!;
  const pilote = { avancer: (_: number) => {} };
  /** Le pied SURVIT à l'étape ; le corps change. */
  function PiedSurvit() {
    const [e, setE] = useState(0);
    pilote.avancer = setE;
    return (
      <Modal title="T" onClose={() => {}} etape={e} footer={<button className="btn btn-primary">Continuer</button>}>
        {e === 0 ? <p>texte</p> : <div className="seg"><button aria-pressed="false">A</button><button aria-pressed="false">B</button></div>}
      </Modal>
    );
  }
  /** MÊME étape 2 (option A pré-retenue, « Valider » au pied), atteinte par un geste qui SURVIT (pied) ou DISPARAÎT (corps). */
  function Etape({ gestePied }: { gestePied: boolean }) {
    const [e, setE] = useState(0);
    const pied = gestePied
      ? <button className="btn btn-primary" onClick={() => setE(1)}>{e === 0 ? 'Suivant' : 'Valider'}</button>
      : (e === 1 ? <button className="btn btn-primary">Valider</button> : undefined);
    return (
      <Modal title="T" onClose={() => {}} etape={e} footer={pied}>
        {e === 0
          ? (gestePied ? <p>intro</p> : <button className="btn" onClick={() => setE(1)}>Suivant</button>)
          : <div className="seg"><button aria-pressed="true">A</button><button aria-pressed="false">B</button></div>}
      </Modal>
    );
  }

  it('P4 : focus sur body après un clic sur une zone vide, étape avancée hors geste — le geste survit, la cible d’étape est posée', async () => {
    act(() => root.render(<PiedSurvit />));
    await tacheSuivante();
    expect(focusNomme()).toBe('Continuer');
    act(() => bouton('Continuer').blur());
    await tacheSuivante();
    expect(focusNomme()).toBe('BODY');
    act(() => pilote.avancer(1));
    await tacheSuivante();
    expect(focusNomme(), 'la cible d’étape (1re option offerte)').toBe('A');
  });

  it('P5a : geste au PIED, il survit — la cible d’étape (le primaire, l’option étant déjà retenue)', async () => {
    act(() => root.render(<Etape gestePied />));
    await tacheSuivante();
    const suivant = bouton('Suivant');
    act(() => suivant.focus());
    act(() => suivant.click());
    await tacheSuivante();
    expect(focusNomme()).toBe('Valider');
  });

  it('P5b : geste au CORPS, il disparaît — le groupe révélé (l’option retenue)', async () => {
    act(() => root.render(<Etape gestePied={false} />));
    await tacheSuivante();
    const suivant = bouton('Suivant');
    act(() => suivant.focus());
    act(() => suivant.click());
    await tacheSuivante();
    expect(focusNomme()).toBe('A');
  });
});
