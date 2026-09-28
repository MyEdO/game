/**
 * Galerie QC des OBJETS ORIENTÉS (navires, engins de siège, gabarit terrestre, props orientés) :
 * pour chaque objet, sa COUVERTURE de vues (face/profil/dos déclarées vs cases vides — pilote les vagues
 * d'art A1-A4) ET un ruban de ROTATION prouvant qu'il pivote avec la caméra via l'UNIQUE résolveur
 * `project(dir, camRot)` (4 crans de caméra × 2 orientations monde = les « 2 projections » d'orientation).
 * Tout art orienté passe par le MÊME contrat `ViewArt` (`rig/viewArt`). Sortie : public/oriented-objects.html
 * Lancer : npx tsx scripts/gen-oriented-objects-gallery.mts
 */
import { writeFileSync } from 'node:fs';
import { planById } from '../src/gameIso/rig/bodyPlan';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { VIEWS, project, type View } from '../src/gameIso/rig/facing';
import { declaredViews, type ViewArt } from '../src/gameIso/rig/viewArt';
import { shipArtOf } from '../src/gameIso/rig/ship/composeShip';
import { SHIP_ARTS } from '../src/gameIso/rig/ship/_registry.generated';
import { landArtOf } from '../src/gameIso/rig/land/composeLand';
import { LAND_ARTS } from '../src/gameIso/rig/land/_registry.generated';
import { enginArtOf } from '../src/gameIso/rig/engin/composeEngin';
import { ENGIN_ARTS } from '../src/gameIso/rig/engin/_registry.generated';
import { PROPS, propSvg, propViewSvg } from '../src/gameIso/catalog/decor/index';
import { defsGlobaux } from '../src/gameIso/sprites';
import type { Dir8 } from '../src/state/dir8';
import type { Rot } from '../src/geometry/iso';

const ROTS: Rot[] = [0, 1, 2, 3];
const ORIENTS: Dir8[] = ['E', 'SE']; // cardinal (front/back net) + diagonale (profil + miroir)

const box = (svg: string, bg = '#243040') =>
  `<svg viewBox="0 0 120 150" width="96" height="120"><defs>${defsGlobaux()}</defs>` +
  `<rect width="120" height="150" fill="${bg}"/>${svg}</svg>`;

/** Un objet du système de PLANS (navire/engin/terrestre) : rendu (view, mirror). */
const planSvg = (planId: string, species: string, view: View, mirror: boolean) => {
  const plan = planById(planId);
  const body = bonesToSvg(plan.resolve(species, view, plan.restPose(), {}));
  return mirror ? `<g transform="translate(120,0) scale(-1,1)">${body}</g>` : body;
};

/** Ligne « couverture » : les 3 vues brutes déclarées ; case vide (grisée) si la vue n'existe pas. */
const coverageRow = <A extends unknown[]>(art: ViewArt<A>, drawRaw: (v: View) => string | null) => {
  const declared = declaredViews(art);
  const cells = VIEWS.map((v) => {
    const svg = drawRaw(v);
    const has = declared.includes(v);
    return `<figure class="${has ? '' : 'empty'}">${has && svg ? box(svg) : `<div class="hole">—</div>`}<figcaption>${v}${has ? '' : ' (repli)'}</figcaption></figure>`;
  }).join('');
  const badge = declared.length === 1 ? `profil seul` : `${declared.length} vues`;
  return { cells, badge };
};

/** Ruban rotation : 2 orientations monde × 4 crans caméra → view+mirror par le résolveur unique. */
const rotationRow = (render: (view: View, mirror: boolean) => string) =>
  ORIENTS.map((dir) => {
    const strip = ROTS.map((rot) => {
      const { view, mirror } = project(dir, rot);
      return `<figure>${box(render(view, mirror))}<figcaption>rot ${rot}<br>${view}${mirror ? ' ⇄' : ''}</figcaption></figure>`;
    }).join('');
    return `<div class="strip"><span class="ori">orient. ${dir}</span>${strip}</div>`;
  }).join('');

type Entry = { name: string; art: ViewArt<never[]>; raw: (v: View) => string | null; render: (view: View, mirror: boolean) => string };

const shipEntry = (id: string): Entry => ({
  name: `navire · ${id}`,
  art: shipArtOf(id) as ViewArt<never[]>,
  raw: (v) => (declaredViews(shipArtOf(id)).includes(v) ? bonesToSvg(planById('navire').resolve(id, v, {}, {})) : null),
  render: (view, mirror) => planSvg('navire', id, view, mirror),
});

const landEntry = (id: string): Entry => ({
  name: `terrestre · ${id}`,
  art: landArtOf(id) as ViewArt<never[]>,
  raw: (v) => (declaredViews(landArtOf(id)).includes(v) ? bonesToSvg(planById('terrestre').resolve(id, v, {}, {})) : null),
  render: (view, mirror) => planSvg('terrestre', id, view, mirror),
});

// Un objet inerte d'`id` FUTUR sans art dédié → REPLI VISIBLE (#223, `orientedArtOr`) : silhouette
// d'erreur criarde, jamais un générique silencieux. Une entrée par famille (id sciemment inconnu).
const missingEntry = (plan: 'navire' | 'terrestre' | 'engin'): Entry => {
  const id = `__id-inconnu-${plan}__`;
  return {
    name: `${plan} · id inconnu → repli visible`,
    art: (plan === 'navire' ? shipArtOf(id) : plan === 'terrestre' ? landArtOf(id) : enginArtOf(id)) as ViewArt<never[]>,
    raw: (v) => (v === 'profile' ? bonesToSvg(planById(plan).resolve(id, v, {}, {})) : null),
    render: (view, mirror) => planSvg(plan, id, view, mirror),
  };
};

const entries: { title: string; items: Entry[] }[] = [
  {
    title: 'Navires — coque par ID (SHIP_ARTS)',
    items: SHIP_ARTS.map((a) => shipEntry(a.id)),
  },
  {
    title: 'Véhicules terrestres — art par ID (LAND_ARTS)',
    items: LAND_ARTS.map((a) => landEntry(a.id)),
  },
  {
    title: 'Engins de siège — art par id',
    items: ENGIN_ARTS.map((a) => ({
      name: `engin · ${a.id}`,
      art: enginArtOf(a.id) as unknown as ViewArt<never[]>,
      raw: (v) => (declaredViews(enginArtOf(a.id)).includes(v) ? bonesToSvg(planById('engin').resolve(a.id, v, {}, {})) : null),
      render: (view, mirror) => planSvg('engin', a.id, view, mirror),
    })),
  },
  {
    title: 'Repli VISIBLE (#223) — id sans art dédié : silhouette d’erreur, jamais un générique silencieux',
    items: (['navire', 'terrestre', 'engin'] as const).map(missingEntry),
  },
  {
    title: 'Props orientés — catalogue décor (PropViz.views)',
    items: Object.keys(PROPS).filter((id) => PROPS[id].views).sort().map((id) => ({
      name: `prop · ${id}`,
      art: PROPS[id].views as unknown as ViewArt<never[]>,
      raw: (v) => propViewSvg(id, v),
      render: (_view, _mirror) => '', // les props se rendent par propSvg(dir, rot) ci-dessous
      _propId: id,
    })) as (Entry & { _propId?: string })[],
  },
];

const objectBlock = (e: Entry & { _propId?: string }) => {
  const { cells, badge } = coverageRow(e.art, e.raw);
  // Props : rendu par la machinerie propSvg(dir, camRot) ; plans : par planSvg(view, mirror).
  const rot = e._propId
    ? ORIENTS.map((dir) => {
        const strip = ROTS.map((rotv) => {
          const { view, mirror } = project(dir, rotv);
          return `<figure>${box(propSvg(e._propId!, dir, rotv))}<figcaption>rot ${rotv}<br>${view}${mirror ? ' ⇄' : ''}</figcaption></figure>`;
        }).join('');
        return `<div class="strip"><span class="ori">orient. ${dir}</span>${strip}</div>`;
      }).join('')
    : rotationRow(e.render);
  return `<div class="obj"><div class="obj-head"><b>${e.name}</b> <span class="badge">${badge}</span></div>
    <div class="cov"><span class="lbl">Couverture</span><div class="grid">${cells}</div></div>
    <div class="rot"><span class="lbl">Rotation caméra</span>${rot}</div></div>`;
};

const sections = entries.map((s) => `<h2>${s.title}</h2>${s.items.map(objectBlock).join('')}`).join('\n');

const html = `<!doctype html><meta charset="utf8"><title>Objets orientés — QC</title><style>
body{margin:0;background:#181c24;color:#cdd6e4;font:13px system-ui;padding:16px}
h1{font-size:16px;color:#e6ecf5}h2{font-size:14px;color:#9fd0ff;margin:22px 0 6px;border-bottom:1px solid #2a3240;padding-bottom:4px}
.obj{background:#1f2530;border-radius:8px;padding:8px 10px;margin:8px 0}
.obj-head{margin-bottom:6px}.badge{background:#33507a;border-radius:10px;padding:1px 8px;font-size:11px;margin-left:6px}
.lbl{display:block;color:#7f8ba0;font-size:11px;margin:4px 0 2px}
.grid,.strip{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start}
.strip{margin:2px 0}
.ori{width:78px;color:#8fa3bf;font-size:11px;align-self:center}
figure{margin:0;text-align:center}figure.empty{opacity:.7}
figcaption{font-size:10px;color:#9aa7bd;margin-top:1px}
.hole{width:96px;height:120px;display:flex;align-items:center;justify-content:center;color:#556;background:#1a1e26;border:1px dashed #333c4a;border-radius:4px}
svg{display:block;border-radius:4px}
</style>
<h1>Objets orientés — couverture de vues + rotation caméra</h1>
<p style="color:#8b97ad">Tout art orienté (navire, engin, chariot, prop) partage le contrat <code>ViewArt</code> et l'unique résolveur <code>project(dir, camRot)</code>. « Couverture » = vues réellement dessinées (case grisée = repli, à combler par les vagues d'art A1-A4). « Rotation caméra » = l'objet pivote (view + miroir ⇄) sur 4 crans × 2 orientations monde.</p>
${sections}`;

writeFileSync('public/oriented-objects.html', html, 'utf8');
console.log('OK: public/oriented-objects.html (navires, engins, terrestre, props orientés)');
