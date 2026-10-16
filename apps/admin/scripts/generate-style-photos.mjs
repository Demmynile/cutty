/**
 * Generates a reference "lookbook" photo for each Virtual Try-On style preset
 * (see TRY_ON_STYLES in packages/types/index.ts) via the Vercel AI Gateway.
 * These are the static thumbnails shown in the booking flow's style gallery —
 * distinct from the personalized try-on images, which edit the customer's own
 * photo at request time.
 *
 * Keep this list's ids/genders/prompts in sync with packages/types/index.ts by
 * hand (this is a plain .mjs script, so it can't import the TS source directly).
 *
 * Styles tagged 'male' or 'female' get one photo. Styles tagged 'unisex' show
 * in BOTH the Men and Women sections of the booking-flow gallery, so each gets
 * two photos (one per section) — otherwise a unisex style would show a photo
 * of the "wrong" gender in one of the two sections.
 *
 *   node apps/admin/scripts/generate-style-photos.mjs         # only generates missing files
 *   node apps/admin/scripts/generate-style-photos.mjs --force # regenerates every style photo
 *
 * Output: apps/mobile/assets/styles/<id>.jpg               (male/female styles)
 *         apps/mobile/assets/styles/<id>-men.jpg / -women.jpg (unisex styles)
 *         4:5 portrait, compressed with `sips`.
 */
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const envPath = new URL('../.env', import.meta.url)
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const { generateImage, generateText } = await import('ai')

const OUT_DIR = new URL('../../mobile/assets/styles/', import.meta.url)
fs.mkdirSync(OUT_DIR, { recursive: true })

const STYLE =
  'Clean editorial beauty/barbershop lookbook photograph. Softly lit against a seamless, warm neutral ' +
  'studio backdrop. Shot from the chest up, sharp focus on the hair with natural, flattering skin tones ' +
  'and realistic texture. Minimal, elegant styling, subtle catchlight in the eyes, calm confident ' +
  'expression looking just off-camera. Portrait orientation. No other people, no text, letters, logos or ' +
  'watermarks anywhere in the image.'

const MAN = 'a confident young Black man'
const WOMAN = 'a confident young Black woman'

// gender: 'male' | 'female' | 'unisex' — must match AITryOnStyle.gender in
// packages/types/index.ts for every id.
const STYLES = [
  { id: 'buzz', gender: 'male', prompt: 'a short, even buzz cut roughly a #2 clipper-guard length all over' },
  { id: 'crew', gender: 'male', prompt: 'a classic crew cut, short on the back and sides with a slightly longer, tapered top' },
  { id: 'taper-fade', gender: 'male', prompt: 'a modern taper fade with short faded sides and back blending into two to three inches of textured hair on top styled loosely forward' },
  { id: 'skin-fade', gender: 'male', prompt: 'a high skin fade shaved to the skin low on the sides, blending up into a short textured crop on top, with a clean line-up at the hairline' },
  { id: 'pompadour', gender: 'male', prompt: 'a pompadour with the top hair grown out and styled up and back off the forehead with height and volume, sides kept short and tapered' },
  { id: 'quiff', gender: 'male', prompt: 'a textured quiff, medium-length on top styled up and forward with a natural matte finish and faded sides' },
  { id: 'slick-back', gender: 'male', prompt: 'medium-length hair combed straight back with a glossy slicked finish and tapered sides' },
  { id: 'curly-top', gender: 'unisex', prompt: 'a curly top with two to three inches of defined natural curls on top and tapered short sides' },
  { id: 'afro', gender: 'unisex', prompt: 'a rounded, evenly shaped afro with natural volume and clean edges' },
  { id: 'waves', gender: 'male', prompt: 'short hair with a well-defined 360 wave pattern brushed in and radiating from the crown' },
  { id: 'locs', gender: 'unisex', prompt: 'neat, medium-length locs (dreadlocks) that fall to about the jaw, evenly sectioned' },
  { id: 'cornrows', gender: 'unisex', prompt: 'cornrows braided in even straight-back rows from the hairline to the nape' },
  { id: 'man-bun', gender: 'male', prompt: 'long top hair pulled back into a compact man bun at the crown with the sides and back shaved in an undercut' },
  { id: 'curtains', gender: 'unisex', prompt: 'a middle-parted curtain fringe, medium-length hair parted in the centre and sweeping down on both sides to frame the face' },
  { id: 'pixie', gender: 'female', prompt: 'a short pixie cut, cropped close at the back and sides with a slightly longer textured fringe' },
  { id: 'blunt-bob', gender: 'female', prompt: 'a sleek, blunt bob cut to chin length with a clean straight perimeter' },
  { id: 'shoulder-layers', gender: 'female', prompt: 'soft, layered hair falling to the shoulders with face-framing layers and natural movement' },
  { id: 'box-braids', gender: 'female', prompt: 'long, waist-length box braids, neatly parted in even square sections with a natural matte finish' },
  { id: 'knotless-braids', gender: 'female', prompt: 'medium-length knotless braids with a seamless, tension-free start at the root and a natural flowing finish' },
  { id: 'senegalese-twists', gender: 'female', prompt: 'shoulder-length Senegalese twists, smooth and rope-like with a glossy, uniform finish' },
  { id: 'faux-locs', gender: 'female', prompt: 'medium-length faux locs with a soft, textured wrap and a few loose curly ends for a bohemian finish' },
  { id: 'bantu-knots', gender: 'female', prompt: 'neat rows of sculpted Bantu knots coiled close to the scalp in an even grid pattern' },
  { id: 'lace-front-wig', gender: 'female', prompt: 'a sleek, bone-straight lace front wig with a natural-looking hairline and a deep side part' },
  { id: 'bob-wig', gender: 'female', prompt: 'a full bob-length wig install, blunt-cut at the chin with a glossy, uniform finish' },
  { id: 'curly-wig', gender: 'female', prompt: 'a voluminous curly wig install with bouncy, well-defined curls falling past the shoulders' },
  { id: 'silk-press', gender: 'female', prompt: 'a natural hair silk press: sleek, silky, bone-straight hair with a smooth shine and soft bounce at the ends' },
]

// Expand into concrete generation jobs: one file for male/female styles, two
// (men + women variants) for unisex styles.
const JOBS = STYLES.flatMap((s) => {
  if (s.gender === 'male') return [{ file: `${s.id}.jpg`, subject: MAN, prompt: s.prompt }]
  if (s.gender === 'female') return [{ file: `${s.id}.jpg`, subject: WOMAN, prompt: s.prompt }]
  return [
    { file: `${s.id}-men.jpg`, subject: MAN, prompt: s.prompt },
    { file: `${s.id}-women.jpg`, subject: WOMAN, prompt: s.prompt },
  ]
})

async function makeImage(prompt) {
  const full = `${prompt}\n\nStyle: ${STYLE}`
  try {
    const r = await generateImage({ model: 'bfl/flux-2-pro', prompt: full, size: '896x1120' })
    const img = r.images?.[0]
    if (img?.base64) return Buffer.from(img.base64, 'base64')
  } catch (e) {
    console.warn('  flux failed, falling back to nano banana:', String(e.message || e).slice(0, 120))
  }
  const r = await generateText({ model: 'google/gemini-2.5-flash-image', prompt: full })
  const f = r.files?.find((x) => x.mediaType?.startsWith('image/'))
  if (!f?.base64) throw new Error('no image returned')
  return Buffer.from(f.base64, 'base64')
}

function dims(p) {
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', p]).toString()
  return {
    w: Number(out.match(/pixelWidth: (\d+)/)[1]),
    h: Number(out.match(/pixelHeight: (\d+)/)[1]),
  }
}

const FORCE = process.argv.includes('--force')

for (const job of JOBS) {
  const { file } = job
  const finalPath = new URL(file, OUT_DIR)
  if (!FORCE && fs.existsSync(finalPath)) {
    console.log(`• ${file} … skipped (already exists, pass --force to regenerate)`)
    continue
  }

  process.stdout.write(`• ${file} … `)
  const prompt = `A close, editorial studio portrait of ${job.subject} with ${job.prompt}.`
  const bytes = await makeImage(prompt)
  const tmp = new URL(`./_tmp-${file}.png`, OUT_DIR)
  fs.writeFileSync(tmp, bytes)

  // Fallback images come back square — centre-crop them to 4:5.
  const { w, h } = dims(tmp.pathname)
  if (w / h > 0.85) {
    execFileSync('sips', ['-c', String(h), String(Math.round((h * 4) / 5)), tmp.pathname], { stdio: 'ignore' })
  }

  execFileSync(
    'sips',
    ['-Z', '1200', '-s', 'format', 'jpeg', '-s', 'formatOptions', '80', tmp.pathname, '--out', finalPath.pathname],
    { stdio: 'ignore' },
  )
  fs.rmSync(tmp)
  const kb = Math.round(fs.statSync(finalPath).size / 1024)
  console.log(`${kb} KB`)
}

console.log('\nDone →', OUT_DIR.pathname)
