/**
 * User-chosen tool visibility (issue #54, "Reduce Token Usage"). Every published tool costs the
 * client tokens on each `tools/list`, so Settings > General offers a tool profile and a list of
 * name patterns to hide. Pure: no Blockbench globals, so it can be unit tested.
 */

/** `mcp_tool_profile` value that publishes every tool whose native condition passes. */
export const TOOL_PROFILE_FULL = "full";
/** `mcp_tool_profile` value that hides the groups listed in {@link LEAN_HIDDEN_PATTERNS}. */
export const TOOL_PROFILE_LEAN = "lean";
/** `mcp_tool_profile` value that publishes only {@link MINIMAL_TOOLS}. */
export const TOOL_PROFILE_MINIMAL = "minimal";

/**
 * Groups the lean profile hides: particles, armatures and vertex weights, mesh editing, material
 * instances and the FPS probe. Cube models (Minecraft entities, blocks, items) can still be built,
 * textured, painted, UV mapped, animated and exported.
 */
export const LEAN_HIDDEN_PATTERNS: readonly string[] = [
  "*particle*",
  "add_locator",
  "*armature*",
  "*vertex_weight*",
  "set_ik_controller",
  "*_mesh",
  "*mesh_*",
  "create_sphere",
  "create_cylinder",
  "create_polyhedron",
  "knife_tool",
  "*material_instance*",
  "get_average_fps",
];

/**
 * The only tools the minimal profile publishes: enough to create a project, build and arrange
 * cubes, texture and paint them, keyframe a simple animation, check the result and export.
 * Meant for small or local models that lose track of long tool lists.
 */
export const MINIMAL_TOOLS: readonly string[] = [
  "create_project", "get_project_info", "get_capabilities",
  "place_cube", "modify_cube", "remove_element", "add_group", "duplicate_element", "rename_element",
  "list_outline", "get_selection",
  "create_texture", "apply_texture", "list_textures", "paint_fill_tool", "paint_with_brush",
  "list_modes", "set_mode",
  "create_animation", "manage_keyframes",
  "capture_screenshot",
  "undo", "redo", "save_checkpoint",
  "list_export_formats", "export_model",
];

/** Splits the `mcp_hidden_tools` setting on commas, whitespace and semicolons. */
export function parseToolPatterns(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value.split(/[\s,;]+/).map(pattern => pattern.trim().toLowerCase()).filter(Boolean);
}

/** `*` matches any run of characters; everything else matches literally, case-insensitively. */
function patternToRegExp(pattern: string): RegExp {
  const source = pattern.split("*").map(part => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${source}$`, "i");
}

/**
 * Builds the predicate `isToolAvailable` consults: true when the profile or the hidden patterns
 * exclude the tool. The minimal profile also hides tools other plugins contribute. Unknown profiles behave as full, so a bad stored value never hides tools.
 */
export function compileToolFilter(profile: unknown, hiddenPatterns: unknown): (name: string) => boolean {
  const patterns = [
    ...(profile === TOOL_PROFILE_LEAN ? LEAN_HIDDEN_PATTERNS : []),
    ...parseToolPatterns(hiddenPatterns),
  ].map(patternToRegExp);
  const minimal = profile === TOOL_PROFILE_MINIMAL ? new Set(MINIMAL_TOOLS) : null;
  return name => (minimal !== null && !minimal.has(name)) || patterns.some(pattern => pattern.test(name));
}
