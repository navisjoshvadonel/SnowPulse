"use client";

import React from "react";
import InsightsCenter from "@/components/ai-insights/InsightsCenter";

interface AiCopilotContainerProps {
  datasetId: number | null;
  kpis: any;
  trends: any;
  anomalies: any;
  recommendations: any;
  loading: boolean;
}

export default function AiCopilotContainer({
  datasetId,
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
        kpis={kpis}
        trends={trends}
        anomalies={anomalies}
        recommendations={recommendations}
        loading={loading}
      />
    </div>
  );
}
