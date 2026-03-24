'use strict';
const rclnodejs = require('rclnodejs');
const xml2json = require('xml2json')
const { BPMN, options, PREFIX, DATA } = require('./constants')
const { js2xml, json2xml } = require('xml-js');


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
        var jsonbpmn = JSON.parse(xml2json.toJson(xml))

        var process_definition = jsonbpmn[BPMN.definitions]
        var process_participants = process_definition[BPMN.collaboration][BPMN.participant]

        /** 
         * If there is only a robot in the collaboration
        */
        if(!Array.isArray(process_participants)){
            process_participants = [process_participants]
        }

        // for each participant, split the collaboration in the collaboration
        process_participants.forEach((process) => {
            const tempProcess = {... process}
            const tempDefinition = structuredClone(process_definition)

            process_dict[process.processRef] = {
                [BPMN.definitions] : tempDefinition
            }

            process_dict[process.processRef][BPMN.definitions][BPMN.collaboration][BPMN.participant] = tempProcess
            process_dict[process.processRef]['name'] = process.name // to ensure proper robot name assignment

        })
        

        // creation of a dictionary {robot_id: bpmn_process, ...}
        Object.keys(process_dict).forEach(element => {
            const def = process_dict[element][BPMN.definitions]

            def[BPMN.signals] = process_definition[BPMN.signals]
            if(!Array.isArray(def[BPMN.process])){
                def[BPMN.process] = [def[BPMN.process]]
            }
            let curr_process = def[BPMN.process].find(p => p.id == element)
            curr_process['isExecutable'] = true

            process_dict[element][BPMN.definitions][BPMN.process] = curr_process;
            def[BPMN.process] = curr_process

            // remove design information
            if (def[BPMN.design]) {
                delete def[BPMN.design]
            }
            //console.log(Object.keys(def))

            var conv_xml = xml2json.toXml(process_dict[element])

            var robot = process_dict[element]['name'].toUpperCase();
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
    node.getLogger().info('Robot name: ' + robot)
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