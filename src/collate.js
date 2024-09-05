module.exports = function (RED) {
  function fieldByPath(path, obj) {
    return path.split(".").reduce((o, i) => o[i], obj);
  }

  function toLabelStudioPredictions(detections, model) {
    let result = [];
    for (let i = 0; i < detections.length; i++) {
      let detection = detections[i]["detection"];
      let prediction = {
        from_name: "label",
        source: "$image",
        to_name: "image",
        type: "rectanglelabels",
        value: {
          score: detection.score,
          rectanglelabels: [detection.label],
          rotation: 0,
          x: detection.x1 * 100.0,
          y: detection.y1 * 100.0,
          width: detection.width * 100.0,
          height: detection.height * 100.0,
        },
      };
      result.push(prediction);
    }

    return { result: result, model_version: model };
  }

  function Collate(config) {
    let node = this;
    RED.nodes.createNode(this, config);
    node.on("input", function (msg, send, done) {
      node.status({
        fill: "yellow",
        shape: "dot",
        text: "converting",
      });

      try {
        let kind = fieldByPath(config.kindPath, msg) || "";
        if (kind !== "InferenceEvent") {
            node.status({
                fill: "red",
                shape: "dot",
                text: "kind not InferenceEvent, skipping!",
            });
            done();
            return;
        }

        let imageBase64 = fieldByPath(config.imagePath, msg).split(",")[1];
        let imageBuffer = Array.from(
          Uint8Array.from(Buffer.from(imageBase64, "base64"))
        );

        let detections = fieldByPath(config.detectionsPath, msg);
        let metadata = {
          lineage: fieldByPath(config.lineagePath, msg) || {},
          location: fieldByPath(config.locationPath, msg) || {},
          peripheral: fieldByPath(config.peripheralPath, msg) || {},
        }
        // let model = fieldByPath(config.modelPath, msg);
        let predictions = [];
        if (detections) {
          predictions.push(toLabelStudioPredictions(detections, "tbd"));
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

  RED.nodes.registerType("collate", Collate);
};
