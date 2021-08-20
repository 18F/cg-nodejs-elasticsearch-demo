# Cloud.gov Node.js / Elasticsearch demo

This repository demonstrates integrating a Node.js app with Elasticsearch in Cloud.gov. It stores the [US Constitution](./documents) in Elasticsearch on startup and provides a simple interface to search by keyword.

## Prerequisites

Running and deploying this demo requires:

- [Docker][docker]
- An active Cloud.gov account
- The [Cloud Foundry CLI tools][cf-cli] (tested with v7)

## Running locally

Use `docker-compose` to run:

```shell
docker-compose up
```

(The app will be available at <http://localhost:3000>.)

## Deploying to Cloud.gov

First, you'll need [an Elasticsearch service][cg-elastic] for this app to connect to:

```shell
cf create-service aws-elasticsearch es-dev my-elastic-service
```

This will take a few minutes to complete. Once in place, deploy the app using `cf push`:

```shell
cf push cg-nodejs-elasticsearch-demo
```

## What's interesting about this?

**Connecting to an Amazon Elasticsearch instance with the `@elastic/elasticsearch` client**

As of this writing, recent versions of the `@elastic/elasticsearch` client will refuse to connect to Amazon Elasticsearch nodes. This repo pins the client version used to one without this limitation.

**Authenticating with Amazon Elasticsearch via `ACCESS_KEY_ID` and `SECRET_ACCESS_KEY`**

Elasticsearch nodes in AWS require that incoming requests are signed. The stock `@elastic/elasticsearch` client does not support this, so this demo uses [`@acuris/aws-es-connection`][aws-es-connection] to handle request signing.

[docker]: https://www.docker.com/
[cf-cli]: https://docs.cloudfoundry.org/cf-cli/
[cg-elastic]: https://cloud.gov/docs/services/aws-elasticsearch/
[aws-es-connection]: https://www.npmjs.com/package/@acuris/aws-es-connection
