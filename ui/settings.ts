import { DEFAULT_MCP_PORT, SETTING_DISCLOSE_AI_USAGE, SETTING_RISKY_EVAL_ENABLED, SETTING_SCRATCHPAD_ENABLED } from "@/lib/constants";
import { refreshToolAvailability, setUserToolFilter } from "@/lib/factories";
import { compileToolFilter, TOOL_PROFILE_FULL, TOOL_PROFILE_LEAN, TOOL_PROFILE_MINIMAL } from "@/lib/tool-filter";
import { onScratchpadSettingChanged } from "@/lib/scratchpad-mode";

const settings: Setting[] = [];

export function settingsSetup() {
  const category = "general";

  // Objects kept by an earlier `keepValues` teardown are superseded by the ones created below.
  // Forget them: `Setting.delete()` works by id, so deleting a stale one later would remove the new one.
  settings.length = 0;

  settings.push(
    new Setting("mcp_instructions", {
      name: tl("mcp.settings.instructions_name"),
      // https://github.com/punkpeye/fastmcp?tab=readme-ov-file#providing-instructions
      description: tl("mcp.settings.instructions_desc"),
      type: "text",
      // Sent to clients as server instructions; empty by default (see lib/instructions.ts).
      value: "",
      category,
      icon: "psychology",
    }),
    new Setting("mcp_port", {
      name: tl("mcp.settings.port_name"),
      description: tl("mcp.settings.port_desc"),
      type: "number",
      value: DEFAULT_MCP_PORT,
      min: 1,
      max: 65535,
      category,
      icon: "numbers",
    }),
    new Setting("mcp_host", {
      name: tl("mcp.settings.host_name"),
      description: tl("mcp.settings.host_desc"),
      type: "text",
      value: "localhost",
      category,
      icon: "lan",
    }),
    new Setting("mcp_access_token", {
      name: tl("mcp.settings.access_token_name"),
      description: tl("mcp.settings.access_token_desc"),
      type: "password",
      value: "",
      category,
      icon: "key",
    }),
    new Setting("mcp_endpoint", {
      name: tl("mcp.settings.endpoint_name"),
      description: tl("mcp.settings.endpoint_desc"),
      type: "text",
      value: "/bb-mcp",
      category,
      icon: "webhook",
    }),
    new Setting("mcp_prompt_cdn_enabled", {
      name: tl("mcp.settings.prompt_cdn_name"),
      description: tl("mcp.settings.prompt_cdn_desc"),
      type: "toggle",
      value: true,
      category,
      icon: "cloud_download",
    }),
    new Setting("mcp_session_timeout", {
      name: tl("mcp.settings.session_timeout_name"),
      description: tl("mcp.settings.session_timeout_desc"),
      type: "number",
      value: 30,
      min: 1,
      max: 1440,
      category,
      icon: "timer",
    }),
    new Setting("mcp_sse_heartbeat", {
      name: tl("mcp.settings.sse_heartbeat_name"),
      description: tl("mcp.settings.sse_heartbeat_desc"),
      type: "number",
      value: 15,
      min: 0,
      max: 600,
      category,
      icon: "favorite",
    }),
    new Setting(SETTING_SCRATCHPAD_ENABLED, {
      name: tl("mcp.settings.scratchpad_name"),
      description: tl("mcp.settings.scratchpad_desc"),
      type: "toggle",
      value: false,
      category,
      icon: "science",
      onChange: onScratchpadSettingChanged,
    }),
    new Setting(SETTING_DISCLOSE_AI_USAGE, {
      name: tl("mcp.settings.disclose_ai_name"),
      description: tl("mcp.settings.disclose_ai_desc"),
      type: "toggle",
      value: true,
      category,
      icon: "verified_user",
    }),
    new Setting(SETTING_RISKY_EVAL_ENABLED, {
      name: tl("mcp.settings.risky_eval_name"),
      description: tl("mcp.settings.risky_eval_desc"),
      type: "toggle",
      // Off by default: the tool runs arbitrary JavaScript with the plugin's (Node) permissions.
      value: false,
      category,
      icon: "code",
      // Connected clients get tools/list_changed right away instead of on the next editor refresh.
      onChange: () => refreshToolAvailability(),
    }),
    new Setting("mcp_tool_profile", {
      name: tl("mcp.settings.tool_profile_name"),
      description: tl("mcp.settings.tool_profile_desc"),
      type: "select",
      value: TOOL_PROFILE_FULL,
      options: {
        [TOOL_PROFILE_FULL]: tl("mcp.settings.tool_profile_full"),
        [TOOL_PROFILE_LEAN]: tl("mcp.settings.tool_profile_lean"),
        [TOOL_PROFILE_MINIMAL]: tl("mcp.settings.tool_profile_minimal"),
      },
      category,
      icon: "filter_list",
      onChange: applyToolFilterSettings,
    }),
    new Setting("mcp_hidden_tools", {
      name: tl("mcp.settings.hidden_tools_name"),
      description: tl("mcp.settings.hidden_tools_desc"),
      type: "text",
      value: "",
      category,
      icon: "visibility_off",
      onChange: applyToolFilterSettings,
    })
  );
  applyToolFilterSettings();
}

/** Applies `mcp_tool_profile` and `mcp_hidden_tools` to tool availability. */
function applyToolFilterSettings(): void {
  setUserToolFilter(compileToolFilter(Settings.get("mcp_tool_profile"), Settings.get("mcp_hidden_tools")));
}

/** Options for {@link settingsTeardown}. */
export interface ISettingsTeardownOptions {
  /** Keep the stored values so a reload (`onunload` + `onload`) does not reset them to defaults. */
  keepValues?: boolean;
}

/**
 * Remove the plugin's settings from the Settings dialog.
 *
 * Blockbench saves settings by iterating the live `Setting` objects, so `delete()` on unload drops
 * every user-changed value (e.g. `mcp_port`) and defaults come back on the next launch. URL-installed
 * plugins are unloaded and reloaded on every start, so this hit everyone who changed the port. With
 * `keepValues` the current values are written to `Settings.stored`, which the `Setting` objects that
 * `settingsSetup()` re-creates read from, and the old objects stay registered so the next save still
 * includes them. Uninstalling deletes them for real.
 *
 * Blockbench runs `onunload` and then `onuninstall` on the same instance when uninstalling, so a
 * `keepValues` teardown must leave the objects tracked for the plain teardown that follows. A reload
 * does not accumulate stale objects because `settingsSetup()` forgets them before creating new ones.
 */
export function settingsTeardown(options: ISettingsTeardownOptions = {}) {
  // blockbench-types declares `stored` as Setting records, but at runtime it is `{ value }` per id.
  const stored = Settings.stored as Record<string, { value: unknown }>;

  settings.forEach((setting) => {
    if (options.keepValues) {
      stored[setting.id] = { value: setting.master_value };
      return;
    }
    setting.delete();
    delete stored[setting.id];
  });

  if (!options.keepValues) {
    settings.length = 0;
  }
}
