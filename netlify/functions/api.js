const serverless = require("serverless-http");
const { app } = require("../../dist/app");

exports.handler = serverless(app);
