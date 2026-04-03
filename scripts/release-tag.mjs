import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";

async function main() {
  const manifestPath = path.join(process.cwd(), "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const tag = manifest.version;

  execSync(`git tag ${tag}`, { stdio: "inherit" });
  execSync("git push origin --tags", { stdio: "inherit" });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
