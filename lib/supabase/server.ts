import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { envServer } from "@/lib/env-server"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(envServer.NEXT_PUBLIC_SUPABASE_URL, envServer.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // The "setAll" method was called from a Server Component.
        }
      },
    },
  })
}
