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
  addCourseMaterial,
  deleteCourseMaterial,
  getCourseMaterials,
  updateCourseMaterial,
  reorderCourseMaterials
} from '../../features/classroom/courseContentApi';


const MATERIALS_KEY =
  'acognix_course_materials';


function createNextId(items) {
  if (items.length === 0) {
    return 1;
  }


  const ids =
    items
      .map(
        (item) =>
          Number(
            item.materialId
          )
      )
      .filter(
        Number.isFinite
      );


  return ids.length
    ? Math.max(...ids) + 1
    : 1;
}

function getMaterialOrder(
  material
) {
  const order =
    Number(
      material.orderIndex
    );


  if (
    Number.isFinite(order) &&
    order > 0
  ) {
    return order;
  }


  const materialId =
    Number(
      material.materialId
    );


  return Number.isFinite(
    materialId
  )
    ? materialId
    : 0;
}

function createEmptyForm() {
  return {
    title: '',
    description: '',
    resourceType:
      'FILE',
    file: null,
    fileName: '',
    resourceUrl: ''
  };
}


export default function CourseMaterialsPage() {
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
    materials,
    setMaterials
  ] = useState([]);


  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    reordering,
    setReordering
  ] = useState(false);

  const [
    loadError,
    setLoadError
  ] = useState('');


  const [
    isModalOpen,
    setIsModalOpen
  ] = useState(false);


  const [
    editingMaterialId,
    setEditingMaterialId
  ] = useState(null);


  const [
    materialToDelete,
    setMaterialToDelete
  ] = useState(null);


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


  useEffect(() => {
    if (!courseId) {
      setCourse(null);
      setMaterials([]);
      setLoadError('');
      setLoading(false);

      return;
    }


    let cancelled = false;


    async function loadMaterialsPage() {
      try {
        setLoading(true);
        setLoadError('');


        const [
          courseResult,
          materialResult
        ] = await Promise.all([
          getCourses(),
          getCourseMaterials(
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
        if (!cancelled) {
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
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }


    loadMaterialsPage();


    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const courseMaterials =
    useMemo(() => {
      return materials
        .filter(
          (material) =>
            String(
              material.courseId
            ) ===
            String(courseId)
        )
        .sort(
          (
            first,
            second
          ) =>
            getMaterialOrder(
              first
            ) -
            getMaterialOrder(
              second
            )
        );
    }, [
      materials,
      courseId
    ]);


  if (loading) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-gray-500">
          Loading course materials...
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
          className="inline-block mt-3 text-sm text-blue-600 hover:underline"
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

  const editingMaterial =
    editingMaterialId !== null
      ? materials.find(
          (material) =>
            String(
              material.materialId
            ) ===
            String(
              editingMaterialId
            )
        ) || null
      : null;


  const hasExistingFile =
    editingMaterial
      ?.resourceType === 'FILE' &&
    Boolean(
      editingMaterial
        ?.resourceUrl
    );

  function openAddModal() {
    setEditingMaterialId(
      null
    );

    setForm(
      createEmptyForm()
    );

    setErrors({});

    setIsModalOpen(true);
  }


  function openEditModal(
    material
  ) {
    setEditingMaterialId(
      material.materialId
    );

    setForm({
      title:
        material.title || '',

      description:
        material.description ||
        '',

      resourceType:
        material.resourceType ||
        'FILE',
      
      file: null,

      fileName:
        material.fileName || '',

      resourceUrl:
        material.resourceUrl ||
        ''
    });

    setErrors({});

    setIsModalOpen(true);
  }


  function closeModal() {
    setIsModalOpen(false);

    setEditingMaterialId(
      null
    );

    setForm(
      createEmptyForm()
    );

    setErrors({});
  }

  function handleResourceTypeChange(
    resourceType
  ) {
    setForm(
      (previous) => ({
        ...previous,

        resourceType,

        file: null,

        fileName: '',

        resourceUrl:
          resourceType ===
            'LINK' &&
          previous.resourceType ===
            'LINK'
            ? previous.resourceUrl
            : ''
      })
    );


    setErrors(
      (previous) => ({
        ...previous,
        fileName: null,
        resourceUrl: null
      })
    );
  }

  function handleFileChange(
    event
  ) {
    const file =
      event.target.files?.[0] ||
      null;


    setForm(
      (previous) => ({
        ...previous,

        file: file,

        fileName:
          file?.name || ''
      })
    );


    setErrors(
      (previous) => ({
        ...previous,

        fileName: null
      })
    );
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


  function validateMaterial() {
    const nextErrors = {};


    if (!form.title.trim()) {
      nextErrors.title =
        'Title is required.';
    }


    if (
      form.resourceType === 'FILE' &&
      !form.file &&
      !hasExistingFile
    ) {
      nextErrors.fileName =
        'Please choose a file.';
    }


    if (
      form.resourceType === 'LINK' &&
      !form.resourceUrl.trim()
    ) {
      nextErrors.resourceUrl =
        'Link URL is required.';
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


  async function handleSaveMaterial() {
    if (!validateMaterial()) {
      return;
    }


    const formData =
      new FormData();


    formData.append(
      'title',
      form.title.trim()
    );


    formData.append(
      'description',
      form.description.trim()
    );


    formData.append(
      'resourceType',
      form.resourceType
    );


    if (
      form.resourceType ===
      'FILE'
    ) {
      if (form.file) {
        formData.append(
          'file',
          form.file
        );
      }
    } else {
      formData.append(
        'linkUrl',
        form.resourceUrl.trim()
      );
    }


    try {
      if (
        editingMaterialId !==
        null
      ) {
        const result =
          await updateCourseMaterial(
            editingMaterialId,
            formData
          );


        const updatedMaterial =
          result.material;


        setMaterials(
          (previousMaterials) =>
            previousMaterials.map(
              (material) =>
                String(
                  material.materialId
                ) ===
                String(
                  updatedMaterial.materialId
                )
                  ? {
                      ...material,
                      ...updatedMaterial
                    }
                  : material
            )
        );


        closeModal();


        return;
      }


      const result =
        await addCourseMaterial(
          courseId,
          formData
        );


      const newMaterial =
        result.material;


      setMaterials(
        (previousMaterials) => [
          ...previousMaterials,
          newMaterial
        ]
      );


      closeModal();
    } catch (error) {
      console.error(
        editingMaterialId !==
          null
          ? 'Unable to update course material:'
          : 'Unable to add course material:',
        error
      );


      alert(
        error.message ||
        (
          editingMaterialId !==
            null
            ? 'Unable to update course material.'
            : 'Unable to add course material.'
        )
      );
    }
  }

  async function handleMoveMaterial(
    materialId,
    direction
  ) {
    if (
      isArchived ||
      reordering
    ) {
      return;
    }

    const currentIndex =
      courseMaterials.findIndex(
        (material) =>
          String(
            material.materialId
          ) ===
          String(materialId)
      );

    if (currentIndex === -1) {
      return;
    }

    const targetIndex =
      currentIndex +
      direction;

    if (
      targetIndex < 0 ||
      targetIndex >=
        courseMaterials.length
    ) {
      return;
    }

    const previousMaterials =
      materials;

    const reorderedCourseMaterials =
      [
        ...courseMaterials
      ];

    [
      reorderedCourseMaterials[
        currentIndex
      ],
      reorderedCourseMaterials[
        targetIndex
      ]
    ] = [
      reorderedCourseMaterials[
        targetIndex
      ],
      reorderedCourseMaterials[
        currentIndex
      ]
    ];

    const reordered =
      reorderedCourseMaterials.map(
        (material, index) => ({
          ...material,
          orderIndex:
            index + 1
        })
      );

    const reorderedMap =
      new Map(
        reordered.map(
          (material) => [
            String(
              material.materialId
            ),
            material
          ]
        )
      );

    /*
    * Optimistic UI.
    */
    setMaterials(
      (previous) =>
        previous.map(
          (material) =>
            reorderedMap.get(
              String(
                material.materialId
              )
            ) ||
            material
        )
    );

    try {
      setReordering(true);

      await reorderCourseMaterials(
        courseId,
        reordered.map(
          (material) => ({
            materialId:
              material.materialId,

            orderIndex:
              material.orderIndex
          })
        )
      );
    } catch (error) {
      console.error(
        'Unable to reorder materials:',
        error
      );

      /*
      * Roll back UI.
      */
      setMaterials(
        previousMaterials
      );

      alert(
        error.message ||
        'Unable to reorder materials.'
      );
    } finally {
      setReordering(false);
    }
  }
  async function handleDeleteMaterial() {
    if (!materialToDelete) {
      return;
    }


    try {
      await deleteCourseMaterial(
        materialToDelete.materialId
      );


      setMaterials(
        (previousMaterials) =>
          previousMaterials.filter(
            (material) =>
              String(
                material.materialId
              ) !==
              String(
                materialToDelete.materialId
              )
          )
      );


      setMaterialToDelete(null);
    } catch (error) {
      console.error(
        'Unable to delete course material:',
        error
      );


      alert(
        error.message ||
        'Unable to delete course material.'
      );
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
              Materials
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


        {!isArchived && (
          <button
            type="button"
            onClick={
              openAddModal
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
            + Add Material
          </button>
        )}
      </header>


      <main
        className="
          p-6
          space-y-5
        "
      >

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
            Materials are available
            for viewing only.
          </div>
        )}


        {courseMaterials.length === 0 ? (
          <div
            className="
              bg-white
              border
              border-gray-100
              rounded-xl
              shadow-sm
              py-16
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
                  d="M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2zm2 4h6m-6 4h6m-6 4h4"
                />
              </svg>
            </div>


            <h2
              className="
                text-base
                font-bold
                text-gray-800
                mt-4
              "
            >
              No materials uploaded
            </h2>

            <p
              className="
                text-sm
                text-gray-500
                mt-2
              "
            >
              Add files or links to
              provide learning resources
              for this course.
            </p>
          </div>
        ) : (
          <div
            className="
              bg-white
              rounded-xl
              border
              border-gray-100
              shadow-sm
              divide-y
              divide-gray-100
            "
          >
            {courseMaterials.map(
              (material, index) => (
                <div
                  key={
                    material.materialId
                  }
                  className="
                    p-5
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
                      gap-4
                      min-w-0
                    "
                  >
                    <div
                      className="
                        w-10
                        h-10
                        rounded-lg
                        bg-gray-100
                        flex
                        items-center
                        justify-center
                        flex-shrink-0
                      "
                    >
                      <span
                        className="
                          text-[10px]
                          font-bold
                          text-gray-600
                        "
                      >
                        {
                          material.resourceType
                        }
                      </span>
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


                      {/* ORIGINAL FILE NAME */}
                      {material.resourceType ===
                        'FILE' &&
                        material.fileName && (
                          <p
                            className="
                              text-xs
                              text-gray-400
                              mt-1
                              truncate
                            "
                            title={
                              material.fileName
                            }
                          >
                            {
                              material.fileName
                            }
                          </p>
                        )}


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
                    </div>
                  </div>


                  {!isArchived && (
                    <div
                      className="
                        flex
                        items-center
                        gap-2
                        flex-shrink-0
                      "
                    >
                      <button
                        type="button"
                        onClick={() =>
                          handleMoveMaterial(
                            material.materialId,
                            -1
                          )
                        }
                        disabled={
                          index === 0
                        }
                        title="Move up"
                        className="
                          text-xs
                          font-semibold
                          text-gray-600
                          bg-gray-100
                          px-2.5
                          py-2
                          rounded-lg
                          hover:bg-gray-200
                          disabled:opacity-40
                          disabled:cursor-not-allowed
                        "
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleMoveMaterial(
                            material.materialId,
                            1
                          )
                        }
                        disabled={
                          index ===
                          courseMaterials.length - 1
                        }
                        title="Move down"
                        className="
                          text-xs
                          font-semibold
                          text-gray-600
                          bg-gray-100
                          px-2.5
                          py-2
                          rounded-lg
                          hover:bg-gray-200
                          disabled:opacity-40
                          disabled:cursor-not-allowed
                        "
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          openEditModal(
                            material
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
                          setMaterialToDelete(
                            material
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
                  )}
                </div>
              )
            )}
          </div>
        )}
      </main>


      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
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
              max-w-xl
              rounded-xl
              shadow-xl
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
                  editingMaterialId !==
                  null
                    ? 'Edit Material'
                    : 'Add Material'
                }
              </h2>


              <button
                type="button"
                onClick={
                  closeModal
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
              {/* TITLE */}
              <div>
                <label
                  className="
                    text-sm
                    font-semibold
                    text-gray-700
                  "
                >
                  Title *
                </label>

                <input
                  type="text"
                  value={
                    form.title
                  }
                  onChange={
                    (event) =>
                      updateForm(
                        'title',
                        event.target.value
                      )
                  }
                  className={`
                    mt-2
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


              {/* DESCRIPTION */}
              <div>
                <label
                  className="
                    text-sm
                    font-semibold
                    text-gray-700
                  "
                >
                  Description
                </label>

                <textarea
                  rows={4}
                  value={
                    form.description
                  }
                  onChange={
                    (event) =>
                      updateForm(
                        'description',
                        event.target.value
                      )
                  }
                  className="
                    mt-2
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
              </div>


              {/* TYPE */}
              <div>
                <p
                  className="
                    text-sm
                    font-semibold
                    text-gray-700
                  "
                >
                  Resource Type *
                </p>


                <div
                  className="
                    flex
                    items-center
                    gap-5
                    mt-2
                  "
                >
                  <label
                    className="
                      flex
                      items-center
                      gap-2
                      text-sm
                    "
                  >
                    <input
                      type="radio"
                      name="resourceType"
                      value="FILE"
                      checked={
                        form.resourceType ===
                        'FILE'
                      }
                      onChange={() =>
                        handleResourceTypeChange(
                          'FILE'
                        )
                      }
                    />

                    File
                  </label>


                  <label
                    className="
                      flex
                      items-center
                      gap-2
                      text-sm
                    "
                  >
                    <input
                      type="radio"
                      name="resourceType"
                      value="LINK"
                      checked={
                        form.resourceType ===
                        'LINK'
                      }
                      onChange={() =>
                        handleResourceTypeChange(
                          'LINK'
                        )
                      }
                    />

                    Link
                  </label>
                </div>
              </div>


              {/* FILE */}
              {form.resourceType ===
                'FILE' && (
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
                    File *
                  </label>


                  {/* Hidden real file input */}
                  <input
                    id="course-material-file"
                    type="file"
                    className="hidden"
                    onChange={
                      handleFileChange
                    }
                  />

                    
                  {/* Existing file when editing */}
                  {hasExistingFile &&
                  !form.file && (
                    <div
                      className="
                        border
                        border-gray-200
                        bg-gray-50
                        rounded-xl
                        p-3
                        flex
                        items-center
                        justify-between
                        gap-3
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
                            w-9
                            h-9
                            rounded-lg
                            bg-blue-100
                            text-blue-600
                            flex
                            items-center
                            justify-center
                            flex-shrink-0
                          "
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            className="w-5 h-5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="
                                M14 2H6
                                a2 2 0 0 0-2 2
                                v16
                                a2 2 0 0 0 2 2
                                h12
                                a2 2 0 0 0 2-2
                                V8z
                              "
                            />

                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M14 2v6h6"
                            />
                          </svg>
                        </div>


                        <div className="min-w-0">
                          <p
                            className="
                              text-xs
                              text-gray-400
                            "
                          >
                            Current file
                          </p>

                          <p
                            className="
                              text-sm
                              font-semibold
                              text-gray-700
                              truncate
                            "
                          >
                            {
                              editingMaterial
                                ?.fileName ||
                              'Course material file'
                            }
                          </p>
                        </div>
                      </div>


                      <div
                        className="
                          flex
                          items-center
                          gap-3
                          flex-shrink-0
                        "
                      >
                        <a
                          href={
                            editingMaterial
                              ?.resourceUrl
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="
                            text-xs
                            font-semibold
                            text-gray-600
                            hover:text-blue-600
                          "
                        >
                          Open
                        </a>


                        <label
                          htmlFor="course-material-file"
                          className="
                            text-xs
                            font-semibold
                            text-blue-600
                            hover:text-blue-700
                            cursor-pointer
                          "
                        >
                          Replace
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Upload area */}
                  {!form.file && 
                    !hasExistingFile && (
                    <label
                      htmlFor="course-material-file"
                      className={`
                        w-full
                        min-h-[120px]
                        border-2
                        border-dashed
                        rounded-xl
                        flex
                        flex-col
                        items-center
                        justify-center
                        cursor-pointer
                        transition

                        ${
                          errors.fileName
                            ? `
                              border-red-300
                              bg-red-50/30
                            `
                            : `
                              border-gray-200
                              bg-gray-50/50
                              hover:border-blue-300
                              hover:bg-blue-50/30
                            `
                        }
                      `}
                    >
                      {/* Upload icon */}
                      <div
                        className="
                          w-10
                          h-10
                          rounded-full
                          bg-blue-50
                          flex
                          items-center
                          justify-center
                          text-blue-600
                          mb-2
                        "
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="
                              M12 16V4
                              m0 0-4 4
                              m4-4 4 4
                              M4 16v2
                              a2 2 0 0 0 2 2
                              h12
                              a2 2 0 0 0 2-2
                              v-2
                            "
                          />
                        </svg>
                      </div>


                      <p
                        className="
                          text-sm
                          font-semibold
                          text-gray-700
                        "
                      >
                        Choose a file
                      </p>


                      <p
                        className="
                          text-xs
                          text-gray-400
                          mt-1
                        "
                      >
                        Click to browse from your device
                      </p>
                    </label>
                  )}


                  {/* Selected file */}
                  {form.file && (
                    <div
                      className="
                        mt-2
                        border
                        border-gray-200
                        bg-gray-50
                        rounded-xl
                        p-3
                        flex
                        items-center
                        justify-between
                        gap-3
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
                            w-9
                            h-9
                            rounded-lg
                            bg-blue-100
                            text-blue-600
                            flex
                            items-center
                            justify-center
                            flex-shrink-0
                          "
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            className="w-5 h-5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="
                                M14 2H6
                                a2 2 0 0 0-2 2
                                v16
                                a2 2 0 0 0 2 2
                                h12
                                a2 2 0 0 0 2-2
                                V8z
                              "
                            />

                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M14 2v6h6"
                            />
                          </svg>
                        </div>


                        <div className="min-w-0">
                          <p
                            className="
                              text-sm
                              font-semibold
                              text-gray-700
                              truncate
                            "
                          >
                            {
                              form.file.name
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
                              (
                                form.file.size /
                                1024 /
                                1024
                              ).toFixed(2)
                            } MB
                          </p>
                        </div>
                      </div>


                      <button
                        type="button"
                        onClick={() => {
                          setForm(
                            (previous) => ({
                              ...previous,
                              file: null,
                              fileName: ''
                            })
                          );
                        }}
                        className="
                          text-xs
                          font-semibold
                          text-red-500
                          hover:text-red-600
                          flex-shrink-0
                        "
                      >
                        Remove
                      </button>
                    </div>
                  )}


                  {errors.fileName && (
                    <p
                      className="
                        text-xs
                        text-red-500
                        mt-1.5
                      "
                    >
                      {
                        errors.fileName
                      }
                    </p>
                  )}
                </div>
              )}


              {/* LINK */}
              {form.resourceType ===
                'LINK' && (
                <div>
                  <label
                    className="
                      text-sm
                      font-semibold
                      text-gray-700
                    "
                  >
                    Link URL *
                  </label>


                  <input
                    type="url"
                    value={
                      form.resourceUrl
                    }
                    onChange={
                      (event) =>
                        updateForm(
                          'resourceUrl',
                          event.target.value
                        )
                    }
                    placeholder="https://..."
                    className={`
                      mt-2
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
                        errors.resourceUrl
                          ? 'border-red-400'
                          : 'border-gray-200'
                      }
                    `}
                  />


                  {errors.resourceUrl && (
                    <p
                      className="
                        text-xs
                        text-red-500
                        mt-1
                      "
                    >
                      {
                        errors.resourceUrl
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
                  closeModal
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
                  handleSaveMaterial
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
                  editingMaterialId !==
                  null
                    ? 'Save Changes'
                    : 'Add Material'
                }
              </button>
            </div>
          </div>
        </div>
      )}


      {/* DELETE CONFIRM */}
      {materialToDelete && (
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
              Remove Material?
            </h2>


            <p
              className="
                text-sm
                text-gray-500
                mt-2
              "
            >
              This material will be
              removed from all Learners'
              synchronized workspaces.
              Continue?
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
                  font-semibold
                  text-gray-700
                "
              >
                {
                  materialToDelete
                    .title
                }
              </p>
            </div>


            <div
              className="
                flex
                justify-end
                gap-3
                mt-6
              "
            >
              <button
                type="button"
                onClick={() =>
                  setMaterialToDelete(
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
                  handleDeleteMaterial
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
                Delete Material
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}