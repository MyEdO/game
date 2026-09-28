// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { OptionChooser, ChoiceButtons, type RollOption, type RollSegOption } from './OptionChooser';
import { optionValue, optionPending } from './breakdown';

/** Pose la cascade RÉELLE de l'app, dans SON ordre (`src/ui/styles.css` : `base.css` puis
 *  `components.css`, foyer de `.seg`) — mesurer un style calculé sans elle mesurerait le vide. */
function poserFeuilles(): void {
  for (const f of ['./styles/base.css', './styles/components.css']) {
    const style = document.createElement('style');
    style.dataset.recette = 'feuille';
    style.textContent = readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8');
    document.head.appendChild(style);
  }
}

/** Le document est PARTAGÉ par tous les cas du fichier (`isolate: false`) : ce que le cas de style
 *  calculé pose doit partir MÊME S'IL ÉCHOUE. Sans ce nettoyage, un rouge sur l'assertion de matière
 *  laissait ses feuilles et sa boîte en place, et huit cas suivants tombaient par pollution — le vrai
 *  défaut devenait illisible sous ses propres retombées (mesuré à la mutation, tour quinquies). */
afterEach(() => {
  for (const n of document.querySelectorAll('style[data-recette="feuille"], body > div')) n.remove();
});

describe('OptionChooser — sélecteur d’options de jet partagé', () => {
  const seg: RollSegOption[] = [
    { key: 'parade', label: 'Parade', value: 55, selected: true, title: 'Parer' },
    { key: 'esquive', label: 'Esquive', value: 48, title: 'Esquiver' },
  ];

  it('layout seg : segmented control, mini-titre, valeur effective, option active = `aria-pressed`', () => {
    const html = renderToStaticMarkup(<OptionChooser layout="seg" groupLabel="Réaction" options={seg} />);
    expect(html).toContain('class="seg"');
    expect(html).toContain('Réaction'); // mini-titre du groupe
    expect(html).toContain('Parade');
    expect(html).toContain('55'); // valeur effective affichée à côté du libellé
    expect(html).toContain('Esquive');
    expect(html).toContain('48');
    // L'ÉLECTION se dit `aria-pressed` (arbitrage A2), jamais une classe `on` : une seule grammaire
    // d'état ferré, et le lecteur d'écran l'entend.
    expect(html).not.toContain('class="on"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>\s*Parade/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>\s*Esquive/);
  });

  it('layout seg : une option qui porte sa RAISON COMPOSE `GatedAction` (bare), sans rien réécrire', () => {
    // UNE implémentation du refus : le segment refusé est un `GatedAction` en variante `bare` (le
    // `.seg` porte déjà la géométrie). Sa signature — conteneur `.gated-action`, `.btn.btn-nu`,
    // `aria-disabled` sans `disabled`, copie `hors-ecran` liée par `aria-describedby` — vient donc de
    // la primitive, jamais d'un troisième rendu local.
    const html = renderToStaticMarkup(
      <OptionChooser layout="seg" idPrefix="frag" options={[
        { key: 'blocs', label: 'blocs', selected: true },
        { key: 'cellule', label: 'cellule', selected: false, refus: 'Cette section ne contient aucune table.' },
      ]} />,
    );
    expect(html).toContain('gated-action');
    expect(html).toContain('btn-nu');
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toMatch(/<button[^>]*\sdisabled/);
    expect(html).toContain('aria-describedby="frag-');
    expect(html).toContain('hors-ecran');
    expect(html).toContain('Cette section ne contient aucune table.');
    // Le segment reste un CHOIX : son état pressé est annoncé (`aria-pressed`), refusé ou non.
    expect(html).toMatch(/aria-pressed="false"[^>]*>\s*cellule|cellule[\s\S]{0,80}aria-pressed="false"/);
  });

  it('layout seg : le segment RETENU reste annoncé pressé même refusé', () => {
    const html = renderToStaticMarkup(
      <OptionChooser layout="seg" options={[{ key: 'a', label: 'A', selected: true, refus: 'Plus disponible.' }]} />,
    );
    expect(html).toMatch(/<button[^>]*class="btn[^"]*btn-nu"[^>]*aria-pressed="true"/);
  });

  it('layout seg : le refus garde la MATIÈRE du segment — mesurée sur le style CALCULÉ, pas sur la classe', () => {
    // Une classe rendue ne prouve rien : c'est la CASCADE qui décide. `.btn.btn-nu` (0,3,0) l'emporte
    // sur `.seg button` (0,1,1) et sur `.seg button[aria-pressed='true']` (0,2,1) — sans les sélecteurs
    // qui reprennent la main (`components.css`), le segment refusé perd sa boîte (padding 0) et le
    // retenu son relief.
    poserFeuilles();
    const boite = document.createElement('div');
    boite.innerHTML = renderToStaticMarkup(
      <OptionChooser layout="seg" options={[
        { key: 'a', label: 'A', selected: true, refus: 'Plus disponible.' },
        { key: 'b', label: 'B' },
      ]} />,
    );
    document.body.appendChild(boite);
    const refuse = boite.querySelector('.btn.btn-nu') as HTMLElement;
    const offert = [...boite.querySelectorAll('.seg button')].find((b) => !b.classList.contains('btn-nu')) as HTMLElement;
    const style = getComputedStyle(refuse);

    expect(style.paddingTop, 'le segment refusé n’a plus la boîte d’un segment').toBe(getComputedStyle(offert).paddingTop);
    expect(style.paddingTop).toBe('6px');
    expect(style.paddingLeft).toBe('14px');
    expect(style.fontWeight, 'le segment RETENU mais refusé a perdu son relief').toBe('600');
    expect(style.opacity, 'un contrôle refusé se voit refusé').toBe('0.4');
    boite.remove();
  });

  it('layout seg : un segment REFUSÉ lit comme un segment offert — sa valeur effective comprise', () => {
    const html = renderToStaticMarkup(
      <OptionChooser layout="seg" options={[
        { key: 'parade', label: 'Parade', value: 55, refus: 'Arme brisée.' },
        { key: 'esquive', label: 'Esquive', value: 48 },
      ]} />,
    );
    // Le refus change ce qu'on PEUT faire, jamais ce qu'on LIT : sans la valeur, l'auteur du geste
    // ne peut plus comparer les deux options — c'est précisément ce qu'il regarde.
    expect(html).toContain('Parade');
    expect(html).toContain('55');
  });

  it('DEUX sélecteurs d’un même écran ne partagent pas leurs ids — `aria-describedby` désigne SA raison', () => {
    const opts = [{ key: 'a', label: 'A', refus: 'Indisponible.' }];
    const html = renderToStaticMarkup(
      <>
        <OptionChooser layout="grid" idPrefix="loc" options={opts} />
        <OptionChooser layout="grid" idPrefix="loc" options={opts} />
        <OptionChooser layout="seg" idPrefix="loc" options={opts} />
      </>,
    );
    const ids = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map((m) => m[1]);
    expect(ids, 'trois raisons rendues').toHaveLength(3);
    expect(new Set(ids).size, 'deux contrôles partagent un id : la raison lue n’est pas la leur').toBe(3);
  });

  it('layout grid : `.rm-loc-grid` de `.btn small`, primary, valeur entre parenthèses, masquage et désactivation', () => {
    const opts: RollOption[] = [
      { key: 'sacrifice', label: "Sacrifier l'Avantage" },
      { key: 'esquive', label: '🤸 Esquiver', value: 48, primary: true },
      { key: 'fuir', label: '🏃 Fuir', disabled: true },
      { key: 'cache', label: 'Caché', hidden: true },
    ];
    const html = renderToStaticMarkup(<OptionChooser layout="grid" options={opts} />);
    expect(html).toContain('class="rm-loc-grid"');
    // L'option PRIMARY porte les trois classes — leur ORDRE n'est pas le contrat (`grid` et `actions`
    // passent par la même composition depuis #1689 T2, qui compose `btn`/`btn-primary` avant `small`).
    const primary = html.match(/<button class="([^"]*)"[^>]*>🤸 Esquiver/)?.[1]?.split(' ') ?? [];
    expect(primary).toEqual(expect.arrayContaining(['btn', 'btn-primary', 'small']));
    expect(html).toContain('(48)'); // valeur entre parenthèses en grille
    expect(html).toContain('disabled'); // option désactivée (MUETTE : elle ne porte pas de `refus`)
    expect(html).not.toContain('Caché'); // option masquée non rendue
  });

  it('ChoiceButtons : les gestes SEULS, `.btn` (primary/ghost), sans conteneur — le cadre les pose dans son pied', () => {
    const opts: RollOption[] = [
      { key: 'subir', label: 'Subir la mutation' },
      { key: 'renier', label: 'Je te renie !', primary: true },
      { key: 'renoncer', label: 'Renoncer', ghost: true },
    ];
    const html = renderToStaticMarkup(<ChoiceButtons options={opts} />);
    expect(html).not.toContain('cadre-pied');
    expect(html.startsWith('<button')).toBe(true);
    expect(html).toContain('btn btn-primary');
    expect(html).toContain('btn btn-ghost');
  });

  it('content : rendu custom à la place de `label value` (ex. portraits)', () => {
    const opts: RollOption[] = [{ key: 'k', label: 'ignoré', value: 10, content: <span className="portrait-x" /> }];
    const html = renderToStaticMarkup(<OptionChooser layout="grid" options={opts} />);
    expect(html).toContain('portrait-x');
    expect(html).not.toContain('ignoré'); // le content remplace le label
    expect(html).not.toContain('(10)');
  });

});

describe('optionValue / optionPending — forme unique pré-jet', () => {
  it('optionValue = base + combineMods (plafonds de Difficulté inclus)', () => {
    expect(optionValue(40, [{ label: 'Avantage', value: 10, famille: 'jet' }])).toBe(50);
    // Malus plafonné à −30 (Très Difficile) : 40 + (−40 plafonné −30) = 10.
    expect(optionValue(40, [{ label: 'X', value: -40, famille: 'circonstance' }])).toBe(10);
    // `famille: 'jet'` (Avantage, hors table `LDB 14 l.48`) échappe au plafond des bonus.
    expect(optionValue(40, [{ label: 'Avantage', value: 100, famille: 'jet' }])).toBe(140);
  });

  it('optionPending : { label, base, mods } ; cible omise par défaut, fournie si plafonnée', () => {
    expect(optionPending('Parade', 45, [{ label: 'Avantage', value: 10, famille: 'jet' }])).toEqual({
      label: 'Parade',
      base: 45,
      mods: [{ label: 'Avantage', value: 10, famille: 'jet' }],
    });
    expect(optionPending('Corps à corps', 38, [], 98)).toEqual({ label: 'Corps à corps', base: 38, mods: [], target: 98 });
  });
});
