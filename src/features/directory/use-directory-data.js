import { useEffect, useState } from "react";

const EMPTY_TABLES = {
  "mcp-server": [],
  skill: [],
  plugin: [],
  agent: [],
};

const BASE_URL = import.meta.env.BASE_URL || "/";
const NORMALIZED_BASE_URL = BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`;

function withBase(path) {
  return `${NORMALIZED_BASE_URL}${path.replace(/^\//, "")}`;
}

export function useDirectoryData(initialData = null) {
  const [harnesses, setHarnesses] = useState(initialData?.harnesses ?? []);
  const [tables, setTables] = useState(initialData?.tables ?? EMPTY_TABLES);
  const [report, setReport] = useState(initialData?.report ?? null);
  const [growth, setGrowth] = useState(initialData?.growth ?? null);

  useEffect(() => {
    if (initialData) {
      return undefined;
    }

    let cancelled = false;

    async function loadData() {
      const [
        harnessResponse,
        mcpResponse,
        skillResponse,
        pluginResponse,
        agentResponse,
        reportResponse,
        growthResponse,
      ] = await Promise.all([
        fetch(withBase("/data/harnesses.json")),
        fetch(withBase("/data/mcp-server.json")),
        fetch(withBase("/data/skill.json")),
        fetch(withBase("/data/plugin.json")),
        fetch(withBase("/data/agent.json")),
        fetch(withBase("/data/report.json")),
        fetch(withBase("/data/growth.json")),
      ]);

      const [
        harnessData,
        mcpRows,
        skillRows,
        pluginRows,
        agentRows,
        reportData,
        growthData,
      ] = await Promise.all([
        harnessResponse.json(),
        mcpResponse.json(),
        skillResponse.json(),
        pluginResponse.json(),
        agentResponse.json(),
        reportResponse.json(),
        growthResponse.json(),
      ]);

      if (cancelled) return;

      setHarnesses(harnessData.harnesses || []);
      setTables({
        "mcp-server": mcpRows,
        skill: skillRows,
        plugin: pluginRows,
        agent: agentRows,
      });
      setReport(reportData);
      setGrowth(growthData);
    }

    loadData().catch((error) => {
      if (!cancelled) {
        console.error(error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [initialData]);

  return {
    harnesses,
    tables,
    report,
    growth,
  };
}
