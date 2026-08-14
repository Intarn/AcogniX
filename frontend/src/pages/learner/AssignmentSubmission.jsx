import {
  useEffect,
  useState
} from 'react';

import {
  Link,
  useNavigate,
  useParams
} from 'react-router-dom';

import {
  getOpenAssessment,
  startSubmission,
  getSubmissionAnswers,
  saveAnswer,
  uploadSubmissionFiles,
  deleteSubmissionFile,
  submitSubmissionAPI
} from '../../services/quizService';

import {
  useConfirm
} from '../../contexts/ConfirmContext';

import {
  useToast
} from '../../contexts/ToastContext';


function formatDateTime(value) {
  if (!value) {
    return 'Not set';
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'Not set';
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


function getOriginalFileName(
  fileUrl,
  index = 0
) {
  if (!fileUrl) {
    return `File ${index + 1}`;
  }


  const storedName =
    String(fileUrl)
      .split('/')
      .pop();


  if (!storedName) {
    return `File ${index + 1}`;
  }


  const separatorIndex =
    storedName.indexOf('__');


  if (separatorIndex === -1) {
    return storedName;
  }


  return storedName.slice(
    separatorIndex + 2
  );
}

export default function AssignmentSubmission() {

  const {
    confirm
  } = useConfirm();

  const {
    showToast
  } = useToast();
  const {
    courseId,
    assessmentId
  } =
    useParams();


  const navigate =
    useNavigate();


  const [
    assessment,
    setAssessment
  ] =
    useState(null);


  const [
    submission,
    setSubmission
  ] =
    useState(null);

  const [
    questions,
    setQuestions
  ] = useState([]);


   const [
    userAnswers,
    setUserAnswers
   ] = useState({});


   const [
    savingQuestionId,
    setSavingQuestionId
   ] = useState(null);


  const [
    selectedFiles,
    setSelectedFiles
  ] =
    useState([]);


  const [
    uploadedFiles,
    setUploadedFiles
  ] =
    useState([]);


  const [
    loading,
    setLoading
  ] =
    useState(true);


  const [
    uploading,
    setUploading
  ] =
    useState(false);

  const [
    deletingFileUrl,
    setDeletingFileUrl
  ] =
    useState(null);


  const [
    submitting,
    setSubmitting
  ] =
    useState(false);


  const [
    loadError,
    setLoadError
  ] =
    useState('');


  const [
    completed,
    setCompleted
  ] =
    useState(false);

  const isResubmission =
    [
      'SUBMITTED',
      'PENDING_REVIEW'
    ].includes(
      submission?.status
    );


  /* =====================================================
     LOAD ASSIGNMENT
  ===================================================== */

  useEffect(() => {
    if (
      !courseId ||
      !assessmentId
    ) {
      setLoading(false);

      setLoadError(
        'Course ID or Assessment ID is missing.'
      );

      return;
    }


    let cancelled =
      false;


    async function initializeAssignment() {
      try {
        setLoading(true);

        setLoadError('');

        const {
          assessment: loadedAssessment,
          questions: loadedQuestions
        } =
          await getOpenAssessment(
            assessmentId
          );


        if (
          !loadedAssessment
        ) {
          throw new Error(
            'Assignment not found.'
          );
        }


        if (
          String(
            loadedAssessment.courseId
          ) !==
          String(
            courseId
          )
        ) {
          throw new Error(
            'This assignment does not belong to the selected course.'
          );
        }

        if (
          loadedAssessment.type !==
          'ASSIGNMENT'
        ) {
          throw new Error(
            'This assessment is not an assignment.'
          );
        }


        if (cancelled) {
          return;
        }


        setAssessment(
          loadedAssessment
        );
        setQuestions(
        Array.isArray(
            loadedQuestions
        )
            ? loadedQuestions
            : []
        );

        try {
          const submissionResult =
            await startSubmission(
                assessmentId
            );


            if (cancelled) {
            return;
            }


            const currentSubmission =
            submissionResult
                .submission;


            setSubmission(
            currentSubmission
            );


            const answerResult =
            await getSubmissionAnswers(
                currentSubmission
                .submissionId
            );


            const savedAnswers =
            Array.isArray(
                answerResult?.answers
            )
                ? answerResult.answers
                : [];
            
            const answerMap = {};


            savedAnswers.forEach(
            answer => {
                answerMap[
                answer.questionId
                ] =
                answer.response ?? '';
            }
            );


            setUserAnswers(
            answerMap
            );
          const existingFileUrls =
            Array.isArray(
                submissionResult
                .submission
                ?.uploadedFileUrls
            )
                ? submissionResult
                    .submission
                    .uploadedFileUrls
                : [];


            setUploadedFiles(
                existingFileUrls.map(
                    (
                    fileUrl,
                    index
                    ) => ({
                    fileUrl,

                    fileName:
                        getOriginalFileName(
                        fileUrl,
                        index
                        ),

                    sizeBytes: null
                    })
                )
                );

        } catch (
          submissionError
        ) {

          /*
           * Learner already submitted:
           * go directly to Review.
           */
          if (
            submissionError.code ===
            'ASSESSMENT_ALREADY_SUBMITTED'
          ) {
            navigate(
              `/learner/courses/${courseId}/assessments/${assessmentId}/review`,
              {
                replace: true
              }
            );

            return;
          }


          throw submissionError;
        }

      } catch (error) {
        if (cancelled) {
          return;
        }


        console.error(
          'Unable to initialize assignment:',
          error
        );


        setLoadError(
          error.message ||
          'Unable to load assignment.'
        );

      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }


    initializeAssignment();


    return () => {
      cancelled = true;
    };

  }, [
    courseId,
    assessmentId,
    navigate
  ]);


  /* =====================================================
     SELECT FILES
  ===================================================== */

  async function handleSaveAnswer(
    questionId,
    response
    ) {
    if (!submission) {
        return;
    }


    /*
    * Update UI immediately.
    */
    setUserAnswers(
        previous => ({
        ...previous,
        [questionId]:
            response
        })
    );


    try {
        setSavingQuestionId(
        questionId
        );


        await saveAnswer(
        submission.submissionId,
        questionId,
        response
        );

    } catch (error) {
        console.error(
        'Unable to save answer:',
        error
        );


        showToast(
          error.message ||
            'Unable to save your answer.',
          'error'
        );

    } finally {
        setSavingQuestionId(
        null
        );
    }
    }

  function handleFileChange(
    event
  ) {
    const files =
      Array.from(
        event.target.files ||
        []
      );


    /*
     * Backend accepts maximum
     * 10 files per upload request.
     */
    setSelectedFiles(
      files.slice(
        0,
        10
      )
    );
  }


  /* =====================================================
     UPLOAD FILES
  ===================================================== */

  async function handleUploadFiles() {
    if (!submission) {
      return;
    }


    if (
      selectedFiles.length ===
      0
    ) {
      showToast(
        'Please select at least one file.',
        'warning'
      );

      return;
    }


    try {
      setUploading(true);


      const result =
        await uploadSubmissionFiles(
          submission.submissionId,
          selectedFiles
        );


      const newlyUploaded =
        Array.isArray(
          result?.files
        )
          ? result.files
          : [];


      setUploadedFiles(
        previous => [
          ...previous,
          ...newlyUploaded
        ]
      );


      setSelectedFiles([]);


      showToast(
        newlyUploaded.length > 1
          ? 'Files uploaded successfully.'
          : 'File uploaded successfully.',
        'success'
      );

    } catch (error) {
      console.error(
        'Unable to upload assignment files:',
        error
      );


      showToast(
        error.message ||
          'Unable to upload files.',
        'error'
      );

    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteUploadedFile(
    file
  ) {
    if (!submission) {
      return;
    }


    if (!file?.fileUrl) {
      return;
    }


    const fileName =
      file.fileName ||
      'this file';


    const confirmed =
      await confirm({
        title:
          'Remove Uploaded File?',

        message:
          `Are you sure you want to remove "${fileName}" from your submission?`,

        confirmLabel:
          'Remove',

        cancelLabel:
          'Cancel',

        tone:
          'danger'
      });


    if (!confirmed) {
      return;
    }


    try {
      setDeletingFileUrl(
        file.fileUrl
      );


      await deleteSubmissionFile(
        submission.submissionId,
        file.fileUrl
      );


      setUploadedFiles(
        previous =>
          previous.filter(
            item =>
              item.fileUrl !==
              file.fileUrl
          )
      );


      showToast(
        `"${fileName}" was removed successfully.`,
        'success'
      );

    } catch (error) {
      console.error(
        'Unable to delete submission file:',
        error
      );


      showToast(
        error.message ||
          'Unable to remove the file.',
        'error'
      );

    } finally {
      setDeletingFileUrl(
        null
      );
    }
  }


  /* =====================================================
     SUBMIT ASSIGNMENT
  ===================================================== */

  async function handleSubmitAssignment() {
    if (!submission) {
      return;
    }


    const hasUploadedFiles =
      uploadedFiles.length > 0;


    const hasSelectedFiles =
      selectedFiles.length > 0;


    const hasAnswers =
      Object.values(
        userAnswers
      ).some(
        answer =>
          String(
            answer ?? ''
          ).trim() !== ''
      );


    /*
    * Learner phải có ít nhất:
    *
    * - answer
    * hoặc
    * - uploaded file
    * hoặc
    * - selected file sắp upload
    */
    if (
      !hasUploadedFiles &&
      !hasSelectedFiles &&
      !hasAnswers
    ) {
      showToast(
        'Please answer at least one question or attach at least one file before submitting.',
        'warning'
      );

      return;
    }


    /*
    * Confirm Submit / Resubmit.
    */
    const confirmed =
      await confirm({
        title:
          isResubmission
            ? 'Resubmit Assignment?'
            : 'Submit Assignment?',

        message:
          isResubmission
            ? 'Are you sure you want to resubmit this Assignment? Your latest answers and uploaded files will be used for the updated submission.'
            : 'Are you sure you want to submit this Assignment? You can still edit and resubmit it while the Assessment remains open.',

        confirmLabel:
          isResubmission
            ? 'Resubmit'
            : 'Submit',

        cancelLabel:
          'Cancel',

        tone:
          'success'
      });


    if (!confirmed) {
      return;
    }


    try {
      setSubmitting(true);


      /*
      * Save all entered answers
      * before final submission.
      */
      for (
        const question of
        questions
      ) {
        const response =
          userAnswers[
            question.questionId
          ];


        if (
          response !==
            undefined &&
          String(
            response
          ).trim() !== ''
        ) {
          await saveAnswer(
            submission.submissionId,
            question.questionId,
            response
          );
        }
      }


      /*
      * Upload newly selected files.
      */
      if (
        selectedFiles.length > 0
      ) {
        await uploadSubmissionFiles(
          submission.submissionId,
          selectedFiles
        );
      }


      /*
      * Finalize / resubmit
      * the Assignment.
      */
      await submitSubmissionAPI(
        submission.submissionId
      );


      showToast(
        isResubmission
          ? 'Assignment resubmitted successfully.'
          : 'Assignment submitted successfully.',
        'success'
      );


      setCompleted(true);

    } catch (error) {
      console.error(
        'Unable to submit assignment:',
        error
      );


      showToast(
        error.message ||
          (
            isResubmission
              ? 'Unable to resubmit assignment.'
              : 'Unable to submit assignment.'
          ),
        'error'
      );

    } finally {
      setSubmitting(false);
    }
  }


  /* =====================================================
     ERROR
  ===================================================== */

  if (
    loadError ||
    !assessment
  ) {
    return (
      <main
        className="
          flex-1
          flex
          items-center
          justify-center
          bg-gray-50
          p-8
        "
      >
        <div
          className="
            bg-white
            border
            border-gray-100
            shadow-sm
            rounded-xl
            p-8
            text-center
            max-w-lg
            w-full
          "
        >
          <h2
            className="
              text-lg
              font-bold
              text-gray-800
            "
          >
            Assignment Not Available
          </h2>


          <p
            className="
              text-sm
              text-red-500
              mt-2
            "
          >
            {
              loadError ||
              'Unable to load assignment.'
            }
          </p>


          <Link
            to={
              `/learner/courses/${courseId}/assessments`
            }
            className="
              inline-block
              mt-4
              text-sm
              font-semibold
              text-blue-600
              hover:underline
            "
          >
            Back to Assessments
          </Link>
        </div>
      </main>
    );
  }


  /* =====================================================
     COMPLETED
  ===================================================== */

  if (completed) {
    return (
      <main
        className="
          flex-1
          flex
          items-center
          justify-center
          bg-gray-50
          p-8
        "
      >
        <div
          className="
            max-w-xl
            w-full
            bg-white
            rounded-2xl
            border
            border-gray-100
            shadow-sm
            overflow-hidden
            text-center
          "
        >
          <div
            className="
              bg-emerald-600
              text-white
              p-7
            "
          >
            <h2
              className="
                text-2xl
                font-bold
              "
            >
              {
                isResubmission
                  ? 'Assignment Resubmitted'
                  : 'Assignment Submitted'
              }
            </h2>


            <p
              className="
                text-sm
                text-emerald-100
                mt-2
              "
            >
              {
                isResubmission
                  ? 'Your updated assignment has been resubmitted successfully.'
                  : 'Your assignment has been submitted successfully.'
              }
            </p>
          </div>


          <div className="p-7">
            <p
              className="
                text-sm
                text-gray-500
                mb-6
              "
            >
              Your submission is now
              pending educator review.
            </p>


            <div
              className="
                flex
                items-center
                justify-center
                gap-3
                flex-wrap
              "
            >
              <Link
                to={
                  `/learner/courses/${courseId}/assessments/${assessmentId}/review`
                }
                className="
                  px-5
                  py-2.5
                  rounded-lg
                  bg-blue-600
                  text-white
                  text-sm
                  font-semibold
                  hover:bg-blue-700
                "
              >
                View Review
              </Link>


              <Link
                to={
                  `/learner/courses/${courseId}/assessments`
                }
                className="
                  px-5
                  py-2.5
                  rounded-lg
                  bg-gray-100
                  text-gray-600
                  text-sm
                  font-semibold
                  hover:bg-gray-200
                "
              >
                Back to Assessments
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }


  /* =====================================================
     MAIN ASSIGNMENT UI
  ===================================================== */

  return (
    <>
      {/* TOPBAR */}
      <header
        className="
          min-h-16
          bg-white
          border-b
          border-gray-100
          px-6
          py-3
          flex
          items-center
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
              to={
                `/learner/courses/${courseId}`
              }
              className="
                hover:text-blue-600
              "
            >
              Course
            </Link>


            <span>/</span>


            <Link
              to={
                `/learner/courses/${courseId}/assessments`
              }
              className="
                hover:text-blue-600
              "
            >
              Assessments
            </Link>


            <span>/</span>


            <span>
              Assignment
            </span>
          </div>


          <h1
            className="
              text-lg
              font-bold
              text-gray-800
            "
          >
            {
              isResubmission
                ? 'Edit Assignment'
                : 'Submit Assignment'
            }
          </h1>
        </div>
      </header>


      <main
        className="
          flex-1
          bg-gray-50
          p-6
          overflow-y-auto
        "
      >
        <div
          className="
            max-w-4xl
            mx-auto
            space-y-5
          "
        >

          {/* ASSIGNMENT INFORMATION */}
          <section
            className="
              bg-white
              rounded-xl
              border
              border-gray-100
              shadow-sm
              p-6
            "
          >
            <div
              className="
                flex
                flex-wrap
                items-start
                justify-between
                gap-4
              "
            >
              <div>
                <div
                  className="
                    flex
                    items-center
                    gap-2
                    flex-wrap
                  "
                >
                  <h2
                    className="
                      text-xl
                      font-bold
                      text-gray-800
                    "
                  >
                    {
                      assessment.title
                    }
                  </h2>


                  <span
                    className="
                      px-2.5
                      py-1
                      rounded-full
                      bg-emerald-50
                      text-emerald-700
                      text-[10px]
                      font-bold
                    "
                  >
                    ASSIGNMENT
                  </span>


                  <span
                    className="
                      px-2.5
                      py-1
                      rounded-full
                      bg-green-100
                      text-green-700
                      text-[10px]
                      font-bold
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
                      text-sm
                      text-gray-500
                      mt-3
                      leading-6
                    "
                  >
                    {
                      assessment.description
                    }
                  </p>
                )}
              </div>
            </div>


            <div
              className="
                grid
                grid-cols-1
                sm:grid-cols-3
                gap-4
                mt-6
              "
            >
              <div
                className="
                  bg-gray-50
                  rounded-xl
                  p-4
                "
              >
                <p
                  className="
                    text-xs
                    text-gray-400
                  "
                >
                  Total Points
                </p>

                <p
                  className="
                    text-sm
                    font-bold
                    text-gray-800
                    mt-1
                  "
                >
                  {
                    assessment.totalPoints ??
                    0
                  }
                </p>
              </div>


              <div
                className="
                  bg-gray-50
                  rounded-xl
                  p-4
                "
              >
                <p
                  className="
                    text-xs
                    text-gray-400
                  "
                >
                  Start Time
                </p>

                <p
                  className="
                    text-sm
                    font-semibold
                    text-gray-700
                    mt-1
                  "
                >
                  {
                    formatDateTime(
                      assessment.startTime
                    )
                  }
                </p>
              </div>


              <div
                className="
                  bg-gray-50
                  rounded-xl
                  p-4
                "
              >
                <p
                  className="
                    text-xs
                    text-gray-400
                  "
                >
                  Deadline
                </p>

                <p
                  className="
                    text-sm
                    font-semibold
                    text-gray-700
                    mt-1
                  "
                >
                  {
                    formatDateTime(
                      assessment.deadline
                    )
                  }
                </p>
              </div>
            </div>


            {assessment
              .instructionFileUrl && (
              <div
                className="
                  mt-5
                  pt-5
                  border-t
                  border-gray-100
                "
              >
                <a
                  href={
                    assessment
                      .instructionFileUrl
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="
                    inline-flex
                    px-4
                    py-2
                    rounded-lg
                    bg-blue-50
                    text-blue-600
                    text-sm
                    font-semibold
                    hover:bg-blue-100
                  "
                >
                  View Assignment Instructions
                </a>
              </div>
            )}
          </section>

          {questions.length > 0 && (
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
                    Assignment Questions
                </h2>


                <p
                    className="
                    text-xs
                    text-gray-400
                    mt-1
                    "
                >
                    Answer the questions below.
                    Your responses are saved automatically.
                </p>
                </div>


                <div
                className="
                    divide-y
                    divide-gray-100
                "
                >
                {questions.map(
                    (
                    question,
                    index
                    ) => {

                    const currentAnswer =
                        userAnswers[
                        question.questionId
                        ] ?? '';


                    const isSaving =
                        savingQuestionId ===
                        question.questionId;


                    const isMultipleChoice =
                        question.type ===
                        'MULTIPLE_CHOICE';


                    return (
                        <div
                        key={
                            question.questionId
                        }
                        className="
                            p-6
                        "
                        >
                        {/* QUESTION HEADER */}
                        <div
                            className="
                            flex
                            items-start
                            gap-3
                            "
                        >
                            <div
                            className="
                                w-8
                                h-8
                                rounded-lg
                                bg-blue-50
                                text-blue-600
                                flex
                                items-center
                                justify-center
                                flex-shrink-0
                                text-xs
                                font-bold
                            "
                            >
                            {
                                index + 1
                            }
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
                                gap-3
                                "
                            >
                                <div>
                                <h3
                                    className="
                                    text-sm
                                    font-semibold
                                    text-gray-800
                                    leading-6
                                    "
                                >
                                    {
                                    question.content
                                    }
                                </h3>


                                <p
                                    className="
                                    text-xs
                                    text-gray-400
                                    mt-1
                                    "
                                >
                                    {
                                    question.points ??
                                    0
                                    }{' '}
                                    points
                                </p>
                                </div>


                                {isSaving && (
                                <span
                                    className="
                                    text-xs
                                    font-semibold
                                    text-blue-500
                                    flex-shrink-0
                                    "
                                >
                                    Saving...
                                </span>
                                )}
                            </div>


                            {/* =================================
                                ESSAY QUESTION
                            ================================= */}

                            {!isMultipleChoice && (
                                <div
                                className="
                                    mt-4
                                "
                                >
                                <label
                                    className="
                                    text-xs
                                    font-semibold
                                    text-gray-500
                                    "
                                >
                                    Your Answer
                                </label>


                                <textarea
                                    value={
                                    currentAnswer
                                    }
                                    onChange={
                                    event =>
                                        setUserAnswers(
                                        previous => ({
                                            ...previous,

                                            [
                                            question
                                                .questionId
                                            ]:
                                            event
                                                .target
                                                .value
                                        })
                                        )
                                    }
                                    onBlur={
                                    event =>
                                        handleSaveAnswer(
                                        question
                                            .questionId,

                                        event
                                            .target
                                            .value
                                        )
                                    }
                                    rows={5}
                                    placeholder="Enter your answer..."
                                    className="
                                    w-full
                                    mt-2
                                    px-4
                                    py-3
                                    rounded-xl
                                    border
                                    border-gray-200
                                    text-sm
                                    text-gray-700
                                    outline-none
                                    resize-y
                                    focus:border-blue-400
                                    focus:ring-2
                                    focus:ring-blue-100
                                    "
                                />
                                </div>
                            )}


                            {/* =================================
                                MULTIPLE CHOICE QUESTION
                            ================================= */}

                            {isMultipleChoice && (
                                <div
                                className="
                                    mt-4
                                    space-y-2
                                "
                                >
                                {(
                                    question.options ||
                                    []
                                ).map(
                                    (
                                    option,
                                    optionIndex
                                    ) => {

                                    /*
                                    * Backend hiện tại có thể
                                    * trả option dạng string.
                                    */
                                    const optionContent =
                                        option &&
                                        typeof option ===
                                        'object'
                                        ? String(
                                            option
                                                .content ??
                                            ''
                                            )
                                        : String(
                                            option ??
                                            ''
                                            );


                                    const selected =
                                        currentAnswer ===
                                        optionContent;


                                    return (
                                        <label
                                        key={
                                            `${question.questionId}-${optionIndex}`
                                        }
                                        className={`
                                            flex
                                            items-center
                                            gap-3
                                            px-4
                                            py-3
                                            rounded-xl
                                            border
                                            cursor-pointer
                                            transition

                                            ${
                                            selected
                                                ? `
                                                border-blue-400
                                                bg-blue-50
                                                `
                                                : `
                                                border-gray-200
                                                hover:border-blue-200
                                                `
                                            }
                                        `}
                                        >
                                        <input
                                            type="radio"
                                            name={
                                            `assignment-${question.questionId}`
                                            }
                                            checked={
                                            selected
                                            }
                                            onChange={() =>
                                            handleSaveAnswer(
                                                question
                                                .questionId,

                                                optionContent
                                            )
                                            }
                                            className="
                                            accent-blue-600
                                            "
                                        />


                                        <span
                                            className="
                                            text-sm
                                            text-gray-700
                                            "
                                        >
                                            {
                                            optionContent
                                            }
                                        </span>
                                        </label>
                                    );
                                    }
                                )}
                                </div>
                            )}
                            </div>
                        </div>
                        </div>
                    );
                    }
                )}
                </div>
            </section>
            )}

          {/* FILE UPLOAD */}
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
                Your Submission
              </h2>


              <p
                className="
                  text-xs
                  text-gray-400
                  mt-1
                "
              >
                Upload the files you want
                to submit for this assignment.
              </p>
            </div>


            <div className="p-6">
              <label
                className="
                  block
                  border-2
                  border-dashed
                  border-gray-200
                  rounded-xl
                  p-8
                  text-center
                  cursor-pointer
                  hover:border-blue-300
                  hover:bg-blue-50/30
                  transition
                "
              >
                <input
                  type="file"
                  multiple
                  onChange={
                    handleFileChange
                  }
                  className="hidden"
                />


                <div
                  className="
                    text-3xl
                    mb-2
                  "
                >
                  📎
                </div>


                <p
                  className="
                    text-sm
                    font-semibold
                    text-gray-700
                  "
                >
                  Select files
                </p>


                <p
                  className="
                    text-xs
                    text-gray-400
                    mt-1
                  "
                >
                  You can select up to
                  10 files.
                </p>
              </label>


              {/* SELECTED FILES */}
              {selectedFiles.length >
                0 && (
                <div
                  className="
                    mt-5
                    space-y-2
                  "
                >
                  <p
                    className="
                      text-xs
                      font-semibold
                      text-gray-500
                    "
                  >
                    Selected Files
                  </p>


                  {selectedFiles.map(
                    (
                      file,
                      index
                    ) => (
                      <div
                        key={
                          `${file.name}-${index}`
                        }
                        className="
                          flex
                          items-center
                          justify-between
                          gap-4
                          bg-gray-50
                          rounded-lg
                          px-4
                          py-3
                        "
                      >
                        <div
                          className="
                            min-w-0
                          "
                        >
                          <p
                            className="
                              text-sm
                              font-semibold
                              text-gray-700
                              truncate
                            "
                          >
                            {
                              file.name
                            }
                          </p>


                          <p
                            className="
                              text-[11px]
                              text-gray-400
                            "
                          >
                            {
                              formatFileSize(
                                file.size
                              )
                            }
                          </p>
                        </div>


                        <button
                          type="button"
                          onClick={() =>
                            setSelectedFiles(
                              (
                                previous
                              ) =>
                                previous.filter(
                                  (
                                    _,
                                    fileIndex
                                  ) =>
                                    fileIndex !==
                                    index
                                )
                            )
                          }
                          className="
                            text-xs
                            font-semibold
                            text-red-500
                          "
                        >
                          Remove
                        </button>
                      </div>
                    )
                  )}


                  <button
                    type="button"
                    onClick={
                      handleUploadFiles
                    }
                    disabled={
                      uploading
                    }
                    className="
                      mt-3
                      px-5
                      py-2.5
                      rounded-lg
                      bg-blue-600
                      text-white
                      text-sm
                      font-semibold
                      hover:bg-blue-700
                      disabled:opacity-50
                    "
                  >
                    {
                      uploading
                        ? 'Uploading...'
                        : 'Upload Files'
                    }
                  </button>
                </div>
              )}


              {/* UPLOADED FILES */}
              {uploadedFiles.length >
                0 && (
                <div
                  className="
                    mt-6
                    pt-5
                    border-t
                    border-gray-100
                  "
                >
                  <p
                    className="
                      text-xs
                      font-semibold
                      text-gray-500
                      mb-3
                    "
                  >
                    Uploaded Files
                  </p>


                  <div
                    className="
                      space-y-2
                    "
                  >
                    {uploadedFiles.map(
                      (
                        file,
                        index
                      ) => (
                        <div
                          key={
                            `${file.fileUrl}-${index}`
                          }
                          className="
                            flex
                            items-center
                            justify-between
                            gap-3
                            rounded-lg
                            bg-green-50
                            px-4
                            py-3
                          "
                        >
                          <div
                            className="
                              min-w-0
                            "
                          >
                            <p
                              className="
                                text-sm
                                font-semibold
                                text-green-700
                                truncate
                              "
                            >
                              {
                                file.fileName
                              }
                            </p>


                            <p
                              className="
                                text-[11px]
                                text-green-600
                              "
                            >
                              {
                                formatFileSize(
                                  file.sizeBytes
                                )
                              }
                            </p>
                          </div>


                          <div
                            className="
                                flex
                                items-center
                                gap-3
                                flex-shrink-0
                            "
                            >
                            <span
                                className="
                                text-xs
                                font-bold
                                text-green-700
                                "
                            >
                                Uploaded
                            </span>


                            <button
                                type="button"
                                onClick={() =>
                                handleDeleteUploadedFile(
                                    file
                                )
                                }
                                disabled={
                                deletingFileUrl ===
                                file.fileUrl
                                }
                                className="
                                text-xs
                                font-semibold
                                text-red-500
                                hover:text-red-700
                                disabled:opacity-50
                                "
                            >
                                {
                                deletingFileUrl ===
                                    file.fileUrl
                                    ? 'Removing...'
                                    : 'Remove'
                                }
                            </button>
                            </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}


              {/* SUBMIT */}
              <div
                className="
                  mt-6
                  pt-5
                  border-t
                  border-gray-100
                  flex
                  justify-end
                "
              >
                <button
                  type="button"
                  onClick={
                    handleSubmitAssignment
                  }
                  disabled={
                    submitting ||
                    uploading
                  }
                  className="
                    px-6
                    py-3
                    rounded-lg
                    bg-emerald-600
                    text-white
                    text-sm
                    font-bold
                    hover:bg-emerald-700
                    disabled:opacity-50
                  "
                >
                  {
                    submitting
                    ? (
                        isResubmission
                          ? 'Resubmitting...'
                          : 'Submitting...'
                      )
                    : (
                        isResubmission
                          ? 'Resubmit Assignment'
                          : 'Submit Assignment'
                      )
                  }
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}