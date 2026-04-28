"""
Flight Price Monitor - Backend Service
Uses Playwright for reliable price scraping from Ctrip.
"""

import sqlite3
import json
import smtplib
import threading
import time
import random
import re
import logging
import asyncio
import os
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from contextlib import contextmanager

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import uvicorn

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Flight Monitor API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DB_PATH = os.environ.get("DB_PATH", "data/flights.db")

# ── Database ──────────────────────────────────────────────────────────────────
def init_db():
    with get_db() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS routes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            dep_city TEXT NOT NULL,
            dep_code TEXT NOT NULL,
            arr_city TEXT NOT NULL,
            arr_code TEXT NOT NULL,
            dep_date TEXT NOT NULL,
            threshold REAL NOT NULL,
            email_to TEXT DEFAULT '',
            enabled INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS price_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            route_id INTEGER NOT NULL,
            price REAL,
            airline TEXT,
            flight_no TEXT,
            dep_time TEXT,
            arr_time TEXT,
            scraped_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY(route_id) REFERENCES routes(id)
        );

        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            route_id INTEGER NOT NULL,
            price REAL,
            threshold REAL,
            sent_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY(route_id) REFERENCES routes(id)
        );

        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        """)
        # Add email_to column if upgrading from old schema
        try:
            conn.execute("ALTER TABLE routes ADD COLUMN email_to TEXT DEFAULT ''")
        except Exception:
            pass  # column already exists

        defaults = {
            "email_smtp": "smtp.qq.com",
            "email_port": "465",
            "email_user": "",
            "email_pass": "",
            "email_to": "",
            "check_interval": "30",
        }
        for k, v in defaults.items():
            conn.execute("INSERT OR IGNORE INTO config(key,value) VALUES(?,?)", (k, v))

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()

# ── City code map ─────────────────────────────────────────────────────────────
CITY_CODES = {
    # 国内
    "北京": "BJS", "上海": "SHA", "广州": "CAN", "深圳": "SZX",
    "成都": "CTU", "重庆": "CKG", "杭州": "HGH", "武汉": "WUH",
    "西安": "SIA", "南京": "NKG", "天津": "TSN", "青岛": "TAO",
    "厦门": "XMN", "昆明": "KMG", "大连": "DLC", "沈阳": "SHE",
    "哈尔滨": "HRB", "长沙": "CSX", "郑州": "CGO", "济南": "TNA",
    "贵阳": "KWE", "南宁": "NNG", "海口": "HAK", "三亚": "SYX",
    "乌鲁木齐": "URC", "兰州": "LHW", "西宁": "XNN", "银川": "INC",
    "呼和浩特": "HET", "太原": "TYN", "石家庄": "SJW", "合肥": "HFE",
    "南昌": "KHN", "福州": "FOC", "温州": "WNZ", "宁波": "NGB",
    # 亚洲
    "东京": "TYO", "大阪": "OSA", "名古屋": "NGO", "札幌": "SPK",
    "首尔": "SEL", "釜山": "PUS", "曼谷": "BKK", "清迈": "CNX",
    "新加坡": "SIN", "吉隆坡": "KUL", "马尼拉": "MNL", "河内": "HAN",
    "胡志明市": "SGN", "雅加达": "JKT", "巴厘岛": "DPS", "金边": "PNH",
    "暹粒": "REP", "东京成田": "NRT", "香港": "HKG", "澳门": "MFM",
    "台北": "TPE", "迪拜": "DXB", "新德里": "DEL", "孟买": "BOM",
    # 欧洲
    "伦敦": "LON", "巴黎": "PAR", "法兰克福": "FRA", "阿姆斯特丹": "AMS",
    "罗马": "ROM", "米兰": "MIL", "马德里": "MAD", "巴塞罗那": "BCN",
    "苏黎世": "ZRH", "维也纳": "VIE", "莫斯科": "MOW", "伊斯坦布尔": "IST",
    "赫尔辛基": "HEL",
    # 北美
    "纽约": "NYC", "洛杉矶": "LAX", "旧金山": "SFO", "西雅图": "SEA",
    "温哥华": "YVR", "多伦多": "YYZ", "芝加哥": "ORD",
    # 大洋洲
    "悉尼": "SYD", "墨尔本": "MEL", "奥克兰": "AKL",
}

# ── Ctrip Scraper (携程低价日历 API) ─────────────────────────────────────────
def _parse_ctrip_date(date_str: str) -> str:
    """将携程 '/Date(1778688000000+0800)/' 格式转为 'YYYY-MM-DD'"""
    m = re.search(r'/Date\((\d+)', date_str)
    if not m:
        return ""
    ts = int(m.group(1)) / 1000
    from datetime import timezone
    tz = timezone(timedelta(hours=8))
    return datetime.fromtimestamp(ts, tz=tz).strftime("%Y-%m-%d")


async def _scrape_ctrip_async(dep_code: str, arr_code: str, dep_date: str) -> dict | None:
    from playwright.async_api import async_playwright

    page_url = (
        f"https://flights.ctrip.com/online/list/oneway-{dep_code.lower()}-{arr_code.lower()}"
        f"?depdate={dep_date}&cabin=Y&adult=1&child=0&infant=0"
    )
    calendar_body = None

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage",
                  "--disable-blink-features=AutomationControlled"],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            locale="zh-CN",
            viewport={"width": 1440, "height": 900},
        )
        page = await context.new_page()

        async def on_response(response):
            nonlocal calendar_body
            try:
                if "LowestPrice" in response.url and response.status == 200:
                    text = await response.text()
                    if len(text) > 500 and calendar_body is None:
                        calendar_body = text
            except Exception:
                pass

        page.on("response", on_response)

        try:
            await page.goto(page_url, timeout=60000, wait_until="domcontentloaded")
        except Exception as e:
            log.warning(f"Ctrip goto warning: {e}")

        for _ in range(12):
            await asyncio.sleep(2)
            if calendar_body:
                break

        await browser.close()

    if not calendar_body:
        return None

    try:
        data = json.loads(calendar_body)
        for item in data.get("priceList", []):
            item_date = _parse_ctrip_date(item.get("departDate", ""))
            if item_date == dep_date:
                price = item.get("price", 0)
                if isinstance(price, (int, float)) and price > 0:
                    return {
                        "price": float(price),
                        "airline": "携程最低价",
                        "flight_no": "",
                        "dep_time": "",
                        "arr_time": "",
                    }
    except Exception as e:
        log.error(f"Failed to parse calendar data: {e}")

    return None


def get_flight_price(dep_code: str, arr_code: str, dep_date: str) -> dict | None:
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(_scrape_ctrip_async(dep_code, arr_code, dep_date))
        loop.close()
        if result:
            log.info(f"Price: {dep_code}→{arr_code} {dep_date} ¥{result['price']:.0f} ({result['airline']})")
        else:
            log.warning(f"No price found: {dep_code}→{arr_code} {dep_date}")
        return result
    except Exception as e:
        log.error(f"Scraper error: {e}")
        return None

# ── Email ─────────────────────────────────────────────────────────────────────
def get_config() -> dict:
    with get_db() as conn:
        rows = conn.execute("SELECT key, value FROM config").fetchall()
        return {r["key"]: r["value"] for r in rows}

def send_email_alert(route: dict, price: float, threshold: float) -> bool:
    cfg = get_config()
    if not cfg.get("email_user"):
        log.warning("Email sender not configured, skipping alert")
        return False

    # Use route-specific email_to if set, otherwise fall back to global
    recipient = (route.get("email_to") or "").strip() or cfg.get("email_to", "").strip()
    if not recipient:
        log.warning(f"No recipient email for route {route.get('name')}, skipping alert")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"✈️ 机票降价提醒：{route['dep_city']}→{route['arr_city']} ¥{price:.0f}"
        msg["From"] = cfg["email_user"]
        msg["To"] = recipient

        html = f"""
        <html><body style="font-family:sans-serif;background:#f5f5f5;padding:20px">
        <div style="max-width:500px;margin:0 auto;background:white;border-radius:8px;
                    padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
          <h2 style="color:#1a73e8;margin-top:0">✈️ 机票降价提醒</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px;color:#666">航线</td>
                <td style="padding:8px;font-weight:bold">
                  {route['dep_city']} ({route['dep_code']}) → {route['arr_city']} ({route['arr_code']})
                </td></tr>
            <tr style="background:#f9f9f9">
                <td style="padding:8px;color:#666">出发日期</td>
                <td style="padding:8px;font-weight:bold">{route['dep_date']}</td></tr>
            <tr><td style="padding:8px;color:#666">当前最低价</td>
                <td style="padding:8px;font-size:28px;font-weight:bold;color:#e53935">
                  ¥{price:.0f}
                </td></tr>
            <tr style="background:#f9f9f9">
                <td style="padding:8px;color:#666">你的目标价</td>
                <td style="padding:8px;font-weight:bold;color:#43a047">¥{threshold:.0f}</td></tr>
          </table>
          <div style="margin-top:20px;padding:12px;background:#e8f5e9;border-radius:6px;
                      border-left:4px solid #43a047">
            <strong style="color:#2e7d32">💡 当前价格已低于目标价，快去抢票！</strong>
          </div>
          <p style="margin-top:16px">
            <a href="https://flights.ctrip.com/online/list/oneway-{route['dep_code']}-{route['arr_code']}?depdate={route['dep_date']}"
               style="display:inline-block;background:#1a73e8;color:white;padding:10px 20px;
                      border-radius:6px;text-decoration:none;font-weight:bold">
              查看携程机票 →
            </a>
          </p>
          <p style="color:#aaa;font-size:11px;margin-bottom:0">
            此邮件由机票价格监测助手自动发送 · {datetime.now().strftime('%Y-%m-%d %H:%M')}
          </p>
        </div></body></html>
        """
        msg.attach(MIMEText(html, "html", "utf-8"))

        port = int(cfg.get("email_port", 465))
        smtp_host = cfg.get("email_smtp", "smtp.qq.com")
        if port == 465:
            server = smtplib.SMTP_SSL(smtp_host, port, timeout=15)
        else:
            server = smtplib.SMTP(smtp_host, port, timeout=15)
            server.starttls()
        server.login(cfg["email_user"], cfg["email_pass"])
        server.sendmail(cfg["email_user"], recipient.split(","), msg.as_string())
        server.quit()
        log.info(f"Alert email sent to {recipient}")
        return True
    except Exception as e:
        log.error(f"Failed to send email: {e}")
        return False

# ── Monitor loop ──────────────────────────────────────────────────────────────
_checking: set = set()   # route_ids currently being checked

def get_historical_min_price(route_id: int) -> float | None:
    """Return the lowest price ever recorded for this route (excluding current check)."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT MIN(price) as min_price FROM price_history WHERE route_id=?",
            (route_id,)
        ).fetchone()
        return row["min_price"] if row and row["min_price"] is not None else None

def check_route(route: dict):
    route_id = route["id"]
    if route_id in _checking:
        return
    _checking.add(route_id)
    try:
        result = get_flight_price(route["dep_code"], route["arr_code"], route["dep_date"])
        if not result:
            return

        price = result["price"]

        # Fetch historical min BEFORE inserting current price
        prev_min = get_historical_min_price(route_id)

        with get_db() as conn:
            conn.execute(
                "INSERT INTO price_history(route_id,price,airline,flight_no,dep_time,arr_time) "
                "VALUES(?,?,?,?,?,?)",
                (route_id, price, result["airline"], result["flight_no"],
                 result["dep_time"], result["arr_time"])
            )

        # Send alert only when:
        #   1. price is below the user's target threshold, AND
        #   2. price is strictly lower than all previously recorded prices
        #      (or there is no history yet — first time below threshold)
        is_below_threshold = price <= route["threshold"]
        is_new_low = (prev_min is None) or (price < prev_min)

        if is_below_threshold and is_new_low:
            sent = send_email_alert(route, price, route["threshold"])
            if sent:
                with get_db() as conn:
                    conn.execute(
                        "INSERT INTO alerts(route_id,price,threshold) VALUES(?,?,?)",
                        (route_id, price, route["threshold"])
                    )
                log.info(f"New low price alert sent: route {route_id} ¥{price:.0f} (prev min: {prev_min})")
        else:
            if is_below_threshold:
                log.info(f"Price ¥{price:.0f} below threshold but not a new low (prev min ¥{prev_min:.0f}), skipping alert")
    finally:
        _checking.discard(route_id)

def monitor_loop():
    while True:
        try:
            cfg = get_config()
            interval = int(cfg.get("check_interval", 30)) * 60
        except Exception:
            interval = 1800

        try:
            with get_db() as conn:
                routes = conn.execute("SELECT * FROM routes WHERE enabled=1").fetchall()
            for route in routes:
                try:
                    check_route(dict(route))
                    time.sleep(random.uniform(5, 12))
                except Exception as e:
                    log.error(f"Error checking route {route['id']}: {e}")
        except Exception as e:
            log.error(f"Monitor loop error: {e}")

        log.info(f"Next check in {interval // 60} minutes")
        time.sleep(interval)

# ── API Routes ────────────────────────────────────────────────────────────────
class RouteCreate(BaseModel):
    name: str
    dep_city: str
    dep_code: str
    arr_city: str
    arr_code: str
    dep_date: str
    threshold: float
    email_to: Optional[str] = ""

class RouteUpdate(BaseModel):
    threshold: Optional[float] = None
    enabled: Optional[int] = None
    dep_date: Optional[str] = None
    email_to: Optional[str] = None

class ConfigUpdate(BaseModel):
    email_smtp: Optional[str] = None
    email_port: Optional[str] = None
    email_user: Optional[str] = None
    email_pass: Optional[str] = None
    email_to: Optional[str] = None
    check_interval: Optional[str] = None

@app.get("/api/routes")
def list_routes():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM routes ORDER BY created_at DESC").fetchall()
        result = []
        for r in rows:
            d = dict(r)
            latest = conn.execute(
                "SELECT price, scraped_at FROM price_history "
                "WHERE route_id=? ORDER BY scraped_at DESC LIMIT 1",
                (r["id"],)
            ).fetchone()
            d["latest_price"] = latest["price"] if latest else None
            d["last_checked"] = latest["scraped_at"] if latest else None
            d["is_checking"] = r["id"] in _checking
            result.append(d)
        return result

@app.post("/api/routes")
def create_route(body: RouteCreate):
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO routes(name,dep_city,dep_code,arr_city,arr_code,dep_date,threshold,email_to) "
            "VALUES(?,?,?,?,?,?,?,?)",
            (body.name, body.dep_city, body.dep_code, body.arr_city,
             body.arr_code, body.dep_date, body.threshold, body.email_to or "")
        )
        return {"id": cur.lastrowid, "message": "Route created"}

@app.put("/api/routes/{route_id}")
def update_route(route_id: int, body: RouteUpdate):
    with get_db() as conn:
        if body.threshold is not None:
            conn.execute("UPDATE routes SET threshold=? WHERE id=?", (body.threshold, route_id))
        if body.enabled is not None:
            conn.execute("UPDATE routes SET enabled=? WHERE id=?", (body.enabled, route_id))
        if body.dep_date is not None:
            conn.execute("UPDATE routes SET dep_date=? WHERE id=?", (body.dep_date, route_id))
        if body.email_to is not None:
            conn.execute("UPDATE routes SET email_to=? WHERE id=?", (body.email_to, route_id))
    return {"message": "Updated"}

@app.delete("/api/routes/{route_id}")
def delete_route(route_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM price_history WHERE route_id=?", (route_id,))
        conn.execute("DELETE FROM alerts WHERE route_id=?", (route_id,))
        conn.execute("DELETE FROM routes WHERE id=?", (route_id,))
    return {"message": "Deleted"}

@app.get("/api/routes/{route_id}/history")
def get_history(route_id: int, limit: int = 50):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM price_history WHERE route_id=? ORDER BY scraped_at DESC LIMIT ?",
            (route_id, limit)
        ).fetchall()
        return [dict(r) for r in rows]

@app.post("/api/routes/{route_id}/check")
def manual_check(route_id: int):
    with get_db() as conn:
        route = conn.execute("SELECT * FROM routes WHERE id=?", (route_id,)).fetchone()
    if not route:
        raise HTTPException(404, "Route not found")
    t = threading.Thread(target=check_route, args=(dict(route),), daemon=True)
    t.start()
    return {"message": "Check triggered"}

@app.get("/api/config")
def get_config_api():
    cfg = get_config()
    if cfg.get("email_pass"):
        cfg["email_pass"] = "••••••••"
    return cfg

@app.put("/api/config")
def update_config(body: ConfigUpdate):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    with get_db() as conn:
        for k, v in updates.items():
            conn.execute("INSERT OR REPLACE INTO config(key,value) VALUES(?,?)", (k, v))
    return {"message": "Config updated"}

@app.post("/api/config/test-email")
def test_email():
    cfg = get_config()
    if not cfg.get("email_user") or not cfg.get("email_to"):
        raise HTTPException(400, "Email not configured")
    try:
        msg = MIMEText(
            "这是一封来自机票价格监测助手的测试邮件，说明你的邮箱配置正确！",
            "plain", "utf-8"
        )
        msg["Subject"] = "✈️ 机票监测 - 邮箱测试"
        msg["From"] = cfg["email_user"]
        msg["To"] = cfg["email_to"]
        port = int(cfg.get("email_port", 465))
        smtp_host = cfg.get("email_smtp", "smtp.qq.com")
        if port == 465:
            server = smtplib.SMTP_SSL(smtp_host, port, timeout=15)
        else:
            server = smtplib.SMTP(smtp_host, port, timeout=15)
            server.starttls()
        server.login(cfg["email_user"], cfg["email_pass"])
        server.sendmail(cfg["email_user"], cfg["email_to"].split(","), msg.as_string())
        server.quit()
        return {"message": "Test email sent successfully"}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/api/alerts")
def list_alerts(limit: int = 20):
    with get_db() as conn:
        rows = conn.execute("""
            SELECT a.*, r.name, r.dep_city, r.arr_city, r.dep_date, r.dep_code, r.arr_code
            FROM alerts a JOIN routes r ON a.route_id = r.id
            ORDER BY a.sent_at DESC LIMIT ?
        """, (limit,)).fetchall()
        return [dict(r) for r in rows]

@app.get("/api/cities")
def list_cities():
    return CITY_CODES

@app.get("/api/health")
def health():
    return {"status": "ok", "time": datetime.now().isoformat()}

# ── Serve frontend static files (for cloud deployment) ───────────────────────
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/", include_in_schema=False)
    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str = ""):
        index = os.path.join(STATIC_DIR, "index.html")
        if os.path.exists(index):
            return FileResponse(index)
        return {"error": "Frontend not built"}

# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
def startup():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    init_db()
    t = threading.Thread(target=monitor_loop, daemon=True)
    t.start()
    log.info("Monitor thread started")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 9400))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
