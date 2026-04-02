import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle } from './ui/Card';
import { sendMessage } from '@/lib/messages';
import { stripHtml } from '@/lib/utils';

interface NotifItem {
  id: number;
  subject: string;
  message: string;
  from: string;
  time: number;
  read: boolean;
  url: string;
}


function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('zh-TW', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function NotificationList() {
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const result = await sendMessage('getNotifications', { limit: 20 });
      setNotifs(result.notifications as NotifItem[]);
    } catch { /* ignore */ }
    setLoading(false);
  };

  if (loading) {
    return <Card><div className="py-6 text-center text-sm text-gray-500">載入通知...</div></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>通知</CardTitle>
        <button onClick={load} className="text-xs text-e3-accent hover:underline">重新整理</button>
      </CardHeader>

      {notifs.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">沒有通知</p>
      ) : (
        <div className="space-y-1">
          {notifs.map((n) => (
            <a
              key={n.id}
              href={n.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={`block p-2.5 rounded-lg transition-colors ${n.read ? 'hover:bg-gray-50' : 'bg-blue-50/50 hover:bg-blue-50'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`text-sm truncate ${n.read ? 'text-gray-600' : 'font-medium text-gray-800'}`}>
                    {n.subject}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {stripHtml(n.message).slice(0, 80)}
                  </p>
                </div>
                <span className="text-[10px] text-gray-400 shrink-0">{formatTime(n.time)}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}
