import { useState, useEffect } from 'react';
import { Trash2, RefreshCw, ChevronDown, ChevronUp, Mail, Plane, TrendingDown, Clock, ToggleLeft, ToggleRight, Edit2 } from 'lucide-react';
import { API } from '../constants';
import { Sparkline } from './Panel';

export function RouteCard({ route, onDelete, onRefresh, onToggle, onEdit }: {
  route: any; onDelete: () => void; onRefresh: () => void; onToggle: () => void; onEdit: () => void
}) {
  const [history, setHistory] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [checking, setChecking] = useState(false);

  const loadHistory = async () => {
    const r = await fetch(`${API}/api/routes/${route.id}/history?limit=20`);
    const d = await r.json();
    setHistory(d);
  };

  useEffect(() => { if (expanded) loadHistory(); }, [expanded]);

  const triggerCheck = async () => {
    setChecking(true);
    await fetch(`${API}/api/routes/${route.id}/check`, { method: 'POST' });
    setTimeout(() => { setChecking(false); onRefresh(); }, 5000);
  };

  const price = route.latest_price;
  const isBelow = price !== null && price <= route.threshold;
  const isEnabled = route.enabled === 1;

  return (
    <div className={`relative border font-mono text-sm transition-all rounded-lg
      ${isEnabled ? 'border-gray-100 bg-white shadow-sm' : 'border-gray-200 bg-gray-50 opacity-60'}`}>

      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <Plane className="w-3.5 h-3.5 text-wechat shrink-0" />
          <span className="text-gray-800 font-medium truncate">{route.name}</span>
          {isBelow && (
            <span className="text-[10px] px-1.5 py-0.5 border border-wechat/30 text-wechat bg-wechat/5 tracking-wider shrink-0">LOW</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-2">
          <button onClick={onToggle} className="text-zinc-600 hover:text-wechat transition-colors p-1">
            {isEnabled ? <ToggleRight className="w-5 h-5 text-wechat" /> : <ToggleLeft className="w-5 h-5" />}
          </button>
          <button onClick={triggerCheck} disabled={checking}
            className="text-zinc-600 hover:text-wechat transition-colors p-1">
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin text-wechat' : ''}`} />
          </button>
          <button onClick={onEdit} className="text-zinc-600 hover:text-wechat transition-colors p-1">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={() => setExpanded(e => !e)}
            className="text-zinc-600 hover:text-wechat transition-colors p-1">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button onClick={onDelete} className="text-zinc-700 hover:text-red-400 transition-colors p-1">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <div className="text-[12px] text-gray-400 mb-1">航线</div>
          <div className="text-gray-800 font-medium">{route.dep_city} → {route.arr_city}</div>
          <div className="text-gray-400 text-xs mt-0.5">{route.dep_code} → {route.arr_code}</div>
        </div>
        <div>
          <div className="text-[12px] text-gray-400 mb-1">出发日期</div>
          <div className="text-gray-800">{route.dep_date}</div>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <div className="text-[12px] text-gray-400 mb-1">当前最低价</div>
          {price !== null ? (
            <div className={`text-2xl tabular-nums font-bold ${isBelow ? 'text-wechat' : 'text-gray-800'}`}>
              ¥{price.toFixed(0)}
            </div>
          ) : (
            <div className="text-gray-400 text-sm">待查询</div>
          )}
        </div>
      </div>

      <div className="px-4 pb-3 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <TrendingDown className="w-3.5 h-3.5 text-warn" />
          <span className="text-[12px] text-gray-400">目标价</span>
          <span className="text-warn tabular-nums">¥{route.threshold.toFixed(0)}</span>
          {route.last_checked && (
            <span className="ml-auto text-[11px] text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {route.last_checked.slice(5, 16)}
            </span>
          )}
        </div>
        {route.email_to && (
          <div className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[12px] text-gray-400">专属邮箱</span>
            <span className="text-gray-600 text-xs truncate">{route.email_to}</span>
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="text-[12px] text-gray-400 mb-2">价格历史</div>
          {history.length === 0 ? (
            <div className="text-gray-400 text-sm">暂无历史数据</div>
          ) : (
            <>
              <div className="mb-3">
                <Sparkline data={history.slice().reverse().map((h: any) => h.price)} />
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {history.map((h: any) => (
                  <div key={h.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{h.scraped_at.slice(5, 16)}</span>
                    <span className={h.price <= route.threshold ? 'text-wechat' : 'text-gray-700'}>
                      ¥{h.price?.toFixed(0)}
                    </span>
                    {h.airline && <span className="text-gray-400 truncate max-w-[100px]">{h.airline}</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
