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
  getCourseAnnouncements
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


function getFileNameFromUrl(
  url,
  index
) {
  if (!url) {
    return `Attachment ${index + 1}`;
  }

  try {
    const cleanUrl =
      String(url)
        .split('?')[0];

    const fileName =
      cleanUrl
        .split('/')
        .pop();

    return (
      decodeURIComponent(
        fileName
      ) ||
      `Attachment ${index + 1}`
    );

  } catch {
    return `Attachment ${index + 1}`;
  }
}


export default function CourseAnnouncements() {
  const {
    courseId
  } = useParams();


  const [
    course,
    setCourse
  ] = useState(null);


  const [
    announcements,
    setAnnouncements
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
          announcementResult
        ] =
          await Promise.all([
            getCourses(),

            getCourseAnnouncements(
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


        const loadedAnnouncements =
          Array.isArray(
            announcementResult
              ?.announcements
          )
            ? [
                ...announcementResult
                  .announcements
              ].sort(
                (
                  first,
                  second
                ) =>
                  new Date(
                    second.publishedAt ||
                    second.createdAt ||
                    0
                  ).getTime() -
                  new Date(
                    first.publishedAt ||
                    first.createdAt ||
                    0
                  ).getTime()
              )
            : [];


        if (cancelled) {
          return;
        }


        setCourse(
          foundCourse
        );

        setAnnouncements(
          loadedAnnouncements
        );

      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          'Unable to load announcements:',
          error
        );

        setCourse(null);

        setAnnouncements([]);

        setLoadError(
          error.message ||
          'Unable to load announcements.'
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
        <p className="text-sm text-gray-500">
          Loading announcements...
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
        <p className="text-sm text-red-500">
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
              className="hover:text-blue-600"
            >
              My Courses
            </Link>

            <span>/</span>

            <Link
              to={
                `/learner/courses/${course.courseId}`
              }
              className="hover:text-blue-600"
            >
              {course.subjectName}
            </Link>

            <span>/</span>

            <span>
              Announcements
            </span>
          </div>


          <h1
            className="
              text-lg
              font-bold
              text-gray-800
            "
          >
            Announcements
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
              Classroom Announcements
            </h2>

            <p
              className="
                text-xs
                text-gray-400
                mt-1
              "
            >
              Updates and messages from
              your educator.
            </p>
          </div>


          <div className="p-6">
            {announcements.length ===
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
                    bg-amber-50
                    flex
                    items-center
                    justify-center
                    mb-3
                  "
                >
                  📢
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
                  Classroom updates will
                  appear here.
                </p>
              </div>

            ) : (
              <div className="space-y-4">
                {announcements.map(
                  (announcement) => (
                    <article
                      key={
                        announcement
                          .announcementId
                      }
                      className="
                        border
                        border-gray-100
                        rounded-xl
                        p-5
                        bg-white
                        hover:border-amber-200
                        transition
                      "
                    >
                      <div
                        className="
                          flex
                          items-start
                          gap-4
                        "
                      >
                        <div
                          className="
                            w-10
                            h-10
                            rounded-xl
                            bg-amber-50
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
                              items-start
                              justify-between
                              flex-wrap
                              gap-3
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
                                announcement.title ||
                                'Announcement'
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
                                    .publishedAt ||
                                  announcement
                                    .createdAt
                                )
                              }
                            </span>
                          </div>


                          <p
                            className="
                              text-sm
                              text-gray-600
                              leading-6
                              whitespace-pre-wrap
                              mt-3
                            "
                          >
                            {
                              announcement.body
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
                                pt-4
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
                                          href={url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="
                                            px-3
                                            py-2
                                            rounded-lg
                                            border
                                            border-gray-200
                                            text-xs
                                            font-semibold
                                            text-blue-600
                                            hover:bg-blue-50
                                            transition
                                          "
                                        >
                                          {
                                            getFileNameFromUrl(
                                              url,
                                              index
                                            )
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
        </section>
      </main>
    </>
  );
}