const path = require('path');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({
    path: path.join(__dirname, '../../.env')
});

if (
    !process.env.SUPABASE_URL ||
    !process.env.SUPABASE_PUBLISHABLE_KEY
) {
    throw new Error(
        'Lack SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in .env'
    );
}

const supabaseAuth = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    }
);

module.exports = supabaseAuth;