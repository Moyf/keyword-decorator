import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, "dist");
const MANIFEST_PATH = path.join(ROOT, "manifest.json");
const STYLES_PATH = path.join(ROOT, "styles.css");
const MAIN_JS_PATH = path.join(DIST_DIR, "main.js");

async function readManifest() {
  const content = await readFile(MANIFEST_PATH, "utf8");
  return JSON.parse(content);
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyIfExists(src, dst) {
  if (await fileExists(src)) {
    await copyFile(src, dst);
    return true;
  }
  return false;
}

async function main() {
  if (!(await fileExists(MAIN_JS_PATH))) {
    throw new Error("dist/main.js does not exist. Run npm run build first.");
  }

  const manifest = await readManifest();
  const pluginDir = path.join("H:\\Docs\\Obsinote\\.obsidian\\plugins", manifest.id);

  await mkdir(pluginDir, { recursive: true });
  await copyFile(MAIN_JS_PATH, path.join(pluginDir, "main.js"));
  await copyFile(MANIFEST_PATH, path.join(pluginDir, "manifest.json"));
  await copyIfExists(STYLES_PATH, path.join(pluginDir, "styles.css"));
  await writeFile(path.join(pluginDir, ".hotreload"), "", { flag: "a" });

  console.log(`Copied plugin files to ${pluginDir}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
