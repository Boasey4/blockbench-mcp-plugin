/**
 * Measures what `tools/list` costs a client under each tool profile (issue #54).
 *
 * Registers every documented tool on an in-memory MCP server with every native condition
 * passing, lists them through a real MCP client, and reports the size of the JSON each client
 * receives. Tokens are estimated at 4 characters per token; real tokenizers vary by model.
 *
 * Usage: bun run tools:size
 */
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createTool, setUserToolFilter } from "@/lib/factories";
import { compileToolFilter, TOOL_PROFILE_FULL, TOOL_PROFILE_LEAN } from "@/lib/tool-filter";
import { getServer } from "@/server/server";
import { toolManifest } from "./docs-manifest";

/** Optional integrations whose tools only appear while their Blockbench plugin is installed. */
const PLUGIN_CATEGORIES = new Set(["GeckoLib Integration", "Hytale Integration"]);

interface IListedTool {
  name: string;
}

interface IProfileRow {
  label: string;
  tools: number;
  characters: number;
}

// Every condition passes, so the numbers are the most a client can be sent.
Object.assign(globalThis, { Condition: () => true });

for (const group of toolManifest) {
  for (const spec of group.tools) {
    createTool(spec.name, {
      description: spec.description,
      annotations: spec.annotations,
      parameters: spec.parameters as z.ZodType,
      condition: spec.condition,
      execute: async () => "",
    }, spec.status);
  }
}

const pluginTools = new Set(
  toolManifest.filter(group => PLUGIN_CATEGORIES.has(group.category)).flatMap(group => group.tools.map(tool => tool.name)),
);

const client = new Client({ name: "tool-list-size", version: "1.0.0" });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await getServer().connect(serverTransport);
await client.connect(clientTransport);

async function measure(label: string, profile: string, skipPluginTools: boolean): Promise<IProfileRow> {
  const compiled = compileToolFilter(profile, "");
  setUserToolFilter(name => compiled(name) || (skipPluginTools && pluginTools.has(name)));
  const { tools } = await client.listTools();
  return { label, tools: tools.length, characters: JSON.stringify(tools).length };
}

const rows = [
  await measure("Full, every integration installed", TOOL_PROFILE_FULL, false),
  await measure("Full, no GeckoLib/Hytale plugin", TOOL_PROFILE_FULL, true),
  await measure("Lean, no GeckoLib/Hytale plugin", TOOL_PROFILE_LEAN, true),
];

const baseline = rows[1].characters;
console.log("profile".padEnd(36), "tools".padStart(6), "chars".padStart(9), "~tokens".padStart(9), "vs full".padStart(9));
for (const row of rows) {
  const change = `${Math.round((row.characters / baseline - 1) * 100)}%`;
  console.log(
    row.label.padEnd(36),
    String(row.tools).padStart(6),
    String(row.characters).padStart(9),
    String(Math.round(row.characters / 4)).padStart(9),
    change.padStart(9),
  );
}

const sizes = (await client.listTools()).tools
  .map((tool: IListedTool) => ({ name: tool.name, characters: JSON.stringify(tool).length }))
  .sort((a, b) => b.characters - a.characters)
  .slice(0, 10);
console.log("\nLargest tools still published by Lean:");
for (const { name, characters } of sizes) console.log(`  ${name.padEnd(30)} ${String(characters).padStart(7)} chars`);

await client.close();
process.exit(0);
