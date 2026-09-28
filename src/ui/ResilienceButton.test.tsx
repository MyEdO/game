// @vitest-environment jsdom
/**
 * ResilienceButton — forme de bouton de POOL (#945) : « Résilience ×N restants » + affordance Codex,
 * comme Chance et Détermination. L'affordance ouvre la RÈGLE dépensée, « Je ne faillirai pas ! »
 * (LDB 17 l.68), qui vit sur la Caractéristique `characteristics`/`resilience` — le foyer UNIQUE.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { useGame } from '../state/store';
import { characteristics, regles } from '../data';
import { codexLookupById, optionBody } from './compendium/registry';
import { ResilienceButton } from './ResilienceButton';

const noop = () => {};

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  useGame.setState({ screen: 'party', codexOverlay: null, compendiumFocus: null });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('ResilienceButton — pool, le BOUTON porte sa règle (#945, #1078)', () => {
  it('libellé « Résilience ×N », et AUCUN ⓘ voisin : c’est le bouton qui porte la règle', () => {
    const html = renderToStaticMarkup(<ResilienceButton resilience={2} show onForce={noop} />);
    expect(html).toContain('Résilience ×2');
    // L'affordance parallèle est MORTE (#1078) : plus d'icône info à côté du bouton.
    expect(html).not.toContain('ab-codex-info');
    expect(html).not.toContain('journal/info');
    // Le `CodexRef` englobant (`wrap`) ne prend AUCUNE interaction : un seul contrôle cliquable,
    // le bouton de dépense — jamais deux actions sur le même clic.
    expect(html).toContain('codex-ref');
    expect(html).not.toContain('role="button"');
    // Forme n/m RÉSERVÉE à la progression (DrBar) — jamais sur un pool.
    expect(html).not.toContain('2/2');
  });

  it('sans Résilience ou hors condition d’échec : rien à l’écran (ni bouton ni affordance)', () => {
    expect(renderToStaticMarkup(<ResilienceButton resilience={0} show onForce={noop} />)).toBe('');
    expect(renderToStaticMarkup(<ResilienceButton resilience={2} show={false} onForce={noop} />)).toBe('');
  });

  it('survoler le bouton donne la RÈGLE « Je ne faillirai pas ! » ; le clic DÉPENSE, il n’ouvre rien', () => {
    let spent = 0;
    act(() => root.render(<ResilienceButton resilience={2} show onForce={() => { spent += 1; }} />));
    const btn = host.querySelector<HTMLElement>('button')!;
    act(() => { btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    const pop = document.querySelector('.infobulle');
    expect(pop, 'le survol du bouton doit rendre la règle').toBeTruthy();
    expect(pop!.textContent).toContain('Je ne faillirai pas');
    // UN SEUL effet au clic : la dépense. Le Codex ne s'ouvre pas par-dessus la modale de jet.
    act(() => btn.click());
    expect(spent).toBe(1);
    expect(useGame.getState().codexOverlay).toBeNull();
    act(() => { btn.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })); }); // referme (React démonte le portal)
  });

  it('CLAVIER : focus bouton → ↓ → « Ouvrir la fiche » activée → le Codex s’ouvre sur la RÈGLE', () => {
    act(() => root.render(<ResilienceButton resilience={2} show onForce={noop} />));
    const btn = host.querySelector<HTMLButtonElement>('button')!;
    // 1. Le focus du contrôle rend la règle (aucun survol requis — chemin clavier pur).
    act(() => { btn.focus(); btn.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); });
    expect(document.querySelector('.infobulle'), 'le focus doit rendre la règle').toBeTruthy();
    // 2. ↓ épingle l'infobulle et y porte le focus : la PORTE est atteignable au clavier bien que le
    //    portal vive en fin de <body> (hors ordre de Tab).
    act(() => { btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
    const porte = document.querySelector<HTMLButtonElement>('.infobulle .codex-pop-open')!;
    expect(porte, '« Ouvrir la fiche » doit être un contrôle réel').toBeTruthy();
    expect(porte.tagName).toBe('BUTTON');
    expect(document.activeElement).toBe(porte);
    // 3. L'activer ouvre la fiche de l'ENTITÉ qui PORTE la règle — la Caractéristique et sa section
    //    « Dépenses » (amendement A #1117 : plus de fiche `regles` doublon), l'`instance` nommant le choix.
    act(() => porte.click());
    expect(useGame.getState().codexOverlay).toMatchObject({ category: 'characteristics', id: 'resilience', instance: 'Je ne faillirai pas !' });
    // …et l'infobulle s'est refermée derrière elle.
    expect(document.querySelector('.infobulle')).toBeNull();
  });

  it('la PORTE est dans l’infobulle, JAMAIS sur le contrôle : le déclencheur n’est pas cliquable', () => {
    act(() => root.render(<ResilienceButton resilience={2} show onForce={noop} />));
    const wrapper = host.querySelector('.codex-ref')!;
    expect(wrapper.getAttribute('role')).toBeNull();
    expect(wrapper.getAttribute('tabindex')).toBeNull();
    // Cliquer la surface englobante n'ouvre rien (elle n'intercepte aucune interaction).
    act(() => (wrapper as HTMLElement).click());
    expect(useGame.getState().codexOverlay).toBeNull();
  });

  it('les DEUX dépenses de Résilience vivent sur la CARACTÉRISTIQUE, texte VERBATIM du Source', () => {
    const res = (characteristics as { id: string; options?: { id: string; label: string; desc: string; source: { book: string; page: number } }[] }[])
      .find((c) => c.id === 'resilience');
    const faillir = res?.options?.find((o) => o.id === 'je-ne-faillirai-pas');
    const renie = res?.options?.find((o) => o.id === 'je-te-renie');
    expect(faillir, 'dépense je-ne-faillirai-pas absente de characteristics/resilience').toBeTruthy();
    expect(renie, 'dépense je-te-renie absente de characteristics/resilience').toBeTruthy();
    // LDB 17 l.68 — le bullet SEUL, recollable tel quel dans le Source.
    expect(faillir!.desc).toBe(
      "- **Je ne faillirai pas ! :** au lieu de lancer les dés pour un Test, vous choisissez le résultat, ce qui vous permet de réussir, même dans les pires conditions. Si vous infligez un Coup Critique, vous pouvez choisir la Localisation atteinte, plutôt que de la laisser au hasard. S'il s'agit d'un Test opposé, vous l'emportez avec au moins DR +1. Vous pouvez même faire ce choix après un Test qui a échoué.",
    );
    // LDB 17 l.67 — l'autre dépense (`resolveRenounce` la joue).
    expect(renie!.desc).toBe(
      '- **Je te renie ! :** vous pouvez choisir de ne pas développer la mutation obtenue. Et comme vous ne mutez pas, vous ne perdez aucun Point de Corruption. Voir Corruption à la page 182 pour en savoir plus.',
    );
    for (const o of [faillir!, renie!]) {
      expect(o.source).toMatchObject({ book: 'livre-de-base', page: 171 });
    }
  });

  it('les fiches `regles` DOUBLONS sont MORTES — un seul foyer par règle (amendement A)', () => {
    const doublons = regles.filter((r) => r.id === 'je-ne-faillirai-pas' || r.id === 'je-te-renie').map((r) => r.id);
    expect(doublons, 'entrée regles/* réintroduite : deux foyers pour le même texte').toEqual([]);
  });

  it('la fiche Résilience rend SA section « Dépenses », une sous-tête par choix', () => {
    const fiche = codexLookupById('characteristics', 'resilience');
    const sec = fiche?.sections?.find((s) => s.title === 'Dépenses');
    expect(sec, 'section « Dépenses » absente de la fiche Résilience').toBeTruthy();
    expect(sec!.rows.filter((r) => r.t === 'sub').map((r) => (r as { label: string }).label))
      .toEqual(['Je ne faillirai pas !', 'Je te renie !']);
  });

  /**
   * GOÛT (recette #1117) : le sous-en-tête porte déjà le nom — le corps ne redit ni la puce de liste
   * ni « **Nom :** ». La DONNÉE, elle, reste le verbatim recollable : le dédoublonnage est un geste
   * d'AFFICHAGE (`optionBody`), vérifié ici des deux côtés.
   */
  it('le corps d’une dépense est DÉDOUBLONNÉ à l’affichage, la donnée restant verbatim', () => {
    const sec = codexLookupById('characteristics', 'resilience')?.sections?.find((s) => s.title === 'Dépenses');
    const corps = sec!.rows.filter((r) => r.t === 'text').map((r) => (r as { text: string }).text);
    for (const t of corps) {
      expect(t.startsWith('- '), 'puce de liste orpheline sous le sous-en-tête').toBe(false);
      expect(t.startsWith('**'), 'libellé répété alors que le sous-en-tête le porte').toBe(false);
    }
    expect(corps[1]).toBe('vous pouvez choisir de ne pas développer la mutation obtenue. Et comme vous ne mutez pas, vous ne perdez aucun Point de Corruption. Voir Corruption à la page 182 pour en savoir plus.');
    // La DONNÉE n'a pas bougé : elle porte toujours sa puce et son préfixe (règle 5).
    const renie = (characteristics as { id: string; options?: { id: string; desc: string }[] }[])
      .find((c) => c.id === 'resilience')!.options!.find((o) => o.id === 'je-te-renie')!;
    expect(renie.desc.startsWith('- **Je te renie ! :**')).toBe(true);
  });

  it('FAIL-CLOSED : `optionBody` ne touche QUE le préfixe de SON libellé', () => {
    expect(optionBody({ label: 'Je te renie !', desc: '- **Je te renie ! :** texte.' })).toBe('texte.');
    // Verbatim qui ne commence PAS par le nom de l'option : rendu tel quel.
    expect(optionBody({ label: 'Je te renie !', desc: '- **Autre chose :** texte.' })).toBe('**Autre chose :** texte.');
    expect(optionBody({ label: 'Je te renie !', desc: 'texte sans puce.' })).toBe('texte sans puce.');
  });
});
