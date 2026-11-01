// @vitest-environment jsdom
/**
 * Briques d'apparence (#1897) : chaque valeur offerte est celle que son lecteur résout. L'arme équipée
 * est un `trappingId` (`SceneEntity.weapon`, `weaponFromId`) ; l'option vide d'Espèce renvoie au profil.
 * L'Espèce propose les registres `species.json` et `creatures.json`, lus par `bodyShapeForSpecies`
 * (`engine/bodyForm.ts`).
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { choisirMediaSelect } from '../MediaSelect.testkit';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { ObjetDonneField } from './ObjetDonneField';
import { objetDuNarratif } from '../../noyau/monde/resolveursDuNarratif';
import { emptyNarratif } from '../../noyau/monde/campaignNarratif';
import { findCreatureById, findTrappingById } from '../../data';
import { EffectFields } from './EffectList';
import { GameOpEditor } from './GameOpEditor';
import type { Effect } from '../../data/schemas/defs-scenes/effets';
import type { GameOp } from '../../engine/ops';
import { apparencesAdmissiblesDObjet } from '../../data/apparencesObjets';
import { CIBLES_D_EFFET_DE_SCENE } from '../../noyau/combatEffects';
import { ApparencesObjetsField, ArmeEquipeeField, ReglagesApparence } from './ReglagesApparence';
import { weaponFromId } from '../../engine/creatureEquip';
import { idsDe } from '../../data/schemas/grammaire/ref';
import type { EntityAppearance } from '../../engine/authoringAppearance';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(demonterRacines);

const selectDe = (container: HTMLElement, libelle: string): HTMLSelectElement =>
  [...container.querySelectorAll('label')].find((l) => l.textContent?.startsWith(libelle))!.querySelector('select')!;

describe('apparence donnée — effets et ops', () => {
  it('les options de l’objet de campagne suivent sa shape locale et son défaut', () => {
    const objet = { ...findTrappingById('arme-simple')!, id: 'hache-de-campagne', label: 'Hache du projet', shape: { id: 'hache' }, formChoices: ['hache'] };
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
    expect(appearance.apparencesObjets).toEqual({ [objet.id]: { id: 'hache_naine' } });
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
    expect(options()).toEqual(apparencesAdmissiblesDObjet({ trappingId: 'arme-simple' }).map((a) => a.label));
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
    expect(options()).toEqual(apparencesAdmissiblesDObjet({ trappingId: 'bouclier' }).map((a) => a.label));
    if (surface === 'op') expect(valeur).toMatchObject({ count: 2, perSL: { every: 1, amount: 1 } });
  });
});

describe('ApparencesObjetsField — contrat partagé', () => {
  it('déduplique les armes, propose les variantes admises et retire seulement la clé revenue au défaut', () => {
    let next: EntityAppearance = { sex: 'M', apparencesObjets: { bouclier: { id: 'bouclier_rectangle' } } };
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
    expect(next.apparencesObjets).toEqual({ bouclier: { id: 'bouclier_rectangle' }, 'arme-simple': { id: 'hache_naine' } });
    choisir('Arme simple', 'Épée');
    expect(next.apparencesObjets).toEqual({ bouclier: { id: 'bouclier_rectangle' } });
    choisir('Bouclier', 'Bouclier');
    expect(next).toEqual({ sex: 'M' });
  });
});

describe('ArmeEquipeeField', () => {
  it('∀ option, la valeur est un trappingId que weaponFromId résout en arme', () => {
    const { container } = monterRacine(<ArmeEquipeeField onWeapon={() => {}} />);
    const valeurs = [...selectDe(container, 'Arme équipée').options].map((o) => o.value).filter(Boolean);
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => {});
    const irresolues = valeurs.filter((v) => weaponFromId(v) === null);
    erreur.mockRestore();
    expect(valeurs.length).toBeGreaterThan(0);
    expect(irresolues).toEqual([]);
  });

  it('le choix émet le trappingId, pas le libellé', () => {
    const onWeapon = vi.fn();
    const { container } = monterRacine(<ArmeEquipeeField onWeapon={onWeapon} />);
    const select = selectDe(container, 'Arme équipée');
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'arbalete');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onWeapon).toHaveBeenLastCalledWith('arbalete');
  });
});

describe('ReglagesApparence — option vide d’Espèce', () => {
  it('renvoie au profil', () => {
    const { container } = monterRacine(<ReglagesApparence appearance={{}} onChange={() => {}} reglages={['species']} />);
    const vide = selectDe(container, 'Espèce').options[0];
    expect(vide.value).toBe('');
    expect(vide.textContent).toBe('— selon le profil —');
  });
});

describe('ReglagesApparence — Espèce : les registres d’espèces jouables et du bestiaire', () => {
  const especes = (appearance: EntityAppearance) => {
    const { container } = monterRacine(<ReglagesApparence appearance={appearance} onChange={() => {}} reglages={['species']} />);
    return selectDe(container, 'Espèce');
  };
  const groupe = (select: HTMLSelectElement, libelle: string) =>
    [...select.querySelectorAll(`optgroup[label="${libelle}"] option`)].map((o) => (o as HTMLOptionElement).value);

  it('deux groupes : « Espèces jouables » = ids de species.json, « Bestiaire » = ids de creatures.json', () => {
    const select = especes({});
    expect([...select.querySelectorAll('optgroup')].map((g) => g.label)).toEqual(['Espèces jouables', 'Bestiaire']);
    expect(new Set(groupe(select, 'Espèces jouables'))).toEqual(new Set(idsDe('species')));
    expect(new Set(groupe(select, 'Bestiaire'))).toEqual(new Set(idsDe('creature')));
  });

  it('une créature du bestiaire s’affiche par son libellé, jamais par son id', () => {
    const creature = [...idsDe('creature')].map((id) => findCreatureById(id)).find((c) => c && c.label !== c.id)!;
    const option = [...especes({}).options].find((o) => o.value === creature.id)!;
    expect(option.textContent).toBe(creature.label);
  });

  it('une espèce jouable portée (nains) est l’option sélectionnée', () => {
    expect(especes({ species: 'nains' }).value).toBe('nains');
  });

  it('une valeur hors des deux registres reste sélectionnée, son id marqué « (hors registre) »', () => {
    const horsRegistre = 'espece-hors-registre';
    expect(idsDe('species').has(horsRegistre) || idsDe('creature').has(horsRegistre)).toBe(false);
    const select = especes({ species: horsRegistre });
    expect(select.value).toBe(horsRegistre);
    expect(select.selectedOptions[0].textContent).toBe(`${horsRegistre} (hors registre)`);
  });
});
