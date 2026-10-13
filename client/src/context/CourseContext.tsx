import React, { createContext, useContext, useState, useEffect } from 'react';
import { Course } from '../../../shared/types';
import { api } from '../api/client';

interface CourseContextType {
  courses: Course[];
  selectedCourse: Course | null;
  setSelectedCourse: (course: Course | null) => void;
  refreshCourses: () => Promise<void>;
  loading: boolean;
}

const CourseContext = createContext<CourseContextType>({
  courses: [],
  selectedCourse: null,
  setSelectedCourse: () => {},
  refreshCourses: async () => {},
  loading: true,
});

export const CourseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshCourses = async () => {
    try {
      const data = await api.getCourses();
      setCourses(data);
      if (data.length > 0) {
        // Restore from localStorage or pick the first course
        const savedId = localStorage.getItem('studymate_selected_course');
        const found = data.find(c => c.id === savedId) || data[0];
        setSelectedCourse(found);
      }
    } catch (err) {
      console.error('Failed to load courses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshCourses();
  }, []);

  const handleSelectCourse = (course: Course | null) => {
    setSelectedCourse(course);
    if (course) {
      localStorage.setItem('studymate_selected_course', course.id);
    } else {
      localStorage.removeItem('studymate_selected_course');
    }
  };

  return (
    <CourseContext.Provider
      value={{
        courses,
        selectedCourse,
        setSelectedCourse: handleSelectCourse,
        refreshCourses,
        loading,
      }}
    >
      {children}
    </CourseContext.Provider>
  );
};

export const useCourse = () => useContext(CourseContext);
