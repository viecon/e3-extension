import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle } from './ui/Card';
import { sendMessage } from '@/lib/messages';

interface CalendarEvent {
  id: number;
  name: string;
  timestart: number;
  eventtype: string;
  overdue: boolean;
  course?: { shortname: string };
  url: string;
}

export function DeadlineTimeline() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const result = await sendMessage('getCalendarEvents', { days: 14 });
      setEvents(result.events as CalendarEvent[]);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (ts: number) =>
    new Date(ts * 1000).toLocaleDateString('zh-TW', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    });

  const formatTime = (ts: number) =>
    new Date(ts * 1000).toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
    });

  // Group by date
  const grouped = events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    const dateKey = formatDate(event.timestart);
    (acc[dateKey] ??= []).push(event);
    return acc;
  }, {});

  if (loading) {
    return (
      <Card>
        <div className="py-6 text-center text-sm text-gray-500">載入行事曆...</div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>近期截止日</CardTitle>
      </CardHeader>

      {events.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">近兩週沒有事件</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([date, dayEvents]) => (
            <div key={date}>
              <div className="text-xs font-semibold text-gray-500 mb-1.5">{date}</div>
              <div className="space-y-1 ml-2 border-l-2 border-gray-200 pl-3">
                {dayEvents.map((e) => (
                  <a
                    key={e.id}
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-2 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 truncate">{e.name}</span>
                      <span className="text-xs text-gray-400 shrink-0 ml-2">
                        {formatTime(e.timestart)}
                      </span>
                    </div>
                    {e.course && (
                      <span className="text-xs text-gray-400">{e.course.shortname}</span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
