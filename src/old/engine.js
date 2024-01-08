'use strict';

const rclnodejs = require('rclnodejs');
const { Engine } = require('bpmn-engine');
const { EventEmitter } = require('events');
const listener = new EventEmitter();
const fs = require('fs');
//const source = fs.readFile('/home/ubuntu/mbros/fame_engine/process/process.bpmn', "UTF-8");
var source = '';

fs.readFile('/home/ubuntu/mbros/fame_engine/process/process.bpmn', 'utf8' , (err, data) => {
    if (err) {
      console.error(err)
      return
    }
    source = data;
  })

var tstart = 0;
var tfinish = 0;

    ; (async function main() {

        example();

    })().catch(() => {
        process.exitCode = 1
    })


// Create a node that publisher a msg to the topic 'foo' every 1 second.
// View the topic from the ros2 commandline as shown below:
//   ros2 topic echo foo std_msgs/msg/String
async function example() {

    await rclnodejs.init();
    let node = rclnodejs.createNode('EngineController');

    // Create main working components here, e.g., publisher, subscriber, service, client, action
    // For example, a publisher sending a msg every 1 sec
    /*    let publisher = node.createPublisher('std_msgs/msg/String', 'foo');
        let cnt = 0;
        let msg = rclnodejs.createMessageObject('std_msgs/msg/String');
        let timer = node.createTimer(1000, () => {
            msg.data = `msg: ${++cnt}`
            publisher.publish(msg);
        });
    */

    const engine = Engine({
        name: 'execution example',
        source,
        variables: {

        }
    });

    listener.on('flow.take', (flow) => {
        console.log(`flow.take <${flow.id}> was taken`);
    });

    //Inizio attivita'
    listener.on('activity.start', (activity) => {
        if (tstart == 0) tstart = activity.messageProperties.timestamp;
        console.log(`activity.start <${activity.id}> was taken`);
    });

    //Fine attivita'
    listener.on('activity.end', (activity) => {
        tfinish = activity.messageProperties.timestamp;
        console.log(`activity.end <${activity.id}> was released`);
    });

    //User task
    listener.on('activity.wait', (wait) => {
        console.log(`wait <${wait.id}> was taken`);
    });

    listener.on('activity.throw', (throwev) => {
        console.log(`throw <${throwev.id}> was taken`);
    });

    listener.on('activity.error', (errorev) => {
        console.log(`error <${errorev.id}> was taken`);
    });

    engine.on('end', (execution) => {
        console.log("### Execution completed in " + JSON.stringify(tfinish - tstart) + "ms ###");
    });

    engine.on('stop', (execution) => {
        console.log('stopped');
    });

    engine.on('error', (execution) => {
        console.log('error');
    });

    engine.execute((err, execution) => {
        listener,
        console.log('Execution completed with id', 1);
    });

      // Manage Camunda extensions
  function camundaExt(activity) {
    if (!activity.behaviour.extensionElements) return;
    let msg_type; // message type
    let ref_topic; // topic name
    let msg_payload; // massage payload
    for (const extn of activity.behaviour.extensionElements.values) {
      if (extn.$type === 'camunda:inputOutput') {
        let io = extn.$children[0]; // input-output data
        // save input parameters in the topic dictionary
        if (io.$type === 'camunda:inputParameter') {
          let data = io.$children[0].$children;

          ref_topic = io.name;
          msg_type = data[0].$body;
          msg_payload = data[1].$body;

          topic_dict[ref_topic] = [msg_type, msg_payload]
        }
        // save output parameters as global variables
        /*else if (io.$type === 'camunda:outputParameter') {
          var variable = io.name;
          activity.environment[variable];
          variables_dict[variable] = activity.environment[variable]
          console.log(variables_dict);
        }*/
      }
    }
  }

    rclnodejs.spin(node);
}
