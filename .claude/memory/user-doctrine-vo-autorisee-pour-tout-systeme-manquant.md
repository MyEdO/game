---
name: user-doctrine-vo-autorisee-pour-tout-systeme-manquant
description: "Un SYSTÈME de règles absent des livres autorisés (colonie, entreprise, contacts, intrigue…) se prend à un livre VO de Source/, intégré livre par livre ; la VF garde la priorité quand elle couvre le système"
metadata:
  type: user
---

**Verbatim (2026-11-25)**, sur MyEdO/game#5064, à la question d'autoriser *Lustria*, *Archives of the Empire Vol III* et *Deft Steps Light Fingers* comme sources de règles : « Je vais autoriser tout système manquant oui, ca devient necessaire pour l'avenir du projet »

**Why :** les projets du noyau (chronique, dynastie, roguelite, jeu de factions) demandent des systèmes que seuls des suppléments VO décrivent ; les laisser hors source en ferait des règles inventées.

**How to apply :**
- Un système de règles qu'aucun livre autorisé ne couvre se prend au livre VO de `Source/` qui le décrit. Exemples : la colonie de *Lustria*, les Entreprises d'*Archives of the Empire Vol III*, les Contacts de *Deft Steps Light Fingers*, l'Intrigue du *High Elf Player's Guide*.
- Le livre s'intègre d'abord par le skill `ajouter-un-livre-source` (entrée au catalogue des livres, `docs/sources-vf.md`, Atlas), puis ses passages se citent comme ceux d'un livre FR.
- Quand un livre VF autorisé couvre le système, c'est lui qui fait foi : la VO ne comble qu'un manque.
- La prose suit la doctrine de langue de `user-doctrine-edition-5e-coeur-remplace-ldb-raw-sauf-errata` : verbatim VO, sans traduction, et repli de la VF vers la VO à l'affichage.
