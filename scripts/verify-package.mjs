import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { env, execPath } from "node:process";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const temporaryRoot = await mkdtemp(
  join(tmpdir(), "tcgplayer-private-api-package-"),
);
const npmCli = env.npm_execpath;
if (!npmCli) {
  throw new Error("npm_execpath is required; run this script through npm");
}
const resolvedTemporaryRoot = resolve(temporaryRoot);
const resolvedSystemTemp = resolve(tmpdir());
const childEnvironment = {
  ...env,
  npm_config_cache: join(temporaryRoot, "npm-cache"),
};
if (
  !resolvedTemporaryRoot.startsWith(`${resolvedSystemTemp}\\`) &&
  !resolvedTemporaryRoot.startsWith(`${resolvedSystemTemp}/`)
) {
  throw new Error("refusing to use a directory outside the system temp path");
}

try {
  const packOutput = execFileSync(
    execPath,
    [
      npmCli,
      "pack",
      "--json",
      "--ignore-scripts",
      "--pack-destination",
      temporaryRoot,
    ],
    { cwd: repositoryRoot, encoding: "utf8", env: childEnvironment },
  );
  const packResult = JSON.parse(packOutput);
  const filename = packResult[0]?.filename;
  if (typeof filename !== "string") {
    throw new Error("npm pack did not return an artifact filename");
  }

  const tarball = join(temporaryRoot, filename);
  const consumer = join(temporaryRoot, "consumer");
  await writeFile(
    join(temporaryRoot, "package-result.json"),
    JSON.stringify(packResult, null, 2),
  );
  execFileSync(
    execPath,
    [
      npmCli,
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--prefix",
      consumer,
      tarball,
    ],
    { cwd: temporaryRoot, stdio: "pipe", env: childEnvironment },
  );

  const esmConsumer = join(consumer, "consumer.mjs");
  const cjsConsumer = join(consumer, "consumer.cjs");
  await writeFile(
    esmConsumer,
    'import { createTcgplayerSellerClient, TcgplayerApiError } from "tcgplayer-private-api";\n' +
      'if (typeof createTcgplayerSellerClient !== "function") throw new Error("missing ESM client export");\n' +
      'if (typeof TcgplayerApiError !== "function") throw new Error("missing ESM error export");\n',
  );
  await writeFile(
    cjsConsumer,
    'const { createTcgplayerSellerClient, TcgplayerApiError } = require("tcgplayer-private-api");\n' +
      'if (typeof createTcgplayerSellerClient !== "function") throw new Error("missing CJS client export");\n' +
      'if (typeof TcgplayerApiError !== "function") throw new Error("missing CJS error export");\n',
  );

  execFileSync(execPath, [esmConsumer], {
    cwd: consumer,
    stdio: "pipe",
  });
  execFileSync(execPath, [cjsConsumer], {
    cwd: consumer,
    stdio: "pipe",
  });

  const packageResult = JSON.parse(
    await readFile(join(temporaryRoot, "package-result.json"), "utf8"),
  );
  const packedPaths = packageResult[0]?.files?.map((file) => file.path) ?? [];
  for (const required of [
    "dist/index.js",
    "dist/index.cjs",
    "dist/index.d.ts",
    "README.md",
  ]) {
    if (!packedPaths.includes(required)) {
      throw new Error(`packed artifact is missing ${required}`);
    }
  }
} finally {
  await rm(resolvedTemporaryRoot, { recursive: true, force: true });
}
