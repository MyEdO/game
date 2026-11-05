---
name: user-doctrine-structure-avant-garde
description: "Une classe de contournement se rend impossible à écrire par la structure (module, exports, types) ; une garde est à éviter absolument"
metadata:
  type: user
---

**Verbatim (2026-10-17)**, sur une garde de stock proposée contre les Critiques appliqués hors pipeline : « Le projet va finir en un amalgame de garde. »

**Verbatim (2026-10-18)**, sur une garde tenue par une liste de fichiers : « Il n'est pas interdit de bouger le code mal placé en tout cas. »

**Verbatim (2026-10-25)** : « L'objectif c'est de traiter la dette et s'assurer qu'il ne soit plus possible de créer. […] On ne cherche pas a cacher la dette, ou la déplacer. »

**Verbatim (2026-10-25)** : « Je pensais que le but était de rendre impossible de créer de la dette car le code ne le permet juste pas et supprimé les gardes ne servent donc plus. »

**Verbatim (2026-11-04)**, sur une garde annoncée contre les clôtures de jet manuscrites (#3324) : « le credo n'est pas a jour, les gardes sont a éviter ABSOLUEMENT »

**Why :** une garde mesure une fuite après coup et ajoute un stock à entretenir ; une frontière de module (exports minimaux, applicateurs internes) rend la fuite incompilable sans rien à entretenir.

**How to apply :** devant une classe de contournement, cherche le module, les exports et le type qui la rendraient impossible à écrire, et n'exporte que les entrées du chemin canonique. Aucune garde neuve : si la structure semble ne pas pouvoir porter l'invariant, cherche encore, sinon dis-le à l'utilisateur. Une garde à liste de fichiers fait déplacer ces fichiers dans un dossier commun, jugé par glob. Une classe soldée par la structure voit sa garde et son stock supprimés.
