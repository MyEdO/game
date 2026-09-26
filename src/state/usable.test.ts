/**
 * UN SEUL MODÈLE D'UTILISABILITÉ (#1687) — `estUtilisable(scene, ent) = actionsDe(scene, ent).length > 0`.
 *
 * Les scènes sont FABRIQUÉES ici (doctrine : jamais une scène de campagne UTILISÉE comme fixture).
 * Le dernier `describe` fait exception et LIT les paquets livrés, mais en PLANCHER : il n'asserte
 * aucun contenu ni aucun nombre récité — il asserte une ÉGALITÉ DÉRIVÉE (« aucune entité livrée ne
 * devient muette »), qui reste vraie quand l'auteur ajoute ou retire des entités.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { emptyScene, type ActionAuthoree, type Scene, type SceneEntity } from './scene';
import { placesJouables, seatSlotsOf } from './seating';
import { actionsDe, actionsAuthorees, cleActionJouee, estUtilisable, ACTION_FOUILLER } from './usable';
import { t } from '../i18n';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';

/** Meuble de référence du catalogue app-owned : 4 places cardinales. */
const TABLE = 'table-ronde-4-tabourets';

function scene(entities: SceneEntity[]): Scene {
  const s = emptyScene(12, 12);
  s.entities = entities;
  return s;
}

const tabouret = (over: Partial<SceneEntity> = {}): SceneEntity =>
  ({ id: 'table-1', kind: 'prop', pos: { x: 5, y: 5 }, ref: TABLE, ...over }) as SceneEntity;

const ids = (sc: Scene, e: SceneEntity) => actionsDe(sc, e).map((a) => a.id);

/** Une action AUTHORÉE minimale : un id, un Flow vide — l'auteur n'a rien d'autre à poser. */
const action = (id: string, over: Partial<ActionAuthoree> = {}): ActionAuthoree =>
  ({ id, flow: { kind: 'seq', steps: [] }, ...over });

describe('actionsDe — les CAPACITÉS D’INSTANCE se dérivent sans rien activer', () => {
  it('un PNJ à `dialogueId` est utilisable SANS `usable`', () => {
    const pnj: SceneEntity = { id: 'p', kind: 'personnage', ref: 'humain', pos: { x: 1, y: 1 }, dialogueId: 'd1' };
    const sc = scene([pnj]);
    expect(ids(sc, pnj)).toEqual(['parler']);
    expect(estUtilisable(sc, pnj)).toBe(true);
  });

  it('dialogue, marchand et action authorée comptent chacun pour une offre, cumulables et dans cet ordre', () => {
    const pnj: SceneEntity = {
      id: 'p', kind: 'personnage', ref: 'humain', pos: { x: 1, y: 1 },
      dialogueId: 'd1',
      merchant: { archetype: 'marchand-general' },
      usable: { actions: [action(ACTION_FOUILLER)] },
    };
    const sc = scene([pnj]);
    expect(ids(sc, pnj)).toEqual(['parler', 'commercer', 'fouiller']);
    expect(actionsDe(sc, pnj).map((a) => a.origine)).toEqual(['capacite', 'capacite', 'authoree']);
  });

  it('le rôle `tavernGame` n’est PAS une offre : sa table se joue par le dialogue qui la sert', () => {
    const joueur: SceneEntity = {
      id: 'j', kind: 'personnage', ref: 'humain', pos: { x: 1, y: 1 }, tavernGame: { gameId: 'imperatrice-ecarlate' },
    };
    const sc = scene([joueur]);
    expect(actionsDe(sc, joueur)).toEqual([]);
    expect(estUtilisable(sc, joueur)).toBe(false);
  });

  it('un décor NU n’offre rien — il n’est pas utilisable', () => {
    const caisse: SceneEntity = { id: 'c', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'tonneau' };
    const sc = scene([caisse]);
    expect(actionsDe(sc, caisse)).toEqual([]);
    expect(estUtilisable(sc, caisse)).toBe(false);
  });
});

describe('actionsDe — l’ASSISE ne s’ouvre qu’à l’ACTIVATION de l’instance (verbatim 2026-09-09)', () => {
  it('un meuble à places SANS `usable` n’est PAS utilisable, et ses places ne sont pas JOUABLES', () => {
    const t = tabouret();
    const sc = scene([t]);
    expect(actionsDe(sc, t)).toEqual([]);
    expect(estUtilisable(sc, t)).toBe(false);
    expect(placesJouables(sc, 'table-1')).toEqual([]);
  });

  it('le MÊME meuble ACTIVÉ offre « S’asseoir », et ses places deviennent jouables', () => {
    const t = tabouret({ usable: { assise: true } });
    const sc = scene([t]);
    expect(actionsDe(sc, t).map((a) => ({ id: a.id, origine: a.origine }))).toEqual([{ id: 'sasseoir', origine: 'assise' }]);
    expect(estUtilisable(sc, t)).toBe(true);
    expect(placesJouables(sc, 'table-1')).toHaveLength(4);
  });

  it('la GÉOMÉTRIE ne dépend d’aucune activation : `seatSlotsOf` rend la MÊME chose des deux côtés', () => {
    const sans = scene([tabouret()]);
    const avec = scene([tabouret({ usable: { assise: true } })]);
    expect(seatSlotsOf(sans, 'table-1')).toHaveLength(4);
    expect(seatSlotsOf(avec, 'table-1')).toEqual(seatSlotsOf(sans, 'table-1'));
  });

  it('une entité ACTIVÉE dont le TYPE n’a aucune place n’en tire aucune action (l’activation n’invente rien)', () => {
    const caisse: SceneEntity = { id: 'c', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'tonneau', usable: { assise: true } };
    const sc = scene([caisse]);
    expect(actionsDe(sc, caisse)).toEqual([]);
  });

  it('une enveloppe qui ne porte que des ACTIONS n’ouvre PAS l’assise — les deux faits sont nommés séparément', () => {
    const t = tabouret({ usable: { actions: [action('ouvrir')] } });
    const sc = scene([t]);
    expect(ids(sc, t)).toEqual(['ouvrir']);
    expect(placesJouables(sc, 'table-1')).toEqual([]);
  });
});

describe('actionsDe — les ACTIONS AUTHORÉES : origine, libellé, épuisement', () => {
  const coffre = (actions: ActionAuthoree[]): SceneEntity =>
    ({ id: 'coffre', kind: 'prop', pos: { x: 3, y: 3 }, ref: 'tonneau', usable: { actions } });

  it('une action authorée sort avec l’origine `authoree` et son id d’auteur', () => {
    const e = coffre([action('ouvrir'), action(ACTION_FOUILLER)]);
    const sc = scene([e]);
    expect(actionsDe(sc, e).map((a) => ({ id: a.id, origine: a.origine })))
      .toEqual([{ id: 'ouvrir', origine: 'authoree' }, { id: ACTION_FOUILLER, origine: 'authoree' }]);
    expect(estUtilisable(sc, e)).toBe(true);
  });

  it('LIBELLÉ : celui de l’auteur s’il en pose un, sinon le catalogue i18n à la clé `usable.<id>`', () => {
    const e = coffre([action(ACTION_FOUILLER), action('ouvrir', { label: 'Forcer le couvercle' })]);
    const sc = scene([e]);
    expect(actionsDe(sc, e).map((a) => a.label)).toEqual([t('usable.fouiller'), 'Forcer le couvercle']);
    // Un id hors catalogue rend la CLÉ : le défaut manquant se voit, il ne se devine pas.
    const inconnu = coffre([action('desceller-la-dalle')]);
    expect(actionsDe(scene([inconnu]), inconnu)[0].label).toBe('usable.desceller-la-dalle');
  });

  it('ÉPUISEMENT : le drapeau `cleActionJouee` ferme CETTE action-là, et elle seule', () => {
    const e = coffre([action(ACTION_FOUILLER, { unique: true }), action('ouvrir')]);
    const sc = scene([e]);
    const flags = { [cleActionJouee('coffre', ACTION_FOUILLER)]: true };
    expect(actionsAuthorees(e, flags).map((a) => a.id)).toEqual(['ouvrir']);
    expect(ids(sc, e)).toEqual([ACTION_FOUILLER, 'ouvrir']);
    expect(actionsDe(sc, e, flags).map((a) => a.id)).toEqual(['ouvrir']);
  });

  it('toutes les actions épuisées : le décor n’offre plus rien et n’est plus utilisable', () => {
    const e = coffre([action(ACTION_FOUILLER, { unique: true })]);
    const sc = scene([e]);
    expect(estUtilisable(sc, e, { [cleActionJouee('coffre', ACTION_FOUILLER)]: true })).toBe(false);
  });

  it('l’ASSISE survit à l’épuisement des actions : elle ne se ferme que par ses places', () => {
    const t = tabouret({ usable: { assise: true, actions: [action(ACTION_FOUILLER, { unique: true })] } });
    const sc = scene([t]);
    expect(ids(sc, t)).toEqual([ACTION_FOUILLER, 'sasseoir']);
    expect(actionsDe(sc, t, { [cleActionJouee('table-1', ACTION_FOUILLER)]: true }).map((a) => a.id)).toEqual(['sasseoir']);
  });
});

/**
 * PLANCHER — aucune instance LIVRÉE ne devient muette (#1687, méthode de la sonde du juge).
 *
 * Lecture des 4 paquets livrés en PLANCHER, jamais en assertion de contenu : l'égalité comparée est
 * DÉRIVÉE des deux côtés (offre AVANT le lot = capacités d'instance + places du TYPE ; offre APRÈS =
 * `estUtilisable`). Aucun nombre n'est récité — ajouter une entité à une campagne ne rougit pas ce
 * test, retirer une offre à une entité livrée, si.
 */
describe('PLANCHER — les entités des paquets livrés gardent leur offre', () => {
  const RACINE = join(process.cwd(), 'src/scenes');
  const PROJETS = listerDossier(RACINE)
    .map((nom: string) => join(RACINE, nom, `${nom}-projet.json`))
    .filter((p: string) => {
      try { readFileSync(p); return true; } catch { return false; }
    });

  it('les paquets livrés sont lisibles (sans quoi le plancher ne mesure rien)', () => {
    expect(PROJETS.length).toBeGreaterThan(0);
  });

  it.each(PROJETS)('%s : chaque entité qui offrait quelque chose AVANT offre encore', (chemin: string) => {
    const doc = JSON.parse(readFileSync(chemin, 'utf8')) as { scenes: { id: string; entities?: SceneEntity[] }[] };
    const muettes: string[] = [];
    let offrantes = 0;
    for (const sc of doc.scenes) {
      const s = scene((sc.entities ?? []) as SceneEntity[]);
      for (const e of s.entities) {
        // L'offre d'AVANT le lot, telle que la sonde du juge la mesurait : les capacités d'instance,
        // les gestes authorés, plus les places que le TYPE porte (l'assise était alors une propriété
        // du TYPE seul). Le rôle `tavernGame` n'en est pas : sa table n'a jamais eu d'exécuteur hors
        // du nœud de dialogue qui la sert (`openTavernGames`, mesuré).
        const avant = !!e.dialogueId || !!e.merchant || !!e.usable?.actions?.length
          || (e.kind === 'prop' && seatSlotsOf(s, e.id).length > 0);
        if (!avant) continue;
        offrantes++;
        if (!estUtilisable(s, e)) muettes.push(`${sc.id} › ${e.id}`);
      }
    }
    expect(offrantes, `${chemin} : aucune entité offrante — le plancher ne mesure rien`).toBeGreaterThan(0);
    expect(muettes, 'entités livrées devenues MUETTES').toEqual([]);
  });
});
