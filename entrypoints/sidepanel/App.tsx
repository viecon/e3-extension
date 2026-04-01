import React, { useEffect, useState } from 'react';
import { LoginForm } from '@/components/LoginForm';
import { AssignmentList } from '@/components/AssignmentList';
import { CourseList } from '@/components/CourseList';
import { DownloadManager } from '@/components/DownloadManager';
import { UploadDialog } from '@/components/UploadDialog';
import { DeadlineTimeline } from '@/components/DeadlineTimeline';
import { GradeOverview } from '@/components/GradeOverview';
import { Button } from '@/components/ui/Button';
import { sendMessage } from '@/lib/messages';

type Tab = 'assignments' | 'courses' | 'calendar' | 'grades';
type SubView =
  | { type: 'none' }
  | { type: 'download'; courseId: number; courseName: string }
  | { type: 'upload'; assignmentId: number; assignmentName: string };

export default function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [fullname, setFullname] = useState('');
  const [tab, setTab] = useState<Tab>('assignments');
  const [subView, setSubView] = useState<SubView>({ type: 'none' });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const state = await sendMessage('getAuthState', undefined);
      setLoggedIn(state.loggedIn);
      setFullname(state.fullname ?? '');
    } catch {
      setLoggedIn(false);
    }
  };

  const handleLogout = async () => {
    await sendMessage('logout', undefined);
    setLoggedIn(false);
  };

  if (loggedIn === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="text-sm text-gray-500">載入中...</span>
      </div>
    );
  }

  if (!loggedIn) {
    return <LoginForm onSuccess={() => { setLoggedIn(true); checkAuth(); }} />;
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'assignments', label: '作業' },
    { key: 'courses', label: '課程' },
    { key: 'calendar', label: '行事曆' },
    { key: 'grades', label: '成績' },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 bg-e3-primary text-white p-3 shadow-md z-10">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-sm font-bold">E3 助手</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-80">{fullname}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="!text-white/80 hover:!text-white hover:!bg-white/10">
              登出
            </Button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSubView({ type: 'none' }); }}
              className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${
                tab === t.key
                  ? 'bg-white/20 text-white font-medium'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {subView.type === 'download' && (
          <DownloadManager
            courseId={subView.courseId}
            courseName={subView.courseName}
            onBack={() => setSubView({ type: 'none' })}
          />
        )}

        {subView.type === 'upload' && (
          <UploadDialog
            assignmentId={subView.assignmentId}
            assignmentName={subView.assignmentName}
            onBack={() => setSubView({ type: 'none' })}
          />
        )}

        {subView.type === 'none' && (
          <>
            {tab === 'assignments' && <AssignmentList />}
            {tab === 'courses' && (
              <CourseList
                onSelectCourse={(id, name) =>
                  setSubView({ type: 'download', courseId: id, courseName: name })
                }
              />
            )}
            {tab === 'calendar' && <DeadlineTimeline />}
            {tab === 'grades' && <GradeOverview />}
          </>
        )}
      </div>
    </div>
  );
}
