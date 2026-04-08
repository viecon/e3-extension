import React, { useRef, useState } from 'react';
import { Card, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { sesskeyStorage, tokenStorage } from '@/lib/storage';
import { formatSize } from '@/lib/utils';
import { moodleUploadDraft, moodleUploadFile } from '@/lib/moodle';
import { sendMessage } from '@/lib/messages';

interface UploadDialogProps {
  assignmentId: number;
  assignmentName: string;
  onBack: () => void;
}

export function UploadDialog({ assignmentId, assignmentName, onBack }: UploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      setFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    setUploading(true);
    setError('');

    try {
      const sesskey = await sesskeyStorage.getValue();
      if (!sesskey) throw new Error('未登入。請先在瀏覽器登入 E3。');

      let itemid = 0;
      for (let i = 0; i < files.length; i++) {
        setProgress(`上傳中 [${i + 1}/${files.length}] ${files[i].name}`);
        const result = await moodleUploadDraft(sesskey, files[i], itemid);
        if (i === 0) itemid = result.itemid;
      }

      setProgress('提交作業中...');
      await sendMessage('uploadAndSubmit', { assignmentId, itemid });

      setDone(true);
      setProgress('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '上傳失敗');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <button onClick={onBack} className="text-xs text-e3-accent hover:underline mb-1">
            ← 返回
          </button>
          <CardTitle>{assignmentName}</CardTitle>
        </div>
      </CardHeader>

      {done ? (
        <div className="text-center py-6">
          <p className="text-sm font-bold text-e3-success">V</p>
          <p className="text-sm font-medium text-e3-success mt-2">作業提交成功！</p>
          <Button onClick={onBack} variant="secondary" size="sm" className="mt-4">
            返回
          </Button>
        </div>
      ) : (
        <>
          <div
            className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-e3-accent transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <p className="text-sm text-gray-500">點擊或拖放檔案</p>
            <p className="text-xs text-gray-400 mt-1">支援多個檔案</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {files.length > 0 && (
            <div className="mt-3 space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-md text-xs">
                  <span className="truncate text-gray-700">{f.name}</span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-gray-400">{formatSize(f.size)}</span>
                    <button
                      onClick={() => removeFile(i)}
                      className="text-gray-400 hover:text-e3-danger"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {progress && (
            <p className="text-xs text-e3-accent mt-2">{progress}</p>
          )}

          {error && (
            <p className="text-xs text-e3-danger mt-2">{error}</p>
          )}

          <Button
            onClick={handleUpload}
            loading={uploading}
            disabled={files.length === 0}
            size="sm"
            className="w-full mt-3"
          >
            上傳並提交 ({files.length} 個檔案)
          </Button>
        </>
      )}
    </Card>
  );
}
