/**
 * Pixel Art Asset Generator
 * Uses Google Imagen 3 via Gemini API to generate game assets.
 *
 * Usage:
 *   npx ts-node src/tools/generate-asset.ts "green slime monster" --name slime.png
 *   npx ts-node src/tools/generate-asset.ts "dungeon stone background" --name dungeon_bg.png --size 1536x1536
 *   npx ts-node src/tools/generate-asset.ts "skull boss enemy" --name boss.png --no-pixelart
 *
 * Options:
 *   --name <file>       Output filename (default: generated_<timestamp>.png)
 *   --size <WxH>        Image size (default: 1024x1024)
 *   --no-pixelart       Skip the pixel art style prefix
 *   --raw               Use the prompt as-is, no wrapper at all
 *   --count <n>         Number of images to generate (1-4, default: 1)
 *   --outdir <path>     Output directory (default: ../../extension/assets)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error('ERROR: GEMINI_API_KEY not found in backend/.env');
    process.exit(1);
}

const IMAGEN_MODEL = 'imagen-3.0-generate-002';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// ─── Pixel art prompt engineering ─────────────────────────────────

function wrapPrompt(raw: string, pixelArt: boolean): string {
    if (!pixelArt) return raw;
    return [
        '16-bit pixel art sprite, retro video game style,',
        'Terraria / SNES aesthetic, clean sharp pixels,',
        'limited color palette, transparent background,',
        raw,
    ].join(' ');
}

// ─── CLI argument parsing ─────────────────────────────────────────

interface CliArgs {
    prompt: string;
    name: string;
    width: number;
    height: number;
    pixelArt: boolean;
    raw: boolean;
    count: number;
    outdir: string;
}

function parseArgs(): CliArgs {
    const args = process.argv.slice(2);
    const opts: CliArgs = {
        prompt: '',
        name: '',
        width: 1024,
        height: 1024,
        pixelArt: true,
        raw: false,
        count: 1,
        outdir: path.resolve(__dirname, '../../..', 'extension/assets'),
    };

    const positional: string[] = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--name' && args[i + 1]) {
            opts.name = args[++i];
        } else if (arg === '--size' && args[i + 1]) {
            const [w, h] = args[++i].split('x').map(Number);
            if (w && h) { opts.width = w; opts.height = h; }
        } else if (arg === '--no-pixelart') {
            opts.pixelArt = false;
        } else if (arg === '--raw') {
            opts.raw = true;
            opts.pixelArt = false;
        } else if (arg === '--count' && args[i + 1]) {
            opts.count = Math.min(4, Math.max(1, parseInt(args[++i], 10) || 1));
        } else if (arg === '--outdir' && args[i + 1]) {
            opts.outdir = path.resolve(args[++i]);
        } else if (!arg.startsWith('--')) {
            positional.push(arg);
        }
    }

    opts.prompt = positional.join(' ').trim();
    if (!opts.prompt) {
        console.error('Usage: npx ts-node src/tools/generate-asset.ts "your prompt" [--name file.png] [--size 1024x1024]');
        console.error('');
        console.error('Examples:');
        console.error('  npx ts-node src/tools/generate-asset.ts "green slime enemy" --name slime.png');
        console.error('  npx ts-node src/tools/generate-asset.ts "medieval dungeon background" --name bg.png --size 1536x1536');
        console.error('  npx ts-node src/tools/generate-asset.ts "fire breathing dragon boss" --name dragon.png --count 4');
        process.exit(1);
    }

    if (!opts.name) {
        const slug = opts.prompt.replace(/[^a-z0-9]+/gi, '_').slice(0, 40).toLowerCase();
        opts.name = `${slug}_${Date.now()}.png`;
    }

    return opts;
}

// ─── Imagen API call ──────────────────────────────────────────────

interface ImagenResponse {
    predictions?: { bytesBase64Encoded: string; mimeType: string }[];
    error?: { message: string; code: number };
}

async function generateImage(prompt: string, count: number): Promise<Buffer[]> {
    const url = `${BASE_URL}/${IMAGEN_MODEL}:predict?key=${API_KEY}`;

    const body = {
        instances: [{ prompt }],
        parameters: {
            sampleCount: count,
            aspectRatio: '1:1',
            personGeneration: 'dont_allow',
        },
    };

    console.log(`\n  Model:  ${IMAGEN_MODEL}`);
    console.log(`  Prompt: "${prompt}"`);
    console.log(`  Count:  ${count}`);
    console.log('');

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Imagen API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as ImagenResponse;

    if (data.error) {
        throw new Error(`Imagen error: ${data.error.message}`);
    }

    if (!data.predictions || data.predictions.length === 0) {
        throw new Error('No images returned. The prompt may have been filtered.');
    }

    return data.predictions.map((p) => Buffer.from(p.bytesBase64Encoded, 'base64'));
}

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
    const opts = parseArgs();

    // Ensure output directory exists
    fs.mkdirSync(opts.outdir, { recursive: true });

    const finalPrompt = opts.raw ? opts.prompt : wrapPrompt(opts.prompt, opts.pixelArt);

    console.log('Generating asset...');

    const buffers = await generateImage(finalPrompt, opts.count);

    const saved: string[] = [];
    for (let i = 0; i < buffers.length; i++) {
        const ext = path.extname(opts.name) || '.png';
        const base = path.basename(opts.name, ext);
        const filename = buffers.length === 1 ? opts.name : `${base}_${i + 1}${ext}`;
        const outPath = path.join(opts.outdir, filename);

        fs.writeFileSync(outPath, buffers[i]);
        saved.push(outPath);
        console.log(`  Saved: ${outPath}`);
    }

    console.log(`\nDone! Generated ${saved.length} image(s).`);
}

main().catch((err) => {
    console.error('\nFailed to generate asset:', err.message || err);
    process.exit(1);
});
