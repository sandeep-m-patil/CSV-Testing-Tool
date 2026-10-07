import { mkdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { StepBlockedError } from "./step-errors";

/**
 * Files for UPLOAD steps. A step names a file (`report.pdf`); only its base
 * name is used, so a value can never reach outside the fixtures directory.
 * A missing fixture is generated as a small placeholder of that name, which is
 * enough for "upload is accepted / rejected by type" cases.
 */

const PLACEHOLDER_DIR = path.join(tmpdir(), "autotest-uploads");
const SAFE_NAME = /^[A-Za-z0-9._ -]{1,120}$/;

export async function resolveUploadFile(value: string, fixturesDir: string): Promise<string> {
  const name = path.basename(value.trim());
  if (!SAFE_NAME.test(name) || name.startsWith(".")) {
    throw new StepBlockedError(`Upload file name "${value}" is not allowed; use a plain file name such as sample.pdf`);
  }
  const fixture = path.resolve(fixturesDir, name);
  if (await exists(fixture)) return fixture;

  await mkdir(PLACEHOLDER_DIR, { recursive: true });
  const placeholder = path.join(PLACEHOLDER_DIR, name);
  if (!(await exists(placeholder))) await writeFile(placeholder, `autotest placeholder upload: ${name}\n`, "utf8");
  return placeholder;
}

async function exists(file: string): Promise<boolean> {
  return stat(file).then((info) => info.isFile()).catch(() => false);
}
