import type { Metadata } from 'next';
import './globals.css';
import { CourseProvider } from '@/context/CourseContext';

export const metadata: Metadata = {
  title: 'StudyTube - Turn YouTube Playlists into Structured Courses',
  description:
    'Convert any YouTube playlist or video into a structured, distraction-free course with interactive notes and Replay the Moment quizzes.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-800 antialiased selection:bg-blue-500 selection:text-white">
        <CourseProvider>{children}</CourseProvider>
      </body>
    </html>
  );
}
