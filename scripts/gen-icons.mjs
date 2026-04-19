import fs from 'fs';

function makeSvg(size) {
  const rx = Math.round(size * 0.22);
  const fs2 = Math.round(size * 0.48);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="#6c63ff"/>
  <text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="${fs2}" font-weight="bold" fill="white">V</text>
</svg>`;
}

fs.mkdirSync('public/icons', { recursive: true });
fs.writeFileSync('public/icons/icon-192.svg', makeSvg(192));
fs.writeFileSync('public/icons/icon-512.svg', makeSvg(512));

// Create minimal PNG using raw bytes (1x1 purple pixel scaled)
// Use SVG as the icon source — browsers accept SVG in manifests too
// Copy SVG as PNG placeholder
fs.copyFileSync('public/icons/icon-192.svg', 'public/icons/icon-192.png');
fs.copyFileSync('public/icons/icon-512.svg', 'public/icons/icon-512.png');

console.log('Icons created');
