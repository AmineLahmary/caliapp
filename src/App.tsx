/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, signInWithGoogle, signOut, db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { doc, getDoc, setDoc, query, collection, where, orderBy, limit, getDocs, Timestamp, addDoc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Trophy, Dumbbell, History, LineChart, User, LogOut, ChevronRight, CheckCircle2, Flame, Award, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { generateDailyWorkout, WorkoutPlan } from '@/src/services/workoutService';
import { UserProfile, WorkoutLog, Difficulty, ExerciseLog } from '@/src/types';
import { LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function App() {
  const [user, loading, error] = useAuthState(auth);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [todayWorkout, setTodayWorkout] = useState<WorkoutPlan | null>(null);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loadingWorkout, setLoadingWorkout] = useState(false);
  const [activeTab, setActiveTab] = useState('workout');

  // Load profile and today's workout
  useEffect(() => {
    if (user) {
      fetchProfile(user.uid);
      fetchLogs(user.uid);
    }
  }, [user]);

  useEffect(() => {
    if (profile && !todayWorkout) {
      getTodayWorkout();
    }
  }, [profile]);

  async function fetchProfile(uid: string) {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setProfile(userSnap.data() as UserProfile);
      } else {
        // Create default profile
        const newProfile: UserProfile = {
          userId: uid,
          email: user?.email || '',
          displayName: user?.displayName || 'Athlete',
          difficulty: 'beginner',
          personalBests: {},
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        await setDoc(userRef, newProfile);
        setProfile(newProfile);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, `users/${uid}`);
    }
  }

  async function fetchLogs(uid: string) {
    try {
      const logsRef = collection(db, 'users', uid, 'logs');
      const q = query(logsRef, orderBy('date', 'desc'), limit(50));
      const querySnapshot = await getDocs(q);
      const fetchedLogs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkoutLog));
      setLogs(fetchedLogs);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, `users/${uid}/logs`);
    }
  }

  async function getTodayWorkout() {
    setLoadingWorkout(true);
    try {
      // Check if we have one for today already (cached in memory or could check DB)
      // For now, let's just generate one based on difficulty
      const workout = await generateDailyWorkout(profile?.difficulty || 'beginner');
      setTodayWorkout(workout);
    } catch (e) {
      toast.error("Failed to generate workout. Using backup plan.");
    } finally {
      setLoadingWorkout(false);
    }
  }

  const updateDifficulty = async (val: Difficulty) => {
    if (!profile || !user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { 
        difficulty: val,
        updatedAt: Timestamp.now()
      });
      setProfile({ ...profile, difficulty: val });
      setTodayWorkout(null); // Trigger re-generation
      toast.success(`Difficulty set to ${val}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleLogWorkout = async (workoutLog: Omit<WorkoutLog, 'userId' | 'date'>) => {
    if (!user) return;
    try {
      const fullLog: WorkoutLog = {
        ...workoutLog,
        userId: user.uid,
        date: Timestamp.now()
      };
      
      const logsRef = collection(db, 'users', user.uid, 'logs');
      const docRef = await addDoc(logsRef, fullLog);
      
      // Update PBs
      const newPBs = { ...profile?.personalBests };
      let pbUpdated = false;
      fullLog.exercises.forEach(ex => {
        const maxReps = Math.max(...ex.completedReps);
        if (!newPBs[ex.name] || maxReps > newPBs[ex.name]) {
          newPBs[ex.name] = maxReps;
          pbUpdated = true;
        }
      });
      
      if (pbUpdated && profile) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { personalBests: newPBs, updatedAt: Timestamp.now() });
        setProfile({ ...profile, personalBests: newPBs });
        toast.success("Workout logged! New Personal Best recorded! 🎉");
      } else {
        toast.success("Workout logged successfully!");
      }
      
      fetchLogs(user.uid);
      setActiveTab('history');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/logs`);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-900" />
      </div>
    );
  }

  if (!user) {
    return <LoginView onLogin={signInWithGoogle} />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans p-4 md:p-8">
      <header className="max-w-4xl mx-auto mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">CaliProgress</h1>
          <p className="text-zinc-500 text-sm">Elevate your body, master your strength.</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="px-3 py-1 border-zinc-200 bg-white">
            <Flame className="h-4 w-4 mr-1 text-orange-500 fill-orange-500" />
            <span className="font-semibold">{logs.length} sessions</span>
          </Badge>
          <Button variant="ghost" size="icon" onClick={() => signOut()} className="text-zinc-500 hover:text-zinc-900">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full bg-zinc-200/50 p-1 rounded-xl">
            <TabsTrigger value="workout" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Dumbbell className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Workout</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <History className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
            <TabsTrigger value="progress" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <LineChart className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Progress</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <User className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <TabsContent value="workout" className="mt-0 space-y-6">
                {loadingWorkout ? (
                  <Card className="border-none shadow-none bg-transparent flex flex-col items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin mb-4 text-zinc-400" />
                    <p className="text-zinc-500 italic">Designing your perfect home program...</p>
                  </Card>
                ) : todayWorkout ? (
                  <WorkoutCard 
                    workout={todayWorkout} 
                    onLog={handleLogWorkout} 
                  />
                ) : (
                  <Card className="bg-white border-zinc-200 shadow-sm border">
                    <CardContent className="py-12 text-center">
                      <p className="text-zinc-500">No workout generated. Head to profile to pick a difficulty!</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-0">
                <HistoryList logs={logs} />
              </TabsContent>

              <TabsContent value="progress" className="mt-0">
                <ProgressCharts logs={logs} />
              </TabsContent>

              <TabsContent value="profile" className="mt-0">
                <ProfileSettings 
                  profile={profile} 
                  onUpdateDifficulty={updateDifficulty} 
                />
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}

function LoginView({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="flex flex-col h-screen items-center justify-center bg-zinc-900 text-white p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-8 max-w-md"
      >
        <div className="space-y-2">
          <div className="bg-white p-4 rounded-3xl w-20 h-20 mx-auto flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(255,255,255,0.1)]">
            <Dumbbell className="h-10 w-10 text-zinc-900" />
          </div>
          <h1 className="text-4xl font-bold tracking-tighter">CaliProgress</h1>
          <p className="text-zinc-400 text-lg">Master your bodyweight. Track your evolution. Daily.</p>
        </div>
        <Button 
          onClick={onLogin} 
          size="lg" 
          className="w-full bg-white text-zinc-900 hover:bg-zinc-200 py-6 text-lg font-bold rounded-2xl transition-all hover:scale-[1.02]"
        >
          Sign in with Google
        </Button>
        <p className="text-xs text-zinc-500 uppercase tracking-widest">Personal Use Calisthenics Portal</p>
      </motion.div>
    </div>
  );
}

function WorkoutCard({ workout, onLog }: { workout: WorkoutPlan, onLog: (log: Omit<WorkoutLog, 'userId' | 'date'>) => void }) {
  const [sessionStarted, setSessionStarted] = useState(false);
  const [currentReps, setCurrentReps] = useState<Record<string, number[]>>({});

  const startSession = () => {
    setSessionStarted(true);
    const initialReps: Record<string, number[]> = {};
    workout.exercises.forEach(ex => {
      initialReps[ex.name] = Array(ex.sets).fill(0);
    });
    setCurrentReps(initialReps);
  };

  const handleRepChange = (exName: string, setIndex: number, val: string) => {
    const num = parseInt(val) || 0;
    const newReps = { ...currentReps };
    newReps[exName][setIndex] = num;
    setCurrentReps(newReps);
  };

  const submitLog = () => {
    const logs: ExerciseLog[] = workout.exercises.map(ex => ({
      name: ex.name,
      sets: ex.sets,
      completedReps: currentReps[ex.name]
    }));
    
    const totalReps = logs.reduce((acc, curr) => acc + curr.completedReps.reduce((a, b) => a + b, 0), 0);
    
    onLog({
      workoutId: workout.title,
      exercises: logs,
      totalReps,
      notes: ""
    });
    setSessionStarted(false);
  };

  return (
    <Card className="bg-white border-zinc-200 shadow-sm overflow-hidden border-none ring-1 ring-zinc-200 flex flex-col h-[70vh] sm:h-[75vh]">
      <CardHeader className="bg-zinc-900 text-white p-6 shrink-0">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-2xl font-bold uppercase tracking-tight">{workout.title}</CardTitle>
            <CardDescription className="text-zinc-400 mt-1">{workout.description}</CardDescription>
          </div>
          <Badge className="bg-orange-500 text-white border-none uppercase text-[10px] tracking-widest px-2 py-0.5">
            {workout.difficulty}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6 flex-1 overflow-y-auto min-h-0 bg-white">
        <div className="space-y-6">
          {workout.exercises.map((ex, idx) => (
            <div key={idx} className="group">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-3">
                  <div className="bg-zinc-100 p-2 rounded-lg group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-900">{ex.name}</h4>
                    <p className="text-xs text-zinc-500">{ex.notes}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm font-bold">{ex.sets} sets x {ex.reps}</span>
                </div>
              </div>
              
              {sessionStarted && (
                <div className="grid grid-cols-5 gap-2 mt-3 bg-zinc-50 p-3 rounded-xl">
                  {currentReps[ex.name].map((reps, sIdx) => (
                    <div key={sIdx} className="space-y-1">
                      <Label className="text-[10px] text-zinc-400 uppercase font-bold text-center block">Set {sIdx + 1}</Label>
                      <Input 
                        type="number"
                        value={reps || ''}
                        onChange={(e) => handleRepChange(ex.name, sIdx, e.target.value)}
                        className="h-10 text-center font-mono focus-visible:ring-zinc-900 border-zinc-200"
                      />
                    </div>
                  ))}
                </div>
              )}
              {idx < workout.exercises.length - 1 && <Separator className="mt-6 opacity-30" />}
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="p-6 border-t border-zinc-100 flex gap-3 bg-white relative z-10 shrink-0">
        {!sessionStarted ? (
          <Button onClick={startSession} className="w-full h-14 rounded-2xl bg-zinc-900 text-lg font-bold hover:bg-zinc-800">
            START WORKOUT
          </Button>
        ) : (
          <Button onClick={submitLog} className="w-full h-14 rounded-2xl bg-orange-600 text-lg font-bold hover:bg-orange-700">
            COMPLETE SESSION
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function HistoryList({ logs }: { logs: WorkoutLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-zinc-300">
        <History className="h-12 w-12 mx-auto text-zinc-300 mb-4" />
        <p className="text-zinc-500 italic">No history yet. Time to hit the bars!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {logs.map((log) => (
        <Card key={log.id} className="bg-white border-zinc-200 overflow-hidden hover:border-zinc-400 transition-all border shadow-none">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-4">
              <div className="bg-zinc-900 text-white h-12 w-12 rounded-xl flex items-center justify-center font-bold">
                {format(log.date.toDate(), 'dd')}
              </div>
              <div>
                <CardTitle className="text-lg font-bold uppercase tracking-tight">{log.workoutId || "Custom Workout"}</CardTitle>
                <CardDescription className="text-xs">{format(log.date.toDate(), 'MMMM yyyy, HH:mm')}</CardDescription>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-zinc-900">{log.totalReps}</div>
              <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest">Total Reps</div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
              {log.exercises.map((ex, i) => (
                <div key={i} className="bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                  <div className="text-[10px] text-zinc-400 uppercase font-black truncate">{ex.name}</div>
                  <div className="font-mono text-xs font-bold text-zinc-700 truncate">
                    {ex.completedReps.join(' • ')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ProgressCharts({ logs }: { logs: WorkoutLog[] }) {
  if (logs.length < 2) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-zinc-300">
        <LineChart className="h-12 w-12 mx-auto text-zinc-300 mb-4" />
        <p className="text-zinc-500 italic">Need at least 2 sessions to visualize progress.</p>
      </div>
    );
  }

  const chartData = [...logs].reverse().map(log => ({
    date: format(log.date.toDate(), 'MMM dd'),
    reps: log.totalReps
  }));

  // Aggregate by exercise
  const exerciseData: Record<string, { date: string, reps: number }[]> = {};
  logs.forEach(log => {
    const d = format(log.date.toDate(), 'MMM dd');
    log.exercises.forEach(ex => {
      if (!exerciseData[ex.name]) exerciseData[ex.name] = [];
      exerciseData[ex.name].push({ date: d, reps: Math.max(...ex.completedReps) });
    });
  });

  return (
    <div className="space-y-6">
      <Card className="shadow-none border border-zinc-200">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Total Volume Over Time</CardTitle>
          <CardDescription>Visualizing your workout density per session</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ReLineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
              <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
                labelStyle={{ fontWeight: 'bold' }}
              />
              <Line type="monotone" dataKey="reps" stroke="#18181b" strokeWidth={3} dot={{ r: 4, fill: '#18181b' }} activeDot={{ r: 6 }} />
            </ReLineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Object.entries(exerciseData).slice(0, 4).map(([name, data]) => (
          <Card key={name} className="shadow-none border border-zinc-200">
            <CardHeader className="p-4">
              <CardTitle className="text-xs uppercase font-black tracking-widest text-zinc-400">{name} (Max Reps)</CardTitle>
            </CardHeader>
            <CardContent className="h-[150px] p-2">
              <ResponsiveContainer width="100%" height="100%">
                <ReLineChart data={data.reverse()}>
                  <XAxis dataKey="date" hide />
                  <YAxis hide />
                  <Tooltip />
                  <Line type="stepAfter" dataKey="reps" stroke="#f97316" strokeWidth={2} dot={false} />
                </ReLineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ProfileSettings({ profile, onUpdateDifficulty }: { profile: UserProfile | null, onUpdateDifficulty: (v: Difficulty) => void }) {
  if (!profile) return null;

  const pbList = Object.entries(profile.personalBests).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <Card className="shadow-none border border-zinc-200 overflow-hidden">
        <CardHeader className="relative overflow-hidden bg-zinc-900 text-white min-h-[160px] flex justify-end">
          <div className="absolute top-0 right-0 p-12 opacity-10 blur-2xl bg-white w-40 h-40 rounded-full" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center text-zinc-900">
              <User className="h-8 w-8" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">{profile.displayName}</CardTitle>
              <CardDescription className="text-zinc-400">{profile.email}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          <div className="space-y-4">
            <Label className="text-xs uppercase font-black tracking-widest text-zinc-500">Training Difficulty</Label>
            <Select value={profile.difficulty} onValueChange={(v) => onUpdateDifficulty(v as Difficulty)}>
              <SelectTrigger className="h-14 rounded-xl border-zinc-200 focus:ring-zinc-900">
                <SelectValue placeholder="Select Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-zinc-400 italic">Changing difficulty will regenerate your daily program.</p>
          </div>

          <Separator className="opacity-50" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase font-black tracking-widest text-zinc-500">Personal Bests</Label>
              <Award className="h-4 w-4 text-orange-500" />
            </div>
            {pbList.length === 0 ? (
              <p className="text-sm text-zinc-400 italic">No records yet. Log your first workout!</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {pbList.map(([exercise, reps]) => (
                  <div key={exercise} className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 flex justify-between items-center group hover:bg-zinc-900 hover:text-white transition-all cursor-default">
                    <span className="font-bold text-sm truncate pr-2">{exercise}</span>
                    <span className="font-mono text-lg font-black">{reps}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <div className="bg-zinc-100 p-6 rounded-3xl border border-zinc-200">
        <h4 className="font-bold text-zinc-900 mb-1">Training Tip</h4>
        <p className="text-sm text-zinc-500">
          The best calisthenics results come from consistency, not intensity. Aim for clean reps over high numbers.
        </p>
      </div>
    </div>
  );
}
