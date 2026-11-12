import { describe, it, expect } from 'vitest';
import { OPTIONAL_RULES } from '../engine/policy';
import { useGame } from '../state/store';
import { ICON_DEFS } from '../data/icons';

/**
 * CÂBLAGE des actions déclarées sur le registre des règles optionnelles (`OptionalRule.action`).
 *
 * `run` et `icon` sont des `string` par NÉCESSITÉ de couche : `engine/policy.ts` est une feuille pure,
 * il ne peut typer ni les clés du store (`state`) ni l'union `IconId` (`ui`) sans inverser la
 * dépendance. Le compilateur ne voit donc pas un renommage — cette garde le voit. Modes de
 * défaillance couverts : un `run` qui ne désigne plus rien (le bouton disparaît en silence), un `run`
 * qui désigne une propriété d'état non appelable (crash au clic), une `icon` absente du registre.
 */
const runIsStoreAction = (run: string): boolean =>
  typeof (useGame.getState() as unknown as Record<string, unknown>)[run] === 'function';

const iconIsRegistered = (icon: string): boolean => !!ICON_DEFS[icon];

const declaredActions = () =>
  OPTIONAL_RULES.filter((r) => r.action).map((r) => ({ rule: r.id, ...r.action! }));

describe('règles optionnelles — actions déclarées, câblage store & icônes', () => {
  it('chaque `action.run` désigne une FONCTION du store, chaque `action.icon` un id du registre', () => {
    const actions = declaredActions();
    expect(actions.length).toBeGreaterThan(0);
    expect(
      actions.filter((a) => !runIsStoreAction(a.run)),
      'action.run ne désigne aucune fonction du store (renommage ?) — le bouton disparaîtrait en silence',
    ).toEqual([]);
    expect(
      actions.filter((a) => !iconIsRegistered(a.icon)),
      'action.icon absente du registre src/data/icons/ — le rendu lèverait en DEV',
    ).toEqual([]);
  });

  it('MORSURE : un nom fautif, une propriété non appelable et une icône inventée sont REFUSÉS', () => {
    expect(runIsStoreAction('restaurerLaFortune')).toBe(true); // le nom réellement déclaré
    expect(runIsStoreAction('restoreFortuneMaintenant')).toBe(false); // renommage/typo
    expect(runIsStoreAction('battle')).toBe(false); // propriété d'état : crash au clic
    expect(runIsStoreAction('party')).toBe(false);
    expect(iconIsRegistered('ressource/chance')).toBe(true);
    expect(iconIsRegistered('resource/fortune-inventee')).toBe(false);
  });
});
