import esbuild from 'esbuild';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entryPoint = path.join(__dirname, 'unit_tests.mjs');
const outfile = path.join(__dirname, 'temp_bundled_test.cjs');

async function run() {
  try {
    await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: outfile,
      resolveExtensions: ['.ts', '.js', '.mjs', '.json'],
      external: []
    });

    const child = spawn(process.execPath, [outfile], { stdio: 'inherit' });
    child.on('exit', (code) => {
      try {
        fs.unlinkSync(outfile);
      } catch (e) {}
      process.exit(code || 0);
    });
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

run();
