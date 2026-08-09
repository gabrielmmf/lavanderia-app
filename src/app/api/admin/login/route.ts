import { NextResponse } from "next/server"
import { signAdminToken, ADMIN_COOKIE_NAME } from "@/lib/auth"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    const validUsername = process.env.ADMIN_USERNAME || "admin"
    const validPassword = process.env.ADMIN_PASSWORD || "admin"

    if (username === validUsername && password === validPassword) {
      const token = await signAdminToken()
      
      const cookieStore = await cookies()
      cookieStore.set({
        name: ADMIN_COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24, // 24 hours
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 })
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
