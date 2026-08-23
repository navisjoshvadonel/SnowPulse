"use client";

import React from "react";
import { SnowSection } from "@/components/layout/Sidebar";
import UnifiedDashboardContainer from "./containers/UnifiedDashboardContainer";
import DatasetOverviewContainer from "./containers/DatasetOverviewContainer";
import DataQualityContainer from "./containers/DataQualityContainer";
import CorrelationMatrixContainer from "./containers/CorrelationMatrixContainer";
import PredictionContainer from "./containers/PredictionContainer";
import AiCopilotContainer from "./containers/AiCopilotContainer";

interface DashboardGridProps {
  activeSection: SnowSection;
  datasetId: number | null;
  datasetSchema: any;
  loadingSchema: boolean;
  loadingDashboard: boolean;
  kpis: any;
  trends: any;
  geoData: any;
  anomalies: any;
  correlations: any;
  aiInsights: any;
  forecast: any;
  trainingHistory: any[];
  loadingPrediction: boolean;
  onDatasetHealed: () => void;
}

export default function DashboardGrid({
  activeSection,
  datasetId,
  datasetSchema,
  loadingSchema,
  loadingDashboard,
  kpis,
  trends,
  geoData,
  anomalies,
  correlations,
  aiInsights,
  forecast,
  trainingHistory,
  loadingPrediction,
  onDatasetHealed,
}: DashboardGridProps) {
  if (!datasetId) return null;

  switch (activeSection) {
    case "dashboard":
    case "power-bi-auto":
      return <UnifiedDashboardContainer datasetId={datasetId} datasetSchema={datasetSchema} />;

    case "dataset-overview":
      return <DatasetOverviewContainer schema={datasetSchema} loading={loadingSchema} />;

    case "data-quality":
      return (
        <DataQualityContainer
          datasetId={datasetId}
          schema={datasetSchema}
          loading={loadingSchema}
          onDatasetHealed={onDatasetHealed}
        />
      );

    case "correlation-matrix":
      return (
        <CorrelationMatrixContainer
          correlations={correlations}
          schema={datasetSchema}
          geoData={geoData}
          kpis={kpis}
          loading={loadingDashboard || loadingSchema}
        />
      );

    case "prediction":
      return (
        <PredictionContainer
          datasetId={datasetId}
          forecast={forecast}
          trainingHistory={trainingHistory}
          loading={loadingPrediction}
          profile={datasetSchema}
        />
      );

    case "ai-copilot":
      return (
        <AiCopilotContainer
          datasetId={datasetId}
          kpis={kpis}
          trends={trends}
          anomalies={anomalies}
          recommendations={aiInsights?.recommendations || null}
          loading={loadingDashboard}
        />
      );

    default:
      return <UnifiedDashboardContainer datasetId={datasetId} />;
  }
}
