import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConditionEditor, WhenEditor, condSummary, recast } from './ConditionEditor';
import type { Condition } from '../../state/flow';
import { emptyNarratif } from '../../state/campaignNarratif';
import { libelleDeValeur, valeursDe } from '../../data/schemas/grammaire/meta';
import { actorFieldSchema, actorRefSchema, hasWhatSchema, partyWhoSchema, relationOrCampSchema, startleCauseSchema } from '../../data/schemas/grammaire/mecanique';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

describe('condSummary — résumé humain de l’algèbre de Condition', () => {
  it('rend chaque forme (flag / horaire / ET / OU / NON) en clair', () => {
    expect(condSummary({ kind: 'always' })).toBe('toujours');
    expect(condSummary({ kind: 'flag', expr: 'porte,!piege' })).toBe('porte,!piege');
    expect(condSummary({ kind: 'time', window: { afterHour: 20 } })).toContain('20:00');
    expect(condSummary({ kind: 'all', of: [{ kind: 'flag', expr: 'a' }, { kind: 'flag', expr: 'b' }] })).toBe('a ET b');
    expect(condSummary({ kind: 'any', of: [{ kind: 'flag', expr: 'cle' }, { kind: 'flag', expr: 'crochete' }] })).toBe('cle OU crochete');
    expect(condSummary({ kind: 'not', of: { kind: 'flag', expr: 'vu' } })).toBe('NON(vu)');
    expect(condSummary({ kind: 'hasItem', trappingId: 'Clé en fer' })).toContain('Clé en fer'); // custom → id brut affiché
    expect(condSummary({ kind: 'money', atLeast: { gold: 10 } })).toContain('10 CO');
    expect(condSummary({ kind: 'partyDead', who: 'any' })).toBe('un héros mort');
    expect(condSummary(undefined)).toBe('');
  });
});

describe('ConditionEditor — conditions d’état VIVANT (objet / bourse / mort)', () => {
  it('hasItem rend le LIBELLÉ de l’objet (id catalogue) + le compte', () => {
    const html = renderToStaticMarkup(<ConditionEditor cond={{ kind: 'hasItem', trappingId: 'corde', count: 2 }} onChange={() => {}} />);
    expect(html).toContain('value="Corde"'); // id 'corde' affiché par son libellé de catalogue
    expect(html).toContain('value="2"');
  });
  it('money rend les trois dénominations (CO/pa/sc)', () => {
    const html = renderToStaticMarkup(<ConditionEditor cond={{ kind: 'money', atLeast: { gold: 5 } }} onChange={() => {}} />);
    expect(html).toContain('CO');
    expect(html).toContain('value="5"');
  });
});

describe('ConditionEditor — conditions party-level (skill/career/species/status, #711)', () => {
  it('condSummary résume chaque nouveau kind', () => {
    expect(condSummary({ kind: 'skill', id: 'crochetage', who: 'any' })).toContain('crochetage');
    expect(condSummary({ kind: 'career', id: 'soldat', who: 'all' })).toContain('soldat');
    expect(condSummary({ kind: 'species', id: 'halflings', who: 'any' })).toContain('halflings');
    expect(condSummary({ kind: 'status', atLeast: 'Argent 2', who: 'any' })).toContain('Argent 2');
  });

  it('skill rend le sélecteur de Compétence + spec + seuil d’avances + who', () => {
    const html = renderToStaticMarkup(<ConditionEditor cond={{ kind: 'skill', id: 'crochetage', spec: 'Serrures', advances: 2, who: 'all' }} onChange={() => {}} />);
    expect(html).toContain('value="crochetage"');
    expect(html).toContain('value="Serrures"');
    expect(html).toContain('value="2"');
    expect(html).toContain('tout le groupe');
  });

  it('career rend le sélecteur de carrière', () => {
    const html = renderToStaticMarkup(<ConditionEditor cond={{ kind: 'career', id: 'soldat', who: 'any' }} onChange={() => {}} />);
    expect(html).toContain('value="soldat"');
  });

  it('species rend le sélecteur d’espèce', () => {
    const html = renderToStaticMarkup(<ConditionEditor cond={{ kind: 'species', id: 'halflings', who: 'any' }} onChange={() => {}} />);
    expect(html).toContain('value="halflings"');
  });

  it('status rend le champ atLeast', () => {
    const html = renderToStaticMarkup(<ConditionEditor cond={{ kind: 'status', atLeast: 'Argent 2', who: 'any' }} onChange={() => {}} />);
    expect(html).toContain('value="Argent 2"');
  });

  it('recast : même kind préservé (lossless), kind différent → défauts sains sans NaN', () => {
    const skill: Condition = { kind: 'skill', id: 'crochetage', who: 'all', advances: 3 };
    expect(recast(skill, 'skill')).toEqual(skill); // même kind = round-trip lossless
    expect(recast(skill, 'career')).toMatchObject({ kind: 'career', id: '', who: 'any' }); // défauts sains, aucun NaN/donnée fantôme
    expect(recast(recast(skill, 'status'), 'status')).toMatchObject({ kind: 'status', atLeast: 'Bronze 1' });
  });
});

describe('ConditionEditor — éditeur récursif de l’algèbre close', () => {
  it('un OU (any) rend ses sous-conditions + le bouton « + OU »', () => {
    const cond: Condition = { kind: 'any', of: [{ kind: 'flag', expr: 'cle' }, { kind: 'flag', expr: 'crochete' }] };
    const html = renderToStaticMarkup(<ConditionEditor cond={cond} onChange={() => {}} />);
    expect(html).toContain('+ OU'); // composition OU
    expect(html).toContain('value="cle"');
    expect(html).toContain('value="crochete"');
  });

  it('un NON enveloppe une sous-condition', () => {
    const html = renderToStaticMarkup(<ConditionEditor cond={{ kind: 'not', of: { kind: 'flag', expr: 'vu' } }} onChange={() => {}} />);
    expect(html).toContain('value="vu"');
    // le sélecteur de type propose bien NON
    expect(html).toContain('NON');
  });

  it('WhenEditor traite « Toujours » comme l’absence de condition (sélecteur sur always)', () => {
    const html = renderToStaticMarkup(<WhenEditor when={undefined} onChange={() => {}} />);
    expect(html).toContain('Toujours');
    expect(html).toContain('value="always"'); // le select est positionné sur « always »
  });
});

describe('#1318 E1 — le domaine du créneau horaire atteint le champ (cale de NumberField)', () => {
  it('les quatre champs d’heure/minute portent leurs bornes (0-23 / 0-59)', () => {
    const cond: Condition = { kind: 'time', window: { afterHour: 20, afterMinute: 30, beforeHour: 2, beforeMinute: 15 } };
    const html = renderToStaticMarkup(<ConditionEditor cond={cond} onChange={() => {}} />);
    expect(html.match(/max="23"/g)).toHaveLength(2);
    expect(html.match(/max="59"/g)).toHaveLength(2);
    expect(html.match(/min="0"/g)).toHaveLength(4);
  });
});


describe('#1694 B2 — les sélecteurs de Condition sont NOMMÉS par leur nœud de grammaire', () => {
  /** Chaque cas : la Condition rendue, et le nœud dont le `select` doit tirer options ET libellés. */
  const CAS: [string, Condition, unknown][] = [
    ['compare (who + field)', { kind: 'compare', subject: { who: 'target', field: 'woundsCurrent' }, op: '>=', value: 1 }, actorFieldSchema],
    ['compare (acteur)', { kind: 'compare', subject: { who: 'target', field: 'woundsCurrent' }, op: '>=', value: 1 }, actorRefSchema],
    ['relation', { kind: 'relation', who: 'target', is: 'ally' }, relationOrCampSchema],
    ['has', { kind: 'has', who: 'target', what: 'trait', value: 'mort-vivant' }, hasWhatSchema],
    ['startleCause', { kind: 'startleCause', is: 'noise' }, startleCauseSchema],
    ['partyDead', { kind: 'partyDead', who: 'any' }, partyWhoSchema],
  ];
  for (const [nom, cond, noeud] of CAS) {
    it(`${nom} : chaque option porte le libellé FR du nœud, aucun libellé au site`, () => {
      const valeurs = valeursDe(noeud);
      expect(valeurs, `le nœud de « ${nom} » n’est pas un enum NOMMÉ`).toBeDefined();
      const html = renderToStaticMarkup(<ConditionEditor cond={cond} onChange={() => {}} />);
      for (const [v, l] of Object.entries(valeurs!)) {
        expect(l, `${nom}/${v} : le libellé ne peut pas être la clé technique`).not.toBe(v);
        expect(html, `${nom} : l’option « ${v} » n’est pas rendue`).toContain(`value="${v}"`);
        expect(html, `${nom} : le libellé « ${l} » n’est pas rendu`).toContain(l.replace(/&/g, '&amp;').replace(/≠/g, '≠'));
      }
    });
  }

  it('le résumé humain d’une Condition lit les mêmes libellés que les sélecteurs', () => {
    expect(condSummary({ kind: 'relation', who: 'caster', is: 'opponent' }))
      .toBe(`${libelleDeValeur(actorRefSchema, 'caster')} : ${libelleDeValeur(relationOrCampSchema, 'opponent')}`);
    expect(condSummary({ kind: 'startleCause', is: 'magic' }))
      .toBe(`effarouché par ${libelleDeValeur(startleCauseSchema, 'magic')}`);
  });
});

describe('#1318 E1 — la largeur des champs nombre du bloc Condition vit dans le CSS, pas au site', () => {
  it('editor.css borne `.cond-time input[type=number]` à la largeur compacte d’atelier', () => {
    const css = readFileSync(fileURLToPath(new URL('../styles/editor.css', import.meta.url)), 'utf8');
    expect(css).toMatch(/\.cond-time input\[type='number'\][^{]*\{[^}]*width:\s*44px/);
  });
});

describe('ConditionEditor — états de campagne (#2539) : offre par USAGE de la forme, libellés résolus', () => {
  const narratif = {
    ...emptyNarratif(),
    etats: [
      { id: 'sosie', label: 'Le sosie', source: { book: 'ennemi-dans-l-ombre', page: 26, note: 'EDO 02 l.91' }, forme: { kind: 'heros' as const } },
      { id: 'issue', label: 'Issue du procès', source: { book: 'ennemi-dans-l-ombre', page: 17, note: 'EDO 01 l.241' }, forme: { kind: 'enum' as const, valeurs: [{ id: 'condamne', label: 'Condamné' }] } },
    ],
  };
  const options = (html: string, aria: string): string[] => {
    const select = html.split(`aria-label="${aria}"`)[1]?.split('</select>')[0] ?? '';
    return [...select.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]);
  };

  it('le sélecteur de héros n’offre que les états qui admettent la sélection ; la valeur comparée, que ceux qui admettent la comparaison', () => {
    expect(options(renderToStaticMarkup(<ConditionEditor cond={{ kind: 'partyDead', who: 'any' }} narratif={narratif} onChange={() => {}} />), 'Héros visé'))
      .toEqual([...Object.keys(valeursDe(partyWhoSchema) ?? {}), 'etat:sosie']);
    expect(renderToStaticMarkup(<ConditionEditor cond={{ kind: 'etat', etat: 'sosie' }} narratif={narratif} onChange={() => {}} />)).not.toContain('Valeur comparée');
    expect(options(renderToStaticMarkup(<ConditionEditor cond={{ kind: 'etat', etat: 'issue' }} narratif={narratif} onChange={() => {}} />), 'Valeur comparée'))
      .toEqual(['', 'condamne']);
  });

  it('sans narratif (racine de catalogue), aucun état n’est offert', () => {
    expect(options(renderToStaticMarkup(<ConditionEditor cond={{ kind: 'partyDead', who: 'any' }} onChange={() => {}} />), 'Héros visé'))
      .toEqual(Object.keys(valeursDe(partyWhoSchema) ?? {}));
  });

  it('condSummary nomme l’état et la valeur par leur LIBELLÉ', () => {
    expect(condSummary({ kind: 'etat', etat: 'issue', value: 'condamne' }, narratif)).toBe('état « Issue du procès » = Condamné');
    expect(condSummary({ kind: 'partyDead', who: { etat: 'sosie' } }, narratif)).toBe('héros désigné « Le sosie » mort');
  });
});
