export const AUTO_FLOW_BLOCKED_PATTERNS = [
  "delete account",
  "permanently delete",
  "delete permanently",
  "cancel account",
  "cancel subscription",
  "refund",
  "issue refund",
  "transfer funds",
  "send money",
  "initiate transfer",
  "send payment",
  "process payment",
  "confirm payment",
  "make payment",
  "place order",
  "confirm order",
  "send email",
  "send message",
  "deploy to production",
  "production deployment",
  "create deployment",
  "publish production",
  "change password",
  "reset password",
  "send reset link",
  "revoke api key",
  "delete api key",
  "remove api key",
  "delete workspace",
  "delete organization",
  "delete user",
  "delete dataset",
  "drop database",
  "truncate table",
  "halt cluster",
  "terminate instance",
  "shut down",
  "power off",
  "delete instance",
  "delete snapshot",
] as const;

export const HIGH_RISK_PATTERNS = [
  "approve",
  "sign off",
  "finalize",
  "publish",
  "submit for review",
  "release",
  "authorize",
  "confirm",
] as const;

export interface ActionSafety {
  dangerous: boolean;
  blocked: boolean;
  reason?: string;
}

export function classifyAction(text: string): ActionSafety {
  const normalized = normalize(text);
  for (const pattern of AUTO_FLOW_BLOCKED_PATTERNS) {
    if (normalized.includes(normalize(pattern))) {
      return { dangerous: true, blocked: true, reason: `blocked-pattern:${pattern}` };
    }
  }
  for (const pattern of HIGH_RISK_PATTERNS) {
    if (normalized.includes(normalize(pattern))) {
      return { dangerous: true, blocked: false, reason: `high-risk:${pattern}` };
    }
  }
  return { dangerous: false, blocked: false };
}

export function isLogoutCommand(label: string): boolean {
  const normalized = normalize(label);
  return ["logout", "sign out", "signout", "log off"].some((command) => normalized === normalize(command));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}