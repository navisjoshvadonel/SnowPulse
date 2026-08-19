from pydantic import BaseModel


class DimensionDef(BaseModel):
    name: str
    description: str
    column: str

class MetricDef(BaseModel):
    name: str
    description: str
    column: str
    agg: str
    format: str | None = None

class SemanticModel(BaseModel):
    name: str
    description: str
    dimensions: list[DimensionDef]
    metrics: list[MetricDef]

class SemanticLayerManager:
    """
    Manages semantic definitions (metrics and dimensions) to bridge the gap
    between human/LLM terminology and physical database column names.
    """
    def __init__(self):
        # In a real enterprise system, these would be loaded from a database, YAML, or dbt integration.
        # For this implementation, we initialize an empty registry that can be built dynamically.
        self.models: dict[str, SemanticModel] = {}

    def register_model(self, model: SemanticModel):
        self.models[model.name] = model

    def resolve_metric(self, model_name: str, metric_name: str) -> MetricDef | None:
        model = self.models.get(model_name)
        if not model:
            return None
        for m in model.metrics:
            if m.name.lower() == metric_name.lower():
                return m
        return None

    def resolve_dimension(self, model_name: str, dim_name: str) -> DimensionDef | None:
        model = self.models.get(model_name)
        if not model:
            return None
        for d in model.dimensions:
            if d.name.lower() == dim_name.lower():
                return d
        return None

    def get_context_for_llm(self, model_name: str) -> str:
        """
        Generates a strict context block for Gemini to understand available metrics.
        This prevents LLM hallucinations by forcing it to choose only valid semantic terms.
        """
        model = self.models.get(model_name)
        if not model:
            return "No semantic model found."

        ctx = f"### Semantic Model: {model.name}\n{model.description}\n\n"

        ctx += "#### Available Metrics:\n"
        for m in model.metrics:
            ctx += f"- **{m.name}**: {m.description} (Aggregation: {m.agg})\n"

        ctx += "\n#### Available Dimensions:\n"
        for d in model.dimensions:
            ctx += f"- **{d.name}**: {d.description}\n"

        ctx += "\nIMPORTANT: When generating a query payload, YOU MUST ONLY use the metric and dimension names listed above. Do not hallucinate columns.\n"
        ctx += "Ensure your JSON payload includes the following fields instead of raw 'metrics' and 'dimensions':\n"
        ctx += f'{{\n  "semantic_model_name": "{model.name}",\n  "semantic_metrics": ["total_revenue", "average_cost"],\n  "semantic_dimensions": ["category_name"],\n  "filters": []\n}}\n'
        return ctx

# Global semantic layer instance
semantic_layer = SemanticLayerManager()
