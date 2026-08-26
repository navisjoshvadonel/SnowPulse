"use client";

import React, { useState, useEffect } from "react";
import { Presentation, ShieldCheck, Workflow, Sliders, Globe } from "lucide-react";
import { useFilterStore } from "@/store/filterStore";
import FilterChipBar from "@/components/dashboard/FilterChipBar";
import FilterSlicerBar from "./FilterSlicerBar";
import UnifiedKpiStrip from "./UnifiedKpiStrip";
import CategoricalBreakdownPanel from "./CategoricalBreakdownPanel";
import DistributionPanel from "./DistributionPanel";
import TimeSeriesPanel from "./TimeSeriesPanel";
import CorrelationPanel from "./CorrelationPanel";
import NaturalLanguageSummaryPanel from "./NaturalLanguageSummaryPanel";
import OutlierAnomalyPanel from "./OutlierAnomalyPanel";
import PinnedChartsPanel from "./PinnedChartsPanel";
import DecompositionTreePanel from "@/components/analytics/DecompositionTreePanel";
import { MonteCarloSimulatorPanel } from "@/components/analytics/MonteCarloSimulatorPanel";
import { NaturalLanguageCalculatedFieldPanel } from "@/components/analytics/NaturalLanguageCalculatedFieldPanel";
import { GeoSpatialHeatmapPanel } from "@/components/analytics/GeoSpatialHeatmapPanel";
import { DataLineagePanel } from "@/components/analytics/DataLineagePanel";
import { DataHealthProfilerPanel } from "@/components/analytics/DataHealthProfilerPanel";
import { ExecutivePresentationModal } from "@/components/analytics/ExecutivePresentationModal";
import { SensitivityMatrixPanel } from "@/components/analytics/SensitivityMatrixPanel";

import { apiService } from "@/services/api";

interface UnifiedBIDashboardProps {
  datasetId: number;
  initialSchema?: any;
}

export default function UnifiedBIDashboard({ datasetId, initialSchema }: UnifiedBIDashboardProps) {
  const [schemaData, setSchemaData] = useState<any>(initialSchema || null);
  const [loading, setLoading] = useState<boolean>(!initialSchema && !schemaData);
  const [filteredRowCount, setFilteredRowCount] = useState<number | undefined>(undefined);
  const [showExecutivePresentation, setShowExecutivePresentation] = useState<boolean>(false);

  const {
    selectedRegion,
    selectedCategory,
    dateRange,
    brushedRange,
    selectedFilters,
    activeCategoryValues,
    activeNumericRanges,
  } = useFilterStore();

  useEffect(() => {
    if (initialSchema) {
      setSchemaData(initialSchema);
      setLoading(false);
    }
  }, [initialSchema]);

  // Fetch Dataset Profile & Schema
  useEffect(() => {
    async function loadSchema() {
      if (!datasetId) return;
      if (!initialSchema && !schemaData) setLoading(true);
      try {
        const res = await apiService.getDatasetSchema(datasetId);
        if (res.ok) {
          const data = await res.json();
          setSchemaData(data);
        } else if (!schemaData && !initialSchema) {
          setSchemaData({ dataset_id: datasetId, name: "Active Dataset", columns: [] });
        }
      } catch (err) {
        console.error("Failed to load dataset schema:", err);
        if (!schemaData && !initialSchema) {
          setSchemaData({ dataset_id: datasetId, name: "Active Dataset", columns: [] });
        }
      } finally {
        setLoading(false);
      }
    }
    loadSchema();
  }, [datasetId, initialSchema]);

  // Execute Dynamic Backend Server-Side Aggregation whenever store filters change
  useEffect(() => {
    async function updateFilteredData() {
      if (!datasetId || !schemaData) return;

      const hasActiveFilters =
        selectedRegion !== null ||
        selectedCategory !== null ||
        dateRange !== null ||
        brushedRange !== null ||
        selectedFilters.length > 0 ||
        Object.keys(activeCategoryValues).length > 0 ||
        Object.keys(activeNumericRanges).length > 0;

      if (!hasActiveFilters) {
        setFilteredRowCount(undefined);
        return;
      }

      try {
        const payload = {
          selectedRegion,
          selectedCategory,
          date_range: dateRange,
          brushedRange,
          filters: selectedFilters.map((f) => ({
            column: f.column,
            op: f.op,
            value: f.value,
          })),
          active_category_values: activeCategoryValues,
          active_numeric_ranges: activeNumericRanges,
        };

        const res = await apiService.getDatasetAggregate(datasetId, payload);

        if (res.ok) {
          const result = await res.json();
          if (result.success && result.total_records !== undefined) {
            setFilteredRowCount(result.total_records);
          }
        }
      } catch (err) {
        console.error("Failed to aggregate filtered dataset:", err);
      }
    }

    updateFilteredData();
  }, [
    datasetId,
    schemaData,
    selectedRegion,
    selectedCategory,
    dateRange,
    brushedRange,
    selectedFilters,
    activeCategoryValues,
    activeNumericRanges,
  ]);

  if (loading) {
    return (
      <div className="w-full py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-400 animate-pulse">
          Synthesizing dataset schema & initializing cross-filter engine...
        </p>
      </div>
    );
  }

  if (!schemaData) {
    return (
      <div className="w-full py-16 text-center bg-slate-900/60 border border-slate-800 rounded-2xl p-8">
        <p className="text-slate-400 text-sm">Please select or upload a dataset to initialize the BI Canvas.</p>
      </div>
    );
  }

  const columns = schemaData.columns || [];
  const totalRows = schemaData.row_count || 0;
  const numColObj = columns.find((c: any) => c.role === "numeric" || c.dtype_category === "numeric" || c.inferred_role === "metric");
  const primaryMetric = schemaData.primary_metric && schemaData.primary_metric !== "volume" ? schemaData.primary_metric : numColObj?.name || "volume";

  const primaryMetricColObj = columns.find((c: any) => c.name === primaryMetric) || numColObj;
  const numericColNames = columns.filter((c: any) => c.data_type === "numeric" || c.data_type === "float" || c.data_type === "integer" || c.role === "numeric" || c.dtype_category === "numeric").map((c: any) => c.name);
  const geoColNames = columns.filter((c: any) => c.role === "categorical" || c.role === "geo" || c.semantic_type === "location" || c.is_primary_geo).map((c: any) => c.name);

  return (
    <div className="w-full space-y-6">
      {/* Executive Deck Top Action Bar */}
      <div className="flex justify-end mb-2">
        <button
          onClick={() => setShowExecutivePresentation(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-xl transition duration-200 border border-cyan-400/40"
        >
          <Presentation className="w-4 h-4 text-cyan-300 animate-pulse" />
          <span>1-Click Executive Slide Deck Generator ⚡</span>
        </button>
      </div>

      {/* 0. Filter Chip Bar */}
      <FilterChipBar />

      {/* Pinned Conversational AI Charts */}
      <PinnedChartsPanel />

      {/* 1. Dynamic Filter & Slicer Bar */}
      <FilterSlicerBar
        columns={columns}
        totalRows={totalRows}
        filteredRows={filteredRowCount}
      />

      {/* 2. Unified KPI Summary Strip */}
      <UnifiedKpiStrip
        totalRows={totalRows}
        filteredRows={filteredRowCount}
        qualityReport={schemaData.quality_report}
        primaryMetricName={primaryMetric}
        primaryMetricStats={primaryMetricColObj?.numeric_stats}
        columnCount={columns.length}
      />

      {/* 3. Data Health Profiler & Auto-Heal Matrix */}
      <DataHealthProfilerPanel
        datasetId={datasetId}
        datasetName={schemaData.name || "Uploaded Dataset"}
        qualityReport={schemaData.quality_report}
        columns={columns}
      />

      {/* 4. Gemini Smart Executive Narrative */}
      <NaturalLanguageSummaryPanel
        datasetId={datasetId}
        datasetName={schemaData.name || "Uploaded Dataset"}
        columns={columns}
      />

      {/* 5. Autonomous Root-Cause Decomposition Tree */}
      <DecompositionTreePanel datasetId={datasetId} />

      {/* 6. AI Monte Carlo Risk & Scenario Simulator */}
      <MonteCarloSimulatorPanel
        datasetId={datasetId}
        datasetName={schemaData.name || "Uploaded Dataset"}
        metricColumn={primaryMetric}
        numericColumns={numericColNames}
      />

      {/* 7. Multi-Variable Sensitivity & What-If Scenario Matrix */}
      <SensitivityMatrixPanel
        datasetId={datasetId}
        metricColumn={primaryMetric}
      />

      {/* 8. AI Natural Language Calculated Fields Engine */}
      <NaturalLanguageCalculatedFieldPanel
        datasetId={datasetId}
        datasetName={schemaData.name || "Uploaded Dataset"}
        numericColumns={numericColNames}
      />

      {/* 9. 3D Spatial Geo-Heatmap Panel */}
      <GeoSpatialHeatmapPanel
        datasetId={datasetId}
        datasetName={schemaData.name || "Uploaded Dataset"}
        numericColumns={numericColNames}
        geoColumns={geoColNames}
      />

      {/* 10. Dynamic Data Lineage & Impact Map */}
      <DataLineagePanel
        datasetId={datasetId}
        datasetName={schemaData.name || "Uploaded Dataset"}
        columns={columns}
      />

      {/* 11. Time-Series Area Trend Panel */}
      <TimeSeriesPanel columns={columns} datasetId={datasetId} />

      {/* 12. Main Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categorical Breakdown & Share */}
        <CategoricalBreakdownPanel columns={columns} datasetId={datasetId} />

        {/* Numeric Frequency Distribution */}
        <DistributionPanel columns={columns} datasetId={datasetId} />
      </div>

      {/* 13. Advanced Analytics & Relationships Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Correlation Heatmap */}
        <CorrelationPanel columns={columns} datasetId={datasetId} />

        {/* Statistical Outliers & Signals */}
        <OutlierAnomalyPanel datasetId={datasetId} />
      </div>

      {/* Executive Slide Deck Modal */}
      <ExecutivePresentationModal
        isOpen={showExecutivePresentation}
        onClose={() => setShowExecutivePresentation(false)}
        datasetName={schemaData.name || "Active Dataset"}
        primaryMetric={primaryMetric}
        totalRows={totalRows}
        qualityScore={schemaData.quality_report?.overall_score || 94}
      />
    </div>
  );
}
