import { useEffect } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

export function Panel({ label, icon: Icon, children, className = '' }: {
  label: string; icon: any; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`bg-white border border-gray-100 rounded-lg shadow-sm ${className}`}>
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-100">
        <Icon className="w-3.5 h-3.5 text-wechat" />
        <span className="text-[13px] font-medium text-gray-700">{label}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data), min = Math.min(...data), r = max - min || 1;
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * 160},${24 - ((v - min) / r) * 24}`
  ).join(' ');
  return (
    <svg width={160} height={24}>
      <polyline points={pts} fill="none" stroke="#07C160" strokeWidth="1.5" />
    </svg>
  );
}

export function Toast({ msg, type, onClose }: { msg: string; type: 'ok' | 'err'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 border font-mono text-sm rounded-sm shadow-xl
      ${type === 'ok' ? 'border-wechat/30 bg-white text-wechat' : 'border-err/30 bg-white text-err'}`}
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
      {type === 'ok' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
      {msg}
    </div>
  );
}
