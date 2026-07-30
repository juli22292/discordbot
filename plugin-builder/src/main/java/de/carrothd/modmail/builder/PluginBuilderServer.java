package de.carrothd.modmail.builder;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import java.util.stream.Stream;

public final class PluginBuilderServer {
    private static final ObjectMapper JSON = new ObjectMapper()
            .findAndRegisterModules()
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .disable(SerializationFeature.FAIL_ON_EMPTY_BEANS);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Pattern JOB_ID_PATTERN = Pattern.compile("^[a-f0-9]{32}$");
    private static final Pattern PROJECT_NAME_PATTERN = Pattern.compile("^[\\p{L}\\p{N}][\\p{L}\\p{N} ._-]{0,63}$");
    private static final Pattern API_VERSION_PATTERN = Pattern.compile("^[0-9][0-9A-Za-z.+_-]{0,47}$");
    private static final Pattern SAFE_PATH_PATTERN = Pattern.compile("^[A-Za-z0-9_./-]{1,240}$");
    private static final Set<String> RESOURCE_EXTENSIONS = Set.of(
            ".yml", ".yaml", ".json", ".properties", ".conf", ".txt", ".toml", ".mcmeta", ".lang"
    );
    private static final Set<String> SECRET_ENVIRONMENT_NAMES = Set.of(
            "PLUGIN_BUILDER_API_SECRET",
            "DISCORD_TOKEN",
            "DISCORD_BOT_TOKEN",
            "DISCORD_CLIENT_SECRET",
            "GROQ_API_KEY",
            "INTERNAL_BOT_API_SECRET",
            "SESSION_SECRET",
            "ENCRYPTION_KEY"
    );

    private final BuilderConfig config;
    private final HttpServer server;
    private final ExecutorService httpExecutor;
    private final ExecutorService buildExecutor;
    private final ScheduledExecutorService maintenanceExecutor;
    private final Map<String, BuildJob> jobs = new ConcurrentHashMap<>();

    private PluginBuilderServer(BuilderConfig config) throws IOException {
        this.config = config;
        this.server = HttpServer.create(new InetSocketAddress(config.bindAddress(), config.port()), 0);
        this.httpExecutor = Executors.newVirtualThreadPerTaskExecutor();
        this.buildExecutor = Executors.newFixedThreadPool(config.maxConcurrentBuilds());
        this.maintenanceExecutor = Executors.newSingleThreadScheduledExecutor();
        server.setExecutor(httpExecutor);
        server.createContext("/health", this::handleHealth);
        server.createContext("/v1/builds", this::handleBuilds);
    }

    public static void main(String[] args) throws Exception {
        BuilderConfig config = BuilderConfig.fromEnvironment();
        Files.createDirectories(config.jobsDirectory());
        Files.createDirectories(config.artifactsDirectory());
        Files.createDirectories(config.mavenRepository());

        PluginBuilderServer application = new PluginBuilderServer(config);
        application.start();
    }

    private void start() {
        cleanupExpiredArtifacts();
        maintenanceExecutor.scheduleAtFixedRate(
                this::cleanupExpiredArtifacts,
                15,
                15,
                TimeUnit.MINUTES
        );
        Runtime.getRuntime().addShutdownHook(new Thread(this::stop, "plugin-builder-shutdown"));
        server.start();
        System.out.printf(
                "[BUILDER] Bereit auf %s:%d, parallele Builds: %d, Artefakt-TTL: %dh%n",
                config.bindAddress(),
                config.port(),
                config.maxConcurrentBuilds(),
                config.artifactTtl().toHours()
        );
    }

    private void stop() {
        server.stop(2);
        maintenanceExecutor.shutdownNow();
        buildExecutor.shutdownNow();
        httpExecutor.shutdownNow();
    }

    private void handleHealth(HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            sendError(exchange, 405, "method_not_allowed", "Diese Methode wird nicht unterstützt.");
            return;
        }
        sendJson(exchange, 200, Map.of(
                "status", "ready",
                "service", "modmailbot-plugin-builder",
                "version", "1.0.0",
                "queuedJobs", jobs.values().stream().filter(job -> job.status == BuildStatus.QUEUED).count(),
                "runningJobs", jobs.values().stream().filter(job -> job.status == BuildStatus.RUNNING).count()
        ));
    }

    private void handleBuilds(HttpExchange exchange) throws IOException {
        if (!isAuthorized(exchange)) {
            sendError(exchange, 401, "unauthorized", "Die Builder-Signatur ist ungültig.");
            return;
        }

        String path = exchange.getRequestURI().getPath();
        if ("/v1/builds".equals(path)) {
            if (!"POST".equals(exchange.getRequestMethod())) {
                sendError(exchange, 405, "method_not_allowed", "Diese Methode wird nicht unterstützt.");
                return;
            }
            createBuild(exchange);
            return;
        }

        String suffix = path.substring("/v1/builds/".length());
        String[] segments = suffix.split("/");
        if (segments.length < 1 || !JOB_ID_PATTERN.matcher(segments[0]).matches()) {
            sendError(exchange, 404, "build_not_found", "Dieser Build wurde nicht gefunden.");
            return;
        }

        BuildJob job = jobs.get(segments[0]);
        if (job == null) {
            job = loadPersistedJob(segments[0]).orElse(null);
        }
        if (job == null) {
            sendError(exchange, 404, "build_not_found", "Dieser Build wurde nicht gefunden oder ist abgelaufen.");
            return;
        }

        if (segments.length == 1 && "GET".equals(exchange.getRequestMethod())) {
            sendJson(exchange, 200, job.toResponse());
            return;
        }
        if (segments.length == 2 && "artifact".equals(segments[1]) && "GET".equals(exchange.getRequestMethod())) {
            downloadArtifact(exchange, job);
            return;
        }

        sendError(exchange, 404, "not_found", "Dieser Builder-Endpunkt existiert nicht.");
    }

    private void createBuild(HttpExchange exchange) throws IOException {
        long activeBuilds = jobs.values().stream()
                .filter(job -> job.status == BuildStatus.QUEUED || job.status == BuildStatus.RUNNING)
                .count();
        if (activeBuilds >= config.maxPendingBuilds()) {
            sendError(
                    exchange,
                    429,
                    "builder_busy",
                    "Die Build-Warteschlange ist voll. Bitte versuche es gleich noch einmal."
            );
            return;
        }

        byte[] body;
        try {
            body = readLimited(exchange.getRequestBody(), config.maxRequestBytes());
        } catch (RequestTooLargeException error) {
            sendError(exchange, 413, "request_too_large", "Das Plugin-Projekt ist größer als erlaubt.");
            return;
        }

        BuildRequest request;
        try {
            request = JSON.readValue(body, BuildRequest.class);
        } catch (JsonProcessingException error) {
            sendError(exchange, 400, "invalid_json", "Die Build-Anfrage enthält kein gültiges JSON.");
            return;
        }

        List<String> validationErrors = validateRequest(request);
        if (!validationErrors.isEmpty()) {
            sendJson(exchange, 400, Map.of(
                    "error", Map.of(
                            "code", "invalid_build",
                            "message", "Das Plugin-Projekt konnte nicht angenommen werden.",
                            "details", validationErrors
                    )
            ));
            return;
        }

        String jobId = randomJobId();
        BuildJob job = BuildJob.queued(jobId, request);
        jobs.put(jobId, job);
        persistJob(job);
        buildExecutor.submit(() -> executeBuild(job, request));
        sendJson(exchange, 202, job.toResponse());
    }

    private List<String> validateRequest(BuildRequest request) {
        List<String> errors = new ArrayList<>();
        if (request == null) {
            return List.of("Die Anfrage fehlt.");
        }

        String projectName = request.projectName == null ? "" : request.projectName.trim();
        if (!PROJECT_NAME_PATTERN.matcher(projectName).matches()) {
            errors.add("Der Projektname ist ungültig oder länger als 64 Zeichen.");
        }

        String platform = request.platform == null ? "" : request.platform.toLowerCase(Locale.ROOT);
        if (!Platform.SUPPORTED.containsKey(platform)) {
            errors.add("Unterstützte Plattformen sind Paper, Purpur und Spigot.");
        }
        if (request.apiVersion == null || !API_VERSION_PATTERN.matcher(request.apiVersion.trim()).matches()) {
            errors.add("Die Minecraft/API-Version ist ungültig.");
        }
        if (request.javaRelease != 17 && request.javaRelease != 21) {
            errors.add("Als Java-Version sind nur 17 und 21 erlaubt.");
        }
        if (request.files == null || request.files.isEmpty()) {
            errors.add("Das Projekt enthält keine Dateien.");
            return errors;
        }
        if (request.files.size() > config.maxFiles()) {
            errors.add("Das Projekt enthält mehr als " + config.maxFiles() + " Dateien.");
        }

        long totalBytes = 0;
        boolean javaSourceFound = false;
        boolean descriptorFound = false;
        Set<String> seenPaths = ConcurrentHashMap.newKeySet();
        for (BuildFile file : request.files) {
            if (file == null || file.path == null || file.content == null) {
                errors.add("Mindestens eine Datei ist unvollständig.");
                continue;
            }
            String normalizedPath = file.path.replace('\\', '/');
            if (!isSafeProjectPath(normalizedPath)) {
                errors.add("Nicht erlaubter Dateipfad: " + normalizedPath);
                continue;
            }
            if (!seenPaths.add(normalizedPath.toLowerCase(Locale.ROOT))) {
                errors.add("Doppelter Dateipfad: " + normalizedPath);
            }
            if (normalizedPath.startsWith("src/main/java/")) {
                javaSourceFound = true;
            }
            if (normalizedPath.equals("src/main/resources/plugin.yml")
                    || normalizedPath.equals("src/main/resources/paper-plugin.yml")) {
                descriptorFound = true;
            }
            int fileBytes = file.content.getBytes(StandardCharsets.UTF_8).length;
            if (fileBytes > config.maxFileBytes()) {
                errors.add("Datei ist zu groß: " + normalizedPath);
            }
            totalBytes += fileBytes;
        }
        if (totalBytes > config.maxSourceBytes()) {
            errors.add("Alle Quelldateien zusammen sind größer als erlaubt.");
        }
        if (!javaSourceFound) {
            errors.add("Mindestens eine Java-Datei unter src/main/java wird benötigt.");
        }
        if (!descriptorFound) {
            errors.add("plugin.yml oder paper-plugin.yml unter src/main/resources fehlt.");
        }
        return errors;
    }

    private boolean isSafeProjectPath(String path) {
        if (!SAFE_PATH_PATTERN.matcher(path).matches()
                || path.startsWith("/")
                || path.contains("..")
                || path.contains("//")) {
            return false;
        }
        if (path.startsWith("src/main/java/")) {
            return path.endsWith(".java");
        }
        if (!path.startsWith("src/main/resources/")) {
            return false;
        }
        String lowerPath = path.toLowerCase(Locale.ROOT);
        return RESOURCE_EXTENSIONS.stream().anyMatch(lowerPath::endsWith);
    }

    private void executeBuild(BuildJob job, BuildRequest request) {
        job.status = BuildStatus.RUNNING;
        job.startedAt = Instant.now();
        persistJob(job);

        Path jobDirectory = config.jobsDirectory().resolve(job.id).normalize();
        Path projectDirectory = jobDirectory.resolve("project");
        try {
            ensureWithin(config.jobsDirectory(), jobDirectory);
            Files.createDirectories(projectDirectory);
            for (BuildFile file : request.files) {
                String normalizedPath = file.path.replace('\\', '/');
                Path target = projectDirectory.resolve(normalizedPath).normalize();
                ensureWithin(projectDirectory, target);
                Files.createDirectories(target.getParent());
                Files.writeString(
                        target,
                        file.content,
                        StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE_NEW
                );
            }

            String artifactId = sanitizeArtifactId(request.projectName);
            Files.writeString(
                    projectDirectory.resolve("pom.xml"),
                    generatedPom(request, artifactId),
                    StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE_NEW
            );

            ProcessBuilder processBuilder = new ProcessBuilder(
                    config.mavenExecutable().toString(),
                    "-B",
                    "-ntp",
                    "-DskipTests",
                    "-Dmaven.repo.local=" + config.mavenRepository().toAbsolutePath(),
                    "clean",
                    "package"
            );
            processBuilder.directory(projectDirectory.toFile());
            processBuilder.redirectErrorStream(true);
            sanitizeBuildEnvironment(processBuilder.environment());

            Process process = processBuilder.start();
            ByteArrayOutputStream logOutput = new ByteArrayOutputStream();
            Thread outputReader = Thread.ofVirtual().start(() -> copyLimitedLog(process.getInputStream(), logOutput));
            boolean finished = process.waitFor(config.buildTimeout().toSeconds(), TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                process.waitFor(10, TimeUnit.SECONDS);
                outputReader.join(Duration.ofSeconds(5));
                throw new BuildFailure("Der Build wurde nach " + config.buildTimeout().toSeconds() + " Sekunden beendet.");
            }
            outputReader.join(Duration.ofSeconds(5));
            job.logTail = tail(logOutput.toString(StandardCharsets.UTF_8), config.maxLogCharacters());
            if (process.exitValue() != 0) {
                throw new BuildFailure("Maven konnte das Plugin nicht kompilieren.");
            }

            Path builtJar = findBuiltJar(projectDirectory.resolve("target"))
                    .orElseThrow(() -> new BuildFailure("Maven hat keine Plugin-JAR erzeugt."));
            String artifactName = sanitizeDownloadName(request.projectName) + "-" + request.apiVersion + ".jar";
            Path artifactPath = config.artifactsDirectory().resolve(job.id + "-" + artifactName).normalize();
            ensureWithin(config.artifactsDirectory(), artifactPath);
            Files.copy(builtJar, artifactPath, StandardCopyOption.REPLACE_EXISTING);

            job.artifactName = artifactName;
            job.artifactPath = artifactPath.toString();
            job.status = BuildStatus.SUCCEEDED;
        } catch (BuildFailure error) {
            job.status = BuildStatus.FAILED;
            job.error = error.getMessage();
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            job.status = BuildStatus.FAILED;
            job.error = "Der Build wurde unterbrochen.";
        } catch (Exception error) {
            job.status = BuildStatus.FAILED;
            job.error = "Interner Builder-Fehler: " + error.getClass().getSimpleName();
            System.err.printf("[BUILDER] Job %s fehlgeschlagen: %s%n", job.id, error);
        } finally {
            job.finishedAt = Instant.now();
            persistJob(job);
            deleteRecursively(jobDirectory);
        }
    }

    private String generatedPom(BuildRequest request, String artifactId) {
        Platform platform = Platform.SUPPORTED.get(request.platform.toLowerCase(Locale.ROOT));
        String apiVersion = normalizeApiVersion(request.apiVersion.trim());
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <project xmlns="http://maven.apache.org/POM/4.0.0"
                         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
                  <modelVersion>4.0.0</modelVersion>
                  <groupId>de.modmailbot.generated</groupId>
                  <artifactId>%s</artifactId>
                  <version>1.0.0</version>
                  <properties>
                    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
                    <maven.compiler.release>%d</maven.compiler.release>
                  </properties>
                  <repositories>
                    <repository>
                      <id>%s</id>
                      <url>%s</url>
                    </repository>
                  </repositories>
                  <dependencies>
                    <dependency>
                      <groupId>%s</groupId>
                      <artifactId>%s</artifactId>
                      <version>%s</version>
                      <scope>provided</scope>
                    </dependency>
                  </dependencies>
                  <build>
                    <finalName>%s</finalName>
                    <plugins>
                      <plugin>
                        <groupId>org.apache.maven.plugins</groupId>
                        <artifactId>maven-compiler-plugin</artifactId>
                        <version>3.15.0</version>
                        <configuration>
                          <release>%d</release>
                          <parameters>true</parameters>
                          <proc>none</proc>
                        </configuration>
                      </plugin>
                      <plugin>
                        <groupId>org.apache.maven.plugins</groupId>
                        <artifactId>maven-resources-plugin</artifactId>
                        <version>3.3.1</version>
                      </plugin>
                      <plugin>
                        <groupId>org.apache.maven.plugins</groupId>
                        <artifactId>maven-jar-plugin</artifactId>
                        <version>3.4.2</version>
                      </plugin>
                    </plugins>
                  </build>
                </project>
                """.formatted(
                xml(artifactId),
                request.javaRelease,
                xml(platform.id),
                xml(platform.repository),
                xml(platform.groupId),
                xml(platform.artifactId),
                xml(apiVersion),
                xml(artifactId),
                request.javaRelease
        );
    }

    private String normalizeApiVersion(String version) {
        if (version.contains("-R") || version.contains(".build.")) {
            return version;
        }
        return version + "-R0.1-SNAPSHOT";
    }

    private void downloadArtifact(HttpExchange exchange, BuildJob job) throws IOException {
        if (job.status != BuildStatus.SUCCEEDED || job.artifactPath == null || job.artifactName == null) {
            sendError(exchange, 409, "artifact_not_ready", "Für diesen Build ist noch keine JAR verfügbar.");
            return;
        }
        Path artifact = Path.of(job.artifactPath).normalize();
        ensureWithin(config.artifactsDirectory(), artifact);
        if (!Files.isRegularFile(artifact)) {
            sendError(exchange, 404, "artifact_expired", "Die JAR ist abgelaufen oder wurde entfernt.");
            return;
        }

        Headers headers = exchange.getResponseHeaders();
        setCommonHeaders(headers);
        headers.set("Content-Type", "application/java-archive");
        headers.set("Content-Disposition", "attachment; filename=\"" + headerFilename(job.artifactName) + "\"");
        headers.set("Cache-Control", "private, no-store");
        long length = Files.size(artifact);
        exchange.sendResponseHeaders(200, length);
        try (OutputStream output = exchange.getResponseBody()) {
            Files.copy(artifact, output);
        }
    }

    private boolean isAuthorized(HttpExchange exchange) {
        String authorization = exchange.getRequestHeaders().getFirst("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return false;
        }
        byte[] provided = authorization.substring(7).trim().getBytes(StandardCharsets.UTF_8);
        byte[] expected = config.apiSecret().getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(provided, expected);
    }

    private void persistJob(BuildJob job) {
        Path statusPath = config.artifactsDirectory().resolve(job.id + ".json").normalize();
        try {
            ensureWithin(config.artifactsDirectory(), statusPath);
            Files.write(
                    statusPath,
                    JSON.writeValueAsBytes(job),
                    StandardOpenOption.CREATE,
                    StandardOpenOption.TRUNCATE_EXISTING
            );
        } catch (IOException error) {
            System.err.printf("[BUILDER] Status für Job %s konnte nicht gespeichert werden: %s%n", job.id, error);
        }
    }

    private Optional<BuildJob> loadPersistedJob(String jobId) {
        Path statusPath = config.artifactsDirectory().resolve(jobId + ".json").normalize();
        try {
            ensureWithin(config.artifactsDirectory(), statusPath);
            if (!Files.isRegularFile(statusPath)) return Optional.empty();
            BuildJob job = JSON.readValue(Files.readAllBytes(statusPath), BuildJob.class);
            jobs.put(jobId, job);
            return Optional.of(job);
        } catch (IOException error) {
            return Optional.empty();
        }
    }

    private void cleanupExpiredArtifacts() {
        Instant cutoff = Instant.now().minus(config.artifactTtl());
        try (Stream<Path> paths = Files.list(config.artifactsDirectory())) {
            paths.filter(Files::isRegularFile).forEach(path -> {
                try {
                    if (Files.getLastModifiedTime(path).toInstant().isBefore(cutoff)) {
                        Files.deleteIfExists(path);
                    }
                } catch (IOException error) {
                    System.err.printf("[BUILDER] Alte Datei konnte nicht entfernt werden: %s%n", path);
                }
            });
        } catch (IOException error) {
            System.err.printf("[BUILDER] Artefakt-Bereinigung fehlgeschlagen: %s%n", error);
        }
        jobs.entrySet().removeIf(entry -> {
            BuildJob job = entry.getValue();
            return job.finishedAt != null && job.finishedAt.isBefore(cutoff);
        });
    }

    private static Optional<Path> findBuiltJar(Path targetDirectory) throws IOException {
        if (!Files.isDirectory(targetDirectory)) return Optional.empty();
        try (Stream<Path> files = Files.list(targetDirectory)) {
            return files
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".jar"))
                    .filter(path -> !path.getFileName().toString().startsWith("original-"))
                    .filter(path -> !path.getFileName().toString().endsWith("-sources.jar"))
                    .filter(path -> !path.getFileName().toString().endsWith("-javadoc.jar"))
                    .max(Comparator.comparingLong(path -> {
                        try {
                            return Files.size(path);
                        } catch (IOException ignored) {
                            return 0;
                        }
                    }));
        }
    }

    private static void sanitizeBuildEnvironment(Map<String, String> environment) {
        Map<String, String> allowed = new HashMap<>();
        for (String name : List.of("PATH", "HOME", "JAVA_HOME", "LANG", "LC_ALL", "TMPDIR")) {
            String value = environment.get(name);
            if (value != null) allowed.put(name, value);
        }
        environment.clear();
        environment.putAll(allowed);
        SECRET_ENVIRONMENT_NAMES.forEach(environment::remove);
        environment.put("MAVEN_OPTS", "-Dfile.encoding=UTF-8 -Djansi.force=false");
    }

    private void copyLimitedLog(InputStream input, ByteArrayOutputStream output) {
        byte[] buffer = new byte[8192];
        try (input) {
            int read;
            while ((read = input.read(buffer)) >= 0) {
                int remaining = Math.max(0, config.maxLogBytes() - output.size());
                if (remaining > 0) {
                    output.write(buffer, 0, Math.min(read, remaining));
                }
            }
        } catch (IOException ignored) {
            // The build result still reports the process exit code.
        }
    }

    private static byte[] readLimited(InputStream input, int maxBytes) throws IOException, RequestTooLargeException {
        try (input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) >= 0) {
                if (output.size() + read > maxBytes) {
                    throw new RequestTooLargeException();
                }
                output.write(buffer, 0, read);
            }
            return output.toByteArray();
        }
    }

    private static void ensureWithin(Path baseDirectory, Path target) throws IOException {
        Path base = baseDirectory.toAbsolutePath().normalize();
        Path normalizedTarget = target.toAbsolutePath().normalize();
        if (!normalizedTarget.startsWith(base)) {
            throw new IOException("Pfad liegt außerhalb des Builder-Verzeichnisses.");
        }
    }

    private static void deleteRecursively(Path directory) {
        if (!Files.exists(directory)) return;
        try (Stream<Path> paths = Files.walk(directory)) {
            paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ignored) {
                    // A later cleanup can remove a locked temporary path.
                }
            });
        } catch (IOException ignored) {
            // A failed workspace cleanup does not change the build result.
        }
    }

    private static String sanitizeArtifactId(String input) {
        String normalized = input.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9._-]+", "-")
                .replaceAll("^-+|-+$", "");
        return normalized.isBlank() ? "minecraft-plugin" : normalized;
    }

    private static String sanitizeDownloadName(String input) {
        String normalized = input.replaceAll("[^A-Za-z0-9._-]+", "-").replaceAll("^-+|-+$", "");
        return normalized.isBlank() ? "minecraft-plugin" : normalized;
    }

    private static String randomJobId() {
        byte[] bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private static String xml(String value) {
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private static String headerFilename(String value) {
        return value.replaceAll("[\\r\\n\"\\\\]", "_");
    }

    private static String tail(String value, int maxCharacters) {
        if (value == null || value.length() <= maxCharacters) return value;
        return "[... ältere Build-Ausgabe gekürzt ...]\n" + value.substring(value.length() - maxCharacters);
    }

    private static void setCommonHeaders(Headers headers) {
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("Referrer-Policy", "no-referrer");
        headers.set("X-Frame-Options", "DENY");
    }

    private static void sendJson(HttpExchange exchange, int status, Object payload) throws IOException {
        byte[] bytes = JSON.writeValueAsBytes(payload);
        Headers headers = exchange.getResponseHeaders();
        setCommonHeaders(headers);
        headers.set("Content-Type", "application/json; charset=utf-8");
        headers.set("Cache-Control", "no-store");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }

    private static void sendError(HttpExchange exchange, int status, String code, String message) throws IOException {
        sendJson(exchange, status, Map.of("error", Map.of("code", code, "message", message)));
    }

    private record Platform(
            String id,
            String repository,
            String groupId,
            String artifactId
    ) {
        private static final Map<String, Platform> SUPPORTED = Map.of(
                "paper", new Platform(
                        "papermc",
                        "https://repo.papermc.io/repository/maven-public/",
                        "io.papermc.paper",
                        "paper-api"
                ),
                "purpur", new Platform(
                        "purpur",
                        "https://repo.purpurmc.org/snapshots",
                        "org.purpurmc.purpur",
                        "purpur-api"
                ),
                "spigot", new Platform(
                        "spigotmc",
                        "https://hub.spigotmc.org/nexus/content/repositories/snapshots/",
                        "org.spigotmc",
                        "spigot-api"
                )
        );
    }

    public static final class BuildRequest {
        public String projectName;
        public String platform;
        public String apiVersion;
        public int javaRelease;
        public List<BuildFile> files;

        public BuildRequest() {
        }
    }

    public static final class BuildFile {
        public String path;
        public String content;

        public BuildFile() {
        }
    }

    public enum BuildStatus {
        QUEUED,
        RUNNING,
        SUCCEEDED,
        FAILED
    }

    public static final class BuildJob {
        public String id;
        public BuildStatus status;
        public String projectName;
        public String platform;
        public String apiVersion;
        public int javaRelease;
        public Instant createdAt;
        public Instant startedAt;
        public Instant finishedAt;
        public String artifactName;
        public String artifactPath;
        public String error;
        public String logTail;

        public BuildJob() {
        }

        private static BuildJob queued(String id, BuildRequest request) {
            BuildJob job = new BuildJob();
            job.id = id;
            job.status = BuildStatus.QUEUED;
            job.projectName = request.projectName.trim();
            job.platform = request.platform.toLowerCase(Locale.ROOT);
            job.apiVersion = request.apiVersion.trim();
            job.javaRelease = request.javaRelease;
            job.createdAt = Instant.now();
            return job;
        }

        private Map<String, Object> toResponse() {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("id", id);
            response.put("status", status.name().toLowerCase(Locale.ROOT));
            response.put("projectName", projectName);
            response.put("platform", platform);
            response.put("apiVersion", apiVersion);
            response.put("javaRelease", javaRelease);
            response.put("createdAt", createdAt);
            response.put("startedAt", startedAt);
            response.put("finishedAt", finishedAt);
            response.put("artifactName", artifactName);
            response.put("error", error);
            response.put("logTail", logTail);
            return response;
        }
    }

    private record BuilderConfig(
            String bindAddress,
            int port,
            String apiSecret,
            Path mavenExecutable,
            Path jobsDirectory,
            Path artifactsDirectory,
            Path mavenRepository,
            int maxConcurrentBuilds,
            int maxPendingBuilds,
            int maxFiles,
            int maxFileBytes,
            int maxSourceBytes,
            int maxRequestBytes,
            int maxLogBytes,
            int maxLogCharacters,
            Duration buildTimeout,
            Duration artifactTtl
    ) {
        private static BuilderConfig fromEnvironment() {
            String apiSecret = requiredEnvironment("PLUGIN_BUILDER_API_SECRET");
            if (apiSecret.length() < 32) {
                throw new IllegalStateException("PLUGIN_BUILDER_API_SECRET muss mindestens 32 Zeichen lang sein.");
            }
            Path dataDirectory = Path.of(environment("PLUGIN_BUILDER_DATA_DIR", "data")).toAbsolutePath().normalize();
            String serverPort = environment("PLUGIN_BUILDER_PORT", environment("SERVER_PORT", "8080"));
            return new BuilderConfig(
                    environment("PLUGIN_BUILDER_BIND_ADDRESS", "0.0.0.0"),
                    integer(serverPort, 1, 65535, "PLUGIN_BUILDER_PORT"),
                    apiSecret,
                    Path.of(environment("PLUGIN_BUILDER_MAVEN_BIN", ".tools/apache-maven/bin/mvn")).toAbsolutePath().normalize(),
                    dataDirectory.resolve("jobs"),
                    dataDirectory.resolve("artifacts"),
                    dataDirectory.resolve("maven-repository"),
                    integer(environment("PLUGIN_BUILDER_CONCURRENCY", "2"), 1, 4, "PLUGIN_BUILDER_CONCURRENCY"),
                    integer(environment("PLUGIN_BUILDER_MAX_PENDING_BUILDS", "8"), 1, 32, "PLUGIN_BUILDER_MAX_PENDING_BUILDS"),
                    integer(environment("PLUGIN_BUILDER_MAX_FILES", "64"), 1, 128, "PLUGIN_BUILDER_MAX_FILES"),
                    integer(environment("PLUGIN_BUILDER_MAX_FILE_BYTES", "131072"), 1024, 524288, "PLUGIN_BUILDER_MAX_FILE_BYTES"),
                    integer(environment("PLUGIN_BUILDER_MAX_SOURCE_BYTES", "524288"), 8192, 2097152, "PLUGIN_BUILDER_MAX_SOURCE_BYTES"),
                    integer(environment("PLUGIN_BUILDER_MAX_REQUEST_BYTES", "786432"), 16384, 3145728, "PLUGIN_BUILDER_MAX_REQUEST_BYTES"),
                    integer(environment("PLUGIN_BUILDER_MAX_LOG_BYTES", "262144"), 8192, 1048576, "PLUGIN_BUILDER_MAX_LOG_BYTES"),
                    integer(environment("PLUGIN_BUILDER_MAX_LOG_CHARACTERS", "24000"), 2000, 100000, "PLUGIN_BUILDER_MAX_LOG_CHARACTERS"),
                    Duration.ofSeconds(integer(environment("PLUGIN_BUILDER_TIMEOUT_SECONDS", "180"), 30, 600, "PLUGIN_BUILDER_TIMEOUT_SECONDS")),
                    Duration.ofHours(integer(environment("PLUGIN_BUILDER_ARTIFACT_TTL_HOURS", "24"), 1, 168, "PLUGIN_BUILDER_ARTIFACT_TTL_HOURS"))
            );
        }

        private static String requiredEnvironment(String name) {
            String value = System.getenv(name);
            if (value == null || value.isBlank()) {
                throw new IllegalStateException(name + " fehlt.");
            }
            return value.trim();
        }

        private static String environment(String name, String fallback) {
            String value = System.getenv(name);
            return value == null || value.isBlank() ? fallback : value.trim();
        }

        private static int integer(String value, int minimum, int maximum, String name) {
            try {
                int parsed = Integer.parseInt(value);
                if (parsed < minimum || parsed > maximum) throw new NumberFormatException();
                return parsed;
            } catch (NumberFormatException error) {
                throw new IllegalStateException(name + " muss zwischen " + minimum + " und " + maximum + " liegen.");
            }
        }
    }

    private static final class BuildFailure extends Exception {
        private BuildFailure(String message) {
            super(message);
        }
    }

    private static final class RequestTooLargeException extends Exception {
    }
}
