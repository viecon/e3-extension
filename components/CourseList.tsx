import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle } from './ui/Card';
import { sendMessage } from '@/lib/messages';

interface Course {
  id: number;
  shortname: string;
  fullname: string;
  progress: number | null;
  visible: number;
  hidden: boolean;
}

interface CourseListProps {
  onSelectCourse?: (courseId: number, courseName: string) => void;
}

export function CourseList({ onSelectCourse }: CourseListProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const result = await sendMessage('getCourses', undefined);
      const visible = (result.courses as Course[]).filter(c => c.visible && !c.hidden);
      setCourses(visible);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-8">
          <span className="text-sm text-gray-500">載入課程...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>我的課程</CardTitle>
      </CardHeader>
      <div className="space-y-1.5">
        {courses.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group"
            onClick={() => onSelectCourse?.(c.id, c.fullname)}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate group-hover:text-e3-accent">
                {c.fullname}
              </p>
              <p className="text-xs text-gray-400">{c.shortname}</p>
            </div>
            <a
              href={`https://e3p.nycu.edu.tw/course/view.php?id=${c.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-e3-accent hover:underline shrink-0 ml-2"
              onClick={(e) => e.stopPropagation()}
            >
              開啟
            </a>
          </div>
        ))}
      </div>
    </Card>
  );
}
