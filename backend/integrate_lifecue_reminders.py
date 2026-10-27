from pathlib import Path
import shutil, py_compile
p=Path('main.py'); backup=Path('main_before_reminders.py')
if not p.is_file() or not backup.is_file(): raise SystemExit('STOP: backend folder mein main.py aur main_before_reminders.py hone chahiye.')
s=p.read_text(encoding='utf-8')
if 'VAPID_PUBLIC_KEY' in s or '_send_due_reminders' in s: raise SystemExit('STOP: reminder code pehle se hai; koi change nahi kiya.')
anchors=['import os\n','from database import db\n','    time: str = "6:00 PM"\n\n\nclass TaskUpdate','        "time": document.get("time", "6:00 PM"),\n        "completed": bool(document.get("completed", False)),','        "time": task.time.strip() or "6:00 PM",\n        "completed": False,','\n\n# ================= HABITS API =================']
if any(s.count(a)!=1 for a in anchors): raise SystemExit('STOP: expected code structure match nahi hua; koi change nahi kiya.')
snapshot=Path('main_before_reminders_script.py')
if not snapshot.exists(): shutil.copy2(p,snapshot)
s=s.replace('import os\n','import os\nimport time\nimport threading\n',1)
s=s.replace('from database import db\n','''from database import db

try:
    from pywebpush import webpush, WebPushException
except ImportError:
    webpush = None
    WebPushException = Exception

VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_CLAIMS_EMAIL = os.getenv("VAPID_CLAIMS_EMAIL", "mailto:admin@example.com")
''',1)
s=s.replace('    time: str = "6:00 PM"\n\n\nclass TaskUpdate','    time: str = "6:00 PM"\n    due_date: str | None = None\n    reminder_at: str | None = None\n    repeat: str = "Never"\n\n\nclass TaskUpdate',1)
s=s.replace('        "time": document.get("time", "6:00 PM"),\n        "completed": bool(document.get("completed", False)),','        "time": document.get("time", "6:00 PM"),\n        "due_date": document.get("due_date"),\n        "reminder_at": document.get("reminder_at"),\n        "repeat": document.get("repeat", "Never"),\n        "completed": bool(document.get("completed", False)),',1)
s=s.replace('        "time": task.time.strip() or "6:00 PM",\n        "completed": False,','        "time": task.time.strip() or "6:00 PM",\n        "due_date": task.due_date,\n        "reminder_at": task.reminder_at,\n        "repeat": task.repeat if task.repeat in {"Never", "Daily", "Weekly"} else "Never",\n        "reminder_sent_for": None,\n        "completed": False,',1)
block='''

# ================= TASK REMINDERS & PUSH NOTIFICATIONS =================
class TaskReminderUpdate(BaseModel):
    due_date: str | None = None
    reminder_at: str | None = None
    repeat: str = "Never"

@app.patch("/tasks/{task_id}/reminder")
def update_task_reminder(task_id: str, reminder: TaskReminderUpdate, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(task_id): raise HTTPException(status_code=400, detail="Invalid task ID.")
    if reminder.repeat not in {"Never", "Daily", "Weekly"}: raise HTTPException(status_code=400, detail="Repeat must be Never, Daily, or Weekly.")
    if reminder.reminder_at:
        try:
            parsed = datetime.fromisoformat(reminder.reminder_at.replace("Z", "+00:00"))
            if parsed.tzinfo is None: raise ValueError("Timezone required")
        except ValueError: raise HTTPException(status_code=400, detail="reminder_at must be ISO-8601 with timezone offset or Z.")
    result = db.tasks.update_one({"_id": ObjectId(task_id), "email": current_user["email"].lower()}, {"$set": {"due_date": reminder.due_date, "reminder_at": reminder.reminder_at, "repeat": reminder.repeat, "reminder_sent_for": None}})
    if result.matched_count == 0: raise HTTPException(status_code=404, detail="Task not found.")
    doc = db.tasks.find_one({"_id": ObjectId(task_id), "email": current_user["email"].lower()})
    return {"success": True, "task": serialize_task(doc)}

class PushSubscriptionCreate(BaseModel):
    subscription: dict

@app.get("/push/public-key")
def push_public_key(): return {"success": bool(VAPID_PUBLIC_KEY), "publicKey": VAPID_PUBLIC_KEY}

@app.post("/push/subscribe")
def push_subscribe(payload: PushSubscriptionCreate, current_user: dict = Depends(get_current_user)):
    endpoint = payload.subscription.get("endpoint")
    if not endpoint: raise HTTPException(status_code=400, detail="Invalid push subscription.")
    db.push_subscriptions.update_one({"email": current_user["email"].lower(), "subscription.endpoint": endpoint}, {"$set": {"email": current_user["email"].lower(), "subscription": payload.subscription}}, upsert=True)
    return {"success": True, "message": "Push notifications enabled."}

@app.delete("/push/subscribe")
def push_unsubscribe(endpoint: str, current_user: dict = Depends(get_current_user)):
    db.push_subscriptions.delete_one({"email": current_user["email"].lower(), "subscription.endpoint": endpoint})
    return {"success": True}

def _send_due_reminders():
    if webpush is None or not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY: return
    now = datetime.now(timezone.utc)
    for task in db.tasks.find({"completed": {"$ne": True}, "reminder_at": {"$type": "string", "$ne": ""}}):
        try:
            due = datetime.fromisoformat(task["reminder_at"].replace("Z", "+00:00"))
            if due.tzinfo is None: continue
            key = due.isoformat()
            if due > now or task.get("reminder_sent_for") == key: continue
            subs = list(db.push_subscriptions.find({"email": task["email"]}))
            if not subs: continue
            payload = {"title": "LifeCue reminder", "body": task.get("title", "Your task is due"), "url": "/tasks", "taskId": str(task["_id"])}
            success = True
            for sub in subs:
                try:
                    webpush(subscription_info=sub["subscription"], data=__import__("json").dumps(payload), vapid_private_key=VAPID_PRIVATE_KEY, vapid_claims={"sub": VAPID_CLAIMS_EMAIL})
                except WebPushException as exc:
                    status = getattr(getattr(exc, "response", None), "status_code", None)
                    if status in (404, 410): db.push_subscriptions.delete_one({"_id": sub["_id"]})
                    else: success = False
            if success:
                db.tasks.update_one({"_id": task["_id"]}, {"$set": {"reminder_sent_for": key}})
                repeat = task.get("repeat", "Never")
                if repeat in {"Daily", "Weekly"}:
                    nxt = due + (timedelta(days=1) if repeat == "Daily" else timedelta(days=7))
                    db.tasks.update_one({"_id": task["_id"]}, {"$set": {"reminder_at": nxt.isoformat(), "reminder_sent_for": None}})
        except (ValueError, TypeError, KeyError): continue

def _reminder_worker():
    while True:
        try: _send_due_reminders()
        except Exception as exc: print(f"LifeCue reminder worker error: {exc}")
        time.sleep(30)

@app.on_event("startup")
def start_reminder_worker():
    if not getattr(app.state, "reminder_worker_started", False):
        threading.Thread(target=_reminder_worker, daemon=True, name="lifecue-reminders").start()
        app.state.reminder_worker_started = True
'''
s=s.replace('\n\n# ================= HABITS API =================',block+'\n\n# ================= HABITS API =================',1)
tmp=Path('main_reminders_integrated.tmp.py'); tmp.write_text(s,encoding='utf-8')
try: py_compile.compile(str(tmp),doraise=True)
except Exception as e:
    tmp.unlink(missing_ok=True); raise SystemExit(f'STOP: syntax check failed; main.py unchanged: {e}')
tmp.replace(p)
print('SUCCESS: reminder code integrated into main.py')
print(f'Safety snapshot: {snapshot}')
print('Run next: python -m py_compile main.py')
