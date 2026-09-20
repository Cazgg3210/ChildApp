// Generates PWA icons from an inline SVG. Run: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const svg = (padding) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${padding ? 0 : 112}" fill="#2f6f6a"/>
  <g transform="translate(${padding ? 96 : 64} ${padding ? 96 : 64}) scale(${padding ? 0.625 : 0.75})">
    <path d="M256 448c-14 0-27-5-37-14L98 322C56 283 48 218 80 172c35-50 106-58 152-20l24 20 24-20c46-38 117-30 152 20 32 46 24 111-18 150L293 434c-10 9-23 14-37 14z" fill="#f9f8f5"/>
    <circle cx="256" cy="250" r="46" fill="#2f6f6a"/>
    <path d="M186 372c10-44 40-66 70-66s60 22 70 66" fill="none" stroke="#2f6f6a" stroke-width="28" stroke-linecap="round"/>
  </g>
</svg>`;

await mkdir("public/icons", { recursive: true });
await sharp(Buffer.from(svg(false))).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(Buffer.from(svg(false))).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(Buffer.from(svg(true))).resize(512, 512).png().toFile("public/icons/icon-512-maskable.png");
await sharp(Buffer.from(svg(false))).resize(180, 180).png().toFile("public/apple-touch-icon.png");
await sharp(Buffer.from(svg(false))).resize(32, 32).png().toFile("src/app/favicon.png");
console.log("icons generated");
