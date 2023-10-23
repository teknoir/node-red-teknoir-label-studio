const { Storage } = require("@google-cloud/storage");
const { v4 } = require("uuid");
const fs = require("fs");
const async = require("async");
const fetch = require("node-fetch");
const utils = require("./utils");

module.exports = async function (RED) {
  const teknoir_config = await utils.config();
  const ls = utils.ls(teknoir_config.LS_HOST, teknoir_config.HTTP_VERIFIED_JWT);
  const storage = new Storage({});
  
  function LabelStudioTask(config) {
    var node = this;
    RED.nodes.createNode(this, config);

    if (!teknoir_config.DOMAIN) {
      node.error("A DOMAIN environment variable is required");
      return;
    }
    const domain = process.env.DOMAIN;

    node.on("input", function (msg) {
      if (!config.selectedProject) {
        const msg = "Must choose project before supplying input";
        node.error(msg);
        node.status({ fill: "red", shape: "dot", text: msg });
        return;
      }
      const payload = msg.payload;

      if (!payload.content) {
        node.error("No data found in msg.payload.content");
        return;
      }

      const fileNamePrefix = payload.filename || v4();
      const fileExtension = payload.type || "jpeg";
      const bucketName = `${teknoir_config.NAMESPACE}.${teknoir_config.DOMAIN}`;
      const projectName = config.selectedProject.title;
      let fileType =
        Array.isArray(payload.predictions) && !payload.predictions.length
          ? "structured"
          : "raw";
      if (
        fileType == "structured" &&
        !utils.validatePredictions(payload.predictions)
      ) {
        node.error("invalid predictions field");
        return;
      }

      const fileName = `label-studio/projects/${projectName}/sources/${fileType}/${fileNamePrefix}`;
      const bucket = storage.bucket(bucketName); // Get access to the bucket

      var contentFile = function uploadMainFile(callback) {
        const fullFilePath = `gs://${bucketName}/${fileName}.${fileExtension}`;
        utils
          .writeToGcs(
            bucket,
            `${fileName}.${fileExtension}`,
            Buffer.from(msg.payload.content)
          )
          .then(() => callback(null, { file: fullFilePath }))
          .catch((err) => callback(err));
      };

      let uploads = [contentFile];
      if (fileType == "structured") {
        uploads.push(function (callback) {
          //uploading json file with link to content file
          const fullFilePath = `gs://${bucketName}/${fileName}.json`;
          const task = {
            data: {
              image: `gs://${bucketName}/${fileName}.${fileExtension}`,
            },
            predictions: predictions,
          };
          utils
            .writeToGcs(
              bucket,
              `${fileName}.json`,
              Buffer.from(JSON.stringify(task))
            )
            .then(() => callback(null, { file: fullFilePath }))
            .catch((err) => callback(err));
        });
      }

      async.series(uploads, function (err, res) {
        if (err) {
          node.err(err);
        } else {
          console.log(res);
          node.send({ payload: res });
        }
      });
    });
  }

  RED.nodes.registerType("training-data", LabelStudioTask);
};
