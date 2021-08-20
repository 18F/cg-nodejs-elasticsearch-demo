// @ts-check

const { createExpressApp } = require("./app");
const { initIndex } = require("./init");

const PORT = process.env.PORT || 3000;
const INDEX = process.env.ELASTICSEARCH_INDEX || "us-constitution";

initIndex(INDEX).catch((err) => {
  console.error(err);
  process.exit(1);
});

const app = createExpressApp(INDEX);

app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});
