import esbuild from 'esbuild'

esbuild.build({
  entryPoints: ['offscreen/offscreen.js'],
  bundle: true,
  outfile: 'dist/offscreen/offscreen.js',
  format: 'esm',
  target: ['chrome109'],
  sourcemap: true,
}).catch(() => process.exit(1))
