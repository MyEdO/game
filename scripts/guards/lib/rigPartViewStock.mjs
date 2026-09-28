// STOCK CLIQUETÉ du FORMAT DE PART du rig (#551) — consommé par
// `src/gameIso/rig/parts/tenues/part-view-format.test.ts`. Patron whitelist-en-lib du dépôt
// (`folioRatchetStock.mjs`, `rollSeamWhitelist.mjs`).
//
// FORMAT : un slot de CORPS se fournit en TROIS vues `{front, profile, back}`.
// Le discriminant est celui du PIPELINE lui-même (`declaredView`, `viewArt.ts`, lu par `isDrawnView`,
// `partViewAudit.ts`) — la garde l'importe, elle n'en réplique pas la définition.
//
// PÉRIMÈTRE : les DEUX registres qui alimentent les slots de corps de `resolveParts` — les TENUES
// (clé `<tenueId>:<slot>`) et les ARMURES (clé `armure:<materiau>:<slot>`). L'armure PRIME sur la
// tenue (`resolve.ts`, `armed ?? tenuePart`) : hors périmètre, elle laissait le format vert sur une
// tenue conforme pendant qu'un personnage en plaque recevait un bras de face plaqué.
//
// FORME DES ENTRÉES — `{ fichier, ref, occurrence }`, la forme UNIQUE de tout stock nominatif du
// dépôt (`cleDeSite`, `scripts/guards/lib/stock.mjs`). Chaque entrée NOMME le fichier de def à
// ouvrir pour solder, et c'est ce que la porte de plage (`croissanceDesStocks`) voit : une clé nue
// (`'apothicaire:jambes'`) lui est INVISIBLE, un append ne coûte alors rien. Aucun PLAFOND ne vit
// ici ni dans la garde : ce qu'une dette ne peut pas faire, c'est croître SANS SE DÉCLARER, et c'est
// l'entrée nommée qui le dit — la garde compare par `ecartDuVolet` (neuves ET périmées).
//
// --- PART_VIEW_RATCHET : slots fournis en `string` FRONT-ONLY ---
// Corps GÉNÉRÉ par `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/partViewAudit.ts`
// (politique `DECROISSANT` : elle refuse SITE PAR SITE, `refusDeCroissance`). Toute prose posée ENTRE les entrées est mangée à la
// régénération — l'explication vit dans cet en-tête.
// Le dégât MESURÉ par `resolveParts` (le chemin réel), pas supposé, tient à deux mécanismes selon le slot :
//   - `bras` (78 clés) : `resolve.ts` ne substitue RIEN sur ce slot — `viewOrFront` retombe sur `front`,
//     donc l'art de FACE est servi VERBATIM de profil et de dos (« FRONT PLAQUE »).
//   - `torse`/`jambes`/`tete` (89 clés) : `resolve.ts` invente une silhouette générique
//     (`PROFILE_TORSE`/`BACK_JAMBE`…) teintée par `dominantCloth` — l'art de la tenue est IGNORÉ.
//
// --- PART_VIEW_ALIAS_RATCHET : vues DÉCLARÉES mais ALIASÉES sur le front ---
// Une vue dont le DESSIN est celui du front satisfait le format tout en produisant EXACTEMENT le
// défaut que le format vise à tuer (art de face plaqué). Sans ce second cliquet, la vague d'art
// solderait le stock ci-dessus en aliasant — garde verte, rendu inchangé. Clé `<porteur>:<slot>:<vue>`.
// La comparaison porte sur la GÉOMÉTRIE (`geometry`, dans la garde), pas sur la chaîne servie : une
// égalité de chaînes se contourne par un espace, un commentaire ou un `<g>` inerte, et rate le front
// simplement RECOLORÉ (cf. `nonne:jambes:back`, trouvé par le passage à la géométrie).
//
// ENQUÊTE des trois entrées d'ALIAS (elle vit ici, la génération mangeant toute prose interne) :
//   - `ogre:jambes:profile` et `ogre:jambes:back` — l'ogre a reçu ses 3 vues de jambe au fix des
//     jambes olive (`394f2b29`, #538) : le MÊME fragment `JAMBE` est servi aux 3 vues. La chair
//     cesse d'être olive (le défaut visé est bien mort), mais le profil garde la largeur et la
//     lanière de la vue de face — genou et botte de côté restent à dessiner.
//   - `nonne:jambes:back` — le dos de la Nonne est son art de FACE au trait près, repeint `@cuir` ->
//     `@cuirO` (assombri) : géométrie identique (paths byte-pour-byte), seul le remplissage change.
//     La comparaison de CHAÎNES le tenait pour un vrai dos ; la géométrie le voit. Genou/talon de
//     dos restent à dessiner.
//
// CLIQUET, pas absolution : la garde échoue (a) sur toute violation ABSENTE de ces listes — une
// tenue neuve fournit ses 3 vues ; (b) sur toute entrée qui ne viole PLUS. Un slot se solde en
// DESSINANT la vue, jamais en allongeant la liste — et l'allonger se voit à la porte de plage.
//
// Ampleur à la pose (2026-07-17) : 171 slots front-only / 426 fournis (40,1 %) sur 121 porteurs
// (117 tenues + 4 armures). Tenues : 167/410 (40,7 %) ; 93 des 117 defs (79,5 %) portent au moins un
// slot au stock — bras 78/101 (77,2 %), jambes 72/117 (61,5 %), torse 13/117 (11,1 %), tete 4/75
// (5,3 %). Armures : 4/16 — les 4 matériaux (cuir/maille/plaque/rembourre) servent leurs 3 vues sur
// tete/torse/jambes et sont front-only sur le SEUL slot `bras`. Ces 171 slots sont TOUS des strings
// pures : aucun def ne fournit une vue partielle (profil sans dos ou l'inverse) — population bimodale.
// Clé = `<id de tenue>:<slot>` (id STABLE `slugId(def.name)`, jamais le libellé) ou
// `armure:<materiau>:<slot>` ; le libellé est en commentaire.

export const PART_VIEW_RATCHET = [
  { fichier: 'src/gameIso/rig/parts/armour/defs/Cuir.ts', ref: 'armure:cuir:bras', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/armour/defs/Maille.ts', ref: 'armure:maille:bras', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/armour/defs/Plaque.ts', ref: 'armure:plaque:bras', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/armour/defs/Rembourre.ts', ref: 'armure:rembourre:bras', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Apothicaire.ts', ref: 'apothicaire:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Artiste.ts', ref: 'artiste:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Bailli.ts', ref: 'bailli:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Boucher-ogre.ts', ref: 'boucher-ogre:bras', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Cavalier.ts', ref: 'cavalier:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Chasseur-de-primes.ts', ref: 'chasseur-de-primes:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Chasseur.ts', ref: 'chasseur:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Chevaucheur-de-blaireau.ts', ref: 'chevaucheur-de-blaireau:bras', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Cocher.ts', ref: 'cocher:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Colporteur.ts', ref: 'colporteur:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Conseiller.ts', ref: 'conseiller:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Contrebandier.ts', ref: 'contrebandier:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Coureur-d-egout.ts', ref: 'coureur-d-egout:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Coureur-d-egout.ts', ref: 'coureur-d-egout:tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Coureur-d-egout.ts', ref: 'coureur-d-egout:torse', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Debardeur.ts', ref: 'debardeur:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Duelliste.ts', ref: 'duelliste:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Eclaireur.ts', ref: 'eclaireur:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Emissaire.ts', ref: 'emissaire:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Enqueteur.ts', ref: 'enqueteur:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Entremetteur.ts', ref: 'entremetteur:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Erudit.ts', ref: 'erudit:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Esclave-skaven.ts', ref: 'esclave-skaven:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Esclave-skaven.ts', ref: 'esclave-skaven:torse', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Espion.ts', ref: 'espion:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Femme-du-fleuve.ts', ref: 'femme-du-fleuve:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Garde.ts', ref: 'garde:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Gardien-de-troupeaux-de-rhinox.ts', ref: 'gardien-de-troupeaux-de-rhinox:bras', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Gladiateur.ts', ref: 'gladiateur:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Herboriste.ts', ref: 'herboriste:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Hors-la-loi.ts', ref: 'hors-la-loi:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Ingenieur.ts', ref: 'ingenieur:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Intendant.ts', ref: 'intendant:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Juriste.ts', ref: 'juriste:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Mangeur-d-hommes.ts', ref: 'mangeur-d-hommes:bras', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Marchand.ts', ref: 'marchand:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Marin.ts', ref: 'marin:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Medecin.ts', ref: 'medecin:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Messager.ts', ref: 'messager:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Milicien.ts', ref: 'milicien:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Mineur.ts', ref: 'mineur:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Mystique.ts', ref: 'mystique:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Naufrageur.ts', ref: 'naufrageur:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Nautonier.ts', ref: 'nautonier:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Ogre.ts', ref: 'ogre:bras', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Patrouilleur-fluvial.ts', ref: 'patrouilleur-fluvial:bras', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Patrouilleur-fluvial.ts', ref: 'patrouilleur-fluvial:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Patrouilleur-routier.ts', ref: 'patrouilleur-routier:bras', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Patrouilleur-routier.ts', ref: 'patrouilleur-routier:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Pilleur-de-tombes.ts', ref: 'pilleur-de-tombes:bras', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Pilleur-de-tombes.ts', ref: 'pilleur-de-tombes:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Pretre-guerrier.ts', ref: 'pretre-guerrier:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Pretre.ts', ref: 'pretre:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Prophete-gris.ts', ref: 'prophete-gris:bras', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Prophete-gris.ts', ref: 'prophete-gris:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Prophete-gris.ts', ref: 'prophete-gris:torse', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Ranconneur.ts', ref: 'ranconneur:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Ratier.ts', ref: 'ratier:bras', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Ratier.ts', ref: 'ratier:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Receleur.ts', ref: 'receleur:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Repurgateur.ts', ref: 'repurgateur:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Rodeur-fantome.ts', ref: 'rodeur-fantome:bras', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Saltimbanque.ts', ref: 'saltimbanque:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Serviteur.ts', ref: 'serviteur:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Sorcier-de-village.ts', ref: 'sorcier-de-village:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Sorcier-dissident.ts', ref: 'sorcier-dissident:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Spadassin.ts', ref: 'spadassin:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Tueur.ts', ref: 'tueur:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Vermine-de-choc.ts', ref: 'vermine-de-choc:bras', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Vermine-de-choc.ts', ref: 'vermine-de-choc:jambes', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Vermine-de-choc.ts', ref: 'vermine-de-choc:tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Vermine-de-choc.ts', ref: 'vermine-de-choc:torse', occurrence: 1 },
]

export const PART_VIEW_ALIAS_RATCHET = [
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Nonne.ts', ref: 'nonne:jambes:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Ogre.ts', ref: 'ogre:jambes:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Ogre.ts', ref: 'ogre:jambes:profile', occurrence: 1 },
]
