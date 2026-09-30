// @vitest-environment jsdom
/**
 * #2099 — l'éditeur de `Formula` est TOTAL sur la grammaire : chaque option de `formulaSchema`, de
 * `sinPointsSchema` et de `formulaSinSchema` a sa forme, son libellé, son résumé et son éditeur. Les
 * options sont ÉNUMÉRÉES sur le schéma zod, jamais recopiées. Le terme de Péché n'est offert que dans
 * le dialecte que le schéma du champ admet.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { z } from 'zod';
import { FormulaField, GameOpEditor, LIBELLE_DE_FORME, formulaForShape, formulaSummary, shapeOf, type DialecteDeFormule } from './GameOpEditor';
import type { Formula, GameOp } from '../../engine/ops';
import type { JsonFormula } from '../../engine/miscast';
import { admetLePeche, formulaSchema, formulaSinSchema, sinPointsSchema } from '../../data/schemas/grammaire/valeurs';
import { gameOpSchema } from '../../data/schemas/grammaire/mecanique';
import { defDe, enfantsDe } from '../../data/schemas/grammaire/descente';
import { noeudDeLEntree, noeudObjet } from '../../data/schemas/validate';
import { datasetArray } from '../../data/overrides';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement | undefined;
let root: Root | undefined;

function mount(node: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root!.render(node); });
}

function demonter() {
  if (root) act(() => { root!.unmount(); });
  container?.remove();
  root = undefined;
  container = undefined;
}

afterEach(demonter);

/** Options d'un nœud de `Formula` : les branches de ses unions, `lazy` déroulés. */
function optionsDe(noeud: unknown): unknown[] {
  const type = defDe(noeud)!.type;
  if (type === 'lazy' || type === 'union') return enfantsDe(noeud).flatMap((e) => optionsDe(e.noeud));
  return [noeud];
}

/** Valeur d'échantillon d'un nœud zod, construite sur sa définition. */
function echantillon(noeud: unknown): unknown {
  const def = defDe(noeud)!;
  const [premier] = enfantsDe(noeud);
  switch (def.type) {
    case 'number': return 1;
    case 'string': return 'x';
    case 'literal': return (def.values as unknown[])[0];
    case 'enum': return Object.values(def.entries!)[0];
    case 'lazy':
    case 'union': return echantillon(premier.noeud);
    case 'array': return [echantillon(premier.noeud), echantillon(premier.noeud)];
    case 'optional': return undefined;
    case 'object':
      return Object.fromEntries(enfantsDe(noeud)
        .filter((e) => e.cle !== undefined && defDe(e.noeud)!.type !== 'optional')
        .map((e) => [e.cle, echantillon(e.noeud)]));
    default:
      if (premier?.segment === '') return echantillon(premier.noeud);
      throw new Error(`échantillon : nœud zod non couvert (${def.type})`);
  }
}

const GRAMMAIRES: readonly { nom: string; schema: unknown; dialecte: DialecteDeFormule }[] = [
  { nom: 'formulaSchema', schema: formulaSchema, dialecte: 'general' },
  { nom: 'sinPointsSchema', schema: sinPointsSchema, dialecte: 'peche' },
  { nom: 'formulaSinSchema', schema: formulaSinSchema, dialecte: 'peche' },
];

const selecteurs = (): HTMLSelectElement[] => [...container!.querySelectorAll<HTMLSelectElement>('select.fml-shape')];
const formesOffertes = (s: HTMLSelectElement): string[] => [...s.options].map((o) => o.value);

describe('FormulaField — totalité sur la grammaire (#2099)', () => {
  for (const { nom, schema, dialecte } of GRAMMAIRES) {
    const options = optionsDe(schema);
    it(`${nom} : ${options.length} options énumérées au schéma`, () => {
      expect(options.length).toBeGreaterThan(0);
    });
    options.forEach((option, i) => {
      const brut = echantillon(option) as JsonFormula;
      it(`${nom} |${i} ${JSON.stringify(brut)} : forme, terme, résumé et éditeur`, () => {
        const forme = shapeOf(brut);
        expect(LIBELLE_DE_FORME[forme]).toBeTruthy();
        const terme = formulaForShape(forme, undefined);
        expect((option as z.ZodType).safeParse(terme).success, `formulaForShape('${forme}') rend ${JSON.stringify(terme)}, hors de l’option`).toBe(true);
        // Une référence (`{rule}`) n'a pas d'échantillon structurel valide : c'est le terme par défaut
        // de sa forme qui la représente.
        const v = (option as z.ZodType).safeParse(brut).success ? brut : terme;
        expect(() => formulaSummary(v)).not.toThrow();
        expect(formulaSummary(v)).not.toMatch(/undefined|NaN/);

        mount(<FormulaField label="Quantité" dialecte={dialecte} value={v} onChange={() => {}} />);
        const [racine] = selecteurs();
        expect(racine.value, `« ${LIBELLE_DE_FORME[forme]} » absent du sélecteur`).toBe(forme);
        expect(racine.selectedOptions[0].textContent).toBe(LIBELLE_DE_FORME[forme]);
        for (const s of selecteurs()) {
          expect(s.value, 'un sélecteur de forme ne porte aucune option pour sa valeur').not.toBe('');
          if (s.value === 'dice') expect(s.parentElement!.querySelector(':scope > .fml-dice'), '« Dés » sans champ').toBeTruthy();
        }
      });
    });
  }
});

/** Monte le champ, élit la forme `s` au sélecteur racine, rend la valeur émise. */
function emise(dialecte: DialecteDeFormule, depart: JsonFormula, s: string): unknown {
  let dernier: unknown = depart;
  mount(<FormulaField label="Durée" dialecte={dialecte} value={depart} onChange={(f) => { dernier = f; }} />);
  const [racine] = selecteurs();
  act(() => {
    racine.value = s;
    racine.dispatchEvent(new Event('change', { bubbles: true }));
  });
  demonter();
  return dernier;
}

describe('FormulaField — dialecte du Péché (#2099)', () => {
  const PECHE: JsonFormula = { sum: [{ dice: { n: 1, sides: 10 } }, { sinPoints: true }] };

  it('dialecte général : le Péché n’est offert à aucune position', () => {
    mount(<FormulaField label="Durée" value={{ sum: [{ dice: { n: 1, sides: 10 } }, 0] }} onChange={() => {}} />);
    for (const s of selecteurs()) expect(formesOffertes(s)).not.toContain('peche');
  });

  it('dialecte du Péché : offert en tête et aux termes de la somme, jamais sous un produit ni une borne', () => {
    mount(<FormulaField label="Durée" dialecte="peche" value={PECHE} onChange={() => {}} />);
    const [tete, t0, t1] = selecteurs();
    expect(formesOffertes(tete)).toContain('peche');
    expect(formesOffertes(t0)).toContain('peche');
    expect(t1.value).toBe('peche');
    demonter();
    mount(<FormulaField label="Durée" dialecte="peche" value={{ times: { of: 1, factor: 2 } }} onChange={() => {}} />);
    const [, of, factor] = selecteurs();
    expect(formesOffertes(of)).not.toContain('peche');
    expect(formesOffertes(factor)).not.toContain('peche');
  });

  it('chaque forme élue rend une valeur que le schéma de son dialecte accepte', () => {
    for (const [dialecte, schema, depart] of [
      ['general', formulaSchema, { sum: [{ dice: { n: 1, sides: 10 } }, 0] }],
      ['peche', formulaSinSchema, PECHE],
      ['peche', formulaSinSchema, { sinPoints: true }],
    ] as const) {
      const formes = Object.keys(LIBELLE_DE_FORME).filter((s) => s !== 'peche' || dialecte !== 'general');
      for (const s of formes) {
        const v = emise(dialecte, depart as JsonFormula, s);
        expect((schema as z.ZodType).safeParse(v).success, `${dialecte} : « ${s} » depuis ${JSON.stringify(depart)} rend ${JSON.stringify(v)}`).toBe(true);
      }
    }
  });

  /** Nœud de la liste `ops` d'une rangée de miscast — lu par le résolveur de l'atelier (`noeudDeLEntree`). */
  const opsDeMiscast = (): unknown =>
    enfantsDe(noeudDeLEntree('miscastMinor', datasetArray('miscastMinor')[0])).find((e) => e.cle === 'ops')?.noeud;

  it('le dialecte se DÉRIVE du schéma du champ : rangée de miscast oui, op ordinaire non', () => {
    expect(admetLePeche(opsDeMiscast())).toBe(true);
    expect(admetLePeche(gameOpSchema)).toBe(false);
    expect(admetLePeche(formulaSchema)).toBe(false);
  });

  /** Formes offertes par le `FormulaField` de libellé `libelle` (texte de tête de son `<label>`). */
  const formesDuChamp = (libelle: string): string[] => {
    const champ = [...container!.querySelectorAll('label.fml-field')].find((l) => l.firstChild?.textContent === libelle);
    expect(champ, `aucun champ « ${libelle} »`).toBeTruthy();
    return formesOffertes(champ!.querySelector<HTMLSelectElement>(':scope > .fml-row > select.fml-shape')!);
  };

  it('GameOpEditor : le dialecte est celui du CHAMP — Péché sur `value`/`amount` (formulaSinSchema), jamais sur `escapeStrength`', () => {
    const ops = [
      { op: 'condition', id: 'empetre', value: 1, escapeStrength: { times: { of: { dice: { n: 1, sides: 10 } }, factor: 10 } } },
      { op: 'wounds', amount: { sum: [{ dice: { n: 1, sides: 10 } }, { sinPoints: true }] } },
    ] as unknown as GameOp[];
    mount(<GameOpEditor noeud={opsDeMiscast()} ops={ops} onChange={() => {}} />);
    expect(formesDuChamp('Intensité'), 'Péché absent de `value`').toContain('peche');
    expect(formesDuChamp('Quantité'), 'Péché absent de `amount`').toContain('peche');
    expect(formesDuChamp('Force'), 'Péché offert sur `escapeStrength`').not.toContain('peche');
    demonter();
    mount(<GameOpEditor ops={ops} onChange={() => {}} />);
    expect(formesDuChamp('Intensité'), 'Péché offert sur une op ordinaire').not.toContain('peche');
  });

  /** Nœud d'un champ de l'op de rangée de miscast (liste `ops`, enveloppes `optional` déroulées). */
  const champDOpDeMiscast = (champ: string): z.ZodType => {
    const deroule = (n: unknown): unknown => (defDe(n)?.type === 'optional' ? deroule(enfantsDe(n)[0]?.noeud) : n);
    return deroule(enfantsDe(noeudObjet(opsDeMiscast())).find((e) => e.cle === champ)?.noeud) as z.ZodType;
  };

  it('GameOpEditor : chaque forme OFFERTE sur `escapeStrength` d’une rangée de miscast rend une valeur que le nœud du champ accepte', () => {
    const noeud = champDOpDeMiscast('escapeStrength');
    const depart = { times: { of: { dice: { n: 1, sides: 10 } }, factor: 10 } };
    const op = { op: 'condition', id: 'empetre', value: 1, escapeStrength: depart } as unknown as GameOp;
    mount(<GameOpEditor noeud={opsDeMiscast()} ops={[op]} onChange={() => {}} />);
    const formes = formesDuChamp('Force');
    demonter();
    expect(formes.length).toBeGreaterThan(1);
    const refusees = formes.flatMap((s) => {
      let emis: unknown = depart;
      mount(<GameOpEditor noeud={opsDeMiscast()} ops={[op]} onChange={(next) => { emis = (next[0] as { escapeStrength?: unknown }).escapeStrength; }} />);
      const champ = [...container!.querySelectorAll('label.fml-field')].find((l) => l.firstChild?.textContent === 'Force')!;
      const racine = champ.querySelector<HTMLSelectElement>(':scope > .fml-row > select.fml-shape')!;
      act(() => {
        racine.value = s;
        racine.dispatchEvent(new Event('change', { bubbles: true }));
      });
      demonter();
      return noeud.safeParse(emis).success ? [] : [`« ${s} » rend ${JSON.stringify(emis)}`];
    });
    expect(refusees, 'forme offerte que le schéma du champ refuse').toEqual([]);
  });

  it('Formula ordinaire : aucun terme de Péché dans un changement de forme', () => {
    const f: Formula = { dice: { n: 2, sides: 10 } };
    expect(formulaForShape('somme', { sinPoints: true })).toEqual({ sum: [{ dice: { n: 1, sides: 10 } }, 0] });
    expect(formulaForShape('minimum', PECHE)).toEqual({ minimum: 1, of: { dice: { n: 1, sides: 10 } } });
    expect(formulaForShape('somme', f)).toEqual({ sum: [f, 0] });
  });
});
