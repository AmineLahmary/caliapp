export interface Exercise {
  name: string;
  reps: string;
  sets: number;
  notes: string;
}

export interface WorkoutPlan {
  title: string;
  description: string;
  difficulty: string;
  exercises: Exercise[];
}

export async function generateDailyWorkout(difficulty: string): Promise<WorkoutPlan> {
  try {
    const response = await fetch("/api/generate-workout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ difficulty }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    return await response.json();
  } catch (e) {
    console.error("Failed to generate workout plan via API", e);
    // Fallback simple workout
    return {
      title: "Full Body Essentials",
      description: "A solid baseline workout.",
      difficulty,
      exercises: [
        { name: "Pushups", reps: "10-15", sets: 3, notes: "Keep core tight" },
        { name: "Squats", reps: "15-20", sets: 3, notes: "Go deep" },
        { name: "Plank", reps: "30s", sets: 3, notes: "No sagging" }
      ]
    };
  }
}
