import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import modelsRouter from "./models";
import componentsRouter from "./components";
import statsRouter from "./stats";
import maintenanceRouter from "./maintenance";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(modelsRouter);
router.use(componentsRouter);
router.use(statsRouter);
router.use(maintenanceRouter);

export default router;
