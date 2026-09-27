import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CharacterCreator, CareerScreen, CharScreen, SpeciesRaceScreen, SkillsScreen, StarScreen, TrappingsScreen, DetailsScreen, PresentationScreen, PettySpellsSection, careerLevelTalentsTitle, TrappingChoiceSlot } from './CharacterCreator';
import { trappingRefLabel, type TrappingRef } from '../../data';
import { CreatorSummary } from './CreatorSummary';
import {
  newDraft,
  withSpecies,
  withCareer,
  rollDraftSpecies,
  withSpeciesSkillTier,
  speciesSkillRefs,
  speciesSkillTier,
  speciesSkillStep,
  SPECIES_SKILLS_PLUS5,
  SPECIES_SKILLS_PLUS3,
  validateStep,
  rollDraftWealth,
  rollDraftChars,
  rollDraftTalents,
  stepIds,
  draftLevel,
} from './draft';
import { species as allSpecies, careersForSpecies, findCareerById } from '../../data';
import { CHAR_LABELS } from '../../engine/types';

// Défauts dérivés (page blanche : plus de pré-tiré dans newDraft) — 1ʳᵉ espèce LDB + sa 1ʳᵉ carrière.
const SP = allSpecies.find((s) => s.source.book === 'livre-de-base')!;
const CAREER = careersForSpecies(SP.refCareer)[0]!;
const ready = () => withCareer(withSpecies(newDraft(7), SP.id), CAREER.id);

/** L'option `label` d'une grille est-elle MISE EN AVANT (`btn-primary`) ? Le contrat est la présence
 *  de la classe, jamais l'ORDRE des classes — `OptionChooser` compose `grid` et `actions` par la même
 *  fonction depuis #1689 T2, et l'ordre y a changé sans que rien de visible ne bouge. */
const estPrimary = (html: string, label: string) =>
  (html.match(new RegExp(`<button class="([^"]*)"[^>]*>${label}`))?.[1] ?? '').split(' ').includes('btn-primary');

describe('CharacterCreator (assistant) — ossature 2 zones + page blanche', () => {
  it('étape 1 (Race, #393 P1) : ossature 2 ZONES « Atelier du scribe » (CreatorStepFrame) ; aucune race pré-tirée', () => {
    const html = renderToStaticMarkup(<CharacterCreator />);
    // Barre d'étapes — le signe astral (ADE II, règle activée par défaut) insère une étape après Caractéristiques.
    expect(html).toContain('1. Race');
    expect(html).toContain('4. Signe astral');
    expect(html).toContain('8. Présentation');
    // Étape 1 : gabarit UNIQUE (CreatorStepFrame → MasterDetail), pas de fiche vivante à ce stade.
    expect(html).toContain('creator-step');
    expect(html).toContain('master-detail-list');
    expect(html).toContain('class="split creator-step"'); // MasterDetail composé sur `Split` (couche LAYOUT)
    expect(html).not.toContain('creator-summary');
    // Page blanche : AUCUNE race sélectionnée au montage (fin du fantôme pré-tiré).
    expect(html).not.toContain('fig-tile sel');
    // Encrier de tirage RACE en rangée UNIQUE avec la recherche (#393 P3) : plus de titre de section
    // « Aux dés » ni de rangée d'aide séparée — le sous-titre de l'encrier porte la règle.
    expect(html).not.toContain('>Aux dés<');
    expect(html).toContain('Tirer aux dés — d100');
    expect(html).toContain('sa race au hasard : ');
    expect(html).toContain('+20 PX de création');
    expect(html).toContain('(garder le tirage)');
    expect(html).toContain('creator-pick-toolbar');
    // Recherche + grille de 7 GRANDES CARTES DE RACE (une par famille, #393 P2)
    expect(html).toContain('Rechercher une race');
    expect(html).toContain('role="listbox"');
    expect(html).toContain('role="option"');
    for (const s of ['Humains', 'Nains', 'Halflings', 'Hauts elfes', 'Elfes sylvains']) {
      expect(html).toContain(s);
    }
    // Validation : « Suivant » gardé tant que la race n'est pas choisie
    expect(html).toContain('Choisissez votre race.');
    expect(html).toContain('Suivant →');
  });

  it('remplissage progressif : une race choisie ouvre son détail (DetailFrame) et se sélectionne (grille)', () => {
    const html = renderToStaticMarkup(<SpeciesRaceScreen d={withSpecies(newDraft(7), SP.id)} setD={() => {}} />);
    expect(html).toContain('fig-tile sel'); // carte de FAMILLE sélectionnée (FigTile, #430 phase 2)
    expect(html).toContain('detail-frame'); // détail rendu (DetailFrame)
    expect(html).toContain('Caractéristiques de base'); // profil chiffré (CodexSections)
    expect(html).toContain('Compétences de race');
    // Humains a 8 lignées : chips de lignée EN TÊTE du cadre de détail (`topper`, #393 P3) —
    // jamais un sibling posé à côté du cadre.
    expect(html).toMatch(/<div class="detail-frame"><div role="radiogroup"[^>]*creator-race-lineages/);
    expect(html).toMatch(/creator-race-lineage sel"[^>]*>Reiklander/);
  });

  it('#393 P4 — après le tirage, le mur de boutons meurt : le résultat vit dans l\'encrier, PLUS de badge par chip de lignée (l\'éligibilité vit dans l\'encrier + le liseré de la carte de famille)', () => {
    const rolled = rollDraftSpecies(withSpecies(newDraft(7), SP.id));
    const html = renderToStaticMarkup(<SpeciesRaceScreen d={rolled} setD={() => {}} />);
    // Encrier « résolu » (rendu laiton) : le jet et sa borne y vivent seuls, sans bouton de tirage ni
    // grille d'options de borne à l'écran.
    expect(html).toContain('dicewell done');
    expect(html).toMatch(/Jet : <b>\d+<\/b> — borne \w+/);
    expect(html).not.toMatch(/\(\+20 PX\)<\/(?:span|button)>\s*<\/button>/); // aucun libellé de bouton de borne à l'écran
    // Mort du badge « +20 PX » par chip de lignée (#393 P4) — la borne couvre une famille entière,
    // l'éligibilité vit dans l'encrier rendu (ci-dessus) + le liseré `.rolled`/`.sel` de la carte de
    // famille (surfaces existantes déjà couvertes par les autres assertions de ce fichier).
    expect(html).not.toContain('xp-badge');
  });

  it('étape 1 — grille de 7 CARTES DE RACE (listbox/option) + recherche, sans grille facettée', () => {
    const html = renderToStaticMarkup(<SpeciesRaceScreen d={newDraft(7)} setD={() => {}} />);
    expect(html).toContain('role="listbox"'); // grille de sélection a11y
    expect(html).toContain('role="option"');
    expect(html).toContain('creator-race-grid');
    expect(html).not.toContain('pick-grid'); // mort du call-site Race de FacetedPickGrid
    expect(html).not.toContain('tabs tabs-sub'); // plus de facettes de famille (grille de cartes directe)
  });

  it('étape 2 — Carrière (#393 P2) : ossature 2 ZONES « Atelier du scribe » (CreatorStepFrame), sections par classe + recherche + encrier', () => {
    const html = renderToStaticMarkup(<CareerScreen d={withSpecies(newDraft(7), SP.id)} setD={() => {}} />);
    expect(html).toContain('creator-step');
    expect(html).toContain('master-detail-list');
    expect(html).toContain('class="split creator-step"'); // MasterDetail composé sur `Split` (couche LAYOUT)
    expect(html).toContain('Rechercher une carrière'); // SearchFilterField canonique en tête
    expect(html).toContain('Tirer aux dés — d100');
    expect(html).toContain('role="listbox"'); // GroupedPickGrid (sections par classe)
    expect(html).toContain('gpg-section');
    // Les sections viennent des données (classes.json), pas d'une liste en dur.
    for (const cl of ['Guerriers', 'Lettrés', 'Roublards']) expect(html).toContain(cl);
    expect(html).not.toContain('pick-facets'); // mort du call-site Carrière de FacetedPickGrid
  });

  it('étape 2 — une carrière choisie ouvre son détail (DetailFrame : MetalStatus + CareerPath) et se sélectionne dans la grille', () => {
    const soldat = findCareerById('soldat')!;
    const html = renderToStaticMarkup(<CareerScreen d={withCareer(withSpecies(newDraft(7), SP.id), 'soldat')} setD={() => {}} />);
    expect(html).toContain('fig-tile sel'); // tuile de la carrière tirée = active
    expect(html).toContain(soldat.label); // et visible (sa section de classe est ouverte, scroll interne)
    expect(html).toMatch(/aria-selected="true"/);
    expect(html).toContain('detail-frame');
    expect(html).toContain('metal-status'); // statut Bronze/Argent/Or du niveau 1
    expect(html).toContain('cc-path'); // CareerPath — chemin d'évolution
  });

  it('PX en direct : accepter le tirage de race incrémente le compteur PX de la fiche vivante (+20)', () => {
    const d = rollDraftSpecies(withSpecies(newDraft(7), SP.id));
    const html = renderToStaticMarkup(<CreatorSummary d={d} />);
    expect(html).toContain('PX bonus de création');
    expect(html).toContain('Espèce +20'); // LDB 04 : race tirée et gardée → contribution EN DIRECT
  });

  it('page blanche : AUCUN PX bonus tant qu\'aucune race n\'est choisie', () => {
    const html = renderToStaticMarkup(<CreatorSummary d={newDraft(7)} />);
    expect(html).toContain('PX bonus de création : <b>+0</b>'); // fin du +50 fantôme (2d10 gardé par défaut)
  });

  it('étape 4 — Magie mineure choisie : la section des sorts inclus apparaît (compteur n/BFM)', () => {
    const d = { ...withCareer(withSpecies(newDraft(7), SP.id), 'sorcier'), careerTalent: { id: 'magie-mineure' } };
    const html = renderToStaticMarkup(<PettySpellsSection d={d} setD={() => {}} />);
    expect(html).toContain('Sorts de Magie mineure (inclus au Talent)');
    expect(html).toContain('Fléchette'); // la liste des sorts de Magie mineure est proposée
    expect(html).toMatch(/0\/\d/); // compteur de quota (BFM)
    // Sans le Talent : aucune section.
    expect(renderToStaticMarkup(<PettySpellsSection d={withCareer(withSpecies(newDraft(7), SP.id), 'soldat')} setD={() => {}} />)).toBe('');
  });

  it('étape 3 (#393 P3bis, correctif « ni de près, ni de loin, la maquette ») : gabarit DEUX ZONES (panneau + fiche vivante), les 5 Augmentations en bande QtyStepper', () => {
    // Régression : `level.characteristics` est déjà en CharKey ; un mapping libellé→clé renvoyait
    // une liste vide → aucune ligne → « Suivant » jamais actif → création infranchissable.
    const html = renderToStaticMarkup(<CharScreen d={withCareer(withSpecies(newDraft(7), SP.id), 'soldat')} setD={() => {}} />);
    expect(html).toContain('creator-step');
    expect(html).toContain('creator-summary'); // fiche vivante, MÊME composition que Race/Carrière
    expect(html).toContain('Augmentations gratuites');
    expect(html).toContain(CHAR_LABELS['capacite-de-combat']); // Soldat : CC est de carrière → ligne présente
    expect(html).toContain('class="cart-step"'); // QtyStepper canonique — mort du Stepper local
    expect(html).toContain('La méthode');
    expect(html).toContain('Le tirage');
    expect(html).toContain('Destin &amp; Résilience');
  });

  it('étape 3 — la grille centrale (ÉDITION) ne montre PLUS la notation cryptique « B<bonus> » (source unique)', () => {
    const html = renderToStaticMarkup(<CharScreen d={withCareer(withSpecies(newDraft(7), SP.id), 'soldat')} setD={() => {}} />);
    expect(html).toContain('plaque-value'); // le total d'ÉDITION est bien rendu (PlaqueRow, valeur de droite)
    // Plus de double notation « 30B3 » : la fiche vivante porte le RÉSULTAT, le centre la valeur seule.
    expect(html).not.toMatch(/>B\d</);
  });

  it('étape 2 — Compétences/Talents/Caractéristiques du détail affichent des libellés, jamais [object Object]', () => {
    const html = renderToStaticMarkup(<CareerScreen d={withCareer(withSpecies(newDraft(7), SP.id), 'soldat')} setD={() => {}} />);
    expect(html).not.toContain('[object Object]');
    expect(html).toContain('Caractéristiques — Niveau 1');
    expect(html).toContain('Compétences — Niveau 1');
    expect(html).toContain('Talents — un au choix');
  });

  it('bug utilisateur 2026-07-15 — le qualificatif « un au choix » (LDB 05 l.535) ne vaut QUE pour le Niveau de départ, jamais un rang exploré supérieur', () => {
    expect(careerLevelTalentsTitle(1)).toBe('Talents — un au choix');
    expect(careerLevelTalentsTitle(3)).toBe('Talents — Niveau 3');
    expect(careerLevelTalentsTitle(3)).not.toContain('un au choix');
  });

  it('les références Codex de l\'assistant sont INTERACTIVES (clic → fiche en modale, brouillon préservé)', () => {
    const html = renderToStaticMarkup(<SpeciesRaceScreen d={withSpecies(newDraft(7), SP.id)} setD={() => {}} />);
    // Le clic ouvre le Codex en MODALE par-dessus l'assistant (cf. CodexOverlay), sans changer d'écran.
    expect(html).toMatch(/class="codex-ref[^"]*"[^>]*role="button"/); // ≥1 ref cliquable
  });

  it('étape 5 (#393 P4, étalons finale-mock4/5/6-5{a,b,c}) — TROIS sous-écrans (a/b/c, Tabs) ; a. Compétences de race au QtyStepper (fin des cases +5/+3)', () => {
    const html = renderToStaticMarkup(<SkillsScreen d={withCareer(withSpecies(newDraft(7), SP.id), 'soldat')} setD={() => {}} />);
    expect(html).toContain('creator-step');
    expect(html).toContain('creator-summary'); // fiche vivante, MÊME composition que Race/Carrière
    expect(html).toContain('class="tabs creator-skills-tabnav"'); // primitive <Tabs> (jamais un tablist recodé)
    expect(html).toContain('Compétences de race');
    expect(html).toContain('class="cart-step"'); // QtyStepper canonique — même widget que les Compétences de carrière
    // Plus de cases à cocher « +5 »/« +3 » : la double mécanique cases/steppers est morte.
    expect(html).not.toMatch(/type="checkbox"[^>]*\/>\s*\+5/);
    expect(html).not.toContain('>+5<'); // l'ancien libellé de case n'existe plus
  });

  it('étape 5a/5b (#393 amendement 3) — les rangées d\'allocation COMPOSENT la rangée-plaque (même meuble que les caracs de l\'étape 3), le geste vit dans la bande d\'ACTION', () => {
    const d = withCareer(withSpecies(newDraft(7), SP.id), 'soldat');
    for (const [sub, geste] of [['race', 'Répartition par défaut'], ['career', '+5 sur les huit']] as const) {
      const html = renderToStaticMarkup(<SkillsScreen d={d} setD={() => {}} skillsSub={sub} setSkillsSub={() => {}} />);
      expect(html).toContain('class="plaque-row'); // primitive PlaqueRow (plaque-row.css)
      expect(html).toContain('class="plaque-grid"');
      expect(html).toContain('creator-band'); // quotas comptés dans la bande titrée (`.cu-sechead`)
      // Le meuble par-étape est MORT : plus aucune rangée redessinée à la main.
      expect(html).not.toContain('skill-row');
      // La rubrique `.rf` de la planche (carac liée) est portée par la plaque, jamais un `<em>` ad hoc.
      expect(html).toMatch(/class="plaque-name">[^<]*<[^>]*>[\s\S]*?<small>/);
      // Le geste du volet est dans la bande d'ACTION du gabarit (planche : topbar, pas un head de volet).
      expect(html.slice(html.indexOf('creator-slot-action'), html.indexOf('creator-slot-choice'))).toContain(geste);
    }
  });

  it('étape 5c (#393 P4) — Talents : trois lots dérivés de la donnée (fixes / à choisir / tirés au d100), deux bandes de MÊME rang', () => {
    const soldier = withCareer(withSpecies(newDraft(7), SP.id), 'soldat');
    const html = renderToStaticMarkup(<SkillsScreen d={soldier} setD={() => {}} skillsSub="talents" setSkillsSub={() => {}} />);
    // Les deux colonnes sont des bandes titrées (`Band` = `.cu-sechead` de la planche), posées par
    // la primitive globale `Grid` — jamais une 2e grille 2-colonnes de domaine.
    expect(html).toContain('creator-band');
    expect(html).toContain('class="grid"');
    expect(html).toContain('De race');
    expect(html).toContain('De carrière');
    expect(html).toContain('un au choix');
  });

  it('étape 3 — agentivité (#393) : caracs à « — » au montage (0/10, aucun dé chiffré), geste « Tirer aux dés » en bande d\'action ; après le geste : dés, totaux, relance', () => {
    const d = withCareer(withSpecies(newDraft(7), SP.id), 'soldat');
    const before = renderToStaticMarkup(<CharScreen d={d} setD={() => {}} />);
    expect(before).toContain('Tirer les dix jets'); // la carte canonique CreatorDice porte le geste
    expect(before).toContain('class="plaque-value">—<'); // aucune valeur tirée pré-affichée
    expect(before).toContain('0/10 tirées'); // jauge honnête avant le geste
    expect(before).not.toContain('Relancer les dix jets'); // la relance n'existe qu'après un premier tirage
    expect(validateStep(d, 'chars')).toBe('Tirez vos Caractéristiques aux dés.');
    const rolled = rollDraftChars(d);
    const after = renderToStaticMarkup(<CharScreen d={rolled} setD={() => {}} />);
    expect(after).not.toContain('class="plaque-value">—<'); // les dix totaux sont posés
    expect(after).toContain('10/10 tirées');
    expect(after).toContain('Relancer les dix jets (bonus perdus)');
  });

  it('étape 5c — agentivité (#393) : talents d100 VIDES avant le geste (carte « Tirer aux dés » en bande d\'ACTION), chips codex-liées après', () => {
    const soldier = withCareer(withSpecies(newDraft(7), SP.id), 'soldat'); // Reiklander : « 3 Talent aléatoire »
    const talents = (d: Parameters<typeof rollDraftTalents>[0]) =>
      renderToStaticMarkup(<SkillsScreen d={d} setD={() => {}} skillsSub="talents" setSkillsSub={() => {}} />);
    const before = talents(soldier);
    expect(before).toContain('Tirer 3 Talents — d100');
    expect(before).not.toContain('Talents rendus'); // aucun tiré pré-affiché
    // Le geste vit dans la bande d'ACTION du gabarit (planche mock6 : l'encrier remonte en topbar,
    // au-dessus des deux colonnes) — pas dans un head de volet.
    const action = before.slice(before.indexOf('creator-slot-action'), before.indexOf('creator-slot-choice'));
    expect(action).toContain('Tirer 3 Talents — d100');
    const after = talents(rollDraftTalents(soldier));
    expect(after).not.toContain('Tirer 3 Talents — d100');
    expect(after).toContain('— d100 — 3 Talents rendus');
  });

  it('fiche vivante — l\'emplacement des talents aléatoires reste « à tirer » (compte dérivé de la donnée) tant que le geste 5c n\'est pas fait', () => {
    const d = withCareer(withSpecies(newDraft(7), SP.id), 'soldat');
    const atSkills = stepIds().indexOf('skills');
    const before = renderToStaticMarkup(<CreatorSummary d={d} step={atSkills} />);
    expect(before).toContain('3 à tirer au d100 — 5c');
    const after = renderToStaticMarkup(<CreatorSummary d={rollDraftTalents(d)} step={atSkills} />);
    expect(after).not.toContain('à tirer au d100');
  });

  // Le sceau de cire marque LE CHOIX, au moment où il se fait (demande user 2026-07-15, verbatim :
  // « Faudrait un sceau de cire sur la race et la carriere selectionnée je pense ») : il tombe sur la
  // tuile élue dès le clic, sur l'étape COURANTE, et suit le joueur s'il change d'avis. Aucune
  // condition de progression ne le gate — sceller n'est pas une récompense de navigation.
  it('sceau de cire (WaxSeal via FigTile) : la tuile ÉLUE est scellée DÈS LA SÉLECTION — Race et Carrière', () => {
    // Rien d'élu → aucun cachet (ni sur la grille des races, ni sur celle des carrières).
    expect(renderToStaticMarkup(<SpeciesRaceScreen d={newDraft(7)} setD={() => {}} />)).not.toContain('fig-tile-seal');
    const d = withSpecies(newDraft(7), SP.id);
    expect(renderToStaticMarkup(<CareerScreen d={d} setD={() => {}} />)).not.toContain('fig-tile-seal');
    // Élue → scellée SUR L'ÉTAPE, sans avoir eu à la valider ni à y revenir.
    expect(renderToStaticMarkup(<SpeciesRaceScreen d={d} setD={() => {}} />)).toContain('fig-tile-seal');
    const dc = withCareer(d, 'soldat');
    expect(renderToStaticMarkup(<CareerScreen d={dc} setD={() => {}} />)).toContain('fig-tile-seal');
    // Un seul cachet : celui de l'élue (jamais un par tuile de la grille).
    expect(renderToStaticMarkup(<CareerScreen d={dc} setD={() => {}} />).split('fig-tile-seal').length - 1).toBe(1);
  });

  it('draft — palier de Compétence de race (Stepper) : quotas 3×+5 / 3×+3 respectés, + saute +3 quand son quota est plein', () => {
    const base = withCareer(withSpecies(newDraft(7), SP.id), 'soldat');
    const names = speciesSkillRefs(base);
    // On pose 3 Compétences à +3 : le quota +3 est plein, un 4ᵉ +3 est refusé (brouillon inchangé).
    let d = base;
    d = withSpeciesSkillTier(d, names[0], 3);
    d = withSpeciesSkillTier(d, names[1], 3);
    d = withSpeciesSkillTier(d, names[2], 3);
    expect(d.speciesPlus3.length).toBe(SPECIES_SKILLS_PLUS3);
    const refused = withSpeciesSkillTier(d, names[3], 3);
    expect(refused.speciesPlus3.length).toBe(SPECIES_SKILLS_PLUS3); // 4ᵉ +3 refusé (quota plein)
    // Le + d'une Compétence à 0, quota +3 plein mais +5 libre → saute directement à 5.
    expect(speciesSkillStep(d, names[3], 1)).toBe(5);
    // Quota +5 plein (3) : une 4ᵉ Compétence à 0 ne peut monter qu'au palier +3 encore libre.
    let e = withSpeciesSkillTier(base, names[0], 5);
    e = withSpeciesSkillTier(e, names[1], 5);
    e = withSpeciesSkillTier(e, names[2], 5);
    expect(e.speciesPlus5.length).toBe(SPECIES_SKILLS_PLUS5);
    expect(withSpeciesSkillTier(e, names[3], 5).speciesPlus5.length).toBe(SPECIES_SKILLS_PLUS5); // 4ᵉ +5 refusé
    expect(speciesSkillStep(e, names[3], 1)).toBe(3); // +5 plein → le + monte au +3 libre
    expect(speciesSkillTier(e, names[0])).toBe(5);
  });

  it('étape Signe astral (#393 ossature, étalon planche FINALE mock 4) — en-tête + encrier en bande d\'action ; ROUE CÉLESTE a11y (radiogroup) ; DetailFrame sourcé du signe élu', () => {
    const rolled = { ...newDraft(7), star: 'la-grande-croix' };
    const html = renderToStaticMarkup(<StarScreen d={rolled} setD={() => {}} />);
    expect(html).toContain('creator-step'); // ossature 2 zones (MÊME gabarit que les 7 autres pas)
    expect(html).toContain('Signe astral'); // en-tête d'étape (absent avant le lot ossature)
    // L'encrier vit dans la bande d'action (slot requis) — la CARTE de la planche (`.c-dicewell` :
    // plateau de deux faces + libellé d'action à l'impératif), à la topbar du pas, plus une section
    // « Aux dés » à bandeau. Rien d'élu ici ⇒ l'encrier est à l'ATTENTE (rouge, cliquable).
    expect(html).toContain('dicewell act');
    expect(html).toContain('Tirer aux dés — d100');
    expect(html).toContain('rm-die'); // les DEUX faces de dés, visibles au repos (planche `.tray`)
    expect(html).not.toContain('<select value="la-grande-croix"'); // fin du <select> de signe
    expect(html).toContain('celestial-wheel');
    expect(html).toContain('role="radiogroup"');
    expect(html).toMatch(/role="radio"[^>]*aria-checked="true"/); // signe choisi mis en évidence
    expect(html).toContain('detail-frame'); // le sens du signe COMPOSE la primitive, jamais une Section ad hoc
    expect(html).toContain('La Grande Croix');
    expect(html).toContain("Les Archives de l&#x27;Empire — Volume II p. 40"); // tagline SOURCÉE (DetailFrame.sub)
    expect(html).toContain('Astrologie (pur roleplay)');
    // Chips à la DISCIPLINE de la planche (Dates + les modificateurs) : la colonne fait ~330px, une
    // chip de prose l'éclate. `signe` est gravé au moyeu de la roue, `dieux` vit à la fiche du Codex.
    expect(html).toContain('Dates');
    expect(html).not.toContain('>Dieu <'); // plus de chip « Dieu Vallich (forgerons et… (Nordland)) »
  });

  it('étape Signe astral — encrier RÉSOLU (planche) : « Aux dés — d100 » + les faces du d100 tiré + le verdict PX', () => {
    // Le d100 a rendu 10 → La Grande Croix (ADE II 3), et le brouillon le GARDE (star === starRoll).
    const d = { ...newDraft(7), star: 'la-grande-croix', starRoll: 'la-grande-croix', starRollValue: 10 };
    const html = renderToStaticMarkup(<StarScreen d={d} setD={() => {}} />);
    expect(html).toContain('dicewell done'); // carte RÉSOLUE (laiton), plus le bouton rouge d'attente
    expect(html).toContain('Aux dés — d100');
    expect(html).toContain('le ciel a rendu');
    expect(html).toContain('+25 PX conservé'); // tirage gardé ⇒ le gain est ACQUIS (XP_STAR_ROLLED)
    // Les faces gravées sont celles du VRAI score (10 → [1,0]), jamais un chiffre inventé.
    expect(html).toContain('>1</text>');
    expect(html).toContain('>0</text>');
    // Le joueur tourne ensuite la roue à la main : le tirage reste affiché, mais le bonus tombe.
    const libre = renderToStaticMarkup(<StarScreen d={{ ...d, star: 'le-flutiste' }} setD={() => {}} />);
    expect(libre).toContain('+0 PX (choix libre)');
    expect(libre).not.toContain('+25 PX conservé');
  });

  it('roue céleste — VINGT positions (les fourchettes d100 du RAW ADE II 3), pas les 23 entrées : les 4 destins de L\'Étoile du Sorcier partagent la borne 100', () => {
    const html = renderToStaticMarkup(<StarScreen d={newDraft(7)} setD={() => {}} />);
    const nodes = html.match(/role="radio"/g) ?? [];
    expect(nodes.length).toBe(20); // 23 entrées de stars.json → 20 positions de cadran
    // Le nom NU du signe sur le cadran — jamais quatre « L'Étoile du Sorcier (…) » empilés au pôle.
    expect(html).toContain('aria-label="L&#x27;Étoile du Sorcier"');
    expect(html).not.toContain('L&#x27;Étoile du Sorcier (Sixième sens)');
  });

  it('roue céleste — AUCUN libellé escamoté : les vingt noms sont gravés EN CLAIR (la géométrie de la planche remplace les tirets), et rien n\'est élu au montage', () => {
    const html = renderToStaticMarkup(<StarScreen d={newDraft(7)} setD={() => {}} />);
    for (const label of ['Wymund l&#x27;Anachorète', 'Le Trait du Peintre', 'La Chèvre Sauvage', 'Le Danseur']) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain('cw-label-dash'); // l'escamotage est mort
    // Agentivité (#393) : page blanche — aucune aiguille posée avant le geste du joueur.
    expect(html).not.toContain('aria-checked="true"');
    expect(html).toContain('Tirez ou'); // le moyeu invite au geste (l'invite est découpée en tspans)
    expect(html).not.toContain('cw-needle'); // aucune aiguille posée
  });

  it('L\'Étoile du Sorcier — la position déplie ses QUATRE destins en plaques (1d10, ADE II 3) et n\'en impose aucun', () => {
    const elu = { ...newDraft(7), star: 'l-etoile-du-sorcier-seconde-vue' };
    const html = renderToStaticMarkup(<StarScreen d={elu} setD={() => {}} />);
    expect(html).toContain('Quatre destins');
    expect((html.match(/plaque-row/g) ?? []).length).toBe(4);
    expect(html).toMatch(/plaque-row sel/); // le destin élu porte la plaque chaude
    expect(html).toContain('1d10 : 4-6'); // sa fourchette de sous-table
  });

  it('étape Possessions (#393 P5, étalon = planche ratifiée du créateur, écran Possessions) — gabarit DEUX ZONES (panneau + fiche vivante), chips CodexRef + statut + bourse (plus de liste à puces)', () => {
    const d = withCareer(withSpecies(newDraft(7), SP.id), 'soldat');
    const html = renderToStaticMarkup(<TrappingsScreen d={d} setD={() => {}} />);
    expect(html).toContain('creator-step');
    expect(html).toContain('creator-summary'); // fiche vivante, MÊME composition que Race/Carrière
    expect(html).toContain('metal-status'); // statut en tête de panneau
    expect(html).toContain('skill-tags'); // objets en chips
    expect(html).toContain('De carrière');
    expect(html).toContain('De classe');
    expect(html).toContain('La bourse');
    expect(html).not.toContain('trapping-list');
    expect(html).not.toContain('item-meta');
  });

  it('étape Possessions — agentivité (#393 P5, directive coordinateur) : la bourse est VIDE au montage, un geste « Tirer aux dés » la révèle, jamais pré-remplie', () => {
    const d = withCareer(withSpecies(newDraft(7), SP.id), 'soldat');
    expect(d.wealthRoll).toBeFalsy();
    const before = renderToStaticMarkup(<TrappingsScreen d={d} setD={() => {}} />);
    expect(before).toContain('Tirer aux dés — la bourse'); // l'encrier : le GESTE de l'étape est offert
    expect(before).not.toContain('créditée au groupe'); // rien n'est tiré → aucun montant posé
    expect(validateStep(d, 'trappings')).toBe('Tirez la bourse de départ aux dés.');
    const rolled = rollDraftWealth(d);
    expect(rolled.wealthRoll).toBe(true);
    const after = renderToStaticMarkup(<TrappingsScreen d={rolled} setD={() => {}} />);
    expect(after).not.toContain('Tirer aux dés — la bourse'); // le geste est consommé (jet figé)
    expect(after).toContain('créditée au groupe'); // le montant figé est posé
    expect(validateStep(rolled, 'trappings')).toBeNull();
  });

  it('TrappingChoiceSlot `{id, qualityChoice}` (#657 Lot 2) : les 4 Atouts de Fabrication en options, raffine pré-sélectionné sans choix', () => {
    const slot: TrappingRef = { id: 'fleuret', qualityChoice: true };
    const withoutChoice = renderToStaticMarkup(<TrappingChoiceSlot slot={slot} choices={{}} onChoicesChange={() => {}} />);
    for (const label of ['Raffiné', 'Léger', 'Pratique', 'Solide']) expect(withoutChoice).toContain(label);
    // Hints d'effet verbatim (`QualityData.desc`, LDB 60).
    expect(withoutChoice).toContain('signe de statut social');
    expect(withoutChoice).toContain('Point d&#x27;Encombrement');
    expect(withoutChoice).toContain('DR à un Test raté');
    expect(withoutChoice).toContain('Robuste');
    // Raffiné (défaut du résolveur) pré-sélectionné sans que rien ne soit stocké.
    expect(estPrimary(withoutChoice, 'Raffiné')).toBe(true);
    expect(estPrimary(withoutChoice, 'Solide')).toBe(false);

    const key = trappingRefLabel(slot);
    const withChoice = renderToStaticMarkup(<TrappingChoiceSlot slot={slot} choices={{ [key]: 'solide' }} onChoicesChange={() => {}} />);
    expect(estPrimary(withChoice, 'Solide')).toBe(true);
    expect(estPrimary(withChoice, 'Raffiné')).toBe(false);
  });

  it('TrappingChoiceSlot `{choice}` imbriquant un `{id, qualityChoice}` : le picker d\'Atout se déroule SOUS la branche choisie', () => {
    const qualityBranch: TrappingRef = { id: 'fleuret', qualityChoice: true };
    const slot: TrappingRef = { choice: [{ id: 'miroir-a-main' }, qualityBranch] };
    const outerKey = trappingRefLabel(slot);
    const branchKey = trappingRefLabel(qualityBranch);
    // Défaut (aucun choix) : la 1re branche (Miroir) est effective, aucun picker d'Atout imbriqué.
    const beforeBranch = renderToStaticMarkup(<TrappingChoiceSlot slot={slot} choices={{}} onChoicesChange={() => {}} />);
    expect(beforeBranch).not.toContain('Robuste'); // desc de Solide, absent : picker imbriqué non déroulé
    // Branche « Fleuret de qualité » choisie + Atout Solide choisi dans le picker imbriqué.
    const afterBranch = renderToStaticMarkup(
      <TrappingChoiceSlot slot={slot} choices={{ [outerKey]: branchKey, [branchKey]: 'solide' }} onChoicesChange={() => {}} />,
    );
    expect(afterBranch).toContain('Robuste'); // picker imbriqué déroulé
    expect(estPrimary(afterBranch, 'Solide')).toBe(true);
  });

  it('étape Détails (#393 P5, étalon = planche ratifiée du créateur, écran Détails) — gabarit DEUX ZONES, identité + motivation + apparence dans le panneau', () => {
    const d = withCareer(withSpecies(newDraft(7), SP.id), 'soldat');
    const html = renderToStaticMarkup(<DetailsScreen d={d} setD={() => {}} />);
    expect(html).toContain('creator-step');
    expect(html).toContain('creator-summary');
    expect(html).toContain('Nom du personnage');
    expect(html).toContain('Âge');
    expect(html).toContain('Cheveux');
    expect(html).toContain('Motivation'); // BackgroundFields présent dans le panneau
    expect(html).toContain('appear-panel'); // Apparence (AppearancePanel) dans le même panneau
  });

  // #1318 E1 : l'état civil ne pose plus d'`<input type="number">` au site (le wrapper `IdentityField`
  // le faisait, invisible au cliquet xvii). `details.json` ne chiffre que le TIRAGE (`ageBase`/`ageRoll`,
  // `heightBase`/`heightRoll`) : aucun plafond n'est authoré — seul le plancher structurel est posé, et
  // une donnée absente laisse le champ VIDE (jamais un 0 fabriqué qui se persisterait comme un âge).
  it('étape Détails — Âge et Taille : plancher 1, aucun plafond inventé, champ VIDE quand la donnée manque', () => {
    const d = withCareer(withSpecies(newDraft(7), SP.id), 'soldat');
    const html = renderToStaticMarkup(<DetailsScreen d={d} setD={() => {}} />);
    const nombres = [...html.matchAll(/<input[^>]*type="number"[^>]*>/g)].map((m) => m[0]);
    for (const nom of ['Âge', 'Taille (cm)']) {
      const champ = nombres.find((t) => t.includes(`aria-label="${nom}"`));
      expect(champ, `pas de champ nombre pour « ${nom} »`).toBeTruthy();
      expect(champ).toContain('min="1"');
      expect(champ, 'un plafond ici serait une valeur maison non sourcée').not.toContain('max=');
      expect(champ).toContain('value=""');
    }
  });

  it('étape Détails — bouton « Visage → Variante » (appSeed) change réellement le rig rendu (#bug visage figé)', () => {
    const d1 = withCareer(withSpecies(newDraft(7), SP.id), 'soldat');
    const html1 = renderToStaticMarkup(<DetailsScreen d={d1} setD={() => {}} />);
    const d2 = { ...d1, appSeed: (d1.appSeed ?? 0) + 1 };
    const html2 = renderToStaticMarkup(<DetailsScreen d={d2} setD={() => {}} />);
    expect(html1).not.toBe(html2);
  });

  it('étape Présentation (#393 P5, étalon = planche ratifiée du créateur, écran Présentation, renommage « Récapitulatif » → « Présentation ») — mise en scène finale en 3 colonnes, sans texte nu (chips CodexRef)', () => {
    const d = ready();
    const html = renderToStaticMarkup(<PresentationScreen d={d} setD={() => {}} />);
    expect(html).toContain('creator-presentation-screen');
    // La SCÈNE de la planche (`.fin-stage`) et sa lampe — nommée à la
    // migration aux valeurs de l'étalon : le centre n'est pas une colonne de plus, c'est le théâtre.
    expect(html).toContain('presentation-stage');
    expect(html).toContain('presentation-lamp');
    expect(html).toContain('Compétences formées');
    expect(html).toContain('Les jets qui le définissent');
    expect(html).toContain('codex-ref');
    // Statut MÉTALLISÉ (`MetalStatus`, `.st-bronze` de la planche) — jamais le libellé en texte nu.
    expect(html).toContain('metal-status');
    // Le NIVEAU de départ est nommé (« Pamphlétaire (Agitateur) » de la planche) — pas la seule carrière.
    expect(html).toContain(draftLevel(d)!.label);
  });

  it('CreatorSummary : caractéristiques EN DIRECT du héros prévisualisé (talents/augmentations inclus)', () => {
    const d = ready();
    const html = renderToStaticMarkup(<CreatorSummary d={d} />);
    expect(html).toContain('Aventurier');
    expect(html).toContain(findCareerById(d.careerId)!.label); // carrière posée
    expect(html).toContain('Mouvement');
    expect(html).toContain('Destin');
    expect(html).toContain('Bourse');
    // Les 10 caractéristiques sont rendues
    for (const k of ['CC', 'CT', 'FM', 'Soc']) expect(html).toContain(`>${k}<`);
  });
});
