import React, { useEffect, useState } from 'react';
import { LoginForm } from '@/components/LoginForm';
import { AssignmentList } from '@/components/AssignmentList';
import { CourseList } from '@/components/CourseList';
import { Button } from '@/components/ui/Button';
import { sendMessage } from '@/lib/messages';

export default function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [fullname, setFullname] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // First check if we already have auth stored
      const state = await sendMessage('getAuthState', undefined);
      if (state.loggedIn) {
        setLoggedIn(true);
        setFullname(state.fullname ?? '');
        return;
      }

      // Try to detect session from E3 cookies
      const session = await sendMessage('checkSession', undefined);
      if (session.loggedIn) {
        setLoggedIn(true);
        setFullname(session.fullname ?? '');
        return;
      }

      setLoggedIn(false);
    } catch {
      setLoggedIn(false);
    }
  };

  const handleLogout = async () => {
    await sendMessage('logout', undefined);
    setLoggedIn(false);
  };

  const openSidePanel = () => {
    if (chrome.sidePanel) {
      chrome.sidePanel.open({ windowId: undefined as unknown as number });
    }
  };

  if (loggedIn === null) {
    return (
      <div className="flex items-center justify-center h-48">
        <span className="text-sm text-gray-500">檢查登入狀態...</span>
      </div>
    );
  }

  if (!loggedIn) {
    return <LoginForm onSuccess={() => { setLoggedIn(true); checkAuth(); }} />;
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-e3-primary">E3 助手</h1>
          <p className="text-xs text-gray-400">{fullname}</p>
        </div>
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" onClick={openSidePanel}>
            展開
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            登出
          </Button>
        </div>
      </div>

      <AssignmentList />
      <CourseList />
    </div>
  );
}
