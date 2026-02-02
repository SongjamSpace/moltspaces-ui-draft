/**
 * Generates favicons from the MoltSpaces logo at -15deg (same angle as the site).
 * Run: node scripts/make-favicon.mjs
 */
import sharp from "sharp";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const logoPath = join(root, "public", "images", "moltspaces-logo.png");
const sourcePath = join(root, "public", "images", "moltspaces-logo-source.png");
const inputPath = existsSync(logoPath) ? logoPath : sourcePath;

if (!existsSync(inputPath)) {
  console.error("Logo not found. Need public/images/moltspaces-logo.png or moltspaces-logo-source.png");
  process.exit(1);
}

const ROTATE_DEGREES = -15; // same as site: rotate-[-15deg]

async function main() {
  await sharp(inputPath)
    .rotate(ROTATE_DEGREES, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(32, 32)
    .png()
    .toFile(join(root, "public", "favicon-32x32.png"));
  console.log("Written: public/favicon-32x32.png");

  await sharp(inputPath)
    .rotate(ROTATE_DEGREES, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(16, 16)
    .png()
    .toFile(join(root, "public", "favicon-16x16.png"));
  console.log("Written: public/favicon-16x16.png");

  await sharp(inputPath)
    .rotate(ROTATE_DEGREES, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(180, 180)
    .png()
    .toFile(join(root, "public", "apple-touch-icon.png"));
  console.log("Written: public/apple-touch-icon.png");

  await sharp(inputPath)
    .rotate(ROTATE_DEGREES, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(192, 192)
    .png()
    .toFile(join(root, "public", "android-chrome-192x192.png"));
  console.log("Written: public/android-chrome-192x192.png");

  await sharp(inputPath)
    .rotate(ROTATE_DEGREES, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(512, 512)
    .png()
    .toFile(join(root, "public", "android-chrome-512x512.png"));
  console.log("Written: public/android-chrome-512x512.png");

  console.log("Done. Favicons use logo at -15deg like the site.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
