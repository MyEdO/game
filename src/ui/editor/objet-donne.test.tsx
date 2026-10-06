// @vitest-environment jsdom
/**
 * Effet `giveTrapping` à l'éditeur (#1988) : options = objets du PROJET édité (`Ctx.narratif.objets`) puis du
 * catalogue qu'admet la feuille (`giveTrappingSchema.shape.trappingId`) ; la saisie, par id OU par
 * libellé, se résout dans ce même univers, entrées refusées comprises — jamais par la campagne jouée.
 * Résolue hors de `INSTANCIABLE_PAR_ID` : refus affiché, rien d'écrit ; non résolue : `custom`.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EffectFields, effectSummary, type Ctx } from './EffectList';
import { RefField } from '../compendium/RefField';
import { CIBLES_D_EFFET_DE_SCENE } from '../../state/combatEffects';
import { trappings, type TrappingData } from '../../data';
import { dansLaSousListe, idsDeLaSousListe } from '../../data/schemas/grammaire/ref';
import { INSTANCIABLE_PAR_ID } from '../../data/schemas/grammaire/sousListes';
import type { Effect } from '../../state/scene';
import { emptyNarratif } from '../../state/campaignNarratif';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const OBJET_DU_PROJET: TrappingData = { ...trappings.find((t) => t.id === 'dague')!, id: 'projet-sceau-du-comte', label: 'Sceau du comte' };
const SERVICE = trappings.find((t) => !dansLaSousListe(INSTANCIABLE_PAR_ID, t))!;
const ctx = (objets: readonly TrappingData[]): Ctx => ({ encounters: [], dialogues: [], cibles: CIBLES_D_EFFET_DE_SCENE, narratif: { ...emptyNarratif(), objets: [...objets] } });
const effetVide = { type: 'giveTrapping', custom: '' } as Effect;

/** Monte `rendu` le temps de `lire(host)` — démonté et retiré du document ensuite. */
function monte<T>(rendu: ReactElement, lire: (host: HTMLElement) => T): T {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    act(() => { root.render(rendu); });
    return lire(host);
  } finally {
    act(() => { root.unmount(); });
    host.remove();
  }
}

/** Les libellés de la datalist que le DOCUMENT résout pour ce champ (le premier élément de cet id). */
const optionsResolues = (champ: HTMLInputElement): string[] =>
  [...(document.getElementById(champ.getAttribute('list')!)?.querySelectorAll('option') ?? [])].map((o) => (o as HTMLOptionElement).value);

/** Monte l'Effet, saisit `texte` dans le champ objet ; rend les émissions, le refus, l'affichage et les options. */
function saisir(texte: string, objets: readonly TrappingData[] = [], effet: Effect = effetVide) {
  const emis: Effect[] = [];
  return monte(<EffectFields effect={effet} ctx={ctx(objets)} onChange={(e) => { emis.push(e); }} />, (host) => {
    const champ = host.querySelector<HTMLInputElement>('input[list]')!;
    const affiche = champ.value;
    const options = optionsResolues(champ);
    if (texte) {
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, texte);
        champ.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    const refus = host.querySelector('[role="status"]')?.textContent ?? null;
    return { emis, refus, invalide: champ.getAttribute('aria-invalid'), options, affiche };
  });
}

const REFUS_DU_SERVICE = `« ${SERVICE.id} » porte le marqueur « service » : cette référence l'exclut du catalogue des objets (trappings.json).`;

describe('Effet `giveTrapping` — sélecteur d’objet', () => {
  it('les options sont les objets du projet admis, puis les libellés des ids admis par la feuille (aucun tarif de service)', () => {
    const admis = new Set(idsDeLaSousListe('trapping', INSTANCIABLE_PAR_ID));
    const catalogue = trappings.filter((t) => admis.has(t.id)).map((t) => t.label);
    expect(saisir('').options.sort()).toEqual([...catalogue].sort());
    expect(saisir('', [OBJET_DU_PROJET]).options.sort()).toEqual([...catalogue, OBJET_DU_PROJET.label].sort());
    expect(saisir('', [{ ...OBJET_DU_PROJET, service: true }]).options).not.toContain(OBJET_DU_PROJET.label);
    expect(saisir('').options).not.toContain(SERVICE.label);
  });

  it.each([['id', SERVICE.id], ['libellé', SERVICE.label]])('un service saisi par %s : refus VISIBLE, rien d’écrit (jamais un `custom` silencieux)', (_par, texte) => {
    const { emis, refus, invalide } = saisir(texte);
    expect(emis).toEqual([]);
    expect(refus).toBe(REFUS_DU_SERVICE);
    expect(invalide).toBe('true');
  });

  it.each([['id', OBJET_DU_PROJET.id], ['libellé', OBJET_DU_PROJET.label]])('un objet du PROJET saisi par %s se résout en `trappingId`', (_par, texte) => {
    expect(saisir(texte, [OBJET_DU_PROJET]).emis.slice(-1)[0]).toMatchObject({ trappingId: OBJET_DU_PROJET.id, custom: undefined });
  });

  it.each([['id', OBJET_DU_PROJET.id], ['libellé', OBJET_DU_PROJET.label]])('un objet du projet marqué `service`, saisi par %s, est refusé comme un tarif du catalogue', (_par, texte) => {
    const { emis, refus } = saisir(texte, [{ ...OBJET_DU_PROJET, service: true }]);
    expect(emis).toEqual([]);
    expect(refus).toMatch(/porte le marqueur « service »/);
  });

  it.each([['id', OBJET_DU_PROJET.id], ['libellé', OBJET_DU_PROJET.label]])('sans objet du projet, la saisie par %s devient un objet `custom`', (_par, texte) => {
    expect(saisir(texte).emis.slice(-1)[0]).toMatchObject({ custom: texte, trappingId: undefined });
  });

  it('un `trappingId` stocké s’affiche par son libellé — objet du projet comme du catalogue', () => {
    expect(saisir('', [OBJET_DU_PROJET], { type: 'giveTrapping', trappingId: OBJET_DU_PROJET.id } as Effect).affiche).toBe(OBJET_DU_PROJET.label);
    expect(saisir('', [], { type: 'giveTrapping', trappingId: 'dague' } as Effect).affiche).toBe(trappings.find((t) => t.id === 'dague')!.label);
  });
});

describe('une datalist par instance de champ libre', () => {
  it('monté avec un champ libre du catalogue entier, l’Effet résout SA datalist : aucun service proposé', () => {
    const { listes, effet, libre } = monte(
      <>
        <RefField cfg={{ ds: 'trappings', freeText: true }} value="" onChange={() => {}} />
        <EffectFields effect={effetVide} ctx={ctx([])} onChange={() => {}} />
      </>,
      (host) => {
        const [champLibre, champEffet] = [...host.querySelectorAll<HTMLInputElement>('input[list]')];
        return { listes: new Set([champLibre, champEffet].map((c) => c.getAttribute('list'))).size, libre: optionsResolues(champLibre), effet: optionsResolues(champEffet) };
      },
    );
    expect(listes).toBe(2);
    expect(libre).toContain(SERVICE.label);
    expect(effet).not.toContain(SERVICE.label);
  });
});

describe('en-tête replié de l’Effet — même chaîne que le champ', () => {
  it('un objet du projet s’y nomme par son LIBELLÉ, un objet du catalogue aussi', () => {
    expect(effectSummary({ type: 'giveTrapping', trappingId: OBJET_DU_PROJET.id } as Effect, ctx([OBJET_DU_PROJET]))).toBe(`Objet : ${OBJET_DU_PROJET.label}`);
    expect(effectSummary({ type: 'giveTrapping', trappingId: 'dague' } as Effect, ctx([]))).toBe(`Objet : ${trappings.find((t) => t.id === 'dague')!.label}`);
  });
});
