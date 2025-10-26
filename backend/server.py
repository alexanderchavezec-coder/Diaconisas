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
from sheets_cache import sheets_cache
import pytz

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Timezone configuration
EASTERN_TZ = pytz.timezone('America/New_York')

# Helper function to get current Eastern Time
def get_eastern_now():
    """Get current datetime in Eastern timezone"""
    return datetime.now(EASTERN_TZ)

def get_eastern_today():
    """Get today's date in Eastern timezone as YYYY-MM-DD string"""
    return get_eastern_now().strftime('%Y-%m-%d')

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
    created_at: datetime = Field(default_factory=get_eastern_now)

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
    fecha_registro: datetime = Field(default_factory=get_eastern_now)

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
    fecha_registro: datetime = Field(default_factory=get_eastern_now)

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
    created_at: datetime = Field(default_factory=get_eastern_now)

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
    expire = get_eastern_now() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
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

# Member endpoints (Google Sheets con caché)
@api_router.post("/members", response_model=Member)
async def create_member(member_input: MemberCreate, current_user: str = Depends(get_current_user)):
    member_obj = Member(**member_input.model_dump())
    values = [member_obj.id, member_obj.nombre, member_obj.apellido, member_obj.direccion, member_obj.telefono, member_obj.fecha_registro.isoformat()]
    sheets_service.append_row('Miembros', values)
    sheets_cache.invalidate('Miembros')  # Invalidar caché
    return member_obj

@api_router.get("/members", response_model=List[Member])
async def get_members(current_user: str = Depends(get_current_user)):
    # Intentar obtener del caché
    cached_data = sheets_cache.get('Miembros')
    if cached_data is not None:
        records = cached_data
    else:
        records = sheets_service.read_all('Miembros')
        sheets_cache.set('Miembros', records)
    
    members = []
    for record in records:
        if record.get('id'):
            # Handle empty fecha_registro
            fecha_str = record.get('fecha_registro', '').strip()
            if not fecha_str:
                fecha_registro = get_eastern_now()
            else:
                try:
                    fecha_registro = datetime.fromisoformat(fecha_str)
                except ValueError:
                    fecha_registro = get_eastern_now()
            
            members.append(Member(
                id=record['id'],
                nombre=record.get('nombre', ''),
                apellido=record.get('apellido', ''),
                direccion=record.get('direccion', ''),
                telefono=str(record.get('telefono', '')),
                fecha_registro=fecha_registro
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
        telefono=str(record.get('telefono', '')),
        fecha_registro=datetime.fromisoformat(record.get('fecha_registro', get_eastern_now().isoformat()))
    )

@api_router.put("/members/{member_id}", response_model=Member)
async def update_member(member_id: str, member_input: MemberCreate, current_user: str = Depends(get_current_user)):
    record = sheets_service.find_row_by_id('Miembros', member_id)
    if not record:
        raise HTTPException(status_code=404, detail="Member not found")
    values = [member_id, member_input.nombre, member_input.apellido, member_input.direccion, member_input.telefono, record.get('fecha_registro', get_eastern_now().isoformat())]
    sheets_service.update_row('Miembros', record['_row'], values)
    sheets_cache.invalidate('Miembros')
    return Member(id=member_id, nombre=member_input.nombre, apellido=member_input.apellido, direccion=member_input.direccion, telefono=member_input.telefono, fecha_registro=datetime.fromisoformat(record.get('fecha_registro', get_eastern_now().isoformat())))

@api_router.delete("/members/{member_id}")
async def delete_member(member_id: str, current_user: str = Depends(get_current_user)):
    record = sheets_service.find_row_by_id('Miembros', member_id)
    if not record:
        raise HTTPException(status_code=404, detail="Member not found")
    sheets_service.delete_row('Miembros', record['_row'])
    sheets_cache.invalidate('Miembros')
    return {"message": "Member deleted successfully"}

# Visitor endpoints (Google Sheets con caché)
@api_router.post("/visitors", response_model=Visitor)
async def create_visitor(visitor_input: VisitorCreate, current_user: str = Depends(get_current_user)):
    visitor_obj = Visitor(**visitor_input.model_dump())
    values = [visitor_obj.id, visitor_obj.nombre, visitor_obj.de_donde_viene, visitor_obj.fecha_registro.isoformat()]
    sheets_service.append_row('Amigos', values)
    sheets_cache.invalidate('Amigos')
    
    # Automatically mark attendance for today
    today = get_eastern_today()
    attendance_obj = Attendance(
        tipo='friend',
        person_id=visitor_obj.id,
        person_name=visitor_obj.nombre,
        fecha=today,
        presente=True
    )
    attendance_values = [
        attendance_obj.tipo,
        attendance_obj.person_id,
        attendance_obj.person_name,
        attendance_obj.fecha,
        'TRUE',
        attendance_obj.id,
        attendance_obj.created_at.isoformat()
    ]
    sheets_service.append_row('Asistencia', attendance_values)
    sheets_cache.invalidate('Asistencia')
    
    logger.info(f"Auto-attendance created for new friend: {visitor_obj.nombre} on {today}")
    
    return visitor_obj

@api_router.get("/visitors", response_model=List[Visitor])
async def get_visitors(current_user: str = Depends(get_current_user)):
    cached_data = sheets_cache.get('Amigos')
    if cached_data is not None:
        records = cached_data
    else:
        records = sheets_service.read_all('Amigos')
        sheets_cache.set('Amigos', records)
    
    visitors = []
    for record in records:
        if record.get('id'):
            visitors.append(Visitor(
                id=record['id'],
                nombre=record.get('nombre', ''),
                de_donde_viene=record.get('de_donde_viene', ''),
                fecha_registro=datetime.fromisoformat(record.get('fecha_registro', get_eastern_now().isoformat()))
            ))
    return visitors

@api_router.get("/visitors/{visitor_id}", response_model=Visitor)
async def get_visitor(visitor_id: str, current_user: str = Depends(get_current_user)):
    record = sheets_service.find_row_by_id('Amigos', visitor_id)
    if not record:
        raise HTTPException(status_code=404, detail="Visitor not found")
    return Visitor(id=record['id'], nombre=record.get('nombre', ''), de_donde_viene=record.get('de_donde_viene', ''), fecha_registro=datetime.fromisoformat(record.get('fecha_registro', get_eastern_now().isoformat())))

@api_router.put("/visitors/{visitor_id}", response_model=Visitor)
async def update_visitor(visitor_id: str, visitor_input: VisitorCreate, current_user: str = Depends(get_current_user)):
    record = sheets_service.find_row_by_id('Amigos', visitor_id)
    if not record:
        raise HTTPException(status_code=404, detail="Visitor not found")
    values = [visitor_id, visitor_input.nombre, visitor_input.de_donde_viene, record.get('fecha_registro', get_eastern_now().isoformat())]
    sheets_service.update_row('Amigos', record['_row'], values)
    sheets_cache.invalidate('Amigos')
    return Visitor(id=visitor_id, nombre=visitor_input.nombre, de_donde_viene=visitor_input.de_donde_viene, fecha_registro=datetime.fromisoformat(record.get('fecha_registro', get_eastern_now().isoformat())))

@api_router.delete("/visitors/{visitor_id}")
async def delete_visitor(visitor_id: str, current_user: str = Depends(get_current_user)):
    record = sheets_service.find_row_by_id('Amigos', visitor_id)
    if not record:
        raise HTTPException(status_code=404, detail="Visitor not found")
    sheets_service.delete_row('Amigos', record['_row'])
    sheets_cache.invalidate('Amigos')
    return {"message": "Visitor deleted successfully"}

# Attendance endpoints (Google Sheets con caché)
@api_router.post("/attendance", response_model=Attendance)
async def create_attendance(attendance_input: AttendanceCreate, current_user: str = Depends(get_current_user)):
    try:
        # Get cached data or read from sheets
        cached_data = sheets_cache.get('Asistencia')
        if not cached_data:
            cached_data = sheets_service.read_all('Asistencia')
            sheets_cache.set('Asistencia', cached_data)
        
        records = list(cached_data)  # Make a copy
        
        existing_row = None
        existing_record_idx = None
        for idx, record in enumerate(records):
            if str(record.get('person_id', '')) == str(attendance_input.person_id) and record.get('fecha') == attendance_input.fecha:
                existing_row = idx + 2  # Sheet row number
                existing_record_idx = idx
                break
        
        if existing_row:
            record_id = records[existing_record_idx].get('id', str(uuid.uuid4()))
            values = [attendance_input.tipo, attendance_input.person_id, attendance_input.person_name, attendance_input.fecha, 'TRUE' if attendance_input.presente else 'FALSE', record_id, get_eastern_now().isoformat()]
            sheets_service.update_row('Asistencia', existing_row, values)
            
            # Update cache in-memory instead of invalidating
            records[existing_record_idx] = {
                'tipo': attendance_input.tipo,
                'person_id': attendance_input.person_id,
                'person_name': attendance_input.person_name,
                'fecha': attendance_input.fecha,
                'presente': 'TRUE' if attendance_input.presente else 'FALSE',
                'id': record_id,
                'created_at': get_eastern_now().isoformat()
            }
            sheets_cache.set('Asistencia', records)
            
            return Attendance(id=record_id, tipo=attendance_input.tipo, person_id=attendance_input.person_id, person_name=attendance_input.person_name, fecha=attendance_input.fecha, presente=attendance_input.presente, created_at=get_eastern_now())
        
        attendance_obj = Attendance(**attendance_input.model_dump())
        values = [attendance_obj.tipo, attendance_obj.person_id, attendance_obj.person_name, attendance_obj.fecha, 'TRUE' if attendance_obj.presente else 'FALSE', attendance_obj.id, attendance_obj.created_at.isoformat()]
        
        logger.info(f"Saving attendance: tipo={attendance_obj.tipo}, person_id={attendance_obj.person_id}, person_name={attendance_obj.person_name}, fecha={attendance_obj.fecha}, presente={attendance_obj.presente}")
        
        sheets_service.append_row('Asistencia', values)
        
        # Add to cache instead of invalidating
        new_record = {
            'tipo': attendance_obj.tipo,
            'person_id': attendance_obj.person_id,
            'person_name': attendance_obj.person_name,
            'fecha': attendance_obj.fecha,
            'presente': 'TRUE' if attendance_obj.presente else 'FALSE',
            'id': attendance_obj.id,
            'created_at': attendance_obj.created_at.isoformat()
        }
        records.append(new_record)
        sheets_cache.set('Asistencia', records)
        
        logger.info(f"Attendance saved successfully. Cache updated with {len(records)} records")
        
        return attendance_obj
    except Exception as e:
        logger.error(f"Error saving attendance: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al guardar asistencia: {str(e)}")

@api_router.get("/attendance")
async def get_attendance_by_date(fecha: str, current_user: str = Depends(get_current_user)):
    cached_data = sheets_cache.get('Asistencia')
    records = cached_data if cached_data else sheets_service.read_all('Asistencia')
    if not cached_data:
        sheets_cache.set('Asistencia', records)
    return [{'id': r.get('id',''), 'tipo': r.get('tipo',''), 'person_id': r.get('person_id',''), 'person_name': r.get('person_name',''), 'fecha': r.get('fecha',''), 'presente': r.get('presente','FALSE').upper()=='TRUE', 'created_at': r.get('created_at',get_eastern_now().isoformat())} for r in records if r.get('fecha')==fecha]

@api_router.get("/attendance/person/{person_id}")
async def get_person_attendance(person_id: str, tipo: str, current_user: str = Depends(get_current_user)):
    cached_data = sheets_cache.get('Asistencia')
    records = cached_data if cached_data else sheets_service.read_all('Asistencia')
    if not cached_data:
        sheets_cache.set('Asistencia', records)
    return [{'id': r.get('id',''), 'tipo': r.get('tipo',''), 'person_id': r.get('person_id',''), 'person_name': r.get('person_name',''), 'fecha': r.get('fecha',''), 'presente': r.get('presente','FALSE').upper()=='TRUE', 'created_at': r.get('created_at',get_eastern_now().isoformat())} for r in records if str(r.get('person_id',''))==str(person_id) and r.get('tipo')==tipo]

@api_router.get("/attendance/today")
async def get_today_attendance(current_user: str = Depends(get_current_user)):
    """Get list of people who have attendance marked for today"""
    today = get_eastern_today()
    logger.info(f"Getting attendance for today: {today}")
    
    # Force refresh from sheets to ensure latest data
    records = sheets_service.read_all('Asistencia')
    sheets_cache.set('Asistencia', records)
    
    logger.info(f"Total attendance records: {len(records)}")
    
    # Return list of person_ids with attendance today (both present and absent)
    today_people = []
    for r in records:
        fecha_record = r.get('fecha', '')
        logger.info(f"Checking record: person_id={r.get('person_id')}, tipo={r.get('tipo')}, fecha={fecha_record}, today={today}")
        if fecha_record == today:
            today_people.append({
                'person_id': r.get('person_id', ''),
                'tipo': r.get('tipo', ''),
                'presente': r.get('presente', 'FALSE').upper() == 'TRUE'
            })
    
    logger.info(f"Attendance for today ({today}): {len(today_people)} people - {today_people}")
    return today_people

# Reports endpoints (Google Sheets con caché)
@api_router.get("/reports/by-date-range")
async def get_report_by_date_range(start: str, end: str, tipo: str = "all", current_user: str = Depends(get_current_user)):
    cached_data = sheets_cache.get('Asistencia')
    records = cached_data if cached_data else sheets_service.read_all('Asistencia')
    if not cached_data:
        sheets_cache.set('Asistencia', records)
    
    filtered = []
    for r in records:
        if start <= r.get('fecha','') <= end:
            rt = r.get('tipo','')
            if tipo=="all" or (tipo=="visitor" and rt in ['visitor','friend']) or tipo==rt:
                filtered.append({'tipo':rt, 'person_id':r.get('person_id',''), 'person_name':r.get('person_name',''), 'fecha':r.get('fecha',''), 'presente':r.get('presente','FALSE').upper()=='TRUE'})
    
    total_records = len(filtered)
    present_count = sum(1 for r in filtered if r['presente'])
    return {"records": filtered, "statistics": {"total": total_records, "present": present_count, "absent": total_records-present_count, "attendance_rate": round((present_count/total_records*100) if total_records>0 else 0, 2)}}

@api_router.get("/reports/individual/{person_id}")
async def get_individual_report(person_id: str, tipo: str, start: Optional[str] = None, end: Optional[str] = None, current_user: str = Depends(get_current_user)):
    cached_data = sheets_cache.get('Asistencia')
    records = cached_data if cached_data else sheets_service.read_all('Asistencia')
    if not cached_data:
        sheets_cache.set('Asistencia', records)
    
    filtered = []
    for r in records:
        if str(r.get('person_id',''))==str(person_id) and r.get('tipo')==tipo:
            rd = r.get('fecha','')
            if (not start or not end) or (start <= rd <= end):
                filtered.append({'fecha':rd, 'presente':r.get('presente','FALSE').upper()=='TRUE'})
    
    total_records = len(filtered)
    present_count = sum(1 for r in filtered if r['presente'])
    return {"person_id": person_id, "tipo": tipo, "records": filtered, "statistics": {"total": total_records, "present": present_count, "absent": total_records-present_count, "attendance_rate": round((present_count/total_records*100) if total_records>0 else 0, 2)}}

@api_router.get("/reports/collective")
async def get_collective_report(start: str, end: str, current_user: str = Depends(get_current_user)):
    cached_data = sheets_cache.get('Asistencia')
    records = cached_data if cached_data else sheets_service.read_all('Asistencia')
    if not cached_data:
        sheets_cache.set('Asistencia', records)
    
    dates = {}
    for r in records:
        rd = r.get('fecha','')
        if start <= rd <= end:
            if rd not in dates:
                dates[rd] = {'members':0, 'visitors':0, 'total':0}
            if r.get('presente','FALSE').upper()=='TRUE':
                dates[rd]['total'] += 1
                rt = r.get('tipo','')
                if rt=='member':
                    dates[rd]['members'] += 1
                elif rt in ['visitor','friend']:
                    dates[rd]['visitors'] += 1
    
    total_records = sum(1 for r in records if start <= r.get('fecha','') <= end)
    total_present = sum(dates[d]['total'] for d in dates)
    return {"date_range": {"start": start, "end": end}, "by_date": dates, "total_records": total_records, "total_present": total_present}

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: str = Depends(get_current_user)):
    members = sheets_cache.get('Miembros') or sheets_service.read_all('Miembros')
    visitors = sheets_cache.get('Amigos') or sheets_service.read_all('Amigos')
    attendance = sheets_cache.get('Asistencia') or sheets_service.read_all('Asistencia')
    
    total_members = len([m for m in members if m.get('id')])
    total_visitors = len([v for v in visitors if v.get('id')])
    
    today = get_eastern_today()
    today_attendance = sum(1 for a in attendance if a.get('fecha')==today and a.get('presente','FALSE').upper()=='TRUE')
    
    eastern_now = get_eastern_now()
    first_day = eastern_now.replace(day=1).strftime('%Y-%m-%d')
    last_day = eastern_now.strftime('%Y-%m-%d')
    month_attendance = sum(1 for a in attendance if first_day <= a.get('fecha','') <= last_day and a.get('presente','FALSE').upper()=='TRUE')
    
    return {"total_members": total_members, "total_visitors": total_visitors, "today_attendance": today_attendance, "month_attendance": month_attendance}

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