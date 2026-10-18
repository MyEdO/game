// @vitest-environment jsdom
/**
 * #2534 — CÂBLAGE du billet sur le chemin réel du joueur, paquet RÉEL committé (EDO 01 l.142) : clic
 * « Marchander » → modale du Marchandage → « Lancer » → « Conclure » → prix négocié affiché par classe →
 * « Payer et partir » → débit du groupe. L'estimation de l'écran et le débit du flux lisent la même offre.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WorldMapView } from './WorldMapView';
import { BargainModal } from './BargainModal';
import { useGame } from '../state/store';
import { diligenceCampaign, paquetDuJeu } from '../scenes/campaign';
import { makePregensWithWealth, PREGEN } from '../data/pregens';
import { creditBourse, fortuneDuGroupe } from '../state/bourseFlow';
import { toBrass } from '../engine/money';
import { setRule, resetRule } from '../engine/policy';
import { draineCascade } from '../state/cascadeTestKit';
import { t } from '../i18n';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const paquet = paquetDuJeu(diligenceCampaign);
const get = () => useGame.getState();
const bourse = () => toBrass(fortuneDuGroupe(get));
const NET_INITIAL = useGame.getState().net;
const SHOWCASE = [PREGEN.soldat, PREGEN.tueur, PREGEN.sorcier, PREGEN.chasseur].map((s) => `pregen-${s}`);

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  setRule('test-auto-bands', 'off');
  // Préférence « réduire les animations » (`prefersReducedMotion`) : « Lancer » résout sans roulis de dés.
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  resetRule('test-auto-bands');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useGame.setState({ pendingBargain: null, billetEnMain: null, marchandagesDeBillet: {}, travelPlan: null, net: NET_INITIAL });
});

const T1 = 'route-la-diligence-route-principale';
const T2 = 'route-route-principale-sept-rayons';

/** Le chapitre 1 lancé avec le groupe showcase et sa bourse, monté à bord (`edo-ch1-depart`). */
function aBord(): void {
  const groupe = makePregensWithWealth().filter((e) => SHOWCASE.includes(e.hero.id));
  useGame.setState({ party: groupe.map((e) => e.hero) });
  get().loadProject(paquet.scenes, paquet.scenes[0].id, paquet.worldMap, paquet.narratif);
  for (const e of groupe) creditBourse(get, useGame.setState, e.hero.id, e.wealth);
  get().acquitterOuverture();
  get().moveParty({ x: 13, y: 31 });
  get().jouerAction('diligence-remise-charrette', 'monter-a-bord');
  expect(get().worldMapOpen).toBe(true);
}

function bouton(texte: string): HTMLButtonElement {
  const b = [...document.body.querySelectorAll('button')].find((x) => (x.textContent ?? '').trim() === texte || x.getAttribute('aria-label') === texte);
  if (!b) throw new Error(`bouton « ${texte} » introuvable`);
  return b;
}
async function cliquer(b: Element): Promise<void> {
  await act(async () => { b.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

describe('billet de la diligence — chemin du joueur', () => {
  it('Marchandage raté de beaucoup : le bandeau nomme le passager refusé près de « Payer et partir » (#2547 c.6234887738)', async () => {
    aBord();
    get().startBilletBargain(T1, 'diligence');
    const negociateur = get().pendingBargain!.playerName;
    const des = [100, 1];
    vi.spyOn(Math, 'random').mockImplementation(() => ((des.shift() ?? 1) - 0.5) / 100);
    get().bargainRoll();
    vi.restoreAllMocks();
    get().bargainConfirm();
    await act(async () => { root.render(<WorldMapView initialRouteId={T1} />); });
    await cliquer(bouton('Diligence'));
    expect(container.textContent).toContain(t('mf.refusVisite', { name: negociateur }));
    expect(bouton('Payer et partir')).toBeTruthy();
  });


  it('Marchander → Conclure → prix négocié par place → Payer et partir → 4 × 3/- débités', async () => {
    const groupe = makePregensWithWealth().filter((e) => SHOWCASE.includes(e.hero.id));
    useGame.setState({ party: groupe.map((e) => e.hero) });
    get().loadProject(paquet.scenes, paquet.scenes[0].id, paquet.worldMap, paquet.narratif);
    for (const e of groupe) creditBourse(get, useGame.setState, e.hero.id, e.wealth);
    get().acquitterOuverture();
    get().moveParty({ x: 13, y: 31 });
    get().jouerAction('diligence-remise-charrette', 'monter-a-bord');
    expect(get().worldMapOpen).toBe(true);

    await act(async () => {
      root.render(<><WorldMapView initialRouteId="route-la-diligence-route-principale" /><BargainModal /></>);
    });
    await cliquer(bouton('Diligence'));
    expect(container.textContent).toContain('Billet jusqu’à Auberge des Sept Rayons (75 km)');
    // Prix plein par place, la classe la MOINS chère retenue par défaut (toit = Extérieur).
    expect(bouton('Extérieur : 4/– par place').getAttribute('aria-pressed')).toBe('true');
    expect(bouton('Intérieur : 8/– par place').getAttribute('aria-pressed')).toBe('false');
    // Prix par PLACE dit une fois en légende, la classe la moins chère en tête ; le total dit ses places.
    const classes = bouton('Extérieur : 4/– par place').closest('.rm-loc-inline')!;
    expect(classes.querySelector('.mini-title')?.textContent).toBe('Prix par place');
    expect([...classes.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'))).toEqual(['Extérieur : 4/– par place', 'Intérieur : 8/– par place']);
    expect(container.textContent).toContain('Total (4 places)');

    await cliquer(bouton('Marchander'));
    const pb = get().pendingBargain!;
    expect(pb.opposant.label).toBe('Gunnar et Hultz');
    expect(document.body.textContent).toContain('Marchander le billet');
    // Le joueur réussit d'un Degré (cible − 10), Gunnar et Hultz font 27 sur 27 : victoire nette < 6 DR.
    const des = [pb.playerSkill - 10, 27];
    vi.spyOn(Math, 'random').mockImplementation(() => ((des.shift() ?? 1) - 0.5) / 100);
    await cliquer(bouton('Lancer'));
    vi.restoreAllMocks();
    await cliquer(bouton('Conclure'));
    expect(get().pendingBargain).toBeNull();

    expect(bouton('Extérieur : 3/– par place').getAttribute('aria-pressed')).toBe('true');
    expect(bouton('Intérieur : 6/– par place')).toBeTruthy();
    expect(bouton('Marchander').getAttribute('aria-disabled'), 'un seul Test par billet').toBe('true');

    const avant = bourse();
    await cliquer(bouton('Payer et partir'));
    expect(avant - bourse()).toBe(4 * 36);
    expect(get().billetEnMain?.routesRestantes).toEqual(['route-route-principale-sept-rayons']);
  });

  it('au virage, billet en main : « Billet payé jusqu’à … (classe) », départ sans paiement', async () => {
    aBord();
    creditBourse(get, useGame.setState, get().party[0].id, { gold: 0, silver: 4, brass: 0 }); // 4 × 4/- au toit
    get().startTravel(T1, 'diligence', { classeId: 'exterieur' });
    expect(get().billetEnMain?.routesRestantes).toEqual([T2]);
    draineCascade(get);
    if (get().travelRecap) get().dismissTravelRecap();
    get().moveParty({ x: 36, y: 3 });
    get().jouerAction('cadavre-kastor-lieberung', 'fouiller');
    get().designerHerosChoisir(get().party[0].id);
    expect(get().flags['edo-ch1-corps-kastor-fouille']).toBe(true);

    await act(async () => { root.render(<WorldMapView initialRouteId={T2} />); });
    await cliquer(bouton('Diligence'));
    expect(container.textContent).toContain('Billet payé jusqu’à Auberge des Sept Rayons (Extérieur)');
    expect(() => bouton('Marchander')).toThrow();
    const avant = bourse();
    await cliquer(bouton('Partir'));
    expect(bourse(), 'le billet couvre le tronçon').toBe(avant);
    expect(get().billetEnMain).toBeNull();
  });

  it('coop : « Marchander » est fermé chez l’invité — l’hôte décide des départs', async () => {
    aBord();
    useGame.setState({ net: { ...get().net, mode: 'guest', mySeat: 1 } });
    await act(async () => { root.render(<WorldMapView initialRouteId={T1} />); });
    await cliquer(bouton('Diligence'));
    const marchander = bouton('Marchander');
    expect(marchander.getAttribute('aria-disabled')).toBe('true');
    await cliquer(marchander);
    expect(get().pendingBargain).toBeNull();
    expect(document.body.textContent).toContain('L’hôte décide des départs.');
  });
});
