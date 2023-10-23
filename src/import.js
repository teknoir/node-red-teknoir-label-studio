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

  const nodeImportingStatus = {
    fill: "yellow",
    shape: "dot",
    text: "importing",
  };
  const nodeSuccessImportStatus = {
    fill: "green",
    shape: "dot",
    text: "task imported",
  };
  const nodePredictionTresholdNotPassedStatus = {
    fill: "yellow",
    shape: "dot",
    text: "predictions didnt pass treshold",
  };
  function LabelStudioImport(config) {
    var node = this;
    RED.nodes.createNode(this, config);

    if (!teknoir_config.DOMAIN) {
      node.error("A DOMAIN environment variable is required");
      return;
    }

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
      const fileExtension = payload.type || "jpeg"; //TODO: determine filetype from binary

      const bucketName = `${teknoir_config.NAMESPACE}.${teknoir_config.DOMAIN}`;
      const projectName = config.selectedProject.title;
      const isPublic = config.publicData;

      node.status(nodeImportingStatus);
      let hasPredictions =
        Array.isArray(payload.predictions) && payload.predictions.length;
      if (hasPredictions && !utils.validatePredictions(payload.predictions)) {
        node.error("invalid predictions field");
        return;
      }

      if (
        hasPredictions &&
        config.predictionsTreshold &&
        // not contains predictions that are lower than treshold
        !payload.predictions.find((p) => {
          return (
            p.result.filter(
              (obj) => obj.value.score < config.predictionsTreshold
            ).length > 0
          );
        })
      ) {
        console.log("predictions didnt pass treshold");
        node.status(nodePredictionTresholdNotPassedStatus);
        return;
      }

      const fileName = `label-studio/projects/${projectName}/import/${fileNamePrefix}`;
      const bucket = storage.bucket(bucketName); // Get access to the bucket
      const fullFilePath = `gs://${bucketName}/${fileName}.${fileExtension}`;
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}.${fileExtension}`;
      var contentFile = function uploadMainFile(callback) {
        utils
          .writeToGcs(
            bucket,
            `${fileName}.${fileExtension}`,
            Buffer.from(msg.payload.content),
            isPublic
          )
          .then(() => callback(null, { file: fullFilePath }))
          .catch((err) => callback(err));
      };

      var importTask = function (callback) {
        const dataLocation = isPublic ? publicUrl : fullFilePath;
        const task = {
          data: {
            image: dataLocation,
          },
          predictions: payload.predictions,
          cancelled_annotations: payload.cancelled_annotations || 0,
          meta: payload.metadata || {},
        };
        ls.importTask(config.selectedProject.id, task)
          .then(res => {
            if(res.status > 400) {
              const err = new Error(`Error importing task! status: ${res.status}`)
              callback(err)
            }
            callback(null, { file: dataLocation, res })
          })
          .catch((err) => callback(err));
      };

      let flow = [contentFile, importTask];
      async.series(flow, function (err, res) {
        if (err) {
          node.error(err);
        } else {
          console.log(res);
          node.send({ payload: res });
          node.status(nodeSuccessImportStatus);
        }
      });
    });
  }

  RED.nodes.registerType("import", LabelStudioImport);
};