"""Copy into tests/billing/ with existing conftest.py and test_api.py."""
from app.models.bill import Bill
from app.models.utility_reading import UtilityReading
from test_api import make_bill


def state(db, bill):
    db.refresh(bill)
    reading = db.query(UtilityReading).filter_by(room_id=bill.contract.room_id, billing_month=bill.billing_month).first()
    return (float(bill.electric_amount),float(bill.water_amount),float(bill.electric_consumed),
            float(bill.water_consumed),float(bill.total_amount),float(reading.electric_old),
            float(reading.electric_new),float(reading.water_old),float(reading.water_new))


def test_BE01_empty_patch_no_change(client,db,setup):
    b=make_bill(db,setup['fixed']); before=state(db,b)
    r=client.patch(f'/bills/{b.id}/edit',json={})
    assert r.status_code==200,r.text
    assert state(db,b)==before


def test_BE02_only_service_fee(client,db,setup):
    b=make_bill(db,setup['fixed']); before=state(db,b)
    r=client.patch(f'/bills/{b.id}/edit',json={'service_fee':90000})
    assert r.status_code==200,r.text
    after=state(db,b)
    assert after[:4]==before[:4]
    assert after[5:]==before[5:]
    assert after[4]==before[4]+40000


def test_BE03_only_due_date(client,db,setup):
    b=make_bill(db,setup['fixed']); before=state(db,b)
    r=client.patch(f'/bills/{b.id}/edit',json={'due_date':'2026-11-06'})
    assert r.status_code==200,r.text
    assert state(db,b)==before
    assert r.json()['due_date']=='2026-11-06'


def test_BE04_only_electric_new(client,db,setup):
    b=make_bill(db,setup['fixed']); before=state(db,b)
    r=client.patch(f'/bills/{b.id}/edit',json={'electric_new':125})
    assert r.status_code==200,r.text
    after=state(db,b)
    assert after[1]==before[1] and after[3]==before[3]
    assert after[7:]==before[7:]
    assert after[0]==87500


def test_BE05_only_water_new(client,db,setup):
    b=make_bill(db,setup['fixed']); before=state(db,b)
    r=client.patch(f'/bills/{b.id}/edit',json={'water_new':56})
    assert r.status_code==200,r.text
    after=state(db,b)
    assert after[0]==before[0] and after[2]==before[2]
    assert after[5:7]==before[5:7]
    assert after[1]==96000


def test_BE06_same_reading_does_not_recalculate(client,db,setup):
    b=make_bill(db,setup['fixed']); reading=db.query(UtilityReading).filter_by(room_id=b.contract.room_id,billing_month=b.billing_month).first()
    before=state(db,b)
    r=client.patch(f'/bills/{b.id}/edit',json={'electric_new':reading.electric_new,'water_new':reading.water_new})
    assert r.status_code==200,r.text
    assert state(db,b)==before
