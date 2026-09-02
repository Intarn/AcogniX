// frontend/src/services/progressService.js
import { apiRequest } from './apiClient';

export const getProgressOverview = async (
  userEmail,
  timeRange = 'Last 7 days',
  startDate = '',
  endDate = ''
) => {
  // UC04: let the caller handle retrieval failures so the Dashboard can show
  // the required Retry state instead of silently rendering partial statistics.
  const params = new URLSearchParams({ timeRange });

  if (timeRange === 'Custom range') {
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
  }

  const data = await apiRequest(`/analytics/me?${params.toString()}`, {
    method: 'GET'
  });

  const trendMins = Array.isArray(data?.progressTrend) ? data.progressTrend : [];
  const backendLabels = Array.isArray(data?.progressTrendLabels) ? data.progressTrendLabels : [];
  const chartDataValues = trendMins.map((minutes) => Number((Number(minutes || 0) / 60).toFixed(1)));
  const quizTrendValues = Array.isArray(data?.quizProgressTrend) ? data.quizProgressTrend : [];
  const quizTrendLabels = Array.isArray(data?.quizProgressTrendLabels) ? data.quizProgressTrendLabels : [];
  const totalMins = Number(data?.totalStudyMinutes || 0);
  const timeStudied = `${Math.floor(totalMins / 60)}h ${Math.round(totalMins % 60)}m`;

  return {
    selectedTimeRange: data?.selectedTimeRange || timeRange,
    selectedStartDate: data?.selectedStartDate || startDate || null,
    selectedEndDate: data?.selectedEndDate || endDate || null,
    timeStudied,
    totalStudyMinutes: totalMins,
    materialsStudied: Number(data?.materialsStudied || 0),
    coursesCompleted: Number(data?.coursesCompleted || 0),
    flashcardsReviewed: Number(data?.flashcardsReviewed || 0),
    quizzesPassed: Number(data?.quizzesPassed || 0),
    overallPerformance: Number(data?.overallPerformance || 0),
    practiceQuizScores: data?.practiceQuizScores ?? null,
    recommendedForReview: Array.isArray(data?.recommendedForReview) ? data.recommendedForReview : [],
    hasEnoughDataForTrend: Boolean(data?.hasEnoughDataForTrend),
    hasLearningData: Boolean(data?.hasLearningData),
    activities: data?.activities || [],
    courseProgressList: Array.isArray(data?.courseProgressList) ? data.courseProgressList : [],
    chartData: {
      labels: backendLabels.length > 0 ? backendLabels : quizTrendLabels,
      data: chartDataValues,
      quizData: quizTrendValues
    }
  };
};
