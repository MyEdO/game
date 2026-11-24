---
name: user-arbitrage-bestiaire-non-officiel
description: "Le Bestiaire non officiel devient un livre de la base commune : ses créatures jouent en combat, ses Traits propres n'ont de mécanique que par la donnée"
metadata:
  node_type: memory
  type: user
---

Verbatim utilisateur (Clément, 2026-11-06, cité au `LISEZMOI.md` de l'Atelier des PNJ, PR #3633) : « Pour les éléments manquants, tu peux les reprendre du fanmade et le tagger ainsi ? »

Verbatim utilisateur (laurent, 2026-11-24, épique #4903) : « C est un énorme défaut du jeu de ne pas accepter le bestiaire fan de fonctionner »

Verbatim utilisateur (laurent, 2026-11-24, épique #4903) : « Pas grave pour le moment si les traits manquant ne font rien. On peut faire ça plus tard »

Verbatim utilisateur (laurent, 2026-11-24, #4916) : « Je ne sais pas si je suis fan de mettre dans le noyau les modèles de carrière, profils de héros et rôles de bête. Jusqu a maintenant je n ajoutais que des données dans le data driven, là on va devoir modifier autre chose que des fichiers json non ? » ; carte de décision du même jour, choisi « Dans l'Atelier, à la création ».

Verbatim utilisateur (laurent, 2026-11-24, #4917) : « Je ne veux pas coder les traits qui ne sont pas officiels. »

**Why:** les créatures du *Bestiaire non officiel* (Le Ratier Bretonnien, v2.03) n'existaient qu'à l'Atelier des PNJ, refusées au lancement d'un combat ; l'utilisateur veut qu'elles jouent comme celles des livres officiels.

**How to apply:** le livre `bestiaire-non-officiel` (BNO) est sans `dir` : ses créatures entrent au bestiaire, citées `{ book: 'bestiaire-non-officiel', page }`, ses Traits propres au catalogue par leur texte verbatim. Ses modèles de carrière, profils de héros et rôles de bête ne sont pas des règles du noyau : l'Atelier des PNJ les applique à la création, en une fiche ordinaire (plan #4903, L10). Ses Traits propres n'ont de mécanique que par la donnée (fiche `user-arbitrage-contenu-fan-sans-code-neuf`). Un id repris d'un catalogue croisé prend le suffixe `-bno`.
