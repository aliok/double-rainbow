const express = require('express');
const bodyParser = require('body-parser');
const kafka = require('kafka-node');

const kafkaHost = process.env['KAFKA_HOST'];
if (!kafkaHost) {
    console.log("KAFKA_HOST env var is not defined");
    process.exit();
}

const kafkaTopic = process.env['KAFKA_TOPIC'];
if (!kafkaTopic) {
    console.log("KAFKA_TOPIC env var is not defined");
    process.exit();
}

// how much time should this app wait before sending a message to Kafka when it receives a CloudEvent
let hold = process.env['HOLD'];
if (!hold) {
    console.log("HOLD env var is not defined or it is 0, going to add messages to Kafka topic immediately");
    hold = 0;
}

let latency = process.env['LATENCY'];
if (!latency) {
    console.log("LATENCY env var is not defined or it is 0, going to response the requests immediately");
    latency = 0;
}

console.log("Creating Kafka client");
const client = new kafka.KafkaClient({
    kafkaHost: kafkaHost
});

console.log("Creating producer");
const producer = new kafka.HighLevelProducer(client, {
    requireAcks: 0,     // disabled to send many messages at once
});

producer.on('error', function (err) {
    console.log("Producer error");
    console.log(err);
    process.exit();
});

producer.on('ready', function (err) {
    if (err) {
        console.error('Error waiting for producer to be ready', err);
    } else {
        console.log('Producer ready, starting webserver');

        const app = express();

        app.use(bodyParser.raw({
            inflate: true, limit: '1000kb', type: function (req) {
                return true
            }
        }));

        app.all('*', function (req, res) {
            console.log("=======================");
            console.log("Request headers:");
            console.log(req.headers)
            console.log("\nRequest body - raw:");
            console.log(req.body)
            console.log("\nRequest body - to string:");
            console.log(String(req.body))
            console.log("=======================\n");

            console.log("HOLD " + hold + " ms");

            setTimeout(function () {
                producer.send([{
                    topic: kafkaTopic,
                    messages: 'a-processor ' + req.body
                }], function (err) {
                    if (err) {
                        console.log('Error sending message ');
                        console.log(err);
                    }
                });

                console.log("SLEEP " + latency + " ms");
                setTimeout(function () {
                    res.status(202).send('');
                }, latency);
            }, hold);

        });


        app.listen(8080, () => {
            console.log('a-processor');
            console.log('App listening on :8080');
        });

    }
});


registerGracefulExit();

function registerGracefulExit() {
    let logExit = function () {
        console.log("Exiting");
        process.exit();
    };

    // handle graceful exit
    //do something when app is closing
    process.on('exit', logExit);
    //catches ctrl+c event
    process.on('SIGINT', logExit);
    process.on('SIGTERM', logExit);
    // catches "kill pid" (for example: nodemon restart)
    process.on('SIGUSR1', logExit);
    process.on('SIGUSR2', logExit);
}
