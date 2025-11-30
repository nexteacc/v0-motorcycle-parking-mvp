import { createBrowserClient } from "@supabase/ssr"
import { envClient } from "@/lib/env-client"

export function createClient() {
  return createBrowserClient(envClient.NEXT_PUBLIC_SUPABASE_URL, envClient.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}
