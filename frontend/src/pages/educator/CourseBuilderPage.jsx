import {
  useEffect,
  useState
} from 'react';

import {
  useNavigate,
  useParams
} from 'react-router';

import {
  createCourse,
  getCourses,
  updateCourse
} from '../../features/classroom/courseApi';



export default function CourseBuilderPage() {
  const navigate =
    useNavigate();

  const {
    courseId:
      routeCourseId
  } = useParams();


  const courseId =
    routeCourseId || null;


  const isEditMode =
    Boolean(courseId);


  const [
    subjectName,
    setSubjectName
  ] = useState('');


  const [
    courseCode,
    setCourseCode
  ] = useState('');


  const [
    description,
    setDescription
  ] = useState('');


  const [
    enrollmentCode,
    setEnrollmentCode
  ] = useState('');


  const [
    status,
    setStatus
  ] = useState(
    'ACTIVE'
  );


  const [
    errors,
    setErrors
  ] = useState({});

  const [
    formError,
    setFormError
  ] = useState('');


  useEffect(() => {
    if (!isEditMode) {
      return;
    }


    let cancelled = false;


    async function loadCourse() {
      try {
        const result =
          await getCourses();


        const courses =
          Array.isArray(
            result?.courses
          )
            ? result.courses
            : [];


        const course =
          courses.find(
            (item) =>
              String(
                item.courseId
              ) ===
              String(courseId)
          );


        if (
          cancelled
        ) {
          return;
        }


        if (!course) {
          console.error(
            'Course not found.'
          );

          return;
        }


        setSubjectName(
          course.subjectName ||
          ''
        );


        setCourseCode(
          course.courseCode ||
          ''
        );


        setDescription(
          course.description ||
          ''
        );


        setEnrollmentCode(
          course.enrollmentCode ||
          ''
        );


        setStatus(
          course.status ||
          'ACTIVE'
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            'Unable to load course:',
            error
          );
        }
      }
    }


    loadCourse();


    return () => {
      cancelled = true;
    };
  }, [
    courseId,
    isEditMode
  ]);


  function validateForm() {
    const nextErrors = {};


    if (
      !subjectName.trim()
    ) {
      nextErrors.subjectName =
        'Subject name is required.';
    }


    if (
      !courseCode.trim()
    ) {
      nextErrors.courseCode =
        'Course code is required.';
    }

    const hasErrors =
      Object.keys(
        nextErrors
      ).length > 0;

    setErrors(
      nextErrors
    );

    setFormError(
      hasErrors
        ? 'Please complete all required fields.'
        : ''
    );


    return !hasErrors;
  }


  function handleCancel() {
    navigate(
      '/educator/courses'
    );
  }


  async function handleSave() {
    if (!validateForm()) {
      return;
    }


    const payload = {
      subjectName:
        subjectName.trim(),

      courseCode:
        courseCode.trim(),

      description:
        description.trim()
    };


    try {
      if (!isEditMode) {
        const result =
          await createCourse(
            payload
          );


        const newCourse =
          result.course;


        navigate(
          `/educator/courses/${newCourse.courseId}`
        );


        return;
      }


      const result =
        await updateCourse(
          courseId,
          payload
        );


      const updatedCourse =
        result.course;


      navigate(
        `/educator/courses/${updatedCourse.courseId}`
      );
    } catch (error) {
      console.error(
        isEditMode
          ? 'Unable to update course:'
          : 'Unable to create course:',
        error
      );


      setFormError(
        error.message ||
        (
          isEditMode
            ? 'Unable to update course.'
            : 'Unable to create course.'
        )
      );
    }
  }


  const isArchived =
    status ===
    'ARCHIVED';


  return (
    <>
      {/* TOPBAR */}
      <header
        className="
          h-16
          bg-white
          border-b
          border-gray-100
          flex
          items-center
          justify-between
          px-6
          flex-shrink-0
        "
      >
        <div>
          <h1
            className="
              text-lg
              font-bold
              text-gray-800
            "
          >
            {
              isEditMode
                ? 'Edit Course'
                : 'Create Course'
            }
          </h1>

          <p
            className="
              text-xs
              text-gray-400
              mt-0.5
            "
          >
            {
              isEditMode
                ? 'Update course information.'
                : 'Create a new course for your learners.'
            }
          </p>
        </div>


        <div
          className="
            flex
            items-center
            gap-3
          "
        >
          <button
            type="button"
            onClick={
              handleCancel
            }
            className="
              text-xs
              font-semibold
              text-gray-600
              bg-gray-100
              px-4
              py-2
              rounded-lg
              hover:bg-gray-200
            "
          >
            Cancel
          </button>


          <button
            type="button"
            onClick={
              handleSave
            }
            disabled={
              isArchived
            }
            className={`
              text-white
              text-xs
              font-semibold
              px-4
              py-2
              rounded-lg
              shadow-sm

              ${
                isArchived
                  ? `
                    bg-gray-400
                    cursor-not-allowed
                  `
                  : `
                    bg-blue-600
                    hover:bg-blue-700
                  `
              }
            `}
          >
            {
              isEditMode
                ? 'Save Changes'
                : 'Save Course'
            }
          </button>
        </div>
      </header>


      {/* CONTENT */}
      <main
        className="
          flex-1
          overflow-y-auto
          p-6
        "
      >
        <div
          className="
            max-w-4xl
            mx-auto
            space-y-6
          "
        >

          {/* ARCHIVED NOTICE */}
          {isArchived && (
            <div
              className="
                bg-amber-50
                border
                border-amber-200
                text-amber-800
                text-sm
                rounded-xl
                px-4
                py-3
              "
            >
              This course is archived
              and can no longer be
              edited.
            </div>
          )}

          {/* FORM ERROR */}
          {formError && (
            <div
              className="
                bg-red-50
                border
                border-red-200
                text-red-700
                text-sm
                rounded-xl
                px-4
                py-3
              "
            >
              {formError}
            </div>
          )}
          
          {/* COURSE INFORMATION */}
          <section
            className="
              bg-white
              rounded-xl
              border
              border-gray-100
              shadow-sm
            "
          >
            <div
              className="
                px-6
                py-4
                border-b
                border-gray-100
              "
            >
              <h2
                className="
                  text-base
                  font-bold
                  text-gray-800
                "
              >
                Course Information
              </h2>

              <p
                className="
                  text-xs
                  text-gray-400
                  mt-1
                "
              >
                Enter the basic
                information for this
                course.
              </p>
            </div>


            <div
              className="
                p-6
                space-y-5
              "
            >

              {/* SUBJECT NAME */}
              <div>
                <label
                  htmlFor="subject-name"
                  className="
                    block
                    text-sm
                    font-semibold
                    text-gray-700
                  "
                >
                  Subject Name
                  <span
                    className="
                      text-red-500
                      ml-1
                    "
                  >
                    *
                  </span>
                </label>


                <input
                  id="subject-name"
                  type="text"
                  value={
                    subjectName
                  }
                  disabled={
                    isArchived
                  }
                  onChange={
                    (event) => {
                      setSubjectName(
                        event.target.value
                      );


                      setErrors(
                        (previous) => ({
                          ...previous,
                          subjectName: null
                        })
                      );


                      setFormError('');
                    }
                  }
                  placeholder="e.g., Introduction to Programming"
                  className={`
                    mt-2
                    w-full
                    rounded-lg
                    border
                    px-3
                    py-2.5
                    text-sm
                    text-gray-700
                    outline-none
                    focus:ring-1
                    focus:ring-blue-300

                    ${
                      errors.subjectName
                        ? `
                          border-red-400
                          bg-red-50/30
                        `
                        : `
                          border-gray-200
                        `
                    }

                    ${
                      isArchived
                        ? `
                          bg-gray-100
                          cursor-not-allowed
                        `
                        : ''
                    }
                  `}
                />


                {errors.subjectName && (
                  <p
                    className="
                      text-xs
                      text-red-500
                      mt-1
                    "
                  >
                    {
                      errors
                        .subjectName
                    }
                  </p>
                )}
              </div>


              {/* COURSE CODE */}
              <div>
                <label
                  htmlFor="course-code"
                  className="
                    block
                    text-sm
                    font-semibold
                    text-gray-700
                  "
                >
                  Course Code
                  <span
                    className="
                      text-red-500
                      ml-1
                    "
                  >
                    *
                  </span>
                </label>


                <input
                  id="course-code"
                  type="text"
                  value={
                    courseCode
                  }
                  disabled={
                    isArchived
                  }
                  onChange={
                    (event) => {
                      setCourseCode(
                        event.target.value
                      );


                      setErrors(
                        (previous) => ({
                          ...previous,
                          courseCode: null
                        })
                      );


                      setFormError('');
                    }
                  }
                  placeholder="e.g., CS101"
                  className={`
                    mt-2
                    w-full
                    rounded-lg
                    border
                    px-3
                    py-2.5
                    text-sm
                    text-gray-700
                    outline-none
                    focus:ring-1
                    focus:ring-blue-300

                    ${
                      errors.courseCode
                        ? `
                          border-red-400
                          bg-red-50/30
                        `
                        : `
                          border-gray-200
                        `
                    }

                    ${
                      isArchived
                        ? `
                          bg-gray-100
                          cursor-not-allowed
                        `
                        : ''
                    }
                  `}
                />


                {errors.courseCode && (
                  <p
                    className="
                      text-xs
                      text-red-500
                      mt-1
                    "
                  >
                    {
                      errors
                        .courseCode
                    }
                  </p>
                )}


                <p
                  className="
                    text-[11px]
                    text-gray-400
                    mt-1
                  "
                >
                  The course code
                  identifies the course,
                  for example CS101.
                  It is different from
                  the enrollment code.
                </p>
              </div>


              {/* DESCRIPTION */}
              <div>
                <label
                  htmlFor="course-description"
                  className="
                    block
                    text-sm
                    font-semibold
                    text-gray-700
                  "
                >
                  Description
                </label>


                <textarea
                  id="course-description"
                  rows={7}
                  value={
                    description
                  }
                  disabled={
                    isArchived
                  }
                  onChange={
                    (event) =>
                      setDescription(
                        event
                          .target
                          .value
                      )
                  }
                  placeholder="Describe the course content and learning objectives..."
                  className={`
                    mt-2
                    w-full
                    rounded-lg
                    border
                    border-gray-200
                    px-3
                    py-2.5
                    text-sm
                    text-gray-700
                    outline-none
                    resize-y
                    focus:ring-1
                    focus:ring-blue-300

                    ${
                      isArchived
                        ? `
                          bg-gray-100
                          cursor-not-allowed
                        `
                        : ''
                    }
                  `}
                />
              </div>
            </div>
          </section>


          {/* SYSTEM INFORMATION */}
          <section
            className="
              bg-white
              rounded-xl
              border
              border-gray-100
              shadow-sm
            "
          >
            <div
              className="
                px-6
                py-4
                border-b
                border-gray-100
              "
            >
              <h2
                className="
                  text-base
                  font-bold
                  text-gray-800
                "
              >
                System Information
              </h2>
            </div>


            <div
              className="
                p-6
                grid
                grid-cols-2
                gap-5
              "
            >

              {/* ENROLLMENT CODE */}
              <div>
                <p
                  className="
                    text-xs
                    font-semibold
                    text-gray-500
                    uppercase
                  "
                >
                  Enrollment Code
                </p>


                {isEditMode ? (
                  <div
                    className="
                      mt-2
                      bg-gray-50
                      border
                      border-gray-200
                      rounded-lg
                      px-3
                      py-2.5
                    "
                  >
                    <span
                      className="
                        text-sm
                        font-bold
                        tracking-wider
                        text-gray-700
                      "
                    >
                      {
                        enrollmentCode ||
                        'Not available'
                      }
                    </span>
                  </div>
                ) : (
                  <p
                    className="
                      mt-2
                      text-sm
                      text-gray-400
                    "
                  >
                    Generated
                    automatically after
                    the course is saved.
                  </p>
                )}
              </div>


              {/* STATUS */}
              <div>
                <p
                  className="
                    text-xs
                    font-semibold
                    text-gray-500
                    uppercase
                  "
                >
                  Status
                </p>


                <div className="mt-2">
                  <span
                    className={`
                      inline-flex
                      items-center
                      rounded-full
                      px-3
                      py-1
                      text-xs
                      font-bold

                      ${
                        status ===
                        'ACTIVE'
                          ? `
                            bg-green-100
                            text-green-700
                          `
                          : `
                            bg-gray-100
                            text-gray-600
                          `
                      }
                    `}
                  >
                    {status}
                  </span>
                </div>
              </div>
            </div>
          </section>


          {/* BOTTOM ACTIONS */}
          <div
            className="
              flex
              items-center
              justify-end
              gap-3
              pb-6
            "
          >
            <button
              type="button"
              onClick={
                handleCancel
              }
              className="
                text-sm
                font-semibold
                text-gray-600
                bg-white
                border
                border-gray-200
                px-5
                py-2.5
                rounded-lg
                hover:bg-gray-50
              "
            >
              Cancel
            </button>


            <button
              type="button"
              onClick={
                handleSave
              }
              disabled={
                isArchived
              }
              className={`
                text-sm
                font-semibold
                text-white
                px-5
                py-2.5
                rounded-lg
                shadow-sm

                ${
                  isArchived
                    ? `
                      bg-gray-400
                      cursor-not-allowed
                    `
                    : `
                      bg-blue-600
                      hover:bg-blue-700
                    `
                }
              `}
            >
              {
                isEditMode
                  ? 'Save Changes'
                  : 'Save Course'
              }
            </button>
          </div>
        </div>
      </main>
    </>
  );
}