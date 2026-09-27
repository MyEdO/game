/**
 * Génère l'art des armes (best-of-N) + juge aveugle sur PNG. Mirroir de creatures-redo.
 * args = [{ label, slug, type, target, wrong? }]  (sous-ensemble à (re)générer).
 * Chaque artiste écrit art-ref/directional/weapons-redo/<slug>/cand<N>.json ET rend son PNG.
 * Le juge lit les PNG (repli SVG-texte) et écrit chosen.json.
 */
export const meta = {
  name: 'weapons-redo',
  description: 'Dessine 1 silhouette fidèle par arme (best-of-N) + juge aveugle de reconnaissabilité. STAGING art-ref/directional/weapons-redo/.',
  whenToUse: 'Générer/corriger l\'art des armes pour qu\'elles se reconnaissent sans leur nom.',
  phases: [{ title: 'Candidats' }, { title: 'Juge aveugle' }],
}

const N = 3 // candidats par arme
const V = { type: 'object', additionalProperties: false, required: ['front'], properties: { front: { type: 'string' } } }
const JUDGE = { type: 'object', additionalProperties: false, required: ['chosenFrom', 'guess', 'recognizable'], properties: { chosenFrom: { type: 'string' }, guess: { type: 'string' }, recognizable: { type: 'boolean' }, note: { type: 'string' } } }

function candPrompt(w, n) {
  const wrong = w.wrong ? `\nPROBLÈME ACTUEL : se lit comme « ${w.wrong} » — à corriger.` : ''
  return `Tu dessines la silhouette d'UNE ARME pour un jeu SVG isométrique (Warhammer Fantasy 4e), vue de face.

CIBLE : « ${w.label} » doit se reconnaître AU PREMIER COUP D'ŒIL comme : ${w.target}.${wrong}

REPÈRE (os « arme », cf. src/gameIso/rig/PART-CONTRACT.md) : origine (0,0) = la POIGNÉE dans la main ; la lame/tête/pointe pointe vers le HAUT (-y) ; pommeau vers +y. Étendue x ∈ [-15,15], y ∈ [-50,10]. Échelle uniforme (gabarit humain). Une arme longue (pique, arc long, fusil) peut aller jusqu'à y=-50, pas plus haut.

STYLE : réutilise UNIQUEMENT les gradients déjà définis (g_steel, g_steelD, g_axe, g_glow, g_eye, g_blood) — n'invente AUCUN <defs>. La CHAIR (poing, main) se peint url(#dg-v-@peauH-@peauO), jamais un hex. Inspire-toi du style des armes existantes : lis src/gameIso/rig/parts/equipment.ts (map WEAPONS : epee/hache/masse/lance…). Manche relié à la tête d'un seul tenant. Silhouette LISIBLE avant le détail ; PAS de blob.

PRODUIS un fragment SVG (sans <svg>, sans <defs>, sans transform racine).
1) Écris-le dans art-ref/directional/weapons-redo/${w.slug}/cand${n}.json = {"front":"<...fragment...>"} (crée les dossiers).
2) Rends son PNG : \`npx tsx scripts/_qc-render-weapon-cand.mts art-ref/directional/weapons-redo/${w.slug}/cand${n}.json\` (doit afficher OK → …png).
Variante ${n} : ${n === 1 ? 'la lecture la plus claire et fidèle' : 'pousse encore la lisibilité / varie la composition'}.
Ne lance NI serveur NI tests. Renvoie aussi le fragment via l'outil structuré (front).`
}

function judgePrompt(w) {
  const list = Array.from({ length: N }, (_, i) => `cand${i + 1}`).join(', ')
  return `Juge AVEUGLE de reconnaissabilité d'arme (jeu SVG iso WFRP4).
Pour chaque candidat de art-ref/directional/weapons-redo/${w.slug}/ : LIS l'image cand<N>.png avec l'outil Read et REGARDE-la (repli : lis cand<N>.json et raisonne sur le SVG si le PNG manque). Candidats : ${list}.
Sans connaître le nom, demande-toi « qu'est-ce que je vois ? ». Choisis le candidat dont la silhouette se lit le plus clairement comme : ${w.target}.
Écris l'art retenu dans art-ref/directional/weapons-redo/${w.slug}/chosen.json = {"front": <le fragment SVG du candidat retenu, copié tel quel depuis son cand<N>.json>}.
Renvoie { chosenFrom:"cand1"|"cand2"|"cand3", guess:<ce que TU vois, sans présumer>, recognizable:<true si ton guess correspond à « ${w.label} »>, note }.`
}

const _argv = typeof args === 'string' ? JSON.parse(args) : args // le harness peut passer args en JSON-string
const work = (Array.isArray(_argv) ? _argv : []).filter((w) => w && w.slug)
if (!work.length) { log('aucune arme en entrée (args vide).'); return { done: 0, items: [] } }
log(`Génération de ${work.length} arme(s), ${N} candidats chacune.`)

phase('Candidats')
const results = await pipeline(
  work,
  async (w) => {
    const cands = await parallel(
      Array.from({ length: N }, (_, i) => () => agent(candPrompt(w, i + 1), { label: `c${i + 1}:${w.slug}`, phase: 'Candidats', schema: V })),
    )
    return { w, ok: cands.filter(Boolean).length }
  },
  async (r) => {
    if (!r || !r.ok) return { slug: r && r.w && r.w.slug, done: false }
    const v = await agent(judgePrompt(r.w), { label: `juge:${r.w.slug}`, phase: 'Juge aveugle', schema: JUDGE })
    return { slug: r.w.slug, label: r.w.label, done: !!v, recognizable: v && v.recognizable, guess: v && v.guess }
  },
)
const done = results.filter((x) => x && x.done)
const stillBad = done.filter((x) => !x.recognizable)
log(`weapons-redo : ${done.length}/${work.length} jugées ; douteuses selon le juge : ${stillBad.map((x) => x.label).join(', ') || 'aucune'}`)
return { total: work.length, done: done.length, items: results.map((r) => r && ({ slug: r.slug, label: r.label, recognizable: r.recognizable, guess: r.guess })) }
