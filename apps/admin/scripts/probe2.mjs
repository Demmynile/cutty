import fs from 'node:fs'
const envPath = new URL('../.env', import.meta.url)
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const { generateImage } = await import('ai')
const { execFileSync } = await import('node:child_process')

async function test(label, opts) {
  try {
    const r = await generateImage(opts)
    const b = Buffer.from(r.images[0].base64, 'base64')
    const p = `/tmp/pt-${label}.${(r.images[0].mediaType||'image/png').split('/')[1]}`
    fs.writeFileSync(p, b)
    const dims = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', p]).toString().match(/pixel\w+: \d+/g)
    console.log(label, '->', r.images[0].mediaType, dims, Math.round(b.length/1024)+'KB')
  } catch (e) { console.log(label, 'FAIL', String(e.message||e).slice(0,150)) }
}

await test('flux2_916', { model: 'bfl/flux-2-pro', prompt: 'a red apple on a table, photo', aspectRatio: '9:16' })
await test('flux2_size', { model: 'bfl/flux-2-pro', prompt: 'a red apple on a table, photo', size: '896x1600' })
await test('fluxpro11_916', { model: 'bfl/flux-pro-1.1', prompt: 'a red apple on a table, photo', aspectRatio: '9:16' })
await test('fluxkontext_916', { model: 'bfl/flux-kontext-pro', prompt: 'a red apple on a table, photo', aspectRatio: '9:16' })
