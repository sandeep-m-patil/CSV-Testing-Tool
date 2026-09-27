import { hash, compare } from "bcryptjs";

export const BCRYPT_COST = 12;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  try {
    return await compare(password, hashed);
  } catch {
    return false;
  }
}