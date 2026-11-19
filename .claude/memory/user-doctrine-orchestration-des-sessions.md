---
name: user-doctrine-orchestration-des-sessions
description: "Un orchestrateur distribue les lots. Chaque session mène son lot de la prise du ticket au solde publié, selon le même workflow."
metadata:
  type: user
---

**Verbatim (2026-11-19)**, au sujet du plafond de sessions et du régime propre à Codex : « Oublie cette consigne », puis « Supprime la d'ailleurs, ainsi que toutes les consignes spécifiques a Codex. »

**Verbatim (2026-11-19)** : « Codex et claude peuvent traiter des tickets de bout en bout maintenant et suivent le même workflow »

**Verbatim (2026-10-31)** : « ne garde jamais une session, il va faire un cache miss »

**Verbatim (2026-11-02)** : « Mais je ne comprends pas, tu utilise comment tes sessions ? Normalement on leur donne un ticket/un lot et il va de bout en bout. »

**How to apply :** un seul orchestrateur de sessions attribue et suit les lots. Chaque session orchestre ses agents, prend un lot entier et le mène jusqu'au solde publié après CI verte. Une session neuve prend chaque nouveau lot. Le skill `orchestrer-des-sessions` porte le cycle et la fiche `user-doctrine-fable-reserve-au-design` porte l'affectation des sujets 3D et des maquettes.
