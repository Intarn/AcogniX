jest.mock('../../service/CourseService', () => ({
  listCoursesByEducator: jest.fn(),
  createCourse: jest.fn(),
  updateCourse: jest.fn(),
  archiveCourse: jest.fn()
}));

const CourseController = require('../../controllers/CourseController');
const CourseService = require('../../service/CourseService');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('CourseController unit tests', () => {
  beforeEach(() => jest.clearAllMocks());

  test('list() returns 200 and courses', async () => {
    const req = { user: { userId: 'e-1' } };
    const res = mockRes();
    CourseService.listCoursesByEducator.mockResolvedValue([{ courseId: 'c-1' }]);

    await CourseController.list(req, res);

    expect(CourseService.listCoursesByEducator).toHaveBeenCalledWith('e-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ courses: [{ courseId: 'c-1' }] });
  });

  test('create() returns 201 on success', async () => {
    const req = { user: { userId: 'e-1' }, body: { subjectName: 'Math', courseCode: 'M101' } };
    const res = mockRes();
    CourseService.createCourse.mockResolvedValue({ courseId: 'c-1' });

    await CourseController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: 'Course created successfully.', course: { courseId: 'c-1' } });
  });

  test('create() handles missing fields (400)', async () => {
    const req = { user: { userId: 'e-1' }, body: {} };
    const res = mockRes();
    CourseService.createCourse.mockRejectedValue(new Error('MISSING_REQUIRED_FIELDS'));

    await CourseController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Please complete all required fields.' });
  });
});