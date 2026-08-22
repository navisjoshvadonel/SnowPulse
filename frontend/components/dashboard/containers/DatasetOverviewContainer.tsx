"use client";

import React from "react";
import DatasetOverviewPanel from "@/components/dashboard/DatasetOverviewPanel";

interface DatasetOverviewContainerProps {
  schema: any;
  loading: boolean;
}

export default function DatasetOverviewContainer({ schema, loading }: DatasetOverviewContainerProps) {
  return (
    <div className="w-full space-y-6">
      <DatasetOverviewPanel schema={schema} loading={loading} />
    </div>
  );
}
