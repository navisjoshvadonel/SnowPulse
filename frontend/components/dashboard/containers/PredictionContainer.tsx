"use client";

import React from "react";
import PredictionPanel from "@/components/dashboard/PredictionPanel";

interface PredictionContainerProps {
  datasetId?: number;
  forecast: any;
  trainingHistory: any[];
  loading: boolean;
  profile: any;
}

export default function PredictionContainer({
  datasetId,
  forecast,
  trainingHistory,
  loading,
  profile,
}: PredictionContainerProps) {
  return (
    <div className="w-full space-y-6">
      <PredictionPanel
        datasetId={datasetId}
        forecast={forecast}
        trainingHistory={trainingHistory}
        loading={loading}
        profile={profile}
      />
    </div>
  );
}
