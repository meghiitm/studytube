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
  let response: Response;
  try {
    response = await fetch('/api/generate-course', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, apiKey }),
    });
  } catch (netErr: any) {
    throw new Error(
      'Network request failed. Please check your internet connection or verify the YouTube URL.'
    );
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Failed to generate course (status ${response.status}).`
    );
  }

  const data = await response.json();
  return data.course;
}
