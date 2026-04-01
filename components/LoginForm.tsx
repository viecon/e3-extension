import React, { useState } from 'react';
import { Button } from './ui/Button';
import { sendMessage } from '@/lib/messages';

interface LoginFormProps {
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [token, setToken] = useState('');
  const [useToken, setUseToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckSession = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await sendMessage('checkSession', undefined);
      if (result.loggedIn) {
        onSuccess();
      } else {
        setError(result.error || '請先在瀏覽器登入 E3');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '連線失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleTokenLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await sendMessage('loginWithToken', { token });
      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || 'Token 無效');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '連線失敗');
    } finally {
      setLoading(false);
    }
  };

  const openE3 = () => {
    chrome.tabs.create({ url: 'https://e3p.nycu.edu.tw/my/' });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-bold text-e3-primary">E3 助手</h1>
        <p className="text-sm text-gray-500 mt-1">NYCU E3 LMS</p>
      </div>

      <div className="flex gap-2 text-xs">
        <button
          className={`flex-1 py-1.5 rounded-md transition-colors ${!useToken ? 'bg-e3-accent text-white' : 'bg-gray-100 text-gray-600'}`}
          onClick={() => setUseToken(false)}
        >
          自動偵測
        </button>
        <button
          className={`flex-1 py-1.5 rounded-md transition-colors ${useToken ? 'bg-e3-accent text-white' : 'bg-gray-100 text-gray-600'}`}
          onClick={() => setUseToken(true)}
        >
          手動 Token
        </button>
      </div>

      {useToken ? (
        <>
          <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
            <p className="font-medium mb-1">取得 Token 方式：</p>
            <ol className="list-decimal ml-4 space-y-0.5">
              <li>登入 E3 後到個人設定</li>
              <li>安全金鑰 → 建立 Token</li>
              <li>複製貼上到下方</li>
            </ol>
          </div>
          <input
            type="password"
            placeholder="Moodle Web Service Token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTokenLogin()}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-e3-accent/50"
          />
          <Button onClick={handleTokenLogin} loading={loading} disabled={!token} className="w-full">
            使用 Token 登入
          </Button>
        </>
      ) : (
        <>
          <div className="text-xs text-gray-500 bg-blue-50 rounded-lg p-3 space-y-2">
            <p>E3 使用交大單一入口 (SSO + 二階段驗證) 登入。</p>
            <p className="font-medium">使用步驟：</p>
            <ol className="list-decimal ml-4 space-y-0.5">
              <li>點擊下方按鈕開啟 E3 並登入</li>
              <li>登入成功後回到這裡</li>
              <li>點「偵測登入狀態」</li>
            </ol>
          </div>

          <Button onClick={openE3} variant="secondary" className="w-full">
            開啟 E3 登入
          </Button>

          <Button onClick={handleCheckSession} loading={loading} className="w-full">
            偵測登入狀態
          </Button>
        </>
      )}

      {error && (
        <p className="text-xs text-e3-danger bg-red-50 rounded-lg p-2">{error}</p>
      )}
    </div>
  );
}
