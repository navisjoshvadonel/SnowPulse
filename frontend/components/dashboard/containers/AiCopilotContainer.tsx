"use client";

import React from "react";
import InsightsCenter from "@/components/ai-insights/InsightsCenter";

interface AiCopilotContainerProps {
  datasetId: number | null;
  datasetSchema?: any;
  kpis: any;
  trends: any;
  anomalies: any;
  recommendations: any;
  loading: boolean;
}

export default function AiCopilotContainer({
  datasetId,
  datasetSchema,
  kpis,
  trends,
  anomalies,
  recommendations,
  loading = false,
}: AiCopilotContainerProps) {
  return (
    <div className="flex-1 w-full flex flex-col max-h-[85vh]">
      <InsightsCenter
        datasetId={datasetId}
        datasetSchema={datasetSchema}
        kpis={kpis}
        trends={trends}
        anomalies={anomalies}
        recommendations={recommendations}
        loading={loading}
      />
    </div>
  );
}
