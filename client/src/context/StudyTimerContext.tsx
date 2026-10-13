import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useCourse } from './CourseContext';

interface StudyTimerContextType {
  status: 'idle' | 'running' | 'paused';
  seconds: number;
  formattedTime: string;
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: (notes?: string) => Promise<{ success: boolean; durationMinutes: number }>;
  resetTimer: () => void;
}

const StudyTimerContext = createContext<StudyTimerContextType>({
  status: 'idle',
  seconds: 0,
  formattedTime: '00:00:00',
  startTimer: () => {},
  pauseTimer: () => {},
  resumeTimer: () => {},
  stopTimer: async () => ({ success: false, durationMinutes: 0 }),
  resetTimer: () => {},
});

export const StudyTimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { selectedCourse } = useCourse();
  const [status, setStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const [seconds, setSeconds] = useState(0);

  const startTimeRef = useRef<number | null>(null);
  const accumulatedSecondsRef = useRef<number>(0);
  const intervalRef = useRef<any>(null);

  // Restore timer state from localStorage on initial load
  useEffect(() => {
    try {
      const saved = localStorage.getItem('studymate_timer_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.status === 'running') {
          const now = Date.now();
          const elapsedSinceSave = Math.floor((now - parsed.lastTimestamp) / 1000);
          const totalSec = parsed.accumulatedSeconds + elapsedSinceSave;
          setSeconds(totalSec);
          accumulatedSecondsRef.current = totalSec;
          startTimeRef.current = now;
          setStatus('running');
        } else if (parsed.status === 'paused') {
          setSeconds(parsed.accumulatedSeconds);
          accumulatedSecondsRef.current = parsed.accumulatedSeconds;
          setStatus('paused');
        }
      }
    } catch (e) {
      console.warn('Could not restore timer state from localStorage');
    }
  }, []);

  // Timer interval loop
  useEffect(() => {
    if (status === 'running') {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }

      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const currentElapsed = Math.floor((now - startTimeRef.current!) / 1000);
        const total = accumulatedSecondsRef.current + currentElapsed;
        setSeconds(total);

        // Save persistent state
        localStorage.setItem(
          'studymate_timer_state',
          JSON.stringify({
            status: 'running',
            accumulatedSeconds: accumulatedSecondsRef.current,
            lastTimestamp: now,
          })
        );
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status]);

  const startTimer = () => {
    if (status === 'running') return; // Prevent duplicate timers
    startTimeRef.current = Date.now();
    accumulatedSecondsRef.current = 0;
    setSeconds(0);
    setStatus('running');
    localStorage.setItem(
      'studymate_timer_state',
      JSON.stringify({
        status: 'running',
        accumulatedSeconds: 0,
        lastTimestamp: Date.now(),
      })
    );
  };

  const pauseTimer = () => {
    if (status !== 'running') return;
    const now = Date.now();
    const currentRun = Math.floor((now - (startTimeRef.current || now)) / 1000);
    accumulatedSecondsRef.current += currentRun;
    startTimeRef.current = null;
    setStatus('paused');
    localStorage.setItem(
      'studymate_timer_state',
      JSON.stringify({
        status: 'paused',
        accumulatedSeconds: accumulatedSecondsRef.current,
        lastTimestamp: now,
      })
    );
  };

  const resumeTimer = () => {
    if (status !== 'paused') return;
    startTimeRef.current = Date.now();
    setStatus('running');
  };

  const resetTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    startTimeRef.current = null;
    accumulatedSecondsRef.current = 0;
    setSeconds(0);
    setStatus('idle');
    localStorage.removeItem('studymate_timer_state');
  };

  const stopTimer = async (notes?: string): Promise<{ success: boolean; durationMinutes: number }> => {
    if (status === 'idle') return { success: false, durationMinutes: 0 };

    let totalDuration = seconds;
    if (status === 'running' && startTimeRef.current) {
      const currentRun = Math.floor((Date.now() - startTimeRef.current) / 1000);
      totalDuration = accumulatedSecondsRef.current + currentRun;
    }

    resetTimer();

    if (totalDuration < 5) {
      // Don't save trivial sessions under 5 seconds
      return { success: false, durationMinutes: 0 };
    }

    try {
      const courseId = selectedCourse?.id || 'crs_cs101_java';
      const session = await api.recordStudySession({
        courseId,
        durationSeconds: totalDuration,
        sessionType: 'platform',
        notes: notes || 'Platform study session',
      });
      return { success: true, durationMinutes: session.duration_minutes };
    } catch (err) {
      console.error('Failed to save study session to backend:', err);
      return { success: false, durationMinutes: Math.round(totalDuration / 60) };
    }
  };

  const formatTime = (totalSeconds: number): string => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <StudyTimerContext.Provider
      value={{
        status,
        seconds,
        formattedTime: formatTime(seconds),
        startTimer,
        pauseTimer,
        resumeTimer,
        stopTimer,
        resetTimer,
      }}
    >
      {children}
    </StudyTimerContext.Provider>
  );
};

export const useStudyTimer = () => useContext(StudyTimerContext);
