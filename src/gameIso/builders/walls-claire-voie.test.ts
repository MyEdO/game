import { describe, it, expect } from 'vitest';
import { buildWalls, wallEnds } from './walls';
import { emptyScene, setDoorOpen, setStructureDown, type Scene, type WallSeg } from '../../state/scene';
import { structureAppearances } from '../../data';
import { formesAdmises, formesDeLArete, type FormeArete } from '../../state/formeArete';

/**
 * CONTRATS de rendu des apparences à CLAIRE-VOIE (#1883), pour chaque FORME que l'apparence habille
 * (`formesAdmises`, `state/formeArete.ts` — la source que lisent aussi `validateScene` et l'Inspecteur),
 * posée sur la Structure du même id, intacte puis abattue. Deux lectures :
 *  - `parties` : `partie[bas-haut]` en mètres depuis le sol, dans l'ordre de peinture ;
 *  - `barreaux` : `barreau[t0-t1]`, le tronçon de l'arête (fraction 0..1 de A vers B) qu'occupe chaque
 *    barreau — l'espacement et la largeur des barreaux, que les hauteurs ne voient pas.
 */

type Variante = { nom: FormeArete; seg: Partial<WallSeg>; open?: boolean };
/** Le segment qui PREND chaque forme (sur une Structure de la bonne nature). */
const PAR_FORME: Record<FormeArete, Variante> = {
  'mur-nu': { nom: 'mur-nu', seg: {} },
  'mur-fenetre': { nom: 'mur-fenetre', seg: { window: true } },
  'porte-fermee': { nom: 'porte-fermee', seg: { door: true, closed: true } },
  'porte-ouverte': { nom: 'porte-ouverte', seg: { door: true }, open: true },
  'fermeture-fixe': { nom: 'fermeture-fixe', seg: {} },
};

const SEG = { x: 1, y: 1, side: 'N' as const };

function rendu(id: string, v: Variante, down: boolean) {
  let s: Scene = emptyScene(4, 4);
  s.walls = [{ ...SEG, structure: id, ...v.seg }];
  if (v.open) s = setDoorOpen(s, SEG.x, SEG.y, SEG.side, 0, true);
  if (down) s = setStructureDown(s, SEG.x, SEG.y, SEG.side, 0, true);
  return buildWalls(s)[0].faces;
}

type Faces = ReturnType<typeof rendu>;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const points = (f: Faces[number]) => f.poly as { x: number; y: number; h: number }[];

/** `partie[bas-haut]`, les répétitions CONSÉCUTIVES comptées (`barreau×7[0-3.4]`). */
function parties(faces: Faces): string[] {
  const out: { cle: string; n: number }[] = [];
  for (const f of faces) {
    const hs = points(f).map((p) => p.h);
    const cle = `${f.material.part}[${r3(Math.min(...hs))}-${r3(Math.max(...hs))}]`;
    const der = out[out.length - 1];
    if (der?.cle === cle) der.n++;
    else out.push({ cle, n: 1 });
  }
  return out.map(({ cle, n }) => (n > 1 ? cle.replace('[', `×${n}[`) : cle));
}

/** `barreau[t0-t1]` : le tronçon de l'arête, fraction de A vers B (`wallEnds`), de chaque barreau. */
function barreaux(faces: Faces): string[] {
  const [A, B] = wallEnds(SEG);
  const long = (p: { x: number; y: number }) =>
    ((p.x - A.x) * (B.x - A.x) + (p.y - A.y) * (B.y - A.y)) / ((B.x - A.x) ** 2 + (B.y - A.y) ** 2);
  return faces
    .filter((f) => f.material.part === 'barreau')
    .map((f) => {
      const ts = points(f).map(long);
      return `barreau[${r3(Math.min(...ts))}-${r3(Math.max(...ts))}]`;
    });
}

const GRAVATS_GC = ['gravats[0-0.16]', 'gravats-tas[0-0.32]', 'poteau[0-0.224]', 'poteau[0-0.176]'];
const GRAVATS_HERSE = ['gravats[0-0.64]', 'gravats-tas[0-1.28]', 'poteau[0-0.896]', 'poteau[0-0.704]'];
const COURONNE_PDV = ['linteau[3.833-4]', 'parapet[4-5.28]', 'bande[4.922-5.022]', 'arase[5.155-5.28]', 'merlon×3[5.28-5.53]'];
const HERSE_FERMEE = ['poteau[0-4]', 'barreau×7[0-3.4]', 'traverse[1.7-1.783]', 'face[3.4-4]', 'chambranle[3.4-3.567]', 'couronnement[3.44-4]', 'jambage×2[0-3.4]', 'poteau[0-4]'];
const BARREAUX_PDV = ['barreau×7[0-3.6]', 'traverse[1.44-1.523]', 'traverse[2.808-2.891]'];
/** Six intervalles, sept barreaux : un barreau à chaque sixième de l'arête, rogné aux deux bouts. */
const SEPT_BARREAUX = [
  'barreau[0-0.02]', 'barreau[0.147-0.187]', 'barreau[0.313-0.353]', 'barreau[0.48-0.52]',
  'barreau[0.647-0.687]', 'barreau[0.813-0.853]', 'barreau[0.98-1]',
];

/** Contrat attendu PAR apparence × variante posable × état. */
const ATTENDU: Record<string, Record<string, { parties: string[]; barreaux: string[] }>> = {
  'garde-corps': {
    'mur-nu|intact': {
      parties: ['poteau[0-1]', 'plinthe[0-0.11]', 'barreau×7[0.11-0.86]', 'couronnement[0.86-1]', 'couronnement[1-1.167]', 'poteau[0-1]'],
      barreaux: SEPT_BARREAUX,
    },
    'mur-nu|abattu': { parties: GRAVATS_GC, barreaux: [] },
  },
  herse: {
    'porte-fermee|intact': { parties: HERSE_FERMEE, barreaux: SEPT_BARREAUX },
    'porte-fermee|abattu': { parties: GRAVATS_HERSE, barreaux: [] },
    'porte-ouverte|intact': {
      parties: ['poteau[0-4]', 'face[3.4-4]', 'chambranle[3.4-3.567]', 'couronnement[3.44-4]', 'jambage×2[0-3.4]', 'poteau[0-4]'],
      barreaux: [],
    },
    'porte-ouverte|abattu': { parties: GRAVATS_HERSE, barreaux: [] },
    'fermeture-fixe|intact': { parties: HERSE_FERMEE, barreaux: SEPT_BARREAUX },
    'fermeture-fixe|abattu': { parties: GRAVATS_HERSE, barreaux: [] },
  },
  'porte-de-ville': {
    'porte-fermee|intact': { parties: [...BARREAUX_PDV, ...COURONNE_PDV], barreaux: SEPT_BARREAUX },
    'porte-fermee|abattu': { parties: ['seuil[0-0.48]', ...COURONNE_PDV], barreaux: [] },
    'porte-ouverte|intact': { parties: COURONNE_PDV, barreaux: [] },
    'porte-ouverte|abattu': { parties: ['seuil[0-0.48]', ...COURONNE_PDV], barreaux: [] },
    'fermeture-fixe|intact': { parties: [...BARREAUX_PDV, ...COURONNE_PDV], barreaux: SEPT_BARREAUX },
    'fermeture-fixe|abattu': { parties: ['seuil[0-0.48]', ...COURONNE_PDV], barreaux: [] },
  },
};

const A_CLAIRE_VOIE = structureAppearances.filter((a) => a.claireVoie).map((a) => a.id);

describe('buildWalls — contrats des apparences à claire-voie, par variante posable (#1883)', () => {
  it('les apparences à claire-voie sont exactement celles que ces contrats décrivent', () => {
    expect(A_CLAIRE_VOIE.sort()).toEqual(Object.keys(ATTENDU).sort());
  });

  for (const def of structureAppearances.filter((a) => a.claireVoie)) {
    const id = def.id;
    const formes = formesAdmises(def);
    it(`${id} (${formes.join(', ')}) : parties × hauteurs et barreaux × tronçons de chaque forme habillée`, () => {
      const obtenu: Record<string, { parties: string[]; barreaux: string[] }> = {};
      for (const v of formes.map((f) => PAR_FORME[f])) {
        expect(formesDeLArete({ structure: id, ...v.seg }), `${id} : la Structure de même id ne prend pas la forme ${v.nom}`).toContain(v.nom);
        for (const down of [false, true]) {
          const faces = rendu(id, v, down);
          obtenu[`${v.nom}|${down ? 'abattu' : 'intact'}`] = { parties: parties(faces), barreaux: barreaux(faces) };
        }
      }
      expect(Object.keys(obtenu).sort()).toEqual(Object.keys(ATTENDU[id]).sort());
      for (const [k, att] of Object.entries(ATTENDU[id])) {
        expect(obtenu[k].parties, `${id} ${k} : parties`).toEqual(att.parties);
        expect(obtenu[k].barreaux, `${id} ${k} : barreaux`).toEqual(att.barreaux);
      }
    });
  }

  it('la branche de porte suit la FORME, pas le bloc `door` : une apparence porte de ville posée en mur nu ne dessine aucun passage', () => {
    const s: Scene = emptyScene(4, 4);
    s.walls = [{ ...SEG, structure: 'mur-en-bois', appearance: 'porte-de-ville' }];
    const parts = buildWalls(s)[0].faces.map((f) => f.material.part);
    expect(parts).not.toContain('barreau');
    expect(parts).not.toContain('linteau');
    expect(parts).toContain('face');
  });

  it('la herse FERMÉE (sa forme posable) : ni plinthe ni main courante — son seul couronnement est celui du cadre de porte, au-dessus des barreaux', () => {
    const herse = rendu('herse', PAR_FORME['porte-fermee'], false);
    const couronnements = herse.filter((f) => f.material.part === 'couronnement');
    const hautBarreaux = Math.max(...herse.filter((f) => f.material.part === 'barreau').flatMap((f) => points(f).map((p) => p.h)));
    expect(herse.map((f) => f.material.part)).not.toContain('plinthe');
    expect(couronnements).toHaveLength(1);
    expect(Math.min(...points(couronnements[0]).map((p) => p.h))).toBeGreaterThanOrEqual(hautBarreaux);
    const gardeCorps = rendu('garde-corps', PAR_FORME['mur-nu'], false).map((f) => f.material.part);
    expect(gardeCorps).toContain('plinthe');
    expect(gardeCorps).toContain('couronnement');
  });
});
