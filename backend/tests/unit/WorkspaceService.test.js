jest.mock('../../config/supabaseClient', () => ({
  from: jest.fn(),
  storage: { from: jest.fn() }
}));

const supabase = require('../../config/supabaseClient');
const WorkspaceService = require('../../service/WorkspaceService');

function mockSupabaseChain(result) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result),
    single: jest.fn().mockResolvedValue(result),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis()
  };
}

describe('WorkspaceService unit tests', () => {
  beforeEach(() => jest.clearAllMocks());

  test('createPersonalProject rejects duplicate names', async () => {
    // Existing project mock
    supabase.from.mockImplementation(() => mockSupabaseChain({ data: { projectId: 'p-1' }, error: null }));

    try {
      await WorkspaceService.createPersonalProject('w-1', null, 'My Project');
    } catch (error) {
      expect(error.message).toBe('PROJECT_NAME_EXISTS');
      expect(error.status).toBe(409);
    }
  });

  test('uploadPersonalMaterial rejects files over 50MB', async () => {
    const hugeSize = 51 * 1024 * 1024; // 51 MB
    try {
      await WorkspaceService.uploadPersonalMaterial('p-1', Buffer.from(''), 'test.pdf', 'application/pdf', hugeSize);
    } catch (error) {
      expect(error.message).toBe('FILE_TOO_LARGE');
      expect(error.status).toBe(400);
    }
  });

  test('uploadPersonalMaterial succeeds and saves metadata', async () => {
    const normalSize = 10 * 1024 * 1024; // 10 MB
    
    // Mock Storage
    const uploadMock = jest.fn().mockResolvedValue({ data: {}, error: null });
    const getPublicUrlMock = jest.fn().mockReturnValue({ data: { publicUrl: 'http://link' } });
    supabase.storage.from.mockReturnValue({ upload: uploadMock, getPublicUrl: getPublicUrlMock });

    // Mock DB Insert
    const insertMock = mockSupabaseChain({ data: { materialId: 'm-1' }, error: null });
    supabase.from.mockImplementation(() => insertMock);

    const result = await WorkspaceService.uploadPersonalMaterial('p-1', Buffer.from(''), 'doc.pdf', 'application/pdf', normalSize);
    
    expect(uploadMock).toHaveBeenCalled();
    expect(insertMock.insert).toHaveBeenCalled();
    expect(result.materialId).toBe('m-1');
  });
});