import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dkzqzxbpzulofmgcltbm.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrenF6eGJwenVsb2ZtZ2NsdGJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzMTk2MTEsImV4cCI6MjA2Nzg5NTYxMX0.B302UeYPTY2ykYzheBaEmKS4bqrwezcsxNmluIh9mM8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default supabase;
