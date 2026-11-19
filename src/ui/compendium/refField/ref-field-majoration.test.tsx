// @vitest-environment jsdom
/**
 * #4346 — Les Qualités d'un objet du catalogue s'éditent au Compendium par la route du Codex (`refFieldCfg`, nœud
 * inféré comme `CodexEdit`) : la majoration d'une munition (« Recharge +2 » du grappin) s'y lit, s'y modifie et
 * s'enregistre (`enregistrerEntree`) ; l'Indice et le « +N » d'une rangée s'excluent.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act, useState } from 'react';
import { RefField, refFieldCfg } from './RefField';
import { editableEntries, enregistrerEntree } from '../../../data/atelierDuCodex';
import { inferFields } from '../../../noyau/codex/editFields';
import { noeudDeLEntree } from '../../../data/schemas/validate';
import { ouverts } from '../../../data/schemas/grammaire/descente';
import { metaDesChamps } from '../../../data/schemas/grammaire/meta';
import { monterRacine, demonterRacines } from '../../../monterRacine.testkit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(demonterRacines);

type Entree = Record<string, unknown> & { id: string; qualities: Record<string, unknown>[] };

/** Le champ `qualities` de l'entrée `id` des trappings, tel que `CodexEdit` le route, monté avec son état. */
function monterQualites(id: string) {
  const entrees = editableEntries('trappings') as Entree[];
  const index = entrees.findIndex((e) => e.id === id);
  const entree = entrees[index];
  const noeud = noeudDeLEntree('trappings', entree);
  const meta = ouverts([noeud]).map(metaDesChamps).find((m) => m !== undefined);
  const champ = inferFields(entrees, { meta, noeud }).find((f) => f.key === 'qualities')!;
  const cfg = refFieldCfg('trappings', 'qualities')!;
  const etat: { qualites: unknown } = { qualites: entree.qualities };
  function Hote() {
    const [qualites, setQualites] = useState<unknown>(entree.qualities);
    return <RefField cfg={cfg} categoryKey="trappings" fieldKey="qualities" label={champ.label} noeud={champ.noeud} value={qualites}
      onChange={(v) => { etat.qualites = v; setQualites(v); }} />;
  }
  const { container } = monterRacine(<Hote />);
  const champNomme = (debut: string, rangee: number) => {
    const el = [...container.querySelectorAll('input')].find((i) => i.getAttribute('aria-label')?.startsWith(debut) && i.getAttribute('aria-label')!.endsWith(`valeur ${rangee + 1}`));
    if (!el) throw new Error(`champ « ${debut} … valeur ${rangee + 1} » introuvable`);
    return el;
  };
  return { entree, index, etat, indice: (r: number) => champNomme('Indice — ', r), plus: (r: number) => champNomme('majoration — ', r) };
}

async function saisir(el: HTMLInputElement, valeur: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(el, valeur);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('Compendium — Qualités majorées d’une munition', () => {
  it('le grappin : Recharge +2 affiché, porté à +3, enregistré sans Indice', async () => {
    const q = monterQualites('grappin-munition');
    const rangee = q.entree.qualities.findIndex((r) => r.id === 'recharge');
    expect(q.plus(rangee).value).toBe('2');
    expect(q.indice(rangee).value).toBe('');
    await saisir(q.plus(rangee), '3');
    const qualites = q.etat.qualites as Record<string, unknown>[];
    expect(qualites[rangee]).toStrictEqual({ id: 'recharge', majoration: 3 });
    // L'enregistrement et sa reprise notifient le dataset au champ monté : sous `act`.
    let issue!: ReturnType<typeof enregistrerEntree>;
    act(() => { issue = enregistrerEntree('trappings', { ...q.entree, qualities: qualites }, q.index); });
    expect(issue.ok ? issue.texte : issue.erreurs).toEqual(expect.stringContaining('"majoration": 3'));
    if (issue.ok) act(issue.reprendre);
  });

  it('l’Indice et le « +N » s’excluent : poser l’un ôte l’autre', async () => {
    const q = monterQualites('grappin-munition');
    const rangee = q.entree.qualities.findIndex((r) => r.id === 'recharge');
    await saisir(q.indice(rangee), '4');
    expect((q.etat.qualites as unknown[])[rangee]).toStrictEqual({ id: 'recharge', value: 4 });
    expect(q.plus(rangee).value).toBe('');
    await saisir(q.plus(rangee), '1');
    expect((q.etat.qualites as unknown[])[rangee]).toStrictEqual({ id: 'recharge', majoration: 1 });
    expect(q.indice(rangee).value).toBe('');
  });
});
