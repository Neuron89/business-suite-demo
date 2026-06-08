# Hosting the demo on the home server (192.168.1.193)

Self-hosted, public, attached to **haydennester.com**. Everything runs in Docker
behind a Caddy reverse proxy; a single Cloudflare tunnel publishes it. No app
ports are exposed on the host — only Caddy — so it can run beside other services.

## Architecture
```
visitor ──https──▶ Cloudflare ──tunnel──▶ cloudflared ──▶ caddy:80 ──┬─▶ portal      (demo.haydennester.com)
                  (*.demo + apex)                                     ├─▶ moc         (moc.demo…)
                                                                      ├─▶ it-request  (it.demo…)
                                                                      ├─▶ … 10 apps total
                                                                      └─▶ postgres / sqlite (internal)
```

## One-time Cloudflare setup (dashboard)
1. **DNS** (haydennester.com zone, must be on Cloudflare):
   - `demo`  →  CNAME to the tunnel (created in step 2)
   - `*.demo` → CNAME to the same tunnel (wildcard, for the per-app subdomains)
2. **Zero Trust → Networks → Tunnels → Create tunnel** (type: *Cloudflared*). Copy the
   token into `.env` as `CLOUDFLARE_TUNNEL_TOKEN`. Add two public hostnames (or one
   wildcard) both pointing at the **same service** `http://caddy:80`:
   - `demo.haydennester.com`   → `http://caddy:80`
   - `*.demo.haydennester.com` → `http://caddy:80`
   (Host-based routing inside Caddy sends each subdomain to the right app.)

## Deploy
```bash
# on 192.168.1.193 (Docker + compose v2 installed)
sudo git clone https://github.com/Neuron89/business-suite-demo.git /opt/business-suite-demo
cd /opt/business-suite-demo
bash install.sh            # writes .env, then stops
nano .env                  # set DEMO_DOMAIN=demo.haydennester.com + CLOUDFLARE_TUNNEL_TOKEN
bash install.sh            # builds + starts everything incl. the tunnel
```
Visit `https://demo.haydennester.com`, pick a role, click tiles.

## Nightly auto-reset (keeps fake data clean)
```bash
sudo cp deploy/acme-demo-reset.service deploy/acme-demo-reset.timer /etc/systemd/system/
# WorkingDirectory in the .service is /opt/business-suite-demo — adjust if you cloned elsewhere
sudo systemctl daemon-reload
sudo systemctl enable --now acme-demo-reset.timer
systemctl list-timers acme-demo-reset.timer
```

## Local smoke test (no DNS/tunnel)
```bash
docker compose up -d --build       # tunnel profile omitted -> local only
curl -H 'Host: demo.haydennester.com' http://localhost:8080/        # portal
curl -H 'Host: moc.demo.haydennester.com' http://localhost:8080/api/health
```

## Link it from haydennester.com
Add a "Live Demo" button on the site → `https://demo.haydennester.com`
(in the `personal_website` repo). Recruiters land on the portal, pick a role, explore.
