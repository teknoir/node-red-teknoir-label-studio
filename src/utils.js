const fs = require("fs");
const fetch = require("node-fetch");

function importLsTask(task, lsHost, lsProjectId, token) {
  return fetch(`http://${lsHost}/api/projects/${lsProjectId}/import`, {
    method: "post",
    headers: {
      // "X-Goog-Authenticated-User-Email": owner,
      // Get user token with:
      // kubectl exec -ti pod/label-studio-7d47c769-kv7ct -c label-studio -- bash
      // label-studio user --username anders.aslund@teknoir.ai
      // kubectl port-forward svc/label-studio 3888:80
      // curl -v -H "Authorization: Token 044df23a70cc457520d93c595b5381bd34a4bbc0" http://localhost:3888/api/current-user/whoami
      "Authorization": `Token ${token}`,
      "Content-type": "application/json",
    },
    body: JSON.stringify(task),
  });
}

async function config() {
  NAMESPACE = process.env.NAMESPACE || k8sNamespace();
  KFAM_HOST =
    process.env.KFAM_URL ||
    "http://profiles-kfam.teknoir.svc.cluster.local:8081";
  return {
    ADD_AUTH_HEADER: process.env.ADD_AUTH_HEADER,
    PIPELINES_HOST:
      process.env.PIPELINES_HOST ||
      "http://ml-pipeline.teknoir.svc.cluster.local:8888",
    KFAM_HOST: KFAM_HOST,
    NAMESPACE: NAMESPACE,
    OWNER: process.env.OWNER || (await getOwner(NAMESPACE, KFAM_HOST)),
    PROJECT_ID: process.env.PROJECT_ID,
    DOMAIN: process.env.DOMAIN,
    LS_HOST: process.env.LS_HOST || "label-studio",
  };
}

/**
 * contains apis for labelstudio
 * @param {*} lsHost - host of label studio
 * @param {*} owner - owner of namespace where label studio runs
 * @returns projects array
 */
function ls(lsHost, owner) {
  const apiUrl = `http://${lsHost}/api`;
  return {
    getProjects: function () {
      return fetch(`${apiUrl}/projects`, {
        headers: { "X-Goog-Authenticated-User-Email": owner },
      })
      .then((x) => x.json())
      .then(projects => {
        // results field is coming from 1.5.0
        return projects['results'] || projects
      });
    },
    getProject: function (id) {
      return fetch(`${apiUrl}/projects/${id}`, {
        headers: { "X-Goog-Authenticated-User-Email": owner },
      }).then((x) => x.json());
    },
    importTask: function (projectId, task) {
      return fetch(`${apiUrl}/projects/${projectId}/import`, {
        method: "post",
        headers: {
          "X-Goog-Authenticated-User-Email": owner,
          "Content-type": "application/json",
        },
        body: JSON.stringify(task),
      });
    },
  };
}

function getOwner(namespace, kfamUrl) {
  const url = `${kfamUrl}/kfam/v1/bindings?namespace=${namespace}`;
  return fetch(url)
    .then((x) => x.json())
    .then((x) => x.bindings.find((x) => x.RoleRef.name == "admin").name);
}

function k8sNamespace() {
  try {
    return fs.readFileSync(
      "/var/run/secrets/kubernetes.io/serviceaccount/namespace"
    );
  } catch (e) {
    return undefined;
  }
}

// returns false if predictions are invalid, true otherwise
function validatePredictions(predictions) {
  const hasInvalidModel = predictions.find((p) => {
    return !p.model_version || p.model_version == "";
  });
  return !hasInvalidModel
}

function writeToGcs(bucket, filePath, buffer, public) {
  return new Promise((resolve, reject) => {
    const file = bucket.file(filePath); // Model access to the file in the bucket
    const writeStreamOptions = public ? { predefinedAcl: "publicRead" } : {};
    const writeStream = file.createWriteStream(writeStreamOptions); // Create a write stream to the file.
    writeStream
      .on("error", reject)
      .on("finish", () => {
        resolve(true);
      })
      .end(buffer);
  });
}

module.exports = {
  validatePredictions,
  k8sNamespace,
  writeToGcs,
  importLsTask,
  getOwner,
  ls,
  config,
};
