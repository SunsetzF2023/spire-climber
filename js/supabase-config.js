// ============================================================
// Supabase client configuration. These are PUBLIC client-side values
// (anon key is safe to expose — access is restricted server-side via
// Row Level Security policies defined in supabase/schema.sql).
// ============================================================

const SUPABASE_URL = 'https://gwsggzowjibnwbnllctz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3c2dnem93amlibndibmxsY3R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MDE2ODMsImV4cCI6MjEwMjA3NzY4M30.F5gsxD_CwyQ_txBzI6qb-RboTXioF5UaKJDCNRCVlH4';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
