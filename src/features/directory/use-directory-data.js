import { useEffect, useState } from "react";

const EMPTY_TABLES = {
  "mcp-server": [],
  skill: [],
  plugin: [],
  agent: [],
};

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
        fetch("/data/harnesses.json"),
        fetch("/data/mcp-server.json"),
        fetch("/data/skill.json"),
        fetch("/data/plugin.json"),
        fetch("/data/agent.json"),
        fetch("/data/report.json"),
        fetch("/data/growth.json"),
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
