// STOCK CLIQUETÉ de la JAMBE encore INLINE dans les tenues (#633) — consommé par
// `src/gameIso/rig/parts/tenues/jambes-gabarit-ratchet.test.ts`. Patron whitelist-en-lib du dépôt
// (`paletteLiteralStock.mjs`, `rigPartViewStock.mjs`).
//
// Chaque tenue redessinait sa jambe INLINE, recopiant le défaut de galbe genou/mollet. Le gabarit
// `jambeVetue` (`parts/bodies/jambe-gabarit.ts`) porte le contour + le galbe lissé UNE fois ; une
// tenue le consomme (ou compose le corps via `BODIES.`). La MESURE vit dans
// `scripts/guards/lib/jambesGabaritAudit.ts`, partagée avec sa régénération,
// `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/jambesGabaritAudit.ts` (politique `DECROISSANT`,
// refus SITE PAR SITE).
//
// FORME DES ENTRÉES — `{ fichier, ref, occurrence }`, la forme UNIQUE de tout stock nominatif du
// dépôt (`cleDeSite`, `scripts/guards/lib/stock.mjs`) : `fichier` = le def de tenue à ouvrir pour
// migrer, `ref` = `<id de tenue>:jambes:inline`. C'est le `fichier` que la porte de plage
// (`croissanceDesStocks`) voit : un id nu (`'apothicaire'`) lui est INVISIBLE, un append ne coûte
// alors rien. Aucun PLAFOND : ce qu'une dette ne peut pas faire, c'est croître SANS SE DÉCLARER, et
// c'est l'entrée nommée qui le dit. Toute prose posée ENTRE les entrées est mangée à la régénération.
//
// DEUX collections, une seule primitive :
//   — `JAMBE_INLINE_RATCHET` : la dette MESURÉE, GÉNÉRÉE, cible 0. Un def migré en sort à la
//     régénération ; un def qui n'a pas migré et qu'on retirerait à la main y RETOMBE (`neuves`).
//   — `JAMBE_SILHOUETTE_OVERRIDES` : les silhouettes ASSUMÉES (jambe volontairement hors gabarit).
//     Elle n'est PAS générée — les deux collections mesurent le MÊME fait (une jambe hors gabarit),
//     et seule la REVUE dit si c'est un choix d'art ou de la dette : la distinction est une
//     DÉCISION, donc cette collection s'écrit à la main. Tenue à zéro aujourd'hui : un cliquet tenu
//     à zéro est un cliquet (`stock.mjs`), il rend ses `neuves` sans plafond ni assertion spéciale.

export const JAMBE_INLINE_RATCHET = [
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Agitateur.ts', ref: 'agitateur:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Apothicaire.ts', ref: 'apothicaire:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Archer.ts', ref: 'archer:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Arquebusier.ts', ref: 'arquebusier:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Artilleur-de-navire.ts', ref: 'artilleur-de-navire:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Artilleur.ts', ref: 'artilleur:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Artisan.ts', ref: 'artisan:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Artiste.ts', ref: 'artiste:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Bailli.ts', ref: 'bailli:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Batelier.ts', ref: 'batelier:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Boucher-ogre.ts', ref: 'boucher-ogre:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Bourgeois.ts', ref: 'bourgeois:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Cartographe.ts', ref: 'cartographe:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Cavalier-leger.ts', ref: 'cavalier-leger:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Cavalier.ts', ref: 'cavalier:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Chansonnier.ts', ref: 'chansonnier:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Chasseur-de-primes.ts', ref: 'chasseur-de-primes:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Chasseur.ts', ref: 'chasseur:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Chevalier-du-loup-blanc.ts', ref: 'chevalier-du-loup-blanc:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Chevalier-du-soleil-flamboyant.ts', ref: 'chevalier-du-soleil-flamboyant:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Chevalier-errant.ts', ref: 'chevalier-errant:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Chevalier-panthere.ts', ref: 'chevalier-panthere:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Cocher.ts', ref: 'cocher:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Colporteur.ts', ref: 'colporteur:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Conseiller.ts', ref: 'conseiller:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Contrebandier.ts', ref: 'contrebandier:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Coureur-d-egout.ts', ref: 'coureur-d-egout:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Cultiste.ts', ref: 'cultiste:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Debardeur.ts', ref: 'debardeur:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Duelliste.ts', ref: 'duelliste:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Eclaireur.ts', ref: 'eclaireur:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Emissaire.ts', ref: 'emissaire:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Enqueteur.ts', ref: 'enqueteur:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Entremetteur.ts', ref: 'entremetteur:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Erudit.ts', ref: 'erudit:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Esclave-skaven.ts', ref: 'esclave-skaven:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Espion.ts', ref: 'espion:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Femme-du-fleuve.ts', ref: 'femme-du-fleuve:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Flagellant.ts', ref: 'flagellant:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Frere-loup.ts', ref: 'frere-loup:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Garde.ts', ref: 'garde:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Gardechamps.ts', ref: 'gardechamps:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Gardien-de-troupeaux-de-rhinox.ts', ref: 'gardien-de-troupeaux-de-rhinox:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Gladiateur.ts', ref: 'gladiateur:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Guerrier-du-chaos.ts', ref: 'guerrier-du-chaos:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Hallebardier.ts', ref: 'hallebardier:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Herboriste.ts', ref: 'herboriste:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Hors-la-loi.ts', ref: 'hors-la-loi:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Ingenieur.ts', ref: 'ingenieur:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Intendant.ts', ref: 'intendant:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Joueur-d-epee.ts', ref: 'joueur-d-epee:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Juriste.ts', ref: 'juriste:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Mangeur-d-hommes.ts', ref: 'mangeur-d-hommes:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Marchand.ts', ref: 'marchand:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Marin.ts', ref: 'marin:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Medecin.ts', ref: 'medecin:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Mendiant.ts', ref: 'mendiant:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Messager.ts', ref: 'messager:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Milicien.ts', ref: 'milicien:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Mineur.ts', ref: 'mineur:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Mystique.ts', ref: 'mystique:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Naufrageur.ts', ref: 'naufrageur:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Nautonier.ts', ref: 'nautonier:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Noble.ts', ref: 'noble:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Nonne.ts', ref: 'nonne:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Officier.ts', ref: 'officier:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Ogre.ts', ref: 'ogre:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Patrouilleur-des-karak.ts', ref: 'patrouilleur-des-karak:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Patrouilleur-fluvial.ts', ref: 'patrouilleur-fluvial:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Patrouilleur-routier.ts', ref: 'patrouilleur-routier:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Pilleur-de-tombes.ts', ref: 'pilleur-de-tombes:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Piquier.ts', ref: 'piquier:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Pretre-de-myrmidia.ts', ref: 'pretre-de-myrmidia:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Pretre-de-stromfels.ts', ref: 'pretre-de-stromfels:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Pretre-guerrier.ts', ref: 'pretre-guerrier:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Pretre-marin-de-manann.ts', ref: 'pretre-marin-de-manann:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Pretre.ts', ref: 'pretre:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Prophete-gris.ts', ref: 'prophete-gris:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Ranconneur.ts', ref: 'ranconneur:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Ratier.ts', ref: 'ratier:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Ratisseur-de-plages.ts', ref: 'ratisseur-de-plages:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Receleur.ts', ref: 'receleur:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Repurgateur.ts', ref: 'repurgateur:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Rodeur-fantome.ts', ref: 'rodeur-fantome:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Saltimbanque.ts', ref: 'saltimbanque:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Serviteur.ts', ref: 'serviteur:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Skaven.ts', ref: 'skaven:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Sorcier-de-village.ts', ref: 'sorcier-de-village:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Sorcier-dissident.ts', ref: 'sorcier-dissident:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Spadassin.ts', ref: 'spadassin:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Specialiste-de-siege.ts', ref: 'specialiste-de-siege:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Squelette.ts', ref: 'squelette:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Suiveur-de-camp.ts', ref: 'suiveur-de-camp:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Tueur.ts', ref: 'tueur:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Vampire.ts', ref: 'vampire:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Vermine-de-choc.ts', ref: 'vermine-de-choc:jambes:inline', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Voleur.ts', ref: 'voleur:jambes:inline', occurrence: 1 },
]

/** @type {ReadonlyArray<import('./stock.mjs').EntreeDeSite>} */
export const JAMBE_SILHOUETTE_OVERRIDES = []
