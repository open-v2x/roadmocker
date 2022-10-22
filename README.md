# RSE Simulator

This is a RSE Simulator based on MQTT websocket client using mqtt.js. You can use it to simulate RSU
devices connections, subscriptions, publishing messages, etc... with the MQTT servers.

## Build image & deploy

```bash
DOCKER_NAME=roadmocker
DOCKER_IMAGE=openv2x/${DOCKER_NAME}

docker build -t ${DOCKER_IMAGE} -f Dockerfile ..
docker push ${DOCKER_IMAGE}

docker stop ${DOCKER_NAME}; docker rm ${DOCKER_NAME}
docker rmi ${DOCKER_IMAGE}
docker pull ${DOCKER_IMAGE}
docker run -d --name ${DOCKER_NAME} -p 6688:80 ${DOCKER_IMAGE}
curl http://localhost:6688/
```
