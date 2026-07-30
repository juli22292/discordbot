package de.carrothd.modmail.builder;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

final class MinecraftVersionCatalogTest {
    private static final MinecraftVersionCatalog.PlatformDefinition PAPER =
            MinecraftVersionCatalog.platform("paper").orElseThrow();
    private static final MinecraftVersionCatalog.PlatformDefinition FOLIA =
            MinecraftVersionCatalog.platform("folia").orElseThrow();

    @Test
    void resolvesLegacyMinecraftVersionAndJavaAutomatically() throws Exception {
        MinecraftVersionCatalog.PlatformMetadata metadata = MinecraftVersionCatalog.parseMetadata(
                PAPER,
                metadata(
                        "1.21.11-R0.1-SNAPSHOT",
                        "1.20.6-R0.1-SNAPSHOT",
                        "1.21.4-R0.1-SNAPSHOT",
                        "1.21.11-R0.1-SNAPSHOT"
                )
        );

        MinecraftVersionCatalog.ResolvedTarget target = MinecraftVersionCatalog.resolve(
                metadata,
                "1.21.4",
                MinecraftVersionCatalog.AUTO_JAVA_RELEASE
        );

        assertEquals("1.21.4", target.minecraftVersion());
        assertEquals("1.21.4-R0.1-SNAPSHOT", target.apiVersion());
        assertEquals(21, target.javaRelease());
    }

    @Test
    void resolvesModernVersionToLatestStableBuildAndJava25() throws Exception {
        MinecraftVersionCatalog.PlatformMetadata metadata = MinecraftVersionCatalog.parseMetadata(
                PAPER,
                metadata(
                        "26.2.build.87-stable",
                        "26.2.build.1-alpha",
                        "26.2.build.40-beta",
                        "26.2.build.87-stable"
                )
        );

        MinecraftVersionCatalog.ResolvedTarget target = MinecraftVersionCatalog.resolve(
                metadata,
                "26.2",
                MinecraftVersionCatalog.AUTO_JAVA_RELEASE
        );

        assertEquals("26.2", target.minecraftVersion());
        assertEquals("26.2.build.87-stable", target.apiVersion());
        assertEquals(25, target.javaRelease());
    }

    @Test
    void resolvesLatestFoliaAndKeepsFoliaArtifact() throws Exception {
        MinecraftVersionCatalog.PlatformMetadata metadata = MinecraftVersionCatalog.parseMetadata(
                FOLIA,
                metadata(
                        "26.2.build.1-beta",
                        "1.21.11-R0.1-SNAPSHOT",
                        "26.2.build.1-beta"
                )
        );

        MinecraftVersionCatalog.ResolvedTarget target = MinecraftVersionCatalog.resolve(
                metadata,
                "latest",
                MinecraftVersionCatalog.AUTO_JAVA_RELEASE
        );

        assertEquals("folia", target.platform().key());
        assertEquals("26.2.build.1-beta", target.apiVersion());
        assertEquals(25, target.javaRelease());
    }

    @Test
    void resolvesWildcardToNewestMatchingPatch() throws Exception {
        MinecraftVersionCatalog.PlatformMetadata metadata = MinecraftVersionCatalog.parseMetadata(
                PAPER,
                metadata(
                        "1.21.11-R0.1-SNAPSHOT",
                        "1.21.4-R0.1-SNAPSHOT",
                        "1.21.8-R0.1-SNAPSHOT",
                        "1.21.11-R0.1-SNAPSHOT"
                )
        );

        MinecraftVersionCatalog.ResolvedTarget target = MinecraftVersionCatalog.resolve(
                metadata,
                "1.21.x",
                MinecraftVersionCatalog.AUTO_JAVA_RELEASE
        );

        assertEquals("1.21.11", target.minecraftVersion());
    }

    @Test
    void rejectsAJavaVersionThatDoesNotMatchTheServerGeneration() throws Exception {
        MinecraftVersionCatalog.PlatformMetadata metadata = MinecraftVersionCatalog.parseMetadata(
                PAPER,
                metadata("26.2.build.87-stable", "26.2.build.87-stable")
        );

        MinecraftVersionCatalog.VersionResolutionException error = assertThrows(
                MinecraftVersionCatalog.VersionResolutionException.class,
                () -> MinecraftVersionCatalog.resolve(metadata, "26.2", 21)
        );

        assertTrue(error.getMessage().contains("Java 25"));
        assertTrue(error.getMessage().contains("Automatisch"));
    }

    @Test
    void usesTheOfficialJavaCompatibilityTable() {
        assertEquals(8, MinecraftVersionCatalog.recommendedJavaRelease("1.8.8"));
        assertEquals(11, MinecraftVersionCatalog.recommendedJavaRelease("1.16.4"));
        assertEquals(16, MinecraftVersionCatalog.recommendedJavaRelease("1.16.5"));
        assertEquals(17, MinecraftVersionCatalog.recommendedJavaRelease("1.19.4"));
        assertEquals(21, MinecraftVersionCatalog.recommendedJavaRelease("1.21.11"));
        assertEquals(25, MinecraftVersionCatalog.recommendedJavaRelease("26.1"));
    }

    private static String metadata(String latest, String... versions) {
        StringBuilder entries = new StringBuilder();
        for (String version : versions) {
            entries.append("<version>").append(version).append("</version>");
        }
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <metadata>
                  <versioning>
                    <latest>%s</latest>
                    <release>%s</release>
                    <versions>%s</versions>
                  </versioning>
                </metadata>
                """.formatted(latest, latest, entries);
    }
}
