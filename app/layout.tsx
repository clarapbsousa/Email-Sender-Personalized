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
