const supabase = require('../config/supabaseClient');
const AppError = require('../error/AppError');
const EmailService = require('./EmailService');
const WorkspaceIntegrationService = require('./WorkspaceIntegrationService');
const { ResourceType } = require('../enums/CourseContentEnums');
const { EnrollmentStatus } = require('../enums/ClassroomEnums');

const BUCKET_MATERIALS = 'course_materials';
const BUCKET_ANNOUNCEMENTS = 'announcements';

class CourseContentService {
  // Basic Flow (UC-05): Educator uploads material (File or Link)
  static async addMaterial(educatorId, courseId, title, description, resourceType, file, linkUrl) {
    await this._verifyCourseOwnership(courseId, educatorId);

    let resourceUrl = linkUrl;
    let fileType = null;
    let sizeBytes = 0;

    if (resourceType === ResourceType.FILE && file) {
      // Upload file to Supabase Storage
      const fileExt = file.originalname.split('.').pop();
      const filePath = `${courseId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_MATERIALS)
        .upload(filePath, file.buffer, { contentType: file.mimetype });

      if (uploadError) throw new AppError(500, 'UPLOAD_FAILED', 'Failed to upload material file.');

      const { data: publicUrlData } = supabase.storage.from(BUCKET_MATERIALS).getPublicUrl(filePath);
      resourceUrl = publicUrlData.publicUrl;
      fileType = file.mimetype;
      sizeBytes = file.size;
    }

    const { data: material, error: dbError } = await supabase
      .from('CourseMaterial')
      .insert([{
        courseId, title, description, resourceType, resourceUrl, fileType, sizeBytes, available: true
      }])
      .select().single();

    if (dbError) throw new AppError(500, 'DB_ERROR', 'Failed to save course material.');

    // Auto-sync to Learners' AI Workspace (SAD Requirement)
    await WorkspaceIntegrationService.syncMaterialToClassProjects(courseId, material);
    
    try {
      // Get the base URL of the Frontend from environment variables
      const baseUrl = process.env.CLIENT_URL;
      
      // Generate a direct link to the Materials tab of this course
      const courseLink = `${baseUrl}/classroom/${courseId}/materials`;

      // Design the HTML email template with a Call-to-Action button
      const emailSubject = `New Material: ${title}`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #2c3e50;">Update from your classroom!</h2>
          <p>The educator has just posted a new material: <b>${title}</b>.</p>
          <p><i>${description ? description : ''}</i></p>
          
          <div style="margin: 30px 0;">
            <a href="${courseLink}" 
               style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
               Access Classroom Workspace
            </a>
          </div>
          
          <p style="font-size: 12px; color: #888;">
            If the button does not work, you can copy and paste the following link into your browser:<br>
            <a href="${courseLink}">${courseLink}</a>
          </p>
          <br/>
          <p>Best regards,<br/><b>AcogniX AI Tutor System</b></p>
        </div>
      `;

      // 4. Call the function to send bulk email to all enrolled learners
      await EmailService.notifyClass(courseId, emailSubject, emailHtml);
      
    } catch (emailErr) {
      console.warn("Material saved successfully but failed to send email notification:", emailErr);
      // Do not throw an error here to prevent rolling back the material upload due to a network email error
    }

    return material;


  }

  // Basic Flow (UC-05): Edit existing material
  static async updateMaterial(educatorId, materialId, updates, newFile) {
    const oldMaterial = await this._getMaterialAndVerifyOwnership(materialId, educatorId);
    let updateData = { ...updates, updatedAt: new Date() };

    if (updates.resourceType === ResourceType.FILE && newFile) {
      const fileExt = newFile.originalname.split('.').pop();
      const filePath = `${oldMaterial.courseId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_MATERIALS)
        .upload(filePath, newFile.buffer, { contentType: newFile.mimetype });
      
      if (uploadError) throw new AppError(500, 'UPLOAD_FAILED', 'Failed to upload new material file.');

      const { data: publicUrlData } = supabase.storage.from(BUCKET_MATERIALS).getPublicUrl(filePath);
      updateData.resourceUrl = publicUrlData.publicUrl;
      updateData.fileType = newFile.mimetype;
      updateData.sizeBytes = newFile.size;

      if (oldMaterial.resourceUrl && oldMaterial.resourceUrl.includes(BUCKET_MATERIALS)) {
         const oldFilePath = oldMaterial.resourceUrl.split(`${BUCKET_MATERIALS}/`)[1];
         if(oldFilePath) await supabase.storage.from(BUCKET_MATERIALS).remove([oldFilePath]);
      }
    } 
    else if (updates.resourceType === ResourceType.LINK) {
      updateData.resourceUrl = updates.linkUrl;
      updateData.fileType = null;
      updateData.sizeBytes = 0;
    }

    const { data, error } = await supabase
      .from('CourseMaterial')
      .update(updateData)
      .eq('materialId', materialId)
      .select().single();
      
    if (error) throw new AppError(500, 'UPDATE_FAILED', 'Failed to update material.');
    return data;
  }

  // Basic Flow & Alt Flow 2 (UC-05): Confirm before delete
  static async deleteMaterial(educatorId, materialId) {
    const material = await this._getMaterialAndVerifyOwnership(materialId, educatorId);

    if (material.resourceType === ResourceType.FILE && material.resourceUrl) {
      const filePath = material.resourceUrl.split(`${BUCKET_MATERIALS}/`)[1];
      if (filePath) {
         await supabase.storage.from(BUCKET_MATERIALS).remove([filePath]);
      }
    }
    
    // Alt Flow 2 (UC-05): Remove from all Learners' synchronized workspaces
    await WorkspaceIntegrationService.removeSynchronizedMaterial(material.courseId, materialId);

    const { error } = await supabase.from('CourseMaterial').delete().eq('materialId', materialId);
    if (error) throw new AppError(500, 'DELETE_FAILED', 'Failed to delete material.');
    
    return true;
  }

  // Basic Flow (UC-16): Learner views materials
  static async getMaterialsForLearner(learnerId, courseId) {
    await this._verifyLearnerEnrollment(courseId, learnerId);

    // Alt Flow 1 (UC-16): Empty Classroom -> returns [] automatically
    const { data, error } = await supabase
      .from('CourseMaterial')
      .select('*')
      .eq('courseId', courseId)
      .eq('available', true)
      .order('uploadedAt', { ascending: false });

    if (error) throw new AppError(500, 'DB_ERROR', 'Failed to fetch course materials.');
    return data;
  }

  // Basic Flow & Alternative Flows (UC-17)
  static async publishAnnouncement(educatorId, courseId, title, body, files) {
    await this._verifyCourseOwnership(courseId, educatorId);

    // Alt Flow 1 (UC-17): Missing Required Fields
    if (!title || !body || !title.trim() || !body.trim()) {
      throw new AppError(400, 'MISSING_FIELDS', 'Title and content cannot be empty. Please fill in the required fields.');
    }

    // Insert Announcement
    const { data: announcement, error: dbError } = await supabase
      .from('Announcement')
      .insert([{ courseId, title, body, publishedAt: new Date() }])
      .select().single();

    if (dbError) throw new AppError(500, 'DB_ERROR', 'Failed to save announcement.');

    // Process attachments if any
    let attachmentUrls = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const filePath = `${courseId}/${announcement.announcementId}/${Date.now()}_${file.originalname}`;
        const { error: uploadErr } = await supabase.storage.from(BUCKET_ANNOUNCEMENTS).upload(filePath, file.buffer);
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from(BUCKET_ANNOUNCEMENTS).getPublicUrl(filePath);
          attachmentUrls.push(urlData.publicUrl);
        }
      }
      
      // Update announcement with attachment URLs
      await supabase.from('Announcement')
        .update({ attachmentUrls })
        .eq('announcementId', announcement.announcementId);
      announcement.attachmentUrls = attachmentUrls;
    }

    // Alt Flow 3 (UC-17): Email Service Failure Handling
    let emailFailed = false;
    try {
      await EmailService.notifyClass(courseId, 'New Announcement', `<b>${title}</b><p>${body}</p>`);
    } catch (emailErr) {
      console.warn("Email service failed but announcement was saved:", emailErr);
      emailFailed = true; // Flag to trigger specific warning in Controller
    }

    return { announcement, emailFailed };
  }

  // Basic Flow (UC-16): View Announcements
  static async getAnnouncementsForLearner(learnerId, courseId) {
    await this._verifyLearnerEnrollment(courseId, learnerId);

    const { data, error } = await supabase
      .from('Announcement')
      .select('*')
      .eq('courseId', courseId)
      .order('publishedAt', { ascending: false });

    if (error) throw new AppError(500, 'DB_ERROR', 'Failed to fetch announcements.');
    return data;
  }

  // ===================================================================
  // HELPER METHODS
  // ===================================================================
  
  static async _verifyCourseOwnership(courseId, educatorId) {
    const { data, error } = await supabase.from('Course').select('educatorId').eq('courseId', courseId).single();
    if (error || !data) throw new AppError(404, 'NOT_FOUND', 'Course not found.');
    if (data.educatorId !== educatorId) throw new AppError(403, 'FORBIDDEN', 'You do not have permission to manage this course.');
  }

  static async _getMaterialAndVerifyOwnership(materialId, educatorId) {
    const { data: material, error } = await supabase.from('CourseMaterial').select('*').eq('materialId', materialId).single();
    if (error || !material) throw new AppError(404, 'NOT_FOUND', 'Material not found.');
    await this._verifyCourseOwnership(material.courseId, educatorId);
    return material;
  }

  static async _verifyLearnerEnrollment(courseId, learnerId) {
    const { data, error } = await supabase.from('Enrollment')
      .select('status')
      .eq('courseId', courseId)
      .eq('learnerId', learnerId)
      .eq('status', EnrollmentStatus.APPROVED)
      .single();
    
    if (error || !data) throw new AppError(403, 'FORBIDDEN', 'You must be an approved member to access this class content.');
  }
}

module.exports = CourseContentService;