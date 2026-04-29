import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for workout generation
  app.post("/api/generate-workout", async (req, res) => {
    try {
      const { difficulty } = req.body;
      if (!difficulty) {
        return res.status(400).json({ error: "Difficulty is required" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server" });
      }

      const genAI = new GoogleGenAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

      const pplRoutine = {
        "Push A": {
          "exercises": [
            "10 Push-ups", "20 Sphinx Push-up",
            "20 Archer Push-up (10/side)", "10 Pike Push-up",
            "15 Bar Dips", "20 BW Lateral Raises (10/side)"
          ],
          "focus": "Chest and Triceps"
        },
        "Pull A": {
          "exercises": [
            "6 Pull-ups", "12 Inverted Row",
            "10 Chin-ups", "20 Superman Row",
            "10 Ring Row", "5 Negative Pull-up",
            "15 Knee Raises", "20 Side Knee Raises (10/side)"
          ],
          "focus": "Lats, Traps, and Biceps"
        },
        "Legs A": {
          "exercises": [
            "20 Basic Squats", "20 Curtsy Lunges (10/side)",
            "20 Archer Squats (10/side)", "20 Single-Leg RDL (10/side)",
            "12 Pistol Squat (6/side)", "12 Long Lever Bridge w/ Marching (6/side)"
          ],
          "focus": "Quads, Glute, and Hamstrings"
        },
        "Push B": {
          "exercises": [
            "10 Dive Bomber Push-ups", "10 Bar Dips",
            "10 Pseudo Planche", "10 Floor L Dips",
            "10 Negative Push Up", "20 Triceps Extensions"
          ],
          "focus": "Chest, Triceps, and Delts"
        },
        "Pull B": {
          "exercises": [
            "5 Muscle-up (No Dip)", "15 Bodyweight Curl",
            "5 L Pull Up", "15 Superman Pull",
            "10 Archer Pull-Up (5/side)", "10 Jackknife Pull-up",
            "20 Knee Tucks", "20 Side Knee Raises (10/side)"
          ],
          "focus": "Back, Biceps, and Abs"
        },
        "Legs B": {
          "exercises": [
            "10 Bulgarian Split Squat (5/side)", "10 Nordic Curl",
            "10 Skater Squats (5/side)", "20 Bird Dog Lifts (10/side)",
            "10 Sissy Squats (5/side)", "10 Elevated Glute Bridge (5/side)"
          ],
          "focus": "Quad, Ham, and Glute"
        }
      };

      const schedule = ["Push A", "Pull A", "Legs A", "Push B", "Pull B", "Legs B", "Rest"];
      const dayOfWeek = new Date().getDay(); // 0 (Sun) to 6 (Sat)
      const scheduleIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const focus = schedule[scheduleIndex];

      if (focus === "Rest") {
        return res.json({
          title: "Rest & Recovery",
          description: "Allow your muscles to recover and grow. Dynamic stretching or light walking is encouraged.",
          difficulty,
          exercises: [
            { name: "Active Recovery", reps: "15 min", sets: 1, notes: "Light movement or stretching" }
          ]
        });
      }

      const workoutBase = pplRoutine[focus as keyof typeof pplRoutine];

      const prompt = `Generate a daily calisthenics home workout plan. 
Today's focus is: ${focus}.
Base Exercises: ${workoutBase.exercises.join(", ")}.
Target Focus: ${workoutBase.focus}.

Athlete Difficulty Level: ${difficulty}.
Please adjust the reps and variations based on the ${difficulty} level while keeping the Spirit of the ${focus} workout from the 6-Day PPL routine.
Perform supersets of every 2 exercises listed (no rest between paired exercises).

Return the plan in JSON format.`;

      const response = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              difficulty: { type: Type.STRING },
              exercises: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    reps: { type: Type.STRING },
                    sets: { type: Type.NUMBER },
                    notes: { type: Type.STRING }
                  },
                  required: ["name", "reps", "sets"]
                }
              }
            },
            required: ["title", "description", "difficulty", "exercises"]
          }
        }
      });

      res.json(JSON.parse(response.response.text()));
    } catch (error) {
      console.error("Workout generation error:", error);
      res.status(500).json({ error: "Failed to generate workout plan" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
