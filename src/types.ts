export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface Exercise {
  name: string;
  reps: string;
  sets: number;
  notes: string;
}

export interface WorkoutPlan {
  id?: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  exercises: Exercise[];
  targetDate?: string;
}

export interface ExerciseLog {
  name: string;
  completedReps: number[]; // Reps per set
  sets: number;
}

export interface WorkoutLog {
  id?: string;
  userId: string;
  workoutId?: string;
  date: any; // Firestore Timestamp
  exercises: ExerciseLog[];
  totalReps: number;
  notes?: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  difficulty: Difficulty;
  personalBests: Record<string, number>; // e.g., { "Pushups": 50 }
  createdAt: any;
  updatedAt: any;
}
