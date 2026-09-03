require('dotenv').config({ path: '../.env' });

const { test, expect } = require('@playwright/test');

const LEARNER_EMAIL = process.env.LEARNER_EMAIL;
const LEARNER_PASSWORD = process.env.LEARNER_PASSWORD;

test.describe('UC04 - View Personal Statistics', () => {

  test.beforeEach(async ({ page }) => {
    if (!LEARNER_EMAIL || !LEARNER_PASSWORD) {
      throw new Error(
        'Missing LEARNER_EMAIL or LEARNER_PASSWORD environment variable.'
      );
    }

    // Login
    await page.goto('/auth/login');

    await page
      .getByPlaceholder('student@acognix.com')
      .fill(LEARNER_EMAIL);

    await page
      .getByPlaceholder('••••••••')
      .fill(LEARNER_PASSWORD);

    await page
      .getByRole('button', { name: 'Log In' })
      .click();

    await expect(page).toHaveURL(/\/learner\/dashboard/);
  });


  test('UC04-UI01 - View Personal Statistics with existing learning data', async ({ page }) => {

    // Wait for statistics API while opening Progress
    const analyticsResponsePromise = page.waitForResponse(
      response =>
        response.url().includes('/api/analytics/me') &&
        response.request().method() === 'GET'
    );

    await page.goto('/learner/progress');

    const analyticsResponse = await analyticsResponsePromise;

    // Verify statistics were retrieved successfully
    expect(analyticsResponse.status()).toBe(200);

    const data = await analyticsResponse.json();

    // This learner should already have learning data
    expect(data.hasLearningData).toBe(true);


    // ===== Verify Personal Statistics UI =====

    await expect(
      page.getByRole('heading', { name: 'Personal Statistics' })
    ).toBeVisible();

    await expect(
      page.getByText('Active Study Time', { exact: true })
    ).toBeVisible();

    await expect(
      page.getByText('Materials Studied', { exact: true })
    ).toBeVisible();

    await expect(
      page.getByText('Quiz Results', { exact: true })
    ).toBeVisible();

    await expect(
      page.getByText('Overall Performance', { exact: true })
    ).toBeVisible();

    await expect(
      page.getByText('Quizzes Passed', { exact: true })
    ).toBeVisible();

    await expect(
      page.getByText('Flashcards Reviewed', { exact: true })
    ).toBeVisible();


    // Learner has data, so empty-state message must not appear
    await expect(
      page.getByText('No learning data is available yet.')
    ).toHaveCount(0);


    // Verify progress section is displayed
    await expect(
      page.getByText('Learning Progress Over Time', { exact: true })
    ).toBeVisible();

  });
  test('UC04-UI02 - Show empty state when learner has no learning data', async ({ page }) => {

    // Mock learner statistics API with no learning data
    await page.route('**/api/analytics/me**', async route => {
        await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
            hasLearningData: false,
            activeStudyTime: 0,
            materialsStudied: 0,
            quizResults: 0,
            overallPerformance: 0,
            quizzesPassed: 0,
            flashcardsReviewed: 0,
            progressOverTime: []
        })
        });
    });

    await page.goto('/learner/progress');

    // Verify page still loads successfully
    await expect(
        page.getByRole('heading', { name: 'Personal Statistics' })
    ).toBeVisible();

    // Verify empty-state message
    await expect(
        page.getByText('No learning data is available yet.')
    ).toBeVisible();

    // Verify progress chart does not incorrectly show learning activity
    await expect(
        page.getByText('Learning Progress Over Time', { exact: true })
    ).toBeVisible();

    });

  test('UC04-UI04 - Retry successfully after statistics retrieval failure', async ({ page }) => {

    let requestCount = 0;

    // Intercept Personal Statistics API
    await page.route('**/api/analytics/me**', async route => {

        requestCount++;

        // First request: simulate server failure
        if (requestCount === 1) {
        await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
            message: 'Internal Server Error'
            })
        });

        return;
        }

        // Subsequent request: use the real backend
        await route.continue();
    });


    // ===== First load: API fails =====

    await page.goto('/learner/progress');

    // Verify required error state
    await expect(
        page.getByText(
        'Unable to load your learning statistics. Please try again.'
        )
    ).toBeVisible();

    await expect(
        page.getByRole('button', { name: 'Retry' })
    ).toBeVisible();


    // ===== Retry: real API should succeed =====

    const retryResponsePromise = page.waitForResponse(
        response =>
        response.url().includes('/api/analytics/me') &&
        response.request().method() === 'GET' &&
        response.status() === 200
    );

    await page
        .getByRole('button', { name: 'Retry' })
        .click();

    const retryResponse = await retryResponsePromise;

    expect(retryResponse.status()).toBe(200);


    // ===== Verify recovery =====

    await expect(
        page.getByRole('heading', { name: 'Personal Statistics' })
    ).toBeVisible();

    await expect(
        page.getByText('Active Study Time', { exact: true })
    ).toBeVisible();

    // Error state must disappear after successful retry
    await expect(
        page.getByText(
        'Unable to load your learning statistics. Please try again.'
        )
    ).toHaveCount(0);

    });
});