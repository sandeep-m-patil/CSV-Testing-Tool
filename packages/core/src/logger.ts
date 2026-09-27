import pino from "pino";

const redactPaths = [
  "password",
  "*.password",
  "secretData",
  "*.secretData",
  "token",
  "*.token",
  "authorization",
  "*.authorization",
  "cookie",
  "*.cookie",
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: redactPaths,
    censor: "[REDACTED]",
  },
  base: {
    service: process.env.SERVICE_NAME ?? "autotest",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createChildLogger(bindings: Record<string, unknown>): pino.Logger {
  return logger.child(bindings);
}