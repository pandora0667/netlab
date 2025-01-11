import sharp from 'sharp';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = [16, 32, 180, 192, 512];
const svgPath = path.join(__dirname, '../client/public/favicon.svg');
const outputDir = path.join(__dirname, '../client/public');

async function generateFavicons() {
  try {
    const svgBuffer = await readFile(svgPath);
    
    // Generate PNGs
    for (const size of sizes) {
      const fileName = size === 180 ? 'apple-touch-icon.png' :
                      size === 192 ? 'android-chrome-192x192.png' :
                      size === 512 ? 'android-chrome-512x512.png' :
                      `favicon-${size}x${size}.png`;
      
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(path.join(outputDir, fileName));
      
      console.log(`Generated ${fileName}`);
    }
    
    // Generate ICO (combine 16x16 and 32x32)
    const ico16 = await sharp(svgBuffer)
      .resize(16, 16)
      .png()
      .toBuffer();
      
    const ico32 = await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toBuffer();
      
    await sharp(ico32)
      .toFile(path.join(outputDir, 'favicon.ico'));
    
    console.log('Generated favicon.ico');
    
  } catch (error) {
    console.error('Error generating favicons:', error);
  }
}

generateFavicons(); 