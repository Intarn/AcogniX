jest.mock('../../config/supabaseClient', () => ({ from: jest.fn() }));

const supabase = require('../../config/supabaseClient');
const NoteService = require('../../service/NoteService');
const PersonalNote = require('../../entities/PersonalNote');

function selectEqMaybeSingle(result) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result)
  };
}

function selectEqList(result) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue(result)
  };
}

function mutationSingle(result) {
  return {
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result)
  };
}

function deleteEq(result) {
  return {
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue(result)
  };
}

function createTableRouter(queues) {
  supabase.from.mockImplementation((name) => {
    const queue = queues[name];
    if (!queue || queue.length === 0) {
      throw new Error(`Unexpected Supabase table call: ${name}`);
    }
    return queue.shift();
  });
}

describe('NoteService UC-25 unit tests', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  describe('getProjectNotes()', () => {
    test('verifies ownership, retrieves notes and maps them to PersonalNote entities', async () => {
      jest.spyOn(NoteService, '_assertProjectOwnedBy').mockResolvedValue({ projectId: 'p-1' });
      const chain = selectEqList({
        data: [
          { noteId: 'n-1', projectId: 'p-1', content: 'First' },
          { noteId: 'n-2', projectId: 'p-1', content: 'Second' }
        ],
        error: null
      });
      createTableRouter({ Personal_Note: [chain] });

      const result = await NoteService.getProjectNotes('p-1', 'l-1');

      expect(NoteService._assertProjectOwnedBy).toHaveBeenCalledWith('p-1', 'l-1');
      expect(chain.eq).toHaveBeenCalledWith('projectId', 'p-1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(PersonalNote);
    });

    test('propagates database retrieval error', async () => {
      jest.spyOn(NoteService, '_assertProjectOwnedBy').mockResolvedValue({});
      const dbError = new Error('DB_ERROR');
      createTableRouter({ Personal_Note: [selectEqList({ data: null, error: dbError })] });
      await expect(NoteService.getProjectNotes('p-1', 'l-1')).rejects.toBe(dbError);
    });
  });

  describe('createNote()', () => {
    beforeEach(() => {
      jest.spyOn(NoteService, '_assertProjectOwnedBy').mockResolvedValue({ projectId: 'p-1' });
    });

    test.each(['', '   ', null, undefined])('rejects blank content %p', async (content) => {
      await expect(
        NoteService.createNote('p-1', 'l-1', content)
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'NOTE_CONTENT_REQUIRED',
        message: 'Note content cannot be empty.'
      });
      expect(supabase.from).not.toHaveBeenCalled();
    });

    test('creates note without title when title is undefined', async () => {
      const saved = { noteId: 'n-1', projectId: 'p-1', content: 'Content' };
      const chain = mutationSingle({ data: saved, error: null });
      createTableRouter({ Personal_Note: [chain] });

      const result = await NoteService.createNote('p-1', 'l-1', 'Content');

      expect(chain.insert).toHaveBeenCalledWith({ projectId: 'p-1', content: 'Content' });
      expect(result).toBeInstanceOf(PersonalNote);
      expect(result.noteId).toBe('n-1');
    });

    test('trims optional title and stores null for a blank title', async () => {
      const saved = { noteId: 'n-1', projectId: 'p-1', title: 'Topic', content: 'Content' };
      const chain = mutationSingle({ data: saved, error: null });
      createTableRouter({ Personal_Note: [chain] });

      await NoteService.createNote('p-1', 'l-1', 'Content', ' Topic ');
      expect(chain.insert).toHaveBeenCalledWith({ projectId: 'p-1', content: 'Content', title: 'Topic' });

      const second = mutationSingle({ data: { ...saved, title: null }, error: null });
      createTableRouter({ Personal_Note: [second] });
      await NoteService.createNote('p-1', 'l-1', 'Content', '   ');
      expect(second.insert).toHaveBeenCalledWith({ projectId: 'p-1', content: 'Content', title: null });
    });

    test('propagates insert database error', async () => {
      const dbError = new Error('INSERT_FAILED');
      createTableRouter({ Personal_Note: [mutationSingle({ data: null, error: dbError })] });
      await expect(NoteService.createNote('p-1', 'l-1', 'Content')).rejects.toBe(dbError);
    });
  });

  describe('updateNote()', () => {
    beforeEach(() => {
      jest.spyOn(NoteService, '_findOwnedNote').mockResolvedValue({ noteId: 'n-1', projectId: 'p-1' });
    });

    test.each(['', '   ', null, undefined])('rejects blank content %p', async (content) => {
      await expect(
        NoteService.updateNote('n-1', 'l-1', content)
      ).rejects.toMatchObject({ statusCode: 400, code: 'NOTE_CONTENT_REQUIRED' });
    });

    test('updates content only when title is undefined', async () => {
      const saved = { noteId: 'n-1', projectId: 'p-1', content: 'Updated' };
      const chain = mutationSingle({ data: saved, error: null });
      createTableRouter({ Personal_Note: [chain] });

      const result = await NoteService.updateNote('n-1', 'l-1', 'Updated');

      expect(NoteService._findOwnedNote).toHaveBeenCalledWith('n-1', 'l-1');
      expect(chain.update).toHaveBeenCalledWith({ content: 'Updated' });
      expect(chain.eq).toHaveBeenCalledWith('noteId', 'n-1');
      expect(result).toBeInstanceOf(PersonalNote);
    });

    test('updates optional title when supplied', async () => {
      const chain = mutationSingle({
        data: { noteId: 'n-1', projectId: 'p-1', content: 'Updated', title: 'New title' },
        error: null
      });
      createTableRouter({ Personal_Note: [chain] });

      await NoteService.updateNote('n-1', 'l-1', 'Updated', ' New title ');
      expect(chain.update).toHaveBeenCalledWith({ content: 'Updated', title: 'New title' });
    });
  });

  describe('deleteNote()', () => {
    test('verifies ownership and deletes note', async () => {
      jest.spyOn(NoteService, '_findOwnedNote').mockResolvedValue({ noteId: 'n-1', projectId: 'p-1' });
      const chain = deleteEq({ error: null });
      createTableRouter({ Personal_Note: [chain] });

      await expect(NoteService.deleteNote('n-1', 'l-1')).resolves.toBeUndefined();
      expect(NoteService._findOwnedNote).toHaveBeenCalledWith('n-1', 'l-1');
      expect(chain.eq).toHaveBeenCalledWith('noteId', 'n-1');
    });

    test('propagates delete error', async () => {
      jest.spyOn(NoteService, '_findOwnedNote').mockResolvedValue({});
      const dbError = new Error('DELETE_FAILED');
      createTableRouter({ Personal_Note: [deleteEq({ error: dbError })] });
      await expect(NoteService.deleteNote('n-1', 'l-1')).rejects.toBe(dbError);
    });
  });

  describe('_findOwnedNote()', () => {
    test('returns NOTE_NOT_FOUND when note does not exist', async () => {
      createTableRouter({ Personal_Note: [selectEqMaybeSingle({ data: null, error: null })] });
      await expect(NoteService._findOwnedNote('n-x', 'l-1')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOTE_NOT_FOUND'
      });
    });

    test('checks project ownership before returning note', async () => {
      const note = { noteId: 'n-1', projectId: 'p-1', content: 'x' };
      createTableRouter({ Personal_Note: [selectEqMaybeSingle({ data: note, error: null })] });
      jest.spyOn(NoteService, '_assertProjectOwnedBy').mockResolvedValue({ projectId: 'p-1' });

      await expect(NoteService._findOwnedNote('n-1', 'l-1')).resolves.toBe(note);
      expect(NoteService._assertProjectOwnedBy).toHaveBeenCalledWith('p-1', 'l-1');
    });
  });

  describe('_assertProjectOwnedBy()', () => {
    test('returns PROJECT_NOT_FOUND when AI_Project does not exist', async () => {
      createTableRouter({ AI_Project: [selectEqMaybeSingle({ data: null, error: null })] });
      await expect(NoteService._assertProjectOwnedBy('p-x', 'l-1')).rejects.toMatchObject({
        statusCode: 404,
        code: 'PROJECT_NOT_FOUND'
      });
    });

    test('returns PROJECT_ACCESS_DENIED when workspace belongs to another Learner', async () => {
      createTableRouter({
        AI_Project: [selectEqMaybeSingle({
          data: { projectId: 'p-1', workspaceId: 'w-1', name: 'Project', type: 'PERSONAL', status: 'ACTIVE' },
          error: null
        })],
        AI_Workspace: [selectEqMaybeSingle({
          data: { workspaceId: 'w-1', learnerId: 'another-learner' },
          error: null
        })]
      });

      await expect(NoteService._assertProjectOwnedBy('p-1', 'l-1')).rejects.toMatchObject({
        statusCode: 403,
        code: 'PROJECT_ACCESS_DENIED'
      });
    });

    test('returns project when workspace belongs to current Learner', async () => {
      const project = { projectId: 'p-1', workspaceId: 'w-1', name: 'Project', type: 'PERSONAL', status: 'ACTIVE' };
      createTableRouter({
        AI_Project: [selectEqMaybeSingle({ data: project, error: null })],
        AI_Workspace: [selectEqMaybeSingle({ data: { workspaceId: 'w-1', learnerId: 'l-1' }, error: null })]
      });

      await expect(NoteService._assertProjectOwnedBy('p-1', 'l-1')).resolves.toBe(project);
    });

    test('propagates AI_Project and AI_Workspace query errors', async () => {
      const projectError = new Error('PROJECT_DB_ERROR');
      createTableRouter({ AI_Project: [selectEqMaybeSingle({ data: null, error: projectError })] });
      await expect(NoteService._assertProjectOwnedBy('p-1', 'l-1')).rejects.toBe(projectError);

      const workspaceError = new Error('WORKSPACE_DB_ERROR');
      createTableRouter({
        AI_Project: [selectEqMaybeSingle({ data: { projectId: 'p-1', workspaceId: 'w-1' }, error: null })],
        AI_Workspace: [selectEqMaybeSingle({ data: null, error: workspaceError })]
      });
      await expect(NoteService._assertProjectOwnedBy('p-1', 'l-1')).rejects.toBe(workspaceError);
    });
  });
});
