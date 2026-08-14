-- ==============================================================================
-- 1. AUTOMATED FUNCTIONS & TRIGGERS
-- ==============================================================================

-- Function to automatically update the "updatedAt" column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW."updatedAt" = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to all tables that have an "updatedAt" column
CREATE TRIGGER update_course_material_modtime BEFORE UPDATE ON public."CourseMaterial" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ai_project_modtime BEFORE UPDATE ON public."AI_Project" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_personal_note_modtime BEFORE UPDATE ON public."PersonalNote" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_conversation_modtime BEFORE UPDATE ON public."Conversation" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to automatically create an AI Workspace when a new LEARNER signs up
CREATE OR REPLACE FUNCTION public.handle_new_learner_workspace()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create workspace if the new user is a LEARNER
  IF NEW.role = 'LEARNER' THEN
    INSERT INTO public."AI_Workspace" ("learnerId") VALUES (NEW."userId");
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the workspace creation function after a new User is inserted
CREATE TRIGGER on_learner_created
  AFTER INSERT ON public."User"
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_learner_workspace();


-- ==============================================================================
-- 2. PERFORMANCE INDEXES (Optimizing Foreign Key lookups)
-- ==============================================================================

-- Classroom Management Indexes
CREATE INDEX idx_enrollment_course ON public."Enrollment"("courseId");
CREATE INDEX idx_enrollment_learner ON public."Enrollment"("learnerId");
CREATE INDEX idx_coursematerial_course ON public."CourseMaterial"("courseId");
CREATE INDEX idx_announcement_course ON public."Announcement"("courseId");

-- AI Workspace Indexes
CREATE INDEX idx_aiproject_workspace ON public."AI_Project"("workspaceId");
CREATE INDEX idx_learningmaterial_project ON public."Learning_Material"("projectId");
CREATE INDEX idx_personalnote_project ON public."PersonalNote"("projectId");
CREATE INDEX idx_conversation_project ON public."Conversation"("projectId");
CREATE INDEX idx_chatmessage_conversation ON public."Chat_Message"("conversationId");

-- Assessment Indexes
CREATE INDEX idx_assessment_course ON public."Assessment"("courseId");
CREATE INDEX idx_question_assessment ON public."Question"("assessmentId");
CREATE INDEX idx_submission_assessment ON public."Submission"("assessmentId");
CREATE INDEX idx_submission_learner ON public."Submission"("learnerId");
CREATE INDEX idx_submissionanswer_submission ON public."SubmissionAnswer"("submissionId");


-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS) & BACKEND POLICIES
-- ==============================================================================
-- Enable RLS for the new tables to secure data
ALTER TABLE public."UserSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Enrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CourseMaterial" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Announcement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AI_Workspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AI_Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Learning_Material" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PersonalNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Assessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Submission" ENABLE ROW LEVEL SECURITY;

-- Create policies to allow the Node.js Backend (Service Role) to perform all operations
-- This bypasses RLS for the backend, as authorization is handled inside Node.js Middleware
CREATE POLICY "Allow all operations for backend" ON public."UserSession" FOR ALL USING (true);
CREATE POLICY "Allow all operations for backend" ON public."Enrollment" FOR ALL USING (true);
CREATE POLICY "Allow all operations for backend" ON public."CourseMaterial" FOR ALL USING (true);
CREATE POLICY "Allow all operations for backend" ON public."Announcement" FOR ALL USING (true);
CREATE POLICY "Allow all operations for backend" ON public."AI_Workspace" FOR ALL USING (true);
CREATE POLICY "Allow all operations for backend" ON public."AI_Project" FOR ALL USING (true);
CREATE POLICY "Allow all operations for backend" ON public."Learning_Material" FOR ALL USING (true);
CREATE POLICY "Allow all operations for backend" ON public."PersonalNote" FOR ALL USING (true);
CREATE POLICY "Allow all operations for backend" ON public."Assessment" FOR ALL USING (true);
CREATE POLICY "Allow all operations for backend" ON public."Submission" FOR ALL USING (true);