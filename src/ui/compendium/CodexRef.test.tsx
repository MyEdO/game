import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CodexRef, nodeHasText, BORNE_DU_CORPS } from './CodexRef';
import { coupeAuMot } from '../../lib/coupeAuMot.mjs';
import { spells } from '../../data';
import { mdToText } from '../Prose';

describe('CodexRef — affordance clic (#tooltipOnly bascule l’infobulle, jamais un survol-only)', () => {
  // `mouvement` (catégorie `characteristics`) : entrée réelle garantie (source des chips
  // moveMod/moveScale, cf. `opRows.ts`) — pas de fixture ad hoc.
  it('tooltipOnly : le déclencheur est FOCUSABLE/CLIQUABLE (role=button, tabindex=0) — jamais survol seul', () => {
    const h = renderToStaticMarkup(<CodexRef category="characteristics" id="mouvement" label="Mouvement" tooltipOnly>Mouvement</CodexRef>);
    expect(h).toContain('role="button"');
    expect(h).toContain('tabindex="0"');
    // Toggletip (Inclusive Components, « Tooltips & Toggletips ») : l'état se dit par l'ANNONCE de la
    // bulle dans sa région `role="status"` (`CodexRef.hooks.test.tsx`), pas par `aria-expanded`.
    expect(h).toContain('role="status"');
    // Le clic ne doit PAS ouvrir la fiche Codex en mode `tooltipOnly` — aucune affordance « Ouvrir la fiche ».
    expect(h).not.toContain('codex-pop-open');
  });

  it('hors tooltipOnly (même entrée) : le clic ouvre la fiche — affordance visible, pas d’aria-expanded (pas de bascule d’infobulle)', () => {
    const h = renderToStaticMarkup(<CodexRef category="characteristics" id="mouvement" label="Mouvement">Mouvement</CodexRef>);
    expect(h).toContain('role="button"');
    expect(h).not.toContain('aria-expanded');
  });
});

describe('CodexRef — repli sans entrée catalogue (#956) : la surface garde sa mise en forme', () => {
  it('entrée INTROUVABLE : le repli porte `codex-ref` (le style de l’affordance mord) et la classe du site', () => {
    const h = renderToStaticMarkup(
      <CodexRef category="characteristics" id="entree-qui-n-existe-pas" label="Inconnue" className="ab-codex-info">Inconnue</CodexRef>,
    );
    expect(h).toContain('codex-ref');
    expect(h).toContain('ab-codex-info');
    // Rien n'est cliquable : aucune fiche à ouvrir.
    expect(h).not.toContain('role="button"');
  });
});

/**
 * NOM ACCESSIBLE d'un déclencheur-ICÔNE (#1117 L0b) — `Icon` rend un `<svg aria-hidden>` : sans nom
 * dérivé, tous les ⓘ du dépôt (stock ÉNUMÉRÉ par `codex-info-affordance-ratchet.test.ts` :
 * `CharacterSheet`, `MerchantPanel`, `PossessionsRegistry`, `StakeNote`, `jetProps/*`) seraient des
 * boutons MUETS. La dérivation vit DANS la primitive : les call-sites n'ont qu'à passer leur `label`, comme
 * ils le font déjà. Un `ariaLabel` explicite reste prioritaire.
 */
describe('CodexRef — le déclencheur-icône se NOMME tout seul (#1117)', () => {
  const icone = <svg aria-hidden />;

  it('sans texte dans le déclencheur, le nom accessible DÉRIVE du label', () => {
    const h = renderToStaticMarkup(
      <CodexRef category="regles" id="soutien" label="Soutien" className="ab-codex-info">{icone}</CodexRef>,
    );
    expect(h).toContain('role="button"');
    expect(h, 'un bouton d’icône ne peut pas être muet').toContain('aria-label="Soutien"');
  });

  it('l’`ariaLabel` explicite PRIME sur la dérivation', () => {
    const h = renderToStaticMarkup(
      <CodexRef category="regles" id="soutien" label="Soutien" ariaLabel="Règle : Cauchemars" className="ab-codex-info">{icone}</CodexRef>,
    );
    expect(h).toContain('aria-label="Règle : Cauchemars"');
    expect(h).not.toContain('aria-label="Soutien"');
  });

  it('un déclencheur TEXTUEL ne reçoit AUCUN aria-label (il se nomme par son contenu)', () => {
    const h = renderToStaticMarkup(<CodexRef category="regles" id="soutien" label="Soutien">Soutien</CodexRef>);
    expect(h).not.toContain('aria-label');
  });

  it('`nodeHasText` — la sonde distingue icône seule, texte, et mélange', () => {
    expect(nodeHasText(icone)).toBe(false);
    expect(nodeHasText([icone, icone])).toBe(false);
    expect(nodeHasText('Soutien')).toBe(true);
    expect(nodeHasText(<span>{icone} Soutien</span>)).toBe(true);
  });
});

/** Coupée à une ESPACE : le préfixe rendu est un préfixe du texte, suivi dans le texte d'une espace. */
const coupeAUneEspace = (texte: string, rendu: string): boolean => {
  const prefixe = rendu.slice(0, -1);
  return rendu.endsWith('…') && texte.startsWith(prefixe) && /\s/.test(texte[prefixe.length] ?? '');
};

describe('CodexRef — la coupe du corps tombe à une FRONTIÈRE DE MOT sur les données réelles (R-M2)', () => {
  it('aucun sort long ne rend un mot tranché (données réelles)', () => {
    const longs = spells.filter((sp) => sp.desc && mdToText(sp.desc).length > BORNE_DU_CORPS);
    expect(longs.length).toBeGreaterThan(0);
    const tranches = longs.filter((sp) => { const t = mdToText(sp.desc!); return !coupeAUneEspace(t, coupeAuMot(t, BORNE_DU_CORPS)); });
    expect(tranches.map((sp) => sp.id)).toEqual([]);
  });
});
