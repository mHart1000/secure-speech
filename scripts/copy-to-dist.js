import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')

// Ensure dist directory exists
if (!fs.existsSync(dist)) {
  fs.mkdirSync(dist, { recursive: true })
}

// Helper to copy file
function copyFile(src, dest) {
  const destDir = path.dirname(dest)
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }
  fs.copyFileSync(src, dest)
  console.log(`Copied: ${path.relative(root, src)} → ${path.relative(root, dest)}`)
}

// Helper to copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`Skipped: ${path.relative(root, src)} (does not exist)`)
    return
  }
  
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true })
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      copyFile(srcPath, destPath)
    }
  }
}

console.log('📦 Copying files to dist/...\n')

// Copy root files
copyFile(path.join(root, 'manifest.json'), path.join(dist, 'manifest.json'))
copyFile(path.join(root, 'background.js'), path.join(dist, 'background.js'))
copyFile(path.join(root, 'content-script.js'), path.join(dist, 'content-script.js'))

// Copy offscreen HTML (JS is bundled by esbuild)
copyFile(path.join(root, 'offscreen/offscreen.html'), path.join(dist, 'offscreen/offscreen.html'))

// Copy worklet
copyDir(path.join(root, 'worklet'), path.join(dist, 'worklet'))

// Copy popup
copyDir(path.join(root, 'popup'), path.join(dist, 'popup'))

// Copy icons
copyDir(path.join(root, 'icons'), path.join(dist, 'icons'))

// Copy models (if exists)
copyDir(path.join(root, 'models'), path.join(dist, 'models'))

console.log('\n✅ Build complete! Extension files are in dist/')
