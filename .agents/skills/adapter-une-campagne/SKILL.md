---
name: adapter-une-campagne
description: À utiliser pour adapter une campagne publiée en jeu (dossier de chapitre, table simulée, porte de goût) ou reprendre L'Ennemi Intérieur.
---
<!-- GENERATED: agents:sync; source=.claude/skills/adapter-une-campagne/SKILL.md -->

# Adapter une campagne publiée

La méthode fait foi dans le commentaire de pilotage de l'épique #665 (« ÉPIQUE campagne:EDO — « L'Ennemi
dans l'Ombre » jouable bout-en-bout (Tome 1 + Compagnon) ») :
https://github.com/MyEdO/game/issues/665#issuecomment-5849927764. Cette skill la ROUTE vers ses outils.

## But et répartition

- But : un jeu PLAISANT qui garde l'ESPRIT de la campagne — enquête et interaction plutôt que massacre,
  humour noir « grim & perilous », réseau de PNJ cohérent, l'ennemi est à l'intérieur — et des choix aux
  conséquences visibles.
- Les agents mesurent la fidélité, la couverture et les frictions. Seul l'utilisateur juge le plaisir,
  manette en main : aucun agent ne tranche le goût.

## Doctrines — lire les fiches avant tout dossier

- `user-doctrine-adaptation-livre-vers-jeu-regime-propre` : état de l'art, puis découpage validé en goût.
- `user-doctrine-adaptation-libre-imperatifs-du-livre` : les impératifs du livre sont des invariants, le
  reste se conçoit, tagué `maison`.
- `user-doctrine-regle-5-campagne-repliques-et-narration-maison` : réplique absente du livre maison ;
  description destinée au MJ reformulée en texte lu à l'écran, même quand le livre la porte ; tout texte
  maison passe devant un juge esprit (étape 8) ; documents et règles verbatim.
- `user-doctrine-lecture-vo-campagne-pour-comprendre` : tomes, compagnons et journaux de dev VO se lisent
  pour comprendre.
- `user-doctrine-campagne-jamais-generee-par-script` : le paquet est manuscrit.
- `user-doctrine-cadence-portes-de-gout-une-par-acte` : une porte de goût par acte (arbitrage 3 du
  pilotage ci-dessus).

## Charte d'adaptation

Tirée des réponses de l'utilisateur au pilotage du 2026-09-26 (#665, issuecomment-5849927764), portées
par les fiches ci-dessus. Elle ne se re-demande pas : une question qu'elle tranche ne monte à aucune porte.

- **Piliers de plaisir.** « le but principale c'est que le jeu soit plaisant et respecte au lieu l'esprit
  du JDR et de la campagne, comme font toutes adaptations de JDR papier en jeu vidéo comme les Pathfinder »
  (2026-09-26). La référence est le CRPG adapté d'un module papier : réactivité (chaque geste rend un
  retour visible), densité (chaque lieu offre quelque chose à faire ou à apprendre), et la réponse du
  genre quand le livre ne dit rien.
- **Politique de média.** Chaque beat reçoit un média : scène jouée, dialogue, interlude, résumé, coupé. Le
  découpage d'un acte se valide à sa porte : « Chaque séance groupe trois choses : jouer la tranche
  livrée, valider le découpage de l'acte suivant, trancher les exceptions » (2026-09-26). Les textes
  suivent la règle 5 de campagne (fiche `user-doctrine-regle-5-campagne-repliques-et-narration-maison`).
- **Points au MJ.** « le livre laisse énormement de place au MJ et n'indique que quelque éléments
  importants a l'histoire et le MJ fait le reste avec quelques indices/impératifs a suivre » (2026-09-26).
  Trois familles :
  - les **impératifs** du livre (éléments importants, indices, « doivent absolument ») sont des
    INVARIANTS, cités au `Source/` et implémentés ;
  - une **règle de jeu** laissée au MJ reçoit un arbitrage EXPLICITE (AGENTS.md règle 7) : donnée maison
    éditable, ou choix du joueur, avec la cérémonie du credo (verbatim et date au ticket) ;
  - le **reste narratif** se conçoit comme un MJ, en puisant dans les compagnons (« péages, les
    PNJs/scénarios annexes et autres, mais pas que »), et chaque ajout est tagué `maison`.
- **Budget d'art.** « aucune vague d'art sans demande » (méthode validée le 2026-09-26, étape 8). C'est un
  défaut : l'utilisateur le lève quand il le veut.

## Les étapes et leurs outils

0. **Cadre** — doctrines consignées ; skill `creer-une-campagne` ; la charte d'adaptation ci-dessus.
1. **Ré-ancrage de l'épique** — tri des tickets ouverts du label de campagne, commentaire de pilotage ;
   ni code ni salve de tickets.
2. **Trame des cinq tomes, avant tout chapitre** — fils transversaux, états et compteurs de campagne lus
   en aval, chapitre propriétaire de chaque état ; déclarés DANS le paquet de campagne.
3. **Dossier de chapitre** — la moitié LIVRE, en donnée commitée : la fiche `docs/dossiers/<ABBR>/<NN>.json`,
   au schéma unique `ficheDeDossier` (`src/data/source/dossier.ts`).
   - Lecture : workflow `dossier-de-chapitre`, args projetés par
     `node scripts/raw/workflow-args.mjs dossier-de-chapitre <ABBR> <NN> --worktree <abs> --date <AAAA-MM-JJ> [--compagnons <ABBR>-<NN>,…]`
     (fichiers du chapitre, tête de l'arbre lu, familles et formes d'entrée de la fiche). Tout agent
     exécute par `ctx_shell`, `cwd` = l'arbre, une commande simple par appel, un seul appel par message,
     et n'écrit aucun fichier. Lentilles parallèles au `Source/` — impératifs, beats, points au MJ,
     indices, secrets et DÉCLENCHEURS (événements à l'initiative d'un PNJ ou du monde) ; PNJ, lieux,
     textes ; tests, rencontres, durée et difficulté, récompenses, états ; matière des compagnons si
     fournis. Le script pose chaque id, `<préfixe><rang>`.
   - Complétude : un juge relit le chapitre et rend ses corrections — oubli, réf fausse, contenu faux
     (tout attribut de l'entrée hors réf, classement compris, validé contre sa forme) —, chacune visée par
     famille et id. Le script les APPLIQUE : la fiche rendue est la fiche CORRIGÉE, `corrections` en est la
     trace. Une correction à cible inconnue ou déjà corrigée, à attribut hors de sa famille ou à valeur
     hors de sa forme, ne s'applique pas : `anomaliesDeCorrection` la nomme.
   - Verdicts : dérivés de `trous`, une liste par espèce. `DOSSIER` (toutes vides) ; sinon la première
     espèce trouée le nomme — `LECTURE INCOMPLÈTE` (`lentillesSansRendu`), `DOSSIER SANS COMPLÉTUDE`
     (`completudeSansRendu`), `CORRECTIONS INAPPLICABLES` (`anomaliesDeCorrection`). `ARRÊT` : argument
     manquant. Un verdict autre que `DOSSIER` se refait.
   - Fiche : `node scripts/raw/workflow-args.mjs ecrire-fiche <rendu.json>` écrit la fiche d'un run au
     verdict `DOSSIER`, validée par le schéma et les gardes du chargeur (`chargerDossiers`), et refuse
     tout autre run : personne n'écrit ce JSON à la main. Puis `npm run test:raw` (gardes des fiches et des
     réfs citées), et commit de la fiche.
   - État des lieux : dans l'éditeur, chaque élément du paquet de campagne pose `couvre` (les entrées de
     fiche qu'il couvre, `<ABBR>-<NN>#<id>`), et le narratif tient `ecartes` (une entrée écartée, avec son
     motif : adaptation libre, jamais une dette). L'état couvert / écarté / non couvert se lit dans
     `docs/dossiers-de-chapitre.md` après `npm run docs:build`.
4. **Table papier simulée** (chapitres à forte ambiguïté ; Tome 1 : 1, 2, 6, 8) — workflow
   `table-simulee`, APRÈS le dossier, qu'elle consomme : args
   `{ livre, chapitre, fichiers, dossier, seed, maxEchanges?, personas?, worktree, date }` projetés par
   `node scripts/raw/workflow-args.mjs table-simulee <ABBR> <NN> --worktree <abs> --date <AAAA-MM-JJ> --seed <graine>`
   (`--max-echanges`, `--personas` facultatifs) : `dossier` = l'objet de la fiche commitée du chapitre,
   chargé et gardé par le lanceur ; sans fiche, le lanceur refuse.
   `maxEchanges` absent = 3 échanges par beat du dossier (mesure #1993 : ≈2 par beat atteint) ; chaque
   échange coûte ≈ 5 agents (1 MJ + 4 joueurs). Explicite, il prime (entier ≥ 1, sinon `ARRÊT`).
   - Préparation : fiches des 4 PJ par un lecteur qui ignore le chapitre (un id de PJ vide ou en double
     = `ARRÊT`) ; sosie désigné sur le dossier et la liste des PJ — `motif` toujours renseigné (pourquoi ce
     PJ, ou pourquoi aucun), `ref` vide sans sosie ; la fiche du MJ est TIRÉE de la fiche commitée.
   - Partie : MJ agent qui cite le livre ou déclare IMPRO, résout chaque intention et rend le sort de
     chaque déclencheur en attente (joué, non échu, écarté), 4 joueurs cloisonnés à personas, dés tirés
     par le moteur (une commande simple par jet, par `ctx_shell`, `cwd` = l'arbre). Le MJ ignore le
     plafond `maxEchanges` : `fin` = le chapitre est clos selon le livre.
   - Analyse : un juge classe chaque intention du journal et chaque déclencheur non joué ou écarté, sait
     si la partie s'est arrêtée au plafond, et relève chaque fuite de secret (narration du MJ qui révèle
     un secret du dossier sans indice trouvé qui y mène). Un test réussi sur une piste qu'aucun indice du
     dossier ne couvre n'est pas un indice trouvé : le secret qu'en tire la narration reste une fuite.
   - Schémas : toute sortie d'agent qui désigne un membre d'un ensemble fermé (PJ, déclencheur en
     attente, beat, persona, secret, échange, id du sosie) est contrainte par le schéma de son appel —
     `enum`, ou objet dont les clés sont exactement les membres qui doivent chacun recevoir une entrée ;
     le script ne re-vérifie pas ce que le schéma garantit, et ne redemande pas ce qu'il sait (la réf
     d'une fuite est celle de son secret au dossier).
   - Retour : `trous`, journal complet (anomalies de sosie, de tirage, de déclencheur ; `interrompue`,
     `plafondAtteint`), analyse (besoins `retenu`, fuites), déclencheurs non joués et écartés.
   - Verdicts : dérivés de `trous`, une liste par espèce. `SIGNAL` ou `THÉÂTRE` (les adverses n'ont pas
     joué : le run ne prouve rien) quand toutes sont vides ; sinon la première espèce trouée le nomme —
     `INTERROMPU` (MJ sans rendu, à tout échange), `PARTIE INCOMPLÈTE` (joueur sans rendu), `PARTIE ANOMALE`
     (sosie à id vide qui cite un passage, tirage hors suite, déclencheur non joué sans motif,
     fuite de secret), `SANS ANALYSE` (juge sans rendu). `ARRÊT` avant la partie.
5. **Maquette grise jouable** — briques existantes seules, sans art ni système neuf, jouée par
   l'utilisateur AVANT toute production ; les systèmes manquants s'ordonnent sur la friction mesurée.
6. **Porte G1** — une page, 10 décisions au plus : charte, découpage des premiers chapitres, maquette
   grise, budget visuel.
7. **Systèmes et cohérence** — tout système récurrent a son design jugé : un agent `juge` dépêché le
   juge, les cas des tomes suivants comme cas canoniques, et son rendu est cité au brief (skill
   `orchestrer-des-agents`) ; on ne construit que ce que le tome courant exige ; gardes :
   propriétaire unique d'un id, drapeau lu → producteur, réfs canoniques.
8. **Production par tranche verticale** — contenu posé à la main dans le paquet : skill
   `creer-une-campagne` ; cartes : skill `creer-une-map` ; créature ou PNJ neuf : skill
   `creer-une-creature` (gabarits existants, aucune vague d'art sans demande) ; rencontres à difficulté
   ciblée ; intégration.
   - Textes : répliques maison taguées, descriptions au MJ reformulées à l'écran, documents et règles
     verbatim.
   - Juge esprit : un `juge` (opus) par lot de textes maison, réplique comme narration reformulée ; il
     reçoit chaque texte, la réf du passage dont il dérive et le passage lu au `Source/`, et rend tient /
     ne tient pas avec motif. Un texte qui ne tient pas se réécrit.
9. **Parties en jeu** — skill `recette-navigateur` : recetteur PREUVE puis JOUEUR-RPG. Chaque intention
   de la table simulée se classe « offerte / refusée dans la fiction / porte fermée en silence (défaut) » ;
   sauvegarde-reprise aux frontières de beat ; coop ; retours en THÈMES.
10. **Porte d'acte** (arbitrage 3) — l'utilisateur joue la tranche, valide le découpage de l'acte suivant,
    tranche les exceptions ; son verdict se consigne verbatim avec sa date.

## Règles de lecture

- Un dossier se relit au `Source/`, jamais au grounding d'un agent. Cas réel : un agent a affirmé que le
  sosie de Kastor n'était documenté qu'au Tome 2 ; il l'est au Tome 1, `EDO 02 l.40`.
- Une intention de table devient un BESOIN si deux personas DE LA TABLE l'ont eue, ou si le livre la
  prévoit.
  L'improvisation du MJ est matière de conception, taguée `maison`.
- Toute table porte ses deux personas adverses : saboteur et hors-cadre.
- La VO se lit pour comprendre (fiche `user-doctrine-lecture-vo-campagne-pour-comprendre`). Un livre
  présent en VF se cite en VF : évaluation d'ingénierie révisable, pas l'arbitrage.

## Où vit quoi

- **État du chantier** : le dernier commentaire de pilotage de l'épique.
- **Dossiers de chapitre** : fiches commitées `docs/dossiers/<ABBR>/<NN>.json` ; leur état des lieux,
  `docs/dossiers-de-chapitre.md` (dérivé, `npm run docs:build`).
- **Journaux de table, verdicts de goût** : commentaires de ticket.
- **Contenu** : le paquet de campagne manuscrit `src/scenes/<campagne>/<campagne>-projet.json`, états de
  campagne compris.

## Chapitre terminé

- Entrées de la fiche couvertes (`couvre`), ou écartées avec motif (`ecartes`) : aucune « non couverte » dans
  `docs/dossiers-de-chapitre.md`.
- Média de chaque beat décidé.
- Gardes et recette PREUVE vertes, console à 0 erreur.
- 0 porte fermée en silence ; 0 thème « m'aurait fait quitter ».
- Durée et difficulté dans la cible.
- Verdict de l'utilisateur consigné verbatim.

## Tome terminé

- Export de l'état du monde lu par le tome suivant.
