import type { Config } from 'tailwindcss'

const config: Config = {
	content: [
		'./src/pages/**/*.{js,ts,jsx,tsx,mdx}',
		'./src/components/**/*.{js,ts,jsx,tsx,mdx}',
		'./src/app/**/*.{js,ts,jsx,tsx,mdx}'
	],
	theme: {
		extend: {
			backgroundImage: {
				'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
				'gradient-conic':
					'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))'
			},
			boxShadow: {
				't-sm': '0 -1px 2px 0 rgba(0, 0, 0, 0.05)',
				't-md': '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
				't-lg': '0 -10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
				't-xl': '0 -20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
				't-2xl': '0 -25px 50px -12px rgba(0, 0, 0, 0.25)',
				't-3xl': '0 -35px 60px -15px rgba(0, 0, 0, 0.3)',
				'b-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
				'b-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)',
				'b-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 -4px 6px -2px rgba(0, 0, 0, 0.05)',
				'b-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 -10px 10px -5px rgba(0, 0, 0, 0.04)',
				'b-2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
				'b-3xl': '0 35px 60px -15px rgba(0, 0, 0, 0.3)',
				'l-sm': '-1px 0 2px 0 rgba(0, 0, 0, 0.05)',
				'l-md': '-4px 0 6px -1px rgba(0, 0, 0, 0.1), 2px 0 4px -1px rgba(0, 0, 0, 0.06)',
				'l-lg': '-10px 0 15px -3px rgba(0, 0, 0, 0.1), 4px 0 6px -2px rgba(0, 0, 0, 0.05)',
				'l-xl': '-20px 0 25px -5px rgba(0, 0, 0, 0.1), 10px 0 10px -5px rgba(0, 0, 0, 0.04)',
				'l-2xl': '-25px 0 50px -12px rgba(0, 0, 0, 0.25)',
				'l-3xl': '-35px 0 60px -15px rgba(0, 0, 0, 0.3)',
				'r-sm': '1px 0 2px 0 rgba(0, 0, 0, 0.05)',
				'r-md': '4px 0 6px -1px rgba(0, 0, 0, 0.1), -2px 0 4px -1px rgba(0, 0, 0, 0.06)',
				'r-lg': '10px 0 15px -3px rgba(0, 0, 0, 0.1), -4px 0 6px -2px rgba(0, 0, 0, 0.05)',
				'r-xl': '20px 0 25px -5px rgba(0, 0, 0, 0.1), -10px 0 10px -5px rgba(0, 0, 0, 0.04)',
				'r-2xl': '25px 0 50px -12px rgba(0, 0, 0, 0.25)',
				'r-3xl': '35px 0 60px -15px rgba(0, 0, 0, 0.3)',
				'all-sm': '0 0 2px 0 rgba(0, 0, 0, 0.05)',
				'all-md': '0 0 6px -1px rgba(0, 0, 0, 0.1), 0 0 4px -1px rgba(0, 0, 0, 0.06)',
				'all-lg': '0 0 15px -3px rgba(0, 0, 0, 0.1), 0 0 6px -2px rgba(0, 0, 0, 0.05)',
				'all-xl': '0 0 25px -5px rgba(0, 0, 0, 0.1), 0 0 10px -5px rgba(0, 0, 0, 0.04)',
				'all-2xl': '0 0 50px -12px rgba(0, 0, 0, 0.25)',
				'all-3xl': '0 0 60px -15px rgba(0, 0, 0, 0.3)',
				't-sm-heavy': '0 -1px 2px 0 rgba(0, 0, 0, 0.1)',
				't-md-heavy': '0 -4px 6px -1px rgba(0, 0, 0, 0.15), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
				't-lg-heavy': '0 -10px 15px -3px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
				't-xl-heavy': '0 -20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
				't-2xl-heavy': '0 -25px 50px -12px rgba(0, 0, 0, 0.35)',
				't-3xl-heavy': '0 -35px 60px -15px rgba(0, 0, 0, 0.4)',
				'b-sm-heavy': '0 1px 2px 0 rgba(0, 0, 0, 0.1)',
				'b-md-heavy': '0 4px 6px -1px rgba(0, 0, 0, 0.15), 0 -2px 4px -1px rgba(0, 0, 0, 0.1)',
				'b-lg-heavy': '0 10px 15px -3px rgba(0, 0, 0, 0.15), 0 -4px 6px -2px rgba(0, 0, 0, 0.1)',
				'b-xl-heavy': '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 -10px 10px -5px rgba(0, 0, 0, 0.1)',
				'b-2xl-heavy': '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
				'b-3xl-heavy': '0 35px 60px -15px rgba(0, 0, 0, 0.4)',
				'l-sm-heavy': '-1px 0 2px 0 rgba(0, 0, 0, 0.1)',
				'l-md-heavy': '-4px 0 6px -1px rgba(0, 0, 0, 0.15), 2px 0 4px -1px rgba(0, 0, 0, 0.1)',
				'l-lg-heavy': '-10px 0 15px -3px rgba(0, 0, 0, 0.15), 4px 0 6px -2px rgba(0, 0, 0, 0.1)',
				'l-xl-heavy': '-20px 0 25px -5px rgba(0, 0, 0, 0.15), 10px 0 10px -5px rgba(0, 0, 0, 0.1)',
				'l-2xl-heavy': '-25px 0 50px -12px rgba(0, 0, 0, 0.35)',
				'l-3xl-heavy': '-35px 0 60px -15px rgba(0, 0, 0, 0.4)',
				'r-sm-heavy': '1px 0 2px 0 rgba(0, 0, 0, 0.1)',
				'r-md-heavy': '4px 0 6px -1px rgba(0, 0, 0, 0.15), -2px 0 4px -1px rgba(0, 0, 0, 0.1)',
				'r-lg-heavy': '10px 0 15px -3px rgba(0, 0, 0, 0.15), -4px 0 6px -2px rgba(0, 0, 0, 0.1)',
				'r-xl-heavy': '20px 0 25px -5px rgba(0, 0, 0, 0.15), -10px 0 10px -5px rgba(0, 0, 0, 0.1)',
				'r-2xl-heavy': '25px 0 50px -12px rgba(0, 0, 0, 0.35)',
				'r-3xl-heavy': '35px 0 60px -15px rgba(0, 0, 0, 0.4)',
				'all-sm-heavy': '0 0 2px 0 rgba(0, 0, 0, 0.1)',
				'all-md-heavy': '0 0 6px -1px rgba(0, 0, 0, 0.15), 0 0 4px -1px rgba(0, 0, 0, 0.1)',
				'all-lg-heavy': '0 0 15px -3px rgba(0, 0, 0, 0.15), 0 0 6px -2px rgba(0, 0, 0, 0.1)',
				'all-xl-heavy': '0 0 25px -5px rgba(0, 0, 0, 0.15), 0 0 10px -5px rgba(0, 0, 0, 0.1)',
				'all-2xl-heavy': '0 0 50px -12px rgba(0, 0, 0, 0.35)',
				'all-3xl-heavy': '0 0 60px -15px rgba(0, 0, 0, 0.4)'
			}
		}
	},
	plugins: []
}
export default config
