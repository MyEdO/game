import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyCast } from '../noyau/combatFlow';
import { groupeDeScenario } from '../scenes/test-scenarios/_heros';
import { findSpellById } from '../data';
import type { CastResult } from '../engine/magic';
import type { Combatant } from '../engine/types';
import { EtatPanel } from './EtatPanel';
import { useGame } from '../state/store';

const reussi: CastResult = { cast: true, roll: 21, target: 70, sl: 3, isCritical: false, isFumble: false, log: 'lancé' };

/** La balise ouvrante de la pastille de pénalité d'incantation (`EtatPanel`, `chip tone-warn`). */
const pastilleDePenalite = (html: string): string | undefined => html.match(/<span[^>]*class="[^"]*\btone-warn\b[^"]*"[^>]*>/)?.[0];

describe('pénalité d’incantation : sa pastille d’état mène à la fiche de son sort, par id', () => {
  it('Couronne de Flammes lancée : la pénalité porte la source du sort, et sa pastille ouvre la fiche', () => {
    useGame.getState().ensemencerLeTirage(51);
    const [lanceur, cible] = groupeDeScenario(idsDeTest, 'sorcier', 'soldat');
    useGame.setState({ party: [lanceur, cible] as Combatant[], battle: null });
    applyCast(useGame.getState, useGame.setState, lanceur, cible, findSpellById('couronne-de-flammes')!, reussi, false, false);

    const touchee = useGame.getState().party.find((c) => c.id === cible.id)!;
    expect(touchee.castPenalties?.map((p) => p.source)).toEqual([{ kind: 'sort', id: 'couronne-de-flammes' }]);

    const pastille = pastilleDePenalite(renderToStaticMarkup(<EtatPanel hero={touchee} />));
    expect(pastille, 'la pastille de pénalité n’est pas rendue').toBeDefined();
    expect(pastille).toContain('role="button"');
    expect(pastille).not.toContain('codex-static');
  });
});
