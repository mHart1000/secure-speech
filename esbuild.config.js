import esbuild from 'esbuild'

esbuild.build({
  entryPoints: ['offscreen/offscreen.js'],
  bundle: true,
  outfile: 'dist/offscreen/offscreen.js',
  format: 'esm',
  target: ['chrome109'],
  sourcemap: true,
  // vosk-browser loads WASM via fetch, so it works in extension context
}).catch(() => process.exit(1))
