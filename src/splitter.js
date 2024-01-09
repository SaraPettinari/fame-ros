'use strict';
const rclnodejs = require('rclnodejs');
const xml2json = require('xml2json')


const definitions = 'bpmn:definitions';
const collaboration = 'bpmn:collaboration';
const participant = 'bpmn:participant';
const processes = 'bpmn:process';
const signals = 'bpmn:signal';


/**
 * Extraction of the bpmn process models from the received data
 * @param {*} node the ROS node
 */
function splitter(node) {

    // creation of the subscription over the /collaboration_diagram topic
    node.createSubscription('std_msgs/msg/String', '/collaboration_diagram', (msg) => {
        var process_dict = {};
        var process_robot = {};

        node.getLogger().info(`Received collaboration diagram`);
        var xml = msg.data;
        // conversion to an object
        var jsonstring = xml2json.toJson(xml)
        var jsonbpmn = JSON.parse(jsonstring)

        var process_definition = jsonbpmn[definitions]
        var process_participants = process_definition[collaboration][participant]

        // for each participant, split the collaboration in the collaboration
        for (let i = 0; i < process_participants.length; i++) {
            var process = process_participants[i]
            var tempProcess = structuredClone(process)
            var tempDefinition = structuredClone(process_definition)
            process_dict[process.processRef] = {};
            process_dict[process.processRef][definitions] = tempDefinition;
            process_dict[process.processRef][definitions][collaboration][participant] = tempProcess;
        }

        // creation of a dictionary {robot_id: bpmn_process, ...}
        Object.keys(process_dict).forEach(element => {
            process_dict[element][definitions][signals] = process_definition[signals]
            var extract_process = process_dict[element][definitions][processes]
            //console.log(extract_process)
            var curr_process = extract_process.find(p => p.id == element);
            process_dict[element][definitions][processes] = curr_process;
            curr_process['isExecutable'] = true
            var x = process_dict[element];
            var conv_xml = xml2json.toXml(x)

            var robot = element.replace('Process_', '').toUpperCase();
            process_robot[robot] = conv_xml;
        })

        // publication of the process models
        if (process_robot) {
            Object.keys(process_robot).forEach(robot => {
                var bpmn = process_robot[robot]
                publish_msg(node, robot, bpmn)
            });
        }
    });
}

/**
 * Publishes bpmn process models over the /bpmn_process ros topic
 * @param {*} node the ROS node
 * @param {*} robot robot identifier
 * @param {*} bpmn robot process model
 */
function publish_msg(node, robot, bpmn) {
    var publisher = node.createPublisher('std_msgs/msg/String', robot + '/bpmn_process');

    setTimeout(function () {
        publisher.publish(bpmn);
        console.log(`Publishing process of ${robot}...`);
    }, 2000);
}

/**
 * Splitter node initialization
 */
rclnodejs.init().then(() => {
    const node = new rclnodejs.Node('splitter_node');
    splitter(node);

    node.spin();
});