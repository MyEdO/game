// @vitest-environment jsdom
/**
 * #1921 — un objet PRÉSENT dans la donnée se rend par l'objet de son nœud (`noeudObjet`), jamais par
 * une autre variante de son union ; un objet à clés déclarées se rend en objet, jamais en record.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { CodexEdit } from './CodexEdit';
import { datasetArray } from '../../data/overrides';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(demonterRacines);

function monter(categoryKey: string, id: string): HTMLDivElement {
  const montage = monterRacine(null);
  act(() => montage.rendre(<CodexEdit categoryKey={categoryKey} id={id} onClose={() => {}} />));
  return montage.container;
}

const libellesDe = (ecran: HTMLElement): string[] => [...ecran.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label') ?? '');
const libelles = (categoryKey: string, id: string): string[] => libellesDe(monter(categoryKey, id));

function saisir(champ: HTMLInputElement, valeur: string): void {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, valeur);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('Codex — un objet présent se rend par l’objet de son nœud', () => {
  it('bâton de combat : les Dégâts `{ plusBF, flat }` ne s’ouvrent pas sur la variante `literal` de l’union', () => {
    const degats = libelles('trappings', 'baton-de-combat').filter((l) => / de Dégâts$/.test(l));
    expect(degats).toEqual(['plusBF de Dégâts', 'flat de Dégâts']);
  });

  it('alvatafl : la Compétence `{ id, spec }` d’une option s’ouvre en objet, ses sous-champs nommés par la méta', () => {
    const competence = libelles('tavernGames', 'alvatafl').filter((l) => / de Compétence de la rangée 2 de Options de Test$/.test(l));
    expect(competence.map((l) => l.split(' de Compétence ')[0])).toEqual(expect.arrayContaining(['identifiant', 'spécialisation']));
    expect(competence).toContain('spécialisation de Compétence de la rangée 2 de Options de Test');
  });

  it('cogue : le `pos` d’un poste NEUF s’ouvre en objet, `x`/`y` saisissables', () => {
    const cogue = (datasetArray('vehicles') as { id: string; deck?: { postes?: unknown[] } }[]).find((v) => v.id === 'cogue');
    const neuve = (cogue?.deck?.postes?.length ?? 0) + 1;
    expect(neuve, 'cogue sans postes').toBeGreaterThan(1);
    const ecran = monter('vehicles', 'cogue');
    const ajouter = ecran.querySelector<HTMLButtonElement>('[aria-label="Ajouter une rangée à postes de Facette Pont"]');
    expect(ajouter, 'bouton d’ajout de poste absent').not.toBeNull();
    act(() => ajouter!.click());
    const suffixe = `de position de la rangée ${neuve} de postes de Facette Pont`;
    expect(libellesDe(ecran)).toEqual(expect.arrayContaining([`abscisse ${suffixe}`, `ordonnée ${suffixe}`]));
    const abscisse = ecran.querySelector<HTMLInputElement>(`input[aria-label="abscisse ${suffixe}"]`)!;
    saisir(abscisse, '3');
    expect(ecran.querySelector<HTMLInputElement>(`input[aria-label="abscisse ${suffixe}"]`)!.value).toBe('3');
  });
});
