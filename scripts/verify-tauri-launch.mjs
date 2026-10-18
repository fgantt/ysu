import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Simulate a machine with a newer SDK than its linker understands.
test('launcher selects a compatible SDK and respects an explicit SDKROOT', { skip: process.platform !== 'darwin' }, () => {
  const directory = mkdtempSync(join(tmpdir(), 'shogi-launch-test-'));
  try {
    const sdkRoot = join(directory, 'SDKs');
    mkdirSync(sdkRoot);
    for (const name of ['MacOSX27.0.sdk', 'MacOSX14.4.sdk']) mkdirSync(join(sdkRoot, name));
    const executable = (name, body) => writeFileSync(join(directory, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
    executable('xcrun', `echo '${join(sdkRoot, 'MacOSX27.0.sdk')}'`);
    executable('cc', 'case "$2" in *MacOSX27.0.sdk) exit 1;; *) exit 0;; esac');
    executable('tauri', 'echo "SDK=$SDKROOT ARGS=$*"');
    const env = { ...process.env, PATH: `${directory}:${process.env.PATH}` };
    delete env.SDKROOT;
    const fallback = spawnSync(process.execPath, [resolve('scripts/run-tauri.mjs'), 'dev'], { env, encoding: 'utf8' });
    assert.equal(fallback.status, 0, fallback.stderr);
    assert.ok(fallback.stdout.includes(`SDK=${join(sdkRoot, 'MacOSX14.4.sdk')} ARGS=dev`));
    const explicit = spawnSync(process.execPath, [resolve('scripts/run-tauri.mjs'), 'build'], { env: { ...env, SDKROOT: '/explicit/sdk' }, encoding: 'utf8' });
    assert.equal(explicit.status, 0, explicit.stderr);
    assert.ok(explicit.stdout.includes('SDK=/explicit/sdk ARGS=build'));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
