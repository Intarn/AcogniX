-- 1. UC-20 (System Infrastructure & API Key Management)
CREATE TABLE IF NOT EXISTS "System_Settings" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key text UNIQUE NOT NULL,
    setting_value text NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now()
);

INSERT INTO "System_Settings" (setting_key, setting_value, description)
VALUES ('LLM_API_KEY', 'your-default-ai-key', 'API Key uses for AI Tutor and Generate')
ON CONFLICT (setting_key) DO NOTHING;


-- 2. UC-03 & UC-04 (Tracking Active Study Time)
CREATE TABLE IF NOT EXISTS "Study_Sessions" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id text NOT NULL, -- Lưu email hoặc ID của Learner
    start_time timestamp with time zone DEFAULT now(),
    last_ping timestamp with time zone DEFAULT now(),
    duration_minutes integer DEFAULT 0,
    status text DEFAULT 'ACTIVE' 
);


-- 3. LEARNING MODULE (AI Chat History)
CREATE TABLE IF NOT EXISTS "AI_Chat_History" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id text NOT NULL,
    project_id text, -- ID của AI Workspace Project (nếu có)
    message_from text NOT NULL, 
    message_text text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- 4. UC-11
CREATE TABLE IF NOT EXISTS "Assessment_Submissions" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    assessment_id text NOT NULL,
    course_id text NOT NULL,
    learner_id text NOT NULL,
    score integer DEFAULT 0,
    status text DEFAULT 'GRADED', -- 'SUBMITTED', 'PENDING_REVIEW', 'GRADED'
    submitted_at timestamp with time zone DEFAULT now()
);