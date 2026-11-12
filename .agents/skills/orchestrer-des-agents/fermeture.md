<!-- GENERATED: agents:sync; source=.claude/skills/orchestrer-des-agents/fermeture.md -->
# Fermeture

Annexe du skill `orchestrer-des-agents` (`.agents/skills/orchestrer-des-agents/SKILL.md`).

**8. Fermeture.** Toute vague qui ferme des tickets se termine par une **passe de réfutation NON
demandée** AVANT toute annonce ; l'annonce porte les VERDICTS (TIENT / FRAGILE / RÉFUTÉ), jamais un score.
Périmètre : fermetures, splits, claims d'agents, écarts non ticketés, ABSTENTIONS (« bloqué » → « prouve
que le blocage n'existe pas », étage `verif-mecanique`) et MES PROPRES COMMITS. Ces règles se DURCISSENT sous pression de temps, elles ne s'y suspendent pas.
- **Le juge de fermeture est NEUF quand le ticket tranche une règle de jeu, un socle ou une structure** :
  brief = DoD, diff, tests, et le `verdict:` du solde est SA sortie. Sinon, le `verdict:` est ma relecture
  du DoD contre la preuve exécutée (#3223).
  Un DoD ou un solde QUANTIFIÉ (« tout », « jamais », « chaque ») porte l'ÉNUMÉRATION de sa classe :
  commande et sortie, jamais une liste de mémoire (#1561).
- **Chaque clôture de phase : juge « ARCHITECTURE À REBOURS »** — partant de zéro, cette couture
  existerait-elle ?
- **C'est le TRAVAIL qui se ferme.** Une clause de DoD portée par un ticket ouvert n'est pas soldée
  (« FERMABLE SOUS DÉCISION » = « NON FERMABLE » ; #925) ; l'objectif suivant ne raccourcit jamais le DoD. Un
  reste que le chantier peut solder lui-même (« limite », « à vérifier », « suite » de son objectif) se solde
  avant l'annonce : le lot GROSSIT ou le ticket RESTE OUVERT, aucun ticket de reste ne naît (fiche
  `user-doctrine-fini-sans-reste`). Ne naît en ticket que ce qui attend l'utilisateur ou un autre fil nommé,
  rattaché à une VAGUE NOMMÉE ; « LIVRÉ » exige des restes soldés ou GELÉS par arbitrage utilisateur daté. Une vague
  ferme au moins autant qu'elle ouvre.
- Un ticket que J'ÉCRIS sur un socle porte son `## Invariant` ; une question qu'il pose se confronte
  D'ABORD aux invariants (tickets-programmes, doctrines) : si une doctrine répond, le ticket ÉNONCE.
