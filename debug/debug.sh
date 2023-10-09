#!/bin/bash
set -e
export NAMESPACE=${NAMESPACE:-teknoir-ai}
export LS_HOST=${LS_HOST:-"localhost:8086"}
export CONTEXT=${CONTEXT:-"gke_teknoir_us-central1-c_teknoir-cluster"}
export DOMAIN="teknoir.cloud"
export PORT=${PORT:-"8088"}

trap "exit" INT TERM ERR
trap "kill 0" EXIT

kubectl --context ${CONTEXT} -n ${NAMESPACE} port-forward svc/label-studio 8086:80 &
kubectl --context ${CONTEXT} -n teknoir port-forward svc/profiles-kfam 8087:8081 &

sleep 5

npm start
