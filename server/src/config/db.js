import mongoose from "mongoose";
import { logger } from "../libs/logger.js";
const db = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info("database.connected");
  } catch (error) {
    logger.error("database.connection_failed", {
      error: {
        name: error.name,
        code: error.code,
        stack: error.stack?.split("\n").slice(1).join("\n"),
      },
    });
    process.exit(1);
  }
};
export default db;
// This function connects to the MongoDB database using Mongoose and logs the status of the connection
