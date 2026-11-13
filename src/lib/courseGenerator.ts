import { Course, Lesson, QuizQuestion } from '@/types/course';

export interface GenerateCourseRequest {
  url: string;
  apiKey?: string; // Optional user BYOK Gemini API key
}

/**
 * Free/local course generator
 * Can use Gemini API when key is provided, or smart fallback heuristic generator
 */
export async function generateCourseFromUrl(url: string, apiKey?: string): Promise<Course> {
  const response = await fetch('/api/generate-course', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, apiKey })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to generate course');
  }

  const data = await response.json();
  return data.course;
}
