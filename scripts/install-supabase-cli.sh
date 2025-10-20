#!/usr/bin/env bash
set -euo pipefail

DEFAULT_VERSION="1.187.3"
VERSION="${SUPABASE_VERSION:-$DEFAULT_VERSION}"
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux)
    OS_TAG="linux"
    ;;
  Darwin)
    OS_TAG="darwin"
    ;;
  *)
    echo "Unsupported operating system: $OS" >&2
    exit 1
    ;;
esac

case "$ARCH" in
  x86_64|amd64)
    ARCH_TAG="amd64"
    ;;
  arm64|aarch64)
    ARCH_TAG="arm64"
    ;;
  *)
    echo "Unsupported architecture: $ARCH" >&2
    exit 1
    ;;
esac

TARBALL="supabase_${VERSION}_${OS_TAG}_${ARCH_TAG}.tar.gz"
DOWNLOAD_URL="https://github.com/supabase/cli/releases/download/v${VERSION}/${TARBALL}"

INSTALL_DIR="${SUPABASE_INSTALL_DIR:-$PWD/bin}"
mkdir -p "$INSTALL_DIR"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

ARCHIVE_PATH="$TMP_DIR/$TARBALL"

if [[ -n "${SUPABASE_CLI_TARBALL:-}" ]]; then
  if [[ ! -f "$SUPABASE_CLI_TARBALL" ]]; then
    echo "Provided SUPABASE_CLI_TARBALL '$SUPABASE_CLI_TARBALL' does not exist" >&2
    exit 1
  fi
  cp "$SUPABASE_CLI_TARBALL" "$ARCHIVE_PATH"
else
  if command -v curl >/dev/null 2>&1; then
    DOWNLOADER=(curl -fL "$DOWNLOAD_URL" -o "$ARCHIVE_PATH")
  elif command -v wget >/dev/null 2>&1; then
    DOWNLOADER=(wget -O "$ARCHIVE_PATH" "$DOWNLOAD_URL")
  else
    echo "Neither curl nor wget is available to download $DOWNLOAD_URL" >&2
    exit 1
  fi

  if ! "${DOWNLOADER[@]}"; then
    cat >&2 <<EOF
Failed to download Supabase CLI from $DOWNLOAD_URL.

If your environment blocks outbound network access, download the tarball from another
machine and set SUPABASE_CLI_TARBALL=/path/to/${TARBALL} before re-running this script.
EOF
    exit 1
  fi
fi

tar -xzf "$ARCHIVE_PATH" -C "$TMP_DIR" supabase
install -m 755 "$TMP_DIR/supabase" "$INSTALL_DIR/supabase"

echo "Supabase CLI installed to $INSTALL_DIR/supabase"
echo "Add $INSTALL_DIR to your PATH to use it."
