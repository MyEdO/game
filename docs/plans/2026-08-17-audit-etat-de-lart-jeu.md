# Audit état de l'art — surface joueur complète (2026-08-17)

Ticket: #1361

> Plan daté, à supprimer une fois les verdicts traités. Méthode imposée par l'utilisateur
> (verbatim : « je suis en train de remettre en cause chaque partie de notre interface en
> te poussant a regarder vers ce qui se fait ailleurs et surement ce qu'on a oublié de
> faire ») : chaque pièce de l'interface et des systèmes confrontée au canon du genre
> (NWN — référence déclarée — BG3, Pathfinder, POE, DOS2, Solasta, Rogue Trader).
> Inventaire source : lecteur 2026-08-17 (worktree console), absences sonnées par grep.

## A. CONFORME au genre (rien à faire, ou déjà en chantier)

| Pièce | Verdict |
|---|---|
| Frise d'initiative (camps, actif, promotion Chance) | conforme, riche |
| Console/pont (post-refonte : assemblage, budget 21 %, densité) | conforme — chantier actif #1348/#1349 |
| Tiroir-journal + fil narratif + historique de dialogues | conforme |
| Chips d'États avec indices + remèdes prévus sur pastille | conforme, au-dessus du genre (Codex-lié) |
| Fiche héros à onglets, Avancement (level-up EN JEU dans la fiche) | conforme (patron Pathfinder) |
| Options : préférences + REBIND CLAVIER + règles optionnelles (house rules) | au-dessus du genre (house rules exposées = rare) |
| Save par slots + export/import + autosave à l'entrée de scène | conforme (mécanisme d'autosave à re-vérifier) |
| Coop : sièges, spectateur nommé, arbitrage MJ des dialogues | conforme |
| Arbitre « une modale de combat à la fois » | conforme (discipline supérieure au genre) |
| Codex/Compendium éditable + auto-liage | au-dessus du genre — c'est un différenciateur |
| Prévisualisations tactiques (portées, coût, gabarits) | en chantier (Vague 2 validée) |
| Caméra aux gestes + clavier, éditeur garde ses boutons | conforme (arbitré 2026-08-17) |
| Défaite de bataille de masse qui continue (« Repoussés ») | choix de design assumé, pas un écart |

## B. NON-STANDARD (on fait autrement — tranché ou à trancher)

| Pièce | État du genre | Notre état | Statut |
|---|---|---|---|
| Barre absente hors combat | barre persistante partout | pont unifié ARBITRÉ (066b0ab2) | tranché, lot 2 |
| Pas de sélection de personnage en exploration | sélection libre (clic portrait) | Zone 13 = PRÉREQUIS édition | modèle proposé, À CONFIRMER |
| Édition de barre | drag & drop in-place universel | arbitré in-place (ee5d4c3f) | tranché, lot 2 |
| Date/lieu en barre haute permanente | médaillon carte/annonces | boussole-horloge-lieu + annonce de zone (arbitré) | tranché, lot matière |
| Clic droit combat = attaque directe (pas de menu) | BG3 : menu contextuel ; XCOM-likes : action directe | action directe | acceptable, revoir si les actions par cible se multiplient |
| Inspection : combat seulement (option), pas d'« examiner » en exploration | examiner partout (survol/clic droit) | InspectPanel combat-only | À TRANCHER (l'examen d'exploration sert l'apprentissage) — tranché 2026-10-05 (#1822) : clic droit / appui long / touche I, en combat et hors combat |
| Loot par source (une fenêtre par fouille) | loot de zone (rayon) chez BG3/PoE | par source | QoL, candidat backlog |
| Objectifs = bannière empilée ; Carnet = enquête seulement | écran journal de quêtes complet | pas d'écran de quêtes | candidat backlog |
| Météo par écran (repos/voyage/hub) | HUD léger ou par écran selon le jeu | par écran | acceptable ; la boussole-horloge peut porter un glyphe météo plus tard |
| Formation de marche / groupe scindé | présent chez BG3/PoE (chaîne de portraits) | absent | faible priorité (cartes petites) — à statuer |
| Furtivité : compétence à jet, aucun mode UI | mode sneak visuel (BG3/DOS2) | jet classique WFRP | fidèle au RAW — le mode visuel serait une maison ; à statuer |

## C. MANQUANT (sonné par grep, périmètre src/** — la colonne « valeur » est ma proposition de priorité)

| # | Manquant | Ce que fait le genre | Valeur proposée |
|---|---|---|---|
| 1 | **Tutoriel/onboarding : 0 match** | tutoriels contextuels, glossaires en jeu | **CRITIQUE — la finalité déclarée du jeu est l'APPRENTISSAGE des règles** ; on a déjà le Codex + CodexRef : l'onboarding peut être « le Codex qui se propose au bon moment » (première Charge → sa fiche), pas un système lourd |
| 2 | **Surbrillance des interactifs (TAB/Alt)** | révéler objets/portes/PNJ interactifs | HAUTE — le confort d'exploration n°1 du genre ; on n'a que le curseur au survol case par case |
| 3 | **Ping/marqueur coop : 0 match** | BG3 : ping de case/objet, pilier du jeu à deux | HAUTE — on EST un jeu coop sans aucun moyen de pointer |
| 4 | **Annonce de zone transitoire** | titre au centre à l'entrée, s'efface | ARBITRÉE 2026-08-17 (avec boussole-lieu) |
| 5 | **Quicksave/quickload : 0 match** | F5/F9 universels | MOYENNE — slots + autosave existent, le geste rapide manque |
| 6 | **Toasts/notifications : 0 composant** | gains d'objets, PX, événements discrets | MOYENNE — beaucoup d'événements passent aujourd'hui par le journal seul |
| 7 | Écran journal de quêtes (au-delà bannière + enquête) | quest log avec états/récompenses | MOYENNE |
| 8 | Loot de zone | ramasser autour en une fenêtre | MOYENNE (QoL) |
| 9 | Menu contextuel / « Examiner » en exploration | examiner n'importe quoi | MOYENNE — porte d'apprentissage de plus |
| 10 | Réglages d'accessibilité exposés (tailles, contrastes — le canal daltonien R9 existe déjà en dur) | présents chez les AAA, rares chez les indés | À VÉRIFIER (`PREFERENCES` non lu en détail) puis statuer |

## D. Angles morts déclarés de l'audit
`PREFERENCES` (réglages exacts), mécanisme précis de l'`autoSave` (`store.ts:1830`),
HUD spécifique POV (`PovStage`), écrans plein-champ non lus en intégralité
(WorldMap/Port/Marché/Voyage/Hub). À couvrir avant de clore les verdicts « À VÉRIFIER ».

## E. Séquencement proposé (après la vague branchements en cours)
1. Les arbitrés du jour (boussole-horloge-lieu, annonce de zone) → lot matière.
2. Le trio à haute valeur : onboarding-par-le-Codex (C1) · surbrillance des interactifs
   (C2) · ping coop (C3) — chacun cadré puis jugé avant code.
3. Les « À TRANCHER » de B et le reste de C au fil des vagues, arbitrés un par un.
