import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle } from './ui/Card';
import { sendMessage } from '@/lib/messages';

interface Assignment {
  id: number;
  cmid: number;
  courseId: number;
  courseName: string;
  courseShortname: string;
  name: string;
  duedate: number;
  submissionStatus: string;
  isOverdue: boolean;
  url?: string;
}

function formatDueDate(timestamp: number): string {
  if (timestamp === 0) return '無期限';
  return new Date(timestamp * 1000).toLocaleString('zh-TW', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getUrgencyClass(duedate: number): string {
  if (duedate === 0) return 'text-gray-400';
  const hoursLeft = (duedate - Date.now() / 1000) / 3600;
  if (hoursLeft < 0) return 'text-e3-danger';
  if (hoursLeft < 24) return 'text-e3-danger font-semibold';
  if (hoursLeft < 72) return 'text-e3-warning';
  return 'text-e3-success';
}

function getUrgencyBorder(duedate: number): string {
  if (duedate === 0) return 'border-l-gray-300';
  const hoursLeft = (duedate - Date.now() / 1000) / 3600;
  if (hoursLeft < 0) return 'border-l-e3-danger';
  if (hoursLeft < 24) return 'border-l-e3-danger';
  if (hoursLeft < 72) return 'border-l-e3-warning';
  return 'border-l-e3-success';
}

export function AssignmentList() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await sendMessage('getPendingAssignments', undefined);
      setAssignments(result.assignments as Assignment[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '載入失敗');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin h-5 w-5 text-e3-accent" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="ml-2 text-sm text-gray-500">載入作業中...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="text-sm text-e3-danger text-center py-4">{error}</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>未完成作業</CardTitle>
        <button onClick={loadAssignments} className="text-xs text-e3-accent hover:underline">
          重新整理
        </button>
      </CardHeader>

      {assignments.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">沒有未完成的作業</p>
      ) : (
        <div className="space-y-2">
          {assignments.map((a) => (
            <a
              key={a.id}
              href={a.url || `https://e3p.nycu.edu.tw/mod/assign/view.php?id=${a.cmid}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`block p-3 rounded-lg border-l-4 bg-gray-50 hover:bg-gray-100 transition-colors ${getUrgencyBorder(a.duedate)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{a.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{a.courseShortname}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs ${getUrgencyClass(a.duedate)}`}>
                    {formatDueDate(a.duedate)}
                  </p>
                  {a.isOverdue && (
                    <span className="text-[10px] text-e3-danger">逾期</span>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}
