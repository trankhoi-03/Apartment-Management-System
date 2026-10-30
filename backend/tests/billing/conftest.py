"""Isolated PostgreSQL API tests. NEVER connects to production."""
import os
from urllib.parse import urlsplit

url = os.getenv('TEST_DATABASE_URL', '')
parsed = urlsplit(url)
if not url or parsed.scheme not in ('postgresql', 'postgresql+psycopg2') or parsed.hostname not in ('localhost','127.0.0.1') or not parsed.path.strip('/').endswith('_test'):
    raise RuntimeError('Set TEST_DATABASE_URL=postgresql://...@localhost:5432/boarding_test (dedicated local *_test DB only).')
os.environ['DATABASE_URL'] = url
os.environ.setdefault('SECRET_KEY', 'test-only-never-use-in-production')
from cryptography.fernet import Fernet
os.environ.setdefault('ENCRYPTION_KEY', Fernet.generate_key().decode())

import pytest
from datetime import date
from fastapi import FastAPI, Header, HTTPException, Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool
from app.models import Base, User, House, Room, Tenant, Contract, UtilityRate, UtilityReading, Bill
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.routers.bill_router import router as bill_router

@pytest.fixture(scope='session')
def engine():
    eng = create_engine(url, poolclass=NullPool)
    if inspect(eng).get_table_names():
        eng.dispose()
        raise RuntimeError('Refusing to use a nonempty database. Create a fresh dedicated boarding_test database.')
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()

@pytest.fixture()
def db(engine):
    with engine.connect() as connection:
        outer = connection.begin()
        session = Session(bind=connection, join_transaction_mode='create_savepoint', expire_on_commit=False)
        try:
            yield session
        finally:
            session.close()
            outer.rollback()

@pytest.fixture()
def setup(db):
    owner_a = User(full_name='Owner A',phone='0900000001',password_hash='x',role='owner')
    owner_c = User(full_name='Owner C',phone='0900000002',password_hash='x',role='owner')
    staff = User(full_name='Staff A',phone='0900000003',password_hash='x',role='staff')
    a = House(name='Test A'); c = House(name='Test C')
    a.managers.extend([owner_a,staff]); c.managers.append(owner_c)
    db.add_all([owner_a,owner_c,staff,a,c]);db.flush()
    d={}
    for key,house,meter in [('fixed',a,True),('split',a,True),('no_meter',a,False),('cross',c,True),('ended',a,True)]:
        room=Room(room_number=key, house_id=house.id, cost_price=0,is_water_meter=meter,status='occupied')
        tenant=Tenant(full_name=key,phone='099'+str(len(d)).zfill(7),owner_id=owner_a.id if house==a else owner_c.id)
        db.add_all([room,tenant]);db.flush()
        contract=Contract(room_id=room.id,tenant_id=tenant.id,start_date=date(2026,10,1),monthly_rent=5000000,status='ended' if key=='ended' else 'active',electric_calc_method='split_ratio' if key=='split' else 'fixed_price')
        rate=UtilityRate(room_id=room.id,electric_price=3500,water_price=16000 if meter else 0,default_water_amount=None if meter else 120000,effective_from=date(2026,10,1))
        reading=UtilityReading(room_id=room.id,billing_month='2026-10',electric_old=100,electric_new=120,water_old=50 if meter else 0,water_new=55 if meter else 0)
        db.add_all([contract,rate,reading]);db.flush()
        d[key]={'room':room,'contract':contract,'rate':rate,'reading':reading}
    d['users']={'owner':owner_a,'cross':owner_c,'staff':staff}
    db.commit()
    return d

@pytest.fixture()
def client(db,setup):
    app=FastAPI()
    app.include_router(bill_router)
    def override_db():
        yield db
    def override_user(x_test_user: str = Header(default='owner')):
        
        user = setup['users'].get(x_test_user)
        if user is None:
            raise HTTPException(status_code=401, detail='Unknown test user')
        return user
    app.dependency_overrides[get_db]=override_db
    app.dependency_overrides[get_current_user]=override_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture()
def generate(client,setup):
    def make(key='fixed', **extras):
        data={'contract_id':setup[key]['contract'].id,'billing_month':'2026-10','rent_amount':5000000,'electric_calc_method':'split_ratio' if key=='split' else 'fixed_price', 'service_fee':50000}
        if key=='split': data.update(electric_total_consumed=100,electric_total_cost=350000)
        data.update(extras)
        return client.post('/bills/generate',json=data)
    return make
