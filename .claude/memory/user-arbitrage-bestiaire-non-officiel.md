---
name: user-arbitrage-bestiaire-non-officiel
description: "Le Bestiaire non officiel devient un livre de la base commune : ses créatures jouent en combat, ses Traits propres entrent d'abord sans mécanique"
metadata:
  node_type: memory
  type: user
---

Verbatim utilisateur (Clément, 2026-11-06, cité au `LISEZMOI.md` de l'Atelier des PNJ, PR #3633) : « Pour les éléments manquants, tu peux les reprendre du fanmade et le tagger ainsi ? »

Verbatim utilisateur (laurent, 2026-11-24, épique #4903) : « C est un énorme défaut du jeu de ne pas accepter le bestiaire fan de fonctionner »

Verbatim utilisateur (laurent, 2026-11-24, épique #4903) : « Pas grave pour le moment si les traits manquant ne font rien. On peut faire ça plus tard »

**Why:** les créatures du *Bestiaire non officiel* (Le Ratier Bretonnien, v2.03) n'existaient qu'à l'Atelier des PNJ, refusées au lancement d'un combat ; l'utilisateur veut qu'elles jouent comme celles des livres officiels.

**How to apply:** le livre `bestiaire-non-officiel` (BNO) est sans `dir` (les fiches de l'Atelier fournissent les pages, aucune extraction VF) : ses créatures entrent au bestiaire, chacune citée `{ book: 'bestiaire-non-officiel', page }`, ses Traits propres au catalogue par leur texte verbatim ; ses modèles de carrière, profils de héros et rôles de bête sont des règles du noyau. Ses Traits propres ne font rien en jeu tant que le ticket de leur mécanique n'est pas soldé : c'est un écart daté à la règle 7 d'`AGENTS.md`, borné à ces Traits (#4916). Un id du livre qui en reprend un d'un catalogue croisé prend le suffixe `-bno`.
