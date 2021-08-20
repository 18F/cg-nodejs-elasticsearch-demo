// @ts-check

const { Client } = require("@elastic/elasticsearch");
const path = require("path");
const fs = require("fs").promises;
const { createElasticSearchClient } = require("./elasticsearch");

const DOCUMENTS_DIR = path.join(__dirname, "documents");
const MAX_TRIES = 20;

async function initIndex(indexName) {
  const client = createElasticSearchClient();

  try {
    await client.indices.delete({
      index: indexName,
    });
  } catch (err) {
    const indexNotFound =
      err.name === "ResponseError" &&
      err.meta.body.error.type === "index_not_found_exception";

    if (!indexNotFound) {
      throw err;
    }
  }

  await client.indices.create({
    index: indexName,
  });
  console.log("Created index %s...", indexName);

  await client.indices.putMapping({
    index: indexName,
    body: {
      properties: {
        type: {
          type: "keyword",
        },
        number: {
          type: "integer",
        },
        title: {
          type: "text",
        },
        "sections.title": {
          type: "text",
        },
        "sections.body": {
          type: "text",
        },
      },
    },
  });

  return await seedIndex(indexName);
}

module.exports.initIndex = makeRetryable(MAX_TRIES, initIndex);

/**
 * @param {string} indexName Elasticsearch index to use.
 * @returns {Promise<string[]>} Set of document ids indexed.
 */
async function seedIndex(indexName) {
  const client = createElasticSearchClient();
  const documents = await getJsonDocuments();

  let promise = Promise.resolve();

  documents.forEach(({ id, body }) => {
    promise = promise.then(async () => {
      console.log("Indexing %s...", id);
      await indexDocument(client, indexName, id, body);
    });
  });

  await promise;

  return documents.map(({ id }) => id);
}

/**
 * @returns {Promise<{id: string, body: object}[]>}
 */
async function getJsonDocuments() {
  return await Promise.all(
    (
      await fs.readdir(DOCUMENTS_DIR)
    )
      .filter((f) => /\.json$/.test(f))
      .map(async (f) => {
        const id = path.basename(f, ".json");
        const file = path.join(DOCUMENTS_DIR, f);
        const body = JSON.parse(await fs.readFile(file, "utf-8"));
        return {
          id,
          body,
        };
      })
  );
}

/**
 * @param {Client} client
 * @param {string} indexName
 * @param {string} id
 * @param {object} body
 */
async function indexDocument(client, indexName, id, body) {
  await client.index({ id, body, index: indexName });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeRetryable(times, func) {
  return async (...args) => {
    for (let attempt = 0; attempt < times; attempt++) {
      const isLastAttempt = attempt === times - 1;
      try {
        return await func.apply(this, args);
      } catch (err) {
        if (isLastAttempt) {
          throw err;
        }

        const isConnectionError =
          err.code === "ECONNREFUSED" || err.name === "ConnectionError";

        if (!isConnectionError) {
          throw err;
        }

        await delay(1000);
      }
    }
  };
}
