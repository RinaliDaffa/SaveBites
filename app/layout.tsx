import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SaveBites — Makan enak, sampah berkurang.',
  description: 'Selamatkan makanan surplus dari restoran terdekat. Diskon hingga 70%. Ambil sendiri.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:bg-orange-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-md"
        >
          Langsung ke konten utama
        </a>
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
