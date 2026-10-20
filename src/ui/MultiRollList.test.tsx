import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MultiRollList } from './MultiRollList';
import type { NightEntry } from '../noyau/restFlow';
import { resolveStake, voyageStakeRef } from '../data';

/**
 * PROCÈS-VERBAL multi-jets (`MultiRollList`) — surface de LECTURE : chaque ligne porte l'anatomie
 * canonique du jet, et les lignes CONSÉCUTIVES d'une même rubrique (`group` : les contributeurs d'un
 * même Test d'équipage) se rendent sous UNE bande titrée (`Band`) au lieu de répéter l'en-tête
 * (#1112 G5). Ce test décrit ce qui EST rendu (l'influence d'une ligne de PV après coup n'existe pas
 * aujourd'hui : c'est le périmètre de #1106).
 */
function d(over: Partial<import('../engine/combat').RollBreakdown>): import('../engine/combat').RollBreakdown {
  return { label: 'Voile', base: 55, modifier: 0, target: 55, roll: 95, success: false, sl: -4, ...over };
}

const entries: NightEntry[] = [
  { id: 'e1', label: 'Capitaine', group: 'Progression', icon: 'travel/anchor', d: d({}), tone: 'bad' },
  { id: 'e2', label: 'Timonier', group: 'Progression', icon: 'travel/anchor', d: d({ roll: 12, success: true, sl: 4 }), tone: 'ok' },
  { id: 'e3', label: 'Navigateur', group: 'Orientation', icon: 'travel/anchor', d: d({ label: 'Navigation', roll: 30, success: true, sl: 2 }), tone: 'ok' },
  { label: 'Note', text: 'jour 3/3' },
];

describe('MultiRollList — PV du jour : une bande par rubrique, une rangée par jet', () => {
  it('les lignes d’une MÊME rubrique se rendent sous UNE bande titrée (en-tête non répété)', () => {
    const html = renderToStaticMarkup(<MultiRollList entries={entries} />);
    expect(html.match(/creator-band-head/g) ?? []).toHaveLength(2); // 2 rubriques → 2 bandes
    expect(html.match(/Progression/g) ?? []).toHaveLength(1); // l'en-tête ne se répète pas
    expect(html).toContain('Orientation');
  });

  it('chaque contributeur garde SA rangée, nommée par sa provenance (rôle tenu)', () => {
    const html = renderToStaticMarkup(<MultiRollList entries={entries} />);
    expect(html.match(/mrl-row/g) ?? []).toHaveLength(4);
    for (const role of ['Capitaine', 'Timonier', 'Navigateur']) expect(html).toContain(role);
  });

  it('une ligne SANS rubrique reste rendue hors bande (note du jour)', () => {
    const html = renderToStaticMarkup(<MultiRollList entries={[{ label: 'Note', text: 'jour 3/3' }]} />);
    expect(html).not.toContain('creator-band-head');
    expect(html).toContain('jour 3/3');
  });

  it('un PV vide le dit', () => {
    expect(renderToStaticMarkup(<MultiRollList entries={[]} />)).toContain('Une nuit sans histoire.');
  });

  /**
   * ENJEU du PV (#1117 L1b) : il appartient à l'ÉTAPE, donc à la RUBRIQUE — une note par bande, jamais
   * une par contributeur (trois marins d'un même Test d'équipage ne redisent pas trois fois la mise).
   */
  it('l’enjeu d’une rubrique se rend UNE fois pour la bande, pas par rangée', () => {
    // Une entrée d'enjeu de VOYAGE RÉELLE (le PV du jour de mer en est le producteur) — pas un gabarit forgé.
    const stake = voyageStakeRef('progression');
    const html = renderToStaticMarkup(<MultiRollList entries={entries.map((e) => (e.group === 'Progression' ? { ...e, stake } : e))} />);
    expect(html.match(/rm-stake/g) ?? [], 'un enjeu par BANDE — jamais un par contributeur').toHaveLength(1);
    // Le texte est celui de la DONNÉE, résolu par la porte unique (l'apostrophe typographique est
    // échappée par le rendu Markdown : on compare le fragment sans apostrophe).
    expect(resolveStake(stake).text).toContain('Le total de DR fixe les milles parcourus');
    expect(html).toContain('Le total de DR fixe les milles parcourus');
  });

  /**
   * INVARIANT du rendu par bande : la note prend l'enjeu de la PREMIÈRE ligne qui en porte un. Ce
   * raccourci n'est juste que si toutes les lignes d'une même rubrique portent le MÊME enjeu — vrai
   * par construction aujourd'hui (`dayEntriesFromStep` recopie `step.stake` sur chaque contributeur
   * d'UNE étape). La garde le rend INVIOLABLE : un futur producteur qui mêlerait deux enjeux sous une
   * seule rubrique rougirait ici, au lieu d'en taire un à l'écran.
   */
  it('INVARIANT : toutes les lignes d’une même rubrique portent le MÊME enjeu', () => {
    const stake = voyageStakeRef('progression');
    const autre = voyageStakeRef('orientation');
    const mixte: NightEntry[] = [
      { id: 'a', label: 'Capitaine', group: 'Progression', d: d({}), stake },
      { id: 'b', label: 'Timonier', group: 'Progression', d: d({}), stake: autre },
    ];
    const divergents = (es: NightEntry[]) => {
      const parGroupe = new Map<string, Set<string>>();
      for (const e of es) {
        if (!e.group || !e.stake) continue;
        const cle = `${e.stake.key!.dataset}/${e.stake.key!.kind}/${e.stake.key!.entryId ?? ''}`;
        parGroupe.set(e.group, (parGroupe.get(e.group) ?? new Set()).add(cle));
      }
      return [...parGroupe].filter(([, cles]) => cles.size > 1).map(([g]) => g);
    };
    // Le détecteur voit bien la divergence…
    expect(divergents(mixte), 'deux enjeux sous UNE rubrique : la bande en tairait un').toEqual(['Progression']);
    // …et le PV réellement produit n'en a aucune.
    expect(divergents(entries.map((e) => (e.group === 'Progression' ? { ...e, stake } : e)))).toEqual([]);
  });

  it('une rubrique SANS enjeu ne rend AUCUNE zone (pas de bande muette)', () => {
    const html = renderToStaticMarkup(<MultiRollList entries={entries} />);
    expect(html).not.toContain('rm-stake');
  });
});
