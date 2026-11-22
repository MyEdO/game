// Équilibrage : joue des expéditions entières sous node, sans interface, avec une stratégie simple (recruter,
// soigner, bâtir, entraîner, partir vers la destination la plus lointaine, rentrer sous 2 héros valides).
// Usage : npx tsx roguelite/equilibrage.ts <graine> <expéditions>
import * as J from './src/jeu';
const e = J.nouvellePartie(Number(process.argv[2] ?? 42));
for (let exp = 0; exp < Number(process.argv[3] ?? 8); exp++) {
  while (e.candidats.length && e.roster.length < 4 && !J.recruter(e, 0)) { /* recrute */ }
  for (const h of e.roster) if (J.blesse(h)) J.soignerAuTemple(e, h.c.id);
  for (const b of ['temple', 'relais', 'salle', 'cartographe', 'peage', 'memorial'] as const) J.ameliorer(e, b);
  for (const h of e.roster) for (const k of J.CARACS_ENTRAINABLES) while (!J.entrainer(e, h.c.id, k)) { /* dépense */ }
  const dest = J.destinationsOuvertes(e).at(-1)!;
  const err = J.partir(e, dest.id, e.roster.filter((h) => J.valide(h) && h.c.wounds.current >= h.c.wounds.max * 0.6).slice(0, 4).map((h) => h.c.id));
  if (err) { console.log('départ refusé', err, e.roster.length, e.or); continue; }
  while (e.expedition) {
    const r = J.avancer(e);
    const g = J.herosDuGroupe(e);
    const valides = g.filter(J.valide).length;
    console.log(`  ${r.titre}${r.combat ? ` (${r.combat.issue}, ${r.combat.pas.length} pas)` : ''} | valides ${valides}/${g.length}`);
    if (e.expedition && valides < 2 && !r.fin) { J.rentrer(e, false); console.log('  → retraite'); }
  }
  console.log(`J${e.semaine} ${dest.nom}: or ${e.or}, trophées ${e.trophees}, roster ${e.roster.length}, morts ${e.cimetiere.length}, bât ${JSON.stringify(e.batiments)}`);
}
