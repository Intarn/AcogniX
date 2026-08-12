import {
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  Link,
  useNavigate,
  useParams
} from 'react-router';

import {
  getCourses
} from '../../features/classroom/courseApi';


import {
  addAssessmentQuestion,
  createAssessment,
  deleteAssessmentQuestion,
  getAssessmentById,
  getAssessmentQuestions,
  publishAssessment,
  scheduleAssessment,
  updateAssessment,
  updateAssessmentQuestion,
  uploadInstructionFile
} from '../../features/assessment/assessmentApi';


function createEmptyQuestionForm() {
  return {
    type:
      'MULTIPLE_CHOICE',

    content:
      '',

    points:
      10,

    options: [
      {
        optionId: 1,
        content: '',
        isCorrect: true
      },

      {
        optionId: 2,
        content: '',
        isCorrect: false
      }
    ]
  };
}


function isAssessmentEditable(
  assessment
) {
  return (
    assessment.status ===
      'DRAFT' ||
    assessment.status ===
      'SCHEDULED'
  );
}

function toDateTimeLocalValue(
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


  const offset =
    date.getTimezoneOffset() *
    60 *
    1000;


  return new Date(
    date.getTime() - offset
  )
    .toISOString()
    .slice(0, 16);
}


function buildQuestionPayload(
  question,
  index
) {
  return {
    content:
      question.content.trim(),

    type:
      question.type,

    points:
      Number(
        question.points
      ),

    displayOrder:
      index + 1,

    options:
      question.type ===
      'MULTIPLE_CHOICE'
        ? question.options.map(
            (option) => ({
              content:
                option.content.trim(),

              isCorrect:
                Boolean(
                  option.isCorrect
                )
            })
          )
        : []
  };
}

function normalizeQuestion(
  question
) {
  const rawOptions =
    Array.isArray(
      question?.options
    )
      ? question.options
      : [];


  const options =
    rawOptions.map(
      (option, index) => {
        /*
         * Future backend may return:
         *
         * { optionId, content, isCorrect }
         *
         * Current AssessmentService
         * stores options as strings.
         */
        if (
          option &&
          typeof option ===
            'object'
        ) {
          return {
            optionId:
              option.optionId ||
              `${question.questionId}-option-${index + 1}`,

            content:
              option.content || '',

            isCorrect:
              option.isCorrect ===
                true ||
              (
                question.correctAnswer !=
                  null &&
                String(
                  option.content
                ) ===
                  String(
                    question.correctAnswer
                  )
              )
          };
        }


        const content =
          String(
            option ?? ''
          );


        return {
          optionId:
            `${question.questionId}-option-${index + 1}`,

          content,

          isCorrect:
            question.correctAnswer !=
              null &&
            content ===
              String(
                question.correctAnswer
              )
        };
      }
    );


  return {
    ...question,

    options:
      question.type ===
      'MULTIPLE_CHOICE'
        ? options
        : []
  };
}

export default function AssessmentBuilderPage() {
  const navigate =
    useNavigate();


  const {
    courseId:
      routeCourseId,

    assessmentId:
      routeAssessmentId
  } = useParams();


  const courseId =
    routeCourseId || null;


  const assessmentId =
    routeAssessmentId || null;


  const isEditMode =
    Boolean(
      assessmentId
    );


  const [
    course,
    setCourse
  ] = useState(null);


  const [
    loading,
    setLoading
  ] = useState(true);


  const [
    loadError,
    setLoadError
  ] = useState('');

  const [
    title,
    setTitle
  ] = useState('');


  const [
    description,
    setDescription
  ] = useState('');


  const [
    type,
    setType
  ] = useState(
    'QUIZ'
  );


  const [
    totalPoints,
    setTotalPoints
  ] = useState(100);


  const [
    startTime,
    setStartTime
  ] = useState('');


  const [
    deadline,
    setDeadline
  ] = useState('');


  const [
    allowLateSubmission,
    setAllowLateSubmission
  ] = useState(false);


  const [
    instructions,
    setInstructions
  ] = useState('');


  const [
    instructionFile,
    setInstructionFile
  ] = useState(null);

  const [
  existingInstructionFileUrl,
  setExistingInstructionFileUrl
] = useState('');

  const [
    status,
    setStatus
  ] = useState(
    'DRAFT'
  );


  const [
    questions,
    setQuestions
  ] = useState([]);


  const [
    errors,
    setErrors
  ] = useState({});


  const [
    questionModalOpen,
    setQuestionModalOpen
  ] = useState(false);


  const [
    editingQuestionId,
    setEditingQuestionId
  ] = useState(null);


  const [
    questionForm,
    setQuestionForm
  ] = useState(
    createEmptyQuestionForm
  );


  const [
    questionErrors,
    setQuestionErrors
  ] = useState({});


  const [
    questionToDelete,
    setQuestionToDelete
  ] = useState(null);


  const [
    blockedMessage,
    setBlockedMessage
  ] = useState('');


  /*
   * Load edit data.
   */
  useEffect(() => {
    if (!courseId) {
      setCourse(null);
      setLoadError('');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadBuilderData() {
      try {
        setLoading(true);
        setLoadError('');

        const [
          courseResult,
          assessmentResult,
          questionResult
        ] = await Promise.all([
          getCourses(),

          isEditMode
            ? getAssessmentById(
                assessmentId
              )
            : Promise.resolve(null),

          isEditMode
            ? getAssessmentQuestions(
                assessmentId
              )
            : Promise.resolve({
                questions: []
              })
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

        if (cancelled) {
          return;
        }

        setCourse(
          foundCourse
        );

        if (!isEditMode) {
          setQuestions([]);
          setExistingInstructionFileUrl('');
          return;
        }

        const assessment =
          assessmentResult?.assessment ||
          assessmentResult;

        if (!assessment) {
          alert(
            'Assessment not found.'
          );

          navigate(
            `/educator/courses/${courseId}/assessments`,
            {
              replace: true
            }
          );

          return;
        }

        if (
          !isAssessmentEditable(
            assessment
          )
        ) {
          setBlockedMessage(
            'This assessment is currently active or has already been closed and can no longer be edited.'
          );

          return;
        }

        setTitle(
          assessment.title || ''
        );

        setDescription(
          assessment.description ||
          ''
        );

        setType(
          assessment.type ||
          'QUIZ'
        );

        setTotalPoints(
          Number(
            assessment.totalPoints
          ) || 0
        );

        setStartTime(
          toDateTimeLocalValue(
            assessment.startTime
          )
        );

        setDeadline(
          toDateTimeLocalValue(
            assessment.deadline
          )
        );

        setAllowLateSubmission(
          Boolean(
            assessment.allowLateSubmission
          )
        );

        setInstructions(
          assessment.instructions ||
          ''
        );

        setInstructionFile(null);

        setExistingInstructionFileUrl(
          assessment.instructionFileUrl ||
          ''
        );

        setStatus(
          assessment.status ||
          'DRAFT'
        );

        const loadedQuestions =
          Array.isArray(
            questionResult?.questions
          )
            ? questionResult.questions.map(
                normalizeQuestion
              )
            : [];

        setQuestions(
          loadedQuestions
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            'Unable to load assessment builder:',
            error
          );

          setCourse(null);

          setLoadError(
            error.message ||
            'Unable to load assessment.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadBuilderData();

    return () => {
      cancelled = true;
    };
  }, [
    assessmentId,
    courseId,
    isEditMode,
    navigate
  ]);


  const questionPointsTotal =
    useMemo(() => {
      return questions.reduce(
        (
          total,
          question
        ) =>
          total +
          Number(
            question.points ||
            0
          ),
        0
      );
    }, [questions]);

  
  if (loading) {
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
            text-gray-500
          "
        >
          Loading assessment...
        </p>
      </div>
    );
  }


  if (loadError) {
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


  const courseArchived =
    course.status ===
    'ARCHIVED';


  function updateError(
    field
  ) {
    setErrors(
      (previous) => ({
        ...previous,
        [field]: null
      })
    );
  }


  function validateAssessment({
    publishing = false
  } = {}) {
    const nextErrors = {};


    if (!title.trim()) {
      nextErrors.title =
        'Assessment title is required.';
    }


    const numericPoints =
      Number(
        totalPoints
      );


    if (
      !Number.isFinite(
        numericPoints
      ) ||
      numericPoints <= 0
    ) {
      nextErrors.totalPoints =
        'Total points must be greater than 0.';
    }


    /*
     * Draft can exist without schedule.
     *
     * Publish requires schedule.
     */
    if (publishing) {
      if (!startTime) {
        nextErrors.startTime =
          'Start time is required before publishing.';
      }


      if (!deadline) {
        nextErrors.deadline =
          'Deadline is required before publishing.';
      }


      if (
        startTime &&
        deadline &&
        new Date(deadline) <=
          new Date(startTime)
      ) {
        nextErrors.deadline =
          'Deadline must be later than the start time.';
      }


      if (
        questions.length ===
          0 &&
        !instructionFile &&
        !existingInstructionFileUrl
      ) {
        nextErrors.content =
          'Add at least one question or an instruction file before publishing.';
      }
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


  async function saveAssessment(
    targetStatus
  ) {
    const publishing =
      targetStatus ===
      'SCHEDULED';


    if (
      !validateAssessment({
        publishing
      })
    ) {
      return;
    }


    const startTimeIso =
      publishing &&
      startTime
        ? new Date(
            startTime
          ).toISOString()
        : null;


    const deadlineIso =
      publishing &&
      deadline
        ? new Date(
            deadline
          ).toISOString()
        : null;


    try {
      /*
      * =========================
      * CREATE
      * =========================
      */
      if (!isEditMode) {
        const result =
          await createAssessment(
            courseId,
            {
              title:
                title.trim(),

              description:
                description.trim() ||
                null,
              
              instructions:
                instructions.trim() ||
                null,

              type,

              totalPoints:
                Number(
                  totalPoints
                ),

              allowLateSubmission,

              startTime:
                startTimeIso,

              deadline:
                deadlineIso,

              questions:
                questions.map(
                  buildQuestionPayload
                )
            }
          );


        const newAssessment =
          result.assessment;


        /*
        * Upload file AFTER Assessment
        * exists because backend needs
        * assessmentId.
        */
        if (instructionFile) {
          await uploadInstructionFile(
            newAssessment
              .assessmentId,
            instructionFile
          );
        }


        /*
        * Publish after questions/file
        * have been saved.
        */
        if (publishing) {
          await publishAssessment(
            newAssessment
              .assessmentId
          );
        }


        navigate(
          `/educator/courses/${courseId}/assessments`
        );


        return;
      }


      /*
      * =========================
      * EDIT BASIC INFORMATION
      * =========================
      */
      await updateAssessment(
        assessmentId,
        {
          title:
            title.trim(),

          description:
            description.trim() ||
            null,

          type,

          totalPoints:
            Number(
              totalPoints
            ),

          allowLateSubmission
        }
      );


      /*
      * New instruction file.
      *
      * Do this before scheduling/
      * publishing so the Assessment
      * is still editable.
      */
      if (instructionFile) {
        await uploadInstructionFile(
          assessmentId,
          instructionFile
        );
      }

      /*
      * Schedule + Publish
      */
      if (publishing) {
        await scheduleAssessment(
          assessmentId,
          startTimeIso,
          deadlineIso
        );


        await publishAssessment(
          assessmentId
        );
      }


      navigate(
        `/educator/courses/${courseId}/assessments`
      );
    } catch (error) {
      console.error(
        'Unable to save assessment:',
        error
      );


      alert(
        error.message ||
        'Unable to save assessment.'
      );
    }
  }


  function handleSaveDraft() {
    saveAssessment(
      'DRAFT'
    );
  }


  function handlePublish() {
    saveAssessment(
      'SCHEDULED'
    );
  }

  function handleSaveChanges() {
    saveAssessment(
      status
    );
  }


  function handleCancel() {
    navigate(
      `/educator/courses/${courseId}/assessments`
    );
  }


  /*
   * QUESTION MODAL
   */

  function openAddQuestion() {
    setEditingQuestionId(
      null
    );

    setQuestionForm(
      createEmptyQuestionForm()
    );

    setQuestionErrors({});

    setQuestionModalOpen(
      true
    );
  }


  function openEditQuestion(
    question
  ) {
    setEditingQuestionId(
      question.questionId
    );


    setQuestionForm({
      type:
        question.type,

      content:
        question.content,

      points:
        question.points,

      options:
        Array.isArray(
          question.options
        )
          ? question.options.map(
              (option) => ({
                ...option
              })
            )
          : []
    });


    setQuestionErrors({});

    setQuestionModalOpen(
      true
    );
  }


  function closeQuestionModal() {
    setQuestionModalOpen(
      false
    );

    setEditingQuestionId(
      null
    );

    setQuestionForm(
      createEmptyQuestionForm()
    );

    setQuestionErrors({});
  }


  function updateQuestionField(
    field,
    value
  ) {
    setQuestionForm(
      (previous) => ({
        ...previous,
        [field]: value
      })
    );


    setQuestionErrors(
      (previous) => ({
        ...previous,
        [field]: null
      })
    );
  }


  function changeQuestionType(
    nextType
  ) {
    if (
      nextType ===
      'MULTIPLE_CHOICE'
    ) {
      setQuestionForm(
        (previous) => ({
          ...previous,

          type:
            'MULTIPLE_CHOICE',

          options:
            previous.options
              .length >= 2
              ? previous.options
              : createEmptyQuestionForm()
                  .options
        })
      );
    } else {
      setQuestionForm(
        (previous) => ({
          ...previous,

          type:
            'ESSAY',

          options: []
        })
      );
    }


    setQuestionErrors({});
  }


  function addOption() {
    setQuestionForm(
      (previous) => ({
        ...previous,

        options: [
          ...previous.options,

          {
            optionId:
              `temp-option-${Date.now()}-${previous.options.length + 1}`,

            content: '',

            isCorrect: false
          }
        ]
      })
    );
  }


  function updateOption(
    optionId,
    field,
    value
  ) {
    setQuestionForm(
      (previous) => ({
        ...previous,

        options:
          previous.options.map(
            (option) => {
              if (
                String(
                  option.optionId
                ) !==
                String(
                  optionId
                )
              ) {
                return option;
              }


              /*
               * Exactly one correct answer.
               */
              if (
                field ===
                'isCorrect'
              ) {
                return {
                  ...option,

                  isCorrect: true
                };
              }


              return {
                ...option,

                [field]: value
              };
            }
          ).map(
            (option) => {
              if (
                field ===
                  'isCorrect' &&
                Number(
                  option.optionId
                ) !==
                Number(
                  optionId
                )
              ) {
                return {
                  ...option,

                  isCorrect: false
                };
              }


              return option;
            }
          )
      })
    );
  }


  function removeOption(
    optionId
  ) {
    setQuestionForm(
      (previous) => ({
        ...previous,

        options:
          previous.options.filter(
            (option) =>
              String(
              option.optionId
            ) !==
            String(
              optionId
            )
          )
      })
    );
  }


  function validateQuestion() {
    const nextErrors = {};


    if (
      !questionForm
        .content
        .trim()
    ) {
      nextErrors.content =
        'Question content is required.';
    }


    const points =
      Number(
        questionForm.points
      );


    if (
      !Number.isFinite(
        points
      ) ||
      points <= 0
    ) {
      nextErrors.points =
        'Question points must be greater than 0.';
    }


    if (
      questionForm.type ===
      'MULTIPLE_CHOICE'
    ) {
      if (
        questionForm.options
          .length < 2
      ) {
        nextErrors.options =
          'A multiple-choice question must have at least two options.';
      }


      if (
        questionForm.options.some(
          (option) =>
            !option.content.trim()
        )
      ) {
        nextErrors.options =
          'All options must have content.';
      }


      const correctCount =
        questionForm.options.filter(
          (option) =>
            option.isCorrect
        ).length;


      if (
        correctCount !== 1
      ) {
        nextErrors.options =
          'A multiple-choice question must have exactly one correct option.';
      }
    }


    setQuestionErrors(
      nextErrors
    );


    return (
      Object.keys(
        nextErrors
      ).length === 0
    );
  }


  async function saveQuestion() {
    if (
      !validateQuestion()
    ) {
      return;
    }


    const editingIndex =
      editingQuestionId !== null
        ? questions.findIndex(
            (question) =>
              String(
                question.questionId
              ) ===
              String(
                editingQuestionId
              )
          )
        : -1;


    const payload =
      buildQuestionPayload(
        questionForm,
        editingIndex >= 0
          ? editingIndex
          : questions.length
      );


    try {
      /*
      * =========================
      * CREATE ASSESSMENT MODE
      * =========================
      *
      * Assessment chưa tồn tại
      * nên Question chỉ nằm ở
      * React state.
      */
      if (!isEditMode) {
        /*
        * EDIT LOCAL QUESTION
        */
        if (
          editingQuestionId !==
          null
        ) {
          setQuestions(
            (previous) =>
              previous.map(
                (question) =>
                  String(
                    question.questionId
                  ) ===
                  String(
                    editingQuestionId
                  )
                    ? {
                        ...question,

                        ...payload,

                        /*
                        * Keep UI option
                        * objects.
                        */
                        options:
                          questionForm.type ===
                          'MULTIPLE_CHOICE'
                            ? questionForm
                                .options
                                .map(
                                  (
                                    option
                                  ) => ({
                                    ...option,

                                    content:
                                      option
                                        .content
                                        .trim()
                                  })
                                )
                            : []
                      }
                    : question
              )
          );


          closeQuestionModal();

          return;
        }


        /*
        * ADD LOCAL QUESTION
        */
        const newQuestion = {
          ...payload,

          questionId:
            `temp-question-${Date.now()}-${questions.length + 1}`,

          assessmentId:
            null,

          options:
            questionForm.type ===
            'MULTIPLE_CHOICE'
              ? questionForm
                  .options
                  .map(
                    (option) => ({
                      ...option,

                      content:
                        option.content
                          .trim()
                    })
                  )
              : []
        };


        setQuestions(
          (previous) => [
            ...previous,
            newQuestion
          ]
        );


        closeQuestionModal();

        return;
      }


      /*
      * =========================
      * EDIT ASSESSMENT MODE
      * =========================
      *
      * Assessment already exists,
      * therefore Question changes
      * go directly to backend.
      */


      /*
      * UPDATE QUESTION
      */
      if (
        editingQuestionId !==
        null
      ) {
        const result =
          await updateAssessmentQuestion(
            assessmentId,
            editingQuestionId,
            payload
          );


        const updatedQuestion =
          normalizeQuestion(
            result.question
          );


        setQuestions(
          (previous) =>
            previous.map(
              (question) =>
                String(
                  question.questionId
                ) ===
                String(
                  editingQuestionId
                )
                  ? {
                      ...question,
                      ...updatedQuestion
                    }
                  : question
            )
        );


        closeQuestionModal();

        return;
      }


      /*
      * ADD QUESTION
      */
      const result =
        await addAssessmentQuestion(
          assessmentId,
          payload
        );


      const newQuestion =
        normalizeQuestion(
          result.question
        );


      setQuestions(
        (previous) => [
          ...previous,
          newQuestion
        ]
      );


      closeQuestionModal();
    } catch (error) {
      console.error(
        'Unable to save question:',
        error
      );


      alert(
        error.message ||
        'Unable to save question.'
      );
    }
  }


  async function confirmDeleteQuestion() {
    if (!questionToDelete) {
      return;
    }

    try {
      /*
      * Existing Question:
      * delete it from Backend first.
      */
      if (
        assessmentId &&
        questionToDelete.questionId
      ) {
        await deleteAssessmentQuestion(
          assessmentId,
          questionToDelete.questionId
        );
      }


      /*
      * Remove from local UI
      * only after Backend succeeds.
      */
      setQuestions(
        (previous) =>
          previous.filter(
            (question) =>
              String(
                question.questionId
              ) !==
              String(
                questionToDelete
                  .questionId
              )
          )
      );


      setQuestionToDelete(null);

    } catch (error) {
      console.error(
        'Unable to delete question:',
        error
      );

      alert(
        error.message ||
        'Unable to delete question.'
      );
    }
  }


  if (
    courseArchived
  ) {
    return (
      <ReadOnlyMessage
        course={course}
        message="This course is archived. New assessments cannot be created or edited."
      />
    );
  }


  if (blockedMessage) {
    return (
      <ReadOnlyMessage
        course={course}
        message={
          blockedMessage
        }
      />
    );
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


            <span>/</span>


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


            <span>/</span>


            <Link
              to={
                `/educator/courses/${course.courseId}/assessments`
              }
              className="
                hover:text-blue-600
              "
            >
              Assessments
            </Link>


            <span>/</span>


            <span>
              {
                isEditMode
                  ? 'Edit'
                  : 'Create'
              }
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
              isEditMode
                ? 'Edit Assessment'
                : 'Create Assessment'
            }
          </h1>
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


          {isEditMode &&
          status === 'SCHEDULED' ? (
            <button
              type="button"
              onClick={
                handleSaveChanges
              }
              className="
                text-xs
                font-semibold
                text-white
                bg-blue-600
                hover:bg-blue-700
                px-4
                py-2
                rounded-lg
                shadow-sm
              "
            >
              Save Changes
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={
                  handleSaveDraft
                }
                className="
                  text-xs
                  font-semibold
                  text-blue-600
                  bg-blue-50
                  px-4
                  py-2
                  rounded-lg
                  hover:bg-blue-100
                "
              >
                Save Draft
              </button>


              <button
                type="button"
                onClick={
                  handlePublish
                }
                className="
                  text-xs
                  font-semibold
                  text-white
                  bg-blue-600
                  hover:bg-blue-700
                  px-4
                  py-2
                  rounded-lg
                  shadow-sm
                "
              >
                Publish
              </button>
            </>
          )}
        </div>
      </header>


      {/* MAIN */}
      <main
        className="
          p-6
        "
      >
        <div
          className="
            max-w-6xl
            mx-auto
            grid
            grid-cols-1
            xl:grid-cols-3
            gap-6
          "
        >
          {/* LEFT */}
          <div
            className="
              xl:col-span-2
              space-y-6
            "
          >
            {/* BASIC INFORMATION */}
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
              <SectionHeader
                title="Basic Information"
                description="Define the assessment type and general information."
              />


              <div
                className="
                  p-6
                  space-y-5
                "
              >
                {/* TITLE */}
                <FormField
                  label="Assessment Title"
                  required
                  error={
                    errors.title
                  }
                >
                  <input
                    type="text"
                    value={
                      title
                    }
                    onChange={
                      (event) => {
                        setTitle(
                          event.target.value
                        );

                        updateError(
                          'title'
                        );
                      }
                    }
                    placeholder="e.g., Quiz 01 - Programming Basics"
                    className={`
                      w-full
                      rounded-lg
                      border
                      px-3
                      py-2.5
                      text-sm
                      outline-none
                      focus:ring-1
                      focus:ring-blue-300

                      ${
                        errors.title
                          ? 'border-red-400'
                          : 'border-gray-200'
                      }
                    `}
                  />
                </FormField>


                {/* DESCRIPTION */}
                <FormField
                  label="Description"
                >
                  <textarea
                    rows={4}
                    value={
                      description
                    }
                    onChange={
                      (event) =>
                        setDescription(
                          event.target.value
                        )
                    }
                    placeholder="Describe this assessment..."
                    className="
                      w-full
                      rounded-lg
                      border
                      border-gray-200
                      px-3
                      py-2.5
                      text-sm
                      outline-none
                      resize-y
                      focus:ring-1
                      focus:ring-blue-300
                    "
                  />
                </FormField>


                {/* TYPE */}
                <FormField
                  label="Assessment Type"
                  required
                >
                  <div
                    className="
                      grid
                      grid-cols-2
                      gap-3
                    "
                  >
                    <TypeOption
                      active={
                        type ===
                        'QUIZ'
                      }
                      title="Quiz"
                      description="Question-based assessment that may be automatically graded."
                      onClick={() =>
                        setType(
                          'QUIZ'
                        )
                      }
                    />


                    <TypeOption
                      active={
                        type ===
                        'ASSIGNMENT'
                      }
                      title="Assignment"
                      description="Official coursework that may require manual review."
                      onClick={() =>
                        setType(
                          'ASSIGNMENT'
                        )
                      }
                    />
                  </div>
                </FormField>


                {/* INSTRUCTIONS */}
                <FormField
                  label="Instructions"
                >
                  <textarea
                    rows={6}
                    value={
                      instructions
                    }
                    onChange={
                      (event) =>
                        setInstructions(
                          event.target.value
                        )
                    }
                    placeholder="Enter instructions for learners..."
                    className="
                      w-full
                      rounded-lg
                      border
                      border-gray-200
                      px-3
                      py-2.5
                      text-sm
                      outline-none
                      resize-y
                      focus:ring-1
                      focus:ring-blue-300
                    "
                  />
                </FormField>


                {/* FILE */}
                <FormField
                  label="Instruction File"
                >
                  <input
                    type="file"
                    onChange={(event) => {
                      const file =
                        event.target
                          .files?.[0] ||
                        null;


                      setInstructionFile(
                        file
                      );


                      setErrors(
                        (previous) => ({
                          ...previous,
                          content: null
                        })
                      );
                    }}
                    className="
                      block
                      w-full
                      text-sm
                      text-gray-600
                    "
                  />


                  {instructionFile && (
                    <div
                      className="
                        mt-3
                        bg-gray-50
                        rounded-lg
                        px-3
                        py-2
                        flex
                        items-center
                        justify-between
                        gap-3
                      "
                    >
                      <span
                        className="
                          text-xs
                          text-gray-600
                          truncate
                        "
                      >
                        {
                          instructionFile.name
                        }
                      </span>


                      <button
                        type="button"
                        onClick={() =>
                          setInstructionFile(
                            null
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
                  )}
                  {!instructionFile &&
                  existingInstructionFileUrl && (
                    <div
                      className="
                        mt-3
                        bg-gray-50
                        rounded-lg
                        px-3
                        py-2
                      "
                    >
                      <a
                        href={
                          existingInstructionFileUrl
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="
                          text-xs
                          font-semibold
                          text-blue-600
                          hover:underline
                        "
                      >
                        View current instruction file
                      </a>
                    </div>
                  )}
                </FormField>


                {errors.content && (
                  <p
                    className="
                      text-xs
                      text-red-500
                    "
                  >
                    {
                      errors.content
                    }
                  </p>
                )}
              </div>
            </section>


            {/* QUESTIONS */}
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
                  flex
                  items-center
                  justify-between
                  gap-4
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
                    Questions
                  </h2>


                  <p
                    className="
                      text-xs
                      text-gray-400
                      mt-1
                    "
                  >
                    Add multiple-choice
                    or essay questions.
                  </p>
                </div>


                <button
                  type="button"
                  onClick={
                    openAddQuestion
                  }
                  className="
                    text-xs
                    font-semibold
                    text-blue-600
                    bg-blue-50
                    hover:bg-blue-100
                    px-3
                    py-2
                    rounded-lg
                  "
                >
                  + Add Question
                </button>
              </div>


              {questions.length === 0 ? (
                <div
                  className="
                    py-12
                    px-6
                    text-center
                  "
                >
                  <p
                    className="
                      text-sm
                      text-gray-500
                    "
                  >
                    No questions added
                    yet.
                  </p>
                </div>
              ) : (
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
                    ) => (
                      <div
                        key={
                          question
                            .questionId
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
                            gap-5
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
                                w-8
                                h-8
                                bg-gray-100
                                rounded-full
                                flex
                                items-center
                                justify-center
                                text-xs
                                font-bold
                                text-gray-600
                                flex-shrink-0
                              "
                            >
                              {
                                index + 1
                              }
                            </div>


                            <div>
                              <div
                                className="
                                  flex
                                  items-center
                                  flex-wrap
                                  gap-2
                                "
                              >
                                <span
                                  className="
                                    text-[10px]
                                    font-bold
                                    bg-blue-50
                                    text-blue-700
                                    rounded-full
                                    px-2.5
                                    py-1
                                  "
                                >
                                  {
                                    question.type
                                  }
                                </span>


                                <span
                                  className="
                                    text-[10px]
                                    font-semibold
                                    text-gray-400
                                  "
                                >
                                  {
                                    question.points
                                  }{' '}
                                  points
                                </span>
                              </div>


                              <p
                                className="
                                  text-sm
                                  font-semibold
                                  text-gray-800
                                  mt-2
                                "
                              >
                                {
                                  question.content
                                }
                              </p>


                              {question.type ===
                                'MULTIPLE_CHOICE' && (
                                <div
                                  className="
                                    mt-3
                                    space-y-2
                                  "
                                >
                                  {question.options.map(
                                    (
                                      option
                                    ) => (
                                      <div
                                        key={
                                          option.optionId
                                        }
                                        className="
                                          flex
                                          items-center
                                          gap-2
                                        "
                                      >
                                        <span
                                          className={`
                                            w-2
                                            h-2
                                            rounded-full

                                            ${
                                              option.isCorrect
                                                ? 'bg-green-500'
                                                : 'bg-gray-300'
                                            }
                                          `}
                                        />


                                        <span
                                          className="
                                            text-xs
                                            text-gray-500
                                          "
                                        >
                                          {
                                            option.content
                                          }
                                        </span>


                                        {option.isCorrect && (
                                          <span
                                            className="
                                              text-[10px]
                                              font-semibold
                                              text-green-600
                                            "
                                          >
                                            Correct
                                          </span>
                                        )}
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          </div>


                          <div
                            className="
                              flex
                              gap-2
                              flex-shrink-0
                            "
                          >
                            <button
                              type="button"
                              onClick={() =>
                                openEditQuestion(
                                  question
                                )
                              }
                              className="
                                text-xs
                                font-semibold
                                text-blue-600
                                bg-blue-50
                                px-3
                                py-2
                                rounded-lg
                                hover:bg-blue-100
                              "
                            >
                              Edit
                            </button>


                            <button
                              type="button"
                              onClick={() =>
                                setQuestionToDelete(
                                  question
                                )
                              }
                              className="
                                text-xs
                                font-semibold
                                text-red-600
                                bg-red-50
                                px-3
                                py-2
                                rounded-lg
                                hover:bg-red-100
                              "
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>
          </div>


          {/* RIGHT SETTINGS */}
          <div
            className="
              space-y-6
            "
          >
            {/* COURSE */}
            <section
              className="
                bg-white
                rounded-xl
                border
                border-gray-100
                shadow-sm
                p-5
              "
            >
              <h2
                className="
                  text-sm
                  font-bold
                  text-gray-800
                "
              >
                Course
              </h2>


              <div
                className="
                  mt-3
                  bg-gray-50
                  rounded-lg
                  px-3
                  py-3
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
                    mt-1
                  "
                >
                  {
                    course.courseCode
                  }
                </p>
              </div>
            </section>


            {/* SCORING */}
            <section
              className="
                bg-white
                rounded-xl
                border
                border-gray-100
                shadow-sm
                p-5
              "
            >
              <h2
                className="
                  text-sm
                  font-bold
                  text-gray-800
                "
              >
                Scoring
              </h2>


              <div
                className="
                  mt-4
                  space-y-4
                "
              >
                <FormField
                  label="Total Points"
                  required
                  error={
                    errors.totalPoints
                  }
                >
                  <input
                    type="number"
                    min="1"
                    value={
                      totalPoints
                    }
                    onChange={
                      (event) => {
                        setTotalPoints(
                          event.target.value
                        );

                        updateError(
                          'totalPoints'
                        );
                      }
                    }
                    className={`
                      w-full
                      rounded-lg
                      border
                      px-3
                      py-2.5
                      text-sm
                      outline-none

                      ${
                        errors.totalPoints
                          ? 'border-red-400'
                          : 'border-gray-200'
                      }
                    `}
                  />
                </FormField>


                <div
                  className="
                    flex
                    items-center
                    justify-between
                    text-xs
                  "
                >
                  <span
                    className="
                      text-gray-500
                    "
                  >
                    Question points
                  </span>


                  <span
                    className={`
                      font-bold

                      ${
                        questionPointsTotal >
                        Number(
                          totalPoints
                        )
                          ? 'text-red-600'
                          : 'text-gray-700'
                      }
                    `}
                  >
                    {
                      questionPointsTotal
                    }
                    {' / '}
                    {
                      totalPoints ||
                      0
                    }
                  </span>
                </div>
              </div>
            </section>


            {/* SCHEDULE */}
            <section
              className="
                bg-white
                rounded-xl
                border
                border-gray-100
                shadow-sm
                p-5
              "
            >
              <h2
                className="
                  text-sm
                  font-bold
                  text-gray-800
                "
              >
                Schedule
              </h2>


              <div
                className="
                  mt-4
                  space-y-4
                "
              >
                <FormField
                  label="Start Time"
                  error={
                    errors.startTime
                  }
                >
                  <input
                    type="datetime-local"
                    value={
                      startTime
                    }
                    onChange={
                      (event) => {
                        setStartTime(
                          event.target.value
                        );

                        updateError(
                          'startTime'
                        );
                      }
                    }
                    className={`
                      w-full
                      rounded-lg
                      border
                      px-3
                      py-2.5
                      text-sm
                      outline-none

                      ${
                        errors.startTime
                          ? 'border-red-400'
                          : 'border-gray-200'
                      }
                    `}
                  />
                </FormField>


                <FormField
                  label="Deadline"
                  error={
                    errors.deadline
                  }
                >
                  <input
                    type="datetime-local"
                    value={
                      deadline
                    }
                    onChange={
                      (event) => {
                        setDeadline(
                          event.target.value
                        );

                        updateError(
                          'deadline'
                        );
                      }
                    }
                    className={`
                      w-full
                      rounded-lg
                      border
                      px-3
                      py-2.5
                      text-sm
                      outline-none

                      ${
                        errors.deadline
                          ? 'border-red-400'
                          : 'border-gray-200'
                      }
                    `}
                  />
                </FormField>


                <label
                  className="
                    flex
                    items-start
                    gap-3
                    cursor-pointer
                  "
                >
                  <input
                    type="checkbox"
                    checked={
                      allowLateSubmission
                    }
                    onChange={
                      (event) =>
                        setAllowLateSubmission(
                          event.target.checked
                        )
                    }
                    className="
                      mt-0.5
                    "
                  />


                  <div>
                    <p
                      className="
                        text-sm
                        font-semibold
                        text-gray-700
                      "
                    >
                      Allow Late Submission
                    </p>


                    <p
                      className="
                        text-[11px]
                        text-gray-400
                        mt-1
                      "
                    >
                      Learners may submit
                      after the deadline
                      and the submission
                      will be marked late.
                    </p>
                  </div>
                </label>
              </div>
            </section>


            {/* CURRENT STATUS */}
            {isEditMode && (
              <section
                className="
                  bg-white
                  rounded-xl
                  border
                  border-gray-100
                  shadow-sm
                  p-5
                "
              >
                <p
                  className="
                    text-xs
                    uppercase
                    font-semibold
                    text-gray-400
                  "
                >
                  Current Status
                </p>


                <span
                  className="
                    inline-flex
                    mt-3
                    rounded-full
                    bg-blue-50
                    text-blue-700
                    px-3
                    py-1
                    text-xs
                    font-bold
                  "
                >
                  {
                    status
                  }
                </span>
              </section>
            )}
          </div>
        </div>
      </main>


      {/* QUESTION MODAL */}
      {questionModalOpen && (
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
              rounded-xl
              shadow-xl
              w-full
              max-w-2xl
              max-h-[90vh]
              overflow-y-auto
            "
          >
            <div
              className="
                px-6
                py-4
                border-b
                border-gray-100
                flex
                items-center
                justify-between
              "
            >
              <h2
                className="
                  text-lg
                  font-bold
                  text-gray-800
                "
              >
                {
                  editingQuestionId !==
                  null
                    ? 'Edit Question'
                    : 'Add Question'
                }
              </h2>


              <button
                type="button"
                onClick={
                  closeQuestionModal
                }
                className="
                  text-gray-400
                  hover:text-gray-700
                "
              >
                ✕
              </button>
            </div>


            <div
              className="
                p-6
                space-y-5
              "
            >
              {/* QUESTION TYPE */}
              <FormField
                label="Question Type"
                required
              >
                <div
                  className="
                    grid
                    grid-cols-2
                    gap-3
                  "
                >
                  <TypeOption
                    active={
                      questionForm.type ===
                      'MULTIPLE_CHOICE'
                    }
                    title="Multiple Choice"
                    description="Learner chooses one correct option."
                    onClick={() =>
                      changeQuestionType(
                        'MULTIPLE_CHOICE'
                      )
                    }
                  />


                  <TypeOption
                    active={
                      questionForm.type ===
                      'ESSAY'
                    }
                    title="Essay"
                    description="Learner provides a written response."
                    onClick={() =>
                      changeQuestionType(
                        'ESSAY'
                      )
                    }
                  />
                </div>
              </FormField>


              {/* CONTENT */}
              <FormField
                label="Question Content"
                required
                error={
                  questionErrors.content
                }
              >
                <textarea
                  rows={4}
                  value={
                    questionForm.content
                  }
                  onChange={
                    (event) =>
                      updateQuestionField(
                        'content',
                        event.target.value
                      )
                  }
                  placeholder="Enter the question..."
                  className={`
                    w-full
                    rounded-lg
                    border
                    px-3
                    py-2.5
                    text-sm
                    outline-none
                    resize-y

                    ${
                      questionErrors.content
                        ? 'border-red-400'
                        : 'border-gray-200'
                    }
                  `}
                />
              </FormField>


              {/* POINTS */}
              <FormField
                label="Points"
                required
                error={
                  questionErrors.points
                }
              >
                <input
                  type="number"
                  min="1"
                  value={
                    questionForm.points
                  }
                  onChange={
                    (event) =>
                      updateQuestionField(
                        'points',
                        event.target.value
                      )
                  }
                  className={`
                    w-full
                    rounded-lg
                    border
                    px-3
                    py-2.5
                    text-sm
                    outline-none

                    ${
                      questionErrors.points
                        ? 'border-red-400'
                        : 'border-gray-200'
                    }
                  `}
                />
              </FormField>


              {/* MC OPTIONS */}
              {questionForm.type ===
                'MULTIPLE_CHOICE' && (
                <div>
                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      gap-4
                    "
                  >
                    <div>
                      <p
                        className="
                          text-sm
                          font-semibold
                          text-gray-700
                        "
                      >
                        Answer Options *
                      </p>


                      <p
                        className="
                          text-[11px]
                          text-gray-400
                          mt-1
                        "
                      >
                        Select exactly
                        one correct
                        answer.
                      </p>
                    </div>


                    <button
                      type="button"
                      onClick={
                        addOption
                      }
                      className="
                        text-xs
                        font-semibold
                        text-blue-600
                        hover:underline
                      "
                    >
                      + Add Option
                    </button>
                  </div>


                  <div
                    className="
                      mt-3
                      space-y-3
                    "
                  >
                    {questionForm.options.map(
                      (
                        option,
                        index
                      ) => (
                        <div
                          key={
                            option.optionId
                          }
                          className="
                            flex
                            items-center
                            gap-3
                          "
                        >
                          <input
                            type="radio"
                            name="correct-option"
                            checked={
                              option.isCorrect
                            }
                            onChange={() =>
                              updateOption(
                                option.optionId,
                                'isCorrect',
                                true
                              )
                            }
                          />


                          <span
                            className="
                              w-6
                              text-xs
                              font-semibold
                              text-gray-400
                            "
                          >
                            {
                              String.fromCharCode(
                                65 + index
                              )
                            }.
                          </span>


                          <input
                            type="text"
                            value={
                              option.content
                            }
                            onChange={
                              (event) =>
                                updateOption(
                                  option.optionId,
                                  'content',
                                  event.target.value
                                )
                            }
                            placeholder={`Option ${String.fromCharCode(
                              65 + index
                            )}`}
                            className="
                              flex-1
                              rounded-lg
                              border
                              border-gray-200
                              px-3
                              py-2
                              text-sm
                              outline-none
                            "
                          />


                          <button
                            type="button"
                            disabled={
                              questionForm
                                .options
                                .length <= 2
                            }
                            onClick={() =>
                              removeOption(
                                option.optionId
                              )
                            }
                            className={`
                              text-xs
                              font-semibold

                              ${
                                questionForm
                                  .options
                                  .length <= 2
                                  ? `
                                    text-gray-300
                                    cursor-not-allowed
                                  `
                                  : `
                                    text-red-500
                                  `
                              }
                            `}
                          >
                            Remove
                          </button>
                        </div>
                      )
                    )}
                  </div>


                  {questionErrors.options && (
                    <p
                      className="
                        text-xs
                        text-red-500
                        mt-2
                      "
                    >
                      {
                        questionErrors.options
                      }
                    </p>
                  )}
                </div>
              )}
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
                onClick={
                  closeQuestionModal
                }
                className="
                  text-sm
                  font-semibold
                  text-gray-600
                  bg-gray-100
                  px-4
                  py-2
                  rounded-lg
                "
              >
                Cancel
              </button>


              <button
                type="button"
                onClick={
                  saveQuestion
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
                "
              >
                {
                  editingQuestionId !==
                  null
                    ? 'Save Changes'
                    : 'Add Question'
                }
              </button>
            </div>
          </div>
        </div>
      )}


      {/* DELETE QUESTION */}
      {questionToDelete && (
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
              p-6
            "
          >
            <h2
              className="
                text-lg
                font-bold
                text-gray-800
              "
            >
              Delete Question?
            </h2>


            <p
              className="
                text-sm
                text-gray-500
                mt-2
              "
            >
              Are you sure you want to
              remove this question from
              the assessment?
            </p>


            <div
              className="
                mt-4
                bg-gray-50
                rounded-lg
                px-3
                py-3
              "
            >
              <p
                className="
                  text-sm
                  text-gray-700
                "
              >
                {
                  questionToDelete
                    .content
                }
              </p>
            </div>


            <div
              className="
                mt-6
                flex
                justify-end
                gap-3
              "
            >
              <button
                type="button"
                onClick={() =>
                  setQuestionToDelete(
                    null
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
                "
              >
                Cancel
              </button>


              <button
                type="button"
                onClick={
                  confirmDeleteQuestion
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
                Delete Question
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


function SectionHeader({
  title,
  description
}) {
  return (
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
        {title}
      </h2>


      {description && (
        <p
          className="
            text-xs
            text-gray-400
            mt-1
          "
        >
          {description}
        </p>
      )}
    </div>
  );
}


function FormField({
  label,
  required = false,
  error,
  children
}) {
  return (
    <div>
      <label
        className="
          block
          text-sm
          font-semibold
          text-gray-700
          mb-2
        "
      >
        {label}

        {required && (
          <span
            className="
              text-red-500
              ml-1
            "
          >
            *
          </span>
        )}
      </label>


      {children}


      {error && (
        <p
          className="
            text-xs
            text-red-500
            mt-1
          "
        >
          {error}
        </p>
      )}
    </div>
  );
}


function TypeOption({
  active,
  title,
  description,
  onClick
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`
        text-left
        rounded-xl
        border
        p-4
        transition

        ${
          active
            ? `
              border-blue-500
              bg-blue-50
            `
            : `
              border-gray-200
              bg-white
              hover:border-gray-300
            `
        }
      `}
    >
      <p
        className={`
          text-sm
          font-bold

          ${
            active
              ? 'text-blue-700'
              : 'text-gray-700'
          }
        `}
      >
        {title}
      </p>


      <p
        className="
          text-[11px]
          text-gray-400
          mt-1
          leading-4
        "
      >
        {description}
      </p>
    </button>
  );
}


function ReadOnlyMessage({
  course,
  message
}) {
  return (
    <div
      className="
        p-8
      "
    >
      <div
        className="
          max-w-xl
          mx-auto
          bg-white
          border
          border-gray-100
          rounded-xl
          shadow-sm
          p-8
          text-center
        "
      >
        <div
          className="
            w-12
            h-12
            mx-auto
            rounded-full
            bg-amber-100
            flex
            items-center
            justify-center
            text-amber-700
            font-bold
          "
        >
          !
        </div>


        <h1
          className="
            text-lg
            font-bold
            text-gray-800
            mt-4
          "
        >
          Assessment Cannot Be Modified
        </h1>


        <p
          className="
            text-sm
            text-gray-500
            mt-2
          "
        >
          {message}
        </p>


        <Link
          to={
            `/educator/courses/${course.courseId}/assessments`
          }
          className="
            inline-block
            mt-5
            text-sm
            font-semibold
            text-blue-600
            hover:underline
          "
        >
          Back to Assessments
        </Link>
      </div>
    </div>
  );
}