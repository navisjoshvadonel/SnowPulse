import os

import pandas as pd
import pytest
from backend.app.database import Base
from backend.app.ml.serving import MLServing
from backend.app.ml.trainer import MLTrainer
from backend.app.models import Dataset
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


@pytest.fixture
def db_session(tmp_path):
    db_file = os.path.join(tmp_path, "test.db")
    engine = create_engine(f"sqlite:///{db_file}")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()


def test_automl_trainer_and_serving(tmp_path, db_session):
    # 1. Create a complex synthetic dataset with text, datetime, numeric, and categorical columns
    csv_file = os.path.join(tmp_path, "complex_dataset.csv")
    df = pd.DataFrame({
        "signup_date": ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"] * 6,
        "user_notes": ["urgent enterprise issue", "standard support request", "billing inquiry help", "upgrade subscription plan", "technical question"] * 6,
        "region": ["US", "EU", "APAC", "US", "LATAM"] * 6,
        "monthly_spend": [120.0, 450.5, 89.0, 1200.0, 310.0] * 6,
        "churned": [0, 1, 0, 1, 0] * 6
    })
    df.to_csv(csv_file, index=False)

    # 2. Register dataset in test DB
    dataset = Dataset(
        owner_id=1,
        name="Complex AutoML Test",
        description="Testing multi-type feature engineering and tournament",
        file_path=csv_file
    )
    db_session.add(dataset)
    db_session.commit()
    db_session.refresh(dataset)

    # 3. Instantiate MLTrainer and run auto-training
    trainer = MLTrainer(db=db_session, dataset_id=dataset.id)
    results = trainer.train_model(task_type="auto")

    assert "task_type" in results
    assert "champion_model" in results
    assert results["features_used"] > 0
    assert "feature_importances" in results

    # 4. Test serving inference with new MLServing engine
    serving = MLServing(dataset_id=dataset.id, task_type=results["task_type"])
    assert serving.loaded is True

    predictions_payload = serving.predict([
        {
            "signup_date": "2025-06-15",
            "user_notes": "enterprise upgrade help",
            "region": "US",
            "monthly_spend": 999.0
        }
    ])
    assert "predictions" in predictions_payload
    assert len(predictions_payload["predictions"]) == 1
