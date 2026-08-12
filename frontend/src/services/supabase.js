import { createClient } from '@supabase/supabase-js';

// Lấy biến môi trường từ file .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Thiếu biến môi trường Supabase! Hãy kiểm tra lại file .env");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);