import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle } from './ui/Card';
import { sendMessage } from '@/lib/messages';

interface GradeEntry {
  courseid: number;
  grade: string;
  rawgrade: string;
}

interface CourseInfo {
  id: number;
  fullname: string;
  shortname: string;
}

export function GradeOverview() {
  const [grades, setGrades] = useState<{ course: string; grade: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGrades();
  }, []);

  const loadGrades = async () => {
    setLoading(true);
    try {
      const [gradesResult, coursesResult] = await Promise.all([
        sendMessage('getGrades', {}),
        sendMessage('getCourses', undefined),
      ]);

      const courseMap = new Map(
        (coursesResult.courses as CourseInfo[]).map((c) => [c.id, c.fullname]),
      );

      const gradeData = gradesResult.grades as { grades: GradeEntry[] } | null;
      if (gradeData?.grades) {
        setGrades(
          gradeData.grades.map((g) => ({
            course: courseMap.get(g.courseid) ?? String(g.courseid),
            grade: g.grade || '-',
          })),
        );
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="py-6 text-center text-sm text-gray-500">載入成績...</div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>成績總覽</CardTitle>
      </CardHeader>

      {grades.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">無成績資料</p>
      ) : (
        <div className="space-y-1">
          {grades.map((g, i) => (
            <div key={i} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50">
              <span className="text-sm text-gray-700 truncate">{g.course}</span>
              <span className="text-sm font-medium text-e3-primary shrink-0 ml-2">{g.grade}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
