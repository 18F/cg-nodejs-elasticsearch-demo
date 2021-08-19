// @ts-check
const AWS = require("aws-sdk");
const { Client, Connection } = require("@elastic/elasticsearch");
const { createAWSConnection } = require("@acuris/aws-es-connection");

const DEFAULT_VCAP_SERVICES = JSON.stringify({
  "aws-elasticsearch": [
    {
      credentials: {
        uri: process.env.ELASTICSEARCH_URL,
      },
    },
  ],
});

/**
 * Creates a preconfigured Elasticsearch client.
 * @returns {Client}
 */
function createElasticSearchClient() {
  const config = getElasticSearchConfig();

  /**
   * @var {Connection|undefined}
   */
  let connection;

  if (config.accessKeyId && config.secretAccessKey) {
    // Adapt client to authenticate using AWS credentials
    const credentials = new AWS.Credentials(
      config.accessKeyId,
      config.secretAccessKey || ""
    );

    connection = createAWSConnection(credentials);
  }

  const client = new Client({
    ...(connection || {}),
    node: config.url,
  });
  return client;
}

/**
 * Reads Elasticsearch connection information from the environment.
 * When deployed to cloud.gov, we use Cloudfoundry's VCAP_SERVICES environment
 * variable. Otherwise, we use dedicated environment variables with
 * "ELASTICSEARCH_" prefixes.
 * @returns {{accessKeyId?: string, secretAccessKey?: string, url: string}}
 */
function getElasticSearchConfig() {
  const vcap = JSON.parse(process.env.VCAP_SERVICES || DEFAULT_VCAP_SERVICES);
  const service = (vcap["aws-elasticsearch"] || [])[0];

  if (!service) {
    throw new Error(
      "No Elasticsearch configuration found. Verify that the application is correctly bound to the Elasticsearch service."
    );
  }

  return {
    url: service.credentials.uri,
    accessKeyId: service.credentials.access_key,
    secretAccessKey: service.credentials.secret_key,
  };
}

module.exports = { createElasticSearchClient };
