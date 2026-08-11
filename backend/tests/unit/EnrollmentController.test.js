jest.mock('../../service/EnrollmentService', () => ({
  requestEnrollment: jest.fn(),
  getCourseMembers: jest.fn(),
  approveEnrollment: jest.fn()
}));

const EnrollmentController = require('../../controllers/EnrollmentController');
const EnrollmentService = require('../../service/EnrollmentService');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('EnrollmentController unit tests', () => {
  beforeEach(() => jest.clearAllMocks());

  test('joinClass() returns 201 on success', async () => {
    const req = { user: { userId: 'l-1' }, body: { enrollmentCode: 'CODE123' } };
    const res = mockRes();
    EnrollmentService.requestEnrollment.mockResolvedValue({
      enrollment: { enrollmentId: 'en-1', status: 'PENDING' },
      course: { subjectName: 'Math', courseCode: 'M101' }
    });

    await EnrollmentController.joinClass(req, res);

    expect(EnrollmentService.requestEnrollment).toHaveBeenCalledWith('l-1', 'CODE123');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('approveEnrollment() returns 200', async () => {
    const req = { user: { userId: 'e-1' }, params: { enrollmentId: 'en-1' } };
    const res = mockRes();
    EnrollmentService.approveEnrollment.mockResolvedValue({
      enrollment: { enrollmentId: 'en-1', status: 'APPROVED' },
      workspace: { provisioned: true }
    });

    await EnrollmentController.approveEnrollment(req, res);

    expect(EnrollmentService.approveEnrollment).toHaveBeenCalledWith('en-1', 'e-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Enrollment approved successfully.'
    }));
  });
});