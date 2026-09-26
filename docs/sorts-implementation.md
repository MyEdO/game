# Sorts & Miracles — état d'implémentation

> GÉNÉRÉ par `npx tsx scripts/gen-sorts-doc.mts` — ne pas éditer à la main.
> ✅ = effets connus appliqués par le moteur ·
> 🟡 = partiel (volet « arbitrage MJ » journalisé en jeu) · 📜 = rien de mécanique
> (effet journalisé verbatim). « curé » = spec complète dans SpellData (spells.json).

**Périmètre mesuré / angles morts** — la classification (État/Curé/Reste) lit `s.effects` (le `Flow` authoré) via `spellOps(s.effects, on)`, appelé seulement pour `on: 'target'` et `on: 'caster'`. `EffectOp.on` admet aussi `'party'` et `'hero'` (`src/engine/flowCore.ts`) : un effet authoré sur ces deux cibles est invisible ici — ni compté dans État/Curé, ni listé dans « Reste à mécaniser ». Mesuré sur `src/data/spells.json` : 0 occurrence de `party`/`hero` aujourd'hui (angle mort inerte). Second angle mort, DISTINCT : `spellOps` ne descend jamais dans les `Flow` imbriqués d'un `GameOp.onHitEffects` (`augmentWeapon`/`grantWeapon`, ex. Serres d'ambre → « En flammes » à la touche) — ces ops ciblent la victime touchée via `TriggeredEffect.on: 'victim'` (un champ DIFFÉRENT d'`EffectOp.on`, cf. `EffectTargeting`). Mesuré : 5 sorts / 6 occurrences (`serres-d-ambre`, `l-epee-ardente-de-rhuin`, `marteau-ardent-de-sigmar`, `morsure-de-l-hiver`, `epee-de-justice`) — mais chacun porte déjà un autre op non-narratif au premier niveau (`augmentWeapon`/`grantWeapon`), donc la classification affichée n'est PAS sous-évaluée par ce trou aujourd'hui ; seul le détail « Reste à mécaniser » de ces 5 lignes est incomplet. Troisième angle mort : la mesure est STRUCTURELLE (le `Flow` authoré existe), pas une preuve d'exécution — une op comptée « mécanique » ici peut rester « inerte au switch » d'`applyOps` (cf. `docs/vocabulaire-mecanique.md`).

## Bénédiction (5)
**Synthèse** : 576 sorts — ✅ 93 mécaniques · 🟡 216 partiels · 📜 267 narratifs (arbitrage MJ) · 438 specs curées.


| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Culpabilité | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Justice | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Rapidité | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Robustesse | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Soins | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Béni (19)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Bénédiction de Bataille | ✅ | oui |  |
| Bénédiction de Chance | ✅ | oui |  |
| Bénédiction de Charisme | ✅ | oui |  |
| Bénédiction de Conscience | 📜 | oui | Bénédiction de Conscience : Test de Force Mentale Accessible (+20) pour briser un Commandement de la divinité, sinon Honte (pas d’Action) — arbitrage MJ. |
| Bénédiction de Convalescence | ✅ | oui |  |
| Bénédiction de Courage | ✅ | oui |  |
| Bénédiction de Droiture | ✅ | oui |  |
| Bénédiction de Finesse | ✅ | oui |  |
| Bénédiction de Grâce | ✅ | oui |  |
| Bénédiction de Guérison | ✅ | oui |  |
| Bénédiction de La Chasse | ✅ | oui |  |
| Bénédiction de Protection | ✅ | oui |  |
| Bénédiction de Puissance | ✅ | oui |  |
| Bénédiction de Sagesse | ✅ | oui |  |
| Bénédiction de Sauvagerie | ✅ | oui |  |
| Bénédiction de Souffle | ✅ | oui |  |
| Bénédiction de Ténacité | ✅ | oui |  |
| Bénédiction de Vigueur | ✅ | oui |  |
| Bénédiction de Vivacité | ✅ | oui |  |

## du Domaine de la Peste (3)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Brume Acide | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Contamination | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Immuno - Déficience | 📜 | repli | Non curé : desc journalisée telle quelle. |

## du Domaine de la Ruine (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Crépitement Funeste | ✅ | repli |  |
| Crevasse | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Dépeçage | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Flamme Verdâtre | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Hébètement | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Rafale Hurlante | 🟡 | repli | Non curé : desc journalisée telle quelle. |

## du Domaine des Ombres (9)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Armure d’Obscurité | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Bond Furtif | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Disparition | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Pattes Gluantes | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Poids Plume | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Poudre d’Escampette | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Rage Meurtrière | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Rat Esclave | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Shurikens Enchantés | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Invocation — Déesse-Araignée (3)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Bon Baiser d'la Fosse Noire | ✅ | oui |  |
| Nuée d'Escampette | ✅ | oui |  |
| Toile surprise | 🟡 | oui | Toile surprise : pour chaque +2 DR, vous pouvez PLUTÔT étendre la zone de BSoc m (au lieu de l'Empêtré supplémentaire) — arbitrage MJ. |

## Invocation — Manann (14)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Apaiser les eaux | 📜 | oui | Apaiser les eaux : l'Indice M d'un Détroit ou d'un Tourbillon tombe à 0 tant que le Miracle fait effet — arbitrage MJ (péril nautique non modélisé). |
| Bénédiction de l'albatros | 📜 | oui | Bénédiction de l'albatros : un albatros suit le navire ; tant qu'il est présent le navire NE PEUT PAS couler, quels que soient les Dégâts. Si l'albatros est tué : –1d10 au Moral et –2d10 à l'Humeur de Manann — arbitrage MJ. |
| Bénédiction du marinier | 📜 | oui | Bénédiction du marinier : tous les Tests de Natation, de Ramer ou de Voile de la cible bénéficient de +1 DR pendant 1 jour. |
| Contre-courants | 📜 | oui | Contre-courants : le navire ciblé subit –1 M et –1 DR sur sa caractéristique Man tant que le Miracle fait effet — arbitrage MJ (caractéristiques de navire non ciblables par op). |
| Encalminé | 📜 | oui | Encalminé : un navire dans la Ligne de vue est privé de vent pendant 1 heure ; une zone d’eaux calmes (BInit m) l’entoure et le suit s’il avance autrement — arbitrage MJ. |
| Générosité de Manann | 🟡 | oui | Générosité de Manann : en pleine mer, la prise nourrit le double (Rations × 2) — arbitrage MJ. |
| Malédiction de la mer | 📜 | oui | Malédiction de la mer : si l'équipage du navire ciblé ne mérite pas le respect de Manann (Chaos, Stromfels, orcs/gobelins, skavens, Humeur de Manann négative), +2 aux Dégâts de tous les coups reçus par l'équipage tant que le Miracle fait effet — arbitrage MJ. |
| Marcher sur les eaux | 📜 | oui | Marcher sur les eaux : vous franchissez une grande étendue d’eau (≥ 10 m de large) comme un sol ferme, pour la durée — arbitrage MJ. |
| Mer déchainée | 🟡 | oui | Mer déchainée : pour utiliser son Mouvement, la cible doit réussir un Test d’Agilité Accessible (+20), sinon elle gagne aussi À Terre — arbitrage MJ. |
| Navigation bénie | 📜 | oui | Navigation bénie : au calcul de l'Humeur de Manann du navire, l'Humeur s'améliore de 2d10, –1 par Point de Péché actuel du prêtre — arbitrage MJ (Humeur de Manann non modélisée). |
| Repousser une créature marine | 📜 | oui | Repousser une créature marine : la créature (Trait Aquatique ou Créature marine) n'effectue aucune action hostile tant qu'elle ne subit ni Dégâts ni États nuisibles, pendant la durée du Miracle — arbitrage MJ/IA. |
| Respiration aquatique | ✅ | oui |  |
| Vents favorables | 📜 | oui | Vents favorables : un voilier dans la Ligne de vue file à sa vitesse maximale (quels que soient vent/marée/courant) et gagne +10 à tous les Tests de pilotage, pendant 1 heure — arbitrage MJ. |
| Visage de l'homme noyé | 🟡 | oui | Visage de l’homme noyé : à la fin du Miracle, la cible effectue un Test de Résistance Difficile (−20) sous peine de gagner l’État À Terre — arbitrage MJ. |

## Invocation — Morr (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Anéantir les morts-vivants | 🟡 | oui | Anéantir les morts-vivants : un mort-vivant détruit par ce Miracle ne peut jamais être relevé par Nécromancie — arbitrage MJ. |
| Condamné | 📜 | oui | Condamné : vous offrez à la cible une vision de sa mort à venir ; elle peut désormais acheter le Talent Destinée par PX (une seule fois par Personnage) — arbitrage MJ. |
| Main de Morr | 📜 | oui | Main de Morr : une cible consentante à 0 PB gagne Inconscient et cesse de se dégrader (maladie, Blessures Critiques, poisons repoussés) pour la durée du Miracle — arbitrage MJ. |
| Masque mortuaire | ✅ | oui |  |
| Rites funéraires | 📜 | oui | Rites funéraires : l’âme d’un cadavre est envoyée au Royaume de Morr (immunisé à la Nécromancie) ; un mort-vivant ou un être Fabriqué ciblé est détruit — arbitrage MJ. |
| Seuil du Portail | 📜 | oui | Seuil du Portail : une ligne de 8 m qu’un Mort-vivant ne franchit que sur un Test de Force Mentale (+0) réussi (jamais s’il est aussi Fabriqué), jusqu’à l’aube — arbitrage MJ. |

## Invocation — Myrmidia (15)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Appel à la Fureur | 🟡 | oui | Appel à la Fureur : la Haine vise précisément ceux qui engagent l’allié au combat — arbitrage MJ. |
| Bouclier de Myrmidia | ✅ | oui |  |
| Commander la Légion | 📜 | oui | Commander la Légion : un ordre à un allié à vue ; votre prochain Test de Commandement lié bénéficie de +10 — arbitrage MJ. |
| Connais Ton Ennemi | 📜 | oui | Connais Ton Ennemi : profil, Traits, Compétences et Talents d’un ennemi à portée sont révélés (panneau d’inspection). |
| Dévotion de la Vierge Guerrière | 🟡 | oui | Dévotion de la Vierge Guerrière : +1 rang Sans peur visant un ennemi précis (individu ou espèce) — arbitrage MJ. |
| En Bon Ordre | 🟡 | oui | En Bon Ordre : les cibles retenues peuvent rompre le combat (Fuite) sans céder d’Avantage ni subir d’attaque gratuite — dispense de Fuite non modélisée. |
| En Terrain Dangereux | 🟡 | oui | En Terrain Dangereux : les cibles retenues ne reçoivent pas l’État Brisé tant que le Miracle est actif — immunité à l’État Brisé non modélisée. |
| Frappe Rapide | 📜 | oui | Frappe Rapide : au début de chaque Round, un Test d’Initiative Intermédiaire (+0) réussi octroie une attaque gratuite immédiate (main principale) — arbitrage MJ. |
| Fureur Vengeresse | 📜 | oui | Fureur Vengeresse : vous devez Charger l’ennemi impénitent le plus proche et pouvez relancer tous vos jets de Corps à corps tant que le Miracle est actif — arbitrage MJ. |
| Inspirant | 🟡 | oui | Inspirant : +1 Talent Coude-à-coude (bonus de surnombre coopératif) — arbitrage MJ si non câblé. |
| Lance de Myrmidia | ✅ | oui |  |
| Prouesses Martiales | ✅ | oui |  |
| Soleil flamboyant | 🟡 | oui | Soleil flamboyant : ne touche que les non-Myrmidiens qui regardent dans votre direction — arbitrage MJ. |
| Terrifier l'Ennemi | ✅ | oui |  |
| Œil de l'aigle | 📜 | oui | Œil de l’aigle : un aigle spectral invulnérable survole le champ ; vous percevez par ses yeux et dirigez son vol, mais vous ne percevez plus par les vôtres (vulnérable) — arbitrage MJ. |

## Invocation — Ranald (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Grâce de Ranald | 🟡 | oui | Grâce de Ranald : la cible gagne aussi +10 en Discrétion pour la durée — arbitrage MJ. |
| Invitation | 📜 | oui | Invitation : un système de verrouillage (serrure, loquet, corde) d’une porte/fenêtre/trappe cède, +1 par +2 DR — arbitrage MJ. |
| Que la chance persiste | 🟡 | oui | Que la chance persiste : vous ne pourrez ré-invoquer ce Miracle qu’une fois revenu à 0 Point de Chance — arbitrage MJ. |
| Riche, pauvre, mendiant, voleur | 📜 | oui | Riche, pauvre, mendiant, voleur : par cible, une illusion au choix (bourse vide/pleine, tenue misérable/riche, objet de valeur imperceptible), +1 effet par +2 DR — arbitrage MJ. |
| Vous ne m'avez pas vu, n'est-ce pas? | 📜 | oui | Vous ne m’avez pas vu : les cibles passent inaperçues tant qu’elles n’attirent pas l’attention (toucher, attaquer, parler, incanter, faire du bruit) — arbitrage MJ. |
| Yeux de chat | 📜 | oui | Yeux de chat : un chat-serviteur invulnérable explore les environs ; vous percevez par ses sens et dirigez ses pas, mais vous ne percevez plus par les vôtres (vulnérable) — arbitrage MJ. |

## Invocation — Rhya (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Abri de Rhya | 📜 | oui | Abri de Rhya : en extérieur sauvage, un abri naturel protégé du vent et de la pluie apparaît (1 personne, +1 par +2 DR) et ne peut être redécouvert une fois quitté — arbitrage MJ. |
| Caresse de Rhya | 🟡 | oui | Caresse de Rhya : au lieu du soin, vous pouvez traiter 1 maladie contractée naturellement ; +1 effet (au choix) par +2 DR ; les résultats mettent ≥ 10 minutes à se manifester — arbitrage MJ. |
| Enfants de Rhya | 📜 | oui | Enfants de Rhya : en pleine nature, vous percevez toutes les créatures conscientes dans un rayon de (Sociabilité) m (+(Sociabilité) m par +2 DR) — arbitrage MJ. |
| Récolte de Rhya | ✅ | oui |  |
| Secours de Rhya | 🟡 | oui | Secours de Rhya : si ce retrait élimine TOUS les États de la cible, elle gagne +10 à tous ses Tests lors de son prochain Tour — arbitrage MJ. |
| Union de Rhya | 📜 | oui | Union de Rhya : vous bénissez l’union de deux âmes ; tant que le Miracle dure (heures), le couple concevra un enfant si c’est biologiquement possible — arbitrage MJ. |

## Invocation — Shallya (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Amère catharsis | 🟡 | oui | Amère catharsis : le prêtre subit 1d10 − BSoc Blessures NON mitigées par poison/maladie purgé — arbitrage MJ. |
| Baume pour un esprit blessé | 🟡 | oui | Baume pour un esprit blessé : sommeil réparateur jusqu’à l’aube si non dérangé (cible non volontaire : Test de Calme +0 pour résister) — arbitrage MJ. |
| Endurance de l'anachorète | 🟡 | oui | Endurance de l’anachorète : la cible ne ressent aucune douleur (effets hors pénalités d’États — arbitrage MJ). |
| Innocence immaculée | 🟡 | oui | Innocence immaculée : sur Maladresse, prêtre ET cible gagnent 1d10 Corruption — arbitrage MJ. |
| Larmes de Shallya | 🟡 | oui | Larmes de Shallya : exige 10 − BSoc Rounds de Prière ininterrompue — arbitrage MJ. |
| Martyr | ✅ | oui |  |

## Invocation — Sigmar (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Comète à Deux Queues | 🟡 | oui | Comète à Deux Queues : cible les ennemis de Sigmar, à l’extérieur seulement — arbitrage MJ. |
| Feu de l'âme | 🟡 | oui | Feu de l’âme : par +2 DR, étendre la ZdE de +BSoc mètres OU +2 Dégâts aux peaux-vertes/morts-vivants/serviteurs de la Ruine — au choix, arbitrage MJ. |
| Flambeau de Vertu | 🟡 | oui | Flambeau de Vertu : le Talent tient tant que la cible reste en Ligne de Vue du prêtre ; les peaux-vertes en LdV doivent tester leur Psychologie — arbitrage MJ. |
| Marteau ardent de Sigmar | ✅ | oui |  |
| N'écoutez point la Sorcière | ✅ | oui |  |
| Vaincre les impies | ✅ | oui |  |

## Invocation — Stromfels (7)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Faire fi de l'Humeur de Manann | 📜 | oui | Faire fi de l'Humeur de Manann : d10 (+1 par Point de Péché) sur la table du Miracle, appliqué au score d'Humeur de Manann du navire du prêtre — arbitrage MJ (Humeur de Manann non modélisée). |
| Flairer le sang | 📜 | oui | Flairer le sang : pendant 1 heure, vous pouvez suivre la piste d'un blessé sur terre comme sur l'eau en réussissant un Test de Pistage Facile (+40) — arbitrage MJ. |
| Lame de fond | 📜 | oui | Lame de fond : une vague énorme s'écrase sur la cible (personne, bateau, phare…) — collision d'IC 15 (Indice de Collision, MDG p.111) — arbitrage MJ (collisions navales non modélisées). |
| Mal de mer | ✅ | oui |  |
| Malédiction de la maîtresse cruelle | 📜 | oui | Malédiction de la maîtresse cruelle : pendant (Bonus de Force) jours, à chaque repos visant à récupérer d'États Exténué, la cible doit réussir un Test de Calme Complexe (–10), sinon l'État Exténué persiste — arbitrage MJ (hook de repos). |
| Sacrifice à Stromfels | 📜 | oui | Sacrifice à Stromfels : l'Indice de Voie d'eau du navire ciblé est DOUBLÉ — arbitrage MJ (pas d'op de mise à l'échelle d'un État à valeur). |
| Vents de tempête | 📜 | oui | Vents de tempête : l'intensité du vent augmente d'un cran pour le navire ciblé pendant (Force) minutes ; direction inchangée — arbitrage MJ (échelle de vent non modélisée). |

## Invocation — Taal (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Bondissant comme un cerf | 🟡 | oui | Bondissant comme un cerf : vous gagnez aussi +1 Mouvement et réussissez automatiquement les Tests d’Athlétisme pour sauter (DR minimum 0) — arbitrage MJ. |
| Dent et griffe | ✅ | oui |  |
| Enchevêtrement | 🟡 | oui | Enchevêtrement (Taal) : pour chaque +2 DR, vous pouvez plutôt étendre la zone de BSoc m (au lieu de l’Empêtré supplémentaire) — arbitrage MJ. |
| Instincts animaux | 🟡 | oui | Instincts animaux : si vous vous reposez, vous êtes automatiquement réveillé par toute menace dans un rayon de (Initiative) m — arbitrage MJ. |
| Roi de la Nature | 🟡 | oui | Roi de la Nature : le MJ choisit l’animal invoqué selon l’environnement (voir « Les bêtes du Reikland ») — ici un Loup par défaut. |
| Seigneur de la Chasse | 📜 | oui | Seigneur de la Chasse : vous ne perdez plus la piste de votre proie désignée et gagnez +10 à tous les Tests la concernant, pour la durée (heures) — arbitrage MJ. |

## Invocation — Ulric (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Frisson du givre | 🟡 | oui | Frisson du givre : tous ceux dans un rayon de (Sociabilité) m perdent −1 Avantage au début de chaque round (gelés jusqu’aux os) — arbitrage MJ. |
| Fureur d'Ulric | ✅ | oui |  |
| Hurlement du loup | 🟡 | oui | Hurlement du loup : à la fin du Miracle, le loup blanc repart aux Terrains de Chasse d’Ulric dans un hurlement effrayant — arbitrage MJ. |
| Jugement du Roi de la neige | 🟡 | oui | Jugement du Roi de la neige : si le MJ juge la cible ni faible, ni couarde, ni fourbe, c’est VOUS qui subissez ces Blessures à sa place — arbitrage MJ. |
| Morsure de l'hiver | 🟡 | oui | Morsure de l’hiver : la hache inflige aussi +DR Dégâts et ses frappes retirent tout Hémorragique sans jamais en causer — arbitrage MJ. |
| Peau de loup d'hiver | ✅ | oui |  |

## Invocation — Verena (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Entraves à la vérité | 🟡 | oui | Entraves à la vérité : l’Empêtré ne s’applique que si la cible a réellement commis un crime et le nie (et il ne peut être retiré tant que le Miracle dure) ; une fausse accusation vous coûte +1 Point de Péché et un jet de Colère des dieux — arbitrage MJ. |
| Épée de justice | 🟡 | oui | Épée de justice : marquez les adversaires criminels du Groupe « Criminel » (éditeur) pour que l’Inconscient les frappe — le statut de criminel relève de l’arbitrage MJ. |
| Justice aveugle | 📜 | oui | Justice aveugle : vous pouvez tester Perception (+0) pour percer les illusions magiques, et Intuition (+20) pour savoir si un interlocuteur pense dire la vérité — arbitrage MJ. |
| La Vérité éclatera | 📜 | oui | La Vérité éclatera : vous posez une question à laquelle les cibles répondent sincèrement, à moins de battre votre DR par un Test de Calme (+20) — refus à +0, dissimulation mineure à +2 DR, majeure à +4, mensonge à +6 — arbitrage MJ. |
| Sagesse de la chouette | ✅ | oui |  |
| Verena est mon témoin | 📜 | oui | Verena est mon témoin : tant que vous ne dites que la vérité, tous vos auditeurs croient vos paroles pour la durée (sans nécessairement partager vos conclusions) — arbitrage MJ. |

## Magie des Arcanes (56)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Agressivité de la Maresang | ✅ | oui |  |
| Algues Cruelles | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Âme Dévoilée | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Argile fertile | 📜 | oui | Argile fertile : pendant la Durée du Sort, la bête des marais se régénère du double de Points de Blessures qu'elle devrait normalement obtenir — doublement d'une Régénération non modélisé, arbitrage MJ. |
| Arme aethyrique | ✅ | oui |  |
| Armure Aethyrique | ✅ | oui |  |
| Attaques en chaîne | ✅ | oui |  |
| Aura ordinaire | 📜 | oui | Aura ordinaire : votre nature magique est indétectable (Perception de la magie et similaires). |
| Bélier | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Berceuse Soporifique UA II | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Bouclier | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Bouclier anti-flèches | ✅ | oui |  |
| Bouclier magique | 📜 | oui | Bouclier magique : +BFM DR à vos tentatives de Dissipation tant que le Sort est actif (la Dissipation n’est pas encore modélisée). |
| Cacophonie Scabreuse | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Carreau | ✅ | oui |  |
| Chute | 📜 | oui | Chute : l’objet tenu tombe (arme au sol — arbitrage MJ). |
| Crue Mortelle | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Décharge Cérébrale | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Décrypter une malédiction | 🟡 | oui | Décrypter une malédiction : l'objet révèle s'il est maudit, le détail de ses bienfaits et méfaits, et la manière dont la malédiction se déclenche ; même décryptée elle reste active, seul le Rituel Lever une malédiction l'élimine — révélation des propriétés d'un objet non modélisée, arbitrage MJ. |
| Déplacement d'objet | 📜 | oui | Déplacement d’objet : déplace un objet inanimé (Force = votre FM) de BFM mètres. |
| Désarroi | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Dôme | ✅ | oui |  |
| Duplicité de Tzeentch | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Effondrement de Fabriqué | 📜 | oui | Effondrement de Fabriqué : les énergies magiques qui maintiennent le Fabriqué en bloc se défont, il devient inerte et sans vie — mise hors service d'un Fabriqué non modélisée, arbitrage MJ. |
| Effrayant | ✅ | oui |  |
| Enchevêtrement | ✅ | oui |  |
| Envol | ✅ | oui |  |
| Esprit Enfiévré | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Explosion | ✅ | oui |  |
| Explosion de Dhar | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Fêlure AEthyrique | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Haleine Fétide | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Introspection | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Langue Acérée | ✅ | repli |  |
| Maîtrise du Destin | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Peau d'écorce et d'os | 🟡 | oui | Peau d'écorce et d'os : NI 1 pour Ghyran et 3 pour Ghur, deux sorciers différents devant contribuer au Sort lors d'un même Round ; la Durée retient le Bonus de Force Mentale le plus haut des deux participants — incantation à deux lanceurs de Domaines distincts non modélisée, arbitrage MJ. |
| Perturbant | ✅ | oui |  |
| Perturber la Magie | 📜 | oui | Perturber la Magie : le Sort ou le Rituel que la cible focalisait échoue et elle subit une Incantation Imparfaite Mineure — interruption d'une incantation adverse non modélisée, arbitrage MJ. |
| Pierre de Souffrance | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Pont | 🟡 | oui | Pont : pont d’énergie de BFM mètres (long./larg.), +BFM mètres par +2 DR (arbitrage MJ). |
| Poussée | ✅ | oui |  |
| Projectile | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Projectile de Dhar | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Protection | ✅ | oui |  |
| Rejeton de Slaanesh | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Sang corrosif | ✅ | oui |  |
| Secourir un serviteur magique | ✅ | oui |  |
| Secousse Tellurique | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Silence | 🟡 | oui | Silence : aucun bruit ne traverse la zone, on n'y entend aucun son et les personnes situées en dehors n'en perçoivent rien ; l'incantation menée à l'intérieur subit une pénalité de −3 DR — propagation du son et pénalité de DR portée par une zone non modélisées, arbitrage MJ. |
| Souffle | ✅ | oui |  |
| Téléportation | ✅ | oui |  |
| Terrifiant | ✅ | oui |  |
| Trouble | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Vague Scélérate | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Varech avarié | ✅ | oui |  |
| Vision dans l'obscurité | ✅ | oui |  |

## Magie des Arcanes & de Nécromancie (8)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Agression AEthyrique | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Appel de Vanhel | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Armure d’AEthyr | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Entrave | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Forme Spectrale | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Frénésie Artificielle | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Mouchard | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Télékinésie | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Magie des Arcanes & de Sorcellerie (5)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Effigie Maudite | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Faux- Semblant | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Nuée | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Ruine | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Terreur Nocturne | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Magie des Arcanes & des Taillis (5)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Bienveillance | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Bouillon Revigorant | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Fertilisation | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Nostrum | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Ramanchage | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Magie des Arcanes Skaven (1)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Avatar du Rat Cornu | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Magie des Arcanes — Bête (24)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Appeler une monture | 🟡 | oui | Appeler une monture : l'animal est un animal commun non monstrueux originaire de la région (cerf, sanglier, ours) — la donnée retient le Sanglier, éditable au Compendium ; votre Compétence Chevaucher vaut alors votre Compétence Langue (Magick) et la monture conserve son instinct de survie (substitution de Compétence non modélisée). |
| Bête indomptée | 🟡 | oui | Bête indomptée : l'animal domestique devient féroce et entêté jusqu'à dissipation ; la Compétence Emprise sur les animaux ne peut plus le dompter, seulement le dissuader d'attaquer, et son cavalier est jeté de sa monture s'il rate un Test de Chevaucher Difficile (−20) — fuite dans la nature ou retournement contre l'ancien propriétaire : arbitrage MJ. Transformation répugnante : la pilosité corporelle de la cible pousse de façon drue et elle perd sa capacité à parler, jusqu'à dissipation. |
| Capuche vengeresse | 📜 | oui | Capuche vengeresse : les Dégâts de l'attaque non magique sont réduits par votre Bonus de Force Mentale + DR ; réduits à 0, l'attaque est redirigée — à distance vers une cible aléatoire située à 2 mètres ou moins de vous, au corps à corps vers l'assaillant, qui ne peut pas s'y opposer (réduction chiffrée et redirection non exprimables sans Trait porteur, arbitrage MJ). |
| Éveil du bois | ✅ | oui |  |
| Forme bestiale | 🟡 | oui | Forme bestiale : choisissez votre forme parmi les Bêtes du Reikland (ici l’Ours par défaut) ; +1 Trait facultatif par +2 DR — arbitrage MJ. |
| Incarnation de Wyssan | 🟡 | oui | Incarnation de Wyssan : gagnez aussi Arboricole et Grand (Taille) ; vous ne pouvez plus utiliser vos Compétences Langue ou Savoir — arbitrage MJ. |
| La lance d'Ambre | 🟡 | oui | La lance d’Ambre : traverse en ligne droite, ignore les PA de cuir/fourrure et frappe chaque cible suivante avec −1 Dégât, jusqu’à n’infliger aucune Blessure — arbitrage MJ. |
| Langue bestiale | 📜 | oui | Langue bestiale : vous parlez aux créatures Bestial (+20 en Emprise sur les animaux et Dressage) mais ne pouvez parler aucune langue civilisée ni incanter tant que le Sort dure — arbitrage MJ. |
| Les lunes du chasseur | ✅ | oui |  |
| Maître de la bête | 📜 | oui | Maître de la bête : une créature Bestial vous considère comme son chef de meute et obéit à vos instructions simples pour la durée ; libérée, elle garde assez de crainte pour ne pas vous attaquer — arbitrage MJ. |
| Malédiction d'Anraheir | 🟡 | oui | Malédiction d'Anraheir : seules les cibles ENNEMIES sont harcelées ; celles qui quittent la Zone d'Effet restent suivies mais ne subissent plus que −1 Mouvement et −10 en Capacité de Combat, Capacité de Tir et Agilité ; les montures fuient si elles ratent un Test de Calme Intermédiaire (+0), jusqu'à être calmées par un Test de Chevaucher Intermédiaire (+0) réussi ; les esprits sont invisibles à tous sauf aux cibles et ne peuvent pas être blessés — suivi hors zone et esprits non modélisés, arbitrage MJ. |
| Obstination du bœuf | 🟡 | oui | Obstination du bœuf : les cibles n'ont pas besoin d'effectuer de Test de Peur ou de Terreur pendant la Durée du Sort — dispense de Test de Peur/Terreur non modélisée. |
| Peau de chasseur | ✅ | oui |  |
| Pelage d'hiver | 🟡 | oui | Pelage d'hiver : les résultats sur tous les Tableaux de Coups Critiques portés contre vous sont réduits de −10 — modificateur de jet sur les Tableaux de Blessures Critiques non modélisé, arbitrage MJ. |
| Régiment monstrueux de Merciw | 🟡 | oui | Régiment monstrueux de Merciw : le bonus est plafonné à 100 en Force comme en Endurance — plafond de Caractéristique non modélisé. |
| Serres d'ambre | 🟡 | oui | Serres d’ambre : vos attaques à mains nues (Bagarre) deviennent magiques et infligent des Dégâts égaux à votre BFM — arbitrage MJ pour la valeur de Dégâts. |
| Suivre le fumet | 📜 | oui | Suivre le fumet : +20 aux Tests de Perception et de Pistage QUI DÉPENDENT DE L'ODORAT, ce qui inclut les Tests de Seconde vue pour sentir la magie, et vous sentez la Corruption et les mutations dans les plantes, les animaux et leurs excréments — la restriction au sens de l'odorat n'est pas exprimable (les sens appariés du moteur ne connaissent que la vue et l'ouïe), un bonus inconditionnel serait plus fort que le RAW. |
| Transe ambrée | 📜 | oui | Transe ambrée : la cible devient une statue d'ambre transparent, indéplaçable et inendommageable (y compris par la maladie et les poisons) mais soignable naturellement et magiquement ; le Sort prend fin si la statue est attaquée, le premier coup n'infligeant aucun dégât, et la cible ne conserve aucun souvenir de sa transe ; une cible volontaire peut hiberner une saison complète de 3 mois jusqu'au prochain équinoxe ou solstice, et lancé sur vous-même le Sort ne peut pas prendre fin prématurément sauf dissipation ou attaque — état de statue non modélisé, arbitrage MJ. |
| Transformation de Kadon | 🟡 | oui | Transformation de Kadon : la bête est de Taille Grande ou Énorme et son type est choisi dans la liste du Sort selon le lanceur (sorcier d'Ambre ou elfique : Demigriffon, Dragon, Hippogriffe, Grand aigle, Griffon ; chamane-bray, sorcier dissident, sorcier du Chaos : Manticore, Hydre, Jabberslythe, Vouivre) — la donnée retient le Griffon, éditable au Compendium ; vous conservez Intelligence et Force Mentale, ne pouvez pas lancer de Sorts, et vos Talents et Compétences sont remplacés par les Traits de créature et Compétences du monstre ; pour chaque +4 DR ou plus, 1 Trait de créature optionnel ou la transformation de quelqu'un d'autre comme un Sort de Contact (les cibles réticentes y résistent par un Test opposé de Force Mentale) — arbitrage MJ. |
| Traversée rapide | 🟡 | oui | Traversée rapide : le Talent Bon marcheur porte sur 1 terrain au choix ; si vous possédez déjà ces Talents, ajoutez +1 niveau temporaire, plus 1 niveau temporaire par tranche de +2 DR obtenus lors de votre Test d'Incantation ; vous bénéficiez également de +10 aux Tests pour éviter l'État Empêtré — choix du terrain, niveaux temporaires et bonus d'évitement non modélisés, arbitrage MJ. |
| Vaporisation de musc | 📜 | oui | Vaporisation de musc (aspersion) : un personnage ou un objet est aspergé d'une odeur facilement identifiable, et les Tests effectués pour le localiser ont un bonus de +2 DR ; le musc subsiste 1 journée plus 1 jour supplémentaire par tranche de +2 DR, rien ne permet de s'en débarrasser — bonus de localisation non modélisé, arbitrage MJ. Vaporisation de musc (territoire) : une zone égale au maximum à votre Bonus de Force Mentale en mètres est marquée comme votre territoire, où les animaux sauvages ne peuvent entrer que s'ils sont affamés ou menacés et s'ils ont réussi un Test de Calme Accessible (+20), ce qui ne décourage pas les monstres ; le musc subsiste 1 journée plus 1 jour supplémentaire par tranche de +2 DR — territoire non modélisé, arbitrage MJ. |
| Ver frétillant | 🟡 | oui | Ver frétillant : la cible est automatiquement Empoignée par le ver, dont la Force est de 50 ; s'il remporte le Test opposé de Force, il ajoute +1 État Empêtré supplémentaire, ou sécrète une enzyme gluante qui retire 1 Point d'Armure à toutes les localisations des armures en cuir ou du même type et dissout les objets en cuir comme les bourses ou les sacs à dos ; le ver ne peut pas infliger de Dégâts avec l'Empoignade, pas plus qu'il ne peut être blessé, et le Sort prend fin si la cible se libère — Empoignade par une créature invoquée non modélisée, arbitrage MJ. |
| Vol du Destin | 🟡 | oui | Vol du Destin : pour votre Action, un Test d’Emprise sur les animaux (+20) déplace la volée sur une autre cible à portée — arbitrage MJ. |
| Yeux de la meute | 📜 | oui | Yeux de la meute : la cible voit par vos yeux et alterne entre sa perspective et la vôtre autant qu'elle le souhaite, sans limite de portée ; votre Ligne de vue peut aider au lancement de certains Sorts comme Téléportation, mais la cible ne peut pas les lancer en passant par votre corps — vision partagée non modélisée, arbitrage MJ. |

## Magie des Arcanes — Cieux (27)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Arc de T'Essla | ✅ | oui |  |
| Arche de saphir | 📜 | oui | Arche de saphir : l'arche de 4 mètres de largeur et 3 mètres de hauteur envoie tout objet ou créature qui passe dessous dans les limbes d'une autre dimension, d'où ils ressortent à votre prochaine incantation du Sort sans avoir vu le temps passer ; si vous êtes tué avant, les occupants reviennent à leur emplacement initial avec 1 État Sonné et 1 État À Terre — mise en limbes extra-dimensionnelle non modélisée, arbitrage MJ. |
| Bienfait de Bel Shanaar | ✅ | oui |  |
| Bouclier céruléen | 📜 | oui | Bouclier céruléen : +DR PA à toutes les Localisations contre les attaques de Corps à corps ; un attaquant à l’arme métallique subit BFM Dégâts — arbitrage MJ. |
| Comète de Cassandora | 🟡 | oui | Comète de Cassandora : impact à la fin du prochain Round ; un Test de Perception ajuste (ou un échec fait dériver) le point de chute de BInit m par DR — arbitrage MJ. |
| Destin éclairci | 📜 | oui | Destin éclairci : vous posez au MJ une question fermée sur les intentions de la cible au cours de la prochaine heure, plus une question par +2 DR ; au contact, vous pouvez à la place connaître sa Destinée ainsi que les présages ou malédictions qui la visent, symboles d'Augure actifs compris — divination et lecture de Destinée non modélisées, arbitrage MJ. |
| Ennemi prévisible | 📜 | oui | Ennemi prévisible : vous ne pouvez pas être Surpris et le MJ doit vous alerter d'une embuscade ou d'une situation similaire (Bonus d'Initiative) Rounds à l'avance, temps dont vous disposez pour fuir ou préparer votre propre guet-apens — immunité à un État et alerte anticipée non modélisées, arbitrage MJ. |
| Ironie du Destin | 🟡 | oui | Ironie du Destin : les cibles retenues partagent une réserve unique de Points de Chance pour la durée du Sort, réallouée à la fin — réserve commune de Points de Chance non modélisée. |
| Lames d'Azur | 📜 | oui | Lames d'Azur : un adversaire au corps à corps subit 3 frappes faisant 8 Dégâts à des Localisations déterminées aléatoirement à chaque Round lors de son tour, sans pouvoir les esquiver ni les parer ; une arme d'allonge Très longue ou Considérable passe à travers les lames, une arme Longue frappe simultanément, une arme plus courte encaisse les Dégâts avant d'attaquer — représailles automatiques contre l'adversaire engagé non modélisées, arbitrage MJ. |
| Le Premier Signe d'Amul | ✅ | oui |  |
| Le Second Signe d'Amul | 🟡 | oui | Le Second Signe d’Amul : +1 Point de Chance supplémentaire par tranche de +2 DR (en plus du +DR de base) — arbitrage MJ. |
| Le Troisième Signe d'Amul | ✅ | oui |  |
| Lentille céleste | 🟡 | oui | Lentille céleste : le disque de cristal vous fait voir distinctement objets et créatures jusqu'à 3 milles et annule les pénalités liées aux nuages et à la brume, mais pas à l'obscurité ; le bonus de +2 DR ne vaut que pour les Tests de Perception impliquant une longue distance, et observer les étoiles accorde +2 DR à votre prochain Test d'Orientation — vision à longue distance et bonus d'Orientation non modélisés, arbitrage MJ. |
| Lueur stellaire | 📜 | oui | Lueur stellaire : la lumière des étoiles éclaire d'une lueur douce une zone qui se déplace avec vous, révèle les cibles invisibles de la Zone d'Effet, y fait disparaître l'obscurité naturelle comme magique et dévoile les créatures et les portes dissimulées — rayon de lumière calculé sur une Caractéristique et révélation des dissimulés non modélisés, arbitrage MJ. |
| Malédiction du Destin | 🟡 | oui | Malédiction du Destin : vous ne pouvez placer qu'une seule malédiction par cible, qui doit être dans votre Ligne de Vue ; la variante Destin fatal, lancée à +6 DR, porte la Portée à 1 mille et fait perdre définitivement un Point de Destin à la cible, ou traite son prochain Coup Critique comme un résultat de « 00 » si elle n'en a pas — perte définitive d'un Point de Destin et forçage du résultat de Critique non modélisés, arbitrage MJ. |
| Maudit | 📜 | oui | Maudit : tant que le Sort dure, vous pouvez dépenser un Point de Chance pour forcer la cible à relancer un Test — arbitrage MJ. |
| Mer d'huile | 📜 | oui | Mer d'huile : l'effet Calme plat (tableau Effet du vent, MDG p.107) s'applique dans une ZdE de (BFM) milles pendant (BFM) minutes — arbitrage MJ (échelle de vent non modélisée). |
| Miroir mystique | 📜 | oui | Miroir mystique : par un miroir ou une surface réfléchissante, vous voyez, entendez et parlez à une cible distante dont vous connaissez le nom ou que vous avez rencontrée ; le Sort échoue si elle n'a aucune surface réfléchissante dans son champ de vision — communication à distance non modélisée, arbitrage MJ. |
| Mistral de la stratosphère | 🟡 | oui | Mistral de la stratosphère : la cible tient bon contre l'Azyr glacé et ne subit aucune pénalité d'Exposition au Froid. Mistral de la stratosphère : la cible subit la première pénalité d'Exposition au Froid (WFJDR, page 181) — Exposition au Froid non modélisée, arbitrage MJ. Mistral de la stratosphère : l'eau sous forme liquide de la Zone d'Effet se glace à raison de 3 centimètres d'épaisseur par Round ; les Rounds suivants, vous dirigez le mistral dans une autre direction ou continuez à glacer les mêmes cibles, qui refont un Test contre l'Exposition au Froid à chaque Round sans reprendre de Dégâts et récupèrent 10 Points de Caractéristique perdus par heure ; vous pouvez vous déplacer tout en lançant ce Sort — persistance dirigeable et gel du décor non modélisés, arbitrage MJ. |
| Nettoyage impeccable | 📜 | oui | Nettoyage impeccable : l'objet en verre devient immaculé ; si c'est une lentille optique ou une fenêtre, il reçoit un bonus d'enchantement temporaire — +20 aux Tests de Savoir (Astronomie) à +2 DR, et +20 aux Tests de Perception basés sur la vue effectués avec le Talent Seconde vue à +4 DR — enchantement temporaire d'un objet non modélisé, arbitrage MJ. |
| Prédiction prodigieuse | 🟡 | oui | Prédiction prodigieuse : la relance ne vaut que pour le premier échec aux Tests d'Incantation, de Focalisation et de Dissipation, et ne bénéficie pas au lanceur ; la formulation inverse, le Bouleversement de Solmann, fait au contraire lancer deux fois les sorciers adverses à ces mêmes Tests, en retenant le moins bon résultat — restriction de la relance à un type de Test et formulation inverse non modélisées, arbitrage MJ. |
| Prémonition | 📜 | oui | Prémonition : vous choisissez l'un des trois effets — connaître le moment le plus opportun pour une action future, dont le MJ juge l'exactitude par un Test d'Intelligence Intermédiaire (+0) effectué secrètement ; localiser un objet perdu ou volé déjà vu, le Sort en indiquant la direction mais pas la distance ; ou modifier de + ou − 10 un prochain lancer de dés précisément désigné, un seul effet de ce type à la fois — divination et modificateur sur un jet futur désigné non modélisés, arbitrage MJ. |
| Projection astrale | 📜 | oui | Projection astrale : votre esprit quitte votre corps, qui reste en sommeil profond ; invisible, il se déplace normalement, voit et entend, traverse les obstacles solides, mais ne peut ni lancer de sorts, ni communiquer, ni manipuler d'objets matériels ; si vous ne le regagnez pas avant la fin du Sort, vous effectuez un Test contre l'Exposition Modérée à la Corruption (WFJDR, page 182) — forme astrale et exposition conditionnée au non-retour non modélisées, arbitrage MJ. |
| Que soufflent les Quatre Vents ! | 🟡 | oui | Que soufflent les Quatre Vents ! : vous faites apparaître 4 Vortex aléatoires ou choisissez 4 groupes d'ennemis à portée ; la distance de répulsion augmente de (Bonus de Force Mentale) mètres pour chaque +2 DR obtenu, et les ennemis qui impactent un obstacle solide ou un autre personnage subissent 7 Dégâts, modifiés par leur Bonus d'Endurance et leurs Points d'Armure, puis s'immobilisent — quatre Zones d'Effet simultanées, répulsion augmentée par les DR et Dégâts de collision non modélisés, arbitrage MJ. |
| Solution de tir optimal de Niezlib | 📜 | oui | Solution de tir optimal de Niezlib : pendant 1 Round, les Tests effectués pour tirer avec un canon depuis le navire ciblé bénéficient de +1 DR. |
| Tempête de Shemtek | 🟡 | oui | Tempête de Shemtek : un nombre d'éclairs égal à votre Bonus d'Initiative × 2 s'échappe de votre corps vers des cibles distinctes devant vous ; quiconque assiste au Sort sans posséder le Talent Magie des Arcanes (Cieux) doit réussir un Test contre la Peur (1), et le Sort n'a pas besoin d'être lancé à ciel ouvert ; une variante moins risquée invoque un nombre d'éclairs égal à votre Bonus d'Initiative dans une zone cible à (Bonus de Force Mentale) × 2 mètres, sans État Sonné ni Peur — éclairs répartis sur des cibles distinctes et variante non modélisés, arbitrage MJ. |
| Tornade de Thorsen | 🟡 | oui | Tornade de Thorsen : les cibles touchées sont ensuite projetées dans une direction aléatoire selon les règles du Sort Que soufflent les Quatre Vents !, et la tornade elle-même suit les règles des Vortex aléatoires — direction aléatoire de la projection et déplacement du vortex non modélisés, arbitrage MJ. |

## Magie des Arcanes — Démonologie (4)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Destruction de Démon Mineur | 🟡 | oui | Destruction de Démon Mineur : ne draine que les Démons de Force Mentale inférieure à la vôtre ; vous gagnez alors +10 à une Caractéristique de votre choix pour la durée — arbitrage MJ. |
| Détection de démon | 📜 | oui | Détection de démon : vous percevez toute influence démoniaque à portée (invoquée, liée à un artefact, en possession…) — arbitrage MJ. |
| Manifestation de Démon mineur | 🟡 | oui | Manifestation de Démon mineur : Test opposé de Focalisation (Dhar)/Force Mentale — sur un succès il vous obéit puis disparaît ; sur un échec il se retourne contre vous (passez-le hostile) — arbitrage MJ. |
| Octogramme | 🟡 | oui | Octogramme : un cercle protecteur (diamètre BFM m) qu’aucune créature Démoniaque ne peut franchir, sauf si sa Force Mentale dépasse le double de la vôtre — arbitrage MJ. |

## Magie des Arcanes — Feu (24)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Allumer le feu | 🟡 | oui | Allumer le feu : dans la Zone d'Effet, tout ce qui est normalement ininflammable peut prendre feu, même l'eau ou la pierre ; l'État En flammes et les +DR Dégâts de feu ne frappent que ce qui est DÉJÀ inflammable — inflammabilité de la matière non modélisée, arbitrage MJ. |
| Blizzard ardent d'Ygethmor | 🟡 | oui | Blizzard ardent d'Ygethmor : le Test d'Athlétisme Intermédiaire (+0) se rejoue à chaque tour passé dans la zone ; les objets inflammables et les éléments du terrain ont 25 % de chance de prendre feu à chaque tour ; seule une couverture totale protège du blizzard — arbitrage MJ. |
| Cautériser | 🟡 | oui | La cible hurle de douleur (Aqshy brûle en guérissant). |
| Cognat de l'âtre | 🟡 | oui | Cognat de l'âtre : un élémentaire mineur (Mouvement 3, Capacité de Combat égale à votre Force Mentale, attaques de Dégâts +6, Trait Peur (1), En flammes sur ses Dégâts) sort du feu de camp, reste à 12 mètres de celui-ci, obéit à la voix, ne gagne pas d'Avantages et n'est blessé que par une pinte d'eau — invocation d'une créature sans profil de bestiaire, arbitrage MJ. |
| Colérique | 🟡 | oui | Colérique : la cible du Préjugé est nommée ou désignée par le lanceur ; la durée est de (Bonus de Force Mentale) heures, jours (+4 DR, Animosité) ou semaines (+8 DR, Haine) ; deux amis laissent à la cible un Test de Calme Accessible (+20) pour résister — cible nommée et durées longues non modélisées, arbitrage MJ. |
| Corps de feu | 📜 | oui | Corps de feu : qui essaie de vous attraper ou de vous empoigner subit 8 + DR Dégâts, doit réussir un Test de Calme Difficile (−20) par Round ou lâcher prise, et prend 1 État En flammes plus 8 + DR Dégâts par Round d'Empoignade ; blessé au corps à corps, votre sang asperge l'assaillant (Test d'Esquive Intermédiaire (+0) ou Projectile magique de Dégâts +3 ignorant les PA) ; vos vêtements et possessions sont ignifugés — riposte passive au contact non exprimable sans Trait porteur, arbitrage MJ. |
| Couronne de Flammes | 🟡 | oui | Couronne de Flammes : +1 Talent Seigneur de guerre tant que le Sort est actif ; par +2 DR, +1 Peur OU Seigneur de guerre repris — arbitrage MJ. |
| Cœurs ardents | 🟡 | oui | Cœurs ardents : +1 Talent Coude-à-coude tant que le Sort est actif (arbitrage MJ). |
| Embrasement | 🟡 | oui | Embrasement : sur une cible DÉJÀ En flammes, distribuez à la place 3 États En flammes aux autres cibles situées à 2 mètres ou moins de celle d'origine — propagation au choix du lanceur, arbitrage MJ. |
| Épées sanguines | 📜 | oui | Épées sanguines : 1 épée volante (+1 par +2 DR, 6 au maximum) flotte devant vous ; dépenser votre action les dirige contre des cibles à portée et en Ligne de vue, une seule épée par cible, Trait Vol (20), Capacité de Combat 60, 8 Dégâts, défense normale de l'adversaire, indestructibles, sans Avantages, dissipables — attaquant autonome à Capacité de Combat propre non modélisé, arbitrage MJ. |
| Flamme fascinante | 🟡 | oui | Flamme fascinante : la cible est un feu, l'observateur affecté est tiré au hasard parmi ceux qui regardent dans sa direction ; les hypnotisés oublient ce qui les entoure jusqu'à retirer tous les États Sonné du Sort, et attaquer une cible Sonnée les retire tous ; +2 DR ensorcelle un brasier ou un feu de camp (2 observateurs), +4 DR un bûcher ou un bâtiment en flammes (tous ceux qui l'observent) — désignation aléatoire des observateurs non modélisée, arbitrage MJ. |
| Flamme inextinguible | 📜 | oui | Flamme inextinguible : un feu d'au plus la taille d'un feu de camp brûle sans combustible pendant (Bonus de Force Mentale) heures, jours (+2 DR), semaines (+4 DR) ou mois (+6 DR) ; les bûches séparées en plus petits feux restent inextinguibles ; le Sort peut à l'inverse éteindre un feu de taille similaire, et aucun Sort ni dissipation ne l'éteint — feu du décor non modélisé, arbitrage MJ. |
| Fournaise flétrissante | 🟡 | oui | Fournaise flétrissante : l'État Exténué ne frappe que les cibles ENNEMIES de la zone qui essayent de courir, charger ou fuir, et retirer l'armure et les vêtements en élimine 1 ; les cibles que le feu touche, même une bougie, reçoivent automatiquement un État En flammes et subissent +DR Dégâts supplémentaires de toutes les sources de feu — arbitrage MJ. |
| Goût du feu | 📜 | oui | Goût du feu : au choix du lanceur, une marmite de nourriture devient extrêmement épicée (Test de Résistance Facile (+40) pour la manger sans problèmes de digestion), une cruche d'1 litre de liquide devient un alcool fort au goût d'origine résiduel, ou une flasque d'1 demi-litre devient une huile hautement inflammable de lanterne — transformation d'un objet en un AUTRE objet non modélisée, arbitrage MJ. |
| Grands feux d'U'Zhul | 🟡 | oui | Grands feux d’U’Zhul : la ZdE autour de la cible subit aussi +5 Dégâts immédiats (ignore PA) + Test d’Esquive ou En flammes — arbitrage MJ. |
| L'Égide d'Aqshy | 📜 | oui | Égide d’Aqshy : immunisé aux Dégâts de feu non magiques, ignore l’État En flammes, Protection (9+) contre le feu magique (arbitrage MJ). |
| L'Épée ardente de Rhuin | 🟡 | oui | Épée ardente de Rhuin : un porteur SANS Magie des Arcanes (Feu) qui obtient une Maladresse avec l’Épée subit ses flammes — arbitrage MJ. |
| La Forge de Tarnus | 🟡 | oui | La Forge de Tarnus : le bonus vaut pour QUICONQUE travaille à la forge imprégnée, y compris pour créer des Objets magiques — forge du décor non modélisée, le bonus est ici porté par le lanceur, arbitrage MJ. |
| Mur de feu | ✅ | oui |  |
| Purification | 🟡 | oui | Purification : consume les Influences corruptrices de la zone (malepierre, objets du Chaos) — arbitrage MJ. |
| Sang bouillant | 🟡 | oui | Sang bouillant : une cible TUÉE par ce Sort explose en un jet de sang brûlant qui inflige un Projectile magique de Dégât +1 à quiconque se trouve dans un rayon de 2 mètres — arbitrage MJ. |
| Tempête de flammes | 🟡 | oui | Tempête de flammes : la colonne fait 2 mètres de diamètre et 2 mètres de hauteur, +1 mètre de diamètre et +2 mètres de hauteur par +2 DR ; les cibles frappées sont projetées hors de la zone ; seules celles immunisées aux feux magiques peuvent y entrer ; le Sort perdure jusqu'à dissipation ou au prochain lever du soleil — projection hors zone et interdiction d'entrée non modélisées, arbitrage MJ. |
| Tempête de magma | 🟡 | oui | Tempête de magma : le vortex suit les règles de Vortex aléatoires et, par +2 DR, engendre après un déplacement de 8 mètres ou moins +1 vortex plus petit par Round (3 au maximum, Zone d'Effet égale à votre Bonus de Force Mentale en mètres) qui se déplace aléatoirement, inflige +1 État En flammes et un Projectile magique de Dégâts +4 sur son chemin, puis disparaît après un déplacement — vortex mobiles non modélisés, arbitrage MJ. |
| Tête enflammée | 🟡 | oui | Tête enflammée : la boule vole en ligne droite et frappe toutes les cibles sur son chemin jusqu'à la limite de la Portée ; une Esquive Intermédiaire (+0) réussie ramène les Dégâts du Projectile magique à +0 mais la tête embrase quand même qui elle touche ; les cibles ayant perdu au moins 1 Blessure vous considèrent porteur du Trait Peur 1 — trajectoire traversante et Peur conditionnelle non modélisées, arbitrage MJ. |

## Magie des Arcanes — Gueule (7)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Bouf 'crâne | 🟡 | oui | Bouf’crâne : ceux qui connaissaient l’ancien propriétaire de la tête dévorée résistent à cette Peur avec −20 au Calme — arbitrage MJ. |
| Broyeur d'os | 🟡 | oui | Broyeur d’os : sur une Blessure Critique infligée, +20 au lancer sur le Tableau des Blessures Critiques — arbitrage MJ. |
| Festin des Damnés | 🟡 | oui | Festin des Damnés : seules les créatures de votre choix dans la ZdE sont affectées (résistance : Test de Résistance Difficile) ; à la fin du Sort, un non-ogre ayant blessé un ennemi teste Calme (+0) ou gagne Sonné — arbitrage MJ. |
| Goinfre costaud | 🟡 | oui | Goinfre costaud : à la fin du Sort, la cible doit se gaver d’un repas conséquent ou gagner un État Exténué (résistance initiale : Test de Calme Complexe) — arbitrage MJ. |
| Goûtemort | 📜 | oui | Goûtemort : en consommant une partie d’un cadavre, vous apprenez de façon générale comment la créature est morte (poison, lame, magie, mort naturelle…) — arbitrage MJ. |
| La Gueule | 🟡 | oui | La Gueule : un gouffre denté s’ouvre dans la ZdE. Test d’Esquive (+0) — réussite : +8 Dégâts (−1/DR) en se dégageant ; échec : chute dans la Gueule (+10 Dégâts + 3 Empêtré opposés à Force 60, +10 Dégâts/round, Critique si encore dedans à la fin) — arbitrage MJ. |
| Trollboyaux | 🟡 | oui | Trollboyaux : un non-ogre qui récupère des Blessures sous ce Sort teste Résistance (+20) ou voit sa chair verdir comme une peau de troll (cosmétique, pas une mutation) — arbitrage MJ. |

## Magie des Arcanes — Lumière (24)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Assaut de pierre | 🟡 | oui | Assaut de pierre : le sol se soulève en une colline d'environ 20 mètres de diamètre et 5 mètres de haut, qui reste en l'état — relief de terrain non modélisé, arbitrage MJ. |
| Bannissement | 🟡 | oui | Bannissement : seules les cibles d’Endurance < votre FM sont affectées ; une cible Mort-vivant/Démoniaque qui possédait DÉJÀ Instable est réduite à 0 PB — arbitrage MJ. |
| Bibliothécaire instantané de Meissner | 🟡 | oui | Bibliothécaire instantané de Meissner : le bonus au Test étendu de Recherche est de (1 + DR) DR ; l'ouvrage localisé s'illumine (Bonus de Force Mentale + DR) rounds — arbitrage MJ. |
| Clarté d'esprit | 🟡 | oui | Clarté d’esprit : les modificateurs négatifs issus de mutations mentales sont aussi ignorés — arbitrage MJ. |
| Collet d'Abulla | 🟡 | oui | Collet d'Abulla : chaque +1 DR fait léviter la cible de 2 mètres de plus, jusqu'à 10 mètres — altitude non modélisée, arbitrage MJ. Collet d'Abulla : le collet soulève la cible à 2 mètres du sol, l'attire au round suivant à 5 mètres au-dessus de vous et la fait se déplacer avec vous ; elle subit des Dégâts de chute quand elle est relâchée (LDB p.166) — arbitrage MJ. |
| Compréhension parfaite | 📜 | oui | Compréhension parfaite : vous comprenez toute langue parlée, écrite ou transmise, ainsi que les messages codés et les échanges peu clairs, sans pouvoir vous exprimer dans les langues que vous ne connaissez pas — compréhension de langue non modélisée, arbitrage MJ. |
| Crevasse | 🟡 | oui | Crevasse : un Échec Minime permet à la cible de s'accrocher au bord ; chevaux et véhicules y tombent automatiquement et les structures touchées peuvent s'effondrer en partie — arbitrage MJ. Crevasse : la cible évite la crevasse de 3 mètres de large, de long et de profondeur, allongée et approfondie d'1 mètre par +2 DR jusqu'à 10 mètres. |
| Distorsion temporelle | 🟡 | oui | Distorsion temporelle : les cibles retenues reçoivent une Action supplémentaire (sans Mouvement supplémentaire), résolue par ordre d'Initiative en ignorant ennemis et neutres, puis l'initiative reprend au personnage qui vous suit — Action supplémentaire non modélisée. |
| Édifice érigé | 🟡 | oui | Édifice érigé : le mur fait 1 mètre de haut et 15 centimètres d'épaisseur et vaut couverture totale (LDB p.161) ; chaque +2 DR permet aussi 1 mètre de hauteur (et 15 centimètres d'épaisseur) de plus, une ouverture par section de 2 mètres, ou une forme courbe ou inclinée ; lancé plusieurs fois il bâtit un squelette de bâtiment qui s'effondre en (Bonus de Force Mentale + DR) jours sans Savoir (Ingénierie) ni Métier (Maçonnerie) — arbitrage MJ. |
| Édifice illuminé | 🟡 | oui | Édifice illuminé : l'emprise éclairée vaut l'intérieur d'une maison (une tour ou un grand manoir à +2 DR, un château à +4 DR) — le rayon est l'arbitrage éditable de cette emprise. Démons et morts-vivants doivent réussir un Test de Force Mentale Intermédiaire (+0) pour entrer et subissent alors un nombre de Dégâts égal au total de vos DR d'Incantation, ignorant Bonus d'Endurance et Points d'Armure ; les créatures sans Force Mentale ne peuvent pas entrer — arbitrage MJ. |
| Fauche-démon | 🟡 | oui | Fauche-démon : les témoins (hors Magie des Arcanes (Lumière)) reçoivent +DR Aveuglé — arbitrage MJ. |
| Filet d'Amyntok | 🟡 | oui | Filet d’Amyntok : ce Sonné ne peut pas être retiré tant que le Sort dure et se récupère sur un Test d’Intelligence ; les créatures Bestial y sont immunisées — arbitrage MJ. |
| Halo purificateur | 🟡 | oui | Halo purificateur : le Talent Résistance (Maladie) profite à quiconque se tient dans la zone éclairée par la source empreinte ; les sorciers y reçoivent, pour dissiper les sorts de Magie noire et du Chaos, un bonus égal au total de vos DR d'Incantation ; la source de lumière (LDB p.308-309) fixe la Portée et la Durée, dans la limite d'1 kilomètre et d'une journée — arbitrage MJ. |
| Intention inspirée | 🟡 | oui | Intention inspirée : les +2 DR valent pour RÉSISTER au Charme et à l'Intimidation ; lancé sur vous-même, vous pouvez choisir +2 DR à vos propres Tests de Charme, sous réserve de ne dire que la vérité — arbitrage MJ du sens du Test. |
| Lever le voile | 🟡 | oui | Lever le voile : voir à travers ténèbres, brume, fumée et brouillard comme en pleine lumière est arbitré par le Talent Vision nocturne, la mécanique codifiée la plus proche ; voir l'invisible, les illusions et l'obscurité magique exige un Test opposé de Force Mentale contre le lanceur — arbitrage MJ. |
| Lueur éblouissante | ✅ | oui |  |
| Lumière aveuglante | 🟡 | oui | Lumière aveuglante : touche quiconque regarde dans votre direction (hors Magie des Arcanes (Lumière)) — arbitrage MJ du ciblage. |
| Lumière de guérison | 🟡 | oui | Lumière de guérison : le retrait de Corruption ne vaut que pour 1 Point gagné dans l’heure précédente — arbitrage MJ. |
| Mains de Karkora | 🟡 | oui | Mains de Karkora : les cibles attrapées sont Empoignées (LDB p.163) par les mains, dont la Force égale votre Force Mentale — Empoignade non modélisée, arbitrage MJ. Mains de Karkora : la cible évite les mains pâles surgies du sol. |
| Manteau miroitant | 📜 | oui | Manteau miroitant : les attaques au corps à corps et les projectiles perdent leur indice de Dégâts et n'infligent que leur DR en Blessures ; tous les autres types de dégâts (feu, chute…) sont entièrement annulés ; les attaques magiques ne sont pas impactées et vous ne pouvez pas vous cacher — perte de l'indice de Dégâts non modélisée, arbitrage MJ. |
| Orbe de Hysh | 📜 | oui | Orbe de Hysh : vous maniez par télékinésie un objet d'Encombrement au maximum égal à votre (Bonus de Force Mentale + DR), à une vitesse égale à votre Bonus de Force Mentale ; si l'objet a une Influence malveillante (LDB p.236), l'orbe l'emprisonne et les Tests de Corruption dus à son exposition deviennent Accessible (+20) — télékinésie non modélisée, arbitrage MJ. |
| Pensée rapide | ✅ | oui |  |
| Protection de Phâ | ✅ | oui |  |
| Yeux de Volans | 🟡 | oui | Yeux de Volans : le malus de −2 DR ne vaut que pour les Tests de Perception basés sur la vue ; employé avec le Talent Seconde vue pour voir les vents, le sort donne au contraire un bonus de +20. Vous voyez la corruption et reconnaissez les mutations chez les humains et les autres races civilisées — pas chez les animaux ni les plantes, et une mutation cachée sous des vêtements peut passer inaperçue ; d'un regard vous connaissez les Points de Corruption d'une cible ou son Trait Corruption — arbitrage MJ. |

## Magie des Arcanes — Magie du marais de Mòna (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Bourbier d'abattement | 🟡 | oui | Bourbier d'abattement : le Sort s'achève une fois que tous les États Empêtré ont été retirés, et le Test de Calme (+20) sous peine d'un État Exténué se répète à CHAQUE Round durant lequel la cible reste empêtrée — répétition d'un Test par Round non modélisée, arbitrage MJ. |
| Brume mystique | 🟡 | oui | Brume mystique : mêmes effets que Miasme mystifiant — les porteurs du Talent Magie des Arcanes (Ombre) y échappent, se déplacer dans la brume exige un Test de Perception (+0) sous peine d'À Terre, et à la dissipation un Test d'Initiative (+40) sous peine de Sonné — arbitrage MJ. |
| De la boue jusqu'au bout ! | 🟡 | oui | De la boue jusqu'au bout ! : pour lancer ce Sort vous devez vous trouver au bord d'un marais, un pied dans l'eau, l'autre sur la terre ferme ; le marais déborde alors de ses frontières sur une distance égale à la Zone d'Effet — condition de lancement et extension durable d'un terrain non modélisées, arbitrage MJ. |
| Empreint de bruine | 🟡 | oui | Empreint de bruine : les fimirs trouvent cette atmosphère relaxante ; tant que le crachin persiste, les Tests effectués pour tirer avec des armes à poudre, lancer des Sorts du Domaine du Feu ou entrer en Frénésie subissent un malus de −2 DR — malus de DR qualifié par type d'arme, par Domaine de Sort et par entrée en Frénésie non modélisé, arbitrage MJ. |
| Piqûres de moustiques | 🟡 | oui | Piqûres de moustiques : la nuée ne s'en prend qu'aux créatures à sang chaud, ses +2 Dégâts de fin de Round comptent comme un Projectile magique, et le Test de Résistance (+20) sous peine d'un État Aveuglé et d'un État Exténué vaut tant qu'elles demeurent dans la Zone d'Effet — filtre « à sang chaud » et répétition d'un Test par Round non modélisés, arbitrage MJ. |
| Tourner en rond | 🟡 | oui | Tourner en rond : le Sort ne fonctionne que si la cible n'a pas conscience qu'il a été lancé, et le malus de −3 DR ne vaut que sur les Tests d'Orientation effectués tant qu'elle se trouve dans l'enceinte d'un marais — ignorance de la cible et restriction au marais non modélisées, arbitrage MJ. |

## Magie des Arcanes — Magie naturelle (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Bonne Volonté | 🟡 | oui | Bonne Volonté : dans la ZdE (BSoc m), tous les Tests de Sociabilité gagnent +10 et les Traits Psychologiques Animosité et Haine sont neutralisés — arbitrage MJ. |
| Charme protecteur | 📜 | oui | Charme protecteur : la breloque imprégnée confère le Talent Résistance à la magie à qui la porte, pour la durée (jours) — arbitrage MJ. |
| Chevaucher l'Obscurité | 📜 | oui | Chevaucher l’Obscurité : votre esprit quitte votre corps (qui reste immobile et insensible) et explore les environs en témoin invisible, traversant les obstacles non magiques — arbitrage MJ. |
| Nepenthès | 📜 | oui | Nepenthès : un philtre qui, bu tant que le Sort est actif, permet à la cible d’oublier définitivement un individu de son choix — arbitrage MJ. |
| Panacée | 📜 | oui | Panacée : la décoction enchantée, bue tant que le Sort dure, guérit BFM Blessures et 1 maladie (+1 maladie par +2 DR) — arbitrage MJ (effet à l’ingestion). |
| Séparer les branches | 📜 | oui | Séparer les branches : vous voyez dans le Monde des Esprits (créatures invisibles, esprits, démons, êtres normalement impossibles à repérer) — arbitrage MJ. |

## Magie des Arcanes — Métal (24)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Arme enchantée | 🟡 | oui | Arme enchantée : par tranche de +3 DR, ajoutez +1 Atout ou retirez 1 Défaut de l’arme tant que le Sort dure — arbitrage MJ. |
| Armure de fer blanc | 🟡 | oui | Armure de fer blanc : seuls les porteurs d'une armure MÉTALLIQUE sont touchés — arbitrage MJ. |
| Bouclier en acier doré | 🟡 | oui | Bouclier en acier doré : la surface couverte gagne +4 d'Armure et devient insensible aux phénomènes naturels ; s'abriter derrière elle confère +1 DR aux Tests de Dissipation contre les Sorts qui vous ciblent ; le Sort n'a aucun effet sur les tissus organiques — arbitrage MJ. |
| Boussole d'argent de Puchta | 📜 | oui | Boussole d'argent de Puchta : la boussole ciblée fonctionne comme une Boussole d'argent météorique pendant la Durée — arbitrage MJ. |
| Cage dorée | 🟡 | oui | Cage dorée : des barreaux dorés enferment la Zone d'Effet — on en sort par un Test de Force Difficile (−20) ou en les sciant, les Tailles Minuscule et Très Petite passent entre les barres, les armes et projectiles aussi — arbitrage MJ. |
| Contact doré | 🟡 | oui | Contact doré : la cible résiste à la pétrification. Contact doré : la cible se transforme en statue dorée — elle ne voit, n'entend ni ne sent rien, son Bonus d'Endurance est considéré comme 10, la Durée est déterminée secrètement par le MJ, et le Sort prend fin dès qu'elle subit des Blessures. |
| Creuset de Chamon | 🟡 | oui | Creuset de Chamon : un objet métallique non magique fond (lâché s’il est tenu, conserve sa valeur de matière première) ; la frappe ne touche que si l’objet est PORTÉ — arbitrage MJ. |
| Défaut | 🟡 | oui | Défaut : l'arme ciblée doit être au moins partiellement en métal ; ses Défauts empirent (Dangereuse sur 9, 8 ou double ; Recharge doublée ; Lente à +2 DR pour les défenseurs) ; les armes magiques ne sont pas modifiées, mais à +4 DR leurs enchantements sont temporairement annulés — arbitrage MJ. |
| Dénouer les nœuds | 🟡 | oui | Dénouer les nœuds : le MJ vous donne un indice menant à la solution, et un indice de plus par +2 DR — arbitrage MJ. |
| Dévoiler l'inconnu | 🟡 | oui | Dévoiler l'inconnu : vous apprenez les propriétés physiques de la cible (santé et Attribut physique le plus élevé d'une créature), plus un détail caché par +2 DR — arbitrage MJ. |
| Écaille d'acier | 🟡 | oui | Écaille d’acier : chaque frappe évitée améliore la Protection de 1 (jusqu’à 3+) — arbitrage MJ. |
| Forge de Chamon | 📜 | oui | Forge de Chamon : sur un objet métallique, ajoutez 1 Atout ou retirez 1 Défaut (+1 par +2 DR) — arbitrage MJ. |
| Globe doré de Gehenna | 🟡 | oui | Contact doré : la cible résiste à la pétrification. Contact doré : la cible se transforme en statue dorée — elle ne voit, n'entend ni ne sent rien, son Bonus d'Endurance est considéré comme 10, la Durée est déterminée secrètement par le MJ, et le Sort prend fin dès qu'elle subit des Blessures. Globe doré de Gehenna : la sphère se déplace selon les règles des Vortex aléatoires — arbitrage MJ. |
| Inscription | 🟡 | oui | Inscription : le Point d'Armure détruit est épargné si l'acide est enlevé au bout de 10 rounds — arbitrage MJ. Inscription : vous gravez une douzaine de mots par round sur une surface en métal ; à +2 DR l'inscription devient une rune secrète, invisible sauf à un sorcier Doré qui relance ce Sort dessus — arbitrage MJ. |
| L'Or des fous | 📜 | oui | L’Or des fous : tout le métal d’un objet non magique devient de l’or pour la durée (peut alourdir une armure, ruiner une arme…) — arbitrage MJ. |
| Malédiction de la rouille | 📜 | oui | Malédiction de la rouille : l'objet métallique non magique ciblé (Encombrement 1, +1 par +2 DR) tombe en rouille et devient définitivement inutilisable ; à +4 DR, un objet non métallique devient fragile comme du verre pendant (Bonus de Force Mentale) minutes — arbitrage MJ. |
| Métal changeant | 📜 | oui | Métal changeant : un objet métallique non magique devient malléable (Test de Force ou de Métier pour le façonner) — arbitrage MJ. |
| Méthode essai-erreur | 🟡 | oui | Méthode essai-erreur : la Compétence choisie au moment de l'incantation reçoit +2 DR la prochaine fois que la cible s'en sert — arbitrage MJ. |
| Plume de plomb | 🟡 | oui | Plume de plomb : dans la ZdE, choisissez — les biens sont alourdis de +2 paliers de Surcharge, ou n’imposent plus de Surcharge — arbitrage MJ. |
| Protections de fer météorique | 🟡 | oui | Protections de fer météorique : l'armure magique est très légère et s'ajoute à celle portée en temps normal. |
| Réfraction prismatique de Habermas | 🟡 | oui | Réfraction prismatique de Habermas : tous les Tests de Focalisation et d'Incantation dans la Zone d'Effet subissent −1 DR ; à la fin du Sort, une couleur de magie au choix devient un fluide aethyrique qui ajoute +1 DR à un seul Test d'Incantation du Domaine lié, et s'évapore au bout de 2 rounds s'il n'est pas utilisé — arbitrage MJ. |
| Réparer du métal | 📜 | oui | Réparer du métal : l'objet en métal abîmé est restauré dans son état d'origine (trois quarts de l'objet requis) ; autrement, le Sort fritte deux objets en métal — aide aux Tests de Métier (Forgeron), ou fusion des pièces d'armure d'un ennemi qui gagnent les Défauts Peu fiable et Volumineux — arbitrage MJ. |
| Reproduction de Levorg | 📜 | oui | Reproduction de Levorg : vous invoquez un objet non magique et inanimé d'Encombrement 4 au maximum (+1 par +2 DR), qui disparaît à la fin du Sort ; au lieu d'un objet, 1d10 Couronnes (+1d10 par +2 DR), formule interdite par le Collège Doré — arbitrage MJ. |
| Transmutation de Chamon | 🟡 | oui | Si les cibles meurent pendant que le Sort est actif, elles sont enfermées de façon permanente dans une carapace de métaux communs, un macabre rappel des risques de la sorcellerie. |

## Magie des Arcanes — Mort (24)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Amarante | 🟡 | oui | Amarante : le résultat obtenu sur l'un des Tableaux de Critique est diminué de 10 lorsque vous subissez un Coup Critique, et un Talent Résistance déjà possédé gagne +1 niveau par +2 DR — modificateur au jet de Tableau de Critique et niveau de Talent échelonné non modélisés, arbitrage MJ. |
| Âme emprisonnée | 📜 | oui | Âme emprisonnée : l'âme de la cible est enfermée dans un réceptacle et son corps reste léthargique (il doit être nourri et hydraté) jusqu'à ce que le réceptacle soit ouvert à côté de lui par un sorcier d'Améthyste ou un prêtre de Morr ; à son réveil, la cible subit une Exposition Modérée à la Corruption. Réceptacle mal ouvert ou éloigné du corps : la cible meurt et son âme devient un fantôme. Le réceptacle sert de composant à Télépathie (portée infinie) et se brise sur une Incantation Imparfaite — emprisonnement d'âme et réveil différé non modélisés, arbitrage MJ. |
| Aperçu de la mort | 🟡 | oui | Aperçu de la mort : les ennemis vivants situés à (Bonus d'Initiative) mètres de la cible principale doivent réussir un Test de Calme Accessible (+20) ou recevoir un État Sonné, et ceux qui échouent enchaînent le Test de Calme Facile (+40) ci-dessus — Zone d'Effet centrée sur la cible principale non modélisée, arbitrage MJ. |
| Caresse de Laniph | ✅ | oui |  |
| Cendre et poussière | 🟡 | oui | Cendre et poussière : le Soleil violet de Xereus, sphère d'obscurité d'1 mètre de diamètre, apparaît au centre du nuage, provoque la Peur (2) et consume automatiquement les obstacles comme les murs et les portes — sphère mobile et destruction d'obstacles non modélisées, arbitrage MJ. Cendre et poussière : le nuage suit les règles de Vortex aléatoire et n'affecte les cibles que tant qu'elles restent dans la Zone d'Effet — dérive du vortex non modélisée, arbitrage MJ. |
| Contraindre les esprits | 🟡 | oui | Contraindre les esprits : l'esprit vous obéit jusqu'au prochain lever du soleil — vous pouvez lui ordonner de fuir ou de combattre, et seul le Sort Libération de la mort peut le délivrer ; commandement d'une créature non modélisé, arbitrage MJ. Contraindre les esprits : les fantômes arrachés au voile de la mort ne sont pas sous vos ordres, sauf si vous lancez à nouveau ce Sort ; l'invocation d'esprits est interdite par le Collège d'Améthyste. |
| Dernières paroles | 📜 | oui | Dernières paroles : vous parlez à l’âme d’un mort récent (la journée précédente) ; elle ne peut que parler et ne ment pas — arbitrage MJ. |
| Destin de Bjuna | 🟡 | oui | Destin de Bjuna : ces Dégâts valent 6 + le Bonus de Force de la CIBLE (seule la part fixe est appliquée — une quantité référant la cible et non le lanceur n'est pas exprimable), et ont 50 % de chance d'être appliqués à la tête, 50 % ailleurs sur le corps ; le Test se répète à chaque Round de la Durée, arbitrage MJ. Destin de Bjuna : l'énergie de Shyish pénètre dans la bouche d'une cible de la ZdE par tranche de +2 DR, qui étouffe pendant la Durée du Sort — sélection d'un nombre de cibles échelonné par DR non modélisée, arbitrage MJ. |
| Embrasser son destin | 📜 | oui | Embrasser son destin : pendant la Durée, les cibles alliées sont immunisées contre la Peur, la Terreur est considérée comme de la Peur, et tous les effets Psychologiques provoqués par du chagrin sont retirés de façon permanente — immunité psychologique restreinte à un TYPE et rétrogradation Terreur→Peur non modélisées, arbitrage MJ. Embrasser son destin : lancé sur des ennemis proches, les cibles qui échouent à un Test de Calme Intermédiaire (+0) ne peuvent pas fuir le combat pendant la Durée du Sort — interdiction de fuite non modélisée, arbitrage MJ. |
| Étreinte d'Iyrtu | 📜 | oui | Étreinte d'Iyrtu : votre Force augmente de +10 pour chaque +1 DR obtenu, et vous réussissez automatiquement les attaques pour Empoigner (un échec compte comme +0 DR) — modificateur de Caractéristique échelonné par DR et réussite automatique d'Empoignade non modélisés, arbitrage MJ. |
| La Faux de Shyish | 🟡 | oui | La Faux de Shyish : les ennemis Mort-vivant ne reçoivent pas d’Avantage quand ils sont Engagés avec vous — arbitrage MJ. |
| Le Labyrinthe de Cristal | 🟡 | oui | Le Labyrinthe de Cristal : tant qu'elles y sont piégées, les cibles disparaissent et ne peuvent en aucun cas être blessées ni affectées, et relancent le d10 à la fin de chaque tour — retrait temporaire du plan matériel non modélisé, arbitrage MJ. |
| Le Voile violet de Shyish | ✅ | oui |  |
| Libération de la mort | 🟡 | oui | Libération de la mort : le Test se répète à chaque Round de la Durée du Sort, arbitrage MJ. |
| Membre flétri | 📜 | oui | Membre flétri : le membre choisi de la cible s'engourdit et devient inutilisable pendant (Bonus de Force Mentale) minutes, considéré comme amputé — amputation d'un membre par un effet (hors Blessure Critique) non modélisée, arbitrage MJ. Membre flétri : lancé sur une sépulture, il frappe la première personne qui la pille de la « malédiction du pilleur de tombe » — membre déterminé au hasard, malédiction de (Bonus de Force Mentale) jours ; piège de sépulture non modélisé, arbitrage MJ. |
| Mort rapide | 📜 | oui | Mort rapide : une cible à 0 Blessure et ≥ 2 Blessures Critiques meurt au contact (et ne peut être ranimée en mort-vivant) — arbitrage MJ. |
| Parent sauvage de Zandox | 📜 | oui | Parent sauvage de Zandox : deux chiens de chasse d'ombres violettes, de Capacité de Combat 50 et de Trait Arme (Morsure) +8, attaquent lors de votre Round les ennemis situés dans un rayon de 4 mètres ; on ne les voit qu'en réussissant un Test de Perception Difficile (−20), et ils ne peuvent être ni attaqués ni gagner d'Avantage — invocation d'un statbloc AD HOC (donné par le Sort, absent du bestiaire) non modélisée, arbitrage MJ. |
| Poids des années | 🟡 | oui | Poids des années : un objet non magique d'Encombrement 2 (+1 par +2 DR) vieillit instantanément et s'effrite en poussière ; un objet portant l'Atout Solide ne s'effrite pas mais perd tous ses Atouts — destruction d'objet non modélisée, arbitrage MJ. Poids des années : les créatures végétales sont elles aussi immunisées à ce vieillissement — aucun Groupe de créatures végétales en donnée, arbitrage MJ. |
| Sanctifier | 🟡 | oui | Sanctifier : un cercle de Shyish (diamètre BFM m) qu’aucun Mort-vivant ne peut franchir, pour la durée — arbitrage MJ. |
| Shyish à découvert | 📜 | oui | Shyish à découvert : vous percevez toutes les créatures mortes dans la Zone d'Effet au cours du dernier mois (+1 mois par +1 DR) — nombre, race et date de leur mort, ni nom ni cause ; en nommant un mort de la zone, vous lui posez une question par +2 DR supplémentaire, à laquelle il répond par des coups — divination non modélisée, arbitrage MJ. |
| Télépathie | 📜 | oui | Télépathie : vous envoyez un message télépathique à un autre sorcier d'Améthyste par le plan des esprits (Âme emprisonnée annule toute limite de portée) ; tout autre destinataire doit réussir un Test d'Intuition Intermédiaire (+0) pour le comprendre — communication télépathique non modélisée, arbitrage MJ. Télépathie : au lieu de cela, vous lisez les pensées superficielles d'un autre sorcier d'Améthyste, qui peut s'en rendre compte par un Test d'Intelligence Intermédiaire (+0) puis contrer l'intrusion par un Test opposé de Force Mentale — lecture de pensées non modélisée, arbitrage MJ. |
| Vitesse de Lykos | 📜 | oui | Vitesse de Lykos : la cible peut se déplacer de 100 mètres lors de son prochain tour tout en effectuant une Action, les obstacles et le terrain la gênant comme d'habitude ; tuée sous cet effet, elle effectue immédiatement une action supplémentaire avant de mourir — distance de déplacement à valeur ABSOLUE et action posthume non modélisées, arbitrage MJ. |
| Vol de vie | ✅ | oui |  |
| Vortex d'âmes | 🟡 | oui | Vortex d’âmes : les +10 Dégâts (ignorant BE et PA) ne devraient toucher QUE les cibles Mort-vivant ; contre les vivants, seul le Brisé s’applique — arbitrage MJ. |

## Magie des Arcanes — Nécromancie (4)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Crâne hurlant | 🟡 | oui | Crâne hurlant : n’affecte que les cibles SANS le Trait Mort-vivant ; le Test de Calme se répète pour chaque Blessure infligée — arbitrage MJ. |
| L'appel de Vanhel | 📜 | oui | L’appel de Vanhel : (BInt) morts-vivants gagnent une Action ou un Mouvement gratuit (le même pour tous), +(BInt) cibles par +2 DR — arbitrage MJ. |
| Réanimation | 🟡 | oui | Réanimation : les réanimés (zombies, ou squelettes au choix) entrent avec l’État À Terre et tiennent jusqu’au lever du soleil ; +(BFM + DR) corps supplémentaires par +2 DR — arbitrage MJ. |
| Relever les morts | 🟡 | oui | Relever les morts : les squelettes entrent avec l’État À Terre et tiennent jusqu’au lever du soleil ; +(DR) squelettes supplémentaires par +2 DR — arbitrage MJ. |

## Magie des Arcanes — Ombres (24)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Ailes grises | 🟡 | oui | Ailes grises : la cible réticente évite la téléportation. Ailes grises : la cible peut passer au travers d'objets solides et la destination n'a pas besoin d'être dans votre Ligne de Vue — traversée des solides et destination hors Ligne de Vue non modélisées, arbitrage MJ. |
| Bosquet d'Ombre | 🟡 | oui | Bosquet d'Ombre : toutes les ombres de la Zone d'Effet deviennent visibles, y compris celles des créatures invisibles et des manifestations aethyriques (les possédés en projettent plusieurs) ; les attaques contre les opposants ainsi découverts ont une pénalité de −10, et le Sort ne fonctionne pas dans le noir total — invisibilité et pénalité contre une cible découverte non modélisées, arbitrage MJ. |
| Charme changeant | 🟡 | oui | Charme changeant : la cible semble morte, même à un examen minutieux ; ses sens continuent de fonctionner, mais elle ne peut ni bouger ni parler — arbitrage MJ. Charme changeant : la cible devient méconnaissable pour ceux qui la connaissaient ; si elle souhaite qu'on la reconnaisse, les personnages ciblés peuvent lancer des Tests de Force Mentale — arbitrage MJ. |
| Chut ! | 📜 | oui | Chut ! : une aura d'Ulgu étouffe les sons et suit la cible, sous l'une des trois formes choisies à l'incantation — aucun son ne sort de la Zone d'Effet, aucun son n'y entre, ou aucun son n'y est produit ; le Sort ne peut pas être lancé sur une cible qui ne le souhaite pas, mais un objet ciblé peut être récupéré après coup — propagation du son non modélisée, arbitrage MJ. |
| Corne d'Andar | 🟡 | oui | Corne d'Andar : les ennemis à portée doivent également réussir immédiatement un Test de Peur (1), et les cibles neutres ne sont pas affectées — Test de Peur immédiat sans source de Peur persistante non modélisé, arbitrage MJ. |
| Danse du désespoir | 🟡 | oui | Danse du désespoir : la cible peut agir malgré tout en réussissant d'abord un Test d'Athlétisme Difficile (−20) ou de Représentation (Danse) Intermédiaire (+0) — arbitrage MJ. Danse du désespoir : la cible résiste à la danse. |
| Désorientation | 🟡 | oui | Désorientation : la cible garde ses esprits. |
| Destrier d'Ombre | 🟡 | oui | Destrier d’Ombre : chevauchez-le (règles de monture) ; la nuit, il gagne aussi Éthéré/Infravision/Insensible à la douleur/Furtif/Foulée/Protection 9+ — arbitrage MJ. |
| Horreurs noires | 🟡 | oui | Horreurs noires : une ombre fantomatique hante la Zone d'Effet et provoque la Peur (1) sans attaquer — +1 d'indice par +2 DR, jusqu'à 4 — puis la zone devient magique et reste dans l'obscurité même éclairée — ombre hantant une zone non modélisée, arbitrage MJ. |
| Illusion | 🟡 | oui | Illusion : masque la ZdE d’une image illusoire ; seul le Talent Seconde vue (Test de Perception Complexe) permet de la remarquer — arbitrage MJ. |
| Illusion grandiose | 🟡 | oui | Illusion grandiose : l'illusion couvre tous les sens (toucher, ouïe, odorat, goût, vue) et paraît réelle à qui y croit — un pont illusoire se franchit vraiment tant qu'on n'a pas compris — illusions sensorielles non modélisées, arbitrage MJ. |
| Illusion rétroactive de Ribauld | 📜 | oui | Illusion rétroactive de Ribauld : un élément de l'environnement (au plus la taille d'une maison, jamais de la terre ferme) est téléporté jusqu'à (Force Mentale) mètres avec les personnages qui s'y trouvent, à condition de ne pas être un point de repère connu et d'atterrir dans un lieu rationnel — déplacement d'un élément de décor non modélisé, arbitrage MJ. |
| Jumeau maléfique | 📜 | oui | Jumeau maléfique : vous prenez l’apparence d’un humanoïde familier (seul Seconde vue peut le percer) — arbitrage MJ. |
| Linceul d'Invisibilité | 📜 | oui | Linceul d’Invisibilité : la cible devient invisible aux sens ordinaires (Seconde vue la situe vaguement) ; le Sort cesse si elle fait du bruit ou attaque — arbitrage MJ. |
| Miasme mystifiant | 🟡 | oui | Miasme mystifiant : se déplacer dans la brume exige un Test de Perception (+0) sous peine d’À Terre ; à la dissipation, Test d’Initiative (+40) ou Sonné — arbitrage MJ. |
| Ombre errante | 📜 | oui | Ombre errante : votre ombre se détache et se déplace à votre vitesse de Mouvement sur vos instructions (une Action pour la guider, sinon elle reste immobile) ; de là où elle est vous voyez, entendez et sentez, mais ne pouvez pas lancer de sorts ; elle est détruite hors de la lumière du soleil ou à plus de 44 mètres d'une source de lumière ; elle n'attaque pas mais provoque la Peur (1) — sens déportés non modélisés, arbitrage MJ. |
| Ombres étrangleuses | 🟡 | oui | Ombres étrangleuses : la cible ne peut pas parler (interactions vocales — arbitrage MJ). |
| Perte de mémoire | 📜 | oui | Perte de mémoire : la cible oublie tout de vous pour la durée ; au terme, un Test d’Intelligence (+20) raté rend l’oubli permanent — arbitrage MJ. |
| Poches profondes | 📜 | oui | Poches profondes : un objet d'Encombrement 0 ou 1 (+1 par +2 DR), récipient plein compris, passe en poche dimensionnelle — très léger, invisible, introuvable à la Perception, récupérable avec une Action, perdu s'il n'est pas retiré avant la fin du Sort — mise en réserve d'un objet non modélisée, arbitrage MJ. |
| Pont des ombres | 🟡 | oui | Pont des ombres : les cibles volontaires volent sur une bande d'ombre jusqu'à une destination dans votre Ligne de Vue, sans traverser les solides mais en survolant les obstacles jusqu'à (Force Mentale) mètres de haut, et arrivent lorsque le Sort prend fin — vol de groupe non modélisé, arbitrage MJ. |
| Portail d'Ombre | 🟡 | oui | Portail d’Ombre : les ennemis Engagés avec vous au départ ou à l’arrivée gagnent l’État Surpris — arbitrage MJ. |
| Puits de Tarnus | 🟡 | oui | Puits de Tarnus : un Échec Minime permet à la victime de s'accrocher au bord — arbitrage MJ. Puits de Tarnus : la cible évite le puits. |
| Substance de l'Ombre | 🟡 | oui | Substance de l'Ombre : la cible est invisible et partiellement intangible, ne peut être ni poussée ni touchée, doit rester entièrement dans l'ombre d'un objet occultant une source de lumière visible (jamais l'obscurité totale), peut attaquer et toucher le matériel sans pénalité, et le Sort prend fin si une partie d'elle sort de l'ombre ; il peut aussi être lancé sur des objets inanimés — invisibilité et condition d'ombre non modélisées, arbitrage MJ. |
| Traître de Tarn | 📜 | oui | Traître de Tarn : la cible vous considère comme un allié et ses anciens alliés deviennent des ennemis ; chaque fois qu'on lui demande d'attaquer un ancien allié elle peut tenter un Test de Calme Intermédiaire (+0) pour rompre l'enchantement, et elle refuse les consignes très dangereuses — retournement d'allégeance non modélisé, arbitrage MJ. Traître de Tarn : lancé sur une cible neutre, il vous donne +2 DR aux Tests basés sur la Sociabilité qui impliquent cette cible ; il n'a aucun effet sur une cible alliée — bonus de DR restreint à un interlocuteur non modélisé, arbitrage MJ. |

## Magie des Arcanes — Sorcellerie (7)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Dégradation | 📜 | oui | Dégradation : un puits devient saumâtre, un champ pourrit en une nuit, ou un animal domestique tombe malade et meurt en 10 − DR jours — arbitrage MJ. |
| Horreur obsédante | 📜 | oui | Horreur obsédante : quiconque entre dans le lieu hanté gagne 1 Exténué (hors Talent Sorcellerie) et, sans Test de Calme (+0), +1 Exténué et un Brisé tant qu’il y reste — arbitrage MJ. |
| Infecte Bénédiction | ✅ | oui |  |
| Malédiction de douleur paralysante | 📜 | oui | Malédiction de douleur paralysante : poignardez la poupée à une Localisation — Jambe/Bras inutilisable (comme amputé), Corps (Exténué + À Terre sur Résistance ratée), Tête (Sonné + Inconscient sur Résistance ratée). Changer de Localisation = votre Action — arbitrage MJ. |
| Malédiction de malchance | 🟡 | oui | Malédiction de malchance : la cible ne peut plus dépenser de Points de Chance tant que le Sort dure — arbitrage MJ. |
| Mauvais œil | 🟡 | oui | Mauvais œil : Test opposé d’Intimidation/Calme (+ votre DR d’Incantation) — la cible subit +1 Exténué par tranche de DR+2 d’écart, et un Brisé au-delà de DR+6 — arbitrage MJ. |
| Menace rampante | 🟡 | oui | Menace rampante : pour votre Action, un Test d’Emprise sur les animaux envoie une nuée sur une autre cible à portée — arbitrage MJ. |

## Magie des Arcanes — Vie (27)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Almanach | 📜 | oui | Almanach : après une journée d'harmonisation, vous prévoyez les principaux évènements saisonniers et météorologiques de l'année à venir sans en connaître les dates exactes (à la semaine près à +2 DR, au jour près à +4 DR) — prévision saisonnière et météorologique non modélisée, arbitrage MJ. |
| Apothéose verdoyante | 🟡 | oui | Apothéose verdoyante : les cibles tuées au cours de la dernière minute reviennent à la vie ; le Sort ne soigne ni Blessure critique ni membre perdu, et un corps décapité ne peut plus être sauvé — retour à la vie non modélisé, arbitrage MJ. |
| Bourbier vivant | 📜 | oui | Bourbier vivant : le navire subit –2 Mouvement et –3 DR de Manœuvre tant qu'il est pris ; l'équipage peut couper les algues (Test étendu de Navigation Intermédiaire (+0), cibles = BFM + DR du lanceur) — arbitrage MJ (caractéristiques de navire). |
| Cercueil de Jade | 📜 | oui | Cercueil de Jade : un cadavre mort depuis moins d'une heure se ranime au maximum de ses Points de Blessures, obéit à des ordres simples, conserve Compétences, Traits et Talents non magiques, ne parle pas et n'est pas Mort-vivant — réanimation d'un cadavre de la scène non modélisée, arbitrage MJ. |
| Chair de pierre | 🟡 | oui | Chair de pierre : la cible peut se déplacer et combattre mais ne peut pas parler ; une cible réticente résiste par un Test opposé de Force Mentale — opposition résolue par le MJ, le consentement de la cible n'étant pas modélisé. |
| Chant revigorant | 🟡 | oui | Chant revigorant : les créatures végétales endormies passent 1 Round à se réveiller, reçoivent +DR à TOUS leurs Tests pendant la Durée et ne sont pas sous votre contrôle — bonus de DR sur tous les Tests non modélisé, arbitrage MJ. |
| Chute de feuilles | 🟡 | oui | Chute de feuilles : les attaques de projectiles contre vous subissent −2 DR et vous réduisez de 3 les Dégâts de Chute comme ceux des armes contondantes ou écrasantes — malus de DR sur une attaque entrante et réduction de Dégâts par type d'attaque non modélisés, arbitrage MJ. |
| Configuration du terrain | 📜 | oui | Configuration du terrain : après 1 minute de communion, vous percevez une carte mentale des reliefs/forêts/rivières naturels à portée (les zones habitées restent floues) — arbitrage MJ. |
| Cri de guerre du Druide | 🟡 | oui | Cri de guerre du Druide : la Forêt de sang reste en place jusqu'à ce qu'elle soit coupée ou brûlée, et le Test d'Agilité ne concerne que qui la traverse de plus de la moitié de son Mouvement — persistance hors combat et seuil de Mouvement non modélisés, arbitrage MJ. |
| Croissance vitale | 📜 | oui | Croissance vitale : la plante ou l'arbre ciblé atteint sa hauteur naturelle maximale, doublée à +2 DR après 1 Round de concentration, triplée à +4 DR après 2 Rounds, quadruplée à +6 DR après 3 Rounds — croissance d'un élément végétal du décor non modélisée, arbitrage MJ. |
| Don de Vie | 📜 | oui | Don de Vie : une rivière/un puits asséché renaît, un champ fructifie immédiatement, ou un animal malade guérit complètement — arbitrage MJ. |
| Eau de la terre | 🟡 | oui | Eau de la terre : vous jaillissez du sol — les ennemis que vous Engagez à l’arrivée gagnent l’État Surpris ; vous ne traversez pas la pierre (mais l’eau, oui) — arbitrage MJ. |
| Écorce | ✅ | oui |  |
| Escalier en colimaçon | 🟡 | oui | Escalier en colimaçon : vous vous élevez de (Force Mentale) mètres (+(Force Mentale) par +2 DR, maximum 200 mètres), cette hauteur s'ajoutant à la distance parcourue par les attaques de projectiles ; les autres sorciers de Jade connaissant le Sort y montent sur un Test de Savoir (Magie) Intermédiaire (+0), la structure n'étant pas tangible pour quiconque d'autre — élévation et distance de tir non modélisées, arbitrage MJ. |
| Êtres du dessous | 🟡 | oui | Êtres du dessous : la cible se dégage des esprits et reste en surface ; une cible montée peut employer la Force de sa monture pour ce Test — choix de la Force employée non modélisé, arbitrage MJ. Êtres du dessous : la cible est emmenée sous terre et torturée dans un « espace entre les mondes » pendant 1d10 heures avant de ramper hors d'une butte, couverte de terre et de vers — disparition hors de la scène non modélisée, arbitrage MJ. |
| Forêt d'épines | ✅ | oui |  |
| Geyser | 🟡 | oui | Geyser : une mare d'eau de source fraîche se forme à l'emplacement du geyser — point d'eau de décor non modélisé, arbitrage MJ. |
| Graisse de la terre | 🟡 | oui | Graisse de la terre : la cible excrète d’un vert intense pour la durée — arbitrage MJ. |
| La Voie de Paranoth | 🟡 | oui | La Voie de Paranoth : qui possède déjà Bon marcheur (Régions boisées) gagne +1 niveau temporaire, plus 1 par +2 DR ; à +4 DR le groupe ne laisse aucune trace et devient impossible à suivre ; le Sort prend fin si le groupe traverse un autre chemin ou blesse un arbre vivant — niveaux temporaires de Talent et absence de traces non modélisés, arbitrage MJ. |
| Murmure de la nature | 📜 | oui | Murmure de la nature : vous interrogez télépathiquement les esprits mineurs de la rivière ou de l'arbre touché, qui rapportent ce qui s'est produit à 1 mille alentour (24 heures de mémoire pour une rivière, des années pour un arbre) — dialogue avec des esprits de lieu non modélisé, arbitrage MJ. |
| Que d'eau, que d'eau | 📜 | oui | Que d'eau, que d'eau : tous les tonneaux vides des réserves du navire se remplissent d'eau pure — arbitrage MJ (réserves d'eau du navire non modélisées). |
| Régénération | ✅ | oui |  |
| Sang de la Terre | 🟡 | oui | Sang de la Terre : seules les créatures en contact direct avec la terre (et vous, debout pieds nus) bénéficient du soin — arbitrage MJ. |
| Tourbillon | 📜 | oui | Tourbillon : un tourbillon (rotation lente, MDG p.113) se forme dans la ZdE ; Surincantation : 5 DR → Tourbillon, 8 → Puissant vortex, 13 → Maelstrom, 21+ → Maelstrom primordial — arbitrage MJ (périls nautiques non modélisés). |
| Transformation en arbre | 📜 | oui | Transformation en arbre : la cible consentante (ou vous-même) devient un chêne qui voit et entend normalement et n'est blessé que par les haches, le feu ou ce qui endommagerait un arbre ; une cible réticente y résiste sur un Test de Force Mentale Accessible (+20) — forme d'arbre non modélisée, arbitrage MJ. |
| Transmutation fantasmagorique de Colchis | 🟡 | oui | Transmutation fantasmagorique de Colchis : les Personnages et les surfaces de la Zone d'Effet sont ignifugés et ne subissent aucun Dégât de feu tant qu'ils y restent, les feux s'éteignant instantanément — immunité au feu attachée à un périmètre non modélisée, arbitrage MJ. |
| Trouver des lignes de force telluriques | 🟡 | oui | Trouver des lignes de force telluriques : vous obtenez une carte mentale des lignes de force et des cercles de pierres à portée, dont la force globale (importante ou secondaire) et le nombre de pierres gardiennes, sans discerner de couleur de magie ; le +2 DR ne vaut que pour l'Orientation employée à localiser une ligne de force — carte mentale non modélisée, arbitrage MJ. |

## Magie du Chaos (9)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Allure démoniaque | ✅ | oui |  |
| Aspect sublimé | 📜 | oui | Aspect sublimé : la Cible paraît sans défaut (cicatrices, difformités, Mutations cachées) ; un Test de Perception Difficile (−20), ou Intermédiaire pour Seconde vue, révèle qu’un Sort opère sans en dévoiler la teneur — arbitrage MJ. |
| Décharge de Corruption | ✅ | oui |  |
| Déchirer l'Aethyr | 🟡 | oui | Déchirer l’Aethyr : un démon mineur de plus traverse le portail à CHAQUE fin de Round (+1/round par +5 DR) ; les vivants voyant la faille testent Résistance (+0) ou gagnent +1 Corruption ; entrer dedans tue, sauf à dépenser un Point de Destin — arbitrage MJ. |
| Esclave des Ténèbres | 📜 | oui | Esclave des Ténèbres : Test opposé de Force Mentale (à gagner d’au moins +2 DR) — l’âme de la Cible est envoyée dans les Royaumes du Chaos et son corps possédé par un démon (sauf Point de Destin) ; un échec retourne le Sort contre vous — arbitrage MJ. |
| Explosion de Corruption | ✅ | oui |  |
| Obsession | 📜 | oui | Obsession : via un objet cher à la Cible, vous l’obsédez (Tests de Résistance horaires, de plus en plus durs, une Maladresse la rend totalement obsédée 1d10−BFM heures) ; à la fin, Test de Résistance (+0) ou +1 Corruption — arbitrage MJ. |
| Odieux messager | 📜 | oui | Odieux messager : un essaim de démons mineurs invisibles porte un message (~25 mots, doublé par +2 DR) à votre Cible, presque instantanément — arbitrage MJ. |
| Pouvoir du Chaos | 🟡 | oui | Pouvoir du Chaos : dans la ZdE, le NI des Sorts est réduit de moitié (et l’incantation s’y fait en Difficulté Accessible +20) ; quiconque y reste teste Résistance (+0) à chaque fin de Round ou gagne +1 Corruption — arbitrage MJ. |

## Magie du Chaos — Nurgle (1)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Flot de Corruption | 🟡 | oui | Flot de Corruption : le Souffle ignore les PA et porte les Traits Corrosif et Poison ; une cible qui subit plus de Blessures que son BE teste Résistance (+0) ou contracte Infection du Sang — arbitrage MJ. |

## Magie du Chaos — Slaanesh (1)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Consentement | 📜 | oui | Consentement : l’Initiative de la cible chute à 10, ses déplacements deviennent erratiques (MJ), et elle ne peut entreprendre une Action qu’en réussissant un Test de Calme (+0) — arbitrage MJ. |

## Magie du Chaos — Tzeentch (15)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Aura dorée de Tzeentch | ✅ | oui |  |
| Avantage de Tzeentch | 📜 | oui | Avantage de Tzeentch : choisissez un Sort de n’importe quel Domaine et lancez-le comme s’il était mémorisé pour la durée (Focalisation Dhar ou celle du Domaine) ; une erreur de canalisation l’efface de votre esprit — arbitrage MJ. |
| Éclair du changement | 🟡 | oui | Éclair du changement : sur une Maladresse, la Cible effectue un jet de Mutation immédiat et gagne le Talent Magie du Chaos (Tzeentch) ; un Point de Détermination permet de résister à la Mutation — arbitrage MJ. |
| Feu bleu de Tzeentch | 🟡 | oui | Feu bleu de Tzeentch : tout le monde dans (BInit) m de la cible subit +3 Dégâts et gagne En flammes ; si une cible (Taille ≥ Petite) tombe à 0 PB sous cet État, sur un 1d10 = 9 deux Horreurs bleues éclosent de son corps — arbitrage MJ. |
| Feu rose de Tzeentch | 🟡 | oui | Feu rose de Tzeentch : si une cible (Taille ≥ Petite) tombe à 0 PB sous l’État En flammes de ce Sort, sur un 1d10 = 9 une Horreur rose éclot de son corps — arbitrage MJ. |
| Feu spirituel | 🟡 | oui | Feu spirituel : +1 Corruption supplémentaire par +2 DR si le Test de Calme échoue ; une Mutation déclenche un jet sur le tableau des Mutations mentales et +1 État En flammes — arbitrage MJ. |
| Flammes vacillantes du capricieux destin | 📜 | oui | Flammes vacillantes du capricieux destin : toute créature percevant ce feu inoffensif peut relancer chaque Test une fois (même réussi), mais teste alors Résistance (+0) ou gagne +1 Corruption (les porteurs de la marque de Tzeentch y sont immunisés) — arbitrage MJ. |
| La Main Pourpre | 📜 | oui | La Main Pourpre : à partir d’un cheveu/rognure de la Cible, ses paumes virent au violet profond pendant 1 heure par DR — un avertissement clair des sorciers de la Main Pourpre — arbitrage MJ. |
| Maître du Destin | 🟡 | oui | Maître du Destin : si l’Incantation échoue, vous gagnez +1 Point de Corruption par DR négatif ; le Sort ne peut être relancé avant la fin de sa durée — arbitrage MJ. |
| Malédiction de Tzeentch | 📜 | oui | Malédiction de Tzeentch : sur un Test opposé de Force Mentale gagné, la Cible (un autre lanceur) perd l’accès à un Sort tiré au hasard, pour 1 jour par DR — arbitrage MJ. |
| Parole de Tzeentch | 🟡 | oui | Parole de Tzeentch : sur une Maladresse, la Cible passe Inconscient + Corruption ; une fois remise, elle teste Résistance (+20) ou gagne +1 Corruption (Maladresse → Mutation mentale) — arbitrage MJ. |
| Percevoir l'écheveau | 📜 | oui | Percevoir l’écheveau : le MJ vous révèle la Motivation, l’Ambition à court terme et l’Ambition à long terme d’une cible que vous voyez — arbitrage MJ. |
| Tempête de feu de Tzeentch | 🟡 | oui | Tempête de feu de Tzeentch : les Cibles, ligotées de feu aethyrique, sont aussi considérées comme impuissantes pour la durée ; à la fin, un Test de Résistance (+0) opposé à votre Langue (Magick) perdu donne +1 Corruption (+1 par DR d’écart) — arbitrage MJ. |
| Trahison de Tzeentch | 📜 | oui | Trahison de Tzeentch : pour la durée, la cible ne peut plus utiliser ses Talents ni ajouter ses Augmentations de Compétences — tous ses Tests se font sur la Caractéristique nue — arbitrage MJ. |
| Transformation de Tzeentch | 🟡 | oui | Transformation de Tzeentch : la Cible est impuissante toute la durée du Sort. À la fin, elle fait un Test de Résistance Intermédiaire (+0) opposé à votre Langue (Magick) ; si elle échoue, +1 Point de Corruption, +1 par DR d’écart — arbitrage MJ. |

## Magie Mineure (23)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Alarme | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Bruit | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Brume Mystique | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Chuchotis | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Conserve | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Courant d’Air | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Eau Pure | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Éclat | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Espionnage | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Fatigue | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Feu Follet | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Flamme | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Langue des Gors | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Langue des Pestigors | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Langue des Slaangors | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Langue des Tzaangors | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Ouverture | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Pied Léger | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Position | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Pourriture | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Projectile Mineur | ✅ | repli |  |
| Regard Lubrique | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Saccade | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Magie mineure (25)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Alerte | 📜 | oui | Alerte : révèle immédiatement si l’objet touché est empoisonné ou piégé. |
| Amitié animale | 📜 | oui | Amitié animale : une créature Bestiale plus petite vous fait totalement confiance (1 heure). |
| Bruits | 📜 | oui | Bruits : petits sons indistincts projetés à portée, sans Ligne de Vue. |
| Choc | ✅ | oui |  |
| Conservation | 📜 | oui | Conservation : préserve une journée de vivres de la putréfaction (durée en jours). |
| Coup de vent | 📜 | oui | Coup de vent : brève rafale (éteint une bougie, claque une porte…). |
| Créer un petit animal | 📜 | oui | Créer un petit animal : fait apparaître un petit animal local (lapin, colombe, rat…). |
| Drain | ✅ | oui |  |
| Éblouissant | ✅ | oui |  |
| En catimini | 📜 | oui | En catimini : téléporte un petit objet proche (taille d’un poing) entre vos mains. |
| Feux follets | 📜 | oui | Feux follets : jusqu’à (Bonus d’Int) lumières flottantes contrôlables (Test de Focalisation Accessible). |
| Flamme magique | 📜 | oui | Flamme magique : petite flamme inoffensive pour vous, qui chauffe et enflamme comme une flamme naturelle. |
| Fléchette | ✅ | oui |  |
| Lumière | 🟡 | oui | Lumière : lueur de torche, modulable de bougie à lanterne sur un Test de Focalisation (+20). |
| Murmures | 📜 | oui | Murmures : projette votre voix vers un point à portée, sans Ligne de Vue. |
| Pas léger | 📜 | oui | Pas léger : votre passage ne laisse aucune trace organique (−20 implicite au Pistage adverse — arbitrage MJ). |
| Protection contre la pluie | ✅ | oui |  |
| Purification de l'eau | 📜 | oui | Purification de l’eau : purifie l’eau d’un récipient (poisons/polluants non magiques éliminés). |
| Putréfaction | 🟡 | oui | Putréfaction : denrées et vêtements organiques pourrissent (taille d’un poing) — arbitrage MJ. |
| Repères | 📜 | oui | Repères : vous savez où est le Nord. |
| Secousse | 📜 | oui | Secousse : l’objet tenu tombe (arme au sol — arbitrage MJ). |
| Serrure ouverte | 📜 | oui | Serrure ouverte : déverrouille une serrure non magique touchée. |
| Sommeil | 🟡 | oui | Sommeil : la cible se RÉVEILLE instantanément si on l'attaque (le coup la bouscule) — elle encaisse alors une attaque normale au lieu d'être achevée. Un bruit fort ou un allié qui la secoue peut aussi la tirer du sommeil. |
| Source | 📜 | oui | Source : fait jaillir ½ litre d’eau par Round (max Bonus d’Initiative litres). |
| Tendre l'oreille | 📜 | oui | Tendre l’oreille : vous entendez vos cibles comme si vous étiez à côté. |

## Magie Mineure Skaven (2)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Faveur du Rat Cornu | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Marque du Rat Cornu | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Miracle (30)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Abondance de Rhya | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Apaisement | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Arrière, Sorcière ! | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Aux Innocents les Mains Pleines ! | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Baratin | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Bénédicité de Taal | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Blizzard | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Bon Débarras ! | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Catharsis | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Chaleur de la Fourrure | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Courage du Loup | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Dressage de Rhya | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Fers de | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Haine du Faible | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Instinct Animal | 📜 | repli | Non curé : desc journalisée telle quelle. |
| La Vérité finit toujours par sortir | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Les Voies de la Nature | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Main de Rhya | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Marteau de Justice | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Modèle de Vertu | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Morsure d’Hiver | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Oeil de Lynx | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Piste Froide | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Résistance du Pénitent | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Sagesse du Hibou | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Sanctuaire | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Saut de Cabri | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Sus à l’Ennemi ! | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Trêve de Taal DSFL | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Verena m’est témoin ! | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Rituel (11)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Art de la malédiction | 📜 | oui |  |
| Corrompre une pierre gardienne | 📜 | oui |  |
| Créer un Fabriqué | ✅ | oui |  |
| Créer un familier | 📜 | oui |  |
| Créer une pierre de pouvoir | 📜 | oui |  |
| Créer une propriété de pierre gardienne | 📜 | oui |  |
| Graver une pierre d'ogham | 📜 | oui |  |
| Imprégner un bâton | ✅ | oui |  |
| Lever une malédiction | 📜 | oui |  |
| Lier un esprit à une pierre de pouvoir | 📜 | oui |  |
| Matérialiser le marais-vivant | ✅ | oui |  |

## Rituel — Bête (2)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Invocation du Prédateur sanglant | ✅ | oui |  |
| Lier une bête monstrueuse | 📜 | oui |  |

## Rituel — Démonologie (1)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Invocation de démon | 📜 | oui |  |

## Rituel — Feu (1)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Invocation de Jack des Cendres | ✅ | oui |  |

## Rituel — Mort (2)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Invocation de l'élémentaire incarné de la Mort | ✅ | oui |  |
| Les Faux croisées | 📜 | oui |  |

## Sort (17)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Arme Souillée | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Cogne-Fort | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Coup d’Boule ! | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Crépitements Vengeurs | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Démangeaison Agaçante | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Douces Paroles | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Flammes Bleues de Tzeentch | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Flammes Roses de Tzeentch | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Furoncle Infecté | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Lune de Malheur | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Malveillance Absolue | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Nuée de Mouches | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Prise de Tête | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Soleil Noir | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Vol | 📜 | repli | Non curé : desc journalisée telle quelle. |
| WAAAGH ! | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Z’Oeils de Mork | 📜 | repli | Non curé : desc journalisée telle quelle. |
<!-- sources-empreinte: c8ee2b81893d1a7193a9a1f8f5b949e85a8cbd63 (218 fichiers, 0 dossiers) corps: 57339bd26972a9f6c7b187ddec8028b3552b357f -->
