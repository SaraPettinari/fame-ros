'use strict';

const { Engine } = require('bpmn-engine');
const bent = require('bent');
const rclnodejs = require('rclnodejs');
const { EventEmitter } = require('events');
const listener = new EventEmitter();
const { BPMN, options, PREFIX, DATA } = require('./constants')

const { XMLParser, XMLBuilder } = require("fast-xml-parser");


var topic_dict = {};
var engine_env = {};
var service_dict = {};


const parser = new XMLParser(options);
const builder = new XMLBuilder(options);


function getProcess(dict_source) {
  return dict_source[BPMN.definitions][BPMN.process]
}

function handleCallActivity(dict_source) {
  var callActivity = getProcess(dict_source)[BPMN.callActivity]//extract the process
  var caProcess = {}

  function processCallActivityElement(element) {
    var name = element[PREFIX.name];
    if (!caProcess.hasOwnProperty(name)) {
      var elProcess = element[PREFIX.text].split("process=\"")[1].split("</callActivity:process>")[0].slice(0, -2);
      caProcess[name] = elProcess;
    }
  }

  // Handle both array and single object cases
  if (Array.isArray(callActivity)) {
    callActivity.forEach(processCallActivityElement);
  } else {
    processCallActivityElement(callActivity);
  }

  return caProcess;
}



/**
 * Create an object from the bpmn process model
 * @param {*} source bpmn source
 * @returns 
 */
function getSourceObj(source) {
  var xml = source;
  var process_result = {}

  try {

    let jsonbpmn = parser.parse(xml);

    Object.keys(jsonbpmn).forEach(element => {
      var el = jsonbpmn[element]
      process_result[element] = el

    });
  } catch (error) {
    console.error('Parsing Error of the BPMN process model')
    console.log(error)
  }
  return process_result
}

/**
 * Return the received bpmn
 * @param {*} bpmn_source 
 */
function setSource(bpmn_source) {
  var source = '';
  if (bpmn_source.data)
    source = bpmn_source.data;
  else
    source = bpmn_source;
  return source;
}

/**
 * Create the dt message in the form: element_id/status/instance_id
 * 
 * @param {*} element element identifier
 * @param {*} status execution status
 * @param {*} instance process instance identifier
 * @returns 
 */
function createDtMsg(element, status, instance) {
  var res_msg = element + '/' + status + '/' + instance
  return res_msg
}

rclnodejs.init().then(() => {
  //start ROS node
  const node = new rclnodejs.Node('engine_node');
  var process_name = node.namespace().replace('/', '');

  node.createSubscription('std_msgs/msg/String', 'bpmn_process', (msg) => {
    node.getLogger().info(`Received process for ${process_name}`)

    // create publisher over the /fame_dt topic
    var element_publisher = node.createPublisher('std_msgs/msg/String', '/fame_dt');

    var bpmn_data = setSource(msg)


    //mergeCallActivity();

    var tstart = 0;
    var tfinish = 0;

    var source_obj = getSourceObj(bpmn_data)

    // append call activity to the main process
    if (bpmn_data.includes(BPMN.callActivity)) {
      var caProcess = handleCallActivity(source_obj)
      Object.keys(caProcess).forEach(element => {
        var process = caProcess[element]
        bpmn_data = bpmn_data.replace(process, ' {{ }} ')
        process = process.replaceAll("bpmn2", "bpmn")
        var end = bpmn_data.indexOf('</bpmn:definitions>')
        bpmn_data = [bpmn_data.slice(0, end), process, bpmn_data.slice(end)].join('')
      });
    }

    node.getLogger().info(bpmn_data)

    // initialization of the engine
    const engine = new Engine({
      name: 'fame',
      source: bpmn_data,
      moddleOptions: {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      },
      extensions: {
        camunda: camundaExtProperties,
      }
    });

    // --- ELEMENT ENACTMENT ---

    listener.on('flow.take', (flow) => {
      console.log(`flow.take <${flow.id}> was taken`);
      var message = createDtMsg(flow.id, 'take', '1')
      element_publisher.publish(message)
    });

    listener.on('activity.start', (activity) => {
      if (tstart == 0) {
        tstart = activity.messageProperties.timestamp;
      }
      handleDataObj(activity, source_obj);
      console.log(`activity.start <${activity.id}> was taken`);
      var message = createDtMsg(activity.id, 'start', '1')
      element_publisher.publish(message)

      if (activity.type.includes('Service') && Object.keys(service_dict).includes(activity.id)) {
        console.log(`! Intercepted a ROS service task ${activity.id} !`);

        const { name, type, payload } = service_dict[activity.id];
        const client = node.createClient(type, name);

        console.log(`-> Calling service: ${name}`);

        client.sendRequest(payload, (response) => {
          if (response.error) {
            console.error(`Error in service call for ${activity.id}: ${response.error}`);
            activity.signal({ forcedResult: `error: ${response.error}` });
          } else {
            console.log(`Received response: ${response}`);
            activity.signal({ forcedResult: `completed ${activity.id} with response ${response}` });
          }

          // Cleanup client if applicable
          if (client.close) client.close();
        });
      }
    });

    listener.on('activity.end', (activity) => {
      tfinish = activity.messageProperties.timestamp;
      addVars(activity.environment.variables); // add activity variables to global ones
      engine_env = engine.environment;
      var message = createDtMsg(activity.id, 'stop', '1')
      element_publisher.publish(message)
      //console.log('HERE:', engine.environment.services);
      //console.log(`activity.end <${activity.id}> was released`);
    });


    listener.on('activity.wait', (wait) => {
      //var message = createDtMsg(wait.id, 'wait', '1')
      //element_publisher.publish(message)
      console.log(`wait <${wait.id}> was taken`);
    });
    /*
        listener.on('activity.throw', (throwev) => {
          console.log(`throw <${throwev.id}> was taken`);
        });
    
        listener.on('activity.error', (errorev) => {
          console.log(`error <${errorev.id}> was taken`);
        });
        */

    /**
     * Add global variables
     * @param {*} var_activity  executed activity
     */
    function addVars(var_activity) {
      const envVars = engine.environment.variables;
      const excludedKeys = new Set(['ros_node', 'fields', 'content', 'properties']);

      Object.keys(var_activity).forEach(element => {
        if (!excludedKeys.has(element)) {
          if (!(element in envVars)) {
            const vs = { [element]: var_activity[element] };
            engine.environment.assignVariables(vs);
          }
        }
      });
    }


    /**
     * Management of signal throwing
     */
    engine.broker.subscribeTmp('event', 'activity.signal', (routingKey, msg) => { // routingKey = activity.signal
      let topic_name = msg.content.name
      let message_type;
      let message_payload;
      let check = false;
      //console.log(msg);
      const regexpr = /\${(.*?)\}/g; // all variables are identified through ${...}

      for (let key in topic_dict) {
        if (key === topic_name) {
          message_type = topic_dict[key][0];
          message_payload = topic_dict[key][1];
          node.getLogger().info(topic_dict + ' <--- ')

          var tempvar = message_payload.match(regexpr);
          // check if there are variables that needs a value assignment
          if (tempvar) {
            for (let i = 0; i < tempvar.length; i++) {
              var val = tempvar[i];
              if (val.startsWith('$')) {
                var variable = val.substring(2, val.length - 1); // removes ${}
                //console.log(engine_env.variables);
                var value = engine_env.variables[variable];
                //console.log(value);
                message_payload = message_payload.replace(val, value); // replace variable with value
                topic_dict[key][1] = message_payload; // update topic dictionary
              }
            }
          }
          check = true;
          break;
        }
      }
      // Publish ros topic
      if (check) {
        engine.execution.signal(msg.content.message, { ignoreSameDefinition: true });
        console.log(`Publishing message on ${topic_name}: ` + message_payload);
        const publisher = node.createPublisher(message_type, '/' + topic_name);

        //var message_obj = JSON.parse(message_payload); // conversion from string to obj

        publisher.publish(message_payload);
      }
    }, { noAck: true });


    engine.execute({
      listener,
      variables: {
        ros_node: node
      },
      services: {
        get: bent('json'),
        set,
      },
    });

    engine.on('end', (execution) => {
      console.log('Ended:', process_name);
    });

    function set(activity, name, value) {
      activity.logger.debug('set', name, 'to', value);
    }

    /**
     * Manages camunda external properties
     * @param {*} activity 
     */
    function camundaExtProperties(activity) {
      if (!activity.behaviour.extensionElements) return;
      var msg_type = ''; // message type
      var ref_topic = ''; // topic name
      var msg_payload = ''; // massage payload

      if (activity.behaviour.extensionElements.values) {
        for (const extn of activity.behaviour.extensionElements.values) {
          if (activity.type.includes('Event')) {

            if (extn.$type === BPMN.ros_type) {
              ref_topic = activity.name;
              msg_type = extn.type;
            }
            if (extn.$type === BPMN.ros_payload) {
              var payload = extn.$children
              if (payload.length > 1) {
                msg_payload += '"{ '
                let payloadParts = [];

                payload.forEach((data) => {
                  if (data.$type === BPMN.ros_data) {
                    payloadParts.push(`${data.name} ${data.value}`);
                  }
                });

                msg_payload += payloadParts.join(', ');

                msg_payload += ' }"';
              }
              else {
                payload.forEach(data => {
                  if (data.$type === BPMN.ros_data) {
                    msg_payload = data.value
                  }
                });
              }
            }

            if (msg_payload != '') { // if it is a throw signal
              topic_dict[ref_topic] = [msg_type, msg_payload]
            } else { // it is a catch
              // create a subscription to the topic
              console.log('Subscribed to: ', ref_topic);
              // added '/' to avoid remap of topics
              node.createSubscription(msg_type, '/' + ref_topic, (msg) => { //create ROS subscription
                console.log(`Received message: `, msg);
                //activity.environment.assignVariables();
                Object.keys(msg).forEach(element => {
                  // assing to global varibles the payload of the signal
                  const find = Object.keys(activity.environment.variables).find(v => v.startsWith(element));
                  if (find) { // check if there is a matching variable
                    var value = msg[element];
                    activity.environment.variables[find] = value;
                  }
                });
                activity.getApi().sendApiMessage('signal'); // forces signal catching
              });
            }
          }
          else if (activity.type.includes('Service')) {
            if (!Object.keys(service_dict).includes(activity.id)) {
              service_dict[activity.id] = {
                name: '', type: '', payload: ''
              }
            }
            if (extn.$type === BPMN.ros_service) {
              service_dict[activity.id].name = extn.name;
              service_dict[activity.id].type = extn.type;
            }
            if (extn.$type === BPMN.ros_payload) {
              service_dict[activity.id].payload = extn.data;
            }
          }

        }

      }
    }

    /**
     * Assigns data object values to global variables
     * @param {*} activity 
     */
    function handleDataObj(activity, source) {
      if (!activity.owner.behaviour.dataInputAssociations) {
        if (!activity.owner.behaviour.dataOutputAssociations) return; // check if there are associated data objects
      }

      var conversion_obj = source;
      var processObjs = getProcess(conversion_obj);

      // data objects extraction
      var inputs = activity.owner.behaviour.dataInputAssociations || []
      var outputs = activity.owner.behaviour.dataOutputAssociations || []

      var dataObjs = inputs.concat(outputs);

      dataObjs.forEach(element => {
        var id = ''
        if (element.type == DATA.data_in)
          id = element.behaviour.sourceRef.id
        else if (element.type == DATA.data_out)
          id = element.behaviour.targetRef.id

        var objList = processObjs[DATA.data_obj]
        var currObj = {}

        if (Array.isArray(objList)) {
          currObj = objList.find((data) => data.id == id);
        }
        else
          currObj = objList

        var extension = currObj[BPMN.extensionElements]?.[BPMN.dataObjs]?.[BPMN.data]
        if (!extension) {
          console.error('No extension found for', id)
          return
        }


        if (Array.isArray(extension)) {
          extension.forEach(data => {
            var variable = new Object();
            variable[data.name] = data.value

            // add data object variables to the global environment
            activity.environment.assignVariables(variable);
            engine.environment.assignVariables(variable);
          });
        } else {
          var variable = new Object();
          variable[extension[PREFIX.name]] = extension[PREFIX.value]

          // add data object variables to the global environment
          activity.environment.assignVariables(variable);
          engine.environment.assignVariables(variable);
        }
      });
    }
  });
  node.spin();
});

