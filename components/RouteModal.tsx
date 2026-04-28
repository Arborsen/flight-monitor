import { useState } from 'react';
import { X } from 'lucide-react';
import { API, CITY_CODES, inp, lbl } from '../constants';
import { CityPicker } from './CityPicker';

export function RouteModal({ existing, onClose, onSaved }: {
  existing?: any; onClose: () => void; onSaved: () => void
}) {
  const isEdit = !!existing;
  const [form, setForm] = useState({
    dep_city: existing?.dep_city || '北京',
    arr_city: existing?.arr_city || '成都',
    dep_date: existing?.dep_date || '',
    threshold: String(existing?.threshold || '800'),
    name: existing?.name || '',
    email_to: existing?.email_to || '',
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.dep_date) { alert('请选择出发日期'); return; }
    const dep_code = CITY_CODES[form.dep_city] || form.dep_city;
    const arr_code = CITY_CODES[form.arr_city] || form.arr_city;
    const name = form.name || `${form.dep_city}→${form.arr_city} ${form.dep_date}`;

    if (isEdit) {
      await fetch(`${API}/api/routes/${existing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dep_date: form.dep_date,
          threshold: parseFloat(form.threshold),
          email_to: form.email_to,
        })
      });
    } else {
      await fetch(`${API}/api/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, dep_city: form.dep_city, dep_code, arr_city: form.arr_city, arr_code, dep_date: form.dep_date, threshold: parseFloat(form.threshold), email_to: form.email_to })
      });
    }
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-40 font-mono p-0 sm:p-4">
      <div className="relative border border-gray-200 bg-white w-full sm:w-[460px] sm:rounded-xl max-h-[92vh] overflow-y-auto"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <span className="text-[15px] font-medium text-gray-800">
            {isEdit ? '编辑路线' : '添加监测路线'}
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>出发城市</label>
              <CityPicker value={form.dep_city} onChange={v => set('dep_city', v)} disabled={isEdit} />
            </div>
            <div>
              <label className={lbl}>到达城市</label>
              <CityPicker value={form.arr_city} onChange={v => set('arr_city', v)} disabled={isEdit} />
            </div>
          </div>

          <div>
            <label className={lbl}>出发日期</label>
            <input type="date" value={form.dep_date} onChange={e => set('dep_date', e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className={inp} />
          </div>

          <div>
            <label className={lbl}>目标价格（低于此价格时通知）</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-base">¥</span>
              <input type="number" value={form.threshold} onChange={e => set('threshold', e.target.value)}
                className={inp} />
            </div>
          </div>

          <div>
            <label className={lbl}>
              专属收件邮箱
              <span className="ml-2 text-gray-400 normal-case tracking-normal">（留空则使用全局默认）</span>
            </label>
            <input type="email" value={form.email_to} onChange={e => set('email_to', e.target.value)}
              placeholder="notify@example.com，多个用逗号分隔"
              className={inp + " placeholder-gray-400"} />
          </div>

          {!isEdit && (
            <div>
              <label className={lbl}>备注名称（可选）</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="如：春节回家"
                className={inp + " placeholder-gray-400"} />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-500 text-sm py-3 hover:border-gray-400 hover:text-gray-600 transition-colors rounded-md">
              取消
            </button>
            <button onClick={submit}
              className="flex-1 bg-wechat text-white text-sm py-3 hover:bg-wechat/90 transition-colors rounded-md">
              {isEdit ? '保存修改' : '添加路线'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
