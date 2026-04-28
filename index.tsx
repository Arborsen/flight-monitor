import { useState, useEffect, useCallback } from 'react';
import { PlusCircle, Bell, Settings, Activity, Plane } from 'lucide-react';
import { API } from './constants';
import { Panel, Toast } from './components/Panel';
import { RouteModal } from './components/RouteModal';
import { RouteCard } from './components/RouteCard';
import { SettingsPanel } from './components/SettingsPanel';

export default function FlightMonitor() {
  const [tab, setTab] = useState<'routes' | 'alerts' | 'settings'>('routes');
  const [routes, setRoutes] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editRoute, setEditRoute] = useState<any>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [connected, setConnected] = useState(false);

  const showToast = (msg: string, type: 'ok' | 'err') => setToast({ msg, type });

  const loadRoutes = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/routes`);
      setRoutes(await r.json());
      setConnected(true);
    } catch { setConnected(false); }
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/alerts`);
      setAlerts(await r.json());
    } catch {}
  }, []);

  useEffect(() => {
    loadRoutes();
    loadAlerts();
    const id = setInterval(() => { loadRoutes(); loadAlerts(); }, 15000);
    return () => clearInterval(id);
  }, []);

  const deleteRoute = async (id: number) => {
    if (!confirm('确认删除此路线？')) return;
    await fetch(`${API}/api/routes/${id}`, { method: 'DELETE' });
    loadRoutes();
    showToast('路线已删除', 'ok');
  };

  const toggleRoute = async (route: any) => {
    await fetch(`${API}/api/routes/${route.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: route.enabled === 1 ? 0 : 1 })
    });
    loadRoutes();
  };

  const activeRoutes = routes.filter(r => r.enabled === 1);
  const alertRoutes = routes.filter(r => r.latest_price !== null && r.latest_price <= r.threshold);

  const tabs = [
    { key: 'routes', label: '监测路线', icon: Activity },
    { key: 'alerts', label: '通知记录', icon: Bell },
    { key: 'settings', label: '邮箱设置', icon: Settings },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50 font-mono text-sm flex flex-col text-gray-800">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {showAdd && <RouteModal onClose={() => setShowAdd(false)} onSaved={loadRoutes} />}
      {editRoute && <RouteModal existing={editRoute} onClose={() => setEditRoute(null)} onSaved={loadRoutes} />}

      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 sticky top-0 bg-white z-30">
        <div className="flex items-center gap-2.5">
          <Plane className="w-4 h-4 text-wechat" />
          <span className="text-[14px] font-semibold text-gray-800">Flight Monitor</span>
        </div>
        <div className="flex items-center gap-3">
          {alertRoutes.length > 0 && (
            <span className="text-[11px] px-2.5 py-0.5 border-none bg-wechat/10 text-wechat rounded-full">
              {alertRoutes.length} 条低价
            </span>
          )}
          <span className={`flex items-center gap-1.5 text-[11px] ${connected ? 'text-wechat' : 'text-err'}`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-wechat' : 'bg-err'}`} />
            {connected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      <div className="flex border-b border-gray-200 sticky top-[49px] bg-white z-20">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-3 text-[11px] tracking-wider uppercase transition-colors border-b-2
              ${tab === key ? 'border-wechat text-wechat' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.slice(0, 2)}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
        {tab === 'routes' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-xs">
                共 {routes.length} 条，{activeRoutes.length} 条监测中
              </span>
              <button onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 bg-wechat text-white text-sm px-4 py-2.5 hover:bg-wechat/90 transition-colors rounded-md active:bg-wechat/80 border-none">
                <PlusCircle className="w-4 h-4" />
                添加路线
              </button>
            </div>
            {routes.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Plane className="w-10 h-10 mx-auto mb-4 text-gray-300" />
                <div className="text-base">暂无监测路线</div>
                <div className="text-xs mt-1">点击「添加路线」开始监测</div>
              </div>
            ) : (
              routes.map(r => (
                <RouteCard key={r.id} route={r}
                  onDelete={() => deleteRoute(r.id)}
                  onRefresh={loadRoutes}
                  onToggle={() => toggleRoute(r)}
                  onEdit={() => setEditRoute(r)} />
              ))
            )}
          </div>
        )}

        {tab === 'alerts' && (
          <Panel label="通知记录" icon={Bell}>
            {alerts.length === 0 ? (
              <div className="text-gray-400 text-center py-8">暂无通知记录</div>
            ) : (
              <div className="space-y-2">
                {alerts.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between border border-wechat/10 px-4 py-3 bg-wechat/5 rounded-lg">
                    <div>
                      <div className="text-wechat font-medium">{a.dep_city} → {a.arr_city}</div>
                      <div className="text-gray-500 text-xs mt-0.5">{a.dep_date}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-wechat tabular-nums text-lg font-bold">¥{a.price?.toFixed(0)}</div>
                      <div className="text-gray-400 text-xs">目标¥{a.threshold?.toFixed(0)} · {a.sent_at?.slice(5, 16)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}

        {tab === 'settings' && (
          <Panel label="邮箱通知设置" icon={Settings}>
            <SettingsPanel onToast={showToast} />
          </Panel>
        )}
      </div>
    </div>
  );
}
