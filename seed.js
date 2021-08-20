// @ts-check

const { Client } = require("@elastic/elasticsearch");
const path = require("path");
const fs = require("fs").promises;
const { createElasticSearchClient } = require("./elasticsearch");

const DOCUMENTS_DIR = path.join(__dirname, "documents");

async function initIndex(indexName) {
  const client = createElasticSearchClient();

  await client.indices.delete({
    index: indexName,
  });

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

  await seedIndex(indexName);
}

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
  let attempts = 4;

  while (attempts > 0) {
    attempts--;
    try {
      await client.index({ id, body, index: indexName });
    } catch (err) {
      if (err.code === "ECONNREFUSED" && attempts > 0) {
        console.error("Connection refused, retrying in a bit...");
        // Server's not awake yet
        await delay(3000);
      } else {
        throw err;
      }
    }
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { initIndex, seedIndex };
