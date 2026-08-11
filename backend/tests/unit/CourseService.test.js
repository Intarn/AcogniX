jest.mock('../../config/supabaseClient', () => ({
  from: jest.fn()
}));

const supabase = require('../../config/supabaseClient');
const CourseService = require('../../service/CourseService');
const { CourseStatus } = require('../../enums/CourseEnums');

function mockSupabaseChain(result) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis()
  };
}

describe('CourseService unit tests', () => {
  beforeEach(() => jest.clearAllMocks());

  test('createCourse successfully creates an active course', async () => {
    const insertMock = mockSupabaseChain({ data: { courseId: 'c-1' }, error: null });
    supabase.from.mockImplementation(() => insertMock);

    const result = await CourseService.createCourse('e-1', { subjectName: 'Math', courseCode: 'M101' });

    expect(insertMock.insert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        educatorId: 'e-1',
        subjectName: 'Math',
        status: CourseStatus.ACTIVE,
        enrollmentCode: expect.any(String) // Randomly generated
      })
    ]));
    expect(result.courseId).toBe('c-1');
  });

  test('archiveCourse sets status to ARCHIVED', async () => {
    // Mock getOwnedCourse -> course exists
    supabase.from.mockImplementationOnce(() => mockSupabaseChain({ data: { courseId: 'c-1', status: CourseStatus.ACTIVE }, error: null }));
    // Mock update
    const updateMock = mockSupabaseChain({ data: { courseId: 'c-1', status: CourseStatus.ARCHIVED }, error: null });
    supabase.from.mockImplementationOnce(() => updateMock);

    const result = await CourseService.archiveCourse('c-1', 'e-1');

    expect(updateMock.update).toHaveBeenCalledWith(expect.objectContaining({ status: CourseStatus.ARCHIVED }));
    expect(result.status).toBe(CourseStatus.ARCHIVED);
  });
});