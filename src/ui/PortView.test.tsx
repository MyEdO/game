/**
 * ESCALE-HUB (#228) — rendu statique des parties présentationnelles PURES (`PortHeader`/`EscaleTab`),
 * pilotées par props : le store en SSR sert l'état INITIAL (seam Zustand, cf. WorldMapView), donc on
 * teste les composants dérivés par props plutôt que le connecteur `PortView` complet.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { findNavalPortById } from '../data';
import { toMoney } from '../engine/money';
import type { PortProfile } from '../engine/seaVoyage';
import { useGame } from '../state/store';
import type { CampaignVessel } from '../noyau/etat';
import { PortHeader, EscaleTab } from './PortView';
import { refusDeGesteSurLeGroupe } from '../noyau/bourseFlow';

// `ShoreLeaveBody`/`ManannBody` (composés par `EscaleTab`) lisent l'événement en attente directement au
// store (SEULE source, cf. VoyageScreen embedded), jamais via une prop `pendingXxx` ad hoc sur ces deux
// corps. `renderToStaticMarkup` (environnement Vitest `node`) fait passer zustand par
// `getServerState ?? getInitialState` (cf. `node_modules/zustand/react.js`) — un `setState` classique
// n'est donc JAMAIS visible ici : seule une mutation de l'objet `getInitialState()` l'est. Restauré
// après chaque test (jamais de fuite vers un test ultérieur qui lirait `getInitialState()`).
const seedInitial = (patch: { pendingShoreLeave?: unknown; pendingManannPriest?: unknown; net?: unknown }) => {
  Object.assign(useGame.getInitialState() as unknown as Record<string, unknown>, patch);
};
const initialNetMode = useGame.getInitialState().net;
afterEach(() => {
  seedInitial({ pendingShoreLeave: null, pendingManannPriest: null, net: initialNetMode });
});

const pp: PortProfile = {
  taille: 4, richesse: 5, production: ['commerce', 'poisson-sale'],
  surplus: { 'pieces-detachees-de-navire': 1 }, demande: { armes: 1 }, cosmopolite: true,
};
const vessel = (crew?: CampaignVessel['crew']): CampaignVessel => ({
  vehicleId: 'cogue', label: 'Le Cormoran', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, ...(crew ? { crew } : {}),
});
const noop = () => {};
const escaleProps = {
  vessel: vessel(), refusHote: null,
  pendingShoreLeave: null, pendingManannPriest: null,
  onHire: noop, onDismiss: noop,
};

describe('PortHeader — en-tête d’escale-hub (#228)', () => {
  it('région du catalogue, 5 indices (libellés sea-cargo), desc verbatim', () => {
    const html = renderToStaticMarkup(<PortHeader pp={pp} catalogue={findNavalPortById('marienburg')} />);
    expect(html).toContain('Wasteland'); // région du catalogue
    expect(html).toContain('port cosmopolite');
    expect(html).toContain('Taille');
    expect(html).toContain('Richesse');
    expect(html).toContain('Production');
    expect(html).toContain('Surplus');
    expect(html).toContain('Demande');
    expect(html).toContain('Poisson salé'); // production id → libellé sea-cargo
    expect(html).toContain('Plus grande cité'); // desc verbatim du catalogue
  });

  it('sans catalogue (port sans ref) : indices rendus, ni région ni desc', () => {
    const html = renderToStaticMarkup(<PortHeader pp={pp} />);
    expect(html).toContain('Taille');
    expect(html).not.toContain('Wasteland');
    expect(html).not.toContain('Plus grande cité');
  });
});

describe('EscaleTab — actions d’escale (#228)', () => {
  it('rôles recrutables + roster vide annoncé, aucun événement en cours', () => {
    const html = renderToStaticMarkup(<EscaleTab {...escaleProps} />);
    expect(html).toContain('Recruter de l’équipage');
    expect(html).toContain('Embaucher');
    expect(html).toContain('Timonier');
    expect(html).toContain('Aucun équipage salarié');
    expect(html).toContain('Aucun événement d’escale en cours');
  });

  it('roster salarié rendu quand l’équipage existe', () => {
    const html = renderToStaticMarkup(<EscaleTab {...escaleProps} vessel={vessel([{ roleId: 'timonier', count: 2 }])} />);
    expect(html).toContain('Équipage salarié'); // ShipCrewWages
    expect(html).toContain('×2');
    expect(html).not.toContain('Aucun équipage salarié');
  });

  it('événement PRÊTRE DE MANANN surfacé (pas caché)', () => {
    const pendingManannPriest = { cost: toMoney({ gold: 5, silver: 3 }) };
    seedInitial({ pendingManannPriest });
    const html = renderToStaticMarkup(<EscaleTab {...escaleProps} pendingManannPriest={pendingManannPriest} />);
    expect(html).toContain('Prêtre de Manann');
    expect(html).toContain('Payer');
    expect(html).not.toContain('Aucun événement d’escale en cours');
  });

  it('RELÂCHE À TERRE en attente surfacée', () => {
    const pendingShoreLeave = { to: { id: 'x', label: 'X', pos: { x: 0, y: 0 }, scene: 's' } };
    seedInitial({ pendingShoreLeave });
    const html = renderToStaticMarkup(<EscaleTab {...escaleProps} pendingShoreLeave={pendingShoreLeave} />);
    expect(html).toContain('Accostage'); // titre porté par `ShoreLeaveBody` (Accostage à {lieu})
    expect(html).toContain('Accorder la relâche');
  });

  it('invité (guest) : embauche désactivée', () => {
    const html = renderToStaticMarkup(<EscaleTab {...escaleProps} refusHote={refusDeGesteSurLeGroupe({ net: { mode: 'guest' } as never })} />);
    expect(html).toMatch(/Embaucher<\/button>/); // le bouton existe
    expect(html).toContain('disabled'); // et il est désactivé
  });

  it('invité (guest) : RELÂCHE À TERRE non résolvable localement (régression #343)', () => {
    const pendingShoreLeave = { to: { id: 'x', label: 'X', pos: { x: 0, y: 0 }, scene: 's' } };
    seedInitial({ pendingShoreLeave, net: { ...initialNetMode, mode: 'guest' } });
    const html = renderToStaticMarkup(<EscaleTab {...escaleProps} refusHote={refusDeGesteSurLeGroupe({ net: { mode: 'guest' } as never })} pendingShoreLeave={pendingShoreLeave} />);
    expect(html).toContain('Accorder la relâche');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*?Accorder la relâche/);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*?Refuser la relâche/);
  });

  it('invité (guest) : PRÊTRE DE MANANN non résolvable localement (régression #343)', () => {
    const pendingManannPriest = { cost: toMoney({ gold: 5, silver: 3 }) };
    seedInitial({ pendingManannPriest, net: { ...initialNetMode, mode: 'guest' } });
    const html = renderToStaticMarkup(<EscaleTab {...escaleProps} refusHote={refusDeGesteSurLeGroupe({ net: { mode: 'guest' } as never })} pendingManannPriest={pendingManannPriest} />);
    expect(html).toContain('Payer');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*?Payer/);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*?Refuser/);
  });
});
