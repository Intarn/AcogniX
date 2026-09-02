// backend/service/AnalyticsService.js
const crypto = require('crypto');
const supabase = require('../config/supabaseClient');
const AppError = require('../error/AppError');
const NotificationService = require('./NotificationService');

class AnalyticsService {
  // UC-03: Track Active Study Time
  // The client owns a stable sessionId and sends the latest meaningful
  // interaction boundary every 30 seconds. This lets a browser crash lose at
  // most one checkpoint while avoiding the old "30 seconds = 1 minute" bug.
  static async recordStudyCheckpoint(learnerId, payload = {}) {
    const {
      sessionId: requestedSessionId,
      projectId,
      startedAt,
      endedAt,
      finalize = false,
      reason = 'checkpoint'
    } = payload;

    if (!projectId) {
      throw new AppError(400, 'PROJECT_ID_REQUIRED', 'An active AI Project is required for study tracking.');
    }

    const sessionId = String(requestedSessionId || crypto.randomUUID()).trim();
    if (!sessionId) {
      throw new AppError(400, 'SESSION_ID_REQUIRED', 'Study session identifier is required.');
    }

    const start = new Date(startedAt);
    const end = new Date(endedAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      throw new AppError(400, 'INVALID_STUDY_INTERVAL', 'Invalid study-session time interval.');
    }

    // Never trust a courseId sent by the browser. Resolve the Project through
    // the Learner's own Workspace, then attribute only CLASS Projects to a
    // course. Personal Projects always remain private/personal statistics.
    const { data: workspace, error: workspaceError } = await supabase
      .from('AI_Workspace')
      .select('workspaceId')
      .eq('learnerId', learnerId)
      .maybeSingle();

    if (workspaceError) {
      console.error('[AnalyticsService] Workspace lookup error:', workspaceError);
      throw new AppError(500, 'DB_ERROR', 'Failed to validate the active AI Project.');
    }
    if (!workspace) {
      throw new AppError(404, 'WORKSPACE_NOT_FOUND', 'AI Workspace not found.');
    }

    const { data: project, error: projectError } = await supabase
      .from('AI_Project')
      .select('projectId, courseId, type, status')
      .eq('projectId', projectId)
      .eq('workspaceId', workspace.workspaceId)
      .maybeSingle();

    if (projectError) {
      console.error('[AnalyticsService] Project lookup error:', projectError);
      throw new AppError(500, 'DB_ERROR', 'Failed to validate the active AI Project.');
    }
    if (!project) {
      throw new AppError(403, 'PROJECT_ACCESS_DENIED', 'You do not have access to this AI Project.');
    }

    const courseId = String(project.type || '').toUpperCase() === 'CLASS'
      ? (project.courseId || null)
      : null;

    const { data: existingSession, error: existingError } = await supabase
      .from('Study_Session')
      .select('sessionId, learnerId, courseId, startTime, endTime, durationMinutes')
      .eq('sessionId', sessionId)
      .maybeSingle();

    if (existingError) {
      console.error('[AnalyticsService] Study session lookup error:', existingError);
      throw new AppError(500, 'DB_ERROR', 'Failed to load the study session.');
    }

    if (existingSession && String(existingSession.learnerId) !== String(learnerId)) {
      throw new AppError(409, 'STUDY_SESSION_CONFLICT', 'Study session identifier is already in use.');
    }

    const existingCourseId = existingSession?.courseId == null ? null : String(existingSession.courseId);
    const resolvedCourseId = courseId == null ? null : String(courseId);
    if (existingSession && existingCourseId !== resolvedCourseId) {
      throw new AppError(409, 'STUDY_SESSION_CONTEXT_MISMATCH', 'Study session Project context changed unexpectedly.');
    }

    const effectiveStart = existingSession?.startTime
      ? new Date(existingSession.startTime)
      : start;
    const previousEnd = existingSession?.endTime
      ? new Date(existingSession.endTime)
      : null;
    const effectiveEnd = previousEnd && previousEnd > end ? previousEnd : end;

    // durationMinutes is retained for backwards compatibility with the
    // existing schema. Statistics below use start/end timestamps so sub-minute
    // checkpoints remain recoverable and accurate.
    const durationMinutes = Math.max(
      0,
      Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / 60_000)
    );

    if (existingSession) {
      const { data: updated, error: updateError } = await supabase
        .from('Study_Session')
        .update({
          endTime: effectiveEnd.toISOString(),
          durationMinutes
        })
        .eq('sessionId', sessionId)
        .eq('learnerId', learnerId)
        .select()
        .single();

      if (updateError) {
        console.error('[AnalyticsService] Study session update error:', updateError);
        throw new AppError(500, 'DB_ERROR', 'Failed to persist the study session.');
      }

      return {
        status: finalize ? 'finalized' : 'checkpointed',
        sessionId,
        projectId: project.projectId,
        courseId: resolvedCourseId,
        durationMinutes: updated?.durationMinutes ?? durationMinutes,
        durationSeconds: Math.max(0, Math.floor((effectiveEnd - effectiveStart) / 1000)),
        finalized: Boolean(finalize),
        reason
      };
    }

    const newSessionPayload = {
      sessionId,
      learnerId,
      courseId: resolvedCourseId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationMinutes
    };

    const { data: created, error: insertError } = await supabase
      .from('Study_Session')
      .insert([newSessionPayload])
      .select()
      .single();

    if (insertError) {
      console.error('[AnalyticsService] Study session insert error:', insertError);
      throw new AppError(500, 'DB_ERROR', 'Failed to create the study session checkpoint.');
    }

    return {
      status: finalize ? 'finalized' : 'created',
      sessionId,
      projectId: project.projectId,
      courseId: resolvedCourseId,
      durationMinutes: created?.durationMinutes ?? durationMinutes,
      durationSeconds: Math.max(0, Math.floor((end - start) / 1000)),
      finalized: Boolean(finalize),
      reason
    };
  }

  // Backwards-compatible alias for any older controller/tests that still call
  // recordStudyPing directly.
  static async recordStudyPing(learnerId, payload = {}) {
    return this.recordStudyCheckpoint(learnerId, payload);
  }

  // Records a completed FLASHCARD DECK review. Individual card flips are not
  // counted by Personal Statistics. System_Settings is used as an idempotent
  // event store so the existing database schema does not need a migration.
  static async recordFlashcardReview(learnerId, payload = {}) {
    const projectId = String(payload.projectId || '').trim();
    const setId = String(payload.setId || '').trim();
    const flashcardId = String(payload.flashcardId || '').trim();
    const reviewSessionId = String(payload.reviewSessionId || '').trim();
    const completed = payload.completed === true;
    const reviewedAtDate = payload.reviewedAt ? new Date(payload.reviewedAt) : new Date();

    if (!projectId || !setId || !flashcardId || !reviewSessionId || !completed) {
      throw new AppError(400, 'FLASHCARD_REVIEW_DATA_REQUIRED', 'Flashcard review information is incomplete.');
    }
    if (Number.isNaN(reviewedAtDate.getTime())) {
      throw new AppError(400, 'INVALID_REVIEW_TIME', 'Flashcard review time is invalid.');
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from('AI_Workspace')
      .select('workspaceId')
      .eq('learnerId', learnerId)
      .maybeSingle();
    if (workspaceError) throw workspaceError;
    if (!workspace) throw new AppError(404, 'WORKSPACE_NOT_FOUND', 'AI Workspace not found.');

    const { data: project, error: projectError } = await supabase
      .from('AI_Project')
      .select('projectId')
      .eq('projectId', projectId)
      .eq('workspaceId', workspace.workspaceId)
      .maybeSingle();
    if (projectError) throw projectError;
    if (!project) throw new AppError(403, 'PROJECT_ACCESS_DENIED', 'You do not have access to this AI Project.');

    const { data: set, error: setError } = await supabase
      .from('Flashcard_Set')
      .select('flashcardSetId, projectId')
      .eq('flashcardSetId', setId)
      .eq('projectId', projectId)
      .maybeSingle();
    if (setError) throw setError;
    if (!set) throw new AppError(404, 'FLASHCARD_SET_NOT_FOUND', 'Flashcard set not found.');

    const { data: card, error: cardError } = await supabase
      .from('Flashcard')
      .select('flashcardId')
      .eq('flashcardId', flashcardId)
      .eq('flashcardSetId', setId)
      .maybeSingle();
    if (cardError) throw cardError;
    if (!card) throw new AppError(404, 'FLASHCARD_NOT_FOUND', 'Flashcard not found.');

    const event = {
      learnerId,
      projectId,
      setId,
      flashcardId,
      reviewSessionId,
      completed: true,
      reviewedAt: reviewedAtDate.toISOString()
    };
    // One completion event per learner + deck + review session.
    const settingKey = `FLASHCARD_REVIEW:${learnerId}:${reviewSessionId}:${setId}`;
    const { error: saveError } = await supabase
      .from('System_Settings')
      .upsert([{ setting_key: settingKey, setting_value: JSON.stringify(event) }], { onConflict: 'setting_key' });

    if (saveError) throw saveError;
    return event;
  }

  // UC-04: View Personal Statistics
  static async getPersonalStats(learnerId, timeRange = 'Last 7 days', startDate = null, endDate = null) {
    try {
      const now = new Date();
      const range = this._resolvePersonalStatsRange(timeRange, now, startDate, endDate);

      const [sessionsRes, enrollmentsRes, submissionsRes, workspaceRes, practiceAttemptsRes, flashcardReviewsRes] = await Promise.all([
        supabase.from('Study_Session').select('durationMinutes, startTime, endTime, courseId').eq('learnerId', learnerId),
        supabase.from('Enrollment').select('courseId, Course(courseId, subjectName, courseCode, status)').eq('learnerId', learnerId).eq('status', 'APPROVED'),
        supabase.from('Submission').select('submissionId, score, status, submittedAt, Assessment(assessmentId, title, type, totalPoints, courseId)').eq('learnerId', learnerId),
        supabase.from('AI_Workspace').select('workspaceId, AI_Project(projectId, Learning_Material(materialId, title))').eq('learnerId', learnerId).maybeSingle(),
        supabase.from('System_Settings')
          .select('setting_key, setting_value')
          .like('setting_key', `PRACTICE_QUIZ_ATTEMPT:${learnerId}:%`),
        supabase.from('System_Settings')
          .select('setting_key, setting_value')
          .like('setting_key', `FLASHCARD_REVIEW:${learnerId}:%`)
      ]);

      // UC-04 Alternative Flow 2: do not render partial/misleading statistics
      // when any required source fails. The frontend can then show Retry.
      const retrievalError =
        sessionsRes.error ||
        enrollmentsRes.error ||
        submissionsRes.error ||
        workspaceRes.error ||
        practiceAttemptsRes.error ||
        flashcardReviewsRes.error;
      if (retrievalError) throw retrievalError;

      const sessions = sessionsRes.data || [];
      const filteredSessions = sessions.filter((session) => {
        const interval = this._getSessionInterval(session);
        return interval && interval.endMs >= range.start.getTime() && interval.startMs <= range.end.getTime();
      });

      // UC03 Alt Flow 3: merge overlapping intervals across Projects/tabs/devices
      // so Personal Statistics counts real active time only once.
      const totalStudyMs = this._calculateUniqueActiveMilliseconds(
        filteredSessions,
        range.start,
        range.end
      );
      const totalMinutes = totalStudyMs / 60_000;

      let materialsStudiedCount = 0;
      const projects = workspaceRes.data?.AI_Project || [];
      projects.forEach((project) => {
        materialsStudiedCount += (project.Learning_Material || []).length;
      });

      const submissions = submissionsRes.data || [];
      const gradedSubmissions = submissions.filter((submission) => {
        if (submission.status !== 'GRADED' || submission.score === null || !submission.submittedAt) {
          return false;
        }

        const submittedMs = new Date(submission.submittedAt).getTime();
        return Number.isFinite(submittedMs)
          && submittedMs >= range.start.getTime()
          && submittedMs <= range.end.getTime();
      });

      const practiceQuizAttempts = (practiceAttemptsRes.data || [])
        .map((row) => {
          try {
            const attempt = JSON.parse(row.setting_value || '{}');
            if (String(attempt.learnerId) !== String(learnerId)) return null;
            const completedAt = new Date(attempt.completedAt);
            const percentage = Number(attempt.percentage);
            if (Number.isNaN(completedAt.getTime()) || !Number.isFinite(percentage)) return null;
            return {
              ...attempt,
              completedAt: completedAt.toISOString(),
              percentage: Math.max(0, Math.min(100, percentage))
            };
          } catch (_) {
            return null;
          }
        })
        .filter(Boolean)
        .filter((attempt) => {
          const completedMs = new Date(attempt.completedAt).getTime();
          return completedMs >= range.start.getTime() && completedMs <= range.end.getTime();
        });

      const flashcardReviews = (flashcardReviewsRes.data || [])
        .map((row) => {
          try {
            const review = JSON.parse(row.setting_value || '{}');
            if (String(review.learnerId) !== String(learnerId)) return null;
            const reviewedAt = new Date(review.reviewedAt);
            if (Number.isNaN(reviewedAt.getTime())) return null;
            return { ...review, reviewedAt: reviewedAt.toISOString() };
          } catch (_) {
            return null;
          }
        })
        .filter(Boolean)
        .filter((review) => {
          const reviewedMs = new Date(review.reviewedAt).getTime();
          return reviewedMs >= range.start.getTime() && reviewedMs <= range.end.getTime();
        });

      // Progress metric means reviewed flashcard DECKS/SETS, not individual cards.
      // Count each set at most once in the selected period. Legacy card-level
      // events are also collapsed by setId, correcting old inflated totals.
      const flashcardsReviewed = new Set(
        flashcardReviews.map((review) => String(review.setId || '')).filter(Boolean)
      ).size;

      const assessmentPercentages = gradedSubmissions.map((submission) => {
        const total = Number(submission.Assessment?.totalPoints || 100);
        if (total <= 0) return null;
        return Math.max(0, Math.min(100, (Number(submission.score) / total) * 100));
      }).filter((value) => Number.isFinite(value));

      const courseQuizPercentages = gradedSubmissions
        .filter((submission) => String(submission.Assessment?.type || '').toUpperCase() === 'QUIZ')
        .map((submission) => {
          const total = Number(submission.Assessment?.totalPoints || 100);
          return total > 0 ? Math.max(0, Math.min(100, (Number(submission.score) / total) * 100)) : null;
        })
        .filter((value) => Number.isFinite(value));

      const aiPracticePercentages = practiceQuizAttempts.map((attempt) => attempt.percentage);
      const allQuizPercentages = [...courseQuizPercentages, ...aiPracticePercentages];
      const allPerformancePercentages = [...assessmentPercentages, ...aiPracticePercentages];

      const quizScoreAverage = allQuizPercentages.length > 0
        ? Math.round(allQuizPercentages.reduce((sum, value) => sum + value, 0) / allQuizPercentages.length)
        : null;

      const overallPerformance = allPerformancePercentages.length > 0
        ? Math.round(allPerformancePercentages.reduce((sum, value) => sum + value, 0) / allPerformancePercentages.length)
        : null;

      const quizzesPassed =
        courseQuizPercentages.filter((percentage) => percentage >= 70).length +
        aiPracticePercentages.filter((percentage) => percentage >= 70).length;

      // Keep one recommendation per topic. Course assessment titles and the
      // active source materials of weak AI Practice Quiz attempts are both
      // eligible recommendation sources.
      const weakTopicMap = new Map();
      const addWeakTopic = (candidate) => {
        const topic = String(candidate?.topic || '').trim();
        if (!topic) return;
        const previous = weakTopicMap.get(topic);
        if (!previous || Number(candidate.percentage) < Number(previous.percentage)) {
          weakTopicMap.set(topic, candidate);
        }
      };

      gradedSubmissions.forEach((submission) => {
        const max = Number(submission.Assessment?.totalPoints || 100);
        if (max <= 0) return;

        const percent = (Number(submission.score) / max) * 100;
        const topic = String(submission.Assessment?.title || '').trim();
        if (percent >= 60 || !topic) return;

        addWeakTopic({
          topic,
          score: Number(submission.score),
          totalPoints: max,
          percentage: Math.round(percent),
          source: 'ASSESSMENT'
        });
      });

      practiceQuizAttempts.forEach((attempt) => {
        if (Number(attempt.percentage) >= 60) return;
        const sourceTitles = Array.isArray(attempt.sourceTitles) && attempt.sourceTitles.length > 0
          ? attempt.sourceTitles
          : [attempt.quizName || 'AI Practice Quiz'];

        sourceTitles.forEach((topic) => addWeakTopic({
          topic,
          score: Number(attempt.score || 0),
          totalPoints: Number(attempt.totalQuestions || 0),
          percentage: Math.round(Number(attempt.percentage || 0)),
          source: 'AI_PRACTICE_QUIZ'
        }));
      });
      const weakTopics = Array.from(weakTopicMap.values());

      let coursesMasteredCount = 0;
      const enrollments = enrollmentsRes.data || [];
      const courseProgressList = enrollments.map((item) => {
        const course = item.Course;
        if (!course) return null;

        const courseSubmissions = gradedSubmissions.filter(
          (submission) => submission.Assessment?.courseId === course.courseId
        );
        let progress = 0;
        if (courseSubmissions.length > 0) {
          const totalScorePercent = courseSubmissions.reduce((sum, submission) => {
            const max = Number(submission.Assessment?.totalPoints || 100);
            if (max <= 0) return sum;
            return sum + ((Number(submission.score) / max) * 100);
          }, 0);
          progress = Math.min(100, Math.round(totalScorePercent / courseSubmissions.length));
        }

        if (progress >= 100 || course.status === 'ARCHIVED') coursesMasteredCount += 1;
        return {
          id: course.courseId,
          name: course.subjectName,
          code: course.courseCode,
          progress
        };
      }).filter(Boolean);

      const trend = this._calculatePersonalProgressTrend(
        filteredSessions,
        range.start,
        range.end,
        range.bucket
      );
      const quizTrend = this._calculatePracticeQuizProgressTrend(
        practiceQuizAttempts,
        range.start,
        range.end,
        range.bucket
      );

      // A meaningful trend may be formed by study activity, quiz performance,
      // or both. One isolated point is still insufficient.
      const hasEnoughDataForTrend =
        trend.activeDataPoints >= 2 ||
        quizTrend.activeDataPoints >= 2;
      const hasLearningData =
        sessions.length > 0 ||
        gradedSubmissions.length > 0 ||
        practiceQuizAttempts.length > 0 ||
        flashcardsReviewed > 0 ||
        materialsStudiedCount > 0;

      return {
        selectedTimeRange: range.normalizedLabel,
        selectedStartDate: range.selectedStartDate || null,
        selectedEndDate: range.selectedEndDate || null,
        totalStudyMinutes: Math.round(totalMinutes),
        totalStudyHours: (totalMinutes / 60).toFixed(1),
        materialsStudied: materialsStudiedCount,
        practiceQuizScores: quizScoreAverage,
        overallPerformance,
        quizzesPassed,
        flashcardsReviewed,
        coursesCompleted: coursesMasteredCount,
        progressTrend: trend.values,
        progressTrendLabels: trend.labels,
        progressTrendDataPoints: trend.activeDataPoints,
        quizProgressTrend: quizTrend.values,
        quizProgressTrendLabels: quizTrend.labels,
        quizProgressTrendDataPoints: quizTrend.activeDataPoints,
        hasEnoughDataForTrend,
        hasLearningData,
        recommendedForReview: weakTopics,
        courseProgressList
      };
    } catch (error) {
      console.error('[AnalyticsService] Error getting personal stats:', error);
      if (error instanceof AppError || error?.statusCode) throw error;
      throw new AppError(500, 'DB_ERROR', 'Unable to load your learning statistics. Please try again.');
    }
  }

  // UC-11: View Class Performance Statistics
  static async getClassPerformance(courseId, educatorId, options = {}) {
    const referenceDate = options.referenceDate ? new Date(options.referenceDate) : new Date();

    const { data: course, error: courseError } = await supabase
      .from('Course')
      .select('courseId, educatorId, subjectName, courseCode')
      .eq('courseId', courseId)
      .maybeSingle();

    if (courseError) {
      console.error('[AnalyticsService] Course lookup error:', courseError);
      throw new AppError(500, 'DB_ERROR', 'Unable to load class performance statistics. Please try again.');
    }
    if (!course) throw new AppError(404, 'COURSE_NOT_FOUND', 'Course not found.');
    if (String(course.educatorId) !== String(educatorId)) {
      throw new AppError(403, 'COURSE_ACCESS_DENIED', 'You do not have permission to view statistics for this class.');
    }

    const { data: enrollments, error: enrollmentError } = await supabase
      .from('Enrollment')
      .select('learnerId, User(displayName, email)')
      .eq('courseId', courseId)
      .eq('status', 'APPROVED');

    if (enrollmentError) {
      console.error('[AnalyticsService] Enrollment lookup error:', enrollmentError);
      throw new AppError(500, 'DB_ERROR', 'Unable to load class performance statistics. Please try again.');
    }

    const learnerIds = (enrollments || []).map((e) => e.learnerId).filter(Boolean);

    let submissions = [];
    let sessions = [];

    if (learnerIds.length > 0) {
      const { data: submissionRows, error: submissionError } = await supabase
        .from('Submission')
        .select('score, learnerId, submittedAt, Assessment!inner(assessmentId, title, totalPoints, courseId)')
        .eq('Assessment.courseId', courseId)
        .in('learnerId', learnerIds);

      if (submissionError) {
        console.error('[AnalyticsService] Submission lookup error:', submissionError);
        throw new AppError(500, 'DB_ERROR', 'Unable to load class performance statistics. Please try again.');
      }
      submissions = submissionRows || [];

      const { data: sessionRows, error: sessionError } = await supabase
        .from('Study_Session')
        .select('learnerId, durationMinutes, startTime, endTime')
        .eq('courseId', courseId)
        .in('learnerId', learnerIds);

      if (sessionError) {
        console.error('[AnalyticsService] Study-session lookup error:', sessionError);
        throw new AppError(500, 'DB_ERROR', 'Unable to load class performance statistics. Please try again.');
      }
      sessions = sessionRows || [];
    }

    let totalScorePercentSum = 0;
    let gradedCount = 0;
    let classTotalStudyMinutes = 0;

    const distributionCounts = [0, 0, 0, 0, 0];
    const assessmentStats = new Map();
    const studentMap = new Map();

    const totalStudents = (enrollments || []).length;

    (enrollments || []).forEach((e) => {
      studentMap.set(e.learnerId, {
        learnerId: e.learnerId,
        name: e.User?.displayName || 'Learner',
        email: e.User?.email || 'N/A',
        scoreSum: 0,
        subCount: 0,
        studyTimeMinutes: 0
      });
    });

    // UC03 + UC11 privacy: only Study_Session rows already scoped to this
    // course and to currently approved Learners are considered. Overlapping
    // intervals for the same Learner are merged to prevent double-counting.
    const sessionsByLearner = new Map();
    sessions.forEach((session) => {
      if (!studentMap.has(session.learnerId)) return;
      if (!sessionsByLearner.has(session.learnerId)) {
        sessionsByLearner.set(session.learnerId, []);
      }
      sessionsByLearner.get(session.learnerId).push(session);
    });

    for (const [learnerId, learnerSessions] of sessionsByLearner.entries()) {
      const uniqueMinutes = this._calculateUniqueActiveMilliseconds(learnerSessions) / 60_000;
      classTotalStudyMinutes += uniqueMinutes;
      studentMap.get(learnerId).studyTimeMinutes = uniqueMinutes;
    }

    submissions.forEach((sub) => {
      if (!studentMap.has(sub.learnerId)) return;
      if (sub.score === null || sub.score === undefined || !sub.Assessment?.totalPoints) return;

      const maxPoints = Number(sub.Assessment.totalPoints);
      if (!Number.isFinite(maxPoints) || maxPoints <= 0) return;

      const percent = (Number(sub.score) / maxPoints) * 100;
      if (!Number.isFinite(percent)) return;

      totalScorePercentSum += percent;
      gradedCount += 1;

      if (percent <= 20) distributionCounts[0] += 1;
      else if (percent <= 40) distributionCounts[1] += 1;
      else if (percent <= 60) distributionCounts[2] += 1;
      else if (percent <= 80) distributionCounts[3] += 1;
      else distributionCounts[4] += 1;

      const asmtId = sub.Assessment.assessmentId;
      if (!assessmentStats.has(asmtId)) {
        assessmentStats.set(asmtId, {
          title: sub.Assessment.title,
          totalPercent: 0,
          count: 0
        });
      }
      const asmtData = assessmentStats.get(asmtId);
      asmtData.totalPercent += percent;
      asmtData.count += 1;

      const learnerStats = studentMap.get(sub.learnerId);
      learnerStats.scoreSum += percent;
      learnerStats.subCount += 1;
    });

    const classAverageScore = gradedCount > 0
      ? Number((totalScorePercentSum / gradedCount).toFixed(1))
      : 0;

    const learnerPerformance = [];
    const atRiskStudents = [];

    for (const stats of studentMap.values()) {
      const avgScore = stats.subCount > 0
        ? Number((stats.scoreSum / stats.subCount).toFixed(1))
        : null;

      let reason = null;

      // "Students Requiring Attention" is performance-oriented.
      // Active study time remains visible as a classroom metric, but low study
      // time by itself must not flag a Learner who is performing well.
      if (stats.subCount > 0 && avgScore < 60) {
        reason = 'Low assessment average';
      } else if (stats.subCount === 0 && gradedCount > 0) {
        reason = 'No submissions turned in';
      }

      const learnerSummary = {
        learnerId: stats.learnerId,
        name: stats.name,
        email: stats.email,
        averageScore: avgScore,
        gradedSubmissions: stats.subCount,
        studyTimeMinutes: Math.round(stats.studyTimeMinutes),
        needsAttention: Boolean(reason),
        reason
      };

      learnerPerformance.push(learnerSummary);
      if (reason) atRiskStudents.push(learnerSummary);
    }

    learnerPerformance.sort((a, b) => a.name.localeCompare(b.name));

    const atRiskCount = atRiskStudents.length;
    const safeCount = Math.max(0, totalStudents - atRiskCount);

    const knowledgeGaps = [];
    for (const item of assessmentStats.values()) {
      const avg = item.count > 0
        ? Number((item.totalPercent / item.count).toFixed(1))
        : 0;
      if (avg < 60) {
        knowledgeGaps.push({
          assessmentTitle: item.title,
          averageScorePercent: avg
        });
      }
    }

    knowledgeGaps.sort((a, b) => a.averageScorePercent - b.averageScorePercent);

    const weeklyWindow = this._getWeeklyWindow(referenceDate);
    const performanceTrends = this._calculateClassPerformanceTrends(
      sessions,
      submissions,
      weeklyWindow.start,
      weeklyWindow.end
    );

    return {
      course: {
        courseId: course.courseId,
        subjectName: course.subjectName,
        courseCode: course.courseCode || ''
      },
      classAverageScore,
      totalGradedSubmissions: gradedCount,
      atRiskStudents,
      learnerPerformance,
      totalStudents,
      avgAssessmentScore: gradedCount > 0 ? `${classAverageScore}%` : '—',
      activeStudyTime: `${(classTotalStudyMinutes / 60).toFixed(1)} hrs`,
      activeStudyMinutes: Math.round(classTotalStudyMinutes),
      performanceRatio: {
        safeCount,
        atRiskCount
      },
      distributionCounts,
      knowledgeGaps,
      performanceTrends,
      trendPeriod: {
        start: weeklyWindow.start.toISOString(),
        end: weeklyWindow.end.toISOString()
      }
    };
  }

  static _getWeeklyWindow(referenceDate = new Date()) {
    const end = new Date(referenceDate);
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    return { start, end };
  }

  static _calculateClassPerformanceTrends(sessions, submissions, rangeStart, rangeEnd) {
    const rows = [];
    const cursor = new Date(rangeStart);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(rangeEnd);

    while (cursor <= end) {
      const bucketStart = new Date(cursor);
      const bucketEnd = new Date(bucketStart);
      bucketEnd.setDate(bucketEnd.getDate() + 1);

      const sessionsByLearner = new Map();
      (sessions || []).forEach((session) => {
        if (!sessionsByLearner.has(session.learnerId)) sessionsByLearner.set(session.learnerId, []);
        sessionsByLearner.get(session.learnerId).push(session);
      });
      let studyMs = 0;
      for (const learnerSessions of sessionsByLearner.values()) {
        studyMs += this._calculateUniqueActiveMilliseconds(learnerSessions, bucketStart, bucketEnd);
      }

      const dailyScores = (submissions || [])
        .filter((sub) => {
          if (sub.score === null || sub.score === undefined || !sub.Assessment?.totalPoints || !sub.submittedAt) return false;
          const submittedMs = new Date(sub.submittedAt).getTime();
          return Number.isFinite(submittedMs) && submittedMs >= bucketStart.getTime() && submittedMs < bucketEnd.getTime();
        })
        .map((sub) => (Number(sub.score) / Number(sub.Assessment.totalPoints)) * 100)
        .filter(Number.isFinite);

      const averageScore = dailyScores.length > 0
        ? Number((dailyScores.reduce((sum, value) => sum + value, 0) / dailyScores.length).toFixed(1))
        : null;

      rows.push({
        date: bucketStart.toISOString().slice(0, 10),
        studyTimeMinutes: Math.round(studyMs / 60_000),
        averageScore,
        gradedSubmissions: dailyScores.length
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return rows;
  }

  static _weeklyReportSettingKey(courseId) {
    return `UC11_WEEKLY_REPORT_${String(courseId)}`;
  }

  static async generateWeeklyReport(courseId, educatorId, generatedAt = new Date()) {
    const generatedDate = new Date(generatedAt);
    if (Number.isNaN(generatedDate.getTime())) {
      throw new AppError(400, 'INVALID_REPORT_DATE', 'Invalid weekly report date.');
    }

    const stats = await this.getClassPerformance(courseId, educatorId, {
      referenceDate: generatedDate
    });
    const period = this._getWeeklyWindow(generatedDate);
    const report = {
      reportId: `UC11-${courseId}-${generatedDate.toISOString().slice(0, 10)}`,
      type: 'WEEKLY_CLASS_PERFORMANCE',
      courseId: stats.course.courseId,
      courseName: stats.course.subjectName,
      courseCode: stats.course.courseCode,
      educatorId,
      generatedAt: generatedDate.toISOString(),
      periodStart: period.start.toISOString(),
      periodEnd: period.end.toISOString(),
      read: false,
      stats
    };

    const { error } = await supabase
      .from('System_Settings')
      .upsert([{
        setting_key: this._weeklyReportSettingKey(courseId),
        setting_value: JSON.stringify(report)
      }], { onConflict: 'setting_key' });

    if (error) {
      console.error('[AnalyticsService] Weekly report persistence error:', error);
      throw new AppError(500, 'WEEKLY_REPORT_SAVE_FAILED', 'Unable to generate the weekly class-performance report.');
    }

    // The report itself is the source event for the in-app notification.
    // Notification persistence is best-effort so it cannot roll back a report
    // that has already been generated and saved successfully.
    let notification = null;
    try {
      notification = await NotificationService.createWeeklyReportNotification({ report });
    } catch (notificationError) {
      console.error('[AnalyticsService] Weekly report notification failed:', notificationError);
    }

    return {
      ...report,
      notificationId: notification?.id || null
    };
  }

  static async getWeeklyReport(courseId, educatorId) {
    const { data: course, error: courseError } = await supabase
      .from('Course')
      .select('courseId, educatorId')
      .eq('courseId', courseId)
      .maybeSingle();

    if (courseError) {
      console.error('[AnalyticsService] Weekly report authorization error:', courseError);
      throw new AppError(500, 'DB_ERROR', 'Unable to load the weekly class-performance report.');
    }
    if (!course) throw new AppError(404, 'COURSE_NOT_FOUND', 'Course not found.');
    if (String(course.educatorId) !== String(educatorId)) {
      throw new AppError(403, 'COURSE_ACCESS_DENIED', 'You do not have permission to view this weekly report.');
    }

    const { data, error } = await supabase
      .from('System_Settings')
      .select('setting_value')
      .eq('setting_key', this._weeklyReportSettingKey(courseId))
      .maybeSingle();

    if (error) {
      console.error('[AnalyticsService] Weekly report lookup error:', error);
      throw new AppError(500, 'DB_ERROR', 'Unable to load the weekly class-performance report.');
    }
    if (!data?.setting_value) {
      throw new AppError(404, 'WEEKLY_REPORT_NOT_FOUND', 'No weekly report is available for this class yet.');
    }

    try {
      const report = JSON.parse(data.setting_value);
      if (String(report.educatorId) !== String(educatorId) || String(report.courseId) !== String(courseId)) {
        throw new AppError(403, 'COURSE_ACCESS_DENIED', 'You do not have permission to view this weekly report.');
      }
      return report;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('[AnalyticsService] Invalid weekly report payload:', error);
      throw new AppError(500, 'WEEKLY_REPORT_INVALID', 'The weekly report data is unavailable.');
    }
  }


  static _getSessionInterval(session) {
    if (!session) return null;

    const startMs = session.startTime ? new Date(session.startTime).getTime() : Number.NaN;
    const endMs = session.endTime ? new Date(session.endTime).getTime() : Number.NaN;

    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
      return { startMs, endMs };
    }

    // Compatibility with older rows whose timestamps were equal but whose
    // integer durationMinutes already contained accumulated study time.
    const fallbackMinutes = Number(session.durationMinutes || 0);
    if (Number.isFinite(startMs) && fallbackMinutes > 0) {
      return { startMs, endMs: startMs + fallbackMinutes * 60_000 };
    }

    return null;
  }

  static _calculateUniqueActiveMilliseconds(sessions, rangeStart = null, rangeEnd = null) {
    const minMs = rangeStart ? new Date(rangeStart).getTime() : Number.NEGATIVE_INFINITY;
    const maxMs = rangeEnd ? new Date(rangeEnd).getTime() : Number.POSITIVE_INFINITY;

    const intervals = (sessions || [])
      .map((session) => this._getSessionInterval(session))
      .filter(Boolean)
      .map(({ startMs, endMs }) => ({
        startMs: Math.max(startMs, minMs),
        endMs: Math.min(endMs, maxMs)
      }))
      .filter(({ startMs, endMs }) => endMs > startMs)
      .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

    if (intervals.length === 0) return 0;

    let totalMs = 0;
    let currentStart = intervals[0].startMs;
    let currentEnd = intervals[0].endMs;

    for (let i = 1; i < intervals.length; i += 1) {
      const interval = intervals[i];
      if (interval.startMs <= currentEnd) {
        currentEnd = Math.max(currentEnd, interval.endMs);
      } else {
        totalMs += currentEnd - currentStart;
        currentStart = interval.startMs;
        currentEnd = interval.endMs;
      }
    }

    totalMs += currentEnd - currentStart;
    return totalMs;
  }

  static _resolvePersonalStatsRange(
    timeRange,
    now = new Date(),
    startDate = null,
    endDate = null
  ) {
    const requested = String(timeRange || 'Last 7 days').trim();
    const currentDate = new Date(now);

    if (requested === 'Custom range') {
      if (!startDate || !endDate) {
        throw new AppError(
          400,
          'CUSTOM_DATE_RANGE_REQUIRED',
          'Please select both From and To dates.'
        );
      }

      const parseDateOnly = (value, endOfDay = false) => {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
        if (!match) return null;

        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const parsed = new Date(year, month - 1, day);

        // Reject impossible dates such as 2026-02-31 instead of allowing
        // JavaScript Date to roll them into the next month.
        if (
          parsed.getFullYear() !== year ||
          parsed.getMonth() !== month - 1 ||
          parsed.getDate() !== day
        ) {
          return null;
        }

        if (endOfDay) parsed.setHours(23, 59, 59, 999);
        else parsed.setHours(0, 0, 0, 0);
        return parsed;
      };

      const start = parseDateOnly(startDate, false);
      const end = parseDateOnly(endDate, true);

      if (!start || !end) {
        throw new AppError(
          400,
          'INVALID_DATE_RANGE',
          'The selected date range is invalid.'
        );
      }

      if (start.getTime() > end.getTime()) {
        throw new AppError(
          400,
          'INVALID_DATE_RANGE',
          'From date cannot be later than To date.'
        );
      }

      const todayEnd = new Date(currentDate);
      todayEnd.setHours(23, 59, 59, 999);
      if (end.getTime() > todayEnd.getTime()) {
        throw new AppError(
          400,
          'FUTURE_DATE_RANGE_NOT_ALLOWED',
          'To date cannot be later than today.'
        );
      }

      return {
        normalizedLabel: 'Custom range',
        selectedStartDate: String(startDate),
        selectedEndDate: String(endDate),
        start,
        end: end > currentDate ? currentDate : end,
        bucket: 'day'
      };
    }

    const end = new Date(currentDate);

    if (requested === 'All time') {
      return {
        normalizedLabel: 'All time',
        selectedStartDate: null,
        selectedEndDate: null,
        start: new Date(0),
        end,
        bucket: 'month'
      };
    }

    const isFourWeeks = requested === 'Last 4 Weeks';
    const isThirtyDays = requested === 'Last 30 days';
    const numberOfDays = isFourWeeks ? 28 : (isThirtyDays ? 30 : 7);

    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (numberOfDays - 1));

    return {
      normalizedLabel: isFourWeeks
        ? 'Last 4 Weeks'
        : (isThirtyDays ? 'Last 30 days' : 'Last 7 days'),
      selectedStartDate: null,
      selectedEndDate: null,
      start,
      end,
      bucket: 'day'
    };
  }

  static _calculatePersonalProgressTrend(sessions, rangeStart, rangeEnd, bucket = 'day') {
    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);
    const labels = [];
    const values = [];
    let activeDataPoints = 0;

    if (bucket === 'month') {
      // For All time, start from the first recorded study interval instead of
      // 1970 so the chart remains readable while still representing all data.
      const validIntervals = (sessions || [])
        .map((session) => this._getSessionInterval(session))
        .filter(Boolean)
        .sort((a, b) => a.startMs - b.startMs);

      const effectiveStart = validIntervals.length > 0
        ? new Date(validIntervals[0].startMs)
        : new Date(end.getFullYear(), end.getMonth(), 1);
      effectiveStart.setDate(1);
      effectiveStart.setHours(0, 0, 0, 0);

      const cursor = new Date(effectiveStart);
      while (cursor <= end) {
        const bucketStart = new Date(cursor);
        const bucketEnd = new Date(bucketStart);
        bucketEnd.setMonth(bucketEnd.getMonth() + 1);

        const uniqueMs = this._calculateUniqueActiveMilliseconds(sessions, bucketStart, bucketEnd);
        const minutes = Number((uniqueMs / 60_000).toFixed(1));
        if (minutes > 0) activeDataPoints += 1;

        labels.push(bucketStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
        values.push(minutes);
        cursor.setMonth(cursor.getMonth() + 1);
      }

      return { labels, values, activeDataPoints };
    }

    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= end) {
      const bucketStart = new Date(cursor);
      const bucketEnd = new Date(bucketStart);
      bucketEnd.setDate(bucketEnd.getDate() + 1);

      const uniqueMs = this._calculateUniqueActiveMilliseconds(sessions, bucketStart, bucketEnd);
      const minutes = Number((uniqueMs / 60_000).toFixed(1));
      if (minutes > 0) activeDataPoints += 1;

      labels.push(bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      values.push(minutes);
      cursor.setDate(cursor.getDate() + 1);
    }

    return { labels, values, activeDataPoints };
  }

  static _calculatePracticeQuizProgressTrend(attempts, rangeStart, rangeEnd, bucket = 'day') {
    const end = new Date(rangeEnd);
    const validAttempts = (attempts || [])
      .map((attempt) => ({
        ...attempt,
        completedMs: new Date(attempt.completedAt).getTime(),
        percentage: Number(attempt.percentage)
      }))
      .filter((attempt) => Number.isFinite(attempt.completedMs) && Number.isFinite(attempt.percentage))
      .sort((a, b) => a.completedMs - b.completedMs);

    const labels = [];
    const values = [];
    let activeDataPoints = 0;

    if (bucket === 'month') {
      const effectiveStart = validAttempts.length > 0
        ? new Date(validAttempts[0].completedMs)
        : new Date(end.getFullYear(), end.getMonth(), 1);
      effectiveStart.setDate(1);
      effectiveStart.setHours(0, 0, 0, 0);

      const cursor = new Date(effectiveStart);
      while (cursor <= end) {
        const bucketStart = new Date(cursor);
        const bucketEnd = new Date(bucketStart);
        bucketEnd.setMonth(bucketEnd.getMonth() + 1);
        const inBucket = validAttempts.filter(
          (attempt) => attempt.completedMs >= bucketStart.getTime() && attempt.completedMs < bucketEnd.getTime()
        );
        const average = inBucket.length > 0
          ? Math.round(inBucket.reduce((sum, attempt) => sum + attempt.percentage, 0) / inBucket.length)
          : null;
        if (average !== null) activeDataPoints += 1;
        labels.push(bucketStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
        values.push(average);
        cursor.setMonth(cursor.getMonth() + 1);
      }
      return { labels, values, activeDataPoints };
    }

    const cursor = new Date(rangeStart);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= end) {
      const bucketStart = new Date(cursor);
      const bucketEnd = new Date(bucketStart);
      bucketEnd.setDate(bucketEnd.getDate() + 1);
      const inBucket = validAttempts.filter(
        (attempt) => attempt.completedMs >= bucketStart.getTime() && attempt.completedMs < bucketEnd.getTime()
      );
      const average = inBucket.length > 0
        ? Math.round(inBucket.reduce((sum, attempt) => sum + attempt.percentage, 0) / inBucket.length)
        : null;
      if (average !== null) activeDataPoints += 1;
      labels.push(bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      values.push(average);
      cursor.setDate(cursor.getDate() + 1);
    }
    return { labels, values, activeDataPoints };
  }

  // Backwards-compatible helper retained for older tests/code paths.
  static _calculateWeeklyTrend(sessions) {
    const now = new Date();
    const range = this._resolvePersonalStatsRange('Last 7 days', now);
    return this._calculatePersonalProgressTrend(sessions, range.start, range.end, 'day').values;
  }
}

module.exports = AnalyticsService;