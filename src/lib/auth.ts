import { SignJWT, jwtVerify } from "jose"

const getJwtSecret = () => {
  const secret = process.env.ADMIN_JWT_SECRET || process.env.CRON_SECRET || "default_development_secret_only"
  return new TextEncoder().encode(secret)
}

export const ADMIN_COOKIE_NAME = "lavanderia_admin_token"

export async function signAdminToken() {
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h") // 1 day
    .sign(getJwtSecret())

  return token
}

export async function verifyAdminToken(token: string) {
  try {
    const verified = await jwtVerify(token, getJwtSecret())
    return verified.payload?.role === "admin"
  } catch {
    return false
  }
}
