// frontend/src/components/Logo.jsx
import { Link } from 'react-router-dom';

export default function Logo({ to = '/learner/dashboard' }) {
  return (
    <Link to={to} className="flex items-center gap-3 group">
      <svg
        width="36"
        height="36"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0 group-hover:scale-105 transition-transform"
      >
        <defs>
          <linearGradient
            id="grad-leg"
            x1="50"
            y1="15"
            x2="80"
            y2="85"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#8B3DFF" />
            <stop offset="100%" stopColor="#6B21FF" />
          </linearGradient>
          <linearGradient
            id="grad-left"
            x1="20"
            y1="85"
            x2="35"
            y2="50"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#00A3FF" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <linearGradient
            id="grad-swoosh"
            x1="25"
            y1="70"
            x2="95"
            y2="45"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#00C2FF" />
            <stop offset="50%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#6B21FF" />
          </linearGradient>
        </defs>
        <path
          d="M 33 55 L 46 25 C 47.5 21.5 52.5 21.5 54 25 L 76 76"
          stroke="url(#grad-leg)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 22 80 L 26 70"
          stroke="url(#grad-left)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M 26 65 C 50 78 70 70 92 48 C 65 68 45 74 24 73 Z"
          fill="url(#grad-swoosh)"
        />
      </svg>
      <div className="flex flex-col">
        <span className="text-xl font-black text-slate-900 tracking-tight leading-tight">
          Acogni<span className="text-blue-600">X</span>
        </span>
        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest leading-none mt-0.5">
          Learner Portal
        </span>
      </div>
    </Link>
  );
}