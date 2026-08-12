import { NavLink } from 'react-router';
import { useAuth } from '../../hooks/useAuth';


const normalNavClass =
  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50';

const activeNavClass =
  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold bg-blue-50 text-blue-600';


function navClass({ isActive }) {
  return isActive
    ? activeNavClass
    : normalNavClass;
}


function SectionLabel({
  children
}) {
  return (
    <p
      className="
        px-4
        pt-5
        pb-1
        text-[10px]
        font-bold
        uppercase
        tracking-wider
        text-gray-400
      "
    >
      {children}
    </p>
  );
}


export default function EducatorSidebar() {
  const { user } = useAuth();


  const educatorName =
    user?.displayName ||
    user?.fullname ||
    user?.email ||
    'Educator';


  const avatarUrl =
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      educatorName
    )}&color=fff&size=36`;


  return (
    <aside
      className="
        w-60
        h-full
        bg-white
        border-r
        border-gray-100
        flex
        flex-col
        justify-between
        flex-shrink-0
      "
    >
      {/* TOP AREA */}
      <div>
        {/* LOGO */}
        <div
          className="
            p-6
            flex
            items-center
            gap-2.5
          "
        >
          <svg
            width="34"
            height="34"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient
                id="educator-grad-leg"
                x1="50"
                y1="15"
                x2="80"
                y2="85"
                gradientUnits="userSpaceOnUse"
              >
                <stop
                  offset="0%"
                  stopColor="#8B3DFF"
                />

                <stop
                  offset="100%"
                  stopColor="#6B21FF"
                />
              </linearGradient>


              <linearGradient
                id="educator-grad-left"
                x1="20"
                y1="85"
                x2="35"
                y2="50"
                gradientUnits="userSpaceOnUse"
              >
                <stop
                  offset="0%"
                  stopColor="#00A3FF"
                />

                <stop
                  offset="100%"
                  stopColor="#3B82F6"
                />
              </linearGradient>


              <linearGradient
                id="educator-grad-swoosh"
                x1="25"
                y1="70"
                x2="95"
                y2="45"
                gradientUnits="userSpaceOnUse"
              >
                <stop
                  offset="0%"
                  stopColor="#00C2FF"
                />

                <stop
                  offset="50%"
                  stopColor="#3B82F6"
                />

                <stop
                  offset="100%"
                  stopColor="#6B21FF"
                />
              </linearGradient>
            </defs>


            <path
              d="M 33 55 L 46 25 C 47.5 21.5 52.5 21.5 54 25 L 76 76"
              stroke="url(#educator-grad-leg)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
            />


            <path
              d="M 22 80 L 26 70"
              stroke="url(#educator-grad-left)"
              strokeWidth="14"
              strokeLinecap="round"
            />


            <path
              d="M 26 65 C 50 78 70 70 92 48 C 65 68 45 74 24 73 Z"
              fill="url(#educator-grad-swoosh)"
            />
          </svg>


          <span
            className="
              text-2xl
              font-black
              text-slate-900
              tracking-tight
              font-sans
            "
          >
            AcogniX
          </span>
        </div>


        {/* NAVIGATION */}
        <nav
          className="
            px-3
            flex
            flex-col
            gap-1.5
          "
        >
          {/* DASHBOARD */}
          <NavLink
            to="/educator/dashboard"
            className={navClass}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>

            Dashboard
          </NavLink>


          {/* TEACHING */}
          <SectionLabel>
            Teaching
          </SectionLabel>


          {/* MY COURSES */}
          <NavLink
            to="/educator/courses"
            className={navClass}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>

            My Courses
          </NavLink>


          {/* STUDENTS */}
          <NavLink
            to="/educator/students"
            className={navClass}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.124-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.124-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>

            Students
          </NavLink>


          {/* PERFORMANCE */}
          <SectionLabel>
            Performance
          </SectionLabel>


          {/* ANALYTICS */}
          <NavLink
            to="/educator/analytics"
            className={navClass}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>

            Analytics
          </NavLink>


          {/* GRADEBOOK */}
          <NavLink
            to="/educator/gradebook"
            className={navClass}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H4a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>

            Gradebook
          </NavLink>


          {/* GENERAL */}
          <SectionLabel>
            General
          </SectionLabel>


          {/* COMMUNITY */}
          <NavLink
            to="/educator/community"
            className={navClass}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.124-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.124-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>

            Community
          </NavLink>


          {/* SETTINGS */}
          <NavLink
            to="/educator/settings"
            className={navClass}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543-.94-3.31.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z"
              />

              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>

            Settings
          </NavLink>
        </nav>
      </div>


      {/* FOOTER PROFILE */}
      <div
        className="
          p-4
          border-t
          border-gray-100
        "
      >
        <div
          className="
            flex
            items-center
            gap-3
            cursor-pointer
          "
        >
          <img
            src={avatarUrl}
            alt={educatorName}
            className="
              w-9
              h-9
              rounded-full
              object-cover
              bg-gray-200
            "
          />


          <div className="text-left">
            <p
              className="
                text-xs
                font-bold
                text-gray-800
                leading-tight
              "
            >
              {educatorName}
            </p>


            <p
              className="
                text-[10px]
                text-gray-400
              "
            >
              Educator
            </p>
          </div>


          <NavLink
            to="/educator/settings"
            className="ml-auto"
          >
            <span
              className="
                text-gray-400
                text-[10px]
              "
            >
              ⚙️
            </span>
          </NavLink>
        </div>
      </div>
    </aside>
  );
}