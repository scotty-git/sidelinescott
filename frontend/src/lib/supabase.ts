import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://geyfjyrgqykzdnvjetba.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdleWZqeXJncXlremRudmpldGJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4Nzk0MzIsImV4cCI6MjA2NzQ1NTQzMn0.7HX8ftFdYlLoCIAOW-sqNbuf3a1-2BdNn3XFmAeKSFU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})