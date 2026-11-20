/**
 * Migration #3710, hors chargement.
 * Entrées : un export portable de projet de l'éditeur (JSON de type `projet`) sur stdin.
 * Sortie : le projet à réimporter dans l'éditeur, sur stdout.
 */
import { text } from 'node:stream/consumers';
import { estObjet } from '../../src/lib/objet.mjs';

function migrer(texte) {
  const projet = JSON.parse(texte);
  if (!estObjet(projet) || projet.type !== 'projet' || !Array.isArray(projet.scenes)) {
    throw new Error('attendu : un export de projet de l’éditeur avec ses scènes.');
  }

  let modifie = false;
  for (const [rangScene, scene] of projet.scenes.entries()) {
    const cheminScene = `scenes[${rangScene}]`;
    if (!estObjet(scene)) throw new Error(`${cheminScene} : une scène est attendue.`);
    if (scene.entities === undefined) continue;
    if (!Array.isArray(scene.entities)) throw new Error(`${cheminScene}.entities : une liste est attendue.`);
    for (const [rangEntite, entite] of scene.entities.entries()) {
      const chemin = `${cheminScene}.entities[${rangEntite}]`;
      if (!estObjet(entite)) throw new Error(`${chemin} : une entité est attendue.`);
      const { statblock, combat } = entite;
      if (!estObjet(statblock) || !Object.hasOwn(statblock, 'randomChars')) continue;
      if (typeof statblock.randomChars !== 'boolean') throw new Error(`${chemin}.statblock.randomChars : un booléen est attendu.`);
      if (combat !== undefined && !estObjet(combat)) throw new Error(`${chemin}.combat : un rôle au combat est attendu.`);
      if (combat?.randomChars !== undefined && typeof combat.randomChars !== 'boolean') {
        throw new Error(`${chemin}.combat.randomChars : un booléen est attendu.`);
      }

      // Le préréglage prenait déjà la priorité sur le statbloc dans porteurDeFiche.
      if (statblock.randomChars && entite.kind === 'personnage' && !entite.presetId) {
        entite.combat = { ...combat, randomChars: true };
      }
      delete statblock.randomChars;
      modifie = true;
    }
  }
  return modifie ? `${JSON.stringify(projet, null, 2)}\n` : texte;
}

try {
  if (process.argv.length !== 2 || process.stdin.isTTY) {
    throw new Error('usage : node scripts/campagne/migrer-caracteristiques-de-pose.mjs < ancien-projet.json > projet-migre.json');
  }
  process.stdout.write(migrer(await text(process.stdin)));
} catch (erreur) {
  console.error(`Migration #3710 : ${erreur.message}`);
  process.exitCode = 1;
}
