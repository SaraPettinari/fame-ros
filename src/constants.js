const BPMN = {
    definitions: 'bpmn:definitions',
    collaboration: 'bpmn:collaboration',
    participant: 'bpmn:participant',
    process: 'bpmn:process',
    signals: 'bpmn:signal',
    subProcesses: 'bpmn:subProcess',
    callActivity: 'bpmn:callActivity',
    extensionElements: 'bpmn:extensionElements',
    dataObjs: 'data:parameters',
    data: 'data:parameter',
    ros_type: 'ros:message',
    ros_payload: 'ros:payload',
    ros_data: 'ros:parameter',
    ros_service: 'ros:service',
    design : 'bpmndi:BPMNDiagram'
  }

const DATA = {
  data_in : 'bpmn:DataInputAssociation',
  data_out : 'bpmn:DataOutputAssociation',
  data_obj: 'bpmn:dataObjectReference'
}

const options = {
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    stopNodes: ["*.bpmn:callActivity"]
  };

const PREFIX = {
  name: '@_name',
  value: '@_value',
  text: '#text'
}

module.exports =  { BPMN, options, PREFIX , DATA}