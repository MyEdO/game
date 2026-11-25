/** Provenance locale, références présentes résolubles et régime documentaire canonique d'un paquet (#2001, #2427),
 *  sur des paquets fabriqués ici et sur le paquet de test ; chaque projet le joue sur ses paquets dans sa suite. */
import { describe, it, expect } from 'vitest';
import { parseProject } from './worldMap';
import { emptyScene } from './monde/scene';
import { emptyNarratif } from './monde/campaignNarratif';
import { flowFromEffects } from './monde/flow';
import paquetDeTest from '../scenes/fixtures/paquet-de-test.json';
import { fautesDeProvenance, proseSourcees, type DocDeProvenance, type ProseSourcee } from './provenanceDuPaquet.testkit';

describe('provenance locale, références présentes résolubles et régime documentaire canonique (#2001)', () => {
  it('le paquet de test : provenance locale, références présentes résolubles et régime documentaire canonique', () => {
    expect(fautesDeProvenance(parseProject(structuredClone(paquetDeTest)), 'paquet-de-test')).toEqual([]);
  });

  const SOURCE = { book: 'ennemi-dans-l-ombre', page: 12 };
  const ADAPTE = { adapteDe: { book: 'ennemi-dans-l-ombre', page: 14 } };
  const NU = { desc: 'Réplique maison.' };
  const paquet = (node: Record<string, unknown>, journal: Record<string, unknown>, source: typeof SOURCE | null = SOURCE): DocDeProvenance => {
    const sc = emptyScene('scene-test', 4, 4);
    sc.id = 'sc';
    sc.dialogues = [{ id: 'dlg', start: { id: 'n1' }, nodes: [{ id: 'n1', choices: [], ...node }] }];
    sc.triggers = [{ id: 't', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: flowFromEffects([{ type: 'journal', ...journal }]) }];
    return { ...(source ? { source } : {}), scenes: [sc], narratif: emptyNarratif() };
  };

  it('la prose Maison coupe la source documentaire racine', () => {
    expect(fautesDeProvenance(paquet(NU, NU), 'f')).toEqual([]);
  });

  it('les mêmes, ADRESSÉS (`descRef`), passent : l’adresse est leur verbatim', () => {
    const ADRESSE = { descRef: { book: 'ennemi-dans-l-ombre', ch: '01', parts: [{ kind: 'blocs', sec: 'le-proprietaire', secOcc: 2, b0: 0, b1: 0, sum: '38e48aee36c04e9f' }] } };
    expect(fautesDeProvenance(paquet({ ...NU, ...ADRESSE }, { ...NU, ...ADRESSE }), 'f')).toEqual([]);
  });

  it('les mêmes, `adapteDe`, passent ; un paquet sans racine `source` n’exige rien', () => {
    expect(fautesDeProvenance(paquet({ ...NU, ...ADAPTE }, { ...NU, ...ADAPTE }), 'f')).toEqual([]);
    expect(fautesDeProvenance(paquet(NU, NU, null), 'f')).toEqual([]);
  });

  it('un `adapteDe.book` inconnu est nommé, même hors racine `source`', () => {
    const inconnu = { ...NU, adapteDe: { book: 'livre-fantome', page: 1 } };
    expect(fautesDeProvenance(paquet(inconnu, { ...NU, ...ADAPTE }, null), 'f')).toEqual([
      'f.scenes[0].dialogues[0].nodes[0].adapteDe : book « livre-fantome » absent de books.json',
    ]);
  });

  const terrainDans = (battle: Record<string, unknown>, source: typeof SOURCE | null = SOURCE): DocDeProvenance => {
    const doc = paquet({ ...NU, ...ADAPTE }, { ...NU, ...ADAPTE }, source);
    doc.scenes[0].triggers.push({
      id: 'bataille', rect: { x: 0, y: 0, w: 1, h: 1 },
      flow: { kind: 'sequence', etapes: [{ kind: 'sequence', etapes: [
        { kind: 'effet', effet: { type: 'startMassBattle', battle: { puissanceAlliee: 50, puissanceEnnemie: 50, ...battle } } },
      ] }] },
    });
    return doc;
  };

  it('le terrain Maison reste local sous une racine sourcée', () => {
    const fautes = fautesDeProvenance(terrainDans({ terrain: 'Terrain maison.' }), 'f');
    expect(fautes).toEqual([]);
    expect(fautesDeProvenance(terrainDans({}), 'f')).toEqual([]);
    expect(fautesDeProvenance(terrainDans({ terrain: 'Terrain maison.' }, null), 'f')).toEqual([]);
    expect(fautesDeProvenance(terrainDans({ terrain: 'Terrain adapté.', ...ADAPTE }), 'f')).toEqual([]);
    expect(fautesDeProvenance(terrainDans({ terrain: 'Terrain copié.', source: SOURCE }), 'f')).toEqual([]);
  });

  it('un stade document et un document Maison sont admis ; Adapté est refusé par le document canonique', () => {
    const doc = terrainDans({});
    doc.narratif.indices = [{ id: 'indice', affaireId: 'affaire', titre: 'Indice', kind: 'indice', stades: [{ id: 'stade', documentId: 'lettre' }] }];
    doc.narratif.documents = [{ id: 'lettre', titre: 'Lettre', prose: 'Texte.' }];
    expect(fautesDeProvenance(doc, 'f')).toEqual([]);
    doc.narratif.documents[0].source = SOURCE;
    expect(fautesDeProvenance(doc, 'f')).toEqual([]);
    expect(fautesDeProvenance({ ...doc, narratif: { ...doc.narratif, documents: [{ ...doc.narratif.documents[0], source: undefined, ...ADAPTE }] } }, 'f'))
      .toEqual(['f.narratif.documents[lettre] : Clé non reconnue : "adapteDe"']);
  });

  it('les refus et sous-titres Maison sous racine sourcée restent locaux', () => {
    const doc = paquet(NU, NU);
    const valeur = {
      ...doc,
      worldMap: { routes: [{ id: 'a', refus: { texte: 'Refus Maison.' } }, { id: 'b', refus: { texte: 'Autre refus Maison.' } }] },
      narratif: { ...doc.narratif,
        ouverture: { titre: 'Ouverture', pitch: 'Maison.', sousTitre: { texte: 'Sous-titre Maison.' } },
        cloture: { titre: 'Clôture', when: { kind: 'always' }, sousTitre: { texte: 'Clôture Maison.' } },
      },
    };
    expect(fautesDeProvenance(valeur as DocDeProvenance, 'f')).toEqual([]);
    const out: ProseSourcee[] = [];
    proseSourcees(valeur, 'f', out);
    expect(out).toEqual([]);
  });

  it('un document Maison accepte les deux racines et conserve sa copie locale ; Adapté est refusé par son canon', () => {
    for (const source of [SOURCE, null]) {
      const doc = paquet(NU, NU, source);
      doc.narratif.documents = [{ id: 'lettre', titre: 'Lettre', prose: 'Texte.' }];
      expect(fautesDeProvenance(doc, 'f')).toEqual([]);
      doc.narratif.documents[0].source = SOURCE;
      expect(fautesDeProvenance(doc, 'f')).toEqual([]);
      const out: ProseSourcee[] = [];
      proseSourcees(doc, 'f', out);
      expect(out).toEqual([{ chemin: 'f.narratif.documents[lettre].prose', texte: 'Texte.', source: SOURCE }]);
      expect(fautesDeProvenance({ ...doc, narratif: { ...doc.narratif, documents: [{ ...doc.narratif.documents[0], ...ADAPTE }] } }, 'f'))
        .toEqual(['f.narratif.documents[lettre] : Clé non reconnue : "adapteDe"']);
    }
  });

  it('les copies suivent la provenance locale du terrain, jamais celle de la racine', () => {
    const SOURCE_LOCALE = { book: 'ennemi-dans-l-ombre', page: 15 };
    const lire = (doc: unknown) => { const out: ProseSourcee[] = []; proseSourcees(doc, 'f', out); return out; };
    expect(lire(terrainDans({ terrain: 'Maison.' }))).toEqual([]);
    expect(lire(terrainDans({ terrain: 'Adapté.', ...ADAPTE }))).toEqual([]);
    const copies = lire(terrainDans({ terrain: 'Copié.', source: SOURCE_LOCALE }));
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({ texte: 'Copié.', source: SOURCE_LOCALE });
    expect(copies[0].chemin).toContain('.battle.terrain');
  });

  it('l’ouverture maison coupe la racine ; le profil conserve la source du preset et adapteDe coupe celle-ci', () => {
    const doc = terrainDans({});
    doc.narratif.ouverture = { titre: 'Ouverture', pitch: 'Maison.' };
    doc.narratif.presetsPnj = [
      { id: 'copie', source: SOURCE, profil: { desc: 'Profil copié.' } },
      { id: 'adapte', ...ADAPTE, profil: { desc: 'Profil adapté.' } },
    ];
    const out: ProseSourcee[] = [];
    proseSourcees(doc, 'f', out);
    expect(out.map((p) => [p.chemin, p.texte, p.source])).toEqual([
      ['f.narratif.presetsPnj[copie].profil.desc', 'Profil copié.', SOURCE],
    ]);
  });

  it('la description de projet n’est pas une copie ; l’objet embarqué conserve sa source propre et l’objet maison n’hérite pas de la racine', () => {
    const doc = terrainDans({});
    const out: ProseSourcee[] = [];
    proseSourcees({
      ...doc,
      desc: 'Présentation maison du projet sourcé.',
      narratif: { ...doc.narratif, objets: [
        { id: 'copie', desc: 'Description copiée.', source: SOURCE },
        { id: 'maison', desc: 'Description maison.' },
        { id: 'adapte', desc: 'Description adaptée.', ...ADAPTE },
      ] },
    }, 'f', out);
    expect(out.map((p) => [p.chemin, p.texte, p.source])).toEqual([
      ['f.narratif.objets[copie].desc', 'Description copiée.', SOURCE],
    ]);
  });
});
