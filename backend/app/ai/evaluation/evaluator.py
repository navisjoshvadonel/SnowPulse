import re
import time
from typing import Any

from sqlalchemy.orm import Session

from ...logging_config import logger
from ..gateway.client import OllamaClient
from ..graphs.supervisor import supervisor_graph
from ..tools.database_tools import SecurityAlertException, sanitize_and_validate_sql


class AIEvaluator:
    @staticmethod
    def calculate_overlap_coefficient(response: str, context: str) -> float:
        """
        Calculates token overlap (overlap coefficient) between response and actual reference context
        to quantify the level of evidence grounding (inverse hallucination rate).
        """
        def tokenize(text: str) -> set:
            # Tokenize and extract alphanumeric words of length >= 3
            words = re.findall(r"\b\w{3,}\b", text.lower())
            # Filter out standard stop words
            stopwords = {"the", "and", "for", "with", "this", "that", "from", "then", "have", "been"}
            return {w for w in words if w not in stopwords}

        r_tokens = tokenize(response)
        c_tokens = tokenize(context)

        if not r_tokens or not c_tokens:
            return 1.0 # default to no violation if empty

        intersection = r_tokens.intersection(c_tokens)
        # Overlap coefficient = size of intersection / min(size(A), size(B))
        overlap = len(intersection) / min(len(r_tokens), len(c_tokens))
        return overlap

    @staticmethod
    async def evaluate_agent_routing() -> dict[str, Any]:
        """
        Benchmarks routing classification accuracy across sample intents.
        """
        client = OllamaClient()
        test_cases = [
            {"query": "Predict my sales for next quarter", "expected": "forecast_agent"},
            {"query": "Show anomalies in database", "expected": "insight_agent"},
            {"query": "Search reports from Minio", "expected": "search_agent"},
            {"query": "What is the average transaction value?", "expected": "kpi_agent"},
            {"query": "Select all active users", "expected": "sql_agent"},
            {"query": "Verify data schema health for dataset", "expected": "dataset_agent"}
        ]

        passed = 0
        total = len(test_cases)
        details = []

        for case in test_cases:
            query = case["query"]
            expected = case["expected"]

            prompt = f"""
Given user query: "{query}"
Classify which agent should handle this next. Respond in raw JSON with key "next_agent".
Choose from: kpi_agent, forecast_agent, insight_agent, search_agent, sql_agent, dataset_agent, report_agent.
"""
            system = "Respond only in JSON."
            try:
                res_text = await client.generate(prompt, system, json_mode=True)
                res_json = re.sub(r"\s+", "", res_text) # strip whitespace
                # Extract routing decision
                decision = "unknown"
                for agent in ["kpi_agent", "forecast_agent", "insight_agent", "search_agent", "sql_agent", "dataset_agent", "report_agent"]:
                    if agent in res_json:
                        decision = agent
                        break

                is_correct = decision == expected
                if is_correct:
                    passed += 1
                details.append({
                    "query": query,
                    "expected": expected,
                    "actual": decision,
                    "passed": is_correct
                })
            except Exception as e:
                details.append({
                    "query": query,
                    "expected": expected,
                    "actual": f"Error: {e}",
                    "passed": False
                })

        accuracy = (passed / total) * 100 if total > 0 else 0.0
        return {
            "accuracy_percentage": accuracy,
            "total_cases": total,
            "passed_count": passed,
            "details": details
        }

    @staticmethod
    def evaluate_sql_security() -> dict[str, Any]:
        """
        Benchmarks SQL injection defenses against toxic update/delete query vectors.
        """
        toxic_payloads = [
            "DELETE FROM users;",
            "SELECT * FROM users; DROP TABLE user_dashboards;",
            "INSERT INTO datasets (name, file_path) VALUES ('toxic', 'path');",
            "UPDATE user_dashboards SET title = 'hacked';",
            "ALTER TABLE users ADD COLUMN password_hacked TEXT;",
            "TRUNCATE semantic_memory;"
        ]

        safe_payloads = [
            "SELECT count(*) FROM users;",
            "SELECT title, insight_notes FROM user_dashboards ORDER BY created_at DESC;",
            "SELECT * FROM datasets WHERE name = 'sales';"
        ]

        blocked_toxic = 0
        allowed_safe = 0

        # Test Toxic (should all raise SecurityAlertException)
        toxic_details = []
        for payload in toxic_payloads:
            try:
                sanitize_and_validate_sql(payload)
                toxic_details.append({"query": payload, "status": "ALLOWED (FAILED TEST)", "passed": False})
            except SecurityAlertException:
                blocked_toxic += 1
                toxic_details.append({"query": payload, "status": "BLOCKED (PASSED TEST)", "passed": True})

        # Test Safe (should all pass)
        safe_details = []
        for payload in safe_payloads:
            try:
                sanitize_and_validate_sql(payload)
                allowed_safe += 1
                safe_details.append({"query": payload, "status": "ALLOWED (PASSED TEST)", "passed": True})
            except SecurityAlertException as e:
                safe_details.append({"query": payload, "status": f"BLOCKED (FAILED TEST: {e})", "passed": False})

        toxic_rate = (blocked_toxic / len(toxic_payloads)) * 100
        safe_rate = (allowed_safe / len(safe_payloads)) * 100

        return {
            "toxic_blocked_percentage": toxic_rate,
            "safe_allowed_percentage": safe_rate,
            "toxic_total": len(toxic_payloads),
            "toxic_blocked": blocked_toxic,
            "safe_total": len(safe_payloads),
            "safe_allowed": allowed_safe,
            "details": toxic_details + safe_details
        }

    @staticmethod
    async def run_full_evaluation_suite(db: Session) -> dict[str, Any]:
        """
        Runs the full evaluation benchmark pipeline.
        """
        start_time = time.time()

        # 1. Routing Benchmarks
        routing = await AIEvaluator.evaluate_agent_routing()

        # 2. SQL Security Benchmarks
        sql_sec = AIEvaluator.evaluate_sql_security()

        # 3. Latency & Grounding test (using a test graph execution)
        graph_start = time.time()
        test_context = {
            "dataset_path": "mock_data.csv",
            "dataset_id": 1
        }

        # Prepare test query
        test_query = "What is the data health and KPI trend for sales?"
        initial_state = {
            "query": test_query,
            "messages": [],
            "next_agent": "supervisor",
            "agent_outputs": {},
            "context": test_context,
            "citations": [],
            "reasoning_steps": [],
            "final_response": None
        }

        final_resp = ""
        overlap_score = 0.0
        graph_latency = 0.0

        try:
            # Execute one sync compiler compile for evaluator
            res_state = await supervisor_graph.ainvoke(initial_state)
            final_resp = res_state.get("final_response", "")
            graph_latency = time.time() - graph_start

            # Grounding overlap calculation
            reference_stats = "Data health completeness check. KPI metrics. Total rows volume. Missing values count."
            overlap_score = AIEvaluator.calculate_overlap_coefficient(final_resp, reference_stats)
        except Exception as e:
            logger.error(f"Evaluation graph invocation failed: {e}")
            graph_latency = time.time() - graph_start
            final_resp = f"Error during test: {e}"
            overlap_score = 0.0

        total_latency = time.time() - start_time

        return {
            "timestamp": time.time(),
            "metrics": {
                "routing_accuracy": routing["accuracy_percentage"],
                "sql_toxic_blocked": sql_sec["toxic_blocked_percentage"],
                "sql_safe_allowed": sql_sec["safe_allowed_percentage"],
                "grounding_overlap_score": round(overlap_score, 2),
                "hallucination_rate_estimate": round(1.0 - overlap_score, 2),
                "graph_execution_latency_seconds": round(graph_latency, 3),
                "total_evaluation_latency_seconds": round(total_latency, 3)
            },
            "routing_details": routing["details"],
            "security_details": sql_sec["details"],
            "test_response_preview": final_resp[:200] + "..." if len(final_resp) > 200 else final_resp
        }
