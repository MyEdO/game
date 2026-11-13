/**
 * Garde-fou de l'allowlist coop côté web : la table des actions de l'ADAPTATEUR est totale et n'expose rien à
 * l'invité. La table du noyau et l'allowlist se jouent au banc (`src/noyau/intents.hors-store.test.ts`).
 */
import { describe, it, expect } from 'vitest';
import { CLASSE_DES_ACTIONS_DE_L_ADAPTATEUR, type TableDeLAdaptateur } from './intents';

describe('#2724 — table TOTALE des classes coop : une action non classée ne compile pas', () => {
  it('la table de l’adaptateur aussi : une action sans classe, ou classée `invité`, ne compile pas', () => {
    const { rotateCam, ...sansRotateCam } = CLASSE_DES_ACTIONS_DE_L_ADAPTATEUR;
    // @ts-expect-error — `rotateCam` n'a pas de classe
    const privee: TableDeLAdaptateur = sansRotateCam;
    // @ts-expect-error — l'allowlist ne compte que des actions du noyau
    const invitee: TableDeLAdaptateur = { ...CLASSE_DES_ACTIONS_DE_L_ADAPTATEUR, saveGame: 'invité' };
    expect([rotateCam, privee.setZoom, invitee.saveGame]).toEqual(['local', 'local', 'invité']);
  });
});
