// @vitest-environment jsdom
/**
 * Effet `giveTrapping` à l'éditeur (#1988) : un SÉLECTEUR, jamais une saisie libre — options = objets du
 * PROJET édité (`Ctx.objets`) puis du catalogue qu'admet la feuille (`giveTrappingSchema.shape.trappingId`),
 * jamais ceux de la campagne jouée. Les qualités ajoutées se choisissent au catalogue des qualités
 * (`REF_FIELD.qualities`, mode liste) et s'écrivent `{ id, value? }` (`qualityRefSchema`).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EffectFields, effectSummary, type Ctx } from './EffectList';
import { CIBLES_D_EFFET_DE_SCENE } from '../../state/combatEffects';
import { trappings, qualities, type TrappingData } from '../../data';
import { dansLaSousListe, idsDeLaSousListe } from '../../data/schemas/grammaire/ref';
import { DONNABLE } from '../../data/schemas/grammaire/sousListes';
import type { Effect } from '../../state/scene';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const OBJET_DU_PROJET: TrappingData = { ...trappings.find((t) => t.id === 'dague')!, id: 'projet-sceau-du-comte', label: 'Sceau du comte' };
const SERVICE = trappings.find((t) => !dansLaSousListe(DONNABLE, t))!;
const ctx = (objets: readonly TrappingData[]): Ctx => ({ encounters: [], dialogues: [], cibles: CIBLES_D_EFFET_DE_SCENE, objets });
const DON = { type: 'giveTrapping', trappingId: 'dague' } as Effect;

/** Monte l'Effet ; rend ce que `lire(host)` observe AVANT `geste(host)`, puis les émissions du geste. */
function monte<T>(effet: Effect, objets: readonly TrappingData[], lire: (host: HTMLElement) => T, geste: (host: HTMLElement) => void = () => {}) {
  const emis: Effect[] = [];
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    act(() => { root.render(<EffectFields effect={effet} ctx={ctx(objets)} onChange={(e) => { emis.push(e); }} /> as ReactElement); });
    const lu = lire(host);
    act(() => geste(host));
    return { emis, lu };
  } finally {
    act(() => { root.unmount(); });
    host.remove();
  }
}

const selecteurDObjet = (host: HTMLElement) => host.querySelector<HTMLSelectElement>('select[aria-label="Objet donné"]')!;
const libellesOfferts = (host: HTMLElement) => [...selecteurDObjet(host).options].filter((o) => o.value !== '').map((o) => o.textContent ?? '');
const choisir = (select: HTMLSelectElement, valeur: string) => {
  select.value = valeur;
  select.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('Effet `giveTrapping` — sélecteur d’objet', () => {
  it('les options sont les objets du projet admis, puis les libellés des ids admis par la feuille (aucun tarif de service)', () => {
    const admis = new Set(idsDeLaSousListe('trapping', DONNABLE));
    const catalogue = trappings.filter((t) => admis.has(t.id)).map((t) => t.label);
    expect(monte(DON, [], libellesOfferts).lu.sort()).toEqual([...catalogue].sort());
    expect(monte(DON, [OBJET_DU_PROJET], libellesOfferts).lu.sort()).toEqual([...catalogue, OBJET_DU_PROJET.label].sort());
    expect(monte(DON, [{ ...OBJET_DU_PROJET, service: true }], libellesOfferts).lu).not.toContain(OBJET_DU_PROJET.label);
    expect(monte(DON, [], libellesOfferts).lu).not.toContain(SERVICE.label);
  });

  it('aucune saisie libre : le champ objet est un `<select>`, sans `<input list>`', () => {
    const { lu } = monte(DON, [OBJET_DU_PROJET], (host) => ({ select: !!selecteurDObjet(host), libre: host.querySelectorAll('input[list]').length }));
    expect(lu).toEqual({ select: true, libre: 0 });
  });

  it('choisir un objet du PROJET écrit son `trappingId`', () => {
    const { emis } = monte(DON, [OBJET_DU_PROJET], () => undefined, (host) => choisir(selecteurDObjet(host), OBJET_DU_PROJET.id));
    expect(emis.slice(-1)[0]).toMatchObject({ trappingId: OBJET_DU_PROJET.id, creatureId: undefined });
    expect('custom' in emis.slice(-1)[0]).toBe(false);
  });

  it('un `trappingId` stocké s’affiche par son libellé — objet du projet comme du catalogue', () => {
    const affiche = (host: HTMLElement) => selecteurDObjet(host).selectedOptions[0]?.textContent;
    expect(monte({ type: 'giveTrapping', trappingId: OBJET_DU_PROJET.id } as Effect, [OBJET_DU_PROJET], affiche).lu).toBe(OBJET_DU_PROJET.label);
    expect(monte(DON, [], affiche).lu).toBe(trappings.find((t) => t.id === 'dague')!.label);
  });
});

describe('Effet `giveTrapping` — qualités ajoutées, choisies au catalogue', () => {
  const QUALITE = qualities.find((q) => q.id === 'magique')!;
  const selecteurDeQualite = (host: HTMLElement) =>
    [...host.querySelectorAll<HTMLSelectElement>('select')].find((s) => [...s.options].some((o) => o.value === QUALITE.id))!;

  it('le choix d’une qualité écrit `{ id }` — jamais un texte', () => {
    const { emis } = monte({ ...DON, qualities: [{ id: '' }] } as Effect, [], () => undefined, (host) => choisir(selecteurDeQualite(host), QUALITE.id));
    expect(emis.slice(-1)[0]).toMatchObject({ qualities: [{ id: QUALITE.id }] });
  });

  it('l’Indice d’une qualité ajoutée s’écrit `value`', () => {
    const { emis } = monte({ ...DON, qualities: [{ id: QUALITE.id }] } as Effect, [], () => undefined, (host) => {
      const champ = host.querySelector<HTMLInputElement>('input[aria-label="Indice — Qualités magiques ajoutées"]')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, '2');
      champ.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(emis.slice(-1)[0]).toMatchObject({ qualities: [{ id: QUALITE.id, value: 2 }] });
  });

  it('retirer la dernière qualité efface le champ', () => {
    const { emis } = monte({ ...DON, qualities: [{ id: QUALITE.id }] } as Effect, [], () => undefined, (host) => {
      host.querySelector<HTMLButtonElement>('button[title="Retirer"]')!.click();
    });
    const dernier = emis.slice(-1)[0] as Extract<Effect, { type: 'giveTrapping' }>;
    expect(dernier.qualities).toBeUndefined();
  });
});

describe('en-tête replié de l’Effet — même chaîne que le champ', () => {
  it('un objet du projet s’y nomme par son LIBELLÉ, un objet du catalogue aussi', () => {
    expect(effectSummary({ type: 'giveTrapping', trappingId: OBJET_DU_PROJET.id } as Effect, ctx([OBJET_DU_PROJET]))).toBe(`Objet : ${OBJET_DU_PROJET.label}`);
    expect(effectSummary(DON, ctx([]))).toBe(`Objet : ${trappings.find((t) => t.id === 'dague')!.label}`);
  });
});
