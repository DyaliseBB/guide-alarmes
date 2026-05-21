// ============================================================
// Guide Alarmes NxStage - PWA
// Stockage : localStorage (chaque appareil garde ses propres modifs)
// ============================================================

'use strict';

const STORAGE_KEY = 'guideAlarmes.data.v1';
const LANG_KEY = 'guideAlarmes.langue';

const state = {
  data: null,
  langue: localStorage.getItem(LANG_KEY) || 'FR',
  filtreType: 'Tous',
  filtreAppareil: 'Tous',
  recherche: '',
  alarmeActuelle: null,
  estNouvelle: false
};

// ============================================================ INIT
window.addEventListener('DOMContentLoaded', init);

async function init() {
  brancherEvenements();
  await chargerDonnees();
  appliquerLangue();
  rendreChipsAppareils();
  rendreListe();
  enregistrerServiceWorker();
}

async function chargerDonnees() {
  // priorité : localStorage (avec modifs utilisateur)
  const sauvegarde = localStorage.getItem(STORAGE_KEY);
  if (sauvegarde) {
    try { state.data = JSON.parse(sauvegarde); return; }
    catch (e) { console.warn('localStorage corrompu, rechargement bundle', e); }
  }
  await chargerBundle();
  sauvegarder();
}

async function chargerBundle() {
  try {
    const r = await fetch('alarmes.json', { cache: 'no-cache' });
    state.data = await r.json();
  } catch (e) {
    console.error('Impossible de charger alarmes.json', e);
    state.data = { alarmes: [], typesAlarmes: [], metadata: {} };
  }
}

function sauvegarder() {
  if (state.data) localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function enregistrerServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('service-worker.js').catch(e => console.warn('SW', e));
  }
}

// ============================================================ I18N
function T(fr, en) { return state.langue === 'EN' ? en : fr; }

function appliquerLangue() {
  document.documentElement.lang = state.langue.toLowerCase();
  document.querySelectorAll('[data-i18n-fr]').forEach(el => {
    el.textContent = T(el.dataset.i18nFr, el.dataset.i18nEn);
  });
  document.querySelectorAll('[data-i18n-ph-fr]').forEach(el => {
    el.placeholder = T(el.dataset.i18nPhFr, el.dataset.i18nPhEn);
  });
  document.getElementById('btnLangue').textContent = state.langue === 'FR' ? 'EN' : 'FR';
  localStorage.setItem(LANG_KEY, state.langue);
}

// ============================================================ FILTRES + LISTE
function rendreChipsAppareils() {
  const cont = document.getElementById('chipsAppareil');
  const appareils = state.data?.metadata?.appareils || [];
  // Garder le bouton "Tous" déjà présent dans HTML, ajouter les autres
  for (const a of appareils) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.dataset.app = a;
    b.textContent = a;
    b.addEventListener('click', () => {
      state.filtreAppareil = a;
      cont.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      rendreListe();
    });
    cont.appendChild(b);
  }
  cont.querySelector('[data-app="Tous"]').addEventListener('click', () => {
    state.filtreAppareil = 'Tous';
    cont.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
    cont.querySelector('[data-app="Tous"]').classList.add('active');
    rendreListe();
  });
}

function filtrer() {
  const alarmes = state.data?.alarmes || [];
  const s = state.recherche.trim().toLowerCase();
  return alarmes.filter(a => {
    if (state.filtreType !== 'Tous' && a.type !== state.filtreType) return false;
    if (state.filtreAppareil !== 'Tous' && a.appareil !== state.filtreAppareil) return false;
    if (!s) return true;
    const champs = [
      a.numero, a.appareil, a.titreFR, a.titreEN,
      state.langue === 'FR' ? a.actionFR : a.actionEN
    ].filter(Boolean).map(x => x.toString().toLowerCase());
    return champs.some(c => c.includes(s));
  });
}

function rendreListe() {
  const liste = filtrer();
  const cont = document.getElementById('liste');
  cont.innerHTML = '';

  if (liste.length === 0) {
    const v = document.createElement('div');
    v.className = 'liste-vide';
    v.textContent = T('Aucune alarme ne correspond.', 'No alarm matches.');
    cont.appendChild(v);
  } else {
    for (const a of liste) {
      cont.appendChild(carteAlarme(a));
    }
  }

  const total = state.data?.alarmes?.length || 0;
  document.getElementById('compteur').textContent = T(
    `${liste.length} / ${total} alarme(s)`,
    `${liste.length} / ${total} alarm(s)`
  );
}

function carteAlarme(a) {
  const c = document.createElement('div');
  c.className = 'carte-alarme type-' + a.type;
  c.addEventListener('click', () => ouvrirDetail(a));

  if (a.ajoutee) {
    const b = document.createElement('span');
    b.className = 'badge badge-added';
    b.textContent = T('AJOUTEE', 'ADDED');
    c.appendChild(b);
  } else if (a.modifie) {
    const b = document.createElement('span');
    b.className = 'badge badge-modified';
    b.textContent = T('MODIFIEE', 'EDITED');
    c.appendChild(b);
  }

  const num = document.createElement('div');
  num.className = 'carte-numero';
  num.textContent = a.numero || '';
  c.appendChild(num);

  const milieu = document.createElement('div');
  const titre = document.createElement('div');
  titre.className = 'carte-titre';
  titre.textContent = T(a.titreFR || a.titreEN || '', a.titreEN || a.titreFR || '');
  if (aDuDetail(a)) {
    const m = document.createElement('span');
    m.className = 'detail-marker';
    m.textContent = T('Détails', 'Details');
    titre.appendChild(document.createTextNode(' '));
    titre.appendChild(m);
  }
  milieu.appendChild(titre);
  const app = document.createElement('div');
  app.className = 'carte-appareil';
  app.textContent = (a.appareil || '') + (a.phase ? ' · ' + a.phase : '');
  milieu.appendChild(app);
  c.appendChild(milieu);

  const type = document.createElement('div');
  type.className = 'carte-type type-' + a.type;
  type.textContent = a.type || '';
  c.appendChild(type);

  return c;
}

function aDuDetail(a) {
  return (a.causes && a.causes.length > 0) ||
         (a.procedureFR && a.procedureFR.length > 0) ||
         (a.procedureEN && a.procedureEN.length > 0);
}

// ============================================================ DETAIL
function ouvrirDetail(a) {
  state.alarmeActuelle = a;
  document.getElementById('detailTitre').textContent = (a.numero || '') + ' · ' + T(a.titreFR || a.titreEN, a.titreEN || a.titreFR);
  document.getElementById('detailContenu').innerHTML = '';
  document.getElementById('detailContenu').appendChild(construireDetail(a));
  changerVue('vueDetail');
}

function construireDetail(a) {
  const frag = document.createDocumentFragment();
  const couleur = couleurType(a.type);

  // Entete colorée
  const ent = document.createElement('div');
  ent.className = 'detail-entete';
  ent.style.background = couleur.bg;
  ent.style.color = couleur.fg;
  const h = document.createElement('h2');
  h.textContent = 'N° ' + (a.numero || '');
  ent.appendChild(h);
  const tp = document.createElement('div');
  tp.className = 'titre-principal';
  tp.textContent = T(a.titreFR, a.titreEN) || '';
  ent.appendChild(tp);
  const ts = document.createElement('div');
  ts.className = 'titre-secondaire';
  ts.textContent = T(a.titreEN, a.titreFR) || '';
  ent.appendChild(ts);
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = (a.appareil ? T('Appareil : ', 'Device: ') + a.appareil : '')
                   + (a.phase ? '  ·  ' + T('Phase : ', 'Phase: ') + a.phase : '')
                   + '  ·  ' + (a.type || '');
  ent.appendChild(meta);
  frag.appendChild(ent);

  // Action
  const sectAct = document.createElement('div');
  sectAct.className = 'detail-section action';
  const hAct = document.createElement('h3');
  hAct.textContent = T('Action recommandée', 'Recommended action');
  sectAct.appendChild(hAct);
  const at = document.createElement('div');
  at.className = 'action-text';
  at.textContent = T(a.actionFR, a.actionEN) || '—';
  sectAct.appendChild(at);
  frag.appendChild(sectAct);

  // Causes
  if (a.causes && a.causes.length > 0) {
    const s = document.createElement('div');
    s.className = 'detail-section cause-action';
    const ttl = document.createElement('h3');
    ttl.textContent = T('Causes probables et actions', 'Probable causes and actions');
    s.appendChild(ttl);
    for (const c of a.causes) {
      const item = document.createElement('div');
      item.className = 'cause-item';
      const av = document.createElement('div');
      av.className = 'a-verifier';
      av.textContent = T(c.checkForFR, c.checkForEN) || '';
      item.appendChild(av);
      const ac = document.createElement('div');
      ac.className = 'action';
      ac.textContent = T(c.doFR, c.doEN) || '';
      item.appendChild(ac);
      s.appendChild(item);
    }
    frag.appendChild(s);
  }

  // Procédure
  const proc = state.langue === 'EN' ? a.procedureEN : a.procedureFR;
  if (proc && proc.length > 0) {
    const s = document.createElement('div');
    s.className = 'detail-section procedure';
    const ttl = document.createElement('h3');
    ttl.textContent = T('Procédure pas-à-pas', 'Step-by-step procedure');
    s.appendChild(ttl);
    const ol = document.createElement('ol');
    ol.className = 'procedure-list';
    for (const etape of proc) {
      const li = document.createElement('li');
      li.textContent = etape;
      ol.appendChild(li);
    }
    s.appendChild(ol);
    frag.appendChild(s);
  }

  // Rappel
  const rap = document.createElement('div');
  rap.className = 'detail-rappel';
  rap.textContent = T(
    'Rappel : ce guide ne remplace pas le User Guide officiel ni la formation NxSTEPS. En cas de doute, appeler immédiatement le support technique Fresenius Medical Care France.',
    'Reminder: this guide does not replace the official User Guide or NxSTEPS training. If in doubt, immediately call Fresenius Medical Care technical support.'
  );
  frag.appendChild(rap);

  return frag;
}

function couleurType(t) {
  const types = state.data?.typesAlarmes || [];
  const x = types.find(z => z.code === t);
  const bg = x?.couleurHex || '#9e9e9e';
  const fg = (t === 'Caution') ? '#5d4400' : '#ffffff';
  return { bg, fg };
}

// ============================================================ EDIT
function ouvrirEdit(a, estNouvelle) {
  state.alarmeActuelle = a;
  state.estNouvelle = estNouvelle;
  document.getElementById('editTitre').textContent = estNouvelle
    ? T('Nouvelle alarme', 'New alarm')
    : T('Modifier ' + (a.numero || ''), 'Edit ' + (a.numero || ''));
  document.getElementById('editNumero').value = a.numero || '';
  document.getElementById('editAppareil').value = a.appareil || 'Cycler';
  document.getElementById('editType').value = a.type || 'Caution';
  document.getElementById('editPhase').value = a.phase || '';
  document.getElementById('editTitreFR').value = a.titreFR || '';
  document.getElementById('editTitreEN').value = a.titreEN || '';
  document.getElementById('editActionFR').value = a.actionFR || '';
  document.getElementById('editActionEN').value = a.actionEN || '';
  rendreCauses(a.causes || []);
  rendreProcedure('editProcFR', a.procedureFR || []);
  rendreProcedure('editProcEN', a.procedureEN || []);
  document.getElementById('btnSupprimerEdit').style.display = estNouvelle ? 'none' : 'block';
  changerVue('vueEdit');
}

function rendreCauses(causes) {
  const c = document.getElementById('editCauses');
  c.innerHTML = '';
  causes.forEach((cause, i) => c.appendChild(carteEditCause(cause, i)));
}

function carteEditCause(cause, idx) {
  const d = document.createElement('div');
  d.className = 'cause-edit';
  const num = document.createElement('div');
  num.className = 'cause-num';
  num.textContent = T('Cause ', 'Cause ') + (idx + 1);
  d.appendChild(num);

  const btnDel = document.createElement('button');
  btnDel.className = 'btn-supprimer-cause';
  btnDel.innerHTML = '×';
  btnDel.title = T('Supprimer cette cause', 'Delete this cause');
  btnDel.addEventListener('click', () => { d.remove(); });
  d.appendChild(btnDel);

  const grille = document.createElement('div');
  grille.className = 'cause-grille';
  grille.appendChild(champCauseLabel('À vérifier (FR)', 'Check for (FR)', cause.checkForFR || '', 'cFR'));
  grille.appendChild(champCauseLabel('À vérifier (EN)', 'Check for (EN)', cause.checkForEN || '', 'cEN'));
  grille.appendChild(champCauseLabel('Action (FR)', 'Action (FR)', cause.doFR || '', 'dFR'));
  grille.appendChild(champCauseLabel('Action (EN)', 'Action (EN)', cause.doEN || '', 'dEN'));
  d.appendChild(grille);
  return d;
}

function champCauseLabel(lblFR, lblEN, val, classe) {
  const w = document.createElement('div');
  const l = document.createElement('label');
  l.textContent = T(lblFR, lblEN);
  const ta = document.createElement('textarea');
  ta.value = val;
  ta.dataset.cause = classe;
  ta.rows = 2;
  w.appendChild(l);
  w.appendChild(ta);
  return w;
}

function rendreProcedure(elId, etapes) {
  const ol = document.getElementById(elId);
  ol.innerHTML = '';
  etapes.forEach((e, i) => ol.appendChild(itemEtape(elId, e, i, etapes.length)));
}

function itemEtape(parentId, texte, idx, total) {
  const li = document.createElement('li');

  const span = document.createElement('span');
  span.className = 'etape-texte';
  span.textContent = texte;
  li.appendChild(span);

  const actions = document.createElement('div');
  actions.className = 'actions-etape';
  const btnUp = document.createElement('button');
  btnUp.className = 'btn-up';
  btnUp.title = T('Monter', 'Up');
  btnUp.addEventListener('click', () => deplacerEtape(parentId, idx, -1));
  if (idx === 0) btnUp.style.visibility = 'hidden';
  actions.appendChild(btnUp);

  const btnDown = document.createElement('button');
  btnDown.className = 'btn-down';
  btnDown.title = T('Descendre', 'Down');
  btnDown.addEventListener('click', () => deplacerEtape(parentId, idx, +1));
  if (idx === total - 1) btnDown.style.visibility = 'hidden';
  actions.appendChild(btnDown);

  const btnEdit = document.createElement('button');
  btnEdit.className = 'btn-edit';
  btnEdit.title = T('Modifier', 'Edit');
  btnEdit.addEventListener('click', async () => {
    const nv = await saisirTexte(T('Modifier l\'étape', 'Edit step'), texte);
    if (nv !== null) {
      const etapes = collecterEtapes(parentId);
      etapes[idx] = nv;
      rendreProcedure(parentId, etapes);
    }
  });
  actions.appendChild(btnEdit);

  const btnDel = document.createElement('button');
  btnDel.className = 'btn-del';
  btnDel.title = T('Supprimer', 'Delete');
  btnDel.addEventListener('click', () => {
    const etapes = collecterEtapes(parentId);
    etapes.splice(idx, 1);
    rendreProcedure(parentId, etapes);
  });
  actions.appendChild(btnDel);

  li.appendChild(actions);
  return li;
}

function collecterEtapes(parentId) {
  const ol = document.getElementById(parentId);
  return Array.from(ol.querySelectorAll('.etape-texte')).map(s => s.textContent);
}

function deplacerEtape(parentId, idx, dir) {
  const etapes = collecterEtapes(parentId);
  const cible = idx + dir;
  if (cible < 0 || cible >= etapes.length) return;
  [etapes[idx], etapes[cible]] = [etapes[cible], etapes[idx]];
  rendreProcedure(parentId, etapes);
}

function collecterCauses() {
  const cards = document.querySelectorAll('#editCauses .cause-edit');
  const causes = [];
  cards.forEach(card => {
    const cFR = card.querySelector('[data-cause="cFR"]').value.trim();
    const cEN = card.querySelector('[data-cause="cEN"]').value.trim();
    const dFR = card.querySelector('[data-cause="dFR"]').value.trim();
    const dEN = card.querySelector('[data-cause="dEN"]').value.trim();
    if (cFR || cEN || dFR || dEN) {
      causes.push({ checkForFR: cFR, checkForEN: cEN, doFR: dFR, doEN: dEN });
    }
  });
  return causes;
}

function enregistrerEdit() {
  const num = document.getElementById('editNumero').value.trim();
  if (!num) { alert(T('Le numéro est obligatoire.', 'Number is required.')); return; }
  const tFR = document.getElementById('editTitreFR').value.trim();
  const tEN = document.getElementById('editTitreEN').value.trim();
  if (!tFR && !tEN) { alert(T('Au moins un titre est obligatoire.', 'At least one title is required.')); return; }

  const causes = collecterCauses();
  const pFR = collecterEtapes('editProcFR').filter(s => s.trim());
  const pEN = collecterEtapes('editProcEN').filter(s => s.trim());

  const nouvelle = {
    numero: num,
    appareil: document.getElementById('editAppareil').value,
    type: document.getElementById('editType').value,
    phase: document.getElementById('editPhase').value.trim() || undefined,
    titreFR: tFR,
    titreEN: tEN,
    actionFR: document.getElementById('editActionFR').value.trim(),
    actionEN: document.getElementById('editActionEN').value.trim(),
    causes: causes.length ? causes : undefined,
    procedureFR: pFR.length ? pFR : undefined,
    procedureEN: pEN.length ? pEN : undefined,
    modifie: true,
    ajoutee: state.estNouvelle || (state.alarmeActuelle?.ajoutee === true)
  };

  if (state.estNouvelle) {
    state.data.alarmes.push(nouvelle);
  } else {
    const idx = state.data.alarmes.indexOf(state.alarmeActuelle);
    if (idx >= 0) state.data.alarmes[idx] = nouvelle;
  }
  sauvegarder();
  rendreListe();
  changerVue('vueListe');
}

function supprimerAlarmeActuelle() {
  if (!state.alarmeActuelle || state.estNouvelle) { changerVue('vueListe'); return; }
  const msg = T(
    'Supprimer l\'alarme ' + state.alarmeActuelle.numero + ' ?\n\nUtilisez "Réinitialiser données Fresenius" dans le menu pour restaurer.',
    'Delete alarm ' + state.alarmeActuelle.numero + '?\n\nUse "Reset to Fresenius data" in the menu to restore.'
  );
  if (!confirm(msg)) return;
  const idx = state.data.alarmes.indexOf(state.alarmeActuelle);
  if (idx >= 0) state.data.alarmes.splice(idx, 1);
  sauvegarder();
  rendreListe();
  changerVue('vueListe');
}

// ============================================================ VUES + MODAL TEXTE
function changerVue(id) {
  document.querySelectorAll('.vue').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function saisirTexte(titre, valeur) {
  return new Promise(resolve => {
    const modal = document.getElementById('modalTexte');
    document.getElementById('modalTexteTitre').textContent = titre;
    const ta = document.getElementById('modalTexteSaisie');
    ta.value = valeur || '';
    modal.hidden = false;
    setTimeout(() => ta.focus(), 50);

    const ok = document.getElementById('modalTexteOK');
    const cancel = document.getElementById('modalTexteAnnuler');
    const finir = (val) => {
      modal.hidden = true;
      ok.removeEventListener('click', okHandler);
      cancel.removeEventListener('click', cancelHandler);
      resolve(val);
    };
    const okHandler = () => finir(ta.value.trim());
    const cancelHandler = () => finir(null);
    ok.addEventListener('click', okHandler);
    cancel.addEventListener('click', cancelHandler);
  });
}

// ============================================================ EVENEMENTS GLOBAUX
function brancherEvenements() {
  document.getElementById('btnLangue').addEventListener('click', () => {
    state.langue = state.langue === 'FR' ? 'EN' : 'FR';
    appliquerLangue();
    rendreListe();
    if (state.alarmeActuelle && document.getElementById('vueDetail').classList.contains('active')) {
      ouvrirDetail(state.alarmeActuelle);
    }
  });

  document.getElementById('recherche').addEventListener('input', e => {
    state.recherche = e.target.value;
    rendreListe();
  });

  document.querySelectorAll('#chipsType .chip').forEach(b => {
    b.addEventListener('click', () => {
      state.filtreType = b.dataset.type;
      document.querySelectorAll('#chipsType .chip').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      rendreListe();
    });
  });

  document.getElementById('btnRetourDetail').addEventListener('click', () => changerVue('vueListe'));
  document.getElementById('btnModifierDetail').addEventListener('click', () => {
    if (state.alarmeActuelle) ouvrirEdit(state.alarmeActuelle, false);
  });

  document.getElementById('btnAnnulerEdit').addEventListener('click', () => {
    if (state.estNouvelle) changerVue('vueListe');
    else ouvrirDetail(state.alarmeActuelle);
  });
  document.getElementById('btnEnregistrerEdit').addEventListener('click', enregistrerEdit);
  document.getElementById('btnSupprimerEdit').addEventListener('click', supprimerAlarmeActuelle);

  document.getElementById('btnAjouterCause').addEventListener('click', () => {
    const causes = collecterCausesActuelles();
    causes.push({ checkForFR: '', checkForEN: '', doFR: '', doEN: '' });
    rendreCauses(causes);
  });

  document.getElementById('btnAjouterProcFR').addEventListener('click', async () => {
    const nv = await saisirTexte(T('Nouvelle étape (FR)', 'New step (FR)'), '');
    if (nv) {
      const etapes = collecterEtapes('editProcFR');
      etapes.push(nv);
      rendreProcedure('editProcFR', etapes);
    }
  });
  document.getElementById('btnAjouterProcEN').addEventListener('click', async () => {
    const nv = await saisirTexte(T('New step (EN)', 'New step (EN)'), '');
    if (nv) {
      const etapes = collecterEtapes('editProcEN');
      etapes.push(nv);
      rendreProcedure('editProcEN', etapes);
    }
  });

  document.getElementById('btnNouvelle').addEventListener('click', () => {
    ouvrirEdit({ type: 'Caution', appareil: 'Cycler' }, true);
  });

  document.getElementById('btnMenu').addEventListener('click', () => {
    document.getElementById('menu').hidden = false;
  });
  document.getElementById('menuFermer').addEventListener('click', () => {
    document.getElementById('menu').hidden = true;
  });
  document.getElementById('menuReset').addEventListener('click', async () => {
    if (!confirm(T(
      'Toutes vos modifications seront perdues. Restaurer les données Fresenius ?',
      'All your edits will be lost. Restore Fresenius data?'
    ))) return;
    localStorage.removeItem(STORAGE_KEY);
    await chargerBundle();
    sauvegarder();
    rendreListe();
    document.getElementById('menu').hidden = true;
    alert(T('Données restaurées.', 'Data restored.'));
  });
  document.getElementById('menuExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alarmes-export.json';
    a.click();
    URL.revokeObjectURL(url);
    document.getElementById('menu').hidden = true;
  });
  document.getElementById('menuImport').addEventListener('click', () => {
    document.getElementById('fileImport').click();
  });
  document.getElementById('fileImport').addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result);
        if (!d.alarmes || !Array.isArray(d.alarmes)) throw new Error('Format invalide');
        state.data = d;
        sauvegarder();
        rendreListe();
        document.getElementById('menu').hidden = true;
        alert(T('Import réussi.', 'Import successful.'));
      } catch (err) {
        alert(T('Erreur import : ', 'Import error: ') + err.message);
      }
    };
    r.readAsText(f);
    e.target.value = '';
  });
  document.getElementById('menuApropos').addEventListener('click', () => {
    alert(T(
      'Guide Alarmes NxStage - PWA\n\nDocument de courtoisie - usage personnel.\nSources : Fresenius TM0763 et TM0848 EMEA (2020).\n\nNE REMPLACE PAS le User Guide officiel.\nEn cas de doute, appeler Fresenius Medical Care France.',
      'NxStage Alarms Guide - PWA\n\nCourtesy document - personal use.\nSources: Fresenius TM0763 and TM0848 EMEA (2020).\n\nDOES NOT REPLACE the official User Guide.\nIf in doubt, call Fresenius Medical Care.'
    ));
    document.getElementById('menu').hidden = true;
  });
}

function collecterCausesActuelles() {
  return collecterCauses();
}
