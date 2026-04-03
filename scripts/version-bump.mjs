import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const packagePath = path.join(ROOT, "package.json");
const manifestPath = path.join(ROOT, "manifest.json");
const versionsPath = path.join(ROOT, "versions.json");

function bumpPatch(version) {
  const [major, minor, patch] = version.split(".").map(Number);
  if ([major, minor, patch].some(Number.isNaN)) {
    throw new Error(`Invalid semver version: ${version}`);
  }
  return `${major}.${minor}.${patch + 1}`;
}

async function readJson(filePath) {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function writeJson(filePath, content) {
  await writeFile(filePath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
}

async function main() {
  const pkg = await readJson(packagePath);
  const manifest = await readJson(manifestPath);
  const versions = await readJson(versionsPath);

  const targetVersion = process.argv[2] || bumpPatch(pkg.version);
  const minAppVersion = manifest.minAppVersion;

  pkg.version = targetVersion;
  manifest.version = targetVersion;
  versions[targetVersion] = minAppVersion;

  await writeJson(packagePath, pkg);
  await writeJson(manifestPath, manifest);
  await writeJson(versionsPath, versions);

  console.log(`Version updated to ${targetVersion}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
