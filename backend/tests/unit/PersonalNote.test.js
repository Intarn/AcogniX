const PersonalNote = require('../../entities/PersonalNote');

describe('PersonalNote entity', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('constructor maps supplied values and optional defaults', () => {
    const note = new PersonalNote({
      noteId: 'n-1',
      projectId: 'p-1',
      content: 'My note'
    });

    expect(note).toEqual(expect.objectContaining({
      noteId: 'n-1',
      projectId: 'p-1',
      title: null,
      content: 'My note',
      createdAt: null,
      updatedAt: null
    }));
  });

  test('updateContent() changes content and updatedAt', () => {
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-08-08T00:00:00.000Z');
    const note = new PersonalNote({ noteId: 'n-1', projectId: 'p-1', content: 'Old' });

    note.updateContent('New');

    expect(note.content).toBe('New');
    expect(note.updatedAt).toBe('2026-08-08T00:00:00.000Z');
  });

  test.each([
    ['', true],
    ['   ', true],
    [null, true],
    [undefined, true],
    ['Useful content', false]
  ])('isBlank() with %p returns %s', (content, expected) => {
    const note = new PersonalNote({ content });
    expect(note.isBlank()).toBe(expected);
  });
});
