from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import aiofiles

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'default_secret')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES', 1440))

# Create uploads directory
UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Mount uploads directory
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# ============== MODELS ==============

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "user"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class TicketCreate(BaseModel):
    title: str
    description: str
    priority: str = "Medium"
    department: str

class TicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    department: Optional[str] = None

class TicketResponse(BaseModel):
    id: str
    title: str
    description: str
    priority: str
    status: str
    created_by: str
    created_by_name: str
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    department: str
    attachments: List[str] = []
    created_at: str
    updated_at: str

class CommentCreate(BaseModel):
    comment: str

class CommentResponse(BaseModel):
    id: str
    ticket_id: str
    user_id: str
    user_name: str
    comment: str
    created_at: str

class HistoryResponse(BaseModel):
    id: str
    ticket_id: str
    user_id: str
    user_name: str
    action: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    created_at: str

class StatsResponse(BaseModel):
    total_tickets: int
    open_tickets: int
    in_progress_tickets: int
    closed_tickets: int

# ============== HELPERS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "email": email, "role": role, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

async def get_user_name(user_id: Optional[str]) -> Optional[str]:
    if not user_id:
        return None
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1})
    return user.get("name") if user else None

async def add_history(ticket_id: str, user_id: str, user_name: str, action: str, old_value: str = None, new_value: str = None):
    history = {
        "id": str(uuid.uuid4()),
        "ticket_id": ticket_id,
        "user_id": user_id,
        "user_name": user_name,
        "action": action,
        "old_value": old_value,
        "new_value": new_value,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.ticket_history.insert_one(history)

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = {
        "id": str(uuid.uuid4()),
        "name": user_data.name,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "role": "user",  # Force role to 'user' for all registrations
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    
    token = create_token(user["id"], user["email"], user["role"])
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            role=user["role"],
            created_at=user["created_at"]
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["email"], user["role"])
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            role=user["role"],
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        name=current_user["name"],
        email=current_user["email"],
        role=current_user["role"],
        created_at=current_user["created_at"]
    )

# ============== USER ROUTES ==============

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(get_admin_user)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.get("/users/technicians", response_model=List[UserResponse])
async def get_technicians(current_user: dict = Depends(get_current_user)):
    users = await db.users.find({"role": "admin"}, {"_id": 0, "password": 0}).to_list(100)
    return [UserResponse(**u) for u in users]

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_admin_user)):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

@api_router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, role: str = Query(...), current_user: dict = Depends(get_admin_user)):
    if role not in ["admin", "user"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    result = await db.users.update_one({"id": user_id}, {"$set": {"role": role}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Role updated"}

# ============== TICKET ROUTES ==============

@api_router.post("/tickets", response_model=TicketResponse)
async def create_ticket(ticket_data: TicketCreate, current_user: dict = Depends(get_current_user)):
    ticket = {
        "id": str(uuid.uuid4()),
        "title": ticket_data.title,
        "description": ticket_data.description,
        "priority": ticket_data.priority,
        "status": "Open",
        "created_by": current_user["id"],
        "assigned_to": None,
        "department": ticket_data.department,
        "attachments": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tickets.insert_one(ticket)
    await add_history(ticket["id"], current_user["id"], current_user["name"], "created", None, "Open")
    
    return TicketResponse(
        **{k: v for k, v in ticket.items() if k != "created_by" and k != "assigned_to"},
        created_by=ticket["created_by"],
        created_by_name=current_user["name"],
        assigned_to=None,
        assigned_to_name=None
    )

@api_router.get("/tickets", response_model=List[TicketResponse])
async def get_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    department: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if current_user["role"] != "admin":
        query["created_by"] = current_user["id"]
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if department:
        query["department"] = department
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    skip = (page - 1) * limit
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for t in tickets:
        created_by_name = await get_user_name(t.get("created_by"))
        assigned_to_name = await get_user_name(t.get("assigned_to"))
        result.append(TicketResponse(
            **{k: v for k, v in t.items() if k not in ["created_by", "assigned_to"]},
            created_by=t.get("created_by", ""),
            created_by_name=created_by_name or "Unknown",
            assigned_to=t.get("assigned_to"),
            assigned_to_name=assigned_to_name
        ))
    return result

@api_router.get("/tickets/count")
async def get_tickets_count(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    department: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if current_user["role"] != "admin":
        query["created_by"] = current_user["id"]
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if department:
        query["department"] = department
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    count = await db.tickets.count_documents(query)
    return {"count": count}

@api_router.get("/tickets/stats", response_model=StatsResponse)
async def get_stats(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user["role"] != "admin":
        query["created_by"] = current_user["id"]
    
    total = await db.tickets.count_documents(query)
    open_q = {**query, "status": "Open"}
    open_count = await db.tickets.count_documents(open_q)
    in_progress_q = {**query, "status": "In Progress"}
    in_progress = await db.tickets.count_documents(in_progress_q)
    closed_q = {**query, "status": "Closed"}
    closed = await db.tickets.count_documents(closed_q)
    
    return StatsResponse(
        total_tickets=total,
        open_tickets=open_count,
        in_progress_tickets=in_progress,
        closed_tickets=closed
    )

@api_router.get("/tickets/recent", response_model=List[TicketResponse])
async def get_recent_tickets(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user["role"] != "admin":
        query["created_by"] = current_user["id"]
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    result = []
    for t in tickets:
        created_by_name = await get_user_name(t.get("created_by"))
        assigned_to_name = await get_user_name(t.get("assigned_to"))
        result.append(TicketResponse(
            **{k: v for k, v in t.items() if k not in ["created_by", "assigned_to"]},
            created_by=t.get("created_by", ""),
            created_by_name=created_by_name or "Unknown",
            assigned_to=t.get("assigned_to"),
            assigned_to_name=assigned_to_name
        ))
    return result

@api_router.get("/tickets/{ticket_id}", response_model=TicketResponse)
async def get_ticket(ticket_id: str, current_user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if current_user["role"] != "admin" and ticket["created_by"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    created_by_name = await get_user_name(ticket.get("created_by"))
    assigned_to_name = await get_user_name(ticket.get("assigned_to"))
    
    return TicketResponse(
        **{k: v for k, v in ticket.items() if k not in ["created_by", "assigned_to"]},
        created_by=ticket.get("created_by", ""),
        created_by_name=created_by_name or "Unknown",
        assigned_to=ticket.get("assigned_to"),
        assigned_to_name=assigned_to_name
    )

@api_router.put("/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket(ticket_id: str, ticket_data: TicketUpdate, current_user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Only admin can update any ticket, users can only update their own
    if current_user["role"] != "admin" and ticket["created_by"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Users cannot change status or assignment
    if current_user["role"] != "admin":
        ticket_data.status = None
        ticket_data.assigned_to = None
    
    updates = {k: v for k, v in ticket_data.model_dump().items() if v is not None}
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        # Log status change
        if "status" in updates and updates["status"] != ticket.get("status"):
            await add_history(ticket_id, current_user["id"], current_user["name"], "status_changed", ticket.get("status"), updates["status"])
        
        # Log assignment change
        if "assigned_to" in updates and updates["assigned_to"] != ticket.get("assigned_to"):
            old_name = await get_user_name(ticket.get("assigned_to")) or "Unassigned"
            new_name = await get_user_name(updates["assigned_to"]) or "Unassigned"
            await add_history(ticket_id, current_user["id"], current_user["name"], "assigned", old_name, new_name)
        
        await db.tickets.update_one({"id": ticket_id}, {"$set": updates})
    
    updated = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    created_by_name = await get_user_name(updated.get("created_by"))
    assigned_to_name = await get_user_name(updated.get("assigned_to"))
    
    return TicketResponse(
        **{k: v for k, v in updated.items() if k not in ["created_by", "assigned_to"]},
        created_by=updated.get("created_by", ""),
        created_by_name=created_by_name or "Unknown",
        assigned_to=updated.get("assigned_to"),
        assigned_to_name=assigned_to_name
    )

@api_router.delete("/tickets/{ticket_id}")
async def delete_ticket(ticket_id: str, current_user: dict = Depends(get_admin_user)):
    result = await db.tickets.delete_one({"id": ticket_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await db.ticket_comments.delete_many({"ticket_id": ticket_id})
    await db.ticket_history.delete_many({"ticket_id": ticket_id})
    return {"message": "Ticket deleted"}

# ============== COMMENT ROUTES ==============

@api_router.post("/tickets/{ticket_id}/comments", response_model=CommentResponse)
async def add_comment(ticket_id: str, comment_data: CommentCreate, current_user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if current_user["role"] != "admin" and ticket["created_by"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    comment = {
        "id": str(uuid.uuid4()),
        "ticket_id": ticket_id,
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "comment": comment_data.comment,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.ticket_comments.insert_one(comment)
    await add_history(ticket_id, current_user["id"], current_user["name"], "commented", None, comment_data.comment[:50])
    
    return CommentResponse(**{k: v for k, v in comment.items() if k != "_id"})

@api_router.get("/tickets/{ticket_id}/comments", response_model=List[CommentResponse])
async def get_comments(ticket_id: str, current_user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if current_user["role"] != "admin" and ticket["created_by"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    comments = await db.ticket_comments.find({"ticket_id": ticket_id}, {"_id": 0}).sort("created_at", 1).to_list(100)
    return [CommentResponse(**c) for c in comments]

# ============== HISTORY ROUTES ==============

@api_router.get("/tickets/{ticket_id}/history", response_model=List[HistoryResponse])
async def get_history(ticket_id: str, current_user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if current_user["role"] != "admin" and ticket["created_by"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    history = await db.ticket_history.find({"ticket_id": ticket_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [HistoryResponse(**h) for h in history]

# ============== FILE UPLOAD ROUTES ==============

@api_router.post("/tickets/{ticket_id}/upload")
async def upload_file(ticket_id: str, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if current_user["role"] != "admin" and ticket["created_by"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Validate file type
    allowed_types = ["image/png", "image/jpeg", "image/gif", "application/pdf", "text/plain"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="File type not allowed")
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
    filename = f"{ticket_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOAD_DIR / filename
    
    async with aiofiles.open(filepath, "wb") as f:
        content = await file.read()
        await f.write(content)
    
    # Update ticket attachments
    file_url = f"/uploads/{filename}"
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$push": {"attachments": file_url}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await add_history(ticket_id, current_user["id"], current_user["name"], "attachment_added", None, file.filename)
    
    return {"url": file_url, "filename": file.filename}

@api_router.get("/departments")
async def get_departments():
    return {"departments": ["IT Support", "Hardware", "Software", "Network", "Security", "Other"]}

# ============== NOTIFICATIONS ==============

@api_router.get("/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    # Get recent activity on user's tickets
    query = {}
    if current_user["role"] != "admin":
        query["created_by"] = current_user["id"]
    
    tickets = await db.tickets.find(query, {"_id": 0, "id": 1}).to_list(100)
    ticket_ids = [t["id"] for t in tickets]
    
    notifications = await db.ticket_history.find(
        {"ticket_id": {"$in": ticket_ids}, "user_id": {"$ne": current_user["id"]}},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {"notifications": notifications}

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
