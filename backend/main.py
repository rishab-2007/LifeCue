import os
import time
import threading
from datetime import datetime, timedelta, timezone

import jwt
from bson import ObjectId
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from pydantic import BaseModel, EmailStr, Field

from database import db

try:
    from pywebpush import webpush, WebPushException
except ImportError:
    webpush = None
    WebPushException = Exception

VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_CLAIMS_EMAIL = os.getenv("VAPID_CLAIMS_EMAIL", "mailto:rhishabsharma1234@gmail.com")


# ================= APP CONFIGURATION =================

app = FastAPI(title="LifeCue API")

password_hash = PasswordHash.recommended()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not JWT_SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY missing hai. Backend ki .env file check karo."
    )

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60

security = HTTPBearer(auto_error=False)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ================= AUTHENTICATION =================

def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    """Validate the JWT token and return the authenticated user."""

    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )

        subject = payload.get("sub")

        if not isinstance(subject, str) or not subject.strip():
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Authentication token expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    except jwt.PyJWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.users.find_one(
        {"email": subject.lower()},
        {"_id": 0, "name": 1, "email": 1},
    )

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="User not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


# ================= HOME =================

@app.get("/")
def home():
    return {"message": "LifeCue Backend is running 🚀"}


# ================= AUTH MODELS =================

class UserRegister(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


# ================= REGISTER =================

@app.post("/register")
def register_user(user: UserRegister):
    email = str(user.email).lower()
    name = user.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Name is required.",
        )

    if db.users.find_one({"email": email}):
        return {
            "success": False,
            "message": "Email already registered.",
        }

    hashed_password = password_hash.hash(user.password)

    db.users.insert_one(
        {
            "name": name,
            "email": email,
            "password": hashed_password,
        }
    )

    return {
        "success": True,
        "message": "User registered successfully.",
    }


# ================= LOGIN =================

@app.post("/login")
def login_user(user: UserLogin):
    email = str(user.email).lower()

    existing_user = db.users.find_one({"email": email})

    if not existing_user:
        return {
            "success": False,
            "message": "Invalid email or password.",
        }

    stored_password = existing_user.get("password", "")

    if not isinstance(stored_password, str):
        return {
            "success": False,
            "message": "Invalid email or password.",
        }

    if not stored_password.startswith("$argon2"):
        return {
            "success": False,
            "message": (
                "This account uses an older password format. "
                "Please use the appropriate password migration or "
                "account recovery process."
            ),
        }

    try:
        password_matches = password_hash.verify(
            user.password,
            stored_password,
        )
    except Exception:
        password_matches = False

    if not password_matches:
        return {
            "success": False,
            "message": "Invalid email or password.",
        }

    now = datetime.now(timezone.utc)

    token = jwt.encode(
        {
            "sub": email,
            "iat": now,
            "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
        },
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )

    return {
        "success": True,
        "message": "Login successful.",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "name": existing_user.get("name", ""),
            "email": email,
        },
    }


# ================= TASKS API =================

class TaskCreate(BaseModel):
    email: EmailStr
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    priority: str = "Medium"
    category: str = "Personal"
    time: str = "6:00 PM"
    due_date: str | None = None
    reminder_at: str | None = None
    repeat: str = "Never"


class TaskUpdate(BaseModel):
    completed: bool


def serialize_task(document):
    return {
        "id": str(document["_id"]),
        "title": document.get("title", ""),
        "description": document.get("description", ""),
        "priority": document.get("priority", "Medium"),
        "category": document.get("category", "Personal"),
        "time": document.get("time", "6:00 PM"),
        "due_date": document.get("due_date"),
        "reminder_at": document.get("reminder_at"),
        "repeat": document.get("repeat", "Never"),
        "completed": bool(document.get("completed", False)),
    }


@app.get("/tasks")
def get_tasks(
    email: EmailStr,
    current_user: dict = Depends(get_current_user),
):
    normalized_email = current_user["email"].lower()

    documents = db.tasks.find(
        {"email": normalized_email}
    ).sort("_id", -1)

    return {
        "success": True,
        "tasks": [
            serialize_task(document)
            for document in documents
        ],
    }


@app.post("/tasks")
def create_task(
    task: TaskCreate,
    current_user: dict = Depends(get_current_user),
):
    normalized_email = current_user["email"].lower()
    title = task.title.strip()

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Task title is required.",
        )

    document = {
        "email": normalized_email,
        "title": title,
        "description": task.description.strip(),
        "priority": (
            task.priority
            if task.priority in {"High", "Medium", "Low"}
            else "Medium"
        ),
        "category": (
            task.category
            if task.category in {
                "Personal", "Learning", "Development", "Work"
            }
            else "Personal"
        ),
        "time": task.time.strip() or "6:00 PM",
        "due_date": task.due_date,
        "reminder_at": task.reminder_at,
        "repeat": task.repeat if task.repeat in {"Never", "Daily", "Weekly"} else "Never",
        "reminder_sent_for": None,
        "completed": False,
    }

    result = db.tasks.insert_one(document)
    document["_id"] = result.inserted_id

    return {
        "success": True,
        "message": "Task saved successfully.",
        "task": serialize_task(document),
    }


@app.patch("/tasks/{task_id}")
def update_task(
    task_id: str,
    email: EmailStr,
    update: TaskUpdate,
    current_user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(task_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid task ID.",
        )

    query = {
        "_id": ObjectId(task_id),
        "email": current_user["email"].lower(),
    }

    result = db.tasks.update_one(
        query,
        {"$set": {"completed": update.completed}},
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Task not found.",
        )

    document = db.tasks.find_one(query)

    return {
        "success": True,
        "message": "Task updated successfully.",
        "task": serialize_task(document),
    }


@app.delete("/tasks/{task_id}")
def remove_task(
    task_id: str,
    email: EmailStr,
    current_user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(task_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid task ID.",
        )

    result = db.tasks.delete_one(
        {
            "_id": ObjectId(task_id),
            "email": current_user["email"].lower(),
        }
    )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Task not found.",
        )

    return {
        "success": True,
        "message": "Task deleted successfully.",
    }


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
    print("\n[REMINDER DEBUG] Checking scheduled reminders...")

    if webpush is None:
        print("[REMINDER DEBUG] ERROR: pywebpush is unavailable.")
        return

    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        print("[REMINDER DEBUG] ERROR: VAPID keys are missing.")
        print(
            f"[REMINDER DEBUG] Public key configured: "
            f"{bool(VAPID_PUBLIC_KEY)}"
        )
        print(
            f"[REMINDER DEBUG] Private key configured: "
            f"{bool(VAPID_PRIVATE_KEY)}"
        )
        return

    now = datetime.now(timezone.utc)
    print(f"[REMINDER DEBUG] Current UTC time: {now.isoformat()}")

    tasks = db.tasks.find({
        "completed": {"$ne": True},
        "reminder_at": {"$type": "string", "$ne": ""}
    })

    for task in tasks:
        try:
            reminder_value = task.get("reminder_at", "")

            due = datetime.fromisoformat(
                reminder_value.replace("Z", "+00:00")
            )

            if due.tzinfo is None:
                print(
                    f"[REMINDER DEBUG] SKIP: Task "
                    f"{task['_id']} has no timezone."
                )
                continue

            key = due.isoformat()

            if due > now:
                continue

            if task.get("reminder_sent_for") == key:
                continue

            email = task.get("email", "").lower()

            print(
                f"[REMINDER DEBUG] Due task found: {task['_id']}"
            )
            print(
                f"[REMINDER DEBUG] Due time: {due.isoformat()}"
            )

            subs = list(
                db.push_subscriptions.find({"email": email})
            )

            if not subs:
                print(
                    f"[REMINDER DEBUG] ERROR: "
                    f"No push subscription for {email}"
                )
                continue

            payload = {
                "title": "LifeCue reminder",
                "body": task.get("title", "Your task is due"),
                "url": "/tasks",
                "taskId": str(task["_id"])
            }

            success = True

            for sub in subs:
                try:
                    webpush(
                        subscription_info=sub["subscription"],
                        data=__import__("json").dumps(payload),
                        vapid_private_key=VAPID_PRIVATE_KEY,
                        vapid_claims={
                            "sub": VAPID_CLAIMS_EMAIL
                        },
                       headers={
    "X-WNS-Type": "wns/raw",
    "TTL": "600",
    "Content-Type": "application/octet-stream"
}
                    )

                    print(
                        "[REMINDER DEBUG] "
                        "Push accepted by push service."
                    )

                except WebPushException as exc:
                    response = getattr(exc, "response", None)
                    status = getattr(response, "status_code", None)

                    print(
                        f"[REMINDER DEBUG] WebPush status: {status}"
                    )
                    print(
                        "[REMINDER DEBUG] Response headers: "
                        f"{getattr(response, 'headers', None)}"
                    )
                    print(
                        "[REMINDER DEBUG] Response body: "
                        f"{getattr(response, 'text', None)}"
                    )

                    if status in (404, 410):
                        db.push_subscriptions.delete_one(
                            {"_id": sub["_id"]}
                        )

                    success = False

                except Exception as exc:
                    print(
                        "[REMINDER DEBUG] "
                        f"Unexpected push error: {exc}"
                    )
                    success = False

            if success:
                db.tasks.update_one(
                    {"_id": task["_id"]},
                    {"$set": {"reminder_sent_for": key}}
                )

                print(
                    "[REMINDER DEBUG] Reminder sent successfully "
                    f"for task {task['_id']}."
                )

                repeat = task.get("repeat", "Never")

                if repeat in {"Daily", "Weekly"}:
                    nxt = due + (
                        timedelta(days=1)
                        if repeat == "Daily"
                        else timedelta(days=7)
                    )

                    db.tasks.update_one(
                        {"_id": task["_id"]},
                        {
                            "$set": {
                                "reminder_at": nxt.isoformat(),
                                "reminder_sent_for": None
                            }
                        }
                    )

        except (ValueError, TypeError, KeyError) as exc:
            print(
                f"[REMINDER DEBUG] Invalid task data: {exc}"
            )

        except Exception as exc:
            print(
                f"[REMINDER DEBUG] Task processing error: {exc}"
            )

def _reminder_worker():
    while True:
        try: _send_due_reminders()
        except Exception as exc: print(f"LifeCue reminder worker error: {exc}")
        time.sleep(3)

@app.on_event("startup")
def start_reminder_worker():
    if not getattr(app.state, "reminder_worker_started", False):
        threading.Thread(target=_reminder_worker, daemon=True, name="lifecue-reminders").start()
        app.state.reminder_worker_started = True


# ================= HABITS API =================

class HabitCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    category: str = "Personal"


class HabitUpdate(BaseModel):
    completed: list[bool] = Field(min_length=7, max_length=7)
    streak: int = Field(default=0, ge=0)


def serialize_habit(document):
    completed = document.get("completed", [False] * 7)
    completed = (list(completed) + [False] * 7)[:7]

    return {
        "id": str(document["_id"]),
        "name": document.get("name", ""),
        "category": document.get("category", "Personal"),
        "completed": completed,
        "streak": int(document.get("streak", sum(completed))),
    }


@app.get("/habits")
def get_habits(
    email: EmailStr,
    current_user: dict = Depends(get_current_user),
):
    normalized_email = current_user["email"].lower()

    documents = db.habits.find(
        {"email": normalized_email}
    ).sort("_id", -1)

    return {
        "success": True,
        "habits": [
            serialize_habit(document)
            for document in documents
        ],
    }


@app.post("/habits")
def create_habit(
    habit: HabitCreate,
    current_user: dict = Depends(get_current_user),
):
    normalized_email = current_user["email"].lower()
    name = habit.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Habit name is required.",
        )

    document = {
        "email": normalized_email,
        "name": name,
        "category": (
            habit.category
            if habit.category in {
                "Personal", "Learning", "Health", "Development"
            }
            else "Personal"
        ),
        "completed": [False] * 7,
        "streak": 0,
    }

    result = db.habits.insert_one(document)
    document["_id"] = result.inserted_id

    return {
        "success": True,
        "message": "Habit saved successfully.",
        "habit": serialize_habit(document),
    }


@app.patch("/habits/{habit_id}")
def update_habit(
    habit_id: str,
    email: EmailStr,
    update: HabitUpdate,
    current_user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(habit_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid habit ID.",
        )

    query = {
        "_id": ObjectId(habit_id),
        "email": current_user["email"].lower(),
    }

    result = db.habits.update_one(
        query,
        {
            "$set": {
                "completed": update.completed,
                "streak": update.streak,
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Habit not found.",
        )

    document = db.habits.find_one(query)

    return {
        "success": True,
        "message": "Habit updated successfully.",
        "habit": serialize_habit(document),
    }


@app.delete("/habits/{habit_id}")
def remove_habit(
    habit_id: str,
    email: EmailStr,
    current_user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(habit_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid habit ID.",
        )

    result = db.habits.delete_one(
        {
            "_id": ObjectId(habit_id),
            "email": current_user["email"].lower(),
        }
    )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Habit not found.",
        )

    return {
        "success": True,
        "message": "Habit deleted successfully.",
    }


# ================= GOALS API =================

class GoalCreate(BaseModel):
    email: EmailStr
    title: str = Field(min_length=1, max_length=200)
    category: str = "Development"
    target: str = Field(default="Complete this goal", max_length=500)
    deadline: str = Field(default="", max_length=100)


class GoalUpdate(BaseModel):
    progress: int = Field(ge=0, le=100)


def serialize_goal(document):
    return {
        "id": str(document["_id"]),
        "title": document.get("title", ""),
        "category": document.get("category", "Development"),
        "target": document.get("target", "Complete this goal"),
        "progress": int(document.get("progress", 0)),
        "deadline": document.get("deadline", "No deadline"),
    }


@app.get("/goals")
def get_goals(
    email: EmailStr,
    current_user: dict = Depends(get_current_user),
):
    normalized_email = current_user["email"].lower()

    documents = db.goals.find(
        {"email": normalized_email}
    ).sort("_id", -1)

    return {
        "success": True,
        "goals": [
            serialize_goal(document)
            for document in documents
        ],
    }


@app.post("/goals")
def create_goal(
    goal: GoalCreate,
    current_user: dict = Depends(get_current_user),
):
    normalized_email = current_user["email"].lower()
    title = goal.title.strip()

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Goal title is required.",
        )

    allowed_categories = {
        "Development", "Learning", "Personal", "Health", "Career"
    }

    document = {
        "email": normalized_email,
        "title": title,
        "category": (
            goal.category
            if goal.category in allowed_categories
            else "Development"
        ),
        "target": goal.target.strip() or "Complete this goal",
        "progress": 0,
        "deadline": goal.deadline.strip() or "No deadline",
    }

    result = db.goals.insert_one(document)
    document["_id"] = result.inserted_id

    return {
        "success": True,
        "message": "Goal saved successfully.",
        "goal": serialize_goal(document),
    }


@app.patch("/goals/{goal_id}")
def update_goal(
    goal_id: str,
    email: EmailStr,
    update: GoalUpdate,
    current_user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(goal_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid goal ID.",
        )

    query = {
        "_id": ObjectId(goal_id),
        "email": current_user["email"].lower(),
    }

    result = db.goals.update_one(
        query,
        {"$set": {"progress": update.progress}},
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Goal not found.",
        )

    document = db.goals.find_one(query)

    return {
        "success": True,
        "message": "Goal updated successfully.",
        "goal": serialize_goal(document),
    }


@app.delete("/goals/{goal_id}")
def remove_goal(
    goal_id: str,
    email: EmailStr,
    current_user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(goal_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid goal ID.",
        )

    result = db.goals.delete_one(
        {
            "_id": ObjectId(goal_id),
            "email": current_user["email"].lower(),
        }
    )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Goal not found.",
        )

    return {
        "success": True,
        "message": "Goal deleted successfully.",
    }


# ================= PLANNER API =================

class PlannerCreate(BaseModel):
    email: EmailStr
    title: str = Field(min_length=1, max_length=200)
    day: str = "Mon"
    time: str = "6:00 PM"
    category: str = "Personal"
    priority: str = "Medium"


class PlannerUpdate(BaseModel):
    completed: bool


def serialize_planner_task(document):
    return {
        "id": str(document["_id"]),
        "title": document.get("title", ""),
        "day": document.get("day", "Mon"),
        "time": document.get("time", "6:00 PM"),
        "category": document.get("category", "Personal"),
        "priority": document.get("priority", "Medium"),
        "completed": bool(document.get("completed", False)),
    }


@app.get("/planner")
def get_planner_tasks(
    email: EmailStr,
    current_user: dict = Depends(get_current_user),
):
    normalized_email = current_user["email"].lower()

    documents = db.planner_tasks.find(
        {"email": normalized_email}
    ).sort("_id", -1)

    return {
        "success": True,
        "tasks": [
            serialize_planner_task(document)
            for document in documents
        ],
    }


@app.post("/planner")
def create_planner_task(
    task: PlannerCreate,
    current_user: dict = Depends(get_current_user),
):
    normalized_email = current_user["email"].lower()
    title = task.title.strip()

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Task title is required.",
        )

    allowed_days = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}
    allowed_categories = {"Personal", "Learning", "Development", "Work"}
    allowed_priorities = {"High", "Medium", "Low"}

    document = {
        "email": normalized_email,
        "title": title,
        "day": task.day if task.day in allowed_days else "Mon",
        "time": task.time.strip() or "6:00 PM",
        "category": (
            task.category
            if task.category in allowed_categories
            else "Personal"
        ),
        "priority": (
            task.priority
            if task.priority in allowed_priorities
            else "Medium"
        ),
        "completed": False,
    }

    result = db.planner_tasks.insert_one(document)
    document["_id"] = result.inserted_id

    return {
        "success": True,
        "message": "Planner task saved successfully.",
        "task": serialize_planner_task(document),
    }


@app.patch("/planner/{task_id}")
def update_planner_task(
    task_id: str,
    email: EmailStr,
    update: PlannerUpdate,
    current_user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(task_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid planner task ID.",
        )

    query = {
        "_id": ObjectId(task_id),
        "email": current_user["email"].lower(),
    }

    result = db.planner_tasks.update_one(
        query,
        {"$set": {"completed": update.completed}},
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Planner task not found.",
        )

    document = db.planner_tasks.find_one(query)

    return {
        "success": True,
        "message": "Planner task updated successfully.",
        "task": serialize_planner_task(document),
    }


@app.delete("/planner/{task_id}")
def delete_planner_task(
    task_id: str,
    email: EmailStr,
    current_user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(task_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid planner task ID.",
        )

    result = db.planner_tasks.delete_one(
        {
            "_id": ObjectId(task_id),
            "email": current_user["email"].lower(),
        }
    )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Planner task not found.",
        )

    return {
        "success": True,
        "message": "Planner task deleted successfully.",
    }


# ================= NOTES API =================

class NoteCreate(BaseModel):
    email: EmailStr
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(default="", max_length=10000)
    category: str = Field(default="General", max_length=50)


class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    content: str | None = Field(default=None, max_length=10000)
    category: str | None = Field(default=None, max_length=50)
    pinned: bool | None = None


def serialize_note(document):
    return {
        "id": str(document["_id"]),
        "title": document.get("title", ""),
        "content": document.get("content", ""),
        "category": document.get("category", "General"),
        "pinned": bool(document.get("pinned", False)),
    }


@app.get("/notes")
def get_notes(
    email: EmailStr,
    current_user: dict = Depends(get_current_user),
):
    normalized_email = current_user["email"].lower()

    documents = db.notes.find(
        {"email": normalized_email}
    ).sort("_id", -1)

    return [
        serialize_note(document)
        for document in documents
    ]


@app.post("/notes")
def create_note(
    note: NoteCreate,
    current_user: dict = Depends(get_current_user),
):
    normalized_email = current_user["email"].lower()
    title = note.title.strip()

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Note title is required.",
        )

    document = {
        "email": normalized_email,
        "title": title,
        "content": note.content.strip(),
        "category": note.category.strip() or "General",
        "pinned": False,
    }

    result = db.notes.insert_one(document)
    document["_id"] = result.inserted_id

    return serialize_note(document)


@app.patch("/notes/{note_id}")
def update_note(
    note_id: str,
    email: EmailStr,
    update: NoteUpdate,
    current_user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(note_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid note ID.",
        )

    changes = update.model_dump(
        exclude_unset=True,
        exclude_none=True,
    )

    if "title" in changes:
        changes["title"] = changes["title"].strip()

        if not changes["title"]:
            raise HTTPException(
                status_code=400,
                detail="Note title is required.",
            )

    if "content" in changes:
        changes["content"] = changes["content"].strip()

    if "category" in changes:
        changes["category"] = changes["category"].strip() or "General"

    query = {
        "_id": ObjectId(note_id),
        "email": current_user["email"].lower(),
    }

    if changes:
        result = db.notes.update_one(query, {"$set": changes})

        if result.matched_count == 0:
            raise HTTPException(
                status_code=404,
                detail="Note not found.",
            )

    document = db.notes.find_one(query)

    if document is None:
        raise HTTPException(
            status_code=404,
            detail="Note not found.",
        )

    return serialize_note(document)


@app.delete("/notes/{note_id}")
def delete_note(
    note_id: str,
    email: EmailStr,
    current_user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(note_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid note ID.",
        )

    result = db.notes.delete_one(
        {
            "_id": ObjectId(note_id),
            "email": current_user["email"].lower(),
        }
    )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Note not found.",
        )

    return {
        "success": True,
        "message": "Note deleted successfully.",
    }


# ================= FOCUS SESSIONS API =================

class FocusSessionCreate(BaseModel):
    email: EmailStr
    duration_minutes: int = Field(gt=0, le=180)
    completed: bool = True
    started_at: datetime | None = None


def serialize_focus_session(document):
    return {
        "id": str(document["_id"]),
        "duration_minutes": int(document.get("duration_minutes", 0)),
        "completed": bool(document.get("completed", False)),
        "started_at": (
            document["started_at"].isoformat()
            if document.get("started_at")
            else None
        ),
        "completed_at": (
            document["completed_at"].isoformat()
            if document.get("completed_at")
            else None
        ),
    }


@app.get("/focus-sessions")
def get_focus_sessions(
    email: EmailStr,
    current_user: dict = Depends(get_current_user),
):
    normalized_email = current_user["email"].lower()

    documents = db.focus_sessions.find(
        {"email": normalized_email}
    ).sort("completed_at", -1)

    return {
        "success": True,
        "sessions": [
            serialize_focus_session(document)
            for document in documents
        ],
    }


@app.post("/focus-sessions")
def create_focus_session(
    session: FocusSessionCreate,
    current_user: dict = Depends(get_current_user),
):
    normalized_email = current_user["email"].lower()
    now = datetime.now(timezone.utc)

    document = {
        "email": normalized_email,
        "duration_minutes": session.duration_minutes,
        "completed": session.completed,
        "started_at": session.started_at or now,
        "completed_at": now,
    }

    result = db.focus_sessions.insert_one(document)
    document["_id"] = result.inserted_id

    return {
        "success": True,
        "message": "Focus session saved successfully.",
        "session": serialize_focus_session(document),
    }