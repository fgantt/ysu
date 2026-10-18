import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

// Keep SDK selection local to this command; never change the machine's Xcode settings.
const env = { ...process.env };
if (process.platform === 'darwin' && !env.SDKROOT) {
  const sdkResult = spawnSync('xcrun', ['--sdk', 'macosx', '--show-sdk-path'], { encoding: 'utf8' });
  const defaultSdk = sdkResult.status === 0 ? sdkResult.stdout.trim() : '';
  if (defaultSdk) {
    env.SDKROOT = defaultSdk;
    const directory = mkdtempSync(join(tmpdir(), 'shogi-sdk-'));
    const canLink = (sdk) => spawnSync('cc', [
      '-isysroot', sdk, '-x', 'c', '-', '-o', join(directory, 'probe'),
      '-framework', 'AppKit', '-framework', 'WebKit', '-framework', 'Carbon',
    ], { input: 'int main(void) { return 0; }\n', encoding: 'utf8' }).status === 0;
    try {
      if (!canLink(defaultSdk)) {
        const alternatives = readdirSync(dirname(defaultSdk))
          .filter(name => /^MacOSX\d+\.\d+\.sdk$/.test(name))
          .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
          .map(name => join(dirname(defaultSdk), name));
        const compatibleSdk = alternatives.find(canLink);
        if (!compatibleSdk) {
          console.error('No installed macOS SDK is compatible with the current linker. Update the Xcode Command Line Tools, or set SDKROOT to a compatible SDK.');
          process.exitCode = 1;
        } else {
          env.SDKROOT = compatibleSdk;
          console.log(`Using compatible macOS SDK: ${compatibleSdk}`);
        }
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
}

if (!process.exitCode) {
  const child = spawn(process.platform === 'win32' ? 'tauri.cmd' : 'tauri', process.argv.slice(2), {
    env, stdio: 'inherit', shell: process.platform === 'win32',
  });
  child.on('error', error => {
    console.error(`Unable to launch Tauri: ${error.message}`);
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}
