// Une partie fixe pour les instantanés : graine 42, bâtiments au premier palier, PX à dépenser, une séquelle.
// Usage : npx tsx roguelite/recette/partie-fixe.ts > fixe.json
import * as J from '../src/jeu';

const e = J.nouvellePartie(42);
e.or = 900;
e.trophees = 5;
for (const k of Object.keys(e.batiments) as J.IdBatiment[]) e.batiments[k] = 1;
for (const h of e.roster) h.c.xp = 400;
process.stdout.write(JSON.stringify(e));
