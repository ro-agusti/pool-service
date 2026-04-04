import type { SupabaseClient } from '@supabase/supabase-js'

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient
      user: { id: string; org_id: string; role: string; name: string; email: string } | null
    }
  }
}

export {}