
function setupSettings() {
  applyAppearance();
  if (window.__settingsWired) { refreshSettingsValues(); return; }
  window.__settingsWired = true;
  document.querySelectorAll('input[data-setting]').forEach(cb => {
    cb.checked = !!state.settings[cb.dataset.setting];
    cb.addEventListener('change', () => { state.settings[cb.dataset.setting] = cb.checked; save(); if (cb.dataset.setting === 'syncOn') renderALStatus(); if (cb.dataset.setting === 'kitsuOn') renderKitsuStatus(); toast('Configuración actualizada', 'info'); });
  });
  document.querySelectorAll('[data-theme-pick]').forEach(b => {
    b.addEventListener('click', () => { state.settings.theme = b.getAttribute('data-theme-pick'); save(); applyAppearance(); toast('Tema: <b>' + (b.getAttribute('data-theme-pick') === 'oled' ? 'OLED Negro' : b.getAttribute('data-theme-pick') === 'light' ? 'Claro' : 'Oscuro') + '</b>', 'ok'); });
  });
  document.querySelectorAll('[data-accent-pick]').forEach(b => {
    b.addEventListener('click', () => { state.settings.accent = b.getAttribute('data-accent-pick'); save(); applyAppearance(); toast('Acento actualizado ✓', 'ok'); });
  });
  const cid = document.getElementById('alClientId');
  const tok = document.getElementById('alToken');
  cid.value = state.settings.alClientId || '';
  tok.value = state.settings.alToken || '';
  cid.addEventListener('input', () => { state.settings.alClientId = cid.value.trim(); save(); });
  tok.addEventListener('input', () => { state.settings.alToken = tok.value.trim(); save(); renderALStatus(); });
  document.getElementById('alAuthBtn').addEventListener('click', () => {
    const id = (state.settings.alClientId || '').trim();
    if (!id) { toast('Primero pega tu <b>Client ID</b> de anilist.co/settings/developer.', 'warn'); return; }
    openExternalUrl('https://anilist.co/api/v2/oauth/authorize?client_id=' + encodeURIComponent(id) + '&response_type=token');
    toast('Si no te pide iniciar sesión, usa el flujo de código y pega el <b>token</b> de la página en el campo de abajo.', 'info');
  });
  document.getElementById('alTestBtn').addEventListener('click', async () => {
    const t = (state.settings.alToken || '').trim();
    if (!t) { toast('Pega tu <b>access token</b> de AniList primero.', 'warn'); return; }
    document.getElementById('alTestBtn').disabled = true;
    document.getElementById('alTestBtn').textContent = 'Verificando…';
    const d = await anilistQuery(AL_VIEWER, null, t);
    document.getElementById('alTestBtn').disabled = false;
    document.getElementById('alTestBtn').innerHTML = 'Conectar';
    if (d && d.Viewer) {
      toast('<b>Conectado como ' + esc(d.Viewer.name) + '</b> en AniList ✓', 'ok');
      renderALStatus(d.Viewer);
    } else {
      toast('Token inválido o expirado. Revisa el flujo de <b>Autorizar</b> y vuelve a pegarlo.', 'err');
      renderALStatus();
    }
    renderSyncChip();
  });
  document.getElementById('alSyncAllBtn').addEventListener('click', alSilentSyncAll);
  document.querySelectorAll('input[data-setting="syncOn"]').forEach(cb => cb.addEventListener('change', renderSyncChip));
  renderALStatus();
  document.getElementById('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'animepulse-backup.json'; link.click();
    URL.revokeObjectURL(url);
    toast('Datos exportados como JSON ✓', 'ok');
  });
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const p = JSON.parse(reader.result);
        state = Object.assign(state, p);
        state.animeList = Array.isArray(p.animeList) ? p.animeList : state.animeList;
        save();
        renderDashboard(); recomputeStats(); renderScrobblerUI(); setupSettings();
        toast('Datos importados correctamente ✓', 'ok');
      } catch (err) { toast('El archivo JSON no es válido.', 'err'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem('animepulse.v2.backup');
    if (window.electronAPI && window.electronAPI.stateWipe) { try { window.electronAPI.stateWipe(); } catch (e) { /* noop */ } }
    state.animeList = [];
    state.activity = [0,0,0,0,0,0,0];
    state.settings = { detectPlayers: true, autoIncrement: true, notifications: true, theme: 'dark', accent: 'purple', autoAdd: true, syncOn: false, alClientId: '', alToken: '', dcEnabled: false, dcClientId: '', autoOrganize: false, kitsuOn: false, kitsuClientId: '', kitsuSecret: '', kitsuEmail: '', kitsuToken: '', kitsuUserId: null, asOn: false, asToken: '' };
    stopScrobble();
    renderDashboard(); recomputeStats(); renderFilterBar(); renderScrobblerUI(); setupSettings();
    toast('Lista borrada. Ahora empiezas desde cero, sin datos de demo ✓', 'ok');
  });
  document.getElementById('kitsuAuthBtn').addEventListener('click', kitsuLogin);
  document.getElementById('kitsuImportBtn').addEventListener('click', kitsuImport);
  document.getElementById('kitsuPushBtn').addEventListener('click', kitsuPushAll);
  const kc = document.getElementById('kitsuClientId');
  const ks = document.getElementById('kitsuSecret');
  const ke = document.getElementById('kitsuEmail');
  if (kc) { kc.value = state.settings.kitsuClientId || ''; kc.addEventListener('input', () => { state.settings.kitsuClientId = kc.value.trim(); save(); }); }
  if (ks) { ks.value = state.settings.kitsuSecret || ''; ks.addEventListener('input', () => { state.settings.kitsuSecret = ks.value.trim(); save(); }); }
  if (ke) { ke.value = state.settings.kitsuEmail || ''; ke.addEventListener('input', () => { state.settings.kitsuEmail = ke.value.trim(); save(); }); }
  const rdb = document.getElementById('restoreDiskBtn');
  if (rdb) rdb.addEventListener('click', () => restoreDisk(true));
  const asBtn = document.getElementById('asLoadBtn');
  if (asBtn) asBtn.addEventListener('click', asLoadSchedule);
  const at = document.getElementById('asToken');
  if (at) { at.value = state.settings.asToken || ''; at.addEventListener('input', () => { state.settings.asToken = at.value.trim(); save(); }); }
  const asCb = document.querySelector('[data-setting="asOn"]');
  if (asCb) asCb.addEventListener('change', () => {
    state.settings.asOn = asCb.checked;
    save();
    if (state.settings.asOn && asSchedCache) { renderAsStatus('ok'); renderCalendar(); }
    else { renderAsStatus(); }
  });
  refreshSettingsValues();
}
function refreshSettingsValues() {
  document.querySelectorAll('input[data-setting]').forEach(cb => { cb.checked = !!state.settings[cb.dataset.setting]; });
  const cid = document.getElementById('alClientId'), tok = document.getElementById('alToken');
  if (cid) cid.value = state.settings.alClientId || '';
  if (tok) tok.value = state.settings.alToken || '';
  const kc = document.getElementById('kitsuClientId'), ks = document.getElementById('kitsuSecret'), ke = document.getElementById('kitsuEmail');
  if (kc) kc.value = state.settings.kitsuClientId || '';
  if (ks) ks.value = state.settings.kitsuSecret || '';
  if (ke) ke.value = state.settings.kitsuEmail || '';
  const at = document.getElementById('asToken');
  if (at) at.value = state.settings.asToken || '';
  renderALStatus();
  renderKitsuStatus();
  renderAsStatus();
}
