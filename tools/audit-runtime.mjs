import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const notes = [];

function fail(message) { failures.push(message); }
function note(message) { notes.push(message); }
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(root, rel)); }

const forbiddenFiles = [
  'src/phaserCompat.ts',
  'src/devHarness.ts',
  'src/uiText.ts',
  'src/generated/greenhouse/chunk0.ts',
  'src/game/GameSceneCozy.ts',
];
for (const rel of forbiddenFiles) {
  if (exists(rel)) fail(`legacy runtime file returned: ${rel}`);
}

const requiredFiles = [
  'src/game/GameScene.ts',
  'src/game/DiscoveryTreeView.ts',
  'src/game/CrewTreeView.ts',
  'src/game/cozy/CozyWorld.ts',
  'src/game/cozy/CozyWorldV5.ts',
  'src/game/content.ts',
  'src/game/model.ts',
  'src/game/p4Meta.ts',
];
for (const rel of requiredFiles) {
  if (!exists(rel)) fail(`required runtime file missing: ${rel}`);
}

function walk(dir) {
  if (!exists(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name).replaceAll('\\', '/');
    if (entry.isDirectory()) out.push(...walk(rel));
    else out.push(rel);
  }
  return out;
}

const sourceFiles = walk('src').filter((file) => file.endsWith('.ts'));
const joined = sourceFiles.map((file) => `\n// ${file}\n${read(file)}`).join('\n');

const forbiddenPatterns = [
  ['@ts-ignore', /@ts-ignore/],
  ['unsafe as any', /\bas\s+any\b/],
  ['Phaser prototype monkey patch sendToBack', /sendToBack\s*\(/],
  ['legacy roundedRectangle factory patch', /roundedRectangle\s*\(/],
  ['legacy fillTrapezoid patch', /fillTrapezoid\s*\(/],
  ['raster gameplay JPG', /['"`]([^'"`]+)\.jpe?g['"`]/i],
  ['raster gameplay PNG', /['"`]([^'"`]+)\.png['"`]/i],
  ['raster gameplay WEBP', /['"`]([^'"`]+)\.webp['"`]/i],
];
for (const [label, pattern] of forbiddenPatterns) {
  if (pattern.test(joined)) fail(label);
}

const main = read('src/main.ts');
if (!main.includes("from './game/GameScene'")) fail('main.ts is not booting the audited GameScene');
if (main.includes('phaserCompat')) fail('main.ts re-imported phaserCompat');

const tree = read('src/game/DiscoveryTreeView.ts');
if (!tree.includes('popoverSafeBounds')) fail('discovery hover safe corridor missing');
if (!tree.includes('popoverBridge')) fail('discovery node-to-card bridge missing');
if (!tree.includes('activeNodeId')) fail('discovery active-card lock missing');
if (!tree.includes("scene.input.on('pointermove'")) fail('discovery pointer-coordinate lifecycle missing');
if (!tree.includes("scene.input.on('pointerdown'")) fail('discovery touch/click lifecycle missing');
if (/hit\.on\(['"]pointerout['"]/.test(tree)) fail('node pointerout race reintroduced');
if (!tree.includes("hit.on('pointerdown'")) fail('node tap-to-open support missing');
if (!tree.includes('clear(): void')) fail('discovery hidden-tree cleanup missing');
if (!tree.includes('onPurchase')) fail('discovery purchase callback missing');

const scene = read('src/game/GameScene.ts');
if (!scene.includes('Phaser.Scenes.Events.SHUTDOWN')) fail('scene shutdown cleanup missing');
if (!scene.includes("this.scale.off('resize'")) fail('resize listener cleanup missing');
if (!scene.includes('removeDevShortcuts')) fail('DEV keyboard cleanup missing');
if (!scene.includes('saveP4Meta(this.meta)')) fail('generation meta persistence missing');
if (!scene.includes('skipShutdownPersist')) fail('reset/shutdown persistence guard missing');
if (!scene.includes('this.discoveryTree.clear()')) fail('hidden discovery tree cleanup missing');
if (!scene.includes('if (offline > 0) saveState(this.state)')) fail('offline progress immediate persistence missing');
if (!scene.includes('CrewTreeView')) fail('crew progression UI missing');
if (!scene.includes('activeEventHits')) fail('multi-tap active event progression missing');
if (!scene.includes('completeActiveEvent')) fail('active event completion path missing');
if (!scene.includes('passiveBoostUntil')) fail('temporary event buff missing');
if (!/hits:\s*(?:[7-9]|10)/.test(scene)) fail('active events no longer require a meaningful tap sequence');
if (!scene.includes("reaction: 'gardener'")) fail('gardener active event missing');

const world = read('src/game/cozy/CozyWorld.ts');
if (!world.includes('killRootTweens')) fail('world rebuild tween cleanup missing');
if (!world.includes('CozyWorldV5')) fail('dense crew world layer is not active');

const worldV5 = read('src/game/cozy/CozyWorldV5.ts');
if (!worldV5.includes('drawDenseProps')) fail('dense greenhouse props missing');
if (!worldV5.includes('drawGardener')) fail('gardener actor missing');
if (!worldV5.includes('getCrewGardenerCount')) fail('multi-gardener progression missing');
if (!worldV5.includes("kind === 'gardener'")) fail('gardener world reaction missing');

const meta = read('src/game/p4Meta.ts');
if (!meta.includes('cachedMeta')) fail('meta cache missing');
if (!meta.includes('applyManualTap')) fail('pure tap meta update missing');
if (!meta.includes('CREW_UPGRADES')) fail('persistent crew upgrades missing');
if (!meta.includes('crewPoints')) fail('persistent crew currency missing');
if (!meta.includes('getCrewGardenerCount')) fail('crew gardener-count model missing');
const crewCount = [...meta.matchAll(/id:\s*'[^']+'\s*,\s*cost:/g)].length;
if (crewCount < 6) fail(`expected at least 6 crew upgrades, found ${crewCount}`);

const crewTree = read('src/game/CrewTreeView.ts');
if (!crewTree.includes('canBuyCrewUpgrade')) fail('crew affordability logic missing from UI');
if (!crewTree.includes('onPurchase')) fail('crew purchase callback missing');

const content = read('src/game/content.ts');
const nodeCount = [...content.matchAll(/\{\s*id:\s*'[^']+'/g)].length;
if (nodeCount !== 32) fail(`expected 32 discovery nodes, found ${nodeCount}`);
if (!/id:\s*'final_bloom'[\s\S]*?final:\s*true/.test(content)) fail('final_bloom is not marked final');

const packageJson = JSON.parse(read('package.json'));
if (!packageJson.dependencies?.phaser) fail('Phaser runtime dependency missing');

note(`audited ${sourceFiles.length} TypeScript source files`);
note(`discovery nodes: ${nodeCount}/32`);
note(`crew upgrades: ${crewCount}`);
note('hover card owns a node-to-card lock corridor');
note('multi-tap world events + gardener passive boost are present');
note('persistent crew progression + multiple gardeners are present');
note('scene/world/reset cleanup guards are present');

if (failures.length) {
  console.error('Runtime audit FAILED:');
  for (const message of failures) console.error(` - ${message}`);
  process.exit(1);
}

console.log('Runtime audit passed.');
for (const message of notes) console.log(` - ${message}`);
