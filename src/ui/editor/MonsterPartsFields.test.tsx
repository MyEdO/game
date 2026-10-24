// @vitest-environment jsdom
/**
 * Briques d'apparence (#1897) : chaque valeur offerte est celle que son lecteur résout. L'arme équipée
 * est un `trappingId` (`SceneEntity.weapon`, `weaponFromId`) ; l'option vide d'Espèce nomme la race que
 * le rendu pose à défaut de toute espèce (`resolveRender`). L'Espèce propose le domaine de saisie
 * (`domaineDEspeces`, `grammaire/art.ts`), formes de nuée pour une Nuée seulement.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { choisirMediaSelect } from '../MediaSelect.testkit';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { ObjetDonneField } from './ObjetDonneField';
import { objetDuNarratif } from '../../noyau/monde/resolveursDuNarratif';
import { emptyNarratif } from '../../noyau/monde/campaignNarratif';
import { findTrappingById } from '../../data';
import { EffectFields } from './EffectList';
import { GameOpEditor } from './GameOpEditor';
import type { Effect } from '../../data/schemas/defs-scenes/effets';
import type { GameOp } from '../../engine/ops';
import { apparencesAdmissibles } from '../../engine/items';
import { CIBLES_D_EFFET_DE_SCENE } from '../../noyau/combatEffects';
import { ApparencesObjetsField, MonsterPartsFields, ReglagesApparence } from './MonsterPartsFields';
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

describe('apparence donnée — effets et ops', () => {
  it('les options de l’objet de campagne suivent sa shape locale et son défaut', () => {
    const objet = { ...findTrappingById('arme-simple')!, id: 'hache-de-campagne', label: 'Hache du projet', shape: 'hache', formChoices: ['hache'] };
    let value: { trappingId: string; apparence?: { id: string } } = { trappingId: objet.id };
    const root = monterRacine(null);
    const render = () => root.rendre(<ObjetDonneField objets={[objet]} value={value} onChange={(next) => { value = next; render(); }} />);
    act(render);
    const labels = [...root.container.querySelectorAll('[role="option"] .ms-label')].map((e) => e.textContent);
    expect(labels).toContain('Hache naine');
    expect(labels).not.toContain('Épée');
    choisirMediaSelect(root.container, 'Apparence de l’objet donné', 'Hache naine');
    expect(value.apparence).toEqual({ id: 'hache_naine' });
    choisirMediaSelect(root.container, 'Apparence de l’objet donné', 'Hache');
    expect(value).not.toHaveProperty('apparence');
    let appearance: EntityAppearance = {};
    const renderEntity = () => root.rendre(<ApparencesObjetsField appearance={appearance}
      weapons={[{ trappingId: objet.id }]} resolveTrapping={objetDuNarratif({ ...emptyNarratif(), objets: [objet] })}
      onChange={(next) => { appearance = next; renderEntity(); }} />);
    act(renderEntity);
    choisirMediaSelect(root.container, 'Apparence — Hache du projet', 'Hache naine');
    expect(appearance.apparencesObjets).toEqual({ [objet.id]: 'hache_naine' });
    choisirMediaSelect(root.container, 'Apparence — Hache du projet', 'Hache');
    expect(appearance).not.toHaveProperty('apparencesObjets');
  });
  it.each(['effet', 'op'])('%s : options admissibles, choix, défaut et changement d’objet', (surface) => {
    let valeur: Effect | GameOp = surface === 'effet'
      ? { type: 'giveTrapping', trappingId: 'arme-simple' }
      : { op: 'giveTrapping', trappingId: 'arme-simple', count: 2, perSL: { every: 1, amount: 1 } };
    const root = monterRacine(null);
    const changer = (v: Effect | GameOp) => { valeur = v; render(); };
    const render = () => root.rendre(surface === 'effet'
      ? <EffectFields effect={valeur as Effect} onChange={changer} ctx={{ encounters: [], dialogues: [], cibles: CIBLES_D_EFFET_DE_SCENE }} />
      : <GameOpEditor ops={[valeur as GameOp]} onChange={(ops) => changer(ops[0])} />);
    act(render);
    const options = () => [...root.container.querySelectorAll('[title="Apparence de l’objet donné"] + [role="listbox"] .ms-label')].map((e) => e.textContent);
    expect(options()).toEqual(apparencesAdmissibles({ trappingId: 'arme-simple' }).map((a) => a.label));
    choisirMediaSelect(root.container, 'Apparence de l’objet donné', 'Hache naine');
    expect(valeur).toMatchObject({ apparence: { id: 'hache_naine' } });
    choisirMediaSelect(root.container, 'Apparence de l’objet donné', 'Épée');
    expect(valeur).not.toHaveProperty('apparence');
    choisirMediaSelect(root.container, 'Apparence de l’objet donné', 'Hache naine');
    const input = root.container.querySelector<HTMLInputElement>('input[aria-label="Objet donné"]')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'bouclier');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(valeur).toMatchObject({ trappingId: 'bouclier' });
    expect(valeur).not.toHaveProperty('apparence');
    expect(options()).toEqual(apparencesAdmissibles({ trappingId: 'bouclier' }).map((a) => a.label));
    if (surface === 'op') expect(valeur).toMatchObject({ count: 2, perSL: { every: 1, amount: 1 } });
  });
});

describe('ApparencesObjetsField — contrat partagé', () => {
  it('déduplique les armes, propose les variantes admises et retire seulement la clé revenue au défaut', () => {
    let next: EntityAppearance = { sex: 'M', apparencesObjets: { bouclier: 'bouclier_rectangle' } };
    const root = monterRacine(null);
    const render = () => root.rendre(<ApparencesObjetsField appearance={next} onChange={(a) => { next = a; render(); }}
      weapons={[{ trappingId: 'arme-simple' }, { trappingId: 'arme-simple' }, { trappingId: 'bouclier' }, {}]} />);
    act(render);
    expect(root.container.querySelectorAll('[role="combobox"]')).toHaveLength(2);
    const labels = [...root.container.querySelectorAll('[title="Apparence — Arme simple"] + [role="listbox"] .ms-label')].map((e) => e.textContent);
    expect(labels).toContain('Hache naine');
    expect(labels).not.toContain('Bouclier rectangulaire');
    const choisir = (arme: string, label: string) => choisirMediaSelect(root.container, `Apparence — ${arme}`, label);
    choisir('Arme simple', 'Hache naine');
    expect(next.apparencesObjets).toEqual({ bouclier: 'bouclier_rectangle', 'arme-simple': 'hache_naine' });
    choisir('Arme simple', 'Épée');
    expect(next.apparencesObjets).toEqual({ bouclier: 'bouclier_rectangle' });
    choisir('Bouclier', 'Bouclier');
    expect(next).toEqual({ sex: 'M' });
  });
});

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
