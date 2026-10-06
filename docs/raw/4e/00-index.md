# Atlas RAW — cœur 4e

Le cœur de règles **WFRP 4e** de l'Atlas : les fiches, catalogues et épreuves de ce cœur vivent dans
ce dossier, **consolidés** depuis les livres autorisés qui le déclarent (table à jour dans
[`sources.md`](../sources.md)), à **usage d'agent** : répondre vite et sûrement à *« est-ce que X est
RAW, et que dit exactement la source ? »* quand la réponse est éclatée sur plusieurs chapitres **et**
plusieurs livres. Les rapports transverses et le routeur des cœurs sont à
[`../00-index.md`](../00-index.md).

## Comment c'est organisé

- **1 fichier par domaine** ; dans chaque fichier, **1 section `##` = 1 topic atomique**.
- Chaque topic = **synthèse fidèle** + **Sources RAW** (toutes les refs `LIVRE NN l.X-Y`, tous livres
  confondus) + **citations verbatim** là où le mot compte + **Voir aussi** (renvois entre règles) +
  **Implémente** — champ **GÉNÉRÉ** par `npm run raw:implemente` (#487), jamais écrit à la main :
  code de `src/` citant les réfs du topic (même livre+chapitre, spans à **±10 lignes** — du bruit de
  voisinage est possible sur les pages denses), symboles remontés, `⚠sans-appelant`/`⚠hors-app` sur
  le code mort détecté, `(non implémenté)` sinon. Source éditoriale (dettes/blocages) :
  `src/data/raw.manifest.json` ; fraîcheur gardée par `npm run docs:check` (CI).
- Convention de réf : `<ABRÉV> <NN> l.<début>-<fin>` — `NN` = préfixe du fichier de chapitre,
  `l.` = numéros de ligne du `.md` source. Table des abréviations → [`sources.md`](../sources.md).

> ⚠️ Contenu **agent-généré**, contrôlé par une passe de **vérification adversariale** (chaque ref
> est reconfrontée à la source ; règle 1 = zéro invention). **La passe de vérif peut elle-même produire
> des faux-positifs** → toute correction passe par une relecture de la source. Les écarts code↔RAW ne
> se consignent plus en prose dans les fiches : un vrai trou = un ticket (cf. #502 pour le tri du stock).

## Domaines

**1 domaine = 1 fiche `<clé>.md`** — la clé est l'id STABLE (c'est elle que nomme un lot du workflow
d'extraction), le titre est de l'affichage. La table ci-dessous est **GÉNÉRÉE** depuis
`scripts/raw/domaines.json` par `node scripts/raw/build-atlas-index.mjs` : un domaine de plus est une
entrée de ce registre, jamais une ligne écrite ici. Tout domaine déclaré a sa fiche et toute fiche a
son domaine — garde `scripts/raw/domaines.test.mjs`. Quels livres et chapitres alimentent une fiche
se LIT sur la fiche, et se MESURE dans [`../coverage.md`](../coverage.md) et
[`../reconciliation.md`](../reconciliation.md).

<!-- ATLAS-DOMAINES:DEBUT -->
| Domaine | Titre |
|---|---|
| [`combat`](combat.md) | Combat |
| [`combat-naval`](combat-naval.md) | Combat naval (La Mer des Griffes) |
| [`tests`](tests.md) | Tests & Degrés de Réussite |
| [`etats`](etats.md) | États |
| [`deplacement`](deplacement.md) | Déplacement & Voyage (hors combat) |
| [`destin`](destin.md) | Destin, Résilience & Détermination |
| [`traumatisme`](traumatisme.md) | Traumatisme & Blessures critiques (LDB 18) |
| [`corruption`](corruption.md) | Corruption & Mutations |
| [`maladies`](maladies.md) | Maladies & Infections |
| [`psychologie`](psychologie.md) | Psychologie |
| [`caracteristiques`](caracteristiques.md) | Caractéristiques & statistiques dérivées |
| [`competences`](competences.md) | Compétences |
| [`talents`](talents.md) | Talents |
| [`carrieres`](carrieres.md) | Classes, Carrières & Statut |
| [`creation`](creation.md) | Création de Personnage |
| [`avancement`](avancement.md) | Avancement (Points d'Expérience) |
| [`magie`](magie.md) | Magie (règles) |
| [`religion`](religion.md) | Religion (Prières, Bénédictions, Miracles) |
| [`equipement`](equipement.md) | Équipement, objets & encombrement |
| [`economie`](economie.md) | Économie : monnaie, marché, fabrication |
| [`bestiaire`](bestiaire.md) | Bestiaire & Profils de créature |
| [`activites`](activites.md) | Activités & Événements (Entre deux aventures) |
<!-- ATLAS-DOMAINES:FIN -->

## Catalogues (données mécaniques verbatim — source Marker propre, tous livres)

> La colonne **Contenu** décrit ce que le catalogue TRANSCRIT. Les LIVRES et CHAPITRES qui l'alimentent
> ne s'écrivent pas ici : chaque catalogue porte sa ligne **« Chapitres source »** dans son propre
> en-tête, GÉNÉRÉE depuis `scripts/raw/chapitres.json#enCatalogue` — une liste recopiée ici mentirait
> dès le livre suivant.

| Catalogue | Contenu |
|---|---|
| [`catalogue-creatures.md`](catalogue-creatures.md) | Bestiaire : profils de créature, Point d'Impact, Traits |
| [`catalogue-sorts.md`](catalogue-sorts.md) | Sorts, avec leurs blocs NI / Portée / Cible / Durée |
| [`catalogue-divin.md`](catalogue-divin.md) | Dieux, cultes, bénédictions, miracles |
| [`catalogue-equipement.md`](catalogue-equipement.md) | Objets, prix, Encombrement, armes et armures |
| [`catalogue-carrieres.md`](catalogue-carrieres.md) | Carrières, détails par niveau |
| [`catalogue-divers.md`](catalogue-divers.md) | Règles éparses des suppléments (entraînement, espionnage, navigation, mutants, astrologie…) |
