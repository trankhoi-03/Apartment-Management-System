"""End-to-end FastAPI route contract + isolated DB regression suite."""
import pytest
from app.models.bill import Bill
from app.models.utility_rate import UtilityRate
from datetime import date


def assert_money(data, **expected):
    for field,value in expected.items(): assert float(data[field]) == pytest.approx(value), (field,data[field],value)

def test_B01_fixed_snapshot(generate):
    r=generate('fixed');assert r.status_code==201,r.text
    assert_money(r.json(),electric_amount=70000,water_amount=80000,electric_unit_price=3500,water_unit_price=16000)

def test_B02_snapshot_survives_new_rate(generate,client,setup,db):
    r=generate('fixed');assert r.status_code==201,r.text
    db.add(UtilityRate(room_id=setup['fixed']['room'].id,electric_price=0,water_price=0,effective_from=date(2026,10,20)));db.commit()
    r=client.patch(f'/bills/{r.json()["id"]}/edit',json={'electric_new':125,'water_new':56})
    assert r.status_code==200,r.text
    assert_money(r.json(),electric_amount=87500,water_amount=96000,electric_unit_price=3500,water_unit_price=16000)

def test_B03_ended_contract_bill_edit(client,setup,db):
    x=setup['ended'];b=make_bill(db,x,ended=True)
    r=client.patch(f'/bills/{b.id}/edit',json={'electric_new':125,'water_new':56})
    assert r.status_code==200,r.text
    assert_money(r.json(),electric_amount=87500,water_amount=96000)

def make_bill(db,x,legacy=False,ended=False,method='fixed_price',status='pending'):
    b=Bill(contract_id=x['contract'].id,billing_month='2026-10',rent_amount=5000000,electric_amount=70000,water_amount=80000 if x['room'].is_water_meter else 120000,service_fee=50000,cleaning_fee=0,internet_fee=0,additional_fee=0,discount_amount=0,total_amount=5200000,electric_consumed=20,water_consumed=5 if x['room'].is_water_meter else 0,status=status,electric_calc_method=method,electric_total_consumed=100 if method=='split_ratio' else None,electric_total_cost=350000 if method=='split_ratio' else None,electric_unit_price=None if legacy or method=='split_ratio' else 3500,water_unit_price=None if legacy or not x['room'].is_water_meter else 16000)
    db.add(b);db.commit();return b

def test_B04_legacy_requires_price(client,setup,db):
    b=make_bill(db,setup['fixed'],legacy=True)
    r=client.patch(f'/bills/{b.id}/edit',json={'electric_new':125,'water_new':56})
    assert r.status_code==422,r.text
    db.refresh(b);assert b.electric_unit_price is None

def test_B05_legacy_confirm(client,setup,db):
    b=make_bill(db,setup['fixed'],legacy=True)
    r=client.patch(f'/bills/{b.id}/edit',json={'electric_new':125,'water_new':56,'electric_unit_price':3500,'water_unit_price':16000})
    assert r.status_code==200,r.text
    assert_money(r.json(),electric_amount=87500,water_amount=96000)
    r=client.patch(f'/bills/{b.id}/edit',json={'electric_new':130,'water_new':57})
    assert r.status_code==200,r.text

def test_B06_intentional_zero(client,setup,db):
    b=make_bill(db,setup['fixed'],legacy=True)
    r=client.patch(f'/bills/{b.id}/edit',json={'electric_unit_price':0,'water_unit_price':0})
    assert r.status_code==200,r.text
    assert_money(r.json(),electric_amount=0,water_amount=0)

def test_B07_cannot_overwrite_snapshot(client,setup,db):
    b=make_bill(db,setup['fixed'])
    r=client.patch(f'/bills/{b.id}/edit',json={'electric_unit_price':4000})
    assert r.status_code==409,r.text
    db.refresh(b);assert float(b.electric_unit_price)==3500

def test_B08_no_meter_fixed_water(generate,client):
    r=generate('no_meter');assert r.status_code==201,r.text
    assert_money(r.json(),water_amount=120000,water_consumed=0)
    r=client.patch(f'/bills/{r.json()["id"]}/edit',json={'electric_new':125,'default_water_amount':130000})
    assert r.status_code==200,r.text
    assert_money(r.json(),water_amount=130000,water_consumed=0)

def test_B09_split_ratio(generate,client):
    r=generate('split');assert r.status_code==201,r.text
    assert_money(r.json(),electric_amount=70000,water_amount=80000)
    r=client.patch(f'/bills/{r.json()["id"]}/edit',json={'electric_new':130})
    assert r.status_code==200,r.text
    assert_money(r.json(),electric_amount=105000)

def test_B10_split_invalid_total(generate,client):
    r=generate('split');assert r.status_code==201,r.text
    r=client.patch(f'/bills/{r.json()["id"]}/edit',json={'electric_total_consumed':0})
    assert r.status_code==422,r.text

def test_B11_fixed_to_split(generate,client):
    r=generate('fixed');assert r.status_code==201,r.text
    r=client.patch(f'/bills/{r.json()["id"]}/edit',json={'electric_calc_method':'split_ratio','electric_total_consumed':100,'electric_total_cost':350000,'electric_new':130})
    assert r.status_code==200,r.text
    assert_money(r.json(),electric_amount=105000)

def test_B12_split_to_fixed_requires_confirm(generate,client):
    r=generate('split');assert r.status_code==201,r.text
    bill_id=r.json()['id']
    r=client.patch(f'/bills/{bill_id}/edit',json={'electric_calc_method':'fixed_price'})
    assert r.status_code==422,r.text
    r=client.patch(f'/bills/{bill_id}/edit',json={'electric_calc_method':'fixed_price','electric_unit_price':3500})
    assert r.status_code==200,r.text

def test_B13_paid_bill_edit_preserves_status(client,setup,db):
    b=make_bill(db,setup['fixed'],status='paid')
    r=client.patch(f'/bills/{b.id}/edit',json={'electric_new':125})
    assert r.status_code==200,r.text
    assert r.json()['status']=='paid'

def test_B14_cross_owner_edit(client,setup,db):
    b=make_bill(db,setup['cross'])
    assert client.patch(f'/bills/{b.id}/edit',json={'electric_new':125}).status_code==403

def test_B15_staff_cannot_edit(client,setup,db):
    b=make_bill(db,setup['fixed'])
    assert client.patch(f'/bills/{b.id}/edit',json={'electric_new':125},headers={'x-test-user':'staff'}).status_code==403

def test_B16_water_below_old(client,setup,db):
    b=make_bill(db,setup['fixed']);r=client.patch(f'/bills/{b.id}/edit',json={'water_new':40})
    assert r.status_code==400,r.text

def test_B17_month_move(client,setup,db):
    b=make_bill(db,setup['fixed']);r=client.patch(f'/bills/{b.id}/edit',json={'billing_month':'2026-12'})
    assert r.status_code==200,r.text
    assert r.json()['billing_month']=='2026-12'

def test_B18_other_bill_not_modified(client,setup,db):
    one=make_bill(db,setup['fixed']);other=make_bill(db,setup['cross'])
    before=client.get(f'/bills/{other.id}',headers={'x-test-user':'cross'}).json()
    r=client.patch(f'/bills/{one.id}/edit',json={'electric_new':125})
    assert r.status_code==200,r.text
    after=client.get(f'/bills/{other.id}',headers={'x-test-user':'cross'}).json()
    assert before==after

@pytest.mark.parametrize('case,method,path,user,expected',[
 ('BA01','get','/bills','owner',200),('BA02','get','/bills','staff',200),
 ('BA03','get','/bills/{cross}','owner',403),('BA04','get','/bills/{own}','staff',200),
 ('BA05','get','/bills/{cross}/utility-reading','staff',403),
 ('BA06','post','/bills/generate','owner',403),('BA07','post','/bills/generate','staff',403),
 ('BA08','post','/bills/generate','staff',201),
 ('BA09','patch','/bills/{cross}','owner',403),('BA10','patch','/bills/{own}','staff',403),
 ('BA11','patch','/bills/{cross}/edit','owner',403),('BA12','patch','/bills/{own}/edit','staff',403),
 ('BA13','delete','/bills/{cross}','owner',403),('BA14','post','/bills/{cross}/send','owner',403),
])
def test_authorization(case,method,path,user,expected,client,setup,db):
    own=make_bill(db,setup['fixed']);cross=make_bill(db,setup['cross'])
    path=path.format(own=own.id,cross=cross.id)
    payload=None
    if '/generate' in path:
        c=setup['cross']['contract'] if case in ('BA06','BA07') else setup['split']['contract']
        payload={'contract_id':c.id,'billing_month':'2026-10','electric_calc_method':'split_ratio' if case=='BA08' else 'fixed_price'}
        if case=='BA08':payload.update(electric_total_consumed=100,electric_total_cost=350000)
    elif method=='patch':payload={'status':'paid'} if path.endswith(str(own.id)) or path.endswith(str(cross.id)) else {'electric_new':125}
    r=getattr(client,method)(path,headers={'x-test-user':user},**({'json':payload} if payload else {}))
    assert r.status_code==expected,(case,r.status_code,r.text)
    if case=='BA01': assert all(x['contract_id']!=cross.contract_id for x in r.json())
    if case=='BA02': assert all(x['contract_id']!=cross.contract_id for x in r.json())
