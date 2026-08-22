"use client";

import React, { useState, useEffect } from "react";
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

import { apiService } from "@/services/api";

interface UnifiedBIDashboardProps {
  datasetId: number;
}

export default function UnifiedBIDashboard({ datasetId }: UnifiedBIDashboardProps) {
  const [schemaData, setSchemaData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filteredRowCount, setFilteredRowCount] = useState<number | undefined>(undefined);

  const {
    selectedRegion,
    selectedCategory,
    dateRange,
    brushedRange,
    selectedFilters,
    activeCategoryValues,
    activeNumericRanges,
  } = useFilterStore();

  // Fetch Dataset Profile & Schema
  useEffect(() => {
    async function loadSchema() {
      if (!datasetId) return;
      setLoading(true);
      try {
        const res = await apiService.getDatasetSchema(datasetId);
        if (res.ok) {
          const data = await res.json();
          setSchemaData(data);
        }
      } catch (err) {
        console.error("Failed to load dataset schema:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSchema();
  }, [datasetId]);

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
  const primaryMetric = schemaData.primary_metric || "volume";

  const primaryMetricColObj = columns.find((c: any) => c.name === primaryMetric);

  return (
    <div className="w-full space-y-6">
      {/* 0. Filter Chip Bar (Visibility & One-Click Removal of active filters) */}
      <FilterChipBar />

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

      {/* 3. Gemini Smart Executive Narrative */}
      <NaturalLanguageSummaryPanel
        datasetId={datasetId}
        datasetName={schemaData.name || "Uploaded Dataset"}
        columns={columns}
      />

      {/* 4. Time-Series Area Trend Panel (Conditional) */}
      <TimeSeriesPanel columns={columns} datasetId={datasetId} />

      {/* 5. Main Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categorical Breakdown & Share */}
        <CategoricalBreakdownPanel columns={columns} datasetId={datasetId} />

        {/* Numeric Frequency Distribution */}
        <DistributionPanel columns={columns} datasetId={datasetId} />
      </div>

      {/* 6. Advanced Analytics & Relationships Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Correlation Heatmap */}
        <CorrelationPanel columns={columns} datasetId={datasetId} />

        {/* Statistical Outliers & Signals */}
        <OutlierAnomalyPanel datasetId={datasetId} />
      </div>
    </div>
  );
}
