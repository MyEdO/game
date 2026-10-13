// RENDU Markdown du rapport de cache de prompt (#2596) : `analyser()` de `cachePromptAnalyses.mjs` → texte. PUR.
import { PRIX, RATIOS, SEUIL_FROID, TTL_MIN } from './cachePromptAnalyses.mjs'

const M = (n) => n == null ? '—' : Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(2) + ' M' : Math.abs(n) >= 1e3 ? (n / 1e3).toFixed(0) + ' k' : String(Math.round(n))
const pc = (a, b) => b ? (100 * a / b).toFixed(1) + ' %' : '—'
const usd = (x) => x == null ? '—' : '$' + x.toFixed(2)
const mn = (x) => x == null ? '—' : x.toFixed(1)
const date = (t) => new Date(t).toISOString().slice(5, 16).replace('T', ' ')
const s8 = (s) => s.slice(0, 8)
const cellule = (x) => String(x ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ')

function table(entetes, lignes) {
  return [`| ${entetes.join(' | ')} |`, `|${entetes.map(() => '---').join('|')}|`, ...lignes.map((l) => `| ${l.map(cellule).join(' | ')} |`)].join('\n')
}

/** @param {{depuis:number, jusqua:number, exclues:string[], fichiers:number}} cadre @param {ReturnType<import('./cachePromptAnalyses.mjs').analyser>} a @param {object} comptes */
export function rendreRapport(cadre, a, comptes) {
  const T = a.vue.total
  const o = []
  const w = (...l) => o.push(...l, '')
  w(`# Rapport cache de prompt, contexte et coût (#2596)`,
    `Fenêtre ${new Date(cadre.depuis).toISOString()} → ${new Date(cadre.jusqua).toISOString()} (UTC). ${cadre.fichiers} transcripts lus, ${T.req} requêtes dédoublonnées, ${a.sessions.length} sessions. Sessions exclues : ${cadre.exclues.length ? cadre.exclues.join(', ') : 'aucune'}.`,
    `Froide = plus de ${M(SEUIL_FROID)} tokens écrits ET plus de la moitié du prompt écrit. Équivalent input : lecture ×${RATIOS.lu}, écriture 5 min ×${RATIOS.e5}, écriture 1 h ×${RATIOS.e1}. TTL attendus : principal ${TTL_MIN.principal} min, sous-agents ${TTL_MIN.agent} min (re-mesurés en §11).`)

  w('## 0. Comptes clés', table(['Compte', 'Valeur'], Object.entries(comptes).map(([k, v]) => [k, typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(4) : v])))

  w('## 1. Vue d’ensemble', table(['Mesure', 'Valeur'], [
    ['Prompt servi', M(T.lu + T.ecrit + T.nu)], ['Lu en cache', `${M(T.lu)} (${pc(T.lu, T.lu + T.ecrit + T.nu)})`],
    ['Écrit en cache', `${M(T.ecrit)} — 1 h ${M(T.e1)}, 5 min ${M(T.e5)}`], ['Input hors cache', M(T.nu)], ['Sortie', `${M(T.out)} (réflexion ${M(T.pense)})`],
    ['Équivalent input du prompt', M(T.eq)], ['Part des écritures dans ce coût', pc(T.eqEcriture, T.eq)], ['Coût en $', usd(a.cout.total.total)],
  ]), table(['Groupe', 'Requêtes', 'Lu', 'Écrit', 'Hit', 'Sortie', 'Équiv. input'], a.vue.groupes.map((g) => [g.cle, g.req, M(g.lu), M(g.ecrit), pc(g.lu, g.lu + g.ecrit + g.nu), M(g.out), M(g.eq)])))

  w('## 2. Écritures par cause', table(['Cause', 'Requêtes', 'Écrit', 'Part', 'Coût d’écriture (éq.)', 'Moyenne'], a.causes.causes.map((c) => [c.cle, c.req, M(c.ecrit), pc(c.ecrit, T.ecrit), M(c.eqEcriture), M(c.ecrit / c.req)])),
    '### Par groupe', table(['Groupe', 'Cause', 'Requêtes', 'Écrit'], a.causes.parGroupe.flatMap((g) => g.causes.map((c) => [g.groupe, c.cle, c.req, M(c.ecrit)]))),
    '### Écart avant une reprise froide (hors naissance et compactage)', table(['Écart (min)', 'Reprises', 'Écrit'], a.causes.tranches.map((t) => [`${t.a}–${t.b === Infinity ? '∞' : t.b}`, t.req, M(t.ecrit)])),
    '### Les 20 écritures froides les plus lourdes', table(['Quand', 'Session', 'Fil', 'Cause', 'Écart', 'Écrit', 'Prompt'], a.causes.lourdes.map((r) => [date(r.t), s8(r.session), r.fil, r.cause, mn(r.ecartMin), M(r.ecrit), M(r.ctx)])))

  const C = a.compactages
  w('## 3. Compactages', `${C.n} compactages. Avant : moyenne ${M(C.preMoyen)}, max ${M(C.preMax)} ; après : moyenne ${M(C.postMoyen)} ; écartés ${M(C.ecartes)}. Déclencheurs : ${JSON.stringify(C.declencheurs)} ; précalculés ${C.precalcules}. Durée médiane ${mn((C.dureeMediane ?? 0) / 1000)} s, max ${mn(C.dureeMax / 1000)} s.`,
    table(['Quand', 'Session', 'Fil', 'Déclencheur', 'Avant', 'Après', 'Durée (s)', 'Précalculé'], C.liste.map((c) => [date(c.t), s8(c.session), c.fil, c.trigger ?? '?', M(c.preTokens), M(c.postTokens), mn((c.durationMs ?? 0) / 1000), c.precomputed ? 'oui' : 'non'])))

  const X = a.contexte
  w('## 4. Contexte', `Prompt par requête : médiane ${M(X.global.med)}, p90 ${M(X.global.p90)}, p99 ${M(X.global.p99)}, max ${M(X.global.max)} ; > 150 k : ${X.global.au150k} ; > 200 k : ${X.global.au200k}.`,
    table(['Groupe', 'Requêtes', 'Médiane', 'p90', 'Max'], X.parGroupe.map((g) => [g.groupe, g.n, M(g.med), M(g.p90), M(g.max)])),
    '### Courbe par fil (15 plus grands)', table(['Fil', 'Type', 'Requêtes', 'Médiane', 'p90', 'Max', 'Croissance / requête', 'Chutes > 50 %'], X.fils.slice(0, 15).map((f) => [s8(f.cle), f.type, f.n, M(f.med), M(f.p90), M(f.max), M(f.croissanceParRequete), f.chutes])))

  w('## 5. Sessions', table(['Session', 'Dossier', 'Requêtes', 'Sous-agents', 'Compactages', 'Lu', 'Écrit', 'Écrit à froid', 'Équiv. input', '$', 'Premier prompt'],
    a.sessions.map((s) => [s8(s.session), (s.cwd ?? '').replace(/^.*[\\/]Game[\\/]?/, '') || 'Game', s.req, s.sousAgents, s.compactages, M(s.lu), M(s.ecrit), M(s.ecritFroid), M(s.eq), usd(s.dollars), s.premierPrompt ?? ''])))

  w('## 6. Sous-agents par type', table(['Type', 'Agents', 'Requêtes', 'Modèles', 'Lu', 'Écrit', 'Naissance moy.', 'Reprises froides', 'Réécrit', 'Ctx max moyen', 'Durée méd. (min)', '$'],
    a.types.map((t) => [t.type, t.agents, t.req, t.modeles.join(', '), M(t.lu), M(t.ecrit), M(t.naissanceMoyenne), t.reprises, M(t.reecrit), M(t.ctxMaxMoyen), mn(t.dureeMediane), usd(t.dollars)])),
    '### Naissances (1re requête)', table(['Type', 'Naissances', 'Écrit moyen', 'Écrit médian', '$'], a.naissances.map((n) => [n.type, n.n, M(n.ecritMoyen), M(n.ecritMedian), usd(n.dollars)])))

  w('## 7. Coût en dollars', `Grille (\`PRIX\`, $/M tokens, catalogue de claude.exe 2.1.296) : ${Object.entries(PRIX).map(([m, p]) => `${m} in ${p.in} / out ${p.out} / w5 ${p.w5} / w1h ${p.w1} / lu ${p.rd}`).join(' ; ')}. Requêtes hors grille : ${a.cout.total.horsGrille}.`,
    table(['Modèle', 'Requêtes', 'Lu $', 'Écrit 5 min $', 'Écrit 1 h $', 'Nu $', 'Sortie $', 'Réflexion $', 'Total $'], a.cout.modeles.map((m) => [m.modele, m.req, usd(m.dollars.lu), usd(m.dollars.e5), usd(m.dollars.e1), usd(m.dollars.nu), usd(m.dollars.sortie), usd(m.dollars.pense), usd(m.dollars.total)])),
    table(['Groupe', 'Lu $', 'Écrit $', 'Sortie $', 'Total $'], a.cout.groupes.map((g) => [g.groupe, usd(g.dollars.lu), usd(g.dollars.e5 + g.dollars.e1), usd(g.dollars.sortie + g.dollars.pense), usd(g.dollars.total)])),
    table(['Jour', 'Total $', 'dont écritures $'], a.cout.jours.map((j) => [j.jour, usd(j.dollars.total), usd(j.dollars.e5 + j.dollars.e1)])),
    '### Dernier cost-state par session (cumul de session, fenêtre non appliquée)', table(['Session', 'totalCostUSD', 'Modèles'], a.coutEtat.map((c) => [s8(c.session), usd(c.totalCostUSD), Object.entries(c.modeles).map(([m, u]) => `${m} ${usd(u.costUSD)}`).join(', ')])))

  w('## 8. Chronologie horaire', table(['Heure (UTC)', 'Requêtes', 'Lu', 'Écrit', 'Écrit à froid', 'Compactages'], a.chronologie.map((h) => [date(h.heure), h.req, M(h.lu), M(h.ecrit), M(h.ecritFroid), h.compactages || ''])))

  const N = a.nourriture
  w('## 9. Ce qui nourrit le contexte (caractères)', ...N.outils.map((g) => `### Résultats d’outils — ${g.groupe}\n\n` + table(['Outil', 'Appels', 'Car.', 'Moyenne', 'Max'], g.lignes.slice(0, 15).map((l) => [l.cle, l.n, M(l.car), M(l.car / l.n), M(l.max)]))),
    '### Attachments', table(['Sorte', 'N', 'Car.', 'Max'], N.attachments.slice(0, 15).map((l) => [l.cle, l.n, M(l.car), M(l.max)])),
    '### Prompts', table(['Nature', 'N', 'Car.', 'Max'], N.prompts.slice(0, 10).map((l) => [l.cle, l.n, M(l.car), M(l.max)])),
    `### Résultats > 40 k car. (≈ 10 k tokens) : ${N.gros.length}`, table(['Quand', 'Session', 'Fil', 'Outil', 'Car.', 'Commande'], N.gros.slice(0, 20).map((g) => [date(g.t), s8(g.session), g.fil, g.outil, M(g.car), (g.commande ?? '').slice(0, 100)])))

  w('## 10. Erreurs d’API', `${a.erreurs.n} messages.`, table(['Motif', 'N'], a.erreurs.motifs.slice(0, 10).map((m) => [m.motif, m.n])))

  w('## 11. TTL', '### Servi', table(['Type', 'Fils', 'Écrit 5 min', 'Écrit 1 h', 'Fils mixtes'], a.ttl.servi.map((t) => [t.type, t.fils, M(t.e5), M(t.e1), t.mixtes])),
    '### Empirique : requêtes froides / requêtes, par tranche d’écart (min)', table(['Groupe', ...a.ttl.empirique[0]?.tranches.map((t) => `${t.a}–${t.b}`) ?? []], a.ttl.empirique.map((g) => [g.groupe, ...g.tranches.map((t) => `${t.froides}/${t.n}`)])))

  const R = a.reprises
  w('## 12. A — Reprises froides des sous-agents : ce qu’ils attendaient', `${R.lignes.length} reprises (hors naissance et compactage). Surcoût = écriture − lecture des mêmes tokens, en équivalent input.`,
    table(['Cause', 'Reprises', 'Écrit', 'Surcoût', 'Attente méd. (min)'], R.parCause.map((x) => [x.cle, x.n, M(x.ecrit), M(x.surcout), mn(x.attenteMed)])),
    '### Type × cause', table(['Type | cause', 'Reprises', 'Surcoût', 'Attente méd.'], R.typeCause.slice(0, 20).map((x) => [x.cle, x.n, M(x.surcout), mn(x.attenteMed)])),
    '### Par jour', table(['Jour', 'Reprises', 'Surcoût'], R.parJour.sort((x, y) => x.cle.localeCompare(y.cle)).map((x) => [x.cle, x.n, M(x.surcout)])))

  const K = a.commandes
  w('## 13. Commandes shell et test:perimetre', table(['Classe (sous-agents)', 'Appels', '> 4 min', '> 5 min', 'Minutes > 4 min', 'Médiane', 'p90'], K.classes.map((c) => [c.classe, c.n, c.plus4, c.plus5, mn(c.minPlus4), mn(c.med), mn(c.p90)])),
    table(['Groupe', 'Runs test:perimetre', 'En fond', 'Médiane (min)', '> 5 min'], K.perim.map((p) => [p.groupe, p.n, p.fond, mn(p.med), p.plus5])),
    `Runs de l’orchestrateur précédés < 3 h d’un run de sous-agent de la même session : ${K.doublonsOrchestrateur}/${K.runsOrchestrateur}. Runs par fil de sous-agent (n runs : fils) : ${JSON.stringify(K.runsParFil)}.`)

  const V = a.reveils
  w('## 14. B — Réveils de l’orchestrateur', table(['Écart (min)', 'Requêtes', 'Froides hors compactage', 'Écrit', 'Coût d’écriture (éq.)'], V.distribution.map((d) => [`${d.a}–${d.b === Infinity ? '∞' : d.b}`, d.n, d.froides, M(d.ecrit), M(d.eqEcriture)])),
    `### Reprises froides après plus de ${TTL_MIN.principal} min, par réveil`, table(['Réveil', 'Reprises', 'Écrit', 'Coût d’écriture'], V.parCause.map((c) => [c.cause, c.n, M(c.ecrit), M(c.eqEcriture)])),
    table(['Quand', 'Session', 'Écart (min)', 'Écrit', 'Réveil'], V.longues.map((l) => [date(l.t), s8(l.session), mn(l.ecartMin), M(l.ecrit), l.cause])),
    '### Outils d’attente', table(['Groupe | outil', 'Appels', 'Erreurs'], a.attente.lignes.map((l) => [l.cle, l.n, l.erreurs])), `scheduled_task_fire : ${a.attente.reveilsProgrammes}.`)

  const E = a.reecritures
  const fr = a.frontieres, cases = [[true, 'avec ajout harnais'], [false, 'sans ajout']]
  w('## 15. C — Préfixe cassé', '### Points de cache', table(['Groupe | lecture', 'Requêtes'], a.points.map((p) => [p.cle, p.n])),
    `### Réécritures complètes (lu ≤ 40 k, perte > 20 k) : ${E.toutes}, dont sous le TTL du fil : ${E.sousTtl.length}`,
    table(['Attribution', 'N', 'Écrit', 'Surcoût'], E.parAttribution.map((x) => [x.cle, x.n, M(x.ecrit), M(x.surcout)])),
    table(['Groupe et écart (min)', 'N', 'Écrit'], E.parTranche.map((x) => [x.cle, x.n, M(x.ecrit)])),
    table(['Session', 'N', 'Écrit'], E.parSession.map((x) => [s8(x.cle), x.n, M(x.ecrit)])),
    `Valeurs de lu les plus fréquentes : ${E.valeursLu.map((x) => `${x.cle} ×${x.n}`).join(', ')}.`,
    '### Frontières de tour du fil principal (écart < TTL)', table(['Tour précédent', 'Frontières', 'Cassées (perte > 20 k)', 'Part'], cases.map(([v, l]) => { const xs = fr.filter((b) => b.ajout === v); const c = xs.filter((b) => b.casse).length; return [l, xs.length, c, pc(c, xs.length)] })),
    `### Signature « avant » (part des requêtes qui portent la sorte) : ${a.signature.n} réécritures contre ${a.signature.nTemoin} témoins`, table(['Sorte', 'Réécritures', 'Témoin'], a.signature.sortes.map((s) => [s.sorte, pc(s.reecritures, 1), pc(s.temoin, 1)])))

  const D = a.drops
  w('## 16. thinking_drop', `${D.n} drops ; écrit par la requête suivante ${M(D.ecritApres)}.`, table(['Ventilation', 'Comptes'], [['groupe', JSON.stringify(D.parGroupe)], ['raison', JSON.stringify(D.parRaison)], ['kinds', JSON.stringify(D.parKinds)], ['baseline', JSON.stringify(D.parBaseline)], ['requête suivante', JSON.stringify(D.suivante)]]),
    `### Bascules d’organisation (credential_org) : ${a.bascules.length}`, table(['Quand', 'Session', 'De', 'Vers'], a.bascules.map((b) => [date(b.t), s8(b.session), s8(b.de ?? '?'), s8(b.vers ?? '?')])))
  return o.join('\n')
}

/** Rendu du delta de deux jeux de comptes. */
export function rendreDelta(d) {
  return ['## Delta contre l’instantané', table(['Compte', 'Avant', 'Après', 'Delta'], Object.entries(d).map(([k, v]) => [k, v.avant, v.apres, v.delta == null ? '—' : (v.delta > 0 ? '+' : '') + (Number.isInteger(v.delta) ? v.delta : v.delta.toFixed(4))])), ''].join('\n')
}
