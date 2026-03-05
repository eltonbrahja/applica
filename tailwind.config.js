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
                dark: {
                    900: '#1a1612',
                    800: '#2a2520',
                    700: '#3d362e',
                    600: '#4b4234',
                    500: '#6b6050',
                    400: '#8a7e6e',
                    300: '#b5ab9a',
                    200: '#d4cdc0',
                    100: '#ebe7dc',
                },
                surface: {
                    900: '#2c2518',
                    800: '#3d3426',
                    700: '#554a39',
                    600: '#6b5f4c',
                    500: '#7a7062',
                    400: '#9e9484',
                    300: '#c4bba8',
                    200: '#e0daca',
                    100: '#f0ebe0',
                    50: '#f7f3e6',
                },
                primary: {
                    400: '#c49a5c',
                    500: '#a67c3d',
                    600: '#8b6630',
                },
                accent: {
                    300: '#d4a574',
                    400: '#c48d55',
                    500: '#b07840',
                    600: '#965f2c',
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out forwards',
                'slide-up': 'slideUp 0.4s ease-out forwards',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
        },
    },
    plugins: [],
}
