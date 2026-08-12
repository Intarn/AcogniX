import {
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  Link,
  useParams
} from 'react-router';

import {
  getCourses
} from '../../features/classroom/courseApi';

import {
  getCourseAnnouncements,
  publishAnnouncement
} from '../../features/classroom/courseContentApi';


function formatDateTime(value) {
  if (!value) {
    return 'N/A';
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'N/A';
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


function createEmptyForm() {
  return {
    title: '',
    body: '',
    attachments: []
  };
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


function normalizeAnnouncement(
  announcement
) {
  const rawAttachments =
    Array.isArray(
      announcement.attachments
    )
      ? announcement.attachments
      : (
          Array.isArray(
            announcement
              .attachmentUrls
          )
            ? announcement
                .attachmentUrls
            : []
        );

  const attachments =
    rawAttachments.map(
      (attachment, index) => {
        if (
          attachment &&
          typeof attachment ===
            'object'
        ) {
          return {
            ...attachment,

            name:
              attachment.name ||
              attachment.fileName ||
              getFileNameFromUrl(
                attachment.url ||
                attachment.fileUrl,
                index
              ),

            url:
              attachment.url ||
              attachment.fileUrl ||
              ''
          };
        }

        return {
          name:
            getFileNameFromUrl(
              attachment,
              index
            ),

          url:
            String(
              attachment || ''
            )
        };
      }
    );

  return {
    ...announcement,
    attachments
  };
}


export default function CourseAnnouncementsPage() {
  const {
    courseId:
      routeCourseId
  } = useParams();


  const courseId =
    routeCourseId || null;


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


  const [
    posting,
    setPosting
  ] = useState(false);


  const [
    form,
    setForm
  ] = useState(
    createEmptyForm
  );


  const [
    errors,
    setErrors
  ] = useState({});


  const [
    showCreateForm,
    setShowCreateForm
  ] = useState(false);


  const [
    showDiscardDialog,
    setShowDiscardDialog
  ] = useState(false);


  const [
    emailWarning,
    setEmailWarning
  ] = useState('');


  const [
    successMessage,
    setSuccessMessage
  ] = useState('');


  useEffect(() => {
    if (!courseId) {
      setCourse(null);
      setAnnouncements([]);
      setLoading(false);

      return;
    }

    let cancelled = false;

    async function loadPage() {
      try {
        setLoading(true);
        setLoadError('');

        const [
          courseResult,
          announcementResult
        ] = await Promise.all([
          getCourses(),
          getCourseAnnouncements(
            courseId
          )
        ]);

        const courses =
          Array.isArray(
            courseResult?.courses
          )
            ? courseResult.courses
            : [];

        const foundCourse =
          courses.find(
            (item) =>
              String(
                item.courseId
              ) ===
              String(courseId)
          ) || null;

        const loadedAnnouncements =
          Array.isArray(
            announcementResult
              ?.announcements
          )
            ? announcementResult
                .announcements
                .map(
                  normalizeAnnouncement
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
        if (!cancelled) {
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
        }
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

  const courseAnnouncements =
    useMemo(() => {
      return announcements
        .filter(
          (announcement) =>
            String(
              announcement.courseId
            ) ===
            String(courseId)
        )
        .sort(
          (first, second) =>
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
        );
    }, [
      announcements,
      courseId
    ]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-gray-500">
          Loading announcements...
        </p>
      </div>
    );
  }


  if (loadError) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-red-500">
          {loadError}
        </p>

        <Link
          to="/educator/courses"
          className="
            inline-block
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
          p-8
          text-center
        "
      >
        <p
          className="
            text-sm
            text-red-500
          "
        >
          Course not found.
        </p>


        <Link
          to="/educator/courses"
          className="
            inline-block
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


  const isArchived =
    course.status ===
    'ARCHIVED';


  function openCreateForm() {
    if (isArchived) {
      return;
    }


    setForm(
      createEmptyForm()
    );

    setErrors({});

    setEmailWarning('');

    setSuccessMessage('');

    setShowCreateForm(true);
  }


  function hasUnsavedChanges() {
    return (
      form.title.trim() !== '' ||
      form.body.trim() !== '' ||
      form.attachments.length > 0
    );
  }


  function handleCancelCreate() {
    if (
      hasUnsavedChanges()
    ) {
      setShowDiscardDialog(
        true
      );

      return;
    }


    closeCreateForm();
  }


  function closeCreateForm() {
    setForm(
      createEmptyForm()
    );

    setErrors({});

    setShowCreateForm(false);

    setShowDiscardDialog(false);
  }


  function confirmDiscard() {
    closeCreateForm();
  }


  function updateForm(
    field,
    value
  ) {
    setForm(
      (previous) => ({
        ...previous,
        [field]: value
      })
    );


    setErrors(
      (previous) => ({
        ...previous,
        [field]: null
      })
    );
  }



  function handleAttachmentChange(
    event
  ) {
    const files =
      Array.from(
        event.target.files ||
        []
      );

    const limitedFiles =
      files.slice(0, 5);

    setForm(
      (previous) => ({
        ...previous,
        attachments:
          limitedFiles
      })
    );
  }

  function validateForm() {
    const nextErrors = {};


    if (
      !form.title.trim()
    ) {
      nextErrors.title =
        'Title is required.';
    }


    if (
      !form.body.trim()
    ) {
      nextErrors.body =
        'Content is required.';
    }


    setErrors(
      nextErrors
    );


    return (
      Object.keys(
        nextErrors
      ).length === 0
    );
  }


  async function handlePostAnnouncement() {
    if (!validateForm()) {
      return;
    }

    try {
      setPosting(true);

      setEmailWarning('');
      setSuccessMessage('');

      const formData =
        new FormData();

      formData.append(
        'title',
        form.title.trim()
      );

      formData.append(
        'body',
        form.body.trim()
      );

      form.attachments.forEach(
        (file) => {
          formData.append(
            'attachments',
            file
          );
        }
      );

      const result =
        await publishAnnouncement(
          courseId,
          formData
        );

      const newAnnouncement =
        normalizeAnnouncement(
          result.announcement
        );

      setAnnouncements(
        (previous) => [
          newAnnouncement,
          ...previous
        ]
      );

      closeCreateForm();

      const message =
        result.message ||
        'Announcement posted successfully.';

      if (
        message
          .toLowerCase()
          .includes(
            'email notifications could not be sent'
          )
      ) {
        setEmailWarning(
          message
        );
        setSuccessMessage('');
      } else {
        setEmailWarning('');

        setSuccessMessage(
          message
        );
      }
    } catch (error) {
      console.error(
        'Unable to post announcement:',
        error
      );

      setEmailWarning('');

      setErrors(
        (previous) => ({
          ...previous,
          form:
            error.message ||
            'Unable to post announcement.'
        })
      );
    } finally {
      setPosting(false);
    }
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
          justify-between
          gap-4
          px-6
          py-3
          flex-shrink-0
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
              to="/educator/courses"
              className="
                hover:text-blue-600
              "
            >
              My Courses
            </Link>


            <span>
              /
            </span>


            <Link
              to={
                `/educator/courses/${course.courseId}`
              }
              className="
                hover:text-blue-600
              "
            >
              {
                course.subjectName
              }
            </Link>


            <span>
              /
            </span>


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


        {!isArchived && (
          <button
            type="button"
            onClick={
              openCreateForm
            }
            className="
              bg-blue-600
              hover:bg-blue-700
              text-white
              text-xs
              font-semibold
              px-4
              py-2
              rounded-lg
              shadow-sm
            "
          >
            + New Announcement
          </button>
        )}
      </header>


      {/* CONTENT */}
      <main
        className="
          p-6
          space-y-5
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
            This course is archived.
            Existing announcements are
            available for viewing only.
          </div>
        )}


        {/* SUCCESS */}
        {successMessage && (
          <div
            className="
              bg-green-50
              border
              border-green-200
              text-green-700
              text-sm
              rounded-xl
              px-4
              py-3
            "
          >
            {
              successMessage
            }
          </div>
        )}


        {/* EMAIL WARNING */}
        {emailWarning && (
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
            {
              emailWarning
            }
          </div>
        )}


        {/* CREATE FORM */}
        {showCreateForm && (
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
                New Announcement
              </h2>


              <p
                className="
                  text-xs
                  text-gray-400
                  mt-1
                "
              >
                Post an update to this
                classroom.
              </p>
            </div>


            <div
              className="
                p-6
                space-y-5
              "
            >
              {/* COURSE */}
              <div>
                <label
                  className="
                    block
                    text-sm
                    font-semibold
                    text-gray-700
                  "
                >
                  Course
                </label>


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
                  <p
                    className="
                      text-sm
                      font-semibold
                      text-gray-700
                    "
                  >
                    {
                      course.subjectName
                    }
                  </p>


                  <p
                    className="
                      text-xs
                      text-gray-400
                      mt-0.5
                    "
                  >
                    {
                      course.courseCode
                    }
                  </p>
                </div>
              </div>


              {/* TITLE */}
              <div>
                <label
                  htmlFor="announcement-title"
                  className="
                    block
                    text-sm
                    font-semibold
                    text-gray-700
                  "
                >
                  Title
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
                  id="announcement-title"
                  type="text"
                  value={
                    form.title
                  }
                  onChange={
                    (event) =>
                      updateForm(
                        'title',
                        event
                          .target
                          .value
                      )
                  }
                  placeholder="e.g., Midterm Exam Reminder"
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
                      errors.title
                        ? `
                          border-red-400
                          bg-red-50/30
                        `
                        : `
                          border-gray-200
                        `
                    }
                  `}
                />


                {errors.title && (
                  <p
                    className="
                      text-xs
                      text-red-500
                      mt-1
                    "
                  >
                    {
                      errors.title
                    }
                  </p>
                )}
              </div>


              {/* CONTENT */}
              <div>
                <label
                  htmlFor="announcement-body"
                  className="
                    block
                    text-sm
                    font-semibold
                    text-gray-700
                  "
                >
                  Content
                  <span
                    className="
                      text-red-500
                      ml-1
                    "
                  >
                    *
                  </span>
                </label>


                <textarea
                  id="announcement-body"
                  rows={7}
                  value={
                    form.body
                  }
                  onChange={
                    (event) =>
                      updateForm(
                        'body',
                        event
                          .target
                          .value
                      )
                  }
                  placeholder="Enter the announcement details..."
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
                    resize-y
                    focus:ring-1
                    focus:ring-blue-300

                    ${
                      errors.body
                        ? `
                          border-red-400
                          bg-red-50/30
                        `
                        : `
                          border-gray-200
                        `
                    }
                  `}
                />


                {errors.body && (
                  <p
                    className="
                      text-xs
                      text-red-500
                      mt-1
                    "
                  >
                    {
                      errors.body
                    }
                  </p>
                )}
              </div>


              {/* ATTACHMENTS */}
              <div>
                <label
                  className="
                    block
                    text-sm
                    font-semibold
                    text-gray-700
                  "
                >
                  Attachments
                </label>


                <input
                  type="file"
                  multiple
                  onChange={
                    handleAttachmentChange
                  }
                  className="
                    mt-2
                    block
                    w-full
                    text-sm
                    text-gray-600
                  "
                />


                <p
                  className="
                    text-[11px]
                    text-gray-400
                    mt-1
                  "
                >
                  You can attach up to
                  5 files.
                </p>


                {form.attachments.length >
                  0 && (
                  <div
                    className="
                      mt-3
                      space-y-2
                    "
                  >
                    {form.attachments.map(
                      (
                        attachment,
                        index
                      ) => (
                        <div
                          key={
                            `${attachment.name}-${index}`
                          }
                        >
                          {attachment.url ? (
                            <a
                              href={
                                attachment.url
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="
                                text-blue-600
                                font-semibold
                                hover:underline
                              "
                            >
                              {
                                attachment.name
                              }
                            </a>
                          ) : (
                            attachment.name
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>


            {/* FORM ACTIONS */}
            <div
              className="
                px-6
                py-4
                border-t
                border-gray-100
                flex
                justify-end
                gap-3
              "
            >
              <button
                type="button"
                onClick={
                  handleCancelCreate
                }
                className="
                  text-sm
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
                  handlePostAnnouncement
                }
                disabled={
                  posting
                }
                className="
                  text-sm
                  font-semibold
                  text-white
                  bg-blue-600
                  hover:bg-blue-700
                  px-4
                  py-2
                  rounded-lg
                  disabled:opacity-50
                  disabled:cursor-not-allowed     
                "
              >
                {
                  posting
                    ? 'Posting...'
                    : 'Post'
                }
              </button>
            </div>
          </section>
        )}


        {/* ANNOUNCEMENT BOARD */}
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
              px-5
              py-4
              border-b
              border-gray-100
              flex
              items-center
              justify-between
            "
          >
            <div>
              <h2
                className="
                  text-base
                  font-bold
                  text-gray-800
                "
              >
                Classroom Board
              </h2>


              <p
                className="
                  text-xs
                  text-gray-400
                  mt-1
                "
              >
                Updates posted to
                enrolled learners.
              </p>
            </div>


            <span
              className="
                text-xs
                text-gray-400
              "
            >
              {
                courseAnnouncements.length
              }{' '}
              announcements
            </span>
          </div>


          {courseAnnouncements.length ===
          0 ? (
            <div
              className="
                py-14
                px-6
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
                "
              >
                <svg
                  className="
                    w-6
                    h-6
                    text-blue-500
                  "
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M11 5h2m-1-1v2m7 5a7 7 0 01-7 7H8l-4 3v-6a7 7 0 117-4z"
                  />
                </svg>
              </div>


              <h3
                className="
                  text-base
                  font-bold
                  text-gray-800
                  mt-4
                "
              >
                No announcements yet
              </h3>


              <p
                className="
                  text-sm
                  text-gray-500
                  mt-2
                "
              >
                Classroom announcements
                will appear here after
                they are posted.
              </p>
            </div>
          ) : (
            <div
              className="
                divide-y
                divide-gray-100
              "
            >
              {courseAnnouncements.map(
                (announcement) => (
                  <article
                    key={
                      announcement
                        .announcementId
                    }
                    className="
                      p-5
                    "
                  >
                    <div
                      className="
                        flex
                        items-start
                        justify-between
                        gap-4
                      "
                    >
                      <div
                        className="
                          min-w-0
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
                            announcement.title
                          }
                        </h3>


                        <p
                          className="
                            text-xs
                            text-gray-400
                            mt-1
                          "
                        >
                          Posted{' '}
                          {
                            formatDateTime(
                              announcement
                                .createdAt
                            )
                          }
                        </p>
                      </div>


                      <span
                        className="
                          flex-shrink-0
                          bg-green-50
                          text-green-700
                          text-[10px]
                          font-bold
                          rounded-full
                          px-2.5
                          py-1
                        "
                      >
                        POSTED
                      </span>
                    </div>


                    <p
                      className="
                        text-sm
                        text-gray-600
                        leading-6
                        mt-4
                        whitespace-pre-wrap
                      "
                    >
                      {
                        announcement.body
                      }
                    </p>


                    {Array.isArray(
                      announcement.attachments
                    ) &&
                      announcement
                        .attachments
                        .length >
                        0 && (
                        <div
                          className="
                            mt-4
                          "
                        >
                          <p
                            className="
                              text-xs
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
                            {announcement
                              .attachments
                              .map(
                                (
                                  attachment,
                                  index
                                ) => (
                                  <div
                                    key={
                                      `${attachment.name}-${index}`
                                    }
                                    className="
                                      bg-gray-50
                                      border
                                      border-gray-100
                                      rounded-lg
                                      px-3
                                      py-2
                                      text-xs
                                      text-gray-600
                                    "
                                  >
                                    {
                                      attachment.name
                                    }
                                  </div>
                                )
                              )}
                          </div>
                        </div>
                      )}
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </main>


      {/* DISCARD CONFIRMATION */}
      {showDiscardDialog && (
        <div
          className="
            fixed
            inset-0
            z-50
            bg-gray-900/50
            flex
            items-center
            justify-center
            p-4
          "
        >
          <div
            className="
              bg-white
              w-full
              max-w-md
              rounded-xl
              shadow-xl
            "
          >
            <div
              className="
                p-6
              "
            >
              <div
                className="
                  w-11
                  h-11
                  rounded-full
                  bg-amber-100
                  flex
                  items-center
                  justify-center
                  mb-4
                "
              >
                <svg
                  className="
                    w-6
                    h-6
                    text-amber-600
                  "
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.667 1.73-3L13.73 4c-.77-1.333-2.69-1.333-3.46 0L3.34 16c-.77 1.333.19 3 1.73 3z"
                  />
                </svg>
              </div>


              <h2
                className="
                  text-lg
                  font-bold
                  text-gray-800
                "
              >
                Discard Announcement?
              </h2>


              <p
                className="
                  text-sm
                  text-gray-500
                  mt-2
                "
              >
                Are you sure you want
                to discard this
                announcement? All
                unsaved changes will
                be lost.
              </p>
            </div>


            <div
              className="
                px-6
                py-4
                border-t
                border-gray-100
                flex
                justify-end
                gap-3
              "
            >
              <button
                type="button"
                onClick={() =>
                  setShowDiscardDialog(
                    false
                  )
                }
                className="
                  text-sm
                  font-semibold
                  text-gray-600
                  bg-gray-100
                  px-4
                  py-2
                  rounded-lg
                  hover:bg-gray-200
                "
              >
                Keep Editing
              </button>


              <button
                type="button"
                onClick={
                  confirmDiscard
                }
                className="
                  text-sm
                  font-semibold
                  text-white
                  bg-red-600
                  hover:bg-red-700
                  px-4
                  py-2
                  rounded-lg
                "
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}