package de.carrothd.modmail.builder;

import org.w3c.dom.Document;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

final class MinecraftVersionCatalog {
    static final int AUTO_JAVA_RELEASE = 0;
    static final List<Integer> SUPPORTED_JAVA_RELEASES = List.of(8, 11, 16, 17, 21, 25);
    private static final Set<String> LATEST_ALIASES = Set.of(
            "latest", "stable", "newest", "neueste", "aktuell"
    );
    private static final Map<String, PlatformDefinition> PLATFORMS = platformDefinitions();

    private final HttpClient httpClient;
    private final Duration cacheTtl;
    private final Map<String, CachedMetadata> cache = new ConcurrentHashMap<>();

    MinecraftVersionCatalog(Duration cacheTtl) {
        this(
                HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(10))
                        .followRedirects(HttpClient.Redirect.NORMAL)
                        .build(),
                cacheTtl
        );
    }

    MinecraftVersionCatalog(HttpClient httpClient, Duration cacheTtl) {
        this.httpClient = httpClient;
        this.cacheTtl = cacheTtl;
    }

    static Optional<PlatformDefinition> platform(String key) {
        if (key == null) return Optional.empty();
        return Optional.ofNullable(PLATFORMS.get(key.toLowerCase(Locale.ROOT)));
    }

    static List<PlatformDefinition> platforms() {
        return List.copyOf(PLATFORMS.values());
    }

    List<PlatformCapability> capabilities() throws CatalogException {
        List<PlatformCapability> result = new ArrayList<>();
        for (PlatformDefinition platform : PLATFORMS.values()) {
            PlatformMetadata metadata = metadata(platform);
            result.add(new PlatformCapability(
                    platform.key(),
                    platform.label(),
                    platform.documentationUrl(),
                    platform.metadataUri().toString(),
                    metadata.latest().minecraftVersion(),
                    metadata.latest().apiVersion(),
                    metadata.versions()
            ));
        }
        return result;
    }

    ResolvedTarget resolve(
            String platformKey,
            String requestedVersion,
            int requestedJavaRelease
    ) throws CatalogException, VersionResolutionException {
        PlatformDefinition platform = platform(platformKey)
                .orElseThrow(() -> new VersionResolutionException(
                        "Diese Plattform wird nicht unterstützt. Verfügbar sind Paper, Folia, Purpur und Spigot."
                ));
        return resolve(metadata(platform), requestedVersion, requestedJavaRelease);
    }

    static ResolvedTarget resolve(
            PlatformMetadata metadata,
            String requestedVersion,
            int requestedJavaRelease
    ) throws VersionResolutionException {
        String cleanedRequest = requestedVersion == null ? "" : requestedVersion.trim();
        final String requested = cleanedRequest.isBlank() ? "latest" : cleanedRequest;

        VersionOption selected = null;
        String normalized = requested.toLowerCase(Locale.ROOT);
        if (LATEST_ALIASES.contains(normalized)) {
            selected = metadata.latest();
        }

        if (selected == null) {
            selected = metadata.versions().stream()
                    .filter(option -> option.apiVersion().equalsIgnoreCase(requested))
                    .findFirst()
                    .orElse(null);
        }

        String gameVersionRequest = normalized.startsWith("v") ? normalized.substring(1) : normalized;
        if (selected == null) {
            selected = metadata.versions().stream()
                    .filter(option -> option.minecraftVersion().equalsIgnoreCase(gameVersionRequest))
                    .findFirst()
                    .orElse(null);
        }

        boolean wildcard = gameVersionRequest.endsWith(".x") || gameVersionRequest.endsWith(".*");
        if (selected == null && wildcard) {
            String prefix = gameVersionRequest.substring(0, gameVersionRequest.length() - 2) + ".";
            selected = metadata.versions().stream()
                    .filter(option -> option.minecraftVersion().startsWith(prefix))
                    .findFirst()
                    .orElse(null);
        }

        if (selected == null) {
            String suggestions = metadata.versions().stream()
                    .limit(8)
                    .map(VersionOption::minecraftVersion)
                    .distinct()
                    .reduce((left, right) -> left + ", " + right)
                    .orElse(metadata.latest().minecraftVersion());
            throw new VersionResolutionException(
                    "Minecraft-Version '" + requested + "' ist für " + metadata.platform().label()
                            + " nicht im offiziellen API-Repository verfügbar. Aktuell verfügbar: " + suggestions + "."
            );
        }

        int recommendedJava = selected.javaRelease();
        int javaRelease = requestedJavaRelease == AUTO_JAVA_RELEASE
                ? recommendedJava
                : requestedJavaRelease;
        if (!SUPPORTED_JAVA_RELEASES.contains(javaRelease)) {
            throw new VersionResolutionException(
                    "Java " + javaRelease + " wird nicht unterstützt. Nutze Automatisch oder Java "
                            + SUPPORTED_JAVA_RELEASES + "."
            );
        }
        if (javaRelease != recommendedJava) {
            throw new VersionResolutionException(
                    selected.minecraftVersion() + " benötigt für zuverlässige Builds Java "
                            + recommendedJava + ". Stelle Java auf Automatisch."
            );
        }

        return new ResolvedTarget(
                metadata.platform(),
                requested,
                selected.minecraftVersion(),
                selected.apiVersion(),
                javaRelease
        );
    }

    static PlatformMetadata parseMetadata(
            PlatformDefinition platform,
            String xml
    ) throws CatalogException {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);

            Document document = factory.newDocumentBuilder().parse(new InputSource(new StringReader(xml)));
            NodeList versionNodes = document.getElementsByTagName("version");
            List<String> artifacts = new ArrayList<>();
            for (int index = 0; index < versionNodes.getLength(); index += 1) {
                String version = versionNodes.item(index).getTextContent().trim();
                if (!version.isBlank()) artifacts.add(version);
            }
            if (artifacts.isEmpty()) {
                throw new CatalogException("Das offizielle Repository enthält keine API-Versionen für " + platform.label() + ".");
            }

            String release = firstElementText(document, "release");
            String latest = firstElementText(document, "latest");
            String preferredArtifact = !release.isBlank()
                    ? release
                    : !latest.isBlank() ? latest : artifacts.get(artifacts.size() - 1);

            LinkedHashMap<String, VersionOption> byMinecraftVersion = new LinkedHashMap<>();
            for (String artifact : artifacts) {
                String minecraftVersion = minecraftVersionFromArtifact(artifact);
                VersionOption candidate = new VersionOption(
                        minecraftVersion,
                        artifact,
                        recommendedJavaRelease(minecraftVersion)
                );
                VersionOption current = byMinecraftVersion.get(minecraftVersion);
                if (current == null || preferArtifact(candidate.apiVersion(), current.apiVersion())) {
                    byMinecraftVersion.put(minecraftVersion, candidate);
                }
            }

            List<VersionOption> versions = new ArrayList<>(byMinecraftVersion.values());
            Collections.reverse(versions);
            VersionOption preferred = optionForArtifact(versions, preferredArtifact)
                    .orElseGet(() -> versions.getFirst());
            versions.removeIf(option -> option.minecraftVersion().equals(preferred.minecraftVersion()));
            versions.addFirst(preferred);

            return new PlatformMetadata(platform, preferred, List.copyOf(versions), Instant.now());
        } catch (CatalogException error) {
            throw error;
        } catch (Exception error) {
            throw new CatalogException(
                    "Die offiziellen Versionsdaten für " + platform.label() + " konnten nicht gelesen werden.",
                    error
            );
        }
    }

    static int recommendedJavaRelease(String minecraftVersion) {
        String[] parts = minecraftVersion.split("\\.");
        int major = integerPart(parts, 0);
        int minor = integerPart(parts, 1);
        int patch = integerPart(parts, 2);

        if (major >= 26) return 25;
        if (major != 1) return 25;
        if (minor <= 11) return 8;
        if (minor <= 15) return 11;
        if (minor == 16) return patch >= 5 ? 16 : 11;
        if (minor <= 19) return 17;
        return 21;
    }

    private PlatformMetadata metadata(PlatformDefinition platform) throws CatalogException {
        CachedMetadata cached = cache.get(platform.key());
        if (cached != null && cached.expiresAt().isAfter(Instant.now())) {
            return cached.metadata();
        }

        HttpRequest request = HttpRequest.newBuilder(platform.metadataUri())
                .timeout(Duration.ofSeconds(20))
                .header("Accept", "application/xml,text/xml;q=0.9")
                .header("User-Agent", "ModmailBot-Plugin-Builder/2.0")
                .GET()
                .build();
        try {
            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString()
            );
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new CatalogException(
                        platform.label() + " antwortete beim Laden der Versionsdaten mit HTTP "
                                + response.statusCode() + "."
                );
            }
            PlatformMetadata metadata = parseMetadata(platform, response.body());
            cache.put(platform.key(), new CachedMetadata(metadata, Instant.now().plus(cacheTtl)));
            return metadata;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new CatalogException("Das Laden der offiziellen Versionsdaten wurde unterbrochen.", error);
        } catch (CatalogException error) {
            throw error;
        } catch (Exception error) {
            throw new CatalogException(
                    "Das offizielle Versions-Repository von " + platform.label() + " ist gerade nicht erreichbar.",
                    error
            );
        }
    }

    private static Optional<VersionOption> optionForArtifact(
            List<VersionOption> versions,
            String artifact
    ) {
        String minecraftVersion = minecraftVersionFromArtifact(artifact);
        return versions.stream()
                .filter(option -> option.minecraftVersion().equals(minecraftVersion))
                .map(option -> new VersionOption(
                        minecraftVersion,
                        artifact,
                        recommendedJavaRelease(minecraftVersion)
                ))
                .findFirst();
    }

    private static boolean preferArtifact(String candidate, String current) {
        int candidateQuality = artifactQuality(candidate);
        int currentQuality = artifactQuality(current);
        return candidateQuality >= currentQuality;
    }

    private static int artifactQuality(String version) {
        String lower = version.toLowerCase(Locale.ROOT);
        if (lower.contains("-stable")) return 50;
        if (lower.contains("-release")) return 45;
        if (lower.contains("snapshot")) return 40;
        if (lower.contains("-beta")) return 30;
        if (lower.contains("-alpha")) return 20;
        if (lower.contains("experimental")) return 10;
        return 35;
    }

    private static String minecraftVersionFromArtifact(String artifactVersion) {
        String version = artifactVersion.trim();
        int legacySuffix = version.indexOf("-R");
        if (legacySuffix > 0) return version.substring(0, legacySuffix);
        int buildSuffix = version.indexOf(".build.");
        if (buildSuffix > 0) return version.substring(0, buildSuffix);
        int qualifier = version.indexOf('-');
        return qualifier > 0 ? version.substring(0, qualifier) : version;
    }

    private static int integerPart(String[] parts, int index) {
        if (index >= parts.length) return 0;
        String digits = parts[index].replaceFirst("[^0-9].*$", "");
        if (digits.isBlank()) return 0;
        try {
            return Integer.parseInt(digits);
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private static String firstElementText(Document document, String name) {
        NodeList nodes = document.getElementsByTagName(name);
        return nodes.getLength() == 0 ? "" : nodes.item(0).getTextContent().trim();
    }

    private static Map<String, PlatformDefinition> platformDefinitions() {
        LinkedHashMap<String, PlatformDefinition> platforms = new LinkedHashMap<>();
        platforms.put("paper", new PlatformDefinition(
                "paper",
                "Paper",
                "papermc",
                "https://repo.papermc.io/repository/maven-public/",
                "io.papermc.paper",
                "paper-api",
                "https://docs.papermc.io/paper/dev/project-setup/"
        ));
        platforms.put("folia", new PlatformDefinition(
                "folia",
                "Folia",
                "papermc",
                "https://repo.papermc.io/repository/maven-public/",
                "dev.folia",
                "folia-api",
                "https://github.com/PaperMC/Folia"
        ));
        platforms.put("purpur", new PlatformDefinition(
                "purpur",
                "Purpur",
                "purpur",
                "https://repo.purpurmc.org/snapshots/",
                "org.purpurmc.purpur",
                "purpur-api",
                "https://purpurmc.org/docs/purpur/"
        ));
        platforms.put("spigot", new PlatformDefinition(
                "spigot",
                "Spigot",
                "spigotmc",
                "https://hub.spigotmc.org/nexus/content/groups/public/",
                "org.spigotmc",
                "spigot-api",
                "https://www.spigotmc.org/wiki/spigot-maven/"
        ));
        return Collections.unmodifiableMap(platforms);
    }

    record PlatformDefinition(
            String key,
            String label,
            String repositoryId,
            String repositoryUrl,
            String groupId,
            String artifactId,
            String documentationUrl
    ) {
        URI metadataUri() {
            String base = repositoryUrl.endsWith("/") ? repositoryUrl : repositoryUrl + "/";
            return URI.create(
                    base + groupId.replace('.', '/') + "/" + artifactId + "/maven-metadata.xml"
            );
        }
    }

    record VersionOption(
            String minecraftVersion,
            String apiVersion,
            int javaRelease
    ) {
    }

    record PlatformMetadata(
            PlatformDefinition platform,
            VersionOption latest,
            List<VersionOption> versions,
            Instant fetchedAt
    ) {
    }

    record PlatformCapability(
            String id,
            String label,
            String documentationUrl,
            String metadataUrl,
            String latestMinecraftVersion,
            String latestApiVersion,
            List<VersionOption> versions
    ) {
    }

    record ResolvedTarget(
            PlatformDefinition platform,
            String requestedVersion,
            String minecraftVersion,
            String apiVersion,
            int javaRelease
    ) {
    }

    private record CachedMetadata(
            PlatformMetadata metadata,
            Instant expiresAt
    ) {
    }

    static final class CatalogException extends Exception {
        CatalogException(String message) {
            super(message);
        }

        CatalogException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    static final class VersionResolutionException extends Exception {
        VersionResolutionException(String message) {
            super(message);
        }
    }
}
