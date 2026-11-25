// Une partie fixe pour les instantanés : graine 42, bâtiments au premier palier, PX à dépenser, une séquelle.
// Usage : npx tsx projets/roguelite/recette/partie-fixe.ts > fixe.json
import * as J from '../src/jeu';
import { poserLesReglesDuRoguelite } from '../src/noyau';

/** La partie fixe des instantanés. */
function partieFixe(): J.Etat {
  const e = J.nouvellePartie(42);
  e.or = 900;
  e.trophees = 5;
  for (const k of Object.keys(e.batiments) as J.IdBatiment[]) e.batiments[k] = 1;
  for (const h of e.roster) h.c.xp = 400;
  return e;
}

if (import.meta.main) {
  poserLesReglesDuRoguelite();
  process.stdout.write(JSON.stringify(partieFixe()));
}
