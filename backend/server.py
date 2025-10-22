from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from jwt.exceptions import InvalidTokenError
from passlib.context import CryptContext
from sheets_service import sheets_service

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class Member(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nombre: str
    apellido: str
    direccion: str
    telefono: str
    fecha_registro: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MemberCreate(BaseModel):
    nombre: str
    apellido: str
    direccion: str
    telefono: str

class Visitor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nombre: str
    de_donde_viene: str
    fecha_registro: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class VisitorCreate(BaseModel):
    nombre: str
    de_donde_viene: str

class Attendance(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tipo: str  # 'member' or 'visitor'
    person_id: str
    person_name: str
    fecha: str  # YYYY-MM-DD format
    presente: bool
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AttendanceCreate(BaseModel):
    tipo: str
    person_id: str
    person_name: str
    fecha: str
    presente: bool

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except (InvalidTokenError, Exception):
        raise HTTPException(status_code=401, detail="Could not validate credentials")

# Auth endpoints
@api_router.post("/auth/register", response_model=Token)
async def register(user_input: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"username": user_input.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Create user
    user_dict = user_input.model_dump()
    user_dict["password"] = get_password_hash(user_dict["password"])
    user_obj = User(**user_dict)
    
    doc = user_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.users.insert_one(doc)
    
    # Create token
    access_token = create_access_token(data={"sub": user_obj.username})
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.post("/auth/login", response_model=Token)
async def login(user_input: UserLogin):
    user = await db.users.find_one({"username": user_input.username})
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    if not verify_password(user_input.password, user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    access_token = create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}

# Member endpoints (Google Sheets)
@api_router.post("/members", response_model=Member)
async def create_member(member_input: MemberCreate, current_user: str = Depends(get_current_user)):
    member_obj = Member(**member_input.model_dump())
    values = [
        member_obj.id,
        member_obj.nombre,
        member_obj.apellido,
        member_obj.direccion,
        member_obj.telefono,
        member_obj.fecha_registro.isoformat()
    ]
    sheets_service.append_row('Miembros', values)
    return member_obj

@api_router.get("/members", response_model=List[Member])
async def get_members(current_user: str = Depends(get_current_user)):
    records = sheets_service.read_all('Miembros')
    members = []
    for record in records:
        if record.get('id'):
            members.append(Member(
                id=record['id'],
                nombre=record.get('nombre', ''),
                apellido=record.get('apellido', ''),
                direccion=record.get('direccion', ''),
                telefono=record.get('telefono', ''),
                fecha_registro=datetime.fromisoformat(record.get('fecha_registro', datetime.now(timezone.utc).isoformat()))
            ))
    return members

@api_router.get("/members/{member_id}", response_model=Member)
async def get_member(member_id: str, current_user: str = Depends(get_current_user)):
    record = sheets_service.find_row_by_id('Miembros', member_id)
    if not record:
        raise HTTPException(status_code=404, detail="Member not found")
    return Member(
        id=record['id'],
        nombre=record.get('nombre', ''),
        apellido=record.get('apellido', ''),
        direccion=record.get('direccion', ''),
        telefono=record.get('telefono', ''),
        fecha_registro=datetime.fromisoformat(record.get('fecha_registro', datetime.now(timezone.utc).isoformat()))
    )

@api_router.put("/members/{member_id}", response_model=Member)
async def update_member(member_id: str, member_input: MemberCreate, current_user: str = Depends(get_current_user)):
    record = sheets_service.find_row_by_id('Miembros', member_id)
    if not record:
        raise HTTPException(status_code=404, detail="Member not found")
    
    values = [
        member_id,
        member_input.nombre,
        member_input.apellido,
        member_input.direccion,
        member_input.telefono,
        record.get('fecha_registro', datetime.now(timezone.utc).isoformat())
    ]
    sheets_service.update_row('Miembros', record['_row'], values)
    
    return Member(
        id=member_id,
        nombre=member_input.nombre,
        apellido=member_input.apellido,
        direccion=member_input.direccion,
        telefono=member_input.telefono,
        fecha_registro=datetime.fromisoformat(record.get('fecha_registro', datetime.now(timezone.utc).isoformat()))
    )

@api_router.delete("/members/{member_id}")
async def delete_member(member_id: str, current_user: str = Depends(get_current_user)):
    record = sheets_service.find_row_by_id('Miembros', member_id)
    if not record:
        raise HTTPException(status_code=404, detail="Member not found")
    sheets_service.delete_row('Miembros', record['_row'])
    return {"message": "Member deleted successfully"}

# Visitor endpoints (Google Sheets - Amigos)
@api_router.post("/visitors", response_model=Visitor)
async def create_visitor(visitor_input: VisitorCreate, current_user: str = Depends(get_current_user)):
    visitor_obj = Visitor(**visitor_input.model_dump())
    values = [
        visitor_obj.id,
        visitor_obj.nombre,
        visitor_obj.de_donde_viene,
        visitor_obj.fecha_registro.isoformat()
    ]
    sheets_service.append_row('Amigos', values)
    return visitor_obj

@api_router.get("/visitors", response_model=List[Visitor])
async def get_visitors(current_user: str = Depends(get_current_user)):
    records = sheets_service.read_all('Amigos')
    visitors = []
    for record in records:
        if record.get('id'):
            visitors.append(Visitor(
                id=record['id'],
                nombre=record.get('nombre', ''),
                de_donde_viene=record.get('de_donde_viene', ''),
                fecha_registro=datetime.fromisoformat(record.get('fecha_registro', datetime.now(timezone.utc).isoformat()))
            ))
    return visitors

@api_router.get("/visitors/{visitor_id}", response_model=Visitor)
async def get_visitor(visitor_id: str, current_user: str = Depends(get_current_user)):
    record = sheets_service.find_row_by_id('Amigos', visitor_id)
    if not record:
        raise HTTPException(status_code=404, detail="Visitor not found")
    return Visitor(
        id=record['id'],
        nombre=record.get('nombre', ''),
        de_donde_viene=record.get('de_donde_viene', ''),
        fecha_registro=datetime.fromisoformat(record.get('fecha_registro', datetime.now(timezone.utc).isoformat()))
    )

@api_router.put("/visitors/{visitor_id}", response_model=Visitor)
async def update_visitor(visitor_id: str, visitor_input: VisitorCreate, current_user: str = Depends(get_current_user)):
    record = sheets_service.find_row_by_id('Amigos', visitor_id)
    if not record:
        raise HTTPException(status_code=404, detail="Visitor not found")
    
    values = [
        visitor_id,
        visitor_input.nombre,
        visitor_input.de_donde_viene,
        record.get('fecha_registro', datetime.now(timezone.utc).isoformat())
    ]
    sheets_service.update_row('Amigos', record['_row'], values)
    
    return Visitor(
        id=visitor_id,
        nombre=visitor_input.nombre,
        de_donde_viene=visitor_input.de_donde_viene,
        fecha_registro=datetime.fromisoformat(record.get('fecha_registro', datetime.now(timezone.utc).isoformat()))
    )

@api_router.delete("/visitors/{visitor_id}")
async def delete_visitor(visitor_id: str, current_user: str = Depends(get_current_user)):
    record = sheets_service.find_row_by_id('Amigos', visitor_id)
    if not record:
        raise HTTPException(status_code=404, detail="Visitor not found")
    sheets_service.delete_row('Amigos', record['_row'])
    return {"message": "Visitor deleted successfully"}

# Attendance endpoints
@api_router.post("/attendance", response_model=Attendance)
async def create_attendance(attendance_input: AttendanceCreate, current_user: str = Depends(get_current_user)):
    # Check if attendance already exists
    existing = await db.attendance.find_one({
        "person_id": attendance_input.person_id,
        "fecha": attendance_input.fecha
    })
    
    if existing:
        # Update existing
        await db.attendance.update_one(
            {"person_id": attendance_input.person_id, "fecha": attendance_input.fecha},
            {"$set": {"presente": attendance_input.presente}}
        )
        existing['presente'] = attendance_input.presente
        if isinstance(existing.get('created_at'), str):
            existing['created_at'] = datetime.fromisoformat(existing['created_at'])
        return Attendance(**existing)
    
    attendance_obj = Attendance(**attendance_input.model_dump())
    doc = attendance_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.attendance.insert_one(doc)
    return attendance_obj

@api_router.get("/attendance")
async def get_attendance_by_date(fecha: str, current_user: str = Depends(get_current_user)):
    attendance_records = await db.attendance.find({"fecha": fecha}, {"_id": 0}).to_list(1000)
    for record in attendance_records:
        if isinstance(record.get('created_at'), str):
            record['created_at'] = datetime.fromisoformat(record['created_at'])
    return attendance_records

@api_router.get("/attendance/person/{person_id}")
async def get_person_attendance(person_id: str, tipo: str, current_user: str = Depends(get_current_user)):
    records = await db.attendance.find({"person_id": person_id, "tipo": tipo}, {"_id": 0}).to_list(1000)
    for record in records:
        if isinstance(record.get('created_at'), str):
            record['created_at'] = datetime.fromisoformat(record['created_at'])
    return records

# Reports endpoints
@api_router.get("/reports/by-date-range")
async def get_report_by_date_range(
    start: str, 
    end: str, 
    tipo: str = "all",
    current_user: str = Depends(get_current_user)
):
    query = {"fecha": {"$gte": start, "$lte": end}}
    if tipo != "all":
        query["tipo"] = tipo
    
    records = await db.attendance.find(query, {"_id": 0}).to_list(10000)
    
    # Calculate statistics
    total_records = len(records)
    present_count = sum(1 for r in records if r['presente'])
    absent_count = total_records - present_count
    
    return {
        "records": records,
        "statistics": {
            "total": total_records,
            "present": present_count,
            "absent": absent_count,
            "attendance_rate": round((present_count / total_records * 100) if total_records > 0 else 0, 2)
        }
    }

@api_router.get("/reports/individual/{person_id}")
async def get_individual_report(
    person_id: str,
    tipo: str,
    start: Optional[str] = None,
    end: Optional[str] = None,
    current_user: str = Depends(get_current_user)
):
    query = {"person_id": person_id, "tipo": tipo}
    if start and end:
        query["fecha"] = {"$gte": start, "$lte": end}
    
    records = await db.attendance.find(query, {"_id": 0}).to_list(10000)
    
    total_records = len(records)
    present_count = sum(1 for r in records if r['presente'])
    absent_count = total_records - present_count
    
    return {
        "person_id": person_id,
        "tipo": tipo,
        "records": records,
        "statistics": {
            "total": total_records,
            "present": present_count,
            "absent": absent_count,
            "attendance_rate": round((present_count / total_records * 100) if total_records > 0 else 0, 2)
        }
    }

@api_router.get("/reports/collective")
async def get_collective_report(
    start: str,
    end: str,
    current_user: str = Depends(get_current_user)
):
    query = {"fecha": {"$gte": start, "$lte": end}}
    records = await db.attendance.find(query, {"_id": 0}).to_list(10000)
    
    # Group by date
    dates = {}
    for record in records:
        fecha = record['fecha']
        if fecha not in dates:
            dates[fecha] = {'members': 0, 'visitors': 0, 'total': 0}
        if record['presente']:
            dates[fecha]['total'] += 1
            if record['tipo'] == 'member':
                dates[fecha]['members'] += 1
            else:
                dates[fecha]['visitors'] += 1
    
    return {
        "date_range": {"start": start, "end": end},
        "by_date": dates,
        "total_records": len(records),
        "total_present": sum(1 for r in records if r['presente'])
    }

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: str = Depends(get_current_user)):
    # Get counts
    total_members = await db.members.count_documents({})
    total_visitors = await db.visitors.count_documents({})
    
    # Get today's attendance
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    today_attendance = await db.attendance.find({"fecha": today, "presente": True}, {"_id": 0}).to_list(1000)
    
    # Get this month's stats
    first_day = datetime.now(timezone.utc).replace(day=1).strftime('%Y-%m-%d')
    last_day = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    month_attendance = await db.attendance.find({
        "fecha": {"$gte": first_day, "$lte": last_day},
        "presente": True
    }, {"_id": 0}).to_list(10000)
    
    return {
        "total_members": total_members,
        "total_visitors": total_visitors,
        "today_attendance": len(today_attendance),
        "month_attendance": len(month_attendance)
    }

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()