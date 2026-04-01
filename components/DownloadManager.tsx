import React, { useState } from 'react';
import { Card, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { sendMessage } from '@/lib/messages';

interface FileItem {
  sectionName: string;
  moduleName: string;
  filename: string;
  fileurl: string;
  filesize: number;
  mimetype?: string;
}

interface DownloadManagerProps {
  courseId: number;
  courseName: string;
  onBack: () => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function DownloadManager({ courseId, courseName, onBack }: DownloadManagerProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const result = await sendMessage('getCourseFiles', {
        courseid: courseId,
        typeFilter: typeFilter.length > 0 ? typeFilter : undefined,
      });
      setFiles(result.files as FileItem[]);
      setLoaded(true);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const downloadAll = async () => {
    setDownloading(true);
    try {
      await sendMessage('downloadCourseFiles', {
        courseid: courseId,
        typeFilter: typeFilter.length > 0 ? typeFilter : undefined,
      });
    } catch {
      // ignore
    } finally {
      setDownloading(false);
    }
  };

  const toggleFilter = (ext: string) => {
    setTypeFilter((prev) =>
      prev.includes(ext) ? prev.filter((f) => f !== ext) : [...prev, ext],
    );
    setLoaded(false);
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <button onClick={onBack} className="text-xs text-e3-accent hover:underline mb-1">
            ← 返回
          </button>
          <CardTitle>{courseName}</CardTitle>
        </div>
      </CardHeader>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {['pdf', 'pptx', 'docx', 'zip'].map((ext) => (
          <button
            key={ext}
            onClick={() => toggleFilter(ext)}
            className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
              typeFilter.includes(ext)
                ? 'bg-e3-accent text-white border-e3-accent'
                : 'bg-white text-gray-500 border-gray-200 hover:border-e3-accent'
            }`}
          >
            .{ext}
          </button>
        ))}
      </div>

      {!loaded ? (
        <Button onClick={loadFiles} loading={loading} size="sm" className="w-full">
          載入檔案列表
        </Button>
      ) : (
        <>
          <div className="text-xs text-gray-500 mb-2">共 {files.length} 個檔案</div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between p-2 text-xs bg-gray-50 rounded-md">
                <span className="truncate text-gray-700">{f.filename}</span>
                <span className="text-gray-400 shrink-0 ml-2">{formatSize(f.filesize)}</span>
              </div>
            ))}
          </div>

          <Button
            onClick={downloadAll}
            loading={downloading}
            size="sm"
            className="w-full mt-3"
          >
            全部下載
          </Button>
        </>
      )}
    </Card>
  );
}
