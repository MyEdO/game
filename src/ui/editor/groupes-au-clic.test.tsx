// @vitest-environment jsdom
/**
 * Les champs de Groupe de l'atelier (#3045 A0-a) se choisissent AU CLIC dans le registre `groups.json`, par le
 * nœud de schéma du champ : un champ de PORTEUR n'offre pas les jokers (`DECLARABLE_PAR_UN_PORTEUR`), un champ
 * de CIBLE d'appartenance les offre sans les Groupes relatifs (`CIBLE_D_APPARTENANCE`, #3045) ; le document porte
 * des ids.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act, useState } from 'react';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { StatblockEditor } from './StatblockEditor';
import { TestFields } from './FlowEditor';
import { ConditionEditor } from './ConditionEditor';
import { Inspector } from './Inspector';
import { GameOpEditor } from './GameOpEditor';
import type { GameOp } from '../../engine/ops';
import type { CustomStatblock } from '../../engine/statblock';
import type { Condition, FlowTest } from '../../engine/flowCore';
import { emptyScene, type Scene } from '../../noyau/monde/scene';
import { emptyNarratif } from '../../noyau/monde/campaignNarratif';
import { idsDe, idsDeLaSousListe } from '../../data/schemas/grammaire/ref';
import { DECLARABLE_PAR_UN_PORTEUR } from '../../data/schemas/grammaire/sousListes';
import { banishNarrationSchema, hasWhatSchema } from '../../data/schemas/grammaire/mecanique';
import { valeursDe } from '../../data/schemas/grammaire/meta';
import { libelleDeValeur } from '../../data/schemas/grammaire/meta';
import { isSocialTest } from '../../engine/skills';
import { groups, skills } from '../../data';
import { CodexEdit } from './codex/CodexEdit';
import { datasetArray, resetData, setDataset } from '../../data/overrides';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  demonterRacines();
  resetData();
});

const GROUPES = [...idsDe('groupe')];
const DECLARABLES = idsDeLaSousListe('groupe', DECLARABLE_PAR_UN_PORTEUR);
/** Jokers et relatifs par la FORME de la donnée, jamais par la sous-liste qu'on éprouve. */
const RELATIFS = groups.filter((g) => g.relatif).map((g) => g.id);
const APPARTENANCE = GROUPES.filter((id) => !RELATIFS.includes(id));
const JOKER = groups.find((g) => g.matchesAll)?.id;
const [RELATIF] = RELATIFS;
const [DECLARABLE] = DECLARABLES;

/** Les valeurs d'option d'un `<select>`, choix vide exclu. */
const options = (select: HTMLSelectElement) => [...select.options].map((o) => o.value).filter((v) => v !== '');

/** Clique le bouton nommé `nom` du conteneur. */
async function cliquer(container: HTMLElement, nom: string) {
  const bouton = [...container.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === nom);
  expect(bouton, nom).toBeDefined();
  await act(async () => bouton!.click());
}

/** Choisit `valeur` dans le `<select>` nommé `nom`. */
async function choisir(container: HTMLElement, nom: string, valeur: string) {
  const select = container.querySelector<HTMLSelectElement>(`select[aria-label="${nom}"]`)!;
  expect(select, nom).not.toBeNull();
  await act(async () => {
    select.value = valeur;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const selectNomme = (container: HTMLElement, nom: string) => container.querySelector<HTMLSelectElement>(`select[aria-label="${nom}"]`)!;

it('le registre a des Groupes déclarables, des jokers et des Groupes relatifs', () => {
  expect(DECLARABLE).toBeDefined();
  expect(JOKER).toBeDefined();
  expect(RELATIF).toBeDefined();
});

describe('statbloc personnalisé — `groups` (porteur)', () => {
  it('ajouter, choisir, retirer un Groupe au clic ; les jokers ne sont pas offerts', async () => {
    let dernier: CustomStatblock = { type: 'statblock', label: 'X', char: { M: 4 } };
    function Banc() {
      const [stat, setStat] = useState(dernier);
      return <StatblockEditor chemin="banc/statblock" stat={stat} onChange={(s) => { dernier = s; setStat(s); }} />;
    }
    const { container } = monterRacine(<Banc />);
    await cliquer(container, 'Ajouter à Groupes');
    expect(options(selectNomme(container, 'Groupes — valeur 1')).sort()).toEqual([...DECLARABLES].sort());
    await choisir(container, 'Groupes — valeur 1', DECLARABLE);
    expect(dernier.groups).toEqual([DECLARABLE]);
    await cliquer(container, 'Retirer Groupes — valeur 1');
    expect(dernier.groups).toBeUndefined();
  });
});

describe('Test de Sociabilité — `vsGroups` (porteur : les Groupes de l’interlocuteur)', () => {
  it('ajouter et choisir un Groupe au clic ; les jokers ne sont pas offerts', async () => {
    const social = skills.find((s) => isSocialTest(s.id, undefined));
    expect(social).toBeDefined();
    let dernier: FlowTest = { skill: { id: social!.id } };
    function Banc() {
      const [test, setTest] = useState(dernier);
      return <TestFields test={test} onChange={(t) => { dernier = t; setTest(t); }} />;
    }
    const { container } = monterRacine(<Banc />);
    const nom = [...container.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') ?? '').find((n) => /^Ajouter à Groupes/.test(n));
    expect(nom).toBeDefined();
    await cliquer(container, nom!);
    const rangee = nom!.replace(/^Ajouter à /, '') + ' — valeur 1';
    expect(options(selectNomme(container, rangee)).sort()).toEqual([...DECLARABLES].sort());
    await choisir(container, rangee, DECLARABLE);
    expect(dernier.vsGroups).toEqual([DECLARABLE]);
  });
});

describe('barrière d’une zone — `blockGroups` (cible)', () => {
  it('ajouter et choisir un joker au clic', async () => {
    let dernier: Scene = { ...emptyScene('scene-test', 8, 8), effectZones: [{ id: 'zone-b', label: 'Cercle', presentation: 'interior', area: { kind: 'rect', x: 0, y: 0, w: 2, h: 2 }, z: 0, barrier: {} }] };
    function Banc() {
      const [scene, setScene] = useState(dernier);
      return (
        <Inspector
          scene={scene} otherScenes={[]} worldMap={null}
          setScene={(s) => { dernier = s; setScene(s); }}
          sel={{ type: 'effectZone', idx: 0 }} setSel={() => undefined}
          enemyCreatures={[]} openLogic={() => undefined} resizeScene={() => undefined}
          narratif={emptyNarratif()} tool={{ mode: 'select' }} armZoneTiles={() => undefined} zoneFocusKey={null}
        />
      );
    }
    const { container } = monterRacine(<Banc />);
    const nom = [...container.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') ?? '').find((n) => /^Ajouter à Bloque les groupes/.test(n));
    expect(nom).toBeDefined();
    await cliquer(container, nom!);
    const rangee = nom!.replace(/^Ajouter à /, '') + ' — valeur 1';
    expect(options(selectNomme(container, rangee)).sort()).toEqual([...APPARTENANCE].sort());
    await choisir(container, rangee, JOKER!);
    expect(dernier.effectZones?.[0].barrier?.blockGroups).toEqual([JOKER]);
  });
});

describe('op `banish` — `onlyGroups` (cible) et `narration` au clic', () => {
  it('ajouter et choisir un joker ; choisir une narration nommée', async () => {
    let dernier: GameOp[] = [{ op: 'banish' }];
    function Banc() {
      const [ops, setOps] = useState(dernier);
      return <GameOpEditor ops={ops} onChange={(o) => { dernier = o; setOps(o); }} />;
    }
    const { container } = monterRacine(<Banc />);
    const nom = [...container.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') ?? '').find((n) => /^Ajouter à Groupes visés/.test(n));
    expect(nom).toBeDefined();
    await cliquer(container, nom!);
    const rangee = nom!.replace(/^Ajouter à /, '') + ' — valeur 1';
    expect(options(selectNomme(container, rangee)).sort()).toEqual([...APPARTENANCE].sort());
    await choisir(container, rangee, JOKER!);
    expect(dernier).toEqual([{ op: 'banish', onlyGroups: [JOKER] }]);

    const [narration] = Object.keys(valeursDe(banishNarrationSchema) ?? {}).slice(-1);
    const quoi = [...container.querySelectorAll<HTMLSelectElement>('select')].find((s) => [...s.options].some((o) => o.value === narration))!;
    expect(quoi).toBeDefined();
    await act(async () => {
      quoi.value = narration;
      quoi.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(dernier).toEqual([{ op: 'banish', onlyGroups: [JOKER], narration }]);
  });
});

describe('Condition `has` — la valeur se choisit dans le registre de `what`', () => {
  it('Groupe : le registre d’appartenance, jokers compris ; changer de `what` change de registre et vide la valeur', async () => {
    let dernier: Condition = { kind: 'has', who: 'target', what: 'group', value: '' };
    function Banc() {
      const [cond, setCond] = useState(dernier);
      return <ConditionEditor cond={cond} onChange={(c) => { dernier = c; setCond(c); }} />;
    }
    const { container } = monterRacine(<Banc />);
    const nomGroupe = libelleDeValeur(hasWhatSchema, 'group');
    expect(options(selectNomme(container, nomGroupe)).sort()).toEqual([...APPARTENANCE].sort());
    await choisir(container, nomGroupe, JOKER!);
    expect(dernier).toEqual({ kind: 'has', who: 'target', what: 'group', value: JOKER });

    const quoi = [...container.querySelectorAll<HTMLSelectElement>('select')].find((s) => [...s.options].some((o) => o.value === 'talent'))!;
    await act(async () => {
      quoi.value = 'talent';
      quoi.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(dernier).toEqual({ kind: 'has', who: 'target', what: 'talent', value: '' });
    expect(options(selectNomme(container, libelleDeValeur(hasWhatSchema, 'talent'))).sort()).toEqual([...idsDe('talent')].sort());
  });
});

describe('atelier du Codex — listes de Groupes', () => {
  type Entree = { id: string; grantGroups?: string[]; exceptGroups?: string[] };
  /** Monte l'atelier sur l'entrée `id` de `categorie`, ajoute une rangée à `champ`, y choisit `valeur`,
   *  enregistre, et rend les options offertes et l'entrée posée. */
  async function choisirAuCodex(categorie: string, ds: 'creatures' | 'groups', id: string, champ: string, valeur: string) {
    const { container } = monterRacine(<CodexEdit categoryKey={categorie} id={id} onClose={() => undefined} />);
    await cliquer(container, `Ajouter à ${champ}`);
    const offertes = options(selectNomme(container, `${champ} — valeur 1`));
    await choisir(container, `${champ} — valeur 1`, valeur);
    await act(async () => container.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!.click());
    return { offertes, posee: (datasetArray(ds) as Entree[]).find((e) => e.id === id)! };
  }

  it('`grantGroups` d’une créature (porteur) : les jokers ne sont pas offerts ; l’id est posé', async () => {
    const [modele] = datasetArray('creatures') as Entree[];
    const banc = { ...modele, id: 'creature-de-banc', grantGroups: [] };
    setDataset('creatures', [...datasetArray('creatures'), banc] as never);
    const { offertes, posee } = await choisirAuCodex('creatures', 'creatures', banc.id, 'Groupes accordés', DECLARABLE);
    expect([...offertes].sort()).toEqual([...DECLARABLES].sort());
    expect(posee.grantGroups).toEqual([DECLARABLE]);
  });

  it('`exceptGroups` d’un Groupe joker (cible) : le registre d’appartenance est offert, jokers compris, relatifs exclus ; l’id est posé', async () => {
    const banc = { id: 'joker-de-banc', type: 'groups', label: 'Joker de banc', matchesAll: true, exceptGroups: [] };
    setDataset('groups', [...datasetArray('groups'), banc] as never);
    const { offertes, posee } = await choisirAuCodex('groups', 'groups', banc.id, 'Groupes exclus', JOKER!);
    expect(offertes).toContain(JOKER);
    expect(offertes).not.toContain(RELATIF);
    expect(DECLARABLES.filter((g) => !offertes.includes(g))).toEqual([]);
    expect(posee.exceptGroups).toEqual([JOKER]);
  });
});
