// Balayage : chaque rencontre de chaque destination (meutes, élites, maître) contre un groupe de quatre recrues du
// roster complet (`PROFILS`), sur plusieurs graines. Signale les impasses, les combats de moins de 5 pas et le taux de victoire.
// Usage : npx tsx roguelite/balayage.ts <graines> [destination]
import { DESTINATIONS, PROFILS } from './src/jeu';
import { nouvelleRecrue, jouerLeCombat, nomDeCreature } from './src/noyau';
const N = Number(process.argv[2] ?? 10);
for (const d of DESTINATIONS.filter((x) => !process.argv[3] || x.id === process.argv[3])) {
  for (const [genre, liste] of [['meute', d.meutes], ['élite', d.elites], ['maître', [d.boss]]] as const) {
    for (const ennemis of liste) {
      let v = 0, imp = 0, courts = 0, morts = 0; const t0 = Date.now();
      for (let i = 0; i < N; i++) {
        const g = [0, 1, 2, 3].map((k) => { const p = PROFILS[(i * 4 + k) % PROFILS.length]; return nouvelleRecrue(7000 + i * 10 + k, p.id, p.espece ?? 'humains-reiklander', p.nom, p.identite); });
        const r = jouerLeCombat(g, ennemis, 9000 + i, d.lumiere);
        if (r.issue === 'victoire') v++; if (r.issue === 'impasse') imp++; if (r.pas.length < 5) courts++; morts += r.morts.length;
        if (r.groupe.length !== g.length - (r.issue === 'victoire' ? 0 : 0) && r.groupe.length + r.morts.length < g.length) console.log('   groupe rendu incomplet', r.issue, r.groupe.length, r.morts.length);
      }
      console.log(`${d.id} ${genre} ${ennemis.map(nomDeCreature).join('+')} : ${v}/${N} victoires, ${imp} impasses, ${courts} courts, ${morts} morts, ${((Date.now() - t0) / N).toFixed(0)} ms`);
    }
  }
}
