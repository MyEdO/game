// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EffectList, EffectFields, effectSummary, newEffect, EFFECT_MENU_GROUPS, EFFECT_LABEL, ctxDeCatalogue, effectCtxOf } from './EffectList';
import { FlowEditor } from './FlowEditor';
import { EMPTY_FLOW } from '../../state/flow';
import { emptyNarratif, type NarratifBlock } from '../../state/campaignNarratif';
import { convertTo } from './AddMenu';
import { choisirDansMenu, entreeDe, menuDe, ouvrirMenu } from './AddMenu.testkit';
import type { Effect } from '../../state/scene';
import { CIBLES_D_EFFET_DE_SCENE } from '../../state/combatEffects';
import { talents } from '../../data';
import { DAY_PHASES } from '../../engine/clock';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const ctx = { encounters: [], dialogues: [], cibles: CIBLES_D_EFFET_DE_SCENE };

describe('EffectList — Effet setTime (jour/nuit via trigger, #T1c)', () => {
  it('newEffect("setTime") crée un défaut phase nuit', () => {
    expect(newEffect('setTime')).toEqual({ type: 'setTime', phase: 'nuit' });
  });
  it('un Effet setTime rend un sélecteur de phase (les 7 phases)', () => {
    const effects: Effect[] = [{ type: 'setTime', phase: 'nuit' } as Effect];
    const html = renderToStaticMarkup(<EffectList effects={effects} onChange={() => {}} ctx={ctx} />);
    expect(html).toMatch(/Régler l’heure sur/);
    expect(html).toContain('Nuit');
    expect(html).toContain('Aube');
  });
  it('une option de phase ne porte que son libellé : l’id d’icône n’est jamais écrit en texte', () => {
    const effects: Effect[] = [{ type: 'setTime', phase: 'nuit' } as Effect];
    const html = renderToStaticMarkup(<EffectList effects={effects} onChange={() => {}} ctx={ctx} />);
    for (const p of DAY_PHASES) expect(html).not.toContain(p.icon);
  });
});

describe('selects guidés (audit M9) — fini les ids à taper', () => {
  it('learnSpell : sorts de la base en optgroups (plus de « libellé exact »)', () => {
    const html = renderToStaticMarkup(
      <EffectList effects={[{ type: 'learnSpell', spell: '', heroId: '' }]} onChange={() => {}} ctx={{ encounters: [], dialogues: [], cibles: CIBLES_D_EFFET_DE_SCENE }} />,
    );
    expect(html).toContain('<optgroup');
    expect(html).toContain('Fléchette');
    expect(html).not.toContain('Libellé exact');
  });

  it('transition : scènes du projet + points d’entrée quand le contexte les fournit', () => {
    const ctx = {
      encounters: [], dialogues: [], cibles: CIBLES_D_EFFET_DE_SCENE,
      scenes: [
        { id: 'sc-a', nom: 'Village', entries: [] },
        { id: 'sc-b', nom: 'Taverne', entries: ['porte', 'cave'] },
      ],
    };
    const html = renderToStaticMarkup(
      <EffectList effects={[{ type: 'transition', scene: 'sc-b', entry: '' }]} onChange={() => {}} ctx={ctx} />,
    );
    expect(html).toContain('Village (sc-a)');
    expect(html).toContain('Taverne (sc-b)');
    expect(html).toContain('porte'); // points d'entrée de la scène choisie
    expect(html).not.toContain('id de la scène cible');
  });

  it('openMerchant : entités marchandes de la scène (ou explication si aucune)', () => {
    const withM = renderToStaticMarkup(
      <EffectList effects={[{ type: 'openMerchant', entityId: '' }]} onChange={() => {}}
        ctx={{ encounters: [], dialogues: [], cibles: CIBLES_D_EFFET_DE_SCENE, merchants: [{ id: 'armurier', label: 'Maître armurier' }] }} />,
    );
    expect(withM).toContain('Maître armurier (armurier)');
    const without = renderToStaticMarkup(
      <EffectList effects={[{ type: 'openMerchant', entityId: '' }]} onChange={() => {}}
        ctx={{ encounters: [], dialogues: [], cibles: CIBLES_D_EFFET_DE_SCENE, merchants: [] }} />,
    );
    expect(without).toContain('Aucune entité marchande');
  });
});

describe('#94 — Effets santé éditables (ambitionLost/inflictThirst/inflictPsychology)', () => {
  it('ambitionLost : champ héros rendu (modèle inflictNightmares)', () => {
    const html = renderToStaticMarkup(
      <EffectList effects={[{ type: 'ambitionLost', heroId: '' }]} onChange={() => {}} ctx={ctx} />,
    );
    expect(html).toMatch(/id du héros/);
  });

  it('inflictThirst : cible + jours (modèle inflictHunger)', () => {
    const html = renderToStaticMarkup(
      <EffectList effects={[{ type: 'inflictThirst', days: 2, target: 'party' }]} onChange={() => {}} ctx={ctx} />,
    );
    expect(html).toMatch(/Jours assoiffés/);
    expect(html).toContain('Tout le groupe');
  });

  it('inflictPsychology : kind/indice/label/cible rendus', () => {
    const html = renderToStaticMarkup(
      <EffectList effects={[{ type: 'inflictPsychology', kind: 'terreur', indice: 2, label: 'Un spectre hurlant', target: 'party' }]} onChange={() => {}} ctx={ctx} />,
    );
    expect(html).toContain('Terreur');
    expect(html).toMatch(/Indice/);
  });

  it('openPort : fallback texte quand le contexte ne fournit pas de carte du monde', () => {
    const html = renderToStaticMarkup(
      <EffectList effects={[{ type: 'openPort', placeId: '' }]} onChange={() => {}} ctx={ctx} />,
    );
    expect(html).toMatch(/id du lieu/);
  });

  it('openPort : lieux de la carte du monde (ou explication si aucun)', () => {
    const withP = renderToStaticMarkup(
      <EffectList effects={[{ type: 'openPort', placeId: '' }]} onChange={() => {}}
        ctx={{ encounters: [], dialogues: [], cibles: CIBLES_D_EFFET_DE_SCENE, places: [{ id: 'port-marienburg', label: 'Marienburg' }] }} />,
    );
    expect(withP).toContain('Marienburg (port-marienburg)');
    expect(withP).not.toMatch(/id du lieu/);
    const without = renderToStaticMarkup(
      <EffectList effects={[{ type: 'openPort', placeId: '' }]} onChange={() => {}}
        ctx={{ encounters: [], dialogues: [], cibles: CIBLES_D_EFFET_DE_SCENE, places: [] }} />,
    );
    expect(without).toContain('Aucun lieu sur la carte du monde');
  });
});

describe('changer le type d’un effet CONVERTIT — un seul vocabulaire, un seul geste', () => {
  it('les champs que le type visé connaît aussi gardent leur valeur (fonction pure)', () => {
    const memoire = { type: 'journal', desc: 'Le plancher gemit' };
    expect(convertTo(newEffect('setObjective'), memoire, 'type')).toEqual({
      type: 'setObjective', id: '', desc: 'Le plancher gemit',
    });
  });

  it('ajouter et changer le type proposent EXACTEMENT le même vocabulaire', () => {
    // Un seul registre publié (`EFFECT_MENU_GROUPS`) : les deux menus le consomment tel quel.
    const rubriques = EFFECT_MENU_GROUPS.length;
    const types = EFFECT_MENU_GROUPS.reduce((n, groupe) => n + groupe.items.length, 0);
    expect(rubriques).toBeGreaterThan(0);
    expect(types).toBeGreaterThan(0);
    const html = renderToStaticMarkup(
      <EffectList effects={[{ type: 'journal', desc: 'Le plancher gemit' }]} onChange={() => {}} ctx={ctx} />,
    );
    // Le choix du type passe par le MÊME menu que l'ajout — plus aucun `<select>` de type.
    expect(html).toContain('Type : Journal');
    expect(html).not.toContain('eff-type');
  });

  it('le texte saisi SURVIT au changement de type, et à l’aller-retour Journal → Flag → Journal', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    let dernier: Effect[] = [];
    function ListeControlee() {
      const [effects, setEffects] = useState<Effect[]>([{ type: 'journal', desc: 'Le plancher gemit' }]);
      return <EffectList effects={effects} ctx={ctx} onChange={(next) => { dernier = next; setEffects(next); }} />;
    }
    await act(async () => {
      root.render(<ListeControlee />);
    });
    const rangee = container.querySelector<HTMLDetailsElement>('details.eff-row')!;
    await act(async () => { rangee.querySelector('summary')!.click(); });
    /** Menu de TYPE de l'effet déplié (pas le menu d'ajout, qui vit hors de la rangée). */
    const choisirType = (libelle: string) => choisirDansMenu(menuDe(rangee, /^Type :/), libelle);

    try {
      await choisirType('Objectif courant (« je fais quoi maintenant ? »)');
      expect(dernier[0]).toEqual({ type: 'setObjective', id: '', desc: 'Le plancher gemit' });

      await choisirType('Définir un flag');
      expect(dernier[0].type).toBe('setFlag');
      expect(dernier[0]).not.toHaveProperty('desc'); // le flag ne porte que les champs de SON type

      await choisirType('Journal');
      expect(dernier[0]).toEqual({ type: 'journal', desc: 'Le plancher gemit' });
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });
});

describe('#1318 E1 — les bornes des rangées d’atelier sont TENUES à la saisie (cale de NumberField)', () => {
  it('startPursuit : la distance de départ reste dans 1–9 et le seuil d’évasion au-dessus de 2', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    let dernier: Effect[] = [];
    function ListeControlee() {
      const [effects, setEffects] = useState<Effect[]>([
        { type: 'startPursuit', distance: 4, escapeAt: 10 } as unknown as Effect,
      ]);
      return <EffectList effects={effects} ctx={ctx} onChange={(next) => { dernier = next; setEffects(next); }} />;
    }
    await act(async () => { root.render(<ListeControlee />); });

    const champ = (nom: string): HTMLInputElement => {
      const el = container.querySelector(`input[aria-label="${nom}"]`);
      if (!el) throw new Error(`champ « ${nom} » introuvable`);
      return el as HTMLInputElement;
    };
    const saisir = async (el: HTMLInputElement, valeur: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      await act(async () => {
        setter.call(el, valeur);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
    };

    // La borne haute est VIVANTE : le moteur borne la distance à `escapeAt - 1` (pursuitFlow.ts l.234).
    await saisir(champ('Distance de départ'), '99');
    expect((dernier[0] as unknown as { distance: number }).distance).toBe(9);
    await saisir(champ('Distance de départ'), '0');
    expect((dernier[0] as unknown as { distance: number }).distance).toBe(1);

    await saisir(champ("Seuil d'évasion"), '6');
    expect((dernier[0] as unknown as { escapeAt: number }).escapeAt).toBe(6);
    await saisir(champ('Distance de départ'), '99');
    expect((dernier[0] as unknown as { distance: number }).distance).toBe(5);

    await saisir(champ("Seuil d'évasion"), '1');
    expect((dernier[0] as unknown as { escapeAt: number }).escapeAt).toBe(2);

    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('giveMoney : chaque champ écrit SA clé de `Money` DANS l’enveloppe `montant` (pistole = silver, sou = brass, money.ts l.9)', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    let dernier: Effect[] = [];
    function ListeControlee() {
      const [effects, setEffects] = useState<Effect[]>([{ type: 'giveMoney', montant: { gold: 0, silver: 0, brass: 0 } } as unknown as Effect]);
      return <EffectList effects={effects} ctx={ctx} onChange={(next) => { dernier = next; setEffects(next); }} />;
    }
    await act(async () => { root.render(<ListeControlee />); });
    const champ = (nom: string): HTMLInputElement => {
      const el = container.querySelector(`input[aria-label="${nom}"]`);
      if (!el) throw new Error(`champ « ${nom} » introuvable`);
      return el as HTMLInputElement;
    };
    const saisir = async (el: HTMLInputElement, valeur: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      await act(async () => {
        setter.call(el, valeur);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
    };
    await saisir(champ('Sous de cuivre'), '7');
    expect(dernier[0]).toMatchObject({ montant: { brass: 7, silver: 0, gold: 0 } });
    await saisir(champ('Pistoles d’argent'), '3');
    expect(dernier[0]).toMatchObject({ montant: { silver: 3, brass: 7 } });
    await saisir(champ('Couronnes d’or'), '2');
    expect(dernier[0]).toMatchObject({ montant: { gold: 2, silver: 3, brass: 7 } });
    // Le libellé VISIBLE suit la même clé (notation LDB 57 : CO / pa / sc).
    const rangee = container.querySelector('.money-fields')!;
    expect([...rangee.querySelectorAll('label')].map((l) => l.textContent?.trim())).toEqual(['CO', 'pa', 'sc']);

    await act(async () => { root.unmount(); });
    container.remove();
  });
});

/**
 * #1874 C0 — la table de cibles d'un Effet `ops` vient de la RACINE qui monte l'éditeur
 * (`CIBLES_PAR_RACINE`). Question canonique : le talent `controle-de-la-frenesie` ouvert au Compendium
 * (racine `declenche`) garde sa feuille `on:'target'` — résumé et sélecteur la disent, et toucher une
 * autre propriété ne la réécrit pas.
 */
describe('#1874 C0 — cibles d’un Effet `ops` : la table vient de la racine', () => {
  const feuilleTarget = (): Effect => {
    const talent = talents.find((t) => t.id === 'controle-de-la-frenesie')!;
    const trouve = (n: unknown): Effect | undefined => {
      if (!n || typeof n !== 'object') return undefined;
      const o = n as Record<string, unknown>;
      if (o.type === 'ops' && o.on === 'target') return o as unknown as Effect;
      for (const v of Object.values(o)) { const r = trouve(v); if (r) return r; }
      return undefined;
    };
    const f = trouve(talent.effects);
    expect(f, 'la feuille `on:target` du talent a disparu de la donnée').toBeDefined();
    return f!;
  };
  const selectsDeCible = (c: HTMLElement) =>
    Array.from(c.querySelectorAll('select')).filter((s) => Array.from(s.options).some((o) => o.value === 'target' || o.value === 'party'));
  const monte = (effect: Effect, racine: Parameters<typeof ctxDeCatalogue>[0] | 'scene'): HTMLElement => {
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(
      <EffectFields effect={effect} ctx={racine === 'scene' ? ctx : ctxDeCatalogue(racine)} onChange={() => {}} />,
    );
    return container;
  };

  it('racine `declenche` : `target` sélectionnée parmi cible/porteur, et retirer une op ne réécrit pas `on`', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    let dernier: Effect | undefined;
    function Controle() {
      const [eff, setEff] = useState<Effect>(feuilleTarget());
      return <EffectFields effect={eff} ctx={ctxDeCatalogue('declenche')} onChange={(n) => { dernier = n; setEff(n); }} />;
    }
    try {
      await act(async () => { root.render(<Controle />); });
      const [sel] = selectsDeCible(container);
      expect(Array.from(sel.options).map((o) => [o.value, o.textContent])).toEqual([['target', 'La cible du déclencheur'], ['caster', 'Le porteur']]);
      expect(sel.value).toBe('target');
      const retirer = container.querySelector(`button[title="Supprimer l'op"]`) as HTMLButtonElement;
      await act(async () => { retirer.click(); });
      expect(dernier).toBeDefined();
      expect((dernier as { on?: string }).on).toBe('target');
    } finally {
      await act(async () => { root.unmount(); });
      container.remove();
    }
  });

  it('racine `sort` : deux options, la cible et le lanceur', () => {
    const [sel] = selectsDeCible(monte({ type: 'ops', on: 'caster', ops: [] }, 'sort'));
    expect(Array.from(sel.options).map((o) => [o.value, o.textContent])).toEqual([['target', 'La cible'], ['caster', 'Le lanceur']]);
  });

  it('racine `maladie` : une seule cible, AUCUN sélecteur, le résumé la nomme', () => {
    const f: Effect = { type: 'ops', ops: [{ op: 'condition', id: 'sonne' }] } as Effect;
    expect(selectsDeCible(monte(f, 'maladie'))).toEqual([]);
    expect(effectSummary(f, ctxDeCatalogue('maladie'))).toMatch(/^Le malade : /);
  });

  it('racine SCÈNE : deux options, groupe et héros', () => {
    const [sel] = selectsDeCible(monte({ type: 'ops', on: 'party', ops: [] }, 'scene'));
    expect(Array.from(sel.options).map((o) => o.value)).toEqual(['party', 'hero']);
  });

  it('effectSummary dit la cible de la racine, et nomme un `on` hors de son vocabulaire', () => {
    const f = feuilleTarget();
    expect(effectSummary(f, ctxDeCatalogue('declenche'))).toMatch(/^La cible du déclencheur : /);
    expect(effectSummary(f, ctx)).toMatch(/^« on: target » hors du vocabulaire de cette racine : /);
    expect(effectSummary({ type: 'ops', ops: [] }, ctx)).toMatch(/^Tout le groupe : /);
    expect(effectSummary({ type: 'ops', on: 'caster', ops: [] }, ctxDeCatalogue('sort'))).toMatch(/^Le lanceur : /);
    expect(effectSummary({ type: 'ops', on: 'caster', ops: [] }, ctxDeCatalogue('declenche'))).toMatch(/^Le porteur : /);
    expect(effectSummary({ type: 'ops', on: 'caster', ops: [] }, ctxDeCatalogue('maladie'))).toMatch(/^« on: caster » hors du vocabulaire/);
    // `on` absent : le défaut est celui de la RACINE — la cible au catalogue, le groupe en scène.
    expect(effectSummary({ type: 'ops', ops: [] }, ctxDeCatalogue('sort'))).toMatch(/^La cible : /);
  });
});

describe('#679 — les références narratives s’éditent par le sélecteur unique, jamais au catalogue', () => {
  const narratif: NarratifBlock = {
    ...emptyNarratif(),
    affaires: [{ id: 'aff', titre: 'La disparition' }],
    indices: [
      { id: 'ind-lettre', affaireId: 'aff', kind: 'indice', titre: 'La lettre chiffrée', stades: [{ id: 'lue', prose: 'a' }, { id: 'dechiffree', prose: 'b' }] },
      { id: 'ind-bruit', affaireId: 'aff', kind: 'rumeur', titre: 'Le bruit du port', stades: [{ id: 'entendu', prose: 'c' }] },
    ],
    documents: [
      { id: 'doc-affiche', titre: 'L’affiche de la diligence', prose: 'd' },
      { id: 'doc-kastor', titre: 'La lettre de Kastor', prose: 'e' },
    ],
  };
  const ctxProjet = effectCtxOf({ scenes: [], narratif });

  /** `EffectFields` contrôlé : l'état vit dans le harnais, chaque choix repart de l'Effect à jour. */
  async function monte(initial: Effect) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    let dernier = initial;
    function Controle() {
      const [eff, setEff] = useState<Effect>(initial);
      return <EffectFields effect={eff} ctx={ctxProjet} onChange={(n) => { dernier = n; setEff(n); }} />;
    }
    await act(async () => { root.render(<Controle />); });
    const select = (libelle: string) => [...container.querySelectorAll('select')]
      .find((s) => s.closest('label')?.textContent?.includes(libelle)) as HTMLSelectElement;
    return {
      dernier: () => dernier,
      /** Libellés des options qui portent une valeur (le « à choisir » et le « aucun » exclus). */
      options: (libelle: string) => [...select(libelle).options].filter((o) => o.value !== '').map((o) => o.textContent),
      choisir: async (libelle: string, valeur: string) => {
        const s = select(libelle);
        await act(async () => {
          Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(s, valeur);
          s.dispatchEvent(new Event('change', { bubbles: true }));
        });
      },
      demonte: async () => { await act(async () => { root.unmount(); }); container.remove(); },
    };
  }

  it('document : propose les documents du narratif par leur titre et écrit l’id choisi', async () => {
    const h = await monte(newEffect('document'));
    try {
      expect(h.options('Document remis')).toEqual(['L’affiche de la diligence', 'La lettre de Kastor']);
      await h.choisir('Document remis', 'doc-kastor');
      expect(h.dernier()).toEqual({ type: 'document', documentId: 'doc-kastor' });
      expect(effectSummary(h.dernier(), ctxProjet)).toBe('Document : La lettre de Kastor');
    } finally { await h.demonte(); }
  });

  it('revealClue : propose les indices, puis les stades de l’indice choisi', async () => {
    const h = await monte(newEffect('revealClue'));
    try {
      expect(h.options('Indice révélé')).toEqual(['La lettre chiffrée', 'Le bruit du port']);
      await h.choisir('Indice révélé', 'ind-lettre');
      expect(h.options('Stade')).toEqual(['stade 1', 'stade 2']);
      await h.choisir('Stade', 'dechiffree');
      expect(h.dernier()).toMatchObject({ type: 'revealClue', indiceId: 'ind-lettre', stade: 'dechiffree' });
      // Changer d'indice retire le stade de l'ancien : il ne désigne rien dans le nouveau.
      await h.choisir('Indice révélé', 'ind-bruit');
      expect(h.dernier()).toMatchObject({ indiceId: 'ind-bruit', stade: undefined });
      expect(h.options('Stade')).toEqual(['stade 1']);
    } finally { await h.demonte(); }
  });

  it('discreditClue : propose les indices et écrit l’id choisi', async () => {
    const h = await monte(newEffect('discreditClue'));
    try {
      await h.choisir('Indice écarté', 'ind-bruit');
      expect(h.dernier()).toEqual({ type: 'discreditClue', indiceId: 'ind-bruit' });
    } finally { await h.demonte(); }
  });

  it('racine de catalogue : « + Effet », « + Bloc » et le changement de type taisent les trois Effects à réf narrative ; la racine de projet les offre', async () => {
    const narratifs = [EFFECT_LABEL.document, EFFECT_LABEL.revealClue, EFFECT_LABEL.discreditClue];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    const entreesDe = async (menu: HTMLDetailsElement) => {
      const boite = await ouvrirMenu(menu);
      const vus = narratifs.filter((l) => entreeDe(boite, l));
      const journal = !!entreeDe(boite, EFFECT_LABEL.journal);
      await act(async () => { menu.querySelector('summary')!.click(); });
      return { vus, journal };
    };
    try {
      for (const [c, attendu] of [[ctxDeCatalogue('consommable'), []], [ctxProjet, narratifs]] as const) {
        await act(async () => {
          root.render(
            <>
              <EffectList effects={[{ type: 'journal', desc: 'x' }]} onChange={() => {}} ctx={c} />
              <FlowEditor flow={EMPTY_FLOW} onChange={() => {}} ctx={c} />
            </>,
          );
        });
        for (const menu of [menuDe(container, '+ Effet'), menuDe(container, '+ Bloc'), menuDe(container, /^Type :/)]) {
          const { vus, journal } = await entreesDe(menu);
          expect(journal).toBe(true);
          expect(vus).toEqual(attendu);
        }
      }
    } finally {
      await act(async () => { root.unmount(); });
      container.remove();
    }
  });
});
