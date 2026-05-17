#!/usr/bin/env node
/**
 * Deploy Trading AI n8n workflows via Public API.
 *
 * Required env:
 *   N8N_URL, N8N_API_KEY, API_INTERNAL_BASE_URL, INTERNAL_API_KEY
 *
 * Optional:
 *   RSS_FEED_URL (default Yahoo Finance)
 *   RSS_SOURCE (default yahoo_finance_rss)
 */

const N8N_URL = (process.env.N8N_URL || "").replace(/\/$/, "");
const N8N_API_KEY = process.env.N8N_API_KEY || "";
const API_BASE = (process.env.API_INTERNAL_BASE_URL || "http://api:8090").replace(/\/$/, "");
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || "";
const RSS_FEED = process.env.RSS_FEED_URL || "https://finance.yahoo.com/news/rssindex";
const RSS_SOURCE = process.env.RSS_SOURCE || "yahoo_finance_rss";

if (!N8N_URL || !N8N_API_KEY || !INTERNAL_KEY) {
  console.error("Set N8N_URL, N8N_API_KEY, and INTERNAL_API_KEY");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  "X-N8N-API-KEY": N8N_API_KEY,
};

async function api(method, path, body) {
  const res = await fetch(`${N8N_URL}/api/v1${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} ${res.status}: ${text}`);
  }
  return data;
}

function httpNode(id, name, x, y, method, urlPath, bodyExpr) {
  const params = {
    method,
    url: `=${API_BASE}${urlPath}`,
    authentication: "none",
    sendHeaders: true,
    headerParameters: {
      parameters: [{ name: "X-Internal-Api-Key", value: INTERNAL_KEY }],
    },
    options: {},
  };
  if (bodyExpr) {
    params.sendBody = true;
    params.specifyBody = "json";
    params.jsonBody = bodyExpr;
  }
  return {
    id,
    name,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [x, y],
    parameters: params,
  };
}

function scheduleNode(id, name, x, y, minutes) {
  return {
    id,
    name,
    type: "n8n-nodes-base.scheduleTrigger",
    typeVersion: 1.2,
    position: [x, y],
    parameters: {
      rule: { interval: [{ field: "minutes", minutesInterval: minutes }] },
    },
  };
}

function setNode(id, name, x, y, assignments) {
  return {
    id,
    name,
    type: "n8n-nodes-base.set",
    typeVersion: 3.4,
    position: [x, y],
    parameters: {
      mode: "manual",
      duplicateItem: false,
      assignments: {
        assignments: assignments.map((a) => ({
          id: a.id,
          name: a.name,
          value: a.value,
          type: a.type || "string",
        })),
      },
      options: {},
    },
  };
}

function buildWorkflow(name, minutes, workflowName, workPath, extraBody) {
  const trigger = scheduleNode("trigger", "Schedule", 0, 0, minutes);
  const start = httpNode(
    "start",
    "Start Run",
    260,
    0,
    "POST",
    "/internal/workflows/runs/start",
    `={{ JSON.stringify({ workflowName: "${workflowName}", runId: $execution.id, metadata: {} }) }}`
  );
  const work = httpNode("work", "Work", 520, 0, "POST", workPath, extraBody);
  const end = httpNode(
    "end",
    "End Run",
    780,
    0,
    "POST",
    "/internal/workflows/runs/end",
    `={{ JSON.stringify({ runId: $('Start Run').first().json.id, status: "success", itemsProcessed: $json.processed ?? $json.generated ?? $json.upserted ?? $json.inserted ?? 1, durationMs: 0 }) }}`
  );

  return {
    name,
    nodes: [trigger, start, work, end],
    connections: {
      Schedule: { main: [[{ node: "Start Run", type: "main", index: 0 }]] },
      "Start Run": { main: [[{ node: "Work", type: "main", index: 0 }]] },
      Work: { main: [[{ node: "End Run", type: "main", index: 0 }]] },
    },
    settings: { executionOrder: "v1" },
  };
}

const workflows = [
  buildWorkflow("01 News RSS Ingestion", 30, "news_rss_ingestion", "/internal/news/rss/ingest", `={{ JSON.stringify({ feedUrl: "${RSS_FEED}", source: "${RSS_SOURCE}" }) }}`),
  buildWorkflow("02 News Article Processing", 30, "news_article_processing", "/internal/news/backlog/process-batch", undefined),
  buildWorkflow("03 News Symbol Mapping", 30, "news_symbol_mapping", "/internal/news/articles/map-symbols", undefined),
  buildWorkflow("04 News Sentiment", 30, "news_sentiment", "/internal/news/sentiment/run-batch", undefined),
  buildWorkflow("05 Market Data Alpaca", 60, "market_data_alpaca", "/internal/market/candles/ingest-alpaca", undefined),
  buildWorkflow("06 Market Features", 60, "market_features", "/internal/features/market/generate", undefined),
  buildWorkflow("07 News Features", 60, "news_features", "/internal/features/news/generate", undefined),
  buildWorkflow("08 Symbol Snapshots", 60, "symbol_snapshots", "/internal/features/snapshots/generate", undefined),
  buildWorkflow("09 Workspace Signals", 60, "workspace_signals", "/internal/workspaces/signals/generate-all", undefined),
];

async function upsertWorkflow(def) {
  const existing = await api("GET", "/workflows?limit=100");
  const found = (existing.data || []).find((w) => w.name === def.name);
  if (found) {
    const updated = await api("PUT", `/workflows/${found.id}`, {
      name: def.name,
      nodes: def.nodes,
      connections: def.connections,
      settings: def.settings,
    });
    await api("POST", `/workflows/${found.id}/activate`);
    return { action: "updated", id: updated.id, name: def.name };
  }
  const created = await api("POST", "/workflows", def);
  await api("POST", `/workflows/${created.id}/activate`);
  return { action: "created", id: created.id, name: def.name };
}

async function main() {
  console.log("Deploying to", N8N_URL, "API", API_BASE);
  for (const def of workflows) {
    const result = await upsertWorkflow(def);
    console.log(result.action, result.name, result.id);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
