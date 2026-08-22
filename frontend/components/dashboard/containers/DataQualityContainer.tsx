"use client";

import React from "react";
import DataQualityReportPanel from "@/components/dashboard/DataQualityReportPanel";

interface DataQualityContainerProps {
  datasetId?: number;
  schema: any;
  loading: boolean;
  onDatasetHealed: () => void;
}

export default function DataQualityContainer({
  datasetId,
  schema,
  loading,
  onDatasetHealed,
}: DataQualityContainerProps) {
  return (
    <div className="w-full space-y-6">
      <DataQualityReportPanel
        datasetId={datasetId}
        schema={schema}
        loading={loading}
        onDatasetHealed={onDatasetHealed}
      />
    </div>
  );
}
