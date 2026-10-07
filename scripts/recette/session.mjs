// SESSION TENUE de recette (#2306.1) : un GARDIEN tient Chrome, l'app et la console entre deux
// commandes de l'agent ; chaque commande est un script `.mjs` client qui s'attache (`attacherSession`,
// `lib.mjs`), joue, lit, et se détache. Voir docs/recette-navigateur.md § « Session tenue ».
//
//   node scripts/recette/session.mjs ouvrir [url] [--vue bureau|portable|mobile] [--inactivite <ms>]
//        → GARDIEN, à lancer EN FOND : vit jusqu'à `fermer` ou au délai d'inactivité ;
//   node scripts/recette/session.mjs fermer   → idempotent (gardien vivant : signal ; mort : purge vérifiée) ;
//   node scripts/recette/session.mjs etat     → le fichier de session et la vie du gardien ;
//   node scripts/recette/session.mjs purger   → profils du kit (`PREFIXE_PROFIL`) sans session vivante.
//
// La VUE appartient au gardien. Un client qui émule (`setViewport`) puis se détache laisse la fenêtre
// NATIVE : le gardien ré-impose sa vue au signal `vue` que pose le `close` du client. Le gardien ne
// voit pas le détachement d'un client par le CDP — mesuré le 2026-10-05 (sonde du codeur, Chrome
// headless) : avec `Target.setDiscoverTargets`, aucun `Target.detachedFromTarget` ni
// `targetInfoChanged` n'arrive sur la connexion du gardien quand un client d'une AUTRE connexion se
// détache, et sa vue retombe à 1685×682.
// Chrome n'est jamais lancé `detached` (`OPTIONS_SPAWN_CHROME`) : un gardien TUÉ emporte son Chrome ;
// seul son profil reste, que `fermer` purge par son chemin enregistré.
// Toutes les écritures (fichier de session, journal, signaux, profil) vivent dans `lib.mjs`, sous os.tmpdir().
import { DEFAULT_URL, fermerSession, fichierDeSession, processusVivant, purgerProfilsOrphelins, tenirSession, DISQUE } from './lib.mjs';

const [commande, ...reste] = process.argv.slice(2);
const option = (nom, defaut) => {
  const i = reste.indexOf(`--${nom}`);
  return i >= 0 ? reste[i + 1] : defaut;
};
const positionnel = reste.find((a, i) => !a.startsWith('--') && !reste[i - 1]?.startsWith('--'));
const sortir = (objet) => console.log(JSON.stringify(objet, null, 2));

try {
  if (commande === 'ouvrir') {
    const fichier = fichierDeSession();
    console.log(`gardien ${process.pid} — session ${fichier}`);
    sortir(await tenirSession(positionnel ?? DEFAULT_URL, { vue: option('vue', 'bureau'), inactiviteMs: Number(option('inactivite', 30 * 60 * 1000)), fichier }));
  } else if (commande === 'fermer') {
    sortir(await fermerSession());
  } else if (commande === 'etat') {
    const fichier = fichierDeSession();
    if (!DISQUE.existe(fichier)) sortir({ etat: 'aucune', fichier });
    else {
      const d = JSON.parse(DISQUE.lire(fichier));
      sortir({ etat: processusVivant(d.pidGardien) ? 'tenue' : 'gardien-mort', fichier, ...d });
    }
  } else if (commande === 'purger') {
    sortir(await purgerProfilsOrphelins());
  } else {
    throw new Error(`commande inconnue « ${commande ?? ''} » — ouvrir | fermer | etat | purger`);
  }
} catch (e) {
  console.error(`session.mjs : ${e.message}`);
  process.exitCode = 1;
}
