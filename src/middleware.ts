import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "./lib/auth"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protect /admin and /api/admin routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    // Exclude login route
    if (pathname === "/admin/login" || pathname === "/api/admin/login") {
      return NextResponse.next()
    }

    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value

    if (!token) {
      if (pathname.startsWith("/api/admin")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      return NextResponse.redirect(new URL("/admin/login", request.url))
    }

    const isValid = await verifyAdminToken(token)

    if (!isValid) {
      if (pathname.startsWith("/api/admin")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      return NextResponse.redirect(new URL("/admin/login", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
}
