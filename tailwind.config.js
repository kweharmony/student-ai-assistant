/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0a0e1f',
        'bg-secondary': '#13265c',
        'text-primary': '#e9effa',
        'text-secondary': '#99b5ea',
        'border-color': 'rgba(153, 181, 234, 0.1)',
        'hover-bg': 'rgba(153, 181, 234, 0.03)',
      },
      fontFamily: {
        'serif': ['Georgia', 'Times New Roman', 'serif'],
      },
      animation: {
        'cloud-drift': 'cloudDrift 60s ease-in-out infinite',
        'cloud-drift-reverse': 'cloudDrift 50s ease-in-out infinite reverse',
      },
      keyframes: {
        cloudDrift: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '50%': { transform: 'translate(80px, -20px)' },
        }
      },
      spacing: {
        '15': '3.75rem',
        '25': '6.25rem',
        '30': '7.5rem',
        '40': '10rem',
        '60': '15rem',
      }
    },
  },
  plugins: [],
}
