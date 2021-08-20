// @ts-check

const express = require("express");
const path = require("path");
const { createElasticSearchClient } = require("./elasticsearch");

/**
 * @param {string} indexName
 * @returns {express.Express}
 */
function createExpressApp(indexName) {
  const app = express();

  app.set("view engine", "ejs");

  app.use(express.json());

  app.use(
    "/uswds",
    express.static(path.join(__dirname, "node_modules/uswds/dist"), {})
  );

  app.get(
    "/",
    asyncHandler(async (req, res, next) => {
      const query = getQuery(req);
      const results = await findDocuments(query, indexName);

      const data = {
        query,
        results: results.map((r) => ({
          ...r,
          url: `${r.url}?q=${encodeURIComponent(query)}`,
        })),
      };

      res.render("home", data);
    })
  );

  app.get(
    "/:type/:number?",
    asyncHandler(async (req, res, next) => {
      const document = await getDocument(
        indexName,
        req.params.type,
        req.params.number ? parseInt(req.params.number, 10) : undefined
      );
      if (!document) {
        res.sendStatus(404);
        return;
      }

      const query = getQuery(req);

      const data = {
        document,
        query,
      };
      res.render("document", data);
    })
  );

  app.get(
    "/ready",
    asyncHandler(async (req, res, next) => {
      const client = createElasticSearchClient();
      const nodes = await client.nodes.info({
        node_id: "_local",
        timeout: "1s",
      });

      res.status(200);
      res.json(nodes);
      res.end();
    })
  );

  app.get(
    "/documents",
    asyncHandler(async (req, res) => {
      const q = req.query.q || "";
      const client = createElasticSearchClient();
      const response = await client.search({
        index: indexName,
      });

      res.status(200);
      res.json(
        response.body.hits.hits.map((doc) => ({
          id: doc._id,
          ...doc._source,
        }))
      );
    })
  );

  app.get(
    "/documents/:id",
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const client = createElasticSearchClient();

      let document;

      try {
        document = await client.get({
          id,
          index: indexName,
        });
      } catch (err) {
        console.error(err);
        res.status(404);
        res.end();
        return;
      }

      res.status(200);
      res.json(document);
      res.end();
    })
  );

  return app;
}

/**
 * @param {(req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>} func
 * @returns {(req: express.Request, res: express.Response, next: express.NextFunction) => void}
 */
function asyncHandler(func) {
  /**
   * @param {express.Request} req
   * @param {express.Response} res
   * @param {express.NextFunction} next
   */
  return (req, res, next) => {
    func(req, res, next).catch(next);
  };
}

/**
 *
 * @param {string} query
 * @param {string} indexName
 * @returns {Promise<object[]>}
 */
async function findDocuments(query, indexName) {
  const client = createElasticSearchClient();
  const response = await client.search({
    index: indexName,
    body: {
      query: {
        multi_match: {
          query,
          fields: ["title", "sections.body"],
        },
      },
      highlight: {
        fields: { "sections.body": {} },
      },
    },
  });

  return response.body.hits.hits.map((doc) => ({
    id: doc._id,
    score: Math.round(doc._score * 1000) / 1000,
    ...doc._source,
    url: doc._source.number
      ? `/${encodeURIComponent(doc._source.type)}/${encodeURIComponent(
          doc._source.number
        )}`
      : `/${encodeURIComponent(doc._source.type)}`,
    highlight: Object.values(doc.highlight)
      .reduce((result, highlight) => {
        if (Array.isArray(highlight)) {
          return [...result, ...highlight];
        } else {
          return [...result, highlight];
        }
      }, [])
      .map((highlight) => {
        return `${highlight}...`;
      }),
  }));
}

/**
 *
 * @param {string} type
 * @param {number?} number
 * @returns {Promise<object>}
 */
async function getDocument(indexName, type, number) {
  const client = createElasticSearchClient();

  const query = {
    bool: {
      must: [{ term: { type } }, number != null && { term: { number } }].filter(
        (x) => x
      ),
    },
  };

  const response = await client.search({
    index: indexName,
    body: {
      query,
    },
  });

  return response.body.hits.hits[0]._source;
}

/**
 * @param {express.Request} req
 * @returns {string}
 */
function getQuery(req) {
  const query = req.query.q;

  if (query == null) {
    return "";
  }

  return Array.isArray(query) ? query.join(" ") : query.toString();
}

module.exports = { createExpressApp };
