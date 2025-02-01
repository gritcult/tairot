import { Elysia } from "elysia";

const app = new Elysia()
  .get("/", () => "Hello World")
  .listen(8888);

console.log(`Server is running at ${app.server?.hostname}:${app.server?.port}`); 