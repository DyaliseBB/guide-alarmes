// ============================================================
// Guide NxStage - PWA (Alarmes + Montage/Demontage)
// Stockage : localStorage (chaque appareil garde ses propres modifs)
// ============================================================

'use strict';

const STORAGE_KEY = 'guideAlarmes.data.v1';
const PROC_STORAGE_KEY = 'guideAlarmes.procedures.v1';
const PIN_KEY = 'guideAlarmes.pin';
const LANG_KEY = 'guideAlarmes.langue';

const state = {
  data: null,
  procedures: null,
  langue: localStorage.getItem(LANG_KEY) || 'FR',
  filtreType: 'Tous',
  filtreAppareil: 'Tous',
  recherche: '',
  alarmeActuelle: null,
  estNouvelle: false,
  procActuelleId: null,
  etapeIdx: 0,
  modeEdition: false
};

// ============================================================ INIT
window.addEventListener('DOMContentLoaded', init);

async function init() {
  brancherEvenements();
  await chargerDonnees();
  await chargerProcedures();
  appliquerLangue();
  rendreChipsAppareils();
  rendreListe();
  rafraichirStatutEdition();
  enregistrerServiceWorker();
}

async function chargerDonnees() {
  const sauvegarde = localStorage.getItem(STORAGE_KEY);
  if (sauvegarde) {
    try { state.data = JSON.parse(sauvegarde); return; }
    catch (e) { console.warn('localStorage alarmes corrompu', e); }
  }
  await chargerBundleAlarmes();
  sauvegarderAlarmes();
}

async function chargerBundleAlarmes() {
  try {
    const r = await fetch('alarmes.json', { cache: 'no-cache' });
    state.data = await r.json();
  } catch (e) {
    console.error('Impossible de charger alarmes.json', e);
    state.data = { alarmes: [], typesAlarmes: [], metadata: {} };
  }
}

async function chargerProcedures() {
  const sauvegarde = localStorage.getItem(PROC_STORAGE_KEY);
  if (sauvegarde) {
    try { state.procedures = JSON.parse(sauvegarde); return; }
    catch (e) { console.warn('localStorage procedures corrompu', e); }
  }
  await chargerBundleProcedures();
  sauvegarderProcedures();
}

async function chargerBundleProcedures() {
  try {
    const r = await fetch('procedures.json', { cache: 'no-cache' });
    state.procedures = await r.json();
  } catch (e) {
    console.error('Impossible de charger procedures.json', e);
    state.procedures = { procedures: { montage: { etapes: [] }, demontage: { etapes: [] } } };
  }
}

function sauvegarderAlarmes() {
  if (state.data) localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function sauvegarderProcedures() {
  if (state.procedures) localStorage.setItem(PROC_STORAGE_KEY, JSON.stringify(state.procedures));
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
  const txtBouton = state.langue === 'FR' ? 'EN' : 'FR';
  document.getElementById('btnLangue').textContent = txtBouton;
  document.getElementById('btnLangueAccueil').textContent = txtBouton;
  localStorage.setItem(LANG_KEY, state.langue);
}

// ============================================================ VUES + STATUT EDITION
function changerVue(id) {
  document.querySelectorAll('.vue').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function rafraichirStatutEdition() {
  const el = document.getElementById('accueilEditionStatus');
  if (state.modeEdition) {
    el.textContent = T('🔓 Mode edition actif', '🔓 Edit mode on');
    el.classList.add('actif');
  } else {
    el.textContent = T('🔒 Lecture seule', '🔒 Read only');
    el.classList.remove('actif');
  }
  document.getElementById('btnNouvelle').style.display = state.modeEdition ? '' : 'none';
  document.getElementById('btnModifierDetail').style.display = state.modeEdition ? '' : 'none';
  document.getElementById('btnEditerProc').hidden = !state.modeEdition;
  document.getElementById('btnEditerEtape').hidden = !state.modeEdition;
}

// ============================================================ PIN
function pinDefini() {
  return !!localStorage.getItem(PIN_KEY);
}

async function hash(txt) {
  const buf = new TextEncoder().encode(txt);
  const h = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function definirPin() {
  const p1 = await saisirPin(
    T('Definir votre PIN d\'edition', 'Set your edit PIN'),
    T('Choisissez un code a 4 chiffres. Il vous sera demande pour modifier les alarmes ou les procedures.', 'Choose a 4-digit code. It will be required to edit alarms or procedures.')
  );
  if (p1 === null) return false;
  if (!/^\d{4}$/.test(p1)) {
    alert(T('Le PIN doit etre 4 chiffres.', 'PIN must be 4 digits.'));
    return false;
  }
  const p2 = await saisirPin(
    T('Confirmer le PIN', 'Confirm PIN'),
    T('Retapez le meme code pour confirmer.', 'Retype the same code to confirm.')
  );
  if (p2 === null) return false;
  if (p1 !== p2) {
    alert(T('Les deux saisies ne correspondent pas.', 'The two entries do not match.'));
    return false;
  }
  localStorage.setItem(PIN_KEY, await hash(p1));
  return true;
}

async function verifierPin() {
  const p = await saisirPin(
    T('Code PIN', 'PIN code'),
    T('Saisir votre PIN a 4 chiffres pour acceder au mode edition.', 'Enter your 4-digit PIN to enable edit mode.')
  );
  if (p === null) return false;
  const h = await hash(p);
  if (h !== localStorage.getItem(PIN_KEY)) {
    alert(T('PIN incorrect.', 'Wrong PIN.'));
    return false;
  }
  return true;
}

async function basculerModeEdition() {
  if (state.modeEdition) {
    state.modeEdition = false;
    rafraichirStatutEdition();
    return;
  }
  if (!pinDefini()) {
    const ok = await definirPin();
    if (!ok) return;
  } else {
    const ok = await verifierPin();
    if (!ok) return;
  }
  state.modeEdition = true;
  rafraichirStatutEdition();
}

async function changerPin() {
  if (pinDefini()) {
    const ok = await verifierPin();
    if (!ok) return;
  }
  localStorage.removeItem(PIN_KEY);
  await definirPin();
}

function saisirPin(titre, sous) {
  return new Promise(resolve => {
    const modal = document.getElementById('modalPin');
    document.getElementById('modalPinTitre').textContent = titre;
    document.getElementById('modalPinSous').textContent = sous || '';
    const inp = document.getElementById('modalPinSaisie');
    inp.value = '';
    document.getElementById('modalPinErreur').hidden = true;
    modal.hidden = false;
    setTimeout(() => inp.focus(), 50);

    const ok = document.getElementById('modalPinOK');
    const cancel = document.getElementById('modalPinAnnuler');
    const onSubmit = () => finir(inp.value);
    const onCancel = () => finir(null);
    const onKey = e => { if (e.key === 'Enter') onSubmit(); };

    function finir(val) {
      modal.hidden = true;
      ok.removeEventListener('click', onSubmit);
      cancel.removeEventListener('click', onCancel);
      inp.removeEventListener('keydown', onKey);
      resolve(val);
    }
    ok.addEventListener('click', onSubmit);
    cancel.addEventListener('click', onCancel);
    inp.addEventListener('keydown', onKey);
  });
}

// ============================================================ FILTRES + LISTE ALARMES
function rendreChipsAppareils() {
  const cont = document.getElementById('chipsAppareil');
  const appareils = state.data?.metadata?.appareils || [];
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
    m.textContent = T('Detail', 'Details');
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

// ============================================================ DETAIL ALARME
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

  const sectAct = document.createElement('div');
  sectAct.className = 'detail-section action';
  const hAct = document.createElement('h3');
  hAct.textContent = T('Action recommandee', 'Recommended action');
  sectAct.appendChild(hAct);
  const at = document.createElement('div');
  at.className = 'action-text';
  at.textContent = T(a.actionFR, a.actionEN) || '—';
  sectAct.appendChild(at);
  frag.appendChild(sectAct);

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

  const proc = state.langue === 'EN' ? a.procedureEN : a.procedureFR;
  if (proc && proc.length > 0) {
    const s = document.createElement('div');
    s.className = 'detail-section procedure';
    const ttl = document.createElement('h3');
    ttl.textContent = T('Procedure pas-a-pas', 'Step-by-step procedure');
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

  const rap = document.createElement('div');
  rap.className = 'detail-rappel';
  rap.textContent = T(
    'Rappel : ce guide ne remplace pas le User Guide officiel ni la formation NxSTEPS. En cas de doute, appeler immediatement le support technique Fresenius Medical Care France.',
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

// ============================================================ EDIT ALARME
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
  grille.appendChild(champCauseLabel('A verifier (FR)', 'Check for (FR)', cause.checkForFR || '', 'cFR'));
  grille.appendChild(champCauseLabel('A verifier (EN)', 'Check for (EN)', cause.checkForEN || '', 'cEN'));
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
    const nv = await saisirTexte(T('Modifier l\'etape', 'Edit step'), texte);
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
  if (!num) { alert(T('Le numero est obligatoire.', 'Number is required.')); return; }
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
  sauvegarderAlarmes();
  rendreListe();
  changerVue('vueListe');
}

function supprimerAlarmeActuelle() {
  if (!state.alarmeActuelle || state.estNouvelle) { changerVue('vueListe'); return; }
  const msg = T(
    'Supprimer l\'alarme ' + state.alarmeActuelle.numero + ' ?\n\nUtilisez "Reinitialiser donnees Fresenius" dans le menu pour restaurer.',
    'Delete alarm ' + state.alarmeActuelle.numero + '?\n\nUse "Reset to Fresenius data" in the menu to restore.'
  );
  if (!confirm(msg)) return;
  const idx = state.data.alarmes.indexOf(state.alarmeActuelle);
  if (idx >= 0) state.data.alarmes.splice(idx, 1);
  sauvegarderAlarmes();
  rendreListe();
  changerVue('vueListe');
}

// ============================================================ PROCEDURES : INTRO
function ouvrirProcedure(procId) {
  state.procActuelleId = procId;
  state.etapeIdx = 0;
  const proc = state.procedures.procedures[procId];
  if (!proc) { changerVue('vueAccueil'); return; }

  const entete = document.getElementById('procIntroEntete');
  entete.style.background = proc.couleur || '#1976d2';
  document.getElementById('procIntroTitre').textContent = T(proc.titreFR, proc.titreEN);

  const cont = document.getElementById('procIntroContenu');
  cont.innerHTML = '';

  const sousTitre = document.createElement('div');
  sousTitre.className = 'proc-intro-sous';
  sousTitre.textContent = T(proc.sousTitreFR || '', proc.sousTitreEN || '');
  cont.appendChild(sousTitre);

  if (proc.introFR || proc.introEN) {
    const intro = document.createElement('div');
    intro.className = 'proc-intro-bloc';
    intro.textContent = T(proc.introFR || '', proc.introEN || '');
    cont.appendChild(intro);
  }

  const total = (proc.etapes || []).length;
  const infos = document.createElement('div');
  infos.className = 'proc-intro-infos';
  infos.textContent = T(`${total} etape(s)`, `${total} step(s)`);
  cont.appendChild(infos);

  const btn = document.createElement('button');
  btn.className = 'btn-grand-action';
  btn.style.background = proc.couleur || '#1976d2';
  btn.textContent = T('Commencer la procedure', 'Start the procedure');
  btn.addEventListener('click', () => ouvrirEtape(0));
  cont.appendChild(btn);

  const apercu = document.createElement('div');
  apercu.className = 'proc-apercu';
  const ttl = document.createElement('h3');
  ttl.textContent = T('Apercu des etapes', 'Steps overview');
  apercu.appendChild(ttl);
  (proc.etapes || []).forEach((e, i) => {
    const li = document.createElement('div');
    li.className = 'proc-apercu-item';
    li.addEventListener('click', () => ouvrirEtape(i));
    const num = document.createElement('span');
    num.className = 'proc-apercu-num';
    num.textContent = i + 1;
    li.appendChild(num);
    const tx = document.createElement('span');
    tx.className = 'proc-apercu-texte';
    tx.textContent = T(e.titreFR, e.titreEN);
    li.appendChild(tx);
    apercu.appendChild(li);
  });
  cont.appendChild(apercu);

  changerVue('vueProcIntro');
}

// ============================================================ PROCEDURES : ETAPE
function ouvrirEtape(idx) {
  const proc = state.procedures.procedures[state.procActuelleId];
  if (!proc) return;
  const etapes = proc.etapes || [];
  if (etapes.length === 0) { changerVue('vueProcIntro'); return; }
  if (idx < 0) idx = 0;
  if (idx >= etapes.length) {
    finProcedure();
    return;
  }
  state.etapeIdx = idx;
  const etape = etapes[idx];

  const entete = document.getElementById('etapeEntete');
  entete.style.background = proc.couleur || '#1976d2';
  document.getElementById('etapeProgres').textContent =
    T(`Etape ${idx + 1} / ${etapes.length}`, `Step ${idx + 1} / ${etapes.length}`);

  const cont = document.getElementById('etapeContenu');
  cont.innerHTML = '';

  const progress = document.createElement('div');
  progress.className = 'etape-progress';
  const bar = document.createElement('div');
  bar.className = 'etape-progress-bar';
  bar.style.width = ((idx + 1) / etapes.length * 100) + '%';
  bar.style.background = proc.couleur || '#1976d2';
  progress.appendChild(bar);
  cont.appendChild(progress);

  const titre = document.createElement('h2');
  titre.className = 'etape-titre';
  titre.textContent = T(etape.titreFR, etape.titreEN);
  cont.appendChild(titre);

  const suffixes = ['', '2', '3', '4', '5'];
  let aucunePhoto = true;
  suffixes.forEach(s => {
    const src = etape['photo' + s];
    if (!src) return;
    aucunePhoto = false;
    const fig = document.createElement('figure');
    fig.className = 'etape-photo';
    const img = document.createElement('img');
    img.src = src;
    const altFR = etape['photoAlt' + s + 'FR'] || '';
    const altEN = etape['photoAlt' + s + 'EN'] || '';
    img.alt = T(altFR, altEN);
    if (s === '') {
      img.onerror = () => { fig.classList.add('photo-erreur'); fig.innerHTML = '<div class="photo-placeholder">📷 ' + T('Photo introuvable', 'Photo not found') + '</div>'; };
    } else {
      img.onerror = () => fig.remove();
    }
    fig.appendChild(img);
    if (altFR || altEN) {
      const cap = document.createElement('figcaption');
      cap.textContent = T(altFR, altEN);
      fig.appendChild(cap);
    }
    cont.appendChild(fig);
  });
  if (aucunePhoto && (etape.photoMissingFR || etape.photoMissingEN)) {
    const ph = document.createElement('div');
    ph.className = 'photo-placeholder';
    ph.textContent = '📷 ' + T(etape.photoMissingFR || '', etape.photoMissingEN || '');
    cont.appendChild(ph);
  }

  const texte = document.createElement('div');
  texte.className = 'etape-texte-detail';
  const txt = T(etape.texteFR || '', etape.texteEN || '');
  // Render line breaks and bullet "- " prefixes
  txt.split('\n').forEach(ligne => {
    if (ligne.trim() === '') {
      texte.appendChild(document.createElement('br'));
      return;
    }
    const p = document.createElement('p');
    if (ligne.trim().startsWith('- ')) {
      p.className = 'etape-puce';
      p.textContent = ligne.trim().substring(2);
    } else {
      p.textContent = ligne;
    }
    texte.appendChild(p);
  });
  cont.appendChild(texte);

  // Boutons
  const btnPrec = document.getElementById('btnEtapePrec');
  const btnVal = document.getElementById('btnEtapeValider');
  btnPrec.disabled = idx === 0;
  if (idx === etapes.length - 1) {
    btnVal.querySelector('span:first-child').textContent = T('Terminer', 'Finish');
  } else {
    btnVal.querySelector('span:first-child').textContent = T('Valider', 'Validate');
  }
  btnVal.style.background = proc.couleur || '#1976d2';

  changerVue('vueEtape');
}

function finProcedure() {
  const proc = state.procedures.procedures[state.procActuelleId];
  alert(T(
    'Procedure "' + (proc?.titreFR || '') + '" terminee.',
    'Procedure "' + (proc?.titreEN || '') + '" completed.'
  ));
  changerVue('vueAccueil');
}

// ============================================================ EDITION ETAPE
let etapeEditPhotoData = '';

function ouvrirEditionEtape() {
  const proc = state.procedures.procedures[state.procActuelleId];
  if (!proc) return;
  const etape = proc.etapes[state.etapeIdx];
  if (!etape) return;

  document.getElementById('etapeEditTitreFR').value = etape.titreFR || '';
  document.getElementById('etapeEditTitreEN').value = etape.titreEN || '';
  document.getElementById('etapeEditTexteFR').value = etape.texteFR || '';
  document.getElementById('etapeEditTexteEN').value = etape.texteEN || '';
  etapeEditPhotoData = etape.photo || '';
  rendreApercuPhoto();
  changerVue('vueEtapeEdit');
}

function rendreApercuPhoto() {
  const cont = document.getElementById('etapeEditPhotoPreview');
  cont.innerHTML = '';
  if (etapeEditPhotoData) {
    const img = document.createElement('img');
    img.src = etapeEditPhotoData;
    img.alt = '';
    img.onerror = () => { cont.textContent = T('Photo introuvable : ', 'Photo not found: ') + etapeEditPhotoData; };
    cont.appendChild(img);
    const note = document.createElement('div');
    note.className = 'photo-source';
    note.textContent = etapeEditPhotoData.startsWith('data:') ? T('Photo personnalisee (stockee localement)', 'Custom photo (stored locally)') : etapeEditPhotoData;
    cont.appendChild(note);
  } else {
    cont.textContent = T('Aucune photo selectionnee', 'No photo selected');
  }
}

function enregistrerEditionEtape() {
  const proc = state.procedures.procedures[state.procActuelleId];
  if (!proc) return;
  const etape = proc.etapes[state.etapeIdx];
  if (!etape) return;
  etape.titreFR = document.getElementById('etapeEditTitreFR').value.trim();
  etape.titreEN = document.getElementById('etapeEditTitreEN').value.trim();
  etape.texteFR = document.getElementById('etapeEditTexteFR').value;
  etape.texteEN = document.getElementById('etapeEditTexteEN').value;
  etape.photo = etapeEditPhotoData;
  if (etape.photo) {
    delete etape.photoMissingFR;
    delete etape.photoMissingEN;
  }
  sauvegarderProcedures();
  ouvrirEtape(state.etapeIdx);
}

function supprimerEtapeActuelle() {
  const proc = state.procedures.procedures[state.procActuelleId];
  if (!proc) return;
  if (!confirm(T('Supprimer cette etape ?', 'Delete this step?'))) return;
  proc.etapes.splice(state.etapeIdx, 1);
  sauvegarderProcedures();
  if (proc.etapes.length === 0) {
    ouvrirProcedure(state.procActuelleId);
  } else {
    ouvrirEtape(Math.min(state.etapeIdx, proc.etapes.length - 1));
  }
}

// ============================================================ MODAL TEXTE
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
  // ACCUEIL
  document.getElementById('btnAccueilAlarmes').addEventListener('click', () => changerVue('vueListe'));
  document.getElementById('btnAccueilMontage').addEventListener('click', () => ouvrirProcedure('montage'));
  document.getElementById('btnAccueilDemontage').addEventListener('click', () => ouvrirProcedure('demontage'));
  document.getElementById('btnLangueAccueil').addEventListener('click', basculerLangue);
  document.getElementById('btnAccueilMenu').addEventListener('click', () => {
    document.getElementById('menu').hidden = false;
  });
  document.getElementById('accueilEditionStatus').addEventListener('click', basculerModeEdition);

  // LISTE ALARMES
  document.getElementById('btnRetourListe').addEventListener('click', () => changerVue('vueAccueil'));
  document.getElementById('btnLangue').addEventListener('click', basculerLangue);
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

  // DETAIL ALARME
  document.getElementById('btnRetourDetail').addEventListener('click', () => changerVue('vueListe'));
  document.getElementById('btnModifierDetail').addEventListener('click', async () => {
    if (!state.modeEdition) {
      alert(T('Activez d\'abord le mode edition (Reglages).', 'Enable edit mode first (Settings).'));
      return;
    }
    if (state.alarmeActuelle) ouvrirEdit(state.alarmeActuelle, false);
  });

  // EDIT ALARME
  document.getElementById('btnAnnulerEdit').addEventListener('click', () => {
    if (state.estNouvelle) changerVue('vueListe');
    else ouvrirDetail(state.alarmeActuelle);
  });
  document.getElementById('btnEnregistrerEdit').addEventListener('click', enregistrerEdit);
  document.getElementById('btnSupprimerEdit').addEventListener('click', supprimerAlarmeActuelle);

  document.getElementById('btnAjouterCause').addEventListener('click', () => {
    const causes = collecterCauses();
    causes.push({ checkForFR: '', checkForEN: '', doFR: '', doEN: '' });
    rendreCauses(causes);
  });

  document.getElementById('btnAjouterProcFR').addEventListener('click', async () => {
    const nv = await saisirTexte(T('Nouvelle etape (FR)', 'New step (FR)'), '');
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
    if (!state.modeEdition) { alert(T('Mode edition desactive.', 'Edit mode disabled.')); return; }
    ouvrirEdit({ type: 'Caution', appareil: 'Cycler' }, true);
  });

  // PROCEDURES - INTRO
  document.getElementById('btnRetourProcIntro').addEventListener('click', () => changerVue('vueAccueil'));
  document.getElementById('btnEditerProc').addEventListener('click', () => {
    alert(T(
      'Pour modifier les etapes, ouvrez une etape puis appuyez sur "Editer".',
      'To edit steps, open a step and press "Edit".'
    ));
  });

  // PROCEDURES - ETAPE
  document.getElementById('btnRetourEtape').addEventListener('click', () => ouvrirProcedure(state.procActuelleId));
  document.getElementById('btnEtapePrec').addEventListener('click', () => {
    if (state.etapeIdx > 0) ouvrirEtape(state.etapeIdx - 1);
  });
  document.getElementById('btnEtapeValider').addEventListener('click', () => {
    ouvrirEtape(state.etapeIdx + 1);
  });
  document.getElementById('btnEditerEtape').addEventListener('click', () => {
    if (!state.modeEdition) {
      alert(T('Activez d\'abord le mode edition (Reglages).', 'Enable edit mode first (Settings).'));
      return;
    }
    ouvrirEditionEtape();
  });

  // EDIT ETAPE
  document.getElementById('btnAnnulerEtapeEdit').addEventListener('click', () => ouvrirEtape(state.etapeIdx));
  document.getElementById('btnEnregistrerEtapeEdit').addEventListener('click', enregistrerEditionEtape);
  document.getElementById('btnSupprimerEtape').addEventListener('click', supprimerEtapeActuelle);
  document.getElementById('etapeEditPhotoFile').addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2_000_000) {
      if (!confirm(T(
        'Cette photo fait plus de 2 Mo. Elle sera stockee en base64 dans le navigateur, ce qui peut saturer le stockage. Continuer ?',
        'This photo is larger than 2 MB. It will be stored as base64 in the browser, which may fill up storage. Continue?'
      ))) { e.target.value = ''; return; }
    }
    const r = new FileReader();
    r.onload = ev => {
      etapeEditPhotoData = ev.target.result;
      rendreApercuPhoto();
    };
    r.readAsDataURL(f);
    e.target.value = '';
  });
  document.getElementById('btnEtapeRetirerPhoto').addEventListener('click', () => {
    etapeEditPhotoData = '';
    rendreApercuPhoto();
  });

  // MENU
  document.getElementById('btnMenu').addEventListener('click', () => {
    document.getElementById('menu').hidden = false;
  });
  document.getElementById('menuFermer').addEventListener('click', () => {
    document.getElementById('menu').hidden = true;
  });
  document.getElementById('menuVerrouillage').addEventListener('click', async () => {
    document.getElementById('menu').hidden = true;
    await basculerModeEdition();
  });
  document.getElementById('menuChangerPin').addEventListener('click', async () => {
    document.getElementById('menu').hidden = true;
    await changerPin();
  });
  document.getElementById('menuReset').addEventListener('click', async () => {
    document.getElementById('menu').hidden = true;
    if (!state.modeEdition) { alert(T('Mode edition desactive.', 'Edit mode disabled.')); return; }
    if (!confirm(T(
      'Toutes vos modifications d\'alarmes seront perdues. Restaurer les donnees Fresenius ?',
      'All your alarm edits will be lost. Restore Fresenius data?'
    ))) return;
    localStorage.removeItem(STORAGE_KEY);
    await chargerBundleAlarmes();
    sauvegarderAlarmes();
    rendreListe();
    alert(T('Donnees alarmes restaurees.', 'Alarm data restored.'));
  });
  document.getElementById('menuResetProc').addEventListener('click', async () => {
    document.getElementById('menu').hidden = true;
    if (!state.modeEdition) { alert(T('Mode edition desactive.', 'Edit mode disabled.')); return; }
    if (!confirm(T(
      'Toutes vos modifications de procedures seront perdues. Restaurer les procedures d\'origine ?',
      'All your procedure edits will be lost. Restore original procedures?'
    ))) return;
    localStorage.removeItem(PROC_STORAGE_KEY);
    await chargerBundleProcedures();
    sauvegarderProcedures();
    alert(T('Procedures restaurees.', 'Procedures restored.'));
  });
  document.getElementById('menuExport').addEventListener('click', () => {
    document.getElementById('menu').hidden = true;
    const bundle = {
      alarmes: state.data,
      procedures: state.procedures,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nxstage-export.json';
    a.click();
    URL.revokeObjectURL(url);
  });
  document.getElementById('menuImport').addEventListener('click', () => {
    document.getElementById('fileImport').click();
  });
  document.getElementById('fileImport').addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!state.modeEdition) { alert(T('Activez le mode edition pour importer.', 'Enable edit mode to import.')); e.target.value = ''; return; }
    const r = new FileReader();
    r.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result);
        // Format 1 : nouveau bundle (alarmes + procedures)
        if (d.alarmes && d.alarmes.alarmes) {
          state.data = d.alarmes;
          if (d.procedures) state.procedures = d.procedures;
          sauvegarderAlarmes();
          sauvegarderProcedures();
        }
        // Format 2 : ancien (juste alarmes)
        else if (d.alarmes && Array.isArray(d.alarmes)) {
          state.data = d;
          sauvegarderAlarmes();
        } else {
          throw new Error('Format non reconnu');
        }
        rendreListe();
        document.getElementById('menu').hidden = true;
        alert(T('Import reussi.', 'Import successful.'));
      } catch (err) {
        alert(T('Erreur import : ', 'Import error: ') + err.message);
      }
    };
    r.readAsText(f);
    e.target.value = '';
  });
  document.getElementById('menuApropos').addEventListener('click', () => {
    document.getElementById('menu').hidden = true;
    alert(T(
      'Guide NxStage - PWA\n\nDocument de courtoisie - usage personnel.\nSources : Fresenius TM0763, TM0848 EMEA (2020), Theradial DT-FOR-125 V7.\n\nNE REMPLACE PAS le User Guide officiel ni la formation NxSTEPS.\nEn cas de doute, appeler Fresenius Medical Care France.',
      'NxStage Guide - PWA\n\nCourtesy document - personal use.\nSources: Fresenius TM0763, TM0848 EMEA (2020), Theradial DT-FOR-125 V7.\n\nDOES NOT REPLACE the official User Guide or NxSTEPS training.\nIf in doubt, call Fresenius Medical Care.'
    ));
  });
}

function basculerLangue() {
  state.langue = state.langue === 'FR' ? 'EN' : 'FR';
  appliquerLangue();
  rendreListe();
  rafraichirStatutEdition();
  if (state.alarmeActuelle && document.getElementById('vueDetail').classList.contains('active')) {
    ouvrirDetail(state.alarmeActuelle);
  }
  if (document.getElementById('vueProcIntro').classList.contains('active')) {
    ouvrirProcedure(state.procActuelleId);
  } else if (document.getElementById('vueEtape').classList.contains('active')) {
    ouvrirEtape(state.etapeIdx);
  }
}
