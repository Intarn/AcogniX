const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Nạp .env theo đường dẫn TUYỆT ĐỐI tính từ vị trí file này,
// không phụ thuộc vào việc bạn chạy `node app.js` từ thư mục nào.
// backend/config/supabaseClient.js -> lên 2 cấp là gốc project (nơi chứa .env)
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Lack SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in file .env');
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
);

module.exports = supabase;