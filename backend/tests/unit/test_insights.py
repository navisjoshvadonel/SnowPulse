"""Tests for backend.app.insights.automation — InsightAutomationEngine."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base
from backend.app.insights.automation import InsightAutomationEngine
from backend.app.models import Dataset, Insight


@pytest.fixture
def insight_db(tmp_path):
    db_file = os.path.join(tmp_path, "insight_test.db")
    eng = create_engine(f"sqlite:///{db_file}")
    Base.metadata.create_all(bind=eng)
    Session = sessionmaker(bind=eng)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def sample_csv_with_anomaly(tmp_path):
    csv_file = tmp_path / "anomaly_data.csv"
    content = (
        "Date,Revenue,Category,Region\n"
        "2024-01-01,100,Electronics,North\n"
        "2024-02-01,110,Electronics,North\n"
        "2024-03-01,120,Apparel,South\n"
        "2024-04-01,130,Apparel,South\n"
        "2024-05-01,5000,Electronics,East\n"  # Big anomaly
        "2024-06-01,150,Home,West\n"
        "2024-07-01,160,Electronics,North\n"
        "2024-08-01,170,Apparel,South\n"
        "2024-09-01,180,Home,East\n"
        "2024-10-01,190,Electronics,West\n"
    )
    csv_file.write_text(content)
    return str(csv_file)


def test_insight_engine_raises_for_missing_dataset(insight_db):
    with pytest.raises(ValueError, match="not found"):
        InsightAutomationEngine(db=insight_db, dataset_id=99999)


def test_insight_engine_detects_anomalies(insight_db, sample_csv_with_anomaly):
    ds = Dataset(
        owner_id=1,
        name="anomaly_test",
        file_path=sample_csv_with_anomaly,
    )
    insight_db.add(ds)
    insight_db.commit()
    insight_db.refresh(ds)

    engine = InsightAutomationEngine(db=insight_db, dataset_id=ds.id)
    insights = engine.run_detection()

    # Should have detected at least the big anomaly spike
    assert len(insights) > 0
    categories = [i["category"] for i in insights]
    # Should include anomaly detection
    assert any(c in ("Anomaly", "Growth", "Risk") for c in categories)


def test_insights_are_saved_to_db(insight_db, sample_csv_with_anomaly):
    ds = Dataset(
        owner_id=1,
        name="save_test",
        file_path=sample_csv_with_anomaly,
    )
    insight_db.add(ds)
    insight_db.commit()
    insight_db.refresh(ds)

    engine = InsightAutomationEngine(db=insight_db, dataset_id=ds.id)
    engine.run_detection()

    saved = insight_db.query(Insight).filter(Insight.dataset_id == ds.id).all()
    assert len(saved) > 0
    for s in saved:
        assert s.title is not None
        assert s.severity in ("Critical", "High", "Medium", "Info")


def test_insights_are_replaced_on_rerun(insight_db, sample_csv_with_anomaly):
    ds = Dataset(
        owner_id=1,
        name="rerun_test",
        file_path=sample_csv_with_anomaly,
    )
    insight_db.add(ds)
    insight_db.commit()
    insight_db.refresh(ds)

    engine = InsightAutomationEngine(db=insight_db, dataset_id=ds.id)
    engine.run_detection()
    count_first = insight_db.query(Insight).filter(Insight.dataset_id == ds.id).count()

    # Run again — old insights should be cleared
    engine.run_detection()
    count_second = insight_db.query(Insight).filter(Insight.dataset_id == ds.id).count()

    # Should be same count (replaced, not accumulated)
    assert count_second == count_first
