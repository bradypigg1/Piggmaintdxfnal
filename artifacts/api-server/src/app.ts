import express, { type Express } from "express";
import type { IncomingMessage, ServerResponse } from "node:http";
import cors from "cors";
import * as pinoHttpNs from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const pinoHttp =
  (pinoHttpNs as unknown as { default?: typeof pinoHttpNs.pinoHttp }).default ??
  pinoHttpNs.pinoHttp;

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: IncomingMessage & { id?: string | number }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: ServerResponse) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
