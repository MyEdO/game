// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { OptionChooser, ChoiceButtons, type RollOption, type RollSegOption } from './OptionChooser';
import { optionValue, optionPending } from './breakdown';

/** Pose la cascade RÉELLE de l'app, dans SON ordre (`src/ui/styles.css` : `base.css`, puis
 *  `components.css`, foyer de `.seg`, puis `option-chooser.css`, foyer de `.rm-loc-inline`) — mesurer un style calculé sans elle mesurerait le vide. */
function poserFeuilles(): void {
  for (const f of ['./styles/base.css', './styles/components.css', './styles/option-chooser.css']) {
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

  it('layout seg : une barre plus large que sa rangée S’ENROULE — chaque option reste visible (#700)', () => {
    // Quatre déclarations de chute (EDO 01 l.231) dans une rangée `.prow-act` : la rangée de choix
    // rétrécit à la place offerte, la barre `.seg` s'enroule — aucune option rognée, aucun défilement
    // horizontal. Mesuré sur le style CALCULÉ de la cascade réelle.
    poserFeuilles();
    const boite = document.createElement('div');
    boite.innerHTML = renderToStaticMarkup(
      <div className="prow-act">
        <OptionChooser layout="seg" groupLabel="Déclarer" options={[
          { key: 'jump', label: 'Sauter' },
          { key: 'attempt', label: 'Tenter' },
          { key: 'suspendre-jump', label: 'Se suspendre puis se lâcher' },
          { key: 'suspendre-attempt', label: 'Se suspendre puis tenter', refus: 'Indisponible.' },
        ]} />
      </div>,
    );
    document.body.appendChild(boite);
    const rangee = boite.querySelector('.rm-loc-inline') as HTMLElement;
    const barre = boite.querySelector('.seg') as HTMLElement;
    expect(getComputedStyle(barre).flexWrap, 'la barre de segments déborde au lieu de s’enrouler').toBe('wrap');
    expect(getComputedStyle(rangee).flexShrink, 'la rangée de choix refuse de tenir dans `.prow-act`').not.toBe('0');
    expect(barre.querySelectorAll('button')).toHaveLength(4);
    boite.remove();
  });

  /** Monte une barre de segments dans la cascade réelle et rend ses ENFANTS DIRECTS (les segments
   *  tels que la flexbox les place : bouton nu, ou enveloppe `.gated-action` d'un refus). */
  function monterBarre(options: RollSegOption[]): { barre: HTMLElement; segments: HTMLElement[] } {
    poserFeuilles();
    const boite = document.createElement('div');
    boite.innerHTML = renderToStaticMarkup(<OptionChooser layout="seg" groupLabel="Déclarer" options={options} />);
    document.body.appendChild(boite);
    const barre = boite.querySelector('.seg') as HTMLElement;
    return { barre, segments: [...barre.children] as HTMLElement[] };
  }
  /** Règles de premier niveau de la cascade posée qui visent `el`, dans l'ordre des feuilles. */
  const reglesQuiVisent = (el: Element): CSSStyleRule[] => [...document.styleSheets].flatMap((f) => [...f.cssRules])
    .filter((r): r is CSSStyleRule => r instanceof CSSStyleRule && el.matches(r.selectorText));
  /** Le CADRE de la barre, tel que déclaré : jsdom ne calcule pas un raccourci `border` qui porte un
   *  `var()` — on lit donc la déclaration, épaisseur et couleur (le jeton). */
  function cadreDe(barre: HTMLElement): { epaisseur: string; couleur: string } {
    const [epaisseur, , couleur] = reglesQuiVisent(barre).map((r) => r.style.getPropertyValue('border')).filter(Boolean).pop()!.split(/\s+/);
    return { epaisseur, couleur };
  }

  it('layout seg : CHAQUE segment porte son séparateur, quelle que soit sa ligne une fois enroulé (#700)', () => {
    // Juge-vision de #700 : enroulée, la barre ne gardait un séparateur que sur sa 1re ligne — les
    // segments des lignes suivantes se lisaient comme du texte centré. Le séparateur appartient au
    // SEGMENT (à sa droite ET sous lui), jamais à sa position : aucun segment n'en est privé, le
    // dernier compris, refusé compris (enveloppé, ou bouton nu d'un refus `refusId`) — même jeton et même épaisseur que le cadre.
    const { barre, segments } = monterBarre([
      { key: 'jump', label: 'Sauter' },
      { key: 'attempt', label: 'Tenter', selected: true },
      { key: 'suspendre-jump', label: 'Se suspendre puis se lâcher' },
      { key: 'suspendre-attempt', label: 'Se suspendre puis tenter', refus: 'Indisponible.' },
      { key: 'mutualise', label: 'Refus mutualisé', refusId: 'raison-commune' },
    ]);
    const { epaisseur, couleur } = cadreDe(barre);
    expect(segments).toHaveLength(5);
    for (const [i, el] of segments.entries()) {
      const couches = getComputedStyle(el).boxShadow.split(/,\s*(?![^(]*\))/).map((c) => c.trim().split(/\s+/));
      const quoi = `segment ${i + 1} : enroulé, il se lirait comme du texte`;
      expect(couches.map((c) => c[c.length - 1]), `${quoi} — séparateur absent ou d'une autre encre que le cadre`).toEqual(couches.map(() => couleur));
      const decalages = couches.map((c) => `${c[0]} ${c[1]}`);
      expect(decalages, `${quoi} — aucun séparateur à sa droite`).toContain(`${epaisseur} 0`);
      expect(decalages, `${quoi} — aucun séparateur sous lui`).toContain(`0 ${epaisseur}`);
    }
    expect(getComputedStyle(barre).gap, 'aucun interstice où tracer le séparateur').toBe(epaisseur);
  });

  it('layout seg : une barre qui tient sur UNE ligne garde sa géométrie (Parade | Esquive, #700)', () => {
    // Sur une ligne, la largeur d'une barre = Σ segments + (n − 1) × séparateur. Le séparateur a
    // l'épaisseur du cadre et vit dans l'interstice : l'interstice vaut donc le cadre, et aucune règle
    // ne donne au bouton une bordure latérale qui l'élargirait d'autant.
    const { barre, segments } = monterBarre(seg);
    expect(segments).toHaveLength(2);
    expect(getComputedStyle(barre).gap, 'l’interstice entre deux segments n’a pas l’épaisseur du cadre').toBe(cadreDe(barre).epaisseur);
    for (const b of barre.querySelectorAll('button')) {
      const lateral = reglesQuiVisent(b).filter((r) => r.selectorText.includes('.seg'))
        .flatMap((r) => ['border-right-style', 'border-left-style'].map((p) => r.style.getPropertyValue(p))).filter((v) => v && v !== 'none');
      expect(lateral, 'le segment porte encore une bordure latérale : la barre s’élargit d’un séparateur').toEqual([]);
    }
  });

  it('layout seg : sous la tranche 560, le libellé passe AU-DESSUS de la barre — une rangée à menu le garde à côté (#700)', () => {
    // À 360px, « Déclarer » à côté de la barre en prenait la largeur et repliait les segments. jsdom
    // n'applique aucune tranche `@media` : on lit la tranche dans le CSSOM de la cascade réelle et
    // on demande quelles de ses règles visent la rangée RENDUE.
    poserFeuilles();
    const boite = document.createElement('div');
    boite.innerHTML = renderToStaticMarkup(
      <>
        <OptionChooser layout="seg" groupLabel="Déclarer" options={seg} />
        <div className="rm-loc-inline"><span className="mini-title">Arme</span><select className="rm-loc-select" /></div>
      </>,
    );
    document.body.appendChild(boite);
    const [rangeeSeg, rangeeMenu] = [...boite.querySelectorAll('.rm-loc-inline')] as HTMLElement[];
    const tranche = [...document.styleSheets].flatMap((f) => [...f.cssRules])
      .filter((r): r is CSSMediaRule => r instanceof CSSMediaRule && /max-width:\s*560px/.test(r.conditionText))
      .flatMap((m) => [...m.cssRules] as CSSStyleRule[]);
    const directionSous560 = (el: HTMLElement) => tranche.filter((r) => el.matches(r.selectorText)).map((r) => r.style.flexDirection).filter(Boolean);
    expect(directionSous560(rangeeSeg), 'la rangée de segments garde son libellé à côté de la barre sous 560').toEqual(['column']);
    expect(directionSous560(rangeeMenu), 'une rangée à menu déroulant n’a pas à empiler son libellé').toEqual([]);
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
