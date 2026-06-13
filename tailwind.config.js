/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // base surfaces
        bg: '#0E0E11',
        surface: {
          DEFAULT: '#16161B',
          raised: '#1C1C23',
          hover: '#22222B'
        },
        border: {
          DEFAULT: '#26262E',
          strong: '#33333D'
        },
        // text
        ink: {
          DEFAULT: '#EDEDF2',
          muted: '#9A9AA6',
          faint: '#6B6B76'
        },
        // accent (gradient endpoints)
        accent: {
          from: '#7C5CFF',
          to: '#00D4FF',
          DEFAULT: '#7C5CFF'
        },
        // status
        status: {
          pending: '#6B6B76',
          running: '#3B82F6',
          done: '#22C55E',
          error: '#EF4444',
          warn: '#F59E0B'
        }
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif']
      },
      fontVariantNumeric: {
        tabular: 'tabular-nums'
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px'
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.25)',
        float: '0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3)',
        glow: '0 0 0 1px rgba(124,92,255,0.4), 0 8px 28px rgba(124,92,255,0.25)'
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #7C5CFF 0%, #00D4FF 100%)',
        'accent-soft': 'linear-gradient(135deg, rgba(124,92,255,0.18) 0%, rgba(0,212,255,0.12) 100%)'
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out'
      }
    }
  },
  plugins: []
}
