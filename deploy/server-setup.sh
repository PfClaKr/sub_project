#!/usr/bin/env bash
# One-time preparation of a fresh Ubuntu host (Lightsail or EC2):
#   sudo ./deploy/server-setup.sh
# Installs Docker, adds swap (a 2GB host needs it while images build) and
# the kernel setting Elasticsearch expects.
set -euo pipefail

if ! command -v docker >/dev/null; then
	curl -fsSL https://get.docker.com | sh
fi
if [ -n "${SUDO_USER:-}" ]; then
	usermod -aG docker "$SUDO_USER"
fi

if ! swapon --show | grep -q /swapfile; then
	fallocate -l 2G /swapfile
	chmod 600 /swapfile
	mkswap /swapfile
	swapon /swapfile
	echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

cat > /etc/sysctl.d/99-itnyang.conf <<'CONF'
vm.max_map_count=262144
vm.swappiness=10
CONF
sysctl --system >/dev/null

echo "Done. Log out and back in so the docker group applies."
