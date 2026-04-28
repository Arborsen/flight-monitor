/** @type {import('tailwindcss').Config} */
export default {
  content: ['./**/*.{tsx,ts,html}', '!./node_modules'],
  theme: {
    extend: {
      colors: {
        wechat: '#07C160',
        warn: '#ff9800',
        err: '#ff4d4f',
      },
    },
  },
  plugins: [],
};
