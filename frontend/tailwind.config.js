/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#F4F7FE', // Light airy blue/gray background
        surface: '#FFFFFF',    // White cards
        primary: '#4F46E5',    // Indigo 600 (Main brand blue)
        primaryLight: '#818CF8', // Indigo 400
        primaryDark: '#3730A3',  // Indigo 800
        accent: '#10B981',     // Emerald 500 (Present)
        danger: '#EF4444',     // Red 500 (Absent)
        warning: '#F59E0B',    // Amber 500 (Late/Medical)
        info: '#06B6D4',       // Cyan 500 (Leave)
        purple: '#6366F1',     // Indigo/Purple (OSD)
        dark: '#1E293B',       // Slate 800 (Weekend)
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)',
        'mesh': 'radial-gradient(at 40% 20%, rgba(59, 130, 246, 0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(16, 185, 129, 0.15) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(239, 68, 68, 0.1) 0px, transparent 50%)',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        'glass-sm': '0 4px 16px 0 rgba(0, 0, 0, 0.2)',
      }
    },
  },
  plugins: [],
}
