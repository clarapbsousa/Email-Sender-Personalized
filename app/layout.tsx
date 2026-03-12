import './globals.css'
import { Space_Grotesk, Inter } from 'next/font/google'
import Providers from './providers'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['300', '400', '500', '600', '700'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['300', '400', '500', '600'],
})

export const metadata = {
  title: 'Personalized Email Sender',
  icons: {
    icon: {
      url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><defs><linearGradient id='grad' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' style='stop-color:%231DA1F2'/><stop offset='100%' style='stop-color:%2300BA7C'/></linearGradient></defs><rect width='40' height='40' rx='12' fill='url(%23grad)'/><path fill='white' stroke='white' stroke-width='1' stroke-linecap='round' stroke-linejoin='round' d='M9 14l7.89 5.26a2 2 0 002.22 0L27 14M11 25h14a2 2 0 002-2V13a2 2 0 00-2-2H11a2 2 0 00-2 2v10a2 2 0 002 2z' transform='translate(3,3)'/></svg>",
      type: 'image/svg+xml',
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body className="text-white font-sans mesh-bg overflow-x-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
