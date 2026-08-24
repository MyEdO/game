// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { Combatant } from '../engine/types';
import { AdvancementPanel, CharacterSheet } from './CharacterSheet';
import { BackgroundPanel } from './BackgroundPanel';
import { casterTalents } from '../engine/grimoire';
import { findTrappingById } from '../data';
import { useGame } from '../state/store';

/** Héros « Agitateur » niveau 1 (« Pamphlétaire ») avec 1000 PX, Charme (in-carrière) + Esquive (hors). */
const hero = (): Combatant =>
  ({
    id: 'h',
    label: 'H',
    kind: 'hero',
    species: 'humains-reiklander',
    career: 'agitateur',
    careerLevel: 1,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 },
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [
      { skillId: 'charme', characteristic: 'sociabilite', advances: 0 },
      { skillId: 'esquive', characteristic: 'agilite', advances: 0 },
    ],
    talents: [],
    movement: 4,
    xp: 1000,
    charAdvances: {},
    motivation: 'Devoir',
    details: { age: 27, ambitionShort: 'Survivre à la prochaine campagne', ambitionLong: 'Commander sa propre compagnie' },
  }) as unknown as Combatant;

describe('AdvancementPanel (rendu)', () => {
  it('rend le bandeau PX, les Caractéristiques, Compétences, Talents et le bloc Carrière', () => {
    const html = renderToStaticMarkup(<AdvancementPanel hero={hero()} />);
    // Bandeau PX collant (total en tête de l'onglet Avancement)
    expect(html).toContain('Expérience disponibles');
    expect(html).toContain('1000');
    // Caractéristiques : coût in-carrière (CT = 25) ET hors-carrière (CC = 50) — rangée en
    // <CharValue> (libellé COURT + popover Codex de la caractéristique)
    expect(html).toContain('char-value');
    expect(html).toContain('CC');
    expect(html).toContain('25 PX');
    expect(html).toContain('50 PX');
    // Pastilles in/hors carrière
    expect(html).toContain('carrière');
    // Compétences : connue + acquérable
    expect(html).toContain('Charme');
    expect(html).toContain('Ragot'); // compétence de carrière non connue → acquérable
    expect(html).toContain('Apprendre');
    // Talents de carrière acquérables
    expect(html).toContain('Sociable');
    expect(html).toContain('Acquérir');
    // Bloc Carrière
    expect(html).toContain('Pamphlétaire');
    expect(html).toContain('niveau en cours');
    expect(html).toContain('changer de carrière');
  });

  it('grise un achat quand les PX sont insuffisants', () => {
    const broke = { ...hero(), xp: 5 } as Combatant;
    const html = renderToStaticMarkup(<AdvancementPanel hero={broke} />);
    expect(html).toContain('disabled'); // boutons d'achat désactivés (coût > 5 PX)
  });
});

describe('Gate Magie & Foi (#492 bug 2)', () => {
  it('un Béni SANS Bénédiction mémorisée reste un lanceur (casterTalents, pas juste spells.length)', () => {
    const beni: Combatant = { ...hero(), spells: [], talents: [{ talentId: 'beni', spec: 'sigmar', times: 1 }] } as Combatant;
    // `isCaster` de CharacterSheet lit CE calcul — un Béni sans sort mémorisé encore ne doit
    // pas perdre son onglet Magie & Foi ni son compteur de Péché.
    expect((beni.spells?.length ?? 0) > 0).toBe(false);
    expect(casterTalents(beni).length).toBeGreaterThan(0);
  });
});

describe('CharacterSheet — colonne PRÉSENCE (#492 arbitrage 2026-07-17)', () => {
  // Rendu CLIENT (jsdom + createRoot), pas `renderToStaticMarkup` : la fiche lit `useGame` en
  // continu (hero courant, onglet…) — la snapshot SERVEUR de `useSyncExternalStore` ne reflète pas
  // un `useGame.setState` fait juste avant un rendu SSR (le hook lirait l'état INITIAL du store,
  // pas le nôtre) ; un montage client s'abonne réellement au store, comme en jeu.
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let container: HTMLDivElement;
  let root: Root;
  function mount(node: React.ReactElement) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(node); });
    return container.innerHTML;
  }
  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  it('la colonne rend la figurine en pied + Blessures, sans compagnie/caracs/ressources', () => {
    const h = hero();
    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'possessions' });
    const html = mount(<CharacterSheet heroId={h.id} onClose={() => {}} />);
    expect(html).toContain('sheet-portrait');
    expect(html).toContain('charprev'); // figurine en pied (CharacterPreview), plus de médaillon PortraitTile
    expect(html).toContain('Blessures');
    expect(html).not.toContain('frame-row'); // rangée de compagnie MORTE dans la fiche (pt.2)
    expect(html).not.toContain('Caractéristiques'); // caracs SORTIES de la colonne (déplacées en tête de Compétences)
    expect(html).not.toContain('Destin'); // ressources (FateChips) SORTIES de la colonne
  });

  it('colonne au CROQUIS (arbitrage 2026-07-17) : nom, boîte-figurine, barre de vie, barre d’encombrement, race/classe/statut — contrat POSITIF, structure figée', () => {
    const h = hero();
    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'possessions' });
    mount(<CharacterSheet heroId={h.id} onClose={() => {}} />);
    const aside = container.querySelector('.sheet-aside')!;
    const portrait = aside.querySelector('.sheet-portrait')!;

    // 1. Nom en tête, AU-DESSUS du cadre-figurine.
    const h3 = portrait.querySelector('h3')!;
    expect(h3.textContent).toBe('H');
    // 2. Cadre-figurine grand format, inchangé.
    const figTile = portrait.querySelector('.fig-tile.hero')!;
    expect(figTile).toBeTruthy();
    expect(h3.compareDocumentPosition(figTile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // le nom précède le cadre
    // 3/4. Barre de vie PUIS barre d'encombrement — VRAIES barres lisses `LifeBar` (arbitrage
    // 2026-07-17 : « pourquoi la version crantée ? »), aucun arc SVG (VitalArc mort).
    expect(aside.querySelector('.vital-arc')).toBeNull();
    const bars = portrait.querySelectorAll('.life-bar');
    expect(bars.length).toBe(2);
    expect(bars[0].querySelector('.life-bar__label')?.textContent).toBe('Blessures');
    expect(bars[0].querySelector('.life-bar__value')?.textContent).toBe('12/12');
    expect(bars[1].querySelector('.life-bar__label')?.textContent).toBe('Encombrement');
    expect(bars[1].querySelector('.life-bar__value')?.textContent).toBe('0/6');
    // 5. Rangées race / carrière / statut / bourse (Lot 3 T-bourse #531 : la Bourse PERSO
    // s'affiche en permanence dans la colonne d'identité, sur tous les onglets).
    const rows = portrait.querySelectorAll('.sheet-idrow');
    expect(rows.length).toBe(4);
    expect(rows[0].querySelector('.sheet-idrow-label')?.textContent).toBe('Race');
    expect(rows[0].textContent).toContain('Humain');
    expect(rows[1].querySelector('.sheet-idrow-label')?.textContent).toBe('Carrière');
    expect(rows[1].textContent).toContain('niv. 1');
    expect(rows[2].querySelector('.sheet-idrow-label')?.textContent).toBe('Statut');
    expect(rows[2].querySelector('.metal-status')).toBeTruthy();
    expect(rows[3].querySelector('.sheet-idrow-label')?.textContent).toBe('Bourse');
    // Structure figée : SANS alarme ni Soins éligibles, l'aside n'a qu'UN enfant direct (le bloc
    // portrait) — un enfant de plus signalerait un ajout non voulu (scroll de fait).
    expect(aside.children.length).toBe(1);
  });

  it('les jauges VIVENT : re-rendent au switch de héros et après un soin (valeur/teinte suivent `hero.wounds`)', () => {
    const blesse = { ...hero(), wounds: { current: 4, max: 12 } } as Combatant;
    useGame.setState({ party: [blesse], battle: null, sheetId: blesse.id, sheetTab: 'possessions' });
    mount(<CharacterSheet heroId={blesse.id} onClose={() => {}} />);
    let vie = container.querySelector('.sheet-aside .life-bar');
    expect(vie?.querySelector('.life-bar__value')?.textContent).toBe('4/12');
    expect(vie?.getAttribute('data-tone')).toBe('danger'); // 4/12 = 33 % <= seuil 34 %

    // Soin (mutation directe du party courant) : la fiche relit `useGame`, la jauge doit suivre.
    act(() => {
      useGame.setState((s) => ({ party: s.party.map((c) => (c.id === blesse.id ? { ...c, wounds: { current: 9, max: 12 } } : c)) }));
    });
    vie = container.querySelector('.sheet-aside .life-bar');
    expect(vie?.querySelector('.life-bar__value')?.textContent).toBe('9/12');
    expect(vie?.getAttribute('data-tone')).toBe('ok'); // 9/12 = 75 % > seuil 67 %
  });

  it('surcharge qui CRIE (arbitrage 2026-07-17) : Enc. > max → piste pleine, surplus affiché, teinte danger', () => {
    const h = {
      ...hero(),
      items: [{ uid: 'sac', label: 'Fourniment', kind: 'misc', qualities: [], enc: 15, equipped: false }],
    } as unknown as Combatant;
    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'possessions' });
    mount(<CharacterSheet heroId={h.id} onClose={() => {}} />);
    const bars = container.querySelectorAll('.sheet-aside .life-bar');
    const enc = bars[1];
    expect(enc.getAttribute('data-overflow')).toBe('');
    expect(enc.getAttribute('data-tone')).toBe('danger');
    expect(enc.querySelector('.life-bar__value')?.textContent).toBe('15/6 · +9');
    expect((enc.querySelector('.life-bar__fill') as HTMLElement).style.width).toBe('100%');
  });

  it('tête de l’onglet Compétences & Talents : CharStatsGrid + Mouvement + Destin·Chance/Résilience·Détermination', () => {
    const h = { ...hero(), fate: 2, fortune: 1, resilience: 1, resolve: 0 } as Combatant;
    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'competences' });
    const html = mount(<CharacterSheet heroId={h.id} onClose={() => {}} />);
    expect(html).toContain('char-stats'); // CharStatsGrid
    expect(html).toContain('Mouvement');
    expect(html).toContain('Destin');
  });

  it('premier onglet = Compétences & Talents (ordre + défaut d’ouverture, arbitrage 2026-07-17)', () => {
    const h = hero();
    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: null, sheetAlarmsSeen: {} });
    const html = mount(<CharacterSheet heroId={h.id} onClose={() => {}} />);
    const tabnav = container.querySelector('.sheet-tabnav')!;
    const firstTab = tabnav.querySelector('[role="tab"]');
    expect(firstTab?.textContent).toContain('Compétences & Talents');
    // Défaut (aucune alarme sur ce héros sain) : l'onglet Compétences & Talents s'affiche, pas État.
    expect(html).toContain('char-stats');
    expect(firstTab?.getAttribute('aria-selected')).toBe('true');
  });

  it('règle d’atterrissage inchangée : une alarme NOUVELLE force toujours l’onglet État', () => {
    const alarme = { ...hero(), corruption: 3 } as Combatant;
    useGame.setState({ party: [alarme], battle: null, sheetId: alarme.id, sheetTab: null, sheetAlarmsSeen: {} });
    mount(<CharacterSheet heroId={alarme.id} onClose={() => {}} />);
    expect(useGame.getState().sheetTab).toBe('etat');
  });

  it('gangrène du cadre : `data-corruption` posé selon le seuil de Corruption', () => {
    const clean = hero();
    useGame.setState({ party: [clean], battle: null, sheetId: clean.id, sheetTab: 'etat' });
    const htmlClean = mount(<CharacterSheet heroId={clean.id} onClose={() => {}} />);
    expect(htmlClean).toContain('data-corruption="none"');

    // BFM/BE = 30 → bonus 3 chacun, seuil = 6 : 3 Points de Corruption reste SOUS le seuil (« ronge »).
    const corrupted = { ...hero(), corruption: 3 } as Combatant;
    useGame.setState({ party: [corrupted], battle: null, sheetId: corrupted.id, sheetTab: 'etat' });
    const htmlCorrupted = mount(<CharacterSheet heroId={corrupted.id} onClose={() => {}} />);
    expect(htmlCorrupted).toContain('data-corruption="ronge"');
  });

  it('Prothèses : la rangée d’Avancement porte le LIBELLÉ DÉCLARÉ du palier (LDB 73, `prosthesisTraining`)', () => {
    // #1318 E4/C-γ : l'écran ne nomme plus aucune prothèse ni aucun palier — il rend `label` de la donnée.
    const tiers = findTrappingById('fausse-jambe')!.prosthesisTraining!;
    expect(tiers.map((t) => t.label)).toEqual(['récupérer le dernier Point de Mouvement perdu', 'réapprendre à utiliser Esquive']);
    const porteur = {
      ...hero(),
      items: [{ uid: 'fj', trappingId: 'fausse-jambe', label: 'Fausse jambe', kind: 'misc', subType: 'protheses', qualities: [], enc: 2, equipped: true }],
    } as unknown as Combatant;
    const html = renderToStaticMarkup(<AdvancementPanel hero={porteur} />);
    expect(html).toContain('Fausse jambe — récupérer le dernier Point de Mouvement perdu');
  });

  it('badges de zone `FigTile.zoneBadges` : PA d’armure en Possessions (seules les zones COUVERTES, ton `sang` si l’armure portée est entamée)', () => {
    const h = {
      ...hero(),
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 2, jambeG: 0, jambeD: 0 },
      items: [{ uid: 'a1', label: 'Cotte de mailles', kind: 'armor', qualities: [], enc: 2, equipped: true, pa: 2, locs: ['corps'], damageTaken: 1 } as never],
    } as unknown as Combatant;
    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'possessions' });
    mount(<CharacterSheet heroId={h.id} onClose={() => {}} />);
    const aside = container.querySelector('.sheet-aside')!;
    const badges = aside.querySelectorAll('.fig-zone-badge');
    // Une zone à PA 0 ne dit rien (six « 0 » = bruit, #492 juge vision 2026-07-17) — seule la
    // Localisation RÉELLEMENT couverte (Corps) porte un badge.
    expect(badges.length).toBe(1);
    const corps = aside.querySelector('.fig-zone-badge[data-loc="corps"]')!;
    expect(corps.getAttribute('data-tone')).toBe('sang'); // armure entamée (damageTaken > 0)
    expect(corps.textContent).toBe('2');
    expect(aside.querySelector('.fig-zone-badge[data-loc="tete"]')).toBeNull(); // PA 0 → aucun badge
  });

  it('badges de zone : critiques/séquelles en État (zones TOUCHÉES seulement) — ABSENTS des autres onglets', () => {
    const h = { ...hero(), critEntriesSuffered: ['blessure-spectaculaire'] } as unknown as Combatant;

    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'etat' });
    mount(<CharacterSheet heroId={h.id} onClose={() => {}} />);
    let aside = container.querySelector('.sheet-aside')!;
    const badges = aside.querySelectorAll('.fig-zone-badge');
    expect(badges.length).toBe(1); // seule la Localisation touchée (Tête, `blessure-spectaculaire`)
    expect(badges[0].getAttribute('data-loc')).toBe('tete');
    expect(badges[0].getAttribute('data-tone')).toBe('sang');

    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'possessions' });
    mount(<CharacterSheet heroId={h.id} onClose={() => {}} />);
    aside = container.querySelector('.sheet-aside')!;
    // Possessions parle PA, jamais le compte de critiques — et ce héros ne porte aucune armure
    // (PA 0 partout) : zéro badge, pas six « 0 » (#492 juge vision 2026-07-17).
    expect(aside.querySelectorAll('.fig-zone-badge').length).toBe(0);

    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'competences' });
    mount(<CharacterSheet heroId={h.id} onClose={() => {}} />);
    aside = container.querySelector('.sheet-aside')!;
    expect(aside.querySelectorAll('.fig-zone-badge').length).toBe(0); // corps nu ailleurs
  });
});

describe('Onglet Possessions — registre `Band`/`PlaqueRow` (#492 lot POSSESSIONS B)', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let container: HTMLDivElement;
  let root: Root;
  function mount(node: React.ReactElement) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(node); });
    return container;
  }
  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  /** Héros avec un sac (Armes/Armures/Divers), un contenant + objet imbriqué, et une prothèse portée
   *  (crochet non maîtrisé) — de quoi peupler les 3 groupes ET vérifier le sort des prothèses. */
  const heroWithItems = (): Combatant =>
    ({
      ...hero(),
      items: [
        { uid: 'w1', label: 'Épée', kind: 'melee', qualities: [], enc: 1, equipped: false },
        { uid: 'a1', label: 'Cotte de mailles', kind: 'armor', qualities: [], enc: 2, equipped: true, pa: 2, locs: ['corps'] },
        { uid: 'bag1', label: 'Sac à dos', kind: 'misc', qualities: [], enc: 1, equipped: false, container: { capacity: 10 } },
        { uid: 'n1', label: 'Gourde', kind: 'misc', qualities: [], enc: 1, equipped: false, inside: 'bag1' },
        { uid: 'p1', label: 'Crochet', trappingId: 'crochet', subType: 'protheses', kind: 'misc', qualities: [], enc: 0, equipped: true },
      ],
      loadouts: [{ id: 'lo1', main: null, off: null }],
      activeLoadoutId: 'lo1',
    }) as unknown as Combatant;

  it('la plaque ENC. de tête MEURT (arbitrage en vol 2026-07-17) — aucun remplaçant dans ce geste', () => {
    const h = heroWithItems();
    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'possessions' });
    const html = mount(<CharacterSheet heroId={h.id} onClose={() => {}} />).innerHTML;
    expect(html).not.toContain('sheet-vitals');
    expect(html).not.toContain('title="Encombrement"');
  });

  it('groupes comptés (Band) : Armes/Armures & protections/Divers présents avec leur compte', () => {
    const h = heroWithItems();
    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'possessions' });
    const text = mount(<CharacterSheet heroId={h.id} onClose={() => {}} />).textContent ?? '';
    expect(text).toContain('Armes');
    expect(text).toContain('Armures & protections');
    expect(text).toContain('Divers');
  });

  it('une `PlaqueRow` par objet non rangé, l’objet imbriqué reste visible sous son contenant', () => {
    const h = heroWithItems();
    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'possessions' });
    const el = mount(<CharacterSheet heroId={h.id} onClose={() => {}} />);
    const rows = el.querySelectorAll('.plaque-row');
    // 5 objets déclarés → 5 rangées (le rangé `n1` reste visible, imbriqué sous `bag1`).
    expect(rows.length).toBe(5);
    expect(el.innerHTML).toContain('Gourde');
    expect(el.querySelector('.inv-nested')?.innerHTML).toContain('Gourde');
  });

  it('ZÉRO `<button>` dans les rangées non élues ; élire une rangée déplie sa barre d’actions EN PLACE', () => {
    const h = heroWithItems();
    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'possessions' });
    const el = mount(<CharacterSheet heroId={h.id} onClose={() => {}} />);
    const inventory = el.querySelector('.sheet-inventory')!;
    // Avant toute élection : chaque `.inv-item` ne porte QUE le bouton de sa propre `PlaqueRow`
    // (l'élection elle-même), aucune barre d'actions dépliée.
    expect(inventory.querySelectorAll('.inv-actionbar').length).toBe(0);
    for (const row of inventory.querySelectorAll('.inv-item')) {
      expect(row.querySelectorAll(':scope > button:not(.plaque-row)').length).toBe(0);
    }
    // Élire la Cotte de mailles (équipée) : SA barre d'actions se déplie, les autres restent fermées.
    const armorRow = [...inventory.querySelectorAll('.plaque-row')].find((r) => r.textContent?.includes('Cotte de mailles'))!;
    act(() => { (armorRow as HTMLButtonElement).click(); });
    expect(inventory.querySelectorAll('.inv-actionbar').length).toBe(1);
    const actionBar = inventory.querySelector('.inv-actionbar')!;
    expect(actionBar.textContent).toContain('Équipé');
    expect(actionBar.querySelectorAll('button').length).toBeGreaterThan(0);
  });

  it('badge « Équipé » présent une seule fois (pas de doublon damier ⇄ liste, classe du bug « Veste ×2 »)', () => {
    const h = heroWithItems();
    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'possessions' });
    const el = mount(<CharacterSheet heroId={h.id} onClose={() => {}} />);
    // La liste ne rend la Cotte de mailles qu'UNE fois (une seule `PlaqueRow` « Cotte de mailles »).
    const rows = [...el.querySelectorAll('.plaque-row')].filter((r) => r.textContent?.includes('Cotte de mailles'));
    expect(rows.length).toBe(1);
  });

  it('les prothèses N’ONT PLUS d’achat PX dans la liste — l’onglet Avancement les porte', () => {
    const h = { ...heroWithItems(), xp: 1000 } as Combatant;
    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'possessions' });
    const possessionsHtml = mount(<CharacterSheet heroId={h.id} onClose={() => {}} />).innerHTML;
    expect(possessionsHtml).not.toContain('100 PX');

    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'avancement' });
    const advHtml = mount(<CharacterSheet heroId={h.id} onClose={() => {}} />).innerHTML;
    expect(advHtml).toContain('Prothèses');
    expect(advHtml).toContain('Crochet');
    // Rachat GRADUÉ du Crochet (LDB 73 l.19) : le palier ACHETABLE est la 1re tranche de 100 PX.
    expect(advHtml).toContain('100 PX');
  });

  it('la Bourse PERSO (montant en CO/pistoles-sous) reste visible sur TOUT onglet — pas seulement Possessions (Lot 3 T-bourse #531)', () => {
    const h = {
      ...heroWithItems(),
      items: [...(heroWithItems().items ?? []), { uid: 'bourse1', label: 'Bourse', trappingId: 'bourse', kind: 'misc', qualities: [], enc: 0, equipped: true, money: { gold: 2, silver: 0, brass: 0 } }],
    } as Combatant;
    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'competences' });
    const el = mount(<CharacterSheet heroId={h.id} onClose={() => {}} />);
    const row = [...el.querySelectorAll('.sheet-idrow')].find((r) => r.querySelector('.sheet-idrow-label')?.textContent === 'Bourse')!;
    expect(row).toBeTruthy();
    expect(row.querySelector('.coin-gold')?.textContent).toBe('2 CO');
  });
});

describe('BackgroundPanel (rendu)', () => {
  it('affiche la bio en lecture seule (âge) et les champs éditables (motivation + ambitions)', () => {
    const html = renderToStaticMarkup(<BackgroundPanel hero={hero()} />);
    // Bio lecture seule : âge présent → affiché ; les champs absents (yeux/cheveux) ne sont pas inventés.
    expect(html).toContain('27 ans');
    expect(html).not.toContain('Yeux');
    // Champs éditables (Motivation + Ambitions court/long) avec leurs valeurs.
    expect(html).toContain('Motivation');
    expect(html).toContain('Devoir'); // value de l'<input> motivation
    expect(html).toContain('Survivre à la prochaine campagne'); // ambition court terme
    expect(html).toContain('Commander sa propre compagnie'); // ambition long terme
    expect(html).toContain('Modifiable hors combat');
  });
});

/**
 * ONGLET MAGIE — LA FICHE NE JOUE PLUS EN COMBAT (spec HUD zone 6). Incanter, Focaliser et Dissiper
 * sont des gestes du TOUR : ils ont UNE surface exhaustive, l'écran des capacités. En combat la fiche
 * garde sa LECTURE et porte un RENVOI, sous LA MÊME PORTE que le bouton du rail
 * (`refusEcranCapacites`) — jamais un drapeau armé qu'aucun écran n'honorerait. Hors combat, rien ne
 * change : l'incantation hors combat reste à la fiche (couture D, `oocCastSpell`).
 */
describe('Onglet magie — la fiche RENVOIE en combat, elle JOUE hors combat', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let container: HTMLDivElement;
  let root: Root;
  function mount(node: React.ReactElement) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(node); });
    return container;
  }
  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    useGame.setState({ battle: null, ecranCapacitesOuvert: false });
  });

  /** Un incantateur avec deux sorts mémorisés — de quoi peupler la rubrique. */
  const magicien = (): Combatant =>
    ({ ...hero(), id: 'm1', spells: ['benediction-de-bataille', 'benediction-de-chance'] }) as unknown as Combatant;

  const boutonsDeSort = () => [...container.querySelectorAll('.spell-actions button')];

  it('HORS COMBAT : les gestes d’incantation de la fiche sont INTACTS, aucun renvoi', () => {
    const h = magicien();
    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'magie' });
    mount(<CharacterSheet heroId={h.id} onClose={() => {}} />);
    expect(boutonsDeSort().length, 'la fiche ne joue plus hors combat').toBeGreaterThan(0);
    expect(container.querySelector('[data-ecran="capacites"]'), 'un renvoi hors combat : la fiche y joue déjà').toBeNull();
  });

  it('EN COMBAT, à son tour : plus AUCUN bouton d’action, un renvoi OFFERT vers l’écran', () => {
    const h = magicien();
    h.pos = { x: 1, y: 1 };
    useGame.setState({
      party: [h], sheetId: h.id, sheetTab: 'magie',
      battle: { combatants: [h], order: [h.id], baseOrder: [h.id], turn: 0, round: 1, action: null,
        selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false,
        log: [], over: null } as never,
    });
    let ferme = 0;
    mount(<CharacterSheet heroId={h.id} onClose={() => { ferme++; }} />);
    expect(boutonsDeSort().length, 'la fiche joue encore un geste de tour en combat').toBe(0);
    const renvoi = container.querySelector('[data-ecran="capacites"] button') as HTMLButtonElement;
    expect(renvoi, 'aucun renvoi vers l’écran des capacités').toBeTruthy();
    expect(renvoi.getAttribute('aria-disabled'), 'le renvoi est refusé à son PROPRE tour').toBeNull();
    act(() => { renvoi.click(); });
    expect(ferme, 'le renvoi n’a pas refermé la fiche').toBe(1);
    expect(useGame.getState().ecranCapacitesOuvert, 'le renvoi n’a pas ouvert l’écran').toBe(true);
  });

  it('EN COMBAT, au tour d’un AUTRE : le renvoi REFUSE avec sa raison, et n’arme rien', () => {
    const h = magicien();
    h.pos = { x: 1, y: 1 };
    const foe = { ...hero(), id: 'e1', kind: 'enemy', pos: { x: 3, y: 3 } } as unknown as Combatant;
    useGame.setState({
      party: [h], sheetId: h.id, sheetTab: 'magie',
      battle: { combatants: [h, foe], order: [h.id, foe.id], baseOrder: [h.id, foe.id], turn: 1, round: 1,
        action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
        acted: false, log: [], over: null } as never,
    });
    let ferme = 0;
    mount(<CharacterSheet heroId={h.id} onClose={() => { ferme++; }} />);
    const renvoi = container.querySelector('[data-ecran="capacites"] button') as HTMLButtonElement;
    expect(renvoi, 'aucun renvoi rendu').toBeTruthy();
    expect(renvoi.getAttribute('aria-disabled'), 'le renvoi s’offre alors que l’écran refuserait').toBe('true');
    // La RAISON existe et est atteignable (copie hors écran de `GatedAction`, liée par aria-describedby).
    const raison = container.querySelector(`#${renvoi.getAttribute('aria-describedby')}`);
    expect(raison?.textContent, 'le refus ne dit pas pourquoi').toBeTruthy();
    act(() => { renvoi.click(); });
    expect(useGame.getState().ecranCapacitesOuvert, 'le renvoi a armé un drapeau qu’il ne peut pas honorer').toBe(false);
    expect(ferme, 'le renvoi a fermé la fiche pour rien').toBe(0);
  });
});

/**
 * LE RENVOI EST CELUI DU PORTEUR QUI JOUE — l'écran des capacités montre l'ACTIF : ouvrir depuis la
 * fiche d'un AUTRE héros donnerait les capacités d'un tiers. La porte le refuse (même mesure unique,
 * `refusEcranCapacites(state, heroId)`).
 */
describe('Onglet magie — le renvoi n’ouvre que pour le porteur qui a la main', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let container: HTMLDivElement;
  let root: Root;
  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    useGame.setState({ battle: null, ecranCapacitesOuvert: false });
  });

  it('fiche de Wilhelm pendant le tour de Gunnar : le renvoi REFUSE et n’ouvre rien', () => {
    const gunnar = ({ ...hero(), id: 'g1', label: 'Gunnar', pos: { x: 1, y: 1 } }) as unknown as Combatant;
    const wilhelm = ({ ...hero(), id: 'w1', label: 'Wilhelm', pos: { x: 2, y: 2 },
      spells: ['benediction-de-bataille'] }) as unknown as Combatant;
    useGame.setState({
      party: [gunnar, wilhelm], sheetId: wilhelm.id, sheetTab: 'magie',
      battle: { combatants: [gunnar, wilhelm], order: [gunnar.id, wilhelm.id], baseOrder: [gunnar.id, wilhelm.id],
        turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0,
        movedPreAction: false, acted: false, log: [], over: null } as never,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<CharacterSheet heroId={wilhelm.id} onClose={() => {}} />); });
    const renvoi = container.querySelector('[data-ecran="capacites"] button') as HTMLButtonElement;
    expect(renvoi, 'aucun renvoi rendu sur la fiche').toBeTruthy();
    expect(renvoi.getAttribute('aria-disabled'), 'la fiche d’un autre héros ouvre l’écran de l’actif').toBe('true');
    act(() => { renvoi.click(); });
    expect(useGame.getState().ecranCapacitesOuvert, 'l’écran s’est ouvert sur les capacités d’un tiers').toBe(false);
  });
});
