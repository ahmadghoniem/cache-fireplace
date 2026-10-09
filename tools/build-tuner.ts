// Bundles tools/tuner/main.ts (the mod's own scene code) into one file: tools/tuner.html.
// Run: bun tools/build-tuner.ts
const here = import.meta.dir
const built = await Bun.build({ entrypoints: [`${here}/tuner/main.ts`], target: 'browser', format: 'iife' })
if (!built.success) {
  for (const log of built.logs) console.error(log)
  process.exit(1)
}
// A string holding `</script` would close the tag: escape its slash
const js = (await built.outputs[0]!.text()).replaceAll('</script', '<' + String.fromCharCode(92) + '/script')
const page = await Bun.file(`${here}/tuner/index.html`).text()
// A function, so `$&` and the like in the script are not read as replacement patterns
await Bun.write(`${here}/tuner.html`, page.replace('<!-- SCRIPT -->', () => `<script>\n${js}</script>`))
console.log(`wrote ${here}/tuner.html`)
