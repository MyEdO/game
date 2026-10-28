// @vitest-environment jsdom
/**
 * Une spécialisation appartient à l'entrée qu'elle spécialise (#3045) : tout sélecteur d'id dont le nœud
 * admet une spécialisation la retire quand l'id change (`reposerLId`) et l'offre au catalogue de l'entrée
 * (`ChoixDeSpec`), dédié ou générique ; l'éditeur n'offre jamais deux régimes de spécialisation que le
 * schéma refuse ensemble.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act, useState } from 'react';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { AdvancementRefField, TalentTestField } from './codex/StructFields';
import { GameOpEditor } from './GameOpEditor';
import { EffectFields } from './EffectList';
import { CodexEdit } from './codex/CodexEdit';
import { catalogueSpecs, entreeOuverte, idsDe } from '../../data/schemas/grammaire/ref';
import { datasetArray, datasetObject, resetData } from '../../data/overrides';
import { CIBLES_D_EFFET_DE_SCENE } from '../../noyau/combatEffects';
import type { AdvancementRef, TalentTest } from '../../data';
import type { GameOp } from '../../engine/ops';
import type { Effect } from '../../data/schemas/defs-scenes/effets';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  demonterRacines();
  resetData();
});

const fermeeASpecs = (type: 'skill' | 'talent', min: number, sauf?: string): string =>
  [...idsDe(type)].find((id) => id !== sauf && !entreeOuverte(type, id) && catalogueSpecs(type, id).length >= min)!;
const autreQue = (id: string): string => [...idsDe('skill')].find((x) => x !== id)!;

async function poser(select: HTMLSelectElement, valeur: string) {
  await act(async () => {
    select.value = valeur;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
const parNom = (c: HTMLElement, nom: string) => c.querySelector<HTMLSelectElement>(`select[aria-label="${nom}"]`);
/** Le contrôle de spécialisation nommé `nom` : un `<select>` (entrée fermée) ou un `<input>` (entrée ouverte). */
const specNommee = (c: HTMLElement, nom: string) => c.querySelector<HTMLSelectElement | HTMLInputElement>(`[aria-label="${nom}"]`);
/** Le `<select>` d'id qui porte la valeur `id` (jamais un sélecteur de spécialisation). */
const selecteurDId = (c: HTMLElement, id: string) =>
  [...c.querySelectorAll('select')].find((s) => !s.getAttribute('aria-label')?.startsWith('Spécialisation') && s.value === id)!;
const enregistrer = (c: HTMLElement) => act(async () => c.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!.click());

describe('emplacement `choix` d’une Carrière (joker)', () => {
  it('affiche son id, le garde au changement, ses restreintes suivent le nouvel id', async () => {
    const x = fermeeASpecs('skill', 2);
    const y = fermeeASpecs('skill', 2, x);
    let dernier: AdvancementRef[] = [{ id: x, choix: catalogueSpecs('skill', x).slice(0, 1) }];
    function Banc() {
      const [v, setV] = useState(dernier);
      return <AdvancementRefField ds="skills" label="C" value={v} onChange={(n) => { dernier = n; setV(n); }} />;
    }
    const { container } = monterRacine(<Banc />);
    const joker = container.querySelectorAll('select')[1];
    expect(joker.value, 'le joker affiche son id courant').toBe(x);
    await poser(joker, y);
    expect(dernier).toEqual([{ id: y, choix: true }]);
    const cases = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(cases).toHaveLength(catalogueSpecs('skill', y).length);
    await act(async () => cases[1].click());
    expect(dernier).toEqual([{ id: y, choix: [catalogueSpecs('skill', y)[1]] }]);
    await act(async () => container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1].click());
    expect(dernier).toEqual([{ id: y, choix: true }]);
  });
});

describe('sélecteurs dédiés', () => {
  it('op `skillMod` : la Compétence se choisit avec sa spécialisation, qui tombe au changement', async () => {
    const quittee = fermeeASpecs('skill', 1);
    const [spec] = catalogueSpecs('skill', quittee);
    const visee = autreQue(quittee);
    let dernier: GameOp[] = [{ op: 'skillMod', skill: { id: quittee, spec }, mod: -10 }];
    function Banc() {
      const [ops, setOps] = useState(dernier);
      return <GameOpEditor ops={ops} onChange={(o) => { dernier = o; setOps(o); }} />;
    }
    const { container } = monterRacine(<Banc />);
    expect(container.querySelector('select[aria-label^="Spécialisation"]')).not.toBeNull();
    await poser(selecteurDId(container, quittee), visee);
    expect(dernier).toEqual([{ op: 'skillMod', skill: { id: visee }, mod: -10 }]);
  });

  it('effet `startPursuit` : la Compétence de Mouvement est une référence choisie, sa spécialisation tombe au changement', async () => {
    const quittee = fermeeASpecs('skill', 1);
    const [spec] = catalogueSpecs('skill', quittee);
    const visee = autreQue(quittee);
    let dernier = { type: 'startPursuit', partyRole: 'fleeing', distance: 4, skill: { id: quittee, spec }, foes: [], encounter: '' } as unknown as Effect;
    function Banc() {
      const [e, setE] = useState(dernier);
      return <EffectFields effect={e} ctx={{ encounters: [], dialogues: [], cibles: CIBLES_D_EFFET_DE_SCENE }} onChange={(n) => { dernier = n; setE(n); }} />;
    }
    const { container } = monterRacine(<Banc />);
    expect(parNom(container, 'Spécialisation — Compétence de Mouvement')!.value).toBe(spec);
    await poser(selecteurDId(container, quittee), visee);
    expect((dernier as unknown as { skill: unknown }).skill).toEqual({ id: visee });
  });

  it('Test de Résistance de l’exposition à l’eau : la spécialisation choisie tombe au changement de Compétence', async () => {
    const specialisee = fermeeASpecs('skill', 1);
    const [spec] = catalogueSpecs('skill', specialisee);
    const visee = autreQue(specialisee);
    const { container } = monterRacine(<CodexEdit categoryKey="waterExposure" id={(datasetObject('waterExposure') as { id: string }).id} onClose={() => undefined} />);
    const competence = () => [...container.querySelectorAll('select')].find((s) => !s.getAttribute('aria-label')?.startsWith('Spécialisation') && [...s.options].some((o) => o.value === specialisee))!;
    await poser(competence(), specialisee);
    await poser(parNom(container, 'Spécialisation — Test de Résistance')!, spec);
    await poser(competence(), visee);
    await enregistrer(container);
    expect((datasetObject('waterExposure') as { test: { skill: unknown } }).test.skill).toEqual({ id: visee });
  });
});

describe('champ générique du Codex : toute référence à spécialisation passe par `RefField` (`spec`)', () => {
  it('référence seule (`tavernGames.skill`) : spécialisation au catalogue, retirée au changement, document valide', async () => {
    const avant = (datasetArray('tavernGames') as unknown as { id: string; skill?: { id: string; spec?: string } }[]).find((g) => g.skill?.spec)!;
    const quittee = avant.skill!;
    const visee = autreQue(quittee.id);
    const { container } = monterRacine(<CodexEdit categoryKey="tavernGames" id={avant.id} onClose={() => undefined} />);
    const select = parNom(container, 'Compétence testée')!;
    expect(select.value).toBe(quittee.id);
    expect(specNommee(container, `Spécialisation — ${select.getAttribute('aria-label')}`)!.value).toBe(quittee.spec);
    await poser(select, visee);
    await enregistrer(container);
    expect(container.querySelectorAll('.codex-edit-errors li')).toHaveLength(0);
    const apres = (datasetArray('tavernGames') as unknown as { id: string; skill?: unknown }[]).find((g) => g.id === avant.id)!;
    expect(apres.skill).toEqual({ id: visee });
  });

  it('liste de références (`seaWeather` skillMods.skills) : chaque rangée garde la sienne, la rangée changée perd sa spécialisation', async () => {
    type Meteo = { precipitations: { skillMods?: { skills: { id: string; spec?: string }[] }[] }[] };
    const avant = structuredClone((datasetObject('seaWeather') as unknown as Meteo).precipitations);
    const i = avant.findIndex((p) => p.skillMods?.some((m) => m.skills.some((s) => s.spec)));
    const j = avant[i].skillMods!.findIndex((m) => m.skills.some((s) => s.spec));
    const k = avant[i].skillMods![j].skills.findIndex((s) => s.spec);
    const quittee = avant[i].skillMods![j].skills[k];
    const visee = [...idsDe('skill')].find((id) => !avant[i].skillMods![j].skills.some((s) => s.id === id))!;
    const { container } = monterRacine(<CodexEdit categoryKey="seaWeather" id="seaWeather" onClose={() => undefined} />);
    const rangee = `de la rangée ${k + 1} de `;
    const select = [...container.querySelectorAll<HTMLSelectElement>('select')]
      .find((s) => s.getAttribute('aria-label')?.includes(rangee) && s.getAttribute('aria-label')?.includes(`de la rangée ${i + 1} de`) && s.value === quittee.id)!;
    expect(select, 'le sélecteur de la rangée nommé par sa position').toBeDefined();
    expect(specNommee(container, `Spécialisation — ${select.getAttribute('aria-label')}`)!.value).toBe(quittee.spec);
    await poser(select, visee);
    await enregistrer(container);
    expect(container.querySelectorAll('.codex-edit-errors li')).toHaveLength(0);
    const apres = (datasetObject('seaWeather') as unknown as Meteo).precipitations;
    expect(apres[i].skillMods![j].skills).toEqual(avant[i].skillMods![j].skills.map((s, n) => (n === k ? { id: visee } : s)));
  });
});

describe('Test lié d’un Talent : spécialisation fixe et spécialisation exclue ne s’offrent pas ensemble', () => {
  it('au clic : l’une posée retire l’offre de l’autre ; changer de Compétence retire l’exclusion', async () => {
    const comp = fermeeASpecs('skill', 2);
    const [a, b] = catalogueSpecs('skill', comp);
    let dernier: TalentTest | undefined = { raw: 'r', matches: [{ skill: { id: comp } }] };
    function Banc() {
      const [v, setV] = useState(dernier);
      return <TalentTestField value={v} onChange={(n) => { dernier = n; setV(n); }} />;
    }
    const { container } = monterRacine(<Banc />);
    const fixe = () => parNom(container, 'Spécialisation fixe — modificateur 1');
    const exclue = () => parNom(container, 'Spécialisation exclue — modificateur 1');
    expect(fixe()).not.toBeNull();
    expect(exclue()).not.toBeNull();
    await poser(fixe()!, a);
    expect(dernier?.matches[0]).toEqual({ skill: { id: comp, spec: a } });
    expect(exclue()).toBeNull();
    await poser(fixe()!, '');
    expect(dernier?.matches[0].skill).toEqual({ id: comp });
    await poser(exclue()!, b);
    expect(dernier?.matches[0].exceptSpec).toBe(b);
    expect(fixe()).toBeNull();
    const autre = autreQue(comp);
    await poser(selecteurDId(container, comp), autre);
    expect(dernier?.matches[0].exceptSpec).toBeUndefined();
    expect(dernier?.matches[0].skill).toEqual({ id: autre });
  });
});
