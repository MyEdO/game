// @vitest-environment jsdom
/**
 * Briques d'apparence (#1897) : chaque valeur offerte est celle que son lecteur résout. L'arme équipée
 * est un `trappingId` (`SceneEntity.weapon`, `weaponFromId`) ; l'option vide d'Espèce nomme la race que
 * le rendu pose à défaut de toute espèce (`resolveRender`). L'Espèce propose le domaine de saisie
 * (`domaineDEspeces`, `grammaire/art.ts`), formes de nuée pour une Nuée seulement.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { MonsterPartsFields, ReglagesApparence } from './MonsterPartsFields';
import { weaponFromId } from '../../engine/creatureEquip';
import { resolveRender } from '../../gameIso/rig/bodyPlan';
import { raceById } from '../../gameIso/rig/races';
import { domaineDEspeces, fauteDEspece, estFormeDeNuee } from '../../data/schemas/grammaire/art';
import type { EntityAppearance } from '../../engine/authoringAppearance';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(demonterRacines);

const selectDe = (container: HTMLElement, libelle: string): HTMLSelectElement =>
  [...container.querySelectorAll('label')].find((l) => l.textContent?.startsWith(libelle))!.querySelector('select')!;

describe('MonsterPartsFields — Arme équipée', () => {
  it('∀ option, la valeur est un trappingId que weaponFromId résout en arme', () => {
    const { container } = monterRacine(<MonsterPartsFields appearance={{}} onChange={() => {}} reglages={[]} onWeapon={() => {}} />);
    const valeurs = [...selectDe(container, 'Arme équipée').options].map((o) => o.value).filter(Boolean);
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => {});
    const irresolues = valeurs.filter((v) => weaponFromId(v) === null);
    erreur.mockRestore();
    expect(valeurs.length).toBeGreaterThan(0);
    expect(irresolues).toEqual([]);
  });

  it('le choix émet le trappingId, pas le libellé', () => {
    const onWeapon = vi.fn();
    const { container } = monterRacine(<MonsterPartsFields appearance={{}} onChange={() => {}} reglages={[]} onWeapon={onWeapon} />);
    const select = selectDe(container, 'Arme équipée');
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'arbalete');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onWeapon).toHaveBeenLastCalledWith('arbalete');
  });
});

describe('ReglagesApparence — option vide d’Espèce', () => {
  it('renvoie au profil, puis nomme la race que le rendu pose sans espèce ni profil', () => {
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => {});
    const repli = resolveRender(undefined, undefined, undefined);
    erreur.mockRestore();
    const { container } = monterRacine(<ReglagesApparence appearance={{}} onChange={() => {}} reglages={['species']} />);
    const vide = selectDe(container, 'Espèce').options[0];
    expect(vide.value).toBe('');
    expect(vide.textContent).toMatch(/^— selon le profil \(à défaut : /);
    expect(vide.textContent).toContain(raceById(repli.species).label);
  });
});

describe('ReglagesApparence — Espèce : le domaine de saisie, partagé par le trait Nuée', () => {
  const especes = (appearance: EntityAppearance, nuee: boolean) => {
    const { container } = monterRacine(<ReglagesApparence appearance={appearance} onChange={() => {}} reglages={['species']} nuee={nuee} />);
    return selectDe(container, 'Espèce');
  };
  const proposees = (select: HTMLSelectElement) => [...select.querySelectorAll('optgroup option')].map((o) => (o as HTMLOptionElement).value);

  it('∀ id du domaine, une option dans le sélecteur de son groupe', () => {
    const domaine = domaineDEspeces();
    const horsNuee = new Set(proposees(especes({}, false)));
    const nuee = new Set(proposees(especes({}, true)));
    expect([...domaine.jouables, ...domaine.creatures].filter((id) => !horsNuee.has(id))).toEqual([]);
    expect(domaine.nuees.filter((id) => !nuee.has(id))).toEqual([]);
  });

  it('aucune option proposée n’échoue au domaine ; aucune forme de nuée hors Nuée, aucune autre en Nuée', () => {
    const horsNuee = proposees(especes({}, false));
    const nuee = proposees(especes({}, true));
    expect([...horsNuee, ...nuee].filter((id) => fauteDEspece(id))).toEqual([]);
    expect(horsNuee.filter(estFormeDeNuee)).toEqual([]);
    expect(nuee.filter((id) => !estFormeDeNuee(id))).toEqual([]);
  });

  it('une espèce jouable portée (nains) est l’option sélectionnée', () => {
    expect(especes({ species: 'nains' }, false).value).toBe('nains');
  });

  it('une valeur hors des options reste sélectionnée, marquée « (inconnue) »', () => {
    const select = especes({ species: 'rats' }, false);
    expect(select.value).toBe('rats');
    expect(select.selectedOptions[0].textContent).toContain('(inconnue)');
  });
});
