// @vitest-environment jsdom
/**
 * #1921 — la campagne se recrée de toute pièce à l'éditeur : un PNJ joueur de taverne dont le jeu a
 * disparu le DIT à l'Inspecteur, et les Spéciaux d'un jeu (NADJ 16 l.82) s'éditent au clic au Codex,
 * leur Talent choisi au catalogue des talents.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { Inspector } from './Inspector';
import { CodexEdit } from './codex/CodexEdit';
import { emptyScene, type Scene, type SceneEntity } from '../../noyau/monde/scene';
import { emptyNarratif } from '../../state/campaignNarratif';
import { datasetArray, setDataset } from '../../data/overrides';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(demonterRacines);

/** Saisie utilisateur dans un contrôle React (setter natif du prototype + `input`/`change`). */
function saisir(champ: HTMLInputElement | HTMLSelectElement, valeur: string) {
  const proto = champ instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(champ, valeur);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
    champ.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('Inspecteur — un jeu de taverne orphelin se signale', () => {
  function inspecteur(entity: SceneEntity) {
    const scene: Scene = { ...emptyScene(4, 4), entities: [entity] };
    const montage = monterRacine(null);
    act(() => montage.rendre(
      <Inspector
        scene={scene} otherScenes={[]} worldMap={null} setScene={() => undefined}
        sel={{ type: 'entity', id: entity.id }} setSel={() => undefined}
        enemyCreatures={[{ id: 'humain', label: 'Humain' }]} openLogic={() => undefined} resizeScene={() => undefined}
        narratif={emptyNarratif()} tool={{ mode: 'select' }} armZoneTiles={() => undefined} zoneFocusKey={null}
      />,
    ));
    return [...montage.container.querySelectorAll('select')]
      .find((el) => el.closest('label')?.textContent?.includes('Joueur de taverne')) as HTMLSelectElement;
  }

  it('un `gameId` hors catalogue reste affiché, marqué introuvable, et le champ est invalide', () => {
    const jeu = inspecteur({ id: 'j', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, tavernGame: { gameId: 'jeu-disparu' } });
    expect(jeu.value, 'jamais « — aucun — » en silence').toBe('jeu-disparu');
    expect(jeu.selectedOptions[0].textContent).toBe('jeu-disparu (introuvable)');
    expect(jeu.getAttribute('aria-invalid')).toBe('true');
  });

  it('un jeu du catalogue n’est pas signalé', () => {
    const jeu = inspecteur({ id: 'j', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, tavernGame: { gameId: 'dominos' } });
    expect(jeu.value).toBe('dominos');
    expect(jeu.getAttribute('aria-invalid')).toBeNull();
    expect([...jeu.options].some((o) => o.textContent?.includes('(introuvable)'))).toBe(false);
  });
});

type Jeu = { id: string; specials?: Record<string, unknown>[] };

describe('Codex — les Spéciaux d’un jeu de taverne s’éditent au clic', () => {
  const avant = (datasetArray('tavernGames') as Jeu[]).slice();
  afterEach(() => setDataset('tavernGames', avant as never));

  it('Arène : modifier, ajouter, retirer une rangée ; le Talent se choisit au catalogue ; la sauvegarde passe le schéma', async () => {
    const montage = monterRacine(null);
    act(() => montage.rendre(<CodexEdit categoryKey="tavernGames" id="arene" onClose={() => {}} />));
    const c = montage.container;
    const nomme = <T extends Element>(nom: string): T => {
      const el = c.querySelector<T>(`[aria-label="${nom}"]`);
      expect(el, `aucun contrôle « ${nom} »`).toBeTruthy();
      return el!;
    };
    const clic = (nom: string) => act(() => { nomme<HTMLButtonElement>(nom).click(); });

    // Les sous-champs se nomment par la méta de leur nœud (`specialSchema`, `nommerChamps`), dans l'ordre de sa déclaration.
    const libelles = [...c.querySelectorAll('.ed-subform > .ed-champs')][0].querySelectorAll(':scope > .ed-field > span');
    expect([...libelles].map((l) => l.textContent?.replace(/\s*\(.*\)$/, ''))).toEqual(['Effet', 'Talent', 'Crans', 'Difficulté imposée', 'Source']);
    const talent1 = nomme<HTMLSelectElement>('Talent de la rangée 1 de Spéciaux');
    expect(talent1.tagName, 'un sélecteur, jamais une saisie libre').toBe('SELECT');
    expect(talent1.value).toBe('tireur-d-elite');
    expect([...talent1.options].map((o) => o.value)).toContain('tireur-embusque');

    saisir(talent1, 'tireur-embusque');
    saisir(nomme<HTMLInputElement>('Crans (plus facile si positif) de la rangée 1 de Spéciaux'), '2');

    clic('Ajouter une rangée à Spéciaux');
    saisir(nomme<HTMLSelectElement>('Effet de la rangée 2 de Spéciaux'), 'difficulte');
    saisir(nomme<HTMLSelectElement>('Talent de la rangée 2 de Spéciaux'), 'tireur-de-precision');
    saisir(nomme<HTMLSelectElement>('Difficulté imposée de la rangée 2 de Spéciaux'), 'facile');
    saisir(nomme<HTMLSelectElement>('Livre de la source de la rangée 2 de Spéciaux'), 'nuits-agitees-et-dures-journees');
    const page = nomme<HTMLInputElement>('Page de la source de la rangée 2 de Spéciaux');
    saisir(page, '93');
    act(() => { page.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });

    clic('Ajouter une rangée à Spéciaux');
    clic('Retirer la rangée 3 de Spéciaux');
    expect(c.querySelector('[aria-label="Talent de la rangée 3 de Spéciaux"]'), 'la rangée retirée a disparu').toBeNull();

    const enregistrer = c.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!;
    expect(enregistrer.disabled).toBe(false);
    await act(async () => { enregistrer.click(); });
    expect(c.querySelector('.codex-edit-errors'), 'le schéma a refusé la sauvegarde').toBeNull();
    const arene = (datasetArray('tavernGames') as Jeu[]).find((g) => g.id === 'arene')!;
    expect(arene.specials).toEqual([
      { effet: 'cran', hasTalent: 'tireur-embusque', steps: 2, source: { book: 'nuits-agitees-et-dures-journees', page: 93, note: 'NADJ 16 l.82' } },
      { effet: 'difficulte', hasTalent: 'tireur-de-precision', difficulty: 'facile', source: { book: 'nuits-agitees-et-dures-journees', page: 93 } },
    ]);
  });

  it('Arène : vider les crans rend l’ABSENCE, jamais 0 — et le schéma la refuse pour un cran', async () => {
    const montage = monterRacine(null);
    act(() => montage.rendre(<CodexEdit categoryKey="tavernGames" id="arene" onClose={() => {}} />));
    const c = montage.container;
    const crans = c.querySelector<HTMLInputElement>('[aria-label="Crans (plus facile si positif) de la rangée 1 de Spéciaux"]')!;
    saisir(crans, '');
    await act(async () => { c.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!.click(); });
    expect(c.querySelector('.codex-edit-errors')?.textContent, 'un cran vidé n’est pas enregistré à 0').toContain('« Crans (plus facile si positif) » est requis');
    expect((datasetArray('tavernGames') as Jeu[]).find((g) => g.id === 'arene')!.specials![0].steps, 'la donnée garde son cran').toBe(1);
  });

  it('Dominos, sans Spécial : la première rangée se pose de toute pièce, Talent compris', async () => {
    const montage = monterRacine(null);
    act(() => montage.rendre(<CodexEdit categoryKey="tavernGames" id="dominos" onClose={() => {}} />));
    const c = montage.container;
    const nomme = <T extends Element>(nom: string): T => {
      const el = c.querySelector<T>(`[aria-label="${nom}"]`);
      expect(el, `aucun contrôle « ${nom} »`).toBeTruthy();
      return el!;
    };
    const difficulte = [...c.querySelectorAll<HTMLLabelElement>('.codex-edit-form > label.ed-field')]
      .find((l) => l.querySelector('span')?.textContent === 'Difficulté du Test')?.querySelector('select');
    expect(difficulte?.value, 'la Difficulté de racine (NADJ 16 l.105) s’édite au Codex').toBe('accessible');
    act(() => { nomme<HTMLButtonElement>('Ajouter une rangée à Spéciaux').click(); });
    saisir(nomme<HTMLSelectElement>('Effet de la rangée 1 de Spéciaux'), 'cran');
    const talent = nomme<HTMLSelectElement>('Talent de la rangée 1 de Spéciaux');
    expect(talent.tagName).toBe('SELECT');
    saisir(talent, 'tireur-d-elite');
    saisir(nomme<HTMLInputElement>('Crans (plus facile si positif) de la rangée 1 de Spéciaux'), '1');
    saisir(nomme<HTMLSelectElement>('Livre de la source de la rangée 1 de Spéciaux'), 'nuits-agitees-et-dures-journees');
    const page = nomme<HTMLInputElement>('Page de la source de la rangée 1 de Spéciaux');
    saisir(page, '93');
    act(() => { page.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    await act(async () => { c.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!.click(); });
    expect(c.querySelector('.codex-edit-errors'), 'le schéma a refusé la sauvegarde').toBeNull();
    expect((datasetArray('tavernGames') as Jeu[]).find((g) => g.id === 'dominos')!.specials).toEqual([
      { effet: 'cran', hasTalent: 'tireur-d-elite', steps: 1, source: { book: 'nuits-agitees-et-dures-journees', page: 93 } },
    ]);
  });
});
