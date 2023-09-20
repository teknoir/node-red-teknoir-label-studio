module.exports = function (RED) {
  function fieldByPath(path, obj) {
    return path.split(".").reduce((o, i) => o[i], obj);
  }

  function toPredictions(objects, model) {
    let result = [];
    for (let i = 0; i < objects.length; i++) {
      let object = objects[i];
      let prediction = {
        from_name: "label",
        source: "$image",
        to_name: "image",
        type: "rectanglelabels",
        value: {
          score: object.score,
          rectanglelabels: [object.className],
          rotation: 0,
          x: object.bbox[0] * 100.0,
          y: object.bbox[1] * 100.0,
          width: object.bbox[2] * 100.0,
          height: object.bbox[3] * 100.0,
        },
      };
      result.push(prediction);
    }

    return { result: result, model_version: model };
  }

  function YoloPostProcessor(config) {
    let node = this;
    RED.nodes.createNode(this, config);
    node.on("input", function (msg, send, done) {
      node.status({
        fill: "yellow",
        shape: "dot",
        text: "converting",
      });
      try {
        let imageBase64 = fieldByPath(config.imagePath, msg).split(",")[1];
        let imageBuffer = Array.from(
          Uint8Array.from(Buffer.from(imageBase64, "base64"))
        );

        let predictionObjects = fieldByPath(config.detectedObjectsPath, msg);
        let metadata = fieldByPath(config.metadataPath, msg) || {};
        let model = fieldByPath(config.modelPath, msg);
        let predictions = [];
        if (predictionObjects && model) {
          predictions.push(toPredictions(predictionObjects, model));
        }
        var result = {
          payload: {
            predictions: predictions,
            content: imageBuffer,
            filetype: "jpeg",
            metadata: metadata
          },
        };
        send(result);
        node.status({
          fill: "green",
          shape: "dot",
          text: "converted",
        });
        done();
      } catch (e) {
        node.error(e);
      }
    });
  }

  RED.nodes.registerType("yolo-post-processor", YoloPostProcessor);
};
