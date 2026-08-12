/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html", 
    "./frontend/index.html", // Dự phòng nếu file HTML nằm trong frontend
    "./frontend/src/**/*.{js,ts,jsx,tsx}", // Ép nó chạy vào đây tìm class CSS!
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}