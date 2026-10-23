import { describe, expect, test } from "bun:test";
import { compileToolFilter, MINIMAL_TOOLS, parseToolPatterns, TOOL_PROFILE_FULL, TOOL_PROFILE_LEAN, TOOL_PROFILE_MINIMAL } from "@/lib/tool-filter";
import docs from "@/docs/api.json";

const allTools = (docs as { tools: { name: string; category: string }[] }).tools;

describe("parseToolPatterns", () => {
  test("splits on commas, semicolons and whitespace and lower-cases", () => {
    expect(parseToolPatterns(" Hytale_*, *particle* ;knife_tool\nundo ")).toEqual(["hytale_*", "*particle*", "knife_tool", "undo"]);
  });

  test("ignores non-strings and empty values", () => {
    expect(parseToolPatterns(undefined)).toEqual([]);
    expect(parseToolPatterns(42)).toEqual([]);
    expect(parseToolPatterns(" , ")).toEqual([]);
  });
});

describe("compileToolFilter", () => {
  test("full profile with no patterns hides nothing", () => {
    const hidden = compileToolFilter(TOOL_PROFILE_FULL, "");
    expect(allTools.filter(tool => hidden(tool.name))).toEqual([]);
  });

  test("an unknown profile behaves as full", () => {
    const hidden = compileToolFilter("bogus", undefined);
    expect(allTools.some(tool => hidden(tool.name))).toBe(false);
  });

  test("hidden patterns support * wildcards and exact names, case-insensitively", () => {
    const hidden = compileToolFilter(TOOL_PROFILE_FULL, "hytale_*, UNDO");
    expect(hidden("hytale_create_quad")).toBe(true);
    expect(hidden("undo")).toBe(true);
    expect(hidden("redo")).toBe(false);
    expect(hidden("place_cube")).toBe(false);
  });

  test("regex characters in patterns match literally", () => {
    const hidden = compileToolFilter(TOOL_PROFILE_FULL, "place.cube");
    expect(hidden("place_cube")).toBe(false);
    expect(hidden("place.cube")).toBe(true);
  });

  test("lean hides the niche groups and keeps the cube modeling workflow", () => {
    const hidden = compileToolFilter(TOOL_PROFILE_LEAN, "");
    const hiddenCategories = ["Particles", "Armature", "Mesh Editing", "Material Instances", "Performance"];
    const meshUv = ["set_mesh_uv", "auto_uv_mesh", "rotate_mesh_uv"];
    for (const tool of allTools) {
      // flip_in_place lives under Mesh Editing but also mirrors cubes.
      const expectHidden = (hiddenCategories.includes(tool.category) && tool.name !== "flip_in_place") || meshUv.includes(tool.name);
      expect([tool.name, hidden(tool.name)]).toEqual([tool.name, expectHidden]);
    }
  });

  test("lean keeps the core tools", () => {
    const hidden = compileToolFilter(TOOL_PROFILE_LEAN, "");
    for (const name of ["place_cube", "modify_cube", "create_texture", "paint_with_brush", "set_cube_uv",
      "create_animation", "manage_keyframes", "export_model", "undo", "capture_screenshot", "get_project_info"]) {
      expect([name, hidden(name)]).toEqual([name, false]);
    }
  });

  test("minimal publishes exactly its list, and every listed tool exists", () => {
    const hidden = compileToolFilter(TOOL_PROFILE_MINIMAL, "");
    const names = new Set(allTools.map(tool => tool.name));
    expect(MINIMAL_TOOLS.filter(name => !names.has(name))).toEqual([]);
    expect(allTools.filter(tool => !hidden(tool.name)).map(tool => tool.name).sort()).toEqual([...MINIMAL_TOOLS].sort());
    expect(hidden("another_plugin_tool")).toBe(true);
  });

  test("hidden patterns still apply on top of minimal", () => {
    const hidden = compileToolFilter(TOOL_PROFILE_MINIMAL, "paint_*");
    expect(hidden("paint_with_brush")).toBe(true);
    expect(hidden("place_cube")).toBe(false);
  });
});
