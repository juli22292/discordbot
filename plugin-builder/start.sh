#!/bin/bash

set -euo pipefail

cd "$(dirname "$0")"

MAVEN_VERSION="${MAVEN_VERSION:-3.9.16}"
MAVEN_ROOT="$PWD/.tools/apache-maven"
MAVEN_ARCHIVE="$PWD/.tools/apache-maven-${MAVEN_VERSION}-bin.tar.gz"
MAVEN_URL="https://dlcdn.apache.org/maven/maven-3/${MAVEN_VERSION}/binaries/apache-maven-${MAVEN_VERSION}-bin.tar.gz"
MAVEN_SHA_URL="${MAVEN_URL}.sha512"
MAVEN_ARCHIVE_URL="https://archive.apache.org/dist/maven/maven-3/${MAVEN_VERSION}/binaries/apache-maven-${MAVEN_VERSION}-bin.tar.gz"

mkdir -p "$PWD/.tools" "$PWD/data"

if [ ! -x "$MAVEN_ROOT/bin/mvn" ]; then
  echo "[BUILDER] Lade Apache Maven ${MAVEN_VERSION}..."
  rm -rf "$MAVEN_ROOT" "$PWD/.tools/apache-maven-${MAVEN_VERSION}"
  if ! curl -fsSL "$MAVEN_URL" -o "$MAVEN_ARCHIVE"; then
    curl -fsSL "$MAVEN_ARCHIVE_URL" -o "$MAVEN_ARCHIVE"
  fi
  if ! curl -fsSL "$MAVEN_SHA_URL" -o "${MAVEN_ARCHIVE}.sha512"; then
    curl -fsSL "${MAVEN_ARCHIVE_URL}.sha512" -o "${MAVEN_ARCHIVE}.sha512"
  fi
  (
    cd "$PWD/.tools"
    EXPECTED_SHA="$(awk '{print $1}' "$(basename "${MAVEN_ARCHIVE}.sha512")")"
    printf '%s  %s\n' "$EXPECTED_SHA" "$(basename "$MAVEN_ARCHIVE")" | sha512sum -c -
  )
  tar -xzf "$MAVEN_ARCHIVE" -C "$PWD/.tools"
  mv "$PWD/.tools/apache-maven-${MAVEN_VERSION}" "$MAVEN_ROOT"
  rm -f "$MAVEN_ARCHIVE" "${MAVEN_ARCHIVE}.sha512"
fi

export PLUGIN_BUILDER_MAVEN_BIN="${PLUGIN_BUILDER_MAVEN_BIN:-$MAVEN_ROOT/bin/mvn}"
export PLUGIN_BUILDER_PORT="${PLUGIN_BUILDER_PORT:-${SERVER_PORT:-8080}}"
export PLUGIN_BUILDER_BIND_ADDRESS="${PLUGIN_BUILDER_BIND_ADDRESS:-0.0.0.0}"

if ! [[ "$PLUGIN_BUILDER_PORT" =~ ^[0-9]+$ ]] || [ "$PLUGIN_BUILDER_PORT" -lt 1 ] || [ "$PLUGIN_BUILDER_PORT" -gt 65535 ]; then
  echo "[BUILDER] Ungültiger Port: ${PLUGIN_BUILDER_PORT}. Prüfe die primäre Pterodactyl-Allocation."
  exit 1
fi

JAVA_MAJOR="$(java -version 2>&1 | awk -F '[".]' '/version/ {print $2; exit}')"
if [ -z "$JAVA_MAJOR" ] || [ "$JAVA_MAJOR" -lt 25 ]; then
  echo "[BUILDER] Java 25 oder neuer wird benötigt. Erkannt: ${JAVA_MAJOR:-unbekannt}."
  echo "[BUILDER] Wähle im Pterodactyl-Egg das Docker-Image ghcr.io/pterodactyl/yolks:java_25."
  exit 1
fi

echo "[BUILDER] Baue den Builder-Dienst..."
"$PLUGIN_BUILDER_MAVEN_BIN" -B -ntp -DskipTests package

echo "[BUILDER] Verwende Pterodactyl-Port ${PLUGIN_BUILDER_PORT}."
echo "[BUILDER] Starte auf ${PLUGIN_BUILDER_BIND_ADDRESS}:${PLUGIN_BUILDER_PORT}..."
exec java \
  -Xms128M \
  -XX:MaxRAMPercentage=70.0 \
  -Dfile.encoding=UTF-8 \
  -jar target/minecraft-plugin-builder.jar
