---
name: user-arbitrage-bestiaire-frenchy
description: "Les profils du Guide fan de Frenchy reviennent au bestiaire comme bestiaire d'auteur cité par page ; ses sorts viennent après"
metadata:
  node_type: memory
  type: user
---

Verbatim utilisateur (2026-11-07) : « Je veux donc profiter de cette expérience pour réintégrer les profils de Frenchy, vu que lui a réussi, corriger les bugs qu'il a detecté dans notre application, et aussi voir d'autres trucs que lui a intégré et qui aurait du sens dans notre jeu »

Verbatim utilisateur (2026-11-08, carte) : « Profils d'abord, sorts ensuite »

Verbatim utilisateur (2026-11-08, carte) : « Oui, comme bestiaire d'auteur »

Verbatim utilisateur (2026-11-08) : « Et l'atlier fourni deja les pages non ? »

**Why:** le *Guide fan v4.5* (« Habitants & Créatures du Vieux-Monde ») apporte des profils jouables que les livres officiels n'ont pas ; son retrait par #3015 visait la dette de son import, pas ses profils.

**How to apply:** le livre `guide-frenchy` est sans `dir` (l'Atelier fournit les pages, aucune extraction) : une source de PROFILS de créatures seulement, chaque statbloc cité `{ book: 'guide-frenchy', page }` ; ses règles maison (Armure doublée, Traits `guide-*`) n'entrent pas, ses sorts propres attendent un second chantier ; un profil officiel homonyme garde son id nu, celui du guide prend le suffixe `-hcvm`.
