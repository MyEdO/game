# Recette navigateur — train 2a2 après corr. 2/3 — RENDU (échéance dépassée)

**Statut** : échéance dépassée pendant l'exécution ; A1 à A5 déroulés et relevés en entier. B (Compétence
Maître artisan) démarré (setup fait, achat/relevé au clavier NON fait). C (spécialisations Compendium)
et D (décompte console final) NON faits. Rendu ci-dessous = données brutes de ce qui a été mesuré,
sans les corriger.

Serveur dev de ce worktree lancé pour cette recette (port **5225**, `.wt-1473-t2`, HEAD `6a55a5d7c`) —
arrêté en fin de mission (`node scripts/recette/arreter-dev.mjs 5225`), `ps` collé en bas de ce fichier.
Scripts et captures : `scripts/recette/...` du worktree pour le kit, tout le jetable dans ce dossier
(`stepA1.mjs`, `stepA2.mjs`, `debugA.mjs`, `stepA-full.mjs`, `stepA4-5.mjs`, `stepA5.mjs`, `stepA5b.mjs`,
`stepB.mjs`).

---

## A. Scénario « Niveau complet », lancé comme un joueur

### A1 — Liste des scénarios (par clic, menu principal → « Scénarios de test »)

Chemin joueur : ouverture de l'app → clic réel sur le bouton du menu principal **« Scénarios de test »**
(`clickButtonByText`, texte exact — c'est le libellé i18n `menu.testScenarios` de `MainMenu.tsx`).

Sections affichées, VERBATIM et dans l'ordre : **Combat, Magie, Créatures, Survie, Progression, Marché,
Scénarios complets, Naval, Rendu.**

Icône de la section « Progression » : `resource/xp` (donnée `SCENARIO_SECTIONS` de
`src/scenes/test-scenarios/_shared.ts` — vérifiée au code, l'icône n'étant pas rendue en texte accessible
distinguable au DOM sans lire le SVG `<use>`, non extrait par la sonde ; capture ci-dessous en fait foi
visuellement).

Entrée du scénario dans la section Progression, VERBATIM :

> **PROGRESSION**
> **Niveau de Carrière complet (LDB 07 l.124)**
> Porte « Niveau complet » (`isCareerLevelComplete`, LDB 07 l.124) à l'onglet Avancement : un Talent de
> carrière la franchit ; un Talent acheté comme en carrière (Marque de Tzeentch, EDOC 13 l.524) la
> laisse fermée ; un Talent ajouté à la carrière (Frénésie par Flagellant, LDB 10 l.467) la franchit —
> un achat chacun, provenance de l'ajout affichée sur sa rangée.
> Trois Agitateurs Niveau 1 au seuil, sans Talent du Niveau, les PX d'un Talent chacun : Talent de
> carrière · Marque de Tzeentch · Flagellant
> [Lancer]

Captures : `A1-00-menu.png`, `A1-01-liste-scenarios.png`.

**Friction** : aucune, le scénario et sa section sont bien rangés et son libellé lisible.

### A2 — Lancement par clic, message de départ

Chemin : clic réel sur **« Lancer »** de la rangée « Niveau de Carrière complet » (`clickButtonByText`
avec `{ rangee: 'Niveau de Carrière' }` — a fallu attendre le rendu de la liste, `waitFor` sur le texte,
sinon la carte n'existe pas encore dans le DOM au moment du clic, cf. Piège ci-dessous).

Après chargement, une modale d'intro s'affiche, VERBATIM :

> **⚑ Niveau complet**
> Trois Agitateurs au seuil de leur Niveau 1 (Caractéristiques et 8 Compétences), sans Talent du Niveau.
> Fiche → Avancement : le 1er achète un Talent de carrière (Niveau complet), le 2e un Talent de la
> Marque de Tzeentch (Niveau incomplet), le 3e Frénésie, ajoutée par Flagellant (Niveau complet).
> [Terminer]

Capture : `A2-00-apres-lancer.png`. Fermée par clic réel sur « Terminer » → exploration, groupe de 3
« Agitateur (Talent de carrière) », « Agitateur (Marque de Tzeentch) », « Agitateur (Flagellant) »
visibles au bandeau de groupe (`.party-dock`/`.pd-track`). Capture : `A2-01-apres-terminer.png`.

**Piège rencontré (à consigner pour la doc)** : après le clic sur « Scénarios de test », `document.body.innerText`
ne contient PAS encore les cartes de scénarios pendant quelques dizaines à centaines de ms (liste rendue
en différé) — un `evaluate` synchrone immédiatement après le clic renvoie 0 résultat. Il faut un
`waitFor(session, "document.body.innerText.includes('...')")` avant tout `clickButtonByText` ciblant une
carte. Non documenté explicitement dans `docs/recette-navigateur.md` (le piège documenté est la closure
DOM/action, celui-ci est un délai de montage pur) — a coûté 2 scripts de mise au point (`debugA.mjs`).

### A3 — Avant tout achat, onglet Avancement de chacun des 3 Agitateurs

**H1 « Agitateur (Talent de carrière) »** — ouverture par clic réel sur le portrait
(`aria-label="Agitateur (Talent de carrière) — fiche du personnage"`), onglet **Avancement** (clic
réel sur le libellé de l'onglet). VERBATIM (extraits) :

> POINTS D'EXPÉRIENCE DISPONIBLES : 100
> … Talents du niveau 1 (4)
> Baratiner `carrière` — Acquérir · 100 PX
> Faire la manche `carrière` — Acquérir · 100 PX
> Lire/Écrire `carrière` — Acquérir · 100 PX
> Sociable `carrière` — Acquérir · 100 PX
> Carrière
> Pamphlétaire — niv. 1 · Bronze 1 — niveau en cours
> Monter : Agitateur (niv. 2) · 200 PX
> niveau actuel non complété

Aucune rangée de Talent ne porte de provenance supplémentaire (les 4 sont de simples Talents de
carrière, aucun n'est ajouté par un autre Talent/Trait). Captures : `A3-00-fiche-h1-ouverte.png`,
`A3-01-h1-avancement.png`, `A3-02-h1-talents-niveau.png`.

**H2 « Agitateur (Marque de Tzeentch) »** — même chemin. VERBATIM (extraits) :

> Talents du niveau 1 (5)
> Baratiner / Faire la manche / Lire/Écrire / Sociable — `carrière` — Acquérir · 100 PX (chacun)
> Magie des Arcanes (Feu) `carrière` `Marque de Tzeentch` « Achat comme en carrière, hors de sa liste »
> — Acquérir · 100 PX
> (… répété pour Lumière/Mort/Vie/Cieux/Métal/Ombres/Bête/Gueule/Sorcellerie/Nécromancie/Démonologie)
> Carrière → Pamphlétaire, niveau en cours, Monter : 200 PX, **niveau actuel non complété**

Provenance visible **avant tout achat** : une puce distincte `Marque de Tzeentch` (style Trait) à côté
de la puce `carrière`, et le texte « Achat comme en carrière, hors de sa liste ». Captures :
`A3-03-h2-avancement-top.png`, `A3-04-h2-talents-niveau.png` (celle-ci montre bien les DEUX puces
côte à côte, cf. capture).

**H3 « Agitateur (Flagellant) »** — même chemin. VERBATIM (extraits) :

> Talents du niveau 1 (5)
> Baratiner / Faire la manche / Lire/Écrire / Sociable — `carrière` — Acquérir · 100 PX (chacun)
> Frénésie `carrière` `Flagellant` — Acquérir · 100 PX
> Carrière → Pamphlétaire, niveau en cours, Monter : 200 PX, **niveau actuel non complété**

Provenance visible avant achat : puce `Flagellant` à côté de `carrière`, PAS de mention « comme en
carrière » ici (cohérent : Frénésie compte pour le niveau, contrairement à la Marque). Captures :
`A3-05-h3-avancement-top.png`, `A3-06-h3-talents-niveau.png`.

### A4 — Achats (un par héros), relevé après chaque achat

**H1 : achète « Baratiner » (Talent de sa carrière)** — clic réel sur son bouton « Acquérir · 100 PX ».
VERBATIM après achat :

> POINTS D'EXPÉRIENCE DISPONIBLES : 0
> Baratiner **×1** `carrière` — +1 · 200 PX
> Carrière → Pamphlétaire — **✓ niveau complété**
> Monter : Agitateur (niv. 2) · **100 PX**
> PX insuffisants — 100 PX requis.

Capture : `A4-00-h1-apres-clic-acquerir.png`, `A4-01-h1-apres-achat-talents.png`.

**Friction/observation à consigner SANS la corriger** : le coût de « Monter » (passage niv. 1 → niv. 2)
affiche **200 PX avant** l'achat du Talent de carrière et **100 PX après**, alors qu'aucune règle
énoncée par le scénario ne relie ce coût à la complétion du niveau (`isCareerLevelComplete`) — le
même écart (200 → 100 PX) est observé identiquement sur **H3** après son achat (ci-dessous), donc ce
n'est pas un artefact isolé mais un comportement systématique du calcul de coût affiché. Aucune preuve
au code n'a été relue (hors périmètre du temps imparti) ; à vérifier : le coût affiché dérive-t-il
réellement de la complétion du niveau, ou d'un autre effet de bord de l'achat (ex. PX consommés) ?
Le libellé lui-même (« Monter : … · 100 PX ») ne dit PAS pourquoi le prix a changé — potentiel mensonge
d'affordance si le prix RAW d'avancement de niveau ne dépend QUE du niveau cible, pas de sa complétion.

**H2 : achète le Talent offert par la Marque de Tzeentch (« Magie des Arcanes (Feu) »)** — clic réel sur
son bouton « Acquérir · 100 PX ». VERBATIM après achat :

> Magie des Arcanes (Feu) **×1** `carrière` `Marque de Tzeentch` « Achat comme en carrière, hors de sa
> liste » — **Maxi atteint**
> Carrière → Pamphlétaire — niveau en cours
> Monter : Agitateur (niv. 2) · **200 PX** (INCHANGÉ)
> **niveau actuel non complété** (INCHANGÉ)

Confirme exactement l'énoncé : un achat « comme en carrière » NE fait PAS franchir « Niveau complet ».
Capture : `A4-02-h2-apres-achat-talents.png`.

**H3 : achète Frénésie (ajoutée par Flagellant)** — clic réel. VERBATIM après achat :

> Frénésie **×1** `carrière` `Flagellant` — **Maxi atteint**
> Carrière → Pamphlétaire — **✓ niveau complété**
> Monter : Agitateur (niv. 2) · **100 PX** (même écart 200→100 PX que H1)
> PX insuffisants — 100 PX requis.

Capture : `A4-03-h3-apres-achat-talents.png`.

### A5 — Clic sur une puce de provenance

**Puce « Flagellant »** (rangée Frénésie, fiche H3) : clic réel (coordonnées lues au DOM puis `clicReel`
CDP). Effet : une SECONDE fenêtre s'ouvre par-dessus la fiche — le **Compendium**, onglet Compétences →
Talents, sur la fiche du Talent **Flagellant** (LDB p.137), avec son texte RAW verbatim, ses onglets
« Description / Ajouté à vos carrières / Carrières (par rang) / Créatures ». Capture :
`A5-00-avant-clic-puce.png` (avant), `A5-01-apres-clic-puce.png` (après, fenêtre Compendium ouverte).
Aucun changement d'état de jeu (achat, PX) constaté — un pur renvoi de référence, cohérent avec la
primitive `CodexRef` (`src/ui/compendium/CodexRef.tsx`) lue par la suite pour comprendre le mécanisme.

**Puce « Marque de Tzeentch »** (rangée Magie des Arcanes (Feu), fiche H2) : même geste. Effet : ouvre
le Compendium sur l'onglet **Monde → Traits**, fiche **Marque de Tzeentch** (EDOC p.83), texte RAW
verbatim. Capture : `A5-02-apres-clic-puce-tzeentch.png`.

Les deux puces de provenance sont donc de vrais liens vivants vers le Codex (pas des libellés inertes),
et ouvrent la bonne famille de fiche selon que la provenance est un Talent ou un Trait — **aucune
friction constatée sur ce point**.

---

## B. Compétence ajoutée par Maître artisan — INACHEVÉ

Setup fait par `__wfrp` (autorisé, préparation d'état, jamais le flux testé) :
`__wfrp.scenario('entrainement')` → fermeture de l'intro « Terrain d'entraînement » par clic réel sur
« Terminer » → `__wfrp.xp(3000)` → `__wfrp.talent('tr-tireur', 'maitre-artisan', { spec: 'forgeron' })`
→ résultat renvoyé par l'outil : `"✓ tr-tireur → maitre-artisan (spec forgeron) ×1"`.

Héros choisi : **« Tireur (entraînement) »** (id `tr-tireur`), qui n'a pas de Compétence Métier au
départ dans ce scénario (créé par `tireur()` dans `entrainement.ts`, sans Métier). Groupe confirmé au
DOM : `Tireur (entraînement)`, `Sigmund Reikhardt`, `Grunni Pierre-de-Fer`, `Wilhelmina Faust`.

**Non fait, faute de temps** :
1. Ouvrir la fiche du Tireur (clic sur son portrait), onglet Avancement, relever si la rangée
   « Métier (Forgeron) » existe, son libellé/statut/coût/provenance.
2. Acheter UNE Augmentation de cette Compétence au clic, relever la rangée + les PX après achat.

Ce qui aurait suffi pour finir sans tricher : le patron exact d'A3/A4 ci-dessus (ouvrir la fiche via
`[aria-label="Tireur (entraînement) — fiche du personnage"]`, onglet Avancement, chercher la section
Compétences pour « Métier (Forgeron) », cliquer son bouton d'achat). Script de départ prêt et non
terminé : `stepB.mjs` (setup only, capture `B1-00-apres-scenario.png`, `B1-01-apres-terminer.png`
disponibles).

## C. Spécialisations au Compendium (atelier) — NON FAIT

Aucun geste effectué (Haine (Au choix) du Cavalier niv. 3, Maître artisan, Destinée). Le patron
réutilisable de la recette précédente du même train existe déjà :
`…/scratchpad/recette-2a2/step17.mjs`… `stepB13.mjs` etc. (atelier compendium, à adapter sans jamais
accorder l'accès fichier ni enregistrer).

## D. Console — PARTIEL

Sur tout le parcours A (A1 à A5, 3 sessions Chrome distinctes) : **0 erreur, 0 avertissement, 0
exception** relevés par `consoleGuard` (`session.listeners`, filtré par `sessionId`) à chaque étape —
voir les lignes `CONSOLE ...` dans les sorties de scripts, toutes `[]`.

Console de la session B (setup only) non vérifiée après achat (le flux n'a pas été poursuivi jusque-là).
Aucun décompte final consolidé faute de temps.

---

## Frictions relevées (sans les corriger)

1. **Piège de timing non documenté** : liste des scénarios rendue en différé après le clic « Scénarios
   de test » — un `clickButtonByText`/`evaluate` immédiat après ce clic ne voit RIEN, il faut
   `waitFor` sur un texte connu. `docs/recette-navigateur.md` documente le piège « closure DOM/action »
   mais pas ce délai de montage pur ; a coûté du temps de mise au point (scripts `stepA1.mjs`,
   `debugA.mjs`).
2. **Coût de « Monter » (niveau suivant) qui varie avec la complétion du niveau** (200 PX → 100 PX,
   observé identiquement sur H1 et H3 après leur achat respectif) — SANS que l'écran ne dise pourquoi.
   Le libellé « Monter : Agitateur (niv. 2) · 100 PX » ne porte aucune explication du changement de
   prix ; si ce lien coût/complétion n'est pas une règle RAW voulue, c'est un mensonge d'affordance
   (le joueur ne sait pas que compléter son niveau a fait baisser le prix, ni pourquoi). Non
   investigué côté code — hors périmètre du temps imparti, à vérifier par la suite.
3. **Icône de section « Progression »** vérifiée par LECTURE DE CODE (`SCENARIO_SECTIONS`), pas par le
   DOM — le SVG `<use>` de l'icône n'a pas été extrait par la sonde utilisée ; la capture d'écran
   `A1-01-liste-scenarios.png` en fait foi visuellement mais le script n'a pas automatisé cette preuve.
   Un `__wfrp` ou un helper de `lib.mjs` qui rendrait l'`href` d'icône lisible en une ligne aurait évité
   ce détour.

## Ce qui n'était pas découvrable sans lire le code

- L'id du scénario cliqué (`entrainement`) et l'id du héros cible (`tr-tireur`) pour la Partie B :
  imposés par le brief lui-même (§ Setup), non déduits du jeu.
- Le fait que `clickButtonByText({ rangee: ... })` cherche un texte de sous-chaîne dans l'ancêtre
  commun le plus proche PORTANT un bouton candidat — a fallu relire `lib.mjs:719-748` pour comprendre
  pourquoi `{ rangee: 'Niveau de Carrière complet' }` échouait alors que `{ rangee: 'Niveau de
  Carrière' }` réussissait une fois le délai de montage résolu (le titre complet incluant « (LDB 07
  l.124) » n'était de toute façon jamais un problème de troncature de texte, seulement de timing).

## Ce qui aurait suffi pour finir B, C, D sans tricher

Rien d'inatteignable : le patron de clics (portrait → onglet Avancement → bouton d'achat) est
IDENTIQUE à celui déjà exercé et prouvé fiable en A3/A4/A5. Seul le TEMPS a manqué (le budget de 45
minutes a été majoritairement consommé par la mise au point du timing de rendu de la liste de
scénarios en A1/A2, cf. friction n°1, et par l'exploration prudente de la structure DOM de la fiche
avant chaque script). Aucun besoin d'outillage supplémentaire identifié pour B/C/D — le kit `lib.mjs`
couvre tout ce qui restait à faire.

## Éditabilité du contenu testé

Non vérifiée (aurait relevé de la Partie C/atelier, non atteinte).

---

## ps final (avant clôture)

```
$ ps aux | grep -E "vite|chrome|node scripts/lancer-local" (après arrêt)
(aucune ligne — rien ne tourne)
```

`ps aux` complet collé (extrait pertinent, aucun processus de recette/dev résiduel) :

```
root         1  0.0  0.0  25780  4660 ?        SLl  Sep23   0:41 /process_api ...
root        84  5.1  3.4 5583612 566220 ?      Ssl  Sep23  61:30 /opt/node22/bin/claude --preload ...
root       140  0.0  0.2 2324592 39140 ?       Sl   Sep23   0:17 /opt/rclone/rclone-filestore ...
root       156  0.0  0.2 2031124 44188 ?       Sl   Sep23   0:40 /usr/local/bin/environment-manager ...
(+ kworkers noyau habituels, aucun n'appartient à cette recette)
```

Serveur dev arrêté par `node scripts/recette/arreter-dev.mjs 5225` (confirmation : « port 5225 : arbre
du PID 19294 arrêté »). Aucun Chrome headless résiduel (chaque script a fermé sa session via
`session.close()` avant la fin, sauf le tout premier essai de `stepA1.mjs` qui a planté sur une Chrome
manquante AVANT tout spawn CDP — aucun process laissé).
