/**
 * CrewTestModal — Test d'équipage GÉNÉRIQUE de COMBAT uniquement (MDG 14) : les Tests d'équipage de
 * VOYAGE sont désormais des étapes de la cascade du jour (#275 Ronde 2 cran 3, `CascadeModal`) — cette
 * modale ne rend plus jamais un Test de voyage, l'action « Annuler » (undo de misclic) est donc
 * TOUJOURS présente.
 *
 * Corps PUR testé en props (patron `ShipDossierView`/`ShipDossier` — cf. docs/architecture.md) :
 * pas de mock du store, robuste sous `isolate:false` (aucun `vi.mock` requis par cette suite).
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PendingCrewTest } from '../noyau/pendings';
import type { BattleState } from '../state/store';
import { CrewTestModalView } from './CrewTestModal';

const noop = () => {};

const pending = (over: Partial<PendingCrewTest>): PendingCrewTest => ({
  shipId: 'ship1', testTypeId: 'progression', moraleScore: 0, participants: [], ...over,
});

const render = (p: PendingCrewTest, battle: BattleState | null) =>
  renderToStaticMarkup(
    <CrewTestModalView
      p={p} battle={battle} party={[]} owns={() => true}
      roll={noop} reroll={noop} bonus={noop} darkPact={noop} force={noop}
      confirm={noop} cancel={noop}
    />
  );

describe('CrewTestModal — Test d’équipage de COMBAT (#211, #275 Ronde 2 cran 3)', () => {
  it('rend le Test de COMBAT avec « Annuler » (Action défaisable)', () => {
    const html = render(pending({}), { combatants: [{ id: 'ship1', label: 'Le Loup' }] } as unknown as BattleState);
    expect(html).toContain('Le Loup');
    expect(html).toContain('Annuler');
  });

  it('sans navire/type d’équipage connu(s) → ne rend rien', () => {
    const html = render(pending({ testTypeId: 'inconnu' }), null);
    expect(html).toBe('');
  });
});
