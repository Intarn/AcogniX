// frontend/src/pages/learner/CourseDetail.jsx
import {
  useEffect,
  useState
} from 'react';

import {
  Link,
  useSearchParams
} from 'react-router-dom';

import {
  getCourses
} from '../../services/courseService';

import {
  getCourseAnnouncements,
  getCourseMaterials
} from '../../features/classroom/courseContentApi';

import {
  getLearnerAssessments
} from '../../services/assessmentService';

function getFileTypeLabel(
  fileType
) {
  if (!fileType) {
    return 'File';
  }

  if (
    fileType ===
    'application/pdf'
  ) {
    return 'PDF';
  }

  if (
    fileType ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'DOCX';
  }

  return fileType;
}


function formatDateTime(
  value
) {
  if (!value) {
    return '';
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }


  return date.toLocaleString(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',

      hour: 'numeric',
      minute: '2-digit'
    }
  );
}

function formatFileSize(
  bytes
) {
  const value =
    Number(bytes);


  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return '';
  }


  if (
    value < 1024
  ) {
    return `${value} B`;
  }


  if (
    value <
    1024 * 1024
  ) {
    return `${Math.ceil(
      value / 1024
    )} KB`;
  }


  return `${(
    value /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

export default function CourseDetail() {
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('id');

  const [
    course,
    setCourse
  ] = useState(null);


  const [
    announcements,
    setAnnouncements
  ] = useState([]);


  const [
    materials,
    setMaterials
  ] = useState([]);

  const [
    assessments,
    setAssessments
  ] = useState([]);

  const [
    activeTab,
    setActiveTab
  ] = useState(
    'Announcements'
  );


  const [
    loading,
    setLoading
  ] = useState(true);


  const [
    loadError,
    setLoadError
  ] = useState('');

  useEffect(() => {
    if (!courseId) {
      setCourse(null);
      setAnnouncements([]);
      setMaterials([]);
      setAssessments([]);

      setLoadError(
        'Course ID is missing.'
      );

      setLoading(false);

      return;
    }


    let cancelled = false;


    async function loadCourseDetail() {
      try {
        setLoading(true);

        setLoadError('');


        const [
          courseResult,
          announcementResult,
          materialResult,
          assessmentResult
        ] =
          await Promise.all([
            getCourses(),

            getCourseAnnouncements(
              courseId
            ),

            getCourseMaterials(
              courseId
            ),

            getLearnerAssessments()
          ]);


        /*
        * GET /api/enrollment
        * returns:
        *
        * {
        *   count: ...,
        *   courses: [...]
        * }
        */
        const courseList =
          Array.isArray(
            courseResult?.courses
          )
            ? courseResult.courses
            : [];


        const foundCourse =
          courseList.find(
            (item) =>
              String(
                item.courseId
              ) ===
              String(
                courseId
              )
          ) || null;


        if (!foundCourse) {
          throw new Error(
            'Course not found or you do not have access to this course.'
          );
        }


        /*
        * GET
        * /api/courses/:courseId/announcements
        *
        * returns:
        *
        * {
        *   announcements: [...]
        * }
        */
        const loadedAnnouncements =
          Array.isArray(
            announcementResult
              ?.announcements
          )
            ? announcementResult
                .announcements
            : [];


        /*
        * GET
        * /api/courses/:courseId/materials
        *
        * returns:
        *
        * {
        *   materials: [...]
        * }
        */
        const loadedMaterials =
          Array.isArray(
            materialResult
              ?.materials
          )
            ? materialResult
                .materials
            : [];
          
        
        const allAssessments =
          Array.isArray(
            assessmentResult
          )
            ? assessmentResult
            : (
                Array.isArray(
                  assessmentResult
                    ?.assessments
                )
                  ? assessmentResult
                      .assessments
                  : []
              );


        const loadedAssessments =
          allAssessments.filter(
            (assessment) =>
              String(
                assessment.courseId
              ) ===
              String(
                courseId
              )
          );


        if (cancelled) {
          return;
        }


        setCourse(
          foundCourse
        );


        setAnnouncements(
          loadedAnnouncements
        );


        setMaterials(
          loadedMaterials
        );

        setAssessments(
          loadedAssessments
        );

    } catch (error) {
        if (cancelled) {
          return;
        }


        console.error(
          'Unable to load learner course:',
          error
        );


        setCourse(null);

        setAnnouncements([]);

        setMaterials([]);
        setAssessments([]);


        setLoadError(
          error.message ||
          'Unable to load course content.'
        );

      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }


    loadCourseDetail();


    return () => {
      cancelled = true;
    };

  }, [courseId]);

  if (loading) {
    return (
      <div
        className="
          flex-1
          flex
          items-center
          justify-center
          p-8
          bg-gray-50
        "
      >
        <p
          className="
            text-sm
            text-gray-500
          "
        >
          Loading course content...
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className="
          flex-1
          flex
          flex-col
          items-center
          justify-center
          p-8
          bg-gray-50
        "
      >
        <p
          className="
            text-sm
            text-red-500
          "
        >
          {loadError}
        </p>


        <Link
          to="/learner/my-courses"
          className="
            mt-3
            text-sm
            text-blue-600
            hover:underline
          "
        >
          Back to My Courses
        </Link>
      </div>
    );
  }

  if (!course) {
    return (
      <div
        className="
          flex-1
          flex
          flex-col
          items-center
          justify-center
          p-8
          bg-gray-50
        "
      >
        <p
          className="
            text-sm
            text-gray-500
          "
        >
          Course not found.
        </p>


        <Link
          to="/learner/my-courses"
          className="
            mt-3
            text-sm
            text-blue-600
            hover:underline
          "
        >
          Back to My Courses
        </Link>
      </div>
    );
  }

  return (
    <main
      className="
        flex-1
        min-h-full
        bg-gray-50
        p-6
        overflow-y-auto
      "
    >
      <div
        className="
          max-w-6xl
          mx-auto
          space-y-5
        "
      >

        {/* =========================
            BREADCRUMB
        ========================= */}
        <div
          className="
            flex
            items-center
            gap-2
            text-xs
            text-gray-500
          "
        >
          <Link
            to="/learner/my-courses"
            className="
              hover:text-blue-600
              transition-colors
            "
          >
            My Courses
          </Link>


          <span>
            /
          </span>


          <span
            className="
              text-gray-700
            "
          >
            {
              course.subjectName ||
              'Course'
            }
          </span>
        </div>


        {/* =========================
            COURSE INFORMATION
        ========================= */}
        <section
          className="
            bg-white
            border
            border-gray-100
            rounded-2xl
            shadow-sm
            p-6
          "
        >
          <div
            className="
              flex
              items-start
              justify-between
              gap-5
            "
          >
            <div
              className="
                min-w-0
              "
            >
              <div
                className="
                  flex
                  flex-wrap
                  items-center
                  gap-2
                  mb-3
                "
              >
                <span
                  className="
                    inline-flex
                    px-2.5
                    py-1
                    rounded-full
                    bg-blue-50
                    text-blue-600
                    text-xs
                    font-semibold
                  "
                >
                  {
                    course.courseCode ||
                    'Course'
                  }
                </span>


                {course.status && (
                  <span
                    className="
                      inline-flex
                      px-2.5
                      py-1
                      rounded-full
                      bg-gray-100
                      text-gray-600
                      text-xs
                      font-semibold
                    "
                  >
                    {
                      course.status
                    }
                  </span>
                )}
              </div>


              <h1
                className="
                  text-2xl
                  font-bold
                  text-gray-900
                "
              >
                {
                  course.subjectName ||
                  'Untitled Course'
                }
              </h1>


              <p
                className="
                  text-sm
                  text-gray-500
                  mt-2
                "
              >
                By{' '}
                {
                  course.educator
                    ?.displayName ||
                  course.educator
                    ?.email ||
                  'Unknown Educator'
                }
              </p>


              {course.description && (
                <p
                  className="
                    text-sm
                    text-gray-600
                    mt-4
                    max-w-3xl
                    leading-relaxed
                  "
                >
                  {
                    course.description
                  }
                </p>
              )}
            </div>
          </div>
        </section>


        {/* =========================
            CLASS CONTENT
        ========================= */}
        <section
          className="
            bg-white
            border
            border-gray-100
            rounded-2xl
            shadow-sm
            overflow-hidden
          "
        >

          {/* =====================
              TABS
          ===================== */}
          <div
            className="
              flex
              border-b
              border-gray-100
            "
          >
            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  'Announcements'
                )
              }
              className={`
                px-6
                py-4
                text-sm
                font-semibold
                border-b-2
                transition

                ${
                  activeTab ===
                  'Announcements'
                    ? `
                      border-blue-600
                      text-blue-600
                    `
                    : `
                      border-transparent
                      text-gray-500
                      hover:text-gray-700
                    `
                }
              `}
            >
              Announcements

              <span
                className="
                  ml-2
                  px-2
                  py-0.5
                  rounded-full
                  bg-gray-100
                  text-[10px]
                  text-gray-500
                "
              >
                {
                  announcements.length
                }
              </span>
            </button>


            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  'Materials'
                )
              }
              className={`
                px-6
                py-4
                text-sm
                font-semibold
                border-b-2
                transition

                ${
                  activeTab ===
                  'Materials'
                    ? `
                      border-blue-600
                      text-blue-600
                    `
                    : `
                      border-transparent
                      text-gray-500
                      hover:text-gray-700
                    `
                    
                }
              `}
            >
              Course Materials

              <span
                className="
                  ml-2
                  px-2
                  py-0.5
                  rounded-full
                  bg-gray-100
                  text-[10px]
                  text-gray-500
                "
              >
                {
                  materials.length
                }
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  'Assessments'
                )
              }
              className={`
                px-6
                py-4
                text-sm
                font-semibold
                border-b-2
                transition

                ${
                  activeTab ===
                  'Assessments'
                    ? `
                      border-blue-600
                      text-blue-600
                    `
                    : `
                      border-transparent
                      text-gray-500
                      hover:text-gray-700
                    `
                }
              `}
            >
              Assessments

              <span
                className="
                  ml-2
                  px-2
                  py-0.5
                  rounded-full
                  bg-gray-100
                  text-[10px]
                  text-gray-500
                "
              >
                {assessments.length}
              </span>
            </button>
          </div>


          {/* =====================
              ANNOUNCEMENTS TAB
          ===================== */}
          {activeTab ===
            'Announcements' && (
            <div
              className="
                p-6
              "
            >
              <div
                className="
                  mb-5
                "
              >
                <h2
                  className="
                    text-lg
                    font-bold
                    text-gray-800
                  "
                >
                  Announcements
                </h2>


                <p
                  className="
                    text-xs
                    text-gray-500
                    mt-1
                  "
                >
                  Updates from your educator
                </p>
              </div>


              {announcements.length ===
              0 ? (
                /*
                 * UC-16 Alternative Flow:
                 * no announcement yet.
                 */
                <div
                  className="
                    py-16
                    text-center
                  "
                >
                  <div
                    className="
                      w-12
                      h-12
                      mx-auto
                      rounded-full
                      bg-blue-50
                      flex
                      items-center
                      justify-center
                      mb-3
                    "
                  >
                    <span
                      className="
                        text-xl
                      "
                    >
                      📢
                    </span>
                  </div>


                  <p
                    className="
                      text-sm
                      font-semibold
                      text-gray-600
                    "
                  >
                    No announcements yet.
                  </p>


                  <p
                    className="
                      text-xs
                      text-gray-400
                      mt-1
                    "
                  >
                    Updates from your educator
                    will appear here.
                  </p>
                </div>

              ) : (
                <div
                  className="
                    space-y-3
                  "
                >
                  {announcements.map(
                    (
                      announcement
                    ) => (
                      <article
                        key={
                          announcement
                            .announcementId
                        }
                        className="
                          border
                          border-gray-100
                          rounded-xl
                          p-4
                          bg-gray-50/50
                        "
                      >
                        <div
                          className="
                            flex
                            items-start
                            gap-3
                          "
                        >
                          <div
                            className="
                              w-10
                              h-10
                              rounded-lg
                              bg-blue-100
                              text-blue-600
                              flex
                              items-center
                              justify-center
                              flex-shrink-0
                            "
                          >
                            📢
                          </div>


                          <div
                            className="
                              flex-1
                              min-w-0
                            "
                          >
                            <div
                              className="
                                flex
                                flex-wrap
                                items-start
                                justify-between
                                gap-2
                              "
                            >
                              <h3
                                className="
                                  text-sm
                                  font-bold
                                  text-gray-800
                                "
                              >
                                {
                                  announcement
                                    .title
                                }
                              </h3>


                              <span
                                className="
                                  text-[11px]
                                  text-gray-400
                                "
                              >
                                {
                                  formatDateTime(
                                    announcement
                                      .publishedAt
                                  )
                                }
                              </span>
                            </div>


                            <p
                              className="
                                text-sm
                                text-gray-600
                                mt-3
                                leading-relaxed
                                whitespace-pre-wrap
                              "
                            >
                              {
                                announcement
                                  .body
                              }
                            </p>


                            {Array.isArray(
                              announcement
                                .attachmentUrls
                            ) &&
                              announcement
                                .attachmentUrls
                                .length >
                                0 && (
                              <div
                                className="
                                  mt-4
                                  pt-3
                                  border-t
                                  border-gray-100
                                "
                              >
                                <p
                                  className="
                                    text-[11px]
                                    font-semibold
                                    text-gray-500
                                    mb-2
                                  "
                                >
                                  Attachments
                                </p>


                                <div
                                  className="
                                    flex
                                    flex-wrap
                                    gap-2
                                  "
                                >
                                  {
                                    announcement
                                      .attachmentUrls
                                      .map(
                                        (
                                          url,
                                          index
                                        ) => (
                                          <a
                                            key={
                                              `${announcement.announcementId}-${index}`
                                            }
                                            href={
                                              url
                                            }
                                            target="_blank"
                                            rel="noreferrer"
                                            className="
                                              px-3
                                              py-1.5
                                              rounded-lg
                                              bg-white
                                              border
                                              border-gray-200
                                              text-xs
                                              font-semibold
                                              text-blue-600
                                              hover:bg-blue-50
                                              transition
                                            "
                                          >
                                            Attachment{' '}
                                            {
                                              index +
                                              1
                                            }
                                          </a>
                                        )
                                      )
                                  }
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    )
                  )}
                </div>
              )}
            </div>
          )}


          {/* =====================
              MATERIALS TAB
          ===================== */}
          {activeTab ===
            'Materials' && (
            <div
              className="
                p-6
              "
            >
              <div
                className="
                  mb-5
                "
              >
                <h2
                  className="
                    text-lg
                    font-bold
                    text-gray-800
                  "
                >
                  Course Materials
                </h2>


                <p
                  className="
                    text-xs
                    text-gray-500
                    mt-1
                  "
                >
                  Materials shared by your educator
                </p>
              </div>


              {materials.length ===
              0 ? (
                /*
                 * UC-16 Alternative Flow:
                 * no material yet.
                 */
                <div
                  className="
                    py-16
                    text-center
                  "
                >
                  <div
                    className="
                      w-12
                      h-12
                      mx-auto
                      rounded-full
                      bg-blue-50
                      flex
                      items-center
                      justify-center
                      mb-3
                    "
                  >
                    <span
                      className="
                        text-xl
                      "
                    >
                      📄
                    </span>
                  </div>


                  <p
                    className="
                      text-sm
                      font-semibold
                      text-gray-600
                    "
                  >
                    No materials have been uploaded for this class.
                  </p>


                  <p
                    className="
                      text-xs
                      text-gray-400
                      mt-1
                    "
                  >
                    Materials shared by your educator
                    will appear here.
                  </p>
                </div>

              ) : (
                <div
                  className="
                    space-y-3
                  "
                >
                  {materials.map(
                    (
                      material
                    ) => {
                      const fileSize =
                        formatFileSize(
                          material
                            .sizeBytes
                        );


                      const typeLabel =
                        material
                          .resourceType ===
                        'LINK'
                          ? 'External Link'
                          : getFileTypeLabel(
                              material
                                .fileType
                            );


                      return (
                        <div
                          key={
                            material
                              .materialId
                          }
                          className="
                            border
                            border-gray-100
                            rounded-xl
                            p-4
                            flex
                            items-center
                            justify-between
                            gap-4
                            bg-white
                            hover:border-blue-200
                            hover:shadow-sm
                            transition
                          "
                        >
                          <div
                            className="
                              flex
                              items-center
                              gap-3
                              min-w-0
                            "
                          >
                            <div
                              className="
                                w-11
                                h-11
                                rounded-xl
                                bg-blue-50
                                text-blue-600
                                flex
                                items-center
                                justify-center
                                flex-shrink-0
                              "
                            >
                              <span
                                className="
                                  text-lg
                                "
                              >
                                {
                                  material
                                    .resourceType ===
                                  'LINK'
                                    ? '🔗'
                                    : '📄'
                                }
                              </span>
                            </div>


                            <div
                              className="
                                min-w-0
                              "
                            >
                              <h3
                                className="
                                  text-sm
                                  font-semibold
                                  text-gray-800
                                  truncate
                                "
                              >
                                {
                                  material
                                    .title ||
                                  'Untitled Material'
                                }
                              </h3>


                              {material
                                .description && (
                                <p
                                  className="
                                    text-xs
                                    text-gray-500
                                    mt-1
                                    line-clamp-2
                                  "
                                >
                                  {
                                    material
                                      .description
                                  }
                                </p>
                              )}


                              <div
                                className="
                                  flex
                                  flex-wrap
                                  items-center
                                  gap-2
                                  mt-2
                                  text-[11px]
                                  text-gray-400
                                "
                              >
                                <span>
                                  {
                                    typeLabel
                                  }
                                </span>


                                {fileSize && (
                                  <>
                                    <span>
                                      •
                                    </span>


                                    <span>
                                      {
                                        fileSize
                                      }
                                    </span>
                                  </>
                                )}


                                {material
                                  .uploadedAt && (
                                  <>
                                    <span>
                                      •
                                    </span>


                                    <span>
                                      {
                                        formatDateTime(
                                          material
                                            .uploadedAt
                                        )
                                      }
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>


                          {material
                            .resourceUrl ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenMaterial(
                                  material
                                )
                              }
                              className="
                                flex-shrink-0
                                px-4
                                py-2
                                rounded-lg
                                bg-blue-50
                                text-blue-600
                                text-xs
                                font-semibold
                                hover:bg-blue-100
                                transition
                              "
                            >
                              {
                                material
                                  .resourceType ===
                                'LINK'
                                  ? 'Open Link'
                                  : 'Open'
                              }
                            </button>

                          ) : (
                            <span
                              className="
                                flex-shrink-0
                                text-xs
                                font-medium
                                text-red-400
                              "
                            >
                              Unavailable
                            </span>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab ===
            'Assessments' && (
            <div className="p-6">

              <div className="mb-5">
                <h2
                  className="
                    text-lg
                    font-bold
                    text-gray-800
                  "
                >
                  Assessments
                </h2>

                <p
                  className="
                    text-xs
                    text-gray-500
                    mt-1
                  "
                >
                  Official quizzes and assignments
                  for this course.
                </p>
              </div>


              {assessments.length ===
              0 ? (
                <div
                  className="
                    py-16
                    text-center
                  "
                >
                  <div
                    className="
                      w-12
                      h-12
                      mx-auto
                      rounded-full
                      bg-emerald-50
                      flex
                      items-center
                      justify-center
                      mb-3
                    "
                  >
                    <span className="text-xl">
                      📝
                    </span>
                  </div>

                  <p
                    className="
                      text-sm
                      font-semibold
                      text-gray-600
                    "
                  >
                    No assessments are available
                    for this course.
                  </p>
                </div>

              ) : (
                <div className="space-y-3">
                  {assessments.map(
                    (assessment) => {
                      const isOpen =
                        assessment.status ===
                        'IN_PROGRESS';


                      return (
                        <div
                          key={
                            assessment
                              .assessmentId
                          }
                          className="
                            border
                            border-gray-100
                            rounded-xl
                            p-4
                            bg-white
                            flex
                            items-center
                            justify-between
                            gap-4
                            hover:border-blue-200
                            hover:shadow-sm
                            transition
                          "
                        >
                          <div
                            className="
                              flex
                              items-start
                              gap-3
                              min-w-0
                            "
                          >
                            <div
                              className="
                                w-11
                                h-11
                                rounded-xl
                                bg-emerald-50
                                flex
                                items-center
                                justify-center
                                flex-shrink-0
                              "
                            >
                              📝
                            </div>


                            <div className="min-w-0">
                              <div
                                className="
                                  flex
                                  items-center
                                  flex-wrap
                                  gap-2
                                "
                              >
                                <h3
                                  className="
                                    text-sm
                                    font-bold
                                    text-gray-800
                                  "
                                >
                                  {
                                    assessment.title
                                  }
                                </h3>


                                <span
                                  className="
                                    px-2
                                    py-0.5
                                    rounded-full
                                    bg-gray-100
                                    text-[10px]
                                    font-semibold
                                    text-gray-600
                                  "
                                >
                                  {
                                    assessment.type
                                  }
                                </span>


                                <span
                                  className="
                                    px-2
                                    py-0.5
                                    rounded-full
                                    bg-blue-50
                                    text-[10px]
                                    font-semibold
                                    text-blue-600
                                  "
                                >
                                  {
                                    assessment.status
                                  }
                                </span>
                              </div>


                              {assessment.description && (
                                <p
                                  className="
                                    text-xs
                                    text-gray-500
                                    mt-1
                                  "
                                >
                                  {
                                    assessment
                                      .description
                                  }
                                </p>
                              )}


                              <div
                                className="
                                  flex
                                  flex-wrap
                                  gap-3
                                  mt-2
                                  text-[11px]
                                  text-gray-400
                                "
                              >
                                <span>
                                  {
                                    assessment
                                      .totalPoints
                                  }{' '}
                                  points
                                </span>


                                {assessment.startTime && (
                                  <span>
                                    Starts:{' '}
                                    {
                                      formatDateTime(
                                        assessment
                                          .startTime
                                      )
                                    }
                                  </span>
                                )}


                                {assessment.deadline && (
                                  <span>
                                    Due:{' '}
                                    {
                                      formatDateTime(
                                        assessment
                                          .deadline
                                      )
                                    }
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>


                          {isOpen ? (
                            <Link
                              to={
                                `/learner/quizzes?id=${assessment.assessmentId}`
                              }
                              className="
                                flex-shrink-0
                                bg-blue-600
                                hover:bg-blue-700
                                text-white
                                text-xs
                                font-semibold
                                px-4
                                py-2
                                rounded-lg
                              "
                            >
                              Open
                            </Link>
                          ) : (
                            <span
                              className="
                                flex-shrink-0
                                text-xs
                                font-semibold
                                text-gray-400
                              "
                            >
                              {
                                assessment.status ===
                                'SCHEDULED'
                                  ? 'Not Open Yet'
                                  : 'Closed'
                              }
                            </span>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}