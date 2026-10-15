# Deploy 視点レンズ to Cloud Run (lens.domo-ai.com)

WO-024. 視点レンズ is a static site: the `Dockerfile` at the repo root builds the card bundle and the
trainer, then serves `apps/trainer/dist` with nginx on `$PORT` (Cloud Run sets 8080). There is no
server code, no database and no login. Access links (`/open?p=<pass>&k=<key>`) unlock a Pass in the
browser only.

**Isolation.** Run every command below in the **視点レンズ GCP project only**. This service shares
nothing with any other product except the domain name `domo-ai.com`. Never reuse or touch another
project's services, database, login or settings.

## 0. Once: choose the project

```sh
# Replace with the 視点レンズ project's ID (create it first in the console if it does not exist yet).
export LENS_PROJECT=<lens-project-id>
gcloud config set project "$LENS_PROJECT"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

## 1. Deploy (each release)

From the repo root, on the commit to release (usually `main`):

```sh
gcloud run deploy lens-web \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --project "$LENS_PROJECT"
```

Cloud Build builds the `Dockerfile`, then Cloud Run serves it. The command prints the service URL
(`https://lens-web-….a.run.app`). Check it before mapping the domain:

- `/` shows the landing page with the three courses;
- `/check` starts the free 3-minute check;
- a deep link such as `/lesson/koukou_juken/area` loads (it shows the course page until the Pass is unlocked).

## 2. Once: map lens.domo-ai.com

Cloud Run's domain mapping needs `domo-ai.com` to be verified for your Google account
(<https://search.google.com/search-console>, add the domain and follow its TXT-record steps).

```sh
gcloud beta run domain-mappings create \
  --service lens-web \
  --domain lens.domo-ai.com \
  --region asia-northeast1 \
  --project "$LENS_PROJECT"

# Shows the DNS record to add, and the certificate status.
gcloud beta run domain-mappings describe \
  --domain lens.domo-ai.com \
  --region asia-northeast1 \
  --project "$LENS_PROJECT"
```

## 3. Once: the DNS record

At the DNS provider for `domo-ai.com`, add **one** record for the subdomain only:

| type | name | value | TTL |
|---|---|---|---|
| CNAME | `lens` | `ghs.googlehosted.com.` | 3600 |

Use the value `describe` prints if it differs. Do not change any other record of `domo-ai.com`: the
cover page and every other subdomain stay as they are. The managed certificate is issued once the
record resolves (usually 15–60 minutes); `describe` shows `CertificateProvisioned: True` when done.

## 4. Check the live site

```sh
curl -sI https://lens.domo-ai.com/ | head -1                                  # HTTP/2 200
curl -s https://lens.domo-ai.com/lesson/koukou_juken/area | grep -c '<div id="root">'   # 1 (SPA fallback)
```

Then open each order email's 「コースをひらく」 link once: it must open that course, and only that one.

## Run the container locally

```sh
docker build -t lens-web .
docker run --rm -p 8080:8080 lens-web
# http://localhost:8080/  ·  /check  ·  /lesson/koukou_juken/area
```

## What the image serves

- every path falls back to `index.html` (the app routes in the browser);
- `index.html` is sent with `Cache-Control: no-cache`, so a release shows at once;
- Vite's hashed files under `/assets/` are cached for a year (`immutable`); `/audio/` and `/pdf/` for a day.

## Rollback

```sh
gcloud run revisions list --service lens-web --region asia-northeast1 --project "$LENS_PROJECT"
gcloud run services update-traffic lens-web --to-revisions <REVISION>=100 \
  --region asia-northeast1 --project "$LENS_PROJECT"
```
