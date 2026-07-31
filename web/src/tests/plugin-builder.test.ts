import { describe, expect, it } from "vitest";
import {
  extractMinecraftProjectFiles,
  parsePluginBuildCapabilities,
  pluginBuilderErrorMessage,
  pluginBuildCapabilitiesPrompt,
  pluginBuildStartSchema,
  PluginProjectExtractionError,
  shouldOfferPluginBuild
} from "../server/plugin-builder";

const COMPLETE_PROJECT = `
### \`src/main/java/de/example/HelloPlugin.java\`
\`\`\`java
package de.example;
public final class HelloPlugin {}
\`\`\`

### src/main/resources/plugin.yml
\`\`\`yaml
name: HelloPlugin
version: 1.0.0
main: de.example.HelloPlugin
\`\`\`

### pom.xml
\`\`\`xml
<project>ignored</project>
\`\`\`
`;

describe("Minecraft plugin project extraction", () => {
  it("extracts only safe Java and resource files", () => {
    expect(extractMinecraftProjectFiles(COMPLETE_PROJECT)).toEqual([
      {
        path: "src/main/java/de/example/HelloPlugin.java",
        content: "package de.example;\npublic final class HelloPlugin {}\n"
      },
      {
        path: "src/main/resources/plugin.yml",
        content: "name: HelloPlugin\nversion: 1.0.0\nmain: de.example.HelloPlugin\n"
      }
    ]);
  });

  it("rejects answers without a plugin descriptor", () => {
    expect(() => extractMinecraftProjectFiles(`
### src/main/java/de/example/HelloPlugin.java
\`\`\`java
class HelloPlugin {}
\`\`\`
`)).toThrow(PluginProjectExtractionError);
  });

  it("rejects duplicate paths", () => {
    expect(() => extractMinecraftProjectFiles(`${COMPLETE_PROJECT}
### src/main/resources/plugin.yml
\`\`\`yaml
name: Duplicate
\`\`\`
`)).toThrow(/mehrfach/);
  });

  it("offers compilation only for complete Minecraft answers", () => {
    expect(shouldOfferPluginBuild("minecraft", COMPLETE_PROJECT)).toBe(true);
    expect(shouldOfferPluginBuild("coding", COMPLETE_PROJECT)).toBe(false);
    expect(shouldOfferPluginBuild("minecraft", "Nur eine Erklärung")).toBe(false);
  });

  it("accepts Folia, automatic Java and modern Minecraft versions", () => {
    const parsed = pluginBuildStartSchema.parse({
      source: COMPLETE_PROJECT,
      projectName: "FoliaPlugin",
      platform: "folia",
      apiVersion: "26.2",
      javaRelease: 0
    });

    expect(parsed.platform).toBe("folia");
    expect(parsed.javaRelease).toBe(0);
  });

  it("parses and summarizes the live builder catalog", () => {
    const capabilities = parsePluginBuildCapabilities({
      builderVersion: "2.0.0",
      javaRuntime: 25,
      javaReleases: [8, 11, 16, 17, 21, 25],
      platforms: [{
        id: "folia",
        label: "Folia",
        documentationUrl: "https://github.com/PaperMC/Folia",
        metadataUrl: "https://repo.papermc.io/repository/maven-public/dev/folia/folia-api/maven-metadata.xml",
        latestMinecraftVersion: "26.2",
        latestApiVersion: "26.2.build.1-beta",
        versions: [{
          minecraftVersion: "26.2",
          apiVersion: "26.2.build.1-beta",
          javaRelease: 25
        }]
      }]
    });

    const prompt = pluginBuildCapabilitiesPrompt(capabilities);
    expect(prompt).toContain("Folia: aktuell 26.2");
    expect(prompt).toContain("26.2 -> API 26.2.build.1-beta, Java 25");
    expect(prompt).toContain("Folia-Maven-Metadaten");
  });

  it("keeps concrete builder validation details", () => {
    expect(pluginBuilderErrorMessage({
      error: {
        code: "invalid_build",
        message: "Das Plugin-Projekt konnte nicht angenommen werden.",
        details: [
          "Mindestens eine Java-Datei unter src/main/java wird benötigt.",
          "src/main/resources/plugin.yml fehlt."
        ]
      }
    })).toBe(
      "Das Plugin-Projekt konnte nicht angenommen werden. "
      + "Mindestens eine Java-Datei unter src/main/java wird benötigt. "
      + "src/main/resources/plugin.yml fehlt."
    );
  });
});
