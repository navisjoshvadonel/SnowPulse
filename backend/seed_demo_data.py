import os
import datetime
import random
import polars as pl
from app.database import SessionLocal, engine, Base
from app.models import User, Dataset
from app.auth import get_password_hash

def seed_demo_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # 1. Seed or get demo user user@snowpulse.ai
    user = db.query(User).filter(User.email == "user@snowpulse.ai").first()
    if not user:
        user = User(
            email="user@snowpulse.ai",
            hashed_password=get_password_hash("password123"),
            is_active=True,
            failed_attempts=0
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"Created demo user: {user.email} (id: {user.id})")
    else:
        print(f"Demo user exists: {user.email} (id: {user.id})")

    # 2. Generate a rich sample CSV dataset
    local_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "local_storage", "datasets"))
    os.makedirs(local_dir, exist_ok=True)
    csv_file_path = os.path.join(local_dir, "sample_enterprise_sales.csv")

    regions = ["North America", "Europe", "APAC", "LATAM"]
    categories = ["Cloud Infrastructure", "AI Copilot", "Security Suite", "Data Warehouse"]
    
    start_date = datetime.date(2025, 1, 1)
    data = []
    
    for i in range(120):
        current_date = start_date + datetime.timedelta(days=i * 3)
        region = random.choice(regions)
        category = random.choice(categories)
        base_rev = 12000 if region == "North America" else 8500 if region == "Europe" else 9500
        
        # Inject occasional anomaly for rich visual feedback
        anomaly_mult = 3.8 if i in [22, 55, 89] else 1.0
        revenue = round(random.uniform(base_rev * 0.8, base_rev * 1.4) * anomaly_mult, 2)
        units_sold = int(revenue / random.uniform(150, 250))
        satisfaction = round(random.uniform(4.0, 5.0), 2)
        
        data.append({
            "date": current_date.strftime("%Y-%m-%d"),
            "region": region,
            "category": category,
            "revenue": revenue,
            "units_sold": units_sold,
            "satisfaction_score": satisfaction
        })

    df = pl.DataFrame(data)
    df.write_csv(csv_file_path)
    print(f"Generated sample dataset CSV at: {csv_file_path}")

    # 3. Register dataset in DB if not already registered
    dataset = db.query(Dataset).filter(Dataset.owner_id == user.id, Dataset.name == "Global Enterprise Revenue & Performance").first()
    if not dataset:
        dataset = Dataset(
            name="Global Enterprise Revenue & Performance",
            description="Operational telemetry, regional performance, and anomaly detection dataset",
            file_path=csv_file_path,
            owner_id=user.id,
            created_at=datetime.datetime.utcnow()
        )
        db.add(dataset)
        db.commit()
        db.refresh(dataset)
        print(f"Registered demo dataset ID: {dataset.id}")
    else:
        # Ensure path is updated to local path
        dataset.file_path = csv_file_path
        db.commit()
        print(f"Updated demo dataset ID: {dataset.id}")

    db.close()

if __name__ == "__main__":
    seed_demo_data()
