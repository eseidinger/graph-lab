# Graph Lab auf der Developer Platform bootstrappen

Diese Anleitung setzt eine **bereits installierte Developer Platform** voraus. Sie
deployt die Graph-Lab-Weboberfläche und die API in ein Projekt und bindet die API
an eine verwaltete PostgreSQL-Datenbank mit Apache AGE. Neo4j, HugeGraph und die
lokalen Referenzkonsolen aus `docker/compose.yaml` gehören nicht zu diesem
Deployment. Die API liefert auch die gebaute Weboberfläche aus. Dafür ist nur
ein öffentliches Image und eine Service-Komponente nötig.

Die maßgeblichen Plattformverträge stehen in der
[Entwickleranleitung](../../developer-platform/docs/developers/getting-started.md),
der [Deklarationsreferenz](../../developer-platform/docs/developers/application-spec.md)
und dem [Store-Workflow](../../developer-platform/docs/operators/data-stores.md).
Die relativen Links funktionieren, wenn `graph-lab` und `developer-platform`
nebeneinander ausgecheckt sind.

## 1. Voraussetzungen

- Projekt-Slug, API-URL und Deployment-Berechtigung vom Plattformteam erhalten.
  Für Store-Erstellung, Bindung und öffentliche Zugriffsregeln wird eine
  Projektadministration benötigt.
- Python 3.12 oder neuer, `devplat`, Docker/Buildx und Schreibzugriff auf eine
  **öffentlich lesbare** OCI-Registry bereitstellen. Die Plattform unterstützt
  keine privaten Image-Pull-Credentials.
- Für CI die OIDC-Token-URL, Client-ID und das einmalig ausgegebene Client-Secret
  als geschützte Variablen hinterlegen. Für interaktive Arbeit kann stattdessen
  ein CLI-Profil mit `devplat auth login` verwendet werden.
- Ein Projekt braucht ausreichend Quota für einen Service und den PostgreSQL-
  Store. Die API führt beliebige Cypher-Schreibabfragen aus; den öffentlichen
  Zugriff deshalb nur an vertrauenswürdige Gruppen vergeben.

```bash
python3 -m pip install --user pipx
python3 -m pipx ensurepath
python3 -m pipx install developer-platform-cli
devplat --help
```

In einer neuen Shell `PLATFORM_API_URL` und entweder ein interaktives Profil
oder `PLATFORM_TOKEN_ENDPOINT`, `PLATFORM_CLIENT_ID` und
`PLATFORM_CLIENT_SECRET` setzen. Geheimnisse gehören weder in die Deklaration
noch in Build-Argumente oder das Repository. Mit `devplat auth status` die
Authentifizierung prüfen. `PLATFORM_ACCESS_TOKEN` ist eine Alternative zu den
drei Deployment-Credential-Variablen.

## 2. Image bauen und veröffentlichen

Vom Graph-Lab-Repository aus das
[Plattform-Dockerfile](../docker/platform/Dockerfile) bauen. Es baut API und
Vite-Weboberfläche und kopiert beide Ergebnisse in ein Node-Image. Fastify
liefert `/`, die Vite-Assets und `/api/*` über Port 3001 aus. Der Prozess lauscht
im Container auf allen Interfaces und läuft mit UID/GID `10001` auf dem
schreibgeschützten Root-Dateisystem der Plattform.
Die Plattformdeklaration setzt `AGE_LOAD_LIBRARY=false`, weil der verwaltete
Store AGE bereitstellt und gebundene Nutzer `LOAD 'age'` nicht ausführen dürfen.
Die lokale Compose-Datenbank verwendet den Standardwert `true`.

```bash
docker buildx build --platform linux/amd64 \
  -f docker/platform/Dockerfile -t eseidinger/graph-lab:latest --push .
```

Gegebenenfalls die Zielarchitektur anpassen. Die Anwendungsdeklaration verweist
auf `docker.io/eseidinger/graph-lab:latest`. Die Plattform löst das Tag beim
Deploy auf einen konkreten Digest auf. Ein lokaler Docker-Build allein macht
das Image für die Plattform noch nicht verfügbar.

## 3. AGE-Store und Anwendung binden

Ein Projektadministrator legt einen benannten PostgreSQL-Store mit `age` an.
Beispiel `resource.json`:

```json
{"name":"graph-data","provider":"postgresql","quota_bytes":1073741824,"extensions":["age"]}
```

```bash
devplat stores create --project graph-lab --file resource.json
devplat stores get RESOURCE_UUID --output json
```

`RESOURCE_UUID` aus der Create-Antwort übernehmen und warten, bis
`observed_state` den Wert `active` hat. Dann eine Schreibbindung **nur für die
Anwendungskomponente** beantragen. Beispiel `binding.json`:

```json
{"resource_id":"RESOURCE_UUID","component":"web","mode":"read-write"}
```

```bash
devplat stores bindings request --project graph-lab --file binding.json
```

Die echte Resource-UUID in `binding.json` einsetzen und die aktive Bindungs-UUID
aus der Antwort bzw. der Store-Ansicht übernehmen. Bei einer projektfremden
Ressource muss deren Administration die Bindung zusätzlich freigeben. Der
Plattform-Store injiziert `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`,
`PGPASSWORD` und `PGSSLMODE` in `web`; Graph Lab nutzt diese Werte bereits über
`pg`.

## 4. Graph-Migration

Der lokale Compose-Container legt `graph_lab` über
[`10-graph-lab.sql`](../docker/infra/age/10-graph-lab.sql) an. Ein neuer
Plattform-Store enthält diesen Graphen noch nicht. Beim Start führt die API
[`001-initialize-graph.ts`](../apps/api/src/migrations/001-initialize-graph.ts)
aus: Sie prüft den Graphkatalog und legt `graph_lab` nur bei Bedarf an. Eine
Transaktionssperre verhindert konkurrierende Initialisierungen. Schlägt die
Migration fehl, startet der Service nicht und der Rollout wird nicht bereit.
Nach dem Deployment lassen sich die AGE-Beispiele aus dem
[Graph-Tutorial](use-cases/graph-tutorial.md) laden.

Die Migration kann bei Bedarf mit `npm run build` und anschließend
`npm run migrate -w @graph-lab/api` separat ausgeführt werden, wenn dieselben
`PG*`-Variablen oder `DATABASE_URL` gesetzt sind. Im normalen Deployment ist
dieser manuelle Schritt nicht nötig.
Direkte Cypher-Schreibzugriffe sind für Experimente geeignet. Für
wiederherstellbare Produktionsdaten verlangt die Plattform eine maßgebliche
Quelle und einen AGE-Rebuild; siehe das
[AGE-Projektionsbeispiel](../../developer-platform/examples/postgresql-graph/README.md).

## 5. Anwendung deklarieren und deployen

`metadata.name` muss dem tatsächlichen Projekt-Slug entsprechen. Die folgende
Datei ist eine **Vorlage**: Die Bindungs-ID durch den realen Wert ersetzen.
Bei einem anderen Projekt-Slug auch `--project` in allen Befehlen anpassen.

```json
{
  "apiVersion": "platform.eseidinger.de/v1",
  "kind": "Application",
  "metadata": {"name": "graph-lab"},
  "spec": {
    "configuration": {"values": {"AGE_LOAD_LIBRARY": "false"}},
    "components": [
      {
        "name": "web",
        "type": "service",
        "runtime": {"type": "container", "image": "docker.io/eseidinger/graph-lab:latest"},
        "ports": [{"name": "http", "protocol": "http", "port": 3001}],
        "bindings": [{"bindingId": "BINDING_UUID", "envPrefix": ""}],
        "exposure": "public",
        "health": {"readiness": {"path": "/api/graphs"}}
      }
    ]
  }
}
```

Die Bindungs-UUID durch den tatsächlichen Wert ersetzen und die Datei als
`application.json` speichern. Dann validieren und anwenden:

```bash
devplat deploy validate --project graph-lab --file application.json
devplat deploy apply --project graph-lab --file application.json --wait
devplat components list --project graph-lab --output json
```

`--wait` prüft die dauerhafte Operation und die Workload-Bereitschaft. Der
Readiness-Pfad `/api/graphs` prüft auch die AGE-Verbindung. Nach dem Rollout
`/api/graphs` über die Web-URL prüfen; dort
soll `graph_lab` erscheinen. Bei Fehlern helfen `devplat logs --project
graph-lab --component api --tail 50 --output json` und die Operationsansicht.

## 6. Browserzugriff freigeben

Ein `public`-Service ist zunächst durch die Plattform gesperrt. Ein
Projektadministrator erstellt eine Gruppe, weist berechtigte Nutzer zu und
aktiviert eine separate `ApplicationAccessPolicy`. Graph Lab benötigt mindestens
`GET` für die Weboberfläche und `/api/graphs` sowie `POST` für `/api/query`.
Beispiel `access-policy.json`:

```json
{
  "component": "web",
  "defaultDecision": "deny",
  "identityAttributes": {"displayName": false, "email": false},
  "routes": [
    {
      "name": "read-ui",
      "match": {"pathPrefix": "/", "methods": ["GET"]},
      "authentication": {"mode": "browser-session"},
      "authorization": {"anyOfGroups": ["graph-users"]}
    },
    {
      "name": "run-query",
      "match": {"pathPrefix": "/api/query", "methods": ["POST"]},
      "authentication": {"mode": "browser-session"},
      "authorization": {"anyOfGroups": ["graph-users"]}
    }
  ]
}
```

```bash
devplat access groups create --project graph-lab --name graph-users \
  --display-name 'Graph Lab users' --idempotency-key graph-lab-users
devplat access policy apply --project graph-lab --application graph-lab \
  --file access-policy.json --wait
```

Die Gruppenmitgliedschaft wird nach der ersten Anmeldung von der
Projektadministration genehmigt. Eine Deployment-Berechtigung gewährt keinen
Zugriff auf die Anwendung. Die URL folgt dem Muster
`https://web-graph-lab.<apps-domain>`. Für Browser-POSTs verlangt die Plattform
zusätzlich ihren CSRF-Cookie/Header und denselben HTTPS-Origin. Der Graph-Lab-
Client kopiert den lesbaren Plattform-CSRF-Cookie für Query-POSTs in den
erforderlichen Header. Nach der Freigabe im Browser die Graphliste und eine
Abfrage ausführen.

## Aktualisieren

Ein neues `latest`-Image veröffentlichen und die **vollständige** Deklaration
mit `devplat deploy apply ... --wait` erneut anwenden. Die Plattform löst das
Tag dabei erneut auf einen Digest auf.
Für parallele Bearbeitung die aktuelle Revision mit `devplat deploy get
--project graph-lab` lesen und beim Apply `--if-match REVISION` angeben.
Rollback einer Anwendung rollt Datenbankänderungen oder Secrets nicht zurück.
