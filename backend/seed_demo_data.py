import datetime
import os
import random

import polars as pl

from app.auth import get_password_hash
from app.database import Base, SessionLocal, engine
from app.models import Dataset, User


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

    local_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "local_storage", "datasets"))
    os.makedirs(local_dir, exist_ok=True)

    # 2. Generate Dataset 1: Global Enterprise Revenue & Performance
    csv_file_path_1 = os.path.join(local_dir, "sample_enterprise_sales.csv")
    regions = ["North America", "Europe", "APAC", "LATAM"]
    categories = ["Cloud Infrastructure", "AI Copilot", "Security Suite", "Data Warehouse"]

    start_date = datetime.date(2025, 1, 1)
    data_1 = []

    for i in range(150):
        current_date = start_date + datetime.timedelta(days=i * 2)
        region = random.choice(regions)
        category = random.choice(categories)
        base_rev = 12000 if region == "North America" else 8500 if region == "Europe" else 9500

        # Inject occasional anomalies for telemetry
        anomaly_mult = 3.8 if i in [22, 55, 89, 134] else 1.0
        revenue = round(random.uniform(base_rev * 0.8, base_rev * 1.4) * anomaly_mult, 2)
        units_sold = int(revenue / random.uniform(150, 250))
        satisfaction = round(random.uniform(4.0, 5.0), 2)

        data_1.append({
            "date": current_date.strftime("%Y-%m-%d"),
            "region": region,
            "category": category,
            "revenue": revenue,
            "units_sold": units_sold,
            "satisfaction_score": satisfaction
        })

    df1 = pl.DataFrame(data_1)
    df1.write_csv(csv_file_path_1)
    print(f"Generated Enterprise Revenue CSV at: {csv_file_path_1}")

    dataset1 = db.query(Dataset).filter(Dataset.owner_id == user.id, Dataset.name == "Global Enterprise Revenue & Performance").first()
    if not dataset1:
        dataset1 = Dataset(
            name="Global Enterprise Revenue & Performance",
            description="Operational telemetry, regional revenue performance, and anomaly detection dataset",
            file_path=csv_file_path_1,
            owner_id=user.id,
            created_at=datetime.datetime.utcnow()
        )
        db.add(dataset1)
        db.commit()
        db.refresh(dataset1)
        print(f"Registered demo dataset 1 ID: {dataset1.id}")
    else:
        dataset1.file_path = csv_file_path_1
        db.commit()
        print(f"Updated demo dataset 1 ID: {dataset1.id}")

    # 3. Generate Dataset 2: Real-World SaaS Customer Retention & Churn Analytics
    csv_file_path_2 = os.path.join(local_dir, "saas_customer_churn_analytics.csv")
    plan_tiers = ["Enterprise", "Pro", "Starter"]
    data_2 = []

    for i in range(200):
        join_date = start_date + datetime.timedelta(days=random.randint(0, 300))
        tier = random.choice(plan_tiers)
        mrr = round(random.uniform(1200, 8500) if tier == "Enterprise" else random.uniform(299, 999) if tier == "Pro" else random.uniform(49, 149), 2)
        support_tickets = random.randint(0, 14)
        active_users = random.randint(1, 450)

        # Real life dataset edge cases: missing churn scores, inconsistent regions, outliers
        churn_risk = None if i % 15 == 0 else round(random.uniform(0.05, 0.95), 2)
        region = random.choice(["North America", "USA", "Europe", "United States", "APAC", "LATAM"])

        data_2.append({
            "customer_id": f"CUST-{1000 + i}",
            "join_date": join_date.strftime("%Y-%m-%d"),
            "plan_tier": tier,
            "mrr": mrr,
            "region": region,
            "support_tickets": support_tickets,
            "active_users": active_users,
            "churn_risk_score": churn_risk
        })

    df2 = pl.DataFrame(data_2)
    df2.write_csv(csv_file_path_2)
    print(f"Generated SaaS Customer Churn CSV at: {csv_file_path_2}")

    dataset2 = db.query(Dataset).filter(Dataset.owner_id == user.id, Dataset.name == "SaaS Customer Churn & Retention Analytics").first()
    if not dataset2:
        dataset2 = Dataset(
            name="SaaS Customer Churn & Retention Analytics",
            description="Real-world customer health dataset featuring MRR, usage metrics, churn risks, and category naming variations",
            file_path=csv_file_path_2,
            owner_id=user.id,
            created_at=datetime.datetime.utcnow()
        )
        db.add(dataset2)
        db.commit()
        db.refresh(dataset2)
        print(f"Registered demo dataset 2 ID: {dataset2.id}")
    else:
        dataset2.file_path = csv_file_path_2
        db.commit()
        print(f"Updated demo dataset 2 ID: {dataset2.id}")

    db.close()

if __name__ == "__main__":
    seed_demo_data()
