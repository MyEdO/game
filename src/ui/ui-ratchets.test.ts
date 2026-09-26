import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

/**
 * Cliquets d'hygiène UI (#236) — même patron que `combat-hardcode-guard`/`no-emoji-affordance` : une
 * BASELINE gèle, PAR FICHIER, la dette tolérée au recensement ; toute HAUSSE échoue (régression) et
 * toute baseline devenue trop haute (fichier assaini) doit être ABAISSÉE. On ne PURGE pas la dette
 * ici — on interdit sa croissance et on impose la décrue.
 */

const UI = fileURLToPath(new URL('.', import.meta.url)); // src/ui/

/** Un fichier du corpus tel que `readCorpus` le rend : chemin POSIX depuis la racine + texte. */
type Fichier = { rel: string; text: string };

/** Tout `src/ui`, tests compris — UNE clé de corpus pour les seize mesures de ce fichier ; chacune
 *  applique ENSUITE son propre périmètre (extension, exemption nominative), qui fait partie de ce
 *  qu'elle mesure. */
const FICHIERS_UI = (): readonly Fichier[] => readCorpus(['src/ui'], { exts: ['.css', '.ts', '.tsx'], tests: true });
/** Chemin depuis `src/ui/` — la clé des baselines et des exemptions. */
const rel = (f: Fichier) => f.rel.slice('src/ui/'.length);
const nomDe = (f: Fichier) => f.rel.slice(f.rel.lastIndexOf('/') + 1);
const estTest = (f: Fichier) => /\.test\./.test(f.rel);
const estCss = (f: Fichier) => f.rel.endsWith('.css');
const estTsx = (f: Fichier) => f.rel.endsWith('.tsx');

function assertRatchet(counts: Record<string, number>, baseline: Record<string, number>, what: string) {
  const over: string[] = [];
  for (const [f, n] of Object.entries(counts)) {
    const b = baseline[f] ?? 0;
    if (n > b) over.push(`${f} : ${n} (baseline ${b})`);
  }
  expect(over, `Régression ${what} — utiliser le token/la primitive, ou ABAISSER une baseline assainie :\n${over.join('\n')}`).toEqual([]);
  const stale: string[] = [];
  for (const [f, b] of Object.entries(baseline)) {
    const n = counts[f] ?? 0;
    if (n < b) stale.push(`${f} : baseline ${b}, réel ${n}`);
  }
  expect(stale, `Baseline(s) PÉRIMÉE(s) ${what} — abaisser :\n${stale.join('\n')}`).toEqual([]);
}

// ── (iv) Couleurs hex hors tokens `:root` : la palette vit dans `base.css` (§charte-ui). Tout hex
//    dans un AUTRE module CSS est de la dette gelée — le cliquet interdit sa hausse, impose la décrue.
//    Purge #310 : les 12 modules audités sont à ZÉRO — baseline vide, tolérance zéro. ──
const HEX_BASELINE: Record<string, number> = {};

// ── (v) Prix affichés ⇒ `<Coins>`/`formatMoney` : une valeur monétaire interpolée suivie d'une unité
//    nue (` CO`/` PA`/` CA`) dans le JSX est de la dette (illisible, non i18n). `Coins.tsx` définit
//    l'unité (exclu). Migré au #310 (ConditionEditor/EffectList/PortView → formatMoney/<Coins>) : la
//    dette réelle est retombée à zéro — heuristique fail-closed, sans baseline. Les 4 faux positifs
//    restants (CharacterSheet/CharacterCreator/GameOpEditor/EquipmentPanel) ne sont PAS de la monnaie
//    (« PA » = Points d'Armure, LDB) : exemption nominative gelée en dur ci-dessous plutôt qu'en
//    baseline (aucun de ces sites n'est censé approcher zéro un jour).
const PRICE_PA_ARMOR_EXEMPT = new Set([
  'CharacterSheet.tsx',
  'creator/CharacterCreator.tsx',
  'editor/GameOpEditor.tsx',
  'EquipmentPanel.tsx',
  // #492 Lot 1b : `ActiveEffectsPanel`/`describeEffect` (« PA (toutes Localisations) », Points
  // d'Armure) déplacés tels quels de CharacterSheet.tsx — même faux positif, même exemption.
  'EtatPanel.tsx',
]);
const PRICE_BASELINE: Record<string, number> = {};

// ── (vii) `flex-wrap: wrap` hors `components.css` : le motif « rangée qui s'enroule » vit dans
//    `.bar`/primitives partagées de `components.css` (§charte-ui). Un `flex-wrap` codé en dur dans un
//    AUTRE module CSS est de la dette gelée (#287) — le cliquet interdit sa hausse, impose la décrue. ──
const FLEX_WRAP_BASELINE: Record<string, number> = {
  // +1 : `.creator-band-right:has(.notch-gauge + .notch-gauge)` (registre État, `EtatPanel.tsx`) —
  // bande à DEUX jauges de quota (Mutations) collisionnant avec son titre dans la colonne bornée
  // `.sheet-main` (motif `.bar` non composable ici, c'est un slot droit de `Band`, pas un bandeau).
  'styles/band.css': 1,
  'styles/base.css': 4,
  // +1 (#1388 C4) : `.de-reflrow` (rangée dense de réfs de l'atelier Codex) s'enroule dès 360 px —
  // motif `.bar` non composable ici (c'est une rangée de CHAMPS d'un formulaire d'édition, pas un
  // bandeau d'écran) ; le `flex-wrap` seul ne suffisait pas, il va de pair avec `min-width: 0`.
  'styles/codex-edit.css': 2,
  // -1 (#492 lot POSSESSIONS B) : mort de l'ancienne `.inv-row { flex-wrap: wrap }` (registre
  // `Band`/`PlaqueRow` désormais, `.inv-actionbar` reprend le motif dans sheet.css, en regard).
  // +2 (chartrage du bloc « dé fixé », juge vision) : `.prow-act` (zone d'actions d'une rangée de jet)
  // et `.rm-die-pick` (options de dé + champ) — deux rangées de contrôles de largeurs variables qui
  // doivent s'enrouler dès 360px ; motif `.bar` non composable (chrome d'en-tête d'écran).
  'styles/combat-modals.css': 8,
  'styles/combat-ui.css': 7,
  'styles/compendium.css': 3,
  // +1 : `.creator-race-lineages` (#393 P2, correction structurelle Race) — rangée de chips de
  // lignée en tête du détail, s'enroule (motif `.bar` non composable ici, boutons de largeur variable).
  // -2 : lot « ossature enforcée » (#393) — mort du bandeau fiche-vivante ≤1100px du rail 3 zones
  // (`.creator-shell > .creator-summary` et `.creator-derived` en rangée), l'empilement vit sur
  // le gabarit unique `.creator-step`.
  // -1 : purge du bloc MORT `.career-path` (superseded par CareerPath/`.cc-path`, 0 réf) — voir (xii).
  'styles/creator.css': 5,
  'styles/editor.css': 10,
  'styles/gauges.css': 1,
  // -1 (R-M1, bande de groupe) : `.party-dock` ne s'enroule plus — une seule rangée qui DÉFILE à
  // tuiles pleines. Baisse ASSAINIE, pas une tolérance.
  'styles/hud.css': 5,
  'styles/mass-battle.css': 2,
  'styles/merchant.css': 1,
  // +1 (#492 lot POSSESSIONS B) : `.inv-actionbar` — barre d'actions de la rangée ÉLUE du registre
  // Possessions (motif « contrôles qui s'enroulent », hérité 1:1 de l'ancienne `.inv-row`).
  // -1 (juge vision, correction d'alignement de la bande Seuils) : `.etat-destin-row` MEURT — les 3
  // jauges composent `.notch-gauge-stack` (grid, patron de groupe de `NotchGauge`, gauges.css) au
  // lieu du flex qui s'enroulait sans aligner les 3 compteurs entre eux.
  // +1 (tableau de bord État, arbitrage user 2026-07-17) : `.etat-chips` — rangée de chips codex-liées
  // des États actifs qui s'enroule ; motif `.bar` non composable ici (chrome de barre d'écran) et
  // `.plaque-fx` scopé DANS `PlaqueRow` (`.plaque-name > .plaque-fx`), même justification que ce dernier.
  'styles/sheet.css': 4,
  // -1 : le roster de postes porte sa matière dans `postes-roster.css`, la feuille de sa primitive.
  'styles/world-meta.css': 17,
  'styles/city-hub.css': 1,
  'styles/voyage.css': 3,
  // +1 (lot #492 « chevet ») : `.plaque-fx` (chips d'effet net sous le nom, `PlaqueRow.tsx`) — enroule
  // en rangée, motif `.bar` non composable ici (le `.bar` du canon porte fond/bordure/padding d'en-tête,
  // pas d'une puce compacte sous un titre de plaque).
  'styles/plaque-row.css': 1,
  // +1 : `.pr-cases` (`PostesRoster`/`AssignRow`) — les portraits d'un poste s'enroulent quand ils
  // débordent de la colonne de cases ; motif `.bar` non composable ici (`.bar` porte fond/bordure/
  // padding d'une barre d'écran, pas d'une case DANS une rangée de grille).
  'styles/postes-roster.css': 1,
};

// ── (viii) Couleurs `fill=`/`stroke=` LITTÉRALES dans le JSX de `src/ui` : un fill/stroke codé en dur
//    (hex/rgb/hsl) hors token `var(--…)` est de la dette — hors thème, illisible quand la surface change
//    de fond (bug « texte noir sur noir » du hub de voyage, user 2026-07-11). BASELINE = surfaces d'ART /
//    de CARTE existantes (aperçu de personnage, canevas de l'éditeur, carte du monde parcheminée) gelées
//    nominativement ; tout NOUVEAU .tsx reste à ZÉRO. Les defs d'art de `gameIso` sont hors périmètre
//    (scan borné aux `.tsx` de `src/ui`). `fill="none"`/`url(#…)`/`currentColor` ne sont pas des littéraux.
const FILL_LITERAL_BASELINE: Record<string, number> = {
  'AppearancePanel.tsx': 1,
  // Restent les teintes de CARTE sans token dédié (vert d'entité de zone, cyan d'entrée et d'aperçu de
  // rectangle, rouge d'exclusion de toiture) ; le jaune de sélection et l'encre de texte composent
  // `--iso-active-halo` / `--shadow-ink`.
  // -1 (8 → 7) : baseline PÉRIMÉE constatée le 2026-08-14 (mesure `git show HEAD:…` = 7 avant comme
  // après le lot C5a du #1176, qui ne touche aucun `fill`/`stroke` de ce fichier) — le cliquet exige
  // l'abaissement d'une baseline devenue plus haute que le réel.
  'editor/EditorCanvas.tsx': 7,
  'editor/Inspector.tsx': 1,
};

// ── (ix) Redéfinition de `.panel` hors `components.css` : la primitive canonique (#306) n'a qu'UNE
//    définition — un module qui la redéclare la rend inerte EN SILENCE (override, seul l'ORDRE d'@import
//    décide à spécificité égale ; à spécificité SUPÉRIEURE le composé écrase toujours, @media du canon
//    compris). C'était le piège de la règle MORTE `base.css` `@media 700px .panel{padding}` (base.css
//    @import AVANT components.css → jamais appliquée), ET l'angle mort des composés `.interlude-hero.panel`
//    (0,2,0) que l'ancre `^\s*\.panel` ne voyait pas (le sélecteur ne COMMENCE pas par `.panel`). Le cliquet
//    couvre donc TOUT `.panel` porté par le MÊME élément : bare en tête de sélecteur (`^\s*\.panel`), OU
//    composé à une autre classe (`X.panel`, ex. `.interlude-hero.panel`), modificateurs `.mod`/`:pseudo`/
//    `[attr]` inclus jusqu'à la fin du sélecteur (`\s*[,{]`). EXCLUS : les DESCENDANTS/enfants (`.panel h3`,
//    `.panel-grid > .panel`) — `.panel` n'y est pas compound sur le même élément, ils scopent sans remplacer
//    la surface — et la classe distincte `.panel-grid` (`.panel` suivi de `-`). La densité mobile du canon
//    vit DANS components.css, APRÈS la base, pour gagner la cascade.
// BASELINE nominative : les 3 spécialisations LÉGITIMES de l'interlude (world-meta.css) — carte d'Activité
//    à liseré d'or (`.interlude-hero.panel`, densité resserrée assumée), son état actif, et le bandeau de
//    bataille à liseré rouge (`.interlude-battle-banner.panel`). Densité CONSTANTE voulue (déjà compacte
//    ≤700px) — plus jamais INVISIBLES au cliquet. Tout NOUVEAU composé `.panel` reste à ZÉRO.
const PANEL_REDEFINE_BASELINE: Record<string, number> = {
  'styles/world-meta.css': 3,
};

// ── (x) `<button` « nu » (#373) : un `<button` dont le `className` (littéral OU gabarit) ne porte
//    AUCUNE classe canon `.btn`/`.chip`/`.seg` est de la dette gelée — cas d'école du hub (noir-sur-
//    noir, feedback user 2026-07-12 verbatim « tu as tendance a ne pas utiliser les primitives et
//    objets React, c'est de la folie »). Un `className` totalement OPAQUE (aucun littéral de chaîne
//    dedans, ex. `className={fn(x)}`) est traité honnêtement à part (catégorie OPAQUE, jamais fondu
//    dans le compte « nu ») plutôt que jugé aveuglément conforme ou non-conforme. Les commentaires
//    (bloc et ligne) sont neutralisés avant le scan — un `<button>` cité en JSDoc n'est pas du markup.
//    EXEMPTÉS (fichiers-PRIMITIVES qui définissent légitimement leur propre rendu de bouton, à charge
//    à l'appelant de les composer — jamais à réécrire un `<button>` à la main) :
//      - OptionChooser.tsx / Tabs.tsx / RollShell.tsx : primitives canon de bouton/onglet/action de la
//        table `docs/architecture.md`, citées nommément par le ticket #373 comme patron d'exemption.
//      - PortraitTile.tsx : primitive canon d'affichage de personnage (`.ptile*`), sa propre famille de
//        classes.
//      - MediaSelect.tsx : primitive canon de champ média (`.ms-trigger`), sa propre classe déclencheur.
//      - ViewControls.tsx / PovControls.tsx : chrome de bouton PARTAGÉ (constante `BTN`) flottant en
//        overlay HTML par-dessus le canvas iso (jeu + éditeur) — l'exception « boutons de canvas »
//        nommée par le ticket #373, hors flux document donc hors `.panel`/`.btn` par nature.
//    TODO(#373) : cliquet (xi) « écran plein-champ sans `.panel` dans son sous-arbre » — heuristique
//    et fichiers cibles à définir au triage du programme #371.
const BARE_BUTTON_EXEMPT_FILES = new Set([
  'OptionChooser.tsx',
  'Tabs.tsx',
  'RollShell.tsx',
  'PortraitTile.tsx',
  'MediaSelect.tsx',
  'ViewControls.tsx',
  'PovControls.tsx',
  // MenuCard.tsx : primitive canon du bouton de MENU (`MenuButton`, table `docs/primitives.md`) — même famille
  // que OptionChooser/Tabs, à charge à l'appelant (MainMenu/GameMenu) de la composer, jamais de recoder
  // un `<button className="btn">` de menu à la main.
  'MenuCard.tsx',
  // FigTile.tsx : primitive canon de tuile-figurine cliquable (`.fig-tile`, #412) — même famille que
  // PortraitTile.tsx, sa propre classe de composant.
  'FigTile.tsx',
  // PlaqueRow.tsx : primitive canon de la rangée-plaque (`.plaque-row`, #393 amendement 3) — même
  // famille que FigTile/MenuCard, sa propre classe de composant ; la plaque d'ACTION de la planche
  // est cliquable (`.c-plate{cursor:pointer}`), la primitive rend alors un VRAI bouton plutôt que
  // de laisser chaque écran piéger un `div` au clic.
  'PlaqueRow.tsx',
  // ListRow.tsx : primitive canon de la RANGÉE DE LISTE sélectionnable (`.listrow` + famille
  // `insp-row`/`codex-row`, #841) — même famille que Tabs/MenuCard/PlaqueRow. Elle existe justement
  // pour que plus aucun panneau ne recode la rangée : 13 sites de l'éditeur la composent désormais,
  // et les 3 classes d'état concurrentes (`active`/`on`/`is-selected`, dont une jamais stylée) sont
  // tranchées ici.
  'ListRow.tsx',
]);
// `dicewell` : bouton-encrier canon de `CreatorDice` (#414, langage `.c-dicewell.act` du kit
// « Atelier du scribe ») — même famille que `.btn`/`.chip`, sa propre classe de composant.
// `cc-step` : médaillon-bouton canon de `CareerPath` (#393 P2, 2026-07-14) — même famille, chaîne
// explorable propre (langage `.cc-path`/`.cc-link`, pas un `.chip`/`.seg` recyclé).
const BARE_BUTTON_CANON = /\b(btn|chip|seg|dicewell|cc-step)\b/;
const BARE_BUTTON_BASELINE: Record<string, number> = {
  // +1 (LOT L, 2026-07-17) : titre de bande CLIQUABLE (`onTitleClick`, registre État → catégorie
  // Compendium) — bouton de RESET pur (`all: unset`) posé UNE fois dans la primitive PARTAGÉE
  // elle-même (`Band.tsx`), jamais recopié à l'appel : tout consommateur de `Band` hérite du patron.
  'Band.tsx': 1,
  'CityHubScreen.tsx': 1,
  // +1 (2026-07-16, #496) : carte-bouton de talent 5c (race « A ou B ») — bouton BESPOKE
  // `.talent-option` (creator.css), même famille que `.fig-tile`/`.plaque-row` mais sans
  // fichier-primitive dédié ; migration vers un patron FigTile différée (une entrée porte 2
  // options, pas 1:1 avec la carte — cf. #496).
  'creator/CharacterCreator.tsx': 1,
  'editor/EditorToolbar.tsx': 1,
  // -5 (EffectList 1→0, FlowEditor 3→0, GameOpEditor 1→0, entrées retirées) : les trois menus
  // d'ajout de l'atelier (« + Effet » / « + Bloc » / « + Op mécanique ») composent la primitive
  // UNIQUE `AddMenu`, dont les rangées sont des `ListRow` — plus un seul `<button>` recodé.
  // #830 : +1 bouton `.pal-item` (sélecteur de matériau de l'outil mur/porte) — même patron que les
  // 6 boutons `.pal-item` déjà comptés ci-dessus (prop/créature/engin).
  'editor/Palette.tsx': 7,
  'editor/StatblockEditor.tsx': 2,
  'ErrorCollectorBanner.tsx': 1,
  // #839 : -1 (1 → 0, entrée retirée) — la remise au défaut d'une règle (`↺`) compose désormais
  // `GatedAction` (bouton `.btn` + raison VISIBLE du verrou de combat), plus un `<button>` nu.
  // #1135 : baseline abaissée (3 → 2), bouton nu retiré au commit 9bae13b3 — détecteur inchangé.
  'InitiativeStrip.tsx': 2,
  'MerchantPanel.tsx': 1,
  'ObjectiveBanner.tsx': 1,
  'VoyageScreen.tsx': 4,
};
// Baseline SÉPARÉE des `className` opaques (aucun littéral dedans) : au recensement, zéro site après
// exemption des primitives — tout `<button className={fn(...)}>` NOUVEAU doit désormais soit exposer un
// littéral `btn`/`chip`/`seg` dans son expression, soit vivre dans un fichier-primitive exempté ci-dessus.
const BARE_BUTTON_OPAQUE_BASELINE: Record<string, number> = {};

// ── (xii) Sélecteurs de classe DÉFINIS par module CSS de DOMAINE (doctrine user 2026-07-12, #373 —
//    « J'y crois pas une seule seconde à des classes mono-écrans, c'est une excuse à la dérive »).
//    Le stock de classes de domaine doit être GELÉ et DÉCROISSANT — hausse = échec, motif : « motif
//    partagé ? → couche atomique (charte, catalogue) ; vraiment spécifique → justifier ». Modules
//    scannés = les modules de DOMAINE (`base`/`components`/`tabs` EXCLUS, couche partagée gardée par
//    xiii ; `styles.css` orchestrateur d'`@import` gardé par xiii) : creator, combat-ui,
//    combat-modals, sheet, merchant, hud, world-meta, editor, compendium, codex-edit, house-rules,
//    mass-battle, ornaments, tavern, party, gauges (jauges navire). L'exhaustivité (xiv) garantit
//    qu'AUCUN .css n'échappe à xii OU xiii.
//    Comptage = NOMS de classes DISTINCTS apparaissant en position de définition (sélecteur), toute
//    forme confondue (bare, composé `X.foo`, descendant `.foo .bar`, modificateur `.foo:hover`,
//    dans un `@media`) — dédupliqué PAR MODULE. Parse par accumulation caractère-par-caractère : le
//    tampon de sélecteur courant se vide à chaque `{` (capturé si ce n'est pas un prélude `@…`, ex.
//    `@media (...)`) et à chaque `}` (referme la règle OU le bloc `@media` — le contenu de règle,
//    jamais un sélecteur, n'est donc jamais scanné). Les commentaires sont neutralisés en amont.
const DOMAIN_CSS_MODULES = [
  'creator',
  'combat-ui',
  'combat-modals',
  'sheet',
  'merchant',
  'hud',
  'world-meta',
  'editor',
  'compendium',
  'codex-edit',
  'house-rules',
  'mass-battle',
  'ornaments',
  'tavern',
  'party',
  'gauges',
  'city-hub',
  'voyage',
  'gallery',
  'rose',
  'hero-sheet',
  'frames',
  'creator-step',
  'plaque-row',
  'band',
  'panneau-parametre',
  'celestial-wheel',
  'creator-presentation',
  'creator-shell',
  'test-scenarios',
  'combat-console',
  'exploration-dock',
  'postes-roster',
];
const CLASS_SELECTOR_BASELINE: Record<string, number> = {
  'styles/codex-edit.css': 20,
  // LifeBar (#492, arbitrage 2026-07-17 « on sait gérer de vraies barres de blessures ») : +5
  // (27 → 32) — `.life-bar(-label|-track|-fill|-value)`, primitive dédiée (patron NotchGauge, même
  // module « jauges »), remplace `.ptile-gauge`/`.ptile-pv` (morts, contrepartie en hud.css).
  // +1 (juge vision, correction d'alignement bande Seuils) : `.notch-gauge-stack` — patron de GROUPE
  // de la primitive `NotchGauge` (colonnes label/piste/valeur alignées en `subgrid` entre N jauges
  // empilées), posé ICI (à côté de la primitive) et non dans `sheet.css` (appelant).
  'styles/gauges.css': 33,
  // #417 suite (consécration HeroSheet) : -6 — .candidate-detail-head/-fig/-id (bande
  // d'en-tête) + override .candidate-detail-pane .creator-derived (dérivées 2 colonnes) morts,
  // portés par hero-sheet.css (SOURCE UNIQUE partagée avec la fiche vivante du créateur).
  'styles/party.css': 66, // #417 passe finale : eyebrow .camp-plate-eyebrow (CAMPAGNE) + override scopé .entity-chip sous .card-roles (chips d'axes small-caps inline, jamais une boîte)
  // +5 : bande d'en-tête figurine+identité+rose du détail candidat (correction de cap 2026-07-14,
  // remplace `.candidate-detail-rose` par `.candidate-detail-head`/`-fig`/`-id`).
  // +6 : grille de sièges « Les contrats d'engagement » (planche ratifiée d'équipe, correction
  // de cap 2026-07-14) — `.party-acts-header`/`-title`/`-subtitle`, `.seat-card-seal`/`-contract`,
  // `.seat-contract-badge`/`.seat-empty-title`, `.party-actions-summary`/`-buttons`.
  // +6 : scène centrale du roulis + dé SVG au chiffre gravé sur la face (#396 v2-v4) — `.rm-scene`/
  // `.rm-die-landed`/`.rm-die-svg`/`.rm-die-gem`/`.rm-die-num`/`.rm-die-rolling` (primitive DiceRoll).
  // +1 (2026-07-16, #496) : `.rm-die-gold` — modificateur de matière DORÉE de `DieFace`/`DiceRoll`
  // (prop `tone`), SOURCE UNIQUE qui remplace les 3 scopes ancêtres dupliqués (creator-step.css/
  // plaque-row.css, purgés en regard).
  // Onglet Compétences & Talents composant `HeroSheet` (arbitrage 2026-07-17) : -5 (148 -> 143) -- `.skill-grid`/
  // `.skill-line`/`.sk-name`/`.sk-val`/`.sk-adv` MIGRENT vers hero-sheet.css (module de la primitive
  // qui rend la table à valeurs (source unique), contrepartie ASSUMÉE en regard.
  // Lot POSSESSIONS (A) : -2 (143 -> 141) -- mort du mannequin `.equip-doll`/`.equip-figure`
  // (EquipmentPanel, #492) : le rig grand format vit desormais dans la colonne de la fiche.
  // Lot POSSESSIONS (B) : -12 (141 -> 129) -- mort de l'ancienne rangée `.inv-row`/`.ir-*`
  // (Sac de l'onglet Possessions) : `.inv-rows`/`.inv-row`/`.kind-melee`/`.kind-ranged`/
  // `.kind-armor`/`.equipped`/`.ir-main`/`.ir-name`/`.ir-stats`/`.ir-enc`/`.ir-kind`/`.inv-nested`
  // migrent au registre `Band`/`PlaqueRow` (module sheet.css, patron EtatPanel) — `.ir-hand` reste
  // ici (HandPicker, composé DANS la nouvelle barre d'actions, inchangé).
  // Chartrage du bloc « dé fixé » (juge vision) : +4 (129 -> 133) -- `.prow`, `.prow-act` et
  // `.prow-fixed-mark` EXISTAIENT déjà dans le markup de `RollRow` SANS aucune règle (le défaut mesuré :
  // ferrage hérité de l'ambiance de la coquille, divergent d'une modale à l'autre) ;
  // `.rm-die-pick` remplace le détournement de `.rm-loc-grid` (grille de 3 boutons) par le bloc propre du
  // sélecteur. Aucun nouveau motif d'écran : le champ COMPOSE `.field` (canon), sans classe de domaine.
  // +7 (#942 L7, verdict vision) : pied FIXE de `RollShell` (`.modal:has(> .rs-scroll)`, `.modal > .rs-scroll`,
  // sa barre d'actions), `.prow-line` (+ son 1er enfant) qui ancre la marque à SA ligne, `.rm-range`
  // (+ son cas sans libellé) pour la fourchette des tuiles, et l'allègement de voile DESCENDU ici
  // depuis la couche partagée (`.app-campaign .modal-overlay:has(.roll-modal)`).
  // +2 (#1078 LOT A1) : `.rm-subtitle`/`.rm-summary` — `.rm-vs` servait CINQ rôles (opposition
  // VsHeader, sous-titre de RollShell, bandeau d'issue agrégée) sous un seul nom : restyler l'un
  // repeignait les autres. Somme nulle VISUELLE (les trois classes partagent le MÊME bloc de
  // déclarations, combat-modals.css) ; la hausse achète la séparation des rôles, pas un motif d'écran.
  // +1 (#1078 LOT B2) : `.rm-spellinfo` — la PORTÉE d'un sort (gabarit de ZdE / « sur lui-même »,
  // CastModal) détournait `.rm-vs` alors qu'elle n'oppose personne. MÊME bloc de déclarations : somme
  // nulle visuelle, un rôle de plus nommé.
  // -2 (143 → 141) : mort de la VARIANTE d'enveloppe `test` — `.test-modal` (largeur figée à 340px,
  // qui écrasait la coquille standard) et `.test-actor` (sous-titre jumeau de `.rm-subtitle`)
  // disparaissent ; les fenêtres de jet n'ont plus qu'une enveloppe, gardée par le cliquet (xvi).
  // +1 (#1349 G5) : `.rm-posture-etat` — l'ÉTAT LECTURE SEULE d'une posture de tir (armée / non armée,
  // accent porté par `[data-armee]` sur la rangée) est un rôle distinct de `.rm-crowd-note` (la note
  // explicative, 11px muted) qu'il détournerait sinon. Un rôle de plus nommé, aucun motif d'écran.
  // -9 (142 → 133), mort de la barre v7 : sortent l'interlude de ciblage qu'elle SEULE portait
  // (`.action-bar.targeting-interlude` + `.targeting-interlude`/`.ti-icon`/`.ti-title`/`.ti-badge`
  // et la densité `.btn`/`.small` de sa tranche `pointer: coarse`), la méta de son sélecteur de sort
  // (`.bp-spell-ni`, `.ab-spell-meta`) et le masquage `.ab-actor-top:empty` de sa rangée d'Avantage.
  // #1318 E1 : 133 → 132 — `.rm-die-input` meurt, la matière du champ du dé se déclare au CONTENEUR
  // du site (`.rm-die-pick > label > input`), la primitive `NumberField` ne portant aucune classe d'écran.
  // -5 : le dossier de navire compose le roster PARTAGÉ (`PostesRoster`), qui porte sa matière dans
  // `postes-roster.css` — `.ship-role`, `.ship-role-head`, `.ship-role-name`, `.ess` et `.crew-remove`
  // n'ont plus de rendu. Les jumelles `.ship-poste*` (pièces d'artillerie) restent.
  'styles/combat-modals.css': 127,
  // -35 (110 → 75), mort de la barre v7 : le module ne définit plus AUCUNE classe de la barre
  // (`.action-bar`, `.commencer-btn`, `.coop-ready`, la famille `.ab-*` — cadre acteur, hotbar,
  // slots, tiroirs) ni du cadre actif `ActiveFrame` (`.aframe`, famille `.af-*`, `[data-slot=…]`).
  // Sa matrice responsive (900/700/560 + `pointer: coarse`) part avec elle : le DOCK DE DÉCISION est
  // la console, qui porte SA matrice dans `combat-console.css` (test « matrice responsive canonique »
  // recentré). Restent ici les surfaces qui ont d'autres porteurs : `.rig-portrait` (portrait de
  // l'arche), `.fx-chip*` (pastilles partagées), `.pv-badge` (aperçu tap-1 sur la scène),
  // `.ready-row`/`.ready-chip` (RestModal/VictoryScreen/VoyageScreen).
  'styles/combat-ui.css': 75,
  // Console de combat (lot console) : famille `.cc-*` de la surface — deux travées, alvéole,
  // conduit d'Avantage, arche, coin de fin de tour, bandeau de phase.
  // Passe de CONTENU (spec §1c-bis) : l'arche ne compose plus `ActiveFrame` — elle rend son propre
  // gabarit (portrait + 2 gouttières à socle + Blessures + nom). Sortent les 5 spécialisations en
  // contexte de la primitive (`.aframe`, `.af-mid`, `.af-bar`, `.af-v`, `.af-h`) et le débord
  // `.cc-overflow`/`.cc-book` (SUPPRIMÉ : l'exhaustif est l'écran de capacités) ; entrent
  // `.cc-arch-body`, `.cc-gutter`, `.cc-gutter-rail`, `.cc-gutter-action`, `.cc-gutter-move`,
  // `.cc-socle`. Total MESURÉ inchangé à 43.
  // Dont, hors famille `.cc-*` : `.ptile`/`.ptile-face` (portrait MINI de la ligne compacte —
  // `PortraitTile` pose sa largeur en style INLINE, API fermée `CHAR_SIZE_PX`), `.btn` (densité du
  // bouton de sortie du bandeau de phase ≤560px), `.rig-portrait` (dessin du portrait de l'arche),
  // et les modificateurs d'état `.on`/`.out`/`.spend`/`.pulse`.
  // +1 (43 → 44) : `.team-enemy` — correctif C-2 du juge vision (2026-08-17). Le portrait de l'arche
  // portait DEUX anneaux de camp concentriques (bordure d'équipe de `PortraitTile` + cadre du dessin
  // de `RigPortrait`) : « cadre dans un cadre », antipattern `FigTile` de la doctrine. Le cadre du
  // dessin se retire, et la FORME du trait (R9, daltonisme) passe sur l'anneau restant — d'où cette
  // seule référence à la classe d'équipe de la primitive, aucune classe de domaine créée.
  // +8 (44 → 52) : COMPOSITION de la travée gauche sur la planche USER 2026-08-17 (spec §1c-bis) —
  // `.cc-bay-body`/`.cc-arsenal`/`.cc-arsenal-body`/`.cc-quick` (les deux groupes de la travée et
  // leurs boîtes), `.cc-bay-head` (bande de titre : le set au poing / ACCÈS RAPIDE), `.cc-sets` (la
  // COLONNE de sets, qui absorbe l'ancien commutateur : `.cc-sets-toggle` disparaît), `.cc-set-n`
  // (rang gravé de la vignette), `.cc-set-load` (l'état « déch. » DIT, jamais la couleur seule) et
  // `.cc-grid-quick` (2×2). Aucune n'est décorative : chacune porte une région de la composition.
  'styles/combat-console.css': 50,
  // Pont d'EXPLORATION (spec HUD combat § « Zone 11 ») : `.exploration-dock` (la bande basse, même
  // matière/liseré que le pont de combat) et `.xd-openers` (la rangée d'icônes-écrans à son extrémité
  // droite, tiroir-journal compris). DEUX noms, aucun décoratif : sans eux, les ouvreurs restent des
  // boîtes flottantes sur le champ.
  // -1 (3 → 2) : le module ne cite PLUS `.worldmap-btn`. La tôle du pont était réécrite ici, de
  // l'extérieur, en 6 propriétés (scope par écran) : elle est devenue une VARIANTE de la primitive
  // (`.worldmap-btn[data-skin='tole']`, définie AVEC elle dans world-meta.css — attribut, aucun nom
  // de classe neuf là-bas). Baisse ASSAINIE, gardée par `ExplorationDock.test.tsx`.
  'styles/exploration-dock.css': 2,
  // +1 : `.nb` (#393 P2) — note d'atelier non cliquable en fin de section chips (CodexRowView).
  'styles/compendium.css': 56,
  // +25 : charte « Atelier du scribe » (#412) — MetalStatus/WaxSeal+SealedPlaque/CareerPath/
  // FigTile/GroupedPickGrid/DetailFrame (primitives SANS canon préexistant).
  // +1 : `.creator-race-shell` (#393 P1) — gabarit deux-zones de l'étape Race (compose
  // `MasterDetail`, enfants ciblés par position pour ne pas re-déclarer ses classes).
  // +1 : `.rm-loc-grid` (#393 P1) — override responsive 360px scopé à l'étape Race, la primitive
  // `OptionChooser` (combat-modals.css) fige 3 colonnes quel que soit le conteneur.
  // +11 : peau « Atelier du scribe » LOT #414 (`.dicewell`/`.dicewell-tray`/`.dicewell-txt` —
  // encrier bordé-teinté de CreatorDice) + restructuration concurrente de l'étape Race (#393 P2,
  // `.creator-race-card`/`.creator-race-grid`/`.creator-race-lineages`/`.creator-race-lineage`…).
  // +5 : correction structurelle Race (#393 P3, verdict utilisateur 2026-07-14) — rangée recherche+
  // encrier (`.creator-race-toolbar`/`.creator-race-search`), copy titre+sous-titre de l'encrier
  // (`.dicewell-copy`/`.dicewell-sub`), état résolu (`.dicewell.done`) et liseré de borne
  // (`.creator-race-card.rolled`).
  // +6 : polish finale Race (#393 P4, rapport juge vision) — `.detail-frame-head`/`.detail-frame-sub`
  // (tagline sourcée), `.dicewell.emph` (encrier idle en emphase), override local
  // `.creator-race-card .charprev-lg` (figurine généreuse sans casser le zéro-scroll).
  // +2 net (#393 P2) : mort du call-site Carrière de `FacetedPickGrid` — `.pick-facets`/`.pick-grid`/
  // `.pick-card*` PARTENT (dernier consommateur), `.creator-race-shell/-toolbar/-search/-count`
  // deviennent `.creator-pick-*` (partagées Race+Carrière, renommage 1:1) + `.dicewell-die` (grands
  // losanges de l'encrier, correctif toolbar P1).
  // +2 : correctifs utilisateur 2026-07-14 (rang CareerPath explorable — `.cc-step.sel`/
  // `.cc-step:focus-visible` ; rangée filtres Carrière — `.creator-pick-filters`).
  // #417 suite (consécration HeroSheet) : -3 — .creator-summary .stat-val.boost (highlight
  // d'augmentation, plus rendu par la fiche vivante — HeroSheet ne le porte pas) et
  // .creator-summary .char-skills (bloc mort, remplacé par le corps HeroSheet) retirés.
  // #393 P3 (Caractéristiques/Signe astral, étalons finale-mock2/mock3) : +3 — `.char-die` (dés
  // permanents par rangée du tirage), `.star-wheel-col` (colonne roue, `.appear-panel`/`.appear-
  // controls` réutilisés pour le reste du layout) et `.cw-label` (noms de signe autour de la roue) ;
  // `.rolled`/`.row-flex`/`NotchGauge` réutilisés pour le surlignage de rangée et la jauge N/10.
  // Lot P3 final (retouches juge vision) : +2 — `.cw-label-dash` (tirets d'anneau à 23 signes),
  // `.creator-identity-roadmap` (chips signe/nom prospectives).
  // Lot P3bis+P4 (#393, écrans Caractéristiques/Compétences & Talents à la charte Atelier) : +17 —
  // scaffolding de layout des DEUX NOUVEAUX écrans plein-panneau (`Band` générique + gabarit
  // deux-zones panneau/fiche vivante, MÊME composition que Race/Carrière) : `.creator-band(-head|-right)`,
  // `.creator-chars-(screen|shell|main)`, `.creator-skills-(screen|shell|main|head|title|sub|card|tabnav)`,
  // `.creator-talents-cols`, `.skill-row(-grid|-label)` — widgets d'allocation composent `QtyStepper`
  // (canonique, mort du `Stepper` local), aucune classe recodée pour ça.
  // Migration FigTile (#430 phase 2, même lot) : -21 — purge de l'ancien motif `.creator-race-card*`
  // (tuile bois + charprev imbriqué, mort par cascade depuis be3fe9e0) au profit du cadre UNIQUE
  // `FigTile`/`frames.css` ; ne reste qu'un modificateur ADDITIF `.creator-race-grid .fig-tile.rolled`.
  // +3 : pastilles de suivi 5a (`.creator-skill-quota-gauges` + descendant `.notch-gauge`, compose
  // `.row-flex` en JSX — LOT clôture pieds étape 5) et séparateur « ou » des talents de race
  // (`.talent-option-ou` : le mot nu, chips SÉPARÉES codex-liées et jamais de pointillé gris-sur-noir —
  // `src/ui/styles/creator.css` porte le verbatim au site de la classe).
  // #393 P5 (Possessions/Détails/Présentation, DERNIER lot du programme #393) : +18 — étend le
  // gabarit deux-zones aux étapes 6/7 (`.creator-trappings-(screen|shell|main)`,
  // `.creator-details-(screen|shell|main|toolbar)`) ; identité (`.identity-(grid|field|sex-toggle)`) ;
  // bourse (`.creator-purse-line`) ; gabarit DÉDIÉ 3 colonnes de l'étape 8, renommée « Présentation »
  // (`.creator-presentation-screen`, `.presentation-(col|left|center|right|fig|name|sub)`).
  // Correctif responsive PRÉSENTATION (agent-œil post-livraison, même lot) : +1 —
  // `.presentation-left .char-stats` (repli 3 colonnes ≤560px, la grille 5 colonnes canonique
  // débordait la colonne étroite mobile).
  // Lot « OSSATURE ENFORCÉE » (#393, croquis user 2026-07-15) : -18 NET (163 → 145, décrue
  // exigée par l'amendement 2 « revenir SOUS 123 » — premier maillon du lot). Le gabarit 2 zones
  // s'encode dans `CreatorStepFrame` (`.creator-step`, renommage 1:1 de `.creator-pick-shell`) :
  // MORT du rail 3 zones (`.creator-shell`/`.creator-rail`/`.creator-main` + overrides ParchmentCard
  // `.creator-main .tag|.talent-option|.talent-desc|.char-alloc|.path-node`, bandeau fiche ≤1100px),
  // des shells par-étape (`.creator-chars|skills|trappings|details-(screen|shell|main)`) et de
  // `.rail-line` ; la teinte dorée des dés vit dans creator-step.css (module de la primitive).
  // Consécration PlaqueRow (#393 amendement 3, même lot) : -8 (145 → 137) — les rangées de
  // caractéristiques de l'étape 3 composent la primitive (plaque-row.css) : `.char-alloc(-grid)`/
  // `.char-key`/`.char-name`/`.char-roll`/`.char-die`/`.char-total`/`.rm-die-num` morts ici.
  // Migration étape 1 (species, même lot) : -3 (137 → 134) — purge du bloc MORT `.career-path`/
  // `.path-node`(`.current`/`em`), ancien CareerPath superseded par la primitive `.cc-path`/`.cc-step`
  // (0 réf TSX) rencontré en auditant creator.css pour la décrue.
  // Migration étape 7 (details, même lot) : -5 (133 → 128) — l'état civil COMPOSE la rangée-plaque
  // (`PlaqueGrid`/`PlaqueRow`, planche `.idf` = la plaque à colonne de libellé gravée) : mort de
  // `.identity-(grid|field|sex-toggle)` et de `.input-dice` (la valeur éditable est une matière de
  // plaque, plaque-row.css) ; la bande d'action rejoint l'en-tête d'étape PARTAGÉ
  // (`.creator-skills-head`, topbar `.fam-topbar` de la planche) → `.creator-details-toolbar` MORTE.
  // Migration étape 6 (trappings, même lot) : -1 (134 → 133) — `.creator-purse-line` MORTE : le total
  // de la bourse s'ancre à droite de la barre (`Band.right`, motif `.cu-sechead .cnt` de la planche —
  // même rang que les « N objets » des dotations), les faces figées + la note passent en enfants
  // DIRECTS de la bande (valeurs `.c-note` déjà portées par `.creator-band > .hint`).
  // Consécration StepHeader (#393 amendement 3, clôture de la migration étape 7) : -3 (128 → 125) —
  // les 6 en-têtes de pas (étapes 3, 5a/5b/5c, 6, 7) COMPOSENT la primitive (creator-step.css, valeurs
  // `.fam-topbar`/`.c-dhead` de la planche : titre 26px + rubrique small-caps EN LIGNE à la baseline,
  // là où le markup recopié à la main les EMPILAIT) : `.creator-skills-head`/`-title`/`-sub` morts ici.
  // Migration étape 8 (presentation, clôture du lot) : -9 (125 → 116, sous l'objectif < 123 de
  // l'amendement 2) — tout le style de la mise en scène finale rejoint SON module dédié
  // (creator-presentation.css, patron rose.css/frames.css) : `.creator-presentation-screen`,
  // `.presentation-(col|center|fig|name|sub|left)` morts ici, et avec eux les deux descendants qui
  // n'existaient QUE pour cet écran (`.presentation-col .mini-title`, `.presentation-left .char-stats`
  // — d'où -9 et non -7 : le compte est par NOM de classe cité, pas par règle).
  // Migration étape 4 (star, lot ossature) : -2 (116 → 114). L'astrolabe rejoint SON module dédié
  // (celestial-wheel.css, patron plaque-row.css/creator-presentation.css) : `.celestial-wheel`,
  // `.cw-label`, `.cw-label-dash` morts ici ; et le corps de l'étape COMPOSE le patron
  // figure+contrôles déjà canon du fichier (`.appear-panel`/`.appear-controls`) au lieu des
  // `.star-body`/`.star-detail-col` que la migration avait d'abord recodés — seules `.star-wheel-col`
  // (l'astrolabe veut la moitié de la zone, `.appear-figure` est une vignette de 184px) et
  // `.star-apparence` (l'ambiance de la constellation) restent propres au pas.
  // Migration étape 5 (skills 5a/5b/5c, lot ossature) : -6 (114 → 108), SANS module neuf — la
  // réserve annoncée par l'amendement 3 (« rangées d'allocation de l'étape 5 : MÊME meuble » que
  // les caracs de l'étape 3 ; la planche le dit en clair, ses `.cs-row` et `.ck-cell` ont la MÊME
  // matière au hex près). Les trois volets composent `PlaqueGrid`/`PlaqueRow` : `.skill-row`,
  // `.skill-row-grid`, `.skill-row-label` morts ; `.creator-skills-card` morte (le gabarit porte le
  // layout) ; `.creator-talents-cols` morte au profit de la primitive GLOBALE `.panel-grid` (« deux
  // colonnes de même rang » de la planche mock6) ; `.creator-skill-quota-gauges` morte, les quotas
  // se comptant dans la tête de `Band` (`.cu-sechead .gauge` : « la réglette sertie compte les
  // quotas au même endroit, toujours »). La rubrique `.rf` de la planche (carac liée), portée à
  // l'identique par `.cs-row` ET `.ck-cell`, entre dans la primitive (prop `sub`) SANS classe neuve :
  // sélecteurs d'ÉLÉMENT sous la classe existante (`.plaque-name:has(> small)`, `.plaque-name > small`),
  // l'idiome que le module tenait déjà pour la plaque éditable (`.plaque-name > input`).
  // Vérification finale du lot ossature : -1 (108 → 107) — purge de `.tag-char`, MORTE (0 réf, la
  // marque « carrière » des rangées de caractéristiques porte `.tag.char` — classe DISTINCTE, bien
  // vivante, définie juste en dessous). Audit de décrue : les 4 autres classes sans consommateur
  // LITTÉRAL du fichier sont des faux positifs (`metal-status-chip|-plaque`, `st-argent|-or` sont
  // bâties par gabarit dans `MetalStatus.tsx` — `metal-status-${size}` / `st-${tier}`).
  // LOT « la tuile, aux valeurs » (#431) : -2 (107 → 105) — PURGE du doublon `.fig-tile*`, la dette
  // de la « phase 2 » annoncée par #430 et jamais payée (frames.css redéclarait la primitive « sans
  // toucher creator.css » : deux peaux se disputaient la tuile par cascade). `.fig-tile-name` et
  // `.fig-tile-sub` meurent ICI, frames.css devient la SEULE définition (+1 en regard, cf. plus bas).
  // `fig-tile` et `sel` restent comptés : le modificateur DOMAINE `.creator-race-grid .fig-tile.rolled`
  // et `.cc-step.sel` les gardent vivants dans ce module.
  // +2 (2026-07-16, #496) : sceau de cire des talents 5c (planche #393, patron `FigTile`) — la carte
  // EST la cible de clic (`.talent-option` devient tantôt le `<button>`, tantôt son enveloppe
  // `<div>` quand elle porte un `<select>` non imbricable dans un bouton) : `.talent-option-btn`
  // (reset de l'enfant cliquable côté carrière) et `.talent-option-seal` (médaillon du sceau) —
  // les 3 `<input type=radio>` des cartes race/carrière meurent au profit du bouton natif.
  // Onglet État — registre compact (#492 Lot 1c, arbitrage user 2026-07-17) : -4 (107 → 103) — la
  // bande titrée (`Band`) est EXTRAITE en primitive partagée (`Band.tsx`/`styles/band.css`, patron
  // plaque-row.css/frames.css) : `.creator-band(-head|-right)` meurent ici, contrepartie ASSUMÉE en
  // regard (band.css, plus bas).
  // Cue de bord de rail scrollable (#535, recette navigateur) : +1 (103 → 104) — `.master-detail-list`
  // (déjà comptée en couche partagée, `components.css`) réapparaît ICI comme fragment de sélecteur
  // `.creator-step > .master-detail-list::before/::after` (`docs/charte-ui.md` § « Cue de bord de
  // rail scrollable ») : nommer le RAIL RÉEL plutôt qu'un `:first-child` structurel opaque — la
  // recette a mesuré que l'ancien sélecteur, correct mais anonyme, ralentissait le diagnostic
  // navigateur (identification du conteneur ciblé). Coût assumé pour la diagnosticabilité.
  'styles/creator.css': 104,
  // +1 (113) : `.trace-layer-panel` — panneau flottant du CALQUE DE RÉFÉRENCE (décalquage d'une
  // planche de livre, #830), motif propre à l'éditeur (chargement/opacité/calage 2 points).
  // +3 (116) : `.trace-layer-panel-collapsed`/`-head`/`-chevron` — repli/dépli du panneau (#830 suite,
  // retour user 2026-07-25 « comment je ferme/ouvre le calque de référence ? »).
  // #834 audit-2 défaut 2 : + `.autosave-recovery-pill` (pastille de reprise masquée, sinon invisible).
  // -1 (117 → 116) : le menu d'ajout de l'atelier compose `ListRow` (cité ici pour sa densité de menu)
  // au lieu de ses deux classes propres `.eff-add-group`/`.eff-add-item`, mortes.
  // -1 (116 → 115) : `.eff-type` meurt — le CHANGEMENT de type d'un effet/d'une op se sert du même
  // menu que l'ajout (`TypeMenu` sur `AddMenu`), plus aucun `<select>` de type dans l'atelier.
  // +1 (115 → 116) : `.editor-iso-3d` (a7f8ac0a, #1176 P3-3) — contexte d'empilement du canevas
  // volumique sous les surcouches SVG d'authoring.
  // -1 (116 → 115) : `.ed-foot-inputs` meurt — l'empreinte d'un décor se VERROUILLE à son type
  // (`props.json`), l'inspecteur n'offre plus la paire de champs qui la saisissait à la main.
  // Le détecteur n'a pas bougé : c'est le STOCK qui a baissé.
  'styles/editor.css': 115,
  'styles/house-rules.css': 9,
  // LifeBar (#492, arbitrage 2026-07-17) : -2 (145 → 143) — `.ptile-gauge`/`.ptile-pv` MEURENT (le
  // marqueur `ptile-gauge` reste un className de compatibilité, sans style propre), le rendu vit
  // dans `LifeBar` (gauges.css).
  // #668 : +1 (143 → 144) — `.objective-deadline` (puce de compte à rebours du bandeau d'objectif).
  // #1078 LOT B1 : +1 (144 → 145) — `.info` complète le trio de tons de `.recap-line` (`ok`/`bad`
  // déjà ici) : le ton ATTÉNUÉ s'écrit, au lieu de dépendre de la couleur par défaut — un cadre qui
  // remet ses lignes à pleine couleur l'effaçait.
  // #1135 (attribution des ancrages du HUD) — décomposition MESURÉE (`git show <rev>:hud.css` passé au
  // détecteur ci-dessous), et non estimée :
  //  · 145 au point de départ (`d8742493`), baseline alors déclarée à 145 — cliquet vert ;
  //  · +5 NON DÉCLARÉS par `9bae13b3` : `view-controls`/`vc-group`/`vc-btn`/`vc-zoom-value`/`btn`.
  //    `ViewControls` posait sa géométrie en `style={{…}}` inline (objet recopié bouton par bouton),
  //    interdit par la charte ; ces classes sont la contrepartie de sa mise en feuille, et
  //    `.view-controls` est l'ANCRE qu'exigent la tranche `pointer: coarse` (cible de 44px) et la
  //    tranche ≤560 (bande basse). Le cliquet mesure donc 150 contre 145 déclarées : il est ROUGE à
  //    HEAD depuis ce commit. La dette se régularise ICI, avec sa justification propre ;
  //  · -8 par RELOGEMENT : `.action-bar` et les sept `.ab-actor`/`-bar`/`-ico`/`-lbl`/`-slot`/
  //    `-slots`/`-spells`. Le DOCK DE DÉCISION porte sa matrice responsive dans `combat-ui.css`, le
  //    module qui définissait DÉJÀ ces noms — aucune classe ne meurt ni n'y naît (ce module paie -1
  //    en regard, `.inspect-toggle`, la bascule appartenant à `ViewControls`).
  // 145 + 5 - 8 = 142, mesure post-lot. La matrice responsive du HUD n'ajoute AUCUN nom : elle ne cible
  // que des classes déjà définies ici, et le lieu de la pile de contexte est désigné par
  // `[data-hud='place']` (attribut, pas classe). Détecteur inchangé.
  // -1 (142 → 141) : mort de la variante d'enveloppe `test` — `.rs-embedded.test-modal` n'a plus de
  // classe à neutraliser, la zone de jet embarquée compose `roll-modal` seule.
  // +6 (141 → 147), passe d'ASSEMBLAGE #1349 : `.hud-rail` (le RAIL D'OUTILS de l'épure G devient
  // UN panneau encadré — commandes de vue + journal, plus rien d'épars sur le champ) et les cinq
  // noms de la bande de groupe repliable à ≤560 (`.pd-track` la piste défilante, `.pd-handle` la
  // poignée, `.pd-count`, `.pd-micro` et sa micro-jauge par héros). Aucun n'est décoratif : chacun
  // porte une surface que le HUD n'avait pas (panneau unique, piste, repli).
  // +1 (147 → 148) : `.pd-label` — la poignée NOMME ce qu'elle compte (« 13 au groupe ») ; un
  // nombre nu se lisait indifféremment héros ou vignettes de la frise dessous (grief d'assemblage).
  // +3 (148 → 151) : le RACK d'alvéoles réservées de `StateChips` (spec HUD combat §1c-bis) — la
  // cellule pleine `.pt-state`, la cellule VIDE `.pt-void` (dessinée : « zéro État ne rétrécit pas
  // la carte ») et le chiffre `.pt-n` porté par la pastille. Trois surfaces neuves, aucune
  // décorative : sans elles la grille d'États du bandeau n'a ni case ni indice.
  // +2 (151 → 153), passe d'ASSEMBLAGE des deux plaques d'outils : `.exploration-dock` (l'ancrage du
  // tiroir-journal SUR le pont hors combat, et la borne de son panneau sur la réserve `--xd-deck-h` —
  // le tiroir ne flotte plus au coin du champ) et `.worldmap-btn` (l'ouvreur du rail dissous ≤700 se
  // pose lui-même : sans ancrage il retombait dans le flux du stage). Deux noms CITÉS, aucun défini
  // en propre ici, et aucun décoratif — chacun porte un ancrage que le HUD n'avait pas.
  // +1 (153 → 154), #1411 P2-A : `.is-hand` — l'ANCRAGE de l'interrupteur de pause de Round
  // (`raise-hand`, spec §1d) au pied de la frise (il s'aligne sur la colonne sans l'élargir). Un seul
  // nom, aucun décoratif : sans lui la commande déborde la colonne. La GRADUATION de sa raison de
  // refus appartient à sa primitive (`GatedAction` variante `dense`, components.css) — ce module ne
  // redéfinit aucune taille de texte pour elle.
  'styles/hud.css': 154,
  'styles/mass-battle.css': 29,
  'styles/merchant.css': 53,
  'styles/ornaments.css': 13,
  // #492 Lot 1b : -9 (91 → 82) — extraction du bloc `.test-scenarios`/`.ts-*` (SON module dédié,
  // aucun rapport avec la fiche) ; +5 (82 → 87) — onglet État rédigé, silhouette organisatrice
  // (`.etat-body`/`-zones`/`-zone`/`-ras`/`.ras-title`, tonalité en attribut `data-tone` — pas de
  // classe par ton). Net -4.
  // #492 Lot 1c (registre compact, arbitrage user 2026-07-17) : -3 (87 → 84) — la silhouette
  // organisatrice (rig + zones par Localisation, jugée du bruit) MEURT : `.etat-body`/`-zones`/
  // `-zone` retirés. Ne reste que l'état calme (`.etat-ras`/`.ras-title`, composition validée
  // inchangée) — le registre affligé compose `Band`/`PlaqueRow`, aucune classe neuve ici.
  // +2 (#509 : .bg-favors/.favor-chip — Faveurs dues sur BackgroundPanel) — survivent (BackgroundPanel, hors fiche).
  // #492 LOT « colonne PRÉSENCE » (arbitrage 2026-07-17, 2e vague) : +1 (84 → 85) — SEULE hausse du
  // lot, malgré la mort de la rangée de compagnie (`.frame-row`, portée par `party.css`, pas ce
  // module) et le déplacement pur des blocs `.sheet-vitals`/`.sheet-resources`/`.sheet-stats` DANS
  // la colonne et les onglets (zéro classe neuve, ils sont RÉUTILISÉS — et restent VIVANTS pour
  // `ShipSheet.tsx`, qui les partage, donc non retirables). Le `+1` est `.plaque-row`, référencé ICI
  // pour les liserés de gravité (`[data-tone] .plaque-row`, pt.5) : `PlaqueRow.tsx` est hors périmètre
  // du lot (pas de prop `tone` à y ajouter, `data-tone` reste posé sur la bande `Section` englobante,
  // jamais une classe par ton) — cibler le sélecteur en DESCENDANT est le seul geste possible sans
  // sortir du périmètre. La gangrène du cadre (`data-corruption`, pt.6) et le dock au-dessus de
  // l'overlay (pt.2, `PartyDock.tsx`) sont à coût NUL ici (attributs / z-index inline contextuel).
  // Correction de jumeau (2026-07-17) : -3 (86 → 83) — `.sheet-headstats` (bornage 223px, écrit
  // contre le MAUVAIS jumeau) et `.sheet-stats`/`.sheet-resources` (morts : la tête de l'onglet
  // Compétences RÉUTILISE désormais `hero-sheet-stats`/`.hero-sheet-derived`, le patron du jumeau
  // CANONIQUE `HeroSheet` — hero-sheet.css, déjà importé globalement, aucune classe neuve). `.sheet-
  // vitals` reste (vivant pour Encombrement en Possessions ET pour `ShipSheet.tsx`).
  // Onglet Compétences & Talents composant `HeroSheet` (arbitrage 2026-07-17) : -1 (83 -> 82) -- `.sheet-skills`
  // (margin-bottom du wrapper 'competences' recodé a la main) MEURT : la rubrique vit desormais dans
  // la primitive, dont le flex `.hero-sheet{gap:10px}` espace deja ses sections.
  // #492 lot « colonne présence » (arbitrage user 2026-07-17, rig grand format + arc integre) :
  // +4 (82 -> 86) -- l'override mobile compose la primitive FigTile/VitalArc en DESCENDANT
  // (`.sheet-portrait .fig-tile.hero`/`.fig-tile-fig`, `.sheet-portrait .vital-arc svg`) : 4
  // classes CITEES ici (fig-tile, hero, fig-tile-fig, vital-arc), aucune definie EN PROPRE.
  // Onglet État sans figurine au repos (arbitrage user 2026-07-17) : +1 (86 -> 87) -- `.ras-sub`
  // (sous-ligne discrete du RAS), seule classe neuve ; `CharacterPreview` retiree de l'etat calme.
  // Lot POSSESSIONS (B), registre `Band`/`PlaqueRow` (#492) : +7 (87 -> 94) -- `.inv-rows` (déplacé
  // de combat-modals.css) + `.inv-item-nested`/`.inv-actionbar`/`.inv-skin`/`.inv-skin-body`/
  // `.inv-skin-remove`/`.inv-nested` (déplacé aussi) : la rangée-plaque élue déplie sa barre
  // d'actions EN PLACE, contrepartie ASSUMÉE des -12 de combat-modals.css.
  // Fix visuel (registre Possessions rétréci à son contenu vs jumeau État pleine largeur) : +1
  // (94 -> 95) -- `.inv-item` devient flex-column (même mécanisme d'étirement que `creator-band`
  // en État : la `PlaqueRow`/bouton n'est stretch que si elle est enfant direct d'un flex/grid).
  // Lot « corps-index » (#492, arbitrage 2026-07-17) : -1 (95 -> 94) -- purge de la plaque ENC.
  // (`.stat-chip.enc-over`, seule occurrence dans ce module) : la plaque MEURT sans remplaçant
  // (amendement en vol — l'Encombrement rejoint une barre de la colonne au geste suivant).
  // Geste « colonne au croquis » (2026-07-17) : +4 (94 -> 98) -- `VitalArc` MEURT (-1, `.vital-arc`
  // purgé de `.sheet-portrait .vital-arc svg`) ; la colonne compose désormais `NotchGauge` (Blessures
  // + Encombrement, jauge PARTAGÉE Coque/Moral/Soute) via `.sheet-portrait .notch-gauge` (+1) et les
  // rangées race/classe/statut via `.sheet-idrows`/`.sheet-idrow`/`.sheet-idrow-label`/`.sheet-idrow-
  // value` (+4), aucune classe neuve pour la jauge elle-même (SOURCE UNIQUE `gauges.css`).
  // Compteurs de DESTIN (pt.4, #492, arbitrage 2026-07-17) : +1 (98 → 99) — `.etat-threshold`
  // (« actives N/BE », « phys N/BE · ment M/BFM »), ton par palier en attribut `data-tone`.
  // Fix de composition (2026-07-17) : -1 (99 → 98) — `.etat-threshold` MEURT, les compteurs
  // composent désormais `NotchGauge` (primitive crantée, `gauges.css`), aucune classe ici.
  // Lot « chevet » — grammaire de carte + bande DESTIN (#492, 2026-07-17) : +6 (98 → 104) — noms CITÉS
  // dans ce module par les nouveaux sélecteurs DESCENDANTS/scopés (aucune n'y est DÉFINIE en propre,
  // le compte est par nom cité, pas par règle) : `.sheet-etat`/`.plaque-value` (valeur discrète du
  // registre, « ces textes énormes en gras, pourquoi ? »), `.etat-destin-row`/`.notch-gauge` (bande de
  // synthèse Destin), `.life-bar__label`/`.life-bar__value` (discipline d'alignement gauche/droite de
  // la colonne, patron `.sheet-idrow*` déjà tenu ici).
  // LOT L addendum pt.5 (durci, 2026-07-17) : -1 (104 → 103) — `.plaque-value` (valeur discrète)
  // MIGRE dans la primitive (`plaque-row.css`, variante `[data-value-muted]`) et ne se cite plus ICI.
  // Fix d'alignement de la bande Seuils (juge vision, 2026-07-17) : -1 (103 → 102) — `.etat-destin-row`
  // MEURT (règle purgée, cf. FLEX_WRAP_BASELINE ci-dessus) : les 3 jauges composent `.notch-gauge-stack`
  // (gauges.css, à côté de la primitive `NotchGauge`) au lieu d'un scope local à cet écran.
  // Fusion vague-2 + fiche : 106 (précédent fusionné) - 2 (LOT L+M) = 104.
  // Tableau de bord État (arbitrage user 2026-07-17) : +2 (`.reserves-seuils-grid` grille 2 colonnes
  // de la bande « Réserves & seuils », `.etat-chips` rangée de chips codex-liées qui s'enroule —
  // `.plaque-fx` scopé `.plaque-name >` dans `PlaqueRow`, non composable ici) ; -3 (`.etat-ras`/
  // `.ras-title`/`.ras-sub`, ancien état RAS mort). `.etat-buff`/`.etat-chip-clock` envisagées puis
  // ÉVITÉES (décrue avant hausse) : le ton de buff réutilise `.chip.tone-ok` (variante ajoutée à la
  // famille `.tone-warn`/`.tone-danger`, components.css) et le cumul/durée inline réutilise
  // `.entity-badge` (badge discret de fin de chip, déjà partagé par `EntityChip`, base.css) — zéro
  // classe neuve pour les deux. Net 104 → 104 (inchangé).
  // Renommage du titre AFFICHÉ de la bande de capacité (arbitrage user 2026-07-18, ancien titre
  // rejeté) : classe de grille renommée en écho — `.reserves-seuils-grid` (même sélecteur, nom
  // aligné). Net 104 → 104 (renommage, pas d'ajout).
  // #762 : `.inv-item-head` — tête de ligne du Registre des Possessions (plaque cliquable de gestion
  // + son lien Codex SIBLING, jamais imbriqué). Net 104 → 105.
  // #990 : `.masked` — ÉTAT de la primitive `RollLine` (jet figé caché jusqu'à la réponse), aux côtés
  // de `.ok`/`.fail`/`.pending` : liseré 3px neutre + empreintes réservées des colonnes dé/DR (la
  // révélation ne déplace rien). Classe de PRIMITIVE, jamais d'écran — aucun site ne la pose. 105 → 106.
  // #1072 : `.rm-roll-diff` — la Difficulté du Test sur la LIGNE (texte + valeur), classe de la
  // PRIMITIVE `RollLine`. MIGRATION, pas un ajout net : `.interlude-hint` (world-meta.css, 134 → 133)
  // meurt en regard — la Difficulté ne se peint plus écran par écran. 106 → 107.
  // #1078 LOT B1 : net NUL (107 → 107) — `.recap-line` est CITÉE ici (`.rm-journal .recap-line`,
  // aucune définition propre : l'issue d'un jet est une donnée rendue par le renderer UNIQUE dans le
  // cadre que ce module possède déjà) ; `.jr-line` n'est plus citée — aucune modale ne compose plus
  // le markup du journal, sa gouttière se reprend en sélecteur d'ÉLÉMENT (`.recap-line > svg`).
  // Finition B1 : +1 (107 → 108) — `.rm-await` (zone d'ATTENTE d'un verdict suspendu à une fenêtre
  // qui va s'interposer, #1004) : rôle distinct de l'issue, donc classe propre aux mêmes tokens de
  // bloc, jamais la note de pied `.rm-log`.
  // +3 (#1388 C4) : la métrique compte des NOMS DE CLASSE (`classNamesDefined`), et le segment qui
  // compose `GatedAction bare` en nomme trois qui n'existaient pas dans ce module — `btn-nu`,
  // `gated-action`, `codex-ref`. Ce ne sont PAS des classes neuves du domaine : elles appartiennent
  // aux primitives (`base.css`, `components.css`), et `sheet.css` ne fait que reprendre la main de
  // SPÉCIFICITÉ dessus (`.seg .btn.btn-nu` bat `.seg button`), sans dupliquer une déclaration. Le
  // sélecteur d'attribut `[aria-disabled='true']` ne pèse rien dans cette métrique.
  'styles/sheet.css': 111,
  // #492 Lot 1b : écran-catalogue des scénarios de test, sa propre maison (extrait de sheet.css).
  'styles/test-scenarios.css': 9,
  'styles/tavern.css': 13,
  // +1 (#942 L7, verdict vision) : `.interlude-phase-actions .hint` — la raison d'un CTA fermé se pose
  // AU-DESSUS du bouton (il changeait d'ancrage entre gaté et actif). Aucune contre-règle de voile
  // ici : l'allègement est descendu dans son domaine (combat-modals.css), le voile plein redevient
  // le défaut partagé.
  // #1072 : -1 (134 → 133) — `.interlude-hint` mort, la Difficulté est rendue par `RollLine`.
  // #1318 V10 (2026-08-16) : +1 (133 → 134) — `.market-carrier`, chip de PORTEUR de la barre d'outils
  // du marché terrestre. Le site EMPRUNTAIT `.port-purse`, propriété de la primitive `ScreenMeta`
  // (garde `primitive-owners-guard`) : un porteur n'est pas une bourse, la classe est sa sémantique
  // propre et vit dans SON domaine (world-meta), documentée au catalogue de `docs/charte-ui.md`.
  // -4 : la carte du monde n'habille plus le roster de postes — sa matière vit dans
  // `postes-roster.css`, à côté de la primitive `PostesRoster` que le dossier de navire compose aussi.
  'styles/world-meta.css': 130,
  'styles/city-hub.css': 18,
  'styles/voyage.css': 30,
  // Galerie design system DEV (#412) — layout d'écran seul (les spécimens composent le canon).
  'styles/gallery.css': 17,
  // Rose des forces (#409) — `.rose`/`.rose text`/`.rose-corner` (`.rose-corner.sm .rose` réutilise
  // le sélecteur `.rose` déjà compté, dédoublonné par module).
  'styles/rose.css': 3,
  // Cadre-figurine UNIQUE (FigTile, #430) — `.fig-tile`/`-name`/`-sub`/`-seal`/`.sel`/`.charprev`
  // (descendant `.fig-tile-fig > .charprev`, dédoublonné) — module primitive dédiée, MÊME patron que
  // rose.css/hero-sheet.css.
  // Consolidation #431 (LOT « la tuile, aux valeurs ») : +1 (7 → 8) — le doublon `.fig-tile*` de
  // creator.css est PURGÉ (phase 2 de #430, jamais faite : deux peaux se disputaient la primitive
  // par cascade — ce que frames.css redéclarait gagnait, ce qu'il ignorait survivait), ce module
  // devient la SEULE définition. `.fig-tile-legend` (bandeau superposé) meurt au profit de
  // `.fig-tile-fig` (boîte-figurine à hauteur FIXE, patron `.fam-tile` de la planche) et de la
  // variante par PROP `.big` (172px pleine zone vs 104 compacte) — l'appelant choisit une taille,
  // jamais une classe par écran. Contrepartie : creator.css paie -2 en regard.
  // #492 lot « colonne présence » (arbitrage user 2026-07-17, rig grand format) : +1 (8 -> 9) --
  // `.fig-tile.hero` (boite-figurine PLEINE FORME 320px, presence STATIQUE de l'aside de la fiche)
  // rejoint `.big`/`.compact` comme 3e variante de taille de la MEME primitive.
  // Lot « corps-index » (#492, arbitrage 2026-07-17) : +2 (9 -> 11) -- `.fig-zone-badges`/
  // `.fig-zone-badge` (badges ANCRÉS par Localisation, position en attribut `data-loc`, ton en
  // `data-tone` — jamais une classe par zone/ton, patron déjà tenu par sheet.css/NotchGauge).
  // Cadre de campagne (#717) : +1 (11 -> 12) -- `.fig-row`, la RANGÉE de tuiles (grille uniforme,
  // 2 colonnes ≤700px) posée AVEC la primitive qu'elle aligne, par `FigRow` (FigTile.tsx). Aucun
  // motif d'écran : l'écran d'ouverture la COMPOSE, il ne redessine pas de grille.
  'styles/frames.css': 12,
  // Corps de fiche héros (HeroSheet.tsx, #417 suite) — bande d'en-tête + dérivées 2 colonnes,
  // SOURCE UNIQUE partagée par la fiche vivante du créateur et le détail candidat.
  // Lot P3 final (retouches juge vision) : +1 — `.chip-roadmap` (chips prospectives par rubrique).
  // Onglet Compétences & Talents composant `HeroSheet` (`skillsVariant='valeurs'`, arbitrage 2026-07-17) : +5 —
  // `.skill-grid`/`.skill-line`/`.sk-name`/`.sk-val`/`.sk-adv` migrés depuis combat-modals.css (leur
  // rendu vit dans la primitive, contrepartie ASSUMÉE en regard).
  'styles/hero-sheet.css': 12,
  // Ossature 2 zones du créateur (CreatorStepFrame, lot « ossature enforcée » #393) — slots
  // `.creator-step-(action|choice|desc)` + dés DORÉS planche (`.rm-die-*` scopés au gabarit et aux
  // plateaux `.dicewell-tray`) ; le layout `.creator-step` vit dans creator.css (renommage 1:1).
  // Consécration StepHeader (#393 amendement 3, clôture étape 7) : +3 (8 → 11) — l'en-tête de pas
  // rejoint le module de SA primitive (`.step-head`/`-title`, + le bornage `.dicewell` de la topbar,
  // classe déjà définie en creator.css : le compte est par-module) ; creator.css paie -3 en regard.
  // +1 (11 → 12) : `.btn-step` — la MANIVELLE laiton de la planche (`.crank button`) reteint la
  // primitive PARTAGÉE `QtyStepper` DANS le gabarit d'étape, MÊME idiome que les dés dorés
  // (`.rm-die-*`) déjà scopés ici : la peau marchande (`--panel2` en aplat, components.css) reste le
  // canon de la table de négoce, aucun fork du composant. Lot « matières & proportions » #393.
  // -4 (2026-07-16, #496) : `.rm-die-gem`/`.rm-die-num`/`.rm-die-rolling` (scopes `.creator-step`/
  // `.dicewell-tray`) purgés — la matière DORÉE des dés est maintenant la prop `tone="gold"` de
  // `DieFace`/`DiceRoll` (modificateur `.rm-die-gold`, SOURCE UNIQUE combat-modals.css).
  'styles/creator-step.css': 8,
  // Mise en scène FINALE du créateur (`PresentationScreen`, migration étape 8 du lot ossature) —
  // l'étape EXEMPTÉE du gabarit 2 zones (user 2026-07-15 : « sauf sur le dernier écran ») porte son
  // style dans SON module, jamais dans creator.css (amendement 2 : décrue nette exigée). Valeurs de
  // la planche ratifiée § « Écran final » : `.fin-col` (registre), `.fin-stage` (la scène),
  // `.c-lamp` (la lampe), `.c-main` (gabarit). Contrepartie ASSUMÉE des -9 de creator.css.
  'styles/creator-presentation.css': 8,
  // Coquille « Atelier du scribe » du créateur (lot « matières & proportions » #393) — `.dirC` de la
  // planche FINALE : le SOL de l'écran, que `.screen` (base.css) ne pose pas et que le radial
  // générique du `body` tenait à sa place (mesuré : #1f180f → #100e0b, plus clair et plus froid).
  // Module DÉDIÉ et non creator.css (cliquet gelé à 107) ni la couche partagée (cliquet xiii —
  // `.screen.creator` est mono-consommateur, donc du DOMAINE) : idiome `.screen.codex` de
  // compendium.css. 2 = les deux noms du sélecteur composé `.screen.creator`.
  'styles/creator-shell.css': 2,
  // Rangée-plaque à rivets d'or (PlaqueRow/PlaqueGrid, #393 amendement 3) — matière `.c-plate` +
  // états `.ck-cell` de la planche FINALE, module primitive dédiée (patron rose.css/frames.css) :
  // `.plaque-(row|grid|prefix|name|meta|value)`, états `.sel`/`.rolling`, dés compacts ET dorés
  // scopés à la méta (`.rm-die`/`-num`/`-gem`/`-rolling` — la plaque rend or où qu'elle soit
  // montée, galerie comprise ; la gemme rouge de combat-modals.css reste le canon du combat).
  // Migration étape 7 (details, même lot) : +1 (12 → 13) — `.plaque-label` : la colonne de libellé
  // gravée de la planche (`.idf .lb`, 92px small-caps) rejoint la primitive, contrepartie ASSUMÉE
  // des -5 de creator.css (mécanisme voulu par l'amendement 3 : « les classes par-étape meurent
  // dans les primitives ») — la plaque ÉDITABLE (`.idf .vl` : trait pointillé) et la plaque
  // CLIQUABLE n'ont, elles, coûté aucune classe (sélecteurs d'élément `.plaque-name > input` /
  // `button.plaque-row`).
  // -2 (2026-07-16, #496) : `.rm-die-gem`/`.rm-die-rolling` (scope `.plaque-meta`) purgés — même
  // bascule que creator-step.css vers le modificateur `.rm-die-gold` de combat-modals.css.
  // +1 (lot « chevet », #492) : `.plaque-fx` — bloc de chips d'effet net SOUS le nom (registre État),
  // additif à `meta` (qui reste latérale pour les autres écrans, ex. badges Possessions).
  'styles/plaque-row.css': 12,
  // Bande titrée (`Band`, extraite du créateur #492 Lot 1c) — module primitive dédiée (patron
  // rose.css/frames.css) : `.creator-band(-head|-right)` + les descendants `.hint`/`.notch-gauge`
  // (jauge du tirage, complète la primitive `NotchGauge` sans fork).
  // +1 (LOT L, 2026-07-17) : `.creator-band-title-link` — reset du bouton-titre CLIQUABLE
  // (`onTitleClick`, registre État → catégorie Compendium), posé UNE fois dans la primitive.
  // +1 (juge vision, 2026-07-17) : `.creator-band-title-affordance` — glyphe d'affordance codex
  // (discret au repos, plein contraste au survol/focus), posé UNE fois dans la primitive.
  'styles/band.css': 7,
  // Panneau-paramètre borné ANCRÉ (`PanneauParametre`, spec HUD combat zone 10) — module primitive
  // dédiée : `.pp-panel` (la surface hors flux, ancrée), `.pp-title`, `.pp-meta` (la méta qui fait
  // décider : NI, quantité, progression). La 4ᵉ est `.rm-loc-grid` — non pas une définition neuve
  // mais le SCOPE du canon d'`OptionChooser` dans le panneau (une valeur de paramètre par ligne),
  // même précédent que `.creator-step .rm-loc-grid` (creator.css).
  // +2 (roster par poste, 2026-09-05) : `.pp-visuel`/`.pp-nom` — la rangée d'un candidat PORTEUR
  // D'UN VISUEL (portrait : affecter une personne) est `[visuel] [nom] [méta]`, rangée par la
  // PRIMITIVE. Sans ces deux nœuds, la grille positionnelle ci-dessus chassait le nom contre le bord
  // droit et reléguait la méta sous le portrait, et chaque appelant aurait dû recoder sa rangée.
  'styles/panneau-parametre.css': 6,
  // Astrolabe de la roue céleste (`CelestialWheel`, migration étape 4 du lot ossature) : les MATIÈRES
  // du cadran aux valeurs du `svg` « 4 — Signe astral » de la planche FINALE. 14 pour 3 qui vivaient
  // dans creator.css : contrepartie ASSUMÉE de la fidélité (l'ancienne roue était un croquis à deux
  // anneaux — pas d'aiguille, pas de rayons gravés, pas de bornes d100, pas de moyeu), tenue au plus
  // court par mutualisation — un SEUL filet laiton (`.cw-ring-fine`) pour l'anneau intérieur, l'anneau
  // pointillé (dash en attribut) et le liseré du moyeu ; les deux `<stop>` de la gemme portent leur
  // `stop-color` en attribut `var(--…)` ; la note du moyeu et l'invite du cadran vide partagent
  // `.cw-hub-note`. Le reste est un nœud = une matière, sans descendant décoratif.
  'styles/celestial-wheel.css': 14,
  // Roster PAR POSTE (`PostesRoster` + sa case `AssignRow`) — module de la primitive (patron
  // panneau-parametre.css/band.css) : `.pr-roster`, `.pr-ligne`, `.pr-label`, `.pr-banc`,
  // `.pr-cases`, `.pr-add` (6 matières, une par nœud de la maquette A). La 7ᵉ n'est pas une
  // définition neuve mais le SCOPE tactile d'une primitive composée (`.ptile` de `PortraitTile`) —
  // la cible de 44 px de la charte est portée par la feuille qui compose, jamais par une
  // neutralisation depuis un écran. `.mini-title` (grille du titre) est cataloguée ailleurs.
  'styles/postes-roster.css': 8,
};

// ── (xiii) FUITE DE DOMAINE dans la COUCHE PARTAGÉE (#371) : le cliquet (xii) ne scanne que les modules
//    de DOMAINE — `base.css`/`components.css` (couche atomique partagée) en sont EXCLUS. C'était le trou :
//    44 classes `.party-*`/`.candidate-*`/`.seat-*` s'étaient planquées dans base.css pour échapper au gel
//    (feedback user 2026-07-13 « elle réinvente la roue, on a des guards mais elle passe à travers »). Une
//    classe de la couche partagée n'est LÉGITIME que si elle est VRAIMENT partagée : soit DOCUMENTÉE au
//    catalogue de `docs/charte-ui.md` (contrat de couche atomique — inclut les primitives React qui posent
//    leurs classes), soit UTILISÉE par ≥2 modules `.tsx` distincts (usage transversal réel). Une classe
//    définie là, mono-consommateur ET non cataloguée = du DOMAINE déguisé → elle doit vivre dans un module
//    de domaine (cliqueté par xii). BASELINE par fichier, GELÉE et DÉCROISSANTE : sortir une famille de
//    domaine (ex. `.city-hub-*`/`.voyage-*` → leur module) ABAISSE la baseline ; en ajouter une la fait
//    monter → échec. Mesure STRUCTURELLE (pas une liste de noms) — la baseline est un COMPTE, pas un
//    allowlist nominatif. L'usage TSX se lit dans les valeurs `className` (littéraux, gabarits, ternaires).
// Couche PARTAGÉE gardée par xiii (chemins relatifs à `src/ui/`) : la couche atomique
// (`base`/`components`), la primitive d'onglets `tabs`, et l'orchestrateur d'`@import` `styles.css`
// (top-level) qui porte aussi les règles TRANSVERSES manette + le bandeau DEV du collecteur d'erreurs.
// #1411 P2-C : `../gameIso/anim.css` entre au radar — c'est la feuille du CHROME DU MONDE (marques de
// jeton, pastille d'état de fin, pastille d'ENTITÉ), consommée par plusieurs modules de `gameIso`, et
// elle échappait aux DEUX cliquets (xii ne voit que `src/ui/styles/`, xiv ne parcourt que `src/ui`).
// Une classe qui s'y planquerait sans être partagée ni cataloguée compte donc désormais comme fuite.
const SHARED_CSS_FILES = ['styles/base.css', 'styles/components.css', 'styles/tabs.css', 'styles.css', '../gameIso/anim.css'];
const SHARED_LEAK_BASELINE: Record<string, number> = {
  // #1372 : 16 → 15 — `.lazy-fallback` cesse d'être mono-consommateur (le voile d'entrée en scène du
  // monde volumique le REPREND au lieu de définir sa propre classe, `stage/VolumetricWorld.tsx`).
  'styles/base.css': 15, // #417 : `.hero-present-sec` reste croisée (PartyScreen+HeroPresentation) ; `.lore-chip`/
  // `.hero-present-chips` repassent mono-consommateur — le détail candidat compose désormais `SkillChip`/
  // `TalentChip`/`EntityRef` + `.skill-tags` (recalage utilisateur 2026-07-14, primitives de fiche vivante)
  // #839 : INCHANGÉ à 11 — le partage de l'écran Options déplace deux fuites sans en retirer :
  // `.game-menu-overlay` devient transversal (GameMenu + OptionsScreen, −1) mais `.menu-sub-body`
  // redevient mono-consommateur (le corps à onglets n'a qu'un porteur, `OptionsScreen`, +1).
  // #1318 V10 (2026-08-16) : 11 → 10 — DÉCROISSANCE mesurée après la migration des recopies de markup
  // vers leurs primitives (garde `primitive-owners-guard`). Stock restant, mesuré : `alert`, `col-name`,
  // `col-stat`, `col-emph`, `col-enc`, `col-price`, `col-buy`, `detail-row`, `group-row`, `rm-roll`.
  'styles/components.css': 10,
  'styles/tabs.css': 1,
  'styles.css': 6,
  // Chrome du MONDE : les classes y sont mono-consommateur PAR NATURE (un peintre unique par marque —
  // `TokenChromeMarks`, `PastilleEntite`, les animations de FX). Baseline posée à l'entrée au radar,
  // GELÉE et DÉCROISSANTE comme les autres.
  '../gameIso/anim.css': 26,
};

/** Classes `.foo` citées entre backticks dans le catalogue de la charte (contrat de couche atomique). */
function catalogueClasses(): Set<string> {
  const doc = readFileSync(fileURLToPath(new URL('../../docs/charte-ui.md', import.meta.url)), 'utf8');
  const names = new Set<string>();
  for (const m of doc.matchAll(/`([^`]*)`/g)) {
    for (const c of m[1].match(/\.[a-zA-Z_-][\w-]*/g) ?? []) names.add(c.slice(1));
  }
  return names;
}

/** class → nombre de modules `.tsx` distincts qui la citent dans une valeur `className` (littéral,
 *  gabarit, ternaire — on collecte les tokens des sous-chaînes quotées de l'attribut). */
function classUsageByModule(): Map<string, Set<string>> {
  const uses = new Map<string, Set<string>>();
  for (const { rel: f, text: raw } of readCorpus(['src'], { exts: ['.tsx'] })) {
    const re = /className\s*=\s*(\{[\s\S]*?\}|"[^"]*"|'[^']*'|`[^`]*`)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) {
      for (const seg of m[1].matchAll(/(["'`])([^"'`]*)\1/g)) {
        for (const tok of seg[2].split(/\s+/)) {
          if (/^[a-zA-Z][\w-]*$/.test(tok)) (uses.get(tok) ?? uses.set(tok, new Set()).get(tok)!).add(f);
        }
      }
    }
  }
  return uses;
}

function classNamesDefined(css: string): Set<string> {
  const names = new Set<string>();
  let buf = '';
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '{') {
      const sel = buf.trim();
      if (sel && !sel.startsWith('@')) {
        const matches = sel.match(/\.[a-zA-Z_-][\w-]*/g) || [];
        for (const m of matches) names.add(m.slice(1));
      }
      buf = '';
    } else if (c === '}') {
      buf = '';
    } else {
      buf += c;
    }
  }
  return names;
}

function scanBareButtons(files: readonly Fichier[]) {
  const bare: Record<string, number> = {};
  const opaque: Record<string, number> = {};
  for (const f of files) {
    const raw = f.text;
    // Neutralise les commentaires bloc `/* ... */` (dont JSDoc/`{/* JSX */}`) et ligne `//…` avant le
    // scan — un `<button>` cité en prose ne doit pas polluer le compte.
    const src = raw
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/(^|[^:])\/\/.*$/gm, (_m, p) => p);
    const re = /<button\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      // Fin de la balise ouvrante = premier `>` hors accolades (les expressions `{…}` d'attribut
      // peuvent contenir des `>` de comparaison/générique).
      let depth = 0;
      let tagEnd = -1;
      for (let i = m.index; i < src.length; i++) {
        const c = src[i];
        if (c === '{') depth++;
        else if (c === '}') depth--;
        else if (c === '>' && depth === 0) { tagEnd = i; break; }
      }
      if (tagEnd === -1) continue;
      const tag = src.slice(m.index, tagEnd + 1);
      const cls = tag.match(/className\s*=\s*(\{[\s\S]*?\}|"[^"]*"|'[^']*'|`[^`]*`)/);
      const r = rel(f);
      if (!cls) {
        bare[r] = (bare[r] ?? 0) + 1;
        continue;
      }
      const clsVal = cls[1];
      if (BARE_BUTTON_CANON.test(clsVal)) continue; // conforme (littéral btn/chip/seg présent)
      if (!/["'`]/.test(clsVal)) {
        opaque[r] = (opaque[r] ?? 0) + 1; // expression opaque, catégorisée à part — pas un échec aveugle
        continue;
      }
      bare[r] = (bare[r] ?? 0) + 1;
    }
  }
  return { bare, opaque };
}

// ── (xv) Rangées TÉMOINS (`interactive:false`) porteuses d'une VALEUR inline (`d:`/`pending:`) hors
//    du builder `opposedFrozen.ts` (#990) : toute rangée qui affiche le jet FIGÉ d'un adversaire doit
//    passer par le calendrier de découverte UNIQUE (`frozenOpposedRow`) — sinon un site ré-affiche un
//    jet masqué ailleurs. Le stock recensé au #990 est gelé et décroissant.
//    COUVERTURE du détecteur (à énoncer, pas à supposer) : il ne voit que les littéraux de rangée
//    portant la valeur EN PLACE (`d:`/`d,`/`pending:`) ; une rangée assemblée depuis une variable
//    (`row: r` de `witnessRows`, `row: pr`) lui échappe. Commentaires exclus du scan.
//    Chaque entrée restante est un témoin dont le jet ne PEUT PAS précéder la réponse (construit
//    `rolled &&`, ou jet du même acteur) : rien à masquer. Les jets figés À L'OUVERTURE (Empoignade,
//    Au Contact, Distraire, Désengagement) sont passés au builder au #990 ; le Marchandage les a
//    rejoints au #1153 (sa rangée adverse existe désormais dès l'ouverture, masquée par le calendrier).
const FROZEN_WITNESS_BASELINE: Record<string, number> = {
  // 2ᵉ Compétence du MÊME acteur (Test combiné) ; la « Puissance » ennemie passe par `opposedLines`.
  'ActivityModal.tsx': 1,
  'CascadeModal.tsx': 1,           // rangée-participant FIGÉE d'un pas batch DÉJÀ validé (pile des étapes)
  'jetProps/useAttackJetProps.tsx': 2, // défense adverse : aperçu SANS valeur (pré-jet) + résultat post-jet
  'MultiRollList.tsx': 1,          // bilan de jets déjà résolus
};

/** Portée d'une occurrence : le littéral `{…}` englobant (forme objet) ou la balise JSX (forme `={false}`). */
function rowScope(src: string, idx: number, jsx: boolean): string {
  if (jsx) {
    const start = src.lastIndexOf('<', idx);
    const end = src.indexOf('>', idx);
    return src.slice(start < 0 ? 0 : start, end < 0 ? src.length : end);
  }
  let depth = 0;
  let i = idx;
  for (; i >= 0; i--) {
    if (src[i] === '}') depth++;
    else if (src[i] === '{') { if (depth === 0) break; depth--; }
  }
  const open = Math.max(0, i);
  depth = 0;
  let j = open;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(open, j + 1);
}

/** Portée d'un APPEL : l'argument, de la parenthèse ouvrante (indice `open`) à sa fermante équilibrée. */
function callScope(src: string, open: number): string {
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === '(') depth++;
    else if (src[j] === ')') { depth--; if (depth === 0) return src.slice(open, j + 1); }
  }
  return src.slice(open);
}

/** Constructeurs de la porte `rollRowBuild.ts` (le montage y prend son 1ᵉʳ argument et ses EXTRAS au 2ᵉ). */
const PORTE_CTOR = /\b(buildRollRow|participantRow|tableRow|drawRow|worldRow|witnessRow|frozenOpposedRow)$/;

/** Appel de la PORTE englobant l'indice donné — sa portée est l'APPEL ENTIER (les deux arguments).
 *  Sans lui, `interactive:false` posé dans les EXTRAS (2ᵉ argument) se lirait seul, sans le `d:`/`pending:`
 *  resté au 1ᵉʳ : une rangée sortirait du radar en passant par la porte, sans que le stock ait bougé. */
function enclosingPorteCall(src: string, idx: number): string | null {
  let depth = 0;
  for (let i = idx; i >= 0; i--) {
    const c = src[i];
    if (c === ')') depth++;
    else if (c === '(') {
      if (depth === 0) return PORTE_CTOR.test(src.slice(Math.max(0, i - 32), i)) ? callScope(src, i) : null;
      depth--;
    }
  }
  return null;
}

function scanFrozenValueRows(files: readonly Fichier[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of files) {
    const src = f.text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // Deux ÉCRITURES d'une rangée témoin, une seule population : le champ posé à la main
    // (`interactive:false`) et le constructeur `witnessRow(` de la porte (#1262), qui le pose pour
    // le site. Sans la seconde, la migration d'un site vers la porte VIDERAIT ce cliquet sans que
    // le stock réel (une valeur figée affichée hors calendrier) ait bougé d'une ligne.
    const re = /interactive(:\s*|=\{)false|witnessRow\(/g;
    let m: RegExpExecArray | null;
    let n = 0;
    while ((m = re.exec(src))) {
      // La portée d'un appel de constructeur est SON argument (jusqu'à la parenthèse équilibrée) —
      // pas le bloc englobant, qui ferait compter la ligne d'un voisin.
      const scope = m[0].startsWith('witnessRow')
        ? callScope(src, re.lastIndex - 1)
        : (enclosingPorteCall(src, m.index) ?? rowScope(src, m.index, m[1] === '={'));
      if (/\bd\s*[,:]|\bpending\s*[,:]/.test(scope)) n++;
    }
    if (n > 0) counts[rel(f)] = n;
  }
  return counts;
}

describe('#236 — cliquets d’hygiène UI', () => {
  it('(iv) hex hors tokens : aucune hausse par module CSS (base.css exclu)', () => {
    const counts: Record<string, number> = {};
    for (const f of FICHIERS_UI().filter((f) => estCss(f) && nomDe(f) !== 'base.css')) {
      // Commentaires exclus du scan : un « #304 » de réf de ticket n'est pas une couleur.
      const css = f.text.replace(/\/\*[\s\S]*?\*\//g, '');
      const n = (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
      if (n > 0) counts[rel(f)] = n;
    }
    assertRatchet(counts, HEX_BASELINE, 'hex hors tokens');
  });

  it('(v) prix ⇒ <Coins> : aucune composition manuelle de monnaie (fail-closed, exemptions PA nominatives)', () => {
    const files = FICHIERS_UI()
      .filter((f) => estTsx(f) && !estTest(f))
      .filter((f) => nomDe(f) !== 'Coins.tsx')
      .filter((f) => !PRICE_PA_ARMOR_EXEMPT.has(rel(f)));
    const counts: Record<string, number> = {};
    for (const f of files) {
      const n = (f.text.match(/\}[^<>{}]{0,4} (?:CO|PA|CA)\b/g) || []).length;
      if (n > 0) counts[rel(f)] = n;
    }
    assertRatchet(counts, PRICE_BASELINE, 'prix sans <Coins>');
  });

  it('(vii) flex-wrap: wrap hors components.css : aucune hausse par module CSS', () => {
    const counts: Record<string, number> = {};
    for (const f of FICHIERS_UI().filter((f) => estCss(f) && nomDe(f) !== 'components.css')) {
      const n = (f.text.match(/flex-wrap:\s*wrap/g) || []).length;
      if (n > 0) counts[rel(f)] = n;
    }
    assertRatchet(counts, FLEX_WRAP_BASELINE, 'flex-wrap hors components.css');
  });

  it('(viii) fill/stroke littéraux hors token var(--…) : aucune hausse par fichier .tsx', () => {
    const counts: Record<string, number> = {};
    for (const f of FICHIERS_UI().filter((f) => estTsx(f) && !estTest(f))) {
      const n = (f.text.match(/(?:fill|stroke)=("|')(?:#|rgb|hsl)/g) || []).length;
      if (n > 0) counts[rel(f)] = n;
    }
    assertRatchet(counts, FILL_LITERAL_BASELINE, 'fill/stroke littéral hors token');
  });

  it('(ix) .panel non redéfini hors components.css (#306)', () => {
    const counts: Record<string, number> = {};
    for (const f of FICHIERS_UI().filter((f) => estCss(f) && nomDe(f) !== 'components.css')) {
      const css = f.text.replace(/\/\*[\s\S]*?\*\//g, '');
      // `.panel` porté par le MÊME élément : soit en TÊTE de sélecteur (`^\s*\.panel`, capture aussi les
      // redéfinitions indentées d'un `@media` — le piège #306), soit COMPOSÉ à une autre classe (`X.panel`,
      // ex. `.interlude-hero.panel` — l'angle mort de l'ancre seule). Les modificateurs du même élément
      // (`.mod`/`:pseudo`/`[attr]`) sont tolérés jusqu'à la FIN du sélecteur (`\s*[,{]`) ; les descendants
      // (`.panel h3`, `.panel-grid > .panel`) et la classe distincte `.panel-grid` (suivi de `-`) sont exclus.
      const n = (css.match(/(?:^\s*|[a-z0-9-])\.panel(?:[.:][\w-]+|\[[^\]]*\])*\s*[,{]/gm) || []).length;
      if (n > 0) counts[rel(f)] = n;
    }
    assertRatchet(counts, PANEL_REDEFINE_BASELINE, '.panel redéfini hors components.css');
  });

  it('(x) <button> nu : aucune hausse par fichier .tsx (composer .btn/.chip ou une primitive — feedback user 2026-07-12, #373)', () => {
    const files = FICHIERS_UI().filter((f) => estTsx(f) && !estTest(f) && !BARE_BUTTON_EXEMPT_FILES.has(rel(f)));
    const { bare, opaque } = scanBareButtons(files);
    assertRatchet(bare, BARE_BUTTON_BASELINE, '<button> nu — composer .btn/.chip ou une primitive (feedback user 2026-07-12, #373)');
    assertRatchet(opaque, BARE_BUTTON_OPAQUE_BASELINE, '<button> className opaque — exposer un littéral btn/chip/seg ou passer par une primitive (feedback user 2026-07-12, #373)');
  });

  it('(xii) sélecteurs de classe DÉFINIS par module CSS de domaine : gelé et décroissant (doctrine user 2026-07-12, #373)', () => {
    const counts: Record<string, number> = {};
    for (const mod of DOMAIN_CSS_MODULES) {
      const css = readFileSync(join(UI, 'styles', `${mod}.css`), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      counts[`styles/${mod}.css`] = classNamesDefined(css).size;
    }
    assertRatchet(counts, CLASS_SELECTOR_BASELINE, 'sélecteurs de classe définis (stock de classes de domaine, #373)');
  });

  it('(xiii) fuite de domaine en couche partagée : classe base/components mono-consommateur ET non cataloguée = gelée et décroissante (#371)', () => {
    const catalogue = catalogueClasses();
    const usage = classUsageByModule();
    const counts: Record<string, number> = {};
    for (const file of SHARED_CSS_FILES) {
      const f = join(UI, file);
      const defined = classNamesDefined(readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''));
      let leaks = 0;
      for (const c of defined) {
        if (catalogue.has(c)) continue; // documentée au catalogue = contrat de couche atomique
        if ((usage.get(c)?.size ?? 0) >= 2) continue; // usage transversal réel (≥2 modules)
        leaks++;
      }
      counts[file] = leaks; // clé = le chemin DÉCLARÉ (une feuille partagée peut vivre hors `src/ui`)
    }
    assertRatchet(counts, SHARED_LEAK_BASELINE, 'classe de domaine planquée en couche partagée — la déplacer dans un module de domaine (cliqueté par xii) ou la documenter au catalogue de charte-ui.md (#371)');
  });

  // ── (xiv) EXHAUSTIVITÉ (#371, gap gauges.css) : les cliquets xii (domaine) et xiii (partagé) ne
  //    valent QUE pour les fichiers listés — un module CSS oublié (ex. `gauges.css`, ~40 classes de
  //    domaine naval) échappait aux DEUX en silence. Ce test STRUCTUREL refuse tout `.css` de
  //    `src/ui/**` non couvert : il doit appartenir soit à `DOMAIN_CSS_MODULES` (xii, `styles/<mod>.css`)
  //    soit à `SHARED_CSS_FILES` (xiii). Ajouter un module CSS force donc à le classer et à poser sa
  //    baseline — plus de fichier hors radar.
  it('(xiv) exhaustivité : chaque .css de src/ui est couvert par xii (domaine) OU xiii (partagé)', () => {
    const all = FICHIERS_UI().filter(estCss).map(rel);
    const accounted = new Set<string>([...DOMAIN_CSS_MODULES.map((m) => `styles/${m}.css`), ...SHARED_CSS_FILES]);
    const orphans = all.filter((f) => !accounted.has(f)).sort();
    expect(orphans, `CSS hors radar (ni cliquet de domaine xii, ni garde partagée xiii) — l’ajouter à DOMAIN_CSS_MODULES ou SHARED_CSS_FILES :\n${orphans.join('\n')}`).toEqual([]);
  });

  it('(xv) rangée TÉMOIN porteuse de valeur hors `opposedFrozen.ts` : gelée et décroissante (#990)', () => {
    const files = FICHIERS_UI().filter((f) => /\.tsx?$/.test(f.rel) && !estTest(f) && rel(f) !== 'opposedFrozen.ts');
    assertRatchet(scanFrozenValueRows(files), FROZEN_WITNESS_BASELINE, 'rangée témoin à valeur figée hors du calendrier de découverte `frozenOpposedRow` (#990)');
  });

  // ── (xvi) LARGEUR d'une classe de MODALE : elle appartient à la COQUILLE partagée (`.modal`,
  //    `components.css`), jamais à une variante d'enveloppe. Défaut mesuré : `.test-modal { width:
  //    340px }`, importée APRÈS la couche partagée, écrasait `min(520px, 94vw)` pour SEPT modales —
  //    les rangées de jet (bâties pour ~520px) s'empilaient et débordaient horizontalement. Deux
  //    volets, tous deux structurels : une largeur en px doit rester BORNÉE à la fenêtre
  //    (`max-width` en vw dans la MÊME règle), et aucune ne descend SOUS la largeur standard —
  //    rétrécir est le travail du contenu, pas d'une classe d'enveloppe.
  it('(xvi) largeur d’une classe de modale : bornée à la fenêtre et jamais plus étroite que la coquille standard', () => {
    const shared = readFileSync(join(UI, 'styles', 'components.css'), 'utf8');
    const standard = shared.match(/\.modal\s*\{[^}]*?width:\s*min\((\d+)px/);
    expect(standard, '`.modal` ne pose plus `width: min(<n>px, …)` dans components.css : le standard de largeur a bougé, cette garde le lit.').toBeTruthy();
    const standardPx = Number(standard![1]);
    const offenders: string[] = [];
    for (const f of FICHIERS_UI().filter(estCss)) {
      const css = f.text.replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const sel = m[1].trim().replace(/\s+/g, ' ');
        if (!/\.[a-z0-9-]*modal\b/i.test(sel)) continue;
        const body = m[2];
        const px = body.match(/(?<![a-z-])width:\s*(\d+)px/i);
        if (!px) continue;
        if (!/max-width:\s*[\d.]+(?:vw|vmin|%)/i.test(body)) offenders.push(`${rel(f)} — ${sel} : width: ${px[1]}px sans max-width relatif à la fenêtre`);
        if (Number(px[1]) < standardPx) offenders.push(`${rel(f)} — ${sel} : width: ${px[1]}px < ${standardPx}px (coquille standard \`.modal\`)`);
      }
    }
    expect(offenders, `Largeur FIXE posée par une classe de modale — la largeur appartient à la coquille (\`.modal\`, components.css) :\n${offenders.join('\n')}`).toEqual([]);
  });
});

/** Corps d'une tranche `@media` (accolades appariées). Les invariants ci-dessous s'énoncent sur la
 *  PRÉSENCE d'une règle dans SA tranche, et sur les GRANDEURS dont une valeur fausse casse une
 *  atteignabilité (réserve d'une colonne recouvrante) — jamais sur une esthétique en pixels. Le
 *  verdict de rendu, lui, se mesure au navigateur : `scripts/recette/hud-clickables.mjs`. */
function mediaBlock(css: string, query: string): string {
  const at = css.indexOf(query);
  if (at < 0) return '';
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  return '';
}
/** Le module PRIVÉ de toutes ses tranches `@media` : ce qui doit valoir à TOUTE largeur se trouve
 *  ici. Une règle glissée dans une tranche disparaît de cette vue — c'est ce que l'invariant traque. */
function baseSection(css: string): string {
  let out = '';
  for (let i = 0; i < css.length; i++) {
    if (css.startsWith('@media', i)) {
      const open = css.indexOf('{', i);
      let depth = 0;
      let j = open;
      for (; j < css.length; j++) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}' && --depth === 0) break;
      }
      i = j;
      continue;
    }
    out += css[i];
  }
  return out;
}
/** Valeur en px de la propriété `prop` dans la règle de sélecteur `selector`, ou `null`. */
function pxOf(css: string, selector: string, prop: string): number | null {
  const rule = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css);
  if (!rule) return null;
  const v = new RegExp(`${prop}:\\s*(-?[\\d.]+)px`).exec(rule[1]);
  return v ? Number(v[1]) : null;
}
const occurrences = (s: string, needle: string) => s.split(needle).length - 1;

const HUD_TRANCHES = ['@media (max-width: 900px)', '@media (max-width: 700px)', '@media (max-width: 560px)', '@media (pointer: coarse)'];
const HUD_MODULES = ['hud.css', 'combat-console.css'];

describe('HUD — matrice responsive canonique (design 2026-07-31 §12)', () => {
  const read = (m: string) => readFileSync(join(UI, 'styles', m), 'utf8');

  it('chaque module du HUD pose les quatre tranches, une seule fois chacune', () => {
    for (const m of HUD_MODULES) {
      const css = read(m);
      for (const q of HUD_TRANCHES) {
        expect(occurrences(css, q), `${m} : la tranche ${q} doit exister en UN exemplaire (section responsive ordonnée)`).toBe(1);
      }
    }
  });

  it('aucun breakpoint de largeur hors du canon 900 / 700 / 560', () => {
    for (const m of [...HUD_MODULES, 'combat-modals.css']) {
      const widths = [...read(m).matchAll(/@media[^{]*max-width:\s*(\d+)px/g)].map((x) => x[1]);
      const hors = [...new Set(widths)].filter((w) => !['900', '700', '560'].includes(w));
      expect(hors, `${m} : breakpoint(s) hors canon (360 et 420 sont des largeurs de RECETTE)`).toEqual([]);
    }
  });

  it('≤700 : la frise d’initiative devient une bande horizontale défilable, contrainte et dégagée', () => {
    const at700 = mediaBlock(read('hud.css'), '@media (max-width: 700px)');
    expect(at700).toMatch(/\.is-tiles\s*\{[^}]*flex-direction:\s*row/);
    expect(at700).toMatch(/\.is-tiles\s*\{[^}]*overflow-x:[ \t\r\n]*auto/);
    // `overflow-x` ne mord que sur une piste BORNÉE : alignée en `flex-start`, elle prend la largeur
    // de son contenu, déborde du HUD et ne défile jamais (défaut mesuré : piste 633px dans une bande
    // de 294px à 360). `stretch` la ramène à la largeur de la bande.
    expect(at700).toMatch(/\.initiative-strip\s*\{[^}]*align-items:\s*stretch/);
    // LE HAUT-DROITE EST LIBRE : la plaque de caméra a quitté l'écran de jeu et le rail dégraissé
    // (journal + dossier de navire) s'ancre EN BAS à cette largeur — la frise va jusqu'au bord, comme
    // à gauche. Elle réservait 168px pour une colonne de 144px qui n'existe plus.
    const reserve = pxOf(at700, '.initiative-strip', 'right');
    expect(reserve, 'la frise ≤700 déclare son bord droit en px').not.toBeNull();
    expect(reserve!).toBeLessThanOrEqual(8);
    // Ce qui remplace la réserve : le rail DISSOUT à cette largeur ne porte plus l'ancrage de ses
    // enfants — son ouvreur d'écran se pose lui-même en bas, sinon il retombe dans le flux du stage.
    expect(at700).toMatch(/\.hud-rail\s*>\s*\.worldmap-btn\s*\{[^}]*position:\s*absolute/);
    expect(at700).toMatch(/\.hud-rail\s*>\s*\.worldmap-btn\s*\{[^}]*bottom:\s*\d+px/);
  });

  it('≤560 : le groupe tient sur une ligne, la console prend la largeur, la sortie de tour reste en bout de rangée d’arche', () => {
    // La bande de groupe tient sur UNE ligne à TOUTE largeur depuis la passe de matière (spécimen B) :
    // l'assertion monte donc dans la section de base — une bande qui s'enroulait mangeait 21 % de
    // l'écran à 1280 (grief vision). La lire dans la tranche ≤560 seulement laisserait le retour à la
    // ligne revenir au-dessus de 560. Le défilement vit sur la PISTE (`.pd-track`) depuis le repli
    // de la bande : le cadre porte l'ancrage, la piste porte la rangée.
    const hudBase = baseSection(read('hud.css'));
    expect(hudBase).toMatch(/\.pd-track\s*\{[^}]*flex-wrap:\s*nowrap/);
    expect(hudBase).toMatch(/\.pd-track\s*\{[^}]*overflow-x:[ \t\r\n]*auto/); // débordement de secours (combat naval)
    const barAt560 = mediaBlock(read('combat-console.css'), '@media (max-width: 560px)');
    // Le pont PREND LA LARGEUR (grille, pas une rangée qui déborde) : les deux travées s'empilent sous
    // la rangée d'arête. Sans `width: 100%`, la grille se rétracte à son contenu et les cases sortent.
    expect(barAt560).toMatch(/\.cc-dock\s*\{[^}]*display:\s*grid/);
    expect(barAt560).toMatch(/\.cc-dock\s*\{[^}]*width:\s*100%/);
    // La SORTIE DE TOUR (le coin) reste EN BOUT DE LA RANGÉE D'ARCHE : le gabarit la nomme, elle ne
    // retombe pas sous les travées où il faudrait défiler pour l'atteindre.
    expect(barAt560).toMatch(/\.cc-dock\s*\{[^}]*grid-template-areas:\s*'arch corner'/);
    expect(barAt560).toMatch(/\.cc-corner\s*\{[^}]*grid-area:\s*corner/);
  });

  it('≤560 : la bande basse réserve la hauteur de la CONSOLE (caméra et tiroir hors de son emprise)', () => {
    const hudAt560 = mediaBlock(read('hud.css'), '@media (max-width: 560px)');
    // La console compacte monte à 265px du bas (4px d'ancrage + 261px mesurés au navigateur,
    // scénario magie 360×640, passe d'ASSEMBLAGE). Toute surface posée plus bas passe SOUS elle et
    // cesse de recevoir ses clics. Le tiroir du journal réserve donc cette hauteur ; la rangée de
    // caméra, elle, est ancrée par le HAUT (bandeau haut, au-dessus du terrain) et doit alors
    // dégager la COLONNE du tiroir (chevauchement mesuré 30×16 quand elle prenait toute la largeur).
    const px = (sel: string, prop: string) => {
      const rule = new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`).exec(hudAt560);
      const v = rule && new RegExp(`${prop}:\\s*(?:calc\\()?\\s*(\\d+(?:\\.\\d+)?)px`).exec(rule[1]);
      return v ? Number(v[1]) : null;
    };
    const tiroir = px('.log-drawer', 'bottom');
    expect(tiroir, 'le tiroir du journal ≤560 doit déclarer sa réserve du bas en px').not.toBeNull();
    expect(tiroir!).toBeGreaterThanOrEqual(265);
    const cameraBas = px('.view-controls', 'bottom');
    const cameraHaut = px('.view-controls', 'top');
    if (cameraBas != null) expect(cameraBas).toBeGreaterThanOrEqual(tiroir! + 44);
    else {
      expect(cameraHaut, 'la rangée de caméra ≤560 s’ancre par le haut ou par le bas, jamais ni l’un ni l’autre').not.toBeNull();
      // Ancrée en haut : elle vit dans le BANDEAU HAUT (groupe replié + frise), au-dessus du
      // terrain — jamais au milieu du champ (640 − 265 de console − 44 de bouton au doigt).
      expect(cameraHaut!).toBeLessThanOrEqual(640 - 265 - 44);
      // … et laisser au tiroir sa colonne de gauche (44px de bouton + son ancrage).
      const cameraGauche = px('.view-controls', 'left');
      expect(cameraGauche, 'la rangée de caméra ancrée en haut doit déclarer sa réserve de gauche').not.toBeNull();
      expect(cameraGauche!).toBeGreaterThanOrEqual(48);
    }
  });

  it('pointeur grossier : les commandes de caméra offrent une cible de 44px', () => {
    const coarse = mediaBlock(read('hud.css'), '@media (pointer: coarse)');
    expect(coarse).toMatch(/\.vc-btn\s*\{[^}]*min-width:\s*44px/);
    expect(coarse).toMatch(/\.vc-btn\s*\{[^}]*min-height:\s*44px/);
  });

  it('la colonne d’États est ancrée dans la carte de SON héros, à TOUTE largeur', () => {
    // L'ancrage se lit hors de toute tranche : glissé dans un `@media`, il cesserait de valoir aux
    // largeurs qui ne l'atteignent pas et les pastilles reflotteraient entre deux portraits.
    // Planche USER 2026-08-17 : la colonne est SŒUR du portrait dans `.ptile-wrap` (rangée flex) —
    // à CÔTÉ de lui, plus posée dessus — et son emprise est UNE colonne d'alvéole, fixe.
    const base = baseSection(read('hud.css'));
    expect(base).toMatch(/\.party-dock\s+\.ptile-wrap\s*\{[^}]*display:\s*flex/);
    expect(base).toMatch(/\.party-dock\s+\.ptile-wrap\s*\{[^}]*flex-direction:\s*row/);
    expect(base).toMatch(/\.party-dock\s+\.ptile-states\s*\{[^}]*display:\s*grid/);
    // Une colonne d'alvéole FIXE, pas une grille libre : sans ce gabarit, une tuile portant 3 États
    // s'élargirait et la bande se décalerait d'un héros à l'autre.
    expect(base).toMatch(/\.party-dock\s+\.ptile-states\s*\{[^}]*grid-template-columns:\s*var\(--alv\)/);
  });

  it('les modales de jet occupent l’écran sous 560, corps défilable et pied fixe', () => {
    const css = read('combat-modals.css');
    expect(css).toMatch(/\.modal:has\(>\s*\.rs-scroll\)\s*\{[^}]*overflow:\s*hidden/); // le corps défile, pas la boîte
    expect(css).toMatch(/\.modal:has\(>\s*\.rs-scroll\)\s*>\s*\.modal-actions/); // pied hors du scrollport
    const at560 = mediaBlock(css, '@media (max-width: 560px)');
    expect(at560).toContain('.rs-scroll');
    // Le cadre tombe SUR LA MODALE de jet : `border-radius: 0` posé sur n'importe quelle autre règle
    // de la tranche satisfaisait l'ancienne formulation sans que la fenêtre prenne l'écran.
    expect(at560).toMatch(/\.modal:has\(>\s*\.rs-scroll\)\s*\{[^}]*border-radius:\s*0/);
  });
});

// ── (xvii) `<input type="number">` codé à la main (#1318 V5) — volet JUMEAU du cliquet (x) `<button>`
//    nu : la primitive canonique du champ nombre borné est `NumberField` (`docs/primitives.md`
//    — saisie clavier + `QtyStepper` + plage dite). Un `<input type="number">` posé
//    directement rejoue à la main la borne, les pas et l'affordance. BASELINE PAR FICHIER DÉCROISSANTE :
//    stock COURANT mesuré par le scan ci-dessous : 26 balises / 2 fichiers, `editor/Inspector.tsx` et
//    `editor/Palette.tsx` (migration #1318 E1, tranche 3). EXEMPTÉ : `NumberField.tsx`, la primitive elle-même (c'est elle qui a le
//    droit — et le devoir — de poser l'`<input type="number">` canonique).
//    COUVERTURE du détecteur (à énoncer, pas à supposer) : il lit la balise OUVRANTE `<input …>` et
//    compte `type="number"` en littéral OU en expression CALCULÉE (`type={kind}`, `type={t ? 'number'
//    : 'text'}`) — un `type` dynamique PEUT valoir `"number"`, et le compter au pire cas ferme le trou
//    des wrappers locaux (`IdentityField` du créateur, dont les champs Âge/Taille étaient invisibles au
//    compte). L'unité mesurée est la BALISE ÉCRITE, pas le champ rendu : un wrapper local posé une fois
//    et appelé N fois vaut 1 (c'était le cas d'`IdentityField`, 1 balise pour 4 champs dont 2 nombres),
//    et un `<input>` produit par une FABRIQUE (`createElement('input')`) échappe au scan — 0 occurrence
//    mesurée. Les commentaires sont neutralisés avant le scan ; les `.test.tsx` sont hors périmètre (un
//    harnais qui pilote un champ n'est pas une réinvention de primitive).
const NUMBER_INPUT_EXEMPT_FILES = new Set(['NumberField.tsx']);
const NUMBER_INPUT_BASELINE: Record<string, number> = {
  // -2 (25 → 23) : les deux `<input type="number">` de l'empreinte de décor disparaissent avec le
  // champ lui-même (empreinte verrouillée à la source). Stock baissé, détecteur inchangé.
  // -1 (23 → 22, #1507) : le rayon d'éclairage d'une instance compose `NumberField` — l'écran touché
  // par le passage du rayon en mètres a rendu son champ à la primitive.
  // -1 (22 → 21, #1715) : la pente et le comble d'un corps composent `NumberField` (vide = suit la scène).
  'editor/Inspector.tsx': 21,
  'editor/Palette.tsx': 1,
};

/** Balise ouvrante `<input …>` complète (les `{…}` d'attribut peuvent contenir des `>`). */
function openTags(src: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}\\b`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 0;
    let end = -1;
    for (let i = m.index; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) { end = i; break; }
    }
    if (end !== -1) out.push(src.slice(m.index, end + 1));
  }
  return out;
}

function scanNumberInputs(files: readonly Fichier[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of files) {
    const r = rel(f);
    if (NUMBER_INPUT_EXEMPT_FILES.has(r)) continue;
    const src = f.text
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/(^|[^:])\/\/.*$/gm, (_m, p) => p);
    for (const tag of openTags(src, 'input')) {
      if (!/type\s*=\s*(["']number["']|\{)/.test(tag)) continue;
      counts[r] = (counts[r] ?? 0) + 1;
    }
  }
  return counts;
}

// ── (xviii) Breakpoints de LARGEUR hors canon, sur TOUS les modules CSS (#1318 V5) — le volet
//    responsive du HUD ne regardait que `hud.css`/`combat-ui.css`/`combat-modals.css` ; la règle
//    stricte 4 du CLAUDE.md vaut pour tout `src/ui`. Canon VERS LE BAS : `max-width` ∈ {900,700,560}.
//    Canon VERS LE HAUT : `min-width` ∈ {561,701,901} (complément exact d'une tranche basse) et 1440
//    (docs/charte-ui.md § « Politique grand écran (≥1440px) »).
//    EXEMPTIONS NOMINATIVES (2026-08-16) — chacune porte sa raison, aucune n'est un blanc-seing :
//      - `creator-presentation.css` @media (max-width: 1100px) : ramener ce seuil à 900 changerait la
//        GÉOMÉTRIE de l'écran de présentation entre 900 et 1100px (grille ⇄ colonne, `order` de la
//        scène, hauteur de figurine) — une décision d'écran, hors lot d'outillage.
const WIDTH_CANON_MAX = ['900', '700', '560'];
const WIDTH_CANON_MIN = ['561', '701', '901', '1440'];
const BREAKPOINT_EXEMPT = new Map<string, string[]>([['styles/creator-presentation.css', ['max:1100']]]);

/** TOUTES les conditions de largeur de CHAQUE prélude `@media` — une règle peut en porter
 *  plusieurs (`@media (min-width: 561px) and (max-width: 900px)`) : ne lire que la première
 *  laisserait la seconde hors du canon sans que rien ne le dise. */
function widthBreakpoints(css: string): string[] {
  return [...css.matchAll(/@media[^{]*/g)].flatMap((p) =>
    [...p[0].matchAll(/(max|min)-width:\s*(\d+)px/g)].map((m) => `${m[1]}:${m[2]}`),
  );
}

// ── (xix) RAISON D'UN REFUS : un `<button disabled … title=…>` est une raison MUETTE (#1689 T2) —
//    `disabled` retire le bouton de l'ordre de tabulation et lui coupe tout événement de pointeur, et
//    un `title` natif n'atteint ni le lecteur d'écran, ni la manette, ni le doigt. Le bouton
//    d'engagement unique qui porte une raison est `GatedAction` (`aria-disabled` + `CodexRef refus` +
//    copie `aria-describedby`), et pour une option des TROIS layouts d'`OptionChooser` (grille, barre
//    d'actions, segment — tous composés par `OptionBouton`), la prop `refus`/`refusId`.
//    Baseline JOUEUR = 0 (les 53 sites appelants migrés) ; l'ATELIER reste gelé à son stock, dont la
//    migration est un lot à part (les outils d'édition n'ont pas la même contrainte manette/tactile).
//    EXEMPTIONS AU SITE (`fichier:ligne`, jamais au FICHIER — un fichier blanchi cache le site NEUF
//    qu'on y ajouterait) : un MODÈLE DE PROPS de socle n'est PAS un site de refus — le composant
//    expose `disabled`/`title` dans son API, et c'est l'APPELANT qui déciderait d'une raison. Chaque
//    ligne porte sa raison ; une ligne périmée (le site a bougé ou a été migré) échoue aussi.
const REFUS_MUET_EXEMPT_SITES = new Map<string, string>([
  ['GatedAction.tsx:155', 'la primitive elle-même : `title={ariaLabel}` y est le NOM accessible, pas une raison'],
  ['OptionChooser.tsx:104', '`OptionBouton` : la composition partagée des trois layouts, dont la branche gatée compose déjà `GatedAction`'],
  ['RollShell.tsx:299', 'modèle de props de la coquille de jet — passage à `GatedAction` = train T9'],
  ['MenuCard.tsx:130', 'modèle de props du menu — train T9'],
  ['MediaSelect.tsx:59', 'modèle de props du sélecteur média — train T9'],
  ['QtyStepper.tsx:36', 'modèle de props du stepper (décrément) — train T9'],
  ['QtyStepper.tsx:40', 'modèle de props du stepper (incrément) — train T9'],
]);
const REFUS_MUET_BASELINE: Record<string, number> = {
  'editor/Editor.tsx': 1,
  'editor/EditorToolbar.tsx': 3,
  'editor/EffectList.tsx': 2,
  'editor/FlowEditor.tsx': 2,
  'editor/GameOpEditor.tsx': 4,
  'editor/Inspector.tsx': 2,
  'editor/NarratifEditor.tsx': 3,
  'editor/Palette.tsx': 1,
  'editor/StatblockEditor.tsx': 2,
  'editor/WorldMapEditor.tsx': 1,
};

/** Balises ouvrantes d'un fichier, avec leur LIGNE — l'exemption se pose au site, pas au fichier. */
function tagsAvecLigne(src: string, tag: string): { tag: string; ligne: number }[] {
  const propre = src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (_m, p) => p);
  const out: { tag: string; ligne: number }[] = [];
  for (const t of openTags(propre, tag)) {
    const at = propre.indexOf(t);
    out.push({ tag: t, ligne: propre.slice(0, at).split('\n').length });
  }
  return out;
}

/** Un littéral d'OPTION qui route un refus par PROP (`{ disabled: …, title: … }` d'un `RollOption`) :
 *  le refus n'y est pas dans une balise, il y est en DONNÉE — et finit rendu en `disabled` + `title`
 *  par le layout. Le contrat est `refus`/`refusId` (`OptionChooser`), d'où sa mesure ici. Forme
 *  DÉTERMINISTE : un objet littéral portant les deux clés à la fois, sur la même accolade. */
function optionsRefusMuet(src: string): number[] {
  const lignes: number[] = [];
  // APPARIEMENT d'accolades, pas `[^{}]*` : une option porte des valeurs à accolades (template
  // literal `${…}`, `onSelect` à corps, `content` JSX). Le motif plat perdait tous ces littéraux —
  // et donc les refus qu'ils routent.
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== '{') continue;
    let prof = 0;
    let fin = -1;
    for (let j = i; j < src.length; j++) {
      if (src[j] === '{') prof++;
      else if (src[j] === '}') { prof--; if (prof === 0) { fin = j; break; } }
    }
    if (fin === -1) continue;
    const bloc = src.slice(i, fin + 1);
    // Clés du PREMIER niveau seulement : un objet imbriqué ne prête pas ses clés à son parent.
    const niveau1 = (cle: string) => {
      let p = 0;
      for (let k = 0; k < bloc.length; k++) {
        if (bloc[k] === '{') p++;
        else if (bloc[k] === '}') p--;
        else if (p === 1 && bloc.startsWith(cle, k) && /[\s,{]/.test(bloc[k - 1] ?? '{') && /^\s*:/.test(bloc.slice(k + cle.length))) return true;
      }
      return false;
    };
    if (!niveau1('disabled') || !niveau1('title')) continue;
    if (!niveau1('key') && !niveau1('onSelect')) continue; // c'est bien une OPTION, pas un objet quelconque
    // ÉCHAPPATOIRE : une option qui porte DÉJÀ `refus`/`refusId` n'est PAS un refus muet — sa raison
    // passe par la primitive, son `disabled` résiduel sert au comptage de l'appelant et son `title`
    // décrit l'état OFFERT (grille de table de `CascadeModal`). Cherchée dans TOUT le bloc, pas au
    // seul premier niveau : ces deux clés arrivent souvent par un SPREAD conditionnel
    // (`...(x ? { refusId } : {})`). Le déclencheur, lui, reste strict au premier niveau : une
    // échappatoire permissive ne crée aucun faux négatif de refus MUET.
    if (/\brefusId?\s*:/.test(bloc)) continue;
    lignes.push(src.slice(0, i).split('\n').length);
    i = fin; // pas de double comptage d'un littéral imbriqué
  }
  return lignes;
}

/** Un REFUS MUET : `<button>` portant À LA FOIS `disabled` et `title` (la raison qu'aucun lecteur
 *  d'écran, aucune manette et aucun doigt n'atteint), OU un `title` de refus posé sur un élément
 *  `aria-hidden` — forme PIRE encore, l'arbre a11y ne voit même plus le porteur —, OU un refus routé
 *  en PROP d'option (`{disabled, title}`), qui échappait au scan de balises. Les trois se mesurent
 *  sur la FORME, jamais sur un nom de variable. */
function sitesRefusMuet(f: Fichier): { cle: string; ligne: number }[] {
  const r = rel(f);
  const src = f.text;
  const out: { cle: string; ligne: number }[] = [];
  for (const tag of ['button', 'span', 'div', 'a'] as const) {
    for (const { tag: t, ligne } of tagsAvecLigne(src, tag)) {
      if (!/\btitle\s*=/.test(t)) continue;
      const muet = tag === 'button' ? /\bdisabled\b/.test(t) : /\baria-hidden\b/.test(t);
      if (muet) out.push({ cle: `${r}:${ligne}`, ligne });
    }
  }
  const propre = src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (_m, p) => p);
  for (const ligne of optionsRefusMuet(propre)) out.push({ cle: `${r}:${ligne}`, ligne });
  return out;
}

function scanRefusMuet(files: readonly Fichier[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of files) {
    const r = rel(f);
    for (const s of sitesRefusMuet(f)) {
      if (REFUS_MUET_EXEMPT_SITES.has(s.cle)) continue;
      counts[r] = (counts[r] ?? 0) + 1;
    }
  }
  return counts;
}

describe('#1318 V5 — cliquets d’hygiène UI (champ nombre, breakpoints)', () => {
  it('(xvii) <input type="number"> à la main : aucune hausse par fichier (composer NumberField)', () => {
    const files = FICHIERS_UI().filter((f) => estTsx(f) && !f.rel.endsWith('.test.tsx'));
    assertRatchet(scanNumberInputs(files), NUMBER_INPUT_BASELINE, '`<input type="number">` (primitive `NumberField`)');
  });

  it('(xix) raison de refus MUETTE (`<button disabled title=…>`) : aucune hausse, zéro côté joueur', () => {
    const files = FICHIERS_UI().filter((f) => estTsx(f) && !f.rel.endsWith('.test.tsx'));
    assertRatchet(scanRefusMuet(files), REFUS_MUET_BASELINE, '`<button disabled title=…>` (primitive `GatedAction`)');
  });

  it('(xix) le stock restant est ENTIÈREMENT dans l’atelier — aucun écran joueur ne porte de refus muet', () => {
    const files = FICHIERS_UI().filter((f) => estTsx(f) && !f.rel.endsWith('.test.tsx'));
    const joueur = Object.entries(scanRefusMuet(files))
      .filter(([f]) => !/^(editor|compendium|gallery)\//.test(f))
      .map(([f, n]) => `${f} : ${n}`);
    expect(joueur, `Refus MUET sur un écran JOUEUR — composer \`GatedAction\` (ou \`OptionChooser\` prop \`refus\`) :\n${joueur.join('\n')}`).toEqual([]);
  });

  it('(xix) chaque exemption est un SITE encore RÉEL — une ligne périmée se retire', () => {
    const reels = new Set(
      FICHIERS_UI().filter((f) => estTsx(f) && !f.rel.endsWith('.test.tsx')).flatMap((f) => sitesRefusMuet(f).map((s) => s.cle)),
    );
    const perimees = [...REFUS_MUET_EXEMPT_SITES.keys()].filter((k) => !reels.has(k));
    expect(perimees, `Exemption(s) PÉRIMÉE(S) — le site a bougé ou a été migré, retirer la ligne :\n${perimees.join('\n')}`).toEqual([]);
  });

  it('(xix) un site NEUF dans un fichier déjà exempté rougit — l’exemption est au SITE, pas au fichier', () => {
    // `GatedAction.tsx` porte une exemption (sa propre balise) : un SECOND refus muet dans ce
    // fichier ne doit PAS en hériter. On l'éprouve sur la source réelle du fichier exempté.
    const src = readFileSync(join(UI, 'GatedAction.tsx'), 'utf8');
    const dejaExempt = [...REFUS_MUET_EXEMPT_SITES.keys()].filter((k) => k.startsWith('GatedAction.tsx:'));
    expect(dejaExempt).toHaveLength(1);
    const neuf = `${src}\nexport const Faux = () => <button disabled title="raison muette">x</button>;\n`;
    const sites = tagsAvecLigne(neuf, 'button')
      .filter(({ tag }) => /\bdisabled\b/.test(tag) && /\btitle\s*=/.test(tag))
      .map(({ ligne }) => `GatedAction.tsx:${ligne}`)
      .filter((cle) => !REFUS_MUET_EXEMPT_SITES.has(cle));
    expect(sites, 'le site NEUF doit rester compté malgré l’exemption du site voisin').toHaveLength(1);
  });

  it('(xix) le détecteur voit un refus muet, et ne confond pas `disabled` seul ni `title` seul', () => {
    // Le scan travaille sur des BALISES ouvrantes : on l'éprouve sur une source en mémoire plutôt que
    // sur un fichier fantôme — `openTags` est la seule dépendance de forme.
    const tags = (src: string) => openTags(src, 'button').filter((t) => /\bdisabled\b/.test(t) && /\btitle\s*=/.test(t));
    expect(tags('<button disabled={x} title="pourquoi">a</button>')).toHaveLength(1);
    expect(tags('<button disabled={x}>a</button>')).toHaveLength(0);
    expect(tags('<button title="nom accessible">a</button>')).toHaveLength(0);
    // Un `title` DANS une accolade d'attribut (ternaire) ne coupe pas la balise trop tôt.
    expect(tags('<button disabled={a ? b : c} title={a ? "x > y" : undefined}>a</button>')).toHaveLength(1);
  });

  it('(xix) le détecteur voit les DEUX autres formes : `title` sur `aria-hidden`, et refus en PROP d’option', () => {
    // Bras `aria-hidden` : un refus écrit dans un `title` posé sur un élément retiré de l'arbre a11y.
    const cache = (src: string) => openTags(src, 'span').filter((t) => /\btitle\s*=/.test(t) && /\baria-hidden\b/.test(t));
    expect(cache('<span className="x" aria-hidden title="verrouillé">·</span>')).toHaveLength(1);
    expect(cache('<span className="x" title="nom">·</span>')).toHaveLength(0);
    expect(cache('<span className="x" aria-hidden>·</span>')).toHaveLength(0);
    // Bras PROP d'option : le refus routé en donnée, que le layout rend en `disabled` + `title`.
    expect(optionsRefusMuet("const o = { key: 'a', label: 'A', disabled: !ok, title: 'Bourse insuffisante' };")).toHaveLength(1);
    expect(optionsRefusMuet("const o = { key: 'a', label: 'A', refus: 'Bourse insuffisante.' };")).toHaveLength(0);
    expect(optionsRefusMuet("const o = { key: 'a', label: 'A', disabled: !ok };")).toHaveLength(0);
    expect(optionsRefusMuet("const o = { key: 'a', label: 'A', title: 'description' };")).toHaveLength(0);
    // Un objet quelconque qui porte les deux clés sans être une option ne compte pas.
    expect(optionsRefusMuet("const cfg = { disabled: true, title: 'x' };")).toHaveLength(0);
  });

  it('(xix) le bras PROP ne perd pas une option à valeurs ACCOLADÉES (le motif plat en ratait 16 sur 19)', () => {
    // 1. `title` en TEMPLATE LITERAL : `${…}` ouvre une accolade DANS la valeur.
    expect(optionsRefusMuet('const o = { key: \'a\', label: \'A\', disabled: !ok, title: `Coût ${n} Av.` };')).toHaveLength(1);
    // 2. `onSelect` à CORPS : le corps de flèche ouvre une accolade.
    expect(optionsRefusMuet("const o = { key: 'a', disabled: !ok, title: 'x', onSelect: () => { go(); } };")).toHaveLength(1);
    // 3. `content` JSX imbriquant une expression accoladée.
    expect(optionsRefusMuet("const o = { key: 'a', disabled: !ok, title: 'x', content: <span>{n}</span> };")).toHaveLength(1);
    // 4. Clés d'un objet IMBRIQUÉ : elles ne comptent pas pour le parent (pas de faux positif).
    expect(optionsRefusMuet("const o = { key: 'a', label: 'A', meta: { disabled: true, title: 'x' } };")).toHaveLength(0);
    // 5. `refus` déjà posé : la raison passe par la primitive, l'option n'est PAS muette.
    expect(optionsRefusMuet("const o = { key: 'a', disabled: !ok, title: 'desc', refusId: 'cause' };")).toHaveLength(0);
    // 6. … y compris arrivé par SPREAD conditionnel (la forme réelle de `CascadeModal`).
    expect(optionsRefusMuet("const o = { key: 'a', disabled: !ok, title: 'desc', ...(x ? { refusId: 'c' } : {}) };")).toHaveLength(0);
  });

  it('(xviii) aucun breakpoint hors canon dans TOUT src/ui (900/700/560 bas, 561/701/901/1440 haut)', () => {
    const hors: string[] = [];
    for (const f of FICHIERS_UI().filter(estCss)) {
      const r = rel(f);
      const exempt = BREAKPOINT_EXEMPT.get(r) ?? [];
      for (const bp of new Set(widthBreakpoints(f.text))) {
        if (exempt.includes(bp)) continue;
        const [sens, px] = bp.split(':');
        const canon = sens === 'max' ? WIDTH_CANON_MAX : WIDTH_CANON_MIN;
        if (!canon.includes(px)) hors.push(`${r} : @media (${sens}-width: ${px}px)`);
      }
    }
    expect(hors, `Breakpoint(s) hors canon (règle stricte 4 ; grand écran : docs/charte-ui.md) :\n${hors.join('\n')}`).toEqual([]);
  });

  it('(xviii) le parseur lit TOUTES les conditions d’un même @media, pas seulement la première', () => {
    expect(widthBreakpoints('@media (min-width: 561px) and (max-width: 1234px) { .a { color: red } }')).toEqual([
      'min:561',
      'max:1234',
    ]);
  });

  it('(xviii) chaque exemption nominative de breakpoint est encore RÉELLE', () => {
    for (const [r, bps] of BREAKPOINT_EXEMPT) {
      const réels = new Set(widthBreakpoints(readFileSync(join(UI, r), 'utf8')));
      for (const bp of bps) expect([...réels], `${r} : exemption ${bp} périmée — la retirer`).toContain(bp);
    }
  });
});
