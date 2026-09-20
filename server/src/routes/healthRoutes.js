import { Router } from "express";
import mongoose from "mongoose";

export function createHealthRouter({
  databaseConnection = mongoose.connection,
} = {}) {
  const router = Router();

  // Liveness deliberately does not depend on MongoDB. It answers whether this
  // Node process can accept HTTP requests, which is distinct from readiness.
  router.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // A connected Mongoose default connection means the API can serve requests
  // that depend on MongoDB. Connecting, disconnecting, and disconnected states
  // must not receive traffic from a load balancer.
  router.get("/ready", (_req, res) => {
    if (databaseConnection.readyState !== mongoose.STATES.connected) {
      return res.status(503).json({ status: "not_ready" });
    }

    return res.status(200).json({ status: "ready" });
  });

  return router;
}

export default createHealthRouter();
