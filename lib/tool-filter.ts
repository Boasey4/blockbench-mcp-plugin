/**
 * User-chosen tool visibility (issue #54, "Reduce Token Usage"). Every published tool costs the
 * client tokens on each `tools/list`, so Settings > General offers a tool profile and a list of
 * name patterns to hide. Pure: no Blockbench globals, so it can be unit tested.
 */

/** `mcp_tool_profile` value that publishes every tool whose native condition passes. */
export const TOOL_PROFILE_FULL = "full";
/** `mcp_tool_profile` value that hides the groups listed in {@link LEAN_HIDDEN_PATTERNS}. */
export const TOOL_PROFILE_LEAN = "lean";

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
 * exclude the tool. Unknown profiles behave as full, so a bad stored value never hides tools.
 */
export function compileToolFilter(profile: unknown, hiddenPatterns: unknown): (name: string) => boolean {
  const patterns = [
    ...(profile === TOOL_PROFILE_LEAN ? LEAN_HIDDEN_PATTERNS : []),
    ...parseToolPatterns(hiddenPatterns),
  ].map(patternToRegExp);
  return name => patterns.some(pattern => pattern.test(name));
}
