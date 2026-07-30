import { describe, expect, it } from "vitest";
import {
  extractMinecraftProjectFiles,
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
});
