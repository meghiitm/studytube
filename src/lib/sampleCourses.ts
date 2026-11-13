import { Course } from '@/types/course';

export const SAMPLE_COURSES: Course[] = [
  {
    id: 'nextjs-mastery',
    title: 'Modern Full-Stack Next.js 15 & React Mastery',
    description: 'Learn Server Components, Server Actions, Dynamic Routing, Caching, and Authentication step-by-step from beginner to production-ready apps.',
    thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&q=80',
    sourceUrl: 'https://www.youtube.com/watch?v=wm5gMKuwSYk',
    sourceType: 'video_chapters',
    author: 'Code & Craft Academy',
    totalDuration: '2h 45m',
    createdAt: new Date().toISOString(),
    lessons: [
      {
        id: 'lesson-1',
        videoId: 'wm5gMKuwSYk',
        title: '01. Next.js Foundations & App Router Architecture',
        duration: '18:40',
        thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&q=80',
        overview: 'Understand the architectural shift from Pages router to App Router, React Server Components (RSC), and file-system routing conventions.',
        timestampNotes: [
          { timeSeconds: 45, label: 'Why Next.js App Router?', summary: 'Overview of React Server Components and zero client-bundle overhead.' },
          { timeSeconds: 310, label: 'Directory Structure & Special Files', summary: 'Understanding page.tsx, layout.tsx, loading.tsx, and error.tsx.' },
          { timeSeconds: 680, label: 'Server vs Client Components', summary: 'When to add "use client" and keeping bundle sizes minimal.' }
        ],
        studyNotes: `### Core Concepts Covered
- **React Server Components (RSC)**: Render on the server by default, enabling direct database queries and reducing JavaScript sent to the browser.
- **Client Components (\`"use client"\`)**: Opt-in components required only when handling browser APIs, event listeners (\`onClick\`), or React state hooks (\`useState\`, \`useEffect\`).
- **Layouts & Nesting**: Layouts preserve state between route changes and avoid unnecessary re-renders.

> **Key Rule**: Push \`"use client"\` boundaries as far down the component leaf tree as possible!`,
        quizzes: [
          {
            id: 'q1-1',
            question: 'What is the default rendering behavior of components inside the Next.js App Router?',
            options: [
              'Client-side rendered (CSR)',
              'React Server Components (RSC) rendered on the server',
              'Static HTML generated only at build time',
              'Edge-worker rendered only'
            ],
            correctAnswer: 1,
            explanation: 'In the App Router, all components inside the app folder are React Server Components by default unless marked with "use client".',
            timestampSeconds: 45
          },
          {
            id: 'q1-2',
            question: 'When must you explicitly declare the "use client" directive?',
            options: [
              'Whenever fetching data from an API',
              'Whenever using interactive hooks like useState, useEffect, or browser events',
              'Whenever defining a TypeScript interface',
              'Whenever exporting an async function'
            ],
            correctAnswer: 1,
            explanation: 'Interactive hooks and event listeners require client-side execution, so the file must begin with "use client".',
            timestampSeconds: 680
          }
        ]
      },
      {
        id: 'lesson-2',
        videoId: 'wm5gMKuwSYk',
        title: '02. Server Actions & Mutations Without REST Boilerplate',
        duration: '24:15',
        thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&q=80',
        overview: 'Deep dive into asynchronous server functions invoked directly from forms and UI components with progressive enhancement.',
        timestampNotes: [
          { timeSeconds: 60, label: 'Introduction to Server Actions', summary: 'Executing server code securely without manually building API route handlers.' },
          { timeSeconds: 420, label: 'Form Handling & useActionState', summary: 'Handling pending states, optimistic updates, and form validations.' },
          { timeSeconds: 890, label: 'Cache Revalidation (revalidatePath)', summary: 'Purging cached routes immediately after data updates.' }
        ],
        studyNotes: `### Server Actions Best Practices
- Define server actions with \`"use server"\` either at the top of a file or inside an async function.
- Always validate input on the server using schema libraries like **Zod**.
- Use \`revalidatePath('/dashboard')\` or \`revalidateTag('user-posts')\` to instantly sync the UI with updated server state without manual refetching.`,
        quizzes: [
          {
            id: 'q2-1',
            question: 'How do you tell Next.js to purge and refresh cached data for a specific route after a mutation?',
            options: [
              'window.location.reload()',
              'router.refreshCache()',
              'revalidatePath("/route-name")',
              'purgeNextCache()'
            ],
            correctAnswer: 2,
            explanation: 'revalidatePath allows you to purge cached data on demand for a specific path in Server Actions.',
            timestampSeconds: 890
          }
        ]
      },
      {
        id: 'lesson-3',
        videoId: 'wm5gMKuwSYk',
        title: '03. Advanced Caching, ISR & Production Deployment',
        duration: '31:50',
        thumbnail: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&q=80',
        overview: 'Master Next.js caching layers: Request Memoization, Data Cache, Full Route Cache, and Router Cache.',
        timestampNotes: [
          { timeSeconds: 90, label: 'The 4 Caching Mechanisms', summary: 'How Next.js optimizes requests across server and client layers.' },
          { timeSeconds: 620, label: 'Incremental Static Regeneration (ISR)', summary: 'Rebuilding pages in the background without downtime.' },
          { timeSeconds: 1150, label: 'Optimizing for Vercel & Docker', summary: 'Standalone build outputs and environment variables configuration.' }
        ],
        studyNotes: `### The Next.js Caching Hierarchy
1. **Request Memoization**: Dedupes \`fetch\` calls during a single render pass.
2. **Data Cache**: Persists data across server requests and deployments.
3. **Full Route Cache**: Caches HTML and RSC payload on the server.
4. **Router Cache**: Client-side in-memory cache of visited route segments.`,
        quizzes: [
          {
            id: 'q3-1',
            question: 'What is the purpose of Request Memoization in Next.js?',
            options: [
              'To store user login sessions in cookies',
              'To deduplicate identical fetch requests within the same render pass',
              'To compress image files before sending them to the browser',
              'To prevent users from refreshing the page'
            ],
            correctAnswer: 1,
            explanation: 'Request memoization ensures that calling the exact same fetch() with identical parameters across multiple components executes only once per render.',
            timestampSeconds: 90
          }
        ]
      }
    ]
  },
  {
    id: 'python-ai-engineering',
    title: 'Python for AI Engineers & LLM Applications',
    description: 'Practical guide to building production AI agents, prompt chaining, function calling, and vector embeddings using modern Python.',
    thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&q=80',
    sourceUrl: 'https://www.youtube.com/watch?v=kCc8FmEb1nY',
    sourceType: 'playlist',
    author: 'AI Dev Guild',
    totalDuration: '1h 50m',
    createdAt: new Date().toISOString(),
    lessons: [
      {
        id: 'py-1',
        videoId: 'kCc8FmEb1nY',
        title: '01. Python 3.12+ Modern Syntax & Type Hints for AI',
        duration: '15:20',
        thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&q=80',
        overview: 'Master typing, Pydantic v2 data models, and structured schema definitions for LLM outputs.',
        timestampNotes: [
          { timeSeconds: 30, label: 'Why Strict Types Matter for LLMs', summary: 'Guaranteeing structured JSON outputs with Pydantic.' },
          { timeSeconds: 400, label: 'AsyncIO Basics for Concurrent API Calls', summary: 'Handling rate limits and batch requests without blocking.' }
        ],
        studyNotes: `### Key Learnings
- Use Pydantic \`BaseModel\` for guaranteed structured outputs with instructor / function calling.
- Type hints improve IDE autocompletion and reduce runtime errors in complex agent loops.`,
        quizzes: [
          {
            id: 'pq-1',
            question: 'Why is Pydantic widely used when building LLM applications in Python?',
            options: [
              'It trains neural networks on GPU',
              'It provides data validation and guarantees structured outputs matching schemas',
              'It acts as an alternative to PyTorch',
              'It replaces standard Python lists with C pointers'
            ],
            correctAnswer: 1,
            explanation: 'Pydantic validates and parses LLM outputs into structured Python objects according to schema definitions.',
            timestampSeconds: 30
          }
        ]
      }
    ]
  }
];
