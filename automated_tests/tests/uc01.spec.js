require('dotenv').config({ path: '../.env' });
const path = require('path');
const { test, expect } = require('@playwright/test');

const LEARNER_EMAIL = process.env.LEARNER_EMAIL;
const LEARNER_PASSWORD = process.env.LEARNER_PASSWORD;

test.describe('UC01 - Manage AI Workspace', () => {

  test.beforeEach(async ({ page }) => {
    // Bảo đảm test account đã được cung cấp
    if (!LEARNER_EMAIL || !LEARNER_PASSWORD) {
      throw new Error(
        'Missing LEARNER_EMAIL or LEARNER_PASSWORD environment variable.'
      );
    }

    // 1. Open Login page
    await page.goto('/auth/login');

    // 2. Login as Learner
    await page
      .getByPlaceholder('student@acognix.com')
      .fill(LEARNER_EMAIL);

    await page
      .getByPlaceholder('••••••••')
      .fill(LEARNER_PASSWORD);

    await page
      .getByRole('button', { name: 'Log In' })
      .click();

    // 3. Verify successful login
    await expect(page).toHaveURL(/\/learner\/dashboard/);

    // 4. Navigate to AI Workspace
    await page
      .getByRole('link', { name: 'AI Workspace' })
      .click();

    await expect(page).toHaveURL(/\/learner\/ai-workspace/);
  });


  test('UC01-UI02 - Create a new Personal Project successfully', async ({ page }) => {

    // Tạo tên unique để lần chạy sau không bị duplicate
    const projectName = `Auto Project ${Date.now()}`;

    // 1. Click New Project
    await page
      .getByRole('button', { name: '+ New Project' })
      .click();

    // 2. Verify Create Personal Project modal
    await expect(
      page.getByRole('heading', { name: 'Create Personal Project' })
    ).toBeVisible();

    // 3. Enter Project name
    await page
      .getByPlaceholder('e.g. IELTS Preparation...')
      .fill(projectName);

    // 4. Create Project
    await page
      .getByRole('button', { name: 'Create Project' })
      .click();

    // 5. Verify success notification
    await expect(
      page.getByText('Personal Project created successfully!')
    ).toBeVisible();

    // 6. Verify newly created Project exists in Project list
    await expect(
      page.locator('select option', { hasText: projectName })
    ).toHaveCount(1);
  });

  test('UC01-UI03 - Prevent creation of a Personal Project with a duplicate name', async ({ page }) => {

    // Tạo một tên unique để đảm bảo project này chưa tồn tại từ trước
    const projectName = `Duplicate Test ${Date.now()}`;

    // ===== Create the first Project =====

    await page
        .getByRole('button', { name: '+ New Project' })
        .click();

    await page
        .getByPlaceholder('e.g. IELTS Preparation...')
        .fill(projectName);

    await page
        .getByRole('button', { name: 'Create Project' })
        .click();

    // Verify first Project was created successfully
    await expect(
        page.getByText('Personal Project created successfully!')
    ).toBeVisible();

    await expect(
        page.locator('select option', { hasText: projectName })
    ).toHaveCount(1);


    // ===== Try to create another Project with the same name =====

    await page
        .getByRole('button', { name: '+ New Project' })
        .click();

    await page
        .getByPlaceholder('e.g. IELTS Preparation...')
        .fill(projectName);

    await page
        .getByRole('button', { name: 'Create Project' })
        .click();


    // ===== Verify duplicate validation =====

    await expect(
        page.getByText(
        'Project name already exists. Please choose another name.'
        )
    ).toBeVisible();

    // There must still be only ONE Project with this name
    await expect(
        page.locator('select option', { hasText: projectName })
    ).toHaveCount(1);

    });
  test('UC01-UI12 - Reject unsupported file format', async ({ page }) => {

    const projectName = `Upload Validation ${Date.now()}`;

    // ===== Create a Personal Project =====
    await page
        .getByRole('button', { name: '+ New Project' })
        .click();

    await page
        .getByPlaceholder('e.g. IELTS Preparation...')
        .fill(projectName);

    await page
        .getByRole('button', { name: 'Create Project' })
        .click();

    await expect(
        page.getByText('Personal Project created successfully!')
    ).toBeVisible();

    // Verify Project exists
    const projectOption = page.locator(
        'select option',
        { hasText: projectName }
    );

    await expect(projectOption).toHaveCount(1);

    // ===== Explicitly open/select the newly created Project =====
    const projectId = await projectOption.getAttribute('value');

    const projectSelect = page
        .locator('select')
        .filter({
            has: page.locator('option', { hasText: projectName })
        });

    await projectSelect.selectOption(projectId);

    // Verify the new Project is really selected
    await expect(projectSelect).toHaveValue(projectId);


    // ===== Upload unsupported file =====
    const fileInput = page.locator('input[type="file"]');

    const unsupportedFile = path.resolve(
        __dirname,
        '../fixtures/unsupported.exe'
    );

    await fileInput.setInputFiles(unsupportedFile);


    // ===== Verify validation =====
    await expect(
        page.getByText('File format not supported.')
    ).toBeVisible();

    // Unsupported file must NOT appear in materials
    await expect(
        page.getByText('unsupported.exe')
    ).toHaveCount(0);
});
});