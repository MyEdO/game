// Équilibrage : joue des expéditions entières sous node, sans interface, avec une stratégie simple (recruter,
// soigner, bâtir, équiper, dépenser les PX dans la carrière, partir vers la destination la plus lointaine avec des
// potions, prier et boire entre les salles, rentrer sous 2 héros valides).
// L'état passe par JSON entre deux expéditions, comme une sauvegarde relue. Finit par la part de chaque carrière parmi
// les candidats proposés et parmi les recrues engagées, par palier du relais.
// Usage : npx tsx roguelite/equilibrage.ts <graine> <expéditions> [parties] — plusieurs parties : graines consécutives, sans journal.
import * as J from './src/jeu';
const [graine0, expeditions, parties] = [42, 8, 1].map((d, i) => Number(process.argv[2 + i] ?? d));
const log = parties > 1 ? () => {} : console.log;
const proposes = new Map<string, number>(), engages = new Map<string, number>(), vus = new Set<string>();
const compter = (m: Map<string, number>, cle: string) => m.set(cle, (m.get(cle) ?? 0) + 1);
const voir = (e: J.Etat) => { for (const c of e.candidats) if (!vus.has(c.c.id)) { vus.add(c.c.id); compter(proposes, `${e.batiments.relais}|${c.carriere}`); } };
for (let partie = 0; partie < parties; partie++) {
let e = J.nouvellePartie(graine0 + partie);
for (let exp = 0; exp < expeditions; exp++) {
  e = JSON.parse(JSON.stringify(e)) as J.Etat; // la sauvegarde relue entre deux expéditions
  voir(e);
  while (e.candidats.length && e.roster.length < 4) { const c = e.candidats[0]; if (J.recruter(e, 0)) break; compter(engages, `${e.batiments.relais}|${c.carriere}`); }
  for (const h of e.roster) if (J.blesse(h)) J.soignerAuTemple(e, h.c.id);
  for (const b of ['temple', 'salle', 'forge', 'relais', 'cartographe', 'peage', 'memorial'] as const) J.ameliorer(e, b);
  voir(e);
  for (const h of e.roster) {
    const armure = J.armuresEnVente(e).filter((a) => a.poids !== 'lourde').at(-1);
    if (armure && J.equipement(h).armure !== armure.label) J.acheterUneArmure(e, h.c.id, armure.poids);
    if (!J.provisionsPortees(h).length) J.acheterUneProvision(e, h.c.id, J.provisionsEnVente(e).at(-1)!.id);
    for (let n = 0; n < 40; n++) {
      const o = J.offresDeCarriere(h);
      const achat: J.Achat | undefined = o.complet && o.suivant ? { genre: 'niveau' }
        : o.caracs.find((k) => k.augmentations < o.requis) ? { genre: 'carac', id: o.caracs.find((k) => k.augmentations < o.requis)!.id }
        : o.competences.find((k) => k.augmentations < o.requis) ? { genre: 'competence', ref: o.competences.find((k) => k.augmentations < o.requis)!.ref }
        : o.talents.find((t) => !t.possede) ? { genre: 'talent', ref: o.talents.find((t) => !t.possede)!.ref } : undefined;
      if (!achat || J.acheter(e, h.c.id, achat)) break;
    }
  }
  const dest = J.destinationsOuvertes(e).at(-1)!;
  const err = J.partir(e, dest.id, e.roster.filter((h) => J.valide(h) && h.c.wounds.current >= h.c.wounds.max * 0.6).slice(0, 4).map((h) => h.c.id));
  if (err) { log('départ refusé', err, e.roster.length, e.or, J.attendreUneSemaine(e) ?? 'la compagnie attend une semaine'); continue; }
  while (e.expedition) {
    const r = J.avancer(e);
    const g = J.herosDuGroupe(e);
    const blesse = g.filter((h) => !h.c.dead).sort((a, b) => a.c.wounds.current - b.c.wounds.current)[0];
    for (const h of g) if (blesse && blesse.c.wounds.current < blesse.c.wounds.max && J.peutPrier(e, h)) J.prier(e, h.c.id, blesse.c.id);
    for (const h of g) for (const p of J.provisionsPortees(h)) if (!p.refus && h.c.wounds.current < h.c.wounds.max / 2) J.utiliserUneProvision(e, h.c.id, p.uid);
    const valides = g.filter(J.valide).length;
    log(`  ${r.titre}${r.combat ? ` (${r.combat.issue}, ${r.combat.pas.length} pas)` : ''} | valides ${valides}/${g.length}`);
    if (e.expedition && valides < 2 && !r.fin) { J.rentrer(e, false); log('  → retraite'); }
  }
  log(`J${e.jour} ${dest.nom}: or ${e.or}, trophées ${e.trophees}, roster ${e.roster.length}, morts ${e.cimetiere.length}, niveaux ${e.roster.map((h) => h.c.careerLevel ?? 1).join("")}, sorts ${e.roster.map((h) => (h.c.spells ?? []).length).join("")}, bât ${JSON.stringify(e.batiments)}`);
}
}
for (const palier of [0, 1, 2]) {
  const total = (m: Map<string, number>) => [...m].filter(([k]) => k.startsWith(`${palier}|`)).reduce((n, [, v]) => n + v, 0);
  const tp = total(proposes), te = total(engages);
  console.log(`relais ${palier} : ${tp} candidats proposés, ${te} recrues`);
  for (const p of J.PROFILS.filter((x) => x.relais <= palier)) {
    const np = proposes.get(`${palier}|${p.id}`) ?? 0, ne = engages.get(`${palier}|${p.id}`) ?? 0;
    console.log(`  ${p.id.padEnd(20)} ${p.role.padEnd(10)} proposés ${String(np).padStart(4)} (${tp ? ((100 * np) / tp).toFixed(1) : '0.0'} %)  recrues ${String(ne).padStart(4)} (${te ? ((100 * ne) / te).toFixed(1) : '0.0'} %)`);
  }
}
