'use strict';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const hashHue = str => { let h = 0; for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0; return Math.abs(h) % 360; };
const initials = str => String(str || '').split(' ').slice(0, 3).map(w => w[0] || '').join('').toUpperCase();
const uid = () => 'uid_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

function normTxt(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

function titleTokens(name) {
  return normTxt(name).replace(/[^a-z0-9ñ\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }