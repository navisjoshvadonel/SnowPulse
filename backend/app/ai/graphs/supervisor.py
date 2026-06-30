import json
import os
import re
from collections.abc import AsyncGenerator
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph
from sqlalchemy.orm import Session

from ...logging_config import logger
from ..agents import AGENTS_REGISTRY
from ..gateway.client import OllamaClient
from ..tools.database_tools import DatabaseTools


# 1. State Definition
class AgentState(TypedDict):
    query: str
    messages: list[dict[str, Any]]
    next_agent: str
    agent_outputs: dict[str, Any]
    context: dict[str, Any]
    citations: list[dict[str, Any]]
    reasoning_steps: list[str]
    final_response: str | None

# Create global Ollama client
ollama_client = OllamaClient()

# 2. Supervisor Node
async def supervisor_node(state: AgentState) -> dict[str, Any]:
    """
    Decides which agent to route to, or if we have enough info to compile the final response.
    """
    query = state["query"]
    agent_outputs = state["agent_outputs"]
    steps = state["reasoning_steps"]

    # Check if we've already run 4 loops to prevent infinite loops
    if len(steps) >= 5:
        logger.warning("Supervisor reached maximum reasoning steps. Compiling final answer.")
        return {"next_agent": "compiler"}

    # Formulate routing decision prompt
    agents_desc = "\n".join([f"- {name}: {info['description']}" for name, info in AGENTS_REGISTRY.items()])

    prompt = f"""
You are the Central AI Supervisor for SNOW Analytics.
Your task is to analyze the user query and decide which worker agent to route to next.
If the query has been successfully resolved by workers, or if you can answer it directly, route to 'compiler' to produce the final answer.

User Query: "{query}"

Available Agents:
{agents_desc}
- compiler: Select this when you have sufficient information to answer the user query or if no other agent is needed.

Active Worker Outputs So Far:
{json.dumps(agent_outputs, indent=2)}

Reasoning Steps So Far:
{", ".join(steps) if steps else "None"}

You must respond in raw JSON format with exactly two keys:
1. "next_agent": The name of the agent to call next (e.g. "kpi_agent", "sql_agent", etc.) or "compiler".
2. "reasoning": A 1-sentence thought explaining your routing decision.

CRITICAL: Return ONLY valid JSON.
"""
    system_prompt = "You are an enterprise AI director. Respond only in raw JSON."

    next_agent = "compiler"
    reasoning = "Final compilation"

    try:
        response_text = await ollama_client.generate(prompt, system_prompt, json_mode=True)
        # Parse JSON
        decision = json.loads(response_text)
        next_agent = decision.get("next_agent", "compiler")
        reasoning = decision.get("reasoning", "Routing to next node")
    except Exception as e:
        logger.error(f"Supervisor classification error: {e}. Defaulting to compiler.")

    # Map next_agent to valid endpoints
    if next_agent not in AGENTS_REGISTRY and next_agent != "compiler":
        next_agent = "compiler"

    updated_steps = list(steps)
    updated_steps.append(f"Supervisor decided: {reasoning} -> {next_agent}")

    return {
        "next_agent": next_agent,
        "reasoning_steps": updated_steps
    }

# 3. Worker Agent Nodes
async def kpi_agent_node(state: AgentState) -> dict[str, Any]:
    query = state["query"]
    context = state["context"]
    dataset_path = context.get("dataset_path")

    stats_data = {}
    if dataset_path:
        stats_data = DatabaseTools.get_dataset_statistics(dataset_path)

    prompt = f"""
Query: "{query}"
Dataset Statistics:
{json.dumps(stats_data, indent=2)}
"""
    agent_prompt = AGENTS_REGISTRY["kpi_agent"]["prompt"].format(context=json.dumps(stats_data))

    response = await ollama_client.generate(prompt, agent_prompt)

    outputs = dict(state["agent_outputs"])
    outputs["kpi_agent"] = response

    citations = list(state["citations"])
    if dataset_path:
        citations.append({
            "source": f"Dataset File: {os.path.basename(dataset_path)}",
            "type": "polars_analytics",
            "details": "Summary statistics calculation for core metrics."
        })

    return {
        "agent_outputs": outputs,
        "citations": citations
    }

async def forecast_agent_node(state: AgentState) -> dict[str, Any]:
    query = state["query"]
    context = state["context"]
    dataset_id = context.get("dataset_id")

    forecast_data = {}
    if dataset_id:
        forecast_data = DatabaseTools.get_forecast_scenarios(dataset_id)

    prompt = f"""
Query: "{query}"
Forecast Scenarios:
{json.dumps(forecast_data, indent=2)}
"""
    agent_prompt = AGENTS_REGISTRY["forecast_agent"]["prompt"].format(context=json.dumps(forecast_data))

    response = await ollama_client.generate(prompt, agent_prompt)

    outputs = dict(state["agent_outputs"])
    outputs["forecast_agent"] = response

    citations = list(state["citations"])
    if dataset_id:
        citations.append({
            "source": f"Statsmodels Prediction Engine (Dataset ID {dataset_id})",
            "type": "statsmodels_forecast",
            "details": "Cumulative baseline vs optimistic projections."
        })

    return {
        "agent_outputs": outputs,
        "citations": citations
    }

async def insight_agent_node(state: AgentState) -> dict[str, Any]:
    query = state["query"]
    context = state["context"]
    dataset_path = context.get("dataset_path")

    stats_data = {}
    if dataset_path:
        stats_data = DatabaseTools.get_dataset_statistics(dataset_path)

    prompt = f"""
Query: "{query}"
Dataset Anomalies:
{json.dumps(stats_data.get("anomalies_count", 0), indent=2)}
"""
    agent_prompt = AGENTS_REGISTRY["insight_agent"]["prompt"].format(context=json.dumps(stats_data))

    response = await ollama_client.generate(prompt, agent_prompt)

    outputs = dict(state["agent_outputs"])
    outputs["insight_agent"] = response

    citations = list(state["citations"])
    citations.append({
        "source": "Statistical Anomaly Scanner (Z-Score Thresholds)",
        "type": "variance_anomalies",
        "details": "Outlier detection computed via standard deviations."
    })

    return {
        "agent_outputs": outputs,
        "citations": citations
    }

async def search_agent_node(state: AgentState) -> dict[str, Any]:
    query = state["query"]

    search_hits = DatabaseTools.search_resources(query)

    prompt = f"""
Query: "{query}"
Search Matches:
{json.dumps(search_hits, indent=2)}
"""
    agent_prompt = AGENTS_REGISTRY["search_agent"]["prompt"].format(context=json.dumps(search_hits))

    response = await ollama_client.generate(prompt, agent_prompt)

    outputs = dict(state["agent_outputs"])
    outputs["search_agent"] = response

    citations = list(state["citations"])
    for hit in search_hits[:2]:
        citations.append({
            "source": f"Search Index: {hit.get('name', 'Resource')}",
            "type": "meilisearch",
            "details": f"Relevance score: {hit.get('_rankingScore', 'N/A')}"
        })

    return {
        "agent_outputs": outputs,
        "citations": citations
    }

async def sql_agent_node(state: AgentState) -> dict[str, Any]:
    query = state["query"]
    context = state["context"]
    db_session: Session | None = context.get("db_session")

    # SQL schema description
    schema_desc = "SQL Database with schemas: users, datasets, user_dashboards, insights, semantic_memory."

    agent_prompt = AGENTS_REGISTRY["sql_agent"]["prompt"].format(context=schema_desc)

    # 1. Ask agent to generate SQL
    gen_prompt = f"Given user query '{query}', write the read-only SQL query required to get data."
    sql_response = await ollama_client.generate(gen_prompt, agent_prompt)

    # Extract SQL block from markdown if present
    sql_query = sql_response
    match = re.search(r"```sql\s*(.*?)\s*```", sql_response, re.DOTALL | re.IGNORECASE)
    if match:
        sql_query = match.group(1)

    # Execute SQL safely
    exec_result = {"success": False, "error": "No database session linked."}
    if db_session:
        exec_result = DatabaseTools.execute_read_only_sql(db_session, sql_query)

    # Summarize query results
    summary_prompt = f"""
Query: "{query}"
SQL Executed: "{sql_query}"
Execution Result: {json.dumps(exec_result, indent=2)}
"""
    final_summary = await ollama_client.generate(summary_prompt, agent_prompt)

    outputs = dict(state["agent_outputs"])
    outputs["sql_agent"] = f"**Executed SQL**:\n```sql\n{sql_query}\n```\n\n**Result Summary**:\n{final_summary}"

    citations = list(state["citations"])
    if exec_result.get("success"):
        citations.append({
            "source": "PostgreSQL Database Engine (Read-Only Connection)",
            "type": "sql_query",
            "details": f"Query: {sql_query[:60]}... Rows returned: {exec_result.get('count')}"
        })

    return {
        "agent_outputs": outputs,
        "citations": citations
    }

async def report_agent_node(state: AgentState) -> dict[str, Any]:
    agent_outputs = state["agent_outputs"]

    prompt = f"""
Compile the intermediate outputs of all agents into a unified report.
Intermediate Data:
{json.dumps(agent_outputs, indent=2)}
"""
    agent_prompt = AGENTS_REGISTRY["report_agent"]["prompt"].format(context=json.dumps(agent_outputs))

    response = await ollama_client.generate(prompt, agent_prompt)

    outputs = dict(state["agent_outputs"])
    outputs["report_agent"] = response

    return {
        "agent_outputs": outputs
    }

async def dataset_agent_node(state: AgentState) -> dict[str, Any]:
    query = state["query"]
    context = state["context"]
    dataset_path = context.get("dataset_path")

    quality_data = {}
    if dataset_path:
        quality_data = DatabaseTools.get_data_quality_report(dataset_path)

    prompt = f"""
Query: "{query}"
Quality Scorer Results:
{json.dumps(quality_data, indent=2)}
"""
    agent_prompt = AGENTS_REGISTRY["dataset_agent"]["prompt"].format(context=json.dumps(quality_data))

    response = await ollama_client.generate(prompt, agent_prompt)

    outputs = dict(state["agent_outputs"])
    outputs["dataset_agent"] = response

    citations = list(state["citations"])
    citations.append({
        "source": "Pandas/Polars Ingestion Validator (Schema Scans)",
        "type": "data_quality_report",
        "details": f"Quality index score: {quality_data.get('quality_score', 100)}/100"
    })

    return {
        "agent_outputs": outputs,
        "citations": citations
    }

# 4. Compiler Node
async def compiler_node(state: AgentState) -> dict[str, Any]:
    """
    Merges all agent outputs into the final user-facing response.
    """
    query = state["query"]
    agent_outputs = state["agent_outputs"]
    citations = state["citations"]

    prompt = f"""
You are the Final Analytics Compiler for SNOW Analytics.
Your task is to review the user's initial question and merge all worker agent reports into a single, cohesive, C-level executive answer.

User Query: "{query}"

Agent Findings:
{json.dumps(agent_outputs, indent=2)}

Available Sources/Citations:
{json.dumps(citations, indent=2)}

Guidelines:
- Return clean markdown with professional tables.
- Do not repeat headings. Organize the output logically.
- At the bottom of your response, list exact Source Citations in a clean bulleted section: `**Citations:**`
- Ensure all statements are strictly backed by the evidence. No hallucinations.
"""
    system_prompt = "You are a professional business analytics compiler. Return clear, concise markdown."

    response = await ollama_client.generate(prompt, system_prompt)
    return {"final_response": response}

# 5. Build LangGraph
def build_supervisor_graph() -> Any:
    workflow = StateGraph(AgentState)

    # Add Nodes
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("kpi_agent", kpi_agent_node)
    workflow.add_node("forecast_agent", forecast_agent_node)
    workflow.add_node("insight_agent", insight_agent_node)
    workflow.add_node("search_agent", search_agent_node)
    workflow.add_node("sql_agent", sql_agent_node)
    workflow.add_node("report_agent", report_agent_node)
    workflow.add_node("dataset_agent", dataset_agent_node)
    workflow.add_node("compiler", compiler_node)

    # Add Edges
    workflow.set_entry_point("supervisor")

    # Conditional edge routing from supervisor
    workflow.add_conditional_edges(
        "supervisor",
        lambda x: x["next_agent"],
        {
            "kpi_agent": "kpi_agent",
            "forecast_agent": "forecast_agent",
            "insight_agent": "insight_agent",
            "search_agent": "search_agent",
            "sql_agent": "sql_agent",
            "report_agent": "report_agent",
            "dataset_agent": "dataset_agent",
            "compiler": "compiler"
        }
    )

    # Edge mapping from workers back to supervisor loop
    workflow.add_edge("kpi_agent", "supervisor")
    workflow.add_edge("forecast_agent", "supervisor")
    workflow.add_edge("insight_agent", "supervisor")
    workflow.add_edge("search_agent", "supervisor")
    workflow.add_edge("sql_agent", "supervisor")
    workflow.add_edge("report_agent", "supervisor")
    workflow.add_edge("dataset_agent", "supervisor")

    # Compiler node ends workflow
    workflow.add_edge("compiler", END)

    return workflow.compile()

# Compilation of active supervisor graph
supervisor_graph = build_supervisor_graph()

# 6. Stream Execution Wrapper
async def run_supervisor_workflow(
    query: str,
    context: dict[str, Any],
    db_session: Session
) -> AsyncGenerator[dict[str, Any], None]:
    """
    Executes LangGraph workflow and streams progressive updates (reasoning, tokens, actions).
    """
    # Enforce db_session inclusion in context
    context["db_session"] = db_session

    initial_state: AgentState = {
        "query": query,
        "messages": [],
        "next_agent": "supervisor",
        "agent_outputs": {},
        "context": context,
        "citations": [],
        "reasoning_steps": [],
        "final_response": None
    }

    yield {"type": "reasoning", "data": "Supervisor initialized. Analyzing intent..."}

    try:
        # Run LangGraph step-by-step
        async for output in supervisor_graph.astream(initial_state):
            # Inspect output nodes
            for node_name, state_delta in output.items():
                if node_name == "supervisor":
                    steps = state_delta.get("reasoning_steps", [])
                    last_step = steps[-1] if steps else "routing decision"
                    yield {"type": "reasoning", "data": f"Supervisor decision: {last_step}"}
                elif node_name == "compiler":
                    # Final response stream
                    final_res = state_delta.get("final_response", "")
                    yield {"type": "output", "data": final_res}
                elif node_name in AGENTS_REGISTRY:
                    yield {"type": "reasoning", "data": f"Completed agent step: {node_name.replace('_', ' ').title()}"}

        yield {"type": "reasoning", "data": "Workflow completed successfully."}
    except Exception as e:
        logger.error(f"Error executing LangGraph supervisor: {e}")
        yield {"type": "error", "data": f"Execution failed: {str(e)}"}
