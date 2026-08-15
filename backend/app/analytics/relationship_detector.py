from typing import Any

from pydantic import BaseModel


class RelationshipLink(BaseModel):
    source_table: str
    source_column: str
    target_table: str
    target_column: str
    relationship_type: str  # one-to-many, one-to-one, many-to-many
    confidence_score: float  # 0.0 to 1.0


class RelationshipDetector:
    @classmethod
    def detect_relationships(cls, datasets: list[dict[str, Any]]) -> list[RelationshipLink]:
        """
        Scans uploaded datasets to auto-suggest foreign key relationships.
        e.g., customers.id = orders.customer_id
        """
        links: list[RelationshipLink] = []

        if len(datasets) < 2:
            return links

        for i in range(len(datasets)):
            for j in range(i + 1, len(datasets)):
                d1 = datasets[i]
                d2 = datasets[j]

                name1, cols1 = d1.get("name", "table_a"), d1.get("columns", [])
                name2, cols2 = d2.get("name", "table_b"), d2.get("columns", [])

                for c1 in cols1:
                    c1_name = c1.get("name", "").lower()
                    for c2 in cols2:
                        c2_name = c2.get("name", "").lower()

                        # Check exact name match or key pattern match (e.g. id & customer_id)
                        is_match = False
                        rel_type = "one-to-many"
                        confidence = 0.85

                        if c1_name == c2_name and ("id" in c1_name or "key" in c1_name):
                            is_match = True
                            confidence = 0.95
                        elif (c1_name == "id" and f"{name1.lower()}_id" in c2_name) or (c2_name == "id" and f"{name2.lower()}_id" in c1_name):
                            is_match = True
                            confidence = 0.98

                        if is_match:
                            links.append(
                                RelationshipLink(
                                    source_table=name1,
                                    source_column=c1.get("name"),
                                    target_table=name2,
                                    target_column=c2.get("name"),
                                    relationship_type=rel_type,
                                    confidence_score=confidence,
                                )
                            )

        return links
