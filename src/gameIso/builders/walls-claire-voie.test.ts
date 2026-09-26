import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { buildWalls } from './walls';
import { emptyScene, setDoorOpen, setStructureDown, type Scene, type WallSeg } from '../../state/scene';
import { findStructureById, structureAppearances } from '../../data';
import { structureEdgeKind } from '../../engine/structures';

/**
 * CONTRATS de rendu des apparences à CLAIRE-VOIE (#1883) : parties × hauteurs (m, depuis le sol) des
 * faces que `buildWalls` pose, dans l'ordre de peinture, pour chaque variante POSABLE. « Posable » se
 * lit dans la DONNÉE : la Structure du même id et sa nature d'authoring (`structureEdgeKind`) — une
 * `mur` se pose à l'outil Cloison (arête nue), une `porte` à l'outil Porte (`door`, fermée ou ouverte ;
 * sélecteurs `isWallEdgeStructure`/`isDoorEdgeStructure`). Chaque variante, intacte puis abattue.
 *
 * L'EMPREINTE couvre ce que les contrats ne lisent pas : la position LE LONG de l'arête (espacement des
 * barreaux, place des jambages). Elle rougit seule quand un barreau glisse sans changer de hauteur.
 */

type Variante = { nom: string; seg: Partial<WallSeg>; open?: boolean };
const PAR_NATURE: Record<'mur' | 'porte', Variante[]> = {
  mur: [{ nom: 'mur', seg: {} }],
  porte: [
    { nom: 'porte-fermee', seg: { door: true, closed: true } },
    { nom: 'porte-ouverte', seg: { door: true }, open: true },
  ],
};

function rendu(id: string, v: Variante, down: boolean) {
  let s: Scene = emptyScene(4, 4);
  s.walls = [{ x: 1, y: 1, side: 'N', structure: id, ...v.seg }];
  if (v.open) s = setDoorOpen(s, 1, 1, 'N', 0, true);
  if (down) s = setStructureDown(s, 1, 1, 'N', 0, true);
  return buildWalls(s)[0].faces;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const hauteurs = (f: { poly: unknown[] }) => (f.poly as { h: number }[]).map((p) => p.h);

/** `partie[bas-haut]`, les répétitions CONSÉCUTIVES comptées (`barreau×7[0-3.4]`). */
function contrat(faces: ReturnType<typeof rendu>): string[] {
  const out: { cle: string; n: number }[] = [];
  for (const f of faces) {
    const hs = hauteurs(f);
    const cle = `${f.material.part}[${r3(Math.min(...hs))}-${r3(Math.max(...hs))}]`;
    const der = out[out.length - 1];
    if (der?.cle === cle) der.n++;
    else out.push({ cle, n: 1 });
  }
  return out.map(({ cle, n }) => (n > 1 ? cle.replace('[', `×${n}[`) : cle));
}

function empreinte(faces: ReturnType<typeof rendu>): string {
  const brut = faces.map((f) => [f.material.part, (f.poly as { x: number; y: number; h: number }[]).map((p) => [r3(p.x), r3(p.y), r3(p.h)])]);
  return createHash('sha256').update(JSON.stringify(brut)).digest('hex').slice(0, 12);
}

const GRAVATS_GC = ['gravats[0-0.16]', 'gravats-tas[0-0.32]', 'poteau[0-0.224]', 'poteau[0-0.176]'];
const GRAVATS_HERSE = ['gravats[0-0.64]', 'gravats-tas[0-1.28]', 'poteau[0-0.896]', 'poteau[0-0.704]'];
const COURONNE_PDV = ['linteau[3.833-4]', 'parapet[4-5.28]', 'bande[4.922-5.022]', 'arase[5.155-5.28]', 'merlon×3[5.28-5.53]'];
const BARREAUX_PDV = ['barreau×7[0-3.6]', 'traverse[1.44-1.523]', 'traverse[2.808-2.891]'];

/** Contrat attendu PAR apparence × variante posable × état — et l'empreinte de cette combinaison. */
const ATTENDU: Record<string, Record<string, { contrat: string[]; empreinte: string }>> = {
  'garde-corps': {
    'mur|intact': {
      contrat: ['poteau[0-1]', 'plinthe[0-0.11]', 'barreau×7[0.11-0.86]', 'couronnement[0.86-1]', 'couronnement[1-1.167]', 'poteau[0-1]'],
      empreinte: '24265a4e668d',
    },
    'mur|abattu': { contrat: GRAVATS_GC, empreinte: 'd88e87e67e81' },
  },
  herse: {
    'porte-fermee|intact': {
      contrat: ['poteau[0-4]', 'barreau×7[0-3.4]', 'traverse[1.7-1.783]', 'face[3.4-4]', 'chambranle[3.4-3.567]', 'couronnement[3.44-4]', 'jambage×2[0-3.4]', 'poteau[0-4]'],
      empreinte: 'e37327a2fb87',
    },
    'porte-fermee|abattu': { contrat: GRAVATS_HERSE, empreinte: '27f0118524f8' },
    'porte-ouverte|intact': {
      contrat: ['poteau[0-4]', 'face[3.4-4]', 'chambranle[3.4-3.567]', 'couronnement[3.44-4]', 'jambage×2[0-3.4]', 'poteau[0-4]'],
      empreinte: '582b1d85f1c2',
    },
    'porte-ouverte|abattu': { contrat: GRAVATS_HERSE, empreinte: '27f0118524f8' },
  },
  'porte-de-ville': {
    'porte-fermee|intact': { contrat: [...BARREAUX_PDV, ...COURONNE_PDV], empreinte: '5bded27ddd88' },
    'porte-fermee|abattu': { contrat: ['seuil[0-0.48]', ...COURONNE_PDV], empreinte: 'cc02c08ed115' },
    'porte-ouverte|intact': { contrat: COURONNE_PDV, empreinte: '7778945472af' },
    'porte-ouverte|abattu': { contrat: ['seuil[0-0.48]', ...COURONNE_PDV], empreinte: 'cc02c08ed115' },
  },
};

const A_CLAIRE_VOIE = structureAppearances.filter((a) => a.claireVoie).map((a) => a.id);

describe('buildWalls — contrats des apparences à claire-voie, par variante posable (#1883)', () => {
  it('les apparences à claire-voie sont exactement celles que ces contrats décrivent', () => {
    expect(A_CLAIRE_VOIE.sort()).toEqual(Object.keys(ATTENDU).sort());
  });

  for (const id of A_CLAIRE_VOIE) {
    const nature = structureEdgeKind(findStructureById(id)!);
    it(`${id} (${nature}) : parties × hauteurs, puis empreinte, de chaque variante posable`, () => {
      expect(nature, `${id} : aucune Structure posable de même id`).toBeDefined();
      const obtenu: Record<string, { contrat: string[]; empreinte: string }> = {};
      for (const v of PAR_NATURE[nature!])
        for (const down of [false, true]) {
          const faces = rendu(id, v, down);
          obtenu[`${v.nom}|${down ? 'abattu' : 'intact'}`] = { contrat: contrat(faces), empreinte: empreinte(faces) };
        }
      expect(Object.keys(obtenu).sort()).toEqual(Object.keys(ATTENDU[id]).sort());
      for (const [k, att] of Object.entries(ATTENDU[id])) {
        expect(obtenu[k].contrat, `${id} ${k}`).toEqual(att.contrat);
        expect(obtenu[k].empreinte, `${id} ${k} : empreinte`).toBe(att.empreinte);
      }
    });
  }

  it('la herse ne porte NI plinthe NI main courante hors de son cadre de porte ; le garde-corps, si', () => {
    const parties = (id: string) => rendu(id, { nom: 'mur', seg: {} }, false).map((f) => f.material.part);
    expect(parties('herse')).not.toContain('plinthe');
    expect(parties('herse')).not.toContain('couronnement');
    expect(parties('garde-corps')).toContain('plinthe');
    expect(parties('garde-corps')).toContain('couronnement');
  });
});
