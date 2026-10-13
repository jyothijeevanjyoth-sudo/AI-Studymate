import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CourseProvider } from './context/CourseContext';
import { StudyTimerProvider } from './context/StudyTimerContext';
import { AppLayout } from './components/layout/AppLayout';

import { DashboardPage } from './pages/DashboardPage';
import { MaterialsPage } from './pages/MaterialsPage';
import { TutorPage } from './pages/TutorPage';
import { QuizPage } from './pages/QuizPage';
import { MisconceptionsPage } from './pages/MisconceptionsPage';
import { LearningTwinPage } from './pages/LearningTwinPage';
import { StudyTrackerPage } from './pages/StudyTrackerPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { StudyPlanPage } from './pages/StudyPlanPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  return (
    <CourseProvider>
      <StudyTimerProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="materials" element={<MaterialsPage />} />
              <Route path="tutor" element={<TutorPage />} />
              <Route path="quiz" element={<QuizPage />} />
              <Route path="misconceptions" element={<MisconceptionsPage />} />
              <Route path="learning-twin" element={<LearningTwinPage />} />
              <Route path="tracker" element={<StudyTrackerPage />} />
              <Route path="study-tracker" element={<Navigate to="/tracker" replace />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="study-plan" element={<StudyPlanPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </StudyTimerProvider>
    </CourseProvider>
  );
};

export default App;
