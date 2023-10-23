const fs = require("fs");
const fetch = require("node-fetch");

async function config() {
  NAMESPACE = process.env.NAMESPACE || k8sNamespace();
  return {
    NAMESPACE: NAMESPACE,
    PROJECT_ID: process.env.PROJECT_ID,
    DOMAIN: process.env.DOMAIN,
    LS_HOST: process.env.LS_HOST || `label-studio.${process.env.NAMESPACE || k8sNamespace()}.svc.cluster.local`,
    HTTP_VERIFIED_JWT: btoa(JSON.stringify({
      gcip: {
        email: `devstudio-${process.env.NAMESPACE || k8sNamespace()}@teknoir.ai`,
        email_verified: true,
        name: 'Devstudio User',
        teknoir: {
          role: 'editor',
        },
      },
    })),
  };
}

/**
 * contains apis for labelstudio
 * @param {*} lsHost - host of label studio
 * @param {*} httpVerifiedJwt - Verified JWT header
 * @returns projects array
 */
function ls(lsHost, httpVerifiedJwt) {
  const apiUrl = `http://${lsHost}/api`;

  return {
    getProjects: function () {
      return fetch(`${apiUrl}/projects`, {
        headers: { "devstudio-verified-jwt": httpVerifiedJwt },
      })
      .then((x) => x.json())
      .then(projects => {
        // results field is coming from 1.5.0
        console.log('projects', projects)
        return projects['results'] || projects
      });
    },
    getProject: function (id) {
      return fetch(`${apiUrl}/projects/${id}`, {
        headers: { "devstudio-verified-jwt": httpVerifiedJwt },
      }).then((x) => x.json());
    },
    importTask: function (projectId, task) {
      return fetch(`${apiUrl}/projects/${projectId}/import`, {
        method: "post",
        headers: {
          "devstudio-verified-jwt": httpVerifiedJwt,
          "Content-type": "application/json",
        },
        body: JSON.stringify(task),
      });
    },
  };
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
  ls,
  config,
};
