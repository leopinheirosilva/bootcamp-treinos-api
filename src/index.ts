import Fastify from "fastify";

const fastify = Fastify({
  logger: true,
});

fastify.get("/", async () => {
  return { hello: "world" };
});

const start = async () => {
  try {
    await fastify.listen({ port: Number(process.env.PORT) || 8080 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
