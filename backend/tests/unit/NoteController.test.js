jest.mock('../../service/NoteService', () => ({
  getProjectNotes: jest.fn(),
  createNote: jest.fn(),
  updateNote: jest.fn(),
  deleteNote: jest.fn()
}));

const NoteController = require('../../controllers/NoteController');
const NoteService = require('../../service/NoteService');
const AppError = require('../../error/AppError');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function reqBase(overrides = {}) {
  return {
    params: {},
    body: {},
    user: { userId: 'l-1', role: 'LEARNER' },
    ...overrides
  };
}

describe('NoteController UC-25 unit tests', () => {
  let consoleErrorSpy;
  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterAll(() => consoleErrorSpy.mockRestore());
  beforeEach(() => jest.clearAllMocks());

  test('getProjectNotes() returns projectId, count and notes', async () => {
    const notes = [{ noteId: 'n-1' }, { noteId: 'n-2' }];
    NoteService.getProjectNotes.mockResolvedValue(notes);
    const req = reqBase({ params: { projectId: 'p-1' } });
    const res = mockRes();

    await NoteController.getProjectNotes(req, res);

    expect(NoteService.getProjectNotes).toHaveBeenCalledWith('p-1', 'l-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ projectId: 'p-1', count: 2, notes });
  });

  test('createNote() forwards content/title and returns 201', async () => {
    const note = { noteId: 'n-1', projectId: 'p-1', content: 'Text', title: 'Topic' };
    NoteService.createNote.mockResolvedValue(note);
    const req = reqBase({ params: { projectId: 'p-1' }, body: { content: 'Text', title: 'Topic' } });
    const res = mockRes();

    await NoteController.createNote(req, res);

    expect(NoteService.createNote).toHaveBeenCalledWith('p-1', 'l-1', 'Text', 'Topic');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: 'Personal Note saved successfully.', note });
  });

  test('updateNote() forwards noteId/content/title and returns 200', async () => {
    const note = { noteId: 'n-1', projectId: 'p-1', content: 'Updated' };
    NoteService.updateNote.mockResolvedValue(note);
    const req = reqBase({ params: { noteId: 'n-1' }, body: { content: 'Updated', title: undefined } });
    const res = mockRes();

    await NoteController.updateNote(req, res);

    expect(NoteService.updateNote).toHaveBeenCalledWith('n-1', 'l-1', 'Updated', undefined);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Personal Note updated successfully.', note });
  });

  test('deleteNote() calls Service and returns success message', async () => {
    NoteService.deleteNote.mockResolvedValue(undefined);
    const req = reqBase({ params: { noteId: 'n-1' } });
    const res = mockRes();

    await NoteController.deleteNote(req, res);

    expect(NoteService.deleteNote).toHaveBeenCalledWith('n-1', 'l-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Personal Note deleted successfully.' });
  });

  test.each([
    ['getProjectNotes', 'getProjectNotes', () => reqBase({ params: { projectId: 'p-1' } })],
    ['createNote', 'createNote', () => reqBase({ params: { projectId: 'p-1' } })],
    ['updateNote', 'updateNote', () => reqBase({ params: { noteId: 'n-1' } })],
    ['deleteNote', 'deleteNote', () => reqBase({ params: { noteId: 'n-1' } })]
  ])('%s() maps AppError to HTTP response', async (controllerMethod, serviceMethod, reqFactory) => {
    NoteService[serviceMethod].mockRejectedValue(new AppError(403, 'PROJECT_ACCESS_DENIED', 'Denied'));
    const res = mockRes();

    await NoteController[controllerMethod](reqFactory(), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ code: 'PROJECT_ACCESS_DENIED', message: 'Denied' });
  });

  test('unexpected error becomes generic 500', async () => {
    NoteService.createNote.mockRejectedValue(new Error('DB details'));
    const req = reqBase({ params: { projectId: 'p-1' }, body: { content: 'Text' } });
    const res = mockRes();

    await NoteController.createNote(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred.'
    });
  });
});
