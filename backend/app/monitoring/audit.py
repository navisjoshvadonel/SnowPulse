from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class AuditEntry(BaseModel):
    id: str
    timestamp: str
    user_id: str
    tenant_id: str
    action: str  # dataset_upload, copilot_query, report_export, model_train, connector_sync
    resource: str
    status: str
    ip_address: Optional[str] = "127.0.0.1"


class AuditLogger:
    _logs: List[AuditEntry] = []

    @classmethod
    def log(
        cls,
        user_id: str,
        tenant_id: str,
        action: str,
        resource: str,
        status: str = "success",
        ip_address: str = "127.0.0.1",
    ) -> AuditEntry:
        import uuid
        entry = AuditEntry(
            id=str(uuid.uuid4())[:8],
            timestamp=datetime.utcnow().isoformat(),
            user_id=user_id,
            tenant_id=tenant_id,
            action=action,
            resource=resource,
            status=status,
            ip_address=ip_address,
        )
        cls._logs.append(entry)
        return entry

    @classmethod
    def get_logs(cls, tenant_id: str, limit: int = 50) -> List[AuditEntry]:
        tenant_logs = [log for log in cls._logs if log.tenant_id == tenant_id]
        return tenant_logs[-limit:]
