from unittest.mock import patch

from app.ai.memory.vector_store import SemanticMemory
from app.models import User


def test_delete_user_account_with_reports(client, test_user, auth_headers, db):
    mem1 = SemanticMemory(
        user_id=test_user.id,
        content="Executive summary report 1",
        category="report",
        metadata_json={"object_path": "minio://reports/executive_report_101.pdf"}
    )
    mem2 = SemanticMemory(
        user_id=test_user.id,
        content="Executive summary report 2",
        category="report",
        metadata_json={"object_path": "minio://reports/executive_report_102.pdf"}
    )
    db.add(mem1)
    db.add(mem2)
    db.flush()

    with patch("backend.app.main.storage_service.delete_files") as mock_delete_files:
        response = client.delete(
            "/api/user/account",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"

        mock_delete_files.assert_called_once_with(
            "reports",
            ["executive_report_101.pdf", "executive_report_102.pdf"]
        )

    # Confirm user deleted
    user_db = db.query(User).filter(User.id == test_user.id).first()
    assert user_db is None


def test_delete_user_account_exception_rollback(client, test_user, auth_headers, db):
    mem = SemanticMemory(
        user_id=test_user.id,
        content="Executive summary report 1",
        category="report",
        metadata_json={"object_path": "minio://reports/executive_report_101.pdf"}
    )
    db.add(mem)
    db.flush()

    with patch("backend.app.main.storage_service.delete_files", side_effect=Exception("Storage error")):
        response = client.delete(
            "/api/user/account",
            headers=auth_headers
        )
        assert response.status_code == 200
