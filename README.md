## Flow

```
Message source  ==>  KafkaSource (a)  ==>  Service (a-processor)  ==>  KafkaSource (b) ==>  Service (b-sink)
```

## Prerequisites

* Docker
* `kind`: https://kind.sigs.k8s.io/
* `kubectl`: https://kubernetes.io/docs/tasks/tools/
* `stern`: https://github.com/wercker/stern
* A recent version of NodeJS (demo presented with Node v12.14.1)

## Prepare

Start your cluster:

```bash
kind create cluster
```

Install Knative, Strimzi; create a Kafka cluster:

```bash
./hack/01-kn-serving.sh && ./hack/02-kn-eventing.sh && ./hack/03-strimzi.sh && ./hack/04-kn-kafka.sh
```

Build images:

```bash
## TODO DOCKER_HUB_USERNAME=<your username here>
DOCKER_HUB_USERNAME=aliok

docker build a-processor -t docker.io/${DOCKER_HUB_USERNAME}/a-processor
docker push docker.io/${DOCKER_HUB_USERNAME}/a-processor

docker build b-sink -t docker.io/${DOCKER_HUB_USERNAME}/b-sink
docker push docker.io/${DOCKER_HUB_USERNAME}/b-sink

docker build message-source -t docker.io/${DOCKER_HUB_USERNAME}/message-source
docker push docker.io/${DOCKER_HUB_USERNAME}/message-source
```

## Run the demo

### Setting up common resources

Create the namespace, the source and the sink:

```bash
kubectl apply -f config/01-namespace.yaml
kubectl apply -f config/02-topics.yaml
kubectl apply -f config/03-a-processor.yaml
kubectl apply -f config/04-b-sink.yaml
kubectl apply -f config/05-kafka-sources.yaml
```

Start watching the Knative service logs:

```bash
stern -n my-namespace a-processor
stern -n my-namespace b-sink
```

### Sending single message

Produce some messages in another terminal:
```bash
kubectl -n kafka exec -it my-cluster-kafka-0 -- bin/kafka-console-producer.sh --broker-list localhost:9092 --topic topic-a
```

You should see the messages you produced in the sink logs in the previous terminal, but as CloudEvents.

Now, stop producing messages since we are going to send heavy load to Kafka.

### Sending many messages

In another terminal, start watching the pods:

```bash
watch kubectl get pods -n my-namespace
```

Create the message-source job, which sends many messages to Kafka:

```bash
kubectl apply -f config/06-message-source.yaml
```

You should see a lot of pods coming up.

## Clean up

```bash
kubectl delete -f config/

kind delete cluster
```
