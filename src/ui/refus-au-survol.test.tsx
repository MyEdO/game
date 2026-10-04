import type { JSX } from 'react';
/**
 * CONTRAT POSITIF de la RAISON D'UN REFUS (#1689 T2) — la loi de `docs/charte-ui.md` § « Raison d'un
 * refus » (arbitrage user 2026-08-24 : « Je n'ai jamais validé ces "textes" impossible a lire sous le
 * nom des capacités ») se vérifie ÉCRAN PAR ÉCRAN, sur la forme RENDUE :
 *   1. le bouton refusé porte `aria-disabled="true"` et JAMAIS l'attribut HTML `disabled` (sinon il
 *      sort de l'ordre de tabulation, la manette ne le voit plus et le doigt n'ouvre plus l'infobulle) ;
 *   2. il porte un `aria-describedby` qui DÉSIGNE un élément du document, lequel porte la RAISON en
 *      toutes lettres (le lecteur d'écran la reçoit sans survoler) ;
 *   3. la raison n'est PAS un `title` natif sur ce bouton (muet à l'arbre a11y).
 * Le cliquet `ui-ratchets` (xix) interdit la RÉAPPARITION d'un `<button disabled title=…>` ; ces
 * tests-ci vérifient ce qui est RENDU à la place — un cliquet vert sur un écran qui ne dirait plus
 * rien serait un faux vert.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GatedAction } from './GatedAction';
import { OptionChooser, ChoiceButtons } from './OptionChooser';
import { EscaleTab } from './PortView';
import { ActivityPane, idBlocage } from './ActivityPane';
import { MedicModal } from './MedicModal';
import { MerchantPanelView } from './MerchantPanel';
import { ShoreLeaveBody } from './ShoreLeaveModal';
import { useGame, type CampaignVessel } from '../state/store';
import type { Combatant, ItemInstance } from '../engine/types';

/** Balise ouvrante d'un `<button>` dont le contenu (ou l'`aria-label`) contient `texte`. */
function bouton(html: string, texte: string): string {
  const tags = [...html.matchAll(/<button\b[^>]*>/g)].map((m) => ({ tag: m[0], at: m.index ?? 0 }));
  const trouve = tags.find((t) => {
    const fin = html.indexOf('</button>', t.at);
    const contenu = fin < 0 ? '' : html.slice(t.at, fin);
    return contenu.includes(texte);
  });
  expect(trouve, `Aucun <button> contenant « ${texte} » dans le rendu`).toBeTruthy();
  return trouve!.tag;
}

/** Texte de l'élément d'`id` donné (la copie accessible de la raison, `.hors-ecran` ou non). */
function texteDeLId(html: string, id: string): string {
  const re = new RegExp(`<([a-z]+)\\b[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</\\1>`);
  const m = html.match(re);
  expect(m, `Aucun élément #${id} dans le document — l'aria-describedby pointe dans le vide`).toBeTruthy();
  return m![2]
    .replace(/<[^>]*>/g, '')
    .replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

/** Les 3 points du contrat, sur le bouton dont le contenu porte `texte`. */
function attendRefusAtteignable(html: string, texte: string, raison: string) {
  const tag = bouton(html, texte);
  expect(tag, `« ${texte} » : le refus doit être ATTEIGNABLE (aria-disabled), jamais \`disabled\``).toContain('aria-disabled="true"');
  expect(/\sdisabled(\s|=|>)/.test(tag), `« ${texte} » : \`disabled\` HTML retire le bouton du clavier/manette/tap`).toBe(false);
  const described = tag.match(/aria-describedby="([^"]+)"/);
  expect(described, `« ${texte} » : aucun aria-describedby vers la raison`).toBeTruthy();
  expect(texteDeLId(html, described![1])).toContain(raison);
  expect(tag, `« ${texte} » : la raison ne se porte pas en \`title\` natif (muet à l'arbre a11y)`).not.toContain(`title="${raison}`);
}

describe('#1689 T2 — la raison d’un refus a UNE forme (GatedAction)', () => {
  it('GatedAction : refusé = aria-disabled + copie hors écran désignée par aria-describedby', () => {
    const html = renderToStaticMarkup(
      <GatedAction id="t-gate" label="Entrer" enabled={false} reason="Bourse insuffisante." onClick={() => {}} />,
    );
    attendRefusAtteignable(html, 'Entrer', 'Bourse insuffisante.');
    expect(html).toContain('hors-ecran'); // la copie n'est pas un texte inline sous le libellé
  });

  it('GatedAction : OFFERT = bouton nu, ni aria-disabled ni raison rendue', () => {
    const html = renderToStaticMarkup(
      <GatedAction id="t-gate" label="Entrer" enabled reason="Bourse insuffisante." onClick={() => {}} />,
    );
    expect(html).not.toContain('aria-disabled');
    expect(html).not.toContain('Bourse insuffisante.');
  });

  it('ChoiceButtons : une option qui porte `refus` passe par la MÊME composition que `grid`', () => {
    const options = [{ key: 'go', label: 'Payer', primary: true, refus: 'L’hôte décide.', onSelect: () => {} }];
    const actions = renderToStaticMarkup(<ChoiceButtons idPrefix="t" options={options} />);
    const grid = renderToStaticMarkup(<OptionChooser layout="grid" idPrefix="t" options={options} />);
    attendRefusAtteignable(actions, 'Payer', 'L’hôte décide.');
    attendRefusAtteignable(grid, 'Payer', 'L’hôte décide.');
  });

  it('FERMÉE ⇒ `aria-disabled`, JAMAIS `disabled` — dans TOUTES les formes, texte de raison ou non', () => {
    // Invariant du socle : un contrôle refusé reste atteignable au clavier, à la manette et au doigt.
    // Le type ADMET `reason=""`/`reasonId=""` (une chaîne reste une chaîne) et `raisonInline` écrit sa
    // raison à l'écran : aucun de ces cas ne rend le `disabled` HTML.
    const formes: [string, JSX.Element][] = [
      ['reason vide', <GatedAction id="t-vide" reason="" label="A" enabled={false} onClick={() => {}} />],
      ['reasonId vide', <GatedAction id="t-vide-id" reasonId="" label="B" enabled={false} onClick={() => {}} />],
      ['sans raison', <GatedAction id="t-sans" label="C" enabled={false} onClick={() => {}} />],
      ['raison portée', <GatedAction id="t-r" reason="Bourse insuffisante." label="D" enabled={false} onClick={() => {}} />],
      ['raison liée', <GatedAction id="t-l" reasonId="ailleurs" label="E" enabled={false} onClick={() => {}} />],
      ['raisonInline', <GatedAction id="t-inline" reason="Déjà lisible." raisonInline label="F" enabled={false} onClick={() => {}} />],
    ];
    for (const [nom, el] of formes) {
      const tag = renderToStaticMarkup(el).match(/<button\b[^>]*>/)![0];
      expect(/\sdisabled(\s|=|>)/.test(tag), `${nom} : une action FERMÉE doit rester atteignable`).toBe(false);
      expect(tag, `${nom} : le refus doit être marqué`).toContain('aria-disabled="true"');
    }
    // Sans texte à lire, ni attribut ni copie : `aria-describedby` ne désigne jamais un `<p>` vide.
    for (const [nom, el] of formes.slice(0, 3)) {
      const html = renderToStaticMarkup(el);
      expect(html.match(/<button\b[^>]*>/)![0], `${nom} : pas de description fantôme`).not.toMatch(/aria-describedby=/);
      expect(html, `${nom} : pas de copie vide`).not.toContain('hors-ecran');
    }
    // `raisonInline` : la raison est EN CLAIR sous le bouton (opt-in), pas dans une bulle.
    expect(renderToStaticMarkup(formes[5][1])).toContain('gated-action-reason');
  });

  it('forme `reasonId` : la raison vit chez l’APPELANT, et le bouton reste ATTEIGNABLE (jamais `disabled`)', () => {
    const html = renderToStaticMarkup(
      <>
        <GatedAction id="t-lie" reasonId="t-cause" label="Opérer" enabled={false} onClick={() => {}} />
        <p id="t-cause">Aucun soigneur dans le groupe.</p>
      </>,
    );
    attendRefusAtteignable(html, 'Opérer', 'Aucun soigneur dans le groupe.');
  });

  it('ActivityPane : quand la BANNIÈRE porte la raison, l’action s’y LIE — le texte n’est pas redit', () => {
    const html = renderToStaticMarkup(
      <ActivityPane
        id="pane-t" icon="nav/activity" title="Banque"
        blocked={<>Dépôt au-delà de votre bourse.</>}
        actions={<GatedAction id="t-dep" reasonId={idBlocage('pane-t')} label="Investir" enabled={false} onClick={() => {}} />}
      />,
    );
    attendRefusAtteignable(html, 'Investir', 'Dépôt au-delà de votre bourse.');
    // La raison est écrite UNE fois : la bannière. Aucune copie hors écran ne la doublonne.
    expect(html.match(/Dépôt au-delà de votre bourse\./g)).toHaveLength(1);
    expect(html).toContain(`id="${idBlocage('pane-t')}"`);
  });

  it('ChoiceButtons : le refus d’une décision d’escale est atteignable (ShoreLeave, invité)', () => {
    const html = renderToStaticMarkup(
      <ChoiceButtons idPrefix="t" options={[{ key: 'ok', label: 'Accorder', refus: 'L’hôte décide de la relâche.', onSelect: () => {} }]} />,
    );
    attendRefusAtteignable(html, 'Accorder', 'L’hôte décide de la relâche.');
  });
});

// ── Écrans migrés : le refus RÉEL, tel que l'écran le rend ──────────────────────────────────────

const vessel: CampaignVessel = { vehicleId: 'cogue', label: 'Le Cormoran', morale: { score: 75, lastMoraleWeek: 0, factors: [] } };
const initialNet = useGame.getInitialState().net;
afterEach(() => {
  Object.assign(useGame.getInitialState() as unknown as Record<string, unknown>, {
    pendingShoreLeave: null, pendingManannPriest: null, net: initialNet,
    medic: null, party: [], pendingHeal: null, pendingSurgery: null,
  });
});

describe('#1689 T2 — écrans migrés', () => {
  it('PORT (escale) : l’invité voit POURQUOI « Embaucher » lui est fermé', () => {
    const html = renderToStaticMarkup(
      <EscaleTab
        vessel={vessel} isGuest
        pendingShoreLeave={null} pendingManannPriest={null}
        onHire={() => {}} onDismiss={() => {}}
      />,
    );
    attendRefusAtteignable(html, 'Embaucher', 'L’hôte seul engage les dépenses du groupe.');
  });

  it('MARCHAND : « + Ajouter » refusé dit « Bourse insuffisante », sans texte inline sous le libellé', () => {
    const stubHero = {
      id: 'h', label: 'H', kind: 'hero', wounds: { current: 10, max: 12 }, conditions: [], advantage: 0,
      weapons: [], skills: [], items: [] as ItemInstance[], movement: 4,
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    } as unknown as Combatant;
    const html = renderToStaticMarkup(
      <MerchantPanelView
        merchant={{ entityId: 'p', archetype: 'armurier', settlement: 'ville', resaleRate: 0.5, stock: [{ id: 'epee', qty: 3 }], cart: [], bargainLocked: false }}
        party={[stubHero]}
        money={{ gold: 0, silver: 0, brass: 0 }}
        onAddToCart={() => {}} onDecCart={() => {}} onRemoveCart={() => {}} onClearCart={() => {}}
        onRefuse={() => {}} onPay={() => {}} onAssignDist={() => {}} onConfirmDist={() => {}}
        onRepair={() => {}} onBargain={() => {}} onAppraise={() => {}} onClose={() => {}}
        onAddToSellCart={() => {}} onRemoveSellCart={() => {}} onClearSellCart={() => {}} onConfirmSell={() => {}}
      />,
    );
    attendRefusAtteignable(html, '+ Ajouter', 'Bourse insuffisante.');
    expect(html).not.toContain('gated-action-reason'); // jamais la variante INLINE hors opt-in
  });

  it('SOIGNEUR : un acte sans soigneur est INERTE et sa raison est atteignable (jamais `disabled`)', () => {
    const patient = {
      id: 'p1', label: 'Blessé', kind: 'hero', wounds: { current: 2, max: 12 }, conditions: [], advantage: 0,
      weapons: [], skills: [], items: [], movement: 4,
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    } as unknown as Combatant;
    Object.assign(useGame.getInitialState() as unknown as Record<string, unknown>, {
      medic: { patientId: 'p1' }, party: [patient], pendingHeal: null, pendingSurgery: null,
    });
    const html = renderToStaticMarkup(<MedicModal />);
    const actes = [...html.matchAll(/<button\b([^>]*)class="[^"]*medic-act[^"]*"([^>]*)>/g)];
    expect(actes.length, 'aucun acte rendu : le test ne mesurerait RIEN').toBeGreaterThan(0);
    // Contrat 3/3 sur CHAQUE acte : atteignable, et son `aria-describedby` RÉSOLU vers une raison
    // NON VIDE (chaque acte a la sienne — pas de soigneur, pas d'Hémorragie…).
    for (const m of actes) {
      const tag = m[0];
      expect(/\sdisabled(\s|=|>)/.test(tag), 'un acte fermé doit rester atteignable').toBe(false);
      expect(tag).toContain('aria-disabled="true"');
      const id = tag.match(/aria-describedby="([^"]+)"/);
      expect(id, 'aucun aria-describedby vers la raison').toBeTruthy();
      expect(texteDeLId(html, id![1]).trim().length, `raison VIDE pour ${id![1]}`).toBeGreaterThan(0);
    }
    // Et la raison du GROUPE sans soigneur est bien celle-là, en toutes lettres.
    expect(html).toContain('Aucun soigneur (Compétence Guérison) dans le groupe.');
  });

  it('ESCALE (relâche) : les deux décisions de l’invité portent leur raison', () => {
    Object.assign(useGame.getInitialState() as unknown as Record<string, unknown>, {
      pendingShoreLeave: { to: { label: 'Marienburg' } },
      net: { ...initialNet, mode: 'guest' },
    });
    const html = renderToStaticMarkup(<ShoreLeaveBody />);
    // Apostrophe DROITE : c'est la graphie du site (`ShoreLeaveModal.tsx`), rendue `&#x27;` par React.
    attendRefusAtteignable(html, 'Accorder la relâche', "L'hôte décide de la relâche.");
    attendRefusAtteignable(html, 'Refuser la relâche', "L'hôte décide de la relâche.");
  });
});
