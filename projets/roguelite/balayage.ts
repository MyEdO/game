// Balayage : chaque rencontre de chaque destination (meutes, élites, maître) contre un groupe de quatre recrues du
// roster complet (`PROFILS`), sur plusieurs graines. Signale les impasses, les combats de moins de 5 pas et le taux de victoire.
// Usage : npx tsx projets/roguelite/balayage.ts <graines> [destination]
import { DESTINATIONS, PROFILS, nouvellePartie, recrue } from './src/jeu';
import { jouerLeCombat, nomDeCreature } from './src/noyau';
/** Balaie chaque rencontre sur `N` graines, la destination `destination` seule si elle est nommée. */
function balayer(N: number, destination?: string): void {
  for (const d of DESTINATIONS.filter((x) => !destination || x.id === destination)) {
    for (const [genre, liste] of [['meute', d.meutes], ['élite', d.elites], ['maître', [d.boss]]] as const) {
      for (const ennemis of liste) {
        let v = 0, imp = 0, courts = 0, morts = 0; const t0 = Date.now();
        for (let i = 0; i < N; i++) {
          const e = nouvellePartie(7000 + i * 10);
          const g = [0, 1, 2, 3].map((k) => recrue(e, PROFILS[(i * 4 + k) % PROFILS.length]).c);
          const r = jouerLeCombat(g, ennemis, 9000 + i, d.lumiere);
          if (r.issue === 'victoire') v++; if (r.issue === 'impasse') imp++; if (r.pas.length < 5) courts++; morts += r.morts.length;
          if (r.groupe.length + r.morts.length < g.length) console.log('   groupe rendu incomplet', r.issue, r.groupe.length, r.morts.length);
        }
        console.log(`${d.id} ${genre} ${ennemis.map(nomDeCreature).join('+')} : ${v}/${N} victoires, ${imp} impasses, ${courts} courts, ${morts} morts, ${((Date.now() - t0) / N).toFixed(0)} ms`);
      }
    }
  }
}

if (import.meta.main) balayer(Number(process.argv[2] ?? 10), process.argv[3]);
