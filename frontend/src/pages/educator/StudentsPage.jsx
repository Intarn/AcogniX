import {
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  Link
} from 'react-router';



import {
  getCourses
} from '../../features/classroom/courseApi';

import {
  getCourseMembers
} from '../../features/classroom/enrollmentApi';


function getInitials(name) {
  if (!name) {
    return '?';
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(
      (part) =>
        part.charAt(0)
    )
    .join('')
    .toUpperCase();
}


export default function StudentsPage() {
  const [
    courses,
    setCourses
  ] = useState([]);


  const [
    memberEntries,
    setMemberEntries
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
    searchTerm,
    setSearchTerm
  ] = useState('');


  const [
    selectedCourseId,
    setSelectedCourseId
  ] = useState('ALL');


  useEffect(() => {
    let cancelled = false;

    async function loadStudents() {
      try {
        setLoading(true);
        setLoadError('');

        const courseResult =
          await getCourses();

        const loadedCourses =
          Array.isArray(
            courseResult?.courses
          )
            ? courseResult.courses
            : [];

        const membershipGroups =
          await Promise.all(
            loadedCourses.map(
              async (course) => {
                const result =
                  await getCourseMembers(
                    course.courseId
                  );

                const members =
                  Array.isArray(
                    result?.members
                  )
                    ? result.members
                    : [];

                return members.map(
                  (member) => ({
                    course,

                    enrollment:
                      member.enrollment ||
                      member,

                    learner:
                      member.learner ||
                      member.user ||
                      null
                  })
                );
              }
            )
          );

        if (cancelled) {
          return;
        }

        setCourses(
          loadedCourses
        );

        setMemberEntries(
          membershipGroups.flat()
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            'Unable to load students:',
            error
          );

          setCourses([]);
          setMemberEntries([]);

          setLoadError(
            error.message ||
            'Unable to load students.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStudents();

    return () => {
      cancelled = true;
    };
  }, []);

  const learnerRows =
    useMemo(() => {
      const learnerMap =
        new Map();

      memberEntries
        .filter(
          ({ enrollment }) =>
            enrollment.status ===
            'APPROVED'
        )
        .forEach(
          ({
            course,
            enrollment,
            learner
          }) => {
            const learnerId =
              String(
                learner?.userId ??
                learner?.id ??
                enrollment.learnerId
              );

            if (
              !learnerMap.has(
                learnerId
              )
            ) {
              learnerMap.set(
                learnerId,
                {
                  learner:
                    learner || {
                      userId:
                        enrollment.learnerId,

                      displayName:
                        'Unknown Learner',

                      email:
                        'N/A',

                      avatarUrl:
                        null,

                      role:
                        'LEARNER'
                    },

                  courses: []
                }
              );
            }

            learnerMap
              .get(learnerId)
              .courses
              .push({
                courseId:
                  course.courseId,

                subjectName:
                  course.subjectName,

                courseCode:
                  course.courseCode,

                status:
                  course.status,

                enrollmentId:
                  enrollment.enrollmentId,

                approvedAt:
                  enrollment.approvedAt
              });
          }
        );

      return Array.from(
        learnerMap.values()
      ).sort(
        (first, second) =>
          String(
            first.learner
              .displayName ||
            first.learner
              .fullname ||
            ''
          ).localeCompare(
            String(
              second.learner
                .displayName ||
              second.learner
                .fullname ||
              ''
            )
          )
      );
    }, [
      memberEntries
    ]);


  const filteredRows =
    useMemo(() => {
      const normalizedSearch =
        searchTerm
          .trim()
          .toLowerCase();


      return learnerRows.filter(
        ({
          learner,
          courses:
            learnerCourses
        }) => {
          /*
           * COURSE FILTER
           */
          if (
            selectedCourseId !==
            'ALL'
          ) {
            const belongsToCourse =
              learnerCourses.some(
                (course) =>
                  String(
                    course.courseId
                  ) ===
                  String(
                    selectedCourseId
                  )
              );


            if (!belongsToCourse) {
              return false;
            }
          }


          /*
           * SEARCH FILTER
           */
          if (!normalizedSearch) {
            return true;
          }


          const name =
            (
              learner.displayName ||
              learner.fullname ||
              ''
            )
              .toLowerCase();


          const email =
            (
              learner.email ||
              ''
            )
              .toLowerCase();


          const courseText =
            learnerCourses
              .map(
                (course) =>
                  `${course.subjectName || ''} ${course.courseCode || ''}`
              )
              .join(' ')
              .toLowerCase();


          return (
            name.includes(
              normalizedSearch
            ) ||
            email.includes(
              normalizedSearch
            ) ||
            courseText.includes(
              normalizedSearch
            )
          );
        }
      );
    }, [
      learnerRows,
      searchTerm,
      selectedCourseId
    ]);


  const activeCourses =
    useMemo(() => {
      return courses
        .filter(
          (course) =>
            course.status ===
            'ACTIVE'
        )
        .sort(
          (first, second) =>
            (
              first.subjectName ||
              ''
            ).localeCompare(
              second.subjectName ||
              ''
            )
        );
    }, [
      courses
    ]);


  const totalApprovedEnrollments =
    useMemo(() => {
      return memberEntries.filter(
        ({ enrollment }) =>
          enrollment.status ===
          'APPROVED'
      ).length;
    }, [
      memberEntries
    ]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-gray-500">
          Loading students...
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
      </div>
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
          <h1
            className="
              text-lg
              font-bold
              text-gray-800
            "
          >
            Students
          </h1>


          <p
            className="
              text-xs
              text-gray-400
              mt-0.5
            "
          >
            View learners enrolled
            across your courses.
          </p>
        </div>
      </header>


      {/* MAIN */}
      <main
        className="
          p-6
          space-y-5
        "
      >
        {/* SUMMARY */}
        <div
          className="
            grid
            grid-cols-1
            sm:grid-cols-3
            gap-4
          "
        >
          <SummaryCard
            label="Unique Students"
            value={
              learnerRows.length
            }
          />


          <SummaryCard
            label="Approved Enrollments"
            value={
              totalApprovedEnrollments
            }
          />


          <SummaryCard
            label="Active Courses"
            value={
              activeCourses.length
            }
          />
        </div>


        {/* FILTERS */}
        <section
          className="
            bg-white
            border
            border-gray-100
            rounded-xl
            shadow-sm
            p-4
          "
        >
          <div
            className="
              grid
              grid-cols-1
              md:grid-cols-2
              gap-4
            "
          >
            {/* SEARCH */}
            <div>
              <label
                htmlFor="student-search"
                className="
                  block
                  text-xs
                  font-semibold
                  text-gray-500
                  mb-2
                "
              >
                Search
              </label>


              <input
                id="student-search"
                type="search"
                value={
                  searchTerm
                }
                onChange={
                  (event) =>
                    setSearchTerm(
                      event.target.value
                    )
                }
                placeholder="Search by name, email, or course..."
                className="
                  w-full
                  rounded-lg
                  border
                  border-gray-200
                  px-3
                  py-2.5
                  text-sm
                  text-gray-700
                  outline-none
                  focus:ring-1
                  focus:ring-blue-300
                "
              />
            </div>


            {/* COURSE FILTER */}
            <div>
              <label
                htmlFor="student-course-filter"
                className="
                  block
                  text-xs
                  font-semibold
                  text-gray-500
                  mb-2
                "
              >
                Course
              </label>


              <select
                id="student-course-filter"
                value={
                  selectedCourseId
                }
                onChange={
                  (event) =>
                    setSelectedCourseId(
                      event.target.value
                    )
                }
                className="
                  w-full
                  rounded-lg
                  border
                  border-gray-200
                  px-3
                  py-2.5
                  text-sm
                  text-gray-700
                  bg-white
                  outline-none
                "
              >
                <option value="ALL">
                  All Courses
                </option>


                {activeCourses.map(
                  (course) => (
                    <option
                      key={
                        course.courseId
                      }
                      value={
                        course.courseId
                      }
                    >
                      {
                        course.subjectName
                      }
                      {' — '}
                      {
                        course.courseCode
                      }
                    </option>
                  )
                )}
              </select>
            </div>
          </div>
        </section>


        {/* STUDENT TABLE */}
        <section
          className="
            bg-white
            border
            border-gray-100
            rounded-xl
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
                All Students
              </h2>


              <p
                className="
                  text-xs
                  text-gray-400
                  mt-1
                "
              >
                Cross-course overview
                of approved learners.
              </p>
            </div>


            <span
              className="
                text-xs
                text-gray-400
              "
            >
              {
                filteredRows.length
              }{' '}
              learners
            </span>
          </div>


          {filteredRows.length ===
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.124-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2a5 5 0 0110 0v2M12 11a4 4 0 100-8 4 4 0 000 8z"
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
                No students found
              </h3>


              <p
                className="
                  text-sm
                  text-gray-500
                  mt-2
                "
              >
                No approved learners
                match the current
                search or course filter.
              </p>
            </div>
          ) : (
            <div
              className="
                overflow-x-auto
              "
            >
              <table
                className="
                  w-full
                  min-w-[900px]
                  text-sm
                  text-left
                "
              >
                <thead
                  className="
                    text-xs
                    uppercase
                    text-gray-500
                    bg-gray-50/50
                  "
                >
                  <tr>
                    <th
                      className="
                        px-5
                        py-3
                      "
                    >
                      Student
                    </th>


                    <th
                      className="
                        px-5
                        py-3
                      "
                    >
                      Email
                    </th>


                    <th
                      className="
                        px-5
                        py-3
                      "
                    >
                      Enrolled Courses
                    </th>


                    <th
                      className="
                        px-5
                        py-3
                      "
                    >
                      Course Codes
                    </th>


                    <th
                      className="
                        px-5
                        py-3
                        text-right
                      "
                    >
                      Actions
                    </th>
                  </tr>
                </thead>


                <tbody
                  className="
                    divide-y
                    divide-gray-100
                  "
                >
                  {filteredRows.map(
                    ({
                      learner,
                      courses:
                        learnerCourses
                    }) => {
                      const learnerId =
                        learner.userId ??
                        learner.id;


                      return (
                        <tr
                          key={
                            learnerId
                          }
                          className="
                            hover:bg-gray-50/50
                          "
                        >
                          {/* STUDENT */}
                          <td
                            className="
                              px-5
                              py-4
                            "
                          >
                            <LearnerIdentity
                              learner={
                                learner
                              }
                            />
                          </td>


                          {/* EMAIL */}
                          <td
                            className="
                              px-5
                              py-4
                              text-gray-500
                            "
                          >
                            {
                              learner.email
                            }
                          </td>


                          {/* COURSES */}
                          <td
                            className="
                              px-5
                              py-4
                            "
                          >
                            <div
                              className="
                                flex
                                flex-wrap
                                gap-2
                              "
                            >
                              {learnerCourses.map(
                                (course) => (
                                  <Link
                                    key={
                                      course.courseId
                                    }
                                    to={
                                      `/educator/courses/${course.courseId}`
                                    }
                                    className="
                                      inline-flex
                                      items-center
                                      rounded-full
                                      bg-blue-50
                                      text-blue-700
                                      px-2.5
                                      py-1
                                      text-[10px]
                                      font-semibold
                                      hover:bg-blue-100
                                    "
                                  >
                                    {
                                      course.subjectName
                                    }
                                  </Link>
                                )
                              )}
                            </div>
                          </td>


                          {/* CODES */}
                          <td
                            className="
                              px-5
                              py-4
                            "
                          >
                            <div
                              className="
                                flex
                                flex-wrap
                                gap-2
                              "
                            >
                              {learnerCourses.map(
                                (course) => (
                                  <span
                                    key={
                                      course.courseId
                                    }
                                    className="
                                      text-xs
                                      font-semibold
                                      text-gray-600
                                      bg-gray-100
                                      rounded-lg
                                      px-2
                                      py-1
                                    "
                                  >
                                    {
                                      course.courseCode
                                    }
                                  </span>
                                )
                              )}
                            </div>
                          </td>


                          {/* ACTION */}
                          <td
                            className="
                              px-5
                              py-4
                            "
                          >
                            <div
                              className="
                                flex
                                items-center
                                justify-end
                              "
                            >
                              {learnerCourses.length ===
                              1 ? (
                                <Link
                                  to={
                                    `/educator/courses/${learnerCourses[0].courseId}/members`
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
                                  View Membership
                                </Link>
                              ) : (
                                <span
                                  className="
                                    text-xs
                                    text-gray-400
                                  "
                                >
                                  {
                                    learnerCourses.length
                                  }{' '}
                                  memberships
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}


function LearnerIdentity({
  learner
}) {
  const displayName =
    learner.displayName ||
    learner.fullname ||
    'Unknown Learner';


  return (
    <div
      className="
        flex
        items-center
        gap-3
        min-w-[170px]
      "
    >
      {learner.avatarUrl ? (
        <img
          src={
            learner.avatarUrl
          }
          alt={
            displayName
          }
          className="
            w-9
            h-9
            rounded-full
            object-cover
            flex-shrink-0
          "
        />
      ) : (
        <div
          className="
            w-9
            h-9
            rounded-full
            bg-blue-100
            text-blue-700
            flex
            items-center
            justify-center
            text-xs
            font-bold
            flex-shrink-0
          "
        >
          {
            getInitials(
              displayName
            )
          }
        </div>
      )}


      <div
        className="
          min-w-0
        "
      >
        <p
          className="
            text-sm
            font-semibold
            text-gray-800
            truncate
          "
        >
          {
            displayName
          }
        </p>


        <p
          className="
            text-[10px]
            text-gray-400
            mt-0.5
          "
        >
          Learner
        </p>
      </div>
    </div>
  );
}


function SummaryCard({
  label,
  value
}) {
  return (
    <div
      className="
        bg-white
        border
        border-gray-100
        rounded-xl
        shadow-sm
        p-5
      "
    >
      <p
        className="
          text-xs
          text-gray-400
        "
      >
        {label}
      </p>


      <p
        className="
          text-2xl
          font-bold
          text-gray-800
          mt-2
        "
      >
        {value}
      </p>
    </div>
  );
}