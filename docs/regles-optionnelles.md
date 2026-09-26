# Règles optionnelles — registre, et contenu qu'elles ouvrent

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-regles-optionnelles.mjs`
> (`npm run docs:regles-optionnelles`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — sont LUES aux fichiers réels : les 87 entrées de
`src/data/reglesOptionnelles.json` (id, libellé, groupe, forme, défaut, options/bornes, référence RAW, folio, présence de
`maison` et d'`action`, `hint` verbatim), les clés déclarées par `src/data/schemas/defs/reglesOptionnelles.ts`, le seuil d'onglet
`OWN_TAB_MIN` et le libellé du fourre-tout de `src/ui/houseRuleTabs.ts`, la clé de persistance de `src/state/houseRules.ts`.
**ANGLE MORT STRUCTUREL** : *la liste des contenus gatés n'est pas déclarée structurellement, c'est
le `hint` qui le dit* — voir le § « Ce doc ne sait pas … » ci-dessous. Autre angle mort : ce doc
décrit le REGISTRE, pas les SITES qui consultent la règle ; qu'une règle existe ne dit pas combien
de coutures la lisent (`rule(id)`, `src/engine/policy.ts`).

## Avant de rapporter une ABSENCE

Une race, une carrière, une table, un écran, un événement peut être ABSENT à l'écran **parce qu'une
règle optionnelle est désactivée par défaut** — pas parce qu'il manque. Exemple mesuré (#1660) :
`creation-gnome-jouable` vaut `false` par défaut, donc le Gnome n'apparaît ni au Tableau des Races
aléatoires ni dans la grille de sélection du créateur. Chercher l'id dans les tables ci-dessous,
activer la règle, **puis** rejouer le geste avant de conclure.

## Activer / désactiver une règle

| Couture | Persistance | Où |
|---|---|---|
| Panneau **Options** in-game | **PERSISTÉE** — `localStorage['wfrp4.house-rules.v1']` | `src/ui/HouseRulesModal.tsx` (onglets dérivés par `src/ui/houseRuleTabs.ts`), écriture par `setHouseRule` (`src/state/houseRules.ts`) |
| Console de recette `__wfrp.rules(id, value)` | **RUNTIME, NON persistée** (meurt au rechargement) | `docs/recette-navigateur.md`, § « Groupe / campagne / règles » |
| Console de recette `__wfrp.rules(id, null)` | réinitialise **et purge la surcharge persistée** | idem |
| Lecture par le moteur | — | `rule(id)` / `ruleDef(id)` (`src/engine/policy.ts`) |

L'asymétrie entre ces trois gestes, le verrou en cours de combat et la vérification de l'état
persisté en fin de run sont décrits **une seule fois**, dans `docs/recette-navigateur.md` : s'y reporter, ils ne
sont pas recopiés ici.

## Ce doc ne sait pas quelles règles gatent du CONTENU

Le registre ne porte **aucune** déclaration du contenu qu'une règle ouvre ou ferme. Les clés
déclarées par `src/data/schemas/defs/reglesOptionnelles.ts` sont : `ref`, `group`, `kind`, `default`, `options`, `min`, `max`, `step`, `hint`, `action` — plus les clés
d'enveloppe posées par la fabrique (`id`, `type`, `label`, `source`, `maison`).
Aucune ne nomme une race, une carrière, une table ni un écran.

Le SEUL porteur de cette information est le `hint`, **en prose**. Conséquence : le contenu gaté se
trouve en LISANT la colonne « Ce que la règle change » ci-dessous, jamais par une requête
structurelle — et une règle nouvellement gatante n'est signalée par aucune garde.

## Formes de contrôle

| `kind` | Entrées | Contrôle rendu | Forme de la valeur |
|---|---|---|---|
| `flag` | 46 | interrupteur | booléen |
| `param` | 29 | champ chiffré | nombre borné (`min`/`max`, `step` optionnel) |
| `mode` | 12 | choix segmenté | chaîne prise dans `options` |

## Groupes et onglets

Le panneau ne code aucun groupe en dur : un groupe obtient son onglet à partir de
**4 entrées**, les résiduels tombent dans l'onglet « Divers » en gardant leur
intertitre (`src/ui/houseRuleTabs.ts`).

| Groupe | Règles | Onglet du panneau |
|---|---|---|
| Tests | 8 | propre |
| Destin & Résistance | 1 | Divers |
| Combat | 19 | propre |
| Social | 8 | propre |
| Création | 2 | Divers |
| Marché | 4 | propre |
| Activités | 7 | propre |
| Avancement | 2 | Divers |
| Magie | 5 | propre |
| Prières | 3 | Divers |
| Corruption | 1 | Divers |
| Psychologie | 1 | Divers |
| Maladies | 2 | Divers |
| Voyage | 23 | propre |
| Possessions | 1 | Divers |

## Provenance

33 règles sur 87 portent un champ `maison` : le RAW ne chiffre pas la
valeur, l'arbitrage est explicite (CLAUDE.md règle 7). 54 portent une ancre
`source: {book, page}` au folio imprimé. 1 portent une `action` rendue sous la
rangée quand la règle atteint sa valeur de déclenchement.

## Le registre

### Tests — 8 règles

Panneau : onglet propre « Tests ».

| id | Libellé | Forme | Défaut | Valeurs | Référence | Ce que la règle change (`hint` verbatim) |
|---|---|---|---|---|---|---|
| `test-auto-bands` | Réussite / échec automatiques | `mode` | `normal` | **`normal`** · `inverted` · `off` | LDB 12 l.28/32 (livre-de-base f.150) | normal = 01-05 réussite auto / 96-00 échec auto (RAW) ; inverted = l’inverse ; off = aucune bande. |
| `test-critiques-doubles` | Succès / échec stupéfiants | `flag` | `false` | `false` · `true` | LDB 12 l.127 (livre-de-base f.153) | Hors combat, un Test réussi sur un DOUBLE est un Succès Stupéfiant (✦) ; raté sur un double, un Échec Stupéfiant. Purement narratif (libellé) : aucun effet mécanique nouveau. |
| `test-fast-sl` | Calculer rapidement un DR | `flag` | `false` | `false` · `true` | LDB 12 l.102 (livre-de-base f.152) | Sur une réussite, le DR = le chiffre des dizaines du jet. |
| `test-over-100` | Tests supérieurs à 100 % | `flag` | `false` | `false` · `true` | LDB 12 l.75 (livre-de-base f.151) | Une valeur de Compétence/Caractéristique au-delà de 100 % n’est plus plafonnée : +1 DR par tranche de 10 % au-dessus de 100 sur une réussite. |
| `test-auto-band-width` | Largeur des bandes automatiques | `param` | `5` | 0 → 10 | LDB 12 l.32 (livre-de-base f.150) | Largeur des bandes de réussite/échec automatiques : 01-N réussite, (101−N)-00 échec. Défaut 5 (01-05 / 96-00) ; 0 = aucune bande. |
| `test-extended-min-sl` | Tests étendus : DR 0 = ±1 minimum | `flag` | `false` | `false` · `true` | LDB 12 l.185 (livre-de-base f.155) | Dans un Test étendu, un Round réussi ajoute au moins +1 au total cumulé (même à DR 0) et un Round raté en retire au moins 1. |
| `test-metier-int` | Métier (Savoir) : Int au lieu de Dex | `flag` | `false` | `false` · `true` | LDB 09 l.358 (livre-de-base f.126) | Quand un Test de Métier sert de Savoir (déterminer une information), il utilise l’Intelligence au lieu de la Dextérité. |
| `test-intimidation-char` | Intimidation : caractéristique | `mode` | `F` | **`F`** · `max` · `FM` · `Int` | LDB 09 l.294 · **maison** | Caractéristique de base d’Intimidation. F = Force (RAW) ; max = la meilleure de F/FM/Int ; FM = Force Mentale ; Int = Intelligence. |

### Destin & Résistance — 1 règle

Panneau : onglet « Divers », intertitre « Destin & Résistance ».

| id | Libellé | Forme | Défaut | Valeurs | Référence | Ce que la règle change (`hint` verbatim) |
|---|---|---|---|---|---|---|
| `fortune-mid-session` | Chance regagnée en cours de session | `mode` | `off` | **`off`** · `manual` · `auto` | LDB 17 l.47 (livre-de-base f.171) | Longues Séances de Jeu : regagner des Points de Chance en cours de session (≈ 1×/h). off = seulement en début de session (RAW, via l’Effet de scène) ; manual = un bouton « Regagner la Chance maintenant » ici, à la demande ; auto = informationnel (le temps réel n’est pas traçable par le moteur — déclenchez-le à la main). **Action liée** sous la rangée quand la valeur vaut `manual` : « Regagner la Chance maintenant ». |

### Combat — 19 règles

Panneau : onglet propre « Combat ».

| id | Libellé | Forme | Défaut | Valeurs | Référence | Ce que la règle change (`hint` verbatim) |
|---|---|---|---|---|---|---|
| `combat-advantage-cap` | Plafond d’Avantage | `param` | `10` | 1 → 20 | LDB 14 l.198 (livre-de-base f.164) | Limiter les Avantages : valeur maximale d’Avantage qu’un combattant peut accumuler. |
| `combat-advantage-cap-bi` | Plafond d’Avantage = Bonus d’Initiative | `flag` | `false` | `false` · `true` | LDB 14 l.197 (livre-de-base f.164) | L’Avantage d’un combattant ne peut dépasser son Bonus d’Initiative (plafond par combattant). Prime sur le plafond fixe ci-dessus. |
| `combat-diff-cap-bonus` | Plafond des bonus de Difficulté | `param` | `60` | 0 → 100, pas 10 | LDB 14 l.95 (livre-de-base f.162) | Plafond de la SOMME des bonus de CIRCONSTANCE d’un Test de combat (RAW +60 = Très Facile). Les modificateurs du jeteur (Avantage, Soutien, États) restent hors plafond. |
| `combat-diff-cap-malus` | Plafond des malus de Difficulté | `param` | `30` | 0 → 100, pas 10 | LDB 14 l.95 (livre-de-base f.162) | Plafond de la SOMME des malus de CIRCONSTANCE d’un Test de combat (RAW −30 = Très Difficile), exprimé en valeur positive ; les modificateurs du jeteur (États, Maladresse…) n’y entrent pas. Règle optionnelle EDO (Difficultés extrêmes, réf EDO App.2) : porter ce plafond à 50. |
| `combat-frappe-mortelle` | Frappe Mortelle | `flag` | `false` | `false` · `true` | LDB 14 l.9 (livre-de-base f.160) | Tuer un adversaire en un seul coup permet d’enchaîner sur un autre (jusqu’au Bonus de CC). La règle de Taille enchaîne déjà sur une simple touche, indépendamment de cette option. |
| `combat-defensive-stance` | Sur la Défensive | `flag` | `true` | `false` · `true` | LDB 13 l.118 (livre-de-base f.158) | Action « Sur la Défensive » : +20 aux Tests de défense jusqu’au prochain tour. Désactiver retire cette Action. |
| `combat-critical-deflect` | Déviation Critique | `flag` | `true` | `false` · `true` | LDB 63 l.30 (livre-de-base f.299) | Sacrifier 1 PA pour annuler un Coup Critique sur une localisation blindée. Désactiver : le Critique est toujours subi (plus d’offre de déviation). |
| `combat-aa-blessures` | Blessures & Critiques (Aux Armes) | `mode` | `ldb` | **`ldb`** · `aa` | AA 07 l.1-185 (aux-armes f.80) | Système ALTERNATIF de Blessures/Blessures Critiques/mort d’Aux Armes (remplace WFJDR p.172-178). ldb = Livre de base (RAW, défaut). aa = tables de Critiques PAR LOCALISATION d’Aux Armes + Critique sur un double (même s’il reste des Blessures) + décalage +10/Blessure au-delà de 0 + mort si (Inconscient & 0 PB & Blessures critiques > Bonus d’Endurance). Le corps mécanique (Blessures + États immédiats + Mort) est appliqué ; les sous-effets récurrents à durée Rounds (membre inutilisable, pénalité de Test) le sont AUSSI (#125, `engine/critical.ts`) — restent en texte : durées en jours (ctx sans horloge au site de résolution) et amputations permanentes non converties en séquelles. |
| `combat-aa-avantage-groupe` | Avantage de groupe (Aux Armes) | `flag` | `false` | `false` · `true` | AA 11 l.3-100 (aux-armes f.133) | Système ALTERNATIF d’Avantage d’Aux Armes (Annexe I) : l’Avantage n’est plus accumulé par combattant mais dans DEUX réserves de camp (alliés / adversaires). La génération est routée vers la réserve du camp (héros/alliés → alliés ; PNJ hostile ou neutre → adversaires). En fin de Round, le camp DOMINANT (le plus de combattants ; Coude-à-coude compte pour deux) prend 1 Avantage à l’autre (ou +1 si l’autre est vide) — remplace la décroissance et le Surnombre du Livre de base. Tout Talent ou Trait porteur d’une variante Aux Armes bascule alors sur elle : sa fiche au Compendium affiche la version qui s’applique. Désactivé (défaut) = modèle par combattant du Livre de base, inchangé. |
| `combat-ranged-melee-penalty` | Tir dans un corps à corps | `flag` | `true` | `false` · `true` | LDB 14 l.112-116 (livre-de-base f.162) | Tirer sur une cible Engagée : −20 au toucher ; si ce malus transforme une réussite en échec, le tir touche un allié au hasard. Désactiver retire le malus et le tir égaré. |
| `combat-helpless-mode` | Cible Inconsciente | `mode` | `critique` | **`critique`** · `mort-auto` | LDB 16 l.113 (livre-de-base f.169) | critique = l’attaque réussit en Coup Critique (RAW, défaut). mort-auto = en CORPS À CORPS la cible est tuée automatiquement ; le tir reste un succès à bout portant (critique). |
| `combat-sudden-death` | Mort Subite | `mode` | `figurants` | **`figurants`** · `tous` · `off` | LDB 18 l.42 (livre-de-base f.173) | Sur un coup fatal (Dégâts > PB), la cible meurt ou tombe Inconsciente sans passer par les Blessures critiques. figurants = figurants seuls (défaut) ; tous = aussi les PNJ importants ; off = personne (tout passe par les critiques). Jamais les PJ. |
| `combat-weapon-reach` | Longueur d’arme | `flag` | `false` | `false` · `true` | LDB 62 l.172 (livre-de-base f.297) | En mêlée, une arme plus longue impose −10 à l’adversaire pour vous toucher (selon l’Allonge des armes). Désactivé par défaut. |
| `combat-init-method` | Méthode d’Initiative | `mode` | `fixed-i` | **`fixed-i`** · `roll-i` · `roll-bi` | LDB 13 l.29 (livre-de-base f.156) | fixed-i = tri par Initiative, sans dé (défaut RAW, ordre stable d’un Round à l’autre) ; roll-i = 1d10 + Initiative ; roll-bi = 1d10 + Bonus d’Initiative + Bonus d’Agilité. |
| `combat-init-reroll` | Relancer l’Initiative chaque Round | `flag` | `false` | `false` · `true` | LDB 13 l.43 (livre-de-base f.156) | Option « effectuer un lancer pour chaque Round » : au début de chaque Round, l’Initiative de tous les combattants est re-tirée (selon la Méthode d’Initiative ci-dessus) et l’ordre recalculé — les plus lents ne sont plus toujours derniers. Désactivé (défaut) = l’ordre d’ouverture est conservé pour tout le combat. |
| `combat-se-fatiguer` | Se fatiguer au combat | `flag` | `false` | `false` · `true` | LDB 16 l.97 (livre-de-base f.168) | Un effort soutenu épuise : après Bonus d’Endurance Rounds de combat, Test de Résistance — échec = État Exténué. Désactivé par défaut. |
| `combat-round-seconds` | Durée d’un Round (secondes) | `param` | `10` | 1 → 60 | LDB 13 l.13 · **maison** | « Un Round correspond en général à quelques secondes, mais c’est le MJ qui décide, si nécessaire, du temps qu’il représente » (LDB 13 l.13) : sert à décompter la rétention de souffle (BE×10 s, LDB 18 l.346) en Rounds. |
| `combat-voice-range-m` | Portée de voix (commandement) | `param` | `50` | 2 → 200, pas 2 | AA 13 l.35 / LDB 09 l.128 · **maison** | Distance en MÈTRES à laquelle un ordre crié porte : « aider une équipe qui utilise une arme possédant le Défaut Arme d’équipe à portée de voix » (AA 13 l.35) — le canon ne chiffre jamais cette portée. Défaut 50 m (≈ 25 cases à 2 m/case). |
| `siege-engine-push-speed` | Vitesse de poussée d’un engin de siège | `param` | `2` | 1 → 6 | ADE II 8 l.258 · **maison** | « [le bélier/la baliste sont] dotés de roues pour se déplacer sur le champ de bataille » (ADE II 8 l.256/258) sans chiffrer de vitesse : plafond MAISON (en cases) d’une poussée d’équipage — mouvement SIMPLE, aucun Test. |

### Social — 8 règles

Panneau : onglet propre « Social ».

| id | Libellé | Forme | Défaut | Valeurs | Référence | Ce que la règle change (`hint` verbatim) |
|---|---|---|---|---|---|---|
| `social-status-reaction-roll` | Réaction au Statut (1d10) | `flag` | `false` | `false` · `true` | LDB 08 l.40/59 (livre-de-base f.50) | Au-delà de la norme sociale : avant un Test social ciblant un PNJ, 1d10 → 1-2 « Braver le Statut » (annule les mods de Statut) ; 3-8 réactions classiques (mods normaux) ; 9-10 « Opinions extrêmes » (mods inversés). |
| `social-begging-bonus` | Mendicité et Statut | `flag` | `false` | `false` · `true` | LDB 08 l.63 (livre-de-base f.51) | La mendicité est plus efficace juste au-dessus de soi : un personnage Bronze qui mendie auprès d’un Échelon Argent obtient +10 au lieu de −10 (Bronze → Argent uniquement). |
| `social-charm-intra-tier` | Statut au sein d’un même Échelon | `flag` | `false` | `false` · `true` | LDB 08 l.57 (livre-de-base f.51) | Le MJ applique aussi le ±10 de Statut entre deux personnes du MÊME Échelon mais de Standing différent (Standing supérieur +10 / inférieur −10). |
| `mendier-heures-par-jour` | Mendier : heures par journée | `param` | `4` | 1 → 12, pas 1 | LDB 09 l.97 · **maison** | Nombre d’heures passées à mendier en une Activité — le gain horaire (Bonus de Sociabilité × DR) est multiplié par ce nombre. |
| `mendier-discours` | Mendier : modificateur de discours | `param` | `0` | -30 → 30, pas 10 | LDB 09 l.97 · **maison** | Modificateur appliqué au Test de Charme selon le discours tenu pour mendier. |
| `mendier-apparence-bonus` | Mendier : apparence qui suscite la sympathie | `param` | `10` | -30 → 30, pas 10 | LDB 09 l.97 · **maison** | Modificateur accordé au Test quand le mendiant porte une atteinte visible (lésion apparente d’une maladie active). |
| `mendier-surpris-pct` | Mendier : chance d’être surpris par ses pairs | `param` | `10` | 0 → 100, pas 5 | LDB 09 l.99 · **maison** | Chance, après une Activité Mendier, d’être vu par ses pairs — auquel cas le Standing baisse de 1 pour la prochaine aventure. Les Carrières sans ressources (Statut d’entrée Bronze 0) en sont exemptées. |
| `mendier-amende-sous` | Mendier : amende des gardes locaux | `param` | `12` | 0 → 240, pas 6 | LDB 09 l.97 · **maison** | Sous de cuivre retirés de la bourse du mendiant délogé par les gardes locaux. La bourse ne descend jamais sous zéro. |

### Création — 2 règles

Panneau : onglet « Divers », intertitre « Création ».

| id | Libellé | Forme | Défaut | Valeurs | Référence | Ce que la règle change (`hint` verbatim) |
|---|---|---|---|---|---|---|
| `creation-gnome-jouable` | Gnome jouable (NADJ) | `flag` | `false` | `false` · `true` | NADJ 14 l.5 (nuits-agitees-et-dures-journees f.86) | Ajoute le Gnome (Nuits agitées) comme race jouable : il devient une option du Tableau des Races aléatoires (borne 98, partagée avec l’Ogre) et apparaît dans la grille de sélection. Désactivé par défaut. |
| `creation-signes-astraux` | Signes astraux à la création | `flag` | `true` | `false` · `true` | ADE II 03 l.30 (archives-de-l-empire-2 f.39) | Étape optionnelle ADE II : un signe astral (1d100, +25 PX si le tirage est gardé) qui modifie les attributs de départ ou octroie un Talent, plus l’ascendant et les demeures célestes (flavor). Désactiver retire l’étape du créateur. |

### Marché — 4 règles

Panneau : onglet propre « Marché ».

| id | Libellé | Forme | Défaut | Valeurs | Référence | Ce que la règle change (`hint` verbatim) |
|---|---|---|---|---|---|---|
| `market-mode` | Système d’achat / vente | `mode` | `complet` | **`complet`** · `sans-disponibilite` · `sans-marchandage` · `simplifie` | LDB 59 l.15 (livre-de-base f.290) | complet = Disponibilité + Marchandage (RAW) ; sans-disponibilite = tout en stock (pas de Test) ; sans-marchandage = prix fixes (pas de jet opposé) ; simplifie = les deux désactivés. |
| `market-tenir-comptes` | Tenir les comptes (Statut) | `flag` | `false` | `false` · `true` | LDB 59 l.9 (livre-de-base f.290) | Simplification LDB 59 l.9-11 : un objet coûtant au plus votre niveau de Statut (Bronze N = N sous, Argent N = N pistoles, Or N = N couronnes) s’achète sans compter les pièces ; au-delà, un seul achat par jour via un Test de Marchandage. Désactivé par défaut (chaque pièce est comptée, RAW). |
| `market-guild` | Guildes d’Artisans | `flag` | `false` | `false` · `true` | LDB 60 l.38 (livre-de-base f.292) | Marché dans une ville à Guilde : les Défauts d’un objet réduisent sa Disponibilité (plus rare) et le premier Atout ne l’augmente pas. |
| `market-cite-stock` | Cité : quantité d’un objet en stock | `param` | `99` | 1 → 999, pas 1 | LDB 59 l.34 · **maison** | Quantité disponible d’un objet en stock dans une CITÉ : « les cités en possèdent autant que le MJ le juge approprié » (LDB 59 l.34) — le canon ne chiffre rien (village 1, ville 1d10). Défaut 99 = stock pratiquement illimité ; baisser pour une cité rationnée. |

### Activités — 7 règles

Panneau : onglet propre « Activités ».

| id | Libellé | Forme | Défaut | Valeurs | Référence | Ce que la règle change (`hint` verbatim) |
|---|---|---|---|---|---|---|
| `tavern-games` | Jeux de taverne | `flag` | `false` | `false` · `true` | NADJ 16 l.9 (nuits-agitees-et-dures-journees f.91) | Ajoute les jeux de taverne (Nuits agitées & dures journées, ch.16) : Al-zahr, bras de fer, fléchettes, dominos, boules, Middenball, Cerevis… chacun joué avec SES règles (manches, mises, passages de lancers, camps). Désactivé par défaut. |
| `tavern-games-rapides` | Jeux de taverne rapides | `flag` | `false` | `false` · `true` | NADJ 16 l.9-11 (nuits-agitees-et-dures-journees f.91) | Pour certains groupes, les jets de dés peuvent gêner le plaisir du jeu de rôle. Si vous souhaitez que vos parties de taverne soient résolues rapidement, effectuez un Test opposé de **Compétence Intermédiaire (+0)** en utilisant la Compétence indiquée dans la section « Jeu » du jeu en question. Si aucune Compétence n'est indiquée (comme pour *Al-zahr*), faites plutôt un Test opposé de **Pari Intermédiaire (+0)**. Celui qui obtient le nombre le plus élevé de DR remporte la partie. |
| `interlude-enabled` | Entre deux aventures | `flag` | `true` | `false` · `true` | LDB 21 l.108 (livre-de-base f.192) | Système « Entre deux aventures » (événements, Activités, dépenses). Désactiver court-circuite l’interlude (ignoré silencieusement). |
| `interlude-elf-duty` | Devoir elfique (Prestige Elfique) | `flag` | `true` | `false` · `true` | LDB 23 l.54-56 (livre-de-base f.196) | Un personnage elfe perd 1 Activité (interlude ≥ 3 semaines) pour son devoir envers les siens. Désactiver lève cette restriction. |
| `interlude-assist-costs-activity` | Assister une Entreprise coûte un créneau (maison) | `flag` | `false` | `false` · `true` | LDB 12 l.189 / ADE II 8 l.81 · **maison** | RAW muet : aucune règle ne dit si prêter son Soutien à l’Entreprise d’un autre (ex. Planification de bataille) consomme l’une des trois Activités de l’assistant. Désactivé (défaut) : seul le meneur dépense un créneau, les assistants aident gratuitement. Activé : chaque assistant qui a encore un créneau en dépense un. |
| `inn-gather-info-minutes` | Recueillir des informations à l’auberge — durée | `param` | `120` | 30 → 480, pas 30 | EDOC 8 l.151-153 · **maison** | Temps passé à papoter et poser des questions dans une auberge (Ragot Intermédiaire, EDOC 8 l.151), en MINUTES — avance l’horloge de campagne quelle que soit l’issue. |
| `favor-rumor-spreads` | Faveur rompue : la rumeur se répand (perte de Niveau) | `flag` | `true` | `false` · `true` | LDB 23 l.141 · **maison** | Rompre une Faveur réduit le Niveau de Carrière de 1 (minimum 0) « si la rumeur de la perfidie se répand » (LDB 23 l.141) — le RAW ne précise aucune condition : par défaut, la rumeur se répand systématiquement. Désactiver retire la pénalité de Niveau (rupture sans conséquence sociale). |

### Avancement — 2 règles

Panneau : onglet « Divers », intertitre « Avancement ».

| id | Libellé | Forme | Défaut | Valeurs | Référence | Ce que la règle change (`hint` verbatim) |
|---|---|---|---|---|---|---|
| `advancement-career-jump` | Sauts de Niveau de Carrière (accord du MJ) | `flag` | `false` | `false` · `true` | LDB 07 l.140/148 (livre-de-base f.49) | Avec l’accord du MJ (LDB 07 l.140/148) : autorise un SAUT vers un Niveau de Carrière supérieur non-adjacent (même Carrière), et l’accès au MÊME Niveau d’une autre Carrière de la même Classe (Niveau courant complété requis). Désactivé (défaut) = RAW strict (Niveau suivant complété ou inférieur, ou 1er Niveau d’une autre Carrière). |
| `advancement-mentor` | Mentor requis hors carrière | `flag` | `false` | `false` · `true` | LDB 07 l.89 (livre-de-base f.48) | LDB 07 l.89 : une Augmentation de Caractéristique/Compétence HORS carrière (déjà au coût doublé) exige de trouver un mentor. Activé, ces Augmentations sont bloquées tant que le flag de groupe/scène « mentor » n’est pas posé (Effet d’éditeur setFlag « mentor »). Désactivé par défaut. |

### Magie — 5 règles

Panneau : onglet propre « Magie ».

| id | Libellé | Forme | Défaut | Valeurs | Référence | Ce que la règle change (`hint` verbatim) |
|---|---|---|---|---|---|---|
| `magic-composant` | Composants d'incantation | `flag` | `false` | `false` · `true` | LDB 46 l.107 (livre-de-base f.236) | Un lanceur peut focaliser sa magie via un composant adapté à un Sort d'Arcane/Domaine (acheté pour ce Sort, coût = NI pistoles d'argent). Sur une Incantation Imparfaite, le composant l'absorbe : Majeure → Mineure, Mineure → annulée. Consumé à l'incantation, même sans Imparfaite. Composants gérés sur la fiche du personnage. Désactivé par défaut. |
| `vents-tourbillonnants` | Vents Tourbillonnants | `mode` | `off` | **`off`** · `scene` · `round` | LDB 46 l.179-190 (livre-de-base f.238) | Avant chaque scène — ou à chaque Round dans une zone de turbulences — tirage 1d10 de la force des Vents (−30 à +30), appliqué aux Tests d'Incantation ET de Focalisation. Un porteur du Talent Seconde vue peut le repérer (Test de Perception Facile +40). off = désactivé (défaut) ; scene = tirage à l'ouverture du combat ; round = re-tirage à chaque Round (« zones de turbulences magiques »). |
| `magic-sorcellerie` | Sorcellerie | `flag` | `false` | `false` · `true` | LDB 49 l.5 (livre-de-base f.255) | Domaine sombre de la Sorcellerie (LDB 49) : les Sorts dont le Domaine porte le marqueur Sorcellerie appliquent ses règles — +1 Point de Corruption à chaque jet d’Incantation Imparfaite, État Hémorragique possible sur la cible, et composant OBLIGATOIRE (sinon une Incantation Imparfaite Mineure est systématiquement lancée ; les ingrédients coûtent le NI en sous de cuivre). Désactivé par défaut. |
| `magic-vdm-incantation` | Règles d'incantation révisées (VDM) | `flag` | `false` | `false` · `true` | VDM 02 l.5-7 (vents-de-la-magie f.19) | Les Vents de Magie révisent les règles d’incantation du Livre de base : « Elles remplacent celles du Livre de Règles de WFJDR » (VDM 02 l.5), « Bien entendu, vous êtes libre d’utiliser celles que vous souhaitez » (l.7). Activé : les Dégâts d’un Projectile magique valent Dégâts du Sort + Bonus de Force Mentale du lanceur, sans le DR du Test d’Incantation (l.68) ; « Puissance totale », sur une Incantation Critique, ajoute le chiffre des dizaines du lancer d’Incantation au DR pour obtenir une Surincantation (l.55) ; les Incantations Imparfaites se tirent sur les tableaux des Vents de Magie (l.218-263) — dont la rangée « Marqué par la Magie », qui tire sur les Marques arcaniques du Vent du lanceur, ou relance sur le tableau Majeur si sa tradition n’en a pas ; la Surincantation suit le Tableau de Surincantation par palier de DR (l.194-215), les DR au-delà du NI étant dépensables un par un ; près d’une Influence corruptrice, tout lancer d’Incantation ou de Focalisation raté impose une Imparfaite Mineure — Majeure si une Mineure était déjà due (l.157-159) ; et le Sorcier du Chaos (Talent Magie du Chaos) ignore les armures du Chaos pour « Repousser les Vents » (VDM 02 l.169). Désactivé par défaut (règles du Livre de base). |
| `magic-vdm-environnementale` | Magie environnementale (VDM) | `flag` | `false` | `false` · `true` | VDM 14 l.26 / l.94 / l.136-179 / l.212-278 (vents-de-la-magie f.190) | Magie environnementale des Vents de Magie (chapitre « Les Vents à l’œuvre ») : l’état magique du LIEU modifie les Tests d’Incantation et de Focalisation — palier de Saturation environnementale (−1 DR en Basse, +1 DR pour le ou les Vents prépondérants en Élevée, +2/+1 DR en Extrême), lignes de force, pierres gardiennes (Réfraction, Atténuation, Amplification), cercles d’oghams, nexus de puissance, appuis arcaniques, Tempêtes de Magie et lieux nommés du chapitre (forge d’Henoth, taverne d’Uli, Pierres de Barbaneagra). Données éditables dans `arcane-phenomena.json`. Désactivé par défaut (règles du Livre de base). |

### Prières — 3 règles

Panneau : onglet « Divers », intertitre « Prières ».

| id | Libellé | Forme | Défaut | Valeurs | Référence | Ce que la règle change (`hint` verbatim) |
|---|---|---|---|---|---|---|
| `prayer-conviction` | Prêchez ma sœur ! | `flag` | `false` | `false` · `true` | LDB 40 l.42 (livre-de-base f.218) | LDB 40 l.42 : les Tests de Prière entonnés discrètement ou sans conviction (murmurés) subissent une Difficulté plus élevée (un cran plus difficile). Le priant choisit alors, à l’incantation, entre prier à voix haute (normal) ou discrètement (plus dur). Désactivé par défaut. |
| `prayer-petites` | Petites Prières | `flag` | `false` | `false` · `true` | LDB 25 l.22 (livre-de-base f.204) | LDB 25 l.22-24 : un personnage NON Béni qui prie dans un site sacré peut malgré tout être entendu — un 1d100 secret, exaucé sur 01 (pourcentage relevé s’il possède la Compétence Prière). Se déclenche depuis un Effet d’éditeur posé sur un site sacré. Désactivé par défaut. |
| `prayer-petites-bonus-per-advance` | Petites Prières : bonus par avance de Prière | `param` | `1` | 0 → 10 | LDB 25 l.22-24 · **maison** | « Si vous avez la Compétence Prière, le MJ peut augmenter ce pourcentage » (l.24) — sans barème chiffré. Valeur maison : +N % de seuil d’exaucement par avance de Prière. |

### Corruption — 1 règle

Panneau : onglet « Divers », intertitre « Corruption ».

| id | Libellé | Forme | Défaut | Valeurs | Référence | Ce que la règle change (`hint` verbatim) |
|---|---|---|---|---|---|---|
| `corruption-tables-edoc` | Tables de Corruption étendues (EDOC) | `mode` | `ldb` | **`ldb`** · `toute` · `khorne` · `nurgle` · `slaanesh` · `tzeentch` | EDOC 12 l.63 (ennemi-dans-l-ombre-compagnon f.65) | Tables de mutations du Compagnon T1 (physiques + mentales), alignées par Puissance du Chaos. ldb = Tableaux du Livre de base (RAW, défaut). toute = tables EDOC « Toute Puissance » (élargies). khorne/nurgle/slaanesh/tzeentch = tables alignées sur un dieu (pour une campagne dédiée). Une mutation peut différer du Livre de base (ex. Écailles épineuses). |

### Psychologie — 1 règle

Panneau : onglet « Divers », intertitre « Psychologie ».

| id | Libellé | Forme | Défaut | Valeurs | Référence | Ce que la règle change (`hint` verbatim) |
|---|---|---|---|---|---|---|
| `psych-acquisition-optional` | Acquisition de Traits psychologiques | `flag` | `false` | `false` · `true` | ADE II 09 l.3 (archives-de-l-empire-2 f.92) | Règles facultatives ADE II (Annexe I) pour gagner de nouveaux Traits psychologiques en cours de partie : Phobie du noir (États Brisé de Terreur cumulés ≥ Bonus de FM → Phobie), Animosité & Haine (dépenser le Destin pour survivre → Test de Calme ; échec → Animosité, doublon → Haine), Trauma (Ambition rendue impossible → Test de Calme ; échec → Trauma). Désactivé par défaut. |

### Maladies — 2 règles

Panneau : onglet « Divers », intertitre « Maladies ».

| id | Libellé | Forme | Défaut | Valeurs | Référence | Ce que la règle change (`hint` verbatim) |
|---|---|---|---|---|---|---|
| `disease-mode` | Utilisation des maladies | `mode` | `full` | **`full`** · `situational` · `off` | LDB 20 l.35 (livre-de-base f.186) | full = toutes les expositions (RAW) ; situational = pas d’Infection Mineure post-critique, mais Infecté/Maladie conservés (Skavens/Nurgle) ; off = aucune maladie (ni contraction, ni progression, ni contagion). |
| `maladie-conscience-determination-minutes` | Maladie : fenêtre de conscience par Détermination (minutes) | `param` | `5` | 1 → 60, pas 1 | LDB 20 l.170 · **maison** | Durée pendant laquelle le SYMPTÔME dépensé est ignoré après la dépense (LDB 20 l.170) — l’État qu’il portait (Inconscient d’une Fièvre Grave) revient à l’échéance ; les autres symptômes de la maladie ne sont pas touchés. |

### Voyage — 23 règles

Panneau : onglet propre « Voyage ».

| id | Libellé | Forme | Défaut | Valeurs | Référence | Ce que la règle change (`hint` verbatim) |
|---|---|---|---|---|---|---|
| `travel-etapes` | Voyage par Étapes | `flag` | `false` | `false` · `true` | EDOC 8 l.33 (ennemi-dans-l-ombre-compagnon f.31) | Sous-système optionnel du Compagnon T1 : un trajet est découpé en Étapes, chacune avec un jet de Météo (et ses activités). Désactivé = voyage jour-par-jour du Livre de base, inchangé. Toggle PARENT : les options de Voyage ci-dessous sont inertes tant qu’il est éteint. |
| `travel-etapes-count-bonus` | Étapes supplémentaires | `param` | `0` | 0 → 4, pas 1 | EDOC 8 l.40 (ennemi-dans-l-ombre-compagnon f.32) | « Si votre groupe apprécie une expérience de voyage plus complexe, augmentez le nombre d’Étapes de 2 ou plus. » +N Étapes par trajet. Sans effet si « Voyage par Étapes » est éteint. |
| `travel-etapes-low-move-bonus` | Étapes supplémentaires (groupe lent) | `param` | `1` | 1 → 2 | EDOC 8 l.25 · **maison** | « Si [le Mouvement le plus faible des Personnages] est inférieur ou égal à 3, le voyage doit être augmenté de 1 ou 2 Étapes » — le canon ne tranche pas entre 1 et 2. Sans effet si « Voyage par Étapes » est éteint. |
| `travel-allures` | Montures et attelages (allures) | `flag` | `false` | `false` · `true` | EDOC 07 l.138-146 (ennemi-dans-l-ombre-compagnon f.25) | Règles de voyage du Compagnon T1 (ch.4) : voyage en selle sur les bêtes possédées (vitesse = Mouvement × 1,5/2,5/3 km/h au pas/trot/galop), endurance des allures (12 h au pas, Bonus d’Endurance en heures au trot, moitié au galop) avec Incidents de monte au-delà, et allure forcée d’un attelage (Test de Conduite d’attelage par km ; Échec Stupéfiant → Problème de véhicule). Indépendant du « Voyage par Étapes ». |
| `travel-departure-gate` | Porte d’heure de départ (terre & fleuve) | `flag` | `true` | `false` · `true` | LDB 51 l.195 · **maison** | Un voyage à pied, en selle ou sur le fleuve ne peut s’ébranler que de l’aube au crépuscule. Tenter de partir de nuit propose d’attendre l’aube (nuit jouée) ou d’annuler. La mer est exemptée (voguer de nuit = équipage + installations, MDG 15 l.76). Désactiver autorise un départ à toute heure. |
| `travel-sleep-forced` | Privation de sommeil (nuit forcée) | `flag` | `true` | `false` · `true` | LDB 18 · **maison** | Chaque jour calendaire franchi SANS nuit de sommeil jouée inflige 1 État Exténué (« privation de sommeil ») à chaque héros vivant. Il se dissipe au prochain vrai repos. Débrayable ici. |
| `sea-night-sailing` | Voguer de nuit (équipage & installations) | `flag` | `true` | `false` · `true` | MDG 15 l.76 · **maison** | Le navire de campagne peut naviguer de nuit (équipage suffisant, installations adéquates) : distance de jour pleine. Désactiver = pas de navigation nocturne → distance quotidienne divisée par deux (MDG 15 l.76). |
| `travel-attraper-froid` | Attraper froid | `flag` | `false` | `false` · `true` | EDOC 8 l.90 (ennemi-dans-l-ombre-compagnon f.33) | Option « Attraper Froid » : Test d’Exposition en fin d’Étape sous intempéries (pluie/neige sans manteau ni tente ; toujours sous averse/blizzard). En saison froide, l’exposition donne un rhume. Sauté si un héros réussit le poste « Plein air ». Sans effet si « Voyage par Étapes » est éteint. |
| `water-scarcity` | Pénurie d’eau | `flag` | `false` | `false` · `true` | LDB 18 l.340 (livre-de-base f.181) | L’eau est réputée abondante au Reikland (rivières, puits, auberges) → aucune Soif par défaut. Activer pour un contexte À SEC (siège, désert, souterrain prolongé) : chaque jour sans eau impose un Test de Résistance (de plus en plus dur) — 1ᵉʳ échec −10 Int/FM/Soc, puis −10 le reste + 1d10 Blessures (LDB 18 l.340). En mer, la Soif suit automatiquement les tonneaux du navire, sans cette règle. |
| `crew-test-zero-success` | Test d’équipage : 0 DR compte comme un succès | `flag` | `false` | `false` · `true` | MDG 14 l.13 (mer-des-griffes f.121) | « Si le total est de 1 DR ou plus, le résultat global est un succès. Le MJ peut aussi considérer un résultat de 0 comme un succès en fonction des circonstances. » Défaut : seuil à 1 DR. Activer : un total de 0 DR vaut un Succès Minime (manœuvre, bordée, entretien, rude épreuve…). |
| `sea-water-litres-mediane` | Eau bue par jour (température Médiane, en mer) | `param` | `3` | 2 → 3 | MDG 14 l.242 · **maison** | « Un membre d’équipage boit 2 à 3 litres d’eau par jour » (hors bandes Caniculaire/Chaude, déjà chiffrées à 4 L/3 L) : le canon donne une fourchette, pas une valeur unique. Défaut : borne haute (3 L). |
| `exposure-night-difficile-count` | Exposition : Tests par nuit (difficile) | `param` | `2` | 0 → 8 | LDB 18 l.328 · **maison** | LDB 18 l.328 ne chiffre que la CADENCE (Test toutes les 4h en environnement difficile) ; l’application « une nuit ~8h dehors = N Tests » est maison. Une nuit abritée en environnement extrême retombe sur ce même nombre. |
| `exposure-night-extreme-count` | Exposition : Tests par nuit (extrême) | `param` | `4` | 0 → 12 | LDB 18 l.328 · **maison** | LDB 18 l.328 ne chiffre que la CADENCE (Test toutes les 2h en environnement extrême, ex. tempête) ; l’application « une nuit ~8h dehors = N Tests » est maison. |
| `exposure-tent-cancels` | La Tente annule l’Exposition du camp | `flag` | `true` | `false` · `true` | LDB 74 l.62 · **maison** | LDB 74 l.62 ne prête à la Tente AUCUN effet sur l’Exposition (seul le Sac de couchage a un bonus chiffré, +20 au Test de Froid, LDB 74 l.60) : cette annulation est une convenance maison. Désactiver : une Tente ne compte plus comme abri automatique (retombe sur l’abri de fortune, Survie en extérieur). |
| `exposure-expire-hours` | Exposition : dissipation des pénalités (heures) | `param` | `24` | 1 → 168, pas 1 | LDB 18 · **maison** | Le canon ne fixe aucune durée à ces pénalités (−10 aux caractéristiques) : convention maison de dissipation après N heures au chaud/au frais. |
| `exposure-no-coat-penalty` | Exposition (Froid) : pénalité sans Manteau | `param` | `10` | 0 → 30, pas 5 | LDB 65 l.44 · **maison** | LDB 65 l.44 dit seulement « des pénalités » sans les chiffrer : valeur maison retirée au Test de Résistance contre le froid sans Manteau/Cape porté(e). |
| `sea-shipwreck-swim` | Naufrage en mer : Difficulté du Test de Natation | `mode` | `complexe` | `facile` · `accessible` · `intermediaire` · **`complexe`** · `difficile` · `tresDifficile` | MDG 13 l.522 · **maison** | Quand le navire de campagne coule (Blessures à 0, MDG 13 l.674), chaque héros à bord tente un Test de Natation (LDB 09 l.372) pour rejoindre la côte ; échec = noyade (LDB 18 l.344). La Difficulté d’un naufrage en pleine mer n’est pas chiffrée : ancrage le plus proche = la noyade du Tourbillon (Natation Complexe –10, MDG 13 l.522). Défaut Complexe. |
| `landRobberyFleePct` | Vol terrestre — perte de cargaison en cas de FUITE (%) | `param` | `25` | 0 → 100, pas 5 | LDB 51 · **maison** | Arbitrage #327 (2026-07-11) : quand une péripétie dangereuse terrestre (embuscade) se solde par un combat, la cargaison des porteurs du convoi subit une perte GRADUÉE par l’issue. Combat FUI : le convoi laisse ce % d’Enc de cargaison aux assaillants (défaut 25). RAW muet en mécanique de vol terrestre → paramètre maison. |
| `landRobberyLossPct` | Vol terrestre — perte de cargaison en cas de DÉFAITE (%) | `param` | `75` | 0 → 100, pas 5 | LDB 51 · **maison** | Arbitrage #327 (2026-07-11) : combat de vol terrestre PERDU → les assaillants pillent ce % d’Enc de cargaison du convoi (défaut 75). Combat gagné = 0 %. RAW muet → paramètre maison. |
| `piratePillagePct` | Cogue pirate — pillage de la cale en cas de soumission (%) | `param` | `100` | 0 → 100, pas 5 | MDG 15 l.171-173 · **maison** | Arbitrage #327 (2026-07-11) : se SOUMETTRE à la Cogue pirate (MDG 15) laisse les forbans « fouiller la cale et prendre ce qu’ils veulent » — ce % d’Enc de cargaison du navire est pillé (défaut 100). Le RAW décrit l’extorsion sans la chiffrer → paramètre maison. |
| `boardingWaveSize` | Abordage — nombre d’assaillants qui montent à bord | `param` | `5` | 1 → 12, pas 1 | MDG 15 l.150/171 · **maison** | Un abordage (MDG 14/15) dérivé d’un événement de navire hostile engendre une vague d’assaillants de CE nombre (individus de l’équipage type de la coque), plus le chef éventuel — la coque ennemie entière (25/45 marins) est l’effectif du navire, jamais autant de figurants sur le pont. Le RAW décrit l’assaut sans chiffrer la vague → paramètre maison, éditable. |
| `sea-overspeed-tests-per-day` | Survitesse : Tests d’Endurance par jour | `param` | `1` | 1 → 6 | MDG 13 l.121-142 · **maison** | « Ça va lâcher, capitaine ! » chiffre 1 Test par heure/minute/Round selon la bande de survitesse — la boucle de voyage résout un JOUR à la fois. Défaut : 1 Test (le pire des dégâts de la bande) par jour de survitesse ; augmenter pour accentuer le risque des bandes les plus sévères (M+7 et plus). |
| `sea-chart-orientation-dr` | Carte marine : bonus d’Orientation | `param` | `2` | 0 → 5, pas 1 | MDG 15 l.290 · **maison** | Une Carte marine donne +2 DR au Test d’Orientation quotidien (MDG 15 l.290), en principe UNIQUEMENT entre les deux ports désignés à sa création. Faute d’un graphe de ports navigables (chantier de la carte du monde), la carte aide ici sur TOUTE route maritime — simplification maison, éditable (0 = la carte n’aide plus). |

### Possessions — 1 règle

Panneau : onglet « Divers », intertitre « Possessions ».

| id | Libellé | Forme | Défaut | Valeurs | Référence | Ce que la règle change (`hint` verbatim) |
|---|---|---|---|---|---|---|
| `possession-random-chars-on-acquire` | Caractéristiques aléatoires à l’acquisition (bêtes/serviteurs) | `flag` | `true` | `false` · `true` | LDB 77 l.108 · **maison** | À l’acquisition d’une bête ou d’un serviteur (achat, dotation, don), tire une fois ses caractéristiques (−10 + 2d10, ou 1d10 si la Caractéristique vaut 5) — le tirage se FIGE dans `Possession.charsRolled`, seedé sur son uid : jamais relancé (« Elles seront relancées à chaque combat ? Pas fou. »). Désactivé : la possession garde le profil imprimé du catalogue. |
<!-- sources-empreinte: e39f6391f69255d9e9e816970db8bac87a2ae846 (10 fichiers, 0 dossiers) corps: a13d2de9542912e9c7a58b053028c0d047e6e679 -->
