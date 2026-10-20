import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const repositoryDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testsDirectory = path.join(repositoryDirectory, "tests");
const mockPath = path.join(testsDirectory, "obsidian-mock.ts");
const testFiles = (await readdir(testsDirectory))
  .filter(filename => filename.endsWith(".test.ts"))
  .map(filename => path.join(testsDirectory, filename));

if (testFiles.length === 0) {
  console.error("No tests/*.test.ts files were found.");
  process.exit(1);
}

const outputDirectory = await mkdtemp(path.join(os.tmpdir(), "keyword-decorator-tests-"));
const resolvedTemporaryRoot = path.resolve(os.tmpdir());
const resolvedOutputDirectory = path.resolve(outputDirectory);
const relativeOutputDirectory = path.relative(resolvedTemporaryRoot, resolvedOutputDirectory);
if (
  !relativeOutputDirectory.startsWith("keyword-decorator-tests-") ||
  relativeOutputDirectory.includes(path.sep) ||
  path.isAbsolute(relativeOutputDirectory)
) {
  throw new Error(`Refusing to clean test output outside the expected temporary directory: ${resolvedOutputDirectory}`);
}

try {
  await esbuild.build({
    entryPoints: testFiles,
    outdir: outputDirectory,
    outExtension: { ".js": ".cjs" },
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node18",
    plugins: [{
      name: "mock-obsidian-for-data-tests",
      setup(build) {
        build.onResolve({ filter: /^obsidian$/u }, () => ({ path: mockPath }));
      },
    }],
  });

  const bundledTests = (await readdir(outputDirectory))
    .filter(filename => filename.endsWith(".test.cjs"))
    .map(filename => path.join(outputDirectory, filename));
  const result = spawnSync(process.execPath, ["--test", ...bundledTests], {
    cwd: repositoryDirectory,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  process.exitCode = result.status ?? 1;
} finally {
  await rm(resolvedOutputDirectory, { recursive: true, force: true });
}
