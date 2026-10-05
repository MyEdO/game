---
name: adapter-une-campagne
description: À utiliser pour adapter une campagne publiée en jeu (dossier de chapitre, table simulée, porte de goût) ou reprendre L'Ennemi Intérieur.
---

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

## Les étapes et leurs outils

0. **Cadre** — doctrines consignées ; skill `creer-une-campagne` ; charte d'adaptation (piliers de
   plaisir dont réactivité et densité, politique de média, typologie des points au MJ).
1. **Ré-ancrage de l'épique** — tri des tickets ouverts du label de campagne, commentaire de pilotage ;
   ni code ni salve de tickets.
2. **Trame des cinq tomes, avant tout chapitre** — fils transversaux, états et compteurs de campagne lus
   en aval, chapitre propriétaire de chaque état ; déclarés DANS le paquet de campagne.
3. **Dossier de chapitre** — workflow `dossier-de-chapitre`, args
   `{ livre, chapitre, fichiers, compagnons?, worktree, date }` (`?` = facultatif). Tout agent exécute par
   `ctx_shell`, `cwd` = l'arbre, une commande simple par appel, un seul appel par message, et n'écrit
   aucun fichier.
   - Lecture : lentilles parallèles au `Source/` — impératifs, beats, points au MJ, indices, secrets et
     DÉCLENCHEURS (événements à l'initiative d'un PNJ ou du monde) ; PNJ, lieux, textes ; tests,
     rencontres, durée et difficulté, récompenses, états ; matière des compagnons si fournis. Un id de
     beat ou de déclencheur vide ou en double est une anomalie de lecture.
   - Confrontation : chaque besoin confronté au code d'`origin/main` (existe / partiel / manque).
     Familles de besoin : PNJ, lieu, texte, test, rencontre, récompense, état, point au MJ, déclencheur,
     compagnon ; durée et difficulté sont rendues, jamais confrontées.
   - Complétude : un juge relit le chapitre et rend ses corrections — oubli, réf fausse, contenu faux
     (un attribut de l'entrée hors id, réf et classement, validé contre sa forme), classement faux —,
     chacune visée par champ et id. Le script les APPLIQUE : le dossier rendu est le dossier CORRIGÉ,
     `corrections` en est la trace. Une correction à cible inconnue, ambiguë, déjà prise ou déjà
     corrigée, à attribut hors de son champ ou à valeur hors de sa forme, ne s'applique pas :
     `anomaliesDeCorrection` la nomme.
   - Confrontation après corrections : tout besoin né d'un oubli, ou dont la famille, le texte ou la réf
     a changé sans que le juge l'ait classé, est confronté à nouveau. Un besoin qui reste
     `non-confronte` (lot sans rendu, nommé dans `lotsSansRendu`, ou verdict absent) fait tomber le
     verdict.
   - Retour : `livre`, `chapitre`, impératifs, beats, points au MJ, indices, secrets, déclencheurs, PNJ,
     besoins, états, durée et difficulté, matière des compagnons, `trous`, commits confrontés,
     `corrections`, synthèse, agents.
   - Verdicts : dérivés de `trous`, une liste par espèce. `DOSSIER` (toutes vides : seul verdict qui arme
     une table) ; sinon la première espèce trouée le nomme — `LECTURE INVALIDE` (`anomaliesDeLecture`),
     `LECTURE INCOMPLÈTE` (`lentillesSansRendu`), `DOSSIER SANS COMPLÉTUDE` (`completudeSansRendu`),
     `CORRECTIONS INAPPLICABLES` (`anomaliesDeCorrection`), `CONFRONTATION INCOMPLÈTE` (`lotsSansRendu`,
     `besoinsNonConfrontes`). `ARRÊT` : argument manquant, mêmes clés vides. Aucun verdict autre que
     `DOSSIER` n'arme de table : le dossier se refait.
4. **Table papier simulée** (chapitres à forte ambiguïté ; Tome 1 : 1, 2, 6, 8) — workflow
   `table-simulee`, APRÈS le dossier, qu'elle consomme : args
   `{ livre, chapitre, fichiers, dossier, seed, maxEchanges?, personas?, worktree, date }`,
   `dossier` = le rendu du workflow précédent au verdict `DOSSIER`, `trous` présents et vides (sinon `ARRÊT`).
   `maxEchanges` absent = 3 échanges par beat du dossier (mesure #1993 : ≈2 par beat atteint) ; chaque
   échange coûte ≈ 5 agents (1 MJ + 4 joueurs). Explicite, il prime (entier ≥ 1, sinon `ARRÊT`).
   - Préparation : fiches des 4 PJ par un lecteur qui ignore le chapitre (un id de PJ vide ou en double
     = `ARRÊT`) ; sosie désigné sur le dossier et la liste des PJ — `motif` toujours renseigné (pourquoi ce
     PJ, ou pourquoi aucun), `ref` vide sans sosie ; la fiche du MJ est TIRÉE du dossier corrigé.
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
- **Dossiers de chapitre, journaux de table, verdicts de goût** : commentaires de ticket.
- **Contenu** : le paquet de campagne manuscrit `src/scenes/<campagne>/<campagne>-projet.json`, états de
  campagne compris.

## Chapitre terminé

- Besoins obligatoires couverts, ou classés « blanc voulu » / « hors adaptation », motivés.
- Média de chaque beat décidé.
- Gardes et recette PREUVE vertes, console à 0 erreur.
- 0 porte fermée en silence ; 0 thème « m'aurait fait quitter ».
- Durée et difficulté dans la cible.
- Verdict de l'utilisateur consigné verbatim.

## Tome terminé

- Export de l'état du monde lu par le tome suivant.
