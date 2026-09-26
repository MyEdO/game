# Atlas RAW — Compétences

> Référentiel autosuffisant des règles WFRP4 (RAW) sur les Compétences. Chaque règle cite
> `LDB 09 l.X-Y` (ou supplément) en source de dernier recours. Voir [`sources.md`](../sources.md),
> [`00-index.md`](00-index.md). Rouvrir le livre = défaut à corriger ici.
> ⚠️ Les champs **Implémente** sont GÉNÉRÉS (`npm run raw:implemente` — source éditoriale : `src/data/raw.manifest.json`) — ne pas les éditer à la main.

## Sommaire

- [Mécanique fondamentale — niveau de Compétence](#mécanique-fondamentale--niveau-de-compétence)
- [Compétences de Base vs Avancées](#compétences-de-base-vs-avancées)
- [Compétences Groupées et Spécialisations](#compétences-groupées-et-spécialisations)
- [Compétences de Base — liste complète](#compétences-de-base--liste-complète)
- [Compétences Avancées — liste complète](#compétences-avancées--liste-complète)
- [Table des Compétences — Caractéristique et type](#table-des-compétences--caractéristique-et-type)
- [Spécialisations — inventaire complet par Compétence](#spécialisations--inventaire-complet-par-compétence)
- [Règle optionnelle — Caractéristique alternative](#règle-optionnelle--caractéristique-alternative)
- [Extension ogre — Langue (Magick) sur Endurance](#extension-ogre--langue-magick-sur-endurance)
- [Règle optionnelle — Filature (Discrétion + Perception)](#règle-optionnelle--filature-discrétion--perception)
- [Applications en combat — résumé par Compétence](#applications-en-combat--résumé-par-compétence)
- [Bilan de fidélité](#bilan-de-fidélité)

- **Les Vents de Magie (VDM)** <!-- VDM-INTEGRATION -->
- [Augure (Int) — Compétence Avancée (VDM)](#augure-int--compétence-avancée-vdm) — `VDM 03 l.424-472`
- [Le Thaumodivinator (VDM)](#le-thaumodivinator-vdm) — `VDM 03 l.483-489`
- [Sorts prémonitoires — Surincantation d'Augure (VDM)](#sorts-prémonitoires--surincantation-daugure-vdm) — `VDM 03 l.491-509`
- [L'Augure et les stupéfiants (VDM)](#laugure-et-les-stupéfiants-vdm) — `VDM 03 l.512-541`
- [Psychométrie (Int) — Compétence Avancée (VDM)](#psychométrie-int--compétence-avancée-vdm) — `VDM 03 l.543-581`
- [Alchimie ordinaire — Métier (Alchimiste) (VDM)](#alchimie-ordinaire--métier-alchimiste-vdm) — `VDM 03 l.584-664`
- [Le laboratoire alchimique portatif (VDM)](#le-laboratoire-alchimique-portatif-vdm) — `VDM 03 l.615-617`
- [Produits alchimiques — effets en jeu (VDM)](#produits-alchimiques--effets-en-jeu-vdm) — `VDM 03 l.666-690`
- [Haute Alchimie (VDM)](#haute-alchimie-vdm) — `VDM 03 l.692-745`

---

## Mécanique fondamentale — niveau de Compétence

Le niveau de Compétence d'un personnage est la **somme de la Caractéristique associée + les
Augmentations** dans cette Compétence inscrites sur la Feuille de Personnage.

> « Un Niveau de Compétence est déterminé en prenant la Caractéristique associée et en ajoutant
> le nombre d'Augmentations prises dans la Compétence. »
> — LDB 09 l.17

**Sources RAW :** LDB 09 l.12-18

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 9` (l.12-18) → `doc`, `possesses`, `RecoverResolution`, `DispelModal`, `useTestJetProps`, `AppraiseModalView`, `BargainModalView`, `HealRollFlow`, `TestResult`, `SurgeryRollFlow`, +29 — `src/data/index.ts`, `src/data/schemas/defs/skills.ts`, `src/engine/axes.ts`, `src/engine/combat.ts`, `src/engine/magic.ts`, `src/engine/skillCombatApps.ts`, +20 fichiers

**Voir aussi :** [Tests & Degrés de Réussite](tests.md) pour l'utilisation de ce niveau en test.

---

## Compétences de Base vs Avancées

### Compétences de Base

Représentent des aptitudes communes ou innées. **Peuvent faire l'objet d'un Test même sans
Augmentation** : on utilise simplement la Caractéristique associée.

> « Les Compétences de Base peuvent faire l'objet d'un Test même si vous n'y avez pas mis
> d'Augmentation. Pour cela, tentez simplement un Test utilisant la Caractéristique associée. »
> — LDB 09 l.25

### Compétences Avancées

Nécessitent un entraînement. **Impossible de tenter le Test sans au moins une Augmentation.**

> « Vous ne pouvez effectuer de Test de Compétence Avancée que si vous y avez ajouté au moins une
> Augmentation. Si ce n'est pas le cas, vous ne pouvez pas tenter le Test de Compétence. »
> — LDB 09 l.30

**Sources RAW :** LDB 09 l.22-32

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 9` (l.22-32) → `doc`, `hasHealSkill`, `possesses`, `specIdOf`, `RecoverResolution`, `CibleDeType`, `DispelModal`, `useTestJetProps`, `AppraiseModalView`, `BargainModalView`, +56 — `src/data/index.ts`, `src/data/schemas/defs/skills.ts`, `src/data/schemas/grammaire/ref.ts`, `src/data/schemas/grammaire/valeurs.ts`, `src/data/skills.json`, `src/engine/activities.ts`, +39 fichiers

---

## Compétences Groupées et Spécialisations

Une Compétence Groupée regroupe plusieurs **Spécialisations** sous une même rubrique. Chaque
Spécialisation est traitée comme une **Compétence distincte** (Augmentations indépendantes, Tests
séparés). Lors d'un gain d'Augmentation dans une Compétence Groupée, on alloue l'Augmentation à
une Spécialisation précise.

> « Quand vous gagnez une Augmentation dans une Compétence Groupée, vous devez allouer
> l'Augmentation à une Spécialisation appropriée. »
> — LDB 09 l.40

Quand la Spécialisation est « Au choix », le joueur la sélectionne librement parmi les exemples de
la description, ou en crée une avec l'accord du MJ.

> « Chaque Compétence est alors appelée une Spécialisation. Quand une Spécialisation est mentionnée
> dans les règles, elle est indiquée entre parenthèses. »
> — LDB 09 l.36-37

**Sources RAW :** LDB 09 l.34-46

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 9` (l.34-46) → `doc`, `hasHealSkill`, `possesses`, `specIdOf`, `CibleDeType`, `art`, `athletisme`, `buySkillAdvance`, `wildcardSpecs`, `estSpecialisable`, +22 — `src/data/index.ts`, `src/data/schemas/defs/skills.ts`, `src/data/schemas/grammaire/ref.ts`, `src/data/schemas/grammaire/valeurs.ts`, `src/data/skills.json`, `src/engine/activities.ts`, +19 fichiers

---

## Compétences de Base — liste complète

Liste source LDB 09 l.52 :

**Art, Athlétisme, Calme, Charme, Chevaucher, Commandement, Conduite d'attelage, Corps à corps,
Discrétion, Divertissement, Emprise sur les animaux, Escalade, Esquive, Intimidation, Intuition,
Marchandage, Orientation, Pari, Perception, Ragot, Ramer, Résistance, Résistance à l'alcool,
Subornation, Survie en extérieur**

(25 Compétences de Base)

---

## Compétences Avancées — liste complète

Liste source LDB 09 l.55-56 :

**Crochetage, Dressage, Escamotage, Évaluation, Focalisation, Guérison, Langue, Métier, Musicien,
Natation, Piégeage, Pistage, Prière, Projectiles, Recherche, Représentation, Savoir, Signes secrets,
Soin aux animaux, Voile**

(20 Compétences Avancées)

---

## Table des Compétences — Caractéristique et type

| Compétence | Carac. | Type | Groupée |
|---|---|---|---|
| Art | Dex | Base | Oui |
| Athlétisme | Ag | Base | Non |
| Calme | Fm | Base | Non |
| Charme | Soc | Base | Non |
| Chevaucher | Ag | Base | Oui |
| Commandement | Soc | Base | Non |
| Conduite d'attelage | Ag | Base | Non |
| Corps à corps | CC | Base | Oui |
| Crochetage | Dex | Avancée | Non |
| Discrétion | Ag | Base | Oui |
| Divertissement | Soc | Base | Oui |
| Dressage | Int | Avancée | Oui |
| Emprise sur les animaux | Fm | Base | Non |
| Escalade | F | Base | Non |
| Escamotage | Dex | Avancée | Non |
| Esquive | Ag | Base | Non |
| Évaluation | Int | Avancée | Non |
| Focalisation | Fm | Avancée | Oui* |
| Guérison | Int | Avancée | Non |
| Intimidation | F | Base | Non |
| Intuition | I | Base | Non |
| Langue | Int | Avancée | Oui |
| Marchandage | Soc | Base | Non |
| Métier | Dex | Avancée | Oui |
| Musicien | Dex | Avancée | Oui |
| Natation | F | Avancée | Non |
| Orientation | I | Base | Non |
| Pari | Int | Base | Non |
| Perception | I | Base | Non |
| Piégeage | Dex | Avancée | Non |
| Pistage | I | Avancée | Non |
| Prière | Soc | Avancée | Non |
| Projectiles | Ct | Avancée | Oui |
| Ragot | Soc | Base | Non |
| Ramer | F | Base | Non |
| Recherche | Int | Avancée | Non |
| Représentation | Ag | Avancée | Oui |
| Résistance | E | Base | Non |
| Résistance à l'alcool | E | Base | Non |
| Savoir | Int | Avancée | Oui |
| Signes secrets | Int | Avancée | Oui |
| Soin aux animaux | Int | Avancée | Non |
| Subornation | Soc | Base | Non |
| Survie en extérieur | Int | Base | Non |
| Voile | Ag | Avancée | Oui |

*Focalisation est « à la fois Groupée (Spécialisations par Vent) et non Groupée pour les non-formés »
(LDB 09 l.250-252).

**Sources RAW :** LDB 09 l.65-574 (descriptions individuelles).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 9` (l.65-574) → `mendier-ennuis`, `GearAssignList`, `rollDrivingMishap` ⚠sans-appelant, `altCharKey`, `drivingAccidentDamage` ⚠sans-appelant, `DRUNK_CARACS`, `accidents-conduite-attelage`, `actBlockReason`, `skillAdvantageCap`, `carryOverState`, +102 — `src/data/activities.json`, `src/data/combat-stakes.json`, `src/data/driving-mishap.json`, `src/data/drunkenness.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, +39 fichiers

---

## Spécialisations — inventaire complet par Compétence

### Art (Dex) — Base, Groupée
**LDB :** Cartographie, Gravure, Mosaïque, Peinture, Sculpture, Tatouage, Tissage
(LDB 09 l.72)
**AA :** Art (Écriture) (AA 9 l.349)

### Chevaucher (Ag) — Base, Groupée
**LDB :** Cheval, Grand Loup, Griffon, Demigriffon, Pégase
(LDB 09 l.118)
**ADE I :** Chevaucher (Blaireau) (ADE I 7 l.44)

### Corps à corps (CC) — Base, Groupée
**LDB :** Arme d'hast, Arme à deux mains, Bagarre, Base, Cavalerie, Escrime, Fléau, Parade
(LDB 09 l.160)
**AA :** aucune nouvelle Spécialisation (les mêmes s'appliquent aux Cavaliers, Hallebardiers,
Duellistess des nouvelles Carrières).

### Discrétion (Ag) — Base, Groupée
**LDB :** Rurale, Souterrains, Urbaine
(LDB 09 l.185)

### Divertissement (Soc) — Base, Groupée
**LDB :** Chant, Comédie, Interprétation, Narration
(LDB 09 l.198)
**AA :** Divertissement (Discours) (AA 6 l.444)

### Dressage (Int) — Avancée, Groupée
**LDB :** Cheval, Chien, Demigriffon, Pégase, Pigeon
(LDB 09 l.211)

### Focalisation (Fm) — Avancée, Groupée*
**LDB :** Aqshy, Azyr, Chamon, Dhar, Ghur, Ghyran, Hysh, Shyish, Ulgu
(LDB 09 l.252)

### Langue (Int) — Avancée, Groupée
**LDB :** bataille, bretonnien, classique, guilde, khazalid, Magick, voleur, tiléen
(LDB 09 l.302)
**Langues du Vieux Monde listées par LDB 09 l.319-346 :** Albionais, Bataille, Bretonnien,
Classique, Elthárin, Estalien, Gospodarin, Grumbarth, Khazalid, Magick, Halfling, Norse, Reikspiel,
Queekique, Tiléen, Langage des voleurs, Wastelander.
**AA :** Langue (Arabéen) (AA 5 l.122)
**Note :** Langue (Magick) sert à lancer des Sorts (LDB 09 l.300-301) — voir [Magie](magie.md).

### Métier (Dex) — Avancée, Groupée
**LDB :** Apothicaire, Calligraphe, Cirier, Charpentier, Cuisinier, Embaumeur, Forgeron, Tanneur
(LDB 09 l.364)
**AA (exemples extraits des Carrières) :** Armurier, Barbier, Cartographe, Explosifs, Fabricant de
flèches, Forgeron, Maçon, Maréchale-ferrant, Mineur, Scribe
**AA 10 l.132 :** Métier (Charpentier) ou Métier (Maçon) pour réparer des Structures.
**AA 8 l.59 :** Métier (Cartographe) pour utiliser un théodolite.

### Musicien (Dex) — Avancée, Groupée
**LDB :** Clavecin, Cor, Cornemuse, Luth, Violon
(LDB 09 l.370)
**AA :** Musicien (Flûte), Musicien (Tambour) (AA 2 l.237, l.469)

### Projectiles (Ct) — Avancée, Groupée
**LDB :** Arbalète, Arc, Entraves, Explosifs, Fronde, Ingénierie, Lancer, Poudre noire
(LDB 09 l.428)
**AA :** Catapulte (AA 10 l.142-144 — armes de siège distinctes de Poudre noire et Arbalète).
Note : Baliste = groupe Arbalète (AA 10 l.148) ; Canon / Canon feu d'enfer = groupe Ingénierie ;
Catapulte = groupe Catapulte exclusif.

### Représentation (Ag) — Avancée, Groupée
**LDB :** Acrobaties, Cracheur de feu, Danser, Funambule, Jonglage, Mime, Pitreries
(LDB 09 l.465)
**AA :** Représentation (Parade) — défilé militaire (AA 2 l.469)

### Savoir (Int) — Avancée, Groupée
**LDB :** Géologie, Héraldique, Histoire, Ingénierie, Loi, Magick, Métallurgie, Science, Théologie
(LDB 09 l.495)
**AA (exemples extraits des Carrières) :** Anatomie, Art de la guerre, Artillerie, Bêtes, Empire,
Géographie, Guerre, Herbes (cité LDB 09 l.565), Ingénierie, Loi, Magie, Nécromancie, Région,
Remèdes, Théologie
**ADE II :** Savoir (Magie) pour fabriquer des objets magiques (ADE II 4 l.94, l.98, l.104)

### Signes secrets (Int) — Avancée, Groupée
**LDB :** Ordre Gris, Guildes (au choix), Ruraux, Éclaireurs, Voleurs, Vagabonds
(LDB 09 l.504)
**AA :** Signes secrets (Ranger) (ADE I 7 l.197) ; Signes secrets (Ulric) (AA 3 l.266) ;
Signes secrets (Soleil flamboyant) (AA 3 l.344) ; Signes secrets (Chevaliers Panthères) (AA 3 l.426)

### Voile (Ag) — Avancée, Groupée
**LDB :** Caravelle, Chaland, Cogue, Drakkar, Frégate
(LDB 09 l.573)
**Note LDB :** posséder une Spécialisation Voile rend les autres Spécialisations de Base pour ce
personnage (LDB 09 l.571).

---

## Descriptions individuelles des Compétences

### Art (Dex) — Base, Groupée
LDB 09 l.65-72

Créer des œuvres d'art dans la Spécialisation choisie. Sans outils appropriés : pénalité. Le DR
obtenu détermine la qualité. Un Test étendu peut être nécessaire pour une œuvre complexe.

**Sources RAW :** LDB 09 l.65-72

---

### Athlétisme (Ag) — Base
LDB 09 l.75-76

Courir, sauter, se déplacer avec rapidité et grâce, toute activité physique générale. Voir aussi
[Déplacement](deplacement.md) pour l'usage en mouvement de combat.

**Sources RAW :** LDB 09 l.75-76

---

### Calme (Fm) — Base
LDB 09 l.80-83

Rester serein sous pression, résister à la peur face à l'horreur, tenir ses convictions. Utilisé pour
résister aux autres Compétences (Charme, Intimidation) et aux effets de Psychologie (voir
[Psychologie](psychologie.md)). Test opposé principal : Calme/Charme, Calme/Intimidation.

**Sources RAW :** LDB 09 l.80-83

---

### Charme (Soc) — Base
LDB 09 l.86-109

Inciter les gens à avoir une bonne opinion de soi, de ses points de vue, des actions proposées.
Usages spécifiques :

- **Mendier :** succès = Bonus de Sociabilité × DR sous de cuivre par heure.
- **Parler en public (discours) :** influencer jusqu'à Bonus de Sociabilité + DR cibles (plus faible
  Force Mentale en premier) ; si foule déchaînée : Test opposé à Fm moyenne de la foule (35 en
  général). Échec Stupéfiant = foule en colère.
- **Test opposé Charme/Calme :** influencer l'attitude d'une ou plusieurs cibles (max Bonus Soc + DR).
- **En combat :** Action ou Défense ; sur succès les cibles ne vous attaquent pas ce Round, +1
  Avantage. Talents Orateur/Grand orateur augmentent le nombre de cibles. Echec Stupéfiant en
  discours = foule hostile.

**Sources RAW :** LDB 09 l.86-109

---

### Chevaucher (Ag) — Base, Groupée
LDB 09 l.111-118

Maîtriser un groupe d'animaux de monte spécifique (chaque Spécialisation = un type). Aucun Test
nécessaire pour une conduite normale ; Test requis pour manœuvres inhabituelles (course, terrain
dangereux, charge en combat). En déplacement monté : Mouvement de la monture, Compétence Chevaucher
remplace Athlétisme pour courir/sauter/bondir. Test étendu pour long trajet.

**Sources RAW :** LDB 09 l.111-118

---

### Commandement (Soc) — Base
LDB 09 l.121-134

Diriger les autres, se faire respecter. Test réussi = ordres à Bonus Soc + DR cibles. Si la cible
est un subordonné direct : pas d'opposition. Sinon (hiérarchie absente ou ordre exigeant) : opposé
au Calme des cibles.

- **En combat :** +10 à tous les Tests de Psychologie des subalternes jusqu'à la fin du prochain
  Round. Transfert d'Avantage : Test réussi = transférer 1 Avantage + 1 par DR à des alliés à portée.

**Sources RAW :** LDB 09 l.121-134

---

### Conduite d'attelage (Ag) — Base
LDB 09 l.137-154

Conduire des véhicules (chariots, diligences, créations expérimentales). Si conditions normales et
Compétence possédée : aucun Test. Sinon : Test requis. Sans Compétence : Test même pour manœuvres
basiques. Échec Stupéfiant → table d'accidents (Harnais cassé / Cahots / Roue brisée / Essieu cassé).

Réparation d'un véhicule accidenté : Métier (Charpentier) ou Métier (Charron).

**Sources RAW :** LDB 09 l.137-154

---

### Corps à corps (CC) — Base, Groupée
LDB 09 l.157-160

Entraînement spécifique à une classe d'armes de combat rapproché. Sans la Spécialisation appropriée :
pénalités définies au Chapitre 11 (Équipement). Voir [Combat](combat.md).

**Sources RAW :** LDB 09 l.157-160

---

### Crochetage (Dex) — Avancée
LDB 09 l.163-176

Ouvrir des serrures sans clef. Souvent Test étendu, DR requis selon la complexité de la serrure.
Sans outils de crochetage : pénalité de −10 (improvisation). Chaque Test = 1 Round. Table de
difficultés standard :

| Type de serrure | Difficulté | DR |
|---|---|---|
| Loquet | Accessible (+20) | — |
| Porte classique | Intermédiaire (+0) | 2 |
| Porte sécurisée | Complexe (−10) | 2 |
| Coffre au trésor | Difficile (−20) | 5 |
| Porte blindée | Très difficile (−30) | 10 |

Sans Compétence : Test de Dextérité Très difficile (−30) pour les serrures simples (MJ).

**Sources RAW :** LDB 09 l.163-176

---

### Discrétion (Ag) — Base, Groupée
LDB 09 l.179-190

Se glisser sournoisement, se dissimuler dans l'ombre. Généralement opposé à la Perception de
l'adversaire. Modificateurs : obscurité, itinéraire dissimulé, tenue appropriée. Échec Impressionnant
ou Stupéfiant = attention immédiate des ennemis.

**Option Filature** (Test Combiné Perception + Discrétion, LDB 09 l.188-190) : voir section dédiée.

**Sources RAW :** LDB 09 l.179-190

---

### Divertissement (Soc) — Base, Groupée
LDB 09 l.193-198

Ravir les foules par la parole, le chant, la comédie, les histoires. Succès = auditoire conquis,
DR = qualité. En combat : peu d'utilité, sauf Divertissement (Interprétation) pour troubler/leurrer
(MJ).

**Distinctions avec Musicien et Représentation (LDB 09 l.275-285) :**
- Divertissement (Soc, Base) = aptitudes communes, même sans entraînement (chant, récit).
- Musicien (Dex, Avancée) = instruments, formation nécessaire.
- Représentation (Ag, Avancée) = arts physiquement exigeants, coordination.

**Sources RAW :** LDB 09 l.193-198, 248-258

---

### Dressage (Int) — Avancée, Groupée
LDB 09 l.201-211

Comprendre et entraîner un type particulier d'animal. Succès = identifier les capacités Dressé de
l'animal (Spécialisation). Permet l'Activité Dressage entre aventures.

**En combat :** Test opposé Dressage/Force Mentale pour instiller la Peur chez un animal (jusqu'à
la fin du prochain tour). En cas de succès, on peut utiliser Dressage à la place de Corps à corps
pour la défense ou l'attaque contre cette cible (avec accord MJ).

**Sources RAW :** LDB 09 l.201-211

---

### Emprise sur les animaux (Fm) — Base
LDB 09 l.214-219

Se lier d'amitié, calmer ou asservir les animaux. Test réussi = influencer Bonus de Fm + DR animaux
(les plus faibles Force Mentale en premier). Naturellement dociles : incontesté. Sinon : opposé à
Force Mentale de la cible.

**En combat :** sur succès, aucune cible affectée ne vous attaque ce Round, +1 Avantage. Peut se
renouveler jusqu'à échec ou arrêt. Après échec : instinct animal reprend le dessus, plus d'influence.

**Sources RAW :** LDB 09 l.214-219

---

### Escalade (F) — Base
LDB 09 l.222-225

Grimper sur des surfaces lisses ou verticales. Si temps non contraint et escalade facile : automatique
pour qui possède la Compétence. Sinon : Test (voir aussi [Déplacement](deplacement.md) et combat). En
combat : possible même sur de grands adversaires.

**Sources RAW :** LDB 09 l.222-225

---

### Escamotage (Dex) — Avancée
LDB 09 l.228-233

Faire les poches, escamoter des objets, tours de prestidigitation, tricher aux jeux de hasard.
Généralement opposé à Perception de la cible. Succès = objet escamoté / poches faites / cartes
échangées. Succès Minime possible = méfiance sans preuve.

**Combinaison avec Pari :** Test d'Escamotage avant chaque Round d'un jeu (opposé si soupçons) ;
succès = pouvoir inverser le Test de Pari si l'inversion donne un succès. Échec = adversaires peu
ravis.

**Sources RAW :** LDB 09 l.228-233

---

### Esquive (Ag) — Base
LDB 09 l.236-239

Éviter des objets, esquiver, plonger, se déplacer rapidement (chutes de pierre, coups, pièges). En
combat : résister aux attaques / éviter les Dégâts. Voir [Combat](combat.md).

**Sources RAW :** LDB 09 l.236-239

---

### Évaluation (Int) — Avancée
LDB 09 l.242-243

Déterminer la valeur d'artefacts rares, marchandises inhabituelles, œuvres d'art. Succès = valeur
connue. Permet aussi de détecter les contrefaçons (Test opposé au DR du Test d'Art ou Métier du
faussaire). Modificateurs : rareté, méconnaissance, background du personnage.

**Sources RAW :** LDB 09 l.242-243

---

### Focalisation (Fm) — Avancée, Groupée*
LDB 09 l.246-252

Appeler et contrôler les différents Vents de Magie. Uniquement avec les règles de magie (voir
[Magie](magie.md)). Particularité : Groupée (Spécialisations par Vent) pour les formés, mais traitée
comme non Groupée pour les non-formés.

**Sources RAW :** LDB 09 l.246-252 ; ADE II 4 l.162, l.180, l.182 (Focalisation sur artefacts magiques).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 9` (l.65-72, l.75-76, l.80-83, l.86-109, l.111-118, l.121-134, l.137-154, l.157-160, l.163-176, l.179-190, l.193-198, l.201-211, l.214-219, l.222-225, l.228-233, l.236-239, l.242-243, l.246-252, l.275-285) → `mendier-ennuis`, `GearAssignList`, `rollDrivingMishap` ⚠sans-appelant, `altCharKey`, `drivingAccidentDamage` ⚠sans-appelant, `accidents-conduite-attelage`, `actBlockReason`, `carryOverState`, `useDefenseJetProps`, `art`, +51 — `src/data/activities.json`, `src/data/combat-stakes.json`, `src/data/driving-mishap.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, +25 fichiers
- sans code : `ADE II 4` (l.162)

---

### Guérison (Int) — Avancée
LDB 09 l.255-269

Formation à soigner blessures et maladies. Un Test réussi permet :

- Diagnostiquer une pathologie / maladie.
- Traiter une maladie (voir [Maladies](maladies.md)).
- Guérir Bonus d'Intelligence + DR Points de Blessure (un seul jet par rencontre par patient). Avec
  liquides stériles / pansements appropriés : pas d'Infection.
- Arrêter un État Hémorragique (chaque DR supplémentaire retire un État Hémorragique de plus).

Échec possible si Bonus d'Int + DR < 0 → Blessures au patient. Échec Stupéfiant → Infection mineure.

Soins d'une personne malade : Test réussi protège le soignant ce jour ; chaque DR protège un
Personnage de plus croisant le patient. Chaque journée complète de soins réduit la durée de la
maladie de 1 (min 1).

En combat : Tests de Guérison Intermédiaires (+0).

**Sources RAW :** LDB 09 l.255-269

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 9` (l.255-269) → `carryOverState`, `useDefenseJetProps`, `healDifficulty`, `healWoundsDelta`, `rederiveAttack`, `stopBleedOutcome`, `HealWoundsOptions`, `applyHealWounds`, `defenseSubOf`, `heal-wounds`, +11 — `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/skills.json`, `src/engine/healing.ts`, `src/engine/persistence.ts`, `src/engine/types.ts`, +4 fichiers

---

### Intimidation (F) — Base
LDB 09 l.272-294

Contraindre ou effrayer des créatures conscientes. Toujours opposé au Calme de la cible ; succès =
Bonus de Force + DR cibles affectées. La cible réagit selon sa personnalité : recul / fuite / combat.

**En combat :** cibles Intimidées subissent la Peur. Peut remplacer Corps à corps en défense contre
les personnes qui vous craignent. Avec accord MJ, peut « attaquer » (donner un ordre précis). Échec
à un Test ultérieur = fin de l'Intimidation (nouvelle tentative possible avec malus).

**Option MJ : Caractéristique alternative (LDB 09 l.293-294) :** F par défaut ; le MJ peut
autoriser Fm (Répurgateur) ou Int (universitaire face à un étudiant). Voir [Règle optionnelle](#règle-optionnelle--caractéristique-alternative).

**Sources RAW :** LDB 09 l.272-294

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 9` (l.272-294) → `altCharKey`, `useDefenseJetProps`, `healDifficulty`, `rederiveAttack`, `defenseSubOf`, `heal-wounds`, `heal-bleed`, `skill-advantage`, `guerison`, `intimidation`, +5 — `src/data/combat-stakes.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/skills.json`, `src/engine/healing.ts`, +5 fichiers

---

### Intuition (I) — Base
LDB 09 l.305-308

Percevoir son environnement, remarquer quand quelque chose ne va pas, ressentir quand on vous cache
quelque chose. Succès = informations subtiles (déterminées par le MJ). Si quelqu'un dissimule
activement : opposé à son Calme ou Divertissement (Interprétation).

**En combat :** Test réussi = +1 Avantage par évaluation de l'environnement et des adversaires.
Maximum d'Avantages par Intuition = Bonus d'Intelligence. Doit observer les cibles sans être
interrompu.

**Sources RAW :** LDB 09 l.305-308

---

### Langue (Int) — Avancée, Groupée
LDB 09 l.311-346

Aisance avec les langues. Tous les personnages parlent le reikspiel (et leur langue maternelle si
différente) sans Test. Si Compétence possédée : compréhension normale sans Test ; Test requis pour
concepts difficiles, dialectes ou vocabulaire obscur.

**Langue (Magick) :** sert à lancer des sorts ; peut nécessiter un Test avec conséquences en cas
d'échec (voir [Magie](magie.md)).

**Langue (Bataille) :** ordres et gestes simples utilisables en combat sans pénalité pour celui qui
la possède ; coordination d'attaques et stratégie inaccessibles à ceux qui ne la possèdent pas.

**Sources RAW :** LDB 09 l.311-346 ; ADE II 2 l.728 (ogres : Langue Magick sur Endurance).

---

### Marchandage (Soc) — Base
LDB 09 l.348-348

Obtenir de meilleures offres lors de négociations. Test opposé de Marchandage pour déterminer si
l'on fait une bonne affaire. Utilisé aussi pour parcourir les échoppes et trouver les meilleurs prix
(voir [Économie](economie.md)).

**Sources RAW :** LDB 09 l.348-348

---

### Métier (Dex) — Avancée, Groupée
LDB 09 l.349-364

Créer quelque chose ou fournir un service, connaissance essentielle de la profession. Si Compétence
possédée + ressources + outils adaptés : tâches courantes automatiques sans Test. Test requis pour :
production rapide, conditions défavorables, objet de grande qualité.

Tests souvent étendus ; DR et temps nécessaires selon l'ampleur du projet.

Peut aussi s'utiliser comme Savoir pour des informations sur la profession (MJ peut substituer Int
à Dex dans ce cas, LDB 09 l.358).

Activité Artisanat entre aventures utilise Métier (voir [Activités](activites.md)).

**Sources RAW :** LDB 09 l.349-364

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 9` (l.305-308, l.311-346, l.348, l.349-364) → `altCharKey`, `skillAdvantageCap`, `test-metier-int`, `PendingTest`, `ACTION_GATES`, `skill-advantage`, `intimidation`, `intuition`, `langue`, `marchandage`, +9 — `src/data/combat-stakes.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/skills.json`, `src/engine/skillCombatApps.ts`, `src/engine/skills.ts`, +7 fichiers
- `ADE II 2` (l.728) → `altCharKey`, `castingCharKey`, `possession-pas-a-sa-taille`, `gueule`, `DomainData`, `ogre`, `bouf-crane`, `broyeur-d-os`, `festin-des-damnes` — `src/data/domains.json`, `src/data/index.ts`, `src/data/regles.json`, `src/data/spells.json`, `src/data/traits.json`, `src/engine/magic.ts`, +1 fichiers

---

### Musicien (Dex) — Avancée, Groupée
LDB 09 l.367-370

Jouer d'un instrument de musique. Test réussi = divertir les spectateurs à portée, DR = qualité du
morceau.

**Distinctions avec Divertissement / Représentation :** voir [Divertissement](#divertissement-soc--base-groupée).

**Sources RAW :** LDB 09 l.367-370

---

### Natation (F) — Avancée
LDB 09 l.373-377

Nager sans se noyer. Si Compétence possédée : nage librement sans Test. Test requis pour courants
difficiles, course-poursuite, créatures aquatiques. Modificateurs : état de l'eau, encombrement
vêtements/armure/équipement.

**En combat aquatique :** remplace Athlétisme pour déterminer le Mouvement. Vitesse = moitié de la
Caractéristique de Mouvement.

**Sources RAW :** LDB 09 l.373-377

---

### Orientation (I) — Base
LDB 09 l.380-383

Trouver son chemin dans la nature (repères, étoiles, cartes). Si Compétence possédée et repères
connus : automatique sans Test. Test requis si désorienté ou hors des sentiers battus. Pour un long
trajet : Test d'Orientation étendu (modificateurs météo, repères visibles, informations géographiques ;
DR selon distance, chaque Test = 1 h à 1 journée de voyage).

**Sources RAW :** LDB 09 l.380-383

---

### Pari (Int) — Base
LDB 09 l.386-395

Évaluer les probabilités d'un pari, participer avec succès aux jeux de hasard. Lors d'un pari :
tous les participants font un Test de Pari ; le DR le plus haut l'emporte. À égalité : les plus
bas se retirent, on recommence.

Mini-jeux de table : Test réussi = avantage dans le jeu (piocher une carte supplémentaire, relancer
un dé, etc.) ; chaque DR = une opportunité de plus.

Pour influencer par des procédés moins honnêtes : voir Escamotage.

**Sources RAW :** LDB 09 l.386-395

---

### Perception (I) — Base
LDB 09 l.398-401

Percevoir son environnement avec tous les sens (vue, odorat, ouïe, toucher, goût — et tout sens
non humain ou magique). MJ peut demander un Test pour détecter quelque chose, modifié par la
facilité à le remarquer. Utilisé pour résister aux tentatives de dissimulation (Escamotage,
Discrétion).

**En combat :** remarquer des détails importants (déterminés par le MJ).

**Sources RAW :** LDB 09 l.398-401

---

### Piégeage (Dex) — Avancée
LDB 09 l.404-407

Poser et désarmer des pièges de toutes sortes. Si Compétence possédée et temps suffisant :
activation/désarmement automatiques. Test requis si rapidité ou pression, ou piège complexe.

Poser/désarmer un piège standard : Test Accessible (+20%). Appareils complexes : Test étendu sur
plusieurs Rounds.

**Sources RAW :** LDB 09 l.404-407

---

### Pistage (I) — Avancée
LDB 09 l.410-413

Suivre des traces subtiles laissées par d'autres. Distincte de Perception (empreintes évidentes dans
la neige = simple Test de Perception ; Pistage implique une lecture profonde des signes de passage).
Peut aussi servir à dissimuler ses propres traces (opposé au Pistage du poursuivant).

Test étendu souvent requis ; Difficulté selon fraîcheur et terrain. MJ peut aussi appliquer les
règles de Poursuite.

**Sources RAW :** LDB 09 l.410-413

---

### Prière (Soc) — Avancée
LDB 09 l.415-421

Invoquer ou communier avec une divinité. Voir [Religion](religion.md) pour les détails d'intervention
divine.

**En combat :** si le MJ l'autorise (situation et foi appropriées) : chaque Round de prière (Test
de Prière réussi) = +1 Avantage. Maximum = Bonus de Sociabilité.

Si les ennemis comprennent votre langue et connaissent/craignent votre divinité : le MJ peut
autoriser Prière à la place de la Compétence Intimidation.

**Sources RAW :** LDB 09 l.415-421

---

### Projectiles (Ct) — Avancée, Groupée
LDB 09 l.424-428

Utiliser des armes à distance spécifiques (chaque Spécialisation = un groupe d'armes). Lancer une
simple pierre sans spécialisation = Capacité de Tir nue. Sans la Spécialisation : pénalités définies
au Chapitre 11. Voir [Combat](combat.md).

**AA (armes de siège, AA 10 l.142-148) :** Arbalète → Baliste ; Catapulte → groupe propre ;
Ingénierie → Poudre noire lourde. Équipe réduite = double temps de recharge + Compétence la plus
faible de l'équipe.

**Sources RAW :** LDB 09 l.424-428 ; AA 10 l.142-148

---

### Ragot (Soc) — Base
LDB 09 l.431-438

Dénicher des informations utiles et répandre des rumeurs. Test réussi = renseignement utile (donné
par le MJ). Chaque DR = renseignement supplémentaire ou répandre une rumeur à Bonus de Soc individus.
Temps requis selon discrétion du groupe et densité de population (MJ).

**Sources RAW :** LDB 09 l.431-438

---

### Ramer (F) — Base
LDB 09 l.440-443

Manier une pagaie et diriger un bateau sur l'eau. Si Compétence possédée et eau calme : automatique
sans Test. Courses-poursuites, rapides, prouesses dangereuses : Test requis. Sans Compétence : Test
même pour manœuvres basiques.

**Sources RAW :** LDB 09 l.440-443

---

### Recherche (Int) — Avancée
LDB 09 l.445-457

Dénicher des connaissances utiles dans des bibliothèques et mines d'informations. Nécessite le
Talent Lire/Écrire. Si Compétence possédée et bibliothèque bien indexée : infos simples automatiques.
Pour info spécifique ou sous pression : Test étendu (Difficulté selon taille de bibliothèque, DR cible
selon obscurité du sujet). Petite bibliothèque ~5 min par Test ; grande bibliothèque ~1 h par Test ou
plus.

**Sources RAW :** LDB 09 l.445-457

---

### Représentation (Ag) — Avancée, Groupée
LDB 09 l.460-465

Arts physiquement exigeants (saltimbanque, carnaval itinérant). Test réussi = divertir les
spectateurs à portée, DR = qualité.

**En combat :** Représentation (Acrobaties) peut remplacer Esquive (accord MJ). D'autres
Spécialisations peuvent servir d'arme si équipement approprié (ex. Représentation (Cracheur de feu)).

**Sources RAW :** LDB 09 l.460-465

---

### Résistance (E) — Base
LDB 09 l.468-469

Supporter des conditions difficiles, privation, attente prolongée, environnements hostiles. Résister
ou se remettre des États (voir [États](etats.md)). Aider à récupérer des Points de Blessure perdus.

**Sources RAW :** LDB 09 l.468-469

---

### Résistance à l'alcool (E) — Base
LDB 09 l.472-487

Consommer de l'alcool sans altérer le jugement. Après chaque boisson alcoolisée : Test de Résistance
à l'alcool (modificateur selon puissance). Chaque échec : −10 à CC, CT, Ag, Dex et Int (max −30 par
Caractéristique). Si échecs = Bonus d'Endurance : Ivre.

**Table d'Ivresse (d10) :**

| d10 | Effet |
|---|---|
| 1–2 | « Bravoure du Marienburgher ! » : +20 à Calme |
| 3–4 | « Vous êtes mon meilleur ami ! » : ignorer Préjugés et Animosités |
| 5–6 | « Pourquoi est-ce que la pièce tourne ? » : Mouvement OU Action au tour, pas les deux |
| 7–8 | « Je vais tous vous prendre un par un ! » : Animosité (Tout le monde !) |
| 9–10 | « Comment je suis arrivé là ? » : réveil le lendemain avec gueule de bois ; Test de Résistance à l'alcool ou État Empoisonné |

Après 1 h sans boire : Test Intermédiaire (+0) ; effets de l'ivresse se dissipent après 10−DR heures,
modifs de Carac disparaissent. Puis gueule de bois = État Exténué, 5−DR heures non retiré.

Dépenser 1 Point de Détermination : ignorer les malus d'ivresse jusqu'à la fin du prochain Round.

**Sources RAW :** LDB 09 l.472-487

---

### Savoir (Int) — Avancée, Groupée
LDB 09 l.490-495

Étude officielle d'une branche de connaissances avancées. Si Compétence possédée : informations
utiles courantes sans Test. Pour infos spécifiques moins connues : Test de Savoir (modificateur selon
obscurité), DR = niveau de détail.

**En combat :** Test réussi possible = +1 Avantage si la spécialisation est pertinente (Géologie en
caverne, Ingénierie face à un dispositif mécanique, etc.) ; accord MJ. Maximum = Bonus d'Int.

**Sources RAW :** LDB 09 l.490-495

---

### Signes secrets (Int) — Avancée, Groupée
LDB 09 l.498-520

Utiliser des marques clandestines lisibles uniquement des membres d'un groupe sélectionné (vagabonds,
voleurs, guildes, guetteurs, etc.). Généralement sans Test si les signes sont visibles. Test requis si
signes modifiés, effacés, ou si pression temporelle. Messages très simples (3 mots max en général).

**Sources RAW :** LDB 09 l.498-520

---

### Soin aux animaux (Int) — Avancée
LDB 09 l.521-535

S'occuper des animaux malades ou blessés. Une seule Augmentation = garder les animaux en bonne santé
sans Test. Test de Soin aux animaux pour :

- Déceler une maladie.
- Comprendre désobéissance ou inconfort.
- Déterminer spécificités de l'animal.
- Guérir Bonus d'Intelligence + DR blessures (un seul lancer par rencontre).
- Stopper un État Hémorragique.
- Préparer l'animal pour une démonstration.

**En combat :** Test réussi = évaluer un animal ennemi → vous et tous informés gagnez +10 pour
toucher cet animal (ou son cavalier) jusqu'à la fin du prochain tour. Maximum +10 par animal.

**Sources RAW :** LDB 09 l.521-535

---

### Subornation (Soc) — Base
LDB 09 l.538-548

Juger si une personne peut être soudoyée et présenter le pot-de-vin de façon optimale. Test réussi =
savoir si la cible peut être corrompue. Le MJ détermine secrètement le prix (basé sur le Revenu de la
cible, honnêteté, risque). Chaque DR = estimation supplémentaire du montant cible.

**En combat :** possible pour stopper le combat, mais Test Difficile (−20) dû au stress. Inefficace
si la cible n'est pas réceptive, ne parle pas la langue, ou si les ennemis ont l'avantage du nombre.

**Sources RAW :** LDB 09 l.538-548

---

### Survie en extérieur (Int) — Base
LDB 09 l.551-565

Survivre dans la nature : pêcher, chasser, fourrager, faire un feu, construire un abri. Repérer
signes de changement de météo et traces de bêtes dangereuses.

Lors d'un campement : Test modifié par la rudesse des conditions (Intermédiaire +0 sous la pluie,
Difficile −20 en tempête). Succès = nourriture et abri pour soi, chaque DR = 1 Personnage de plus.
Échec = Test de Résistance Intermédiaire (+0) ou État Exténué. Échec Stupéfiant = événement
fâcheux (MJ).

**En combat dans la nature :** Test = +1 Avantage (comme Intuition), max Bonus d'Int.

**Option Trouver nourriture et herbes (LDB 09 l.559-565) :**
- Recherche de nourriture : succès = 1 Personnage nourri, +1 par DR.
- Chasser/pêcher (avec équipement) : succès = 2 Personnages, +2 par DR.
- Piégeage : même résultat que chasse/pêche.
- Savoir (Herbes) : succès = 1 dose de l'herbe recherchée, +1 par DR ; Difficulté selon disponibilité
  (Commune 0 / Limitée −10 / Rare −20 / Exotique −30).

**Sources RAW :** LDB 09 l.551-565

---

### Voile (Ag) — Avancée, Groupée
LDB 09 l.568-573

Piloter et manœuvrer un voilier (nœuds, gouvernail, mesure du vent, etc.). Si équipage entraîné
suffisant et conditions normales : aucun Test pour une navigation ordinaire. Test requis pour
course-poursuite, hauts-fonds dangereux, mauvaises conditions météo, etc.

Peut aussi s'utiliser pour des activités de navigation : faire des nœuds, ligoter des personnes.

Particularité : posséder une Spécialisation Voile rend toutes les autres Spécialisations de Base
pour ce personnage.

**Sources RAW :** LDB 09 l.568-573

---

## Règle optionnelle — Caractéristique alternative

**LDB 09 l.293-294 :** Pour Intimidation, le MJ peut autoriser une Caractéristique différente de F :
- Fm (ex. Répurgateur intimidant par sa foi)
- Int (ex. universitaire impressionnant un étudiant par ses connaissances)

**LDB 09 l.358 :** Pour Métier utilisé comme Savoir, le MJ peut préférer Int à Dex (souvent ignoré
pour simplifier).

**ADE II 2 l.728 :** Pour les lanceurs ogres, Langue (Magick) utilise l'Endurance au lieu de
l'Intelligence. (Voir section dédiée.)

**Sources RAW :** LDB 09 l.293-294 ; LDB 09 l.358 ; ADE II 2 l.728

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 9` (l.293-294, l.358) → `altCharKey`, `useDefenseJetProps`, `rederiveAttack`, `test-metier-int`, `defenseSubOf`, `heal-wounds`, `heal-bleed`, `skill-advantage`, `guerison`, `intimidation`, +9 — `src/data/combat-stakes.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/skills.json`, `src/engine/skills.ts`, +4 fichiers
- `ADE II 2` (l.728) → `altCharKey`, `castingCharKey`, `possession-pas-a-sa-taille`, `gueule`, `DomainData`, `ogre`, `bouf-crane`, `broyeur-d-os`, `festin-des-damnes` — `src/data/domains.json`, `src/data/index.ts`, `src/data/regles.json`, `src/data/spells.json`, `src/data/traits.json`, `src/engine/magic.ts`, +1 fichiers

---

## Extension ogre — Langue (Magick) sur Endurance

Les lanceurs de sorts ogres peuvent apprendre Langue (Magick) si disponible dans leur Carrière.
Cependant, la magie ogre est instinctive. **Les lanceurs ogres utilisent l'Endurance (E) au lieu de
l'Intelligence (Int) pour leur Compétence Langue (Magick).**

> « Les lanceurs de sorts ogres utilisent l'Endurance au lieu de l'Intelligence pour leur Compétence
> Langue (Magick). »
> — ADE II 2 l.728

**Sources RAW :** ADE II 2 l.728

**Implémente :** _(généré — `npm run raw:implemente`)_
- `ADE II 2` (l.728) → `altCharKey`, `castingCharKey`, `possession-pas-a-sa-taille`, `gueule`, `DomainData`, `ogre`, `bouf-crane`, `broyeur-d-os`, `festin-des-damnes` — `src/data/domains.json`, `src/data/index.ts`, `src/data/regles.json`, `src/data/spells.json`, `src/data/traits.json`, `src/engine/magic.ts`, +1 fichiers

---

## Règle optionnelle — Filature (Discrétion + Perception)

Suivre quelqu'un discrètement = **Test Combiné Perception + Discrétion** (LDB 09 l.188-190). Si la
cible cherche activement à brouiller les pistes : opposé à Discrétion de la cible.

- Perception réussie + Discrétion échouée : on suit la cible mais on est repéré.
- Perception échouée + Discrétion réussie : on perd la cible sans être vu.

**Sources RAW :** LDB 09 l.188-190

**Voir aussi :** [Tests](tests.md) → section Tests Combinés.

---

## Applications en combat — résumé par Compétence

| Compétence | Usage combat | Détail |
|---|---|---|
| Athlétisme | Déplacement | Courir, sauter, bondir (voir Déplacement) |
| Calme | Résistance | Résister à Charme, Intimidation, Peur |
| Charme | Action/Défense | Cibles charmées n'attaquent pas ce Round, +1 Avantage |
| Commandement | Action | +10 Tests de Psy alliés ; transférer Avantages |
| Conduite d'attelage | Action | Percuter ennemis, distancer (si véhicule) |
| Corps à corps | Attaque/Parade | Compétence principale de mêlée |
| Discrétion | Préparation | Embuscade, se glisser derrière un adversaire |
| Dressage | Attaque/Défense | Opposé Dressage/FM → Peur sur animal ; remplace Corps à corps |
| Emprise sur les animaux | Action | Aucune cible affectée n'attaque ce Round, +1 Avantage |
| Escalade | Déplacement | Grimper sur de grands adversaires (risqué) |
| Escamotage | Diversion | Gagner un Avantage en tirant une dague de nulle part |
| Esquive | Défense | Résister aux attaques / éviter Dégâts |
| Guérison | Action | Tests Intermédiaires (+0) en combat |
| Intimidation | Attaque/Défense | Peur sur cibles ; remplace Corps à corps en défense |
| Intuition | Accumulation | +1 Avantage par Round, max Bonus d'Int |
| Natation | Déplacement | Remplace Athlétisme dans l'eau |
| Prière | Accumulation | +1 Avantage par Round, max Bonus de Soc ; peut remplacer Intimidation |
| Projectiles | Attaque à distance | Compétence principale de tir |
| Représentation (Acrobaties) | Défense | Peut remplacer Esquive (accord MJ) |
| Représentation (Cracheur de feu) | Attaque | Utilisable comme arme avec équipement |
| Savoir | Accumulation | +1 Avantage selon spécialisation pertinente, max Bonus d'Int |
| Soin aux animaux | Action | +10 pour toucher l'animal évalué jusqu'à la fin du prochain tour |
| Subornation | Arrêt du combat | Test Difficile (−20) pour stopper le combat |
| Survie en extérieur (nature) | Accumulation | +1 Avantage, max Bonus d'Int |

---

## Extension (PDT) — Hypnotisme (Int, Avancée)

**Hypnotisme (Int) — Avancée.** Compétence de supplément (*Le Pouvoir derrière le Trône*, Annexe III), utilisée par certains Saltimbanques et Mystiques (parfois à visée médicale). Permet de mettre un Personnage en **transe** : tant qu'elle dure, la cible n'a conscience que de la voix de l'hypnotiseur, répond honnêtement, peut retrouver des souvenirs réprimés (traumatisme) ou effacés (sort), et reçoit des **suggestions inconscientes** exécutées jusqu'à la fin de la séance.

**Mise en transe** : l'attention du sujet doit rester focalisée sur l'hypnotiseur **≥ 1 minute** (voix douce et monotone, pendule facultatif). Sujet **coopératif** → Test d'Hypnotisme **simple** ; sujet récalcitrant → il peut **résister par un Test de Force Mentale**. Sur réussite, le sujet entre en transe :
- **volontaire** : reste en transe jusqu'à la fin de la séance ;
- **contraint** : a droit à un **Test de Calme par Round, opposé à l'Hypnotisme** de l'hypnotiseur ; sur un succès seulement **Minime**, il sort de la transe mais subit 1 État *Sonné*.

**Interrogatoire** : le sujet doit répondre honnêtement. Après la 1ʳᵉ question, **chaque nouvelle question = un Test d'Hypnotisme à −5 cumulatif**. Réussite → réponse honnête. **Échec Minime** → pas de réponse, reste en transe. Échec plus grave → la séance s'arrête, le sujet se réveille (1 État *Sonné* sur Échec Impressionnant, 2 sur Échec Stupéfiant).

**Suggestions post-hypnotiques** : **Test opposé Hypnotisme vs Force Mentale** du sujet. Si le sujet connaît la suggestion et la désire (p. ex. oublier un souvenir source de cauchemars/folie) → **+30** à l'hypnotiseur, mais un Test reste requis. La suggestion est poursuivie jusqu'à accomplissement, ou retrait lors d'une autre séance.

**Carrières autorisées** (au gré du MJ) : Médecin, Prêtre (dieux de guérison/vérité), Érudit, Sorcier (Gris, Lumière, + cultes de Slaanesh et Tzeentch), Espion, Sorcier de village, Mystique, Saltimbanque, Charlatan.

**Sources RAW** :
- `PDT 12 l.5` — Hypnotisme = Compétence Avancée (Int) ; avertissement au MJ sur son usage.
- `PDT 12 l.13-18` — transe : conditions (≥ 1 min), Test simple (coopératif) / résistance en Force Mentale ; sortie d'un sujet contraint (Calme/Round opposé ; succès Minime → *Sonné*).
- `PDT 12 l.22` / `l.51` — interrogatoire : −5 cumulatif par question ; échecs (Minime = pas de réponse ; Impressionnant/Stupéfiant = réveil + 1/2 *Sonné*).
- `PDT 12 l.26-28` — suggestions post-hypnotiques (Test opposé Hypnotisme/FM ; +30 si consentant).
- `PDT 12 l.33-44` — carrières pouvant acquérir la Compétence.

> « L'hypnotisme est une Compétence Avancée utilisée par certains Saltimbanques et autres Mystiques. » — `PDT 12 l.5`

**Voir aussi** : Tests opposés (`tests.md`), État *Sonné* (`etats.md`), Force Mentale / Calme (`psychologie.md`).
**Implémente :** _(généré — `npm run raw:implemente`)_
- `PDT 12` (l.5, l.13-18, l.22, l.26-28, l.33-44) → `hypnotisme` — `src/data/skills.json`

---

---

## Augure (Int) — Compétence Avancée (VDM)

**Augure (Int) — Avancée.** Compétence introduite par *Les Vents de Magie* : la **capacité de glaner des informations sur le futur**. Le supplément ajoute deux Compétences d'Arcane, Augure et Psychométrie.

> « Les Vents de Magie présente deux nouvelles compétences, Augure et Psychométrie, et apporte des détails supplémentaires à la Compétence Métier lorsqu'elle est utilisée avec l'Alchimie. »
> — VDM 03 l.458

> « L'Augure est une Compétence Avancée et la capacité à glaner des informations sur le futur. »
> — VDM 03 l.468

**Méthodes d'usage** (l.428-432, exemples RAW) : interprétation des rêves / visions prophétiques (Prêtres de Morr, Sœurs de Sigmar), lecture des étoiles (sorciers Célestes), outils divinatoires (cartes, dés des Mystiques), consultation du **Thaumodivinator** à Altdorf, pactes démoniaques (Kairos, Gardien des Secrets).

**Règles de Test :**
- **Un seul Test d'Augure par jour.** Auguer pour autrui est possible mais devient un Test d'**Augure Complexe (−10)**.

> « Un Personnage ne peut effectuer qu'un seul Test d'Augure par jour. Il peut également faire des Tests d'Augure au nom d'autres Personnages, mais transmettre des visions prophétiques de façon pertinente s'avère compliqué. Ces Tests sont alors des Tests d'**Augure Complexes (−10)**. »
> — VDM 03 l.476

- Sur réussite, **le MJ décide de l'information** (développement d'intrigue plausible, motivation d'un PNJ clef) ; les échecs livrent des informations trompeuses. À défaut, on emploie le **Tableau d'Augure** (effet selon les DR) puis le **Tableau des Symboles**.
- Un même symbole obtenu plus d'une fois : les jets suivants sont perdus. On ne peut pas choisir de symboles inversés.

> « Si vous obtenez le même symbole plus d'une fois, les jets suivants sont perdus : l'Augure est à ce point versatile. Vous ne pouvez pas choisir de symboles inversés. »
> — VDM 03 l.480

- **Après un augure**, +1 DR (ou −1 DR au choix) au **premier Test** lié à la Compétence listée pour le symbole ; une **inversion** (issue d'un échec) impose **−1 DR** au premier Test lié. L'effet s'applique une seule fois par Compétence listée.

> « Après avoir reçu un augure, un Personnage peut bénéficier de +1 DR (ou −1 DR s'il préfère) au premier Test qu'il effectue en lien avec la Compétence listée dans le Tableau des Symboles. »
> — VDM 03 l.483

> « Une pénalité de −1 DR est imposée au premier Test en lien avec celles-ci, puisque le Personnage est induit en erreur à cause de sa compréhension erronée du futur. »
> — VDM 03 l.485

### Tableau d'Augure

| DR | Résultat | Effet |
|---|---|---|
| +6 ou plus | Succès Stupéfiant | Choisissez deux symboles sur le Tableau des Symboles. |
| +4 à +5 | Succès Impressionnant | Effectuez deux lancers sur le Tableau des Symboles. |
| +2 à +3 | Succès | Choisissez un symbole sur le Tableau des Symboles. |
| +0 à +1 | Succès Minime | Effectuez un lancer sur le Tableau des Symboles. |
| −0 à −1 | Échec Minime | Aucune information n'est reçue. |
| −2 à −3 | Échec | Effectuez un lancer sur le Tableau des Symboles. Le symbole est inversé. |
| −4 à −5 | Échec Impressionnant | Effectuez deux lancers sur le Tableau des Symboles. Les symboles sont inversés. |
| −6 ou moins | Échec Stupéfiant | Effectuez trois lancers sur le Tableau des Symboles. Les symboles sont inversés. |

### Tableau des Symboles

| Lancer | Symbole | Significations courantes | Tests associés |
|---|---|---|---|
| 1 | Morrslieb | Malheur, Chaos | Tests de Perception. Inversé : Tests pour résister à la Corruption. |
| 2 | Morr | Mort, Rêves | Tests d'Intuition. Inversé : Intuition. |
| 3 | Ulric | Bataille, Loups, Hiver | Tests d'Emprise sur les animaux, Résistance, Survie en extérieur. Inversé : Tests de Projectiles (Poudre noire). Tests pour résister à Préjugé ou à Animosité. |
| 4 | La Tour | Orgueil, Menace cachée | Subornation, Discrétion Inversé : Perception. |
| 5 | Sigmar | Victoire, Unité, Espoir | Test de Commandement. Inversé : Focalisation |
| 6 | Le Marteau Légendaire | Défier le Mal | Tests de Corps à corps (au choix). Tests pour résister à la Corruption. Inversé : Projectiles (au choix), Charme. |
| 7 | Verena | Justice, Sagesse | Tests de Charme pour convaincre une personne de la vérité. Savoir (au choix). Inversé : Crochetage, Escamotage, Focalisation (Ulgu). |
| 8 | Blitzbeil | Force, Férocité | Tests pour entrer en Frénésie. Corps à corps (Base). Inversé : Ragot, Marchandage. |
| 9 | Le Donjon | Courage, Sécurité | Tests de Corps à corps (Base) pour s'opposer à des attaques. Inversé : Athlétisme, Escalade. |
| 10 | Le Démon | Manipulation, Danger | Tests de Focalisation, Charme, Langue (Magick). Inversé : Commandement. |

### Accès et restrictions

Carrières y accédant au premier Échelon, et restriction de race :

> « Les Carrières suivantes devraient avoir accès à la Compétence d'Augure au premier Échelon : Mystique, Nonne (sous réserve d'avoir les Talents *Béni (Sigmar* ou *Morr)* ou *Invocation (Sigmar* ou *Morr)*), Prêtre (moyennant le Talent *Béni (Morr)* ou *Invocation (Morr)*) et Prêtre Guerrier (à condition d'avoir le Talent *Béni (Morr)* ou *Invocation (Morr)*). Seuls les humains et les elfes peuvent choisir cette Compétence. »
> — VDM 03 l.519

Accès démoniaque, avec risque de Corruption :

> « N'importe quel Personnage ayant le Talent *Magie des Arcanes (Démonologie)* peut apprendre la Compétence Augure pour figurer un entretien avec des démons à propos de son destin. Néanmoins, à chaque fois qu'il obtient Le Démon sur le Tableau des Symboles, il subit une Exposition Modérée à la Corruption (**WFJDR**, page 182). »
> — VDM 03 l.521

> « Un Personnage ne peut pas posséder en même temps les Compétences Augure et Psychométrie. »
> — VDM 03 l.523

**Sources RAW** : VDM 03 l.416, l.426, l.434, l.436, l.438, l.441, l.443, l.445-455 (Tableau d'Augure), l.461-472 (Tableau des Symboles), l.477, l.479, l.481

**Voir aussi** : [Tests & Degrés de Réussite](tests.md) (DR, difficultés), [Corruption](corruption.md) (Exposition Modérée), [Talents](talents.md) (Béni / Invocation / Magie des Arcanes), [Psychométrie](#psychométrie-int--compétence-avancée-vdm) (exclusion mutuelle).

---

## Le Thaumodivinator (VDM)

Appareil en cuivre d'Altdorf (disques et anneaux symboliques) construit par l'Ordre Doré et rempli d'amulettes divinatoires par l'Ordre Céleste, qui **révèle des symboles de futur contre une pistole**.

> « Le Thaumodivinator est un mécanisme inventé par un conclave de sorciers pour révéler le futur. »
> — VDM 03 l.527

Il permet à quiconque — sans posséder Augure — d'obtenir une prédiction via un Test d'**Intelligence** (et non d'Augure) :

> « Quiconque dépense une pistole dans la machine peut effectuer un Test d'**Intelligence Complexe (−10)** à la place d'un Test d'Augure. Si l'intéressé a le Talent *Lire/Écrire*, le Test d'**Intelligence** devient **Accessible (+20)**. »
> — VDM 03 l.531

On applique ensuite les Tableaux d'Augure et des Symboles pour déterminer les effets.

**Sources RAW** : VDM 03 l.485, l.489

**Voir aussi** : [Augure (Int)](#augure-int--compétence-avancée-vdm) (Tableaux), [Économie](economie.md) (pistole), [Talents](talents.md) (Lire/Écrire).

---

## Sorts prémonitoires — Surincantation d'Augure (VDM)

Certains Sorts Célestes (LDB) offrent des visions du futur :

> « Il existe plusieurs Sorts au catalogue des sorciers Célestes qui leur offrent des visions du futur, comme *Ironie du Destin, Maudit*, et les trois *Signes d'Amul*. Voir **WFJDR**, pages 246–247, pour en savoir plus sur ceux-ci. »
> — VDM 03 l.535

VDM ajoute une **surincantation** propre à ces Sorts : le lanceur peut convertir des DR excédentaires du Test d'Incantation en jets sur le Tableau des Symboles (mécanique de la Surincantation LDB) :

> « Outre les effets décrits par ces Sorts, le lanceur peut dépenser n'importe quel nombre de DR supplémentaires au Test d'Incantation pour recevoir une vision prophétique plus claire. Ceci fonctionne de la même manière que la Surincantation, décrite page 23. En plus d'ajouter des cibles, d'étendre la zone d'effet ou autre, un sorcier Céleste peut choisir d'effectuer un jet sur le Tableau des Symboles. »
> — VDM 03 l.537

Contrepartie en cas d'Incantation Imparfaite :

> « Si une Incantation Imparfaite survient durant le lancement de l'un d'eux, le MJ peut effectuer un lancer sur le Tableau des Symboles et attribuer à la cible du Sort un symbole inversé parallèlement aux autres effets d'Incantation Imparfaite. »
> — VDM 03 l.539

### Table de surincantation des sorts d'Augure

| DR | Effet |
|---|---|
| 1 | Effectuez un lancer sur le Tableau des Symboles. |
| 2 | Effectuez un lancer sur le Tableau des Symboles. |
| 3 | Choisissez un symbole sur le Tableau des Symboles. |
| 5 | Choisissez un symbole sur le Tableau des Symboles. |
| 8 | Effectuez deux lancers sur le Tableau des Symboles. |
| 13 | Effectuez deux lancers sur le Tableau des Symboles. |
| 21 ou plus | Choisissez deux symboles sur le Tableau des Symboles. |

**Sources RAW** : VDM 03 l.493, l.495, l.497, l.499-509 (table de surincantation)

**Voir aussi** : [Magie](magie.md) (Test d'Incantation, Surincantation, Incantation Imparfaite), [Augure (Int)](#augure-int--compétence-avancée-vdm) (Tableau des Symboles).

---

## L'Augure et les stupéfiants (VDM)

Certaines herbes et concoctions déclenchent des visions, y compris pour un personnage sans la Compétence Augure — mais les prophéties d'un profane sont peu fiables.

> « Les visions prophétiques se révèlent grâce à certaines herbes et concoctions. Ingurgiter de la liqueur de rêve ou avaler un gros morceau de mystracine peut permettre à quelqu'un qui n'en est normalement pas capable de recevoir une vision. Ce n'est pas une science exacte, et les prophéties reçues par ceux qui manquent d'entraînement et d'expérience dans la Compétence Augure doivent rarement être prises pour argent comptant. »
> — VDM 03 l.556

### La liqueur de rêve

Détails et effets dans *Altdorf, la Couronne de l'Empire* p.185 (l.518). Règles d'usage avec Augure :

> « Le buveur doit d'abord faire un Test de **Résistance à l'alcool Intermédiaire (+0).** S'il le réussit, il n'y a pas d'effet, mais s'il échoue, il pourra avoir des visions. »
> — VDM 03 l.565

> « Tant qu'il est sous les effets de la liqueur de rêve, le buveur bénéficie des Talents *Sixième sens* et *Perception de la magie* et gagne un bonus de +2 DR à tous les Tests d'Intuition. »
> — VDM 03 l.567

> « Le buveur choisit soit un Point de Chance supplémentaire (qu'il doit dépenser au cours de la session), soit un lancer sur le Tableau d'Augure en utilisant son Intelligence plutôt que la Compétence Augure. »
> — VDM 03 l.568

> « Que le buveur réussisse ou non le Test de Résistance à l'alcool, il doit effectuer un Test pour une Exposition Modérée à la Corruption (**WFJDR**, page 182). Il doit également réussir un Test de **Calme Accessible (+20)** ou « entendre l'appel ». Il peut l'entendre un nombre de fois égal à son Bonus de Force Mentale. Au-delà, il doit dépenser un Point de Destin ou bien renoncer à sa vie pour partir en quête des vignobles des Montagnes Grises où le vin est produit. »
> — VDM 03 l.569

> « La liqueur de rêve est considérée comme hautement dangereuse ; sa vente et sa consommation sont interdites dans l'Empire. »
> — VDM 03 l.571

### La mystracine

> « La mystracine est mâchée et entraîne un sentiment d'euphorie et d'hallucinations agréables, la reliant, selon certains, à *Azyr*. Une dose donne un bonus de +10 aux Tests d'Endurance et de Force Mentale, mais une pénalité de −10 à ceux d'Agilité, d'Initiative et d'Intelligence. »
> — VDM 03 l.575

> « **Durée :** Active lorsqu'elle est mâchée plus 1d10 × 10 minutes supplémentaires. »
> — VDM 03 l.577

> « La plupart des gens qui mâchent de la mystracine savent comment ne pas s'arrêter sur ses visions – réputées peu fiables. Néanmoins, si un consommateur le souhaite, il peut effectuer un Test d'**Intelligence Difficile (−20)** au lieu d'un Test d'Augure. »
> — VDM 03 l.579

### Autres stupéfiants

> « D'autres substances existent, comme les champignons amanites mauves (voir l'**Empire en Ruines – Compagnon** pour plus d'informations). Elles peuvent être utilisées pour effectuer des Tests d'Intelligence à la place des Tests d'Augure, mais ceux-ci doivent être au minimum Difficile et provoquer d'autres effets secondaires. »
> — VDM 03 l.583

**Sources RAW** : VDM 03 l.514, l.523, l.525, l.526, l.527, l.529, l.533, l.535, l.537, l.541

**Voir aussi** : [Augure (Int)](#augure-int--compétence-avancée-vdm), [États](etats.md), [Corruption](corruption.md) (Exposition Modérée), [Destin](destin.md) (Point de Chance / de Destin), [Talents](talents.md) (Sixième sens, Perception de la magie).

---

## Psychométrie (Int) — Compétence Avancée (VDM)

**Psychométrie (Int) — Avancée.** Capacité innée rare (des « devins ») de lire le passé au contact d'un lieu, d'un objet ou d'une personne.

> « La Psychométrie est une capacité innée difficile à maîtriser et possédée par un faible nombre d'humains, appelés devins. Nombre d'entre eux souffrent d'une profonde angoisse à cause de leurs dons. À l'aide de cette Compétence Avancée, un Personnage peut recevoir des visions et sensations relatives à un évènement récent ou des pensées non exprimées par une autre personne. La Compétence est basée sur l'Intelligence et pour l'utiliser un devin doit soit se trouver dans un endroit lié à un évènement, soit toucher un objet associé à un évènement ou une personne dont il cherche à lire les pensées. »
> — VDM 03 l.587

**Nature de l'information reçue** (l.550) : objet employé, heure de l'évènement, nombre de personnes impliquées, préoccupation ou apparence d'un participant, son honnêteté, une sensation, une odeur ou un goût fort.

**Coût du Test** — chaque usage épuise :

> « La divination exige un effort mental et physique considérable. Chaque fois qu'un Personnage effectue un Test de Psychométrie, quel qu'en soit le résultat, il doit réaliser un Test de **Résistance Accessible (+20)** ou gagner un État *Exténué*. »
> — VDM 03 l.594

**Acquisition** — la Compétence peut se prendre à la création en échangeant un Talent aléatoire, mais son augmentation est verrouillée derrière certaines Carrières :

> « un Personnage peut prendre la Compétence Psychométrie à la création de son Personnage s'il abandonne l'un de ses Talents aléatoires. De plus, avant qu'il ne puisse dépenser des Points d'Expérience pour l'augmenter, le Personnage devrait entamer l'une des Carrières suivantes : »
> — VDM 03 l.600

Carrières requises (l.560-567) : Mystique, Sorcier de village, Nonne, Prêtre, Devin, Prêtre guerrier, Sorcier dissident, Sorcier (LDB ou de VDM).

> « Ces limites ne s'appliquent pas aux Personnages dont la Carrière de départ est Devin. Seuls les Personnages humains peuvent choisir cette Compétence. »
> — VDM 03 l.611

### Tableau du résultat de Psychométrie

| DR / Résultat | Général | Exemple de cambriolage |
|---|---|---|
| +6 ou plus — Succès Stupéfiant | Au moins trois informations sont reçues, dont l'une est extrêmement pertinente. | Le devin ressent un profond sentiment de peur. Il voit un groupe de rustres casser une fenêtre. Une voix dit : « T'as rien vu, pigé ? » |
| +4 à +5 — Succès Impressionnant | Deux informations sont reçues. | Le devin voit l'un des rançonneurs s'approcher d'une fenêtre avec un caillou dans la main et se sent incapable de parler. |
| +2 à +3 — Succès | Une information est reçue. | Le devin entend du verre se briser. |
| +0 à +1 — Succès Minime | Vague impression de l'évènement. Une information est révélée de manière métaphorique. | Le devin voit un poisson dans l'eau. La bande de rançonneurs appartient à une organisation connue sous le nom du « Poisson ». |
| −0 à −1 — Échec Minime | Aucune information n'est reçue. | Le devin ne parvient pas à lire quoi que ce soit d'utile. |
| −2 à −3 — Échec | Une information légèrement trompeuse est reçue. | Le devin comprend que la victime avait peur de quelqu'un qui n'a aucun lien avec le crime. |
| −4 à −5 — Échec Impressionnant | Le Devin reçoit des impressions dérangeantes et trompeuses. | Le devin est envahi par des émotions et des images, mais rien de pertinent. |
| −6 ou moins — Échec Stupéfiant | Submergé par des impressions cauchemardesques. Plus un point de Corruption. | Le devin est submergé par un sentiment de peur, d'impuissance et de honte. Il reçoit un point de Corruption. |

**Sources RAW** : VDM 03 l.545, l.550, l.552, l.558, l.560-567 (carrières), l.569, l.571-581 (tableau du résultat)

**Voir aussi** : [États](etats.md) (Exténué), [Corruption](corruption.md), [Création de personnage](creation.md) (échange d'un Talent aléatoire), [Carrières](carrieres.md), [Augure (Int)](#augure-int--compétence-avancée-vdm) (exclusion mutuelle).

---

## Alchimie ordinaire — Métier (Alchimiste) (VDM)

VDM détaille l'usage de **Métier (Alchimiste) (Dex)** pour l'alchimie. Le Collège Doré distingue Basse et Haute Alchimie :

> « La Basse Alchimie, comme l'appelle le Collège Doré, comprend l'extraction de métaux à partir d'un minerai ou la construction d'appareils optiques simples. Elle peut être l'œuvre de n'importe quel érudit, mais la Haute Alchimie suppose de manipuler Chamon d'une manière qui peut être facilement confondue avec la pratique de la magie. »
> — VDM 03 l.464

> « Quiconque possède la Compétence Métier (Alchimiste) peut s'essayer à l'alchimie ordinaire ou « Basse Alchimie ». Pour l'essentiel, elle consiste à isoler des éléments chimiques, les combiner pour créer des composés, ou encore se servir de la connaissance scientifique lors de la création de petits artefacts simples. »
> — VDM 03 l.636

**Prérequis matériel :**

> « Pour pouvoir utiliser la Compétence Métier (Alchimiste), un Personnage a besoin d'un laboratoire ou de posséder le Talent Concocter (**WFJDR**, page 135). »
> — VDM 03 l.638

**Risque (Maladresse) :**

> « Si un Personnage obtient une Maladresse à un Test de Métier (Alchimiste) pour créer un artefact alchimique, quelque chose s'est terriblement mal passé. Lancez 1d10, ajoutez les degrés d'échec et consultez le **Tableau des Catastrophes de brassage** à la page 161. »
> — VDM 03 l.640

**Procédés (chacun un Test de Métier (Alchimiste)) :**

- **Isoler des éléments de base** (métal d'un minerai, soufre, gaz porteur…) : Test **Accessible (+20)**.

Bonus de production (mécanisme partagé Isoler/Fabriquer) : chaque +DR obtenu améliore de 5 % la production unitaire, jusqu'à un maximum de 20 %, sans augmenter le prix des matériaux bruts (VDM 03 l.621, répété l.627).

- **Fabriquer un composé simple** (savon, teinture, encre, huile minérale, poudre noire…) : Test **Intermédiaire (+0)** après un temps de préparation variable ; même bonus de +5 % par +DR (max 20 %).

> « Pour créer un composé simple, un alchimiste doit réunir les matériaux bruts, les préparer pendant un certain temps (la poudre noire peut prendre plusieurs heures ; les teintures, des mois) et effectuer un Test de **Métier (Alchimiste) Intermédiaire (+0)**. »
> — VDM 03 l.669

- **Substances caustiques / corrosives** (acides, alcalis) — utilisables comme arme :

> « Ils peuvent être lancés avec un effet similaire à celui d'une bombe incendiaire (**WFJDR**, page 295), même si tout État *En flammes* qui en résulte est une brûlure chimique plutôt que du feu à proprement parler. »
> — VDM 03 l.673

- **Magnétisme** :

> « Ils peuvent créer un aimant après une journée de travail et un Test de **Métier (Alchimiste) Accessible (+20)** ou fabriquer une boussole après deux jours de travail et un Test de **Métier (Alchimiste) Intermédiaire (+0)**. »
> — VDM 03 l.677

- **Optique** :

> « Un simple miroir ou une loupe peuvent être conçus après une journée de travail et un Test de **Métier (Alchimiste) Accessible (+20)**. Un périscope simple ou un télescope prennent une semaine et un Test de **Métier (Alchimiste) Intermédiaire (+0)**. »
> — VDM 03 l.681

**Trouver un client** (vente) :

> « Faites un Test de Ragot afin de trouver un acheteur solvable, la difficulté de ce Test varie selon le produit que vous essayez de vendre. Vous ne pouvez effectuer qu'un seul test par jour. »
> — VDM 03 l.685

### Produits alchimiques (fabrication et vente)

| Produit | Unités | Coût unitaire des matériaux bruts | Temps de préparation | Valeur unitaire sur le marché | Difficulté du Test de Ragot |
|---|---|---|---|---|---|
| Un demi-kilo d'argent | 1 | 10/– | 1 semaine | 1 CO | Facile (+40) |
| Vessies de gaz porteur | 12 | 14/– | 2 jours | 1 CO 6/– | Très Difficile (−30) |
| Tonnelet de poudre noire (contenant assez pour 12 poires à poudre, qui permettent chacune 12 tirs) | 1 | 4/– | 3 jours | 8/– | Intermédiaire (+0) |
| Tonnelet de poudre noire améliorée (contenant assez pour 12 poires à poudre, qui contiennent chacune 12 munitions) | 1 | 4/– | 5 jours | 2 CO | Complexe (−10) |
| Pains de savon | 24 | –/4 | 1 semaine | –/8 | Complexe (−10) |
| Fioles de teinture (verte ou jaune) | 120 | –/3 | 1 semaine | 1/– | Complexe (−10) |
| Fioles de teinture (rouge ou bleue) | 60 | –/6 | 1 semaine | 2/6 | Difficile (−20) |
| Fiole de teinture (pourpre ou violette) | 12 | 2 CO | 1 mois | 10 CO | Très Difficile (−30) |
| Fioles de liquide caustique/corrosif | 12 | –/6 | 2 jours | 1/3 | Complexe (−10) |
| Aimant | 1 | 1/– | 1 jour | 3/– | Difficile (−20) |
| Boussole | 1 | 4/– | 3 jours | 1 CO | Difficile (−20) |
| Prisme | 1 | 4/– | 2 jours | 1 CO | Très Difficile (−30) |
| Miroir à main | 1 | 5/– | 3 jours | 1 CO 1/6 | Difficile (−20) |
| Bésicles | 1 | 6/6 | 1 semaine | 3 CO | Très Difficile (−30) |
| Périscope (1 mètre) | 1 | 15/– | 1 semaine | 3 CO | Très Difficile (−30) |
| Télescope | 1 | 1 CO | 2 semaines | 5 CO | Très Difficile (−30) |

**Sources RAW** : VDM 03 l.422, l.586, l.594, l.596, l.598, l.621, l.627, l.631, l.635, l.639, l.643, l.646-664 (table des produits alchimiques)

**Voir aussi** : [Talents](talents.md) (Concocter, Seconde vue), [Combat](combat.md) (bombe incendiaire, État En flammes), [Équipement](equipement.md), [Économie](economie.md) (notation monétaire CO / schillings / pennies), [Haute Alchimie](#haute-alchimie-vdm).

---

## Le laboratoire alchimique portatif (VDM)

Nécessaire de voyage requis (à défaut d'un laboratoire fixe ou du Talent Concocter) pour pratiquer l'alchimie sur le terrain.

> « Ouverte, cette grande malle de voyage révèle les outils du métier d'alchimiste : un mortier et un pilon, des creusets, une petite forge, des outils d'artisan pour le travail du métal, de la verrerie pour raffiner et manipuler des liquides, et de nombreux tiroirs contenant des ingrédients. Ce nécessaire coûte 12 CO. »
> — VDM 03 l.659

**Sources RAW** : VDM 03 l.615-617

**Voir aussi** : [Équipement](equipement.md), [Alchimie ordinaire](#alchimie-ordinaire--métier-alchimiste-vdm).

---

## Produits alchimiques — effets en jeu (VDM)

Effets mécaniques des objets fabriqués par Métier (Alchimiste) :

- **Vessie de gaz porteur** :

> « une vessie de cochon remplie d'un gaz volatile plus léger que l'air. »
> — VDM 03 l.712

- **Poudre noire améliorée** — armes chargées avec :

> « le temps de Recharge est réduit de 1, jusqu'à un minimum de 1. »
> — VDM 03 l.718

> « si l'arme devait avoir un raté d'allumage, le tireur peut effectuer un Test de **Projectiles (Poudre noire ou Ingénierie) Intermédiaire (+0)** pour en ignorer les effets. »
> — VDM 03 l.719

- **Boussole** :

> « Lorsqu'il est intéressant de savoir dans quelle direction il se trouve, les Tests d'Orientation réalisés avec une boussole bénéficient de +2 DR. »
> — VDM 03 l.722

- **Bésicles** :

> « les bésicles de verre à poignées confèrent un bonus de +20 aux Tests de Langue pour déchiffrer une écriture minuscule ou inintelligible. Les Tests de Perception pour chercher des détails précis, tels qu'une porte ou un compartiment secret reçoivent aussi un bonus de +20. »
> — VDM 03 l.726

- **Télescope** :

> « Les Tests de Perception effectués pour obtenir des informations sur des objets ou des formes éloignées reçoivent un bonus de +20. »
> — VDM 03 l.732

**Sources RAW** : VDM 03 l.670, l.674, l.676, l.677, l.680, l.684, l.690

**Voir aussi** : [Équipement](equipement.md), [Combat](combat.md) (Recharge, Incident de tir), [Alchimie ordinaire](#alchimie-ordinaire--métier-alchimiste-vdm).

---

## Haute Alchimie (VDM)

Prolongement de l'alchimie ordinaire en manipulant *Chamon* ; **réservé aux porteurs du Talent Seconde vue** ; création d'artefacts magiques par Test étendu.

> « La Haute Alchimie prend une pincée des principes appris dans l'alchimie ordinaire et ajoute au mélange une touche de *Chamon*. Un alchimiste peut créer des artefacts d'une grande puissance en choisissant des composants riches en énergie magique. Seuls les Personnages dotés du Talent *Seconde vue* peuvent s'y essayer. »
> — VDM 03 l.736

**Procédé** — l'alchimiste crée d'abord la substance ordinaire, puis :

> « Il effectue ensuite un Test étendu de **Métier (Alchimiste)** pour imprégner la substance de la qualité magique. »
> — VDM 03 l.738

**Risque aggravé (Maladresse)** — 1d10 **+ 3** (contre 1d10 pour l'alchimie ordinaire) :

> « Si un Personnage effectue un Test de Métier (Alchimiste) et obtient une Maladresse, lancez 1d10 + 3. Ajoutez les degrés d'échec et consultez le **Tableau des Catastrophes de brassage** à la page 161. »
> — VDM 03 l.740

**Valeur** — un objet de Haute Alchimie peut être vendu jusqu'à 100 fois le prix du matériau brut :

> « s'ils vendaient ces objets précieux, ils pourraient en majorer le prix de 100 fois celui du matériau brut. »
> — VDM 03 l.742

### Al-kahest (solvant universel)

> « Pour une fiole, un alchimiste doit d'abord mélanger une substance corrosive avec des matériaux bruts coûtant 10/6, puis effectuer un Test étendu de **Métier (Alchimie) Difficile (−20)**, totalisant 20 DR. »
> — VDM 03 l.750

> « Considérez-la comme une bombe incendiaire (**WFJDR**, page 295) qui brûle chaque cible de 5 + DR États *En flammes*. »
> — VDM 03 l.752

### Poudre alchimique de Leonardo

> « Pour une bombe ou 12 munitions d'arquebuse ou de pistolet, un alchimiste doit produire un tonnelet de poudre noire avec des matériaux bruts coûtant 3/–, puis effectuer un Test étendu de **Métier (Alchimiste) Complexe (−10)**, totalisant 20 DR. »
> — VDM 03 l.757

> « Si la poudre est utilisée dans une arme à feu ou un explosif, les Dégâts infligés sont augmentés de +2, en plus de tout autre bonus habituellement accordé par la poudre et un tir. Cependant, tout Dégât infligé par un Incident de tir est lui aussi augmenté de +2. »
> — VDM 03 l.759

### Boussole d'argent météorique

> « Pour en créer une, un alchimiste doit d'abord fabriquer une boussole avec des matériaux bruts coûtant 10/–, puis effectuer un Test étendu de **Métier (Alchimiste) Complexe (−10)**, totalisant 20 DR. »
> — VDM 03 l.763

> « lorsqu'un Personnage s'en sert lors d'un Test d'Orientation pour localiser des zones de saturation magique Élevée ou Extrême, des appuis arcaniques, des Tempêtes de Magie, ou bien d'autres endroits ou phénomènes magiques, il bénéficie d'un bonus de +2 DR. »
> — VDM 03 l.765

### Prisme de pouvoir

Isole ou substitue les Vents de Magie. Fabrication :

> « Pour en créer un, un alchimiste doit d'abord tailler un prisme avec des matériaux bruts coûtant 8/–, puis effectuer un Test étendu de **Métier (Alchimiste) Difficile (−20)**, totalisant 20 DR. »
> — VDM 03 l.773

Usages (Test étendu de **Savoir (Magie)**) :
- **Attirer un seul vent depuis une source de *Dhar*** (ou de malepierre) sans corruption tant qu'on reste à distance :

> « Utiliser ainsi un prisme de pouvoir exige un Test étendu de **Savoir (Magie) Complexe (−10)**, totalisant 5 DR. »
> — VDM 03 l.783

- **Altérer un vent par un autre** (faire apparaître ou supprimer un vent) :

> « L'utilisation d'un prisme de pouvoir de cette manière exige un Test étendu de **Savoir (Magie) Très Difficile (−30)**, totalisant 20 DR. »
> — VDM 03 l.787

**Sources RAW** : VDM 03 l.694, l.696, l.698, l.700, l.708, l.710, l.715, l.717, l.721, l.723, l.731, l.741, l.745

**Voir aussi** : [Talents](talents.md) (Seconde vue), [Magie](magie.md) (Chamon, Dhar, malepierre, appuis arcaniques, pierres de pouvoir, Focalisation), [Combat](combat.md) (bombe incendiaire, États En flammes), [Corruption](corruption.md), [Alchimie ordinaire](#alchimie-ordinaire--métier-alchimiste-vdm).

## Bilan de fidélité

**45 Compétences transcrites** (25 de Base + 20 Avancées), conformes à LDB 09 l.49-56.

**Refs code couvertes :**
- `LDB 09 l.358` (Métier comme Savoir → Int) : couvert § Métier + § Règle optionnelle + Implémente.
- `LDB 09 l.293` (Intimidation → carac réglable) : couvert § Intimidation + § Règle optionnelle + Implémente.
- `LDB 18 l.202` (traumatisme → pénalité Langue) : hors scope de ce fichier (domaine Traumatisme) ;
  mentionné dans `testValue` via `traumaSkillPenalty`. Voir `traumatisme.md`.
- `LDB 09 l.34-45` (Compétences groupées) : couvert § Compétences Groupées + Implémente.
- `ADE II 2 l.728` (ogre Langue Magick / Endurance) : couvert § Extension ogre.

**Écarts code ↔ RAW identifiés :**
- Aucun écart de règle détecté. La Caractéristique alternative par entité (ogre) est correctement
  portée en donnée (`SkillInstance.characteristic`) et non en sniff d'espèce dans le moteur.
- `testValue` applique correctement les 5 couches (Carac effective, Augmentations, États, Encombrement,
  Traumatisme, Passifs) conformes à LDB 09 (niveau de Compétence = Carac + Augmentations) et aux
  règles d'États/Traumatisme des chapitres 16 et 18.

**Extensions non-LDB intégrées :**
- AA : Métier (Cartographe), Métier (Explosifs), Musicien (Flûte/Tambour), Projectiles (Catapulte),
  Représentation (Parade), Savoir (Artillerie/Empire/Géographie/Guerre/Anatomie/Remèdes),
  Signes secrets (Ulric/Soleil flamboyant/Chevaliers Panthères/Ranger), Langue (Arabéen),
  Art (Écriture), Divertissement (Discours).
- ADE I : Chevaucher (Blaireau), Signes secrets (Ranger).
- ADE II : Savoir (Magie) pour fabrication d'objets magiques.
- AA/ADE I ne définissent **aucune nouvelle Compétence de base** — uniquement de nouvelles
  Spécialisations de Compétences Groupées existantes.
