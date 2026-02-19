// This script generates microphone icons in various sizes. Requires the Sharp library.
// npm install sharp
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

// Simple microphone SVG icon
const micSvg = `
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <!-- Microphone capsule -->
  <rect x="48" y="20" width="32" height="48" rx="16" fill="#333" />

  <!-- Microphone stand -->
  <path d="M 64 68 L 64 90" stroke="#333" stroke-width="4" fill="none" />

  <!-- Microphone arc -->
  <path d="M 36 58 Q 36 80 64 80 Q 92 80 92 58"
        stroke="#333" stroke-width="4" fill="none"
        stroke-linecap="round" />

  <!-- Microphone base -->
  <line x1="48" y1="90" x2="80" y2="90" stroke="#333" stroke-width="4" stroke-linecap="round" />
</svg>
`.trim()

const sizes = [16, 48, 128]
const iconsDir = path.join(__dirname, '..', 'icons')

// Create icons directory if it doesn't exist
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true })
}

// Generate each size
Promise.all(
  sizes.map(size =>
    sharp(Buffer.from(micSvg))
      .resize(size, size)
      .png()
      .toFile(path.join(iconsDir, `mic-${size}.png`))
      .then(() => console.log(`✓ Generated mic-${size}.png`))
  )
)
  .then(() => console.log('\n All icons generated successfully!'))
  .catch(err => {
    console.error('Error generating icons:', err)
    process.exit(1)
  })
