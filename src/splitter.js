'use strict';
const rclnodejs = require('rclnodejs');
const fs = require('fs');
const xml2json = require('xml2json')


var source = '';
var process_path = '/home/ubuntu/mbros/fame_engine/process/';
var process_dict = {};
var process_robot = {};

const definitions = 'bpmn:definitions';
const collaboration = 'bpmn:collaboration';
const participant = 'bpmn:participant';
const processes = 'bpmn:process';
const signals = 'bpmn:signal';

fs.readFile(process_path + 'simple_scenario.bpmn', 'utf8', (err, data) => {
    if (err) {
        console.error(err)
        return
    }
    source = data;
})


function splitter() {
    var xml = source;
    var jsonstring = xml2json.toJson(xml)
    var jsonbpmn = JSON.parse(jsonstring)

    var process_definition = jsonbpmn[definitions]
    var process_participants = process_definition[collaboration][participant]

    for (let i = 0; i < process_participants.length; i++) {
        var process = process_participants[i]
        var p = structuredClone(process)
        var d = structuredClone(process_definition)
        process_dict[process.processRef] = {};
        process_dict[process.processRef][definitions] = d;
        process_dict[process.processRef][definitions][collaboration][participant] = p;
    }

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

}

function publish_msg(node, robot, bpmn) {
    var publisher = node.createPublisher('std_msgs/msg/String', robot + '/bpmn_process');

    setTimeout(function () {
        publisher.publish(bpmn);
        console.log(`Publishing process of ${robot}`);
    }, 2000);
}

rclnodejs.init().then(() => {
    splitter();
    const node = new rclnodejs.Node('splitter_node');
    Object.keys(process_robot).forEach(robot => {
        var bpmn = process_robot[robot]
        publish_msg(node, robot, bpmn)
    });

    node.spin();
});