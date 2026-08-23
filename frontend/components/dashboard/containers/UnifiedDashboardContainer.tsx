"use client";

import React from "react";
import UnifiedBIDashboard from "@/components/unified-dashboard/UnifiedBIDashboard";

interface UnifiedDashboardContainerProps {
  datasetId: number;
  datasetSchema?: any;
}

export default function UnifiedDashboardContainer({ datasetId, datasetSchema }: UnifiedDashboardContainerProps) {
  return (
    <div className="w-full space-y-6">
      <UnifiedBIDashboard datasetId={datasetId} initialSchema={datasetSchema} />
    </div>
  );
}
