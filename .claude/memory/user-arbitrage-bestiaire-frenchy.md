---
name: user-arbitrage-bestiaire-frenchy
description: "Les profils et les sorts propres du Guide fan de Frenchy entrent comme contenu d'auteur cité par page ; chaque sort garde son livre VO"
metadata:
  node_type: memory
  type: user
---

Verbatim utilisateur (2026-11-07) : « Je veux donc profiter de cette expérience pour réintégrer les profils de Frenchy, vu que lui a réussi, corriger les bugs qu'il a detecté dans notre application, et aussi voir d'autres trucs que lui a intégré et qui aurait du sens dans notre jeu »

Verbatim utilisateur (2026-11-08, carte) : « Profils d'abord, sorts ensuite »

Verbatim utilisateur (2026-11-08, carte) : « Oui, comme bestiaire d'auteur »

Verbatim utilisateur (2026-11-08) : « Et l'atlier fourni deja les pages non ? »

Verbatim utilisateur (2026-11-08, carte, #3666) : « Oui, sourcés au guide »

Verbatim utilisateur (2026-11-08, #3666) : « Le jour où leurs vfs seront en ma possession, on mettra à jour ses sorts »

**Why:** le *Guide fan v4.5* (« Habitants & Créatures du Vieux-Monde ») apporte des profils jouables que les livres officiels n'ont pas ; son retrait par #3015 visait la dette de son import, pas ses profils.

**How to apply:** le livre `guide-frenchy` est sans `dir` (l'Atelier fournit les pages, aucune extraction) : une source de PROFILS de créatures et de SORTS propres, chacun cité `{ book: 'guide-frenchy', page }` ; ses règles maison (Armure doublée, Traits `guide-*`) n'entrent pas ; un sort propre entre avec la prose verbatim de sa table, `titreVO` et `livreVO` (titre VO, livre VO que le guide nomme), pour que sa VF officielle le remplace, ou reste hors catalogue quand aucun GameOp ne porte son effet (#3666) ; un profil officiel homonyme garde son id nu, celui du guide prend le suffixe `-hcvm`.
