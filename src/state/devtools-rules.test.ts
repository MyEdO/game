import { describe, it, expect, beforeEach } from 'vitest';
import { rule, resetRule, OPTIONAL_RULES } from '../engine/policy';
import { reglerUneRegleMaisonWeb as auPanneau } from './reglesMaison';
import { useGame } from './store';
import { buildApi } from './devtools';
import { poserLeLocalStorage } from '../lib/stockage.testkit';

const KEY = 'wfrp4.house-rules';


/**
 * LE HELPER DE RECETTE NE DOIT PAS MENTIR SUR SA PERSISTANCE (#1279) — `__wfrp.rules(id, value)` est une
 * surcharge RUNTIME (elle meurt au rechargement), mais `rules(id, null)` doit purger la surcharge
 * PERSISTÉE : sinon une règle cochée un jour au panneau revient COCHÉE à chaque ouverture, et toute
 * « restauration » de recette est une illusion (mesuré : « Jeux de taverne rapides » retrouvée active
 * 3 runs de suite après deux restaurations). La remise à zéro passe donc par la couture JOUEUR
 * (`remettreUneRegleMaison`), verrou de combat compris.
 */
describe('__wfrp.rules(id, null) — la remise à zéro purge le PERSISTÉ, pas seulement la mémoire', () => {
  beforeEach(() => {
    poserLeLocalStorage();
    useGame.setState({ battle: null });
    for (const r of OPTIONAL_RULES) resetRule(r.id);
  });

  it('une règle cochée AU PANNEAU (persistée) est PURGÉE du localStorage', () => {
    auPanneau('tavern-games-rapides', true);
    expect(JSON.parse(localStorage.getItem(KEY)!)['tavern-games-rapides'], 'le panneau persiste').toBe(true);

    buildApi().rules('tavern-games-rapides', null);

    expect(rule('tavern-games-rapides'), 'défaut RAW retrouvé en mémoire').toBe(false);
    expect(JSON.parse(localStorage.getItem(KEY)!)['tavern-games-rapides'], 'et rien ne ressuscite au run suivant').toBeUndefined();
  });

  it('EN COMBAT, la remise à zéro est REFUSÉE et DIT sa raison (même verrou que le panneau)', () => {
    auPanneau('tavern-games-rapides', true);
    useGame.setState({ battle: { over: null } as never });

    const dit = buildApi().rules('tavern-games-rapides', null);

    expect(typeof dit === 'string' && dit.length > 0, 'le helper rend la raison au lieu de mentir').toBe(true);
    expect(rule('tavern-games-rapides'), 'rien n’a bougé').toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY)!)['tavern-games-rapides']).toBe(true);
  });
});
