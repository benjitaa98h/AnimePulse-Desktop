import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function loadScript(rel, extra = {}) {
  const code = readFileSync(path.join(ROOT, rel), 'utf8');
  const sandbox = {
    console,
    // stubs de globals que no tocan DOM/red para las funciones puras
    toast: () => {},
    sleep: () => Promise.resolve(),
    fetch: () => Promise.resolve({ ok: false }),
    setTimeout,
    clearTimeout,
    AbortController,
    ...extra,
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: rel });
  return sandbox;
}

export function loadApi() {
  return loadScript('src/api.js');
}

export function loadScrobbler(extra = {}) {
  const utils = loadScript('src/utils.js');
  return loadScript('src/modules/scrobbler.js', {
    titleTokens: utils.titleTokens,
    normTxt: utils.normTxt,
    ...extra,
  });
}

export function loadUtils() {
  return loadScript('src/utils.js');
}