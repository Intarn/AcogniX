import {
  useEffect,
  useState
} from 'react';

import {
  Link,
  useParams
} from 'react-router-dom';

import {
  getCourses
} from '../../services/courseService';

import {
  getCourseMaterials
} from '../../features/classroom/courseContentApi';


function formatDateTime(value) {
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


function formatFileSize(bytes) {
  const value =
    Number(bytes);

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return '';
  }

  if (value < 1024) {
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


function getFileTypeLabel(fileType) {
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


export default function CourseMaterials() {
  const {
    courseId
  } = useParams();


  const [
    course,
    setCourse
  ] = useState(null);


  const [
    materials,
    setMaterials
  ] = useState([]);


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
      setLoading(false);

      setLoadError(
        'Course ID is missing.'
      );

      return;
    }


    let cancelled =
      false;


    async function loadPage() {
      try {
        setLoading(true);

        setLoadError('');


        const [
          courseResult,
          materialResult
        ] =
          await Promise.all([
            getCourses(),

            getCourseMaterials(
              courseId
            )
          ]);


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


        const loadedMaterials =
          Array.isArray(
            materialResult?.materials
          )
            ? materialResult.materials
            : [];


        if (cancelled) {
          return;
        }


        setCourse(
          foundCourse
        );

        setMaterials(
          loadedMaterials
        );

      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          'Unable to load course materials:',
          error
        );

        setCourse(null);

        setMaterials([]);

        setLoadError(
          error.message ||
          'Unable to load course materials.'
        );

      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }


    loadPage();


    return () => {
      cancelled = true;
    };

  }, [
    courseId
  ]);


  function handleOpenMaterial(
    material
  ) {
    const resourceUrl =
      String(
        material?.resourceUrl ||
        ''
      ).trim();


    if (!resourceUrl) {
      alert(
        'This material is unavailable.'
      );

      return;
    }


    /*
    * resourceUrl của FILE phải là
    * URL hoàn chỉnh do backend trả về.
    *
    * Ví dụ:
    * https://xxxx.supabase.co/storage/...
    */
    if (
      material.resourceType ===
        'FILE' &&
      !/^https?:\/\//i.test(
        resourceUrl
      )
    ) {
      console.error(
        'Invalid material file URL:',
        resourceUrl
      );

      alert(
        'The material file URL is invalid.'
      );

      return;
    }


    /*
    * Với external link, nếu Educator
    * nhập thiếu http:// hoặc https://
    * thì thêm https://.
    */
    const openUrl =
      material.resourceType ===
        'LINK' &&
      !/^https?:\/\//i.test(
        resourceUrl
      )
        ? `https://${resourceUrl}`
        : resourceUrl;


    window.open(
      openUrl,
      '_blank',
      'noopener,noreferrer'
    );
  }


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
          Loading course materials...
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
            font-semibold
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
    return null;
  }


  return (
    <>
      {/* TOPBAR */}
      <header
        className="
          min-h-16
          bg-white
          border-b
          border-gray-100
          flex
          items-center
          px-6
          py-3
        "
      >
        <div>
          <div
            className="
              flex
              items-center
              gap-2
              text-xs
              text-gray-400
              mb-1
            "
          >
            <Link
              to="/learner/my-courses"
              className="
                hover:text-blue-600
              "
            >
              My Courses
            </Link>

            <span>/</span>

            <Link
              to={
                `/learner/courses/${course.courseId}`
              }
              className="
                hover:text-blue-600
              "
            >
              {course.subjectName}
            </Link>

            <span>/</span>

            <span>
              Course Materials
            </span>
          </div>


          <h1
            className="
              text-lg
              font-bold
              text-gray-800
            "
          >
            Course Materials
          </h1>
        </div>
      </header>


      {/* MAIN */}
      <main
        className="
          flex-1
          p-6
          bg-gray-50
          overflow-y-auto
        "
      >
        <section
          className="
            bg-white
            rounded-xl
            border
            border-gray-100
            shadow-sm
            overflow-hidden
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
              Learning Materials
            </h2>

            <p
              className="
                text-xs
                text-gray-400
                mt-1
              "
            >
              Materials shared by your
              educator for {course.subjectName}.
            </p>
          </div>


          <div className="p-6">
            {materials.length === 0 ? (
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
                  📄
                </div>

                <p
                  className="
                    text-sm
                    font-semibold
                    text-gray-600
                  "
                >
                  No course materials yet.
                </p>

                <p
                  className="
                    text-xs
                    text-gray-400
                    mt-1
                  "
                >
                  Materials uploaded by your
                  educator will appear here.
                </p>
              </div>

            ) : (
              <div className="space-y-3">
                {materials.map(
                  (material) => {
                    const fileSize =
                      formatFileSize(
                        material.sizeBytes
                      );


                    const typeLabel =
                      material.resourceType ===
                      'LINK'
                        ? 'External Link'
                        : getFileTypeLabel(
                            material.fileType
                          );


                    return (
                      <article
                        key={
                          material.materialId
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
                              flex
                              items-center
                              justify-center
                              flex-shrink-0
                            "
                          >
                            {
                              material.resourceType ===
                              'LINK'
                                ? '🔗'
                                : '📄'
                            }
                          </div>


                          <div className="min-w-0">
                            <h3
                              className="
                                text-sm
                                font-bold
                                text-gray-800
                              "
                            >
                              {
                                material.title ||
                                'Untitled Material'
                              }
                            </h3>


                            {material.description && (
                              <p
                                className="
                                  text-xs
                                  text-gray-500
                                  mt-1
                                  line-clamp-2
                                "
                              >
                                {
                                  material.description
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
                                {typeLabel}
                              </span>


                              {fileSize && (
                                <>
                                  <span>•</span>

                                  <span>
                                    {fileSize}
                                  </span>
                                </>
                              )}


                              {material.uploadedAt && (
                                <>
                                  <span>•</span>

                                  <span>
                                    {
                                      formatDateTime(
                                        material.uploadedAt
                                      )
                                    }
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>


                        {material.resourceUrl ? (
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
                              material.resourceType ===
                              'LINK'
                                ? 'Open Link'
                                : 'Open'
                            }
                          </button>

                        ) : (
                          <span
                            className="
                              text-xs
                              text-red-400
                              font-semibold
                            "
                          >
                            Unavailable
                          </span>
                        )}
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}