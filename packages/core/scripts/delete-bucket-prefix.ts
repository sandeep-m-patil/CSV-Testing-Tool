/* eslint-disable no-console -- command-line script: printing progress is its interface. */
/**
 * Deletes every object under one prefix of the evidence bucket, e.g. the old
 * TicketGo `posters/` folder. Dry run by default: it only counts. Pass --apply
 * to delete. The platform's own evidence prefix (`modules/`) is refused.
 *
 *   pnpm --filter @repo/worker exec tsx ../../packages/core/scripts/delete-bucket-prefix.ts posters/
 *   pnpm --filter @repo/worker exec tsx ../../packages/core/scripts/delete-bucket-prefix.ts posters/ --apply
 *
 * Reads S3_* settings from the .env of the directory it runs in (apps/worker).
 */
import { readFileSync } from "node:fs";
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

const PROTECTED_PREFIXES = ["modules/", ""];
const BATCH = 1000;

const prefix = process.argv[2] ?? "";
const isApply = process.argv.includes("--apply");
if (PROTECTED_PREFIXES.includes(prefix) || !prefix.endsWith("/")) {
  console.error(`Refusing prefix "${prefix}". Give a folder such as posters/ (modules/ holds the platform's evidence).`);
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => [match[1]!, match[2]!.trim()]),
);
const bucket = env.S3_BUCKET!;
const client = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
});

const keys: string[] = [];
let token: string | undefined;
do {
  const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
  for (const object of page.Contents ?? []) keys.push(object.Key!);
  token = page.IsTruncated ? page.NextContinuationToken : undefined;
} while (token);

console.log(`${keys.length} object(s) under ${bucket}/${prefix}`);
if (!isApply) {
  console.log("Dry run only. Re-run with --apply to delete them.");
  process.exit(0);
}
for (let index = 0; index < keys.length; index += BATCH) {
  const batch = keys.slice(index, index + BATCH).map((Key) => ({ Key }));
  await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: batch, Quiet: true } }));
  console.log(`deleted ${Math.min(index + BATCH, keys.length)} / ${keys.length}`);
}
