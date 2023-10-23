const fetch = require("node-fetch");
const utils = require("./utils");

module.exports = async function (RED) {
  const teknoir_config = await utils.config();
  const ls = utils.ls(teknoir_config.LS_HOST, teknoir_config.HTTP_VERIFIED_JWT);

  function LabelStudioProject(config) {
    var node = this;
    RED.nodes.createNode(this, config);

    node.on("input", async function (msg) {
      if (!config.selectedProject) {
        const msg = "Must choose project before supplying input";
        node.error(msg);
        node.status({ fill: "red", shape: "dot", text: msg });
        return;
      }
      ls.getProject(config.selectedProjectId).then((project) => {
        parsedLabels = project.parsed_label_config;
        projectLabels = (parsedLabels.tag || parsedLabels.label).labels;

        node.send({
          payload: {
            project_info: {
              labels: projectLabels,
              namespace: teknoir_config.NAMESPACE,
              labelstudio_project: project.title,
              domain: teknoir_config.DOMAIN,
            },
          },
        });
       
        node.status({ fill: "green", shape: "dot", text: "done" });
      });
    });
  }

  RED.nodes.registerType("project", LabelStudioProject);

  RED.httpAdmin.get("/label-studio/task/projects", function (req, res) {
    ls.getProjects().then((x) => res.json(x));
  });
};
