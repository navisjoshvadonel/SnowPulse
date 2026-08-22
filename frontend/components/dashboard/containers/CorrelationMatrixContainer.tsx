"use client";

import React from "react";
import CorrelationMatrixPanel from "@/components/dashboard/CorrelationMatrixPanel";

interface CorrelationMatrixContainerProps {
  correlations: any;
  schema: any;
  geoData: any;
  kpis: any;
  loading: boolean;
}

export default function CorrelationMatrixContainer({
  correlations,
  schema,
  geoData,
  kpis,
  loading,
}: CorrelationMatrixContainerProps) {
  return (
    <div className="w-full space-y-6">
      <CorrelationMatrixPanel
        correlations={correlations}
        schema={schema}
        geoData={geoData}
        kpis={kpis}
        loading={loading}
      />
    </div>
  );
}
