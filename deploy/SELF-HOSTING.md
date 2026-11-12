# Self-hosting the demo on your own domain

Everything runs in Docker behind a Caddy reverse proxy, and a single Cloudflare
tunnel publishes it. No app ports are exposed on the host (only Caddy, on
`HTTP_PORT`), so the suite can run beside other services on the same machine.

The examples use `demo.example.com`; substitute your own domain.

## Architecture

```
visitor ──https──▶ Cloudflare ──tunnel──▶ cloudflared ──▶ caddy:80 ──┬─▶ portal      (demo.example.com)
                  (apex + wildcard)                                   ├─▶ moc         (moc.demo.example.com)
                                                                      ├─▶ it-request  (it.demo.example.com)
                                                                      ├─▶ ... 10 apps total
                                                                      └─▶ postgres / sqlite (internal only)
```

Cloudflare terminates TLS. Caddy receives plain HTTP and routes by `Host`
header to the right container (see `docker/Caddyfile`).

## One-time Cloudflare setup

1. **DNS** (the zone must be on Cloudflare):
   - `demo`   → CNAME to the tunnel created in step 2
   - `*.demo` → CNAME to the same tunnel (wildcard for the per-app subdomains)
2. **Zero Trust → Networks → Tunnels → Create tunnel** (type: Cloudflared). Copy
   the token into `.env` as `CLOUDFLARE_TUNNEL_TOKEN`, then add two public
   hostnames that both point at the same service:
   - `demo.example.com`   → `http://caddy:80`
   - `*.demo.example.com` → `http://caddy:80`

## Deploy

```bash
# on a Linux host with Docker + Compose v2
sudo git clone https://github.com/Neuron89/business-suite-demo.git /opt/business-suite-demo
cd /opt/business-suite-demo
bash install.sh            # writes .env, then stops
nano .env                  # set DEMO_DOMAIN, CLOUDFLARE_TUNNEL_TOKEN, and the secrets
bash install.sh            # builds + starts everything, including the tunnel
```

Open `https://demo.example.com`, pick a role, and click a tile.

## Nightly reset

Visitors can edit the demo data, so a systemd timer wipes the volumes and
re-seeds every app at 04:00 local time.

```bash
sudo cp deploy/acme-demo-reset.service deploy/acme-demo-reset.timer /etc/systemd/system/
# WorkingDirectory in the .service is /opt/business-suite-demo; adjust if you cloned elsewhere
sudo systemctl daemon-reload
sudo systemctl enable --now acme-demo-reset.timer
systemctl list-timers acme-demo-reset.timer
```

`deploy/reset.sh` can also be run by hand at any time.

## Smoke test without DNS

With the stack up (tunnel or not), Caddy answers on `HTTP_PORT` and routes on
the `Host` header:

```bash
curl -H 'Host: demo.example.com'     http://localhost:8080/            # portal
curl -H 'Host: moc.demo.example.com' http://localhost:8080/api/health  # MOC API
```

For interactive use without a domain, use the localhost mode described in the
top-level README (`bash install.sh --local`).
