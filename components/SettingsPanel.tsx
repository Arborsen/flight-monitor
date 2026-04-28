import { useState, useEffect } from 'react';
import { Mail } from 'lucide-react';
import { API, SMTP_PRESETS, inp, lbl } from '../constants';

export function SettingsPanel({ onToast }: { onToast: (msg: string, type: 'ok' | 'err') => void }) {
  const [cfg, setCfg] = useState<any>({});
  const [pass, setPass] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/config`).then(r => r.json()).then(d => setCfg(d));
  }, []);

  const set = (k: string, v: string) => setCfg((c: any) => ({ ...c, [k]: v }));

  const applyPreset = (name: string) => {
    const p = SMTP_PRESETS[name];
    if (p) setCfg((c: any) => ({ ...c, email_smtp: p.smtp, email_port: p.port }));
  };

  const save = async () => {
    setSaving(true);
    const body: any = { ...cfg };
    delete body.email_pass;
    if (pass) body.email_pass = pass;
    await fetch(`${API}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    setSaving(false);
    onToast('设置已保存', 'ok');
  };

  const testEmail = async () => {
    setTesting(true);
    try {
      const r = await fetch(`${API}/api/config/test-email`, { method: 'POST' });
      const d = await r.json();
      if (r.ok) onToast('测试邮件已发送，请检查收件箱', 'ok');
      else onToast(d.detail || '发送失败', 'err');
    } catch { onToast('连接失败', 'err'); }
    setTesting(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[12px] text-gray-400 mb-2">邮箱服务商快速选择</div>
        <div className="flex flex-wrap gap-2">
          {Object.keys(SMTP_PRESETS).map(name => (
            <button key={name} onClick={() => applyPreset(name)}
              className="text-sm px-3 py-1.5 border border-gray-200 text-gray-600 hover:border-wechat hover:text-wechat hover:bg-wechat/5 transition-colors rounded-md">
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>SMTP 服务器</label>
          <input value={cfg.email_smtp || ''} onChange={e => set('email_smtp', e.target.value)} className={inp} />
        </div>
        <div>
          <label className={lbl}>端口</label>
          <input value={cfg.email_port || ''} onChange={e => set('email_port', e.target.value)} className={inp} />
        </div>
      </div>

      <div>
        <label className={lbl}>发件邮箱</label>
        <input value={cfg.email_user || ''} onChange={e => set('email_user', e.target.value)}
          placeholder="your@email.com" className={inp + " placeholder-gray-400"} />
      </div>

      <div>
        <label className={lbl}>
          邮箱密码 / 授权码
          <span className="ml-2 text-gray-400 normal-case tracking-normal">（QQ/163需使用授权码）</span>
        </label>
        <input type="password" value={pass} onChange={e => setPass(e.target.value)}
          placeholder="留空则不修改" className={inp + " placeholder-gray-400"} />
      </div>

      <div>
        <label className={lbl}>
          默认收件邮箱
          <span className="ml-2 text-gray-400 normal-case tracking-normal">（路线未设专属邮箱时使用）</span>
        </label>
        <input value={cfg.email_to || ''} onChange={e => set('email_to', e.target.value)}
          placeholder="notify@email.com，多个用逗号分隔" className={inp + " placeholder-gray-400"} />
      </div>

      <div>
        <label className={lbl}>检查间隔（分钟）</label>
        <input type="number" value={cfg.check_interval || '30'} onChange={e => set('check_interval', e.target.value)}
          min="10" max="1440" className={inp + " w-32"} />
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={save} disabled={saving}
          className="flex-1 bg-wechat text-white text-sm py-3 hover:bg-wechat/90 transition-colors rounded-md">
          {saving ? '保存中...' : '保存设置'}
        </button>
        <button onClick={testEmail} disabled={testing}
          className="border border-gray-300 text-gray-500 text-sm px-5 py-3 hover:border-gray-400 hover:text-gray-600 transition-colors flex items-center gap-2 rounded-md">
          <Mail className="w-4 h-4" />
          {testing ? '发送中...' : '测试邮件'}
        </button>
      </div>
    </div>
  );
}
