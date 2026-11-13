export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // 0-based index
  explanation: string;
  timestampSeconds: number; // For "Replay the Moment"
}

export interface TimestampNote {
  timeSeconds: number;
  label: string;
  summary?: string;
}

export interface Lesson {
  id: string;
  videoId: string;
  title: string;
  duration?: string;
  startSeconds?: number;
  thumbnail?: string;
  overview?: string;
  timestampNotes: TimestampNote[];
  studyNotes: string; // Markdown formatted
  quizzes: QuizQuestion[];
  completed?: boolean;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  sourceUrl: string;
  sourceType: 'playlist' | 'video_chapters';
  author?: string;
  totalDuration?: string;
  createdAt: string;
  lessons: Lesson[];
  placementTest?: QuizQuestion[];
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  box: 1 | 2 | 3 | 4; // Leitner boxes: 1=new, 2=2d, 3=5d, 4=mastered
  nextReviewAt: string; // ISO date
  lessonId?: string;
}

export interface UserProgress {
  courseId: string;
  completedLessonIds: string[];
  knownLessonIds?: string[]; // Skipped via Placement Test
  bookmarkedLessonIds?: string[];
  dailyPaceMinutes?: 30 | 60 | 90 | 120;
  quizScores: Record<string, number>; // lessonId -> percentage score
  personalNotes: Record<string, string>; // lessonId -> user markdown notes
  flashcards?: Flashcard[];
  lastVisitedLessonId?: string;
}

export interface StudyStats {
  currentStreak: number;
  bestStreak: number;
  lastStudyDate: string | null; // YYYY-MM-DD
  studyDates: string[];
}

export interface CourseRoadmap {
  id: string;
  title: string;
  description: string;
  courseIds: string[];
  createdAt: string;
}
