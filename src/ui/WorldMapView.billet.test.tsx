// @vitest-environment jsdom
/**
 * CÂBLAGE du billet (#2534) sur le chemin réel du joueur, à La Diligence (EDO 01 l.142) : panneau de départ
 * → « Marchander » → modale de Marchandage → « Conclure » → prix négocié affiché → « Payer et partir » →
 * débit de ce prix.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WorldMapView } from './WorldMapView';
import { BargainModal } from './BargainModal';
import { useGame } from '../state/store';
import { diligenceCampaign, paquetDuJeu } from '../scenes/campaign';
import { creditBourse, partyMoneyTotal } from '../state/bourseFlow';
import { toBrass } from '../engine/money';
import { setRule } from '../engine/policy';
import type { Combatant } from '../engine/types';
import type { BilletEnMain } from '../state/billetFlow';

const R1 = 'route-la-diligence-route-principale';
const R2 = 'route-route-principale-sept-rayons';

const heros = (i: number): Combatant =>
  ({
    id: `h${i}`, label: `Héros ${i}`, kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], movement: 4,
  } as unknown as Combatant);

let hote: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  act(() => root.unmount());
  hote.remove();
  vi.restoreAllMocks();
});

function bouton(texte: string): HTMLButtonElement {
  const b = [...hote.querySelectorAll('button')].find((e) => (e.getAttribute('aria-label') ?? e.textContent ?? '').includes(texte));
  if (!b) throw new Error(`bouton « ${texte} » introuvable`);
  return b;
}
function cliquer(texte: string): void {
  act(() => { bouton(texte).dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

/** Le groupe de 4 à La Diligence, 240 sous, la diligence attelée ; carte et modale de Marchandage montées. */
function monter(routeId = R1, sceneId = 'la-diligence', sous = 240, billetEnMain: BilletEnMain | null = null): void {
  setRule('travel-departure-gate', false);
  const paquet = paquetDuJeu(diligenceCampaign);
  const party = [1, 2, 3, 4].map(heros);
  useGame.setState({ party, billetEnMain: null, marchandagesDeBillet: {}, pendingBargain: null });
  useGame.getState().loadProject(paquet.scenes, sceneId, structuredClone(paquet.worldMap!), paquet.narratif);
  const wm = useGame.getState().worldMap!;
  const flags = { ...useGame.getState().flags, 'edo-ch1-depart': true, ...(billetEnMain ? { 'edo-ch1-corps-kastor-fouille': true } : {}) };
  useGame.setState({ worldMap: { ...wm, params: { ...wm.params, perilDie: 0 } }, flags, billetEnMain });
  if (sous) creditBourse(useGame.getState, useGame.setState, 'h1', { gold: 0, silver: 0, brass: sous });
  hote = document.createElement('div');
  document.body.appendChild(hote);
  root = createRoot(hote);
  act(() => root.render(<><WorldMapView initialRouteId={routeId} /><BargainModal /></>));
}

describe('billet de Gunnar et Hultz — chemin réel du joueur', () => {
  it('la modale nomme le marchandeur et l’ENJEU du billet avant le jet, palier « 6 DR ou plus » insécable', () => {
    monter();
    cliquer('Diligence');
    cliquer('Marchander le billet');
    const modale = document.body.textContent ?? '';
    expect(modale).toContain('Héros 1 — Marchandage, contre');
    // Classe et prix, prix et « la place » : insécables (N1).
    expect(modale).toContain('Prix demandé : Intérieur 8/–, Extérieur 4/– la place. Marchandage gagné : Intérieur 6/–, Extérieur 3/– la place ; 6 DR ou plus : Intérieur 4/–, Extérieur 2/– la place.');
  });

  it('le TOTAL du passage est un cartouche à part, « Prix » soudé à son montant insécable, sans refus répété', () => {
    monter(R1, 'la-diligence', 0); // bourse vide : « Payer et partir » refusé
    cliquer('Diligence');
    const total = hote.querySelector('.worldmap-panel .stat-chip'); // cartouche « label + valeur » de la charte
    expect(total?.querySelector('.sc-label')?.textContent).toBe('Prix (4 places)');
    expect(total?.querySelector('.sc-value .coins')?.textContent).toBe('16/–'); // 4 × 4/– sur le toit
    expect([...hote.querySelectorAll('.wm-est')].some((p) => p.textContent?.includes('Prix'))).toBe(false);
    expect(hote.textContent).not.toContain('bourse insuffisante'); // le refus vit dans l'infobulle de « Payer et partir »
    const css = readFileSync(resolve(process.cwd(), 'src/ui/styles/coins.css'), 'utf8');
    expect(css).toMatch(/(^|\n)\.coins\s*\{[^}]*white-space:\s*nowrap/);
  });

  it('en-tête de route : chaque nombre reste soudé à son unité', () => {
    monter();
    cliquer('Diligence');
    expect(hote.querySelector('.wm-trip-route')?.textContent).toContain('principale · 40 km'); // le « · » reste avec le lieu (N6)
    expect(hote.textContent).toContain('Allure 15 km/h');
    expect(hote.textContent).toContain('Billet jusqu’à Auberge des Sept Rayons (75 km)');
  });

  it('« Marchander » est secondaire : une seule action primaire par barre, « Payer et partir »', () => {
    monter();
    cliquer('Diligence');
    expect(bouton('Marchander le billet').className).not.toContain('btn-primary');
    expect(bouton('Payer et partir').className).toContain('btn-primary');
  });

  it('billet implicite : même structure que le billet d’auteur (arrivée, distance, classes)', () => {
    monter(R2, 'route-principale-virage');
    act(() => { useGame.setState({ flags: { ...useGame.getState().flags, 'edo-ch1-corps-kastor-fouille': true } }); });
    cliquer('Diligence');
    expect(hote.textContent).toContain('Billet jusqu’à Auberge des Sept Rayons (35 km)');
    // Tarif implicite au km (LDB 51 l.178) sur 35 km, insécable de bout en bout (N1).
    expect(bouton('Extérieur').textContent).toBe('Extérieur · 2/11 la place');
    expect(bouton('Intérieur').textContent).toBe('Intérieur · 5/10 la place');
  });

  it('au relais, billet en main : le panneau s’ouvre sur le mode du billet, sans clic', () => {
    monter(R2, 'route-principale-virage', 240, { routeId: R1, mode: 'diligence', classeId: 'exterieur', routesRestantes: [R2] });
    expect(hote.textContent).toContain('Billet payé (Extérieur) jusqu’à');
    expect(hote.querySelector('[aria-pressed="true"]')?.textContent).toContain('Diligence');
  });

  it('tronçon couvert : le panneau rappelle la classe payée', () => {
    monter(R2, 'route-principale-virage');
    act(() => { useGame.setState({ billetEnMain: { routeId: R1, mode: 'diligence', classeId: 'interieur', routesRestantes: [R2] }, flags: { ...useGame.getState().flags, 'edo-ch1-corps-kastor-fouille': true } }); });
    cliquer('Diligence');
    expect(hote.textContent).toContain('Billet payé (Intérieur) jusqu’à');
  });

  it('Marchander déjà joué : sa raison se lit dans l’infobulle au focus, comme celle de « Payer et partir »', () => {
    monter(R1, 'la-diligence', 0); // bourse vide : « Payer et partir » refusé aussi
    cliquer('Diligence');
    act(() => { useGame.setState({ marchandagesDeBillet: { [`${R1}:diligence`]: { won: false, drNet: 1, negotiator: false } } }); });
    const raisonAuFocus = (texte: string) => {
      act(() => { bouton(texte).focus(); });
      const r = document.querySelector('.infobulle[role="tooltip"] [data-refus]')?.textContent ?? null;
      act(() => { bouton(texte).blur(); });
      return r;
    };
    expect(raisonAuFocus('Marchander le billet')).toBe('Le prix de ce billet est déjà marchandé : un seul Test par billet.');
    // Même mode que « Payer et partir » refusé (bourse vide) : infobulle au focus, aucune raison gravée à l'écran.
    expect(raisonAuFocus('Payer et partir')).toBeTruthy();
    expect(hote.querySelectorAll('.gated-action-reason').length).toBe(0);
  });

  it('Marchander → Conclure → prix négocié affiché → Payer et partir → débit du prix affiché', async () => {
    monter();
    cliquer('Diligence');
    expect(hote.textContent).toContain('Billet jusqu’à');
    expect(hote.textContent).toContain('4/–'); // toit, prix demandé (EDO 01 l.142)

    cliquer('Marchander le billet');
    expect(useGame.getState().pendingBargain?.contrepartie).toEqual({ kind: 'billet', routeId: R1, mode: 'diligence' });
    // d100 imposés dans l'ordre du flux : négociateur 5 (cible 30), vendeur 95 (cible 27) ; le reste à 50.
    const des = [5, 95];
    vi.spyOn(Math, 'random').mockImplementation(() => ((des.shift() ?? 50) - 0.5) / 100);
    cliquer('Lancer');
    // Le dé roule à l'écran avant de tomber (animation du jet) : on attend sa chute, comme le joueur.
    for (let i = 0; i < 50 && !useGame.getState().pendingBargain?.result; i++) await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
    // Le verdict dit le prix OBTENU (EDO 01 l.142 : 3/- sur le toit, 2/- avec au moins 6 DR).
    const verdict = useGame.getState().pendingBargain!.result!.netSL >= 6 ? 'Intérieur 4/–, Extérieur 2/–' : 'Intérieur 6/–, Extérieur 3/–';
    expect(document.body.textContent).toContain(`Gagné : ${verdict} la place`);
    cliquer('Conclure');
    expect(hote.textContent).toContain('Prix marchandé (Marchandage gagné).'); // le fait, sa cause entre parenthèses (N7)
    expect(useGame.getState().pendingBargain).toBeNull();
    const issue = useGame.getState().marchandagesDeBillet[`${R1}:diligence`];
    expect(issue.won).toBe(true);
    // Le prix négocié (EDO 01 l.142 : 3/-, ou 2/- à 6 DR) remplace le prix demandé dans l'option du toit.
    const toit = issue.drNet >= 6 ? { sous: 24, affiche: '2/–' } : { sous: 36, affiche: '3/–' };
    expect(bouton('Extérieur').textContent).toContain(`${toit.affiche} la place`);
    expect(bouton('Marchander le billet').getAttribute('aria-disabled') ?? String(bouton('Marchander le billet').disabled)).toMatch(/true/);

    cliquer('Payer et partir');
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(240 - 4 * toit.sous);
    expect(useGame.getState().billetEnMain?.routesRestantes).toEqual(['route-route-principale-sept-rayons']);
  });
});
