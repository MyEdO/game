// @vitest-environment jsdom
/**
 * Atelier du Codex — les capacités mécaniques (liste fermée) d'un Trait, d'une Qualité, d'un Symptôme
 * s'offrent TOUTES à la saisie, chacune sous le libellé que son schéma déclare (`nommerChamps`), posées
 * ou non ; une capacité cochée s'enregistre. Doctrine `user-doctrine-ids-stables-labels-affichage`.
 * Chaque champ s'offre sous le contrôle de son kind : « Ajouter une rangée » sur un nœud de liste
 * seulement, et une valeur saisie par le contrôle passe le schéma à l'enregistrement.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { z } from 'zod';

import { CodexEdit } from '../editor/codex/CodexEdit';
import { datasetArray, datasetSerializeRoot, setDataset } from '../../data/overrides';
import { DEFS_DE_DOCUMENT, validateDataset } from '../../data/schemas/validate';
import { descendre } from '../../data/schemas/grammaire/descente';
import { metaDesChamps } from '../../data/schemas/grammaire/meta';
import { admetUneListe, inferFields, offreDesRangees, videDuNoeud, type FieldDesc } from './editFields';
import { declarationDeFeuilleDId, estFeuilleDId, idsDeLaSousListe } from '../../data/schemas/grammaire/ref';
import { ouverts } from '../../data/schemas/grammaire/descente';
import { libelleDeDataset } from './RefField';
import { serializeDataset } from '../../data/serialize';
import { capacitesDe, PORTEURS_DE_CAPACITES } from './porteursDeCapacites.testkit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

type Porteur = { id: string; capabilities?: Record<string, unknown> };
const CHAMP = 'Capacités mécaniques (liste fermée)';

function monter(categoryKey: string, id: string) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<CodexEdit categoryKey={categoryKey} id={id} onClose={() => {}} />); });
}

/** Libellés de saisie des capacités BOOLÉENNES déclarées par le schéma. */
const libellesBooleens = (schema: z.ZodObject): string[] => {
  const meta = metaDesChamps(schema, { exigees: true });
  return Object.entries(schema.shape)
    .filter(([, n]) => (n instanceof z.ZodOptional ? n.unwrap() : n) instanceof z.ZodBoolean)
    .map(([k]) => meta[k].label);
};
const cases = () => new Map([...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
  .map((c) => [c.getAttribute('aria-label') ?? '', c] as const)
  .filter(([l]) => l.endsWith(` de ${CHAMP}`)));

const PORTEURS = PORTEURS_DE_CAPACITES.map(({ categorie, dataset, schema }) => ({ key: categorie, dataset, schema }));

describe('atelier du Codex — capacités mécaniques offertes sous leur libellé de saisie', () => {
  for (const { key, dataset, schema } of PORTEURS) {
    it(`${key} : chaque capacité booléenne du schéma a sa case sous son libellé, posée ou non`, () => {
      const p = (datasetArray(dataset) as Porteur[]).find((e) => Object.values(e.capabilities ?? {}).some((v) => v === true));
      expect(p, `aucune entrée de ${key} ne porte de capacité`).toBeTruthy();
      monter(key, p!.id);
      const attendus = libellesBooleens(schema).map((l) => `${l} de ${CHAMP}`);
      const offertes = [...cases().keys()];
      expect(offertes).toEqual(expect.arrayContaining(attendus));
      expect(offertes.filter((l) => Object.keys(schema.shape).some((k) => l.startsWith(`${k} `))), 'clé technique en libellé').toEqual([]);
    });
  }

  it('traits : une capacité non posée, cochée, s’enregistre', async () => {
    const avant = (datasetArray('traits') as Porteur[]).slice();
    try {
      monter('traits', 'champion');
      const libelle = metaDesChamps(capacitesDe('traits'), { exigees: true }).counterRequiresFastParry.label;
      const c = cases().get(`${libelle} de ${CHAMP}`)!;
      expect(c.checked).toBe(false);
      act(() => { c.click(); });
      await act(async () => { container.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!.click(); });
      const pose = (datasetArray('traits') as Porteur[]).find((t) => t.id === 'champion')!;
      expect(pose.capabilities).toMatchObject({ counterOnDefenseWin: true, counterRequiresFastParry: true });
    } finally {
      setDataset('traits', avant as never);
    }
  });
});

/** Champs de capacités, tels que l'atelier les infère au régime de profondeur. */
const champsDe = (schema: z.ZodObject): FieldDesc[] => inferFields([{}], { niveau: 'profondeur', noeud: schema });
const AJOUT_DE_RANGEE = 'Ajouter une rangée à ';
const rangeesOffertes = () => [...container.querySelectorAll('button')]
  .map((b) => b.getAttribute('aria-label') ?? '')
  .filter((l) => l.startsWith(AJOUT_DE_RANGEE) && l.endsWith(` de ${CHAMP}`))
  .map((l) => l.slice(AJOUT_DE_RANGEE.length, -` de ${CHAMP}`.length));
const saisir = (el: HTMLInputElement | HTMLSelectElement, v: string) => {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
};
const controle = (aria: string) => container.querySelector<HTMLInputElement | HTMLSelectElement>(`[aria-label="${aria}"]`);
const SCALAIRES: readonly FieldDesc['kind'][] = ['text', 'number', 'select'];
const LISTES: readonly FieldDesc['kind'][] = ['stringList', 'numberList'];

describe('atelier du Codex — Type psychologique d’un Trait, référence au catalogue des psychologies', () => {
  const f = () => champsDe(capacitesDe('traits')).find((c) => c.key === 'psychType')!;
  const options = (el: HTMLSelectElement) => [...el.options].filter((o) => o.value !== '' && !o.textContent!.endsWith('(inconnu)'));

  it('psychType se saisit par le sélecteur de `RefField`, ses options = la sous-liste de sa feuille `idDe`, sous le libellé du jeu de données', async () => {
    const feuille = declarationDeFeuilleDId(ouverts([f().noeud]).find(estFeuilleDId));
    expect(feuille?.type).toBe('psychology');
    const admis = idsDeLaSousListe(feuille!.type, feuille!.sousListe!);
    const psy = new Map((datasetArray('psychologies') as { id: string; label: string }[]).map((e) => [e.id, e.label]));
    const avant = (datasetArray('traits') as Porteur[]).slice();
    const porteur = avant.find((e) => e.capabilities?.psychType != null)!;
    try {
      monter('traits', porteur.id);
      const select = controle(`${f().label} de ${CHAMP}`) as HTMLSelectElement;
      expect(select).toBeInstanceOf(HTMLSelectElement);
      expect(select.closest('label.ed-field')?.querySelector('.ed-hint')?.textContent, 'indication du catalogue de `RefField`').toBe(` (${libelleDeDataset('psychologies')})`);
      expect(options(select).map((o) => o.value).sort()).toEqual([...admis].sort());
      for (const o of options(select)) expect(o.textContent, o.value).toBe(psy.get(o.value));
      const autre = admis.find((id) => id !== porteur.capabilities!.psychType)!;
      act(() => { saisir(select, autre); });
      await act(async () => { container.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!.click(); });
      expect([...container.querySelectorAll('.codex-edit-errors li')].map((l) => l.textContent)).toEqual([]);
      expect((datasetArray('traits') as Porteur[]).find((e) => e.id === porteur.id)!.capabilities!.psychType).toBe(autre);
    } finally {
      setDataset('traits', avant as never);
    }
  });

  it('psychType posé se VIDE : « — (aucun) — » offert, et l’enregistrement retire la clé', async () => {
    const avant = (datasetArray('traits') as Porteur[]).slice();
    const admis = idsDeLaSousListe('psychology', declarationDeFeuilleDId(ouverts([f().noeud]).find(estFeuilleDId))!.sousListe!);
    try {
      monter('traits', 'champion');
      const select = () => controle(`${f().label} de ${CHAMP}`) as HTMLSelectElement;
      act(() => { saisir(select(), admis[0]); });
      expect(select().value).toBe(admis[0]);
      const aucun = [...select().options].find((o) => o.value === '');
      expect(aucun?.textContent, 'option de vidage d’un champ optionnel posé').toBe('— (aucun) —');
      act(() => { saisir(select(), ''); });
      await act(async () => { container.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!.click(); });
      expect([...container.querySelectorAll('.codex-edit-errors li')].map((l) => l.textContent)).toEqual([]);
      // La forme DISQUE, celle qu'écrit l'enregistrement (`serializeDataset`).
      const racine = datasetSerializeRoot('traits');
      expect(validateDataset('traits.json', racine)).toBeNull();
      const disque = (JSON.parse(serializeDataset(racine)) as Porteur[]).find((e) => e.id === 'champion')!;
      expect('psychType' in (disque.capabilities ?? {}), 'clé psychType écrite').toBe(false);
    } finally {
      setDataset('traits', avant as never);
    }
  });

  it('un id hors catalogue, ou hors sous-liste (Frénésie, `frenzyCapable`), est refusé au parse', () => {
    const noeud = f().noeud as z.ZodType;
    expect(noeud.safeParse('psychologie-inexistante').success).toBe(false);
    expect(noeud.safeParse('frenesie').success).toBe(false);
  });
});

describe('inferFields — le vidable et la valeur vide se lisent sur le NŒUD du champ', () => {
  const champ = (noeud: z.ZodObject, entrees: Record<string, unknown>[]) => inferFields(entrees, { niveau: 'profondeur', noeud }).find((c) => c.key === 'k')!;

  it('un champ `.optional()` rempli sur TOUTES les entrées se vide, à `undefined`', () => {
    const c = champ(z.object({ k: z.string().optional() }), [{ k: 'a' }, { k: 'b' }]);
    expect(c.nullable).toBe(true);
    expect(videDuNoeud(c.noeud)).toBeUndefined();
  });

  it('un champ `.nullable()` seul se vide à `null`', () => {
    const c = champ(z.object({ k: z.string().nullable() }), [{ k: 'a' }]);
    expect(c.nullable).toBe(true);
    expect(videDuNoeud(c.noeud)).toBeNull();
  });

  it('un champ OBLIGATOIRE absent d’une entrée ne se vide pas : le schéma refuse l’absence', () => {
    expect(champ(z.object({ k: z.string() }), [{ k: 'a' }, {}]).nullable).toBe(false);
  });
});

describe('atelier du Codex — chaque capacité sous le contrôle de son kind', () => {
  for (const { key, dataset, schema } of PORTEURS) {
    it(`${key} : « Ajouter une rangée » n'est offert que sur un nœud de liste`, () => {
      const parLibelle = new Map(champsDe(schema).map((f) => [f.label, f]));
      // L'entrée qui porte le MOINS de capacités : chaque champ absent s'offre par le kind de son nœud.
      const e = (datasetArray(dataset) as Porteur[]).reduce((a, b) => (Object.keys(b.capabilities ?? {}).length < Object.keys(a.capabilities ?? {}).length ? b : a));
      monter(key, e.id);
      expect(rangeesOffertes().filter((l) => admetUneListe(parLibelle.get(l)?.noeud) !== true), `${e.id} : rangées offertes à un scalaire`).toEqual([]);
    });

    // Tout champ hors cases et sous-formulaires : son kind doit avoir un contrôle typé.
    for (const f of champsDe(schema).filter((c) => c.kind !== 'checkbox' && c.kind !== 'object')) {
      it(`${key} : « ${f.label} » (${f.kind}) saisi par son contrôle s'enregistre`, async () => {
        expect([...SCALAIRES, ...LISTES], `« ${f.label} » sans contrôle typé`).toContain(f.kind);
        const avant = (datasetArray(dataset) as Porteur[]).slice();
        const porteuse = avant.find((e) => e.capabilities?.[f.key] != null);
        const cible = avant.find((e) => e.capabilities && e.capabilities[f.key] === undefined);
        expect(porteuse && cible, `aucune paire porteuse/cible pour « ${f.label} » : la saisie ne mesure rien`).toBeTruthy();
        const v = porteuse!.capabilities![f.key];
        try {
          monter(key, cible!.id);
          const nom = `${f.label} de ${CHAMP}`;
          if (LISTES.includes(f.kind)) {
            (v as unknown[]).forEach((x, i) => {
              act(() => { controle(`Ajouter à ${nom}`)!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
              act(() => { saisir(controle(`${nom} — valeur ${i + 1}`)!, String(x)); });
            });
          } else {
            expect(controle(nom), `aucun contrôle « ${nom} »`).toBeTruthy();
            act(() => { saisir(controle(nom)!, String(v)); });
          }
          await act(async () => { container.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!.click(); });
          expect([...container.querySelectorAll('.codex-edit-errors li')].map((l) => l.textContent)).toEqual([]);
          expect((datasetArray(dataset) as Porteur[]).find((e) => e.id === cible!.id)!.capabilities![f.key]).toEqual(v);
        } finally {
          setDataset(dataset, avant as never);
        }
      });
    }
  }
});

describe('atelier du Codex — un champ déclaré absent ne s’offre en rangées que sur un nœud de liste', () => {
  it('tous les objets nommés des schémas de documents', () => {
    const vus = new Set<unknown>();
    let horsListe = 0;
    const fautifs: string[] = [];
    for (const d of DEFS_DE_DOCUMENT) {
      descendre([d.schema], ({ noeud, def }) => {
        if (def.type !== 'object' || vus.has(noeud) || !metaDesChamps(noeud)) return;
        vus.add(noeud);
        for (const f of inferFields([{}], { niveau: 'profondeur', noeud })) {
          if (f.kind !== 'json' || admetUneListe(f.noeud)) continue;
          horsListe++;
          if (offreDesRangees(f, undefined)) fautifs.push(`${d.file} ${f.key}`);
        }
      });
    }
    expect(horsListe, 'aucun champ JSON hors liste : la mesure ne porte sur rien').toBeGreaterThan(0);
    expect(fautifs).toEqual([]);
  });
});
