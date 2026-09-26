// M2 : projection (buildAdvancementView) contre store (buySkillAdvance), pour un ajout Métier qui recouvre
// l'emplacement Agitateur N1 « Métier (Imprimerie) » et pour un qui n'en recouvre aucun (Forgeron).
import { useGame } from '/home/claude/game/.wt-1473-t2/src/state/store';
import { buildAdvancementView } from '/home/claude/game/.wt-1473-t2/src/state/advancement';
import { scenario } from '/home/claude/game/.wt-1473-t2/src/scenes/test-scenarios/niveau-complet';
import { acquerirTalent } from '/home/claude/game/.wt-1473-t2/src/engine/careerSlots';
for (const spec of ['imprimerie', 'forgeron']) {
  const [h] = scenario.makeParty();
  acquerirTalent(h, { id: 'maitre-artisan', spec });
  h.xp = 1000; h.skills = h.skills.filter((s) => s.id !== 'metier');
  useGame.setState({ battle: null, party: [h], journal: [] } as any);
  const rows = buildAdvancementView(useGame.getState().party[0]).skills.filter((s) => s.skillId === 'metier');
  console.log(`[${spec}] PROJECTION`, JSON.stringify(rows.map((r) => ({ spec: r.spec, inCareer: r.inCareer, known: r.known, cost: r.nextCost, ajout: r.ajout?.provenance ? `${r.ajout.provenance.id}|${r.ajout.provenance.spec}` : '-' }))));
  for (const r of rows) {
    const before = useGame.getState().party[0].xp;
    useGame.getState().buySkillAdvance(h.id, 'metier', r.spec);
    const p = useGame.getState().party[0];
    console.log(`[${spec}] STORE achat metier|${r.spec} : paye=${before - p.xp} projete=${r.nextCost} adv=${p.skills.find((s) => s.id === 'metier' && s.spec === r.spec)?.advances}`);
    const r2 = buildAdvancementView(p).skills.find((s) => s.skillId === 'metier' && s.spec === r.spec)!;
    console.log(`[${spec}]   rangee apres: known=${r2.known} inCareer=${r2.inCareer} cost=${r2.nextCost} ajout=${r2.ajout ? r2.ajout.provenance.id : '-'}`);
  }
}
