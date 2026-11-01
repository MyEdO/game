# Coop en ligne (Jalon 7) — design

**Statut : ARBITRÉ (2026-06-11) — « ça doit marcher avec un code à partager, sans dépendre
d'un système externe »** → WebRTC **sans broker** : signalisation par échange de codes
(copier/coller), aucune lib réseau tierce, aucun serveur. Le §2 est mis à jour en conséquence ;
PeerJS (cloud OU self-host) est écarté.

## 1. Contraintes du projet

- **Prod 100 % statique** (GitHub Pages, `cgauche.github.io/jeu/`) : pas de serveur applicatif à
  héberger/maintenir. Toute solution exigeant un backend permanent casse le déploiement actuel.
- **Tour par tour** : latence non critique (pas de tick temps réel) ; 2-4 joueurs entre amis.
- **Socle déjà en place** : RNG de combat seedable (`battleRng`/`store.seedRng`) ; **état
  entièrement sérialisable** (prouvé par la sauvegarde : `snapshotSave` capture toutes les clés
  de données de `getInitialState`) ; hotseat fonctionnel (tout le monde contrôle tout).

## 2. Topologie réseau — ARBITRÉ : WebRTC DataChannel, signalisation par CODES (zéro broker)

| Option | Verdict |
|---|---|
| **WebRTC pur + codes copiés/collés** (offre/réponse SDP compressées en codes texte) | ✅ **Arbitrage utilisateur (#3175)** : un code se partage sans système externe. Zéro serveur, zéro lib tierce, marche sur GitHub Pages tel quel. |
| WebRTC + PeerJS (broker de signaling cloud) | ❌ Écarté par l'arbitrage : dépendance à un service tiers. |
| WebSocket + serveur maison | ❌ Backend hébergé (coût, ops, hors modèle statique). |

**Flux de connexion** (par invité ; l'hôte répète pour chaque siège, 3 max) :
1. Hôte « Inviter un joueur » → l'app génère un **code d'invitation** (offre SDP + candidats ICE,
   dégonflée `CompressionStream` → base64url, préfixe de version `W4C1.`) → l'hôte l'envoie par
   le canal de son choix (Discord, SMS…).
2. L'invité colle le code → l'app génère un **code de réponse** (même encodage) → il le renvoie.
3. L'hôte colle la réponse → le DataChannel s'ouvre → handshake `hello` (version de build).

**STUN, assumé et documenté** : `stun:` est un simple annuaire d'adresses publiques (AUCUNE
donnée de jeu n'y transite, remplaçable par n'importe quelle URL stun, constante dans le code).
Sans STUN, la connexion ne marche en pratique qu'en LAN ; avec, la plupart des NAT domestiques
passent. Pas de TURN (relais) : si deux NAT symétriques se croisent, ça ne se connecte pas —
limite documentée « jeu entre amis ».

## 3. Modèle d'autorité — RECOMMANDATION : hôte-autoritaire + snapshots d'état

- **Hôte-autoritaire** : SEUL l'hôte exécute le store/les règles. Les invités envoient des
  **intentions** (`{ action: 'battleClickEntity', args: [...] }`) ; l'hôte les rejoue, puis
  **broadcast un snapshot** de l'état (réutilise `snapshotSave` — données JSON-sûres).
- Alternative écartée : **lockstep déterministe** (chaque client rejoue les actions, RNG seedé).
  Élégant sur le papier (le socle seedable existe) mais fragile : LA MOINDRE source de
  non-déterminisme (ordre d'itération, `Date.now` caché, divergence de version) = désync
  silencieuse indétectable. Le snapshot autoritaire est trivialement correct.
- Coût : un snapshot complet par action (~50-300 Ko JSON). Pour du tour par tour à 4, c'est
  acceptable en DataChannel ; optimisation différentielle (delta/compression) = V2 si besoin.
- Le RNG vit chez l'hôte → aucune triche/désync possible côté invité.

## 4. Contrôles & propriété

Chaque joueur dispose de son écran et contrôle les personnages attribués au lobby. En combat,
les modales restent propres aux personnages concernés ; en exploration, l’hôte agit et les autres
écrans reflètent son état. Le périmètre V1 couvre le combat ; les précisions suivent ci-dessous. #3175.

- **Chaque joueur a SON écran** (son navigateur) — il n'y a jamais d'écran partagé.
- **Propriété par lot** : au lobby, l'hôte attribue à chaque siège un NOMBRE LIBRE de héros
  (`ownership: Record<heroId, seat>` — pas du 1:1 strict ; un joueur peut en contrôler 2).
- **Combat (le périmètre V1)** : les modales de jet (Attaque/Défense/Incantation/jets divers)
  ne S'AFFICHENT que chez le PROPRIÉTAIRE du combattant concerné — gating d'affichage par
  ownership (les pendings voyagent dans le snapshot ; les autres joueurs voient la scène, le
  journal et un indicateur « X joue… »). La hotbar n'est interactive que pour le propriétaire
  du combattant actif.
- **Exploration : MIROIR** — l'hôte fait tout (déplacements, dialogues, fouilles, marchand) et
  les écrans invités REFLÈTENT son état (snapshots) sans aucune interaction (V1) ; leurs fiches
  restent consultables.
- **Interlude/menus** : hors périmètre V1 (miroir comme l'exploration).
- L'écran de création/roster reste local ; V1 : l'hôte compose le groupe comme aujourd'hui.

### 4bis. Modales : à qui, et lesquelles (arbitré 2026-06-11, contre-propositions retenues)

- **Une modale n'apparaît que chez le(s) CONCERNÉ(S)** : je prends/inflige un Coup Critique → je
  la vois ; MA Colère divine, MA maladresse, MON Imparfaite → chez moi. Un événement purement
  ENNEMI (maladresse/miscast/Colère d'un monstre) → **AUCUNE modale** : le **bandeau d'événements
  EXISTANT** (journal de combat structuré → bandeau du HUD) porte une version COURTE des
  événements ennemis majeurs (Colère, critique, Imparfaite), le journal garde le détail ; si
  l'effet touche un héros (dégâts/État), son propriétaire reçoit la modale adaptée (défense…).
  ⚠️ S'applique AUSSI EN SOLO → chantier `pendingReveals` : supprimer les révélations témoin
  purement ennemies (→ bandeau+journal).
- **Auto-fermeture des informatives** (sans choix joueur) : délai COURT (3-4 s) pour le mineur
  (rechargement, entretien…), LONG avec **barre de temps visible** (8-10 s) pour un
  critique/État grave sur TON héros ; un clic ferme toujours avant.
- **Contre-sort à PLUSIEURS** : RAW vérifié (LDB 46 — « un seul Sort chaque Round » = limite PAR
  lanceur ; « plusieurs lanceurs… effectuent leur lancer séparément ») : chaque propriétaire
  d'un contre-lanceur éligible voit le sort ennemi et tente sur LE MÊME sort (déjà le
  comportement moteur — `dispelledThisRound` par combattant).
- **Ready-check** : DÉBUT DE COMBAT et VICTOIRE seulement (portraits d'un perso par joueur +
  ✓/✗ au-dessus de la barre). Les Rounds s'enchaînent SANS gate ; un bouton « ✋ » discret
  permet d'ouvrir volontairement la fenêtre Chance du début de Round. (Le « agir en premier »
  reste individuel.)
- **Victoire & butin** : écran de fin SYNCHRONISÉ + ready-check ; attribution du loot visible
  en temps réel chez tous ; un changement d'attribution ne dévalide QUE le joueur à qui on
  retire un objet déjà pris.
- Un joueur déconnecté : ses héros repassent à l'hôte, son ✓ n'est plus requis.

## 5. Architecture code (sans toucher au moteur)

```
src/net/
  codes.ts        encode/décode des codes de signalisation (JSON → deflate → base64url, préfixe W4C1.)
  protocol.ts     messages : {kind:'intent'|'snapshot'|'hello'|'assign'|'chat'}, version du protocole
  session.ts      « NetSession » : 'local' (défaut, comportement actuel) | 'host' | 'guest'
  transport.ts    RTCPeerConnection nu (offer/answer/DataChannel) + FakeTransport (tests en mémoire)
  intents.ts      registre des actions REJOUABLES (allowlist nom→action store + validation owner)
```
- **Couture store minimale** : un middleware d'INTERCEPTION — en mode `guest`, les actions de
  l'allowlist ne s'exécutent pas localement : elles partent en intent ; en mode `host`, après
  chaque action de l'allowlist, broadcast du snapshot. Le mode `local` est un no-op total
  (zéro régression hotseat).
- Les modales/pendings : DANS le snapshot (déjà des données pures — le chargement de save les
  restaure déjà). Le gating « qui voit quoi » est un filtre d'AFFICHAGE par ownership, pas une
  logique d'état.
- `seedRng` à l'ouverture de session (l'hôte seed et broadcast — utile aux replays/logs, pas à
  la correction).

## 6. Lobby & cycle de vie

1. « Jouer en ligne » (menu) → Héberger (bouton « Inviter » par siège → **code d'invitation** à
   envoyer, champ « Coller la réponse ») ou Rejoindre (coller l'invitation → **code de réponse**
   à renvoyer).
2. Lobby : liste des connectés, attribution des héros (drag/select), bouton Lancer (hôte).
3. En partie : indicateur de connexion par joueur ; un invité déconnecté → ses héros repassent
   à l'hôte (bandeau « X a quitté — reprise par l'hôte ») ; reconnexion par le même code →
   re-handshake + snapshot complet.
4. Sauvegarde : l'HÔTE sauvegarde (slots existants) ; recharger une save en ligne = ré-héberger
   puis réattribuer les héros.

## 7. Sécurité/limites assumées (V1)

Pas d'anti-triche au-delà de l'autorité hôte (jeu entre amis) ; pas de chat vocal (texte
optionnel V2) ; 4 joueurs max ; même version de build requise (check de version au hello).

## 8. Découpage d'implémentation

- **P0a** : `codes.ts` + `protocol.ts` (purs, testés — encode/décode, version, parse).
- **P0b** : `NetSession` + allowlist d'intents + middleware (mode local inerte) — testable sans
  réseau (deux stores en mémoire reliés par `FakeTransport`).
- **P1** : transport WebRTC nu + lobby codes (héberger/inviter/rejoindre/attribuer) + snapshot
  broadcast — recette à deux onglets.
- **P2** : ownership UI (hotbar/modales gâtées par propriétaire, spectateur).
- **P3** : robustesse — reconnexion (nouveau code), version check, héros orphelins, indicateurs.
- **P4 (V2)** : deltas d'état, exploration déléguée, chat.

## 9. Arbitrages — TOUS TRANCHÉS (2026-06-11)

1. ~~PeerJS cloud ?~~ Aucun système externe — codes à partager (WebRTC pur, signalisation
   copier/coller, STUN public assumé comme simple annuaire).
2. Exploration **pilotée par l'hôte** (confirmé utilisateur).
3. **4 joueurs max, un par héros, pas de spectateurs** (confirmé utilisateur).
