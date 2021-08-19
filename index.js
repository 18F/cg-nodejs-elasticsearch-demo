// @ts-check

const { createExpressApp } = require("./app");
const { seedIndex } = require("./seed");

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

async function run() {
  const PORT = process.env.PORT || 3000;
  const INDEX = process.env.ELASTICSEARCH_INDEX || "my-index";

  const documentIds = await seedIndex(INDEX);
  console.log("Indexed %d document(s)", documentIds.length);

  const app = createExpressApp(INDEX);
  app.listen(PORT, () => {
    console.log(`Listening on ${PORT}`);
  });
}
