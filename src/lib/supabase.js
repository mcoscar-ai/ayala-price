import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  'https://jaxelverwempabbqhufl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpheGVsdmVyd2VtcGFiYnFodWZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNDkxMjEsImV4cCI6MjEwMDkyNTEyMX0.Nu_RueyACNu5Vhs8MEQzhePafRelsv4zoeRkQir9DYw'
)
