/**
 * Reprise (salvage) de weapons-redo après interruption : ne REDESSINE PAS les candidats
 * déjà produits — ne dessine que les slots manquants, puis juge toute arme sans chosen.json.
 * args = { draw: [{label,slug,type,target,slots:[n…]}], judge: [{label,slug,target}] }
 * (émis par scripts/qc/_weapon-salvage-args.mts, qui inspecte le staging.)
 */
export const meta = {
  name: 'weapons-salvage',
  description: 'Reprise weapons-redo : dessine les candidats manquants + juge aveugle des armes sans chosen.json. STAGING art-ref/directional/weapons-redo/.',
  whenToUse: 'Quand une génération weapons-redo a été coupée : finir sans tout refaire.',
  phases: [{ title: 'Candidats manquants' }, { title: 'Juge aveugle' }],
}

const V = { type: 'object', additionalProperties: false, required: ['front'], properties: { front: { type: 'string' } } }
const JUDGE = { type: 'object', additionalProperties: false, required: ['chosenFrom', 'guess', 'recognizable'], properties: { chosenFrom: { type: 'string' }, guess: { type: 'string' }, recognizable: { type: 'boolean' }, note: { type: 'string' } } }

function candPrompt(w, n) {
  return `Tu dessines la silhouette d'UNE ARME pour un jeu SVG isométrique (Warhammer Fantasy 4e), vue de face.

CIBLE : « ${w.label} » doit se reconnaître AU PREMIER COUP D'ŒIL comme : ${w.target}.

REPÈRE (os « arme », cf. src/gameIso/rig/PART-CONTRACT.md) : origine (0,0) = la POIGNÉE dans la main ; la lame/tête/pointe pointe vers le HAUT (-y) ; pommeau vers +y. Étendue x ∈ [-15,15], y ∈ [-50,10]. Échelle uniforme (gabarit humain). Une arme longue (arquebuse, tromblon, pistolet) tient dans ces bornes : le canon pointe vers -y.

STYLE : réutilise UNIQUEMENT les gradients déjà définis (g_steel, g_steelD, g_axe, g_glow, g_eye, g_blood) — n'invente AUCUN <defs>. La CHAIR (poing, main) se peint url(#dg-v-@peauH-@peauO), jamais un hex. Pour le bois/la crosse, un remplissage sombre (#3a2a1a / #5a3d24) convient. Inspire-toi du style des armes existantes : lis src/gameIso/rig/parts/equipment.ts (map WEAPONS). Crosse + canon + platine reliés d'un seul tenant. Silhouette LISIBLE avant le détail ; PAS de blob.

PRODUIS un fragment SVG (sans <svg>, sans <defs>, sans transform racine).
1) Écris-le dans art-ref/directional/weapons-redo/${w.slug}/cand${n}.json = {"front":"<...fragment...>"} (crée les dossiers).
2) Rends son PNG : \`npx tsx scripts/_qc-render-weapon-cand.mts art-ref/directional/weapons-redo/${w.slug}/cand${n}.json\` (doit afficher OK → …png).
Variante ${n} : ${n === 1 ? 'la lecture la plus claire et fidèle' : 'pousse encore la lisibilité / varie la composition'}.
Ne lance NI serveur NI tests. Renvoie aussi le fragment via l'outil structuré (front).`
}

function judgePrompt(w) {
  return `Juge AVEUGLE de reconnaissabilité d'arme (jeu SVG iso WFRP4).
Dans art-ref/directional/weapons-redo/${w.slug}/ : repère les candidats présents (cand1, cand2, cand3 — il peut en manquer). Pour CHAQUE candidat présent, LIS l'image cand<N>.png avec l'outil Read et REGARDE-la (repli : lis cand<N>.json et raisonne sur le SVG si le PNG manque).
Sans connaître le nom, demande-toi « qu'est-ce que je vois ? ». Choisis le candidat dont la silhouette se lit le plus clairement comme : ${w.target}.
Écris l'art retenu dans art-ref/directional/weapons-redo/${w.slug}/chosen.json = {"front": <le fragment SVG du candidat retenu, copié tel quel depuis son cand<N>.json>}.
Renvoie { chosenFrom:"cand1"|"cand2"|"cand3", guess:<ce que TU vois, sans présumer>, recognizable:<true si ton guess correspond à « ${w.label} »>, note }.`
}

const _argv = typeof args === 'string' ? JSON.parse(args) : args
const draw = (_argv && Array.isArray(_argv.draw)) ? _argv.draw : []
const judge = (_argv && Array.isArray(_argv.judge)) ? _argv.judge : []
log(`salvage : ${draw.length} arme(s) à compléter (candidats), ${judge.length} à juger.`)

// Phase 1 — dessine UNIQUEMENT les slots manquants (barrière avant le juge).
phase('Candidats manquants')
if (draw.length) {
  const tasks = draw.flatMap((w) =>
    (Array.isArray(w.slots) ? w.slots : [1, 2, 3]).map((n) => () =>
      agent(candPrompt(w, n), { label: `c${n}:${w.slug}`, phase: 'Candidats manquants', schema: V })),
  )
  const drawn = await parallel(tasks)
  log(`candidats manquants : ${drawn.filter(Boolean).length}/${tasks.length} dessinés.`)
}

// Phase 2 — juge aveugle de toute arme sans chosen.json.
phase('Juge aveugle')
const verdicts = await parallel(
  judge.map((w) => () =>
    agent(judgePrompt(w), { label: `juge:${w.slug}`, phase: 'Juge aveugle', schema: JUDGE })
      .then((v) => ({ slug: w.slug, label: w.label, done: !!v, recognizable: v && v.recognizable, guess: v && v.guess, chosenFrom: v && v.chosenFrom })),
  ),
)
const done = verdicts.filter((x) => x && x.done)
const doubtful = done.filter((x) => !x.recognizable)
log(`salvage : ${done.length}/${judge.length} jugées ; douteuses selon le juge : ${doubtful.map((x) => `${x.label} (vu: ${x.guess})`).join(', ') || 'aucune'}`)
return { drawn: draw.length, judged: done.length, doubtful: doubtful.map((x) => ({ slug: x.slug, label: x.label, guess: x.guess })), items: verdicts }
