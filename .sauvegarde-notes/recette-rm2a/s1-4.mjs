import {
  openApp, consoleGuard, evaluate, realKey,
  survoler, clickButtonByText, waitFor, sleep,
} from '/home/user/game/scripts/recette/lib.mjs';

/** Le chunk lazy de la fiche (`import('./CompendiumScreen')`) est servi par Vite (HTTP) : la 1re
 *  ouverture d'une session est parfois plus lente qu'un `sleep` fixe. On ATTEND la boîte (ou son
 *  absence confirmée), jamais un délai arbitraire. */
async function attendreCodexModal(session, { present = true, timeoutMs = 3000 } = {}) {
  try {
    await waitFor(session, `document.querySelector('.codex-modal') ${present ? '!==' : '==='} null`, { timeoutMs, intervalMs: 100 });
    return present;
  } catch {
    return !present; // délai écoulé : l'état inverse de celui attendu est confirmé
  }
}

const log = (...a) => { const s = a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); };

async function activeElInfo(session) {
  return evaluate(session, `(() => {
    const e = document.activeElement;
    if (!e) return null;
    return { tag: e.tagName, cell: e.dataset ? e.dataset.cell : undefined, aria: e.getAttribute('aria-label'), text: (e.textContent || '').trim().slice(0,60) };
  })()`);
}

async function main() {
  const session = await openApp();
  const guard = consoleGuard(session);
  try {
    log('== Setup: scenario entrainement + fight ==');
    log(await evaluate(session, "window.__wfrp.scenario('entrainement')"));
    log(await evaluate(session, "window.__wfrp.ready()"));
    log(await evaluate(session, "window.__wfrp.fight('enc-entrainement')"));
    await sleep(500);
    await clickButtonByText(session, 'Commencer le combat', { exact: true }).catch((e) => log('clic Commencer le combat:', e.message));
    await sleep(400);
    log('count boutons cc-cell:', await evaluate(session, "document.querySelectorAll('button.cc-cell[data-cell]').length"));

    // ================= CONSTAT PRÉALABLE : Tab est capturé en combat =================
    log('\n== CONSTAT : Tab pour atteindre une case, en vrai clavier ==');
    await evaluate(session, "document.querySelectorAll('button.cc-cell[data-cell]')[0].focus()");
    const focused0 = await activeElInfo(session);
    log('Focus pose sur une case (via script, mesure isolee) :', focused0);
    await realKey(session, { key: 'Tab' });
    await sleep(80);
    const afterTab = await activeElInfo(session);
    log('Apres UNE frappe Tab REELLE (aucun clic, aucun evaluate d-action) -> activeElement:', afterTab, '(ATTENDU si Tab marchait : une AUTRE case ou un autre controle ; MESURE : le focus ne bouge pas du tout)');
    await realKey(session, { key: 'Tab', modifiers: 8 });
    await sleep(80);
    log('Apres Maj+Tab -> activeElement:', await activeElInfo(session));

    // ================= Scénario 1 : cycle CLAVIER, 3 passes =================
    log('\n== SCENARIO 1 : cycle clavier (Bas ouvre+focus dedans, Entree "Ouvrir la fiche", Echap ferme->focus case), 3 passes ==');
    log('NOTE : le focus initial sur la case est pose par script (workaround), Tab reel etant bloque (constat ci-dessus) -- le reste du geste (Bas/Entree/Echap) est joue au VRAI clavier.');
    for (let pass = 1; pass <= 3; pass++) {
      log(`-- passe ${pass} --`);
      await evaluate(session, "document.querySelectorAll('button.cc-cell[data-cell]')[0].focus()");
      const focused = await activeElInfo(session);
      log('Focus sur case:', focused);
      await realKey(session, { key: 'ArrowDown' });
      await sleep(400);
      const afterDown = await activeElInfo(session);
      const boiteVisible = await evaluate(session, "!!document.querySelector('.infobulle')");
      log('Apres fleche Bas -> activeElement:', afterDown, '| boite infobulle presente ?', boiteVisible);
      await realKey(session, { key: 'Enter' });
      const codexOpen = await attendreCodexModal(session, { present: true, timeoutMs: 3000 });
      const afterEnter = await activeElInfo(session);
      log('Apres Entree -> activeElement:', afterEnter, '| .codex-modal present ?', codexOpen);
      await sleep(300);
      await realKey(session, { key: 'Escape' });
      await sleep(300);
      const afterEscape = await activeElInfo(session);
      const codexOpenAfterEsc = await evaluate(session, "!!document.querySelector('.codex-modal')");
      log('Apres Echap -> activeElement:', afterEscape, '| .codex-modal encore present ?', codexOpenAfterEsc);
      await evaluate(session, "document.activeElement && document.activeElement.blur && document.activeElement.blur()");
    }

    // ================= Scénario 2 : cycle SOURIS, 3 passes =================
    log('\n== SCENARIO 2 : cycle souris (survol case, clic "Ouvrir la fiche", Echap -> focus case pas body), 3 passes ==');
    const firstCellSel = "button.cc-cell[data-cell]:not([disabled])";
    for (let pass = 1; pass <= 3; pass++) {
      log(`-- passe ${pass} --`);
      await survoler(session, firstCellSel, { attenteMs: 400 });
      const boiteVisible = await evaluate(session, "!!document.querySelector('.infobulle')");
      log('Apres survol -> boite infobulle presente ?', boiteVisible);
      const hasOuvrirBtn = await evaluate(session, "!!document.querySelector('.infobulle .codex-pop-open')");
      log('Bouton "Ouvrir la fiche" present dans la boite ?', hasOuvrirBtn);
      if (hasOuvrirBtn) {
        await clickButtonByText(session, 'Ouvrir la fiche', { exact: true, dans: '.infobulle' });
        const codexOpen = await attendreCodexModal(session, { present: true, timeoutMs: 3000 });
        log('Apres clic "Ouvrir la fiche" -> .codex-modal present ?', codexOpen);
        await sleep(300);
        await realKey(session, { key: 'Escape' });
        await sleep(300);
        const afterEscape = await activeElInfo(session);
        const codexOpenAfterEsc = await evaluate(session, "!!document.querySelector('.codex-modal')");
        log('Apres Echap -> activeElement:', afterEscape, '| .codex-modal encore present ?', codexOpenAfterEsc);
      } else {
        log('PAS de bouton "Ouvrir la fiche" -> case sans fiche catalogue, on note et on continue');
      }
      await survoler(session, 'body', { attenteMs: 50 });
    }
    log('Apres avoir deplace le pointeur hors zone (sans y revenir) : boite reapparue ?',
      await evaluate(session, "!!document.querySelector('.infobulle')"));

    // ================= Scénario 3 : Echap sur infobulle survolee =================
    log('\n== SCENARIO 3 : Echap sur infobulle ouverte au survol -> fermee, ne se rouvre pas tant que pointeur ne quitte/revient ==');
    await survoler(session, firstCellSel, { attenteMs: 400 });
    log('Boite ouverte au survol ?', await evaluate(session, "!!document.querySelector('.infobulle')"));
    await realKey(session, { key: 'Escape' });
    await sleep(300);
    log('Apres Echap (pointeur TOUJOURS sur la case) -> boite presente ?', await evaluate(session, "!!document.querySelector('.infobulle')"));
    await survoler(session, firstCellSel, { attenteMs: 400 });
    log('Re-survol SANS avoir quitte la case -> boite presente ? (attendu: non, congediee)', await evaluate(session, "!!document.querySelector('.infobulle')"));
    await survoler(session, 'body', { attenteMs: 200 });
    await sleep(200);
    await survoler(session, firstCellSel, { attenteMs: 400 });
    log('Apres avoir QUITTE puis QUITTE-revenu -> boite presente ? (attendu: oui, rouverte)', await evaluate(session, "!!document.querySelector('.infobulle')"));

    // ================= Scénario 4 : case REFUSEE =================
    log('\n== SCENARIO 4 : case refusee (aria-disabled) -> raison au survol ET au clavier (focus+Bas) ==');
    // Aucune case gatee sur le Tireur par defaut (mesure) : la Sorciere porte des sorts non-focalisables
    // (geste secondaire refuse) -- on lui donne le tour via __wfrp.turn (SETUP, pas le geste teste).
    log(await evaluate(session, "window.__wfrp.turn('pregen-707')"));
    await sleep(300);
    const gatedInfo = await evaluate(session, `(() => {
      const els = Array.from(document.querySelectorAll('button.cc-cell[data-gated]'));
      if (!els.length) return null;
      const e = els[0];
      e.setAttribute('data-recette-gated', '');
      return { cell: e.dataset.cell, ariaDisabled: e.getAttribute('aria-disabled'), disabledAttr: e.disabled };
    })()`);
    log('Case refusee trouvee (lecture DOM seule) :', gatedInfo);
    if (gatedInfo) {
      const gatedSel = '[data-recette-gated]';
      await survoler(session, gatedSel, { attenteMs: 400 });
      const refusTextHover = await evaluate(session, "(document.querySelector('.infobulle [data-refus]')||{}).textContent || null");
      log('Raison de refus au SURVOL :', refusTextHover);
      await survoler(session, 'body', { attenteMs: 100 });
      await sleep(150);
      // Tab reel etant bloque (constat ci-dessus), on pose le focus par script comme workaround assume.
      await evaluate(session, "document.querySelector('[data-recette-gated]').focus()");
      log('Focus (workaround) pose sur la case refusee :', await activeElInfo(session));
      await realKey(session, { key: 'ArrowDown' });
      await sleep(250);
      const refusTextKbd = await evaluate(session, "(document.querySelector('.infobulle [data-refus]')||{}).textContent || null");
      log('Raison de refus au CLAVIER (focus+Bas) :', refusTextKbd);
      await realKey(session, { key: 'Escape' });
    } else {
      log('AUCUNE case refusee (data-gated) trouvee dans cette console -> scenario 4 non joue ici');
    }

  } finally {
    log('\n== Erreurs / warnings console ==');
    log(guard.errors());
    await session.close();
  }
}

main().then(() => { console.log('\n---OK---'); }).catch((e) => { console.error('ECHEC SCRIPT:', e && e.stack || e); process.exitCode = 1; });
