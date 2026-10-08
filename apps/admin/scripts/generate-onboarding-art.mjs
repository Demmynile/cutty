/**
 * Regenerates the mobile app's first-launch onboarding wallpapers via the
 * Vercel AI Gateway (same key as the AI features). Cinematic open-world-game
 * cover-art aesthetic applied to a Lagos barbershop-and-salon world (barbering
 * plus women's braiding/wig services).
 *
 *   node apps/admin/scripts/generate-onboarding-art.mjs        # only generates missing files
 *   node apps/admin/scripts/generate-onboarding-art.mjs --force # regenerates every slide
 *
 * Output: apps/mobile/assets/onboarding/0N.jpg  (9:16 portrait, compressed with `sips`)
 */
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const envPath = new URL('../.env', import.meta.url)
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const { generateImage, generateText } = await import('ai')

const OUT_DIR = new URL('../../mobile/assets/onboarding/', import.meta.url)
fs.mkdirSync(OUT_DIR, { recursive: true })

const STYLE =
  'ONE single continuous full-frame photograph — not a collage, not split, no borders or panels. ' +
  'Cinematic promotional key art in the style of a modern open-world video game cover: ' +
  'sun-drenched synthwave sunset palette (deep teal, warm coral-orange, magenta accents), ' +
  'strong golden-hour rim light with gentle lens bloom and flare, anamorphic framing, ' +
  'fine 35mm film grain, shallow depth of field, hyper-real yet clean and slightly painterly, ' +
  'confident subject, rich lived-in environmental detail, contemporary Lagos Nigeria barbershop-and-salon culture. ' +
  'Vertical portrait composition with the subject in the upper-middle of the frame. ' +
  'Absolutely no text, letters, words, signage copy, logos or watermarks anywhere in the image.'

const SLIDES = [
  {
    file: '01.jpg',
    prompt:
      'A sharply dressed Black barber standing in the open doorway of his shop at golden hour, arms crossed, ' +
      'cordless clippers in one hand, a warm glow spilling from the lit interior behind him, a busy Lagos street ' +
      'softly reflected in the glass, sun flare behind his shoulder.',
  },
  {
    file: '02.jpg',
    prompt:
      'Tight cinematic portrait of a young man getting a crisp skin fade and hairline finished, a clipper blade ' +
      'just visible at the edge of frame, tiny flecks of hair catching the backlight, his eyes closed and calm, ' +
      'glossy teal-and-orange colour grade.',
  },
  {
    file: '03.jpg',
    prompt:
      'Interior of a stylish barbershop shot from waist height: vintage leather chairs, gold-framed mirrors, ' +
      'two friends waiting and laughing, hanging plants and framed records on the wall, warm tungsten light ' +
      'mixing with cool blue light from a big window, lived-in and aspirational.',
  },
  {
    file: '04.jpg',
    prompt:
      'Dramatic still-life hero shot of premium grooming products — a dropper bottle of beard oil, a tin of ' +
      'pomade and a wooden brush — arranged on a dark marble counter, hard low side light carving deep shadows, ' +
      'one bottle catching a bright coral rim light, a faint wisp of steam.',
  },
  {
    file: '05.jpg',
    prompt:
      'Night scene: a young woman and a young man leaning in together looking at a phone screen that shows a ' +
      'preview of a new hairstyle on the man, soft coral glow from the screen lighting their faces, blurred ' +
      'city lights and a warm barbershop glow behind them.',
  },
  {
    file: '06.jpg',
    prompt:
      'Tight cinematic portrait of a young Black woman having knotless box braids installed, a stylist\'s hands ' +
      'mid-parting a fresh section at the edge of frame, neat rows of long braids cascading over her shoulder, ' +
      'her eyes closed and calm, glossy teal-and-coral colour grade, tiny flyaway hairs catching the backlight.',
  },
  {
    file: '07.jpg',
    prompt:
      'A confident young Black woman seated indoors in a salon chair admiring a freshly installed sleek lace-front ' +
      'wig in a small round hand mirror, golden-hour light spilling across a styling station with a couple of ' +
      'blurry wig mannequin heads, edge brushes and a blow-dryer softly out of focus in the background, plain ' +
      'walls with no visible street, windows, shopfronts or signage of any kind, warm coral rim light on her cheekbone.',
  },
]

async function makeImage(prompt) {
  const full = `${prompt}\n\nStyle: ${STYLE}`
  try {
    // flux-2-pro ignores `aspectRatio` through the gateway but honours `size`.
    const r = await generateImage({ model: 'bfl/flux-2-pro', prompt: full, size: '896x1600' })
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

for (const slide of SLIDES) {
  const finalPathCheck = new URL(slide.file, OUT_DIR)
  if (!FORCE && fs.existsSync(finalPathCheck)) {
    console.log(`• ${slide.file} … skipped (already exists, pass --force to regenerate)`)
    continue
  }

  process.stdout.write(`• ${slide.file} … `)
  const bytes = await makeImage(slide.prompt)
  const tmp = new URL(`./_tmp-${slide.file}.png`, OUT_DIR)
  fs.writeFileSync(tmp, bytes)

  // Fallback images come back square — centre-crop them to 9:16.
  const { w, h } = dims(tmp.pathname)
  if (w / h > 0.6) {
    execFileSync('sips', ['-c', String(h), String(Math.round((h * 9) / 16)), tmp.pathname], { stdio: 'ignore' })
  }

  const finalPath = new URL(slide.file, OUT_DIR)
  execFileSync(
    'sips',
    ['-Z', '1600', '-s', 'format', 'jpeg', '-s', 'formatOptions', '82', tmp.pathname, '--out', finalPath.pathname],
    { stdio: 'ignore' },
  )
  fs.rmSync(tmp)
  const kb = Math.round(fs.statSync(finalPath).size / 1024)
  console.log(`${kb} KB`)
}

console.log('\nDone →', OUT_DIR.pathname)
