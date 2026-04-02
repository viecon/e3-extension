import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle } from './ui/Card';
import { sendMessage } from '@/lib/messages';
import { stripHtml } from '@/lib/utils';

interface NewsItem {
  subject: string;
  message: string;
  author: string;
  time: number;
}


function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('zh-TW', {
    month: 'short', day: 'numeric',
  });
}

export function NewsList() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const result = await sendMessage('getNews', {});
      setNews(result.news as NewsItem[]);
    } catch { /* ignore */ }
    setLoading(false);
  };

  if (loading) {
    return <Card><div className="py-6 text-center text-sm text-gray-500">載入公告...</div></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>課程公告</CardTitle>
        <button onClick={load} className="text-xs text-e3-accent hover:underline">重新整理</button>
      </CardHeader>

      {news.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">近期沒有公告</p>
      ) : (
        <div className="space-y-3">
          {news.map((n, i) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-800">{n.subject}</p>
                <span className="text-xs text-gray-400 shrink-0">{formatTime(n.time)}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{n.author}</p>
              <p className="text-xs text-gray-600 mt-2 line-clamp-3">
                {stripHtml(n.message).slice(0, 150)}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
