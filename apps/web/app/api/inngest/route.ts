import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";
import { driveSync } from "../../../inngest/drive-sync";
import { jobSearch } from "../../../inngest/job-search";
import { analyticsAggregation } from "../../../inngest/analytics-aggregation";

const handler = serve({ client: inngest, functions: [driveSync, jobSearch, analyticsAggregation] });
export const GET = handler.GET;
export const POST = handler.POST;
export const PUT = handler.PUT;
